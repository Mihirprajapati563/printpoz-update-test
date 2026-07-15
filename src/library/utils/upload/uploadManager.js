/**
 * uploadManager.js
 * ─────────────────────────────────────────────────────────────────
 * Orchestrates the full optimized upload pipeline:
 *
 *   1. Client-side resize  (via resizePool.js — Web Worker pool, off
 *      the main thread, concurrency bounded by POOL_SIZE there)
 *   2. Request signed URLs (POST /uploads/init)
 *   3. Upload each variant (Large/Medium/Small) directly to S3
 *      using 5 MB chunks via pre-signed PUT URLs
 *   4. Finalize            (POST /uploads/complete)
 *
 *   ★ Fallback: after 3 consecutive API failures, abandons the
 *     multipart flow and falls back to the legacy
 *     apiMultiPartPost upload.
 *
 * Memory budget:
 *   • Only one 5 MB ArrayBuffer per active chunk is held.
 *   • Blobs from the resizer are streamed via .slice(), never
 *     fully read into memory at once.
 * ─────────────────────────────────────────────────────────────────
 */

import { resizeImageInPool } from "./resizePool";
import { apiPost, apiMultiPartPost, getAccessToken } from "../common-services/apiCall";
import { ENDPOINTS } from "../constants/apiurl";
import { localAssetsEnabled, saveImageLocally } from "./localAssetStore";

// ════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

// Per-image chunk concurrency: how many chunks of a SINGLE image upload at
// once. Lower = each image holds fewer of the shared connections, so MORE
// images upload visibly in parallel (the global cap below distributes the
// rest). 2 → with the 6-wide global cap, ~3 images stream at full speed and
// the others rotate in quickly. Drop to 1 for maximum simultaneous images
// (≈6 at once, each slightly slower); raise for faster single-image uploads.
const MAX_CONCURRENT_CHUNKS = 2;

// Global cap on TOTAL chunk PUTs in flight across ALL images at once.
// Browsers allow ~6 connections per host; uncoordinated per-image
// concurrency used to oversubscribe that and let the browser silently queue
// connections (unpredictable, and it starved later images). This semaphore
// makes the limit explicit and self-balancing: one image alone can use all
// 6, many images share them fairly (FIFO). This is THE knob for how many
// images upload simultaneously vs how fast each one goes.
const MAX_GLOBAL_CONCURRENT_CHUNKS = 6;

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // exponential: 1 s → 2 s → 4 s

// ── Global network-connection semaphore (FIFO, fair) ───────────────
// Shared by every in-flight image so the browser's connection pool is never
// oversubscribed. Permits are handed directly to the next waiter on release
// so `activeChunkSlots` can never drift out of sync, and every acquire is
// paired with exactly one release in a `finally` (see uploadChunk).
let activeChunkSlots = 0;
const chunkSlotWaiters = [];

function acquireChunkSlot() {
  if (activeChunkSlots < MAX_GLOBAL_CONCURRENT_CHUNKS) {
    activeChunkSlots++;
    return Promise.resolve();
  }
  return new Promise((resolve) => chunkSlotWaiters.push(resolve));
}

function releaseChunkSlot() {
  const next = chunkSlotWaiters.shift();
  if (next) {
    // Hand the permit straight to the next waiter — count stays constant.
    next();
  } else {
    activeChunkSlots = Math.max(0, activeChunkSlots - 1);
  }
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

/** Sleep with exponential backoff */
const sleep = (attempt) =>
  new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt)));

/** Check if the browser is online */
function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Wait until the browser comes back online.
 * Resolves immediately if already online.
 */
function waitForOnline() {
  return new Promise((resolve) => {
    if (isOnline()) return resolve();
    const handler = () => {
      window.removeEventListener("online", handler);
      resolve();
    };
    window.addEventListener("online", handler);
  });
}

// ════════════════════════════════════════════════════════════════
// Upload a single chunk with retry + network-aware pause
// ════════════════════════════════════════════════════════════════

