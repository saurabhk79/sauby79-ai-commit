import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { isGitRepo } from "./git.js";

export const execAsync = promisify(exec);

export async function ensureGitRepoOrExit() {
  const ok = await isGitRepo();
  if (!ok) {
    console.error(
      chalk.red("Not a git repository. This tool must be run inside a git repo.")
    );
    process.exit(1);
  }
}