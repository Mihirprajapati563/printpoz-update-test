# Photo-Editors — Project Context for Claude Code

## Project Overview

**Photo-Editors** is a web-based photo editor built with React, supporting multiple product types (photobooks, calendars, canvas prints, acrylic prints, wall art, folding products). It features a drag-and-drop canvas, multi-page editing, 3D product previews, and AI-powered tools. Backend is hosted at `https://apis.printpoz.com/api/v1/`.

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18, React Bootstrap 2, Bootstrap 5, styled-components 6 |
| State Management | Redux Toolkit + react-redux + redux-undo (300-step undo) |
| Routing | react-router-dom v6 |
| 3D Rendering | Three.js + @react-three/fiber + @react-three/drei |
| Drag & Drop | react-moveable, react-dnd |
| Export | jspdf, jszip, file-saver, html-to-image, html2canvas |
| HTTP Client | Axios (centralized in `apiCall.js`) |
| AI | OpenAI SDK (text captions), custom AI endpoints (face-swap, BG removal) |
| Auth | Google OAuth (@react-oauth/google) |
| Real-time | socket.io-client |
| Build | Create React App (no eject) |

## Key File Locations

### Entry Points
- `src/index.jsx` — Redux Provider + BrowserRouter + context wrapping
- `src/App/app.jsx` — Routes: `/` (editor), `/upload/:projectId` (mobile), `/preview`
- `src/layout/index.jsx` — Main editor layout wrapper

### State (Redux Store)
- `src/store/store.jsx` — Store config with custom undoable canvas reducer
- `src/store/slices/canvas.js` — **Main slice (194KB)** — all canvas state: pages, objects, selections, zoom, undo/redo
- `src/store/slices/appAlice.js` — UI state: preview mode, toolbars, dialogs, magic-write mode
- `src/store/slices/imageUpload.js` — Image library and upload management
- `src/store/slices/projectSetup.js` — Project initialization data
- `src/store/slices/svgData.js` — Export-time SVG data
- `src/store/slices/brandDetails.js` — Brand configuration
- `src/store/slices/editorConfigurations.js` — Per-editor-type settings
- `src/store/slices/aiKidsPhotobookSlice.js` — AI face-swap state

### Canvas & Rendering
- `src/components/canvas/Canvas.jsx` — Central editor canvas (SVG-based)
- `src/components/canvas/Photo.jsx` — Image object renderer
- `src/components/canvas/Text.jsx` — Text object renderer
- `src/components/canvas/Shape.jsx` — Shape object renderer
- `src/components/canvas/Sticker.jsx` — Sticker/clipart renderer
- `src/components/canvas/ItemDragger.jsx` — Drag & drop handler (react-moveable)
- `src/components/canvas/SafeAreaDragger.jsx` — Print safe area manager
- `src/components/canvas/MaskImage.jsx` — Image masking
- `src/components/canvas/SVGClippper.jsx` — SVG clipping

### Layout / Header / Footer
- `src/layout/Header.jsx` — Top toolbar (~70KB, very feature-rich)
- `src/layout/Footer.jsx` — Bottom pagination and actions
- `src/layout/Sidebar.jsx` — Tool panel toggle
- `src/layout/TopActions.jsx` — Zoom, orientation controls
- `src/layout/BottomActions.jsx` — Bottom control bar

### Tools (Sidebar Panels & Floating Toolbars)
All panels live in `src/tools/`:
- `photos/` — Photo upload, library, auto-create (`AutoCreateV2PopUp.jsx`)
- `text/` — Text editor tools, floating toolbar & dialog panel, magic-write AI
- `image/` — Image floating toolbar & dialog panel
- `sticker/` — Sticker/clipart management + `StickerFloatingToolbar.jsx` & `StickerToolbarDialogPanel.jsx`
- `shape/` — Shape management + `ShapeFloatingToolbar.jsx` & `ShapeToolbarDialogPanel.jsx`
- `backgrounds/` — Background selection (patterns, colors, images)
- `layouts/` — Template layout selection
- `themes/` — Theme management (predefined + custom)
- `calendar/` — Calendar configuration
- `frames/`, `masks/` — Frame and mask selection
- `assets/` — Asset management with tags
- `object-settings/` — Per-object settings (image, text, shape, sticker, position) — also exports inline components (e.g., `SetBorderInline`, `AdjustmentsInline`, `EffectsInline`) reused by dialog panels

### Utility / Library
- `src/library/utils/constants/index.js` — Editor types, user types, all constants
- `src/library/utils/constants/apiurl.js` — 79 API endpoints
- `src/library/utils/common-services/apiCall.js` — Axios HTTP client (auto-injects auth headers)
- `src/library/utils/helpers/canvasSliceGetters.js` — Redux selectors
- `src/library/utils/helpers/alignmentUtils.js` — Alignment helpers
- `src/library/utils/helpers/gradientUtils.js` — Gradient helpers
- `src/library/utils/common-functions/` — calc, objectResize, unitConversion, fontLoader, fontParser, generatePageSvg
- `src/library/utils/custom-hooks/` — useInitializeProject, useExportPages, useThemeSetup, useExitPrompt
- `src/library/utils/jsons/defaultObjects.js` — Default templates for all object types
- `src/library/utils/jsons/commonJSON.js` — Font families and common data (128KB)
- `src/library/utils/context/FontContext.jsx` — Font management context

### 3D Product Previews
- `src/products-preview/photobook/photoBookPreview.jsx`
- `src/products-preview/calendar/Calendar3D.jsx`
- `src/products-preview/canvas-print/CanvasPrint3D.jsx`
- `src/products-preview/acrylic-print/AcrylicPrint3D.jsx`
- `src/products-preview/WallPreview.jsx`
- `src/products-preview/folding/`

### Common / Shared Components
- `src/common-components/StyledComponents.jsx` — Styled-components theme & global styles
- `src/common-components/ColorPickerModal.jsx`
- `src/common-components/ProgressModal.jsx`
- `src/common-components/SVGRenderer.jsx`
- `src/components/popups/` — Modal dialogs (font management, color picker, export options, multi-select toolbar)
- `src/components/popups/ColorPickerPortal.jsx` — Portal-based color picker; renders via `ReactDOM.createPortal` into `document.body` at `position: fixed`, centered horizontally within `.actions-wrapper` (the sidebar panel). Used by `CalendarAction.jsx` for all calendar color pickers to avoid sidebar overflow/clipping issues.
- `src/components/popups/ColorPickerWithOpacity.jsx` — The actual color picker UI (Solid + Gradient tabs, opacity, Apply button). Accepts `onClose` prop; Apply button calls `onClose`.
- `src/components/popups/SizeSettingsPopup.jsx` — Custom canvas size configuration. Uses dual-mode input handling: `px` mode stores raw string values directly; non-px mode (inches, cm, etc.) uses `localUnitValues` state to track raw input strings during typing, converting to pixels only on `onBlur`. This prevents decimal-point loss while typing (e.g., "3." → "3" issue) and allows setting values to 0 for margin fields via `pxValue >= 0` check for margins vs `pxValue > 0` for dimensions.
- `src/components/calendar/DynamicCalendar.jsx`, `MultipleDynamicCalendar.jsx`

### Export Pipeline
- `src/library/utils/services/export/` — SVG/PDF export service
- `src/library/utils/canvas/captureHelpers.js` — Page capture for export
- `src/library/utils/upload/uploadManager.js` — Upload orchestration (chunked multipart)
- `src/components/export/ExportPage.jsx`

## Architecture & Data Model

### Canvas Data Model
```
Store.canvas.present
├── pages[]
│   ├── layout[]  (1-2 sides: front/back)
│   │   ├── background { fill, image, gradient }
│   │   ├── safeArea { margins }
│   │   └── objects[]
│   │       ├── { id, type:"img", transform:{x,y,scale,rotation}, opacity, border, shadow, effects, masking, flip, zIndex }
│   │       ├── { id, type:"text", content, font, style, alignment, ... }
│   │       ├── { id, type:"shape", fill, gradient, ... }
│   │       ├── { id, type:"sticker", svgData, ... }
│   │       └── { id, type:"calendar", month, year, ... }
├── activePage, activeSide, activeObject
├── activeObjects[] (multi-select)
├── isMultiSelectMode
├── zoom
└── editorType
```

