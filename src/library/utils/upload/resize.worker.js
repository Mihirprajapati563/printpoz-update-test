/* eslint-disable no-restricted-globals */
/**
 * resize.worker.js
 * ─────────────────────────────────────────────────────────────────
 * Dedicated Worker that runs the image resize pipeline completely
 * off the main thread. Decoding (createImageBitmap), rasterizing
 * (OffscreenCanvas.drawImage) and encoding (convertToBlob) of a
 * 20-30 MB photo take seconds of CPU — doing that on the main
 * thread is what froze the editor during bulk uploads.
 *
 * Protocol (one job at a time per worker — managed by resizePool):
 *   in : { file, outputType, quality, thumbMaxDim }
 *   out: { type: "thumb", thumb }                  – early preview
 *        { type: "done",  result }                 – all variants ready
 *        { type: "error", error, unsupported }     – unsupported=true
 *          means this browser's workers lack OffscreenCanvas and the
 *          pool should fall back to the main thread permanently.
 * ─────────────────────────────────────────────────────────────────
 */
import { resizeImage } from "./imageResizer";

self.onmessage = async (event) => {
  const { file, outputType, quality, thumbMaxDim } = event.data || {};

  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    self.postMessage({ type: "error", error: "worker-unsupported", unsupported: true });
    return;
  }

  try {
    const result = await resizeImage(file, outputType, quality, {
      thumbMaxDim,
      onThumb: (thumb, dims) => self.postMessage({ type: "thumb", thumb, dims }),
    });
    self.postMessage({ type: "done", result });
  } catch (err) {
    const message = err?.message || "Image resize failed";
    self.postMessage({
      type: "error",
      error: message,
      unsupported: message === "worker-unsupported",
    });
  }
};
