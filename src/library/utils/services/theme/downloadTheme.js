// Offline theme download orchestrator (desktop only).
// ───────────────────────────────────────────────────
// Pulls a full theme (every size variant + all referenced assets) onto disk so
// it can be browsed, size-selected and edited with no network. Pure client-side:
// it only uses the existing getTheme endpoint + the CDN urls in the payload.
//
// Flow (see the offline-theme-download plan):
//   1. fetch the FULL detail (no size filter → all variants)
//   2. enumerate every remote asset url (walk each variant's decompressed pages
//      + the theme metadata); classify image vs font
//   3. download binaries with bounded concurrency → themePacks.putAsset()
//      (fonts warm the existing font cache instead)
//   4. persist theme.json + manifest via themePacks.saveManifest()
//   5. rebuild the offline url map so the assets resolve from disk immediately
//
// Everything is best-effort per asset: a failed asset marks the pack incomplete
// (still openable offline — missing images fall back to their CDN url) and is
// re-tried on the next download (putAsset is idempotent / resumes).

import { ENDPOINTS } from "../../constants/apiurl.js";
import { apiPost } from "../../common-services/apiCall.js";
import { decompressFromBase64 } from "../../common-functions/index.js";
import { assetCacheKey } from "../../helpers/assetsCache.js";
import {
  isThemePacksSupported,
  refreshThemePackUrlMap,
  listThemePacks,
} from "../../helpers/themePacks.js";
import { desktop } from "../../../../desktop/index.js";
import { getUserDetails } from "./index.js";

const DOWNLOAD_CONCURRENCY = 5;

