# packgate

Fail CI when `npm pack`, `pnpm pack`, or `yarn pack` would ship secrets, untracked files, or drop the files your `package.json` says you export.

`.gitignore` does **not** decide what a registry upload contains. A `files` field or `.npmignore` can pack `.env` files that git never tracked — or omit `dist/index.d.ts` and break every consumer. packgate inspects the tarball those pack commands actually write.

## Who this is for

Maintainers of JavaScript packages who want a last gate before publish, without creating an npmjs (or any other) account to *use* packgate.

## Why not just gitleaks / publint / `.gitignore`?

| Tool | What it actually inspects |
| --- | --- |
| git / gitleaks | The git tree and history |
| publint, `@arethetypeswrong/cli` | `package.json` fields and type resolution |
| **packgate** | The **tarball `npm` / `pnpm` / `yarn` pack produces** |

Those tools are complementary. packgate exists because the publish artifact is a third tree, distinct from git and from the manifest.

This is not theoretical. With `files: ["*"]`, npm, pnpm, and yarn will pack a gitignored `.env`:

```text
files: ["*"]  +  .gitignore containing .env  →  .env is still in the tarball
```

## Install (GitHub only)

No npmjs account. GitHub is the distribution channel.

```bash
npx --yes github:cocabot/gro
```

```bash
npm install github:cocabot/gro
```

### GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "22"
- run: npm ci
- run: npm run build --if-present
- uses: cocabot/gro@v0.2.0
  with:
    fail-on-severity: high
```

If `package.json` `files` includes `dist/`, build first so the tarball matches what you would publish.

### pre-commit

```yaml
- repo: https://github.com/cocabot/gro
  rev: v0.2.0
  hooks:
    - id: packgate
```

## Quick start

```bash
npx --yes github:cocabot/gro
```

Exit codes:

- `0` — no findings at or above `--fail-on-severity` (default `high`)
- `1` — the tarball failed the gate
- `2` — packgate could not run (pack command failed, bad arguments, …)

`--oracle auto` (default) uses `package.json#packageManager`, then `pnpm-lock.yaml` / `yarn.lock`, then `npm pack`.


## What it checks

1. **Packed but not in git** — files in the tarball that `git ls-files` does not know about. This is the usual secret-leak path.
2. **Deny globs** — `.env`, `*.pem`, `.npmrc`, private key names, and similar (configurable).
3. **Secret filenames and contents** — high-confidence patterns only (PEM/PKCS keys, GitHub PATs, npm tokens, AWS access key IDs, Slack bot tokens). Matches are redacted in output.
4. **Required files** — default `LICENSE` and `README.md`.
5. **Declared package paths** — `main`, `module`, `types`, `bin`, and `exports` targets must exist in the tarball.
6. **Dangerous `files` field** — `*`, `**`, and `**/*` are flagged because they reintroduce gitignored files.
7. **Size budget** — optional `maxUnpackedBytes`.

## Configuration

`packgate.json` or a `"packgate"` key in `package.json`:

```json
{
  "deny": ["**/.env", "**/.env.*", "!**/.env.example", "**/*.pem"],
  "require": ["LICENSE", "README.md"],
  "allowUntracked": [],
  "maxUnpackedBytes": 1048576,
  "scanContents": true,
  "git": true,
  "oracle": "auto"
}
```

See [docs/configuration.md](docs/configuration.md).

## CLI

```text
packgate [directory]
  --oracle auto|npm|pnpm|yarn
  --format text|json|markdown|sarif
  --fail-on-severity none|info|low|medium|high|critical
  --print-files
  --config packgate.json
  --no-scan-contents
  --no-git
```

SARIF can be uploaded with `github/codeql-action/upload-sarif`.

## Library

```js
import { analyze, formatReport, shouldFail } from "packgate";

const result = await analyze({ cwd: process.cwd() });
process.stdout.write(formatReport(result, "text"));
if (shouldFail(result, "high")) {
  process.exitCode = 1;
}
```

## Documentation

- [Concepts: git vs pack](docs/concepts.md)
- [Configuration](docs/configuration.md)
- [GitHub Action](docs/github-action.md)
- [Install without npmjs](docs/install.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