### Multi-Side Pages (Layflat / Photobook)
- Pages can have **two sides** (`layout[0]` = left, `layout[1]` = right); `activeSide` tracks which is active (0 or 1)
- `getCurrentActivePageObjects` — returns objects from the **active side only**
- `getAllObjectsOfAllLayoutsOfCurrentPage` — returns objects from **both sides** of the current page; use this whenever an operation should affect the full spread (e.g., searching for the first empty image box)
- `changeObjectInPage` already searches all layouts by object ID, so it correctly updates objects on the non-active side without extra handling

### Photos Gallery Sort (`PhotosAction.jsx`)
The sidebar gallery sort dropdown maps options by `SORT_CONFIG` (module scope) to backend `{ sortField, sortOrder }`: **Recently/Earliest added** → `_id` desc/asc (ObjectId is creation-monotonic = record/added order), **Latest/Earliest created** → `created_at` desc/asc, **File name (A–Z / Z–A)** → `file_name` asc/desc (the last two are commented out in the `<select>` pending backend-field confirmation). ⚠️ `created_at` and `file_name` are the assumed backend field names — if the API uses different names, change them in `SORT_CONFIG` (one place); both fetch sites and the legacy-`asc`/`desc` fallback go through `resolveSort()`. **Default is `added_asc` ("Earliest added", oldest first)** — `cachedSortOrder` via `readStoredSortOrder()`; the gallery reads top-to-bottom in upload order so freshly uploaded images land at the BOTTOM. The user's explicit pick is persisted in `localStorage` (`SORT_STORAGE_KEY`) and overrides the default on reload. `galleryImages` merges the pending tiles with the backend list in **two phases** (do NOT collapse this back to "pin all pending"). It branches on `stillActive` = any pending tile with `pendingStatus` `"queued"` or `"uploading"`:
- **While `stillActive` (mid-upload):** pin the WHOLE pending group at the most-recent end in **stable selection order** (`[...pending.reverse(), ...projectImages]` for `pinTop`/desc; appended for other sorts). Do NOT `_id`-sort here. `projectImages` is still the pre-batch list (the batch refetch fires only once everything is terminal), so pinning the batch on top is already correct, and it stays put. (Sorting completed tiles by `_id` mid-upload made a tile **jump out of its slot the instant it finished** — init/resize order ≠ selection order — which read as tiles shuffling during upload.)
- **Once settled (no active uploads left):** split the leftovers — **`completed`** (finished WITH a real `serverId`, `isPending:false`, real `_id`) are **sorted INTO the backend list by `_id`** (`byId` comparator; ObjectId hex string compare == Mongo `_id` order). **`pinned`** (failed / no-server-id, no `_id` to sort by) stay pinned. This is ONE resettle to the authoritative backend order at the end of the batch.

⚠️ **Why `completed` must be `_id`-sorted, not pinned (regression guard):** the page-1 refetch returns only the newest ~20 images. When a batch pushes the total over one page, completed uploads whose `_id` is OLDER than page-1's newest stay as bridge tiles. The OLD code pinned *all* pending to the top, so those older-but-finished uploads were shoved ABOVE the newer page-1 images — the gallery showed the wrong order until pagination absorbed them (user report: "recently uploaded images go to the bottom, scrolling brings them up; only smaller images glitch" — smaller images init/finish in the stranded older-`_id` slot). Both the mid-upload pin and the settled `_id`-sort are blink-free because `galleryKeyOf` gives a bridge tile and its eventual backend tile the SAME key, so React moves the node instead of remounting. **The backend order (sorted by `_id`) is authoritative and correct — the gallery must mirror it; do not re-introduce blanket top-pinning of completed tiles.**

### Auto-Fill Empty Image Box (`PhotosAction.jsx`)
- When a photo is clicked from the sidebar and nothing is selected, the editor auto-fills the first empty `type:"img"` box on the current page
- Uses `currentPageObjects` (from `getCurrentActivePageObjects` selector) to find empty boxes
- Priority order: (1) explicitly selected image box, (2) first empty box on current page, (3) add new image
- Searches across both sides of multi-side pages (spread/layflat)
- Empty box detection: `type:"img" && (url ?? "") === ""` (via `emptyBoxesCount` computed selector in `PhotosAction.jsx`)
- **AutoCreateV2PopUp**: Two-option modal for auto-design methods (option1: "Automated addition" — fill empty frames only; option2: "Re-create with all photos" — replace all photos with new layout). Warning system: when option1 is selected and available images < empty boxes, shows warning with two buttons ("Upload More Photos" or "Continue Anyway"). Fully responsive design using `clamp(minSize, vwPercent, maxSize)` for all fonts and images so content scales naturally from mobile to desktop; cards stack vertically on mobile (`col-12 col-sm-6`) and side-by-side on tablet+; footer buttons full-width on mobile, inline on larger screens.

### Undo/Redo
- Uses `redux-undo` with a custom filter — ignores spammy UI actions (zoom, dragger state, menu items)
- 300-step limit; preserves zoom + selection during time travel
- History stored in `Store.canvas.past` / `.future`
- **Image zoom via Ctrl+Wheel**: Takes a pre-zoom snapshot on first scroll of a session (`wheelSessionActiveRef`); all subsequent scrolls use `history: false`. Prevents Ctrl+Z from undoing to intermediate zoom values
- **Floating toolbar dispatches**: Must use `setCurrentObjectProperties` action; toolbar-initiated changes auto-record to undo stack if `history` param is not explicitly set to `false`

### API Layer
- All requests go through `src/library/utils/common-services/apiCall.js`
- Auto-injects: `Authorization: Bearer <token>`, `x-user-id`, `x-brand-id`
- Auto-adds `brand_id` to POST payloads
- Base URL: `https://apis.printpoz.com/api/v1/`

### Export Pipeline
1. `generatePageSvg` captures each page as SVG
2. `extractFontsFromSvg` collects embedded fonts
3. `uploadManager` does chunked multipart upload to backend
4. Backend generates JPG/PDF
5. `file-saver` downloads result

### Theme System
- Themes in Redux; predefined themes with multiple size variants
- Theme application patches all text font IDs across pages
- Custom theme creation from current pages

### Font System
- Custom fonts uploaded to backend
- Google Fonts fetched dynamically (`googleFontFetcher.js`)
- `FontContext` tracks availability; fonts preloaded on init

### Multi-Select
- `isMultiSelectMode` flag in canvas state
- `activeObjects[]` array for selected object IDs
- Falls back to single select for toolbar/property panels

### Floating Toolbars
- Context-aware per object type: `TextFloatingToolbar`, `ImageFloatingToolbar`, `StickerFloatingToolbar`, `ShapeFloatingToolbar`
- All floating toolbars rendered in `src/layout/index.jsx` toolbar slot (replaces `TopActions` when object selected)
- Separate dialog panels for advanced settings (position, borders, shadows, adjustments, colors)
- Dialog state stored in `appSlice`: `textToolbarDialog`, `imageToolbarDialog`, `stickerToolbarDialog`, `shapeToolbarDialog`
- Dialog panels (TextToolbarDialogPanel, ImageToolbarDialogPanel, StickerToolbarDialogPanel, ShapeToolbarDialogPanel) render via React portal and are draggable/resizable
- Toolbars use `setCurrentObjectProperties` action for changes; dialog panels manage their own state and position memory per dialog type

## Editor Types
Defined in `src/library/utils/constants/index.js`. Different editor types (photobook, calendar, canvas-print, etc.) control which tools are available, which product preview is shown, and which API endpoints are used.

## Scripts
```bash
npm start       # Dev server
npm run build   # Production build (sets CI=false)
npm test        # Jest tests
```

## Calendar System

### Calendar Components
- `DynamicCalendar` — single-month calendar grid (used by `type: "calendar"` objects)
- `MultipleDynamicCalendar` — same as DynamicCalendar but used for `type: "multiple-calendar"` objects (multiple months per page). Both have **identical SVG class structure**.
- Both support **multi-column weeks layout** via `weeksColumns` setting (1, 2, 3, or 4 columns)

### Multi-Column Weeks Layout
The calendar grid can be split into multiple columns, with each column containing a subset of weeks (row-major ordering). Controlled via:
- Redux state: `calendarSettings.weeksColumns` (1-4, default 1)
- Sidebar UI: "Week Columns" dropdown in `CalendarAction.jsx`
- Applied per-object via `calendarSettings.weeksColumns` on each calendar object

