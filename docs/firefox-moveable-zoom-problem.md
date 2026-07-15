# Problem statement — react-moveable selection box misaligns in Firefox when the canvas is zoomed

## One-line summary
In **Firefox only**, when the design canvas is scaled by CSS **`zoom`**, react-moveable's selection/control box detaches from the target object — offset up-left, and the **offset grows proportionally with the zoom level**. Chrome is correct at all zoom levels. At 100% (zoom = 1) Firefox is also correct; the error appears only once `zoom ≠ 1`.

## Environment
- `react-moveable@0.56.0`, React 18.3.1, Create React App (CRA5/webpack5).
- Firefox (current). Chrome works correctly.
- Editor is an SVG-based design canvas (photobook / canvas-print / etc.). Moveable targets are elements **inside** an `<svg>`.

## How the canvas zoom works (the crux)
The user zoom (`canvasScale`, range 0.3–2, Ctrl+wheel) is applied as the **non-standard CSS `zoom` property** on the canvas wrapper:

```
.pages-outer (scroll container, overflow:auto when zoomed)
└── .canvas-box   style={{ zoom: canvasScale, margin: auto }}   ← CSS zoom here
    └── .ruler-reserve-wrap  style={{ transform: scale(0.95) }} ← small cosmetic reserve
        └── <svg> … <object/> (Moveable target)
└── <ItemDragger> → <Moveable> … (sibling of the page wrapper, inside .canvas-box)
```

CSS `zoom` is used (not `transform: scale`) specifically because **`zoom` inflates the layout box**, so `.pages-outer` overflows and the user can **scroll/pan** the enlarged canvas. `transform: scale` has **no layout footprint**, so it would break panning.

## Root cause (confirmed from the library's own type defs)
react-moveable computes the control-box position from `getBoundingClientRect()` and/or `offsetParent` math built around CSS **`transform` matrices**. It does **not** understand CSS `zoom`. The installed `declaration/types.d.ts` states verbatim:

> *"Because getBoundingClientRect is used, **css zoom**, transform: rotate between container and rootContainer **cannot be used**."*

Firefox maps CSS `zoom` into `getBoundingClientRect()` **differently from Chrome**, so Moveable's computed box position diverges from the real on-screen position by a factor that scales with the zoom. This is a **documented, by-design limitation**, not a bug — so a version bump is unlikely to fix it.

## What we tried (and why each failed)
1. **`zoom={canvasScale}` prop on `<Moveable>`** — *no effect on position.* The `zoom` prop only *"zooms in the elements of a moveable"* (resizes the handles); it is **not** a container-scale compensation.
2. **`useAccuratePosition={true}`** — *no effect.* It positions from `getBoundingClientRect`, but the docs explicitly exclude CSS `zoom` (and it doesn't support group selection). Empirically did not re-attach the box in Firefox.
3. **Replace CSS `zoom` with `transform: scale` on a wrapper** (so Moveable can read the matrix) **+ a sizer div carrying the scaled layout footprint** (to keep panning) — *regressed selection at ALL zoom levels in BOTH browsers.* Wrapping the target in a transformed ancestor changed the object's **`offsetParent`**, which this Moveable build's positioning depends on, so the box detached even at 100% / in Chrome. Reverted.
4. **`rootContainer` pointed at an un-transformed ancestor** (render the control box outside the scaled layer) — *fixed the visual but broke undo-tracking* (the box stopped following the object on Ctrl+Z). Reverted.

## Hard constraints any solution must satisfy
- **Pan/scroll when zoomed in must keep working** (the canvas can exceed the viewport; the layout must overflow `.pages-outer`).
- **Must not regress Chrome** (currently correct at all zooms).
- **Undo (Ctrl+Z) must still re-position the box** (Moveable re-measures via `updateRect()` on object change).
- **Drag / resize / rotate / snap / guidelines / group-multi-select must keep working** (large existing Moveable integration, incl. imperative `onRender` throttling and a live-resize store).
- Targets are **inside `<svg>`** (`svgOrigin="50% 50%"` is used).

## The core question to research
> How do you make react-moveable's control box align with a target that lives inside a **CSS-`zoom`-scaled** (or otherwise scaled) container — while preserving native scroll/pan of the enlarged canvas — specifically in **Firefox**, where `zoom` maps into `getBoundingClientRect()` differently than Chrome?

### Promising leads to investigate
- **`transform: scale` (not `zoom`) + a layout-footprint sizer + `useAccuratePosition`** together. `useAccuratePosition` uses `getBoundingClientRect` and may bypass the `offsetParent` breakage that killed attempt #3 — and `transform` (unlike `zoom`) is supported. Caveat: `useAccuratePosition` is documented as **not supporting group/multi-select**.
- **Render the canvas at true scaled pixel size** (scale the SVG width/height + viewBox instead of using `zoom`/`transform` at all), so there's no scaled ancestor for Moveable to misread. Larger rendering change.
- **A custom selection overlay** positioned purely from `getBoundingClientRect` per frame (bypasses Moveable's positioning entirely; reuses Moveable only for gesture math, or reimplements it). Most reliable, most work.
- **Upgrade react-moveable** and re-test — low confidence (limitation is documented as by-design), but cheap to check the changelog/issues for CSS-`zoom` / Firefox fixes.

## Keywords for search
`react-moveable css zoom firefox getBoundingClientRect`, `moveable control box offset scaled container`, `react-moveable useAccuratePosition zoom`, `moveable transform scale offsetParent`, `firefox css zoom getBoundingClientRect difference`.
