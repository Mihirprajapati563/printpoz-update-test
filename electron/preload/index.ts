import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "../shared/ipc";
import type {
  AppConfig,
  AppInfo,
  ChannelName,
  CustomSizeEntry,
  DesktopApi,
  IpcResult,
  ListAssetsInput,
  ListAssetsResult,
  LocalAsset,
  MenuEvent,
  OpenedImage,
  RenderSvgInput,
  RenderSvgResult,
  SaveAssetInput,
  SavedDesignEntry,
  SavedDesignMeta,
  SavedIdeaEntry,
  SaveThemePackInput,
  ThemePackMeta,
  UpdateStatus,
} from "../shared/ipc";

// Unwrap the IpcResult envelope so the renderer gets clean promises (throws on error).
async function invoke<T>(channel: ChannelName, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!res || res.ok !== true) {
    throw new Error((res && "error" in res && res.error) || "IPC error");
  }
  return res.data;
}

const api: DesktopApi = {
  getInfo: () => invoke<AppInfo>(CHANNELS.appGetInfo),
  secureStore: {
    get: (key) => invoke<string | null>(CHANNELS.secureStoreGet, key),
    set: (key, value) => invoke<void>(CHANNELS.secureStoreSet, key, value),
    delete: (key) => invoke<void>(CHANNELS.secureStoreDelete, key),
  },
  openExternal: (url) => invoke<void>(CHANNELS.authOpenExternal, url),
  // Absolute filesystem path of a user-picked / dropped File (Electron's
  // File.path replacement). Returns "" for blobs with no real on-disk file
  // (Google Photos downloads, clipboard paste) — the caller uses that empty
  // string to route those into the copy fallback instead of the reference model.
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  },
  dialog: {
    openImages: (multi) => invoke<OpenedImage[]>(CHANNELS.dialogOpenImages, multi),
    saveAs: (defaultName, filters) =>
      invoke<string | null>(CHANNELS.dialogSaveAs, defaultName, filters),
    openFolder: (title) => invoke<string | null>(CHANNELS.dialogOpenFolder, title),
  },
  fs: {
    readFileAsBuffer: (path) => invoke<ArrayBuffer>(CHANNELS.fsReadFileAsBuffer, path),
    writeFile: (path, data) => invoke<void>(CHANNELS.fsWriteFile, path, data),
  },
  assets: {
    save: (input: SaveAssetInput) => invoke<LocalAsset>(CHANNELS.assetsSave, input),
    list: (input: ListAssetsInput) => invoke<ListAssetsResult>(CHANNELS.assetsList, input),
    remove: (projectId: string, ids: string[]) =>
      invoke<void>(CHANNELS.assetsRemove, projectId, ids),
    setFavorite: (projectId: string, id: string, favorite: boolean) =>
      invoke<void>(CHANNELS.assetsSetFavorite, projectId, id, favorite),
    checkOriginals: (projectId: string, ids: string[]) =>
      invoke<string[]>(CHANNELS.assetsCheckOriginals, projectId, ids),
  },
  export: {
    renderSvg: (input: RenderSvgInput) =>
      invoke<RenderSvgResult>(CHANNELS.exportRenderSvg, input),
  },
  fonts: {
    cacheGet: (url: string) => invoke<ArrayBuffer | null>(CHANNELS.fontsCacheGet, url),
    cachePut: (url: string, bytes: ArrayBuffer) =>
      invoke<void>(CHANNELS.fontsCachePut, url, bytes),
    cacheHas: (url: string) => invoke<boolean>(CHANNELS.fontsCacheHas, url),
  },
  assetsCache: {
    get: (category: string, key: string) =>
      invoke<unknown | null>(CHANNELS.assetsCacheGet, category, key),
    put: (category: string, key: string, value: unknown) =>
      invoke<void>(CHANNELS.assetsCachePut, category, key, value),
    clear: (category: string) => invoke<void>(CHANNELS.assetsCacheClear, category),
  },
  imageCache: {
    get: (url: string) => invoke<string | null>(CHANNELS.imageCacheGet, url),
    put: (url: string, bytes: ArrayBuffer, mime: string) =>
      invoke<string>(CHANNELS.imageCachePut, url, bytes, mime),
    urlMap: () => invoke<Record<string, string>>(CHANNELS.imageCacheUrlMap),
    evict: (maxAgeMs: number) => invoke<void>(CHANNELS.imageCacheEvict, maxAgeMs),
  },
  editorData: {
    snapshotGet: () => invoke<string | null>(CHANNELS.editorDataSnapshotGet),
    snapshotSet: (json: string) => invoke<void>(CHANNELS.editorDataSnapshotSet, json),
    snapshotClear: () => invoke<void>(CHANNELS.editorDataSnapshotClear),
    historyGet: () => invoke<string | null>(CHANNELS.editorDataHistoryGet),
    historySet: (json: string) => invoke<void>(CHANNELS.editorDataHistorySet, json),
    historyClear: () => invoke<void>(CHANNELS.editorDataHistoryClear),
    designsList: () => invoke<SavedDesignMeta[]>(CHANNELS.editorDataDesignsList),
    designsGet: (id: string) => invoke<SavedDesignEntry | null>(CHANNELS.editorDataDesignsGet, id),
    designsPut: (entry: SavedDesignEntry) => invoke<void>(CHANNELS.editorDataDesignsPut, entry),
    designsDelete: (id: string) => invoke<void>(CHANNELS.editorDataDesignsDelete, id),
    ideasList: () => invoke<SavedIdeaEntry[]>(CHANNELS.editorDataIdeasList),
    ideasPut: (entry: SavedIdeaEntry) => invoke<void>(CHANNELS.editorDataIdeasPut, entry),
    ideasDelete: (id: string) => invoke<void>(CHANNELS.editorDataIdeasDelete, id),
    sizesGet: () => invoke<CustomSizeEntry[]>(CHANNELS.editorDataSizesGet),
    sizesSet: (sizes: CustomSizeEntry[]) => invoke<void>(CHANNELS.editorDataSizesSet, sizes),
  },
  themePacks: {
    list: () => invoke<ThemePackMeta[]>(CHANNELS.themePacksList),
    getThemeJson: (themeId: string) =>
      invoke<string | null>(CHANNELS.themePacksGetThemeJson, themeId),
    hasAsset: (themeId: string, file: string) =>
      invoke<boolean>(CHANNELS.themePacksHasAsset, themeId, file),
    putAsset: (themeId: string, file: string, bytes: ArrayBuffer) =>
      invoke<void>(CHANNELS.themePacksPutAsset, themeId, file, bytes),
    saveManifest: (input: SaveThemePackInput) =>
      invoke<void>(CHANNELS.themePacksSaveManifest, input),
    delete: (themeId: string) => invoke<void>(CHANNELS.themePacksDelete, themeId),
    urlMap: () => invoke<Record<string, string>>(CHANNELS.themePacksUrlMap),
  },
  checkForUpdate: () => invoke<void>(CHANNELS.updateCheck),
  onMenu: (cb: (event: MenuEvent) => void) => {
    const listener = (_: unknown, event: MenuEvent) => cb(event);
    ipcRenderer.on(CHANNELS.menuEvent, listener);
    return () => ipcRenderer.removeListener(CHANNELS.menuEvent, listener);
  },
  onUpdateStatus: (cb: (status: UpdateStatus, progress?: number) => void) => {
    const listener = (_: unknown, status: UpdateStatus, progress?: number) =>
      cb(status, progress);
    ipcRenderer.on(CHANNELS.updateStatus, listener);
    return () => ipcRenderer.removeListener(CHANNELS.updateStatus, listener);
  },
};

// Read config synchronously so renderer modules can use window.__APP_CONFIG__ at import time.
let appConfig: AppConfig | null = null;
try {
  appConfig = ipcRenderer.sendSync(CHANNELS.appGetConfigSync) as AppConfig | null;
} catch {
  appConfig = null;
}

contextBridge.exposeInMainWorld("desktop", api);
contextBridge.exposeInMainWorld("__APP_CONFIG__", appConfig);
