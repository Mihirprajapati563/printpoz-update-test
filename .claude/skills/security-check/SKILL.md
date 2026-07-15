---
name: security-check
description: Run the secret scan and Electron security audit before any build or release.
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
---

# Security Check (pre-release gate)

1. **Secret scan** — grep `src/` and `electron/` for `sk-`, `GOCSPX-`, `client_secret`, `AKIA`,
   and `BEGIN PRIVATE KEY`. Any hit is a blocker.
2. **Electron audit** — delegate to the `electron-security-auditor` agent (isolation, sandbox, CSP,
   preload exposure, navigation guards).
3. **Report** — list findings by severity with file:line and fixes; state clearly whether the build
   is safe to ship. Do NOT proceed to packaging if any Critical finding remains.
