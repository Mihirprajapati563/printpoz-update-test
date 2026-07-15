---
name: lint-typecheck
description: Type-check the Electron TypeScript layer and report/fix issues. Use after editing anything under electron/.
allowed-tools: Bash(npm run typecheck:electron), Bash(npx tsc*), Read, Edit
---

# Type-check the Electron layer

1. Run `npm run typecheck:electron` (`tsc -p electron/tsconfig.json`).
2. If there are errors, fix them by editing the offending files (keep strict-TS clean — no `any`).
3. Re-run until green and report the result.

(The renderer is JS and compiled by react-scripts; this skill covers the TS layer.)
