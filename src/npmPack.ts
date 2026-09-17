import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readTarGz, stripPackagePrefix } from "./tar.js";
import type { PackedFile } from "./types.js";

export interface NpmPackResult {
  packageName: string;
  version: string;
  filename: string;
  packedSize: number;
  unpackedSize: number;
  files: PackedFile[];
  contents: Map<string, Buffer>;
}

interface NpmPackJson {
  id?: string;
  name?: string;
  version?: string;
  filename?: string;
  size?: number;
  unpackedSize?: number;
  files?: { path: string; size: number; mode?: number }[];
}

export function npmPack(cwd: string): NpmPackResult {
  const temp = mkdtempSync(path.join(tmpdir(), "packgate-"));
  try {
    const stdout = execFileSync("npm", ["pack", "--json", "--pack-destination", temp], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
    });
    const parsed = parseNpmJson(stdout);
    const packedPath = path.join(temp, parsed.filename ?? "");
    const archive = readFileSync(packedPath);
    const entries = readTarGz(archive);
    const contents = new Map<string, Buffer>();
    for (const entry of entries) {
      const relative = stripPackagePrefix(entry.name);
      if (relative) {
        contents.set(relative, entry.content);
      }
    }
    return {
      packageName: parsed.name ?? "package",
      version: parsed.version ?? "0.0.0",
      filename: parsed.filename ?? path.basename(packedPath),
      packedSize: parsed.size ?? archive.length,
      unpackedSize: parsed.unpackedSize ?? [...contents.values()].reduce((sum, buf) => sum + buf.length, 0),
      files: (parsed.files ?? []).map((file) => ({
        path: file.path.replaceAll("\\", "/").replace(/^\.\//, ""),
        size: file.size,
        ...(file.mode === undefined ? {} : { mode: file.mode }),
      })),
      contents,
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function parseNpmJson(stdout: string): NpmPackJson {
  const start = stdout.indexOf("[");
  const jsonText = start === -1 ? stdout : stdout.slice(start);
  const payload: unknown = JSON.parse(jsonText);
  if (Array.isArray(payload) && payload[0] && typeof payload[0] === "object") {
    return payload[0] as NpmPackJson;
  }
  if (payload && typeof payload === "object") {
    return payload as NpmPackJson;
  }
  throw new Error("npm pack --json returned an unexpected payload");
}
