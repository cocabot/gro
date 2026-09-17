/**
 * Small glob matcher for POSIX paths.
 * A double-star segment matches zero or more directories, including none.
 */
export declare function matchGlob(filePath: string, glob: string): boolean;
export declare function isDenied(filePath: string, deny: readonly string[]): boolean;
export declare function normalizePosix(value: string): string;
