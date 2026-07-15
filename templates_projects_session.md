# Session Handoff — "Reuse Saved Designs as Templates" + Thumbnails + Save Timing

> Purpose: this session got very long. This is a **complete, self-contained handoff**
> so a fresh window can continue. It states the feature, everything already built and
> working, the **two still-broken things** (thumbnail is blank; text overflow), all
> diagnostic evidence gathered, the leading hypotheses, and concrete next steps.
> There is also a **debug-logging cleanup** list at the end.

---

## 1. What the user asked for (overall feature)

Let the user reuse their own **saved designs** as **templates/layouts**, all **local** (no API):

- In the editor **Themes** sidebar tab, add two sub-tabs: **Projects** (opens first) and **Themes**.
- **Projects** lists the user's saved designs ("Your Designs" library) and lets them **apply one as a layout** onto the current canvas.
- **No explicit "Save as Template"** — the auto-saved designs library IS the template source.
- Applying must **resize text/images to the current canvas** exactly like the **Manage-Size** convert flow.
- A saved design must appear in the list **only after close/Save** (not while mid-editing, no empty "junk" cards).
- Each saved design must have a **working thumbnail** (cover/first page) that shows the design.

---

## 2. What is DONE and working

### 2a. Themes tab → Projects | Themes sub-tabs
- `src/tools/themes/ThemesAction.jsx` — sub-tab switcher, **Projects default**. Themes body toggled with `display:none` (not unmounted) so infinite-scroll survives tab switches.
- `src/tools/themes/ProjectsList.jsx` (NEW) — lists `listSavedDesigns()` filtered to `activeEditorType`; apply-on-click with confirm; delete.

### 2b. Explicit "Save as Template" REMOVED
- Removed the header menu items, `saveAsLocalTemplate`, the separate "Templates" sidebar tab, `TemplatesAction.jsx`, `localTemplates.js`, `templateThumbnail.js`, and the `editorData:templates:*` IPC channels (reverted in `electron/shared/ipc.ts`, `electron/preload/index.ts`, `electron/main/ipc/editor-data.ipc.ts`, `electron/main/services/editor-data.service.ts`). Electron rebuilt.

### 2c. Apply = resize like Manage-Size  ✅ (mathematically correct)
- `src/library/utils/common-functions/scaleDesignPages.js` (NEW) — `scaleSourcePagesToTarget(pages, adjSrcW, srcH, adjTgtW, tgtH)`. Scales `obj.font.size` by `Math.min(scaleX,scaleY)` and images by `image.width/height/positionX/positionY`. This is the **exact** function `SizeSettingsPopup.jsx` uses (it now imports the shared one — line ~84 + call ~2676).
- `ProjectsList.applyDesign` uses it with source dims from `entry.canvasSize`, then `applyTheme` (+ `changeObjectsInAllPages({option:"option1"})` to carry current canvas photos into the new layout when present).
- ⚠️ **The remaining text overflow is NOT a scale-factor bug** — see §4b.

### 2d. Saved-designs library — content gate + timing
- `src/library/utils/helpers/savedDesigns.js` `_saveDesignToLibrary`: **content guard strengthened** — "content" now means a layout has real objects/safe-area objects/background (NOT just `layout.length>0`, which was true for an empty `layout:[{objects:[]}]` and wrongly saved blank cards). `allowEmpty` remains only for the EXPLICIT `saveCurrentEditorToLibrary` (Save button).
- New-design dialogs (`CreateNewDesignModal.jsx` blank flow, `CreateThemeDialog.jsx`) **no longer pass `allowEmpty`** → a brand-new blank design is not carded until it has content.
- Test `src/library/utils/helpers/__tests__/savedDesigns.test.js` — 9 pass (added one locking "layout present but no objects → not stored").

### 2e. Library commit timing  ✅
- `src/library/utils/custom-hooks/useEditorSnapshot.js` — the LIBRARY entry is committed **only on close/unmount (force) or explicit Save**, never on the periodic 15s tick. The periodic tick still writes the crash-resume snapshot.
- **Live update for already-saved designs**: `commitThumbnailIfExisting()` pushes a fresh thumbnail to the library as soon as it renders, but ONLY when `libraryEntryExistsRef` is true (design was opened from the library, detected via `getDesignById` after restore, or committed on close). Brand-new designs stay uncommitted until close.

### 2f. Duplicate cards  ✅ FIXED
- Root cause: the id system was half-refactored. Restore adopted the id into the **module** (`activeLocalDesignId` in savedDesigns.js via `adoptActiveLocalDesignId`), but the save read a **separate** `localDesignIdRef` in the hook → every reopen forked a fresh `local:<ts>` id → duplicate.
- Fix: `useEditorSnapshot.getLocalDesignId()` now delegates to `ensureActiveLocalDesignId()` (module). Abandon path uses `resetActiveLocalDesignId()`. Id now round-trips open→edit→close→reopen.
- (Existing on-disk duplicates must be deleted by the user; the fix only prevents new ones.)

