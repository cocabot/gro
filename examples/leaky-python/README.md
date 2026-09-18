# Example: gitignored `.env` still packed by setuptools

This directory is a **demonstration**, not a published package. From the repository root:

```bash
node dist/cli.js examples/leaky-python
```

`[tool.setuptools.package-data]` includes `*` / `.env` while `.gitignore` lists `.env`. packgate should fail: the wheel still contains `leaky/.env`.
