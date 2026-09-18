import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findGitRoot } from "./git.js";
import { normalizePosix } from "./glob.js";
import { packPackage, type ResolvedOracle } from "./pack.js";
import { readTarGz, stripPackagePrefix } from "./tar.js";
import type { Finding, PackedFile } from "./types.js";

export type BaselineSpec =
  | { kind: "none" }
  | { kind: "git"; ref: string }
  | { kind: "npm"; version: string };

export interface BaselineSnapshot {
  spec: string;
  resolved: string;
  packedFileCount: number;
  files: PackedFile[];
}

export function parseBaseline(raw: string | null | undefined): BaselineSpec {
  const value = (raw ?? "").trim();
  if (value === "" || value === "none" || value === "off") {
    return { kind: "none" };
  }
  if (value === "last-tag" || value === "git" || value === "git:last-tag") {
    return { kind: "git", ref: "last-tag" };
  }
  if (value.startsWith("git:")) {
    const ref = value.slice(4).trim();
    if (!ref) {
      throw new Error("Empty git baseline ref. Use --baseline last-tag or --baseline git:v1.0.0.");
    }
    return { kind: "git", ref };
  }
  if (value === "npm" || value === "latest") {
    return { kind: "npm", version: "latest" };
  }
  if (value.startsWith("npm:")) {
    const version = value.slice(4).trim() || "latest";
    return { kind: "npm", version };
  }
  return { kind: "git", ref: value };
}

export async function loadBaseline(
  cwd: string,
  raw: string | null | undefined,
  oracle: ResolvedOracle,
): Promise<BaselineSnapshot | null> {
  const spec = parseBaseline(raw);
  if (spec.kind === "none") {
    return null;
  }
  if (spec.kind === "git") {
    return loadGitBaseline(cwd, spec.ref, oracle);
  }
  return loadNpmBaseline(cwd, spec.version);
}

export function baselineFindings(current: PackedFile[], snapshot: BaselineSnapshot): Finding[] {
  const currentSet = new Set(current.map((file) => normalizePosix(file.path)));
  const baseSet = new Set(snapshot.files.map((file) => normalizePosix(file.path)));
  const findings: Finding[] = [];
  for (const relative of currentSet) {
    if (baseSet.has(relative)) {
      continue;
    }
    findings.push({
      id: `baseline-added:${relative}`,
      kind: "baseline-added",
      severity: "medium",
      path: relative,
      message: `Packed file '${relative}' was not in the baseline tarball (${snapshot.resolved}).`,
    });
  }
  for (const relative of baseSet) {
    if (currentSet.has(relative)) {
      continue;
    }
    findings.push({
      id: `baseline-removed:${relative}`,
      kind: "baseline-removed",
      severity: "high",
      path: relative,
      message: `Packed file '${relative}' was in the baseline tarball (${snapshot.resolved}) but is missing now. Publishing would drop it from consumers.`,
    });
  }
  return findings;
}

function loadGitBaseline(cwd: string, ref: string, oracle: ResolvedOracle): BaselineSnapshot {
  const root = findGitRoot(cwd);
  if (!root) {
    throw new Error("Git baseline requires a git repository.");
  }
  const resolved = ref === "last-tag" ? lastTag(root) : ref;
  try {
    execFileSync("git", ["rev-parse", "--verify", `${resolved}^{commit}`], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(`Git baseline ref '${resolved}' was not found.`);
  }
  const worktree = path.join(tmpdir(), `packgate-baseline-${process.pid}-${Date.now()}`);
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktree, resolved], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const rel = path.relative(root, path.resolve(cwd));
    const packCwd = rel && rel !== "." ? path.join(worktree, rel) : worktree;
    if (!existsSync(path.join(packCwd, "package.json"))) {
      throw new Error(`Git baseline '${resolved}' has no package.json at ${rel || "."}.`);
    }
    const packed = packPackage(packCwd, oracle);
    return {
      spec: ref === "last-tag" ? "last-tag" : `git:${resolved}`,
      resolved: `git:${resolved}`,
      packedFileCount: packed.files.length,
      files: packed.files,
    };
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", worktree], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      rmSync(worktree, { recursive: true, force: true });
    }
  }
}

function lastTag(root: string): string {
  try {
    return execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error("No git tags found. Pass --baseline git:<ref> or create a tag.");
  }
}

async function loadNpmBaseline(cwd: string, version: string): Promise<BaselineSnapshot> {
  const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as { name?: string };
  if (!pkg.name) {
    throw new Error("npm baseline needs package.json name.");
  }
  let url: string;
  try {
    url = execFileSync("npm", ["view", `${pkg.name}@${version}`, "dist.tarball"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
    }).trim();
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(
      `npm view ${pkg.name}@${version} dist.tarball failed. The package must already be on the registry, or use --baseline last-tag.\n${(err.stderr ?? err.message ?? "").trim()}`,
    );
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`npm view did not return a tarball URL for ${pkg.name}@${version}.`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Downloading ${url} failed with HTTP ${response.status}.`);
  }
  const archive = Buffer.from(await response.arrayBuffer());
  const files: PackedFile[] = [];
  for (const entry of readTarGz(archive)) {
    const relative = stripPackagePrefix(entry.name);
    if (!relative) {
      continue;
    }
    files.push({ path: relative, size: entry.size });
  }
  return {
    spec: `npm:${version}`,
    resolved: `npm:${pkg.name}@${version}`,
    packedFileCount: files.length,
    files,
  };
}