**Geometry calculation:**
- `effectiveColumns = Math.min(weeksColumns, totalWeeks || 1)` — prevents empty columns if fewer weeks than requested
- `maxRows = Math.ceil(totalWeeks / effectiveColumns)` — distribute weeks across columns with balanced rows
- `cellWidth = width / (7 * effectiveColumns)` — fits all columns + days into canvas object width
- `cellHeight = height / (maxRows + 1)` — fits rows + header into canvas object height
- `colStride = 7 * cellWidth + 6 * cellMargin` — horizontal spacing between column groups
- **Row-major ordering**: Week N goes to `col = N % effectiveColumns`, `row = floor(N / effectiveColumns)`. This ensures left-to-right week sequence (1→2→3 on row 0, then 4→5→6 on row 1), avoiding column-major jumps like 1→2→3→11.

### Calendar CSS Class Structure (both DynamicCalendar and MultipleDynamicCalendar)
```
<svg class="cal cal{n} cal-grid">          ← n = 1-based position among calendars on this page (calIndex prop)
  <g class="cal-header">                   ← one per day-of-week column, repeated per week column
    <rect class="cal-header" />
    <text class="cal-header__label" />
  </g>
  <g class="cal-cell-{row}-{col}">         ← one per day cell (0-indexed week/day)
    <rect class="cal-cell-bg" />
    <text class="cal-cell-number" />
  </g>
</svg>
```

### Month/Year Text Boxes
- `type: "text"`, `subtype: "month"` or `"year"` — added via "Add Month Box" / "Add Year Box" in CalendarAction
- Class structure inside SVG foreignObject:
  ```
  <g class="fade-animate">
    <foreignObject class="cal-month">     ← or cal-year
      <div>                               ← no class
        <div class="cal-month-text" contenteditable>  ← or cal-year-text
  ```
- **Dynamic sizing**: Month/year boxes auto-scale based on canvas width: `dynamicFontSize = Math.round(16 * (canvasSize.width / 500))`, then `width = dynamicFontSize * 4.5` (month) or `3` (year), `height = dynamicFontSize * 1.2`. Ensures text fits exactly in box without overflow.
- Month offset per text box: `pageIndex = currentActivePageNumber * subtypeCount + subtypePosition`
  - `subtypeCount` = total text boxes of same subtype on the page
  - `subtypePosition` = 0-based index of this box among same-subtype boxes
- Formula in `canvas/Text.jsx` and `layout/preview/Text.jsx`: `getMonthYear(startMonth, startYear, pageIndex)`

### Calendar Month Sequencing Across Multiple Pages
When a page has multiple calendars (e.g., 2 on page 1, 3 on page 2), the month sequence must continue across pages, not restart per page.
- **Issue**: Old formula `pageIndex * calendarCount + (calIndex - 1)` assumed equal calendars per page, causing page 2 calendars to skip months (e.g., April→May→June instead of March→April→May).
- **Fix**: `DynamicCalendar` now accepts optional `calendarMonthOffset` prop that overrides the formula when provided. `Canvas.jsx` computes: `prevCalCount` = total calendars on all previous pages, then `calendarMonthOffset = prevCalCount + calendarIndexOnThisPage`, ensuring continuous monthly progression.
- Applied to both main canvas (`Canvas.jsx`) and footer previews (`src/layout/Footer.jsx`).

### Sidebar Layout Classes
- `.sidebar-wrapper` — outer sidebar container
- `.actions-wrapper` — the active tool panel (e.g. Calendar settings panel); has `slide-in`/`slide-out` animation classes

## Image Upload System

> Full deep-dive (worker protocol, failure handling, concurrency model, June 2026 rework changelog): `docs/upload-pipeline.md`

### Architecture Overview
The image upload system uses a **pre-registration + bounded concurrency** pattern with **CPU work and network work bounded separately**:
1. **Pre-Registration**: All selected images dispatch to Redux immediately with `status: "queued"` so UI displays full list instantly
2. **Bounded Concurrency Workers**: `MAX_CONCURRENT_UPLOADS` workers (see current value in `imageUploadThunks.js`) process the queue, requesting signed URLs just-in-time before each upload
3. **Just-In-Time URL Fetching**: Each worker fetches fresh signed URLs immediately before uploading, keeping URLs fresh (1-hour validity)
4. **Off-Main-Thread Resize Pool** (`resizePool.js`): decode + variant encode runs in a bounded pool of Web Workers (`POOL_SIZE`, hardware-dependent cap) regardless of upload concurrency — many simultaneous 20-30MB decodes (~200MB transient RAM each) froze even strong machines. Falls back to main-thread (concurrency 1) when workers/OffscreenCanvas are unavailable (e.g., Safari < 16.4)

### Upload Flow
```
User selects N images
    ↓
dispatchUploadsWithConcurrency(dispatch, uploadItems)
    ├─ [Sync] Pre-register all images: dispatch(startUpload(..., status:"queued"))
    ├─ [Sync] For EVERY image: startEagerResize() → resizeImageInPool
    │         (SINGLE decode, ≤POOL_SIZE concurrent, DECOUPLED from upload
    │          concurrency; emits the preview early via onThumb → setPreviewUrl
    │          and returns the cached variants as a promise)
    ├─ [Async] Launch MAX_CONCURRENT_UPLOADS concurrent workers
    │   Each worker:
    │   ├─ Shift item from queue
    │   ├─ dispatch(uploadImage(item))   ← item carries resizePromise
    │   │   ├─ await resizePromise → preResized variants (NO second decode)
    │   │   ├─ Request fresh signed URLs
    │   │   ├─ Upload chunks with throttled progress dispatches
    │   │   └─ dispatch(uploadSuccess(...))  ← Store image URL + variants
    │   └─ Repeat until queue empty
    └─ Return Promise.all() of all workers
```

> **Single-decode eager resize (decoupled from uploads).** Previews used to be a
> by-product of the full resize inside `uploadImage`, which only ran once an
> upload worker (capped at `MAX_CONCURRENT_UPLOADS`) picked the image up — so
> selecting >10 images left images 11+ with NO thumbnail until an earlier upload
> fully finished. Now `dispatchUploadsWithConcurrency` calls `startEagerResize()`
> for every image at registration: it runs the FULL resize through the pool
> (still bounded by `POOL_SIZE` concurrent decodes), emits the preview from that
> SAME decode (`onThumb` → `setPreviewUrl`), and hands the resulting variants to
> the upload via `preResized` so each image is **decoded EXACTLY ONCE**. The
> upload worker `await`s `item.resizePromise` instead of re-resizing.
> Why single-decode (not a separate cheap thumbnail pass): a `createImageBitmap`
> resize-on-decode shortcut mishandled EXIF (portrait→landscape) and produced
> broken blobs, and a correct full second decode doubled CPU (upload-time lag).
> Trade-off (chosen by the user): a resized image's variants are held in RAM from
> resize-completion until its upload finishes — bounded by upload throughput, but
> a very large batch of EXIF-rotated photos (re-encoded `large`) can hold a few
> hundred MB transiently. Direct/retry paths have no eager resize → `uploadImage`
> resizes itself and emits the preview via `onThumbnail`.

### Key Components

**`src/store/background-services/imageUploadThunks.js`:**
- `dispatchUploadsWithConcurrency(dispatch, uploadItems)` — Pre-registers all images, spawns MAX_CONCURRENT_UPLOADS workers, returns completion promise
- `uploadImage` thunk — Handles single image: resize → signed URLs → chunk upload → progress/success/failure dispatches
- `MAX_CONCURRENT_UPLOADS` — Network-side worker count. CPU-side resize is bounded independently by `resizePool`'s `POOL_SIZE`, so raising this no longer multiplies decode/encode load
- **Progress throttling**: `onProgress` dispatches only when the integer percent changes AND ≥150ms (`PROGRESS_DISPATCH_MIN_INTERVAL_MS`) elapsed (terminal 100% always passes); `onStatusChange` deduped by message. Raw chunk progress events arrive far too often (per-chunk XHR events × parallel chunks × parallel images flooded Redux with hundreds of dispatches/sec and froze the UI)

