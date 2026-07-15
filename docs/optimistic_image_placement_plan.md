# Feature Plan: Optimistic Image Placement (Use Photos While They Upload)

**Status:** ✅ IMPLEMENTED 2026-06-12 (same session as approval; production build verified; owner manual test pending — see §11 test plan). The §8 VERIFY list was resolved before implementation; see §10 "As-built notes" for resolutions and deviations.
**Prerequisite reading:** `docs/upload-pipeline.md` (the upload pipeline this builds on), `CLAUDE.md` → "Image Upload System".
**Scope:** Frontend only. No backend/API changes.

---

## 1. Goal & UX

When a user selects images:

1. The photo dialog **closes immediately** (no waiting in the queue tab).
2. The selected images appear in the **sidebar photos grid right away** (thumbnail tiles with progress badges), mixed with the existing server-backed gallery.
3. The user can **place pending images into the project immediately** — manual click-to-fill, drag, auto-fill, and Auto-Create all work with still-uploading images.
4. Uploads continue in the background (existing pipeline, untouched).
5. When an image finishes uploading, every placed instance is **silently swapped** from its local blob preview to the permanent server URL. The user never notices.

## 2. Locked Product Decisions (owner-approved, do not re-ask)

| Question | Decision |
|---|---|
| Placed image's upload permanently fails | **Keep + badge + retry**: object stays visible (thumb blob), warning badge on it, Retry available; Save/Export blocked until resolved |
| Save/Update & Export while placements pending | **Wait automatically**: show "Finishing X uploads…" progress, proceed when count reaches 0; failed placements surface a resolve prompt instead of waiting forever |
| Canvas preview source for placed pending images | **Worker thumbnail ONLY** (≤256px blob). Never full-res blobs — see §3 memory rationale. `thumbMaxDim` (currently 256, in `uploadManager.js`) may be raised to ~512 as a quality lever if needed |
| Auto flows (auto-fill, Auto-Create) | **Enabled from day one** — pending images count as available everywhere |

## 3. Why thumbnails only (memory rationale — do not "upgrade" to full-res blobs)

A blob URL itself is just a pointer to the disk-backed File (~free). Memory cost appears when an element **renders** it: the browser decodes the full image (~190 MB bitmap for a 25 MB photo) and caches it while displayed. In this app the **footer renders per-page preview thumbnails of every page** (`src/layout/Footer.jsx`), so a full-res blob placed anywhere would be decoded even when its page isn't active. Ten placed full-res blobs ≈ ten full decodes alive simultaneously — the exact decode storm the June 2026 rework eliminated. The ≤256px worker thumbnail keeps placement cost negligible regardless of count. The blurry window is short because of the priority queue jump (§5.3).

## 4. What already exists that this feature builds on (verified 2026-06-12)

- `resizePool.js` / `resize.worker.js` / `imageResizer.js`: worker pool emits a **≤256px thumbnail blob early** per image → `setPreviewUrl(imageId, objectUrl)` in `src/store/slices/imageUpload.js`. Sidebar tiles can reuse exactly this.
- `uploadImage` thunk (`src/store/background-services/imageUploadThunks.js`): on success it holds the full result and dispatches `uploadSuccess({ imageId, imageUrl, urls })` — `imageUrl` is the large variant URL, `urls` is `[{ size, url, w, h }]`. **The swap signal already exists**; the swap dispatch should be added here (thunk-driven), because:
- **Uploads outlive Redux queue entries**: the concurrency loop in `dispatchUploadsWithConcurrency` works off a closure-local array; removing an image from the queue UI does not cancel its upload. `uploadSuccess` no-ops for removed images (guard added June 2026), but the thunk still has the result — so a swap dispatched from the thunk works even if the queue row was removed.
- `customUndoableCanvasReducer` (`src/store/store.jsx`): existing precedent for **state surgery on the redux-undo wrapper** (it already re-injects preserved UI state into `present` after UNDO/REDO). The history-patching in §5.2 extends this same wrapper.
- `historyFilter` (`src/store/store.jsx`): `ignoredCanvasActions` list for actions that must never enter undo history.
- `changeObjectInPage` searches **all layouts** of a page by object ID (per CLAUDE.md) — multi-side spreads are already handled for per-object patching.
- Sidebar gallery (`src/tools/photos/PhotosAction.jsx`): `projectImages` is **component state fetched from the server** (`getProjectImages`), refreshed when `state.imageUpload.batch` gains a completed batch id. Pending images are NOT shown today — the merge in §5.4 is new work.
- Per-image **Retry** exists (`UploadedQueue.jsx` → `retryUpload` + re-dispatch `uploadImage`).
- `useExitPrompt` custom hook exists (`src/library/utils/custom-hooks/`) for leave-page warnings.
- Entry points call `dispatchUploadsWithConcurrency` then `openPhotoOption("Upload Queue")` (`ImportPhotoFromDevice.jsx`) — the dialog-close change happens at these call sites.

