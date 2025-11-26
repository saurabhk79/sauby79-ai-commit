# Changelog

## 2025-11-26

- **package.json**: Added dependencies `inquirer@^9.2.7` and `@types/inquirer@^9.0.9` for interactive prompts.
- **src/ai.ts**: Refactored OpenRouter API calls into reusable `callOpenRouter`; reduced commit message `max_tokens` to 300; added `generateSummary` with changelog-style prompt and `generateChangelogEntry` reusing it (`max_tokens=800`).
- **src/git.ts**: Added `isGitRepo()` to check if inside a Git repository; minor import formatting fixes.
- **src/index.ts**: Major CLI overhaul with subcommands (`generate commit|summary|changelog`), flags (`--commit`, `--push`, `--new`), and interactive inquirer menu; added usage tracking (`.ai-commit/usage.json`), token status (`token status`), CHANGELOG.md auto-creation/appending/pushing; Git repo validation; improved spinners, error handling, and commit confirmation.
