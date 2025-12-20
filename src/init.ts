import inquirer from "inquirer";
import chalk from "chalk";
import os from "os";
import path from "path";
import { appendFile, readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { log } from "./log.js";

const execAsync = promisify(exec);

export async function runInit() {
  console.log(
    "\n" +
      log.title("Komp CLI — Initialization") +
      "\n" +
      chalk.dim(
        "This will store credentials in your system environment variables."
      ) +
      "\n"
  );

  const answers = await inquirer.prompt([
    {
      name: "apiKey",
      type: "password",
      message: "OpenRouter API key:",
      validate: (input) =>
        input.length > 0 || "API key is required. No key, no magic.",
    },
    {
      name: "model",
      type: "input",
      message: "Model name:",
      default: "openai/gpt-3.5-turbo",
    },
  ]);

  const platform = os.platform();
  console.log(log.step(`Detected platform: ${platform}`));

  if (platform === "win32") {
    await setWindowsEnv(answers.apiKey, answers.model);
  } else {
    await setUnixEnv(answers.apiKey, answers.model);
  }

  console.log(log.ok("Initialization finished."));
}

export async function runUpdate() {
  console.log(
    log.warn("Update just re-runs init and overwrites existing values.")
  );

  const { confirm } = await inquirer.prompt({
    name: "confirm",
    type: "confirm",
    message: "Run initialization now?",
    default: true,
  });

  if (!confirm) {
    console.log(log.info("Update cancelled."));
    return;
  }

  await runInit();
}

async function setWindowsEnv(apiKey: string, model: string) {
  try {
    console.log(log.step("Writing environment variables using setx..."));

    await execAsync(`setx OPENROUTER_API_KEY "${apiKey}"`);
    await execAsync(`setx OPENROUTER_MODEL "${model}"`);

    console.log(
      "\n" +
        log.ok("Environment variables saved.") +
        "\n" +
        chalk.yellow.bold("Restart your terminal for changes to take effect.")
    );
  } catch (error) {
    console.error(log.err("Failed to set environment variables on Windows."));
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

async function setUnixEnv(apiKey: string, model: string) {
  const shell = process.env.SHELL || "/bin/bash";
  const homeDir = os.homedir();
  let rcFile = ".bashrc";

  if (shell.includes("zsh")) {
    rcFile = ".zshrc";
  } else if (shell.includes("bash")) {
    rcFile = ".bashrc";
    if (os.platform() === "darwin" && !shell.includes("zsh")) {
      rcFile = ".bash_profile";
    }
  }

  const rcPath = path.join(homeDir, rcFile);

  const contentToAppend = `
# Added by komp
export OPENROUTER_API_KEY="${apiKey}"
export OPENROUTER_MODEL="${model}"
`;

  try {
    try {
      await readFile(rcPath);
      console.log(log.step(`Updating ${rcPath}...`));
    } catch {
      console.log(log.step(`Creating ${rcPath}...`));
    }

    await appendFile(rcPath, contentToAppend);

    console.log(
      "\n" +
        log.ok(`Variables written to ${rcPath}.`) +
        "\n" +
        chalk.yellow.bold(
          `Run 'source ~/${rcFile}' or restart your terminal to apply changes.`
        )
    );
  } catch (error) {
    console.error(log.err(`Failed to update ${rcFile}.`));
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
