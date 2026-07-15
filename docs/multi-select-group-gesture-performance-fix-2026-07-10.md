# Multi-Select Group Gesture Performance — The Real Fix & Debugging Log (2026-07-10)

> Scope: making **multi-select group gestures** (drag / rotate / resize of 2+ selected objects) smooth at 60fps in **this** app. This is the as-built follow-up to the ported design notes in **[Multi-Select Group Gesture Performance →](multi-select-group-gesture-performance-2026-07-10.md)**. That port assumed the lag had the **same root cause** as the single-object work (`MainCanvas` re-rendering per frame). **In this app it did not.** This doc records what actually caused the lag, the data that proved it, every dead-end we hit, and the fix that finally landed — so nobody re-walks this path.

---

## TL;DR

The ported fix (make the group handlers imperative → stop the per-frame redux dispatch → stop `MainCanvas` re-rendering) was **implemented correctly and still lagged exactly the same.** Instrumentation proved why: during a group gesture **`MainCanvas` was already NOT re-rendering** (it went from ~10 renders to ~13 across 450 drag frames) and **our own handler cost ~0.1ms/frame** — so neither React nor our code was the bottleneck.

**The real cost was entirely inside react-moveable:** with `flushSync`, it **synchronously re-renders one control-box PER selected child** (8 boxes for 7 objects) on **every pointer-move (~200Hz)**. That synchronous storm was the lag — independent of redux, independent of `MainCanvas`.

**The fix:** keep `flushSync` (needed so the box tracks rotation live), but set **`hideChildMoveableDefaultLines={isUpdatingObject}`** so react-moveable renders its real per-child selection lines **at rest** and collapses to a **single** group box **during** a gesture (instead of re-rendering N child boxes at ~200Hz), and turn **snapping off** on the group (its per-frame geometry math was the other spike source). Cheap synchronous render during the gesture → smooth **and** live control-box; native selection lines when idle.

| Layer | Was it the cause? | Evidence |
|---|---|---|
| Per-frame redux dispatch → `MainCanvas` re-render | **No** | `MC renders` flat (~3 in 450 frames) |
| Per-frame `setState` (toolbar reposition) | No | removed it; no change |
| Our `onRenderGroup` body (cssText + `querySelectorAll` footer mirror) | No | measured **0.015–0.17ms**/frame |
| **react-moveable `flushSync` re-rendering N child boxes at mouse-poll rate** | **YES** | removing `flushSync` → instant smooth; re-adding → instant stutter |
| react-moveable snapping geometry (N targets × guidelines / frame) | Secondary | biggest `max-gap` spikes (400–700ms) tracked to it |

---

## What was implemented first (the faithful port — correct, but not the bottleneck)

The single-object imperative paths already existed here (`liveResizeStore`, `applyLiveObjectTransform`, imperative `onRender`). Only the group handlers still dispatched `updateMultipleObjects({history:false})` every frame. Following the port doc we made the group handlers imperative:

- **`onRenderGroup`** (drag/rotate): apply `cssText` to each canvas member + mirror to footer copies via `applyLiveObjectTransform` + stash `{x,y,rotation}` in a ref. **No per-frame dispatch.**
- **`onResizeGroup`**: push each member's live geometry to `liveResizeStore` (`setLiveResize`) + apply position from `drag.beforeTranslate` + stash. **No per-frame dispatch.**
- **`onGroupTransformEnd`**: commit the whole gesture in **one** `updateMultipleObjects({history:true})` from the stash, then `clearLiveResize`.
- Split the start handler into **`onGroupDragRotateStart`** (drag/rotate + Ctrl-click toggle, no history checkpoint) and **`onGroupResizeStart`** (builds the resize snapshot). One end-commit = one Ctrl+Z reverts.

This is all still in place and is **correct** — it's why `MainCanvas` no longer re-renders during a group gesture. It just wasn't what made the gesture feel laggy in this app.

