# Resize Imperative Performance — Session Notes (2026-06-16)

> Scope: making **single-object resize** (drag a corner/edge handle) smooth at 60fps for **every object type** — image, text, shape, sticker, QR, calendar — without breaking undo, the footer live preview, save/export, or any existing behavior. Companion to **[Canvas Interaction Performance →](canvas-interaction-performance-2026-06-16.html)** (which made drag/rotate/inner-zoom/pan imperative). Resize was explicitly **deferred** there; this doc finishes it.

---

## TL;DR

| Problem | Fix |
|---|---|
| Resize dispatched to Redux **every frame** → the ~3900-line `MainCanvas` re-rendered synchronously (`flushSync`) each frame = the lag | During the gesture, push live geometry to a **per-object store** (`liveResizeStore`); only the resized object's renderer re-renders, `MainCanvas` does **not**. Commit to Redux **once** on release. |
| First attempt (rAF-coalesce the dispatch) made it **worse** | Coalescing punted the dispatch off Moveable's synchronous `flushSync` tick → content lagged the selection box. Reverted. The cost was never the dispatch *count* — it was the per-dispatch `MainCanvas` re-render. |
| Text has self-managing height effects (auto-grow, Firefox fix) that **dispatch** | Guard those two effects OFF while resizing (`isLiveResizing`); they re-run and re-validate once the resize commits. |
| Footer thumbnails read from Redux → would freeze during the (now dispatch-free) gesture | Footer **preview** renderers subscribe to the same store (size tracks live) + the wrapper translate is mirrored imperatively (position tracks live). |

---

## How it works — at a glance 🎯

**The lag: resizing ONE object repainted the whole canvas's React tree.** Drag was already smooth because it commits to Redux **zero** times mid-gesture (it moves the element imperatively). Resize kept dispatching every frame "because its size comes from Redux width/height" — and every dispatch re-ran the giant `MainCanvas` component.

```
  ❌ BEFORE (per resize frame)        ✅ AFTER (per resize frame)
  onResize → dispatch(redux)          onResize → store.setLiveResize(id)
     └─ MainCanvas re-render  ✗           └─ only THAT object re-renders ✓
        (3900-line reconcile)               (MainCanvas untouched)
  …commit happens every frame          …commit ONCE on release (undo step)
```

**Why a store and not imperative DOM?** We want **true reflow** (text re-wraps, image re-crops, calendar grid re-lays-out) — not a uniform `scale()`. Letting React render the object with the live geometry gives correct reflow for free, for every type, with no hand-written per-type DOM surgery. The trick is isolating that re-render to **just the one object**: a `useSyncExternalStore` keyed by object id. `MainCanvas` never subscribes, so it never re-renders during the gesture.

---

## 1. The diagnosis (measured, not guessed)

The lag was localized by elimination — each step ruled a hypothesis out:

| Observation | Rules out |
|---|---|
| React DevTools "Highlight updates": **only the resized object** flashes | React render fan-out (memo works) |
| **Shape lags exactly like image** (shape dispatches once/frame, image up to 3×) | Dispatch *count* |
| Lag is the **same with 2 objects or 30** | Object-count-scaled work |
| Lag is **type-independent** (text/shape/image all equal) | Image-specific raster |
| **Paint flashing** shows almost no green | SVG repaint |
| Disabling Moveable **snapping** changed nothing | Moveable re-measure/snap |

What's left: a **fixed per-dispatch cost** that is invisible to paint/highlight = the synchronous `MainCanvas` reconciliation forced by `flushSync` on every per-frame dispatch. Confirmed by the fact that **drag (0 dispatches) is smooth** and resize (per-frame dispatch) is not.

---

## 2. The mechanism

### 2.1 Per-object override store (`liveResizeStore.js`)
A module-level `Map<id, override>` + `useSyncExternalStore`. `setLiveResize(id, {width,height,image?})` notifies only that id's subscribers. `getLiveResize` returns the cached object ref (or `null`) so there's no re-render when idle and no `getSnapshot` thrash.

### 2.2 Renderers merge the override
Every object renderer (canvas **and** footer preview) does:
```js
const liveResize = useLiveResize(rawItem.id);
const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
```
`null` at all other times → a complete no-op outside an active resize. During a resize, only the one resized object's component re-renders (canvas copy + its footer copy), and React reflows the real geometry.

### 2.3 ItemDragger drives it imperatively
- `onResizeStart` — seed `resizeWorkingRef` from the live object (so the image-cover math can chain frame-to-frame; Redux is frozen during the gesture, so the working ref is the source of truth and reproduces the old per-dispatch `flushSync` chain exactly).
- `onResize` — compute the next geometry (image cover / text measure+clamp / plain size) and `setLiveResize(id, …)`. **No Redux dispatch.**
- `onRender` — applies the wrapper translate via `cssText` (canvas) and mirrors it to the footer wrapper (`applyLiveObjectTransform`); **skips** the per-frame Redux dispatch for imperative types.
- `onResizeEnd` — commits the final width/height/image (+ x/y if a top/left handle moved the wrapper) in **one** `history:true` dispatch, then clears the override. The committed value equals the last override → no jump.

