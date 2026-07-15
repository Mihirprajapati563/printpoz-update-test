// Offline-first catalog cache for editor library assets.
// ─────────────────────────────────────────────────────
// The asset panels (layouts, backgrounds, stickers, masks, themes) each fetch a
// paginated listing JSON (`{ items, totalCount }`) from the brand API. This
// helper wraps those fetches so the panels keep working with no connection:
//
//   • ONLINE  → run the real fetch, and on success write the payload THROUGH to
//               a local cache (so a later offline session can replay it).
//   • OFFLINE / API error → the fetch resolves without `items` (apiPost returns
//               `{ error }` instead of throwing), so we transparently return the
//               last-cached payload for that exact query.
//
// When the connection is restored the next fetch succeeds and refreshes the
// cache automatically — no explicit "sync on reconnect" listener needed, since
// every panel already re-fetches when opened / on its refresh signal.
//
// Storage:
//   • DESKTOP: AppData/cache/assets/<category>/<key>.json via the assetsCache
//              IPC channel (durable; survives a wiped browser cache).
//   • WEB:     localStorage key `assetCache:<category>:<key>` (best-effort; the
//              web build already has the browser HTTP cache, so this is a bonus).
//
// This is CATALOG JSON only — the actual image/SVG bytes still load from their
// CDN URLs (Chromium keeps those warm in its own HTTP cache). Shapes are NOT
// here: they are built-in client objects with no server fetch, already offline.
//
// Non-breaking contract: `withAssetCache` resolves to the SAME `{ items,
// totalCount }` shape every caller already expects. On web without any cache it
// behaves exactly like calling the fetcher directly. Cache writes are
// fire-and-forget and never reject into the caller.

import { desktop, isDesktop } from "../../../desktop/index.js";

const WEB_KEY_PREFIX = "assetCache:";

const desktopApi = () =>
  isDesktop && desktop?.assetsCache ? desktop.assetsCache : null;

// One-time boot diagnostic so a stale preload (missing `desktop.assetsCache`,
// the usual cause of "nothing cached offline") is obvious in DevTools. Remove
// once the feature is confirmed working in the field.
let loggedBoot = false;
const logBootOnce = () => {
  if (loggedBoot) return;
  loggedBoot = true;
  try {
    console.info(
      "[assetsCache] boot:",
      JSON.stringify({
        isDesktop,
        hasDesktopBridge: !!desktop,
        hasAssetsCacheApi: !!(desktop && desktop.assetsCache),
        online: isOnline(),
      }),
    );
  } catch (_) {
    /* logging is best-effort */
  }
};

/** Best-effort connectivity check (renderer-side). */
export const isOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine !== false : true;

// A response is a usable success when it carries an `items` array. apiPost never
// throws — on a network/API failure it resolves to `{ error }` (no `items`), so
// this is how we detect "fetch didn't really return data".
const hasItems = (res) => !!res && Array.isArray(res.items);

// ── Stable cache key ─────────────────────────────────────────────────────────
// Build a short, filesystem-safe key from an arbitrary request descriptor
// (filter object / page / search / etc.) so each distinct query caches its own
// page. Order-independent (keys are sorted) and collision-resistant enough for a
// per-category cache. NOT cryptographic — just a stable digest.
const stableStringify = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
};

const hashString = (str) => {
  // FNV-1a 32-bit → base36. Deterministic across sessions and platforms.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
};

/**
 * Compute a deterministic cache key for a query descriptor. Pass any
 * JSON-serializable value (typically the request `filter` plus page/skip/limit).
 */
export const assetCacheKey = (descriptor) => hashString(stableStringify(descriptor));

// Per-category "most recent successful first-page listing" key. The exact
// paginated descriptor can vary between an online session and a later offline
// re-open (useInfiniteScroll's restore-to-page changes skip/limit, search/tag
// filters differ, module-level page counters reset across launches). To
// guarantee the panel shows SOMETHING offline, every page-1 success also writes
// to this stable fallback key, and an offline miss on the exact key falls back to
// it. `__latest__` can't collide with a hash (safeSegment keeps the underscores).
const LATEST_KEY = "__latest__";

// True when this descriptor represents the first page of an UNFILTERED listing —
// the canonical "default view" we replay offline when the exact page isn't cached.
const isDefaultFirstPage = (descriptor) => {
  if (!descriptor || typeof descriptor !== "object") return false;
  const skip = descriptor.skip;
  const f = descriptor.filter || {};
  const noSkip = skip == null || skip === 0;
  const noSearch = !f.search;
  const noTag = f.tagId == null || (Array.isArray(f.tagId) && f.tagId.length === 0);
  return noSkip && noSearch && noTag;
};

// ── Low-level read / write (desktop IPC or web localStorage) ─────────────────

