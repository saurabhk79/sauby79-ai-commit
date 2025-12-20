import chalk from "chalk";

interface Log {
  info: (msg: string) => string;
  ok: (msg: string) => string;
  warn: (msg: string) => string;
  err: (msg: string) => string;
  step: (msg: string) => string;
  title: (msg: string) => string;
}

export const log: Log = {
  info: (msg: string) => chalk.cyan("ℹ") + " " + msg,
  ok: (msg: string) => chalk.green("✔") + " " + msg,
  warn: (msg: string) => chalk.yellow("⚠") + " " + msg,
  err: (msg: string) => chalk.red("✖") + " " + msg,
  step: (msg: string) => chalk.magenta("➜") + " " + msg,
  title: (msg: string) => chalk.bold.blue(msg),
};
