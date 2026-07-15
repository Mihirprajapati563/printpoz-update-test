# Multi-Select Group Gesture Performance — Session Notes (2026-07-10)

> Scope: making **multi-select group gestures** (drag / rotate / resize of 2+ selected objects) smooth at 60fps, the same way single-object gestures already are. This was the last "still per-frame dispatch" item flagged in **[Canvas Interaction Performance §6 →](canvas-interaction-performance-2026-06-16.md)** and **[Resize Imperative §3 →](resize-imperative-performance-2026-06-16.md)**. Only `ItemDragger.jsx`'s group handlers changed — no reducer, store, or renderer changes.

---

## TL;DR

| Problem | Fix |
|---|---|
| Group **drag/rotate** dispatched `updateMultipleObjects` **every frame** → the ~3900-line `MainCanvas` re-rendered ~60×/sec = the lag | Drag/rotate is imperative (cssText already moved the canvas members); mirror the move to the **footer** DOM copies (`applyLiveObjectTransform`) and commit **once** on gesture end. No per-frame dispatch. |
| Group **resize** dispatched every frame too | Push each member's live geometry to the per-object **`liveResizeStore`** (`setLiveResize`) — only that member's renderer reflows, `MainCanvas` doesn't subscribe → doesn't re-render. Commit once on end. |
| The old **start** handler fired a `history:true` checkpoint (needed only because the per-frame writes were about to move `present`) | Removed. With no per-frame writes, `present` stays at the pre-gesture state until the **single end-commit** → one Ctrl+Z fully reverts (matches single-object). |
| One shared start handler couldn't tell resize from drag | Split into `onGroupDragRotateStart` (drag/rotate + Ctrl-click toggle) and `onGroupResizeStart` (builds the resize snapshot, sets `isGroupResizingRef`). |

Result: `MainCanvas` commits during a group drag/resize drop from **~60/sec → 0** (1 on release), and the footer preview tracks the gesture live.

---

## Why it lagged

The single-object work (companion docs) made drag/rotate imperative and resize `liveResizeStore`-driven, but the **group** Moveable's handlers still dispatched `updateMultipleObjects({history:false})` on every `onRenderGroup` / `onResizeGroup` frame. Each dispatch rebuilt `state.pages` and forced a synchronous `MainCanvas` reconcile — exactly the fan-out the single-object fixes removed. Selecting 2+ objects and dragging/resizing therefore reproduced the original lag.

## The mechanism (a faithful port of the two proven single-object paths)

### Drag / rotate — imperative + footer mirror
`onRenderGroup` already applied `target.style.cssText += cssText` to each member (canvas visual). Now it **also**:
- mirrors the move to the footer copies via `applyLiveObjectTransform(id, x, y, rotation, target.ownerSVGElement)` (the canvas copy is skipped — moveable owns it), and
- stashes each member's `{x, y, rotation}` in `groupDragUpdatesRef` (a `Map`),
- and **does not dispatch**.

`onGroupTransformEnd` reads the ref and commits every member in **one** `updateMultipleObjects({history:true})`. Rotation is committed only when the gesture actually rotated (`rotation == null` on a drag-only frame → commit `{x,y}` only, so the reducer's transform-merge preserves each member's existing angle).

**Rotated-member footer trap:** on a drag-only frame Moveable reports `rotate = null`, so mirroring `0` would visibly un-rotate an already-rotated member in the footer. Each member's base rotation is captured in `groupBaseRotationRef` at drag start and used for the mirror when the gesture isn't rotating.

### Resize — per-member `liveResizeStore`
`onResizeGroup` keeps the **exact same** per-member math (image cover, text font-scale, `beforeTranslate`) — only the transport changed:
- `setLiveResize(id, { width, height, image?, font? })` per member instead of dispatching. The store's renderers (canvas **and** footer, all 6 types) already merge `useLiveResize`, so each member reflows correctly and `MainCanvas` never re-renders.
- The **live** override must carry a **complete** `font` object (the store renderer shallow-merges `{...raw, ...live}`; a bare `{size}` would drop family/weight mid-resize). The **commit** uses partials (`{size}`) because the reducer deep-merges.
- Final values stash in `groupResizeUpdatesRef`; `onGroupTransformEnd` commits them once and then `clearLiveResize` for every member (committed redux value == last override → no jump).

