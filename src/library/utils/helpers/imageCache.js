// Offline image-blob cache
// ────────────────────────
// Stores remote image bytes as base64 data-URLs in the "image_cache" IndexedDB
// object store so they can be served without a network connection.
//
// API
//   resolveImageUrl(url)         → Promise<string>  (data-URL when cached, original URL otherwise)
//   cacheImageUrl(url)           → Promise<void>    (fetch + store; no-op when already cached)
//   getCachedImageUrl(url)       → Promise<string|null>
//   clearOldImageCache(maxAgeMs) → Promise<void>    (evict entries older than maxAgeMs)
//
// The caller does NOT need to know about IndexedDB; resolveImageUrl is the
// primary entry point. It is safe to call for any URL — remote, data:, blob:,
// relative — and will pass non-http URLs straight through.

import { idbGet, idbAvailable } from "./idb.js";
import { isOnline } from "./assetsCache.js";
import { desktop, isDesktop } from "../../../desktop/index.js";

const STORE = "image_cache";

// Max age for cached images before we evict them (7 days)
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory map of url → data-URL for the lifetime of the page so we never
// hit IDB twice for the same asset in one session.
const memCache = new Map();

// FNV-1a 32-bit hash → base36 (same algo as assetsCache.js assetCacheKey)
const hashUrl = (url) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return "img_" + h.toString(36);
};

/** True when the url is a remote http(s) asset we can fetch + cache. */
const isRemoteUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("http://") || url.startsWith("https://"));

// ── Offline theme-pack resolution ────────────────────────────────────────────
// A downloaded theme pack maps each original CDN url → an `app-assets://` url
// pointing at the on-disk copy. The map is built once at boot (and after each
// download/delete) by themePacks.js calling setThemePackUrlMap(). When a url is
// in the map we serve the local copy directly — both online (faster, zero CDN
// round-trip) and offline (the whole point). themePacks.js owns the IPC; this
// module just consults the plain lookup object so there is no import cycle.
let themePackUrlMap = null;

/** Replace the original-url → app-assets-url lookup (plain object). */
export const setThemePackUrlMap = (mapObj) => {
  themePackUrlMap =
    mapObj && typeof mapObj === "object" && !Array.isArray(mapObj) ? mapObj : null;
};

const themePackLocalUrl = (url) =>
  themePackUrlMap && Object.prototype.hasOwnProperty.call(themePackUrlMap, url)
    ? themePackUrlMap[url]
    : null;

// ── Desktop AppData image cache ───────────────────────────────────────────────
// On desktop the actual image BYTES live in AppData (userData/cache/images) via
// the imageCache IPC bridge — durable, survives a wiped browser cache, and served
// back as `app-assets://image-cache/<hash>.<ext>` urls. This is what makes remote
// previews/thumbnails (theme previews, background/sticker/mask panels) render
// with no connection. We keep a boot-loaded in-memory map (original url →
// app-assets url) so an offline resolve is synchronous, exactly like the
// theme-pack map above. The WEB build keeps the IndexedDB data-URL path below.
const imgCacheApi = () =>
  isDesktop && desktop?.imageCache ? desktop.imageCache : null;

let imageCacheUrlMap = null;

/** Replace the desktop original-url → app-assets-url lookup (plain object). */
export const setImageCacheUrlMap = (mapObj) => {
  imageCacheUrlMap =
    mapObj && typeof mapObj === "object" && !Array.isArray(mapObj) ? mapObj : null;
};

const imageCacheLocalUrl = (url) =>
  imageCacheUrlMap && Object.prototype.hasOwnProperty.call(imageCacheUrlMap, url)
    ? imageCacheUrlMap[url]
    : null;

// Record a freshly-cached url→app-assets mapping into the in-memory map so the
// next resolve is an instant hit (creating the map lazily on first write).
const rememberImageCacheUrl = (url, appUrl) => {
  if (!appUrl) return;
  if (!imageCacheUrlMap) imageCacheUrlMap = {};
  imageCacheUrlMap[url] = appUrl;
};

/**
 * Rebuild the desktop image-cache url map from disk into memory. Call at boot and
 * on reconnect so offline previews resolve synchronously. No-op (empty) on web.
 */
export const refreshImageCacheUrlMap = async () => {
  const api = imgCacheApi();
  if (!api) {
    setImageCacheUrlMap(null);
    return {};
  }
  try {
    const map = (await api.urlMap()) || {};
    setImageCacheUrlMap(map);
    return map;
  } catch (_) {
    setImageCacheUrlMap(null);
    return {};
  }
};

/** Boot alias — build the desktop image-cache url map once on startup. */
export const initImageCacheUrlMap = refreshImageCacheUrlMap;

// ── Low-level IDB helpers (direct, not through the shared withStore wrapper) ──
// We open the same DB that idb.js manages; because idb.js bumped DB_VERSION to
// include "image_cache" we can just call ipcRenderer through the same handle.
// Rather than duplicating the openDB logic we use a thin direct IDB open here
// that stays scoped to the image_cache store.

