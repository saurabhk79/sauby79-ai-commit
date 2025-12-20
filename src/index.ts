#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import { API_KEY, MODEL } from "./config.js";
import { ensureGitRepoOrExit } from "./utils.js";
import { runInit, runUpdate } from "./init.js";
import {
  runGenerateCommit,
  runGenerateSummary,
  runGenerateChangelog,
} from "./commands.js";
import { log } from "./log.js";

async function main() {
  console.log("\n" + log.title("Komp CLI") + "\n");
  console.log("\n" + log.info("Easy ai commit helper!") + "\n");

  const args = process.argv.slice(2);
  const mainCmd = args[0];
  const subCmd = args[1];

  if (mainCmd === "init") {
    console.log(log.step("Running initialization..."));
    await runInit();
    console.log(log.ok("Initialization complete."));
    process.exit(0);
  }

  if (mainCmd === "update") {
    console.log(log.step("Updating configuration..."));
    await runUpdate();
    console.log(log.ok("Configuration updated."));
    process.exit(0);
  }

  if (mainCmd !== "generate") {
    if (!API_KEY) {
      console.log(log.warn("API key not found."));
      console.log(chalk.dim("Looks like first run. You need to initialize."));

      const { doInit } = await inquirer.prompt({
        name: "doInit",
        type: "confirm",
        message: "Run initialization now?",
        default: true,
      });

      if (doInit) {
        await runInit();
        console.log(log.ok("Setup complete. Run the command again."));
        process.exit(0);
      } else {
        console.log(log.err("No API key. Exiting."));
        process.exit(1);
      }
    }

    console.log(log.step("Entering interactive mode."));
    console.log(chalk.dim(`Using model: ${MODEL}`));

    const { action } = await inquirer.prompt({
      name: "action",
      type: "list",
      message: "What do you want to do?",
      choices: [
        { name: "Generate commit message", value: "commit" },
        { name: "Generate summary", value: "summary" },
        { name: "Generate changelog entry", value: "changelog" },
        { name: "Update configuration", value: "update" },
      ],
    });

    if (action === "update") {
      await runUpdate();
      console.log(log.ok("Configuration updated."));
      process.exit(0);
    }

    console.log(log.step("Validating git repository..."));
    await ensureGitRepoOrExit();
    console.log(log.ok("Git repo confirmed."));

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

      const flags: string[] = [];
      if (commitNow) flags.push("-c", "--commit");
      if (push) flags.push("-p", "--push");

      await runGenerateCommit(API_KEY, MODEL, flags);
    } else if (action === "summary") {
      await runGenerateSummary(API_KEY, MODEL);
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

      const flags: string[] = [];
      if (createNew) flags.push("-n", "--new");
      if (push) flags.push("-p", "--push");

      await runGenerateChangelog(API_KEY, MODEL, flags);
    }

    console.log(log.ok("Done."));
    process.exit(0);
  }

  const supported = ["commit", "summary", "changelog"];

  if (!supported.includes(subCmd)) {
    console.log(
      log.warn("Invalid command.") +
        "\n" +
        chalk.dim("Usage: komp generate <commit|summary|changelog>")
    );
    process.exit(0);
  }

  console.log(log.step("Validating git repository..."));
  await ensureGitRepoOrExit();

  if (!API_KEY) {
    console.error(log.err("OPENROUTER_API_KEY missing. Run `komp init`."));
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