**`onRenderGroup` fires during resize too** (confirmed by the single-object `onRender`'s `isResizingRef` branch, which would be dead code otherwise). During a resize it still applies the wrapper translate (canvas position) and mirrors footer **position**, but skips recording drag values, and it uses the **snapshot** rotation for the mirror (never the gesture's mid-resize rotate, which can read 0). `isGroupResizingRef` routes `onGroupTransformEnd` to the resize branch.

---

## Undo (the part that silently breaks if you don't restructure it)

**Before:** `start` fired `history:true` (checkpoint pre-gesture), per-frame `history:false` writes carried the geometry, `end` fired `history:true`. The start checkpoint existed only because the per-frame writes were about to move `present`.

**After:** start does **not** checkpoint (it only builds the snapshot / captures base rotations and sets `isUpdatingObject`). The gesture is imperative, so `present` stays at the pre-gesture state until the **one** `history:true` end-commit. One Ctrl+Z reverts the whole group drag / resize / rotate — identical to single-object. A gesture with no movement commits nothing (no dead undo step).

---

## Files changed

| File | Change |
|---|---|
| `components/canvas/ItemDragger.jsx` | `onRenderGroup` (imperative drag/rotate + footer mirror, no dispatch); `onResizeGroup` (per-member `setLiveResize`, no dispatch); `onGroupTransformEnd` (single `history:true` commit from the stash refs + `clearLiveResize`); split `onGroupTransformStart` → `onGroupDragRotateStart` + `onGroupResizeStart` (no start checkpoint); new refs `isGroupResizingRef` / `groupBaseRotationRef` / `groupDragUpdatesRef` / `groupResizeUpdatesRef` |

No changes to `liveResizeStore.js`, `progressiveImage.js`, `canvas.js`, or any renderer — they already supported everything (group members are ordinary objects with the same ids / `data-id-t`).

---

## Gotchas (do not regress)

- **No per-frame dispatch in the group handlers** — that dispatch was the lag. Drag/rotate = cssText + footer mirror; resize = `setLiveResize`. Commit once on end.
- **Start must NOT checkpoint** — the single end-commit is the only `history:true`. Re-adding a start checkpoint gives a dead second Ctrl+Z.
- **Live font override must be a full font object** (shallow-merge renderer); the commit uses `{size}` (deep-merge reducer). Don't swap them.
- **During resize, mirror rotation from the snapshot, never the gesture's rotate** (it can be 0 → un-rotates the footer member). Same trap as single-object imperative resize.
- **Drag-only frames report `rotate = null`** — commit `{x,y}` only (preserve angle) and mirror the footer using the captured base rotation, not 0.
- **`clearLiveResize` after the commit** (dispatch first, then clear) so the renderer lands on the committed redux value with no jump.

---

## UI follow-ups (same session)

Small polish requested after the perf fix landed:

- **Multi-select toolbar cleared the rotate handle.** The `6 selected / Swap Images` toolbar's left edge sat exactly on the selection centre-X — right on top of the group rotate dragger. `updateMultiSelectToolbarPosition` now nudges `left` by `MULTISELECT_TOOLBAR_X_OFFSET` (40px) so the toolbar clears it.
- **Group rotate handles now match single-object.** The group `<Moveable>` had no `rotationPosition` (default = one top handle). Added `rotationPosition={["left-top","top","bottom","right-bottom"]}` + `className="moveable-rotation-control"` (same as the single-object Moveable) → four rotate handles.
- **Live rotation-angle readout (single object).** `ObjectProperty` (the `W:… H:…` label) now takes an `objectRotation` prop and renders `∠{deg}°` (always present so the DOM node exists at 0°). During a rotate gesture redux is frozen (imperative), so `onRender` writes the live angle straight to `.labelObjectRotationVal` (gated by `isRotatingRef`, set in the single Moveable's `onRotateStart`/`onRotateEnd`) and repositions the label; it re-syncs to the committed value on gesture end.

## Verification checklist

- React DevTools Profiler: `MainCanvas` shows **0 commits during a group drag and a group resize** (1 on release).
- Footer thumbnail tracks **live** for group drag, group rotate, and group resize.
- One Ctrl+Z fully reverts a group drag, a group resize, and a group rotate.
- A rotated member keeps its angle after a group resize and after a group drag.
- Group resize reflows content (text re-wraps, image re-crops) — not a uniform scale-distort.
- Ctrl/Cmd-click still toggles a member in/out of the selection.
- Save / export reflect the final committed geometry.

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
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
- 👥 **Multi-Select Group Gesture Performance (2026-07-10)** — _you are here_
<!-- DOCS-INDEX:END -->
