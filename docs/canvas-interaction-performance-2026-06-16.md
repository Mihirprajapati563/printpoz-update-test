# Canvas Interaction Performance — Session Notes (2026-06-16)

> Scope: making the **main editing canvas** smooth during object drag/rotate/resize and inner-image zoom/pan (target: 60fps even at 4× CPU throttle), without breaking the **footer live preview**, undo, or export. Companion to **[Image Loading Optimization →](image-loading-optimization-2026-06-16.md)** (image *loading*) — this doc covers *interaction/rendering*.

---

## TL;DR

| Problem | Fix |
|---|---|
| Every drag/zoom frame re-rendered **all ~30 objects** | Selector returns **stable item identities** (WeakMap) + memoize all object components → only the changed object re-renders |
| Canvas zoomed by changing `<img>` width/height → **re-raster every frame** | Zoom via **GPU `transform: scale()`** on a fixed-size image |
| `MainCanvas` (god component) **re-rendered every gesture frame** | Drag/rotate/zoom/pan are **imperative** (no per-frame redux dispatch); commit once on gesture end |
| Footer live preview **froze** during imperative gestures | Mirror the gesture to footer DOM copies imperatively (`applyLiveImageTransform`, `applyLiveObjectTransform`) |
| Selection box **stopped tracking** during inner pan; **stayed oversized** on a pan-handle click | rAF `updateRect()` loop while panning + re-measure on pan end |
| Zoom-after-undo **jumped back** to old scale | Read zoom base from the **live object** (reverts on undo), not the preserved `activeObjectprops` |
| Inner pan/zoom **re-scanned the whole DOM** (`querySelectorAll`) every frame | Query the `<img>`/Ghost targets **once at gesture start**, cache, reuse each frame |

---

## How it works — at a glance 🎯

**① The lag: moving ONE object repainted ALL of them.** Imagine a classroom where the teacher asks *one* kid a question, but the *whole class* has to stand up and sit down. Drag one photo, and all ~30 objects re-rendered 60×/sec.

```
  ❌ BEFORE (everyone repaints)        ✅ AFTER (only the one you touched)
  ▣ ▣ ▣ ▣ ▣ ▣                          ▢ ▢ ▢ ▢ ▢ ▢
  ▣ ▣ ▣ ▣ ▣ ▣   ← all red = slow      ▢ ▢ ● ▢ ▢ ▢   ← one green = fast
  ▣ ▣ ▣ ▣ ▣ ▣                          ▢ ▢ ▢ ▢ ▢ ▢
```
The trick: give every object a **stable "name tag"** (a WeakMap) so React can tell *"this one didn't change — skip it."*

**② How a drag works now: move first, save once.** Before, every mouse wiggle wrote to the "save file" (Redux) — and writing the save file is what woke up the whole heavy canvas. Now we move the picture *directly* on screen and write the save file **once**, when you let go.

```
  🖱️ you drag        …still dragging         🖐️ you let go
  picture moves   →  NO save-file writes  →  save ONCE
  on screen          (canvas stays calm)     (undo works)
```

**③ The footer is a "mirror" — keep it in sync.** The page thumbnails show the *same* objects. Since we stopped writing the save file mid-drag, the footer wouldn't know to move — so during a drag we **also nudge the footer's copy directly**. Both move, still no save-file writes. (Same idea keeps the blue **selection box** glued to the photo.)

```
  🖼️ Main canvas  ⇄  🔻 Footer thumbnail
  moved by drag      nudged to match (same data-id)
```

---

## 1. The problem

On a 4× CPU throttle the main canvas stuttered during interaction while the sidebar/footer did not. Profiling showed the cost was **re-render fan-out and per-frame work**, not raster:

1. One interaction frame → one redux dispatch → `MainCanvas` (~3900 lines) re-renders → its N-object `.map` runs → **every object re-renders** (memo defeated).
2. Inner-image zoom changed `<img>` width/height → the browser **re-rasterized the full-res bitmap every frame**.
3. `MainCanvas` re-rendered **~60×/sec** during any gesture.

---

## 2. Root causes & fixes

