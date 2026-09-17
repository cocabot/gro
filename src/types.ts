export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingKind =
  | "packed-untracked"
  | "deny-glob"
  | "secret-filename"
  | "secret-content"
  | "missing-required"
  | "missing-package-path"
  | "unpacked-size"
  | "dangerous-files-field";

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
}

export interface AnalyzeOptions {
  cwd?: string;
  config?: Partial<PackgateConfig>;
  configPath?: string;
  scanContents?: boolean;
  git?: boolean;
}

export interface AnalyzeResult {
  packageName: string;
  version: string;
  cwd: string;
  packedSize: number;
  unpackedSize: number;
  packedFiles: PackedFile[];
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
