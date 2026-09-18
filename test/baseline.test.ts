import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { analyze } from "../dist/index.js";
import { parseBaseline } from "../dist/baseline.js";
import { shouldFail } from "../dist/report.js";

function makePackage(files: Record<string, string>): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "packgate-baseline-"));
  for (const [relative, contents] of Object.entries(files)) {
    const filePath = path.join(cwd, relative);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "packgate-test@example.com"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "packgate test"], { cwd, stdio: "ignore" });
  execFileSync("git", ["add", "--", "."], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
  return cwd;
}

function commitAll(cwd: string, message: string): void {
  execFileSync("git", ["add", "--", "."], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

const pkg = (name: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    name,
    version: "1.0.0",
    files: ["LICENSE", "README.md", "extra.js"],
    ...extra,
  });

test("parseBaseline accepts last-tag, git refs, npm, and none", () => {
  assert.deepEqual(parseBaseline(null), { kind: "none" });
  assert.deepEqual(parseBaseline("none"), { kind: "none" });
  assert.deepEqual(parseBaseline("last-tag"), { kind: "git", ref: "last-tag" });
  assert.deepEqual(parseBaseline("git:v1.2.3"), { kind: "git", ref: "v1.2.3" });
  assert.deepEqual(parseBaseline("v1.2.3"), { kind: "git", ref: "v1.2.3" });
  assert.deepEqual(parseBaseline("npm:latest"), { kind: "npm", version: "latest" });
  assert.deepEqual(parseBaseline("npm:1.0.0"), { kind: "npm", version: "1.0.0" });
});

test("last-tag baseline flags a newly packed path as baseline-added", async () => {
  const cwd = makePackage({
    "package.json": pkg("baseline-add"),
    "README.md": "x",
    LICENSE: "MIT",
    "extra.js": "export default 1\n",
  });
  execFileSync("git", ["tag", "v1.0.0"], { cwd, stdio: "ignore" });
  writeFileSync(
    path.join(cwd, "package.json"),
    pkg("baseline-add", { files: ["LICENSE", "README.md", "extra.js", "new.js"] }),
  );
  writeFileSync(path.join(cwd, "new.js"), "export default 2\n");
  commitAll(cwd, "add new.js");

  const result = await analyze({ cwd, baseline: "last-tag" });
  assert.equal(result.baseline?.resolved, "git:v1.0.0");
  assert.equal(
    result.findings.some((finding) => finding.kind === "baseline-added" && finding.path === "new.js"),
    true,
  );
  assert.equal(shouldFail(result, "high"), false);
  assert.equal(shouldFail(result, "medium"), true);
});

test("last-tag baseline flags a dropped packed path as baseline-removed", async () => {
  const cwd = makePackage({
    "package.json": pkg("baseline-remove"),
    "README.md": "x",
    LICENSE: "MIT",
    "extra.js": "export default 1\n",
  });
  execFileSync("git", ["tag", "v1.0.0"], { cwd, stdio: "ignore" });
  writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({
      name: "baseline-remove",
      version: "1.0.0",
      files: ["LICENSE", "README.md"],
    }),
  );
  commitAll(cwd, "stop packing extra.js");

  const result = await analyze({ cwd, baseline: "last-tag" });
  assert.equal(
    result.findings.some((finding) => finding.kind === "baseline-removed" && finding.path === "extra.js"),
    true,
  );
  assert.equal(shouldFail(result, "high"), true);
});

test("identical tree against last-tag has no baseline findings", async () => {
  const cwd = makePackage({
    "package.json": pkg("baseline-same"),
    "README.md": "x",
    LICENSE: "MIT",
    "extra.js": "export default 1\n",
  });
  execFileSync("git", ["tag", "v1.0.0"], { cwd, stdio: "ignore" });
  const result = await analyze({ cwd, baseline: "last-tag" });
  assert.equal(
    result.findings.some((finding) => finding.kind === "baseline-added" || finding.kind === "baseline-removed"),
    false,
  );
});
