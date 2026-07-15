# Image Loading Optimization — Session Notes (2026-06-16)

> Scope: how canvas/editor images are loaded and displayed, optimized for projects of 500–2000 photos with originals up to 30 MB. Companion to `docs/upload-pipeline.md` (which covers the *upload* side) and to **[Canvas Interaction Performance →](canvas-interaction-performance-2026-06-16.md)** (drag/zoom/pan rendering).

---

## TL;DR

- **No blob cache.** Live server (S3/CDN) URLs are the single source of truth. The browser's HTTP cache already makes repeat views instant; a blob can't speed up a first download and would only pin memory. Blobs exist **only** for the brief in-flight-upload preview.
- **Progressive ladder per image: `small → medium → large`** — climbed once and kept (no variant swapping mid-gesture).
- **Zoom is a GPU `transform: scale()`, not a width/height change** — so the bitmap decodes once and the GPU composites the zoom (smooth on low-end, no re-raster), and there's no `src` swap to blink.
- **Preload current + adjacent pages** to make page flips download-free.
- **Fast click-to-place:** probe the `small` variant (already cached by the sidebar) for orientation instead of downloading the 30 MB `large`.
- **Two bug fixes:** the click→select "blink" (placeholder flash) and "delete button does nothing" on a spread's non-active side.
- **Print quality is never affected** by the canvas display variant — export renders server-side from `large`/original.

---

## How it works — at a glance 🖼️

**① One photo → four sizes.** The server makes 4 copies of every photo. We always show the *smallest copy that still looks right* — like picking the right zoom on a map instead of downloading the whole world.

```
  thumb        small          medium           large
  ▢            ▢▢            ▢▢▢             ▢▢▢▢▢
  ≈256px       ≈700px         ≈1400px          full-res
  sidebar  →   previews,  →   canvas      →    print / export
  tiles        1st paint      editing          ONLY (on server)
```

**② What you SEE when an image loads (progressive).** Instead of a blank box waiting on a 30 MB photo, you see a tiny version *instantly*, and it sharpens a moment later — like a video thumbnail snapping into focus.

```
  ⚡ 0 ms                 a beat later            when you click it
  tiny `small` shows  →   `medium` arrives    →   `large` loads
  INSTANTLY (a bit soft)  → sharpens up            → razor sharp
```

**③ Which size goes where.** Big screens get big copies; tiny thumbnails get tiny copies. Nobody downloads 30 MB to show a 100-pixel thumbnail.

```
  Sidebar ........ thumb        Selected image .. large (on demand)
  Footer preview . small        Print / Export .. large/original
  Canvas (edit) .. medium                          on the SERVER 🖥️
```

**④ Page flips are instant (preloading).** While you work on one page, we quietly fetch the next/previous pages' images in the background.

```
   ◀ prev page  ·  ★ current page (you're here)  ·  next page ▶
   pre-loaded                                      pre-loaded
```

**⑤ Why we DON'T copy images into "blobs."** A "blob" is a private copy kept in app memory. But the browser *already* keeps a copy of everything it downloads (its cache). So a blob = a **second copy** = wasted memory, for zero speed gain — and it can't make the first download faster.

```
  ❌ Blob cache:   download → make OUR copy → use it   = 2 copies, pins memory
  ✅ Just the URL: download → browser caches it free   = 1 copy, auto-evicted
```

---

## Problem statement

The editor must stay smooth with 500–2000 wedding photos, each up to 30 MB. The pain points addressed this session:

1. The canvas rendered the **full-res `large`** variant for on-screen editing — a 4000×3000 image decodes to ~48 MB of RAM each; 20 on a spread ≈ 1 GB.
2. Clicking a sidebar photo took **seconds** — it downloaded the full `large` original just to read EXIF dimensions before placing.
3. A visible **"blink"** when an image was placed/selected.
4. The **Delete button silently did nothing** for images on the non-active side of a spread.
5. Open question: does showing `medium` on canvas hurt quality? And should we cache via blobs?

---

## Decisions & rationale

### 1. Blobs vs. live URLs → **live URLs (no blob cache)**

