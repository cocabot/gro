import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readTarGz, stripPackagePrefix } from "./tar.js";
import type { PackedFile, PackOracle } from "./types.js";

export type ResolvedOracle = Exclude<PackOracle, "auto">;

export interface PackResult {
  oracle: ResolvedOracle;
  packageName: string;
  version: string;
  filename: string;
  packedSize: number;
  unpackedSize: number;
  files: PackedFile[];
  contents: Map<string, Buffer>;
}

export function resolveOracle(cwd: string, requested: PackOracle = "auto"): ResolvedOracle {
  if (requested === "npm" || requested === "pnpm" || requested === "yarn") {
    return requested;
  }
  const fromField = packageManagerField(cwd);
  if (fromField) {
    return fromField;
  }
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(path.join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

export function packPackage(cwd: string, requested: PackOracle = "auto"): PackResult {
  const oracle = resolveOracle(cwd, requested);
  const temp = mkdtempSync(path.join(tmpdir(), "packgate-"));
  try {
    const archivePath = createTarball(cwd, oracle, temp);
    const archive = readFileSync(archivePath);
    const contents = new Map<string, Buffer>();
    const files: PackedFile[] = [];
    for (const entry of readTarGz(archive)) {
      const relative = stripPackagePrefix(entry.name);
      if (!relative) {
        continue;
      }
      contents.set(relative, entry.content);
      files.push({ path: relative, size: entry.size });
    }
    const pkg = readPackedPackageJson(cwd, contents);
    return {
      oracle,
      packageName: pkg.name ?? "package",
      version: pkg.version ?? "0.0.0",
      filename: path.basename(archivePath),
      packedSize: archive.length,
      unpackedSize: files.reduce((sum, file) => sum + file.size, 0),
      files,
      contents,
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** @deprecated Use packPackage. Kept as the npm-named alias. */
export const npmPack = packPackage;

function createTarball(cwd: string, oracle: ResolvedOracle, temp: string): string {
  switch (oracle) {
    case "pnpm":
      run(cwd, "pnpm", ["pack", "--pack-destination", temp]);
      return onlyTarball(temp, "pnpm pack");
    case "yarn": {
      const dest = path.join(temp, "package.tgz");
      run(cwd, "yarn", yarnPackArgs(dest));
      if (existsSync(dest)) {
        return dest;
      }
      return onlyTarball(temp, "yarn pack");
    }
    default:
      run(cwd, "npm", ["pack", "--pack-destination", temp], {
        NPM_CONFIG_FUND: "false",
        NPM_CONFIG_AUDIT: "false",
      });
      return onlyTarball(temp, "npm pack");
  }
}

function yarnPackArgs(dest: string): string[] {
  return yarnClassic() ? ["pack", "--filename", dest] : ["pack", "--out", dest];
}

function yarnClassic(): boolean {
  try {
    const version = execFileSync("yarn", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return version.startsWith("0.") || version.startsWith("1.");
  } catch {
    return true;
  }
}

function run(cwd: string, command: string, args: string[], extraEnv: Record<string, string> = {}): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0", ...extraEnv },
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    const detail = (err.stderr ?? err.message ?? String(error)).trim();
    throw new Error(
      `${command} ${args.join(" ")} failed. Install ${command} or pass --oracle npm.\n${detail}`,
    );
  }
}

function onlyTarball(dir: string, label: string): string {
  const matches = readdirSync(dir).filter((name) => name.endsWith(".tgz") || name.endsWith(".tar.gz"));
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(`${label} produced ${matches.length} tarball(s) in ${dir}: ${matches.join(", ") || "(none)"}`);
  }
  return path.join(dir, matches[0]);
}

function packageManagerField(cwd: string): ResolvedOracle | null {
  try {
    const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as {
      packageManager?: unknown;
    };
    if (typeof pkg.packageManager !== "string") {
      return null;
    }
    if (pkg.packageManager.startsWith("pnpm")) {
      return "pnpm";
    }
    if (pkg.packageManager.startsWith("yarn")) {
      return "yarn";
    }
    if (pkg.packageManager.startsWith("npm")) {
      return "npm";
    }
    return null;
  } catch {
    return null;
  }
}

function readPackedPackageJson(
  cwd: string,
  contents: Map<string, Buffer>,
): { name?: string; version?: string } {
  const packed = contents.get("package.json");
  if (packed) {
    return JSON.parse(packed.toString("utf8")) as { name?: string; version?: string };
  }
  return JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
}
