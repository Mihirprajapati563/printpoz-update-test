# Blank Theme — Random-Layout Generator

**Session notes — 2026-07-08.** A "Blank design" entry point (for **photobook** and
**layflat album** products) that builds a fresh project where **every spread is
filled with a random layout** whose image count falls in a user-chosen range.
Image boxes stay **empty** — the user drops in their own photos afterwards.

This doc explains how it works end-to-end and how to reimplement it in **another
app, theme, or website**. The design principle throughout: **do not hand-roll any
layout→canvas scaling** — reuse the same reducers the "Shuffle" button already
uses, and just drive them programmatically.

---

## 1. TL;DR

| Topic | Detail |
|---|---|
| What it is | A generator that creates N pages, each filled with a **random, non-repeating** layout picked from the layouts catalog. Only for **spread-based** products (photobook / layflat). |
| Two entry points | (a) **Design-selection screen** → a dashed **"Blank design"** card in each photobook/layflat category grid, opening the Create modal with a random-layout section. (b) **In-editor** → a "Blank" card in the Themes sidebar tab. |
| Shared core | `src/library/utils/helpers/blankThemeGenerator.js` → `generateRandomLayoutPages(dispatch, { pageCount, minImages, maxImages })`. Both entry points call it. |
| Key reuse | It **does not** compute object positions itself. It builds empty pages, then per page dispatches the SAME reducers the Layout sidebar's Shuffle uses (`setPageLayout` / `setEntireSpreadLayout`), which own the scaling + bleed math. |
| Cache-first layouts | The layouts catalog is fetched from the API **once**, then stored **in-memory + durable local cache**. Subsequent generates run fully offline; the API is called **only when nothing is stored locally**. |
| No repeats | A `usedIds` set tracks layouts already placed; each page prefers an **unused** layout, repeating only when a given image-count is exhausted. |
| Blank = empty boxes | Layouts are placed with empty `type:"img"` boxes; no photos are inserted. |

---

## 2. User flow

```
Design-selection screen
  └─ open a Photo Book / Layflat Album category
       └─ grid shows a dashed "＋ Blank design" card FIRST
            └─ click → Create modal opens with a "Fill every spread with a
                        random layout" section pre-enabled
                 ├─ Project name
                 ├─ Size (predefined tiles or custom W×H, unit-aware) + DPI
                 ├─ Number of spreads
                 └─ Min / Max images per spread
            └─ Create
                 ├─ fetch layouts (cache-first)
                 ├─ build N blank pages, fill each with a random layout
                 ├─ open the editor with the generated design
                 └─ footer thumbnails + canvas render immediately
```

The in-editor Themes-tab card is the same, but it regenerates the **currently
open** design instead of creating a new one.

---

## 3. Files

| File | Role |
|---|---|
| `src/library/utils/helpers/blankThemeGenerator.js` | **The core.** `generateRandomLayoutPages()` + the cache-first layout fetch, spread/single predicate, no-repeat picker. Framework-agnostic logic (only depends on the store + a few reducers). |
| `src/components/design-selection/CreateNewDesignModal.jsx` | Design-selection entry: adds the random-layout fields; in `handleCreate` swaps the single empty page for `await generateRandomLayoutPages(...)`; opens the editor. |
| `src/components/design-selection/ThemeBrowser.jsx` | Renders the dashed **Blank design** card as the first grid tile (gated to photobook/layflat). |
| `src/layout/pages/DesignSelectionPage.jsx` | Wires the card → opens the Create modal in `mode="random"`. |
| `src/tools/themes/BlankThemeDialog.jsx` | In-editor entry: a focused modal that regenerates the open design via the same core. |
| `src/library/utils/helpers/assetsCache.js` | Added `readAssetCache` / `writeAssetCache` for the strict cache-first layout store. |

Reducers reused (all in `src/store/slices/canvas.js`): `applyTheme`,
`setPageNumber`, `setActiveSide`, `setPageLayout`, `setEntireSpreadLayout`,
`setCurrentObjectProperties`, `setCanvasSize`, `setEditorType`, `setSettings`.
Plus `setThemeApplied` (projectSetup) and `clearHistory` (redux-undo).

---

## 4. The generation algorithm (step by step)

`generateRandomLayoutPages(dispatch, { pageCount, minImages, maxImages })`:

1. **Read current context from the store** — `editorType`, `canvasSize`,
   `settings`. The CALLER must have set these first (size + type), because the
   scaling reducers read `state.canvasSize` synchronously.

2. **Decide split** — `usesHalfWidthLayout = PHOTOBOOK || settings.isFoldable`.
   - Photobook / foldable → `splitby = 2` (a layout side is scaled to
     `canvasSize.width / 2`; a spread has two sides).
   - Layflat (non-foldable) → `splitby = 1` (one full-width layout per page).
   - This **must match** the Layout sidebar's `scaleLayouts` split, or every
     layout is halved/doubled.

