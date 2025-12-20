
# Kompitai (Komp CLI)

A command-line tool to generate conventional commit messages for your staged changes using AI.

## Installation

```bash
npm install -g kompitai
```

![Demo](https://raw.githubusercontent.com/saurabhk79/commit-masterai/main/demo.gif)

## Features

- Analyzes your staged `git diff`.
- Generates a commit message following the [Conventional Commits](https://www.conventionalcommits.org/) specification.
- Uses the fast and efficient `gemini-1.5-flash` model.
- Provides the `git commit` command ready to copy-paste.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/) initialized in your project.

## Configuration

The tool requires a Google AI API key to function.

1.  **Get a Google AI Key**:
    - Go to [Google AI Studio](https://aistudio.google.com/).
    - Sign in and click **"Get API key"**.
    - Create a new API key in a new or existing project.

2.  **Set the Environment Variable**:
    You need to set the `GOOGLE_AI_KEY` environment variable. You can do this in a few ways:

    - **Option A: `.env` file**
      Create a `.env` file in the root of your project, or add it to .bashrc/.zshrc and add the following line:
      ```
      GOOGLE_AI_KEY="your_key_here"
      ```

    - **Option B: Shell Profile**
      Add the following line to your shell profile file (e.g., `.bashrc`, `.zshrc`):
      ```bash
      export GOOGLE_AI_KEY="your_key_here"
      ```
      Remember to restart your terminal or source the file (`source ~/.zshrc`) for the changes to take effect.

## Usage

1.  Stage the changes you want to commit:
    ```bash
    git add <file1> <file2> ...
    ```

2.  Run the tool:
    ```bash
    komp generate commit
    ```

3.  The tool will analyze the diff and generate a commit message.

4.  Copy the provided `git commit` command to commit your changes.

## License

This project is licensed under the MIT License.