## 5. Architecture

### 5.1 Data model

A placed-from-pending canvas object is a **normal `type:"img"` object** plus one extra field:

```js
{ id, type: "img", url: <thumbnail blob URL>, pendingImageId: <upload imageId>, ...transform/etc }
```

`pendingImageId` is the upload pipeline's `imageId` (uuid from pre-registration). It is the join key for the swap and for the Save/Export gate. It is **removed** by the swap, so a fully-synced project has no trace of it.

**Parity invariant (the no-guess rule for field shape):** after the swap, the object must be byte-for-byte identical to an object placed normally from an already-uploaded sidebar image. Implementation must first read what placement writes today (which URL field/variant, whether the `urls` array is stored on the object, what `Photo.jsx` actually renders) and mirror it. See VERIFY list §8.

### 5.2 The swap — including the undo/redo trap (critical)

New canvas action: `replaceImageSourceAcrossPages({ pendingImageId, imageUrl, urls })`.

- Walks every page → every layout → every object; for each object with matching `pendingImageId`: set the final URL field(s) per the parity invariant, delete `pendingImageId`.
- Dispatched **from the `uploadImage` thunk** right after `uploadSuccess` (it has `imageUrl` + `urls` in scope).
- Added to `ignoredCanvasActions` in `historyFilter` — it must never create an undo step.

**The trap:** redux-undo snapshots taken between placement and swap contain the blob URL. If the swap only patched `present`, any later Ctrl+Z (even for an unrelated edit) restores a `past` snapshot where the object still references the blob — the swap silently un-happens and never re-fires (the upload is already done).

**The fix:** handle this action in `customUndoableCanvasReducer` (the existing wrapper) — after running the inner reducer, also map over `state.past` and `state.future`, applying the same object patch to every snapshot. After a swap, **no state anywhere references the blob**. Consequences:
- Undo/redo is bulletproof with zero reconciliation logic.
- Blob revocation becomes safe post-swap (§5.5).
- Cost: one map over ≤300 snapshots per completed upload, only rewriting snapshots that contain the id (structural sharing for the rest). Rare and cheap relative to the upload itself.

### 5.3 Priority queue jump

When the user places a still-**queued** image, promote it to the front of the upload queue so its swap happens in seconds.

Verified constraint: the queue is a `const queue = [...]` **closure-local array** inside `dispatchUploadsWithConcurrency` — there is currently no handle to reorder it. Required restructure: keep a module-level registry of active queues (or a single module-level pending list the workers shift from), and export `prioritizeUpload(imageId)` that splices the matching item to the front. No behavior change for non-placed images.

### 5.4 Sidebar merge (`PhotosAction.jsx`)

> ⚠️ The *rendering* described here (progress badges, column-div grid) was redesigned 2026-06-18 — see **§10c** for the current as-built (silent tiles, JS masonry, stable-key handoff). The merge/dedupe data flow below still holds.

