import { stat, writeFile, readFile } from "fs/promises";
import chalk from "chalk";
import path from "path";
import { execAsync } from "./utils.js";

const CHANGELOG_FILENAME = "CHANGELOG.md";

const log = {
  info: (msg: string) => chalk.cyan("ℹ") + " " + msg,
  ok: (msg: string) => chalk.green("✔") + " " + msg,
  warn: (msg: string) => chalk.yellow("⚠") + " " + msg,
  err: (msg: string) => chalk.red("✖") + " " + msg,
  step: (msg: string) => chalk.magenta("➜") + " " + msg,
};

export async function createChangelogEntryAndMaybePush(
  summary: string,
  options: { newFile?: boolean; push?: boolean }
) {
  const changelogPath = path.join(process.cwd(), CHANGELOG_FILENAME);

  console.log(log.step("Checking for existing changelog..."));

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
      log.warn(
        `${CHANGELOG_FILENAME} not found. Use --new if you actually want one created.`
      )
    );
    return false;
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const header = `\n## ${dateStr}\n\n`;
  const entry = header + summary + "\n";

  try {
    if (!exists) {
      console.log(log.step(`Creating ${CHANGELOG_FILENAME}...`));

      await writeFile(changelogPath, `# Changelog\n\n${entry}`);

      console.log(
        log.ok(`Created ${CHANGELOG_FILENAME} and added first entry.`)
      );
    } else {
      console.log(log.step(`Updating ${CHANGELOG_FILENAME}...`));

      const currentContent = await readFile(changelogPath, "utf-8");

      const updatedContent = currentContent.replace(
        /(# Changelog\n\n)/,
        `$1${entry}`
      );

      if (updatedContent === currentContent) {
        await writeFile(changelogPath, entry + currentContent);
      } else {
        await writeFile(changelogPath, updatedContent);
      }

      console.log(log.ok("Changelog entry added."));
    }
  } catch (e) {
    console.error(log.err("Failed to write changelog."));
    console.error(chalk.red((e as Error).message));
    return false;
  }

  if (options.push) {
    try {
      console.log(log.step("Resolving current git branch..."));

      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD");
      const branch = stdout.trim();

      if (!branch) {
        throw new Error("Unable to determine current branch.");
      }

      console.log(log.step("Committing changelog..."));
      await execAsync(`git add ${CHANGELOG_FILENAME}`);
      await execAsync(`git commit -m "chore(changelog): update ${dateStr}"`);

      console.log(log.step(`Pushing ${branch} → origin...`));
      await execAsync(`git push origin ${branch}`);

      console.log(log.ok("Changelog committed and pushed."));
    } catch (e) {
      console.error(log.err("Failed to commit or push changelog."));
      console.error(chalk.red((e as Error).message));
      return false;
    }
  }

  return true;
}