### 2.4 Text's self-managing effects are guarded
Canvas `Text` has a font auto-grow effect and a Firefox height-fix effect that **dispatch height to Redux** and are keyed on `item.width/height`. Merging the live geometry would make them fire (and dispatch) per frame. They early-return while `isLiveResizing` and re-run once the resize commits (so "text can't shrink below content" is still enforced — also kept live via a measure+clamp in `onResize`).

---

## 3. Coverage — ALL single-object types

| Type | Canvas renderer | Footer renderer | Imperative resize |
|---|---|---|---|
| Image | `canvas/Photo` | `preview/Photo` | ✅ |
| Text | `canvas/Text` (+effect guards) | `preview/Text` | ✅ |
| Shape | `canvas/Shape` | `preview/Shape` | ✅ |
| Sticker | `canvas/Sticker` | `preview/Sticker` | ✅ |
| QR code | `canvas/QRCode` | `preview/QRCode` | ✅ |
| Calendar | `calendar/DynamicCalendar` | `preview/DynamicCalendar` | ✅ |
| Multi-calendar | `calendar/MultipleDynamicCalendar` (shared) | (same component) | ✅ |

**Not in scope (unchanged, still use the old Redux path — no regression):** multi-select **group** resize (uses the group Moveable / `onResizeGroup`). Single-object drag/rotate/inner-zoom/pan were already imperative (companion doc).

---

## 4. Files changed

| File | Change |
|---|---|
| `components/canvas/liveResizeStore.js` | **New** — per-object override store + `useLiveResize` hook |
| `components/canvas/ItemDragger.jsx` | Imperative resize for img/text/shape/sticker/qrcode/calendar/multi-calendar; commit once on `onResizeEnd`; footer translate mirror; `onRender` skips per-frame dispatch for imperative types |
| `components/canvas/Photo.jsx` `Shape.jsx` `Sticker.jsx` `QRCode.jsx` | Merge live override |
| `components/canvas/Text.jsx` | Merge override **+ guard the 2 geometry-keyed dispatching effects** while resizing |
| `components/calendar/DynamicCalendar.jsx` `MultipleDynamicCalendar.jsx` | Merge override; re-derive width/height from it (keeping the original default-from-item semantics) |
| `layout/preview/Photo.jsx` `Text.jsx` `Shape.jsx` `Sticker.jsx` `QRCode.jsx` `DynamicCalendar.jsx` | Merge live override so the footer thumbnail tracks the resize live |

---

## 5. Safety audit (what was checked, by reading the code)

- **Undo/redo** — zero history during the gesture; exactly **one** `history:true` commit on release → one Ctrl+Z restores fully. Identical to before.
- **Image crop/cover** — math ported verbatim, chained through the working ref → same result as the old `flushSync` chain (no drift).
- **Rotated objects** — rotation is **not** taken from the gesture (which can report 0 during resize); the pre-resize rotation is preserved on commit and in the footer mirror, so a rotated object's angle is never wiped.
- **Text "can't shrink below content"** — preserved (live measure+clamp during the drag; the guarded effect re-validates on commit).
- **Save / export / order / themes** — all read Redux (committed value); no `blob:`/URL handling here, so nothing can leak.
- **Locked / customer-disabled** — resize is gated by `isAdjustable`; untouched.
- **Idle cost** — `useLiveResize` returns `null` when not resizing → no extra re-renders, ever.
- **Calendar / QR / Shape / Sticker** — pure renderers (no dispatch), so wiring cannot re-introduce the lag or fight the override.

---

## 6. Gotchas (do not regress)

- **Never coalesce the resize dispatch onto rAF** — it desyncs from Moveable's `flushSync` selection box (the failed first attempt). The fix is *no* per-frame dispatch, not *fewer*.
- **Text's dispatching effects MUST stay guarded** (`isLiveResizing`) — without the guard they dispatch height per frame during resize, re-introducing the lag and fighting the live geometry.
- **`MainCanvas` must NOT subscribe to the override store** — that's the whole point (it stays put during the gesture). The store is consumed only by leaf renderers.
- **Commit on release must equal the last override** (read from `resizeWorkingRef`) — otherwise the object jumps on release.
- **Calendar width/height** are default-from-item params; re-derive them from the merged item, or the override won't take effect.

---

## 7. Verification checklist

- React DevTools "Highlight updates": resizing any object highlights **only that object** (not the canvas).
- React DevTools Profiler: `MainCanvas` shows **0 commits during a resize, 1 on release**.
- Resize is smooth at 4× CPU throttle for **image, text, shape, sticker, QR, calendar**.
- Footer thumbnail tracks **live** during resize (size + position), for every type.
- Resize from a **top-left** corner and on a **rotated** object both track on canvas and footer.
- Ctrl+Z after a resize = one clean undo to the pre-resize state, every type.
- Text still cannot shrink below its content; auto-grow still works after release.
- Save/export reflect the final committed size.

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
- 📐 **Resize Imperative Performance (2026-06-16)** — _you are here_
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
