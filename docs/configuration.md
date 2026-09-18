# Configuration

packgate reads the first source that exists:

1. `--config path/to/packgate.json`
2. `packgate.json` in the package directory
3. the `"packgate"` object in `package.json`

All keys are optional. Missing keys keep the defaults.

## Fields

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `deny` | string[] | see below | Packed paths matching a pattern fail. `!` prefixes a negation. |
| `require` | string[] | `["LICENSE", "README.md"]` | Each entry must match at least one packed path (exact or glob). npm already auto-includes `LICENSE`/`README` when those files exist on disk; this check fails when they are absent entirely. |
| `allowUntracked` | string[] | `[]` | Packed paths that may be absent from git (`packed-untracked` skip list). |
| `maxUnpackedBytes` | number \| null | `null` | Fail when the pack tarball's unpacked size exceeds this budget. |
| `scanContents` | boolean | `true` | Read packed files for high-confidence secret patterns. |
| `git` | boolean | `true` | Compare packed paths to `git ls-files`. |
| `oracle` | `"auto"` \| `"npm"` \| `"pnpm"` \| `"yarn"` | `"auto"` | Which pack command to inspect. |

Replacing `deny` replaces the **entire** default list. Copy the defaults you still want.

## Default deny list

```json
[
  "**/.env",
  "**/.env.*",
  "!**/.env.example",
  "!**/.env.sample",
  "!**/.env.template",
  "!**/.env.test",
  "!**/.env.testing",
  "**/*.pem",
  "**/*.p12",
  "**/*.pfx",
  "**/*.key",
  "**/*.keystore",
  "**/id_rsa",
  "**/id_ed25519",
  "**/.npmrc",
  "**/.pypirc",
  "**/.aws/credentials",
  "**/credentials.json",
  "**/service-account*.json",
  "**/.git",
  "**/.git/**"
]
```

`**/.env` matches `.env` at the package root and in subdirectories.

## Example `package.json` snippet

```json
{
  "packgate": {
    "require": ["LICENSE", "README.md", "dist/index.js"],
    "maxUnpackedBytes": 1048576
  }
}
```

## Severity

| Kind | Default severity |
| --- | --- |
| `secret-content`, `secret-filename`, `missing-package-path` | critical |
| `packed-untracked`, `deny-glob`, `missing-required` | high |
| `dangerous-files-field` (no packed secret names) , `unpacked-size` | medium |
| `dangerous-files-field` when packed names look like secrets | high |

`--fail-on-severity high` (the default) fails on high and critical.
