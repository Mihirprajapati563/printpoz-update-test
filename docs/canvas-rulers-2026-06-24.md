# Canvas Rulers — Session Notes (2026-06-24)

> Scope: pro-album-style measurement **rulers that hug the top and left edges of the canvas**, with an on/off toggle in the top toolbar and a corner-box options dialog (unit + where `0` starts). State lives in `appSlice` (NOT `canvas.present.settings`) and is persisted to `localStorage`, so it carries across projects and never leaks into saved project/theme JSON. Touch-points: `src/components/canvas/CanvasRulers.jsx`, `src/layout/RulerControl.jsx`, `src/store/slices/appAlice.js`, and a small integration in `src/components/canvas/Canvas.jsx`.

---

## TL;DR

| Topic | Detail |
|---|---|
| What it is | Figma/Photoshop-style rulers pinned to the **top** and **left** edges of the canvas viewport. A toolbar toggle turns them on/off; a **corner box** opens an options dialog (Unit · "Start from" · Hide ruler). |
| Where the state lives | `appSlice` — `showRuler`, `rulerUnit`, `rulerOrigin`. Persisted to `localStorage` (`editorShowRuler` / `editorRulerUnit` / `editorRulerOrigin`). **Deliberately NOT in `canvas.present.settings`** — that slice is serialized into saved project/theme JSON, and a view-only pref must never leak into every saved document. `rulerUnit` is the ruler's **own** unit, independent of the print-unit pref. |
| Units / origin | Unit ∈ `px` / `in` / `cm` / `mm`. Origin (`rulerOrigin`) ∈ `center` (default = spine) / `start` (top-left corner) / `end` (bottom-right). The **left** ruler ignores `center` and treats it as `start` (there is no vertical spine). |
| Always-visible bands | The bands are **fixed at the viewport edges** and measure the canvas's **live on-screen rect** (`getBoundingClientRect` on `#canvasWrapper` ÷ its `viewBox`). They clamp to the viewport so they never scroll off-screen for a huge album or a small screen — only the tick **numbers** slide. |
| Gutter reserve | The canvas is **always** rendered at `transform: scale(0.95)` (`RULER_RESERVE_SCALE`) so there's permanent gutter for the bands — applied unconditionally so toggling the ruler never resizes the canvas (no blink). |
| ⚠️ Firefox gotcha | The 0.95 reserve MUST be a `transform: scale`, **not** CSS `zoom` — Firefox maps `zoom` differently in `getBoundingClientRect`, which offset Moveable's selection (object jumped top-right). `transform: scale` is handled identically by Moveable + `getBoundingClientRect` in every browser. |

---

## How it works — at a glance 🎯

```
  ┌─ corner box (unit + options dialog) ── top band (spans canvas width) ─────────┐
  │ px │  0    50   100   150   200   250   300   350  …                          │
  ├────┼──────────────────────────────────────────────────────────────────────────
  │  0 │                                                                          │
  │ 50 │                                                                          │
  │100 │                  ┌─────────────── canvas ───────────────┐               │
  │150 │   left band      │   #canvasWrapper <svg> + viewBox      │               │
  │  ⋮ │  (spans canvas   │                                       │               │
  │    │   height)        └───────────────────────────────────────┘               │
  └────┴──────────────────────────────────────────────────────────────────────────
       ▲ bands HUG the canvas edges (just outside the artwork), but CLAMP to the
         viewport so they stay visible when the canvas overflows / on small screens
```

- The **toggle** (`RulerControl`) flips `appSlice.showRuler`. When off, `CanvasRulers` renders `null` and wires up **no observers** — the cost is paid only while the ruler is on.
- The **corner box** (the small `px`/`in`/… square at the top-left intersection) toggles the **options dialog**: a segmented **Unit** control (`px`/`in`/`cm`/`mm`), a segmented **"Start from"** control (`Center`/`Start`/`End`), and a **Hide ruler** button. It closes on outside-click / Escape.
- Tick labels count **outward from `0`** at the chosen origin; the band itself stays glued to the canvas edge, so the numbers stay correct as the canvas zooms/pans.

---

## 1. State — `appSlice` (not `canvas.settings`), persisted to `localStorage`

`src/store/slices/appAlice.js` owns three fields + three actions:

```js
// initial state
showRuler:  readShowRuler(),   // localStorage "editorShowRuler"  → boolean (default false)
rulerUnit:  readRulerUnit(),   // localStorage "editorRulerUnit"  → "px"|"in"|"cm"|"mm" (default "px")
rulerOrigin:readRulerOrigin(), // localStorage "editorRulerOrigin"→ "center"|"start"|"end" (default "center")

// actions (each validates + writes through to localStorage)
setShowRuler(boolean)
setRulerUnit("px"|"in"|"cm"|"mm")     // falls back to "px" on bad input
setRulerOrigin("center"|"start"|"end") // falls back to "center" on bad input
```

