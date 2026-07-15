# Fix: Per-Page Orientation for Spread Products

_Date: 2026-07-13 · Portable to the web version_

## The bug

Spread products — **photobook**, **layflat**, and any **foldable** editor — store the
**full spread width** (two pages side by side) as `canvasSize.width`. So a size like
**1200 × 600** is really two **600 × 600** pages.

Everywhere we _displayed_ orientation, we computed it from the raw stored width:

```js
const orientationOf = (w, h) => (w > h ? "Landscape" : w < h ? "Portrait" : "Square");
// 1200 × 600 photobook  →  1200 > 600  →  "Landscape"   ❌
```

But each page is 600 × 600 → **Square**. So size dropdowns, tiles, tables and previews
showed the wrong orientation for every spread product, and it contradicted the
orientation the store actually saved.

## The canonical rule (already in the reducer)

`setCanvasSize` already halves the width for spread products when it stores
`state.orientation`. This is the authority every display must mirror:

```js
// store/slices/canvas.js — setCanvasSize reducer
let width = /* incoming width */;
if (
  editorType === EDITOR_TYPES.PHOTOBOOK ||
  editorType === EDITOR_TYPES.LAYFLATALBUM ||
  state.settings?.isFoldable
) {
  width = width / 2;               // ← judge orientation per SINGLE page
}
if (width > height) state.orientation = "L";
else if (width < height) state.orientation = "P";
else state.orientation = "S";
```

**The fix = make every _display_ compute orientation the same way the reducer stores it.**

## The fix: one shared helper

Create a single source of truth and route every orientation display through it.

**`src/library/utils/helpers/orientation.js`**

```js
/**
 * Orientation helpers — a single source of truth for "is this size Landscape,
 * Portrait or Square?".
 *
 * Spread products (photobook, layflat, and any foldable editor) store the FULL
 * SPREAD width — two pages side by side — so a 1200×600 "size" is really two
 * 600×600 pages. Orientation must be judged per SINGLE page (width / 2), exactly
 * the rule the setCanvasSize reducer uses when it stores state.orientation.
 */

import { EDITOR_TYPES } from "../constants/index.js";

// A spread product renders two half-width pages, so its stored width is twice a
// single page. Mirrors the setCanvasSize reducer's condition.
const isHalfWidthSpread = (editorType, settings) =>
  editorType === EDITOR_TYPES.PHOTOBOOK ||
  editorType === EDITOR_TYPES.LAYFLATALBUM ||
  settings?.isFoldable === true;

// Per-page width for orientation/display: full width for normal products, half
// the stored spread width for spread products.
const perPageWidth = (width, editorType, settings) =>
  isHalfWidthSpread(editorType, settings) ? Number(width) / 2 : Number(width);

// Full orientation word ("Landscape" | "Portrait" | "Square"), judged per single
// page for spread products.
export const getSizeOrientation = (width, height, editorType, settings) => {
  const w = perPageWidth(width, editorType, settings);
  const h = Number(height);
  if (w > h) return "Landscape";
  if (w < h) return "Portrait";
  return "Square";
};

// Optional: single-letter form ("L" | "P" | "S") matching how the reducer stores it.
export const getSizeOrientationLetter = (width, height, editorType, settings) =>
  getSizeOrientation(width, height, editorType, settings).charAt(0);
```

> `settings` is optional. If a call site knows the editor type but not `settings`,
> pass just `editorType` — the photobook/layflat cases still fire. Only the
> **foldable** case needs `settings.isFoldable`.

## Replace every raw orientation computation

Search the codebase for these patterns and route them through `getSizeOrientation`:

- `w > h ? "Landscape" : w < h ? "Portrait" : "Square"`
- a local `orientationOf = (w, h) => …`
- `width < height ? 'Portrait' : …` (e.g. a "Type" column)

### Pattern A — module-level `orientationOf` → component-scoped, editor-aware

The helper needs the editor type, which lives in component state/selectors. Move the
local `orientationOf` **into the component** so it can close over the current type:

```diff
- // module scope
- const orientationOf = (w, h) => (w > h ? "Landscape" : w < h ? "Portrait" : "Square");
+ import { getSizeOrientation } from ".../helpers/orientation.js";

  function SizePicker() {
    const editorType = useSelector(getActiveEditorType); // or a prop
+   const orientationOf = (w, h) => getSizeOrientation(w, h, editorType);
    // …all existing orientationOf(w, h) call sites keep working unchanged
  }
```

