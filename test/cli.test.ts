import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs } from "../dist/cli.js";
import { githubAnnotations, shouldFail } from "../dist/report.js";
import type { AnalyzeResult } from "../dist/index.js";

test("parseArgs accepts --oracle", () => {
  const options = parseArgs(["--oracle", "yarn"]);
  assert.equal(options.oracle, "yarn");
});

test("parseArgs accepts --baseline", () => {
  const options = parseArgs(["--baseline", "last-tag"]);
  assert.equal(options.baseline, "last-tag");
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

test("GitHub annotations are errors only at or above the fail threshold", () => {
  const result = {
    findings: [
      { id: "a", kind: "dangerous-files-field", severity: "medium", message: "broad files" },
      { id: "b", kind: "deny-glob", severity: "high", path: ".env", message: "denied" },
    ],
  } as AnalyzeResult;
  const lines = githubAnnotations(result, "high");
  assert.equal(lines.some((line) => line.startsWith("::warning ") && line.includes("broad files")), true);
  assert.equal(lines.some((line) => line.startsWith("::error ") && line.includes("denied")), true);
});
