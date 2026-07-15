---
paths:
  - "src/**"
---

# Renderer (React) Rules

- This is the existing web editor, reused. **Do not rewrite it.** Keep changes minimal and
  **non-breaking for the web build** — every change must still work when `window.desktop` is absent.
- **Never import from `electron/`** or any Node/Electron API in `src/`. Reach the OS only via the
  `src/desktop/` adapter (`desktop`, `isDesktop`, `appConfig`), which wraps `window.desktop`.
- **Branch on capability, not platform inline.** Use `isDesktop` / optional chaining on `desktop?.…`
  with a web fallback; don't scatter `process.platform` checks through components.
- Routing: `HashRouter` is selected automatically on desktop in `src/index.jsx` — don't hardcode it.
- Config: read API base URLs from the existing `apiurl.js` (it already reads `window.__APP_CONFIG__`
  with a web fallback). Don't re-hardcode URLs.
- Incremental TS adoption only — convert one file at a time (`.js`→`.ts`); never a big-bang migration.
- Token storage currently stays in `localStorage` (works in Electron). Migrating to `secureStore`
  is a planned hardening step — coordinate via the adapter, keep the sync `getAccessToken` contract.
