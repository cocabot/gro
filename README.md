# packgate

Fail CI when `npm pack` would ship secrets, untracked files, or drop the files your `package.json` says you export.

`.gitignore` does **not** decide what `npm publish` uploads. A `files` field or `.npmignore` can pack `.env` files that git never tracked — or omit `dist/index.d.ts` and break every consumer. packgate runs the same `npm pack` that the registry gets, then fails the build if that tarball is unsafe or incomplete.

## Who this is for

Maintainers of npm packages (and CI for those packages) who want a last gate before `npm publish` or a merge to the release branch.

## Why not just gitleaks / publint / `.gitignore`?

| Tool | What it actually inspects |
| --- | --- |
| git / gitleaks | The git tree and history |
| publint, `@arethetypeswrong/cli` | `package.json` fields and type resolution |
| **packgate** | The **tarball `npm pack` produces** |

Those tools are complementary. packgate exists because the publish artifact is a third tree, distinct from git and from the manifest.

This is not theoretical. With `files: ["*"]`, npm will pack a gitignored `.env`:

```text
files: ["*"]  +  .gitignore containing .env  →  .env is still in the tarball
```

## Install

```bash
# one-shot
npx --yes github:cocabot/gro --help

# or from a clone
git clone https://github.com/cocabot/gro.git
cd gro
npm install
npm test
node dist/cli.js --help
```

The CLI entry point is `packgate` after `npm install` (locally or, once published, from the npm registry). Until an npm release is available, GitHub is the source of truth:

```bash
npm install github:cocabot/gro
```

## Quick start

```bash
npx --yes github:cocabot/gro
```

Exit codes:

- `0` — no findings at or above `--fail-on-severity` (default `high`)
- `1` — the tarball failed the gate
- `2` — packgate could not run (`npm pack` failed, bad arguments, …)

## GitHub Action

```yaml
name: packgate
on:
  pull_request:
  push:
    branches: [main]

jobs:
  pack:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run build
      - uses: cocabot/gro@v0.1.0
        with:
          fail-on-severity: high
```

The action requires a built `dist/` in the checked-out repo when you pin this repository as the action. For your **own** package (the usual case), checkout **your** repo, install **your** deps, then run packgate against that working tree:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "22"
- run: npm ci
- run: npm pack --dry-run   # optional: inspect npm's own listing
- uses: cocabot/gro@v0.1.0
  with:
    path: .
    fail-on-severity: high
```

If your `package.json` `files` list includes `dist/`, build before packgate so the tarball is what you would really publish.

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
  "git": true
}
```

See [docs/configuration.md](docs/configuration.md).

## CLI

```text
packgate [directory]
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

- [Concepts: git vs npm pack](docs/concepts.md)
- [Configuration](docs/configuration.md)
- [GitHub Action](docs/github-action.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
