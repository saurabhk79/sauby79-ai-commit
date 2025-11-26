#!/usr/bin/env node

import chalk from "chalk";
import ora from "ora";
import * as dotenv from "dotenv";
import clipboard from "clipboardy";
import inquirer from "inquirer";
import { getStagedDiff, hasStagedChanges, isGitRepo } from "./git.js";
import {
  generateCommitMessage,
  generateSummary,
  generateChangelogEntry,
} from "./ai.js";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir, stat } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Load environment variables from a .env file if present
dotenv.config();

const USAGE_DIR = path.join(process.cwd(), ".ai-commit");
const USAGE_FILE = path.join(USAGE_DIR, "usage.json");

async function ensureUsageFile() {
  try {
    await stat(USAGE_DIR);
  } catch (e) {
    await mkdir(USAGE_DIR, { recursive: true });
  }

  try {
    await stat(USAGE_FILE);
  } catch (e) {
    await writeFile(
      USAGE_FILE,
      JSON.stringify({ total: 0, commands: {} }, null, 2)
    );
  }
}

async function incrementUsage(command: string) {
  try {
    await ensureUsageFile();
    const raw = await readFile(USAGE_FILE, "utf-8");
    const data = JSON.parse(raw);
    data.total = (data.total || 0) + 1;
    data.commands = data.commands || {};
    data.commands[command] = (data.commands[command] || 0) + 1;
    await writeFile(USAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    // best-effort
  }
}

function maskKey(key = "") {
  if (!key) return "(missing)";
  if (key.length <= 8) return `${key.slice(0, 2)}***${key.slice(-2)}`;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

async function ensureGitRepoOrExit() {
  const ok = await isGitRepo();
  if (!ok) {
    console.error(
      chalk.red(
        "Not a git repository. This tool must be run inside a git repo."
      )
    );
    process.exit(1);
  }
}

async function showTokenStatus() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log(chalk.bold("Token status:"));
  console.log("Key:", maskKey(apiKey));
  try {
    await ensureUsageFile();
    const raw = await readFile(USAGE_FILE, "utf-8");
    const data = JSON.parse(raw);
    console.log("Total AI requests this repo:", data.total || 0);
    console.log("Per-command:", data.commands || {});
  } catch (e) {
    console.log(chalk.dim("No usage data available."));
  }
}

async function createChangelogEntryAndMaybePush(
  summary: string,
  options: { newFile?: boolean; push?: boolean }
) {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  const exists = await (async () => {
    try {
      await stat(changelogPath);
      return true;
    } catch {
      return false;
    }
  })();

  if (!exists && !options.newFile) {
    console.log(
      chalk.yellow("CHANGELOG.md not found. Use --new to create a changelog.")
    );
    return false;
  }

  const header = `\n## ${new Date().toISOString().split("T")[0]}\n\n`;
  const content = header + summary + "\n";
  if (!exists) {
    await writeFile(changelogPath, `# Changelog\n\n${content}`);
    console.log(chalk.green("Created CHANGELOG.md and appended entry."));
  } else {
    const prev = await readFile(changelogPath, "utf-8");
    await writeFile(changelogPath, prev + content);
    console.log(chalk.green("Appended entry to CHANGELOG.md."));
  }

  if (options.push) {
    try {
      const { stdout: branchStdout } = await execAsync(
        "git rev-parse --abbrev-ref HEAD"
      );
      const branch = branchStdout.trim();
      await execAsync(
        `git add CHANGELOG.md && git commit -m "chore(changelog): update" && git push origin ${branch}`
      );
      console.log(chalk.green("Pushed changelog update."));
    } catch (e) {
      console.log(
        chalk.red("Failed to commit/push changelog:"),
        (e as Error).message
      );
    }
  }
  return true;
}

async function runGenerateCommit(apiKey: string, args: string[]) {
  const spinner = ora("Reading git diff...").start();

  const staged = await hasStagedChanges();
  if (!staged) {
    spinner.fail("No staged changes.");
    console.log(
      chalk.yellow("Run `git add <files>` before running this tool.")
    );
    process.exit(0);
  }

  const diff = await getStagedDiff();
  if (!diff) {
    spinner.fail("Failed to read diff.");
    process.exit(1);
  }

  spinner.text = "Analyzing changes with OpenRouter AI...";
  const message = await generateCommitMessage(apiKey, diff);
  await clipboard.write(message);
  spinner.succeed("Commit message generated and copied to clipboard!");

  console.log(
    "\n" + chalk.green("--------------------------------------------------")
  );
  console.log(message);
  console.log(
    chalk.green("--------------------------------------------------") + "\n"
  );

  // flags
  const shouldCommit = args.includes("--commit");
  const shouldPush = args.includes("--push");

  if (!shouldCommit) {
    const { confirm } = await inquirer.prompt({
      name: "confirm",
      type: "confirm",
      message: "Create commit with this message now?",
      default: false,
    });
    if (!confirm) return;
  }

  // commit
  try {
    const safeMsg = message.replace(/"/g, '\\"');
    spinner.start("Creating git commit...");
    await execAsync(`git commit -m "${safeMsg}"`);
    spinner.succeed("Committed staged changes.");
    await incrementUsage("generate:commit");
  } catch (err) {
    spinner.fail("Failed to create git commit.");
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  if (shouldPush) {
    spinner.start("Pushing current branch to origin...");
    try {
      const { stdout: branchStdout } = await execAsync(
        "git rev-parse --abbrev-ref HEAD"
      );
      const branch = branchStdout.trim();
      if (!branch) throw new Error("Unable to determine current branch");
      await execAsync(`git push origin ${branch}`);
      spinner.succeed(`Pushed ${branch} to origin.`);
    } catch (err) {
      spinner.fail("Failed to push to origin.");
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  }
}

async function runGenerateSummary(apiKey: string) {
  const spinner = ora("Reading git diff...").start();
  const staged = await hasStagedChanges();
  if (!staged) {
    spinner.fail("No staged changes.");
    console.log(
      chalk.yellow("Run `git add <files>` before running this tool.")
    );
    process.exit(0);
  }
  const diff = await getStagedDiff();
  if (!diff) {
    spinner.fail("Failed to read diff.");
    process.exit(1);
  }
  spinner.text = "Summarizing changes with OpenRouter AI...";
  const summary = await generateSummary(apiKey, diff);
  spinner.succeed("Summary generated.");
  console.log("\n" + chalk.green("---- Summary ----"));
  console.log(summary);
  console.log(chalk.green("-----------------\n"));
  await incrementUsage("generate:summary");
}

async function runGenerateChangelog(apiKey: string, args: string[]) {
  const spinner = ora("Reading git diff...").start();
  const staged = await hasStagedChanges();
  if (!staged) {
    spinner.fail("No staged changes.");
    console.log(
      chalk.yellow("Run `git add <files>` before running this tool.")
    );
    process.exit(0);
  }
  const diff = await getStagedDiff();
  if (!diff) {
    spinner.fail("Failed to read diff.");
    process.exit(1);
  }
  spinner.text = "Generating changelog entry...";
  const summary = await generateChangelogEntry(apiKey, diff);
  spinner.succeed("Changelog entry created.");

  const createNew = args.includes("--new");
  const push = args.includes("--push");
  const ok = await createChangelogEntryAndMaybePush(summary, {
    newFile: createNew,
    push,
  });
  if (ok) await incrementUsage("generate:changelog");
}

async function main() {
  console.log(chalk.bold.blue("AI Commit CLI"));

  const args = process.argv.slice(2);
  const mainCmd = args[0];
  const subCmd = args[1];

  // global token helper
  if (mainCmd === "token" && subCmd === "status") {
    await showTokenStatus();
    process.exit(0);
  }

  if (mainCmd !== "generate") {
    // Offer interactive menu
    console.log(chalk.blue("Welcome to the AI Commit CLI interactive menu."));
    const { action } = await inquirer.prompt({
      name: "action",
      type: "list",
      message: "What would you like to do?",
      choices: [
        { name: "Generate commit message", value: "commit" },
        { name: "Generate summary", value: "summary" },
        { name: "Generate changelog entry", value: "changelog" },
        { name: "Show token status", value: "token" },
      ],
    });

    if (action === "token") {
      await showTokenStatus();
      process.exit(0);
    }

    await ensureGitRepoOrExit();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error(
        chalk.red(
          "OPENROUTER_API_KEY is missing. Set it in environment or .env file."
        )
      );
      process.exit(1);
    }

    if (action === "commit") {
      const { commitNow, push } = await inquirer.prompt([
        {
          name: "commitNow",
          type: "confirm",
          message: "Create commit automatically?",
          default: false,
        },
        {
          name: "push",
          type: "confirm",
          message: "Push after commit?",
          default: false,
        },
      ]);
      const flags = [] as string[];
      if (commitNow) flags.push("--commit");
      if (push) flags.push("--push");
      await runGenerateCommit(apiKey, flags);
    } else if (action === "summary") {
      await runGenerateSummary(apiKey);
    } else if (action === "changelog") {
      const { createNew, push } = await inquirer.prompt([
        {
          name: "createNew",
          type: "confirm",
          message: "Create CHANGELOG.md if missing?",
          default: false,
        },
        {
          name: "push",
          type: "confirm",
          message: "Commit & push changelog?",
          default: false,
        },
      ]);
      const flags = [] as string[];
      if (createNew) flags.push("--new");
      if (push) flags.push("--push");
      await runGenerateChangelog(apiKey, flags);
    }

    process.exit(0);
  }

  // CLI style: ai-commit generate <sub>
  const supported = ["commit", "summary", "changelog"];
  if (!supported.includes(subCmd)) {
    console.log(
      chalk.yellow(
        "Usage: ai-commit generate <commit|summary|changelog> [--commit] [--push] [--new]"
      )
    );
    process.exit(0);
  }

  await ensureGitRepoOrExit();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      chalk.red(
        "OPENROUTER_API_KEY is missing. Set it in environment or .env file."
      )
    );
    process.exit(1);
  }

  if (subCmd === "commit") {
    await runGenerateCommit(apiKey, args.slice(2));
  } else if (subCmd === "summary") {
    await runGenerateSummary(apiKey);
  } else if (subCmd === "changelog") {
    await runGenerateChangelog(apiKey, args.slice(2));
  }
}

main();
