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
export declare function npmPack(cwd: string): NpmPackResult;
