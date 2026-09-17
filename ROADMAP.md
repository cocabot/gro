# Roadmap

These are real gaps, not filler. Each item should land with a fixture and a finding kind or a documented non-goal.

## Next

- **`pnpm pack` / `yarn pack` oracle** — npm pack is the registry-facing default, but package-manager-specific tarballs can differ.
- **Workspace packages** — run against `--workspace` members instead of only the current directory.
- **Baseline diff** — compare the current tarball to the previous git tag or `npm view <name> dist.tarball`.
- **Python sdists/wheels** — the same class of bug exists for `python -m build` artifacts (`files` vs VCS vs `MANIFEST.in`).

## Later

- Cargo `cargo package --list`
- Allow listing packed files in a lockfile checked into git (`packgate-lock.json`) for reviewable diffs
- GitHub Action that comments a packed-file diff on pull requests (needs `pull-requests: write`)

## Non-goals

- Replacing gitleaks for git history
- License-compatibility legal opinions
- Auto-rewriting `package.json` `files` without a confirmed dry-run
