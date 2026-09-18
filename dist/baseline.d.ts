import { type ResolvedOracle } from "./pack.js";
import type { Finding, PackedFile } from "./types.js";
export type BaselineSpec = {
    kind: "none";
} | {
    kind: "git";
    ref: string;
} | {
    kind: "npm";
    version: string;
};
export interface BaselineSnapshot {
    spec: string;
    resolved: string;
    packedFileCount: number;
    files: PackedFile[];
}
export declare function parseBaseline(raw: string | null | undefined): BaselineSpec;
export declare function loadBaseline(cwd: string, raw: string | null | undefined, oracle: ResolvedOracle): Promise<BaselineSnapshot | null>;
export declare function baselineFindings(current: PackedFile[], snapshot: BaselineSnapshot): Finding[];
