# Image Upload Pipeline

This document describes the bulk image upload pipeline: client-side resizing in Web Workers, chunked signed-URL uploads to S3, progress reporting, and the queue/toast UI. It reflects the June 2026 performance rework (see [Changelog](#changelog--june-2026-performance-rework) at the bottom for what changed and why).

## Design Goals

1. **The UI must stay responsive** while 30+ images of 20–30 MB each upload. All CPU-heavy image work (decode, rasterize, encode) runs off the main thread.
2. **CPU and network concurrency are bounded separately.** Decoding a 20–30 MB photo costs ~200 MB of transient RAM and seconds of CPU; uploads are I/O-bound and tolerate more parallelism. One knob must not multiply the other.
3. **Redux dispatch volume is throttled.** Raw XHR progress events (per chunk × parallel chunks × parallel images) must not flood the store.
4. **Print quality is preserved.** The large variant keeps full original resolution; where possible the untouched original bytes are uploaded (no lossy re-encode generation).

## High-Level Flow

```
User selects N images (file picker / drag-drop / Google Photos / mobile QR flow)
    ↓
dispatchUploadsWithConcurrency(dispatch, uploadItems)        imageUploadThunks.js
    ├─ [Sync] Pre-register all N images in Redux (status: "queued")
    │         → queue UI shows the full list instantly (placeholder thumbnails)
    └─ [Async] MAX_CONCURRENT_UPLOADS worker loops, each repeating:
        dispatch(uploadImage(item))
            ├─ 1. RESIZE   resizeImageInPool(file)           resizePool.js → resize.worker.js → imageResizer.js
            │      ├─ emits ≤256px thumbnail EARLY → setPreviewUrl → queue row preview appears
            │      └─ returns { large, medium, small, width, height, mimeType }
            ├─ 2. INIT     POST /uploads/init                → signed multipart URLs per variant
            ├─ 3. UPLOAD   5 MB chunks × MAX_CONCURRENT_CHUNKS per variant, sequential variants
            │      └─ throttled progress dispatches → updateUploadProgress
            ├─ 4. COMPLETE POST /uploads/complete            → server assembles, returns URL variants
            └─ dispatch(uploadSuccess) — or uploadFailure, with legacy fallback in between
```

## Components

### `src/library/utils/upload/imageResizer.js` — core resize (environment-agnostic)

Runs in **both** window and Worker contexts.

- Reads EXIF orientation from the first 64 KB of the file (JPEG only; everything else → orientation 1).
- Decodes via `createImageBitmap(file, { imageOrientation: "none" })` so the bitmap holds raw pixels and our manual orientation transform is the only rotation applied (Chrome 105+ would otherwise pre-rotate and cause double rotation).
- Produces variants sequentially (one canvas alive at a time — peak-memory bound, critical on mobile):
  - **thumbnail** (optional, `opts.thumbMaxDim`, longest side capped, quality 0.7) — generated FIRST and delivered early via `opts.onThumb` so the UI gets a preview while heavy encodes still run
  - **large** — full resolution
  - **medium** — 50%, **small** — 25% (quality 0.85)
- **Original-bytes fast path:** when EXIF orientation is 1, the type is JPEG/PNG, and no explicit `outputType` is requested, the untouched original `File` is returned as `large` — skipping the most expensive encode (seconds of CPU on a ~50 MP photo) and avoiding a lossy re-encode generation. Safe because the server reads pixel dimensions from the uploaded blob, and with orientation 1 the raw bytes already match the decoded dimensions.
- Orientations 2–8 still re-encode the large variant with the rotation baked in (sending raw bytes with an EXIF rotation tag would make the server store unrotated w/h).
- In a Worker without `OffscreenCanvas` it throws `"worker-unsupported"` so the pool can fall back.

### `src/library/utils/upload/resize.worker.js` — Worker wrapper

Thin dedicated-Worker shell around `resizeImage`. Bundled by CRA 5 / webpack 5 via `new Worker(new URL("./resize.worker.js", import.meta.url))` (emitted as its own chunk).

Message protocol (one job at a time per worker):

| Direction | Message |
|---|---|
| main → worker | `{ file, outputType, quality, thumbMaxDim }` |
| worker → main | `{ type: "thumb", thumb }` — early preview blob |
| worker → main | `{ type: "done", result }` — all variants ready |
| worker → main | `{ type: "error", error, unsupported }` — `unsupported: true` ⇒ this browser's workers lack OffscreenCanvas |

### `src/library/utils/upload/resizePool.js` — bounded worker pool

- `resizeImageInPool(file, { outputType, quality, thumbMaxDim, onThumb })` → same result shape as `resizeImage`.
- Pool size: `POOL_SIZE` (hardware-dependent cap — **hand-tuned; read the current value in the source**). All resize requests funnel through the pool; excess requests queue. This is what decouples CPU concurrency from `MAX_CONCURRENT_UPLOADS`.
- Workers are spawned lazily and reused.
- **Failure handling:**
  - Worker reports `unsupported` (e.g. Safari < 16.4: no OffscreenCanvas in workers) → the job AND any jobs in-flight on other workers are re-queued, all workers are torn down, and the pool permanently switches to a **main-thread fallback with concurrency 1** (the pre-worker behavior, serialized to keep the UI alive).
  - Worker crashes (`onerror`, e.g. OOM on a corrupt/huge image) → only that job rejects; the slot is replaced. The rejection propagates to `uploadManager`, which degrades to the legacy upload for that image.

### `src/library/utils/upload/uploadManager.js` — orchestration

`uploadImageOptimized({ file, metadata, onProgress, onStatusChange, onThumbnail })`:

1. **Resize** via the pool. `thumbMaxDim: 256` is requested only when the caller passed `onThumbnail` (single-image paths like Canvas paste/drag-drop don't pay for a thumb they don't show).
2. **Init** — `POST /uploads/init` with metadata + per-variant `{ file_size, width, height }` → pre-signed multipart PUT URLs.
3. **Upload** — per variant: 5 MB chunks (`CHUNK_SIZE`), up to `MAX_CONCURRENT_CHUNKS` (2) parallel chunk PUTs **per image**, each PUT gated by the global `MAX_GLOBAL_CONCURRENT_CHUNKS` (6) FIFO connection semaphore so all images share the browser's connection budget fairly. Per-chunk retry ×3 with exponential backoff and offline-aware pausing (`waitForOnline`); the connection permit is released between retries. Variants upload **sequentially** (large → medium → small) to bound peak memory. A failed variant first retries with refreshed URLs (`/uploads/refresh-urls`) before falling back.
4. **Complete** — `POST /uploads/complete` with upload IDs + ETags → server returns `{ items: { urls: [{ size, url, w, h }] } }`.
- **Legacy fallback:** after 3 consecutive failures at any stage (or an unrecoverable resize error), the whole flow falls back to `apiMultiPartPost(uploadProjectImages)` — the original single-request multipart upload. The backend generates size variants itself on that path.
- Progress mapping: 2 (resize start) → 8 (resize done) → 12–90 (bytes uploaded across all variants) → 92 (finalizing) → 100.

### `src/store/background-services/imageUploadThunks.js` — Redux layer

- `dispatchUploadsWithConcurrency(dispatch, uploadItems)` — pre-registers all images, then runs `MAX_CONCURRENT_UPLOADS` worker loops (**hand-tuned; read the current value in the source**). Note: these loops are independent of Redux — removing an image from the queue UI does **not** cancel its upload; terminal reducers simply no-op for removed images.
- `uploadImage` thunk — drives one image through the manager and translates callbacks into actions:
  - **Progress throttling:** dispatches `updateUploadProgress` only when the integer percent changed AND ≥150 ms (`PROGRESS_DISPATCH_MIN_INTERVAL_MS`) passed since the last dispatch; terminal 100% always passes. Status messages are deduped.
  - **Thumbnail:** `onThumbnail` blob → `URL.createObjectURL` → `setPreviewUrl`.
- A new `batch_id` is generated per 10 selected images (entry points); batch completion pushes the id to `state.imageUpload.batch`, which `PhotosAction` watches to refresh the server-side gallery.

### `src/store/slices/imageUpload.js` — state

- `startUpload` — registers `{ imageId, file, batchId, previewUrl: null, status }`. **No object URL of the original file is created** — decoding dozens of full-resolution originals just to paint 72 px thumbnails was a major freeze source.
- `setPreviewUrl` — stores the worker thumbnail object URL; revokes the previous one, and revokes the incoming one if the image was removed meanwhile (no leaks).
- `uploadSuccess` — stores `uploadUrl` (large) + `uploadUrls` (all variants); no-ops if the image was removed mid-upload (previously crashed); completes batch tracking.
- `removeImage` / `clearQueue` / `clearCompleted` — all revoke preview object URLs.
- `clearCompleted` — removes **only** `status === "uploaded"` images. Queued/uploading must survive (their uploads keep running regardless of Redux); failed images stay so the user can Retry (per-row ✕ removes them individually).

### `src/tools/photos/UploadedQueue.jsx` — queue UI

- One memoized `QueueRow` (`React.memo`) per image — a progress tick re-renders only the affected row. Immer keeps untouched image objects referentially stable, so the shallow compare works.
- Gray placeholder icon until the worker thumbnail arrives (`previewUrl === null`); rows show name/size, color-coded status, striped/animated progress, Retry (on failure) and ✕.
- **“Clear Completed”** button (replaces “Clear All”): dispatches `clearCompleted`, disabled until at least one image finished.

### `src/components/popups/UploadProgressToast.jsx` — global progress toast

- Draggable fixed toast: progress ring, `X / Y completed`, `MB / MB`, and a red `N failed` line when applicable.
- **Session-stable totals** (`useActiveUploadStats`): a ref-tracked Set of imageIds defines the current upload session. Once an image joins, it stays in `total`/`bytesTotal` until the whole session ends — **including failed images and images of already-completed batches**. (Dropping them mid-run made totals shrink and the completed-count reset, e.g. `0/29 · 598 MB` suddenly reading `0/19 · 392 MB`.)
- Failed images keep their bytes in the denominator (stable total) but contribute 0 transferred — the percent honestly reflects missing bytes.
- Visibility is driven by `hasActive` (any queued/uploading image), not by totals, so the final numbers remain visible during the fade-out. The session set resets when new uploads start after full idle.

## Concurrency Model Summary

| Bound | Constant | Where | What it limits |
|---|---|---|---|
| Pipeline | `MAX_CONCURRENT_UPLOADS` | `imageUploadThunks.js` | images simultaneously in the resize→init→upload→complete pipeline (workers feeding the network stage) |
| CPU | `POOL_SIZE` | `resizePool.js` | simultaneous decodes/encodes across the whole app |
| **Global network** | `MAX_GLOBAL_CONCURRENT_CHUNKS` (6) | `uploadManager.js` | **total** chunk PUTs in flight across ALL images — a FIFO semaphore matching the browser's ~6-connections-per-host limit |
| Per-image network | `MAX_CONCURRENT_CHUNKS` (2) | `uploadManager.js` | parallel 5 MB chunk PUTs for a single image |

The two network constants together set **how many images upload visibly in parallel**: roughly `MAX_GLOBAL_CONCURRENT_CHUNKS / MAX_CONCURRENT_CHUNKS` (6/2 ≈ 3). Lower the per-image value to 1 for ≈6 images at once (each a bit slower); raise it for faster single-image uploads. Before the semaphore, each image independently opened 3 connections — with >2 images that oversubscribed the browser's 6-connection pool, and the surplus stalled invisibly (the "only 1-2 upload at a time, rest sit at Preparing" symptom). The semaphore makes the budget explicit and self-balancing: one image alone can take all 6, many images share fairly. Permits are acquired **per chunk attempt** and released in a `finally`, so a failed chunk frees its slot during the exponential-backoff sleep instead of holding a connection idle.

The CPU/pipeline constants (`POOL_SIZE`, `MAX_CONCURRENT_UPLOADS`) are deliberately hand-tuned — check the source for current values before reasoning about them. Note `MAX_CONCURRENT_UPLOADS` (pipeline workers, e.g. 10) is intentionally higher than the network can stream at once; the surplus workers keep images flowing through resize so the network stage is never starved.

## Browser Support

- **Worker path** (fast): needs `Worker` + `OffscreenCanvas` + `createImageBitmap` in workers — Chrome/Edge 69+, Firefox 105+, Safari 16.4+.
- **Main-thread fallback** (serialized): any browser with `createImageBitmap`.
- **Legacy upload fallback**: anything else, or after repeated API/network failures — original file via multipart POST, server does the resizing.

## Related store config

`src/store/store.jsx` disables both RTK dev middlewares (`serializableCheck` and `immutableCheck`). `immutableCheck` deep-scanned the entire store — including up to 300 redux-undo canvas snapshots — on every dispatch, which made dev freeze during bulk uploads and made dev performance unrepresentative of production. Don't re-enable.

## Future Improvement (requires backend work)

The backend can already derive size variants from a single original (the legacy endpoint does exactly that). If `/uploads/init` + `/uploads/complete` accepted a **single variant** and the server generated medium/small (+ EXIF auto-orient), the client would do almost zero image work — just stream original bytes and generate a thumbnail. That is the cheapest possible client pipeline; the worker pool already captures most of the win without backend changes.

## Changelog — June 2026 Performance Rework

Full session record (diagnosis, owner decisions, verification status): `docs/session-2026-06-12-upload-pipeline-rework.md`. Next planned feature on top of this pipeline: `optimistic_image_placement_plan.md` (root).

Problem: selecting 30+ images of 20–30 MB froze the editor (worst right after file selection), in both dev and production.

| Cause | Fix |
|---|---|
| Up to N images decoded + triple-encoded **on the main thread simultaneously** (~2 GB+ transient RAM, seconds of CPU each) | Resize moved into a bounded Web Worker pool (`resizePool.js`, `resize.worker.js`); CPU concurrency decoupled from network concurrency |
| Full-resolution large variant re-encoded for every image | Original bytes reused when EXIF orientation = 1 (JPEG/PNG) — no encode, better print fidelity |
| Unthrottled chunk progress events → hundreds of Redux dispatches/sec, full queue-table re-render each | Integer-percent + 150 ms throttle per image; status dedupe; memoized `QueueRow` |
| Queue thumbnails = object URLs of the **original files** → browser decoded 30 full-res images for 72 px previews | ≤256 px worker-generated thumbnails, emitted early; placeholder until ready; object URLs revoked on remove/clear |
| Dev-only RTK `immutableCheck` deep-scanned the store (incl. 300 undo snapshots) per dispatch | Disabled in `store.jsx` |
| Toast totals shrank / completed-count reset when images failed or batches completed | Session-stable stats (ref-tracked id Set), `hasActive`-driven visibility, failed count shown |
| “Clear All” deleted queued/uploading rows while their uploads kept running invisibly | `clearCompleted` reducer + “Clear Completed” button — only finished images are removed |
| Removing an image mid-upload crashed the `uploadSuccess` reducer | Guard added (no-op for removed images) |

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ [Architecture](architecture.md)
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 [Data Flow Diagram](data-flow-diagram.md)
- 🖌️ [Canvas](canvas.md)
- ✋ [Interaction](interaction.md)
- 📷 [Photo](photo.md)
- 🔷 [Shape](shape.md)
- ⭐ [Sticker](sticker.md)
- 🔤 [Text](text.md)
- 📱 [React Native Migration Plan](react-native-migration-plan.md)
- ⬆️ **Upload Pipeline** — _you are here_
- 📝 [Session: Upload Pipeline Rework (2026-06-12)](session-2026-06-12-upload-pipeline-rework.md)
- 🖼️ [Image Loading Optimization (2026-06-16)](image-loading-optimization-2026-06-16.md)
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
