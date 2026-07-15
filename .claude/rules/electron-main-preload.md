---
paths:
  - "electron/**"
  - "scripts/build-electron.mjs"
---

# Electron Main / Preload Rules

- **Strict TypeScript.** No `any` leaks; validate every IPC payload before use.
- **IPC is contract-first.** Add the channel + types in `electron/shared/ipc.ts` FIRST, then
  the `ipcMain.handle` in `electron/main/ipc/<domain>.ipc.ts`, then the wrapper in
  `electron/preload/index.ts`. Register new domains in `electron/main/ipc/index.ts`.
- **Handlers never throw across the bridge.** Return `IpcResult<T>` (`{ ok, data } | { ok:false, error }`).
  The preload `invoke()` helper unwraps it.
- **Services vs IPC.** OS logic lives in `electron/main/services/*` as plain async functions
  (no `ipcMain` knowledge). IPC modules only validate args and delegate.
- **Security invariants (never weaken):** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`. Expose ONLY the curated `window.desktop` API — never
  raw `ipcRenderer` or Node modules.
- **Navigation:** keep `setWindowOpenHandler` deny + `will-navigate` guard intact; external
  links open via `shell.openExternal`.
- The preload is bundled by esbuild (electron external). Keep it dependency-light so it bundles
  cleanly under `sandbox: true`.
- Build = `npm run build:electron` (esbuild → `dist-electron/`). Type-check = `npm run typecheck:electron`.
