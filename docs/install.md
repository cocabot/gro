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
- uses: cocabot/gro@v0.3.0
  with:
    fail-on-severity: high
    oracle: auto
```

The action runs from this repository's `dist/`. Consumers do not publish anything.

## pre-commit

```yaml
repos:
  - repo: https://github.com/cocabot/gro
    rev: v0.3.0
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

If there is no `package.json` but `pyproject.toml` or `setup.py` exists, `auto` uses `python3 -m build`. That needs the `build` package (`python3 -m pip install build`).

The chosen binary must be on `PATH`. GitHub-hosted runners have npm. Enable Corepack or add a setup step for pnpm/yarn when those lockfiles are present. Python packages need `python3` and `python3 -m build`.

## GitHub Pages

The `site/` directory is a static landing page. GitHub Pages is not turned on for this repository yet, so the deploy workflow is `workflow_dispatch` only (it will fail on every push until Pages is enabled). After **Settings → Pages → GitHub Actions**, run the Pages workflow from the Actions tab.

## What this project will not do

It will not create npmjs, PyPI, or other third-party accounts on your behalf.