- Merge pending entries from `state.imageUpload.images` (status `queued`/`uploading`/`failed`) into the rendered grid alongside server `projectImages`.
- Tile = worker thumbnail (`previewUrl`, placeholder until it arrives) + progress badge; failed = ⚠ badge + Retry.
- Clicking a pending tile reuses the existing placement logic (auto-fill first empty box etc.) but writes `url: previewUrl` + `pendingImageId`, and calls `prioritizeUpload`.
- **Dedupe on refetch:** when a batch completes, `PhotosAction` refetches server images; an uploaded pending entry and its server counterpart must not both render. `uploadSuccess` currently stores `uploadUrl`/`uploadUrls` but **not the server `_id`** (the complete response carries `items._id` — used in the Canvas.jsx paste path). Either (a) also store `serverId` in `uploadSuccess` and dedupe by `_id`, or (b) dedupe by large-URL equality — precedent: `getUsageCount` in `PhotosAction.jsx` "checks by `_id` first, then large URL" (comment at PhotosAction.jsx:298). Option (a) is cleaner; small slice addition.
- Entry points (`ImportPhotoFromDevice.jsx`, and the equivalent in the other entry points): replace `openPhotoOption("Upload Queue")` with closing the dialog. The global `UploadProgressToast` keeps showing progress; the queue tab remains reachable manually.

### 5.5 Blob lifecycle

- Placed objects reference the **thumbnail** blob (`previewUrl`) — the same URL the queue/sidebar tiles use.
- `setPreviewUrl` already revokes the **previous** URL when replacing, and orphaned URLs when the image is gone — unchanged.
- Post-swap, history-patching (§5.2) guarantees nothing references the blob → existing revocation paths (`removeImage`, `clearCompleted`, replacement) stay safe.
- **New edge to close:** `removeImage` (queue row ✕) revokes `previewUrl`. If the user removes the queue row of a **placed, still-uploading** image, the canvas object's blob dies → broken tile until the swap lands. Fix: route the ✕ through a small thunk (`removeImageSafe`) that checks canvas state for `pendingImageId` references via `getState()`; if referenced, remove the row but **skip revocation** (upload continues; swap will fire from the thunk and history-patch makes the blob unreferenced, at which point it is revoked). Cross-slice check belongs in a thunk, not the reducer.

### 5.6 Save / Export gate ("wait automatically")

- New cross-slice selector `getPendingPlacedImages(state)`: walk all pages/layouts/objects collecting `pendingImageId`s, join with `state.imageUpload.images` statuses → `{ pendingCount, failedCount }`. (Canvas-only helpers live in `canvasSliceGetters.js`; this one reads two slices — put it in a new helper or accept `(canvasPresent, imageUploadImages)` args.)
- **Save/Update** (Header) and **Export**: before proceeding, if `pendingCount > 0` → show "Finishing X uploads…" (subscribe to the count, proceed automatically at 0). If `failedCount > 0` → resolve prompt: Retry failed / Remove failed placements / Cancel. Never write a `blob:` URL into saved project JSON or exported SVG — **a saved blob URL is the one way this feature can corrupt a print project.**
- **Auto-save:** existence not yet verified (see §8). If any code path persists pages JSON without the Update button, it gets the same gate. This must be settled before shipping, not after.
- **Exit prompt:** while `pendingCount + failedCount > 0` for placed images, enable the leave-page warning (`useExitPrompt`) — a reload kills blobs and the unsaved placements with them.

### 5.7 Failed placement UX (locked: keep + badge + retry)

- Object keeps rendering its thumb blob; `Photo.jsx` renders a small ⚠ overlay when its `pendingImageId` maps to a failed upload (cross-slice read in the component).
- Sidebar tile and queue row show failed state + Retry (existing `retryUpload` flow). On retry success the normal swap fires and clears everything.
- Save/Export resolve prompt (§5.6) is the backstop.

### 5.8 Auto flows (locked: day one)

