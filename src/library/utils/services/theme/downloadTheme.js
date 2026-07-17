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
//
// RESUME (why this file never deletes bytes)
// ------------------------------------------
// A download is interruptible: the network can drop, the user can navigate away,
// the app can be killed. In every one of those cases the bytes already on disk
// are the whole value — throwing them away means the user re-downloads a theme
// they already paid for in bandwidth. So this module NEVER deletes a pack on
// failure. Instead it CHECKPOINTS: `assets` accumulates per-item inside `tick`
// (not at the end from the pool's return value, which an abort never reaches),
// and `persist(complete)` writes what we have so far. saveManifest is additive
// on the main side, so a checkpoint can never truncate an earlier run's record.
//
// A later run then resumes for free: findExistingAssetFile short-circuits every
// asset already on disk and fonts.cacheHas skips warmed fonts, so only the
// remainder transfers.
//
// The one deletion that remains is the STALE wipe (the theme's content genuinely
// changed server-side), and even that is gated on being online — never destroy
// bytes you can't re-fetch.

import { ENDPOINTS } from "../../constants/apiurl.js";
import { apiPost } from "../../common-services/apiCall.js";
import { decompressFromBase64 } from "../../common-functions/index.js";
import { assetCacheKey, isOnline } from "../../helpers/assetsCache.js";
import {
  isThemePacksSupported,
  refreshThemePackUrlMap,
  listThemePacks,
  addThemePackOwner,
} from "../../helpers/themePacks.js";
import { desktop } from "../../../../desktop/index.js";
import { getUserDetails } from "./index.js";

const DOWNLOAD_CONCURRENCY = 5;

// Checkpoint the manifest every N settled assets, so a hard kill (power loss,
// SIGKILL) loses at most this many assets' INDEX entries — the bytes themselves
// are already on disk and rejoin the manifest on the next resume.
const CHECKPOINT_EVERY = 25;

// The server has permanently lost these — retrying can only ever 404 again, so
// they're recorded and excluded from the completeness test. Without this, one
// dead CDN url would pin a pack at `complete: false` forever and nag the user to
// Resume a download that can never finish.
//
// 403 is deliberately NOT here: S3/CloudFront return it both for a denied object
// AND for an expired signature. Treating it as a normal failure means the next
// run re-fetches getThemeById, mints a fresh signed url, and self-heals.
const PERMANENT_STATUS = new Set([404, 410]);

const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i;
const FONT_EXT_RE = /\.(woff2?|ttf|otf|eot)(?:[?#]|$)/i;
const isHttp = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

// Always go to the network for a download, never to Chromium's HTTP cache.
//
// This is NOT a perf preference — `cache: "force-cache"` here was a real bug.
// The CDN only returns `Access-Control-Allow-Origin` when a request carries an
// `Origin` header. An <img>/CSS background-image loads an asset WITHOUT one, so
// the response Chromium caches has no ACAO. force-cache then made this
// (CORS-mode) fetch reuse that exact entry, and the CORS check failed with a
// bare `TypeError` — meaning the ONE asset shown in the UI before you press
// Download, the theme's own card thumbnail, was the ONE asset that could never
// download. One failed asset pins `complete: failed === 0` at false, so every
// theme sat on "Resume" forever and the pack's thumbnail was always blank.
//
// Nothing is lost by skipping the cache: resume works off what's ON DISK
// (findExistingAssetFile / fonts.cacheHas), never off the HTTP cache.
const FETCH_OPTS = { cache: "reload" };

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

// Last-resort: identify an image from its own bytes. Needed because an S3 object
// uploaded without an explicit ContentType is served as `binary/octet-stream`,
// and if its key also has no extension the header tells us nothing — the asset
// would be dropped as junk and silently missing from the offline theme. The
// bytes never lie, so sniff them before giving up.
const imageExtFromBytes = (buffer) => {
  const b = new Uint8Array(buffer);
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  // RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "webp";
  }
  // ....ftypavif
  if (
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
    b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66
  ) {
    return "avif";
  }
  // SVG is text: look for an <svg or an xml prolog in the first bytes only.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(b.subarray(0, Math.min(b.length, 256)))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "svg";
  }
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
  try {
    for (const e of exts) {
      const file = fileFor(url, e);
      // eslint-disable-next-line no-await-in-loop
      if (await desktop.themePacks.hasAsset(themeId, file)) return file;
    }
  } catch (_) {
    // A failed probe must not fail the ASSET — fall through and re-fetch it.
    // putAsset no-ops if the bytes are in fact already there, and the manifest
    // union keeps the existing entry, so the worst case is one wasted request.
  }
  return null;
};

