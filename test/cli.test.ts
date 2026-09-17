import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs } from "../dist/cli.js";
import { shouldFail } from "../dist/report.js";
import type { AnalyzeResult } from "../dist/index.js";

test("parseArgs accepts format and severity flags", () => {
  const options = parseArgs(["--format", "json", "--fail-on-severity", "critical", "--no-git"]);
  assert.equal(options.format, "json");
  assert.equal(options.failOn, "critical");
  assert.equal(options.git, false);
});

test("shouldFail respects the severity threshold", () => {
  const result = {
    findings: [{ id: "x", kind: "deny-glob", severity: "high", message: "nope" }],
    counts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
  } as AnalyzeResult;
  assert.equal(shouldFail(result, "high"), true);
  assert.equal(shouldFail(result, "critical"), false);
  assert.equal(shouldFail(result, "none"), false);
});