- Auto-fill ("first empty image box") and Auto-Create count pending images as available; placement writes thumb + `pendingImageId` exactly like manual placement; bulk placements swap per-image as uploads land.
- `AutoCreateV2PopUp` warning math ("available images < empty boxes") must include pending images in its available count.

## 6. Implementation order

| Phase | Deliverable | Main files |
|---|---|---|
| **A** | Swap machinery: `pendingImageId` model, `replaceImageSourceAcrossPages` (slice + undo-wrapper history patch + `ignoredCanvasActions`), thunk dispatch, `removeImageSafe`, parity-invariant verification | `canvas.js`, `store.jsx`, `imageUploadThunks.js`, `imageUpload.js` |
| **B** | Sidebar merge + dialog auto-close + priority jump | `PhotosAction.jsx`, entry points, `imageUploadThunks.js` (queue restructure) |
| **C** | Auto flows with pending images | `PhotosAction.jsx`, `AutoCreateV2PopUp.jsx` |
| **D** | Gates: Save/Export wait-automatically, failed-resolve prompt, ⚠ badge, exit prompt | `Header.jsx`, export entry (`useExportPages`/`ExportPage`), `Photo.jsx`, selector helper |

A is the foundation and is testable alone (place via a temporary hook, watch the swap). D ships before the feature is announced — the gates are the print-safety net.

## 7. Edge cases checklist (design answers included)

- Undo to pre-swap snapshot → handled by history patching (§5.2).
- Queue row removed for a placed pending image → `removeImageSafe`, no revocation while referenced (§5.5).
- Upload fails after placement → keep + badge + retry (§5.7); Save/Export resolve prompt.
- Retry after failure → normal swap path; badge clears.
- Same pending image placed multiple times / across both spread sides → swap walks ALL objects on ALL layouts; ID-based, not URL-based.
- Page reload mid-upload → blobs die; nothing was saved with blobs (gate §5.6); exit prompt warns first.
- `clearCompleted` → only touches uploaded (already-swapped) images; safe by construction.
- Mobile QR flow (`MobileUpload.jsx`) → uploads happen on the phone; desktop sidebar gets them via batch refresh; optimistic placement simply doesn't apply there. No change.
- Google Photos flow (`ImportPhoto.jsx`) → downloads first then uses the same concurrency dispatcher; should inherit the feature — verify its entry shape (§8).
- Theme save (`Header.jsx` `getDataToSave` reads fresh `store.getState()`) → gate applies there too if it serializes pages.

## 8. VERIFY-before-implementing list (facts NOT confirmed — do not assume)

1. **What placement writes today**: exact object fields for an image placed from the sidebar (`url` from which variant? is `urls` stored on the object?) and what `Photo.jsx` renders. Defines the parity invariant (§5.1). Read `PhotosAction.jsx` placement handler, `defaultObjects.js`, `Photo.jsx`.
2. **Auto-save**: does any code path persist pages JSON without the explicit Update button? Read `Header.jsx` (~70KB, careful) and search for the save endpoint usage.
3. **Export entry points**: where capture starts (`useExportPages`, `ExportPage.jsx`, Header trigger) → exact gate location.
4. **`AutoCreateV2PopUp` counting internals** beyond the CLAUDE.md description (`emptyBoxesCount`, option1/option2 flows).
5. **`useExitPrompt` API** (how to enable/disable conditionally).
6. **Server image item shape** in `getProjectImages` response (`_id`, urls array) for the dedupe choice (§5.4).
7. **`ImportPhoto.jsx` (Google Photos) and `AddPhotosFirstTime.jsx`** entry-point shapes for the dialog-close change.
8. Whether preview-mode rendering (`src/layout/preview/`) and 3D previews render image objects via the same `url` field (they must show thumbs correctly pre-swap).

## 9. Out of scope

- Backend single-variant init + server-side derivative generation (the "zero client CPU" endgame) — documented in `docs/upload-pipeline.md` → "Future Improvement". Independent of this feature.
- Cancelling in-flight uploads when a queue row is removed (pre-existing behavior, unchanged).

