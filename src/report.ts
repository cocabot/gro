import { SEVERITY_RANK, type AnalyzeResult, type Finding, type Severity } from "./types.js";

export type ReportFormat = "text" | "json" | "markdown" | "sarif";

export function worstSeverity(result: AnalyzeResult): Severity | null {
  if (result.findings.length === 0) {
    return null;
  }
  return result.findings.reduce<Severity>((worst, finding) => {
    return SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst] ? finding.severity : worst;
  }, "info");
}

export function shouldFail(result: AnalyzeResult, failOn: Severity | "none"): boolean {
  if (failOn === "none") {
    return false;
  }
  const threshold = SEVERITY_RANK[failOn];
  return result.findings.some((finding) => SEVERITY_RANK[finding.severity] >= threshold);
}

export function formatReport(result: AnalyzeResult, format: ReportFormat): string {
  switch (format) {
    case "json":
      return `${JSON.stringify(result, jsonReplacer, 2)}\n`;
    case "markdown":
      return formatMarkdown(result);
    case "sarif":
      return `${JSON.stringify(formatSarif(result), null, 2)}\n`;
    default:
      return formatText(result);
  }
}

export function githubAnnotations(result: AnalyzeResult, failOn: Severity | "none" = "high"): string[] {
  return result.findings.map((finding) => {
    const failing = failOn !== "none" && SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[failOn];
    const level = failing ? "error" : "warning";
    const file = finding.path ? `file=${finding.path},` : "";
    const title = "title=packgate,";
    return `::${level} ${file}${title}::${escapeProperty(finding.message)}`;
  });
}

function formatText(result: AnalyzeResult): string {
  const lines: string[] = [
    `packgate ${result.packageName}@${result.version} (${result.oracle} pack)`,
    `packed ${result.packedFiles.length} files (${result.unpackedSize} unpacked bytes, ${result.packedSize} packed bytes)`,
  ];
  if (result.baseline) {
    lines.push(`baseline ${result.baseline.resolved} (${result.baseline.packedFileCount} files)`);
  }
  if (result.findings.length === 0) {
    lines.push("No findings.");
    return `${lines.join("\n")}\n`;
  }
  lines.push(`Findings: ${result.findings.length}`);
  for (const finding of result.findings) {
    lines.push(formatFindingLine(finding));
  }
  return `${lines.join("\n")}\n`;
}

function formatMarkdown(result: AnalyzeResult): string {
  const lines: string[] = [
    `## packgate ${result.packageName}@${result.version}`,
    "",
    `- Pack oracle: **${result.oracle}**`,
    `- Packed files: **${result.packedFiles.length}**`,
    `- Unpacked size: **${result.unpackedSize}** bytes`,
    `- Packed size: **${result.packedSize}** bytes`,
  ];
  if (result.baseline) {
    lines.push(`- Baseline: **${result.baseline.resolved}** (${result.baseline.packedFileCount} files)`);
  }
  lines.push(`- Findings: **${result.findings.length}**`, "");
  if (result.findings.length === 0) {
    lines.push("No findings.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("| Severity | Kind | Path | Message |");
  lines.push("| --- | --- | --- | --- |");
  for (const finding of result.findings) {
    lines.push(
      `| ${finding.severity} | ${finding.kind} | ${finding.path ?? ""} | ${escapeTable(finding.message)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function formatSarif(result: AnalyzeResult): unknown {
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "packgate",
            version: result.version,
            informationUri: "https://github.com/cocabot/gro",
            rules: [...new Set(result.findings.map((finding) => finding.kind))].map((kind) => ({
              id: kind,
              shortDescription: { text: kind },
            })),
          },
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.kind,
          level: finding.severity === "info" || finding.severity === "low" ? "note" : "error",
          message: { text: finding.message },
          locations: finding.path
            ? [
                {
                  physicalLocation: {
                    artifactLocation: { uri: finding.path },
                  },
                },
              ]
            : [],
        })),
      },
    ],
  };
}

function formatFindingLine(finding: Finding): string {
  const path = finding.path ? ` ${finding.path}` : "";
  return `- [${finding.severity}] ${finding.kind}${path}: ${finding.message}`;
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function escapeProperty(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}
