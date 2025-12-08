import { stat, writeFile, readFile } from "fs/promises";
import chalk from "chalk";
import path from "path";
import { execAsync } from "./utils.js";

const CHANGELOG_FILENAME = "CHANGELOG.md";

export async function createChangelogEntryAndMaybePush(
  summary: string,
  options: { newFile?: boolean; push?: boolean }
) {
  const changelogPath = path.join(process.cwd(), CHANGELOG_FILENAME);

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
      chalk.yellow(
        `${CHANGELOG_FILENAME} not found. Use --new to create a changelog.`
      )
    );
    return false;
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const header = `\n## ${dateStr}\n\n`;
  const content = header + summary + "\n";

  if (!exists) {
    await writeFile(changelogPath, `# Changelog\n\n${content}`);
    console.log(chalk.green(`Created ${CHANGELOG_FILENAME} and appended entry.`));
  } else {
    const currentContent = await readFile(changelogPath, "utf-8");
    const updatedContent = currentContent.replace(
      /(# Changelog\n\n)/,
      `$1${content}`
    );
    
    if (updatedContent === currentContent) {
        await writeFile(changelogPath, content + currentContent);
    } else {
        await writeFile(changelogPath, updatedContent);
    }
    
    console.log(chalk.green(`Added entry to ${CHANGELOG_FILENAME}.`));
  }

  if (options.push) {
    try {
      const { stdout: branchStdout } = await execAsync(
        "git rev-parse --abbrev-ref HEAD"
      );
      const branch = branchStdout.trim();
      
      console.log(chalk.dim("Committing changelog..."));
      await execAsync(`git add ${CHANGELOG_FILENAME}`);
      await execAsync(`git commit -m "chore(changelog): update ${dateStr}"`);
      
      console.log(chalk.dim(`Pushing to ${branch}...`));
      await execAsync(`git push origin ${branch}`);
      
      console.log(chalk.green("✔ Pushed changelog update."));
    } catch (e) {
      console.log(
        chalk.red("Failed to commit/push changelog:"),
        (e as Error).message
      );
    }
  }
  return true;
}