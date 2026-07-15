# Photos Gallery Order & Preview Variant — Session Notes (2026-06-19)

> Scope: the sidebar **Photos gallery** showed freshly uploaded images in the **wrong order** after a batch upload (newest sank to the bottom / "only the smaller images glitch"), and a follow-up **mid-upload shuffle** where a tile jumped to the end of the batch as it finished. Plus two smaller asks: the **product preview** was downloading the heavy `large` variant instead of reusing a cached one, and the gallery **default sort** needed to flip to "Earliest added". Companion to **[Upload Pipeline](upload-pipeline.md)** and **[Image Loading Optimization →](image-loading-optimization-2026-06-16.html)**.

---

## TL;DR

| Problem | Fix |
|---|---|
| After a >1-page batch upload, newest images sank to the **bottom**; scrolling "fixed" it. Backend order (`_id` desc) was **correct** — the bug was the gallery merge. | The page-1 refetch returns only the newest ~20. Completed uploads older than page-1's newest stayed as **bridge tiles** and the merge **pinned ALL pending to the top**, shoving older-but-finished uploads above newer ones. Now completed bridge tiles are **sorted into the backend list by `_id`**, not pinned. |
| "Only the smaller images glitch" | Smaller images resize/init faster → land in the stranded older-`_id` bridge-tile slot, so they were the visible victims of the top-pinning. Same root cause. |
| Follow-up: a tile **jumped to the end of the batch** mid-upload, then settled correctly. | `_id`-sorting completed tiles *while siblings were still uploading* made each finished tile jump out of its pinned slot (init order ≠ selection order). Now the merge is **two-phase**: stable selection-order pin **while actively uploading**, one `_id`-sort resettle **after the batch settles**. |
| Product **preview** fetched `large` — a second, heavy download with no cache reuse | Preview now uses **`medium`** (the canvas's progressive baseline + `preloadImages` for current ±1), so the active spread loads from cache; far pages fetch `medium` (≈½ of `large`) once. Export still uses `large`. |
| Default gallery sort was "Recently added" | Flipped default to **"Earliest added"** (`added_asc`); bumped the `localStorage` key so the old persisted value doesn't override it. |

---

## How it was found 🔎 (logging, not guessing)

The reasoning kept concluding "newest should be on top for `_id desc`" — which contradicted the user's screenshots. The contradiction was resolved by **temporary `[ORDER-DEBUG]` logs** at the three places order could diverge (batch-refetch effect, `getProjectImages` replace/append, and the `galleryImages` merge). The logs were the smoking gun:

```
getProjectImages RESULT  → REPLACE, returnedFirst5: ef25, ef25, ef24…   (backend = newest first ✓)
galleryImages MERGED     → pinTop:true, pendingCount:11
   projectImagesFirst5:  ef25, ef25, ef24…    (correct backend order)
   pendingFirst5:        ee91, ee91, ee92…    (all pending:false, OLDER _ids)
   mergedFirst8:         eea5, ee97, ee97…    ← OLDER bridge tiles on TOP  ✗
```

`projectImages` was perfectly newest-first; the **merge** put older completed bridge tiles above it. Logs removed after diagnosis.

---

## 1. The order bug

```
Backend getProjectImages(sortField:_id, sortOrder:desc) page 1 = newest 20  ✓ correct
Batch of >20 new images → the OLDEST-init ones (lowest _id) fall to page 2.
Those finished uploads are kept as "bridge tiles" (completed, real serverId,
isPending:false) until the refetch's projectImageServerIds absorbs them.

OLD merge:  [ ...ALL pending.reverse(), ...projectImages ]   (pinTop / desc)
            └─ older-but-finished page-2 bridge tiles pinned ABOVE newer page-1 images
               = newest appear to "sink"; pagination later absorbs them ("scroll fixes it")
```

Why "only smaller images": small images resize/init fastest → earliest `_id` → they're exactly the page-2 leftovers that got mis-pinned.

---

## 2. The fix — two-phase `galleryImages` merge

`galleryImages` (in `PhotosAction.jsx`) branches on `stillActive` = any pending tile with `pendingStatus` `"queued"` or `"uploading"` (the batch refetch only fires once everything is terminal, so while this is true `projectImages` is still the pre-batch list):

```
if (stillActive)  →  MID-UPLOAD: pin the WHOLE pending group in STABLE selection order
                       pinTop ? [ ...pending.reverse(), ...projectImages ]
                              : [ ...projectImages, ...pending ]
                     (no _id-sort → finished tiles don't jump out of their slot)

else              →  SETTLED: split leftovers
                       completed (real _id)  → sorted INTO the backend list by _id
                       pinned  (failed / no-id) → stay pinned (retry candidates)
                       pinTop ? [ ...pinned.reverse(), ...sort([completed,...projectImages]) ]
                              : [ ...sort(...), ...pinned ]
```

- **`byId` comparator:** ObjectId hex strings are fixed-length and byte-monotonic, so plain string compare reproduces MongoDB's `_id` order exactly (`asc`: `x<y?-1:1`, `desc`: `x>y?-1:1`).
- **Blink-free:** `galleryKeyOf` gives a bridge tile and its eventual backend tile the **same React key** (`pk_<imageId>` / `serverId`→`pendingImageId`), so React **moves** the node instead of remounting — both the mid-upload pin and the settled resettle are flash-free.
- **One settle:** at the moment the last active upload finishes, the group resettles once from reversed-selection order to authoritative `_id` order; the async refetch then lands on an already-`_id`-sorted list (no second visible move).

---

## 3. Preview image variant → `medium`

| Renderer | Variant | Why |
|---|---|---|
| Footer thumbnails | `small` | tiny tiles; `small` cached for **every** page |
| Canvas (editing) | `medium` baseline, `large` only on zoom-in | `useProgressiveImage`; `preloadImages` warms `medium` for active page **± 1** |
| Product preview | ~~`large`~~ → **`medium`** | reuses the canvas's cached/decoded `medium` for the active spread; far pages fetch `medium` (≈½ of `large`) once |
| Export / print | `large` / original (server-side) | unchanged — output quality unaffected |

Switched all product-preview `<Photo size="large">` to `size="medium"` (photobook, wall, folding). `medium` is the sweet spot: sharper than `small`, cached where you're most likely looking, and far lighter than the old `large` everywhere.

---

## 4. Default sort → "Earliest added"

- `readStoredSortOrder()` default fallback flipped from `added_desc` → **`added_asc`** (single source for the dropdown, `cachedSortOrder`, and `sortOrderRef`).
- **`SORT_STORAGE_KEY` bumped to `_v2`** so a browser that persisted `added_desc` under the old default doesn't override the new one on reload (resets everyone once; explicit picks persist after).
- Works with the two-phase merge: for `asc`, pending pin to the **bottom** mid-upload, then completed tiles sort `_id`-ascending into the backend list on settle.

---

## 5. Files changed

| File | Change |
|---|---|
| `tools/photos/PhotosAction.jsx` | Two-phase `galleryImages` merge (`stillActive` gate + `byId` sort of completed bridge tiles); default sort → `added_asc`; `SORT_STORAGE_KEY` → `_v2` |
| `products-preview/photobook/photoBookPreivewPages.jsx` | `<Photo>` `size` `large` → `medium` (both sides) |
| `products-preview/photBookPreview.jsx` | `<Photo>` `size` `large` → `medium` |
| `products-preview/WallPreview.jsx` | `<Photo>` `size` `large` → `medium` (both) |
| `products-preview/folding/FoldingLayoutPreivewPages.jsx` | `<Photo>` `size` `large` → `medium` (both) |
| `CLAUDE.md` | Updated "Photos Gallery Sort" + optimistic-placement notes (two-phase merge, new default) |

---

## 6. Gotchas (do not regress)

- **Do NOT re-pin all completed tiles to the top.** The backend `_id` order is authoritative and correct; completed bridge tiles MUST be `_id`-sorted into the backend list, or >1-page batches scramble again.
- **Do NOT `_id`-sort completed tiles while the batch is still actively uploading** — that's the mid-upload shuffle. Keep the `stillActive` stable-pin phase.
- **`galleryKeyOf` must stay stable** (same key for bridge tile ↔ backend tile) — it's what makes the move blink-free; an array-index fallback would remount and flash.
- **Preview previews use `medium`, export uses `large`.** Don't "fix" the preview back to `large` — that re-introduces the heavy second download. (Export embedding `large` is intentional and separate.)
- **Known edge (not fixed):** starting a NEW batch before scrolling to absorb a prior >1-page batch's leftover bridge tiles re-pins those older completed tiles on top during the new upload (self-heals on settle). Fixing needs `batchId` threaded into the merge — deferred until reported.

---

## 7. Verification checklist

- Upload **>20** images: during upload no tile jumps to the end of the batch; after completion the order matches the backend and **scrolling does not reshuffle**.
- "Recently added": newest stay at the **top** after completion. "Earliest added": newest at the **bottom**.
- Upload→backend handoff has **no flash/remount** (stable keys).
- Preview (DevTools → Network): active spread images served from **cache** as `..._medium.jpg`; far pages fetch `..._medium.jpg` once; **no `..._large.jpg`** from the preview.
- Fresh browser (no `localStorage`): default sort shows **"Earliest added"**.
- Export still renders from `large`/original (output unchanged).

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
- 📝 [Session: Upload Pipeline Rework (2026-06-12)](session-2026-06-12-upload-pipeline-rework.md)
- 🖼️ [Image Loading Optimization (2026-06-16)](image-loading-optimization-2026-06-16.md)
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ **Photos Gallery Order & Preview (2026-06-19)** — _you are here_
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
