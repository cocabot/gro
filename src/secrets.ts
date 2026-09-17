export interface SecretHit {
  rule: string;
  evidence: string;
}

const FILENAME_RULES: { rule: string; glob: RegExp }[] = [
  { rule: "env-file", glob: /(?:^|\/)\.env(?:$|\.(?!example$|sample$|template$|testing$|test$))/iu },
  { rule: "private-key-file", glob: /(?:^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/u },
  { rule: "pem-file", glob: /\.(?:pem|p12|pfx|key|keystore)$/iu },
  { rule: "npmrc", glob: /(?:^|\/)\.npmrc$/u },
  { rule: "pypirc", glob: /(?:^|\/)\.pypirc$/u },
  { rule: "aws-credentials", glob: /(?:^|\/)\.aws\/credentials$/u },
  { rule: "service-account-json", glob: /(?:^|\/)service-account.*\.json$/iu },
];

const CONTENT_RULES: { rule: string; pattern: RegExp }[] = [
  {
    rule: "pkcs-private-key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    rule: "aws-access-key-id",
    pattern: /\bAKI[A-Z0-9]{16}\b/,
  },
  {
    rule: "github-pat",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/,
  },
  {
    rule: "github-fine-grained-pat",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    rule: "npm-access-token",
    pattern: /\bnpm_[A-Za-z0-9]{20,}\b/,
  },
  {
    rule: "slack-bot-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
];

export function matchSecretFilename(filePath: string): SecretHit | null {
  const posix = filePath.replaceAll("\\", "/");
  for (const { rule, glob } of FILENAME_RULES) {
    if (glob.test(posix)) {
      return { rule, evidence: posix };
    }
  }
  return null;
}

export function matchSecretContent(filePath: string, content: Buffer): SecretHit | null {
  if (content.includes(0)) {
    return null;
  }
  if (content.length > 256 * 1024) {
    return null;
  }
  const text = content.toString("utf8");
  for (const { rule, pattern } of CONTENT_RULES) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return {
        rule,
        evidence: `${filePath}: matched ${rule} (${redact(match[0])})`,
      };
    }
  }
  return null;
}

function redact(value: string): string {
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}