3. **Classify each page** — `isSpreadIndex(editorType, settings, i, total)`
   mirrors the Layout sidebar's spread-eligibility predicate exactly:
   - Photobook interior (indices ≠ `{0, 1, total-2, total-1}`) → **spread** (2-up).
   - Photobook covers/inside (`0, 1, total-2, total-1`) → **single** page.
   - Photobook index 0 when `showFullCoverSheet` → spread.
   - Layflat (non-foldable) → **single** (full-width) everywhere.

4. **Fetch layout pools (cache-first)** — one pool for spreads
   (`number_of_layouts: 2`) and one for single pages (`number_of_layouts: 1`),
   only for whichever the page classification actually needs. Each pool is
   scaled to the target size and grouped by image count. See §5.

5. **Build N blank pages** — each `{ id, title, bgColor:"#fff", layout: [],
   settings:{ isHalfSheet:false }, isPageEdited:false }`. The apply reducers
   create the layout sides from the empty `layout: []`, so we don't pre-shape
   them. Layflat cover pages get `isCoverPage:true` when `coverEnabled`.

6. **Apply pages** — `dispatch(applyTheme(blankPages))`.

7. **Fill each page** — loop `i = 0…total-1`:
   - `dispatch(setPageNumber(i))`.
   - Pick a random target image count in `[min, max]`.
   - Spread page → `pickLayout(spreadPool, target, usedIds)` →
     `dispatch(setEntireSpreadLayout(layout))` (fills both sides).
   - Single page → `dispatch(setActiveSide(0))` →
     `pickLayout(pagePool, target, usedIds)` →
     `dispatch(setPageLayout(layout[0]))`.

8. **Return the built pages** — `JSON.parse(JSON.stringify(
   store.getState().canvas.present.pages))` (deep-cloned so a caller can
   serialise/persist them).

`pickLayout` prefers a layout **not** already in `usedIds`; if the exact
image-count has no layouts, it falls out to the **nearest** count (like the
Shuffle fallback); it only repeats a layout when a count is fully exhausted.

---

## 5. Cache-first layouts (the "don't spam the API" part)

The generator NEVER calls the layouts API on every create. Three tiers, in order:

```
getRawLayouts(numberOfLayouts):
  1. in-memory pool (this session)      → reuse instantly
  2. durable local cache (blankgen_pool_N)
        AppData (desktop) / localStorage (web)   → reuse, survives restarts
  3. layouts API (full catalog, limit huge)
        → then PERSIST to both caches so it's never fetched again
```

- The catalog is stored **raw** (undecompressed) and size-independent. Each
  generate decompresses + scales it to the current target size on demand.
- `readAssetCache` / `writeAssetCache` in `assetsCache.js` are the strict
  cache-first primitives (unlike `withAssetCache`, which always re-fetches to
  refresh). They use a **stable** string key (`blankgen_pool_1` /
  `blankgen_pool_2`), not a hashed descriptor, so the same store is reused across
  sessions.
- **Trade-off:** once cached, new server-side layouts won't appear until the
  cache is cleared. That's intentional (the requirement was "only call the API if
  there are no layouts locally"). Add a staleness timestamp if you want periodic
  refresh.

---

## 6. Opening the generated design (design-selection path)

The whole point is to reuse the **proven** blank-design open flow and only swap
which pages get created. In `CreateNewDesignModal.handleCreate`:

```js
// prime the store so the generator scales against the target
dispatch(setEditorType(selectedEditorType));
dispatch(setSettings({ subtype: "", isFoldable: false,
                       showFullCoverSheet: false, coverEnabled: false }));
dispatch(setCanvasSize({ width, height, depth:0, safeMargin, bleedMargin, dpi }));

const themePagesData = wantRandom
  ? await generateRandomLayoutPages(dispatch, { pageCount, minImages, maxImages })
  : [emptyPage];                       // ← the ONLY branch that changed

dispatch(UndoActionCreators.clearHistory());   // generation floods the undo stack
// … the existing customer/admin save + navigate path, unchanged …
dispatch(setThemeApplied(true));               // so the Footer leaves skeleton state
```

Everything downstream (compress pages, `saveDesignToLibrary`, `navigate`,
customer vs admin) is the existing code.

---

