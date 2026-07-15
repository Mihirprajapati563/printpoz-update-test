// ── Design thumbnail generator ───────────────────────────────────────────────
// Builds a small, self-contained SVG preview (as a data-URL) of a design's first
// content page, for the Saved Designs cards. It reuses the data-driven
// `generatePageSvg` (no DOM / no network) so it works at auto-save time in any
// editor session.
//
// This is best-effort: it must NEVER throw into the save path. Any failure
// returns null and the card falls back to a category placeholder. For multi-side
// spreads it renders the full spread; for single-layout products it renders the
// single page — both produce a recognisable preview.

import { generatePageSvg } from "../common-functions/generatePageSvg.js";
import {
  localExportEnabled,
  renderSvgToBlobLocal,
} from "../services/export/localExport.js";

/**
 * Flatten a page's layouts into the flat `allObjects` array generatePageSvg
 * expects: each object tagged with its `layoutIndex`. Objects keep their raw
 * spread-space `transform.x` (the generator positions layout[1] at +halfWidth
 * for spreads and ignores the offset for single-side pages).
 */
const flattenPageObjects = (page) => {
  const layouts = Array.isArray(page?.layout) ? page.layout : [];
  const objects = [];
  const safeAreaObjects = [];
  layouts.forEach((layout, layoutIndex) => {
    (layout?.objects || []).forEach((obj) =>
      objects.push({ ...obj, layoutIndex })
    );
    (layout?.safeAreaObjects || []).forEach((obj) =>
      safeAreaObjects.push({ ...obj, layoutIndex })
    );
  });
  return { objects, safeAreaObjects };
};

// An object that visibly shows something (a plain white background or empty
// photo box does NOT count — those render as a blank card).
const objHasVisible = (o) =>
  !!o &&
  ((o.type === "text" && String(o.text || "").trim() !== "") ||
    o.type === "sticker" ||
    o.type === "shape" ||
    o.type === "calendar" ||
    o.type === "multiple-calendar" ||
    o.type === "qr" ||
    (o.type === "img" && String(o.url || "").trim() !== ""));

// A layout that actually shows content — a visible object or a background IMAGE
// (a background COLOR alone is not distinctive enough to be worth a thumbnail).
// An empty photobook cover has a layout but nothing visible, so we skip it.
const layoutHasContent = (l) =>
  !!l &&
  ((Array.isArray(l.objects) && l.objects.some(objHasVisible)) ||
    (Array.isArray(l.safeAreaObjects) && l.safeAreaObjects.some(objHasVisible)) ||
    !!(l.background && l.background.image));

/** Pick the first page that actually shows content (falls back to any page). */
const firstContentPage = (pages) =>
  (pages || []).find(
    (p) => Array.isArray(p?.layout) && p.layout.some(layoutHasContent)
  ) ||
  (pages || []).find((p) => Array.isArray(p?.layout) && p.layout.length > 0) ||
  (pages || [])[0] ||
  null;

/**
 * Encode an SVG string as a UTF-8-safe base64 data-URL. `btoa` alone throws on
 * non-Latin1 characters (e.g. accented/emoji text content), so we percent-encode
 * to bytes first.
 */
const svgToDataUrl = (svg) => {
  try {
    const b64 = btoa(
      encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16))
      )
    );
    return `data:image/svg+xml;base64,${b64}`;
  } catch (_) {
    return null;
  }
};

/**
 * Generate a thumbnail data-URL for a design.
 *
 * @param {object} args
 * @param {Array}  args.pages        decompressed pages array
 * @param {object} args.canvasSize   { width, height, ... }
 * @param {string} args.editorType
 * @param {object} [args.settings]
 * @param {object} [args.calendarSettings]
 * @returns {string|null} data:image/svg+xml;base64,… or null on failure
 */
