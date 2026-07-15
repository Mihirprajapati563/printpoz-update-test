# Firefox + react-moveable zoom fix — the "Golden Path" (2026-06-24)

> Scope: object selection (react-moveable's control box) **detached from the object in Firefox whenever the canvas was zoomed**, with the offset growing as zoom increased; Chrome looked fine. Root cause is CSS `zoom`. Fix = swap the user-zoom from CSS `zoom` to `transform: scale`, keep Moveable **inside** that transform, and counter-scale its handles with an **inverse `zoom` prop**. Touches `Canvas.jsx`, `ItemDragger.jsx`, `SafeAreaDragger.jsx`. See the companion **[problem statement](firefox-moveable-zoom-problem.md)** for the full investigation.

---

## TL;DR

| Symptom | Cause | Fix |
|---|---|---|
| Selection box offset from the object in **Firefox** when zoomed; offset ∝ zoom. Chrome OK. | User-zoom (`canvasScale`) was CSS **`zoom`** on `.canvas-box`. CSS `zoom` maps into `getBoundingClientRect()` **differently per browser** (W3C standardized it: unscaled→scaled rects, Chromium 128 / Firefox 126). react-moveable's own types say *"css zoom … cannot be used."* | Apply user-zoom as **`transform: scale`** instead — `transform` is consistent in `getBoundingClientRect` across browsers. |
| Selection box **borders/handles vanished** in Firefox (esp. bottom edge, below 100%). | Moveable is **inside** the scaled box, so its `1px` lines scale to sub-pixel (`0.5px`). Firefox rounds sub-1px lines to **0**; Chrome anti-aliases them. | Pass the **inverse** scale to Moveable's `zoom` prop (`zoom={1/canvasScale}`) → lines render `Npx` local → a true `1px` on screen. |
| Couldn't pan a zoomed-in canvas; handles clipped at edges. | `transform: scale` has **no layout footprint**, so `.pages-outer` never overflowed → no scroll, and the canvas hit `.pages-outer { overflow:hidden }`. | Wrap `.canvas-box` in **`.canvas-zoom-sizer`** sized to `base × scale + buffer` (measured) → real scroll footprint + room for the box. |
| Giant red numbers while dragging. | Moveable sizes snap-distance **digit text** as `fontSize × zoom`; the inverse `zoom` blows it up when zoomed out. | Disable digit display (`isDisplaySnapDigit`/`isDisplayInnerSnapDigit = false`). Snapping itself still works. |

---

## Why CSS `zoom` was the root cause 🎯

CSS `zoom` is a **non-standard property** that the W3C only recently standardized. The standardization **changed** how `zoom` maps into `getBoundingClientRect()` / `getClientRects()` / `IntersectionObserver`: they used to return **unscaled** rects and now return **zoom-scaled** rects. Chromium shipped this on-by-default in **128**; Firefox implemented the new behavior in **126**.

react-moveable builds its control-box matrix from `getBoundingClientRect` and is designed around CSS `transform` — its type defs literally state *"Because getBoundingClientRect is used, css zoom … cannot be used."* So with CSS `zoom` on the canvas wrapper, Firefox (new behavior) and the running Chrome (older behavior) disagreed, and the box drifted by the scale factor.

> **Not "Firefox-only."** It's a *standardized-zoom* issue — modern Chrome (128+) hits it too; a "working Chrome" was simply older. So the fix is to stop using CSS `zoom`, not to special-case Firefox.

---

## The Golden Path — DOM structure

```
.pages-outer  (overflow:auto when zoomed)
└── .canvas-zoom-sizer     width/height = base × canvasBoxScale + HANDLE_BUFFER×2
    │                      (MEASURED) → carries the scaled layout footprint so the
    │                      page overflows .pages-outer → pan works + handle room
    └── .canvas-box         transform: scale(canvasBoxScale); transformOrigin: 0 0;
        │                   position:absolute; top/left: HANDLE_BUFFER; willChange:transform
        ├── .ruler-reserve-wrap   transform: scale(0.95)  (ruler gutter; unrelated)
        │   └── <svg> … objects (Moveable targets)
        ├── <ItemDragger/>   ← INSIDE .canvas-box → shares the target's transform
        └── <SafeAreaDragger/>     context. zoom={1/canvasScale} keeps lines 1px.
```

**The single most important rule:** `<Moveable>` must render **inside** the `transform: scale` box (sharing the target's transform context). Putting it *outside* (a sibling of the scaled box) changes the target's `offsetParent` and detaches the box at every zoom in every browser — that was the failed attempt #3.

---

## The mechanism (3 files)

### 1. `Canvas.jsx` — `transform` + sizer + footprint
```jsx
const canvasBoxScale = canvasScale * mobileCoverMult;           // was the CSS zoom value

// sizer: real layout footprint so .pages-outer overflows (pan) + buffer for handles
<div className="canvas-zoom-sizer"
     style={{ margin:"auto", position:"relative",
              width: zoomFootprint?.w, height: zoomFootprint?.h }}>
  <div ref={canvasBoxRef} className="canvas-box"
       style={{ position:"absolute", top:HANDLE_BUFFER, left:HANDLE_BUFFER,
                transform:`scale(${canvasBoxScale})`, transformOrigin:"0 0",
                willChange:"transform" }}>
    …pages… <ItemDragger/> <SafeAreaDragger/>
  </div>
</div>
```
- **Footprint is MEASURED**, not computed: a `useLayoutEffect` reads `canvasBoxRef.offsetWidth/Height` (pre-transform → stable base) and sets `zoomFootprint = base × canvasBoxScale + HANDLE_BUFFER×2`. (Use `offsetWidth`, i.e. effectively `max-content`, NOT a `fit-content` wrapper — `fit-content` clamps to the sizer and feedback-collapses the canvas when zoomed out.)
- `HANDLE_BUFFER` (44px) on every side gives the selection box's borders + rotate/corner handles room so `.pages-outer { overflow:hidden }` can't clip them.
- The two **overflow-detection effects** now read `canvasBoxScaleRef.current` (the known scale) instead of `getComputedStyle(canvasBox).zoom` (which is now `1`, since there's no CSS zoom).

### 2. `ItemDragger.jsx` — inverse `zoom` + snap digits off
```jsx
const moveableZoom = 1 / (canvasScale || 1);   // INVERSE — keeps control lines 1px on screen
// on BOTH the single-object and group Moveable:
<Moveable zoom={moveableZoom} isDisplaySnapDigit={false} isDisplayInnerSnapDigit={false} … />
```
- `zoom` is the **inverse** scale. At 50% (`scale 0.5`) → `zoom 2` → lines render `2px` local → `1px` on screen. (`zoom={canvasScale}` was the bug — it made lines *thinner*, which Firefox rounds to 0.)
- Snap-distance **digit text** is hidden because Moveable sizes it as `fontSize × zoom`, which balloons under the inverse zoom. Snapping/guidelines still work.

### 3. `SafeAreaDragger.jsx`
Same inverse `zoom={1/canvasScale}` on its Moveable (it also lives inside the scaled `.canvas-box`).

---

## Dead ends (so nobody re-tries them)

| Attempt | Result |
|---|---|
| `zoom` prop = `canvasScale` (not inverse) | Position correct, but lines too thin → Firefox dropped borders. |
| `useAccuratePosition={true}` | No effect — docs exclude CSS `zoom`; also unsupported for group/multi-select. |
| `transform` with Moveable **outside** the scaled box + a sizer | Box detached at **all** zooms in **both** browsers (`offsetParent` changed). |
| `rootContainer` = un-transformed ancestor | Fixed the visual but **broke undo-tracking**. |
| Padding `.pages-outer` to reserve room | **Shifted** the centered canvas off the right/bottom. |
| GPU hint (`backfaceVisibility:hidden`) alone | Didn't fix vanishing borders (the inverse `zoom` did); kept only `willChange:transform`. |

---

## Files changed

| File | Change |
|---|---|
| `src/components/canvas/Canvas.jsx` | `.canvas-box` CSS `zoom` → `transform: scale` (`transformOrigin:0 0`, `position:absolute`, `top/left:HANDLE_BUFFER`, `willChange:transform`); new `.canvas-zoom-sizer` wrapper; `canvasBoxScale` + `canvasBoxScaleRef`; `zoomFootprint` state + `useLayoutEffect` measure; `HANDLE_BUFFER`; overflow-detection reads the known scale. |
| `src/components/canvas/ItemDragger.jsx` | `getCanvasScale` selector; `moveableZoom = 1/canvasScale`; `zoom={moveableZoom}` on both Moveables; `isDisplaySnapDigit`/`isDisplayInnerSnapDigit = false`. |
| `src/components/canvas/SafeAreaDragger.jsx` | `getCanvasScale` selector; `zoom={1/canvasScale}` on its Moveable. |

No store/reducer/API changes. The other Moveable in the tree (`SVGClippper.jsx`) is unused.

---

## Verification checklist (runtime — must be done in a browser, both Firefox + Chrome)
- Zoom in/out (Ctrl+wheel) at several levels → selection box **sits on the object**.
- All four **borders + corner/rotate handles render** at every zoom, esp. **below 100%**.
- **Drag / resize / rotate / snap** track correctly; objects still **snap** to guidelines (no giant numbers).
- **Multi-select** drag/resize.
- Zoom in past 100% → **pan/scroll** reaches all edges; canvas stays centered when it fits.
- Photobook (spreads/facing pages) **and** a single-page product (canvas/acrylic).

## Known minor caveat (pre-existing, same root cause)
The app's own marquee/paste coordinate calc (`toCanvasCoords` → `/zoomRatio`) doesn't account for `canvasBoxScale`, so rubber-band selection / paste-at-cursor can be slightly off **while zoomed**. It shares the exact root cause as this bug and was already imprecise on modern browsers; fix the divisor if it surfaces.

---

_Related: **[Firefox/Moveable zoom — problem statement](firefox-moveable-zoom-problem.md)** · **[Canvas Rulers](canvas-rulers-2026-06-24.md)**_
