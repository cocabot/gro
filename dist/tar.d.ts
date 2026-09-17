export interface TarEntry {
    name: string;
    size: number;
    content: Buffer;
}
/**
 * Read files from an npm pack tarball (gzipped ustar, usually with a `package/` prefix).
 * Handles GNU long names and a subset of PAX `path=` headers used by npm.
 */
export declare function readTarGz(archive: Buffer): TarEntry[];
export declare function stripPackagePrefix(name: string): string;
