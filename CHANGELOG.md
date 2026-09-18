# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-18

### Added

- `--oracle python` inspects the wheel and sdist from `python -m build` (gitignored `package-data` / `MANIFEST.in` leaks)
- Example `examples/leaky-python`
- CI job that runs the published Action `cocabot/gro@v0.3.0` against this repo

## [0.3.0] - 2026-09-18

### Added

- `--baseline last-tag|git:<ref>|npm:latest` compares packed paths to that tarball (`baseline-added`, `baseline-removed`)
- Action input/output `baseline`

### Changed

- GitHub Pages deploy is `workflow_dispatch` only until Pages is enabled on the repository

## [0.2.0] - 2026-09-18

### Added

- `--oracle auto|npm|pnpm|yarn` inspects the tarball from that pack command (`auto` uses `packageManager`, then lockfiles)
- pre-commit hook (`repo: https://github.com/cocabot/gro`, `always_run: true`)
- GitHub Pages landing page under `site/`
- Action output `resolved-oracle`

### Changed

- GitHub is the documented distribution channel (`npx github:cocabot/gro`, Action, pre-commit). npmjs is not required.
- Findings that mention the pack command use the resolved oracle name (`npm` / `pnpm` / `yarn`)

## [0.1.0] - 2026-09-17

### Added

- CLI that runs `npm pack` and inspects the resulting tarball
- Comparison of packed paths against `git ls-files` (`packed-untracked`)
- Default deny list for `.env`, private keys, `.npmrc`, and similar files
- High-confidence content scan for PEM/PKCS keys, GitHub PATs, npm tokens, AWS access key IDs, and Slack bot tokens
- Required-file checks (default `LICENSE` and `README.md`)
- Checks that `main` / `module` / `types` / `bin` / `exports` targets are packed
- Warning for overly broad `package.json` `"files"` patterns (`*`, `**`, `**/*`)
- Optional unpacked size budget
- Text, JSON, Markdown, and SARIF reports
- GitHub Action with job summary, annotations, and outputs
- `packgate.json` and `package.json#packgate` configuration

[0.4.0]: https://github.com/cocabot/gro/releases/tag/v0.4.0
[0.3.0]: https://github.com/cocabot/gro/releases/tag/v0.3.0
[0.2.0]: https://github.com/cocabot/gro/releases/tag/v0.2.0
[0.1.0]: https://github.com/cocabot/gro/releases/tag/v0.1.0
