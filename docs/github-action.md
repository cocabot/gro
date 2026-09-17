# GitHub Action

```yaml
- uses: cocabot/gro@v0.1.0
  with:
    path: .
    fail-on-severity: high
    report-format: markdown
    scan-contents: true
    git: true
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `path` | `.` | Package directory |
| `config` | empty | Path to `packgate.json` |
| `report-format` | `markdown` | `text`, `json`, `markdown`, or `sarif` |
| `fail-on-severity` | `high` | Threshold or `none` |
| `scan-contents` | `true` | Scan packed file contents |
| `git` | `true` | Compare with `git ls-files` |

## Outputs

| Output | Meaning |
| --- | --- |
| `finding-count` | Total findings |
| `critical-count` | Critical findings |
| `high-count` | High findings |
| `packed-file-count` | Files in the tarball |

The action writes a job summary and GitHub workflow annotations. It only needs `contents: read`.

## Permissions

```yaml
permissions:
  contents: read
```

Do not grant `id-token: write` or `packages: write` for this job unless another step needs them.

## Build before packing

If the published tarball is supposed to contain `dist/`, run your build first. packgate will not compile TypeScript for you; it inspects whatever `npm pack` would ship from the current tree.

## Pinning

Pin the action to a tag or a commit SHA. Tags can move; SHAs do not.

```yaml
- uses: cocabot/gro@v0.1.0
# or
- uses: cocabot/gro@<commit-sha>
```
