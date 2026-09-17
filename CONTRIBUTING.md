# Contributing

Thanks for helping improve packgate. The useful contributions are: failing fixtures, clearer docs, fewer false positives, and support for other pack oracles (`pnpm pack`, Python wheels, crates).

## Development setup

Requirements: Node.js 20+, npm, git.

```bash
git clone https://github.com/cocabot/gro.git
cd gro
npm install
npm test
```

`npm test` typechecks, compiles `src/` to `dist/`, then runs `node --test` on `test/*.test.ts`.

Run packgate against this repo (after a build):

```bash
npm run packgate
```

## Layout

- `src/` — library, CLI, GitHub Action entry
- `test/` — Node's built-in test runner
- `docs/` — user documentation
- `action.yml` — GitHub Action metadata
- `dist/` — compiled JavaScript committed so `uses: cocabot/gro@<tag>` works without a build step inside the action

If you change `src/`, run `npm run build` and include the updated `dist/` in the same commit.

## Tests

Add a fixture under a temp dir (see `test/analyze.test.ts`) rather than snapshots of real private packages.

- Reproduce the tarball you care about with `files` / `.npmignore` / `.gitignore`
- Assert `finding.kind`, not the full message string, unless the message is the behavior

## Pull requests

Use the PR template. Include:

- the problem (a tarball that is wrong today)
- how you tested it (`npm test` and, if relevant, `npm pack --dry-run` in a fixture)
- any compatibility impact (CLI flags, config keys, finding kinds)

## Security

Do not attach live secrets to issues or PRs. See [SECURITY.md](SECURITY.md).
