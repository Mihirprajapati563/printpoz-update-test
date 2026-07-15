// Shared IPC contract — the single source of truth for main <-> renderer.
// Imported by main and preload (TypeScript). The renderer (JS) uses these shapes
// loosely via window.desktop. Add a channel here FIRST, then the handler, then the
// preload wrapper (see docs/05-ARCHITECTURE.md §7 and .claude/skills/add-ipc-channel).

export const CHANNELS = {
  appGetInfo: "app:getInfo",
  appGetConfigSync: "app:getConfigSync", // sync read so renderer can read config at import time
  secureStoreGet: "secureStore:get",
  secureStoreSet: "secureStore:set",
  secureStoreDelete: "secureStore:delete",
  authOpenExternal: "auth:openExternal",
  dialogOpenImages: "dialog:openImages",
  dialogSaveAs: "dialog:saveAs",
  dialogOpenFolder: "dialog:openFolder",
  fsReadFileAsBuffer: "fs:readFileAsBuffer",
  fsWriteFile: "fs:writeFile",
  // local user-photo store (offline-first; no S3 upload on desktop)
  assetsSave: "assets:save",
  assetsList: "assets:list",
  assetsRemove: "assets:remove",
  assetsSetFavorite: "assets:setFavorite",
  assetsCheckOriginals: "assets:checkOriginals",
  // client-side export (offscreen render — replaces server-side exportAsJpeg)
  exportRenderSvg: "export:renderSvg",
  // on-disk font cache (avoid re-downloading the same WOFF2 every session)
  fontsCacheGet: "fonts:cacheGet",
  fontsCachePut: "fonts:cachePut",
  // offline-first catalog cache for library assets (layouts/backgrounds/
  // stickers/masks/themes listing JSON) — read on offline, write-through online
  assetsCacheGet: "assetsCache:get",
  assetsCachePut: "assetsCache:put",
  assetsCacheClear: "assetsCache:clear",
  // offline-first BINARY cache for remote preview/thumbnail images (theme
  // previews, background/sticker/mask thumbnails) — bytes on disk under
  // cache/images/, served back via the app-assets:// image-cache scope
  imageCacheGet: "imageCache:get",
  imageCachePut: "imageCache:put",
  imageCacheUrlMap: "imageCache:urlMap",
  imageCacheEvict: "imageCache:evict",
  // editor data store — snapshot, saved-designs library, custom sizes (AppData)
  editorDataSnapshotGet: "editorData:snapshot:get",
  editorDataSnapshotSet: "editorData:snapshot:set",
  editorDataSnapshotClear: "editorData:snapshot:clear",
  editorDataHistoryGet: "editorData:history:get",
  editorDataHistorySet: "editorData:history:set",
  editorDataHistoryClear: "editorData:history:clear",
  editorDataDesignsList: "editorData:designs:list",
  editorDataDesignsGet: "editorData:designs:get",
  editorDataDesignsPut: "editorData:designs:put",
  editorDataDesignsDelete: "editorData:designs:delete",
  // customer "Save as Idea" — page/spread ideas saved locally (no API)
  editorDataIdeasList: "editorData:ideas:list",
  editorDataIdeasPut: "editorData:ideas:put",
  editorDataIdeasDelete: "editorData:ideas:delete",
  editorDataSizesGet: "editorData:sizes:get",
  editorDataSizesSet: "editorData:sizes:set",
  // offline theme packs — full theme + its assets downloaded to disk for offline
  // browse/open (AppData/theme-packs/<id>/). Served back via the app-assets://
  // theme-pack scope. See theme-packs.service.ts.
  themePacksList: "themePacks:list",
  themePacksGetThemeJson: "themePacks:getThemeJson",
  themePacksHasAsset: "themePacks:hasAsset",
  themePacksPutAsset: "themePacks:putAsset",
  themePacksSaveManifest: "themePacks:saveManifest",
  themePacksDelete: "themePacks:delete",
  themePacksUrlMap: "themePacks:urlMap",
  // renderer -> main: re-run the update check (Retry button)
  updateCheck: "update:check",
  // events (main -> renderer)
  menuEvent: "menu:event",
  updateStatus: "update:status",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export type AppEnv = "development" | "staging" | "production";
export type AppChannel = "stable" | "beta";

export interface AppConfig {
  apiBaseUrl: string;
  orderApiBaseUrl: string;
  env: AppEnv;
  channel: AppChannel;
  
  // enableDevTools?: boolean;
  isDesktop: true;
  platform: NodeJS.Platform;
  version: string;
  enableDevTools?: boolean;
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  isDesktop: true;
  channel: AppChannel;
}

export interface OpenedImage {
  path: string;
  name: string;
  size: number;
}

// ── Local asset store (user photos, desktop only) ──────────────────
// One resized variant's bytes, sent from renderer → main to write to disk.
export interface AssetVariantInput {
  size: "large" | "medium" | "small";
  bytes: ArrayBuffer;
  ext: string; // "jpg" | "png" | "webp" | ...
}

export interface SaveAssetInput {
  projectId: string;
  fileName: string; // original file name (display only)
  fileSize: number; // original byte size (display only)
  width: number; // natural (EXIF-corrected) dimensions of the large variant
  height: number;
  variants: AssetVariantInput[];
  // REFERENCE MODE (desktop): absolute path to the user's ORIGINAL file. When
  // present, the store keeps ONLY a small thumbnail on disk (no large/medium
  // copies) and full-resolution pixels are streamed from this path on demand
  // (canvas + export) via the app-assets://original/ scope. Absent → legacy
  // copy mode (all variant bytes are written to disk, today's behavior).
  originalPath?: string;
}

export interface LocalAssetUrl {
  size: string; // "large" | "medium" | "small"
  url: string; // app-assets://project/<projectId>/<file>
  w: number;
  h: number;
}

// Shaped to mirror a server `project-images` item so the existing gallery,
// placement, sort and optimistic-merge code consume it unchanged.
export interface LocalAsset {
  _id: string; // ObjectId-shaped 24-hex id, monotonic-by-creation
  file_name: string;
  fileSize: number;
  width: number;
  height: number;
  is_favorite: boolean;
  created_at: string; // ISO timestamp
  urls: LocalAssetUrl[];
  // Present only for reference-mode assets: absolute path to the user's original
  // file. Used server-side (main) to stream full-res + to detect a missing
  // original; the renderer treats a truthy `originalPath` as "referenced".
  originalPath?: string;
  // True when the original file was present at the last list()/stat. The gallery
  // uses this to surface the "re-add this image" toast for referenced assets
  // whose original was moved/deleted.
  originalMissing?: boolean;
}

export interface ListAssetsInput {
  projectId: string;
  skip?: number;
  limit?: number;
  sortField?: string; // "_id" | "created_at" | "file_name"
  sortOrder?: string; // "asc" | "desc"
}

export interface ListAssetsResult {
  items: LocalAsset[];
  totalCount: number;
}

// ── Editor data store (snapshot / saved-designs / custom sizes) ────
// All three are stored as JSON files under userData/editor/ on desktop.
// The renderer helpers (editorSnapshot.js, savedDesigns.js, customSizes.js)
// call these channels on desktop; the localStorage/IndexedDB paths are used
// on web (window.desktop absent).

// Opaque JSON blob — the renderer owns the schema; the service stores/retrieves it.
export interface EditorSnapshotRaw {
  json: string; // stringified snapshot
}

// Card-level metadata returned by list (no heavy payload).
export interface SavedDesignMeta {
  id: string;
  name: string;
  size: string | null; // display size label, e.g. "1200 × 1600"
  editorType: string | null;
  cat: string | null;
  thumbnail: string | null;
  createdAt: number;
  updatedAt: number;
}

// Full entry stored/retrieved as a single JSON blob (renderer manages schema).
export interface SavedDesignEntry extends SavedDesignMeta {
  [key: string]: unknown; // themeId, pages_c, canvasSize, settings, etc.
}

// A single custom size entry (renderer manages schema).
export interface CustomSizeEntry {
  id: string;
  [key: string]: unknown;
}

// ── Saved Ideas library (customer "Save as Idea", desktop only) ─────
// One page or spread the customer saved locally from the editor. Small enough to
// keep the whole record (including the compressed layout) in one list file; the
// renderer owns the schema. `spread` groups the idea under Page vs Spread in the
// Ideas tab; `layout_c` is the compressed `{ layout: [...] }` reused verbatim by
// the existing Ideas render + apply pipeline.
export interface SavedIdeaEntry {
  id: string;
  name: string;
  editorType: string | null;
  spread: boolean;
  number_of_layouts: number;
  number_of_images: number;
  width: number;
  height: number;
  layout_c: string; // compressed JSON.stringify({ layout: [...] })
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

// ── Library asset catalog cache (offline-first listing JSON) ───────
// The renderer caches the LAST SUCCESSFUL listing/detail payload per query so the
// asset panels (layouts, backgrounds, stickers, masks, themes) render offline.
// The payload is opaque JSON — the renderer owns the shape (typically
// `{ items, totalCount }`); the service just stores/retrieves it by (category,
// key). `key` is a renderer-computed filesystem-safe hash of the request filter.
export interface AssetsCacheApi {
  get(category: string, key: string): Promise<unknown | null>;
  put(category: string, key: string, value: unknown): Promise<void>;
  clear(category: string): Promise<void>;
}

// ── Binary preview/thumbnail image cache (offline-first) ───────────
// Stores the actual BYTES of remote preview images (theme previews, background/
// sticker/mask panel thumbnails) under userData/cache/images so they render with
// no connection. `get`/`urlMap` return an app-assets:// url pointing at the
// on-disk copy; `put` writes the bytes (fetched by the renderer) and returns
// that url. `urlMap` is loaded once at boot into an in-memory lookup so an
// offline resolve is synchronous. This is the binary counterpart to
// AssetsCacheApi (which stores only listing JSON).
export interface ImageCacheApi {
  get(url: string): Promise<string | null>;
  put(url: string, bytes: ArrayBuffer, mime: string): Promise<string>;
  urlMap(): Promise<Record<string, string>>;
  evict(maxAgeMs: number): Promise<void>;
}

export interface EditorDataApi {
  // Snapshot (one active slot)
  snapshotGet(): Promise<string | null>; // returns raw JSON string or null
  snapshotSet(json: string): Promise<void>;
  snapshotClear(): Promise<void>;
  // Undo/redo history (one active slot, separate file — potentially large, so it
  // is loaded ASYNC after boot and never on the synchronous RootGate path).
  historyGet(): Promise<string | null>; // returns raw JSON string or null
  historySet(json: string): Promise<void>;
  historyClear(): Promise<void>;
  // Saved-designs library
  designsList(): Promise<SavedDesignMeta[]>;
  designsGet(id: string): Promise<SavedDesignEntry | null>;
  designsPut(entry: SavedDesignEntry): Promise<void>;
  designsDelete(id: string): Promise<void>;
  // Saved Ideas library (customer "Save as Idea")
  ideasList(): Promise<SavedIdeaEntry[]>;
  ideasPut(entry: SavedIdeaEntry): Promise<void>;
  ideasDelete(id: string): Promise<void>;
  // Custom sizes
  sizesGet(): Promise<CustomSizeEntry[]>;
  sizesSet(sizes: CustomSizeEntry[]): Promise<void>;
}

// ── Offline theme packs ────────────────────────────────────────────
// A "theme pack" is a full theme (every size variant + all referenced assets)
// downloaded to disk so it can be browsed, size-selected and edited with no
// network. Binary assets are written to AppData/theme-packs/<id>/assets/ and
// served back to the renderer via `app-assets://theme-pack/<id>/assets/<file>`.
// The renderer owns the schema; the service stores/retrieves/serves it.

export interface ThemePackSize {
  size: string; // "WxH"
  width: number;
  height: number;
  dpi: number | null;
  orientation: string | null;
}

// One downloaded binary: its original CDN url and the on-disk file name
// (`<urlHash>.<ext>`, computed by the renderer, re-validated by main).
export interface ThemePackAsset {
  url: string;
  file: string;
}

// Lightweight card metadata kept in theme-packs/index.json for the offline grid.
export interface ThemePackMeta {
  themeId: string;
  name: string;
  category: string | null; // editor_type
  version: string | null; // the theme's server updatedAt (client-side version key)
  fingerprint: string | null; // hash over all variants' pages_c (drift detection)
  thumbnail: string | null; // LOCAL app-assets:// url of the card thumbnail
  sizesCount: number;
  downloadedAt: number;
  totalBytes: number;
  complete: boolean; // false while a download is partial/resumable
}

// Full per-pack manifest (manifest.json) — meta + the url→file map + variants.
export interface ThemePackManifest extends ThemePackMeta {
  sizes: ThemePackSize[];
  assets: ThemePackAsset[];
  fontUrls: string[];
  thumbnailUrl: string | null; // ORIGINAL url chosen as the thumbnail
}

// Payload the renderer sends to persist a pack (after all bytes are written).
export interface SaveThemePackInput {
  themeId: string;
  name: string;
  category: string | null;
  version: string | null;
  fingerprint: string | null;
  sizes: ThemePackSize[];
  assets: ThemePackAsset[];
  fontUrls: string[];
  thumbnailUrl: string | null;
  downloadedAt: number;
  totalBytes: number;
  complete: boolean;
  themeJson: string; // raw getTheme response (stringified) — the offline-open source
}

export interface ThemePacksApi {
  list(): Promise<ThemePackMeta[]>;
  getThemeJson(themeId: string): Promise<string | null>;
  hasAsset(themeId: string, file: string): Promise<boolean>;
  putAsset(themeId: string, file: string, bytes: ArrayBuffer): Promise<void>;
  saveManifest(input: SaveThemePackInput): Promise<void>;
  delete(themeId: string): Promise<void>;
  // originalUrl → app-assets:// url, across every complete pack (one boot call).
  urlMap(): Promise<Record<string, string>>;
}

// ── Client-side export (offscreen render) ──────────────────────────
export interface RenderSvgInput {
  svg: string; // full SVG markup of one page
  width: number; // target pixel width (already DPI-scaled by the renderer)
  height: number; // target pixel height
  fontFaceCss?: string; // @font-face rules (data: URIs for custom fonts) injected into the shell
  format?: "jpeg" | "png"; // output encoding of each tile (default jpeg)
  quality?: number; // jpeg quality 0-100 (default 92)
}

// A page is rendered full-size in ONE shot via CDP Page.captureScreenshot (see
// exporter.ts) → `bytes` carries the whole encoded image. Only when a dimension
// exceeds Chromium's 16384px texture cap does the exporter fall back to a few
// large vertical/horizontal bands (`tiles`), which the renderer stitches.
export interface RenderTile {
  x: number; // top-left position of this band within the full page (px)
  y: number;
  w: number; // band pixel size
  h: number;
  bytes: ArrayBuffer; // encoded band image
}

export interface RenderSvgResult {
  width: number; // full page pixel size
  height: number;
  format: "jpeg" | "png"; // encoding of `bytes` / band `tiles`
  bytes?: ArrayBuffer; // the full page as ONE encoded image (common path)
  tiles?: RenderTile[]; // band fallback for pages larger than the texture cap
}

export type MenuEvent =
  | "undo"
  | "redo"
  | "save"
  | "export"
  | "open"
  | "new"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset";

export type UpdateStatus =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

// Every handler returns this; the preload unwraps it (throws on !ok) so the
// renderer sees clean promises. Never throw across the IPC bridge.
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

// The exact surface exposed on window.desktop in the renderer.
export interface DesktopApi {
  getInfo(): Promise<AppInfo>;
  secureStore: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  openExternal(url: string): Promise<void>;
  // Absolute path of a user-picked/dropped File, or "" if it has no on-disk
  // original (blob from Google Photos / clipboard paste). Synchronous.
  getPathForFile(file: File): string;
  dialog: {
    openImages(multi?: boolean): Promise<OpenedImage[]>;
    saveAs(defaultName: string, filters?: Electron.FileFilter[]): Promise<string | null>;
    // Pick a single destination directory (used by multi-file image export so the
    // user is prompted ONCE, not once per page). Returns the chosen absolute path,
    // or null if the picker was cancelled.
    openFolder(title?: string): Promise<string | null>;
  };
  fs: {
    readFileAsBuffer(path: string): Promise<ArrayBuffer>;
    writeFile(path: string, data: ArrayBuffer): Promise<void>;
  };
  assets: {
    save(input: SaveAssetInput): Promise<LocalAsset>;
    list(input: ListAssetsInput): Promise<ListAssetsResult>;
    remove(projectId: string, ids: string[]): Promise<void>;
    setFavorite(projectId: string, id: string, favorite: boolean): Promise<void>;
    // Reference mode: given asset ids, return the subset whose ORIGINAL file is
    // missing on disk. Used to gate order/export (a missing original prints blank).
    checkOriginals(projectId: string, ids: string[]): Promise<string[]>;
  };
  export: {
    renderSvg(input: RenderSvgInput): Promise<RenderSvgResult>;
  };
  fonts: {
    // Returns the cached font bytes for a source URL, or null if not cached yet.
    cacheGet(url: string): Promise<ArrayBuffer | null>;
    // Stores font bytes on disk keyed by the source URL.
    cachePut(url: string, bytes: ArrayBuffer): Promise<void>;
  };
  editorData: EditorDataApi;
  assetsCache: AssetsCacheApi;
  imageCache: ImageCacheApi;
  themePacks: ThemePacksApi;
  checkForUpdate(): Promise<void>;
  onMenu(cb: (event: MenuEvent) => void): () => void;
  onUpdateStatus(cb: (status: UpdateStatus, progress?: number) => void): () => void;
}
