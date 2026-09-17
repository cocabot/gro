# Troubleshooting

## `npm pack` failed (exit 2)

packgate shells out to `npm pack`. Failures usually mean:

- there is no `package.json` in `--path`
- `package.json` is invalid JSON
- npm cannot pack because of a lifecycle script error

Run `npm pack --dry-run --json` in the same directory. Fix that first.

## False positive: generated files are packed but not in git

Build outputs sometimes are gitignored and only created in CI. Either:

- commit the generated files that you publish, or
- build in CI **and** add those paths to `allowUntracked`, or
- stop packing them (`files` allow list)

Prefer committing or generating them before packgate runs over a blanket `allowUntracked: ["**"]`.

## False positive: `.env.example`

Defaults already negate `.env.example`, `.env.sample`, `.env.template`, `.env.test`, and `.env.testing`. If you use another name, add a negation:

```json
{
  "deny": ["**/.env", "**/.env.*", "!**/.env.example", "!**/.env.development"]
}
```

Remember that setting `deny` replaces the default list.

## False positive: `*.key` source files

`**/*.key` is denied because TLS private keys commonly use that suffix. If your project has non-secret `.key` files, drop that glob from a copied deny list.

## `packed-untracked` on `package.json`

That should not happen; `package.json` is normally tracked. If it does, you ran packgate outside the git work tree (`--no-git` disables the comparison).

## Action cannot find `dist/action.js`

You are using this repository as a GitHub Action. The tagged release must contain `dist/`. If you are developing packgate itself, run `npm run build` and commit `dist/`.

## Contents scan missed a secret

The scanner is deliberately narrow. Add a deny glob for the filename, or use gitleaks/TruffleHog for git history. Please open an issue if a **high-confidence** public token format is missing.

## Windows

Content listing uses a built-in tar.gz reader, not the system `tar`. `npm` and `git` still need to be on `PATH`.
