# Electron Desktop — Setup, Run & Verify

This app is the existing React (CRA) photo editor wrapped in **Electron + TypeScript**, added
**in-place** (the React app in `src/` is intact). Below is everything needed to install, run, build,
and verify.

## What was added (not breaking the web app)

```
electron/                         # Electron layer (TypeScript, strict)
├── shared/ipc.ts                 # IPC contract: channels + types + DesktopApi (source of truth)
├── main/
│   ├── index.ts                  # app lifecycle, single-instance, bootstrap
│   ├── window.ts                 # BrowserWindow (secure webPreferences) + window-state restore
│   ├── protocol.ts               # app:// protocol serving the built renderer
│   ├── security.ts               # CSP + navigation guards
│   ├── menu.ts                   # native menu → menu:event (Undo/Redo/Save/Export/…)
│   ├── config.ts                 # runtime config (API base URL per env)
│   ├── lib/logger.ts
│   ├── ipc/                      # one module per IPC domain (app, secure-store, dialog, fs)
│   └── services/                 # secure-store (safeStorage), window-state
├── preload/index.ts              # contextBridge → window.desktop + window.__APP_CONFIG__
└── tsconfig.json
scripts/build-electron.mjs        # esbuild bundler → dist-electron/{main,preload}.js
scripts/hooks/*.mjs               # Claude Code hook scripts (secret-block, type-check)
electron-builder.yml              # packaging (Win NSIS + Mac dmg)
src/desktop/                      # renderer-side bridge adapter (plain JS)
.claude/                          # AI workflow: rules, agents, skills, settings(+hooks)
```

**Renderer edits (minimal, web-safe):**
- `src/index.jsx` — uses `HashRouter` on desktop, `BrowserRouter` on web (auto-detected).
- `src/library/utils/constants/apiurl.js` — reads `window.__APP_CONFIG__` with the web URL as fallback.
- `src/App/app.jsx` — mounts `useDesktopMenu()` (wires native Undo/Redo; no-op on web).
- `package.json` — added `main`, `homepage: "./"`, Electron scripts + devDependencies.

## Install

```bash
npm install
```

## Run (development — hot reload)

```bash
npm run electron:dev
```
Starts CRA on `http://localhost:3000` (no browser tab) and launches Electron against it.
> Editing `electron/*` requires re-running this (main-process hot reload is not wired in v1).

## Run (production-from-source — exercises app:// + real worker behavior)

```bash
npm run build          # CRA build → build/
npm run electron:start # bundles electron + launches, serving build/ via app://
```

## Package installers (unsigned for now)

```bash
npm run dist        # current OS
npm run dist:win    # Windows NSIS .exe
npm run dist:mac    # macOS .dmg
```
Output in `release/`. Signing + notarization are Phase 4 (see `docs/06-IMPLEMENTATION-PLAN.md`).

## Type-check the Electron layer

```bash
npm run typecheck:electron
```

## ✅ Verification checklist (run these once after `npm install`)

1. **Dev launch:** `npm run electron:dev` → editor window opens (login or `/`).
2. **Production launch:** `npm run build && npm run electron:start` → editor loads via `app://`.
3. **⭐ Worker spike (most important):** select photos → thumbnails appear and an upload runs **via the
   resize Web Worker**, NOT the main-thread fallback. Open DevTools (View ▸ Toggle DevTools in dev)
   and confirm no "worker unsupported / fallback" path. *This is the #1 thing to confirm.*
4. **3D preview** renders (Three.js).
5. **socket.io** face-swap progress works (if exercised).
6. **Native menu:** Edit ▸ Undo / Redo affects the canvas; File ▸ Save/Export fire `desktop:menu`.
7. **Window state** restores size/position on relaunch.
8. **Config:** API calls hit `apis.printpoz.com` (or your `PE_API_BASE_URL`).

## Known follow-ups (intentionally deferred to keep this conversion non-breaking)

- **Secrets (do this ASAP):** remove + rotate the OpenAI key (`src/tools/text/CaptionByAI.jsx`) and
  the Google client secret (`src/tools/photos/googlePhotosPickerUtils.js`); route AI captions via the
  backend; switch Google to a PKCE desktop client. The `block-secrets` hook stops NEW secrets.
- **Desktop Google OAuth:** the current web flow uses `window.location.origin`; for app:// it needs the
  system-browser + loopback PKCE pattern (`auth:openExternal` IPC is already available).
- **CSP hardening:** `electron/main/security.ts` is permissive; tighten `connect-src` + drop
  `unsafe-eval` after verifying (use the `electron-security-auditor` agent).
- **Token storage → safeStorage:** `secureStore` IPC is ready; rewire `apiCall.js` getters via an
  adapter with startup hydration (keeps the sync contract). Currently tokens stay in `localStorage`
  (works in Electron).
- **Auto-update / signing:** wire `electron-updater` + Authenticode/notarization in Phase 4.
- **Env config for env switching:** launch with `PE_ENV` / `PE_API_BASE_URL` to point at staging.

## AI-assisted workflow

`.claude/` is configured: path-scoped **rules**, four **sub-agents** (`ipc-contract-guardian`,
`electron-security-auditor`, `ts-code-reviewer`, `performance-auditor`), four **skills**
(`add-ipc-channel`, `lint-typecheck`, `run-app`, `security-check`), and **hooks** (PreToolUse
secret-blocker, PostToolUse change-note, Stop type-check). See `docs/07-CLAUDE-CODE-AI-WORKFLOW.md`.
