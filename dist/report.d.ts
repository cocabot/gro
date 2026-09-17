import { type AnalyzeResult, type Severity } from "./types.js";
export type ReportFormat = "text" | "json" | "markdown" | "sarif";
export declare function worstSeverity(result: AnalyzeResult): Severity | null;
export declare function shouldFail(result: AnalyzeResult, failOn: Severity | "none"): boolean;
export declare function formatReport(result: AnalyzeResult, format: ReportFormat): string;
export declare function githubAnnotations(result: AnalyzeResult, failOn?: Severity | "none"): string[];
