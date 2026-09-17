#!/usr/bin/env node
import { type ReportFormat } from "./report.js";
import type { Severity } from "./types.js";
export interface CliOptions {
    cwd: string;
    format: ReportFormat;
    failOn: Severity | "none";
    scanContents: boolean;
    git: boolean;
    printFiles: boolean;
    configPath?: string;
    help: boolean;
    version: boolean;
}
export declare function parseArgs(argv: string[]): CliOptions;
export declare function helpText(): string;
export declare function main(argv?: string[]): Promise<number>;