const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i;
const FONT_EXT_RE = /\.(woff2?|ttf|otf|eot)(?:[?#]|$)/i;
const isHttp = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

/** True when offline download is available (desktop + bridge present). */
export const isThemeDownloadSupported = () => isThemePacksSupported();

// Recursively collect every remote http(s) string in an arbitrary JSON tree.
const collectUrls = (node, out) => {
  if (!node) return;
  if (typeof node === "string") {
    if (isHttp(node)) out.add(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectUrls(v, out);
    return;
  }
  if (typeof node === "object") {
    for (const k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) collectUrls(node[k], out);
    }
  }
};

// Walk the raw getTheme response: metadata + each variant's DECOMPRESSED pages
// (pages_c itself is a compressed string, so it must be expanded to find urls).
const enumerateAssets = (raw) => {
  const items = raw && raw.items;
  if (!items) return { imageUrls: [], fontUrls: [], thumbnailUrl: null };

  const urls = new Set();
  collectUrls(items.theme_images, urls);

  if (Array.isArray(items.theme)) {
    for (const variant of items.theme) {
      // Walk the variant's non-pages fields (settings/cal_settings backgrounds…).
      const { pages_c, ...rest } = variant || {};
      collectUrls(rest, urls);
      try {
        if (pages_c) collectUrls(decompressFromBase64(pages_c), urls);
      } catch (_) {
        /* a corrupt/empty variant just contributes no urls */
      }
    }
  }

  const imageUrls = [];
  const fontUrls = [];
  for (const u of urls) {
    if (FONT_EXT_RE.test(u)) fontUrls.push(u);
    // Every other remote url is an IMAGE CANDIDATE — we do NOT gate on a file
    // extension here. Many CDN/S3 image urls (backgrounds, stickers, masks,
    // the thumbnail) have no extension; gating on IMG_EXT_RE silently dropped
    // them, leaving the theme broken offline. Non-images are filtered out at
    // download time by their Content-Type (downloadImage), so junk isn't stored.
    else imageUrls.push(u);
  }

  // The card thumbnail (already in imageUrls if remote) — recorded so it can be
  // resolved to its local copy for the offline grid.
  const thumbnailUrl =
    (Array.isArray(items.theme_images) && items.theme_images[0]?.url) || null;

  return { imageUrls, fontUrls, thumbnailUrl };
};

const imageExtFromUrl = (url) => {
  const m = IMG_EXT_RE.exec(url);
  if (!m) return null;
  const e = m[1].toLowerCase();
  return e === "jpeg" ? "jpg" : e;
};

const imageExtFromContentType = (ct) => {
  if (!ct) return null;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return null;
};

// Deterministic, filesystem-safe file name (hash of the url + an image ext).
// Same FNV the offline url-map keys on, so on-disk name ↔ map entry always agree.
const fileFor = (url, ext) => `${assetCacheKey(url)}.${ext}`;

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
};

// Candidate extensions to probe when a url has no extension of its own, so a
// resume still finds the copy written last run under its Content-Type-derived
// extension (e.g. an extension-less url stored as "<hash>.png").
const PROBE_EXTS = ["jpg", "png", "webp", "svg", "gif", "avif"];

// Find an already-downloaded file for this url (resume / dedupe). For an
// extension-ful url it's a single probe; for an extension-less one we probe the
// candidate extensions so the actual stored file (whatever ext it got) is found.
const findExistingAssetFile = async (themeId, url) => {
  const known = imageExtFromUrl(url);
  const exts = known ? [known] : PROBE_EXTS;
  for (const e of exts) {
    const file = fileFor(url, e);
    // eslint-disable-next-line no-await-in-loop
    if (await desktop.themePacks.hasAsset(themeId, file)) return file;
  }
  return null;
};

// Download one image asset → write it into the pack. Idempotent (skips on-disk
// files) and content-type aware (silently skips non-image urls).
const downloadImage = async (themeId, url, thumbnailUrl, signal) => {
  throwIfAborted(signal);

  const existing = await findExistingAssetFile(themeId, url);
  if (existing) return { url, file: existing, bytes: 0 };

  const res = await fetch(url, { cache: "force-cache", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  // Decide the on-disk extension. If this isn't an image at all (no url ext AND
  // a non-image Content-Type), skip it rather than storing junk — the thumbnail
  // falls back to jpg so the card image is always captured.
  const ext =
    imageExtFromUrl(url) ||
    imageExtFromContentType(ct) ||
    (url === thumbnailUrl ? "jpg" : null);
  if (!ext) return { url, skipped: true, bytes: 0 };

  const buffer = await res.arrayBuffer();
  const file = fileFor(url, ext);
  await desktop.themePacks.putAsset(themeId, file, buffer);
  return { url, file, bytes: buffer.byteLength };
};

// Warm one font into the EXISTING on-disk font cache (keyed by url) so text
// renders offline. Failures are non-fatal (font falls back at editor load).
const warmFont = async (url, signal) => {
  throwIfAborted(signal);
  if (!desktop?.fonts?.cachePut) return { url, bytes: 0 };
  const res = await fetch(url, { cache: "force-cache", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  await desktop.fonts.cachePut(url, buffer);
  return { url, bytes: buffer.byteLength };
};

// Bounded-concurrency runner. A failing item resolves to `{ error }` (never
// rejects the whole run) and `onTick` fires once per settled item for progress.
const runPool = async (items, worker, concurrency, onTick, signal) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runOne = async () => {
    while (cursor < items.length) {
      throwIfAborted(signal);
      const idx = cursor++;
      try {
        results[idx] = await worker(items[idx]);
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        results[idx] = { error: String(err?.message || err), url: items[idx] };
      }
      onTick(results[idx]);
    }
  };
  const lanes = Array.from(
    { length: Math.min(concurrency, items.length) },
    runOne,
  );
  await Promise.all(lanes);
  return results;
};

/**
 * Download a theme for offline use.
 *
 * @param {object} theme  the theme card object (needs at least `_id`, `name`)
 * @param {{ onProgress?: (p) => void, signal?: AbortSignal }} [opts]
 *        onProgress receives `{ name, total, done, failed, bytes }` per asset.
 * @returns {Promise<{ themeId, total, done, failed, bytes, complete }>}
 */
export const downloadThemeForOffline = async (theme, opts = {}) => {
  if (!isThemeDownloadSupported()) {
    throw new Error("Offline download is only available in the desktop app.");
  }
  const { onProgress, signal } = opts;
  const themeId = theme?._id;
  if (!themeId) throw new Error("Missing theme id.");

  const user = getUserDetails();

  // 1. Full detail — NO size filter so the server returns every variant.
  const raw = await apiPost(ENDPOINTS.getThemeById, {
    _id: themeId,
    user_type_code: user ? user.userTypeCode ?? null : null,
  });
  if (!raw || raw.status === 0 || !raw.items) {
    throw new Error("Couldn't fetch this theme's details.");
  }
  const items = raw.items;

  // 2. Enumerate assets + compute the content fingerprint.
  const { imageUrls, fontUrls, thumbnailUrl } = enumerateAssets(raw);
  const total = imageUrls.length + fontUrls.length;
  const fingerprint = assetCacheKey(
    (Array.isArray(items.theme) ? items.theme : []).map((v) => v.pages_c || ""),
  );

  // If a pack already exists for this theme but its content changed (different
  // fingerprint), wipe it first so we never serve stale on-disk bytes for an
  // asset url that stayed the same. `createdFresh` also drives abort cleanup
  // below — a brand-new or just-wiped pack with no manifest must not leak its
  // partial bytes if the user cancels.
  const existingPack = (await listThemePacks()).find((p) => p.themeId === themeId);
  const isStale = !!(
    existingPack &&
    existingPack.fingerprint &&
    existingPack.fingerprint !== fingerprint
  );
  if (isStale) {
    try {
      await desktop.themePacks.delete(themeId);
    } catch (_) {
      /* best-effort; a failed wipe just means resume keeps old assets */
    }
  }
  const createdFresh = !existingPack || isStale;

  let done = 0;
  let failed = 0;
  let bytes = 0;
  const tick = (r) => {
    done += 1;
    if (r?.error) failed += 1;
    else if (r?.bytes) bytes += r.bytes;
    onProgress?.({ name: theme.name, total, done, failed, bytes });
  };
  onProgress?.({ name: theme.name, total, done: 0, failed: 0, bytes: 0 });

  try {
    // 3. Download images, then warm fonts (both bounded).
    const imageResults = await runPool(
      imageUrls,
      (u) => downloadImage(themeId, u, thumbnailUrl, signal),
      DOWNLOAD_CONCURRENCY,
      tick,
      signal,
    );
    await runPool(
      fontUrls,
      (u) => warmFont(u, signal),
      DOWNLOAD_CONCURRENCY,
      tick,
      signal,
    );

    const assets = imageResults
      .filter((r) => r && r.file && !r.error)
      .map((r) => ({ url: r.url, file: r.file }));

    // 4. Persist. theme.json is the raw response (offline-open source); the
    //    manifest carries the url→file map, variants and the version key.
    const sizes = (Array.isArray(items.theme) ? items.theme : []).map((v) => ({
      size: v.size || `${v.width}x${v.height}`,
      width: Number(v.width) || 0,
      height: Number(v.height) || 0,
      dpi: v.dpi != null ? Number(v.dpi) : null,
      orientation: v.orientation ?? null,
    }));

    await desktop.themePacks.saveManifest({
      themeId,
      name: theme.name || items.name || "Untitled theme",
      category: items.editor_type ?? theme.editor_type ?? null,
      version: items.updatedAt != null ? String(items.updatedAt) : null,
      fingerprint,
      sizes,
      assets,
      fontUrls,
      thumbnailUrl,
      downloadedAt: Date.now(),
      totalBytes: bytes,
      complete: failed === 0,
      themeJson: JSON.stringify(raw),
    });

    // 5. Make the new pack's assets resolve from disk immediately.
    await refreshThemePackUrlMap();

    return { themeId, total, done, failed, bytes, complete: failed === 0 };
  } catch (err) {
    // Cancelled (or hard-failed) before a manifest was written: a fresh/just-
    // wiped pack has orphaned asset bytes with no index entry, unreachable from
    // the UI. Reclaim them. An existing (unchanged) pack is left intact — we
    // only added/skipped assets, so it stays valid and openable.
    if (createdFresh) {
      try {
        await desktop.themePacks.delete(themeId);
        await refreshThemePackUrlMap();
      } catch (_) {
        /* best-effort cleanup */
      }
    }
    throw err;
  }
};
