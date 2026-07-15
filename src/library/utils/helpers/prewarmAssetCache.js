// Startup pre-warm for the offline asset catalog cache.
// ─────────────────────────────────────────────────────
// On-demand caching only stores a category once its panel is opened ONLINE — so
// a tab the user never visited has nothing to show offline. This module fetches
// page 1 of every asset catalog in the background while online, so EVERY asset
// tab works offline from the first session (and after a reconnect).
//
// It routes through the same `withAssetCache` helper the panels use, so each
// fetch populates BOTH the exact page-1 key AND the per-category `__latest__`
// fallback. The panels read that same fallback offline (see assetsCache.js
// isDefaultFirstPage), so the pre-warmed data is guaranteed to surface even if a
// panel's live descriptor differs slightly (editor type, canvas size, etc.).
//
// Best-effort and non-blocking: failures are swallowed, it never throws into the
// boot path, and it only runs on desktop (web already has the browser HTTP
// cache). Re-runs on `online` so a machine that booted offline warms up as soon
// as the connection returns.

import { apiPost } from "../common-services/apiCall.js";
import { ENDPOINTS } from "../constants/apiurl.js";
import { EDITOR_ASSETS, EDITOR_TYPES } from "../constants/index.js";
import { isDesktop } from "../../../desktop/index.js";
import { withAssetCache, isOnline } from "./assetsCache.js";

const PAGE_SIZE = 20;

// Themes are intentionally NOT pre-warmed here: their page-1 descriptor depends
// on the live editor type, user role, brand and product — a generic warm could
// cache a payload that doesn't match the panel's request. Themes still cache on
// first ONLINE open of the Themes panel (the normal flow) and the per-category
// `__latest__` fallback covers descriptor drift after that.
//
// Ideas use the same LAYOUT endpoint but filtered to asset_type IDEA. The
// descriptor below mirrors the panel's most common default (single page layout,
// no spread, PHOTO editor type). Descriptor drift across editor types is covered
// by the per-category `__latest__` fallback — the panel's first online open
// always refreshes the exact descriptor.

// Each entry mirrors a panel's DEFAULT page-1 (unfiltered) request so the cached
// payload and key line up with what the panel asks for when first opened. These
// are intentionally the broad, filter-free defaults — `isDefaultFirstPage` in
// assetsCache.js recognises them and also stamps the `__latest__` fallback.
const CATALOGS = [
  {
    category: "backgrounds",
    endpoint: ENDPOINTS.getBackgrounds,
    descriptor: {
      filter: {
        status: 1,
        tagId: null,
        type: EDITOR_ASSETS.BACKGROUND,
        display_in_web: true,
        search: "",
      },
      skip: 0,
      limit: PAGE_SIZE,
    },
  },
  {
    category: "stickers",
    endpoint: ENDPOINTS.getStickers,
    descriptor: {
      filter: {
        status: 1,
        type: EDITOR_ASSETS.STICKER,
        display_in_web: true,
        search: "",
      },
      skip: 0,
      limit: PAGE_SIZE,
    },
  },
  {
    category: "masks",
    endpoint: ENDPOINTS.getMask,
    descriptor: {
      filter: {
        status: 1,
        type: EDITOR_ASSETS.MASK,
        display_in_web: true,
      },
      skip: 0,
      limit: PAGE_SIZE,
    },
  },
  // {
  //   // Clip Art sidebar panel (ClipArtAction). Uses the dedicated getClipArts
  //   // endpoint (distinct from stickers). Mirrors the panel's default page-1
  //   // request; the per-category `__latest__` fallback bridges any key drift (the
  //   // panel's `type` resolves to undefined and is dropped by the clone below).
  //   category: "cliparts",
  //   endpoint: ENDPOINTS.getClipArts,
  //   descriptor: {
  //     filter: {
  //       status: 1,
  //       type: EDITOR_ASSETS.CLIPART,
  //       display_in_web: true,
  //       search: "",
  //     },
  //     skip: 0,
  //     limit: PAGE_SIZE,
  //   },
  // },
  {
    category: "layouts",
    endpoint: ENDPOINTS.getLayouts,
    descriptor: {
      filter: {
        status: { $in: [1, 3] },
        display_in_web: true,
        number_of_layouts: 1,
        spread: false,
        number_of_images: null,
        asset_type: EDITOR_ASSETS.LAYOUT,
      },
      skip: 0,
      limit: PAGE_SIZE,
      sortField: "_id",
      sortOrder: "desc",
    },
  },
  {
    category: "ideas",
    endpoint: ENDPOINTS.getLayouts,
    descriptor: {
      filter: {
        status: { $in: [1, 3] },
        display_in_web: true,
        asset_type: EDITOR_ASSETS.IDEA,
        editor_type: EDITOR_TYPES.PHOTOBOOK,
        number_of_layouts: 1,
        spread: false,
        number_of_images: 1,
      },
      skip: 0,
      limit: PAGE_SIZE,
      sortField: "_id",
      sortOrder: "desc",
    },
  },
];

// `apiPost` MUTATES the descriptor it's given (it injects brand_id into
// `filter`). Pass a deep clone so the cache KEY we compute from the descriptor
// stays the clean, brand-agnostic default the panel also computes its key from —
// otherwise the pre-warmed entry would live under a different key than the
// panel's read. (The panel passes a freshly-built object each call, so its key
// is always the clean one.)
const clone = (v) => JSON.parse(JSON.stringify(v));

const warmOne = async ({ category, endpoint, descriptor }) => {
  try {
    await withAssetCache(category, clone(descriptor), () =>
      apiPost(endpoint, clone(descriptor)),
    );
  } catch (_) {
    /* best-effort — a single category failing must not stop the others */
  }
};

let warming = false;

/**
 * Fetch + cache page 1 of every asset catalog while online. Safe to call
 * repeatedly (guards against overlapping runs). No-op on web or when offline.
 */
export const prewarmAssetCache = async () => {
  if (!isDesktop) return; // web: relies on the browser HTTP cache
  if (warming) return;
  if (!isOnline()) return; // nothing to fetch — the reconnect listener retries
  warming = true;
  try {
    // Sequential, not parallel: pre-warm is a low-priority background task and
    // should not contend with the user's real first fetch for connections.
    for (const cat of CATALOGS) {
      // eslint-disable-next-line no-await-in-loop
      await warmOne(cat);
    }
  } finally {
    warming = false;
  }
};

let installed = false;

/**
 * Install the startup pre-warm: run once now (if online) and re-run whenever the
 * connection is (re)established. Idempotent — safe to call from a boot effect.
 */
export const installAssetCachePrewarm = () => {
  if (!isDesktop || installed) return;
  installed = true;

  // Kick off the initial warm (deferred so it never delays first paint).
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => prewarmAssetCache());
  } else {
    setTimeout(() => prewarmAssetCache(), 1500);
  }

  // Re-warm on reconnect so a machine that booted offline catches up.
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => prewarmAssetCache());
  }
};