**`src/library/utils/upload/` (resize pipeline):**
- `imageResizer.js` — Core resize: EXIF orientation handling, large/medium/small variants + optional ≤512px thumbnail (`opts.thumbMaxDim`, early `opts.onThumb` callback). **Skips the full-resolution large re-encode when EXIF orientation = 1 and type is JPEG/PNG** — original bytes are already pixel-correct, uploading them avoids seconds of encode CPU per image and a lossy re-encode generation (better for print). Orientation 2-8 still re-encodes (server reads pixel dims from the blob). Runs in both window and Worker contexts. The preview thumbnail comes from this same decode+orientation+`drawToBlob` path (via `onThumb`), so it is dimension/orientation-identical to the upload — do NOT reintroduce a separate resize-on-decode thumbnail shortcut (it mishandled EXIF and produced broken/rotated previews)
- `resize.worker.js` — Worker wrapper around `resizeImage` (bundled by CRA5/webpack5 via `new Worker(new URL(...))`)
- `resizePool.js` — `resizeImageInPool(file, opts)`: queue + bounded worker pool (`POOL_SIZE`); re-queues in-flight jobs if workers turn out unsupported; main-thread fallback with concurrency 1. **Both `POOL_SIZE` and `MAX_CONCURRENT_UPLOADS` are hand-tuned by the user — read current values before reasoning about them**
- `uploadManager.js` — Orchestrates resize (via pool) → init → chunked S3 upload → finalize, with legacy `apiMultiPartPost` fallback. Accepts an optional **`preResized`** result (from the eager single decode) — when present it SKIPS its own resize entirely (no second decode); otherwise it resizes and emits the preview via `onThumbnail`. **Network parallelism is governed by a global FIFO connection semaphore** (`MAX_GLOBAL_CONCURRENT_CHUNKS`, default 6 = browser per-host cap) shared across ALL in-flight images, plus a per-image chunk cap (`MAX_CONCURRENT_CHUNKS`, default 2). Why: the browser only allows ~6 connections per host; uncoordinated per-image concurrency oversubscribed that and let later images stall. With the semaphore, `globalCap / perImage` images stream at once (6/2 ≈ 3) and the rest rotate in fairly — **lower `MAX_CONCURRENT_CHUNKS` to 1 for ≈6 images uploading simultaneously, raise it for faster single-image uploads.** The permit is acquired per-attempt and released in a `finally` (no leak across retries/backoff; backoff sleeps hold no connection)

