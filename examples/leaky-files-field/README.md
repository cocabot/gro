# Example: gitignored `.env` still packed

This directory is a **demonstration**, not a published package. From the repository root:

```bash
node dist/cli.js examples/leaky-files-field
```

`package.json` uses `"files": ["*"]` while `.gitignore` lists `.env`. packgate should fail: the tarball still contains `.env`.
