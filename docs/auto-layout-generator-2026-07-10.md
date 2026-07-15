# Auto Layout — Random-Layout Generator (in-editor)

**Session notes — 2026-07-10.** A complete in-editor system for **auto-generating and
re-rolling page layouts** in a photo editor, for **photobook** and **layflat album**
products. It lets a user (customer or admin) fill/re-shuffle every interior page with
random, non-repeating layouts — either keeping their placed photos or starting from
empty boxes — and lets an admin apply the same to a new or existing theme.

This doc is the **as-built reference** for the whole feature: the shared engine, every
button/dialog and exactly where it lives, the customer-vs-admin differences, the
page-vs-spread semantics, the bugs that were fixed, and a step-by-step port guide.

> Builds on the design-selection-era doc `docs/blank-theme-generator-2026-07-08.md`
> (which described the same engine for a *different* app's new-project flow). This app
> has **no design-selection screen**, so the feature is **fully in-editor**.

---

## 1. TL;DR

| Topic | Detail |
|---|---|
| What it is | Whole-book random-layout generation + re-roll for **photobook / layflat**. Every **interior (non-cover)** page gets a random, non-repeating layout. |
| Two content modes | **Keep my photos** (reflow existing content into new layouts — the default) and **Empty boxes** (clear + fresh empty slots). |
| Shared engine | `src/library/utils/helpers/blankThemeGenerator.js` → `generateRandomLayoutPages(dispatch, opts)`. Every entry point calls it. |
| Key reuse | It does **not** compute object positions. It builds the pages array, then per page dispatches the SAME reducers the Layout "Shuffle" uses (`setPageLayout` / `setEntireSpreadLayout`), which own scaling + bleed math. |
| Covers | **Never modified.** The engine splits pages into leading/interior/trailing and only touches interior pages. |
| Cache-first | Layout catalog fetched **once per session** via the existing `fetchAllLayoutsCached()` (in-memory, de-duped). No durable localStorage tier (deliberate — see §9). |
| Primary home (UI) | **Layout sidebar tab → "Auto Layout" card**: `Generate Layout` (opens options dialog) + `Shuffle All` (one-click re-roll). |
| Admin extras | New-design setup dialog gets a "Fill every page with a random layout" toggle (Create Theme **or** Apply Without Saving). Admins can also change the page count in the dialog. |
| Pages = pages | Public API + all UI speak **physical pages**; the engine converts to spreads internally (a photobook entry = a 2-page spread). |

---

## 2. Files

### Created

| File | Role |
|---|---|
| `src/library/utils/helpers/blankThemeGenerator.js` | **The engine.** `generateRandomLayoutPages()` + helpers + cache-first pools + no-repeat picker + page/spread conversion. |
| `src/tools/themes/BlankThemeDialog.jsx` | The **"Generate Layout"** options dialog (mode cards, photos-per-page, admin page count, destructive confirm). |
| `docs/auto-layout-generator-2026-07-10.md` | This doc. |

### Modified

| File | Change |
|---|---|
| `src/tools/layouts/LayoutsAction.jsx` | Added the **"Auto Layout"** card (Generate Layout + Shuffle All), the whole-book `shuffleAllPages` handler, and a `ConfirmationDialog` before Shuffle All. |
| `src/components/popups/CreateThemeDialog.jsx` | Admin new-design random-layout toggle; generation wired into both **Create Theme** (`handleSaveTheme`) and **Apply Without Saving** (`handleMaybeLater`). |
| `src/components/canvas/Canvas.jsx` | Marquee (drag-select) filters coerce coords with `Number()` (string-coord bug fix — see §7). |
| `src/store/slices/canvas.js` | `setCanvasSize`, `setPageLayout`, `setEntireSpreadLayout` coerce the bleed/safe margin with `Number()` so transform coords never become strings (root of the marquee bug). |
| `src/tools/photos/PhotosAction.jsx` | (Intermediate) had Generate/Regenerate buttons — **later removed**; Photos tab now only hosts **Auto Create** (photo-driven). |

Reducers reused (all in `src/store/slices/canvas.js`): `applyTheme`, `setPageNumber`,
`setActiveSide`, `setPageLayout`, `setEntireSpreadLayout`, `setCurrentObjectProperties`.
Plus `clearHistory` from `redux-undo`.

---

## 3. Where everything lives (final UI placement)

The single design principle that survived several iterations: **all layout automation
lives in the Layout tab** (the semantically correct home). The Photos tab stays about
photos. New-design setup (admin) is a separate moment.

```
LAYOUT TAB  (src/tools/layouts/LayoutsAction.jsx)
┌───────────────────────────────────┐
│ Layout                          ✕ │
├───────────────────────────────────┤
│ ✨ AUTO LAYOUT                     │  ← styled `AutoLayoutBox`, top of scroll
│  [ Generate Layout ] [ Shuffle All]│    - Generate Layout → opens BlankThemeDialog
│  Fill or re-roll every page …      │    - Shuffle All → ConfirmationDialog → shuffleAllPages()
├───────────────────────────────────┤
│ Page ○  Spread ○                   │  ← existing per-page controls (unchanged)
│ Filter by Photos …                 │
│ [–] [⇄ shuffle THIS page] [+]      │
│ [ layout thumbnails … ]            │
└───────────────────────────────────┘

PHOTOS TAB  (src/tools/photos/PhotosAction.jsx)
   → only "Auto Create" (photo-driven fill). NO generate/regenerate buttons.

NEW-DESIGN SETUP  (src/components/popups/CreateThemeDialog.jsx, ADMIN only)
┌───────────────────────────────────┐
│ Set Up Your Design                │
│ … name / size / type …            │
│ ✨ Blank Design                    │  ← shown only for photobook/layflat
│  [x] Fill every page with random  │
│      Number of pages [10]         │
│      Min photos [1]  Max [4]      │
│ [ Apply Without Saving ] [Create] │  ← both honor the toggle
└───────────────────────────────────┘
```

**Gating summary**

| Entry point | Who sees it | Product gate |
|---|---|---|
| Layout tab "Auto Layout" (Generate + Shuffle All) | **customer + admin** | photobook / layflat (`isBlankGeneratorSupported`) |
| Per-page shuffle (pre-existing) | customer + admin | photobook / layflat / foldable |
| CreateThemeDialog random toggle | **admin only** (dialog returns `null` for customers) | photobook / layflat |
| Admin "Number of pages" input inside `BlankThemeDialog` | **admin only** (`isAdmin` inside the dialog) | any supported product |

> `isBlankGeneratorSupported(editorType)` = `editorType === PHOTOBOOK || LAYFLATALBUM`.
> Admin = `userTypeCode ∈ { SUPERUSER(2), ADMIN(3), EMPLOYEE(5) }`, read from
> **Redux** `state.projectSetup.userDetails` (NOT localStorage — that's wiped on
> `beforeunload`).

---

## 4. The engine — `generateRandomLayoutPages`

```js
await generateRandomLayoutPages(dispatch, {
  mode: "keep" | "empty",        // default "empty" at the API level; the dialog defaults to "keep"
  minImages: 1,                  // photos per PHYSICAL page (see §6)
  maxImages: 4,
  targetInteriorCount,           // OPTIONAL physical-page count (admin). Omit to keep current count.
  preserveImageCount: false,     // keep-mode only: re-roll each page to its CURRENT photo count 1:1
})
// → returns deep-cloned built pages (already applied to the canvas)
```

### Algorithm (as-built)

1. **Read store context** — `editorType`, `settings`, `canvasSize`, `pages`,
   `activePageIndex`. (The caller must have set size/type/settings first if creating
   fresh — the scaling reducers read `state.canvasSize` synchronously.)
2. **Remember the active page** (`startPageIndex`) so we can land the user back on it
   afterward (the fill loop navigates page-by-page). **Do NOT force page 0** (that's the
   empty cover — jarring on a re-roll).
3. **`pagesPerEntry`** = `usesHalfWidthLayout ? 2 : 1` — bridges physical pages ↔ interior
   entries (a photobook/foldable entry is a 2-page spread; layflat is 1).
4. **Split** current pages into `{ leading, interior, trailing }` via `splitStructural`
   — covers are leading/trailing, only `interior` is regenerated.
5. **Build interior pages**:
   - `mode === "empty"` → `interior.map(blankInteriorFromExisting)` (`layout: []`, keeps
     id/title/settings/`isCoverPage`).
   - `mode === "keep"` → `interior.map(clonePage)` (retains objects, so the apply reducer
     reflows them).
6. **Admin page-count override** — `targetInteriorCount` arrives as **physical pages**;
   convert to entries: `Math.round(targetInteriorCount / pagesPerEntry)`. Grow (push
   `makeBlankInterior`) or shrink (`slice`) the interior list to that many entries.
7. **Assemble** `targetPages = [...leading, ...interiorPages, ...trailing]` and track
   `interiorStart` / `interiorEnd`.
8. **Fetch + scale pools** (cache-first): `fetchAllLayoutsCached()` → `{ page, spread }`,
   clone (never mutate the cache) + `scaleLayout(layout, canvasWidth/splitby, height)`.
   Only build the pool(s) the page classification needs.
9. **Commit** — `dispatch(setCurrentObjectProperties(null))` then
   `dispatch(applyTheme(targetPages))`.
10. **Fill each interior page** — loop `i = interiorStart … interiorEnd-1`:
    - `perPageFactor = pageUsesSpread(page) ? 2 : 1`.
    - `target = preserveImageCount && countPageImages(page) > 0`
      `? countPageImages(page)` (keep the current count 1:1)
      `: randomInt(lo * perPageFactor, hi * perPageFactor)` (photos-per-page → spread).
    - `dispatch(setPageNumber(i))`.
    - spread page → `pickLayout(spreadPool, target, usedIds)` →
      `dispatch(setEntireSpreadLayout(layout))`.
    - single page → `dispatch(setActiveSide(0))` →
      `pickLayout(pagePool, target, usedIds)` → `dispatch(setPageLayout(layout[0]))`.
11. **Restore** — `setPageNumber(clamp(startPageIndex, 0, targetPages.length-1))`,
    `setActiveSide(0)`, `setCurrentObjectProperties(null)`.
12. **Return** deep-cloned `store.getState().canvas.present.pages`.

`pickLayout(pool, target, usedIds)` prefers a layout **not** in `usedIds`; if the exact
image-count has none, it falls out to the **nearest** count (searches ±30). Only repeats
a layout when a count is exhausted. Records `lastGenerationConfig` for one-click re-roll.

### Public exports

| Export | Purpose |
|---|---|
| `generateRandomLayoutPages(dispatch, opts)` | The engine (above). |
| `getCurrentInteriorCount()` | Interior **entries** (spreads) of the open design. |
| `getCurrentInteriorPageCount()` | Interior count in **physical pages** (entries × `pagesPerEntry`) — used to seed the dialog's "Number of pages". |
| `getLastGenerationConfig()` | `{ mode, minImages, maxImages }` from the last run (module-level, survives sidebar remounts). |
| `isBlankGeneratorSupported(editorType)` | `true` for photobook / layflat. |

---

## 5. The dialogs & the buttons

### 5a. `BlankThemeDialog.jsx` — the "Generate Layout" options dialog

Reused everywhere generation is configured. Styled to match `CreateThemeDialog`
(gradient header, rounded modal, `--primary`).

- **Mode cards** (2×, `role="radiogroup"`): **Keep my photos** (FIRST, **default**) and
  **Empty boxes** (second). Order + default were deliberately set to Keep-first (the
  common "change my layout" intent). Cards carry `aria-checked`.
- **Photos per page**: Minimum / Maximum number inputs (clamped 1–20, clamp-on-blur so
  the shown value matches what runs). These are **per physical page** (see §6).
- **Number of pages** (admin only): seeded from `getCurrentInteriorPageCount()`; physical
  pages; help text "Currently N. Covers are added/kept automatically."
- **Summary line**: "Fills N pages with X–Y photos each … your undo history is reset."
- **Destructive confirm** (in-modal, not a second modal): fires when `mode === "empty" && hasPhotos`
  OR when an admin **reduces** the page count. The primary button flips to a red
  **"Replace & Generate"**; the secondary flips to **"Back"** (steps back to the form —
  does NOT close the dialog; Escape is gated the same way).
- On success: `clearHistory()`, toast, `onGenerated({ mode, minImages, maxImages })`
  callback (lets a caller remember settings), then `onClose()`.
- **Disabled** when there are 0 target pages (a brand-new empty book) — avoids a false
  "success" that changed nothing.

Props: `{ show, onClose, onGenerated? }`.

### 5b. Layout tab — `AutoLayoutBox` (the card)

`src/tools/layouts/LayoutsAction.jsx`, rendered at the **top of the scroll container**,
gated by `isBlankGeneratorSupported(editorType)`.

- **Generate Layout** (`$primary` `AutoBtn`) → `setShowGenDialog(true)` → renders
  `<BlankThemeDialog>`.
- **Shuffle All** (`AutoBtn`) → opens a `ConfirmationDialog`; on confirm →
  `shuffleAllPages()`:
  ```js
  const shuffleAllPages = async () => {
    dispatch(setCurrentObjectProperties(null));
    await generateRandomLayoutPages(dispatch, { mode: "keep", preserveImageCount: true });
    dispatch(UndoActionCreators.clearHistory());
    toast.success("All pages shuffled!");
  };
  ```
  i.e. whole-book re-roll that keeps content and each page's photo count 1:1.

### 5c. Shuffle All confirmation (validation)

Same for customer and admin (`src/components/popups/ConfirmationDialog.jsx`):

> **Shuffle all pages?** This will change the layout of every page. Your photos are kept
> and cover pages stay untouched. `[Cancel] [Shuffle All]`

`loading={shufflingAll}` keeps it open with a spinner during the async run, then closes.

### 5d. `CreateThemeDialog.jsx` — admin new-design (setup) integration

Only rendered for admins (returns `null` for `USER_TYPES.CUSTOMER`). Shows a **"Blank
Design"** `FormSection` for photobook/layflat with a switch + Number of pages + Min/Max.

- **Create Theme** (`handleSaveTheme`) and **Apply Without Saving** (`handleMaybeLater`)
  both branch on `wantRandom = randomLayout && isBlankGeneratorSupported(...)`:
  1. Dispatch editorType / settings / canvasSize (so the engine scales to target).
  2. Seed the base structure: photobook → `buildDefaultPhotobookPages()` (4 pages:
     front, inside, inside, back); layflat → one blank interior page.
  3. `dispatch(applyTheme(seed))` → `await generateRandomLayoutPages(...)` →
     `clearHistory()`.
  4. Create Theme also normalizes each layout side's `width/height` for the saved theme
     JSON and POSTs `saveAsTheme`. Apply Without Saving skips the API entirely.
- The **secondary button relabels to "Apply Without Saving"** when the toggle is on, so
  admins can change/apply a layout **without creating a theme**.

### 5e. Changing an EXISTING theme's layout (admin)

No new save path was needed — the header's existing **Save / Update Theme**
(`saveAsTheme(false)` / `updateThemeWithSvg`) updates the open theme. The flow is:

1. Open the saved theme (loads its layouts).
2. **Shuffle All** (Layout tab) or **Generate Layout** → whole-book re-roll (keep content,
   covers untouched, page count preserved).
3. **Save / Update Theme** (Header) → persists back to the SAME theme.

---

## 6. Pages vs. spreads (the semantic model)

The data model: a photobook/foldable **pages-array entry is a 2-page spread**
(`layout[0]` left + `layout[1]` right); a layflat entry is a single page. Users think in
**physical pages**, so the whole feature was made to speak physical pages, with the
engine converting internally:

- **`pagesPerEntry = usesHalfWidthLayout(editorType, settings) ? 2 : 1`.**
- **Number of pages** (input) → **entries**: `round(pages / pagesPerEntry)`. So a photobook
  "10 pages" → 5 spreads = 10 real pages. Layflat "10 pages" → 10 entries.
- **Photos per page** (input) → **spread target**: `randomInt(lo*perPageFactor, hi*perPageFactor)`
  where `perPageFactor = pageUsesSpread(page) ? 2 : 1`. So "4 photos/page" on a photobook
  targets ~8 across the spread (nearest-layout fallback covers exact availability).
- **Covers/special pages are excluded** from all counts — the engine only ever counts and
  fills `interior` pages.
- `preserveImageCount` (keep-content shuffle) is **not** scaled — it uses each page's actual
  current image count, which is already whole-page/whole-spread.

The dialog seeds "Number of pages" from `getCurrentInteriorPageCount()` and passes the raw
physical number as `targetInteriorCount`; the engine does the ÷/× conversion. UI never
shows the word "spread".

---

## 7. Bugs fixed this session (read before porting)

| Symptom | Root cause | Fix |
|---|---|---|
| **Marquee (drag-select) multi-select selected nothing** after generate/regenerate; shift-click still worked; reload "fixed" it. | Generated objects had **string** `transform.x/y` (e.g. `"1712.318…"`). In `setEntireSpreadLayout`/`setPageLayout`, `x = x * scaleX + bleed` where `bleed = canvasSize.bleedMargin` was a **string** → number+string **concatenation** → string coord. The marquee filter did `ox + obj.width` → string concat → `NaN` comparisons → nothing matched. (Reload's load-time `scalePages` multiplies coords → numbers, hence "reload fixes it".) | (a) **Root:** `Number(...)` the margin in `setCanvasSize`, `setPageLayout`, `setEntireSpreadLayout` so coords stay numeric (also fixes the same latent bug for the Shuffle button and export/alignment math). (b) **Defensive:** the marquee filters coerce `Number(obj.transform?.x)` etc. |
| Re-roll dumped the user on the empty **front cover**. | Engine ended on `setPageNumber(0)`. | Capture `startPageIndex` up front; restore it (clamped) at the end. |
| "Number of pages / photos per page" counted **spreads** while labeled **pages**. | Engine counted interior entries (spreads) directly. | `pagesPerEntry`/`perPageFactor` conversion (§6). |
| Brand-new (0-interior) book showed a false "generated!" success. | No guard. | Dialog disables Generate + shows a hint when target pages = 0. |
| "Back" (in the destructive confirm) closed the whole dialog. | `Cancel` handler always called `onClose`. | Confirm-aware handler steps back; Escape gated too. |

**General lesson:** the two systemic fragilities in this family of features are (1) a
shared apply-reducer that produces string coordinates when a config value (margin) is a
string, and (2) UI code that does arithmetic on `transform.x/y` assuming numbers. Coerce
at the source **and** defensively at the consumer.

---

## 8. How to port to another project

The concept is framework-agnostic. You need four capabilities:

1. **A layouts catalog** — templates each with an image count and boxes in some reference
   space, filterable by "images per page" and "single vs spread" (`number_of_layouts` 1
   vs 2).
2. **A layout→canvas placer you already have** — REUSE your editor's "apply a layout to a
   page" (here: `setPageLayout` / `setEntireSpreadLayout`). Don't reimplement the math.
3. **A page model** — create N empty pages and apply a layout to page `i` (here:
   `applyTheme` + `setPageNumber` + the two apply reducers).
4. **A cache** — memory (+ optional durable) keyed by a stable string; read before fetch.

Pseudocode:

```
function generate({ mode, minImages, maxImages, targetPages, preserveCount }):
    ctx      = readEditorContext()          # type, size, settings, pages, activePage
    factor   = usesSpreads(ctx) ? 2 : 1
    {lead, interior, trail} = splitCovers(ctx.pages)     # covers excluded
    body     = mode=="empty" ? interior.map(blank) : interior.map(clone)
    if targetPages != null:                 # physical → entries
        resize(body, round(targetPages / factor))
    pages    = [...lead, ...body, ...trail]
    apply(pages)
    used = new Set()
    for i, page in interior(pages):
        target = preserveCount && count(page)>0 ? count(page)
                 : randInt(minImages*factor, maxImages*factor)
        applyLayout(page, pickUnused(pool, target, used))   # REUSE your placer
    restore(ctx.activePage)
    return pages
```

**Do keep:** cache-first, no-repeat picker, nearest-count fallback, covers excluded,
physical-page ↔ spread conversion, restore-active-page, `clearHistory()` after generation.

**Do watch:** the split factor must match your placer (half-width per spread side vs full
width); coerce margins/coords to numbers at the source; set your "design ready" flag after
applying pages; a confirm before any destructive whole-book re-roll.

---

## 9. Gotchas checklist

- ✅ Reuse your apply reducers; never hand-roll layout scaling.
- ✅ Split factor = photobook/foldable → 2 (spread), layflat → 1 (single).
- ✅ Exclude covers/special pages from counts and fills.
- ✅ Public API + all UI speak **physical pages**; convert to spreads internally.
- ✅ Coerce margins to `Number()` at the reducer so `transform.x/y` never become strings;
  coerce again in any code that does math on coords (e.g. marquee select).
- ✅ Restore the active page after a re-roll (don't jump to the cover).
- ✅ `clearHistory()` after generation (it floods the undo stack) — warn the user it
  resets undo.
- ✅ Confirm before destructive actions (Shuffle All; empty-mode-with-photos; page-count
  reduction). Same wording for customer and admin.
- ✅ Read the user role from your durable auth source (Redux here), not a snapshot that a
  session teardown can wipe.
- ✅ Cache the raw catalog; only fetch when nothing is stored (one request per session).
- ✅ Disable the primary action when there is nothing to generate (0 interior pages).

---

## 10. Quick reference — data contracts

**Layouts API** (`POST getLayouts`): filter by `number_of_layouts` (1 single / 2 spread),
`spread`, `number_of_images`, `display_in_web`, `asset_type: LAYOUT`; `limit` huge to fetch
the whole catalog once. Each item's `layout_c` is an lz-string base64 blob →
`{ layout: [ { width, height, objects:[…] } ] }` (spread layouts have TWO entries).

**Generated page** (per interior page the engine builds):

```jsonc
{
  "id": "pages_<uuid>", "title": "…", "bgColor": "#fff",
  "layout": [ /* 1 side (single) or 2 sides (spread), each with positioned
                 type:"img" boxes; empty when mode:"empty" */ ],
  "settings": { "isHalfSheet": false },
  "isPageEdited": false
}
```
