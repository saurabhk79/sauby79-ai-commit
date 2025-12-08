import inquirer from "inquirer";
import chalk from "chalk";
import os from "os";
import path from "path";
import { appendFile, readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runInit() {
  console.log(chalk.blue.bold("AI Commit Initialization (Global Mode)"));
  console.log(
    chalk.dim(
      "This will store your keys permanently in your system environment variables.",
    ),
  );

  const answers = await inquirer.prompt([
    {
      name: "apiKey",
      type: "password",
      message: "Enter your OpenRouter API Key:",
      validate: (input) => input.length > 0 || "API Key is required.",
    },
    {
      name: "model",
      type: "input",
      message: "Enter the Model Name (e.g., openai/gpt-3.5-turbo):",
      default: "openai/gpt-3.5-turbo",
    },
  ]);

  const platform = os.platform();

  if (platform === "win32") {
    await setWindowsEnv(answers.apiKey, answers.model);
  } else {
    await setUnixEnv(answers.apiKey, answers.model);
  }
}

export async function runUpdate() {
  console.log(
    chalk.yellow(
      "To update, simply run 'ai-commit init' again to overwrite the values.",
    ),
  );
  const { confirm } = await inquirer.prompt({
    name: "confirm",
    type: "confirm",
    message: "Run init now?",
    default: true,
  });

  if (confirm) {
    await runInit();
  }
}

// --- Windows ---
async function setWindowsEnv(apiKey: string, model: string) {
  try {
    console.log(
      chalk.dim("Running 'setx' to save variables to Windows Registry..."),
    );

    await execAsync(`setx OPENROUTER_API_KEY "${apiKey}"`);
    await execAsync(`setx OPENROUTER_MODEL "${model}"`);

    console.log(chalk.green("\nSuccess! ✔"));
    console.log(
      chalk.yellow.bold(
        "IMPORTANT: You must restart your command prompt/terminal for these changes to take effect.",
      ),
    );
  } catch (error) {
    console.error(chalk.red("Failed to set environment variables on Windows."));
    console.error((error as Error).message);
  }
}

// --- Mac/Linux Logic ---
async function setUnixEnv(apiKey: string, model: string) {
  const shell = process.env.SHELL || "/bin/bash";
  const homeDir = os.homedir();
  let rcFile = ".bashrc";

  // Detect shell type
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
# Added by ai-commit
export OPENROUTER_API_KEY="${apiKey}"
export OPENROUTER_MODEL="${model}"
`;

  try {
    try {
      await readFile(rcPath);
    } catch {
      console.log(chalk.dim(`Creating ${rcPath}...`));
    }

    await appendFile(rcPath, contentToAppend);

    console.log(chalk.green(`\nSuccess! Appended variables to ${rcPath} ✔`));
    console.log(
      chalk.yellow.bold(
        `IMPORTANT: Run 'source ~/${rcFile}' or restart your terminal to apply changes.`,
      ),
    );
  } catch (error) {
    console.error(chalk.red(`Failed to update ${rcFile}.`));
    console.error((error as Error).message);
  }
}
