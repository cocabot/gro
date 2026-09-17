export interface SecretHit {
    rule: string;
    evidence: string;
}
export declare function matchSecretFilename(filePath: string): SecretHit | null;
export declare function matchSecretContent(filePath: string, content: Buffer): SecretHit | null;