## 10. As-built notes (2026-06-12) — VERIFY resolutions & deviations

§8 VERIFY answers (all confirmed in code before implementation):
1. **Placement writes** `url` (large variant), `urls` (full array), `image_id` (`_id`), `image.{width,height,positionX,positionY,scale,originalWidth,originalHeight}`; renderers: canvas `Photo.jsx` uses `item.url`; preview `layout/preview/Photo.jsx` selects from `item.urls` by size with `item.url` fallback (pending objects carry synthesized small/large entries pointing at the thumb blob, so both render correctly pre-swap).
2. **Auto-save EXISTS**: 30s interval for customers (`Header.jsx`) → implemented as a **silent skip** while placements are pending/failed (no modal from the timer).
3. **Export entries**: `handleExportOptions` (admin) and `handleCustomerPdfExport` (customer) in Header — both self-gated. `orderProject`, `saveProject`, `saveAsTheme`, `updateThemeWithSvg` self-gated too (theme JSON also serializes page objects).
4-8. AutoCreate counting, `useExitPrompt(shouldBlock, message)`, server item shape (`_id` + `urls[{size,url,w,h}]`), entry points, preview renderers — as documented in the component sections above.

Implementation deviations / additions vs the original plan:
- **Natural dims ride with the thumbnail**: `onThumb(blob, {width,height})` through worker → pool → manager → `setPreviewUrl` stores `width`/`height` on the queue entry. `handlePhotoClick` SKIPS the EXIF probe for pending items (probing the 256px blob would return thumb dims and corrupt `originalWidth/Height`).
- **Shared module-level upload queue**: `dispatchUploadsWithConcurrency` now feeds one global queue + one worker pool capped at `MAX_CONCURRENT_UPLOADS` (also fixes overlapping batches spawning 2× workers). `prioritizeUpload(imageId)` splices a queued item to the front; called on every pending placement (manual + AutoCreate).
- **Pending tiles synthesize the server-item shape** (`_id: "pending_<imageId>"`, `urls` small/large = thumb blob, `isPending`, `pendingStatus`), so existing grid/click/usage-count code paths work unchanged. Settled-but-not-yet-refetched uploads render as normal tiles via `serverId`/`uploadUrls` until the gallery refetch dedupes them.
- **PhotosAction subscribes to a string signature** (imageId:status:hasThumb:serverId) instead of the images array — progress dispatches don't re-render the panel.
- **Drag-to-canvas for pending tiles is disabled** in v1 (click-to-place only); the OS-file drag path and sidebar drag of uploaded images are unchanged.
- **uploadSuccess stores `serverId`** (`items._id`) — used by the swap (`image_id`) and gallery dedupe.
- **Gate modal lives in Header** (react-bootstrap Modal, `backdrop="static"`): pending state = spinner + "Finishing X uploads…" + Cancel; failed state = "N placed photos failed" + [Retry failed uploads] [Cancel]. Retry reads `getRetryableFailedPlacedImages(store.getState())` imperatively.
- **Status of a removed-mid-upload placed image** counts as *failed* for the gate (it cannot resolve by waiting; the swap may still land if the upload survives, which un-blocks automatically).
- New shared helpers: `patchPendingImageObject(s)` exported from `canvas.js` (used by reducer AND the undo-wrapper history patch in `store.jsx`); `usePendingPlacedImages` + `getPendingPlacedImageCounts` + `getRetryableFailedPlacedImages` in `src/library/utils/custom-hooks/usePendingPlacedImages.js`.

## 10b. Post-implementation fixes (2026-06-12, after first owner test)