- **Why `appSlice`, not `canvas.present.settings`:** `settings` is serialized into saved project/theme JSON (via `Header.jsx getDataToSave`). Ruler visibility is a pure **view preference** — keeping it in `appSlice` + `localStorage` means it survives reloads and **carries across projects** without polluting any saved document. Same rationale as `layoutMode`.
- **`rulerUnit` is independent** of the print/document unit preference (`getPreferredUnit()`); the ruler measures in whatever unit the user picks in the corner dialog.
- Each setter is defensive: it validates against the allowed list and silently no-ops the `localStorage` write if storage is unavailable.

---

## 2. The toggle — `RulerControl.jsx` (top toolbar)

`src/layout/RulerControl.jsx` is an `IconButton` rendered inside an `ActionWrapperBox` in **TopActions**, so it matches the other toolbar buttons.

- Uses the toolbar's `.active` convention: when `showRuler` is true it gets `className="active"` (light-blue tint) and the icon/label switch to `var(--primary)`.
- `role="switch"` + `aria-checked={showRuler}` for accessibility; title flips between "Show ruler" / "Hide ruler".
- **On/off only** — the unit and origin options deliberately live in the ruler's **own corner dialog**, not in the toolbar and not in the Settings tab (matches how a pro editor exposes ruler options at the corner intersection).

---

## 3. The ruler component — `CanvasRulers.jsx`

Rendered once inside `Canvas.jsx`'s outer `.CanvasWrapper` (the canvas viewport, `position: relative`); self-gated by `showRuler`.

### 3.1 Always-visible bands measured from the live rect

`measure()` reads the canvas's live on-screen geometry and stores it in `geom`:

```js
const cRect = root.getBoundingClientRect();        // the .CanvasWrapper viewport
const sRect = svg.getBoundingClientRect();         // #canvasWrapper <svg>
geom = {
  rootW, rootH,                                    // viewport size
  left: sRect.left - cRect.left, top: sRect.top - cRect.top, // canvas offset in viewport
  width: sRect.width, height: sRect.height,        // canvas on-screen size
  vbW: svg.viewBox.baseVal.width,                  // canvas-units (for in/cm/mm)
  vbH: svg.viewBox.baseVal.height,
};
```

- `screenPerCanvasX = geom.width / geom.vbW` converts canvas units → on-screen px, so **cm/in marks stay physically correct** at any zoom (rect ÷ viewBox), and `dpi = canvasSize.dpi || 200` feeds the unit conversion.
- The bands span the canvas extent and **hug** its edges (`top - THICK - GAP`, `left - THICK - GAP`), but the thickness-axis position is run through `clampPos(v, max)` so a band **sticks at the viewport edge** instead of scrolling off-screen when the canvas is larger than the viewport (huge album) or the screen is small. Only the tick numbers slide.

### 3.2 Origin (where `0` sits)

```js
// top ruler honours center/start/end
const origin0X = origin === "start" ? 0 : origin === "end" ? geom.width : geom.width / 2;
// left ruler IGNORES "center" — no vertical spine; center behaves like start
const origin0Y = origin === "end" ? geom.height : 0;
```

Ticks are built outward from the origin in both directions; labels are `Math.abs(k * step)` so they count up on either side of a centered `0`.

### 3.3 Adaptive tick density + memoization

- A "nice-step" ladder (`PX_LADDER` / `UNIT_LADDER`) keeps **labelled ticks ≥ 56px apart** (`MIN_MAJOR`) so node count stays bounded at any zoom; minors below `MIN_MINOR` (6px) are dropped. Three tick levels: major / mid / minor.
- Tick geometry is `useMemo`'d on `[geom, unit, origin, canvasSize.dpi]`; `measure()` is **rAF-throttled** (`schedule()`).

### 3.4 Re-measure triggers

A `ResizeObserver` watches the `#canvasWrapper` svg **and** the root **and** `.pages-outer` (the animated padding shift when the ruler toggles on is a position change with no svg-size change — the `.pages-outer` content-box shrinks through the transition, so observing it keeps the bands following the canvas to rest). Plus a `scroll` listener on `.pages-outer`, `window resize`, two belt-and-suspenders `setTimeout`s (120ms / 420ms), and effect deps `pageIndex / zoomRatio / canvasScale / canvasSize` (a `pageIndex` change re-acquires the remounted svg).

### 3.5 Corner dialog

