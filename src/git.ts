import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Minimized diff options:
// --cached            → staged only
// --unified=0         → remove context lines
// --minimal           → reduce patch noise
// --ignore-all-space  → skip whitespace-only edits
// Excludes generated/lock files and build outputs across major languages
const DIFF_CMD = `git diff --cached --unified=0 --minimal --ignore-all-space \
  --ignore='package-lock.json' \
  --ignore='yarn.lock' \
  --ignore='pnpm-lock.yaml' \
  --ignore='composer.lock' \
  --ignore='Gemfile.lock' \
  --ignore='poetry.lock' \
  --ignore='pipfile.lock' \
  --ignore='dist/' \
  --ignore='build/' \
  --ignore='out/' \
  --ignore='.next/' \
  --ignore='*.min.js' \
  --ignore='*.min.css' \
  --ignore='node_modules/' \
  --ignore='.gradle/' \
  --ignore='target/' \
  --ignore='bin/' \
  --ignore='obj/' \
  --ignore='.venv/' \
  --ignore='venv/' \
  --ignore='__pycache__/' \
  --ignore='*.pyc' \
  --ignore='.pytest_cache/' \
  --ignore='.mypy_cache/' \
  --ignore='vendor/' \
  --ignore='go.sum' \
  --ignore='go.mod' \
  --ignore='.o' \
  --ignore='.a' \
  --ignore='.exe' \
  --ignore='.so' \
  --ignore='.dylib'`;

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