**`src/store/slices/imageUpload.js`:**
- `startUpload` — Registers image with `status: "queued" | "uploading"` and optional `batchId`; `previewUrl` starts `null` (NO `URL.createObjectURL(file)` — decoding 30 full-res originals for 72px thumbnails froze the queue UI). Also copies `fileName`/`fileSize` to primitives so the UI can still show them after `file` is released on success
- `setPreviewUrl(imageId, url)` — Stores the worker-generated ≤512px thumbnail object URL (from the eager pass); revokes the previous/orphaned URL
- `releasePreviewUrl(imageId)` — Revokes + nulls a preview blob once it has no consumer left. Dispatched from `PhotosAction.jsx` at the **provably-dead** point (the image's `serverId` has entered `projectImageServerIds` — backend refetch superseded the tile), NOT at the swap (that path is blink-sensitive). Prevents preview blobs accumulating for the whole session
- `updateUploadProgress(imageId, progress)` — Updates progress 0-100
- `uploadSuccess(imageId, imageUrl, urls)` — Marks complete, stores primary URL + all size variants; no-ops if image was removed mid-upload. **Releases the original `File` (`image.file = null`)** — nothing reads it after success (retry only runs on failure, which keeps `file`); for big in-memory blobs (e.g. downloaded Google Photos) this is the bulk of the per-image memory
- `uploadFailure(imageId, error)` — Marks failed with error message
- `updateUploadStatus(imageId, statusText)` — Custom status text ("Preparing image…", etc.)
- `removeImage` / `clearQueue` / `clearCompleted` — also revoke preview object URLs; `clearCompleted` removes ONLY `status === "uploaded"` images (queued/uploading must survive — upload workers keep running regardless of Redux, wiping them orphans live uploads; failed stay for Retry)

**`src/tools/photos/UploadedQueue.jsx`:**
- Displays all images with **Status column**: `Queued` / `Uploading…` / `✓ Done` / `✗ Failed` (color-coded)
- Progress bars: Full-width striped for queued/uploading, full solid green for done, red for failed
- Rows rendered via memoized `QueueRow` (`React.memo`) — a progress update re-renders only the affected row, not all 30+
- Gray placeholder icon shown until the worker thumbnail arrives (`previewUrl === null`)
- **"Clear Completed" button** (not "Clear All") — dispatches `clearCompleted`; disabled while nothing is uploaded yet
- **Display order = upload order (first-selected at top), NOT reversed.** The slice stores images in selection order and never reorders them; the queue renders `images` directly so the display stays stable and matches the backend order (first uploaded = first). Do not reverse/sort it (an earlier "newest at top" reversal was reverted — it contradicted the server order the user relies on)
- Safe access: `image.file?.name || ""` for file metadata

**`src/components/popups/UploadProgressToast.jsx`:**
- Fixed-position draggable toast showing `X/Y completed` + data transferred (+ red `N failed` line when applicable)
- `useActiveUploadStats` uses **session-stable totals**: a ref-tracked Set of imageIds; once an image joins the session it stays in total/bytesTotal until the whole run ends (failed images and completed batches INCLUDED — dropping them made totals shrink and completed-count reset mid-run). Session resets when new uploads start after full idle
- Visibility driven by `hasActive` (any queued/uploading image), not totals — final numbers stay visible during fade-out
- Draggable: position stored in localStorage

### Upload Entry Points
All dispatch via `dispatchUploadsWithConcurrency`:
- `src/tools/photos/ImportPhotoFromDevice.jsx` — Drag-drop and file picker
- `src/tools/photos/AddPhotosFirstTime.jsx` — First-time project photos
- `src/tools/photos/ImportPhoto.jsx` — Google Photos (downloads first, then uploads concurrently)
- `src/layout/pages/MobileUpload.jsx` — Mobile app flow
- `src/tools/photos/UploadedQueue.jsx` — Retry mechanism for failed images
- `src/components/canvas/Canvas.jsx` — single-image paste (`uploadImageFile`) and drag-drop (call `uploadImageOptimized` directly, not the queue)

### Per-Image Size Limit (30 MB)
Client-side guard mirroring the backend's 30 MB cap (avoids wasting a resize + upload on a file the server would reject). Helpers in `src/library/utils/common-functions/index.js`: `MAX_IMAGE_UPLOAD_BYTES` / `MAX_IMAGE_UPLOAD_MB` (30), `filterOversizedImages(files)` → `{ valid, oversized }`, `buildOversizedAlert(oversized)`. Behavior: **skip oversized, upload the rest**, then a **`react-toastify` `toast.warning`** listing skipped (NOT `alert()` — the user asked for toasts). Applied at ALL upload entry points above — bulk paths filter before the count-limit check; Google Photos checks each blob post-download; Canvas paste/drag reject the single oversized file. **Note:** `MobileUpload.jsx` is a standalone route outside the editor layout, so it imports its own `ToastContainer` + `react-toastify` CSS. (`AddMyPhotos.jsx` adds already-uploaded server photos by ID — no file upload, no size check.)

### Redux State Shape
```js
state.imageUpload = {
  batch: [],  // IDs of completed batches
  images: [
    {
      imageId: uuid,
      file: File,
      batchId: string,
      previewUrl: blob URL of ≤256px worker thumbnail (null until generated),
      uploadProgress: 0-100,
      status: "queued" | "uploading" | "uploaded" | "failed",
      uploadUrl: string,  // Primary (large) image URL
      uploadUrls: [{ size, url, w, h }],  // All size variants
      statusText: string,  // Custom status message
      error: string  // Error message if failed
    }
  ],
  imageUploaded: boolean,
  totalUploadedImages: number,
  limitReached: boolean
}
```

### Authentication & Headers
- `src/library/utils/common-services/apiCall.js` includes `apiMultiPartPost` and `apiMultiPartPatch`
- Both auto-inject: `Authorization: Bearer <token>`, `x-user-id`, `x-brand-id`
- Used as fallback when optimized signed-URL upload fails

### Optimistic Image Placement (place photos while they upload)
> Full design + as-built notes: `optimistic_image_placement_plan.md` (root)

- Selecting photos **closes the dialog immediately**; in-flight images appear in the sidebar gallery as pending tiles (`PhotosAction.jsx` — synthesized items shaped like server items: `_id: "pending_<imageId>"`, `urls` small/large = thumb blob, `isPending`, `pendingStatus`). **Order is newest-first** (the just-selected photos at the TOP, matching the backend's newest-first order). Only the **still-`inFlight`** tiles are `.reverse()`-pinned to the top; **completed bridge tiles are sorted into the backend list by `_id`** (see "Photos Gallery Sort" above for the split and the regression it fixed) — this gallery only, NOT the `UploadedQueue` tab. **As of 2026-06-18 the upload UX is silent + blink-free — see `optimistic_image_placement_plan.md` §10c for the full as-built.** Key points superseding older notes here: (1) a finished upload is **kept visible** with its permanent server URLs (`entry.uploadUrls`) until the batch refetch's `projectImageServerIds` contains its `serverId`, then dropped — this **vanish-gap bridge** replaces the old "finished image briefly absent" trade-off; (2) the grid is a single **JS absolute-positioned masonry** (`MasonryGrid`), stable on both prepend and pagination; (3) the upload→backend handoff keeps the **same React key** (`MasonryGrid` `keyOf` → `galleryKeyOf` maps `serverId`→`pending_<imageId>`) so no remount/flash. The batch-refetch effect doesn't `setProjectImages([])` first, so the list never blinks empty
- Placing a pending image writes a normal `type:"img"` object whose `url` is the **local thumbnail blob** plus a **`pendingImageId`** marker; `image_id` is null until swap. Works for manual click, auto-fill, and Auto-Create (failed uploads excluded from auto flows). Placement calls `prioritizeUpload(imageId)` (queue jump). Drag of pending tiles is disabled (v1)
- **Silent swap**: when the upload finishes, the thunk dispatches `replaceImageSourceAcrossPages({pendingImageId, url, urls, serverId})` — `canvas.js` patches every matching object in `objects` AND `safeAreaObjects` across all pages/layouts (helper `patchPendingImageObjects`, pure/structural-sharing). The action is in `ignoredCanvasActions`, and `store.jsx`'s undo wrapper **also patches past/future snapshots AND `_latestUnfiltered`** so Ctrl+Z can never resurrect a blob: URL. ⚠️ `_latestUnfiltered` is essential: redux-undo (default `syncFilter:false`) leaves it = the pre-swap blob after a filtered action, and its `insert` later pushes that stale snapshot into `past` — undoing to it showed the blurry preview then re-swapped. Do NOT drop that patch. Placement reducers explicitly set/clear `pendingImageId` (the `...currentObj` spread would otherwise leak stale markers). **Perf**: `patchPendingImageObjects` is allocation-free on no-match (scans first, clones via slice/spread ONLY the lists that actually contain the `pendingImageId`), and `store.jsx` memoizes the patch per-dispatch by `pages` array identity — so a batch of N finishing uploads no longer does O(N × 300 snapshots × all objects) throwaway-array work (that was the bulk-completion freeze)
- **Preview quality / appearance**: canvas/sidebar preview uses a **512px** thumbnail emitted by the **eager single resize** (`startEagerResize` → `resizeImageInPool` `onThumb`, `PREVIEW_THUMB_MAX_DIM` in `imageUploadThunks.js`). Previews now appear for ALL selected images regardless of upload concurrency (was: stalled after the first ~10 until uploads finished). Queued images without a thumbnail yet appear as non-placeable **skeleton-shimmer** tiles (`noThumb` flag → `SkeletonTile`) so no selected photo is ever missing from the grid. Uploading tiles carry **no text badge** (only `⚠ Failed` shows); there is no fade-in (it flickered). The shared upload queue respawns workers in `finally` to avoid stranding a batch enqueued during the worker-exit race
- **Gates** (`Header.jsx` + `usePendingPlacedImages` hook): `saveProject`, `orderProject`, `handleExportOptions`, `handleCustomerPdfExport`, `saveAsTheme`, `updateThemeWithSvg` all self-gate via `getPendingPlacedImageCounts(store.getState())`. Pending → "Finishing X uploads…" modal that auto-proceeds; failed → resolve prompt (Retry failed / Cancel). The 30s customer auto-save **silently skips** while placements are pending. A `blob:` URL must NEVER reach saved JSON / theme JSON / exported SVG
- Failed placed uploads: object keeps its thumb + ⚠ "Upload failed" badge (`Photo.jsx` overlay, narrow per-object selector); Retry from queue/sidebar; `useExitPrompt` enabled in `layout/index.jsx` while placements are pending
- Queue ✕ uses `removeImageSafe` (thunk) — keeps the blob URL alive if the image is placed on canvas; `setPreviewUrl` also stores natural (EXIF-corrected) `width`/`height` from the eager thumbnail pass (`generateThumbnailFast` returns them; placement fit math needs them)

## Canvas Rulers (top/left scale)

Pro-album-style measurement rulers that **hug the top and left edges of the canvas** (spanning the canvas extent, just outside the artwork). An **on/off toggle lives in the top toolbar** (TopActions); **unit + "start from" origin options live in a dialog that opens from the ruler's top-left corner box** — like a pro editor. NOT in the Settings tab.

- **State lives in `appSlice`** (`showRuler` + `rulerUnit` + `rulerOrigin`), persisted to `localStorage` (`editorShowRuler` / `editorRulerUnit` / `editorRulerOrigin`), NOT in `canvas.present.settings` (which is serialized into saved project/theme JSON via `Header.jsx getDataToSave` — a view-only pref there would leak into every saved document; same rationale as `layoutMode`). Actions: `setShowRuler`, `setRulerUnit`, `setRulerOrigin` in `appAlice.js`. `rulerUnit` is the ruler's OWN unit, independent of the print `getPreferredUnit()` pref. `rulerOrigin` ∈ `center` (default, = spine) / `start` (top-left corner) / `end` (bottom-right) — where `0` sits; numbers count outward from it. **One shared control, but the LEFT (vertical) ruler ignores `center`** (there's no vertical spine) — `center` behaves like `start` (0 at top) for the left band; only `end` flips it to the bottom. So the X origin uses center/start/end and the Y origin is `origin === "end" ? bottom : top`. Do NOT split this into two controls (the user wants one input).
- **Toggle UI**: `src/layout/RulerControl.jsx` — an `IconButton` (toolbar's `.active` convention: light-blue tint + primary icon) rendered inside an `ActionWrapperBox` in `TopActions.jsx`, so it matches the other toolbar buttons. On/off only.
- **Ruler component**: `src/components/canvas/CanvasRulers.jsx` — rendered in `Canvas.jsx`'s outer `.CanvasWrapper` (the canvas viewport, `position:relative`), self-gated by `showRuler` (renders null + wires no observers when off). It is a **fixed overlay at the VIEWPORT level (NOT inside `.canvas-box`/`.WrapperDiv`)** — so it is not affected by the canvas zoom and, crucially, not clipped by `.WrapperDiv { overflow:hidden }` (the bug that made the earlier in-canvas overlay invisible). The bands hug the canvas edges and measure the canvas's **live on-screen rect** via `getBoundingClientRect` on the `#canvasWrapper` `<svg>` (+ `svg.viewBox.baseVal` for canvas-units), so they stay aligned as it zooms/pans.
- **Re-measure triggers** (rAF-throttled `measure()`): a `ResizeObserver` on the `#canvasWrapper` svg (catches zoom/fit + the `.containerWrapperD svg { transition }` animation frames) and on the root; a `scroll` listener on `.pages-outer`; `window resize`; plus effect deps `pageIndex/zoomRatio/canvasScale/canvasSize` (pageIndex re-acquires the remounted svg). Tick geometry is `useMemo`'d on `[geom, unit, origin, dpi]`.
- **Corner dialog**: clicking the corner box toggles a small options popover (`.canvas-ruler-menu`) with a Unit segmented control (px/in/cm/mm), a "Start from" segmented control (Center/Start/End), and a "Hide ruler" button. Closes on outside-click / Escape. Because it renders at viewport scale (not inside the zoom), it's a normal-sized UI.
- **Always-visible clamp (critical fix)**: each band spans the canvas extent and hugs its edge (top band at `geom.top − THICK`, left band at `geom.left − THICK`), BUT its **thickness-axis position is clamped to `[0, rootDim − THICK]`** (`clampPos`). For normal albums this is a no-op (ruler sits at the canvas edge as before); when the canvas is **larger than the viewport** (e.g. 9600×4800 at 100%) the canvas edge scrolls off-screen and the band would go to a negative position and get clipped by the root's `overflow:hidden` → the "ruler goes away / left gone / top gone / both half" bug. Clamping makes the band **stick at the viewport edge** instead, staying fully visible; the along-axis position/extent still follow the canvas so ticks stay aligned (overflow past the viewport is clipped, showing the correct visible slice). Do NOT remove the clamp, and do NOT switch the bands to a fixed full-viewport position (the user explicitly wants them at the canvas edges).
- **Reserved gutter via ALWAYS-ON CANVAS SHRINK (no overlap, no off-screen, no blink)**: a wrapper div **`.ruler-reserve-wrap`** (inside `.canvas-box`, wrapping ALL visual canvas elements — the `.WrapperDiv` page AND the blank-facing-page `.WrapperDivLine`s) gets `transform: scale(RULER_RESERVE_SCALE)` + `transformOrigin: center` (`0.95`, module const in `Canvas.jsx`) **unconditionally — NOT gated on `showRuler`**. Renders the (centered) canvas ~5% smaller at all times → permanent gutter on all four sides for the bands; applied always so toggling the ruler **never resizes the canvas → no blink/jump**. ⚠️ FOUR hard-won constraints, do not change lightly:
  1. **Must be `transform: scale`, NOT folded into `zoom`** (canvas-box also has `zoom: canvasScale`). CSS `zoom` is mapped differently by **Firefox** in `getBoundingClientRect`, so a fractional `zoom` offset react-moveable's selection (object jumped top-right, blank left/bottom). `transform` is walked by Moveable's matrix math + reflected in `getBoundingClientRect` identically everywhere.
  2. **Must be on the `.ruler-reserve-wrap` wrapper, NOT `.canvas-box`.** `ItemDragger`/Moveable and `SafeAreaDragger` are **siblings of the wrapper inside `.canvas-box`** (kept OUTSIDE it): their selection lines render unscaled (transform-on-canvas-box dropped the right edge line in Firefox) and undo re-measure (`updateRect` on `getActiveCanvasObjProps` change) tracks the object normally. Moveable still detects the transform on its *target*, so the box stays aligned. (A `rootContainer={.pages-outer}` workaround for canvas-box placement fixed the line but BROKE undo-tracking — reverted.)
  3. **Must wrap ALL visual pages together** (not scale `.WrapperDiv` alone): photobook page-1/last-1 spreads render a blank facing `.WrapperDivLine` beside the canvas — scaling only `.WrapperDiv` shrank the canvas but not the blank page (size mismatch). The wrapper scales them as one unit. The `theme-box-shadow` (non-photobook products) lives on the wrapper too, so it hugs the smaller canvas (no gap).
  4. **Reserve by SHRINKING, not padding `.pages-outer`** — padding-top/left *shifts* the centered canvas down-right and pushes right/bottom off-screen (user report); a centered shrink can't go off-screen.
  cm/in marks stay correct (CanvasRulers measures `getBoundingClientRect ÷ viewBox`). `0.95` tuned for desktop.
- **Chicken-and-egg guard**: the component must early-return ONLY on `!showRuler`, never on `!geom` — the root `<div ref={rootRef}>` has to mount so `measure()` can read `rootRef.current`; gating the whole render on `geom` leaves the root unmounted and `geom` null forever (invisible). Bands render inside `{geom && (…)}`.
- **Guarantees**: `pointerEvents:none` on the root (corner button + dialog opt back in with `pointerEvents:auto`), `className="not-exportable"`, adaptive tick density (nice-step ladder keeps labelled ticks ≥56px apart → bounded nodes), 3-level tick hierarchy (major/mid/minor). `dpi = canvasSize.dpi || 200`.

## Floating Toolbars & Sidebar Behavior

### Toolbar State Management
- Text & image objects: sidebar tab does NOT auto-switch when canvas object is selected (intentional UX)
- Other object types (shapes, stickers, etc.): tab-switching on selection should be disabled (similar to text/image pattern)
- Floating toolbars use `setCurrentObjectProperties` to dispatch changes; use explicit `history: true/false` only when special handling is needed

### Floating Toolbar Patterns
**File Locations:**
- Text: `src/tools/text/TextFloatingToolbar.jsx` + `TextToolbarDialogPanel.jsx`
- Image: `src/tools/image/ImageFloatingToolbar.jsx` + `ImageToolbarDialogPanel.jsx`
- Sticker: `src/tools/sticker/StickerFloatingToolbar.jsx` + `StickerToolbarDialogPanel.jsx`
- Shape: `src/tools/shape/ShapeFloatingToolbar.jsx` + `ShapeToolbarDialogPanel.jsx`

**Sticker Toolbar Features:**
- Flip H/V, Position, Border, Shadow, Adjustments (opacity/brightness/contrast/saturation)
- Edit (opens sidebar), Layer controls (backward/forward/lock), Remove
- Multi-select toggle on mobile

**Shape Toolbar Features:**
- Fill color swatch (solid + gradient support via ColorPickerWithOpacity)
- Position, Border, Shadow
- Edit (opens sidebar), Layer controls (backward/forward/lock), Remove
- Multi-select toggle on mobile
- Uses `generateGradientCss` to display gradient preview on color swatch
- Gradient history tracking via selectors

**Toolbar Rendering Logic:**
1. Toolbar rendered in layout slot based on `activeObjectProps.type` (text/img/sticker/shape)
2. Toolbar shows quick-access buttons; clicking opens dialog via `setStickerToolbarDialog` / `setShapeToolbarDialog`
3. Dialog panel reads from Redux state, remembers position per dialog type, renders via portal
4. Closing dialog dispatches `null` to Redux, hiding the panel
5. Dialog uses `data-no-drag="true"` on interactive elements to prevent drag-to-move on form controls

## Theme Import & Spread Layout Model

### How Photobook/Layflat Spreads Work in Canvas Rendering
- **Single SVG rendering**: The canvas (`Canvas.jsx:2646`) renders `allObjects` — a flat, sorted array combining objects from ALL layouts — in a single full-spread SVG (viewBox width = `variantWidth`, e.g., 2400px for a 2400x1200 theme)
- **No per-layout offset**: Objects are positioned at their raw `transform.x` values with NO offset applied per layout. This means:
  - Left layout objects: x = 0 to 1199 (left half)
  - Right layout objects: x = 1200 to 2399 (right half)
  - Both appear correctly in the 2400px SVG without adjustment
- **Layout split purpose**: Splitting into `layout[0]` (left) and `layout[1]` (right) exists for **editing control** only — determines which side is "active" via `activeSide`. It does NOT affect visual positioning
- **Spread dimension model**:
  - `layoutWidth` = `variantWidth` (full spread, e.g., 2400px) for BOTH photobook and layflat
  - `scalePages` uses `targetWidth` (full spread width), not half-width
  - Import objects must keep their original x-coordinates in spread-space; do NOT adjust x when splitting to layout[0]/layout[1]

### Theme JSON Import (`ImportJsonToSvgDialog.jsx`)
- Parses theme variants from `items.theme[*]` with `pages` as a JSON string
- `normalizeImportedPagesToCanvas` splits objects at `splitX = variantWidth / 2` into layout[0] (left) and layout[1] (right)
- **Critical**: Right-side objects are NOT adjusted by subtracting `splitX` — they keep their original x (e.g., x=1450 stays x=1450, not x=250)
- `scalePages` is called with `targetWidth` to scale imported pages to match the editor's current canvas size

## Form & Input Handling Patterns

### Unit-Aware Number Inputs (SizeSettingsPopup pattern)
For inputs that support multiple units (px, inches, cm, etc.):
1. **px mode**: Store raw string value directly in state (no conversion), allows decimals naturally
2. **Non-px mode**: Use separate local string state (`localUnitValues`) to track raw input during typing; only convert to px on `onBlur`
3. **Sync on external changes**: When unit selector changes or external data loads, sync derived values via `useEffect`
4. **Allow zero for margins, not for dimensions**: Use conditional logic — `isMargin ? pxValue >= 0 : pxValue > 0` — when validating blur input
5. **Benefits**: Users can type decimals freely (e.g., "3.5 inches") without intermediate conversion stripping the decimal point; allows setting 0 for safe/bleed margins

## Responsive Design Patterns

### Fluid Typography with clamp()
Use CSS `clamp(minSize, vwPercent, maxSize)` for responsive sizing:
- **Font sizes**: `font-size: "clamp(12px, 2vw, 15px)"` scales 12px on small screens → 15px on large, intermediate scaling with viewport
- **Images**: `maxWidth: "clamp(220px, 40%, 340px)"` prevents tiny images on mobile, full-sized on desktop
- **Spacing**: `padding: "clamp(12px, 3vw, 28px)"` tight on mobile, roomy on desktop
- **Benefit**: Single responsive CSS value replaces multiple media query breakpoints

### Responsive Grid Layout
- Use Bootstrap's flexible grid: `col-12 col-sm-6` for full-width mobile, side-by-side on tablet+
- Flex direction toggle: `flex-column flex-sm-row` for stacked buttons on mobile, inline on desktop
- Row gutters: `g-3` (Bootstrap utility) for consistent spacing at all breakpoints

## Background System

### Background State
Each page layout side has its own `background` object: `{ color, image, gradient, flip, bg_id, _t }`. Only one of `color`, `image`, or `gradient` is active at a time — applying one clears the others.

### Apply Scope: Page vs Spread
The background panel (`src/tools/backgrounds/BackgroundsAction.jsx`) has a **Page / Spread** toggle (visible only on multi-side pages like photobook/layflat):
- **Page** (default): applies background to the active side only — uses `setBackgroundColor`, `setGradientBackground`, `setFlipBackground`, `setBackgroundImage`
- **Spread**: applies background to **all layouts** of the current page simultaneously — uses `setBackgroundColorSpread`, `setGradientBackgroundSpread`, `setFlipBackgroundSpread`, `setBackgroundImageSpread`

The toggle visibility is driven by `getIsSpreadPage` selector (returns `true` when the current page has more than one non-null layout). `BackgroundSlider` receives `applyMode` as a prop and selects the correct action.

### Spread Image Rendering (continuous background)
When a background image is applied in Spread mode, `background.isSpread = true` is stored on both layouts. The canvas (`Canvas.jsx`) detects this flag and renders a **single SVG pattern** with `patternUnits="userSpaceOnUse"` spanning the full spread width (`canvasSize.width`). Both the left rect and right rect reference this same pattern — since they occupy different x positions within the same SVG coordinate space, each naturally shows its own slice of the image, creating one seamless continuous background across the spread.

For colors and gradients in spread mode, `isSpread` is not set (both sides independently render the same solid/gradient, which looks identical and continuous by nature).

### Background Redux Actions
- Single-side: `setBackgroundColor`, `setGradientBackground`, `setFlipBackground`, `setBackgroundImage` — operate on `layout[activeSide]`, clear `isSpread` on that side
- Spread: `setBackgroundColorSpread`, `setGradientBackgroundSpread`, `setFlipBackgroundSpread`, `setBackgroundImageSpread` — iterate over all layouts; image spread sets `isSpread: true` on all layouts

## Calendar Settings Persistence
- `calendarSettings` stored in Redux at `state.canvas.present.calendarSettings`
- Includes: `startMonth`, `startYear`, `addCover`, `weeksColumns`, `cellMargin`, language, colors, borders, etc.
- Persisted in theme JSON as `cal_settings` (saved at theme save time via `Header.jsx`'s `getDataToSave`)
- Per-object overrides: each calendar object can have its own `calendarSettings` that override global defaults
- When loading a theme: `Header.jsx` reads fresh Redux state via `store.getState()` to ensure latest `weeksColumns` value is included in payload
- Backward compat: if old saved data lacks `weeksColumns`, Redux initial state provides default `weeksColumns: 1`

## Photobook Full Cover Feature

### Overview
Photobooks support a **Show Full Cover Spread** setting (`showFullCoverSheet`) that makes the front cover (page 0) render at full spread width instead of the default half-width single page. Enabling it automatically hides the back cover (`hideLastCover: true`).

### Settings (commonJSON.js)
- `showFullCoverSheet` — visible for `EDITOR_TYPES.PHOTOBOOK`; enabling it auto-sets `hideLastCover: true` via the `setSettings` reducer
- `hideLastCover` — has `dependentSetting: "showFullCoverSheet"`, so it only appears in the UI when full cover is on

### Redux Logic (canvas.js `setSettings` reducer)
When `showFullCoverSheet === true` for PHOTOBOOK → auto-sets `hideLastCover: true`.
When `showFullCoverSheet === false` for PHOTOBOOK → auto-sets `hideLastCover: false`.
No page array reconstruction needed (unlike layflat's `coverEnabled`); the existing cover page (page 0) is simply rendered differently.

### Canvas Rendering (Canvas.jsx)
Two `useEffect` hooks set the `isCover` local state — **both** must be updated or one will override the other when the user selects an object:
- **First useEffect** (deps: `[dispatch, activeObject, ...]`) — keyboard/delete handler; also sets `isCover`
- **Second useEffect** (deps: `[currentActivePageNumber, settings, ...]`) — main `isCover` update

For both: `isPhotobookFullCover = activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet`. When true, page 0 is NOT treated as a cover (`isCover = false`).

Four render functions also use `isPhotobookFullCover`:
- `getPageWidth()` — excludes page 0 from `isSpecialPage` when full cover on → returns `canvasSize.width` instead of `canvasSize.width / 2`
- `calculateSvgDimensions()` — same exclusion → `viewBoxWidth = canvasSize.width`
- `shouldShowCenterWrapperLine()` — includes page 0 when full cover → center spine line shows on cover
- `getCanvasWidth()` — **no change needed**; always returns `canvasSize.width / 2` for photobook (background rects together span full viewBoxWidth)

### Footer Thumbnail (Footer.jsx `calculateSvgDimensions`)
Same `isPhotobookFullCover` guard: excludes page 0 from `isSpecialPage` so the cover thumbnail renders at full spread width.

### 3D Preview (photoBookPreivewPages.jsx + photoBookPreview.jsx)
**`photoBookPreivewPages.jsx`** — SVG rendering changes for page 0:
- Imports `getSettings`, derives `isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet`
- `calculateSvgDimensions()`: excludes page 0 from `isSinglePage` → full-width SVG viewBox
- Outer div class: stays `"page front-cover hard"` regardless (turn.js needs this for correct book structure)
- `WrapperDiv` class: shows `WrapperDivLine` (center spine divider) for page 0 when full cover
- `clipPath` rect: uses full `canvasSize.width` for page 0 when full cover

**`photoBookPreview.jsx`** — turn.js initialization changes:
- Adds `showFullCoverRef` (same stale-closure-safe ref pattern as `hideLastCoverRef`) tracking `settings?.showFullCoverSheet`
- Initial flipbook position: skips the `leftspace += leftspace * 0.5` half-cover offset when full cover is on → book starts centered as a spread
- `options.when.turning` page === 1 handler: same — no half-cover offset when full cover
- After `.page svg` jQuery CSS rule: explicitly overrides with `$(".flipbook-viewport .front-cover svg").css({ width: bookwidth })` when full cover (jQuery's `.page svg` rule sets all page SVGs to `bookwidth/2`, this restores the cover to full-width)

### Key Difference vs Layflat Full Cover
Layflat `showFullCoverSheet` **reconstructs the pages array** (removes old cover pages, inserts a new `isCoverPage: true` page at index 0 with empty layout, doubles canvas width via `canvasSize.width * 2`). Photobook full cover **only changes rendering** of the existing page 0 — no page array changes, no canvas size changes. Objects designed at half-width coordinates appear on the left half of the full-width spread; users extend the design rightward.

## Reuse Saved Designs as Layouts (Themes tab → "Projects" sub-tab)

There is **no explicit "save as template"** flow. Instead the user's own **saved designs** (the `savedDesigns.js` "Your Designs" library — auto-saved on every edit, AppData on desktop / IndexedDB on web) are reusable as layouts directly.

- **UI**: `tools/themes/ThemesAction.jsx` renders a two-tab switcher — **"Projects"** (default, opens first) and **"Themes"**. Projects → `tools/themes/ProjectsList.jsx`; Themes → the existing catalog grid. The Themes body is toggled with `display:none` (NOT unmounted) so its infinite-scroll observers/refs survive tab switches. There is no separate Templates sidebar tab and no `desktopOnly` MenuJSON flag.
- **`ProjectsList.jsx`** lists `listSavedDesigns()` cards filtered to the current `activeEditorType` (a calendar design can't apply onto a photobook). Delete removes via `removeSavedDesign`.
- **Apply** (fully local, does NOT route through `setEditorPages`/`useThemeSetup` — that pipeline is gated on `cartDetails`, only carries images on a *theme_id switch*, and re-fetches masks):
  1. `getDesignById(id)` → `processProjectPages(pages_c → current canvas size)` → `scaleFontsToCanvas` (font sizes scale by `max(widthScale,heightScale)` per layout from the ORIGINAL pre-scale dims — `scaleLayout` scales the wrong prop `obj.text.fontSize`; the real size is `obj.font.size`, so without this text is invisible/oversized when the saved size ≠ current canvas).
  2. `collectPlacedImages(currentCanvasPages)` (from `blankImages.js`).
  3. If the current canvas HAS placed images → `applyTheme(blankImageUrls(finalPages))` then `changeObjectsInAllPages({ images, option:"option1" })` transplants them into the new layout's empty boxes (same fit path PhotosAction uses). If NONE → `applyTheme(finalPages)` keeps the design's own photos.
  4. `replaceSettings` (preserving the `PRESERVED_SETTINGS_KEYS` permission flags) + `setCalendarSettings` + `deSelectSafeArea` + `setPageNumber(0)` + `clearHistory` + `recordThemeBaseline`. Deferred 600ms so a canvas-size change commits first.

## Blank Theme — random-layout generator (Themes tab → first "Blank" card)

**Photobook / Layflat only.** The Themes catalog grid prepends a dashed **"＋ Blank"** card (gated on `activeEditorType === PHOTOBOOK || LAYFLATALBUM` in `ThemesAction.jsx`). Clicking opens `tools/themes/BlankThemeDialog.jsx`, which asks for **project name, page size (unit-aware, defaults to current), page/spread count, and an images-per-page RANGE (min–max)**, then builds a fresh blank design where **every page is filled with a random layout** whose image-count falls in the range. Image boxes stay **empty** (blank = user fills later). The page/spread count is the **TOTAL** including covers, and **covers get random layouts too** (product decisions).

- **Do NOT hand-roll layout→canvas scaling.** The generator reuses the exact proven path: fetch the layouts catalog (`ENDPOINTS.getLayouts`, offline-first `withAssetCache`, `number_of_layouts` 1=page / 2=spread), `decompressFromBase64` + `scaleLayout(l, canvasWidth/splitby, height)` to the target size (same as `LayoutsAction.scaleLayouts`), then per page `dispatch(setEntireSpreadLayout(...))` (2-up spread pages) or `dispatch(setPageLayout(...))` (single pages). Those reducers own the scaling/bleed math; because the catalog is pre-scaled, their internal `scaleFactor` collapses to identity.
- **`splitby` / half-vs-full width MUST match `LayoutsAction`:** `usesHalfWidthLayout = PHOTOBOOK || settings.isFoldable` → `splitby=2`, size field is per-single-page (spread = 2× wide), `fullWidth = pageW*2`. **Layflat (non-foldable)** → `splitby=1`, size field is the full page width, single full-width page layouts everywhere (its `setPageLayout` divides by full `canvasSize.width`, not `/2`). Getting this wrong halves/doubles every layout.
- **Spread-vs-single per index** uses the same predicate as `LayoutsAction` (`isSpreadIndex`): photobook interior = indices ≠ {0, 1, len-2, len-1} (plus index 0 when `showFullCoverSheet`); layflat non-foldable = always single. Random count fallback to nearest available count mirrors the Shuffle fallback.
- **Sequencing:** build N blank pages (`{ id, title, bgColor:"#fff", layout:[], settings:{isHalfSheet:false} }`; the apply reducers create the layout sides from the empty array) → `setCanvasSize(newSize)` → **defer 600ms** (same as `setupTheme`: Canvas.jsx's 500ms canvasSize effect recomputes zoom first; note `updateCanvasSize` only dispatches `setZoom`, it does NOT rescale objects) → `applyTheme(blankPages)` → per-page navigate + apply random layout → `setThemeName` + `setPageNumber(0)` + `clearHistory` + `recordThemeBaseline`. Layouts are deep-cloned on pick (same catalog entry may be used for several pages; apply reducers mutate the payload).
- **v1 limitation:** layflat with `showFullCoverSheet` active (doubled canvas / reconstructed cover pages) is NOT specially handled — only `isCoverPage` on the ends when `coverEnabled`.

## Auto Layout — regenerate the OPEN design (Layout tab → "Auto Layout" card)

**Photobook / Layflat only** (`isBlankGeneratorSupported(editorType)`). Distinct from the "Blank Theme" generator above (which builds a *fresh* book) — this re-rolls the layouts of the **currently open** design, keeping covers untouched. Full port/design notes: `docs/auto-layout-generator-2026-07-10.md`. Lives entirely in the **Layout sidebar tab** (`tools/layouts/LayoutsAction.jsx` "Auto Layout" card): **Generate Layout** (opens `tools/layouts/AutoLayoutDialog.jsx`) + **Shuffle All** (one-click, `ConfirmationDialog`-gated). (The doc's admin `CreateThemeDialog` integration was intentionally NOT ported — new-design setup lives in `CreateNewDesignModal`/`DesignSelectionPage` in this app.)

- **Engine:** `regenerateOpenDesignLayouts(dispatch, { mode:"keep"|"empty", minImages, maxImages, preserveImageCount })` in `blankThemeGenerator.js` (the existing `generateRandomLayoutPages` signature was left untouched — its two callers still use it). Reuses the SAME `pickLayout`/`fetchLayoutPool`/no-repeat/nearest-count machinery. **Keep** = reflow each interior page's photos into a new layout (skips 0-photo pages); **Empty** = `applyTheme` blanks interior pages (covers cloned exactly) then apply → empty boxes. **Shuffle All** = keep + `preserveImageCount:true` (each page re-rolled to its CURRENT photo count 1:1, never drops a photo). Restores the user's active page at the end (not page 0).
- **Single-undo (revert the whole re-roll with one Ctrl+Z):** both buttons call `regenerateOpenDesignLayoutsAsSingleUndo(dispatch, opts)`, NOT the raw engine. The raw engine's per-page `setPageLayout`/`setEntireSpreadLayout` dispatches each record an undo step (messy N-step undo); the wrapper snapshots the redux-undo canvas stack BEFORE generating (an immutable object — the in-between dispatches build new state, never mutate it), runs the generation, then `dispatch({type:"canvas/restoreHistory", payload})` to install a rebuilt stack `[...priorPast, preGenPresent]` with the generated present on top. Result: ONE Ctrl+Z (or the Header undo button) reverts the entire generation; prior history is preserved. Do NOT go back to `clearHistory()` (that made it non-revertable — the user's complaint).
- **Cover/interior predicate:** `isCoverIndex` excludes layflat `isCoverPage===true` + photobook index 0 / last. `pageUsesSpread` mirrors `LayoutsAction`'s live spread-eligibility (photobook interior ≠ {0,1,len-2,len-1} +fullCover page 0; foldable = `!isHalfSheet`; layflat = single).
- **MUST read each page fresh from `store.getState().canvas.present.pages[i]` per loop iteration** — a component's `useSelector` values (e.g. `currentActivePageObjects`) do NOT refresh inside a synchronous dispatch loop, so looping over the per-page `shuffleLayout` would count every page as the originally-active one. The engine reads the store directly; do NOT reroute Shuffle All through `shuffleLayout`.
- **String-coordinate fix (do NOT regress):** `setCanvasSize`, `setPageLayout`, `setEntireSpreadLayout` now `Number(...)` the bleed/safe margin before `transform.x/y = x*scale + bleed`. A string margin (even `"0"`, truthy so `|| 0` won't catch it) makes coords strings → marquee (drag-select) filters do string arithmetic → `NaN` → nothing selects until reload. Shuffle All applies layouts to every page, so it amplified this; the source coercion is the fix.

## Notes for Development
- `canvas.js` slice is very large (194KB) — use `canvasSliceGetters.js` selectors, don't add direct state access
- `store.jsx` disables BOTH RTK dev middlewares (`serializableCheck` AND `immutableCheck`) — immutableCheck deep-scanned the entire store (incl. 300 undo snapshots) on every dispatch and froze dev during bulk uploads; don't re-enable
- Path aliases configured in `src/jsconfig.json` — imports resolve from `src/`
- No `.env` file checked in; API base URL is hardcoded in `apiurl.js`
- 3D previews use Three.js via react-three/fiber — keep separate from canvas editor logic
- `Header.jsx` is ~70KB and very complex — be careful with changes there
- All object mutations go through Redux actions in `canvas.js` slice
- `implementation_plan.md`, `multi_object_selection_plan.md`, and `optimistic_image_placement_plan.md` in root contain feature planning docs (the last one is approved-but-unbuilt: place images while they upload, with locked product decisions and a VERIFY list — read it before touching that feature)
- `docs/session-2026-06-12-upload-pipeline-rework.md` records the upload-performance rework session (diagnosis, decisions log, verification status)
- When fixing floating toolbar issues: changes in sidebar panels are often the authoritative pattern; check sidebar reducer dispatch patterns before modifying toolbar code
- Calendar theme save uses `store.getState()` to read fresh Redux state at save time, preventing stale closure issues with `useSelector` hooks