// Download one image asset → write it into the pack. Idempotent (skips on-disk
// files) and content-type aware (silently skips non-image urls).
const downloadImage = async (themeId, url, thumbnailUrl, signal) => {
  throwIfAborted(signal);

  const existing = await findExistingAssetFile(themeId, url);
  if (existing) return { url, file: existing, bytes: 0 };

  const res = await fetch(url, { ...FETCH_OPTS, signal });
  if (!res.ok) {
    // Gone for good → record it and move on; anything else is worth a retry.
    if (PERMANENT_STATUS.has(res.status)) return { url, missing: true, bytes: 0 };
    throw new Error(`HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  // Decide the on-disk extension. enumerateAssets deliberately treats EVERY
  // non-font url as an image candidate (many CDN image urls carry no extension),
  // so this is also where genuine non-images get filtered back out.
  const headerExt =
    imageExtFromUrl(url) ||
    imageExtFromContentType(ct) ||
    (url === thumbnailUrl ? "jpg" : null);

  const buffer = await res.arrayBuffer();
  // Neither the url nor the header identified it — ask the bytes before writing
  // it off. Without this, a real background served as binary/octet-stream from
  // an extension-less key is dropped silently: not stored, not counted as
  // failed, so the pack still reports complete and just renders a hole offline.
  const ext = headerExt || imageExtFromBytes(buffer);
  if (!ext) return { url, skipped: true, bytes: 0 };

  const file = fileFor(url, ext);
  await desktop.themePacks.putAsset(themeId, file, buffer);
  return { url, file, bytes: buffer.byteLength };
};

// Warm one font into the EXISTING on-disk font cache (keyed by url) so text
// renders offline. Failures are non-fatal (font falls back at editor load).
const warmFont = async (url, signal) => {
  throwIfAborted(signal);
  if (!desktop?.fonts?.cachePut) return { url, bytes: 0 };
  // Already warmed by an earlier (possibly interrupted) run — skip the transfer.
  // A boolean probe, so resuming a font-heavy theme costs nothing.
  try {
    if (desktop.fonts.cacheHas && (await desktop.fonts.cacheHas(url))) {
      return { url, bytes: 0 };
    }
  } catch (_) {
    /* probe failed — just re-warm it (cachePut is idempotent) */
  }
  const res = await fetch(url, { ...FETCH_OPTS, signal });
  if (!res.ok) {
    if (PERMANENT_STATUS.has(res.status)) return { url, missing: true, bytes: 0 };
    throw new Error(`HTTP ${res.status}`);
  }
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
 * Download a theme for offline use — or RESUME one that was interrupted.
 *
 * There is no separate resume entry point: this function is idempotent, so
 * calling it again on a partial pack simply transfers whatever is still missing.
 *
 * @param {object} theme  the theme card object (needs at least `_id`, `name`)
 * @param {{ onProgress?: (p) => void, signal?: AbortSignal }} [opts]
 *        onProgress receives `{ name, total, done, failed, bytes }` per asset.
 *        On a resume, `done` climbs almost instantly through the assets already
 *        on disk — that's the resume working, not a stall.
 * @returns {Promise<{ themeId, total, done, failed, missing, bytes, complete }>}
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
  // Couldn't REACH the server vs the server saying no — apiPost never throws, and
  // a transport failure carries no HTTP `response` (same idiom as
  // useInitializeProject). Telling an offline user the theme is broken sends them
  // to delete a perfectly good partial pack, which is how bytes got lost before.
  if (raw?.error && !raw.error.response) {
    throw new Error("You're offline — reconnect to download this design.");
  }
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
  // asset url that stayed the same.
  //
  // Gated on being online: `navigator.onLine === false` is the one direction of
  // that signal Electron reports reliably, and wiping a pack we then can't
  // re-download would leave the user worse off than the stale bytes did. Read
  // through the PER-ACCOUNT list deliberately — the raw bridge would hand this
  // account another account's fingerprint and the two would wipe each other's
  // pack back and forth.
  const existingPack = (await listThemePacks()).find((p) => p.themeId === themeId);
  const isStale = !!(
    existingPack &&
    existingPack.fingerprint &&
    existingPack.fingerprint !== fingerprint
  );
  if (isStale && isOnline()) {
    try {
      await desktop.themePacks.delete(themeId);
    } catch (_) {
      /* best-effort; a failed wipe just means resume keeps old assets */
    }
  }

  const sizes = (Array.isArray(items.theme) ? items.theme : []).map((v) => ({
    size: v.size || `${v.width}x${v.height}`,
    width: Number(v.width) || 0,
    height: Number(v.height) || 0,
    dpi: v.dpi != null ? Number(v.dpi) : null,
    orientation: v.orientation ?? null,
  }));

  // Accumulated PER ITEM rather than from runPool's return value, because an
  // abort rejects the pool and we never see that value — which is exactly the
  // case where we most need to know what was already downloaded.
  const assets = [];
  const missing = [];

  let done = 0;
  let failed = 0;
  let bytes = 0;
  let saving = false;
  let sinceSave = 0;

  // Serialized ONCE, not per checkpoint — a theme.json carries every variant's
  // compressed pages and is allowed up to 64MB, so re-stringifying it on each of
  // a long download's checkpoints would be the most expensive thing this module
  // does. `raw` never changes after the fetch above.
  const themeJson = JSON.stringify(raw);

  // Write what we have so far. `complete` is a required argument, never
  // defaulted: this is called from the success path AND the abort path, and
  // guessing wrong in either direction either strands a finished pack behind a
  // Resume button or claims a half-downloaded theme is available offline.
  //
  // `refreshMap` is skipped for the periodic checkpoints: rebuilding the map
  // walks every manifest of every pack on disk, and nothing is rendering this
  // theme mid-download. The terminal persists (success/abort) do refresh it.
  const persist = async (complete, refreshMap = true) => {
    await desktop.themePacks.saveManifest({
      themeId,
      name: theme.name || items.name || "Untitled theme",
      category: items.editor_type ?? theme.editor_type ?? null,
      version: items.updatedAt != null ? String(items.updatedAt) : null,
      fingerprint,
      sizes,
      // Copied, not passed by reference: persist is async and `assets` keeps
      // growing underneath a checkpoint that's still in flight.
      assets: [...assets],
      missing: [...missing],
      fontUrls,
      thumbnailUrl,
      downloadedAt: Date.now(),
      complete,
      themeJson,
    });
    // Ownership is the VISIBILITY key, not a completion flag — an unowned pack is
    // hidden from the sidebar, so a partial must claim it or its bytes would sit
    // on disk with no way for the user to resume or delete them. It's recorded
    // here rather than at the call site because the unmount-abort path runs after
    // the page is already gone.
    addThemePackOwner(themeId);
    // Make whatever we just recorded resolve from disk immediately.
    if (refreshMap) await refreshThemePackUrlMap();
  };

  const tick = (r) => {
    done += 1;
    if (r?.error) failed += 1;
    else if (r?.bytes) bytes += r.bytes;
    if (r?.file && !r.error) assets.push({ url: r.url, file: r.file });
    if (r?.missing) missing.push(r.url);
    onProgress?.({
      name: theme.name,
      total,
      done,
      failed,
      missing: missing.length,
      bytes,
    });

    // Periodic checkpoint so a hard kill can't cost more than CHECKPOINT_EVERY
    // assets' index entries. Fire-and-forget (awaiting it here would stall the
    // download pool) and non-overlapping; the main side's per-pack lock and
    // additive union make an interleaved write safe either way.
    sinceSave += 1;
    if (sinceSave >= CHECKPOINT_EVERY && !saving) {
      saving = true;
      sinceSave = 0;
      persist(false, false)
        .catch(() => {})
        .finally(() => {
          saving = false;
        });
    }
  };
  onProgress?.({ name: theme.name, total, done: 0, failed: 0, bytes: 0 });

  try {
    // 3. Download images, then warm fonts (both bounded). Assets already on disk
    //    from an earlier run short-circuit inside these workers.
    await runPool(
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

    // 4. Persist. theme.json is the raw response (offline-open source); the
    //    manifest carries the url→file map, variants and the version key.
    //    Assets the server has permanently lost don't count against completeness.
    await persist(failed === 0);

    return {
      themeId,
      total,
      done,
      failed,
      missing: missing.length,
      bytes,
      complete: failed === 0,
    };
  } catch (err) {
    // Cancelled or hard-failed: checkpoint instead of cleaning up. The bytes on
    // disk are the user's bandwidth — keep them, record them, let them resume.
    try {
      await persist(false);
    } catch (_) {
      /* checkpoint is best-effort; never mask the original error */
    }
    // Must rethrow: the page's AbortError branch is what clears the toast.
    throw err;
  }
};
