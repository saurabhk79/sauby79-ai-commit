#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import { API_KEY, MODEL } from "./config.js";
import { ensureGitRepoOrExit } from "./utils.js";
import { runInit, runUpdate } from "./init.js";
import { 
  runGenerateCommit, 
  runGenerateSummary, 
  runGenerateChangelog 
} from "./commands.js";

async function main() {
  console.log(chalk.bold.blue("AI Commit CLI"));

  const args = process.argv.slice(2);
  const mainCmd = args[0];
  const subCmd = args[1];

  // 1. Handle Init & Update
  if (mainCmd === "init") {
    await runInit();
    process.exit(0);
  }
  if (mainCmd === "update") {
    await runUpdate();
    process.exit(0);
  }

  // 2. Interactive Menu
  if (mainCmd !== "generate") {
    if (!API_KEY) {
        console.log(chalk.yellow("API Key not found in environment variables."));
        console.log(chalk.dim("It looks like this is your first time using ai-commit."));
        
        const { doInit } = await inquirer.prompt({
            name: "doInit",
            type: "confirm",
            message: "Would you like to run initialization now?",
            default: true
        });

        if (doInit) {
            await runInit();
            process.exit(0);
        } else {
            process.exit(1);
        }
    }

    console.log(chalk.blue("Interactive Menu:"));
    console.log(chalk.dim(`Using Model: ${MODEL}`));
    
    const { action } = await inquirer.prompt({
      name: "action",
      type: "list",
      message: "What would you like to do?",
      choices: [
        { name: "Generate commit message", value: "commit" },
        { name: "Generate summary", value: "summary" },
        { name: "Generate changelog entry", value: "changelog" },
        { name: "Update configuration (init)", value: "update" },
      ],
    });

    if (action === "update") {
      await runUpdate();
      process.exit(0);
    }

    await ensureGitRepoOrExit();

    if (action === "commit") {
      const { commitNow, push } = await inquirer.prompt([
        { name: "commitNow", type: "confirm", message: "Create commit automatically?", default: false },
        { name: "push", type: "confirm", message: "Push after commit?", default: false },
      ]);
      const flags = [] as string[];
      if (commitNow) flags.push("--commit");
      if (push) flags.push("--push");
      await runGenerateCommit(API_KEY, MODEL, flags);
    } else if (action === "summary") {
      await runGenerateSummary(API_KEY, MODEL);
    } else if (action === "changelog") {
      const { createNew, push } = await inquirer.prompt([
        { name: "createNew", type: "confirm", message: "Create CHANGELOG.md if missing?", default: false },
        { name: "push", type: "confirm", message: "Commit & push changelog?", default: false },
      ]);
      const flags = [] as string[];
      if (createNew) flags.push("--new");
      if (push) flags.push("--push");
      await runGenerateChangelog(API_KEY, MODEL, flags);
    }

    process.exit(0);
  }

  // 3. CLI Argument Mode
  const supported = ["commit", "summary", "changelog"];
  if (!supported.includes(subCmd)) {
    console.log(chalk.yellow("Usage: ai-commit generate <commit|summary|changelog>"));
    process.exit(0);
  }

  await ensureGitRepoOrExit();
  
  if (!API_KEY) {
      console.error(chalk.red("OPENROUTER_API_KEY is missing. Run 'ai-commit init'."));
      process.exit(1);
  }

  if (subCmd === "commit") {
    await runGenerateCommit(API_KEY, MODEL, args.slice(2));
  } else if (subCmd === "summary") {
    await runGenerateSummary(API_KEY, MODEL);
  } else if (subCmd === "changelog") {
    await runGenerateChangelog(API_KEY, MODEL, args.slice(2));
  }
}

main();