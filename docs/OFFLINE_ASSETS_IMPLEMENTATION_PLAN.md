# Desktop Offline-First Asset & Export Pipeline — Technical Specification

> [!NOTE]
> **Documentation Directory:**
> - **Offline Assets (This Doc):** [OFFLINE_ASSETS_IMPLEMENTATION_PLAN.md](file:///d:/Codnix%20Projects/printpoz-desktop-designer/OFFLINE_ASSETS_IMPLEMENTATION_PLAN.md) | [Dashboard HTML](file:///d:/Codnix%20Projects/printpoz-desktop-designer/OFFLINE_ASSETS_DASHBOARD.html)
> - **Export Pipeline:** [EXPORT_PIPELINE.md](file:///d:/Codnix%20Projects/printpoz-desktop-designer/EXPORT_PIPELINE.md) | [Dashboard HTML](file:///d:/Codnix%20Projects/printpoz-desktop-designer/EXPORT_PIPELINE_DASHBOARD.html)

## 1. Executive Summary & Offline-First Vision

This document is the single source of truth for converting the Printpoz web photo editor into an offline-first Electron desktop application. All core editor interactions (positioning, styling, shapes, layers, local saves) and final print exports run completely on-device, bypassing S3 uploads and server-side PDF generation. The cloud functions purely in the background to sync data, back up changes, and serve new library assets.

---

## 2. Offline Capability Matrix

The desktop application partitions features into three distinct operational states based on network availability:

### 2.1 Fully Offline (No Internet Required)
- **Editor Interaction:** Move/resize layers, insert text, shapes, apply filters, masks, layouts, backgrounds, undo/redo.
- **Canvas Undo/Redo:** Handled completely in memory for the current session.
- **File Management:** Create new projects, open existing local projects, import user images from disk.
- **Library Reuse:** Use cached backgrounds, stickers, templates, clip art, and custom WOFF2 fonts.
- **Print Export:** True high-resolution export to local disk (JPEG, PDF, ZIP) via the offscreen browser pipeline.
- **3D Preview:** Reconstructed locally using client-side WebGL canvas renderers.

### 2.2 Works Under Unstable Internet (Queued + Auto-Retry)
- **Cloud Sync & Saves:** Design schema updates are committed locally and synced in the background.
- **Asset Uploads:** User-provided photos are registered locally and queued for cloud backup.
- **Asset Library Browsing:** Cached indexes allow browsing previously loaded assets; new indexes auto-fetch and retry.

### 2.3 Online-Only (Requires Active Internet Connection)
- **AI Features:** AI Caption Suggestions, AI Kids Photo Book Face Swap, AI Background Removal (calls backend API).
- **Checkout/Ordering:** Adding designs to cart, pricing/coupon verification, final checkout flow.
- **First-Time Load:** Accessing a project stored exclusively in the cloud for the first time.

---

## 3. Advanced Desktop Advantages Over Web

Converting to a native Electron wrapper allows us to deliver high-performance capabilities impossible in a standard web browser:

### 3.1 Extreme Performance
- **Zero-Upload Editing:** Stream and read massive high-res photos straight from the local hard drive, removing S3 upload latency.
- **Native Decode & Resize:** Multi-threaded image processing in the background (using Node/Sharp or worker processes) avoids blocking the main renderer thread.
- **Infinite Memory Limits:** Bypasses browser tab memory limits, letting users work on 100+ page photobooks with high-resolution graphics.
- **Sub-Second Cold Starts:** Cached application files and libraries load from native storage instantly.

### 3.2 Native OS Integration
- **Drag-and-Drop:** Seamlessly drag file directories or images from Windows Explorer/macOS Finder straight into the canvas.
- **File Associations:** Double-click a native `.ppzproject` file to launch Printpoz; supports system "Open With" handlers.
- **Installed System Fonts:** Access all locally installed operating system fonts on the user's computer (similar to Figma Desktop).
- **Desktop Chrome Integration:** System tray support, jump lists, recent files history, global keyboard shortcuts, and native menus.
- **Notifications & Clipboard:** Paste images directly from the clipboard; receive OS notifications when a large print export completes.

### 3.3 Enhanced Productivity
- **Silent Updates:** Seamless background application updates.
- **Persistence:** Background synchronization of projects continues even after the editor window is closed.
- **Watch-Folders:** Define folders on disk that automatically import new photos into the design gallery.
- **On-Device AI (Future):** Porting lightweight ONNX models to local execution (e.g. background removal) to make AI fully offline.

### 3.4 Print & Color Dominance
- **Uncapped Export Resolution:** Render print-ready SVGs at 300+ DPI without hitting web browser memory constraints or server timeout limits.
- **Color Profiles (CMYK/ICC):** Apply ICC profiles and color management locally for accurate soft-proofing in the UI.
- **Press-Ready Output:** Injected crop marks, bleeds, CMYK color spaces, and direct local print spooling.

---

## 4. Local Storage Stack & Sync Strategy

To deliver an offline-first experience, we replace the web's network-dependent model with a reliable native storage stack:

```
                  ┌──────────────────────────────────────────────┐
                  │                 USER CANVAS                  │
                  └──────────────────────┬───────────────────────┘
                                         │ React / Redux
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          OFFLINE-FIRST SYNC ENGINE           │
                  └────┬───────────────────┬──────────────────┬──┘
                       │                   │                  │
         Save JSON     │     Image Bytes   │    Keychain      │    Queued Ops
                       ▼                   ▼                  ▼    (in order)
                  ┌──────────┐      ┌─────────────┐     ┌──────────┐  ┌──────────┐
                  │  SQLite  │      │ Content-    │     │    OS    │  │  SQLite  │
                  │ (better- │      │ Addressed   │     │ Keychain │  │  Sync    │
                  │ sqlite3) │      │ File Store  │     │ (keytar) │  │  Queue   │
                  └──────────┘      └─────────────┘     └──────────┘  └────┬─────┘
                                                                           │
                                                                           │ Replay on
                                                                           │ reconnect
                                                                           ▼
                                                                      ┌──────────┐
                                                                      │ SERVER   │
                                                                      │ API      │
                                                                      └──────────┘
```

### 4.1 Storage Stack Implementation
1. **SQLite (via `better-sqlite3`):** Emitted locally inside the main process. Manages:
   - **Project Catalog:** Quick search index of all local projects, metadata, and creation dates.
   - **Version History:** Delta-compressed snapshots of the project design JSON.
   - **Sync Queue:** Sequence of pending writes to replay to the API.
2. **Content-Addressed File Store:** All image assets (user photos, cached stickers/backgrounds) are hashed (SHA-256) and saved in a central storage path based on their hash (e.g. `cache/images/ab/cd12...`). This automatically de-duplicates assets used across multiple pages or different projects.
3. **JSON Config Files:** Simple key-value storage for editor preferences, workspace dimensions, and caching limits.
4. **OS Keychain Security (via `keytar` / `safeStorage`):** Encrypts auth tokens, refresh tokens, and session secrets using system-level cryptography.

### 4.2 Auto-Save, Backups & Version Control
- **Atomic Auto-Save:** Every change generates a silent, non-blocking local JSON write. Writes use atomic operations (`fs.writeFile` to a temp file, then renamed) to ensure drafts are never corrupted.
- **Crash Recovery:** If the app shuts down uncleanly, a startup boot reconciliation script detects the unsaved local draft and prompts the user to recover it.
- **Backup Rings:** A rotating ring of `.ppzproject` file backups (e.g., 3 rotating local snapshots) ensures users can roll back files.
- **Snapshots ("Time Machine"):** Every major milestone (like a manual save or printing) creates a durable point-in-time snapshot.

### 4.3 Background Sync & Conflict Management
- **Durable Sync Queue:** When offline or on unstable networks, editor modifications are appended to a queue table in SQLite.
- **Mobile-Parity Sync:** Integrates background sync techniques: exponential backoff, connectivity checkpointing, and resume-on-reconnect.
- **Single-User Conflict Resolution:** "Last-Write-Wins" strategy. When online, the app verifies the remote version ID. If a project was updated elsewhere, it prompts: *"This project was updated on another device. Would you like to keep your local edits as a copy or overwrite?"*

---

## 5. Detailed API Endpoint Audit

The following is an exhaustive audit of every `ENDPOINTS.*` call in the codebase, traced from [apiurl.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/constants/apiurl.js).

### 5.1 Endpoints That Stay Online (No Change Needed)

These endpoints serve metadata, manage server state, or call third-party AI services. They cannot be cached or localized without a fundamental architecture change.

| Endpoint Constant | Actual Path | Called From | Why It Stays Online |
|---|---|---|---|
| `getProjectDetails` | `cart-editor-details/view/:id` | `useInitializeProject.js` | Loads full project JSON from server |
| `saveProject` | `cart-editor-details/save` | `Header.jsx` | Persists design state to server |
| `getOrderDetails` | `order/details` | `useInitializeProject.js` | Order/cart data lives on server |
| `saveLayouts` | `editor-settings/createLayout` | Admin only | Server-side CRUD |
| `saveAsTheme` | `store-theme-editor/saveTheme` | `Header.jsx`, `CreateThemeDialog.jsx` | Server-side persist |
| `savePageAsThemeImage` | `store-theme-editor/saveThemeImage` | `Header.jsx` | Server-side persist |
| `getProjectImages` | `project-images` | `PhotosAction.jsx`, `AddMyPhotos.jsx` | Server-managed image gallery |
| `addProjectImageAsFavroite` | `project-images/addImageAsFavroite` | `PhotosAction.jsx` | Server-side flag |
| `removeProjectImageAsFavroite` | `project-images/removeImageAsFavroite` | `PhotosAction.jsx` | Server-side flag |
| `deleteProjectImage` | `project-images/deleteImage` | `PhotosAction.jsx` | Server-side delete |
| `deleteMultipleProjectImages` | `project-images/deleteMultipleImages` | `PhotosAction.jsx`, `AddMyPhotos.jsx` | Server-side delete |
| `addToProject` | `project-images/copyImagesFromProject` | `AddMyPhotos.jsx` | Server-side copy |
| `getTextCaptions` | `ai/generate-caption-suggestions` | `CaptionByAI.jsx`, `MagicWritePanel.jsx` | AI text generation |
| `removeBackground` | `ai/remove-background` | `ImageSettingsPanel.jsx`, `ImageFloatingToolbar.jsx` | AI image processing |
| `swapFaceByAI` | `ai/swap-face-by-ai` | `AIKidsPhotoBookModal.jsx` | AI processing + socket.io |
| `fetchUserDataFromToken` | `users/fetchUserDataFromToken` | `useInitializeProject.js` | Auth validation |
| `authLogin` | `auth/store/loginWithEditor` | `LoginPage.jsx` | Authentication |
| `verifyOTP` | `auth/store/verifyOTPForEditorLogin` | `LoginPage.jsx` | Authentication |
| `getBrandDetails` | `brand/getEditorBrandDetails` | `useInitializeProject.js` | Brand config |
| `getProductSizes` | `productSize/getSizeForEditor` | `SizeSettingsPopup.jsx` | Product metadata |
| `calculateOrderAmount` | `cart/calculateOrderAmountForEditor` | `Header.jsx` | Pricing |
| `getStoreList` | `brand-store` | `EditorConfigurationAction.jsx` | Admin listing |
| `getEditorConfigurationForStore` | `editor-configurations/...` | `EditorConfigurationAction.jsx` | Config |
| `saveEditorConfiguration` | `editor-configurations/...` | `EditorConfigurationAction.jsx` | Config persist |
| `getFontsList` | `font` | `FontManagementDialog.jsx` | Admin font management |
| `addFont` | `font/create` | `AddFontDialog.jsx` | Admin upload |
| `updateFont` | `font/update` | `EditFontDialog.jsx` | Admin update |
| `toggleFont` | `font/toggleEnabled` | `FontManagementDialog.jsx` | Admin toggle |
| Asset CRUD endpoints | `editor-settings/create/update/delete` | `AssetManagementDialog.jsx` | Admin CRUD |
| Tag CRUD endpoints | `store-tags/create/update/delete` | `TagManagementDialog.jsx` | Admin CRUD |

### 5.2 Endpoints To Be Intercepted on Desktop

| Endpoint Constant | Actual Path | Called From | Desktop Replacement |
|---|---|---|---|
| `uploadImage` | `project-images/uploadImage` | `uploadManager.js` (legacy) | **Local file copy** via `fs:saveLocalAsset` IPC |
| `uploadsInit` | `project-images/uploads/init` | `uploadManager.js` | **Skipped** — no S3 multipart needed |
| `uploadsComplete` | `project-images/uploads/complete` | `uploadManager.js` | **Skipped** — no S3 finalization needed |
| `uploadsRefreshUrls` | `project-images/uploads/refresh-urls` | `uploadManager.js` | **Skipped** — no signed URLs needed |
| `exportAsJPG` | `cart-editor-details/exportAsJpeg` | `useExportPages.js`, `getTrimmedPreviewTexture.js`, `export/index.js` | **Offscreen Electron render** via `export:renderSvg` IPC |

### 5.3 Endpoints For On-Demand Caching

These endpoints return lists or detail configurations. The metadata is cached locally on first fetch so they are available offline.

| Endpoint Constant | Actual Path | Called From | Cache Strategy |
|---|---|---|---|
| `getBackgrounds` | `editor-settings/getEditorTypeWiseDetails` | `BackgroundsSlider.jsx` | API returns list with image URLs. On placement, download the full image and cache it at `AppData/cache/backgrounds/<id>` |
| `getBackgroundCategory` | `store-tags` | `BackgroundsSlider.jsx` | JSON metadata only — not cached |
| `getStickers` | `editor-settings/getEditorTypeWiseDetails` | `StickersAction.jsx` | Same as backgrounds — cache on placement |
| `getStickerCategories` | `store-tags` | `StickersAction.jsx` | JSON metadata only — not cached |
| `getMask` | `editor-settings/getEditorTypeWiseDetails` | `MasksContent.jsx` | Cache SVG/PNG mask files on first use |
| `getClipArts` | `editor-settings/getClipArts` | `ClipArtAction.jsx` | Cache clip art images on first use |
| `getLayouts` | `editor-settings/getLayouts` | `LayoutsAction.jsx`, `IdeasAction.jsx` | Cache JSON layouts catalog index and individual layout schemas locally to browse offline |
| `getTemplates` | `editor-settings/getEditorTypeWiseDetails` | (templates panel) | Cache templates list and structural page schemas locally to load offline |
| `getThemesCategory` | `store-tags` | `ThemesAction.jsx` | Cache themes tag listing JSON locally to browse offline categories |
| `getThemes` | `store-theme-editor` | `ThemesAction.jsx` | Cache themes index catalog JSON locally to browse offline themes list |
| `getThemeById` | `store-theme-editor/getTheme` | `theme/index.js` | Cache full theme details JSON locally (images/backgrounds are cached on placement) |
| `getFontsListInSidebar` | `font/list` | `FontContext.jsx` | API returns font metadata + WOFF2 URLs. Cache WOFF2 binary files locally |
| `getFontById` | `font/getFontsDetailsFromIdsOrNames` | `FontContext.jsx` | Same — cache WOFF2 files |
| `getImageGallery` | `cart-editor-details/getImageGallery` | `Header.jsx` | Gallery metadata — not cached |

---

## 6. Local File System Layout

All local data resides under `app.getPath("userData")`:

```
%APPDATA%/photo-editor-desktop-app/
├── projects/
│   └── <project-id>/
│       └── assets/
│           ├── a1b2c3d4.jpg        ← user photo (copied from local disk)
│           ├── e5f6g7h8.png        ← another user photo
│           └── ...
├── cache/
│   ├── backgrounds/
│   │   ├── <asset-db-id>.jpg       ← cached background image
│   │   └── ...
│   ├── stickers/
│   │   ├── <asset-db-id>.png       ← cached sticker
│   │   └── ...
│   ├── masks/
│   │   ├── <asset-db-id>.svg       ← cached mask
│   │   └── ...
│   ├── cliparts/
│   │   ├── <asset-db-id>.svg       ← cached clip art
│   │   └── ...
│   ├── layouts/
│   │   ├── layouts.json            ← cached layouts & templates listing
│   │   └── ...
│   ├── themes/
│   │   ├── themes.json             ← cached themes metadata listing
│   │   ├── <theme-id>.json         ← cached individual theme object
│   │   └── ...
│   └── fonts/
│       ├── <font-id>-400-normal.woff2
│       ├── <font-id>-700-normal.woff2
│       └── ...
└── config/
    └── cache-manifest.json          ← LRU tracking, sizes, timestamps
```

---

## 7. Custom Protocol (`app-assets://`)

Chromium's security model blocks `file://` URIs from the renderer context. We register
a custom privileged scheme to serve local binaries securely.

**URL format:**
- `app-assets://project/<project-id>/<filename>` → project-scoped user photos
- `app-assets://cache/<category>/<asset-id>` → shared cached library assets

**Security:**
- Path traversal guard: resolved path must start with the expected base directory
- The scheme is registered as `standard`, `secure`, `supportFetchAPI`, `corsEnabled`, and `stream`

---

## 8. User Photo Pipeline (No Upload)

### Current web flow:
1. User selects file → `File` object created
2. `dispatchUploadsWithConcurrency()` → `startEagerResize()` → preview blob URL
3. `uploadImageOptimized()` → `uploadsInit` → S3 chunk PUT → `uploadsComplete`
4. `replaceImageSourceAcrossPages()` swaps preview blob → S3 `https://` URL

### Desktop flow (replacement):
1. User selects file → Electron `File` object has `.path` property
2. `startEagerResize()` → preview blob URL (same as web — for instant canvas display)
3. **Instead of upload:** IPC `fs:saveLocalAsset(file.path, projectId)`
   - Main process copies file to `AppData/projects/<id>/assets/<uuid>.<ext>`
   - Returns `app-assets://project/<id>/<uuid>.<ext>`
4. `replaceImageSourceAcrossPages()` swaps preview blob → `app-assets://` URL

**Interception point:** [imageUploadThunks.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/store/background-services/imageUploadThunks.js) `uploadImage` thunk, line 196.

---

## 9. Library Asset Caching Pipeline

### Flow for backgrounds, stickers, masks, clip art:
1. User opens panel → API called to fetch **list metadata** (always online)
2. Panel renders thumbnails using remote CDN URLs (small thumbnails load fast)
3. User **clicks/places** an asset on the canvas
4. **Desktop interceptor** checks: `await desktop.cache.check(category, assetId)`
5. If cached → returns `app-assets://cache/<category>/<assetId>` immediately
6. If not cached + online → `await desktop.cache.download(remoteUrl, category, assetId)`
   - Main process downloads the full-resolution file via `https`
   - Writes to `AppData/cache/<category>/<assetId>`
   - Returns local protocol URL
7. If not cached + offline → falls back to the remote URL (will fail gracefully with
   a broken image indicator in the canvas)

### Layouts, Templates, and Themes Caching:
Unlike library graphics (which cache large binary files on placement to canvas), layouts and themes cache their listing JSON catalog index and design details locally so the user can browse, load, and apply them completely offline.

1. **Category & Theme Listing (`getThemesCategory`, `getThemes`, `getLayouts`):**
   - When the user opens the Layouts/Themes panel, the interceptor checks: `await desktop.cache.checkJson(category)` (e.g. at `AppData/cache/layouts/layouts.json`).
   - If offline → loads the cached JSON catalog instantly, allowing the panel list to render offline.
   - If online → fetches the fresh listing from the API, saves it to the local cache directory, and renders the panels.
2. **Individual Theme Details & Templates (`getThemeById`, `getTemplates`):**
   - Selecting a theme or template calls the details API. The interceptor caches the JSON schema at `AppData/cache/themes/<themeId>.json` on first fetch.
   - When offline, the schema is loaded from the cache.
   - Images, backgrounds, and assets referenced within the theme/template JSON are resolved through the standard binary caching pipeline once placed onto canvas pages.

### Font caching:
Fonts follow a different path because they're loaded via the `FontFace` API:
1. [FontContext.jsx](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/context/FontContext.jsx) calls `getFontsListInSidebar` or `getFontById` → returns WOFF2 `fileUrl`
2. [fontLoader.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/common-functions/fontLoader.js) calls `loadFontFile(name, fileUrl, weight, style)` → `new FontFace()` + `document.fonts.add()`
3. **Desktop interceptor** wraps `loadFontFile`: before fetching the remote WOFF2, check if it exists at `AppData/cache/fonts/<fontId>-<weight>-<style>.woff2`. If cached, load from local. If not, download → cache → load.

### Google Fonts:
Google Fonts are loaded via `<link>` injection in [fontLoader.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/common-functions/fontLoader.js#L150-L191).
They hit `https://fonts.googleapis.com/css2?family=...` which requires internet.
**No caching for Google Fonts** — the CSS response varies by user-agent and Google's CDN
handles its own caching headers. This is an accepted online requirement.

---

## 10. Export Pipeline (Fully Local)

### Current web flow:
1. Canvas generates SVG content per page → stored in `svgData.svgContent[]`
2. For each page: `apiPost(ENDPOINTS.exportAsJPG, { svgDetails, fonts, w, h })` → server renders via headless Chrome → returns JPEG blob
3. Client compiles JPEG blobs into PDF via `jsPDF` → `saveAs()` downloads to browser Downloads folder

### Desktop flow (replacement):
1. SVG content generation stays identical
2. **Instead of API call:** IPC `export:renderSvg(svgContent, width, height)`
   - Main process spawns hidden `BrowserWindow` with `offscreen: true`
   - Loads SVG inside an HTML shell with injected `@font-face` rules
   - Waits for `document.fonts.ready`
   - Calls `webContents.capturePage()` → returns JPEG buffer
   - Closes hidden window immediately
3. Client compiles JPEG buffers into PDF via `jsPDF` (same as web)
4. **Instead of `saveAs()`:** `desktop.dialog.saveAs()` → native OS Save dialog → `desktop.fs.writeFile()` writes directly to chosen path

**Interception points:**
- [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js): Every `apiPost(ENDPOINTS.exportAsJPG, ...)` call (lines 153, 291, 326, 443, 496, 569, 619)
- [getTrimmedPreviewTexture.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/products-preview/shared/getTrimmedPreviewTexture.js): Line 30
- [export/index.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/services/export/index.js): Line 16

### Font handling during export:
The server-side renderer receives a `fonts` array and loads them independently. For desktop
rendering, the hidden window must have access to the same fonts. Since fonts are already
loaded in the main renderer via `FontFace` API, they are available in the hidden window
as long as it shares the same session partition. Alternatively, we inject `@font-face`
declarations pointing to cached local WOFF2 files.

---

## 11. IPC Channels Summary

| Channel Name | Direction | Purpose |
|---|---|---|
| `fs:saveLocalAsset` | Renderer → Main | Copy user photo to project folder |
| `cache:check` | Renderer → Main | Check if library asset is cached |
| `cache:download` | Renderer → Main | Download and cache a library asset |
| `export:renderSvg` | Renderer → Main | Render SVG to JPEG in hidden window |
| `dialog:openImages` | Renderer → Main | Already exists — native file picker |
| `dialog:saveAs` | Renderer → Main | Already exists — native save dialog |
| `fs:writeFile` | Renderer → Main | Already exists — write buffer to disk |
| `fs:readFileAsBuffer` | Renderer → Main | Already exists — read file as ArrayBuffer |

---

## 12. Implementation Timeline (Phases)

### Phase 1 — Protocol & Core IPC (Foundation)
- [ ] Extend `app-assets://` protocol to handle `project/` and `cache/` scopes
- [ ] Implement `fs:saveLocalAsset` IPC handler
- [ ] Implement `cache:check` and `cache:download` IPC handlers
- [ ] Update preload bridge and `DesktopApi` interface

### Phase 2 — User Photo Interception
- [ ] Modify `uploadImage` thunk to bypass S3 upload when `isDesktop`
- [ ] Verify `File.path` is available in Electron's file picker
- [ ] Test eager resize + local copy + canvas swap end-to-end

### Phase 3 — Library Asset Caching
- [ ] Create `resolveLibraryAsset()` utility
- [ ] Wire into `BackgroundsSlider.jsx` — cache on background placement
- [ ] Wire into `StickersAction.jsx` — cache on sticker placement
- [ ] Wire into `MasksContent.jsx` — cache on mask application
- [ ] Wire into `ClipArtAction.jsx` — cache on clip art placement
- [ ] Wire font caching into `fontLoader.js` → `loadFontFile()`
- [ ] Implement JSON caching interceptors for `getLayouts` and `getTemplates` in `LayoutsAction.jsx`
- [ ] Implement JSON caching interceptors for `getThemes` and `getThemeById` in `ThemesAction.jsx`

### Phase 4 — Export Pipeline
- [ ] Implement `export:renderSvg` IPC with hidden `BrowserWindow`
- [ ] Update `useExportPages.js` to route through IPC when desktop
- [ ] Update `getTrimmedPreviewTexture.js` and `export/index.js`
- [ ] Replace `saveAs()` with native Save dialog + `fs.writeFile`

### Phase 5 — Cache Management
- [ ] Implement `cache-manifest.json` tracking (file sizes, access timestamps)
- [ ] LRU eviction when total cache exceeds 500 MB limit
- [ ] Settings UI to view cache size and clear cache