let _db = null;
const openImageDB = () => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    // Open the SAME database that idb.js uses. Version must match DB_VERSION in
    // idb.js (currently 2). If idb.js is upgraded, bump this too.
    const req = indexedDB.open("printpoz_local", 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("designs_meta")) {
        db.createObjectStore("designs_meta", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("designs_payload")) {
        db.createObjectStore("designs_payload", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
};

const idbImageGet = async (key) => {
  try {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      tx.oncomplete = () => resolve(req.result ?? null);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    return null;
  }
};

const idbImagePut = async (record) => {
  try {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
  }
};

const idbImageGetAll = async () => {
  try {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => resolve(req.result ?? []);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    return [];
  }
};

const idbImageDelete = async (key) => {
  try {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
  }
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch the remote URL and store its bytes as a base64 data-URL in IDB.
 * No-op if already cached or if the URL is not a remote http(s) URL.
 * Fire-and-forget — never rejects into the caller.
 */
export const cacheImageUrl = async (url) => {
  if (!isRemoteUrl(url)) return;

  // A downloaded theme-pack asset is already on disk — nothing to fetch/store.
  if (themePackLocalUrl(url)) return;

  // Desktop: persist the bytes to AppData (userData/cache/images) via IPC instead
  // of the IndexedDB data-URL cache. Best-effort: on any failure we simply keep
  // using the CDN url (online), so a CORS/network error never breaks display.
  const api = imgCacheApi();
  if (api) {
    if (imageCacheLocalUrl(url)) return; // already cached this session
    if (!isOnline()) return; // can't fetch offline — the reconnect warm will get it
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return;
      const mime = res.headers.get("content-type") || "";
      const buffer = await res.arrayBuffer();
      const appUrl = await api.put(url, buffer, mime);
      rememberImageCacheUrl(url, appUrl);
    } catch (err) {
      console.debug("[imageCache] desktop put failed for", url, err?.message);
    }
    return;
  }

  const key = hashUrl(url);
  if (memCache.has(key)) return; // already in memory

  // Check IDB first (avoids redundant network fetch on hot pages)
  try {
    const existing = await idbImageGet(key);
    if (existing?.dataUrl) {
      memCache.set(key, existing.dataUrl);
      return;
    }
  } catch (_) {
    /* IDB miss — fall through to fetch */
  }

  // Only fetch when online — we don't want to log network errors when offline
  if (!isOnline()) return;

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return;

    const mimeType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    // Convert ArrayBuffer → base64 data-URL
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    memCache.set(key, dataUrl);
    // Fire-and-forget write; don't await so the caller returns fast
    idbImagePut({ id: key, dataUrl, mimeType, cachedAt: Date.now(), originalUrl: url });
  } catch (err) {
    // Silently ignore — network unavailable, CORS, etc. The original URL will
    // still be used; the image just won't display offline until cached.
    console.debug("[imageCache] cacheImageUrl failed for", url, err?.message);
  }
};

/**
 * Return the locally-cached data-URL for `url`, or null if not cached.
 * Fast — checks in-memory map first, then IDB.
 */
export const getCachedImageUrl = async (url) => {
  if (!isRemoteUrl(url)) return null;

  // A downloaded theme pack always wins — the bytes are on disk under app-assets.
  const packUrl = themePackLocalUrl(url);
  if (packUrl) return packUrl;

  // Desktop: consult the in-memory AppData map, then fall back to a direct IPC
  // lookup (covers bytes cached earlier this session before the map was rebuilt).
  const api = imgCacheApi();
  if (api) {
    const mapped = imageCacheLocalUrl(url);
    if (mapped) return mapped;
    try {
      const appUrl = await api.get(url);
      if (appUrl) {
        rememberImageCacheUrl(url, appUrl);
        return appUrl;
      }
    } catch (_) {
      /* fall through to null */
    }
    return null;
  }

  const key = hashUrl(url);

  if (memCache.has(key)) return memCache.get(key);

  try {
    const record = await idbImageGet(key);
    if (record?.dataUrl) {
      memCache.set(key, record.dataUrl);
      return record.dataUrl;
    }
  } catch (_) {
    /* miss */
  }
  return null;
};

/**
 * Resolve a URL to its cached local equivalent when offline, or start caching
 * it when online. Always returns a usable URL string.
 *
 *   - Online  : returns the original URL as-is + kicks off a background cache write
 *   - Offline : returns the cached data-URL if available, else the original URL
 *               (which will fail to load, same as before — but gracefully)
 */
export const resolveImageUrl = async (url) => {
  if (!isRemoteUrl(url)) return url; // data:, blob:, relative, etc. — pass through

  // Serve a downloaded theme-pack asset straight from disk (works on/offline).
  const packUrl = themePackLocalUrl(url);
  if (packUrl) return packUrl;

  // Desktop: a locally-cached copy (AppData) always wins — online (faster, skips
  // the CDN round-trip) and offline (the whole point). Otherwise warm it while
  // online; when offline, serve whatever was cached (or fall back to the CDN url).
  const api = imgCacheApi();
  if (api) {
    const mapped = imageCacheLocalUrl(url);
    if (mapped) return mapped;
    if (isOnline()) {
      cacheImageUrl(url); // fire-and-forget write to AppData
      return url;
    }
    const cached = await getCachedImageUrl(url);
    return cached ?? url;
  }

  if (isOnline()) {
    // Background-cache while online so next offline session works
    cacheImageUrl(url); // fire-and-forget
    return url;
  }

  // Offline: return cached or fall back to original (will show broken image)
  const cached = await getCachedImageUrl(url);
  return cached ?? url;
};

/**
 * Evict cache entries older than `maxAgeMs` milliseconds.
 * Call from a startup effect to keep IDB from growing unbounded.
 */
export const clearOldImageCache = async (maxAgeMs = DEFAULT_MAX_AGE_MS) => {
  // Desktop: evict old entries from the AppData image cache via IPC.
  const api = imgCacheApi();
  if (api) {
    try {
      await api.evict(maxAgeMs);
    } catch (err) {
    }
    return;
  }

  try {
    const records = await idbImageGetAll();
    const cutoff = Date.now() - maxAgeMs;
    const stale = records.filter((r) => r.cachedAt < cutoff);
    for (const r of stale) {
      await idbImageDelete(r.id);
      memCache.delete(r.id);
    }
    if (stale.length > 0) {
      console.debug("[imageCache] evicted", stale.length, "stale entries");
    }
  } catch (err) {
  }
};
