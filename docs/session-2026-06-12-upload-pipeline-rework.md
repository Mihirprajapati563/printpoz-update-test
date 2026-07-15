# Session Record — 2026-06-12: Upload Pipeline Performance Rework

Purpose: continuity document for future sessions. Records what was diagnosed, what was changed and why, the product decisions made, verification status, and what is planned next. Companion docs: `docs/upload-pipeline.md` (resulting architecture, normative), `optimistic_image_placement_plan.md` (next feature, planned not built).

---

## 1. Reported problem

Uploading ~30 images of 20–30 MB froze/lagged the editor severely — on a good PC, in **both** dev (`npm start`) and production builds, worst **immediately after selecting files**. Upload throughput was also poor.

## 2. Diagnosis (verified by reading the code, confirmed by owner answers)

1. **Main-thread image processing × high concurrency.** Every upload ran `resizeImage()` (decode via `createImageBitmap` + draw + encode of THREE variants, including a full-resolution JPEG re-encode) on the UI thread. With `MAX_CONCURRENT_UPLOADS = 10` at session start, ten ~50 MP decodes (~200 MB transient RAM each) + encodes ran simultaneously the moment files were selected. Dominant cause; matches "freeze right after selecting".
2. **Redux dispatch flood.** Per-chunk XHR `onprogress` events (~every 50 ms × 3 parallel chunks × N parallel images) each dispatched `updateUploadProgress` unthrottled → hundreds of dispatches/sec, each re-rendering the entire queue table and toast.
3. **Full-resolution thumbnails.** `startUpload` created `URL.createObjectURL(file)` and the queue rendered 30 full-res originals as 72px `<img>`s → multi-GB decode burst. URLs never revoked.
4. **Dev amplifier.** `store.jsx` disabled only `serializableCheck`; RTK's dev-only `immutableCheck` still deep-scanned the entire store (incl. up to 300 redux-undo canvas snapshots) on every dispatch.

## 3. Round 1 — pipeline rework (implemented, built)

New files:
- `src/library/utils/upload/resize.worker.js` — Worker wrapper around `resizeImage` (CRA5/webpack5 `new Worker(new URL(...))`; emitted as its own chunk — verified in build output).
- `src/library/utils/upload/resizePool.js` — bounded worker pool; all resizes funnel through it (CPU concurrency decoupled from network concurrency); `unsupported` → re-queues in-flight jobs, tears down workers, permanent main-thread fallback (concurrency 1); worker crash → that job rejects, slot replaced.

