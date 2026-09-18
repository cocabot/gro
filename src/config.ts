import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { PackOracle, PackgateConfig } from "./types.js";

export const DEFAULT_DENY = [
  "**/.env",
  "**/.env.*",
  "!**/.env.example",
  "!**/.env.sample",
  "!**/.env.template",
  "!**/.env.test",
  "!**/.env.testing",
  "**/*.pem",
  "**/*.p12",
  "**/*.pfx",
  "**/*.key",
  "**/*.keystore",
  "**/id_rsa",
  "**/id_ed25519",
  "**/.npmrc",
  "**/.pypirc",
  "**/.aws/credentials",
  "**/credentials.json",
  "**/service-account*.json",
  "**/.git",
  "**/.git/**",
] as const;

export const DEFAULT_REQUIRE = ["LICENSE", "README.md"] as const;

export function defaultConfig(): PackgateConfig {
  return {
    deny: [...DEFAULT_DENY],
    require: [...DEFAULT_REQUIRE],
    allowUntracked: [],
    maxUnpackedBytes: null,
    scanContents: true,
    git: true,
    oracle: "auto",
  };
}

export function loadConfig(cwd: string, configPath?: string, overrides: Partial<PackgateConfig> = {}): PackgateConfig {
  const base = defaultConfig();
  const fromFile = configPath
    ? readConfigFile(path.resolve(cwd, configPath))
    : readDefaultConfigFiles(cwd);
  return mergeConfig(base, fromFile, overrides);
}

function readDefaultConfigFiles(cwd: string): Partial<PackgateConfig> {
  const jsonPath = path.join(cwd, "packgate.json");
  if (existsSync(jsonPath)) {
    return readConfigFile(jsonPath);
  }
  const pkgPath = path.join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return {};
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packgate?: Partial<PackgateConfig> };
  return pkg.packgate ?? {};
}

function readConfigFile(filePath: string): Partial<PackgateConfig> {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<PackgateConfig>;
  return raw;
}

function mergeConfig(...parts: Partial<PackgateConfig>[]): PackgateConfig {
  const result = defaultConfig();
  for (const part of parts) {
    if (part.deny) {
      result.deny = part.deny;
    }
    if (part.require) {
      result.require = part.require;
    }
    if (part.allowUntracked) {
      result.allowUntracked = part.allowUntracked;
    }
    if (part.maxUnpackedBytes !== undefined) {
      result.maxUnpackedBytes = part.maxUnpackedBytes;
    }
    if (part.scanContents !== undefined) {
      result.scanContents = part.scanContents;
    }
    if (part.git !== undefined) {
      result.git = part.git;
    }
    if (part.oracle) {
      result.oracle = part.oracle;
    }
  }
  return result;
}