export const generateDesignThumbnail = ({
  pages,
  canvasSize,
  editorType,
  settings,
  calendarSettings,
} = {}) => {
  try {
    if (!Array.isArray(pages) || pages.length === 0 || !canvasSize) return null;
    const page = firstContentPage(pages);
    if (!page) return null;

    const pageIndex = pages.indexOf(page);
    const { objects, safeAreaObjects } = flattenPageObjects(page);

    const result = generatePageSvg({
      page,
      pageIndex: pageIndex < 0 ? 0 : pageIndex,
      canvasSize,
      allObjects: objects,
      allSafeAreaObjects: safeAreaObjects,
      allPages: pages,
      calendarSettings,
      settings,
      activeEditorType: editorType,
      totalPages: pages.length,
      isPreviewBook: false,
      includeGuides: false,
    });

    if (!result?.svgContent) return null;
    return svgToDataUrl(result.svgContent);
  } catch (_) {
    return null;
  }
};

// ── Raster thumbnail (JPEG, shows photos) — DESKTOP via the export pipeline ────
// The sync SVG above can't show photos: an SVG loaded via <img src="data:…">
// won't fetch external images, and rasterizing it in-renderer TAINTS the canvas
// (photo foreignObject) so toDataURL fails. Instead reuse the PROVEN export
// path: renderSvgToBlobLocal renders the page SVG in an offscreen Electron
// window and returns plain untainted raster tiles → a real JPEG with photos and
// fonts. We render only the COVER/first content page, small and low-quality, so
// the thumbnail stays tiny. Desktop-only (needs the export bridge); on web the
// caller falls back to the sync SVG.

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Async JPEG thumbnail (data-URL) of a design's COVER/first content page,
 * rendered through the desktop export pipeline (photos + fonts, never tainted).
 * Small + low quality so it stays lightweight. Resolves null when unavailable
 * (web / no export bridge) or on any failure — the caller falls back to the
 * sync SVG.
 *
 * @param {object} args
 * @param {number} [args.maxDim]     longest edge of the output (default 420px)
 * @param {number} [args.quality]    JPEG quality 1-100 (default 55 — thumbnails)
 */
export const generateDesignThumbnailAsync = async ({
  pages,
  canvasSize,
  editorType,
  settings,
  calendarSettings,
  maxDim = 420,
  quality = 55,
} = {}) => {
  try {
    // eslint-disable-next-line no-console
    console.warn("[thumb] generateDesignThumbnailAsync CALLED", {
      localExportEnabled,
      pages: Array.isArray(pages) ? pages.length : "not-array",
      canvasSize: canvasSize ? `${canvasSize.width}x${canvasSize.height}` : "null",
    });
    if (!localExportEnabled) return null; // desktop-only reliable path
    if (!Array.isArray(pages) || pages.length === 0 || !canvasSize) return null;
    const page = firstContentPage(pages);
    if (!page) return null;

    const pageIndex = Math.max(0, pages.indexOf(page));
    const { objects, safeAreaObjects } = flattenPageObjects(page);

    const result = generatePageSvg({
      page,
      pageIndex,
      canvasSize,
      allObjects: objects,
      allSafeAreaObjects: safeAreaObjects,
      allPages: pages,
      calendarSettings,
      settings,
      activeEditorType: editorType,
      totalPages: pages.length,
      isPreviewBook: false,
      includeGuides: false,
    });
    if (!result?.svgContent) return null;

    const svgWidth = Number(result.width) || canvasSize.width;
    const svgHeight = Number(result.height) || canvasSize.height;
    if (!svgWidth || !svgHeight) return null;

    // Downscale the render to a small thumbnail (keeps aspect ratio).
    const factor = Math.min(1, maxDim / Math.max(svgWidth, svgHeight));
    const blob = await renderSvgToBlobLocal({
      svgDetails: result.svgContent,
      fonts: result.fonts,
      w: Math.max(1, Math.round(svgWidth * factor)),
      h: Math.max(1, Math.round(svgHeight * factor)),
      scale: 1,
      format: "jpeg",
      quality,
    });
    if (!blob) {
      // Diagnostic: the offscreen render returned no blob (e.g. couldn't load a
      // sticker/photo, or produced no tiles). Surfaced so a failing thumbnail is
      // never a silent mystery.
      // eslint-disable-next-line no-console
      console.warn("[thumb] renderSvgToBlobLocal returned NO BLOB", { svgWidth, svgHeight });
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn("[thumb] renderSvgToBlobLocal OK", { blobSize: blob.size, svgWidth, svgHeight });
    return await blobToDataUrl(blob);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[thumb] generateDesignThumbnailAsync failed:", err?.message || err);
    return null;
  }
};
