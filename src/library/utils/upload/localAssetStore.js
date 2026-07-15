/**
 * localAssetStore.js — desktop-only local user-photo store (renderer adapter).
 * ─────────────────────────────────────────────────────────────────
 * On desktop the offline-first design NEVER uploads user photos to S3. Instead
 * the renderer resizes each image (the existing eager-resize pipeline), sends the
 * variant BYTES to the main process, which writes them content-addressed to disk
 * and records a gallery index entry that survives restarts.
 *
 * Every function here returns the SAME shape the corresponding server endpoint
 * returns, so the call sites (uploadManager, PhotosAction) only need a one-line
 * `isDesktop` branch and the rest of the gallery/placement/sort code is untouched.
 *
 * On web (no window.desktop) `localAssetsEnabled` is false and nothing here runs.
 */

import { isDesktop, desktop } from "../../../desktop";

/** True only in the Electron desktop app with the assets bridge available. */
export const localAssetsEnabled = isDesktop && !!(desktop && desktop.assets);

function resolveProjectId(projectId) {
  // Empty/undefined → a stable "default" bucket (mirrors the main-process
  // sanitizer) so saves and the gallery fetch always agree on the folder.
  return projectId && String(projectId).trim() ? String(projectId) : "default";
}

function extForMime(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Absolute path of the user's ORIGINAL file, or "" if it has no on-disk original
 * (Google Photos download, clipboard paste — those arrive as in-memory blobs).
 * The empty string is the discriminator that routes such images into copy mode.
 */
function originalPathOf(file) {
  try {
    const p = (file && desktop?.getPathForFile?.(file)) || "";
    // Route UNC / device paths (\\host\share, \\?\, //host) to COPY mode instead
    // of reference mode: they'd be rejected by the main-side validator anyway
    // (SMB/NTLM-relay guard), and copy mode keeps a working full-res image for a
    // legitimate import off a network share.
    if (/^[\\/]{2}/.test(p)) return "";
    return p;
  } catch {
    return "";
  }
}

/**
 * Persist a resized image locally and return a server-shaped upload result:
 *   { items: { _id, urls: [{ size, url, w, h }], ... } }
 *
 * REFERENCE MODE (file has an on-disk original): we do NOT copy full-res into
 * AppData — only the small thumbnail is written, plus the original's path. The
 * canvas + export read full-res straight from the original file (via the
 * app-assets://original/ scope). COPY MODE (no path — blobs): today's behavior,
 * all three variants copied so canvas/export still work with no file to point at.
 *
 * @param {object}   params
 * @param {File}     params.file      – original file (name/size metadata + path)
 * @param {object}   params.metadata  – upload metadata (carries cart_order_id)
 * @param {object}   params.resized   – { large, medium, small, width, height, mimeType }
 */
export async function saveImageLocally({ file, metadata, resized }) {
  const { large, medium, small, width, height, mimeType } = resized;
  const ext = extForMime(mimeType);
  const originalPath = originalPathOf(file);

  const base = {
    projectId: resolveProjectId(metadata?.cart_order_id),
    fileName: file?.name || "image",
    fileSize: typeof file?.size === "number" ? file.size : 0,
    width,
    height,
  };

  let asset;
  if (originalPath) {
    // Reference mode — send ONLY the small thumbnail bytes + the original path.
    const smallBuf = await small.arrayBuffer();
    asset = await desktop.assets.save({
      ...base,
      fileSize: typeof file?.size === "number" ? file.size : smallBuf.byteLength,
      originalPath,
      variants: [{ size: "small", bytes: smallBuf, ext }],
    });
  } else {
    // Copy mode — full variant set (blobs from Google Photos / paste have no
    // on-disk original to reference, so we must keep a real full-res copy).
    const [largeBuf, mediumBuf, smallBuf] = await Promise.all([
      large.arrayBuffer(),
      medium.arrayBuffer(),
      small.arrayBuffer(),
    ]);
    asset = await desktop.assets.save({
      ...base,
      fileSize: typeof file?.size === "number" ? file.size : largeBuf.byteLength,
      variants: [
        { size: "large", bytes: largeBuf, ext },
        { size: "medium", bytes: mediumBuf, ext },
        { size: "small", bytes: smallBuf, ext },
      ],
    });
  }

  // Mirror the server `/uploads/complete` shape consumed by the upload thunk.
  return { items: asset };
}

/**
 * Local equivalent of `apiPost(getProjectImages, …)`.
 * Returns `{ status, items, totalCount }` — the fields PhotosAction reads.
 */
export async function fetchLocalGallery({ projectId, skip, limit, sortField, sortOrder }) {
  const res = await desktop.assets.list({
    projectId: resolveProjectId(projectId),
    skip,
    limit,
    sortField,
    sortOrder,
  });
  return { status: 1, items: res.items, totalCount: res.totalCount };
}

/** Local equivalent of the add/remove-favorite endpoints. */
export async function setLocalFavorite(projectId, id, favorite) {
  await desktop.assets.setFavorite(resolveProjectId(projectId), id, favorite);
  return { status: 1 };
}

/** Local equivalent of delete / deleteMultiple project images. */
export async function removeLocalAssets(projectId, ids) {
  await desktop.assets.remove(resolveProjectId(projectId), ids);
  return { status: 1 };
}

const ORIGINAL_URL_RE = /^app-assets:\/\/original\/[^/]+\/([a-f0-9]{24})\./i;

/** The reference-mode asset id encoded in an original-scope url, or null. */
function originalAssetIdOf(url) {
  const m = typeof url === "string" ? url.match(ORIGINAL_URL_RE) : null;
  return m ? m[1].toLowerCase() : null;
}

/**
 * Scan the canvas `pages` for PLACED images backed by a reference-mode original
 * (app-assets://original/…) and return the asset ids whose original file is now
 * missing on disk. Used to gate order/export so a moved/deleted original never
 * silently prints blank. Returns [] on web / when nothing is referenced.
 *
 * @param {Array}  pages     – canvas.present.pages
 * @param {string} projectId – cart_order_id
 * @returns {Promise<string[]>} missing asset ids (empty if none / not desktop)
 */
export async function findMissingPlacedOriginals(pages, projectId) {
  if (!localAssetsEnabled || !Array.isArray(pages)) return [];
  const ids = new Set();
  for (const page of pages) {
    if (!page || !Array.isArray(page.layout)) continue;
    for (const layout of page.layout) {
      if (!layout) continue;
      for (const key of ["objects", "safeAreaObjects"]) {
        const list = layout[key];
        if (!Array.isArray(list)) continue;
        for (const obj of list) {
          if (obj?.type !== "img") continue;
          const candidates = [obj.url, ...(Array.isArray(obj.urls) ? obj.urls.map((u) => u?.url) : [])];
          for (const c of candidates) {
            const id = originalAssetIdOf(c);
            if (id) ids.add(id);
          }
        }
      }
    }
  }
  if (ids.size === 0) return [];
  try {
    return await desktop.assets.checkOriginals(resolveProjectId(projectId), Array.from(ids));
  } catch {
    // Best-effort — never block export on the check itself failing.
    return [];
  }
}
