# Install without npmjs

packgate is distributed from this GitHub repository. You do not need an npmjs.com, Docker Hub, or PyPI account to run it.

## One-shot CLI

Requires Node.js 20+ and `npm` on `PATH` (the npm client, not an npmjs login).

```bash
npx --yes github:cocabot/gro
```

## Dependency

```bash
npm install github:cocabot/gro
```

That clones the GitHub repo; it does not talk to the npmjs registry for packgate itself.

## GitHub Action

```yaml
- uses: cocabot/gro@v0.2.0
  with:
    fail-on-severity: high
    oracle: auto
```

The action runs from this repository's `dist/`. Consumers do not publish anything.

## pre-commit

```yaml
repos:
  - repo: https://github.com/cocabot/gro
    rev: v0.2.0
    hooks:
      - id: packgate
```

pre-commit clones the hook repo and installs it with Node. Again, no npmjs package is required.

## Oracle tools

`--oracle auto` picks:

1. `package.json` `"packageManager"` (`pnpm@…`, `yarn@…`, `npm@…`)
2. `pnpm-lock.yaml` → pnpm
3. `yarn.lock` → yarn
4. otherwise npm

The chosen binary must be on `PATH`. GitHub-hosted runners have npm. Enable Corepack or add a setup step for pnpm/yarn when those lockfiles are present.

## GitHub Pages

The `site/` directory is a static landing page. After merge to `main`, enable **Settings → Pages → GitHub Actions** in this repository (no extra account). The `Pages` workflow deploys it.

## What this project will not do

It will not create npmjs, PyPI, or other third-party accounts on your behalf.
