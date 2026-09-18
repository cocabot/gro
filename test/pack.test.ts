import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { packPackage, resolveOracle } from "../dist/pack.js";

function hasBin(name: string): boolean {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function makeDir(files: Record<string, string>): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "packgate-oracle-"));
  for (const [relative, contents] of Object.entries(files)) {
    const filePath = path.join(cwd, relative);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  return cwd;
}

function gitInit(cwd: string, track: string[]): void {
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "packgate-test@example.com"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "packgate test"], { cwd, stdio: "ignore" });
  execFileSync("git", ["add", "--", ...track], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
}

test("resolveOracle uses packageManager, then lockfiles, then npm", () => {
  const pnpmField = makeDir({
    "package.json": JSON.stringify({ name: "x", version: "1.0.0", packageManager: "pnpm@10.0.0" }),
    "yarn.lock": "",
  });
  assert.equal(resolveOracle(pnpmField, "auto"), "pnpm");

  const pnpmLock = makeDir({
    "package.json": JSON.stringify({ name: "x", version: "1.0.0" }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "yarn.lock": "",
  });
  assert.equal(resolveOracle(pnpmLock, "auto"), "pnpm");

  const yarnLock = makeDir({
    "package.json": JSON.stringify({ name: "x", version: "1.0.0" }),
    "yarn.lock": "",
  });
  assert.equal(resolveOracle(yarnLock, "auto"), "yarn");

  const npm = makeDir({
    "package.json": JSON.stringify({ name: "x", version: "1.0.0" }),
  });
  assert.equal(resolveOracle(npm, "auto"), "npm");
  assert.equal(resolveOracle(npm, "pnpm"), "pnpm");
});

test("pnpm pack includes untracked files that are not gitignored", { skip: hasBin("pnpm") ? false : "pnpm not installed" }, () => {
  const cwd = makeDir({
    "package.json": JSON.stringify({ name: "pnpm-untracked", version: "1.0.0", files: ["*"] }),
    "README.md": "x",
    LICENSE: "MIT",
    "accidental.js": "export default 1\n",
  });
  gitInit(cwd, ["package.json", "README.md", "LICENSE"]);
  const packed = packPackage(cwd, "pnpm");
  assert.equal(packed.files.some((file) => file.path === "accidental.js"), true);
});

test("pnpm pack in a git repo omits a gitignored .env even when files is *", { skip: hasBin("pnpm") ? false : "pnpm not installed" }, () => {
  const cwd = makeDir({
    "package.json": JSON.stringify({ name: "pnpm-gitignored", version: "1.0.0", files: ["*"] }),
    "README.md": "x",
    LICENSE: "MIT",
    ".env": "SECRET=1\n",
    ".gitignore": ".env\n",
  });
  gitInit(cwd, ["package.json", "README.md", "LICENSE", ".gitignore"]);
  const packed = packPackage(cwd, "pnpm");
  assert.equal(packed.oracle, "pnpm");
  assert.equal(packed.files.some((file) => file.path === ".env"), false);
});

test("yarn pack in a git repo still ships a gitignored .env when files is *", { skip: hasBin("yarn") ? false : "yarn not installed" }, () => {
  const cwd = makeDir({
    "package.json": JSON.stringify({ name: "yarn-leaky", version: "1.0.0", files: ["*"] }),
    "README.md": "x",
    LICENSE: "MIT",
    ".env": "SECRET=1\n",
    ".gitignore": ".env\n",
  });
  gitInit(cwd, ["package.json", "README.md", "LICENSE", ".gitignore"]);
  const packed = packPackage(cwd, "yarn");
  assert.equal(packed.oracle, "yarn");
  assert.equal(packed.files.some((file) => file.path === ".env"), true);
});

test("explicit --oracle npm ignores a pnpm lockfile", () => {
  const cwd = makeDir({
    "package.json": JSON.stringify({ name: "npm-forced", version: "1.0.0", files: ["LICENSE", "README.md"] }),
    "README.md": "x",
    LICENSE: "MIT",
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  });
  const packed = packPackage(cwd, "npm");
  assert.equal(packed.oracle, "npm");
});
