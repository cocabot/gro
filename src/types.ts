export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type PackOracle = "auto" | "npm" | "pnpm" | "yarn";

export type FindingKind =
  | "packed-untracked"
  | "deny-glob"
  | "secret-filename"
  | "secret-content"
  | "missing-required"
  | "missing-package-path"
  | "unpacked-size"
  | "dangerous-files-field"
  | "baseline-added"
  | "baseline-removed";

export interface PackedFile {
  path: string;
  size: number;
  mode?: number;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: Severity;
  message: string;
  path?: string;
  evidence?: string;
}

export interface PackgateConfig {
  deny: string[];
  require: string[];
  allowUntracked: string[];
  maxUnpackedBytes: number | null;
  scanContents: boolean;
  git: boolean;
  oracle: PackOracle;
  baseline: string | null;
}

export interface AnalyzeOptions {
  cwd?: string;
  config?: Partial<PackgateConfig>;
  configPath?: string;
  scanContents?: boolean;
  git?: boolean;
  oracle?: PackOracle;
  baseline?: string | null;
}

export interface AnalyzeResult {
  packageName: string;
  version: string;
  cwd: string;
  oracle: Exclude<PackOracle, "auto">;
  packedSize: number;
  unpackedSize: number;
  packedFiles: PackedFile[];
  baseline: {
    spec: string;
    resolved: string;
    packedFileCount: number;
  } | null;
  findings: Finding[];
  counts: Record<Severity, number>;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};