Modified:
- `imageResizer.js` — runs in window AND worker contexts; optional ≤256px thumbnail generated FIRST and delivered early via `opts.onThumb`; **skips the full-res large re-encode when EXIF orientation = 1 and type is JPEG/PNG and no `outputType` requested** (original bytes uploaded as large — pixel-dimension-safe for the server, avoids seconds of CPU and a lossy generation; better for print). Orientations 2–8 still re-encode (server reads pixel dims from blob).
- `uploadManager.js` — resize via `resizeImageInPool`; new optional `onThumbnail(blob)` param; `thumbMaxDim: 256` requested only when `onThumbnail` provided (Canvas.jsx paste/drag-drop callers pass none → no wasted thumb).
- `imageUploadThunks.js` — progress dispatches throttled (integer-percent change AND ≥150 ms `PROGRESS_DISPATCH_MIN_INTERVAL_MS`; terminal 100% always passes); status messages deduped; `onThumbnail` → `URL.createObjectURL` → `setPreviewUrl`.
- `imageUpload.js` slice — `previewUrl` starts `null` (no full-res object URL); new `setPreviewUrl` (revokes prior/orphaned URL); `removeImage`/`clearQueue` revoke URLs; `uploadSuccess` guarded against images removed mid-upload (previously crashed: dereferenced `image.batchId` on undefined).
- `UploadedQueue.jsx` — rewritten around memoized `QueueRow` (`React.memo`; immer keeps untouched rows referentially stable) + gray placeholder icon until thumbnail arrives.
- `store.jsx` — `immutableCheck: false` (with comment; don't re-enable).

## 4. Round 2 — fixes from owner's real-world test (600 MB album)

Symptoms reported with screenshots; both root-caused and fixed:

1. **Toast totals shrank / completed-count reset mid-run** (`0/29 · 598 MB` → `0/19 · 392 MB`). Cause: `useActiveUploadStats` dropped failed images AND images of completed batches (batches = groups of 10 by `batch_id`) from its "active" set. Fix (`UploadProgressToast.jsx`): **session-stable totals** — a ref-tracked Set of imageIds; once an image joins the session it stays in `total`/`bytesTotal` until the whole run ends (failed keep bytes in the denominator, contribute 0 transferred); red `N failed` line; visibility driven by `hasActive` (any queued/uploading), final numbers persist through fade-out; session resets when new uploads start after full idle.
2. **"Clear All" deleted queued/uploading rows** while their uploads kept running invisibly (the concurrency loop is independent of Redux). Fix: new `clearCompleted` reducer (removes ONLY `status === "uploaded"`, revokes their URLs); button renamed **"Clear Completed"**, disabled until something finished. Failed rows intentionally remain (Retry); per-row ✕ removes them — owner accepted this literal reading, flagged as a one-line change if failed should clear too.

## 5. Owner decisions log (do not re-ask)

Round 1 diagnosis questions:
- Lag occurs in **both dev and production** (so not just dev middleware).
- **Backend CAN generate size variants** from one original (legacy endpoint does).
- Large variant: **full original resolution required** (print) — no downscaling.
- Lag worst **right after selecting files**.

Round 2 (optimistic placement feature — see plan doc §2 for the canonical table):
- Failed placed upload → **keep + badge + retry**, Save/Export blocked until resolved.
- Save/Export with pending placements → **wait automatically** ("Finishing X uploads…").
- Canvas preview for placed pending images → **worker thumbnail only** (owner's explicit memory concern; validated — full-res blobs would be decoded by the footer's per-page previews).
- Auto flows (auto-fill / Auto-Create) with pending images → **enabled from day one**.

## 6. Hand-tuned constants — IMPORTANT for future sessions

The owner live-edits tuning constants, including **mid-session while the assistant works** (observed: `MAX_CONCURRENT_UPLOADS` 10→5→10; `POOL_SIZE` cap 2→4; `UploadProgressToast` restyled). **Always re-read these files before editing; never silently change the values.**

As of end of session 2026-06-12 (informational only — read the source for truth):
- `MAX_CONCURRENT_UPLOADS = 10` (`imageUploadThunks.js`) — network-side; safe to raise now that CPU is bounded separately.
- `POOL_SIZE = min(4, max(1, hardwareConcurrency − 2))` (`resizePool.js`).
- `PROGRESS_DISPATCH_MIN_INTERVAL_MS = 150` (`imageUploadThunks.js`).
- `thumbMaxDim: 256` (`uploadManager.js`).

A persistent memory entry also records this (auto-memory: `upload-concurrency-user-tuned`).

## 7. Verification status (precise)

- **Production build**: passed twice after round 1 (worker chunk emitted and referenced — verified by grepping build output for the `worker-unsupported` marker), and once after round 2 changes. Pre-existing lint warnings in unrelated files remain (build is `CI=false`).
- **Owner manual test after round 1**: confirmed working via screenshots (placeholders, progressive thumbnails, moving bars, responsive UI during a 600 MB / 29-image upload).
- **Round 2 fixes (toast session stats, Clear Completed)**: build-verified only at time of writing — **not yet confirmed by an owner manual test**.

## 8. Documentation written this session

- `docs/upload-pipeline.md` — NEW, normative architecture doc (flow, per-component reference, worker protocol, concurrency model, browser support, future backend improvement, rework changelog).
- `CLAUDE.md` — "Image Upload System" section rewritten to match (links to the deep-dive); store middleware note added to "Notes for Development".
- `optimistic_image_placement_plan.md` — NEW, end-to-end plan for the approved next feature (status: planned, not implemented). Contains a **VERIFY-before-implementing list** of facts deliberately NOT assumed (Photo.jsx render source, auto-save existence, export entry points, etc.).
- This file.

## 9. Open / next work

1. ~~**Implement `optimistic_image_placement_plan.md`** (Phases A→D). Start by resolving its §8 VERIFY list.~~ **DONE later this same session** — see §10 below.
2. **Owner to manually verify round 2 fixes** (toast stability with failures + Clear Completed during an active upload).
3. **Backend (separate ticket, owner-confirmed feasible):** single-variant `/uploads/init` + server-side derivative generation + completion notify — would remove the remaining client-side medium/small encodes entirely. See `docs/upload-pipeline.md` → "Future Improvement".
4. Minor flagged-not-done: making "Clear Completed" also remove failed rows is a one-line filter change if the owner asks.

## 10. Addendum — Optimistic Image Placement implemented (same session)

The owner approved and the feature was built in full (Phases A→D of `optimistic_image_placement_plan.md`). The plan's §8 VERIFY list was resolved first via four parallel read-only exploration agents (key findings: placement writes `url`/`urls`/`image_id`; **auto-save exists** — 30s customer interval in Header; canvas `Photo.jsx` renders `item.url`, preview renderer selects from `item.urls` by size).

Touched: `canvas.js` (swap reducer + pure patch helpers + `pendingImageId` passthrough in 3 placement reducers), `store.jsx` (undo past/future snapshot patching + ignored action), `imageResizer/resize.worker/resizePool/uploadManager` (thumbnail now carries natural dims), `imageUploadThunks.js` (shared module-level queue — also fixes overlapping batches over-spawning workers; `prioritizeUpload`; swap dispatch on success; `removeImageSafe`), `imageUpload.js` (dims + `serverId`; `removeImage` keepPreviewUrl), `PhotosAction.jsx` (pending tiles via string-signature subscription, click-to-place, AutoCreate merge), `ImportPhotoFromDevice/ImportPhoto/AddPhotosFirstTime` (dialog closes on select), `Photo.jsx` (⚠ failed badge), `layout/index.jsx` (exit prompt), `Header.jsx` (six self-gated actions + wait/resolve modal + auto-save silent skip), new `usePendingPlacedImages.js` hook.

**Verification status: production build passed; the plan's §11 manual acceptance tests have NOT yet been run by the owner.** Undo-with-swap (§11 test 3) and the Save-while-pending gate (test 5) are the highest-value manual checks.

## 11. Addendum — Post-build owner fixes (same session)

Owner tested and reported four issues; all root-caused and fixed (see `optimistic_image_placement_plan.md` §10b for the first three):

1. **Preview quality too low** — canvas preview thumbnail 256px/0.7 → **768px/0.85** (`uploadManager.js` `thumbMaxDim`, `imageResizer.js`). ~2 MB decoded/image; tunable.
2. **Some images not appearing** — (a) gallery skipped entries without a thumbnail yet (only ~POOL_SIZE have one at a time); now all show immediately as non-placeable "Queued" placeholder tiles (`noThumb`). (b) shared-queue **respawn race** — a batch enqueued as a worker exited was stranded; worker now re-checks the queue in `finally`.
3. **Ctrl+Z "blurry then swaps"** — THE real undo bug. redux-undo keeps `_latestUnfiltered` = present as of the last RECORDED action; the swap is FILTERED so (default `syncFilter:false`) it stays = pre-swap blob, and the next recorded edit's `insert` pushes that stale blob snapshot into `past`. Verified in `node_modules/redux-undo/dist`: `n.syncFilter||(g._latestUnfiltered=r._latestUnfiltered)`. Fix: undo wrapper now also patches `_latestUnfiltered` for the swap action (targeted, not the global `syncFilter` flag).
4. **"Uploads wait for first 10 to finish / only 1-2 upload in parallel"** — diagnosed: NO code barrier (queue is a continuous worker pool). The ~2-at-a-time cap came from two gates: `POOL_SIZE = 2` (resize, owner keeps it) AND browser ~6 connections ÷ `MAX_CONCURRENT_CHUNKS = 3` = 2 images. Owner chose: keep POOL_SIZE=2, "pick best balance" on network. Fix (`uploadManager.js`): added a **global FIFO connection semaphore** `MAX_GLOBAL_CONCURRENT_CHUNKS = 6` (acquire per chunk-attempt, release in `finally` — no leak, no deadlock, backoff holds no connection) and lowered per-image `MAX_CONCURRENT_CHUNKS` to **2** → ~3 images stream at once, rest rotate fairly. Per-image=1 would give ≈6 simultaneous (slower each); it's the documented knob. Total wall-clock is bandwidth-bound either way — this changes the *distribution*, not the total.

Race-condition audit (owner asked for "no loopholes"): semaphore leak-free (acquire⇄release paired in finally; release hands permit to FIFO waiter or decrements); queue respawn race fixed; `prioritizeUpload`/worker-shift safe (single-threaded, atomic array ops); each queue item settled exactly once; `uploadSuccess` no-ops if the row was removed; swap dispatched from the thunk so it fires regardless of queue state; `setPreviewUrl` revokes orphaned URLs; resizePool re-queues on worker `unsupported`/crash.

**Verification: production build passed. Owner manual retest still pending** — most valuable: bulk upload shows ~3 images streaming at once (not 1-2); all selected photos appear instantly as placeholders; placed pending image is sharper; the exact Ctrl+Z sequence (place pending → make another edit → wait for upload → undo) no longer flashes the blurry version.

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
- ⬆️ [Upload Pipeline](upload-pipeline.md)
- 📝 **Session: Upload Pipeline Rework (2026-06-12)** — _you are here_
- 🖼️ [Image Loading Optimization (2026-06-16)](image-loading-optimization-2026-06-16.md)
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
