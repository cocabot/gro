# Security policy

## Supported versions

The `main` branch and the latest `v*` GitHub release are supported.

## Reporting a vulnerability

If packgate itself can be used to leak secrets (for example, a finding message that echoes a live credential, a path traversal when reading tar entries, or a command injection through package metadata), **do not open a public issue**.

Use GitHub's **Privately report a vulnerability** flow on this repository:

https://github.com/cocabot/gro/security/advisories/new

Include:

- packgate version or commit
- a minimal package that reproduces the problem
- **redacted** evidence (never paste a live token)

We will acknowledge the report, fix it on a private branch when needed, and publish a release with a changelog note.

## What packgate is not

A packgate finding that your **package tarball** contains a secret is working as designed. Rotate the credential, remove the file from the tarball, and treat already-published versions as compromised. That class of issue can be a public bug report against **your** package, not a packgate advisory.
