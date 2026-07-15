# Image Resizer Refactor — Review & Recommendation

Context: User reported uploaded image variants (small/medium/large) rendering as a square crop of the top of the image with the rest as black. A targeted bug fix was applied to [imageResizer.js](src/library/utils/upload/imageResizer.js). A broader refactor proposal was then put forward. This document records both opinions on that broader proposal.

---

## Root cause of the original bug

`applyOrientation` in [imageResizer.js:216-242](src/library/utils/upload/imageResizer.js#L216-L242) used the wrong translation axis for the rotation orientations:

- **Case 6** (rotate 90° CW): translated by `h` instead of `w`
- **Case 7** (transverse): `w` and `h` swapped
- **Case 8** (rotate 270° CW): translated by `w` instead of `h`

For an image with EXIF orientation 8 and landscape raw pixels (1920×1080), the bug mapped the bitmap into a 1080×1080 region at the top of the 1080×1920 portrait canvas. Remaining canvas area stayed transparent, and JPEG (no alpha) encoded it as black — exactly the reported symptom.

**Fix applied**: swap `w↔h` in cases 6, 7, 8. Case 5 was correct (translate is `(0,0)`).

---

## Advisor's opinion (on the original bug)

> The bug is in `applyOrientation` — the rotation cases (5–8) use the wrong axis for translation. Case 8 specifically explains your screenshot exactly.
>
> The standard EXIF-rotate idiom (`translate(canvas.width, 0); rotate(90°)` for case 6, `translate(0, canvas.height); rotate(-90°)` for case 8) gives:
>
> - Case 6: `ctx.transform(0, 1, -1, 0, w, 0)` — code had `h`
> - Case 7: `ctx.transform(0, -1, -1, 0, w, h)` — code had `h, w` (swapped)
> - Case 8: `ctx.transform(0, -1, 1, 0, 0, h)` — code had `w`
>
> Case 5 is correct because its translate is `(0,0)`, so the bug is invisible there.

The advisor confirmed the diagnosis pre-fix and recommended verifying with a re-upload of the failing image.

---

## Broader refactor proposal — review

The follow-up proposal included eight points: remove stale-EXIF heuristic, switch to 9-arg `drawImage`, sequential variant generation, explicit canvas cleanup, `HTMLImageElement` fallback, max dimension cap of 4096px, error handling, preserve API shape.

### Worth doing

| Item | Reason |
|---|---|
| **9-arg `drawImage`** | Eliminates manual `scaleX`/`scaleY` math, removes an off-by-one bug class |
| **Sequential variant generation** | Peak memory drops from ~1.31× to 1× of the largest canvas. Cheap mobile win |
| **Explicit canvas cleanup** (`canvas.width = 0`, null refs) | Known Safari/iOS GC pattern, harmless elsewhere |
| **Better error messages** | Current code silently falls back to legacy on any throw — explicit errors aid debugging |

### Carries real risk — push back

#### 1. Removing the stale-EXIF heuristic

```js
const effectiveOrientation =
  orientation >= 5 && orientation <= 8 && rawW <= rawH ? 1 : orientation;
```

This exists because `imageOrientation: "none"` is **not honored everywhere**:

- Chrome ≥105: honors it ✓
- Firefox ≥109: honors it ✓
- Safari: supported but with known quirks on iOS Safari and older WebViews
- Older Android WebViews: spotty

If a browser silently ignores the hint, the bitmap arrives already-rotated (portrait pixels), EXIF still says "rotate", and applying the orientation transform **double-rotates** → wrong dimensions. The heuristic catches exactly this.

**Verdict**: keep it. Removing it trades a cross-browser safety net for theoretical cleanliness.

#### 2. 4096px max dimension cap

The product list includes wall art, canvas prints, acrylic prints. A 4096px cap is ~13" at 300 DPI — fine for photobooks, **too small** for large-format prints.

**Verdict**: skip the cap, or raise to 8192px. Otherwise large-print quality regresses.

### Probably overkill

#### 3. `HTMLImageElement` fallback for `createImageBitmap`

`createImageBitmap` has been supported in all evergreen browsers since ~2020 (Safari 15+, 2021). Adding a fallback is ~50 lines that will likely never run.

**Verdict**: skip unless a specific old Android WebView target is required.

---

## Recommendation

Two viable paths:

### Path A — Ship the bug fix as-is
The crop/black-bottom symptom is resolved. Stop here, observe whether other symptoms appear in the wild.

### Path B — Targeted hardening (subset of the proposal)

- ✅ Switch to 9-arg `drawImage`
- ✅ Sequential generation
- ✅ Canvas cleanup
- ✅ Better error handling
- ❌ **Keep** the stale-EXIF heuristic
- ❌ **Skip** the 4096px cap (or raise to 8192)
- ❌ **Skip** the `HTMLImageElement` fallback

Path B captures the genuine wins (memory, clarity, mobile robustness) without the regressions Path A's full proposal would introduce.

---

## Status

- ✅ Bug fix applied to [imageResizer.js:216-242](src/library/utils/upload/imageResizer.js#L216-L242)
- ⏸ Broader refactor — pending decision (Path A vs. Path B)
