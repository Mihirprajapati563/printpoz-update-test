/**
 * imageResizer.js
 * ─────────────────────────────────────────────────────────────────
 * Memory-optimized client-side image resizer.
 * Uses OffscreenCanvas (or fallback <canvas>) to generate
 * Medium (50 %) and Small (25 %) Blobs from the original File.
 *
 * ★ Key design decisions
 *   • EXIF orientation is applied by the BROWSER at decode time
 *     (createImageBitmap with imageOrientation:"from-image"), exactly
 *     as an <img> tag displays it — so the decoded bitmap is already
 *     correctly oriented and we do NO manual rotation. (The old
 *     "none" + manual-rotate approach double-rotated portrait photos
 *     into landscape on engines that ignore imageOrientation:"none".)
 *   • The original File is kept as-is (Large) when EXIF orientation
 *     is 1 (no rotation needed) and the type is JPEG/PNG — skipping
 *     the very expensive full-resolution re-encode. Other
 *     orientations are baked into a re-encoded Large (the server
 *     reads pixel dimensions from the uploaded blob).
 *   • createImageBitmap is used where available – it decodes off
 *     the main thread and avoids holding a full HTMLImageElement.
 *   • All intermediate bitmaps & canvases are closed / dereferenced
 *     immediately after use to minimize peak memory.
 *   • Runs in both window and Worker contexts (Worker requires
 *     OffscreenCanvas — callers fall back to the main thread when
 *     it is unavailable).
 * ─────────────────────────────────────────────────────────────────
 */

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Read EXIF orientation tag from a JPEG/HEIC blob.
 * Returns an integer 1-8 (default 1 if not found).
 * Only reads the first 64 KB – negligible memory.
 */
async function readExifOrientation(file) {
  try {
    const slice = file.slice(0, 65536);
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);

    // Must start with JPEG SOI marker 0xFFD8
    if (view.getUint16(0) !== 0xffd8) return 1;

    let offset = 2;
    while (offset < view.byteLength - 2) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 – potential Exif
        const length = view.getUint16(offset);
        // "Exif\0\0"
        if (
          view.getUint32(offset + 2) === 0x45786966 &&
          view.getUint16(offset + 6) === 0x0000
        ) {
          const tiffStart = offset + 8;
          const bigEndian = view.getUint16(tiffStart) === 0x4d4d;
          const ifdOffset = view.getUint32(tiffStart + 4, !bigEndian);
          const entries = view.getUint16(tiffStart + ifdOffset, !bigEndian);
          for (let i = 0; i < entries; i++) {
            const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            if (view.getUint16(entryOffset, !bigEndian) === 0x0112) {
              return view.getUint16(entryOffset + 8, !bigEndian);
            }
          }
        }
        offset += length;
      } else if ((marker & 0xff00) === 0xff00) {
        offset += view.getUint16(offset);
      } else {
        break;
      }
    }
  } catch {
    /* not a JPEG or unreadable – fine */
  }
  return 1;
}

// ────────────────────────────────────────────────────────────────
// Core resize function
// ────────────────────────────────────────────────────────────────

// Near-lossless quality for the LARGE (print/export source) variant when it must
// be re-encoded (EXIF orientation ≠ 1). Higher than the display default so the
// exported image keeps the source detail.
const LARGE_VARIANT_QUALITY = 0.95;

/**
 * Given a File, produce { large, medium, small } Blobs and the
 * natural (orientation-corrected) dimensions.
 *
 * @param {File}   file           – The user-selected image file.
 * @param {string} [outputType]   – MIME type for resized blobs
 *                                  (default: same as input or image/jpeg).
 * @param {number} [quality=0.85] – Encoding quality (0-1).
 * @param {object} [opts]
 * @param {number}   [opts.thumbMaxDim] – If set, also generate a small
 *                                        preview thumbnail (longest side
 *                                        capped at this many px).
 * @param {Function} [opts.onThumb]     – Called with the thumbnail Blob as
 *                                        soon as it is ready (before the
 *                                        heavier variants are encoded).
 * @returns {Promise<{
 *   large:  Blob,
 *   medium: Blob,
 *   small:  Blob,
 *   thumb:  Blob|null,
 *   width:  number,
 *   height: number,
 *   mimeType: string
 * }>}
 */
