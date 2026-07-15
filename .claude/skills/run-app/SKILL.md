---
name: run-app
description: Build and launch the Electron desktop app to verify a change in the real app. Use to confirm the editor loads, uploads run via the worker, and 3D previews render.
allowed-tools: Bash(npm run *), Bash(npm install*)
---

# Run the Desktop App

1. If `node_modules` is missing, run `npm install` first.
2. **Dev (hot reload renderer):** `npm run electron:dev` — starts CRA on :3000 and launches Electron
   against it.
3. **Production-from-source:** `npm run build` then `npm run electron:start` — serves the built
   renderer via the `app://` protocol (this is the path that exercises real production behavior).
4. Verify and report:
   - editor window loads (login or `/` route under HashRouter);
   - selecting photos shows thumbnails and an upload runs **via the resize worker** (not the
     main-thread fallback — check DevTools/console);
   - a 3D product preview renders;
   - native menu Undo/Redo works.

Report exactly what you observed (and any console errors).