### 2.1 Re-render fan-out → stable identities + memoization
`getAllObjectsSortedByZIndex` spread-copied every object (`{...obj}`) on every recompute → every `item` prop was a new reference → `React.memo` on `Photo`/`Shape`/`Sticker` failed (and `Text` wasn't memoized) → all N objects re-rendered each frame.

**Fix:** the selector now wraps each object through a **`WeakMap`** keyed by the underlying object. With Immer, an unchanged object keeps its identity across dispatches, so unchanged objects get the **same** wrapped reference → memo holds → **only the changed object re-renders**. `Text` is now `React.memo` too.

```
BEFORE (per drag frame)                AFTER (per drag frame)
 dispatch                               dispatch
   └─ getAllObjects (new array,           └─ getAllObjects (WeakMap reuse:
       {...obj} → ALL new refs)               only changed obj is a new ref)
        └─ MainCanvas re-render                └─ MainCanvas re-render
             └─ Photo×30 re-render  ✗               └─ Photo×1 re-render  ✓
                Text×N re-render  ✗                    (others memo-bail)
```

### 2.2 Full-res raster on zoom → GPU transform
The canvas sized the image with `width = image.width * scale`. Changing that re-rasters the source bitmap every frame (brutal at `large`). Now the image renders at **fixed intrinsic size** and zoom is `transform: translate(pos) scale(scale)` (`transformOrigin: 0 0`) → decoded once, GPU samples the texture → smooth at any zoom. Clip/mask/flip are frame-space and unaffected. (Full image-loading ladder: companion doc.)

### 2.3 Per-frame redux dispatch → imperative gestures
react-moveable already moves the dragged element imperatively (`cssText`), and the inner image uses a GPU transform — so the **per-frame redux dispatch is redundant for the visual**; its only job is persistence. So:

- **Object drag/rotate** (`ItemDragger.onRender`): no per-frame dispatch; commit the final transform once on `onDragend`/`onRotateEnd`. (Resize keeps dispatching — its size visual comes from redux width/height.)
- **Inner-image zoom** (`Canvas.jsx` wheel): write the `<img>` transform to the DOM each tick; commit once when scrolling pauses.
- **Inner-image pan** (`Photo.jsx` flushPan): move image + GhostImage imperatively; commit once on mouse-up.

Result: `MainCanvas` commit count during a gesture drops from **~60/sec → ~0** (one commit on release).

### 2.4 Imperative gestures broke the footer → mirror to footer DOM
The footer thumbnails read positions/sizes from redux, so any gesture made imperative froze the footer. Fix: helpers in `progressiveImage.js` mirror the gesture to the **off-canvas DOM copies** (footer renders the same objects with the same `data-id`/`data-id-t`):

- `applyLiveImageTransform(id, image, canvasRootEl)` — inner zoom/pan. Canvas `<img>` uses `transform`; footer `<img>` uses `marginLeft/marginTop` + scaled `width/height`.
- `applyLiveObjectTransform(id, x, y, rotation, canvasRootEl)` — object drag/rotate. Both render `<g class="page-item" data-id-t>`; mirror `translate/rotate`.

`canvasRootEl` (the main `<svg>`) is passed so the canvas copy (already moved by moveable / its own imperative write) is **skipped**. No redux → no `MainCanvas` re-render → footer stays live.

### 2.5 Selection box tracking during imperative pan
The moveable selection box re-measured when `getActiveObjectprops` changed (every frame, via the old dispatch). With imperative pan it stopped changing → the box froze. Fix: a **rAF loop** calls `moveableRef.current.updateRect()` every frame while `isDragger` is true; and on pan end (incl. a bare pan-handle **click**, which briefly shows the box-expanding GhostImage) it **re-measures** so the box snaps back instead of staying oversized.

### 2.6 Zoom-after-undo jump
The undo wrapper **preserves `activeObjectprops`** across Ctrl+Z (`store.jsx`), so after undo it kept the last-zoomed scale even though the object reverted. The zoom base now reads from the **live object** (`activeObjImageRef`, synced from `allObjects` + `activeObject`), which reverts on undo → re-zoom correctly starts from the reverted scale.

### 2.7 Per-frame DOM query during inner pan/zoom → cache the targets
The footer mirror (§2.4) finds an image's on-screen `<img>` elements with `document.querySelectorAll(...)`. The first version called that **every frame** of a pan/zoom — pan did it twice (the images + the GhostImage), zoom once — and the scan walks the *whole* DOM, which on a busy page includes **every footer thumbnail**. That per-frame scan was a residual "little lag."

Since the gesture is imperative (no re-render), those elements **don't change** during the gesture, so there's no reason to re-find them. Fix: split the helper into **query-once** + **apply-to-cached**:

- `queryLiveImageEls(id)` — runs the `querySelectorAll` once.
- `applyLiveImageTransformEls(els, image, canvasRootEl)` — applies position/scale to the already-queried elements.
- `applyLiveImageTransform(id, …)` — kept as a convenience (query + apply) for non-hot callers.

Callers cache at gesture start and clear at gesture end:
- **Pan** (`Photo.jsx`): first `flushPan` frame caches `{ imgEls, ghostEl }` in `panElsRef`; reused every frame; cleared on mouse-up.
- **Zoom** (`Canvas.jsx`): first wheel tick of a session caches `zoomImgElsRef`; reused every tick; cleared when the zoom commits.

Net effect: **N DOM scans per gesture → 1.** Pure DOM-lookup optimization — the same elements get the same writes, so redux/save/theme/export are untouched.

---

## 3. Architecture diagram

```
                          ┌────────────────────────────────────────────┐
                          │  REDUX (canvas.present)  — source of truth   │
                          │  objects: {transform, image:{scale,posX/Y}}  │
                          └───────▲───────────────────────────▲─────────┘
                  commit ONCE on  │                           │  read for
                  gesture end     │                           │  render
        ┌─────────────────────────┴───────┐      ┌────────────┴─────────────┐
        │   GESTURE (per frame, NO redux)  │      │     RENDERERS (memoized) │
        │                                  │      │                          │
        │  moveable cssText  ─┐            │      │  MainCanvas ─ Photo/Text/ │
        │  imperative img/g  ─┼─► DOM      │      │   Shape/Sticker (memo)    │
        │  applyLiveImage/   ─┘   (canvas  │      │  Footer ─ preview/* (memo)│
        │  ObjectTransform        + footer)│      │                          │
        └──────────────────────────────────┘      └──────────────────────────┘
                  │                                            ▲
                  └─────── footer DOM copies updated ──────────┘
                          imperatively (no re-render)
```

---

## 4. Data-flow diagram (one drag/rotate frame)

```
 mouse move
    │
    ▼
 react-moveable onRender
    ├─ e.target.style.cssText += cssText      ── moves CANVAS object <g>  (GPU)
    ├─ applyLiveObjectTransform(id,x,y,rot)   ── moves FOOTER object <g>   (GPU)
    └─ (NO redux dispatch)                     ── MainCanvas does NOT re-render
    │
    ▼  (gesture end)
 onDragend / onRotateEnd
    └─ dispatch setCurrentObjectProperties({transform, history:true})
         └─ ONE redux update → MainCanvas + Footer render the committed value
              (matches the imperative DOM → no jump)
```

Inner-image pan/zoom is identical, swapping `applyLiveObjectTransform` for
`applyLiveImageTransform`, plus the rAF `updateRect()` loop that keeps the
moveable box on the photo.

---

## 5. Files changed

| File | Change |
|---|---|
| `library/utils/helpers/canvasSliceGetters.js` | `getAllObjectsSortedByZIndex` returns **stable** wrapped items (WeakMap) |
| `components/canvas/Text.jsx` | `export default React.memo(Text)` |
| `library/utils/image/progressiveImage.js` | `applyLiveObjectTransform` (footer mirror); `queryLiveImageEls` + `applyLiveImageTransformEls` (query-once / apply-to-cached split); `applyLiveImageTransform` kept as convenience |
| `components/canvas/ItemDragger.jsx` | drag/rotate imperative (no per-frame dispatch); footer mirror in `onRender`; rAF `updateRect()` box-tracking + snap-back on pan end |
| `components/canvas/Canvas.jsx` | imperative image zoom (commit on pause, `history:true`); `activeObjImageRef` (undo-safe zoom base); footer mirror; `zoomImgElsRef` caches the targets per wheel session |
| `components/canvas/Photo.jsx` | GPU `transform` zoom render; imperative inner pan (commit on mouse-up); footer mirror; `data-id` on GhostImage; `panElsRef` caches the targets for the pan |
| `store/slices/canvas.js` | `removeObjectInPage` searches all sides (unrelated delete fix from the same session) |

---

## 6. Gotchas (do not regress)

- **The footer reads from redux** — any gesture you make imperative MUST be mirrored to the footer DOM (`applyLive*Transform`), or the footer freezes during that gesture.
- **Undo preserves `activeObjectprops`** — never use it as a gesture base; read the live object (`activeObjImageRef`).
- **No mid-zoom `history:true` snapshot** — it re-renders and resets the imperative transform (the "glitter"). Commit on pause with `history:true` instead.
- **Selection box** needs a rAF `updateRect()` loop during imperative pan, plus a re-measure on pan end (GhostImage expands the bbox).
- **Full-cover spread spine offset** is not re-applied in the footer mirror during a live drag (the footer catches up on commit on those special pages).
- **Cache the gesture's DOM targets, don't re-query per frame** — query `<img>`/Ghost once at gesture start (`panElsRef`/`zoomImgElsRef`), reuse, and **clear on gesture end** (stale cached nodes would point at a since-removed object). Use `applyLiveImageTransformEls` on the hot path; `applyLiveImageTransform` only for one-off calls.
- **Deferred (still per-frame dispatch):** multi-select group drag, object resize, whole-canvas zoom. Give them the same treatment if they lag.

---

## 7. Verification checklist

- React DevTools "Highlight updates": dragging an object highlights **only that object** (not the whole canvas).
- React DevTools Profiler: `MainCanvas` shows **0 commits during a drag, 1 on release**.
- Zoom/pan/drag/rotate are smooth at 4× CPU throttle.
- Footer thumbnail tracks **live** for drag, rotate, resize, image zoom, image pan.
- Selection box follows the photo during pan; snaps back on a pan-handle click.
- Zoom → Ctrl+Z → zoom again starts from the reverted scale.
- Inner pan/zoom stays smooth with many footer thumbnails present (no per-frame DOM scan).
- Export / save reflect the final committed position.

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
- 🎯 **Canvas Interaction Performance (2026-06-16)** — _you are here_
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