export async function resizeImage(file, outputType, quality = 0.85, opts = {}) {
  if (!file || typeof file.slice !== "function") {
    throw new Error("resizeImage: expected a File or Blob");
  }

  const mime =
    outputType ||
    (file.type === "image/png" ? "image/png" : "image/jpeg");

  // 1. Read EXIF orientation (cheap – only 64 KB read). Used ONLY to decide
  //    whether the original bytes can be reused as the Large variant.
  const orientation = await readExifOrientation(file);

  // 2. Decode into an ImageBitmap with the browser applying EXIF orientation
  //    ("from-image") — exactly as an <img> tag (and Windows Photos) display it.
  //    ★ Why NOT the old "none" + manual-rotate approach: it relied on the
  //    browser honoring imageOrientation:"none" (raw pixels) and then rotated
  //    manually. On any engine that IGNORES "none" (it applies EXIF anyway), the
  //    manual rotation became a SECOND rotation — turning EXIF-rotated portrait
  //    photos into landscape ("portrait sometimes uploads as landscape"). Baking
  //    EXIF in via the browser is correct on every engine and needs no manual
  //    math, so the decoded pixels always match what the user sees.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    throw new Error(`Failed to decode image (${file.type || "unknown type"}): ${err.message}`);
  }

  // The bitmap is already EXIF-corrected → its dimensions ARE the natural
  // (display) dimensions and no per-variant rotation is needed.
  const natW = bitmap.width;
  const natH = bitmap.height;

  // Helper: draw the (already-oriented) bitmap onto a canvas at the target size.
  async function drawToBlob(targetW, targetH, blobMime = mime, blobQuality = quality) {
    const useOffscreen = typeof OffscreenCanvas !== "undefined";
    if (!useOffscreen && typeof document === "undefined") {
      // Worker context without OffscreenCanvas — caller must fall back
      // to the main thread.
      throw new Error("worker-unsupported");
    }
    let canvas = useOffscreen
      ? new OffscreenCanvas(targetW, targetH)
      : document.createElement("canvas");

    if (!useOffscreen) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    let ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire 2D canvas context");
    }

    try {
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, targetW, targetH);

      const blob = useOffscreen
        ? await canvas.convertToBlob({ type: blobMime, quality: blobQuality })
        : await new Promise((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
              blobMime,
              blobQuality
            );
          });

      if (!blob) throw new Error("Blob generation failed");
      return blob;
    } finally {
      // Aggressively release canvas memory — mobile Safari is slow to GC
      // canvases and stacking three full-size ones causes tab reloads.
      try {
        canvas.width = 0;
        canvas.height = 0;
      } catch {
        /* some engines reject 0-size — ignore */
      }
      ctx = null;
      canvas = null;
    }
  }

  // 4. Generate the variants at EXIF-corrected dimensions, sequentially.
  // ★ IMPORTANT: When EXIF orientation ≠ 1 we must re-encode the large
  //   variant (not keep the raw original File). The server reads actual
  //   pixel dimensions from the uploaded blob — sending the raw JPEG with
  //   an EXIF rotation tag results in the server storing the unrotated
  //   (landscape) w/h in the DB.
  //   When orientation IS 1 the original bytes already match the decoded
  //   pixel dimensions, so we upload the untouched original as Large.
  //   That skips the most expensive encode (seconds of CPU on a ~50 MP
  //   photo) AND avoids a lossy re-encode generation for print.
  //   (PNG: browsers can't write eXIf anyway and our reader returns 1,
  //   so reusing the original is also dimension-correct.)
  // Sequential (not parallel) keeps peak memory to one canvas at a time —
  // necessary on mobile to avoid GPU memory spikes and tab crashes.
  const reuseOriginalAsLarge =
    orientation === 1 &&
    (file.type === "image/jpeg" || file.type === "image/png") &&
    !outputType; // explicit outputType means caller wants transcoding

  const mediumW = Math.max(1, Math.floor(natW * 0.5));
  const mediumH = Math.max(1, Math.floor(natH * 0.5));
  const smallW  = Math.max(1, Math.floor(natW * 0.25));
  const smallH  = Math.max(1, Math.floor(natH * 0.25));

  try {
    // Thumbnail first — it's nearly free and lets the UI show a preview
    // while the heavy variants are still encoding.
    let thumbBlob = null;
    if (opts.thumbMaxDim > 0) {
      const thumbScale = Math.min(1, opts.thumbMaxDim / Math.max(natW, natH));
      const thumbW = Math.max(1, Math.round(natW * thumbScale));
      const thumbH = Math.max(1, Math.round(natH * thumbScale));
      thumbBlob = await drawToBlob(thumbW, thumbH, mime, 0.85);
      try {
        // Natural (EXIF-corrected) dims ride along — optimistic placement
        // needs them for fit math before the upload completes.
        opts.onThumb?.(thumbBlob, { width: natW, height: natH });
      } catch {
        /* preview callback must never break the upload */
      }
    }

    // The LARGE variant is the print/export source, so when we DO have to
    // re-encode it (EXIF orientation ≠ 1 — most phone/portrait photos), encode
    // near-lossless (0.95) instead of the display-oriented 0.85 default. This is
    // the one always-on quality loss between a placed photo and its export; the
    // medium/small variants (canvas display only) stay at the lighter default.
    const largeBlob = reuseOriginalAsLarge
      ? file
      : await drawToBlob(natW, natH, mime, LARGE_VARIANT_QUALITY);
    const mediumBlob = await drawToBlob(mediumW, mediumH);
    const smallBlob = await drawToBlob(smallW, smallH);

    return {
      large: largeBlob,
      medium: mediumBlob,
      small: smallBlob,
      thumb: thumbBlob,
      width: natW,
      height: natH,
      mimeType: mime,
    };
  } finally {
    // Close bitmap whether we succeeded or failed
    try {
      bitmap.close();
    } catch {
      /* ignore */
    }
  }
}

export default resizeImage;
