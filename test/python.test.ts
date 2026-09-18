import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { analyze } from "../dist/index.js";
import { packPackage, resolveOracle } from "../dist/pack.js";
import { shouldFail } from "../dist/report.js";

function hasPythonBuild(): boolean {
  try {
    execFileSync("python3", ["-m", "build", "--help"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function makePython(files: Record<string, string>, track: string[]): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "packgate-python-"));
  for (const [relative, contents] of Object.entries(files)) {
    const filePath = path.join(cwd, relative);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "packgate-test@example.com"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "packgate test"], { cwd, stdio: "ignore" });
  execFileSync("git", ["add", "--", ...track], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
  return cwd;
}

const pyproject = `[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"
[project]
name = "leaky"
version = "1.0.0"
[tool.setuptools.package-data]
leaky = ["*", ".env", "*.pem"]
`;

test("resolveOracle uses python when there is no package.json", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "packgate-py-oracle-"));
  writeFileSync(path.join(cwd, "pyproject.toml"), '[project]\nname = "x"\n');
  assert.equal(resolveOracle(cwd, "auto"), "python");
  const js = mkdtempSync(path.join(tmpdir(), "packgate-js-oracle-"));
  writeFileSync(path.join(js, "package.json"), '{"name":"x","version":"1.0.0"}');
  writeFileSync(path.join(js, "pyproject.toml"), '[project]\nname = "x"\n');
  assert.equal(resolveOracle(js, "auto"), "npm");
  assert.equal(resolveOracle(js, "python"), "python");
});

test(
  "python wheel still ships a gitignored package .env when package-data is *",
  { skip: hasPythonBuild() ? false : "python -m build not installed" },
  async () => {
    const cwd = makePython(
      {
        "pyproject.toml": pyproject,
        "leaky/__init__.py": "x = 1\n",
        "leaky/.env": "NPM_TOKEN=npm_abcdefghijklmnopqrstuvwxyz\n",
        ".gitignore": ".env\n",
        LICENSE: "MIT\n",
        "README.md": "leaky\n",
      },
      ["pyproject.toml", "leaky/__init__.py", ".gitignore", "LICENSE", "README.md"],
    );
    const packed = packPackage(cwd, "python");
    assert.equal(packed.oracle, "python");
    assert.equal(packed.packageName, "leaky");
    assert.equal(
      packed.files.some((file) => file.path === "leaky/.env"),
      true,
    );
    const result = await analyze({ cwd, oracle: "python", config: { require: [] } });
    const kinds = new Set(result.findings.map((finding) => finding.kind));
    assert.equal(kinds.has("packed-untracked"), true);
    assert.equal(kinds.has("secret-filename"), true);
    assert.equal(shouldFail(result, "high"), true);
  },
);
