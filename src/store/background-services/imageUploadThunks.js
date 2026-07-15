import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  startUpload,
  updateUploadProgress,
  uploadSuccess,
  uploadFailure,
  updateUploadStatus,
  setPreviewUrl,
  removeImage,
} from "../slices/imageUpload";
import { replaceImageSourceAcrossPages } from "../slices/canvas";
import { collectPlacedPendingIds } from "../../library/utils/custom-hooks/usePendingPlacedImages";
import { apiMultiPartPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { uploadImageOptimized } from "../../library/utils/upload/uploadManager";
import { resizeImageInPool } from "../../library/utils/upload/resizePool";
import { v4 as uuidv4 } from "uuid";

// Preview thumbnail longest-side cap. The optimistic-placement preview renders
// this ON the canvas in full-size image boxes until the upload swaps in the
// server URL, so it must be reasonably sharp (256 looked soft); 512 decodes to
// well under a megabyte.
const PREVIEW_THUMB_MAX_DIM = 512;

/**
 * Start the SINGLE eager resize for one image, decoupled from the upload
 * workers, and return the in-flight promise.
 *
 * This is the fix for "thumbnails stop appearing after ~10 images": previews
 * used to be a by-product of the full resize, which only ran once an upload
 * worker (capped at MAX_CONCURRENT_UPLOADS) picked the image up — so images
 * past the cap had no preview until an earlier upload fully finished. Now every
 * registered image is resized straight away through the pool (still bounded by
 * POOL_SIZE concurrent decodes), the preview is emitted from that SAME decode
 * (onThumb → setPreviewUrl), and the resulting variants are handed to the
 * upload via `preResized` so the image is decoded EXACTLY ONCE.
 *
 * Never rejects — on failure resolves null so the upload falls back to
 * resizing itself.
 */
function startEagerResize(dispatch, imageId, file) {
  if (!file) return Promise.resolve(null);
  return resizeImageInPool(file, {
    thumbMaxDim: PREVIEW_THUMB_MAX_DIM,
    onThumb: (thumb, dims) => {
      if (!thumb) return;
      try {
        // setPreviewUrl revokes this URL itself if the image was removed mid-flight.
        dispatch(
          setPreviewUrl({
            imageId,
            url: URL.createObjectURL(thumb),
            width: dims?.width,
            height: dims?.height,
          })
        );
      } catch {
        /* preview is cosmetic — never fail the upload over it */
      }
    },
  }).catch(() => null);
}

// Maximum images in the upload pipeline simultaneously. Keeps signed
// URLs fresh and avoids saturating the browser's connection pool
// (browsers cap ~6 connections per host anyway). CPU-heavy resizing
// is bounded separately by resizePool's POOL_SIZE, so only that many
// of these slots resize at once while the rest stream bytes.
const MAX_CONCURRENT_UPLOADS = 10;

// Progress events arrive per chunk (~every 50 ms, several chunks in
// parallel, several images in parallel) — dispatching every one of
// them flooded Redux with hundreds of actions/second and re-rendered
// the queue UI constantly. Dispatch only when the integer percent
// changed and at most ~6×/s per image (terminal 100% always passes).
const PROGRESS_DISPATCH_MIN_INTERVAL_MS = 150;

/**
 * Dispatch uploads for an array of { file, formData } items with
 * bounded concurrency.
 *
 * 1. Immediately registers ALL images in the Redux queue (status "queued")
 *    so the user sees everything they selected right away.
 * 2. Processes at most MAX_CONCURRENT_UPLOADS at a time. Each image
 *    requests its signed URLs just before uploading, so URLs stay fresh.
 *
 * @param {Function} dispatch  – Redux dispatch
 * @param {{ file: File, formData: FormData }[]} uploadItems
 * @returns {Promise<void>}
 */
// ── Shared upload queue (module scope) ──────────────────────────────
// All dispatchUploadsWithConcurrency() calls feed ONE global queue drained
// by ONE worker pool capped at MAX_CONCURRENT_UPLOADS. (Previously each call
// spawned its own workers, so overlapping batches could run 2× the cap.)
// Module scope also enables prioritizeUpload(): when the user places a
// still-queued image on the canvas (optimistic placement), it jumps to the
// front so its silent blob→URL swap happens as soon as possible.
const sharedQueue = []; // [{ file, formData, imageId, settle }]
let activeWorkerCount = 0;

function spawnQueueWorkers(dispatch) {
  while (activeWorkerCount < MAX_CONCURRENT_UPLOADS && sharedQueue.length > 0) {
    activeWorkerCount++;
    (async () => {
      try {
        while (sharedQueue.length > 0) {
          const item = sharedQueue.shift();
          try {
            await dispatch(uploadImage(item)).unwrap();
          } catch {
            // Individual failure is already handled inside the thunk
          } finally {
            item.settle();
          }
        }
      } finally {
        activeWorkerCount--;
        // Close the race: a new batch can be enqueued AFTER this worker saw
        // the queue empty but BEFORE it decremented — at that instant
        // spawnQueueWorkers sees the pool full and spawns nothing, so the
        // new items would be stranded (queued forever, never appearing in
        // the gallery). Re-check here now that a slot is free.
        if (sharedQueue.length > 0) spawnQueueWorkers(dispatch);
      }
    })();
  }
}

export function dispatchUploadsWithConcurrency(dispatch, uploadItems) {
  // Pre-register every image so the queue UI shows them all immediately,
  // then enqueue. Returns a promise that resolves when THIS batch is done.
  const completions = uploadItems.map((item) => {
    const imageId = uuidv4();
    const batchId = item.formData.get("batch_id");
    dispatch(startUpload({ imageId, file: item.file, batchId, status: "queued" }));
    // Resize ONCE, eagerly, decoupled from the upload workers: this emits the
    // preview immediately (for ALL images, not just the first ~10) and the
    // resulting variants are reused by the upload below (no second decode).
    const resizePromise = startEagerResize(dispatch, imageId, item.file);
    let settle;
    const done = new Promise((resolve) => {
      settle = resolve;
    });
    sharedQueue.push({ ...item, imageId, settle, resizePromise });
    return done;
  });

  spawnQueueWorkers(dispatch);
  return Promise.all(completions);
}

/**
 * Reconcile placed-but-not-swapped images.
 *
 * A photo placed on canvas while still uploading carries a `pendingImageId`; the
 * upload thunk swaps it to the permanent source when it finishes. But if the
 * upload completes BEFORE the object is placed (common on desktop, where local
 * saves are near-instant), that one-shot swap finds nothing to patch and the
 * freshly-placed object is left with a `pendingImageId` that will never resolve —
 * permanently blocking the Save/Export gate.
 *
 * This re-fires the swap for any placed pendingImageId whose upload has actually
 * finished (status "uploaded" + serverId + urls), clearing the stale marker.
 * Returns the number reconciled. Safe to call before any gated action.
 */
export const reconcilePlacedUploads = () => (dispatch, getState) => {
  const state = getState();
  const placedIds = collectPlacedPendingIds(state);
  if (placedIds.size === 0) return 0;
  const images = state.imageUpload?.images || [];
  let reconciled = 0;
  for (const img of images) {
    if (
      placedIds.has(img.imageId) &&
      img.status === "uploaded" &&
      img.serverId &&
      Array.isArray(img.uploadUrls) &&
      img.uploadUrls.length
    ) {
      const large =
        img.uploadUrls.find((u) => u.size === "large") || img.uploadUrls[0];
      if (!large?.url) continue;
      dispatch(
        replaceImageSourceAcrossPages({
          pendingImageId: img.imageId,
          url: large.url,
          urls: img.uploadUrls,
          serverId: img.serverId,
        })
      );
      reconciled++;
    }
  }
  return reconciled;
};

/**
 * Move a queued image to the front of the shared upload queue.
 * No-op if it is already uploading or not in the queue.
 */
export function prioritizeUpload(imageId) {
  const index = sharedQueue.findIndex((item) => item.imageId === imageId);
  if (index > 0) {
    const [item] = sharedQueue.splice(index, 1);
    sharedQueue.unshift(item);
  }
}

/**
 * Remove an image from the upload queue UI without breaking the canvas.
 * If the image was optimistically placed (an object carries its
 * pendingImageId), the preview blob URL must stay alive — the canvas still
 * renders it until the upload finishes and the swap fires.
 */
export const removeImageSafe = (imageId) => (dispatch, getState) => {
  const pages = getState().canvas?.present?.pages || [];
  const isPlaced = pages.some((page) =>
    page?.layout?.some(
      (layout) =>
        layout &&
        ["objects", "safeAreaObjects"].some((key) =>
          layout[key]?.some?.((obj) => obj?.pendingImageId === imageId)
        )
    )
  );
  dispatch(removeImage({ imageId, keepPreviewUrl: isPlaced }));
};

/**
 * Optimized upload thunk.
 *
 * Tries the new multipart signed-URL flow first (resize → init →
 * chunk upload → finalize). If that fails 3 times at any stage,
 * it automatically falls back to the legacy `apiMultiPartPost`.
 *
 * The caller interface is identical to the old thunk so all 4
 * dispatch sites (ImportPhotoFromDevice, AddPhotosFirstTime,
 * MobileUpload, UploadedQueue) work without changes.
 */
export const uploadImage = createAsyncThunk(
  "imageUpload/uploadImage",
  async ({ file, formData, imageId, resizePromise }, { dispatch, rejectWithValue }) => {
    const finalImageId = imageId || uuidv4();

    // The bulk path (dispatchUploadsWithConcurrency) already started the single
    // eager resize and passed its promise. The direct-dispatch path starts one
    // here. Retry (imageId set, no resizePromise) has neither → the upload
    // resizes itself and emits the preview via onThumbnail below.
    let preResizePromise = resizePromise || null;

    if (!imageId) {
      // Direct dispatch (not via concurrency queue) — register now
      const batchId = formData?.get("batch_id");
      dispatch(startUpload({ imageId: finalImageId, file, batchId }));
      preResizePromise = startEagerResize(dispatch, finalImageId, file);
    } else {
      // Pre-registered or retry — mark as active
      dispatch(updateUploadStatus({ imageId: finalImageId, statusText: "Preparing image…" }));
      dispatch(updateUploadProgress({ imageId: finalImageId, progress: 1 }));
    }

    // Await the single eager resize (if any). Its variants are reused by the
    // upload so the image is decoded exactly once. null → upload resizes itself.
    const preResized = preResizePromise ? await preResizePromise : null;

    // Build a plain metadata object from the FormData so the
    // optimized manager can send JSON instead of multipart.
    // On retry, formData may be absent — fall back to empty metadata.
    const metadata = {};
    if (formData) {
      for (const [key, value] of formData.entries()) {
        if (key !== "file") metadata[key] = value;
      }
    }

    // Throttle + dedupe progress dispatches (see constant above).
    let lastDispatchedPercent = -1;
    let lastDispatchTime = 0;
    let lastStatusMessage = null;

    try {
      const result = await uploadImageOptimized({
        file,
        metadata,
        onProgress: (percent) => {
          const pct = Math.min(100, Math.round(percent));
          if (pct === lastDispatchedPercent) return;
          const now = Date.now();
          if (
            pct < 100 &&
            now - lastDispatchTime < PROGRESS_DISPATCH_MIN_INTERVAL_MS
          ) {
            return;
          }
          lastDispatchedPercent = pct;
          lastDispatchTime = now;
          dispatch(
            updateUploadProgress({ imageId: finalImageId, progress: pct })
          );
        },
        onStatusChange: (status, message) => {
          if (message === lastStatusMessage) return;
          lastStatusMessage = message;
          dispatch(
            updateUploadStatus({ imageId: finalImageId, statusText: message })
          );
        },
        // Reuse the single eager resize (bulk + direct paths) so the image is
        // decoded exactly once.
        preResized,
        // Only request a preview from uploadManager's own resize when there was
        // NO eager resize (the retry path) — otherwise the eager resize already
        // emitted the preview via its onThumb.
        onThumbnail: preResized
          ? undefined
          : (blob, dims) => {
              try {
                dispatch(
                  setPreviewUrl({
                    imageId: finalImageId,
                    url: URL.createObjectURL(blob),
                    width: dims?.width,
                    height: dims?.height,
                  })
                );
              } catch {
                /* preview is cosmetic — never fail the upload over it */
              }
            },
      });

      if (result && !result.error) {
        // Complete response shape: { items: { urls: [{ size, url, w, h }] } }
        // Extract the large URL as the primary image URL; fall back through variants.
        const urls = result.items?.urls || result.urls || [];
        const largeEntry = urls.find((u) => u.size === "large") || urls[0];
        const imageUrl = largeEntry?.url || null;
        const serverId = result.items?._id || null;

        if (!imageUrl) {
          // The upload "succeeded" but the response carried NO usable server URL,
          // so we can't swap a placed object off its local blob: URL — and a
          // blob must never reach saved JSON. Treat this as a FAILURE so the
          // state is honest: uploadFailure keeps `file` (uploadSuccess would null
          // it), the save-gate counts it correctly, and "Retry failed uploads"
          // can re-upload it (vs. the old path that marked it "uploaded" with a
          // dangling pendingImageId → falsely "failed", unretryable, save stuck).
          dispatch(
            uploadFailure({
              imageId: finalImageId,
              error: "Upload finished without a server URL",
            })
          );
          return rejectWithValue("Upload finished without a server URL");
        }

        dispatch(
          uploadSuccess({
            imageId: finalImageId,
            imageUrl,
            urls, // full array for consumers that need all sizes
            serverId,
          })
        );

        // Optimistic placement: silently swap every canvas object placed
        // with this image's local thumbnail to the permanent server source.
        // Dispatched from here (not derived from queue state) so it fires
        // even if the user removed the queue row mid-upload.
        dispatch(
          replaceImageSourceAcrossPages({
            pendingImageId: finalImageId,
            url: imageUrl,
            urls,
            serverId,
          })
        );
        // NOTE: the preview blob is NOT revoked here. The swap moment is
        // blink-sensitive (this feature has regressed on it before), so the
        // blob is freed later — at the provably-dead point where the backend
        // refetch supersedes the tile — via releasePreviewUrl in PhotosAction.
      } else {
        throw new Error(result?.error || "Upload failed");
      }
    } catch (error) {
      dispatch(
        uploadFailure({ imageId: finalImageId, error: error.message })
      );
      return rejectWithValue(error.message);
    }
  }
);