- **Preview quality**: the canvas preview thumbnail was 256px/0.7 — too soft in full-size image boxes. Raised to **768px/0.85** (`uploadManager.js` `thumbMaxDim`, `imageResizer.js` thumb quality). ~2 MB decoded/image, still trivial. Tunable via the one constant.
- **"Some images not appearing"** — two bugs:
  1. `pendingGalleryItems` skipped any entry without a thumbnail yet (`if (!entry.previewUrl) continue`). With the resize pool at 2 concurrent, only the 2 actively-resizing images had thumbnails; the rest were invisible. Now ALL non-uploaded entries render immediately — as a non-placeable gray "Queued" placeholder tile (`noThumb`) until the thumbnail lands. `ImageItem` and the mobile tile render the placeholder; AutoCreate `placeablePending` excludes `noThumb`.
  2. **Shared-queue respawn race** (`imageUploadThunks.js` `spawnQueueWorkers`): a batch enqueued in the instant between a worker seeing the queue empty and decrementing its slot was stranded (queued forever, never appearing). Fixed: worker re-checks `sharedQueue` in `finally` after decrementing and respawns.
- **Ctrl+Z "blurry then swaps" (the real undo bug)**: redux-undo's `_latestUnfiltered` = present as of the last RECORDED action. The swap is a FILTERED action; redux-undo (default `syncFilter:false`) leaves `_latestUnfiltered` holding the pre-swap **blob** version (verified in `node_modules/redux-undo/dist`: `n.syncFilter||(g._latestUnfiltered=r._latestUnfiltered)`). The next recorded edit's `insert` pushes that stale blob snapshot into `past`, so a later Ctrl+Z resurrected the blurry preview and the server image then replaced it. Fix: the undo wrapper in `store.jsx` now also patches `_latestUnfiltered` for the swap action (targeted — NOT the global `syncFilter` flag, which would change zoom/dragger undo behavior).

## 10c. Upload-UX redesign + blink elimination (2026-06-18) — supersedes §5.4 rendering

Owner goal this round: the sidebar upload must feel **silent** — "show the preview, upload in the background, swap to the server URL without the user noticing," **newest-first**, and **zero blink** (no flash, no reshuffle, no vanish-gap). All changes are in `PhotosAction.jsx` unless noted.

### Silent tiles (no badges, no broken-look)
- Removed the `Uploading…`/`Queued` text badges. Only **`⚠ Failed`** remains (the user must retry those). Background upload + the existing silent blob→URL swap need no announcement.
- `noThumb` (queued, thumbnail not generated yet) tiles render a **skeleton shimmer** (`SkeletonTile` styled.div) instead of the old gray broken-image icon — reads as "loading," not "error."
- Removed the per-tile **fade-in** (`tileFadeIn`): a CSS fade re-ran on every `<img>` mount and read as flicker (worst at the handoff). `ThumbImg` is now a plain `styled.img`.
- **styled-components v4+ gotcha:** a `keyframes` value must be interpolated inside a tagged styled template (`styled.div\`animation:${kf}\``), NEVER into an inline-style string (`style={{animation:\`${kf}…\`}}`) — the latter throws a runtime "interpolating a keyframe declaration into an untagged string" error.

### Newest-first order
- Backend `getProjectImages` returns **newest-first** (owner confirmed: "last uploaded is first"). `pendingGalleryItems` is `.reverse()`d so the last-selected photo sits at the TOP, consistent with the backend. **Reverse ONLY this gallery — NOT the `UploadedQueue` tab**, which keeps server order.

### Vanish-gap bridge (no disappear-then-reappear)
- A finished upload used to be dropped from `pendingGalleryItems` on `status==="uploaded"` and not reappear until the ~10-image batch refetch — a visible hole. Now uploaded entries are **kept**, rendered with their **permanent server URLs** (`entry.uploadUrls`), until `projectImageServerIds` (a `Set` of `projectImages[]._id`) contains their `serverId`; then they drop and the backend tile takes over. Same photo stays visible the whole time.
- This is the SAFE reintroduction of the once-removed "uploaded-but-not-refetched tile" branch (§10 deviations removed it for scrambling order). Safe now because order is newest-first AND dedupe is by `serverId`, so the bridged tile sits exactly where the backend tile will.