**Deliberate divergence from the port:** the port claims `onRenderGroup` fires during a group resize and hangs resize *position* on it. That isn't guaranteed across react-moveable builds, so `onResizeGroup` owns position itself (it always fires during resize and already receives `drag.beforeTranslate`), and `onRenderGroup` early-returns during a resize.

---

## The debugging log — how we proved it, dead-end by dead-end

The user's report stayed constant through the first fixes: **"single object is perfectly smooth, group lags exactly like before."** That's the tell — it ruled out anything the two share.

### Attempt 1 — remove the per-frame redux dispatch (the port). ❌ no change
Made every group handler imperative (above). Still lagged identically. If the dispatch/`MainCanvas` re-render were the cost, this had to help. It didn't → the cost is elsewhere.

### Attempt 2 — remove the per-frame `setState`. ❌ no change
`onRenderGroup`/`onResizeGroup` called `updateMultiSelectToolbarPosition()` every frame, which does `setMultiSelectToolbarPos({...})` — a `setState` that re-renders `ItemDragger`. Removed it (the toolbar is `visibility:hidden` during the gesture anyway; it's repositioned once on end). Still lagged. Real, but not the bottleneck.

### Attempt 3 — **instrument instead of guess.** ✅ localized it
Two counters: one incremented in `MainCanvas`'s render body, one per `onRenderGroup` frame, logging both plus the time spent in our callback. Dragging 5 objects:

```
group drag frame # 374 … MC renders so far: 10
…
group drag frame # 822 … MC renders so far: 13      ← ~450 gesture frames, MainCanvas rendered 3×
[grp] members=5 avg-my-callback=0.015ms … MCrenders=16
[grp] members=5 avg-my-callback=0.168ms … MCrenders=19
```

**Verdict:** `MainCanvas` is essentially frozen during the drag (correct — no dispatch), and our handler costs **~0.1ms/frame**. By elimination the entire cost is **react-moveable's own per-frame group rendering.**

### Attempt 4 — remove `flushSync` from the group Moveable. ⚠️ fixed drag, broke rotate
`flushSync` forces react-moveable to re-render its control tree **synchronously** on every pointer-move. Removing it lets React batch to ~60fps. Result: **drag became perfectly smooth** — `avg-frame-gap` dropped to **8ms** (≈125fps). (The scary multi-second `max-gap` values were just idle time **between** separate drags — the probe clock wasn't reset per gesture. Fixed the probe; in-gesture gaps were consistently ~8ms.)

But it introduced two regressions:
- **The blue control-box stopped rotating live** — without `flushSync`, react-moveable commits the box asynchronously, so during a rotate it visibly trailed / didn't tilt.
- **Rotation was lost on commit** (see next).

### Attempt 5 — fix the "object snaps straight after group-rotate" bug. ✅ correctness fix
Symptom: rotate a group → deselect → click one object → it renders **unrotated**. Cause: on some frames (including the **final** one) react-moveable reports `transformObject.rotate == null`. Our end-commit then deep-merged `{x,y}` only — and because redux was untouched mid-gesture, that merged onto the **pre-gesture** angle (0). The old per-frame-dispatch code masked this by writing rotation on every frame. **Fix:** persist the **last non-null** rotation per member in the stash, so the commit always carries the real angle. (A pure drag never sets rotation → commits `{x,y}` only → preserves the existing angle. Correct either way.)

### Attempt 6 — conditional `flushSync` (off for drag, on for rotate). ❌ rotate still stuttered
Idea: drag doesn't need `flushSync` (translation box tracks fine), rotate does. Set it per gesture in the start handler. Drag stayed smooth, but **rotate still stuttered** (`max-gap` 95–246ms) — proving `flushSync` **itself** is the cost, not just which gesture uses it.

### Attempt 7 — snapping off. ⚠️ smaller spikes, still stuttered
Turned `snappable` off on the group (its per-frame geometry against all guidelines for N targets was suspected). `max-gap` spikes shrank from ~400–700ms to ~95–246ms — snapping was **a** cost — but rotate with `flushSync` still stuttered. So `flushSync`'s synchronous render is expensive **on its own**.

### Attempt 8 — rAF `updateRect()` loop to track the box without `flushSync`. ❌ tracks position, not tilt
Kept `flushSync` off (smooth) and ran a 60fps `groupMoveableRef.updateRect()` loop during rotate — the same pattern single-object pan uses. `updateRect` **re-measures** the box; it does **not re-rotate** it. So the box tracked position but the rotation tilt still didn't follow live. Dead end.

### Attempt 9 — **`hideChildMoveableDefaultLines` + keep `flushSync`.** ✅ smooth, but…
The realization: the expensive part of `flushSync`'s synchronous render is that react-moveable draws a **control box per child** in a group — 8 boxes for 7 objects — and re-renders **all of them** every frame. `hideChildMoveableDefaultLines={true}` hides the per-child boxes, leaving only the **single group box**. Now the synchronous `flushSync` render is **one** box → cheap enough to run at mouse-poll rate → **smooth drag, smooth rotate, and the group box tracks live.** Snapping stays off (removes the other spike; single-object objects still snap).

### Attempt 10 — the follow-up: hiding child lines removed the *selection* indicator. ✅ final
`hideChildMoveableDefaultLines={true}` made it smooth but also hid the per-object blue lines **at rest** — so you couldn't tell which objects were selected (only the group bounding box showed). A hand-drawn `<rect>` outline per selected object *looked wrong* and was rejected — users want react-moveable's real lines.

Key insight: **the child lines only need to be hidden while a gesture is running** (that's when re-rendering N boxes at ~200Hz stutters). **At rest there is no per-frame render, so the native lines are free.** So gate it on the gesture flag:

```jsx
hideChildMoveableDefaultLines={isUpdatingObject}   // true only during an active group gesture
```

- **At rest** (`isUpdatingObject === false`) → react-moveable draws its **real** per-child selection lines → clear, native-looking selection.
- **During drag/rotate/resize** (`isUpdatingObject === true`) → child lines collapse to the single group box → smooth; the box stays live via `flushSync`.
- **On release** → lines snap back onto every selected object.

The flag flips **once** at gesture start and **once** at end (set in the group start/end handlers), so it adds **no** per-frame cost — the smoothness is untouched.

---

## Final configuration (as shipped)

On the **group** `<Moveable>` in `components/canvas/ItemDragger.jsx`:

```jsx
snappable={false}                               // per-frame snap geometry (N targets × guidelines) was a spike source
hideChildMoveableDefaultLines={isUpdatingObject} // real child lines AT REST; only the group box DURING a gesture ← the fix
flushSync={flushSync}                           // keep it: the group box must track rotate/drag/resize LIVE
// triggerAblesSimultaneously removed            // only the active able computes per frame
```

`isUpdatingObject` is `true` only for the span of an active group gesture (set in the start handlers, cleared in `onGroupTransformEnd`), so the native per-child selection lines show at rest and hide only while dragging/rotating/resizing.

Handlers (all imperative, single commit on end):
- `onRenderGroup` — drag/rotate: `cssText` + footer mirror + stash last-non-null rotation. No dispatch.
- `onResizeGroup` — resize: `setLiveResize` per member (complete `font`/`image` for the shallow-merge renderer) + position from `beforeTranslate` + stash partials. No dispatch.
- `onGroupTransformEnd` — one `updateMultipleObjects({history:true})` from the stash + `clearLiveResize`.
- `onGroupDragRotateStart` / `onGroupResizeStart` — capture base rotations / build snapshot; **no history checkpoint**.

---

## Files changed

| File | Change |
|---|---|
| `components/canvas/ItemDragger.jsx` | Group handlers made imperative (no per-frame dispatch); split start handlers; single `history:true` end-commit; **persist last-non-null rotation** in the drag stash; group `<Moveable>` gets `hideChildMoveableDefaultLines={isUpdatingObject}` (native lines at rest, group box only during a gesture), `snappable={false}`, `flushSync` kept, `triggerAblesSimultaneously` removed, four `rotationPosition` handles + `moveable-rotation-control`; dropped the per-frame `updateMultiSelectToolbarPosition()` calls. Also: single-object live `∠°` rotation readout. |
| `components/popups/ObjectPropertiesPopover.jsx` | `objectRotation` prop → always-present `.labelObjectRotationVal` node (`∠{deg}°`) for the live single-object rotate readout. |

No reducer, store, or renderer changes — group members are ordinary objects (same ids / `data-id-t`); the renderers already merge `useLiveResize`.

---

## Gotchas (do not regress)

- **The group lag is NOT `MainCanvas` and NOT our handler.** Both were measured out (MainCanvas flat, handler ~0.1ms/frame). Don't re-attack them. The cost is **react-moveable's synchronous group render under `flushSync`.**
- **`hideChildMoveableDefaultLines={isUpdatingObject}` is load-bearing AND deliberate.** Hiding the child boxes *during a gesture* is what makes `flushSync` affordable (1 box vs N) — hard-coding it to `true` brings the stutter back if removed, but hard-coding it to `true` also **hides the selection indicator at rest** (users can't tell what's selected). Gate it on the gesture flag: real native lines at rest, single box only while gesturing. Do **not** replace the native lines with a hand-drawn `<rect>` — it was tried and looked wrong.
- **Keep `flushSync` on the group.** Without it the control-box does not track rotation live (`updateRect` re-measures but does not re-tilt — proven). The stutter it *used* to cause is gone because the child boxes are hidden.
- **`snappable={false}` on the group is intentional** (per-frame snap geometry across N targets was the other spike). Single-object still snaps. If group snap-to-guides is ever wanted back, expect to re-tune.
- **Persist the last non-null rotation in the drag stash** — a group rotate reports `rotate=null` on some frames incl. the final one; committing `{x,y}`-only would deep-merge onto the pre-gesture angle (0) and the object snaps straight after deselect/reselect.
- **No per-frame `setState` in the group handlers** (the toolbar reposition was one) — it re-renders `ItemDragger` + the group Moveable every frame. The toolbar is hidden during the gesture; reposition once on end.
- **`onResizeGroup` owns resize position** (from `drag.beforeTranslate`); don't make it depend on `onRenderGroup` firing during a resize.
- **When diagnosing "still laggy," instrument before theorizing.** This bug ate several wrong fixes aimed at `MainCanvas`/redux because the port *said* that was the cause. One render-counter + one callback-timer settled it in a single run.

---

## Verification checklist

- Group **drag** of 5–7 objects is smooth (~8–16ms frame gap, ~60–120fps).
- Group **rotate** is smooth **and** the blue control-box tilts **live** as it turns.
- Group **resize** is smooth; content reflows (text re-wraps, image re-crops).
- Multi-selecting shows react-moveable's **real per-object blue lines at rest**; they hide during a gesture (only the group box) and snap back on release.
- Rotate a group → deselect → click one object → it **stays rotated** (angle committed).
- One Ctrl+Z fully reverts a group drag, resize, and rotate.
- Ctrl/Cmd-click still toggles a member in/out of the selection.
- React DevTools Profiler: `MainCanvas` shows **0 commits during a group gesture** (1 on release).
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
- 👥 [Multi-Select Group Gesture Performance — port design notes (2026-07-10)](multi-select-group-gesture-performance-2026-07-10.md)
- 🩹 **Multi-Select Group Gesture Performance — The Real Fix & Debugging Log (2026-07-10)** — _you are here_
<!-- DOCS-INDEX:END -->
