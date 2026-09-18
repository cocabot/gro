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
export declare function resolveOracle(cwd: string, requested?: PackOracle): ResolvedOracle;
export declare function packPackage(cwd: string, requested?: PackOracle): PackResult;
/** @deprecated Use packPackage. Kept as the npm-named alias. */
export declare const npmPack: typeof packPackage;
