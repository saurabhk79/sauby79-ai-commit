import ora from "ora";
import type { Ora } from "ora";
import chalk from "chalk";
import clipboard from "clipboardy";
import inquirer from "inquirer";
import { getStagedDiff, hasStagedChanges } from "./git.js";
import {
  generateCommitMessage,
  generateSummary,
  generateChangelogEntry,
} from "./ai.js";
import { execAsync } from "./utils.js";
import { createChangelogEntryAndMaybePush } from "./changelog.js";
import { MODEL } from "./config.js";

async function getDiffOrExit(spinner: Ora) {
  const staged = await hasStagedChanges();
  if (!staged) {
    spinner.fail("No staged changes.");
    console.log(
      chalk.yellow("Run `git add <files>` before running this tool."),
    );
    process.exit(0);
  }
  const diff = await getStagedDiff();
  if (!diff) {
    spinner.fail("Failed to read diff.");
    process.exit(1);
  }
  return diff;
}

export async function runGenerateCommit(
  apiKey: string,
  model: string,
  args: string[],
) {
  const spinner = ora("Reading git diff...").start();
  const diff = await getDiffOrExit(spinner);

  spinner.text = `Analyzing changes with ${model}...`;
  const message = await generateCommitMessage(apiKey, model, diff);
  await clipboard.write(message);
  spinner.succeed("Commit message generated and copied to clipboard!");

  console.log("\n" + chalk.green("-".repeat(50)));
  console.log(message);
  console.log(chalk.green("-".repeat(50)) + "\n");

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

  try {
    const safeMsg = message.replace(/"/g, '\\"');
    spinner.start("Creating git commit...");
    await execAsync(`git commit -m "${safeMsg}"`);
    spinner.succeed("Committed staged changes.");
  } catch (err) {
    spinner.fail("Failed to create git commit.");
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  if (shouldPush) {
    spinner.start("Pushing current branch to origin...");
    try {
      const { stdout: branchStdout } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
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

export async function runGenerateSummary(apiKey: string, model: string) {
  const spinner = ora("Reading git diff...").start();
  const diff = await getDiffOrExit(spinner);

  spinner.text = `Summarizing changes with ${model}...`;
  const summary = await generateSummary(apiKey, model, diff);
  spinner.succeed("Summary generated.");

  console.log("\n" + chalk.green("---- Summary ----"));
  console.log(summary);
  console.log(chalk.green("-----------------\n"));
}

export async function runGenerateChangelog(
  apiKey: string,
  model: string,
  args: string[],
) {
  const spinner = ora("Reading git diff...").start();
  const diff = await getDiffOrExit(spinner);

  spinner.text = "Generating changelog entry...";
  const summary = await generateChangelogEntry(apiKey, model, diff);
  spinner.succeed("Changelog entry created.");

  const createNew = args.includes("--new");
  const push = args.includes("--push");

  await createChangelogEntryAndMaybePush(summary, {
    newFile: createNew,
    push,
  });
}
