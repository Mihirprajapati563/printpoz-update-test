# Session: Cover/Spine settings, Size selection & Custom sizes

_2026-07-13 · dashboard "New Theme" / in-editor "Blank" dialogs + size helpers_

Scope: the two entry dialogs where a design is created —
`components/design-selection/CreateNewDesignModal.jsx` (dashboard "Create New
Theme / Create New Design / Create Blank Theme") and
`tools/themes/BlankThemeDialog.jsx` (in-editor Themes → Blank card) — plus the
shared size/orientation/custom-size helpers they lean on.

---

## 1. Cover & Spine settings in the create dialog

**New shared config:** `library/utils/jsons/coverSettingsConfig.js`

The cover-related admin settings (subset of `globalSettingJSON`) surfaced in the
create dialog so cover behaviour is set up front, not only from the admin
Settings panel.

- `COVER_TOGGLES[editorType]` — per-type toggle list:
  - **Photobook:** Full Cover Spread, Hide Back Cover, Export Spine
  - **Layflat:** Enable Cover Page, Full Cover Spread, Hide Back Cover, Export Spine
- `supportsCoverSettings`, `readCoverSettings`, `isCoverToggleVisible` (mirrors
  admin's `dependentSetting` gating).
- `reconcileCoverSettings(editorType, state, key, value)` — mirrors the
  `setSettings` reducer's interdependencies in the UI (staged local state doesn't
  auto-reconcile): full cover ⟹ hide back cover; un-hiding back cover exits full
  cover; disabling cover page (layflat) clears everything; spine export needs full
  cover. **There is no "hide both covers" toggle** — the only back-cover control
  the reducer knows is `hideLastCover`.

**Wired into `CreateNewDesignModal.jsx`** (photobook/layflat only): config-driven
toggle group + paper-thickness/auto-spine-width. Flags persisted into the saved
theme settings (admin API) and the local library snapshot (customer), and
dispatched live so the reducer builds the cover structure on load.

> Note: earlier this was also added to `CreateThemeDialog.jsx` / `SizeSettingsPopup.jsx`
> then **reverted** — the user only wanted it in the two create dialogs.

---

## 2. Per-page orientation fix (see also `docs/orientation-per-page-fix.md`)

**New helper:** `library/utils/helpers/orientation.js`

Spread products (photobook / layflat / foldable) store the **full spread width**,
so orientation must be judged per single page (`width / 2`) — a 1200×600 photobook
is two 600×600 (Square) pages, not "Landscape". This mirrors the rule the
`setCanvasSize` reducer already uses to store `state.orientation`.

- `getSizeOrientation(w, h, editorType, settings)` → "Landscape"|"Portrait"|"Square"
- `perPageWidth(w, editorType, settings)` — exported so visual thumbnails draw the
  single page (`ThemeSizeModal` tile rect).
- Internal: `isHalfWidthSpread` (photobook || layflat || `settings.isFoldable`).

**Applied everywhere size orientation is displayed:** `CreateNewDesignModal`,
`BlankThemeDialog`, `ThemeSizeModal` (via new `editorType` prop from
`DesignSelectionPage.jsx`), `SizeSettingsPopup` (saved-sizes "Type" column).
`CreateThemeDialog` already halved internally → left alone.

**Visual thumbnail fix:** `ThemeSizeModal` tile rectangle now uses
`proxyDims(perPageWidth(s.width, editorType), s.height)` so a 16.67×8.33 photobook
draws a **square** thumbnail matching its "Square" label.

---

## 3. Size selection in both dialogs

### BlankThemeDialog

- Added a **Predefined sizes** dropdown (same `recommendedSizes` list the New
  Theme dialog uses). Picking one fills Width/Height/DPI, halving width per page
  for photobook/foldable.
- Grouped **"Your saved sizes"** (custom) + **"Standard sizes"**.

### CreateNewDesignModal — always-visible size fields

- Replaced the hidden-behind-a-toggle custom-size form with **always-visible
  Width / Height / Unit / DPI** fields as the single source of truth for the size.
- Predefined dropdown + custom sizes just **fill** these fields.
- **Removed** the redundant "Create new custom size" form and the "Your previously
  used sizes" tiles (dead code + styled-components deleted) — they duplicated the
  always-visible fields / the dropdown's "Your saved sizes" group.

### Shared unit (cover/spine ↔ size)

Removed the separate `coverUnit` (its own `coverSpineUnit` localStorage key). The
cover/spine measurements now use the **same shared `unit`** as the size fields
(seeded from `getPreferredUnit()`, persisted via `setPreferredUnit()`). Switching
the unit converts width, height, **and** paper thickness together.

### Two-DPI fix

Removed the redundant **"Export DPI"** from the random-layout section. The single
**DPI** field in the size row now drives resolution, random generation, and
cover/spine conversion (no separate rescale step).

---

## 4. Custom sizes: saving, DPI, dedup

**Root cause of "custom sizes don't save":** creating a theme only saved the
*theme* — it never wrote the size to the durable custom-size store
(`getCustomSizes`), so the dropdowns had nothing to show.

Fixes:

- **Auto-save on create** (`CreateNewDesignModal.handleCreate` +
  `BlankThemeDialog.handleCreate`): on Create, `await initCustomSizes()` then
  `addCustomSize(...)` — unless the size matches a standard size or an existing
  saved one.
- **`initCustomSizes()` stale-resolve bug** (`library/utils/helpers/customSizes.js`):
  the desktop AppData read is memoized (`loadPromise`) and used to resolve with the
  **first-load snapshot**. A consumer doing `initCustomSizes().then(list => setState(list))`
  after a size was added got the stale (empty) list and **overwrote** its correct
  state — sizes showed in the Theme Size Picker but not the dropdowns. Now resolves
  with `getCustomSizes()` (the live mirror) while still deduping the round-trip.
- **DPI always persisted** (`buildEntry`): was `dpi: size.dpi ? … : undefined`, so a
  missing DPI read back as the generic 200 fallback (a 300-DPI size looked like
  200). Now `dpi: Math.max(1, Math.round(Number(size.dpi) || 200))`.
- **Custom sizes shown in the dropdowns** under "Your saved sizes" with a `●`
  marker + `· Custom` tag + `· N DPI`, so they're distinguishable and DPI is visible.
- **Pixel-only dedup on auto-save:** the same `5000×2500` must not appear twice
  just because the DPI differs. Auto-save dedups by **pixel dimensions only**
  (ignores DPI). Explicit "Add Size" / "Create custom size" keep their exact-size+DPI
  behaviour. (Existing duplicates aren't auto-merged — delete via the trash icon.)

---

## 5. Template → new project size conversion (OPEN — has a known bug)

`CreateNewDesignModal.handleCreateFromTemplate` used to hardcode
`canvasSize: entry.canvasSize` and never scaled pages, so picking a template + a
different size kept the template's size.

Fix in progress: when `selectedSize` is set, scale the template's pages to it with
`scaleSourcePagesToTarget` (the SAME scaler `SizeSettingsPopup` convert and
`ProjectsList.applyDesign` use — halving both widths for photobook), and set
`finalCanvasSize` / `finalOrientation`. No size chosen → keep the template's size.

Also fixed: template create used `{ allowEmpty: false }` — a template with only
image boxes has objects so that's fine, but confirmed it saves.

**Diagnostic logs removed.** The scaler math was re-audited and is **correct**:
`scaleSourcePagesToTarget` uses `scaleX = targetWidth / sourceWidth` where BOTH
are full-spread stored `canvasSize.width` values (the dialog's manual Width field
IS the stored spread width — see `handleCreate`, which sets
`canvasSize.width = displayWidth` and only halves the per-page `layout.width`).
The photobook `/2` on both source+target in `handleCreateFromTemplate` cancels in
the ratio, so it's a no-op. The scaler maps over pages/layouts structurally and
never drops objects.

**Likely intermittency cause = cross-type templates (see §7).** The template list
was UNFILTERED by editor type, so a calendar/canvas template could be selected
while browsing photobook; `handleCreateFromTemplate` then inherits that template's
own `editorType`, and its restore (`setSettings(template settings)`, e.g. layflat
`coverEnabled` reconstructs the pages array) behaves differently per template —
exactly a "sometimes converts, sometimes not" pattern. Fixed by §7. **Re-test #1
with only compatible templates before chasing further.** If it persists, the next
unexamined lever is the restore order in `useEditorSnapshot` (`setCanvasSize`
target → then `setSettings` template settings, which can reshape size/pages for
cover-enabled layflat).

---

## 7. Template list filtered by editor type (2026-07-14)

`CreateNewDesignModal.filteredProjects` used to filter saved-design "templates"
**only by search text** — every editor type showed in every category, so a
calendar template could be selected while browsing photobook and (via
`handleCreateFromTemplate` inheriting `entry.editorType`) silently create a
calendar design. The sibling `ProjectsList` reuse flow already gates by
`activeEditorType`; this dialog was the outlier.

Fix (product decision: **co-list spread types, keep each template's own type**):

- New `isTemplateCompatible(t)` helper — a template is shown when its `editorType`
  equals the current `selectedEditorType`, OR both are in the spread group
  `{photobook, layflat}` (reuses `isBlankGeneratorSupported`). Legacy entries with
  no stored `editorType` are kept (they fall back to the current category on
  create). Applied in `filteredProjects` (dep `selectedEditorType` added).
- **Create keeps the template's OWN type** (unchanged — `entry.editorType` at
  line ~651). A photobook template → photobook; a layflat template picked in the
  photobook category → layflat. NO cross-type page reshaping (layflat
  `coverEnabled` reconstructs the pages array + doubles canvas — reshaping a
  photobook into it would break structure).
- Deselect guard: switching Product Type clears an now-incompatible
  `selectedProject` so "Create from Template" can't fire on a hidden template.
- Empty-state message is type-aware ("No saved projects for this product type").

## 8. Size readout shown to customers (2026-07-14)

`TopActions.jsx` has a top-right editor-details readout (`displayEditorDetails`
box: `editorType - WxH`, `Size`, `Depth`, theme name, subtype). It was gated to
admin/employee/superuser (state defaulted `false`, an effect set it `true` only
for those roles). Product decision: show the **full box to ALL users** (customers
too). Fix = default `displayEditorDetails` to `true`; the admin effect is now a
redundant no-op. TopActions renders as the default toolbar slot in `layout/index.jsx`
for every user (when no object/floating toolbar is active), so this alone makes it
appear in the customer build. (This is the READOUT only — the Header "Manage Size"
resize popup stays admin-only; the "no in-editor resizing for customers" decision
in §6 is unchanged.)

## 9. Converted template shows the NEW size in the sidebar (2026-07-14)

`handleCreateFromTemplate` built `finalCanvasSize` by spreading the template's
`sourceCanvas`, which could carry a stale `sizeLabel` from the template's ORIGINAL
size — `displaySizeLabel` prefers `sizeLabel`, so the saved-design card / size
readout would show the template's old size after a convert. Fix: set
`sizeLabel: null` in the convert branch so the label falls back to the new
`W×H px`. (No-size-chosen branch is untouched — size unchanged, old label correct.)

## 10. Cover toggles reverted on customer create (2026-07-14)

**Bug:** cover/spine toggles (Full Cover Spread, Hide Back Cover, Export Spine)
picked in `CreateNewDesignModal` didn't stick for CUSTOMERS — "sometimes" =
worked for admins, not customers. Root cause: the customer `handleCreate` blank
path saved `designEntry.settings = { subtype: "" }`, **dropping `coverPayload`**.
The customer path navigates `restore=1`, and `useEditorSnapshot` re-applies the
staged entry's `settings` via `setSettings` — so the live `setSettings(coverPayload)`
dispatch at create time was overwritten by the flag-less snapshot on restore. The
admin path already saved `themePayload.settings = { subtype:"", ...coverPayload }`
(→ works), so it was customer-only.

**Fix (one line):** `settings: { subtype: "", ...coverPayload }` in the customer
`designEntry`. Verified against the `setSettings` reducer:
- Standalone **Hide Back Cover** survives: the reducer only INFERS
  `hideLastCover = showFullCoverSheet` when `hideLastCover === undefined`
  (canvas.js ~993). `coverPayload` sets every key explicitly, so an explicit
  `hideLastCover:true` with `showFullCoverSheet:false` is preserved.
- Photobook full cover is **flag-driven** for a blank design — page merge
  (canvas.js ~879) is idempotent/data-shape-gated and moot when the cover is
  empty; Canvas renders page 0 full-width off `settings.showFullCoverSheet`, which
  survives `applyTheme` (flags live in `settings`, not `pages`).

**Deferred (documented, NOT fixed — out of scope / high blast radius):**
1. **Layflat blank-create WITH `coverEnabled`** — layflat cover is page-array
   RECONSTRUCTION (unshift cover page), not just flags. The restore order in
   `useEditorSnapshot` (`setSettings`@127 BEFORE `applyTheme`@155) means the
   reconstruction is discarded by the later `applyTheme(snap.pages)` (un-reconstructed
   pages). Photobook is what the user hits; layflat blank+cover is imperfect.
2. **Restore ordering** (`setSettings` before `applyTheme`) is pre-existing and
   affects EVERY resume — do not refactor mid-task.
3. **`handleCreateFromTemplate` ignores dialog cover toggles** — it keeps the
   template's OWN `entry.settings` (its baked cover config). Merging dialog toggles
   onto a template's already-reconstructed cover pages is risky; left as-is
   pending a product decision.

## 11. Customer spine not showing + in-editor Cover/Spine control (2026-07-14)

**"Spine doesn't show on the customer side"** was the SAME dropped-`coverPayload`
bug as §10: the spine width = `ceil(billablePages/2) × settings.paperThickness`,
and `paperThickness` lived inside the `coverPayload` the customer create path was
dropping → `liveSpineWidth = 0` → no spine. §10's fix restores it. Verified the
spine RENDER path in `Canvas.jsx` has **no user-type gate** — given equal state,
customer spine == admin spine.

**"Customer can add the spine" (new control):** `Sidebar.jsx` (~123) ALWAYS removes
the "Setting" tab from the customer view, so customers had no in-editor way to
turn on full cover / set paper thickness. And `paperThickness` isn't even in
`globalSettingJSON` (admins set it only at creation / SizeSettingsPopup). New
component **`layout/CoverSpineControl.jsx`** — a focused, CUSTOMER-ONLY toolbar
control (rendered in `TopActions.jsx` next to `RulerControl`, gated
`userType === CUSTOMER`; self-gates to photobook/layflat via
`supportsCoverSettings`):
- Popover with the cover toggles from `COVER_TOGGLES[editorType]` (reuses
  `isCoverToggleVisible` / `readCoverSettings`) + a **Paper thickness (mm/sheet)**
  input shown when full cover is on.
- Each change dispatches `setSettings({ ...settings, [key]: value })` — IDENTICAL
  to admin `SettingAction.handleCheckboxChange`, so the `canvas.js` reducer
  reconciles cover flags + page structure the same way (no new reducer logic).
- Paper thickness stored in PX (same as the create dialog); edited in mm, converted
  at `canvasSize.dpi`. Local input string avoids decimal-typing round-trip mangling.
- NOT the whole admin Setting tab (that stays hidden) — just the cover/spine subset.
Build passes (`npm run build`, no errors).

## 12. Template pre-fill + settings redesign (2026-07-14)

**Auto-select the template's settings.** `handleSelectProject` was name-only, so
picking a template left the dialog's cover/spine toggles + size at their defaults —
they didn't reflect the template. Now, on select, it loads the full entry
(`getDesignById` — the list meta carries neither `settings` nor `canvasSize`) and
pre-fills: `setCoverSettings(readCoverSettings(entry.settings))`, paper thickness
(px→unit at the template DPI), and the size fields (`fillSizeFields` from
`entry.canvasSize`). Guards: `selectRequestRef` (a slow load for an earlier click
can't overwrite a later one) and `prefilledIdRef` (set only on a successful
pre-fill for THIS template).

**Apply the user's changes back.** `handleCreateFromTemplate` used
`settings: entry.settings` (template's own, dialog toggles ignored). Now it merges
the dialog cover payload (`showFullCoverSheet`/`hideLastCover`/`exportSpine`/
`coverEnabled`/`paperThickness`/`spineWidth`) ON TOP of `entry.settings` — but
**only when `prefilledIdRef === selectedProject.id`** (pre-fill loaded) and
`supportsCoverSettings(templateEditorType)`. Because the pre-fill seeds
`coverSettings` from the template, the merge is a no-op unless the user actually
changed a toggle — then their change wins, without a failed pre-fill clobbering the
template's config with default-off flags.

**Redesign (focused on the settings area — the part the user flagged).** The
cover/spine options and random-layout toggle were bare checkboxes with the
description hidden in a `title` tooltip. New styled components `SettingsCard` /
`ToggleRow` / `ToggleText` / `Switch` render each option as a professional
toggle-switch row with a visible title + description inside a grouped card. Wiring
unchanged (`handleCoverToggle` / `coverSettings` / `COVER_TOGGLES`); a visually-
hidden checkbox drives the `<Switch $on>`. Build passes. NOT a full dialog rewrite —
template browser / name / product-type / size grid kept as-is (offered to extend).

## 13. Template flow didn't save the typed custom size (2026-07-14)

**Bug:** typing a new size in the create dialog and creating **from a template**
didn't add it to "Your saved sizes". Only `handleCreate` (blank flow) had the
`initCustomSizes` + dedup + `addCustomSize` block; `handleCreateFromTemplate` never
called it, so a size typed there vanished (user's "Create from Template" screenshot
showed the new 5200×2700 not persisted).

**Fix:** extracted the auto-save into a shared `persistCustomSize({width,height,dpi,
safeMargin,bleedMargin})` helper (same PIXEL-only dedup vs standard + saved sizes,
`await initCustomSizes()` first so the write hits the loaded in-memory mirror and
the dropdown reflects it on next open). `handleCreate` now calls it; **added the
call to `handleCreateFromTemplate`** (saves `finalCanvasSize` — the size the design
was actually created at, whether the template's own or a typed override). No
behavior change for the blank flow (identical logic, now shared).

## 6. Investigations (no code change)

- **"Manage Size" is admin-only** — the in-editor `SizeSettingsPopup` button in
  `Header.jsx` is inside `{showAdminOptions && …}` (`isAdminOrEmployee && !c_id`).
  Customers can't resize an open design in the editor.
- **"Convert Size to New Size" does NOT create a variant per saved size** — the
  convert modal opens with nothing pre-selected; targets come from the
  `getProductSizes` API, not saved custom sizes.
- **Customer size flow decision:** keep size selection **only at creation**
  (customer "Create New Design" dialog), no in-editor resizing. The size fields and
  template convert in `CreateNewDesignModal` are **not** gated by `isCustomer`
  (only labels + the local-save branch differ), so customers already select/convert
  at creation. (Audit of the customer save branch was in progress.)

---

## Files touched

| File | Change |
|---|---|
| `library/utils/jsons/coverSettingsConfig.js` | **new** — cover toggle config + reconcile |
| `library/utils/helpers/orientation.js` | **new** — per-page orientation + `perPageWidth` |
| `library/utils/helpers/customSizes.js` | `initCustomSizes` fresh-resolve; `buildEntry` always-DPI |
| `components/design-selection/CreateNewDesignModal.jsx` | cover block, always-visible size fields, shared unit, remove Export DPI, custom-size auto-save + dedup + dropdown, template size conversion (+ diagnostic logs) |
| `tools/themes/BlankThemeDialog.jsx` | predefined + custom size dropdown, auto-save + pixel dedup, orientation |
| `components/design-selection/ThemeSizeModal.jsx` | `editorType` prop, per-page orientation + thumbnail |
| `layout/pages/DesignSelectionPage.jsx` | pass `editorType` to `ThemeSizeModal` |
| `components/popups/SizeSettingsPopup.jsx` | saved-sizes "Type" column uses per-page orientation |
| `docs/orientation-per-page-fix.md` | **new** — portable orientation-fix guide (for web) |

## Open items

1. **Template-convert blank pages** — diagnostic logs live; awaiting console output; remove logs after.
2. Existing duplicate custom sizes aren't auto-merged (delete manually).