A blob cache is `fetch → download bytes → createObjectURL → use`. Compared with pointing `<img>` at the live URL:

| Dimension | Blob cache | Live URL (chosen) |
|---|---|---|
| First load | Full network download — **no faster** | Same download, progressive paint hides it |
| Repeat views / page flips | Instant from blob | Instant from **browser HTTP cache** (free) |
| Memory | Pins encoded bytes in JS heap until revoked (~600 MB for 2000 photos) | Browser-managed, auto-evicted |
| Complexity | LRU + revoke accounting + leak risk | None |

The blob's only unique benefit is surviving a **URL that expires** (short-TTL signed S3 URLs). If display variants are long-lived/public CDN URLs, blobs add nothing. → **No blob cache.** (If URLs *do* expire mid-session, fix that on the CDN, not with blobs.)

### 2. Progressive loading ladder → **`small → medium → large`, adaptive**

- **`small`** paints immediately (tens of KB) — instant content.
- **`medium`** swaps in after off-thread decode — clean sharpen, no flash.
- **`large`** upgrades after medium for **full resolution**, but only for the **selected** image and only once the gesture **settles** (~250 ms idle).

**GPU-composited zoom (the real fix).** The canvas used to render an image at `image.width * scale` — changing the `<img>` width/height attributes, which makes the browser **re-rasterize the source bitmap every wheel frame** (the lag, brutal on low-end). It's now rendered at **fixed intrinsic size** with zoom expressed as a CSS `transform: translate(pos) scale(image.scale)` (`transformOrigin: 0 0`). The bitmap decodes **once**; the GPU samples the existing texture for the zoom → smooth at any resolution, even `large`. `transformOrigin: 0 0` preserves the old top-left anchoring, so all `positionX/Y` clamp math in state is unchanged. Clip-path/mask/flip are frame-space and unaffected.

**No mid-gesture variant swapping (the blink fix).** Because GPU zoom no longer re-rasterizes, there's no reason to drop to `medium` during a zoom — so the loader no longer swaps the `<img src>` mid-gesture (that swap was the blink). The ladder climbs `small → medium → large` once and keeps `large`. A fresh `large` download is gated to the selected image; once decoded it's shown for any image even after deselect. Non-selected images stay `medium`. Print/export uses large/original server-side regardless.

**Why not blanket `large`:** at 2000 photos that pins gigabytes of decoded bitmaps; even the whole *current page* at large made canvas interaction heavy. So large is **selected-image-only** — at most one full-res bitmap on canvas at a time, and never during a gesture. Non-selected images stay at `medium` (and print/export uses large/original server-side regardless).

**Critical reassurance:** the canvas display variant has **zero effect on print/export**. Export rasterizes **server-side from `large`/original** (`generatePageSvg.js` feeds `item.url`, the server renders full-res). So "medium on canvas" can never produce a low-quality printed book — it only affects on-screen editing sharpness, which the ladder maximizes anyway.

### 3. Preloading → **current + next + previous page**

On project load and page change, warm the browser cache (bounded concurrency) for the current page and its neighbours so flipping is download-free. Keyed on page index + page count only (not page identity), so it never re-runs on drag/edit frames.

### 4. Fast click-to-place → **probe `small`, not `large`**

Placing a sidebar photo needs EXIF-correct orientation. It used to `await` a download of the full `large` variant (up to 30 MB) — the multi-second hang. Now it probes the **`small`** variant (already in the browser cache because the sidebar tile rendered it → a cache hit, ~1 ms) for orientation, and takes full-resolution magnitude from the `large` **metadata** (`w/h`). Both placement reducers (`changeObjectInPage`, `addObjectInPage`) stay dimensionally accurate.

### 5. Blink fix → **initialize `isPlaceholder` from `item.url`**

`isPlaceholder` defaulted to `true`, so a freshly-placed image rendered the drop-image placeholder for one frame before a `useEffect` corrected it — the visible blink. Now it initializes from `item.url` so an image with a URL renders directly.

### 6. Delete fix → **search all sides of the active page**