const readCache = async (category, key) => {
  logBootOnce();
  const api = desktopApi();
  if (api) {
    try {
      return await api.get(category, key);
    } catch (err) {
      return null;
    }
  }
  // Web fallback.
  try {
    const raw = localStorage.getItem(`${WEB_KEY_PREFIX}${category}:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const writeCache = (category, key, value) => {
  logBootOnce();
  const api = desktopApi();
  if (api) {
    // Fire-and-forget; a failed cache write must never break the online path.
    api.put(category, key, value).then(
      () => console.debug("[assetsCache] wrote", category, key, (value.items || []).length, "items"),
      (err) => {},
    );
    return;
  }
  try {
    localStorage.setItem(
      `${WEB_KEY_PREFIX}${category}:${key}`,
      JSON.stringify(value),
    );
  } catch (_) {
    // Quota exceeded / storage unavailable — drop silently. The web build still
    // has the browser HTTP cache, so this is non-essential.
  }
};

// ── Direct cache access (no fetch) ───────────────────────────────────────────
// For callers that want a strict CACHE-FIRST strategy (use the local copy if we
// have one, and only hit the network when we don't) rather than withAssetCache's
// refresh-on-every-success behaviour. Pass a STABLE string key (not a hashed
// descriptor) so the same store is reused across sessions.
export const readAssetCache = (category, key) => readCache(category, key);
export const writeAssetCache = (category, key, value) =>
  writeCache(category, key, value);

/**
 * Run an asset listing fetch with offline-first caching.
 *
 * @param {string}  category   one of: "layouts" | "backgrounds" | "stickers" |
 *                             "masks" | "themes" (free-form; namespaces the cache)
 * @param {object}  descriptor JSON-serializable query descriptor (used as the
 *                             cache key — include everything that changes the
 *                             result: filter, page, skip, limit, search, …)
 * @param {() => Promise<{items:any[], totalCount:number}>} fetcher the existing
 *                             API call, unchanged.
 * @returns {Promise<{items:any[], totalCount:number, fromCache:boolean}>}
 *          The normal `{ items, totalCount }` plus a `fromCache` flag callers may
 *          ignore. Falls back to the cached payload when the fetch returns no
 *          items; resolves to `{ items: [], totalCount: 0 }` if there is also no
 *          cache (identical to today's empty-panel behavior).
 */
export const withAssetCache = async (category, descriptor, fetcher) => {
  const key = assetCacheKey(descriptor);

  let res = null;
  try {
    res = await fetcher();
  } catch (_) {
    res = null; // defensive — fetchers shouldn't throw, but never let it bubble
  }

  if (hasItems(res)) {
    // Online success → refresh the cache for this query and return as-is.
    const payload = { items: res.items, totalCount: res.totalCount || 0 };
    writeCache(category, key, payload);
    // Also stamp the per-category fallback so an offline re-open always has a
    // default list to show even if the exact paginated descriptor differs.
    if (isDefaultFirstPage(descriptor) && payload.items.length > 0) {
      writeCache(category, LATEST_KEY, payload);
    }
    return { ...res, items: payload.items, totalCount: payload.totalCount, fromCache: false };
  }

  // No items came back (offline / API error) → serve the last cached payload for
  // this exact query.
  const cached = await readCache(category, key);
  if (cached && Array.isArray(cached.items)) {
    return {
      items: cached.items,
      totalCount: cached.totalCount || cached.items.length,
      fromCache: true,
    };
  }

  // Exact key not cached (e.g. a paginated/filtered descriptor we never stored
  // online). Fall back to the per-category default listing so the panel still
  // renders offline instead of showing an empty grid. Only do this for the
  // default first-page view — a deeper page / active filter legitimately has no
  // offline data, and replaying the default there would look wrong.
  if (isDefaultFirstPage(descriptor)) {
    const latest = await readCache(category, LATEST_KEY);
    if (latest && Array.isArray(latest.items)) {
      return {
        items: latest.items,
        totalCount: latest.totalCount || latest.items.length,
        fromCache: true,
      };
    }
  }

  // Nothing cached either — preserve the original empty-result shape so callers
  // behave exactly as they do today (their `if (response.items)` guard skips).
  return { items: [], totalCount: 0, fromCache: false };
};

/**
 * Offline-first wrapper for a single-object detail fetch (e.g. getThemeById)
 * whose success/empty signal isn't an `items` array. `isValid(result)` decides
 * whether the fetch succeeded; on success the result is cached, on failure the
 * cache is replayed.
 *
 * @returns the fetched value (cached on success), the cached value when the
 *          fetch fails offline, or null when neither is available.
 */
export const withAssetDetailCache = async (category, descriptor, fetcher, isValid) => {
  const key = assetCacheKey(descriptor);

  let res = null;
  try {
    res = await fetcher();
  } catch (_) {
    res = null;
  }

  const ok = typeof isValid === "function" ? isValid(res) : res != null;
  if (ok) {
    writeCache(category, key, res);
    return res;
  }

  const cached = await readCache(category, key);
  return cached != null ? cached : null;
};
