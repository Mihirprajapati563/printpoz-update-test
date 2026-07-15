---
name: add-ipc-channel
description: Scaffold a new main↔renderer IPC channel end-to-end (contract + handler + preload + renderer adapter). Use whenever the renderer needs a new OS/native capability.
argument-hint: "<domain:action> <short description>"
allowed-tools: Read, Edit, Grep, Bash(npm run typecheck:electron)
---

# Add an IPC Channel

Add the capability `$ARGUMENTS`, following the contract-first recipe (see docs/05-ARCHITECTURE.md §7).

1. **Contract** — `electron/shared/ipc.ts`:
   - add the channel constant to `CHANNELS` (`domain:action`);
   - add request/response types and the method signature on `DesktopApi`.
2. **Service** (if it does OS work) — `electron/main/services/<name>.service.ts`: a plain async
   function, no IPC knowledge, unit-testable.
3. **Handler** — `electron/main/ipc/<domain>.ipc.ts`: validate args → delegate to the service →
   return `IpcResult` (never throw). Register it in `electron/main/ipc/index.ts`.
4. **Preload** — `electron/preload/index.ts`: add a typed wrapper using the `invoke()` helper.
5. **Renderer adapter** — expose it through `src/desktop/` with a safe web fallback (so the web
   build still works when `window.desktop` is absent).
6. **Verify** — run `npm run typecheck:electron`. Optionally delegate to the `ipc-contract-guardian`
   agent to confirm all layers agree.
7. **Docs** — update the IPC list in docs/05-ARCHITECTURE.md.