### Pattern B — inline `const type = …` (e.g. a saved-sizes table)

```diff
- const type = width < height ? 'Portrait' : width > height ? 'Landscape' : 'Square';
+ const type = getSizeOrientation(width, height, activeEditorType, settings);
```

### Pattern C — a reusable modal that doesn't know the editor type

Thread the editor type in as a **prop** from the caller (which does know it):

```diff
  // ThemeSizeModal
- const orientationOf = (w, h) => (w > h ? "Landscape" : w < h ? "Portrait" : "Square");
+ const orientationOf = (w, h) => getSizeOrientation(w, h, editorType); // editorType is a new prop

  // caller
- <ThemeSizeModal variants={variants} … />
+ <ThemeSizeModal variants={variants} editorType={selectedCategory?.type} … />
```

## Sites changed in the desktop app (use as your checklist)

| File | What it shows | Change |
|---|---|---|
| `library/utils/helpers/orientation.js` | — | **new** shared helper |
| `components/design-selection/CreateNewDesignModal.jsx` | size dropdown, tiles, footer, saved orientation letter | replaced module `orientationOf` with component-scoped `getSizeOrientation(w, h, selectedEditorType)` |
| `tools/themes/BlankThemeDialog.jsx` | predefined-size dropdown | `getSizeOrientation(w, h, editorType, settings)` |
| `components/design-selection/ThemeSizeModal.jsx` | "choose a size" list | added `editorType` prop → `getSizeOrientation(w, h, editorType)` |
| `layout/pages/DesignSelectionPage.jsx` | — | passes `editorType={selectedCategory?.type}` into `ThemeSizeModal` |
| `components/popups/SizeSettingsPopup.jsx` | saved-sizes table "Type" column (both rows) | `getSizeOrientation(width, height, activeEditorType, settings)` |

### Left unchanged on purpose

- **CreateThemeDialog** already halved the width internally for spread products, so it
  was never wrong — leave it (or optionally route it through the helper for consistency).
- **Convert-modal optgroups** that group generic sizes by the `(P)/(L)/(S)` in a
  size's _label string_ — that's a naming convention on the catalog, not a computed
  display of the current product's orientation. Don't touch.
- **Orientation toggle icons** in the header (Landscape/Portrait buttons) — those set
  orientation, they don't display a size's computed orientation.

## Porting to the web version

The web app shares this architecture (same Redux `setCanvasSize` rule, same
`EDITOR_TYPES`, same size dialogs). To port:

1. **Add** `orientation.js` under the web app's `helpers` folder (adjust the import
   path for `EDITOR_TYPES`).
2. **Confirm the reducer rule** in the web `canvas` slice `setCanvasSize` — verify it
   halves the width for `PHOTOBOOK || LAYFLATALBUM || settings.isFoldable`. If the web
   list of spread products differs, mirror the SAME condition in `isHalfWidthSpread`
   so display and storage never diverge.
3. **Grep** the web `src/` for the raw patterns above and replace each with
   `getSizeOrientation(...)`, using Pattern A / B / C as it fits. Wherever a component
   already has the editor type (selector or prop), pass it; for a shared modal, add an
   `editorType` prop and pass it from the caller.
4. **Verify** (below).

## Verify

- **1200 × 600 photobook** → per-page 600 × 600 → **Square** ✅ (was "Landscape")
- **2000 × 1600 photobook** → per-page 1000 × 1600 → **Portrait**
- **1200 × 600 canvas/print** (non-spread) → 1200 × 600 → **Landscape** (unchanged) ✅
- **layflat** and **foldable** behave like photobook (halved); every other product is
  unchanged.
- The displayed orientation now matches `store.canvas.present.orientation` for the
  same size.

## Why one helper (don't inline it again)

The bug existed because the halving rule lived in the reducer but every display
re-derived orientation from the raw width. Centralizing it guarantees dropdowns,
tiles, tables, previews, and the stored value can never drift apart again. If the set
of spread products ever changes, update `isHalfWidthSpread` (and the reducer) in
lock-step — one place each.
