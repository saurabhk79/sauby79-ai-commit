#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import clipboard from 'clipboardy';
import { getStagedDiff, hasStagedChanges } from './git.js';
import { generateCommitMessage } from './ai.js';

// Load environment variables from a .env file if present
dotenv.config();

async function main() {
  console.log(chalk.bold.blue('AI Commit Message Generator'));

  // 1. Check API Key
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    console.error(chalk.red('\nError: GOOGLE_AI_KEY is missing.'));
    console.log(chalk.yellow('Please set it in your environment variables or a .env file.'));
    console.log(`export GOOGLE_AI_KEY="your_key_here"`);
    process.exit(1);
  }

  // 2. Check Git Status
  const staged = await hasStagedChanges();
  if (!staged) {
    console.log(chalk.yellow('\n No staged changes found.'));
    console.log('Run `git add <files>` before running this tool.');
    process.exit(0);
  }

  const spinner = ora('Reading git diff...').start();
  
  try {
    const diff = await getStagedDiff();
    if (!diff) {
      spinner.fail('Failed to read diff.');
      process.exit(1);
    }

    spinner.text = 'Analyzing changes with Gemini AI...';
    
    const message = await generateCommitMessage(apiKey, diff);
    await clipboard.write(message);

    spinner.succeed('Commit message generated!');

    console.log('\n' + chalk.green('--------------------------------------------------'));
    console.log(message);
    console.log(chalk.green('--------------------------------------------------') + '\n');

    console.log(chalk.dim('To use this message:'));
    console.log(chalk.white(`git commit -m "${message.replace(/"/g, '\\"')}"`));

    console.log(chalk.dim('The commit message has also been copied to your clipboard.'));

  } catch (error) {
    spinner.fail('An error occurred.');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

main();