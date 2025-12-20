import ora from "ora";
import type { Ora } from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import { getStagedDiff, hasStagedChanges } from "./git.js";
import {
  generateCommitMessage,
  generateSummary,
  generateChangelogEntry,
} from "./ai.js";
import { askToCopyToClipboard, execAsync } from "./utils.js";
import { createChangelogEntryAndMaybePush } from "./changelog.js";
import { log } from "./log.js";

export async function getRepoDiff(spinner: Ora) {
  const staged = await hasStagedChanges();

  if (!staged) {
    spinner.fail(log.warn("No staged changes. Git has nothing to work with."));

    const { confirm } = await inquirer.prompt({
      name: "confirm",
      type: "confirm",
      message: "Stage all files now?",
      default: false,
    });

    if (!confirm) {
      console.log(log.info("Aborted. No changes, no output."));
      process.exit(0);
    }

    spinner.start(log.step("Staging files..."));
    await execAsync("git add .");
    spinner.succeed(log.ok("Files staged."));
  }

  spinner.start(log.step("Reading staged diff..."));
  const diff = await getStagedDiff();

  if (!diff) {
    spinner.fail(log.err("Failed to read diff. Something broke."));
    process.exit(1);
  }

  spinner.succeed(log.ok("Diff loaded."));
  return diff;
}

export async function runGenerateCommit(
  apiKey: string,
  model: string,
  args: string[]
) {
  const spinner = ora(log.step("Scanning staged changes...")).start();
  const diff = await getRepoDiff(spinner);

  spinner.text = log.step(`Feeding diff to ${model}...`);
  const message = await generateCommitMessage(apiKey, model, diff);
  console.log(
    "\n" +
      chalk.dim("─".repeat(60)) +
      "\n" +
      chalk.bold.white("Proposed Commit Message:\n") +
      chalk.white(message) +
      "\n" +
      chalk.dim("─".repeat(60)) +
      "\n"
  );

  await askToCopyToClipboard(message, spinner);

  const shouldCommit = args.includes("--commit");
  const shouldPush = args.includes("--push");

  if (!shouldCommit) {
    const { confirm } = await inquirer.prompt({
      name: "confirm",
      type: "confirm",
      message: "Create commit with this message?",
      default: false,
    });

    if (!confirm) {
      console.log(log.info("Commit cancelled."));
      return;
    }
  }

  try {
    const safeMsg = message.replace(/"/g, '\\"');
    spinner.start(log.step("Creating commit..."));
    await execAsync(`git commit -m "${safeMsg}"`);
    spinner.succeed(log.ok("Commit created."));
  } catch (err) {
    spinner.fail(log.err("Commit failed."));
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  if (shouldPush) {
    spinner.start(log.step("Resolving current branch..."));

    try {
      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD");
      const branch = stdout.trim();

      if (!branch) throw new Error("Unable to determine branch name");

      spinner.text = log.step(`Pushing ${branch} → origin...`);
      await execAsync(`git push origin ${branch}`);
      spinner.succeed(log.ok(`Branch ${branch} pushed.`));
    } catch (err) {
      spinner.fail(log.err("Push failed."));
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  }
}

export async function runGenerateSummary(apiKey: string, model: string) {
  const spinner = ora(log.step("Scanning staged changes...")).start();
  const diff = await getRepoDiff(spinner);

  spinner.text = log.step(`Generating summary via ${model}...`);
  const summary = await generateSummary(apiKey, model, diff);
  spinner.succeed(log.ok("Summary generated."));

  askToCopyToClipboard(summary, spinner);

  console.log(
    "\n" +
      chalk.bold.cyan("Summary\n") +
      chalk.dim("─".repeat(40)) +
      "\n" +
      summary +
      "\n" +
      chalk.dim("─".repeat(40)) +
      "\n"
  );
}

export async function runGenerateChangelog(
  apiKey: string,
  model: string,
  args: string[]
) {
  const spinner = ora(log.step("Scanning staged changes...")).start();
  const diff = await getRepoDiff(spinner);

  spinner.text = log.step("Drafting changelog entry...");
  const entry = await generateChangelogEntry(apiKey, model, diff);
  spinner.succeed(log.ok("Changelog entry generated."));

  const createNew = args.includes("--new");
  const push = args.includes("--push");

  await createChangelogEntryAndMaybePush(entry, {
    newFile: createNew,
    push,
  });

  console.log(log.ok("Changelog updated."));
}
