import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Minimized diff options:
// --cached            → staged only
// --unified=0         → remove context lines
// --minimal           → reduce patch noise
// --ignore-all-space  → skip whitespace-only edits
const DIFF_CMD = `git diff --cached --unified=0 --minimal --ignore-all-space -- \
  . \
  ':!package-lock.json' \
  ':!bun.lockb' \
  ':!pnpm-lock.yaml' \
  ':!yarn.lock'
`;

/**
 * Get a minimized diff of staged changes.
 */
export async function getStagedDiff(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(DIFF_CMD);
    const out = stdout.trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Check if there are staged changes.
 */
export async function hasStagedChanges(): Promise<boolean> {
  const diff = await getStagedDiff();
  return diff !== null && diff.length > 0;
}

/**
 * Check if current working directory is inside a git repository
 */
export async function isGitRepo(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git rev-parse --is-inside-work-tree");
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