`removeObjectInPage` only searched `layout[activeSide]`, while every other control searches all layouts. On a spread, an image on the **non-active side** was selectable and editable but **un-deletable** ("only the delete button doesn't work"). The reducer now locates the object across all sides (both `objects` and `safeAreaObjects`) before removing it. Object IDs are unique UUIDs, so the wider search can never pick the wrong object. Single-page editors and active-side deletes are unchanged.

---

## Current end-to-end flow

1. **Upload** — select photos → pre-registered in the Redux queue → resize pool makes `large/medium/small/thumbnail` + a 768px preview blob (off main thread) → bounded workers upload variants to S3 (signed-URL multipart) → server returns `urls: [{size,url,w,h}]` (live CDN URLs) + a server `_id`.
2. **Sidebar** — each tile shows the **`small` live URL** (browser-cached). In-flight uploads show as pending tiles using the local preview blob.
3. **Click to place** — probe `small` for orientation (cache hit), magnitude from `large` metadata, build the object with the **live `urls[]`** (or blob preview + `pendingImageId` if still uploading), dispatch.
4. **Canvas display** — `useProgressiveImage(item, isActive)`: `small` instant → `medium` after decode → `large` (immediate if selected, idle otherwise). Canvas preloads current + adjacent pages.
5. **Upload finishes** (in-flight placed image) — `replaceImageSourceAcrossPages` swaps blob → **live URL** across all pages and patches undo snapshots so Ctrl-Z can't resurrect the blob.
6. **Repeat views / page flips** — browser HTTP cache + preloader. No blobs, no re-fetch.
7. **Save / Order / Export** — reads `item.url` (live) from Redux. A `blob:` can never reach the payload.

---

## Files changed

| File | Change |
|---|---|
| `src/library/utils/image/progressiveImage.js` | **New.** `useProgressiveImage` (small→medium→large ladder), `preloadImages`, `pickVariantUrl`, `resetImageLoadState`. |
| `src/components/canvas/Photo.jsx` | Use `useProgressiveImage(item, isActive)` + `decoding="async"`; `isPlaceholder` initialized from `item.url` (blink fix); thread `isActive` → `PhotoItem` → `PhotoHolder`. |
| `src/components/canvas/Canvas.jsx` | Preload effect for current + adjacent pages (`preloadImages`). |
| `src/layout/index.jsx` | `resetImageLoadState()` on editor unmount. |
| `src/tools/photos/PhotosAction.jsx` | Click-to-place probes `small` (not `large`); magnitude from `large` metadata. |
| `src/store/slices/canvas.js` | `removeObjectInPage` searches all sides of the active page (delete fix). |

> A short-lived `blobImageCache.js` was prototyped and **deleted** after we concluded blobs are redundant with the browser cache. Do not reintroduce it (see "Rejected approaches").

---

## Rejected approaches

- **Blob URL cache for display** — redundant with the browser HTTP cache, can't speed up first load, pins memory. Deleted.
- **Storing blobs in Redux and swapping to live on order** — would put blobs in undo snapshots and force every save/export path to reverse-swap (leak risk). Live URLs stay in Redux instead.
- **Blanket `large` on every canvas image** — gigabytes of decoded bitmaps at 2000 photos; replaced by the adaptive ladder.

---

## Performance characteristics

- **First paint:** instant (`small`), regardless of original size.
- **Editing sharpness:** full `large` on the focused image immediately; whole visible page reaches `large` on idle.
- **Memory:** bounded — only the active page's images are decoded; the browser evicts the rest.
- **Network:** one cached `small` per sidebar click (cache hit); medium/large fetched once and HTTP-cached; adjacent pages prefetched.
- **Print/export:** always full-res server-side — independent of canvas display.

---

## Future options (not built)

1. **Bulk-upload display reuse** — keep the just-made local blob for display after upload to avoid re-downloading freshly-uploaded images from the CDN during large template creation. Only if measured to lag.
2. **Zoom-aware upgrade** — upgrade non-selected images to `large` when the canvas zoom exceeds what `medium` can render sharply.
3. **CDN cache headers / immutable variant keys** — for instant reopen across sessions.

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
- 🖼️ **Image Loading Optimization (2026-06-16)** — _you are here_
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
