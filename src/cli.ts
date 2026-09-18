#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "./analyze.js";
import { formatReport, githubAnnotations, shouldFail, type ReportFormat } from "./report.js";
import type { PackOracle, Severity } from "./types.js";

export interface CliOptions {
  cwd: string;
  format: ReportFormat;
  failOn: Severity | "none";
  scanContents: boolean;
  git: boolean;
  printFiles: boolean;
  configPath?: string;
  help: boolean;
  version: boolean;
  oracle: PackOracle;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    format: "text",
    failOn: "high",
    scanContents: true,
    git: true,
    printFiles: false,
    help: false,
    version: false,
    oracle: "auto",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return value;
    };
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        options.version = true;
        break;
      case "--path":
      case "--cwd":
        options.cwd = path.resolve(next());
        break;
      case "--config":
        options.configPath = next();
        break;
      case "--format": {
        const value = next();
        if (value !== "text" && value !== "json" && value !== "markdown" && value !== "sarif") {
          throw new Error(`Unknown format '${value}'`);
        }
        options.format = value;
        break;
      }
      case "--fail-on-severity": {
        const value = next();
        if (value !== "none" && value !== "critical" && value !== "high" && value !== "medium" && value !== "low" && value !== "info") {
          throw new Error(`Unknown severity '${value}'`);
        }
        options.failOn = value;
        break;
      }
      case "--scan-contents":
        options.scanContents = true;
        break;
      case "--no-scan-contents":
        options.scanContents = false;
        break;
      case "--git":
        options.git = true;
        break;
      case "--no-git":
        options.git = false;
        break;
      case "--print-files":
        options.printFiles = true;
        break;
      case "--oracle": {
        const value = next();
        if (value !== "auto" && value !== "npm" && value !== "pnpm" && value !== "yarn") {
          throw new Error(`Unknown oracle '${value}'`);
        }
        options.oracle = value;
        break;
      }
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown argument '${arg}'`);
        }
        options.cwd = path.resolve(arg);
    }
  }
  return options;
}

export function helpText(): string {
  return `packgate — fail CI when npm/pnpm/yarn pack would ship the wrong files

Usage:
  packgate [directory] [options]

Options:
  --path, --cwd DIR          Package directory (default: current directory)
  --config FILE              packgate.json config path
  --format text|json|markdown|sarif
  --fail-on-severity LEVEL   none|info|low|medium|high|critical (default: high)
  --print-files              List packed file paths
  --oracle auto|npm|pnpm|yarn  Pack command to inspect (default: auto)
  --no-scan-contents         Skip reading tarball contents for secret patterns
  --no-git                   Skip comparing packed files to git ls-files
  -h, --help                 Show help
  -v, --version              Show version

Exit codes:
  0  no findings at or above the severity threshold
  1  findings at or above the severity threshold
  2  packgate could not complete (pack command failed, invalid args, ...)
`;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(helpText());
    return 0;
  }
  if (options.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  try {
    const result = await analyze({
      cwd: options.cwd,
      ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
      scanContents: options.scanContents,
      git: options.git,
      oracle: options.oracle,
    });
    if (options.printFiles) {
      for (const file of result.packedFiles) {
        process.stdout.write(`${file.path}\n`);
      }
    }
    process.stdout.write(formatReport(result, options.format));
    if (process.env["GITHUB_ACTIONS"] === "true") {
      for (const line of githubAnnotations(result, options.failOn)) {
        process.stdout.write(`${line}\n`);
      }
    }
    return shouldFail(result, options.failOn) ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    return 2;
  }
}

function readVersion(): string {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
