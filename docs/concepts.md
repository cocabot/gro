# Concepts: git, `.gitignore`, and `npm pack`

Three different file sets show up when you publish a JavaScript package:

1. **The working tree** — everything on disk.
2. **The git tree** — `git ls-files`. `.gitignore` only affects this set.
3. **The npm tarball** — `npm pack`. This is what `npm publish` uploads.

packgate compares (3) with (2) and with a deny list. It does not try to replace a secret scanner for git history.

## How npm decides what to pack

npm's packing rules (simplified):

- If `package.json` has a `files` array, that is an **allow list** (plus `package.json` itself, README, LICENSE, and a few always-included files).
- Else if `.npmignore` exists, it is used like `.gitignore`.
- Else `.gitignore` is used.

The dangerous case is a **broad `files` allow list**:

```json
{
  "files": ["*"]
}
```

`*` is not "everything git tracks". It is "everything npm's pack walker can see", including files you ignored in git so they would never be committed. `.env`, `credentials.json`, and editor swap files can all ride along.

A narrower allow list is the usual fix:

```json
{
  "files": ["dist", "LICENSE", "README.md"]
}
```

## What packgate will not do

- It will not rotate leaked credentials. If a finding is `secret-content` or `secret-filename`, treat the value as compromised until you know otherwise.
- It is not a general secret scanner. Patterns are intentionally few and high-confidence to keep CI noise low.
- It uses `npm pack` as the oracle. `pnpm pack` / `yarn pack` can differ; see the issue tracker for ecosystem coverage.
- License compatibility of dependencies is out of scope.

## Related tools

Use them together:

- [publint](https://github.com/publint/publint) — manifest and export map issues
- [Are the types wrong?](https://github.com/arethetypeswrong/arethetypeswrong.github.io) — TypeScript resolution of the published package
- [gitleaks](https://github.com/gitleaks/gitleaks) / [TruffleHog](https://github.com/trufflesecurity/trufflehog) — secrets in git
- [lockfile-lint](https://github.com/lirantal/lockfile-lint) — lockfile URL and integrity hygiene
