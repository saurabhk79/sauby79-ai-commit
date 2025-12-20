import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { isGitRepo } from "./git.js";
import inquirer from "inquirer";
import { log } from "./log.js";
import type { Ora } from "ora";
import clipboard from "clipboardy";

export const execAsync = promisify(exec);

export async function ensureGitRepoOrExit() {
  const isRepo = await isGitRepo();

  if (isRepo) {
    return;
  }

  console.error(log.err("This is not a git repository."));

  const { confirm } = await inquirer.prompt({
    name: "confirm",
    type: "confirm",
    message: "Initialize a git repository here?",
    default: true,
  });

  if (!confirm) {
    console.error(log.err("Git repository required. Exiting."));
    process.exit(1);
  }

  try {
    console.log(log.step("Initializing git repository..."));
    await execAsync("git init");
    console.log(log.ok("Git repository initialized."));
  } catch (e) {
    console.error(log.err("Failed to initialize git repository."));
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  }
}

export async function askToCopyToClipboard(message: string, spinner: Ora) {
  const { confirm: copyConfirm } = await inquirer.prompt({
    name: "confirm",
    type: "confirm",
    message: "Copy text?",
  });

  if (copyConfirm) {
    await clipboard.write(message);
    spinner.succeed(log.ok("Commit message generated & copied to clipboard."));
  }
}
