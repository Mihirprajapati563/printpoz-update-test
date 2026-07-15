import { useSelector, shallowEqual } from "react-redux";

/**
 * usePendingPlacedImages
 * ─────────────────────────────────────────────────────────────────
 * Optimistic image placement (see optimistic_image_placement_plan.md):
 * counts canvas objects that still carry `pendingImageId` (placed while
 * their upload is in flight), joined with the upload queue status.
 *
 *   pendingCount – placed images still queued/uploading. These resolve on
 *                  their own: the upload thunk swaps the object to its
 *                  server URL when done. Save/Export should WAIT on these.
 *   failedCount  – placed images whose upload failed (or whose queue entry
 *                  is gone / has no server URL — unrecoverable without user
 *                  action). Save/Export must surface a resolve prompt.
 *
 * Never let a blob: URL reach saved project JSON or exported SVG — blobs
 * are meaningless outside this tab and would print blank.
 *
 * Returns only primitive counts (shallowEqual) so subscribers don't
 * re-render on unrelated upload-state changes. Callers needing the actual
 * failed ids (e.g. a Retry button) should read the store imperatively at
 * click time.
 */
export function collectPlacedPendingIds(state) {
  const pages = state.canvas?.present?.pages || [];
  const placedIds = new Set();
  for (const page of pages) {
    if (!page || !Array.isArray(page.layout)) continue;
    for (const layout of page.layout) {
      if (!layout) continue;
      for (const key of ["objects", "safeAreaObjects"]) {
        const list = layout[key];
        if (!Array.isArray(list)) continue;
        for (const obj of list) {
          if (obj?.pendingImageId) placedIds.add(obj.pendingImageId);
        }
      }
    }
  }
  return placedIds;
}

/** Pure variant for imperative (click-time / interval) reads. */
export function getPendingPlacedImageCounts(state) {
  const placedIds = collectPlacedPendingIds(state);
  if (placedIds.size === 0) return { pendingCount: 0, failedCount: 0 };

  const images = state.imageUpload?.images || [];
  const statusById = new Map(images.map((img) => [img.imageId, img.status]));

  let pendingCount = 0;
  let failedCount = 0;
  for (const id of placedIds) {
    const status = statusById.get(id);
    if (status === "queued" || status === "uploading") {
      pendingCount++;
    } else {
      // "failed", or "uploaded" without a swap (no server URL), or queue
      // entry removed and never completed — none of these will resolve by
      // waiting; the user must retry, replace, or remove the object.
      failedCount++;
    }
  }
  return { pendingCount, failedCount };
}

export default function usePendingPlacedImages() {
  return useSelector(getPendingPlacedImageCounts, shallowEqual);
}

/**
 * Imperative variant for click-time reads (e.g. building the Retry list).
 * Returns the placed pendingImageIds that have a retryable queue entry.
 */
export function getRetryableFailedPlacedImages(state) {
  const placedIds = collectPlacedPendingIds(state);
  const images = state.imageUpload?.images || [];
  return images.filter(
    (img) => placedIds.has(img.imageId) && img.status === "failed" && img.file
  );
}
