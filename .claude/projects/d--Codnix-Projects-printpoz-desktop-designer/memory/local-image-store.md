---
name: local-image-store
description: Desktop user-photo storage is fully local (no S3 upload); decisions + interception points
metadata:
  type: project
---

Implemented Phase 1+2 of the offline-assets plan (see OFFLINE_ASSETS_IMPLEMENTATION_PLAN.md) for USER PHOTOS only, on 2026-06-25.

**Locked decisions (user-chosen, not derivable from code):**
- **Fully local, NO server upload** for user photos on desktop. Saved project JSON holds `app-assets://` URLs — NOT portable across machines / not server-render-able (accepted tradeoff; later sync phase may revisit).
- **All import paths** go local (device picker, drag-drop, clipboard paste, Google Photos). MobileUpload.jsx stays server-based (inherently needs the server).
- **Gallery persists across restarts** via a per-project `index.json` on disk.

**Single renderer interception point:** `uploadImageOptimized()` in `src/library/utils/upload/uploadManager.js` — branches on `localAssetsEnabled` BEFORE the S3 flow. Every path funnels through it, so all import paths become local automatically. No `File.path` needed (Electron 33 removed it) — we send the resized variant BYTES (ArrayBuffers) over IPC.

**Key files:** `electron/main/services/local-assets.service.ts` (content-addressed SHA-256 writes + in-memory authoritative index, sync mutate, debounced atomic flush, `flushAllSync` on before-quit, ObjectId-shaped monotonic ids), `electron/main/ipc/assets.ipc.ts`, `app-assets://` protocol in `electron/main/protocol.ts`, renderer adapter `src/library/utils/upload/localAssetStore.js`, gallery/favorite/delete branches in `src/tools/photos/PhotosAction.jsx`.

**Two hard-won constraints (from advisor review):** (1) index MUST be mutated synchronously in-memory + flushed atomically or bulk import races clobber entries; (2) the gallery `_id` MUST be ObjectId-shaped & monotonic (8-hex seconds + per-process-constant 10-hex random + 6-hex counter) — NOT the content hash — because the gallery sorts/keys by `_id` and relies on hex-compare == added-order. Bytes are content-addressed for dedup; identity is kept separate.

**Display on desktop (2026-06-25 follow-up):** local files load instantly from disk, so the progressive-image bandwidth ladder is bypassed — `useProgressiveImage` returns the LARGE variant directly on desktop, `isLocalUrl()` treats `app-assets:` as local, the canvas ghost overlay and footer preview (`src/layout/preview/Photo.jsx`) use large too. `DESKTOP_DISPLAY_ORDER = ["large","medium","small"]` in `progressiveImage.js`. Footer-large is a deliberate (user-requested) call despite the many-page decode cost — revisit to `medium` if footer lags.

**Never-upload guard:** `fallbackLegacyUpload` in `uploadManager.js` THROWS on desktop (was the one path that could still hit S3 if local save/resize threw). Upload-queue tab is skipped on desktop in `ImportPhotoFromDevice.jsx` + `ImportPhoto.jsx` (no upload → just close, optimistic gallery). Plan image-cap bypassed on desktop in `common-functions/index.js` (`handleImageUploadLimit`).

**Storage location (Windows):** `%APPDATA%\photo-editor-desktop-app\projects\<projectId>\assets\<sha256>.<ext>` + `index.json`. `<projectId>` = `cart_order_id`, or `default` for unsaved projects. (productName "Photo Editor" only applies to packaged builds; dev uses the package.json `name`.)

**Display perf (do NOT force always-large):** desktop canvas uses MEDIUM at cover-fit and LARGE only when zoomed >1.5× (the existing `wantLarge` gate in `progressiveImage.js`). Forcing large for every placed image decoded ~96MB/photo → ~2GB/20-image spread → severe lag. Ghost overlay + sidebar gallery + footer all use SMALL. Only the focused/zoomed canvas image goes large. [[local-export-pipeline]]

**Next (not yet done):** library asset caching (backgrounds/stickers/masks/cliparts/fonts/themes), and the export pipeline (`export:renderSvg`). See [[offline-assets-roadmap]].
