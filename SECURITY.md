# Security

## Reporting a vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/mdeeb95/poe2buildplanner/security/advisories/new) rather than public issues.

Include steps to reproduce, impact, and any suggested fix if you have one.

## Scope notes

- The production app is a read-only Next.js deployment: public JSON routes (`/tree`, `/gems`, etc.) stream committed files from disk. There is no user authentication or server-side build storage today.
- Build import/export is client-side (`.build` JSON files). Untrusted imports should be treated as untrusted input.
- Do not commit secrets (Railway tokens, `.env` files). Production currently requires no API keys.

We aim to acknowledge reports within a few days and patch confirmed issues promptly.