/**
 * PUT a single chunk to a pre-signed URL.
 *
 * @param {string} url        – Pre-signed PUT URL
 * @param {Blob}   chunkBlob  – The chunk slice
 * @param {Function} onProgress – Called with fraction (0-1) of this chunk
 * @returns {Promise<string>} – The ETag header from S3
 */
async function uploadChunk(url, chunkBlob, onProgress) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // If offline, wait before even trying (do NOT hold a connection slot
    // while waiting — acquire only around the actual PUT).
    await waitForOnline();

    // Acquire one of the shared connection slots just for this attempt.
    // Released in `finally` below, so a failed/timed-out chunk frees its
    // slot immediately and the exponential backoff sleep happens WITHOUT
    // holding a connection (other images keep moving during the wait).
    await acquireChunkSlot();
    try {
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(e.loaded / e.total);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.getResponseHeader("ETag") || "");
          } else {
            reject(new Error(`S3 PUT failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during chunk upload"));
        xhr.ontimeout = () => reject(new Error("Chunk upload timed out"));
        xhr.timeout = 120000; // 2 min per chunk

        xhr.send(chunkBlob);
      });

      return response; // success – return ETag
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) await sleep(attempt);
    } finally {
      releaseChunkSlot();
    }
  }

  throw lastError; // bubble up after all retries exhausted
}

// ════════════════════════════════════════════════════════════════
// Upload a single variant (large / medium / small) - Helper function
// ════════════════════════════════════════════════════════════════

/**
 * Uploads a single Blob to S3 using multipart pre-signed URLs.
*
 * @param {Blob}     blob        – The variant blob (or File for large)
 * @param {object}   variant     – { uploadId, urls: [string] } from init API
 * @param {Function} onProgress  – Called with (bytesUploaded, totalBytes)
 * @returns {Promise<string[]>}  – Array of ETags for each part
 */
async function uploadVariant(blob, variant, onProgress) {
  const { parts } = variant;
  const totalSize = blob.size;
  const totalParts = parts.length;
  const eTags = new Array(totalParts).fill(null);

  // Track bytes uploaded per part for progress
  const partProgress = new Array(totalParts).fill(0);

  function reportProgress() {
    const uploaded = partProgress.reduce((a, b) => a + b, 0);
    onProgress?.(uploaded, totalSize);
  }

  // Upload parts with bounded concurrency
  let nextPart = 0;

  async function worker() {
    while (nextPart < totalParts) {
      const partIndex = nextPart++;
      const start = partIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = blob.slice(start, end);
      const partSize = end - start;

      const eTag = await uploadChunk(parts[partIndex], chunkBlob, (frac) => {
        partProgress[partIndex] = Math.round(frac * partSize);
        reportProgress();
      });

      eTags[partIndex] = eTag;
      partProgress[partIndex] = partSize;
      reportProgress();
    }
  }

  // Spawn N workers
  const workers = [];
  for (let i = 0; i < Math.min(MAX_CONCURRENT_CHUNKS, totalParts); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return eTags;
}

// ════════════════════════════════════════════════════════════════
// Main entry point
// ════════════════════════════════════════════════════════════════

/**
 * Full upload pipeline for a single image file.
 *
 * @param {object}   params
 * @param {File}     params.file          – User-selected file
 * @param {object}   params.metadata      – { user_id, brand_id, cart_order_id, ... }
 * @param {Function} params.onProgress    – (percent:number) => void  (0–100)
 * @param {Function} params.onStatusChange – (status:string, message:string) => void
 * @param {Function} [params.onThumbnail] – (blob:Blob) => void — small preview
 *                                          thumbnail, fired as soon as the
 *                                          resize worker produces it
 *
 * @returns {Promise<object>} – API result (same shape as legacy upload response)
 */
export async function uploadImageOptimized({
  file,
  metadata,
  onProgress,
  onStatusChange,
  onThumbnail,
  preResized,
}) {
  let consecutiveFailures = 0;

  const fail = () => {
    consecutiveFailures++;
    return consecutiveFailures >= MAX_RETRIES;
  };

  const resetFails = () => {
    consecutiveFailures = 0;
  };

  try {
    // ── Step 1: Client-side resize (off-main-thread worker pool) ─
    // SINGLE DECODE: the bulk path resizes each image ONCE, eagerly (decoupled
    // from upload concurrency so previews appear for ALL images immediately),
    // and hands the cached variants in via `preResized` so we never decode a
    // second time here. The direct/retry path has no pre-resize, so we resize
    // now (and emit the preview thumbnail if the caller wants one).
    let resized = preResized;
    if (!resized) {
      onStatusChange?.("resizing", "Preparing image…");
      onProgress?.(2);
      resized = await resizeImageInPool(file, {
        thumbMaxDim: onThumbnail ? 512 : 0,
        onThumb: (thumb, dims) => onThumbnail?.(thumb, dims),
      });
    }

    const { large, medium, small, width, height, mimeType } = resized;

    // ── Desktop: store locally, skip S3 entirely ────────────────
    // Offline-first — write the resized variants to disk via IPC and return the
    // same { items: { _id, urls } } shape the server upload would. This is THE
    // single interception point: every path funnels through uploadImageOptimized
    // (bulk queue, Google Photos, clipboard paste, drag-drop), so they all become
    // local automatically. No File.path needed — we already hold the bytes.
    if (localAssetsEnabled) {
      onStatusChange?.("uploading", "Saving image…");
      onProgress?.(40);
      const result = await saveImageLocally({ file, metadata, resized });
      onProgress?.(100);
      onStatusChange?.("ready", "Saved!");
      return result;
    }

    onProgress?.(8);

    // ── Step 2: Request signed URLs ─────────────────────────────
    onStatusChange?.("initializing", "Setting up upload…");

    const variants = {
      large: {
        file_size: large.size,
        width,
        height,
      },
      medium: {
        file_size: medium.size,
        width: Math.round(width * 0.5),
        height: Math.round(height * 0.5),
      },
      small: {
        file_size: small.size,
        width: Math.round(width * 0.25),
        height: Math.round(height * 0.25),
      },
    };

    let initResult;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await waitForOnline();
        initResult = await apiPost(ENDPOINTS.uploadsInit, {
          ...metadata,
          file_name: file.name,
          mime_type: mimeType,
          variants,
        });

        if (initResult?.error) throw new Error(initResult.error);
        resetFails();
        break;
      } catch (err) {
        if (fail()) {
          // ── FALLBACK to legacy upload ─────────────────────────
          return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
        }
        await sleep(attempt);
      }
    }

    if (!initResult) {
      return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
    }

    // Extract variants from nested response structure
    const variantData = initResult.items?.variants || initResult.variants || initResult;
    const imageId = initResult.items?._id;

    // ── Step 3: Upload all three variants ───────────────────────
    onStatusChange?.("uploading", "Uploading image…");

    const blobMap = { large, medium, small };
    const variantKeys = ["large", "medium", "small"];
    const totalBytes = large.size + medium.size + small.size;
    const variantBytesUploaded = { large: 0, medium: 0, small: 0 };

    function calcOverallProgress() {
      const uploaded =
        variantBytesUploaded.large +
        variantBytesUploaded.medium +
        variantBytesUploaded.small;
      // Map 12–90 % of the overall progress bar to the upload phase
      const pct = 12 + Math.round((uploaded / totalBytes) * 78);
      onProgress?.(Math.min(pct, 90));
    }

    const eTagsByVariant = {};

    // Upload variants sequentially to limit peak memory (only one
    // variant's chunks are live at a time). Small + Medium are tiny
    // so this barely costs any extra wall-clock.
    for (const key of variantKeys) {
      try {
        const eTags = await uploadVariant(
          blobMap[key],
          variantData[key],
          (uploaded) => {
            variantBytesUploaded[key] = uploaded;
            calcOverallProgress();
          }
        );
        eTagsByVariant[key] = eTags;
        resetFails();
      } catch (err) {
        if (fail()) {
          return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
        }
        // Retry once more for this variant
        try {
          // Request refreshed URLs
          const refreshed = await apiPost(ENDPOINTS.uploadsRefreshUrls, {
            _id: imageId,
            variant: key,
            remaining_parts: variantData[key].parts
              .map((_, index) => index + 1)
              .filter((partNum) => !eTagsByVariant[key]?.[partNum - 1]),
          });
          if (refreshed?.error) throw new Error(refreshed.error);

          // Convert parts object to array (keys are "1", "2", etc.)
          const refreshedParts = refreshed.items?.parts || refreshed.parts || {};
          const partsArray = Object.keys(refreshedParts)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((key) => refreshedParts[key]);

          const eTags = await uploadVariant(
            blobMap[key],
            { ...variantData[key], parts: partsArray },
            (uploaded) => {
              variantBytesUploaded[key] = uploaded;
              calcOverallProgress();
            }
          );
          eTagsByVariant[key] = eTags;
          resetFails();
        } catch {
          return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
        }
      }
    }

    onProgress?.(92);

    // ── Step 4: Finalize ────────────────────────────────────────
    onStatusChange?.("finalizing", "Finishing up…");

    let completeResult;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await waitForOnline();
        completeResult = await apiPost(ENDPOINTS.uploadsComplete, {
          _id: imageId,
          user_id: metadata.user_id,
          userTypeCode: metadata.userTypeCode,
          editor_type: metadata.editor_type || "",
          variants: {
            large: {
              upload_id: variantData.large.upload_id,
              eTags: eTagsByVariant.large,
            },
            medium: {
              upload_id: variantData.medium.upload_id,
              eTags: eTagsByVariant.medium,
            },
            small: {
              upload_id: variantData.small.upload_id,
              eTags: eTagsByVariant.small,
            },
          },
        });

        if (completeResult?.error) throw new Error(completeResult.error);
        resetFails();
        break;
      } catch (err) {
        if (fail()) {
          return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
        }
        await sleep(attempt);
      }
    }

    onProgress?.(100);
    onStatusChange?.("ready", "Upload complete!");
    return completeResult;
  } catch (err) {
    // Ultimate fallback
    return await fallbackLegacyUpload(file, metadata, onProgress, onStatusChange);
  }
}

// ════════════════════════════════════════════════════════════════
// Legacy fallback – sends file the old way via apiMultiPartPost
// ════════════════════════════════════════════════════════════════

async function fallbackLegacyUpload(file, metadata, onProgress, onStatusChange) {
  // DESKTOP: user photos are stored fully locally — NEVER upload to the server,
  // not even as a fallback. If the local-save path threw, surface it as a failure
  // (retryable) instead of silently shipping the image to S3.
  if (localAssetsEnabled) {
    onStatusChange?.("failed", "Could not save image locally.");
    throw new Error("Local save failed (server upload disabled on desktop)");
  }

  onStatusChange?.("uploading", "Uploading image (standard)…");
  onProgress?.(10);

  const formData = new FormData();
  formData.append("file", file);

  // Spread all metadata keys into formData
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  const result = await apiMultiPartPost(
    ENDPOINTS.uploadProjectImages,
    formData,
    (progress) => {
      // Map 10–100 of progress bar
      onProgress?.(10 + Math.round(progress * 0.9));
    }
  );

  if (result?.error) {
    onStatusChange?.("failed", "Upload failed.");
    throw new Error(result.error);
  }

  onProgress?.(100);
  onStatusChange?.("ready", "Upload complete!");
  return result;
}

export default uploadImageOptimized;
