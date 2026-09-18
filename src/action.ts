import { appendFileSync } from "node:fs";
import { analyze } from "./analyze.js";
import { formatReport, githubAnnotations, shouldFail, type ReportFormat } from "./report.js";
import type { PackOracle, Severity } from "./types.js";

function getInput(name: string, fallback = ""): string {
  const key = `INPUT_${name.replaceAll(/[ -]/g, "_").toUpperCase()}`;
  return (process.env[key] ?? fallback).trim();
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (value === "") {
    return fallback;
  }
  return value === "true" || value === "1";
}

export async function runAction(): Promise<number> {
  const cwd = getInput("path", process.cwd());
  const format = (getInput("report-format", "markdown") || "markdown") as ReportFormat;
  const failOn = (getInput("fail-on-severity", "high") || "high") as Severity | "none";
  const configPath = getInput("config");
  const scanContents = parseBoolean(getInput("scan-contents"), true);
  const git = parseBoolean(getInput("git"), true);
  const oracle = (getInput("oracle", "auto") || "auto") as PackOracle;

  const result = await analyze({
    cwd,
    ...(configPath ? { configPath } : {}),
    scanContents,
    git,
    oracle,
  });
  const report = formatReport(result, format);
  process.stdout.write(report);
  for (const line of githubAnnotations(result, failOn)) {
    process.stdout.write(`${line}\n`);
  }
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) {
    appendFileSync(summaryPath, formatReport(result, "markdown"));
  }
  const outputPath = process.env["GITHUB_OUTPUT"];
  if (outputPath) {
    appendFileSync(
      outputPath,
      [
        `finding-count=${result.findings.length}`,
        `critical-count=${result.counts.critical}`,
        `high-count=${result.counts.high}`,
        `packed-file-count=${result.packedFiles.length}`,
        `resolved-oracle=${result.oracle}`,
        "",
      ].join("\n"),
    );
  }
  return shouldFail(result, failOn) ? 1 : 0;
}

if (process.argv[1]?.endsWith("action.js") || process.env["PACKGATE_ACTION"] === "1") {
  void runAction()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}