Clicking the corner box toggles `.canvas-ruler-menu` — a small popover with the **Unit** segmented control, the **"Start from"** segmented control, and a **Hide ruler** button (dispatches `setShowRuler(false)`). Closes on outside-click / Escape. Because the whole overlay renders at **viewport scale** (outside the canvas zoom), it's a normal-sized, crisp UI regardless of zoom.

### 3.6 Guarantees

- Root has `pointerEvents: none` (the corner button + dialog opt back in with `pointerEvents: auto`), so the bands never intercept canvas clicks.
- `className="not-exportable"` keeps the rulers out of any export/capture.
- The root `<div>` always mounts (guarded only on `showRuler`, not on `geom`) so `rootRef` is set and `measure()` can populate `geom` — guarding on `geom` would mean it never becomes visible.

---

## 4. Canvas integration & the Firefox gotcha — `Canvas.jsx`

```jsx
// rendered in the outer .CanvasWrapper, self-gated by showRuler
<CanvasRulers />
```

```js
const RULER_RESERVE_SCALE = 0.95; // permanent gutter for the rulers
// …on the .canvas-box style:
zoom: canvasScale * (…),                     // existing page zoom
transform: `scale(${RULER_RESERVE_SCALE})`,  // the ruler gutter reserve
transformOrigin: "center center",
```

- The ~5% gutter is reserved **unconditionally** (always-on), so toggling the ruler never resizes the canvas → **no blink** on toggle. Centered transform-origin shrinks the canvas toward its middle so it never goes off-screen.
- ⚠️ **It MUST be `transform: scale`, NOT `zoom`.** Folding the 0.95 into the existing `zoom` broke Moveable's selection in **Firefox**: Firefox maps CSS `zoom` differently inside `getBoundingClientRect`, which offset Moveable's selection box (the object jumped to the top-right). A `transform: scale` is handled identically by Moveable + `getBoundingClientRect` in every browser, so the selection stays aligned. Do not collapse the reserve back into `zoom`.

---

## 5. Files changed

| File | Change |
|---|---|
| `src/store/slices/appAlice.js` | Added `showRuler` / `rulerUnit` / `rulerOrigin` to initial state (read from `localStorage` via `readShowRuler`/`readRulerUnit`/`readRulerOrigin`) + `setShowRuler` / `setRulerUnit` / `setRulerOrigin` reducers (validate + write through to `localStorage` keys `editorShowRuler` / `editorRulerUnit` / `editorRulerOrigin`). |
| `src/layout/RulerControl.jsx` | New on/off toggle `IconButton` for TopActions (uses `.active` convention, `role="switch"`); drives `setShowRuler`. |
| `src/components/canvas/CanvasRulers.jsx` | New viewport-anchored ruler overlay: measures `#canvasWrapper` rect ÷ viewBox, clamps bands to viewport, adaptive tick ladder, corner options dialog (unit + origin + hide). |
| `src/components/canvas/Canvas.jsx` | Renders `<CanvasRulers />` in the outer `.CanvasWrapper`; adds the `RULER_RESERVE_SCALE = 0.95` `transform: scale` gutter on `.canvas-box` (NOT `zoom` — Firefox/Moveable alignment). |
| `src/layout/TopActions.jsx` | Mounts `RulerControl` inside an `ActionWrapperBox`. |

---

## 6. Verification checklist

- Toggle the **Ruler** button in TopActions → bands appear/disappear at the top + left canvas edges; button shows the `.active` (primary) state when on.
- Toggling on/off does **not** resize or jiggle the canvas (the 0.95 gutter is permanent).
- Click the **corner box** → options dialog opens; change **Unit** (px/in/cm/mm) → tick labels switch units and stay physically correct; outside-click / Escape closes it.
- Change **"Start from"** Center / Start / End → top ruler's `0` moves to center / left / right; the **left** ruler treats Center as Start (0 at top), and End flips it to the bottom.
- Zoom in until the canvas overflows the viewport → bands **stay visible** (clamped to the viewport edges); only the numbers slide. Scroll `.pages-outer` → bands follow the canvas edge.
- Reload the page → `showRuler` / unit / origin persist (localStorage); open a **different project** → the same ruler prefs carry over.
- Save a project / save as theme → the saved JSON contains **no** ruler fields (they live in `appSlice`, not `canvas.settings`).
- **Firefox specifically:** select/move an object with the ruler on → Moveable's selection box stays aligned with the object (no top-right jump). This is the reason the reserve is `transform`, not `zoom`.
- Export → rulers do not appear in the output (`not-exportable`).

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
- 📏 **Canvas Rulers (2026-06-24)** — _you are here_
<!-- DOCS-INDEX:END -->