## 7. Three bugs this feature hit (and the fixes) — read before porting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot read properties of undefined (reading 'some')` crash on open | The generator used `replaceSettings({subtype:""})` which **wiped** `settings.selectedMenuItems`; the customer Sidebar does `settings.selectedMenuItems.some(...)` unguarded. | (a) Use `setSettings` (**merge**) not `replaceSettings` — keep `selectedMenuItems`. (b) Guard the Sidebar access: fall back to the full menu when `selectedMenuItems` is missing. |
| Footer thumbnails stuck as loading skeletons | The footer gates on `projectSetup.isThemeApplied`. The customer create flow navigates `restore=1` without staging a snapshot, so `useEditorSnapshot`'s `setThemeApplied(true)` never fires. | Dispatch `setThemeApplied(true)` in the customer create path. |
| Same layout repeated across pages | `pickLayout` picked a random layout with no memory. | Track a `usedIds` set; prefer unused layouts. |

**General lesson for any port:** the two systemic fragilities are (1) replacing a
settings object that other code reads unguarded, and (2) an "is the design ready"
flag that some open paths forget to set. Guard shared reads; set the ready flag
wherever you apply pages.

---

## 8. How to port this to another app / theme / website

The concept is framework-agnostic. You need four capabilities:

1. **A layouts catalog** — a list of layout templates, each with an image count
   and a set of boxes (position/size in some reference coordinate space). Filter
   by "images per page" and by "single vs spread".

2. **A layout→canvas placer** — a function that, given a layout template and the
   target page size, produces positioned empty image boxes. **Reuse whatever your
   editor already uses for "apply a layout to a page"** — don't reimplement the
   math. (Here: `setPageLayout` / `setEntireSpreadLayout`.)

3. **A page model** — the ability to create N empty pages and apply a layout to
   page `i`. (Here: `applyTheme` + `setPageNumber` + the two apply reducers.)

4. **A cache** — any key/value store (memory + a durable layer). Store the raw
   catalog under a stable key; read it before fetching.

Pseudocode, editor-agnostic:

```
function generate(pageCount, minImages, maxImages):
    layouts = cacheFirstFetchLayouts()          # memory → durable → API
    used = new Set()
    pages = []
    for i in 0..pageCount-1:
        target = randomInt(minImages, maxImages)
        template = pickUnused(layouts, target, used)   # nearest-count fallback
        page = newBlankPage()
        applyLayout(page, template, targetPageSize)     # REUSE your placer
        pages.push(page)
    return pages
```

**Do keep:** cache-first (fetch once), no-repeat picker, nearest-count fallback,
empty boxes, "single vs spread per index" if your product has covers.

**Do watch:** the split factor (half-width per side vs full width) must match your
placer's expectation; set your "design ready / loaded" flag after applying; never
replace a shared settings/config object that other code reads without a guard.

---

## 9. Data contracts

**Layouts API** — `POST getLayouts`:

```jsonc
{
  "filter": {
    "status": { "$in": [1, 3] },
    "display_in_web": true,
    "number_of_layouts": 1,          // 1 = single page, 2 = spread
    "spread": false,                 // true when number_of_layouts === 2
    "number_of_images": { "$gte": 1 },
    "asset_type": "<LAYOUT asset id>"
  },
  "skip": 0, "limit": 10000000,      // fetch the whole catalog once
  "sortField": "_id", "sortOrder": "desc"
}
```

Each response item has `layout_c` = an lz-string-compressed base64 blob that
decompresses to:

```jsonc
{ "layout": [ { "width": W, "height": H, "objects": [ /* boxes */ ] } ] }
// spread layouts have TWO entries in "layout" (left + right)
```

`scaleLayout(layout, targetWidth/splitby, targetHeight)` rescales a layout's
`width/height` + object transforms to the target; the apply reducer's own
scale-factor then collapses to identity.

**Generated page** (what `generateRandomLayoutPages` returns per page):

```jsonc
{
  "id": "pages_<uuid>", "title": "…", "bgColor": "#fff",
  "layout": [ /* 1 side (single) or 2 sides (spread), each with positioned
                 empty type:"img" boxes */ ],
  "settings": { "isHalfSheet": false },
  "isPageEdited": false
}
```

---

## 10. Gotchas checklist

- ✅ Set `editorType` + `canvasSize` (+ clean settings) **before** calling the
  generator — the apply reducers read the store synchronously.
- ✅ `splitby` must match the Layout sidebar (photobook/foldable = 2, layflat = 1).
- ✅ `isSpreadIndex` must match the Layout sidebar's spread eligibility.
- ✅ Merge settings, never replace (keeps `selectedMenuItems` etc.).
- ✅ Set `isThemeApplied` (or your equivalent) after applying pages.
- ✅ `clearHistory()` after generation (it floods the undo stack).
- ✅ Cache the raw catalog; only fetch when nothing is stored locally.
- ✅ Track `usedIds` for variety; fall back to nearest count, then repeat.