### 2g. Delete-current-project  ✅
- `src/library/utils/helpers/designSession.js` (NEW) — session `markDesignAbandoned/isDesignAbandoned`.
- Deleting the open project → `ProjectsList` marks it abandoned → the auto-save mints a fresh local id and continues as a NEW design (deleted one never resurrected). `forceNewLocalRef` keeps it local-only afterwards.

### 2h. Negative-width `<rect>` render error  ✅ (defensive)
- `generatePageSvg.js renderTextObject` clamps `width/height` to `Math.abs(...)` (some saved text boxes have negative width, e.g. `-212.77`, which threw `<rect> attribute width: A negative value is not valid` and could break the offscreen render).

---

## 3. Thumbnail architecture (current, IMPORTANT)

- **Generator**: `src/library/utils/helpers/designThumbnail.js` → `generateDesignThumbnailAsync()`. It uses the **proven export pipeline** `renderSvgToBlobLocal()` (`src/library/utils/services/export/localExport.js`) which renders the page SVG in an **offscreen Electron window** (`electron/main/services/exporter.ts`, IPC `desktop.export.renderSvg`) and returns an **untainted JPEG blob** (screenshot-based, so cross-origin images don't taint). Then downscaled to `maxDim=420`, `quality=55`. Sync `generateDesignThumbnail()` (raw SVG data-URL) remains as a web/non-desktop fallback.
- **Page picked**: `firstContentPage()` — now skips pages with no VISIBLE content (`objHasVisible`: text-with-chars / sticker / shape / calendar / img-with-url / bg-image) and falls back to any page.
- **When it runs**: `useEditorSnapshot.refreshThumbnailCache()` runs **3s after load and every interval**, INDEPENDENT of the snapshot's "pages changed" early-return (that early-return was why it never ran on a merely-opened design). Result cached in `cachedThumbnailRef`, committed on close / live for existing designs.
- **The offscreen exporter force-decodes all `<img>`/SVG `<image>` before capture** (`exporter.ts:63-76`, `im.onload/onerror/decode` awaited). So it DOES wait for images.

---

## 4. STILL BROKEN

### 4a. Thumbnail renders BLANK  ← main open issue
**Evidence (latest run):**
```
[thumb] generateDesignThumbnailAsync CALLED {localExportEnabled: true, pages: 9, canvasSize: '5400x3600'}
[thumb] renderSvgToBlobLocal OK {blobSize: 1567, svgWidth: 2700, svgHeight: 3600}
[thumb-flow] cached thumbnail SET {len: 2115}
```
- The render **succeeds** but `blobSize ≈ 1567` = a nearly-blank JPEG.
- `svgWidth: 2700` = 5400/2 → it rendered a **half-width page (the cover)**, i.e. `firstContentPage` is STILL landing on a sparse/cover page for this design (or that design's only "content" page has broken images).

**Console also shows, for the loaded design:**
```
app-assets://project/default/<hash>.jpg   → 404 (Not Found)   ← the design's PHOTOS are missing on disk
https://storage.printpoz.com/themes/photobook/*.jpg → CORS blocked (imageCache.js fetch) ← sticker/theme images
<rect> attribute width: A negative value is not valid ("-212.77…")  ← negative-width text box (now clamped)
```

**Leading hypotheses (in priority order):**
1. **The design's images genuinely don't render** — photos are `app-assets://…404` (missing files) and stickers are remote. If the picked page is mostly photos+stickers and they fail, the offscreen capture is blank. NOTE: `<img>` loading is NOT blocked by CORS (only canvas readback is), so stickers *should* load in the offscreen window — VERIFY whether they actually do (the CORS errors in console are from `imageCache.js`'s `fetch()`, a *different* code path, not the offscreen `<img>`).
2. **`firstContentPage` still picks a sparse page.** `svgWidth 2700` (cover) suggests it did NOT skip the cover. Check what `objHasVisible` returns for this design's cover — maybe the cover has a sticker (counts as visible) but that sticker doesn't load → blank. Consider: pick the page with the **most** visible objects, or specifically prefer a page with **text**.
3. **Render size too small / half-spread only.** It renders one half (2700) not the full spread. For a photobook maybe it should render the **full spread** (both layouts) like `Footer`/`generateDesignThumbnail` do for spreads. Check `generatePageSvg` args (`allObjects` currently = one page's flattened objects; for a full spread you need both layouts + `layoutIndex`).
4. **Text not rendering in offscreen** (font not injected). `renderSvgToBlobLocal` builds `@font-face` from `result.fonts`; confirm the picked page's fonts are in that list.

**Fastest way to disambiguate:** open a design you KNOW has large visible **text** on page 0 (no photos), watch `blobSize`. If it's still ~1.5KB → the render/text path is broken (hypothesis 3/4). If it's large → the earlier designs were just broken-image data (hypothesis 1) and the feature is basically fine.

**Also worth trying:** temporarily save the thumbnail blob to disk (or `console.log` the data-URL and open it) to SEE what the render actually contains — that instantly distinguishes "blank" from "small-but-correct."

### 4b. Text overflow on apply / create-from-template
- `scaleSourcePagesToTarget` is correct (matches Manage-Size). The overflow is **design data**: some text boxes have **negative width** (`-212`) and the SVG `<text>` renderer (`editorVersion<2`) does **not** wrap/auto-fit like the on-canvas editor. `create-from-template` (`CreateNewDesignModal.handleCreateFromTemplate`) also does **not** rescale (keeps the template's own `canvasSize`), so any overflow there is the template's own data, not scaling.
- Options for next session: (a) normalize negative-width/height boxes on load/apply (x += width; width = |width|); (b) shrink-to-fit text for SVG `<text>` when content exceeds the box; (c) decide product-wise whether create-from-template should rescale to a chosen size.

---

## 5. Key files (map)

| File | Role |
|---|---|
| `src/tools/themes/ThemesAction.jsx` | Projects/Themes sub-tabs |
| `src/tools/themes/ProjectsList.jsx` | list + apply + delete saved designs |
| `src/library/utils/common-functions/scaleDesignPages.js` | shared resize (font `min`, image w/h/pos) |
| `src/components/popups/SizeSettingsPopup.jsx` | Manage-Size; imports the shared scaler |
| `src/library/utils/helpers/designThumbnail.js` | `generateDesignThumbnailAsync`, `firstContentPage`, `objHasVisible` |
| `src/library/utils/services/export/localExport.js` | `renderSvgToBlobLocal` (offscreen render → JPEG blob) |
| `electron/main/services/exporter.ts` | the offscreen render (`renderSvg`, force-decodes images) |
| `src/library/utils/common-functions/generatePageSvg.js` | data→SVG (text/photo/sticker); negative-width clamp in `renderTextObject` |
| `src/library/utils/custom-hooks/useEditorSnapshot.js` | snapshot + library commit timing + `refreshThumbnailCache` + id system + `commitThumbnailIfExisting` |
| `src/library/utils/helpers/savedDesigns.js` | id system (`ensure/adopt/reset/peekActiveLocalDesignId`, `deriveDesignId`), content gate, `saveDesignToLibrary` |
| `src/library/utils/helpers/designSession.js` | abandoned-design registry (delete-current) |
| `src/components/design-selection/CreateNewDesignModal.jsx` | New Design/Theme dialog (blank + create-from-template) |
| `src/components/popups/CreateThemeDialog.jsx` | offline create-theme fallback |

Verify commands: `BABEL_ENV=development npx eslint <file>` ; `CI=true npx react-scripts test src/library/utils/helpers/__tests__/savedDesigns.test.js --watchAll=false`.

Saved designs on disk (desktop): `%APPDATA%/printpoz-desktop-designer/editor/designs/` (`meta.json` = cards incl. `thumbnail`, `<id>.json` = payload with gzip+base64 `pages_c`). Handy inspection: decode `pages_c` with `pako.ungzip(Buffer.from(pages_c,'base64'),{to:'string'})`.

---

## 6. Debug logging to REMOVE once thumbnails work
All `console.warn("[thumb…")` / `console.warn("[thumb-flow…")` added for diagnosis:
- `src/library/utils/helpers/designThumbnail.js` — in `generateDesignThumbnailAsync` (CALLED / renderSvgToBlobLocal OK / NO BLOB / failed).
- `src/library/utils/custom-hooks/useEditorSnapshot.js` — `writeSnapshot ENTER`, `COMMIT library on close`, `refreshThumbnailCache → generating`, `cached thumbnail SET`.

---

## 7. Suggested next-session plan
1. **Prove what the render contains**: log/save the thumbnail data-URL for one design and open it. Blank vs small-but-correct decides everything.
2. If blank: test a **text-only page-0 design** → isolates render/text/font vs broken-image data.
3. Make `firstContentPage` prefer a page with the **most visible content** (esp. text), and consider rendering the **full spread** for photobooks (both layouts) rather than a half page.
4. Confirm remote stickers actually load in the offscreen window (they should — `<img>` isn't CORS-gated); if not, that's the offscreen-network/CSP issue to fix in `exporter.ts`.
5. Then tackle §4b text overflow (normalize negative boxes / shrink-to-fit).
6. Remove debug logging (§6).
