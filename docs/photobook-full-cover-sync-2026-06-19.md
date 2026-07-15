# Photobook Full-Cover Merge-State Sync — Session Notes (2026-06-19)

> Scope: fixing the intermittent **"back cover lands on page one instead of the front cover"** bug when toggling **Full Cover** on a photobook from the **Size Settings popup** and switching between saved sizes. The expected cover spread is **back (left) + spine + front (right)** — confirmed by the user. The fix makes the `setSettings` reducer reconcile the page **data shape** to the effective `showFullCoverSheet` setting instead of reacting only to settings *transitions*.

---

## TL;DR

| Problem | Fix |
|---|---|
| Photobook full-cover merge/split in `setSettings` only ran on a settings **transition** (`!wasFullCover && willBeFullCover`). Switching **from an already-ON size into a size whose pages are still un-merged** left `!wasFullCover` false → **no merge ran**. Pages stayed un-merged while `showFullCoverSheet` stayed `true` → page 0 rendered only `layout[0]` (the back cover) with a blank right half. | Drive merge/split off the **data shape** vs the effective setting: **merge** when `effectiveFullCover && !alreadyMerged`, **split** when `!effectiveFullCover && alreadyMerged`. Idempotent and self-heals on every size load. |
| Reading an omitted `showFullCoverSheet` as `false` would **tear apart a merged cover on every unrelated settings edit** (many callers send partial payloads). | Compute the *effective* value: `effectiveFullCover = (dataObj.showFullCoverSheet ?? state.settings.showFullCoverSheet) === true` — omitted flag = "unchanged", never "off". |
| Two independent merge/split implementations (reducer over **live pages**, `SizeSettingsPopup` eager-prop over each saved size's `pages_c`) drifted out of sync; the popup's early-return path even flips the flag ON while leaving `pages_c` un-merged. | The reducer is the **single choke point** — every size-load path ends with `setSettings(theme.settings)`, so reconciliation happens automatically on load. The popup helpers stay as-is (already idempotent); any wrong merge-state they leave is corrected when that size loads. |

---

## How it works — at a glance 🎯

The cover spread is a single page-0 spread: **`layout[0]` = back cover (left half)**, **`layout[1]` = front cover (shifted +halfWidth into the right half)**. That orientation is correct and unchanged.

```
  ❌ BEFORE (transition-gated merge)        ✅ AFTER (data-shape reconcile)
  setSettings({showFullCoverSheet:true})    setSettings({showFullCoverSheet:true})
     merge only if !wasFullCover  ✗            merge if NOT already merged  ✓
     → switching ON-size → ON-size              → pages always match the setting
       skips the merge → pages un-merged          (self-heals drift on every load)
       → page 0 shows BACK only, no front
```

**Why the bug was intermittent:** every ON→ON path where the target's `pages_c` was *already* merged worked fine. The bug only appeared when **pages were un-merged while `showFullCoverSheet` was already `true`** — a state reachable by toggling/size-switching once the live pages and a saved size's stored `pages_c` had drifted apart.

---

## 1. The architecture (two independent merge/split sites)

Full Cover merges the photobook's separate **front cover (page 0)** and **back cover (last page)** into one spread on page 0. This logic exists in **two places that operate on independent data with independent idempotency guards**:

| Site | Operates on | Old guard |
|---|---|---|
| `setSettings` reducer — [canvas.js](../src/store/slices/canvas.js) | **live** `state.pages` | settings **transition** (`!wasFullCover && willBeFullCover`) **+** data shape (`alreadyMerged`) |
| `applySpineSettings` eager-prop — [SizeSettingsPopup.jsx](../src/components/popups/SizeSettingsPopup.jsx) | each saved size's `pages_c` in `allThemes` | data shape only (`mergePhotobookCover`/`splitPhotobookCover` early-return on `layout.length`) |

The size-load paths (`selectAndCloseSavedSize`, `addSize`) call `setEditorPages`/`applyTheme` (which do **no** photobook merge) and then `setSettings(theme.settings)`. So **all reconciliation must happen in `setSettings`** — it's the common tail of every load.

---

## 2. Root cause

Three sources can leave **un-merged pages + `showFullCoverSheet: true`**:

1. **Eager-prop early return** — [SizeSettingsPopup.jsx](../src/components/popups/SizeSettingsPopup.jsx): when a theme has no decodable pages (`!decoded.length || !fullWidth`) it returns `{ ...theme, settings: nextSettings }`, flipping `showFullCoverSheet: true` while leaving `pages_c` **un-merged**.
2. **Transition-gated reducer merge** — switching **from an already-ON size** (`wasFullCover = true`) into a size whose pages are un-merged makes the `!wasFullCover` term false → **the merge never runs**.
3. **DPI/size convert** (`confirmMultiConvertDpi`) — mints a new size with live-merged `pages_c` but copies `sourceTheme.settings`, which can disagree with the page shape.

In all three, page 0 has a single `layout[0]` (the back cover content) while the renderer believes full cover is on (`hideLastCover` hides the trailing back page). Result: **back cover on page one, front cover missing**.

---

## 3. The fix (single choke point)

In `setSettings` (photobook branch) — [canvas.js](../src/store/slices/canvas.js):

```js
// RESULTING (effective) full-cover state — NOT a transition flag. Omitted flag
// (partial settings edits) falls back to the existing setting = "unchanged".
const willBeFullCover =
  (dataObj.showFullCoverSheet ?? state.settings?.showFullCoverSheet) === true;
const alreadyMerged = (state.pages[0]?.layout?.length || 0) >= 2;

// ON: merge front + back into a spread on page 0 when the setting is ON but
// the pages aren't merged yet.
if (willBeFullCover && !alreadyMerged && state.pages.length >= 2) { /* merge */ }

// OFF: split the merged spread back into separate front/back pages when the
// setting is OFF but the pages are still merged.
if (!willBeFullCover && alreadyMerged && state.pages.length >= 2) { /* split */ }
```

What changed vs. before:
- Merge condition dropped the `!wasFullCover` transition term → now `willBeFullCover && !alreadyMerged`.
- Split condition dropped the `wasFullCover && dataObj.showFullCoverSheet === false` transition terms → now `!willBeFullCover && alreadyMerged`.
- `willBeFullCover` is the **effective** value via `??`, so partial payloads can't trigger a spurious split.

Kept intact: the `[backLayout, frontLayout]` orientation, the `halfWidth` shift, the `alreadyMerged` guard, the `hideLastCover` forced-exit (turning "Hide Back Cover" off while full cover is on still exits full cover → split), and the spine-width shift.

---

## 4. Why partial payloads are safe (the landmine that was avoided)

Many `setSettings` callers send **partial** payloads. The settings sidebar (`SettingAction`) dispatches `setSettings({ ...settings, [key]: value })`, which **spreads the current settings**, so `showFullCoverSheet` is present with its *current* value — exactly the effective value. Truly-omitted payloads fall back to `state.settings.showFullCoverSheet` via `??`.

If omission were read as `false`, a data-shape split would **rip apart an already-merged cover on every unrelated settings edit.** The `??` fallback is what makes the data-shape approach safe.

The only callers that set the flag to a dynamic boolean (`applySpineSettings`, `CreateThemeDialog` theme-save payload) always send an explicit `true`/`false`, where `false` unambiguously means "turn off."

---

## 5. Files changed

| File | Change |
|---|---|
| `src/store/slices/canvas.js` | `setSettings` photobook branch: merge/split now reconcile by **data shape** vs the **effective** `showFullCoverSheet` (omitted = unchanged). Updated two stale comments. |

No changes were needed in `SizeSettingsPopup.jsx` — its `mergePhotobookCover`/`splitPhotobookCover` helpers are already idempotent, and any merge-state they leave wrong is corrected when that size loads through `setSettings`.

---

## 6. Scope / what was NOT touched

- **Layflat** cover logic — untouched; it still gates merge/split on `coverEnabled`/`showFullCoverSheet` **transitions** (its cover model reconstructs the pages array differently).
- **Theme switching** (`ThemesAction` → `replaceSettings`) — a different flow that fully replaces pages; not part of the reported triggers (size-switch + size-popup toggle). `replaceSettings` does `state.settings = payload` with no merge/split.
- **`applyTheme` / `setEditorPages`** — deliberately left without reconcile; they run **before** `setSettings`, so they'd act on stale flags. Reconcile must stay in `setSettings`.

---

## 7. Gotchas (do not regress)

- **Effective value, not raw payload.** Always compute `willBeFullCover` as `(dataObj.showFullCoverSheet ?? state.settings.showFullCoverSheet) === true`. Reading a missing flag as `false` will split merged covers on unrelated edits.
- **Reconcile lives in `setSettings` only.** Don't move it into `applyTheme`/`setEditorPages` (they run first, before the flag is set).
- **Keep `[backLayout, frontLayout]` orientation.** `layout[0]` = back (left), `layout[1]` = front (shifted +halfWidth). Swapping it inverts the spread.
- **`alreadyMerged` keys on `state.pages[0].layout.length >= 2`.** Page 0 is the front cover, a single half-sheet when not full-cover; interior spread pages also have 2 layouts but are never page 0, so this check is specific to the cover.
- **`setSettings` is in `ignoredCanvasActions`** (not recorded in undo). The merge/split mutates `state.pages` as part of the present state — same as the pre-existing code — so no separate undo step is created. Don't move the merge out into a recorded action without rechecking undo.

---

## 8. Verification checklist

- Enable Full Cover → page 0 shows **back (left) + front (right)** every time.
- Toggle Full Cover OFF → front and back split back into separate pages, content intact.
- Enable Full Cover, then **switch between saved sizes** repeatedly → every size shows back-left + front-right (no "back only" page 0).
- **Toggle ON/OFF repeatedly** from the Size Settings popup → no drift, no corruption.
- Turning **"Hide Back Cover" off** while full cover is on exits full cover and restores the separate back cover page.
- An unrelated settings change (e.g. some other toggle) while full cover is on does **not** split the cover.
- Spine width still shifts the right-half (front) cover objects correctly when paper thickness changes.

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
- 🅿️ **Photobook Full Cover Sync (2026-06-19)** — _you are here_
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
