import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../dist/index.js";
import { shouldFail } from "../dist/report.js";

interface Layout {
  files: Record<string, string>;
  gitignore?: string[];
  track?: string[];
}

function makePackage(layout: Layout): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "packgate-test-"));
  for (const [relative, contents] of Object.entries(layout.files)) {
    const filePath = path.join(cwd, relative);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  if (layout.gitignore) {
    writeFileSync(path.join(cwd, ".gitignore"), `${layout.gitignore.join("\n")}\n`);
  }
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "packgate-test@example.com"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "packgate test"], { cwd, stdio: "ignore" });
  const track = layout.track ?? Object.keys(layout.files).filter((file) => file !== ".env");
  if (track.length > 0) {
    execFileSync("git", ["add", "--", ...track], { cwd, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
  }
  return cwd;
}

test("files:['*'] packs a gitignored .env and fails the gate", async () => {
  const cwd = makePackage({
    files: {
      "package.json": JSON.stringify({
        name: "leaky",
        version: "1.0.0",
        files: ["*"],
      }),
      "README.md": "example",
      LICENSE: "MIT",
      ".env": "NPM_TOKEN=npm_abcdefghijklmnopqrstuvwxyz\n",
    },
    gitignore: [".env"],
    track: ["package.json", "README.md", "LICENSE", ".gitignore"],
  });
  const result = await analyze({ cwd });
  const kinds = new Set(result.findings.map((finding) => finding.kind));
  assert.equal(kinds.has("packed-untracked"), true);
  assert.equal(kinds.has("deny-glob"), true);
  assert.equal(kinds.has("secret-filename"), true);
  assert.equal(kinds.has("dangerous-files-field"), true);
  assert.equal(kinds.has("secret-content"), true);
  assert.equal(shouldFail(result, "high"), true);
});

test("an explicit files allow list with LICENSE, README, and main passes", async () => {
  const cwd = makePackage({
    files: {
      "package.json": JSON.stringify({
        name: "clean",
        version: "1.0.0",
        main: "./dist/index.js",
        files: ["dist", "LICENSE", "README.md"],
      }),
      "README.md": "clean package",
      LICENSE: "MIT",
      "dist/index.js": "export const ok = true;\n",
      ".env": "SECRET=1\n",
    },
    gitignore: [".env"],
    track: ["package.json", "README.md", "LICENSE", "dist/index.js", ".gitignore"],
  });
  const result = await analyze({ cwd });
  assert.deepEqual(result.findings, []);
  assert.equal(
    result.packedFiles.map((file) => file.path).sort().join(","),
    "LICENSE,README.md,dist/index.js,package.json",
  );
});

test("missing package.json main path is a critical finding", async () => {
  const cwd = makePackage({
    files: {
      "package.json": JSON.stringify({
        name: "broken-main",
        version: "1.0.0",
        main: "./dist/index.js",
        files: ["LICENSE", "README.md"],
      }),
      "README.md": "broken",
      LICENSE: "MIT",
    },
    track: ["package.json", "README.md", "LICENSE"],
  });
  const result = await analyze({ cwd });
  const missing = result.findings.find((finding) => finding.kind === "missing-package-path");
  assert.ok(missing);
  assert.equal(missing.severity, "critical");
  assert.equal(shouldFail(result, "critical"), true);
});

test("required LICENSE missing from tarball is a high finding", async () => {
  const cwd = makePackage({
    files: {
      "package.json": JSON.stringify({
        name: "no-license",
        version: "1.0.0",
        files: ["README.md"],
      }),
      "README.md": "no license file on disk",
    },
    track: ["package.json", "README.md"],
  });
  const result = await analyze({ cwd });
  assert.ok(result.findings.some((finding) => finding.kind === "missing-required" && finding.path === "LICENSE"));
});