### The masonry journey (why the final layout)
The grid layout was the real blink source. Three iterations:
1. **Separate column `<div>`s** distributed by `i % columnCount` — any list change (newest-first prepend, a tile finishing, refetch) shifts indices → a tile moves to a **different DOM parent** → React unmount+**remount** → browser **reloads** the `<img>` → flash. (Stable `key` can't help across parents.)
2. **Single CSS `column-count` container** — fixes remounts (one parent), but the browser **re-balances all columns** whenever items are appended → infinite-scroll **pagination reshuffles the whole grid** (owner hit this).
3. **`MasonryGrid` — JS absolute-positioned masonry (final).** Each tile's `(x,y)` is computed by shortest-column packing from the variant's intrinsic `w/h` (deterministic → no measure pass → no flash; skeleton tiles are square). One relative parent, absolute children. Stable on **both** prepend (uploads) and append (pagination): appended items only **extend** the columns, so existing tiles never move; position changes animate via a `transform` transition instead of flashing. `ImageItem`'s `PhotoWrapper` `marginBottom` is 0 (the grid reserves `MASONRY_GAP`); the absolute wrapper has `lineHeight:0` to kill the inline-block baseline gap.

### Stable-key handoff (the last "little blink")
- Even in one container, the upload→backend handoff changed a tile's React key (`pending_<imageId>` → backend `_id`) → unmount+remount → flash/gap.
- `MasonryGrid` now takes a **`keyOf`** prop. `galleryKeyOf` maps a backend item whose `_id` is a current-session `serverId` back to `pending_<imageId>` (via `serverIdToPending`, built from the upload slice). Same key for the whole lifecycle (skeleton → thumb → uploaded → backend tile) → React reconciles **in place** (the src is the same cache-warm URL) → invisible. Reverts to the real `_id` only after the session clears (a one-time remount while idle).

### Physical limit (stated to owner, accepted)
A thumbnail genuinely has to be generated by the resize worker and downloaded before it can be shown, so photos still **appear** as they become ready, and a queued square skeleton **resizes once** to the real aspect when its dims land. That's image loading, not a blink — no app can show an image that hasn't loaded. (To suppress even that: render tiles only once they have a thumbnail — loses the instant skeleton appearance. Not done; owner accepted the current behavior as "working perfectly.")

### Mobile
Unchanged — the mobile render is already a single flat `galleryImages.map` container with stable `_id` keys (no column-jump remount).

## 11. Manual test plan (acceptance)

1. Select 30 large images → dialog closes instantly, tiles appear with badges, UI stays responsive.
2. Immediately place 3 pending images (one on each side of a spread, one twice on different pages) → thumbs render; placed images upload first (priority jump); each silently swaps; verify via DevTools that object URLs become server URLs and no `blob:` remains in Redux (present AND past).
3. Ctrl+Z stress: place pending image → make unrelated edits → wait for swap → undo several times → image must never show a broken/blob source.
4. Kill network mid-upload of a placed image until it fails → ⚠ badge appears; Save shows resolve prompt; Retry → swap completes; Save proceeds.
5. Click Save while 5 uploads pending → "Finishing 5 uploads…" → auto-proceeds; exported/saved JSON contains zero `blob:` URLs (assert by inspection).
6. Remove the queue row of a placed pending image → canvas tile stays intact; swap still lands.
7. Auto-Create with a mix of uploaded + pending images → layout built, all swap eventually; counts/warnings correct.
8. Reload attempt mid-pending-placement → exit prompt fires.

**Silent-UX / no-blink acceptance (2026-06-18, §10c):**
9. Select 30 photos → tiles appear as skeleton shimmers (no `Uploading…/Queued` badges), newest at top; no broken-image icons.
10. Watch a full upload run → no flash, no whole-grid reshuffle, and no photo disappears-then-reappears as each finishes (vanish-gap bridge + stable-key handoff).
11. Scroll to trigger pagination while/after uploading → existing tiles do NOT jump/reshuffle when the next page loads (JS masonry append only extends columns).
12. A failed upload still shows the `⚠ Failed` badge and is retryable.
