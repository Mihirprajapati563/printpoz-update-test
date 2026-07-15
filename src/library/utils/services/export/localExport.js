/**
 * localExport.js — desktop client-side page render (replaces server exportAsJpeg).
 * ─────────────────────────────────────────────────────────────────
 * On desktop, pages are rendered LOCALLY in an offscreen Electron window instead
 * of being sent to the server's headless Chrome. This is REQUIRED, not just an
 * optimization: user photos are now local `app-assets://` files the server cannot
 * see, so a server render would produce blank images.
 *
 * `renderSvgToBlobLocal()` returns the SAME thing the server call returned (a Blob),
 * so every export/texture call site only needs a one-line `isDesktop` branch.
 *
 * Fonts: the offscreen window is a fresh document with none of the editor's loaded
 * fonts, so we rebuild self-contained @font-face rules from the font registry in
 * fontLoader.js — custom fonts as base64 `data:` URIs (fully offline), Google fonts
 * via their css2 stylesheet (online on first use, then served from cache).
 *
 * Font cache strategy:
 *  - Custom fonts: in-memory Map keyed by fileUrl → base64 data URI.
 *    Re-fetching local app-assets:// files is fast, but caching avoids any I/O
 *    round-trips during back-to-back page exports.
 *  - Google fonts: two-tier:
 *      1. In-memory Map keyed by css2 URL (valid for the whole session).
 *      2. localStorage key "export:googleFontCss:<url>" (valid across restarts).
 *    Google font CSS only changes when the URL changes (i.e. when the variant set
 *    changes), so it is safe to cache indefinitely. Re-downloaded only if missing
 *    from both caches.
 */

import { isDesktop, desktop } from "../../../../desktop";
import {
  getCustomFontSources,
  getGoogleFontSources,
} from "../../common-functions/fontLoader";
import { extractFontsFromSvg } from "../../common-functions/extractFontsFromSvg";
import { embedImageDpi } from "./embedDpi";

/** True only when the desktop offscreen-render bridge is available. */
export const localExportEnabled = isDesktop && !!(desktop && desktop.export);

// ── Font data caches ──────────────────────────────────────────────────────────

/**
 * In-memory cache: fileUrl → base64 data URI.
 * Custom fonts are local files — avoids repeated I/O on multi-page exports.
 */
const customFontDataCache = new Map();

/**
 * In-memory cache: googleCss2Url → CSS text.
 * Populated from localStorage on first hit, then kept hot for the session.
 */
const googleFontCssMemoryCache = new Map();

const GFONT_LS_PREFIX = "export:googleFontCss:";

function readGoogleFontCssFromStorage(url) {
  try {
    return localStorage.getItem(GFONT_LS_PREFIX + url) || null;
  } catch {
    return null;
  }
}

function saveGoogleFontCssToStorage(url, css) {
  try {
    localStorage.setItem(GFONT_LS_PREFIX + url, css);
  } catch {
    // Storage quota exceeded — not a fatal error, just skip caching.
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000; // avoid call-stack limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const mimeForFormat = (format) =>
  ({ woff2: "font/woff2", woff: "font/woff", truetype: "font/ttf", opentype: "font/otf" }[
    format
  ] || "font/woff2");

function googleCss2Url(familyValue, variants) {
  const tuples = variants
    .map((v) => `${v.style === "italic" ? 1 : 0},${v.weight}`)
    .sort();
  const familyParam = `${familyValue.replace(/ /g, "+")}:ital,wght@${tuples.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
}

// ── Core font CSS builder ─────────────────────────────────────────────────────

/**
 * Build the @font-face CSS to inject into the offscreen render window.
 * Custom fonts → self-contained data: URIs (in-memory cached).
 * Google fonts  → inlined css2 stylesheet (localStorage + in-memory cached).
 *
 * @param {Array<{name:string, weights?:string}>} usedFonts
 * @returns {Promise<string>}
 */
async function buildExportFontCss(usedFonts) {
  const usedFamilies = new Set(
    (usedFonts || []).map((f) => String(f?.name || "").trim().toLowerCase()).filter(Boolean)
  );

  const blocks = [];

  // ── Custom fonts → self-contained data: URIs ──────────────────────
  const customSources = getCustomFontSources().filter(
    (s) => usedFamilies.size === 0 || usedFamilies.has(s.family.toLowerCase())
  );
  await Promise.all(
    customSources.map(async (s) => {
      try {
        let dataUri = customFontDataCache.get(s.fileUrl);
        if (!dataUri) {
          const res = await fetch(s.fileUrl);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          dataUri = `data:${mimeForFormat(s.format)};base64,${arrayBufferToBase64(buf)}`;
          customFontDataCache.set(s.fileUrl, dataUri);
        }
        blocks.push(
          `@font-face{font-family:"${s.family}";font-weight:${s.weight};` +
            `font-style:${s.style};font-display:swap;` +
            `src:url("${dataUri}") format("${s.format}");}`
        );
      } catch {
        /* one font failing must not break the whole export */
      }
    })
  );

  // ── Google fonts → cached css2 stylesheet ────────────────────────
  // Priority: in-memory → localStorage → network. After first fetch, saved to
  // both caches so subsequent pages / restarts skip the network entirely.
  const googleSources = getGoogleFontSources().filter(
    (g) => usedFamilies.size === 0 || usedFamilies.has(g.familyValue.toLowerCase())
  );
  await Promise.all(
    googleSources.map(async (g) => {
      const url = googleCss2Url(g.familyValue, g.variants);
      try {
        // 1. In-memory (hottest — zero I/O)
        if (googleFontCssMemoryCache.has(url)) {
          blocks.push(googleFontCssMemoryCache.get(url));
          return;
        }
        // 2. localStorage (persisted across restarts — no network round-trip)
        const stored = readGoogleFontCssFromStorage(url);
        if (stored) {
          googleFontCssMemoryCache.set(url, stored);
          blocks.push(stored);
          return;
        }
        // 3. Network fetch (first time only for this variant set)
        const res = await fetch(url);
        if (!res.ok) return;
        const css = await res.text();
        googleFontCssMemoryCache.set(url, css);
        saveGoogleFontCssToStorage(url, css);
        blocks.push(css);
      } catch {
        /* Google font unavailable offline — text falls back to a system font */
      }
    })
  );

  return blocks.join("\n");
}

/**
 * Clear the Google font CSS localStorage cache (e.g., to force re-fetching after
 * a font update). In-memory cache is also wiped so the change takes effect immediately.
 * Exposed for debugging / settings UI if needed.
 */
export function clearGoogleFontCssCache() {
  googleFontCssMemoryCache.clear();
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GFONT_LS_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage may be unavailable — not fatal */
  }
}

/**
 * Render one page SVG to an image Blob locally (desktop only).
 * @param {{ svgDetails:string, fonts?:Array, w:number, h:number, format?:string, quality?:number, scale?:number, dpi?:number }} args
 * @returns {Promise<Blob>}
 */
export async function renderSvgToBlobLocal({ svgDetails, fonts, w, h, format, quality, scale, dpi }) {
  const usedFonts = fonts && fonts.length ? fonts : extractFontsFromSvg(svgDetails);
  const fontFaceCss = await buildExportFontCss(usedFonts);
  const isPng = String(format || "").toLowerCase() === "png";

  // DPI upscale: render the page at scale× its logical pixels so placed photos
  // are sampled at higher resolution (the SVG viewBox keeps the layout identical).
  const s = typeof scale === "number" && scale > 0 ? scale : 1;
  const renderW = Math.round(w * s);
  const renderH = Math.round(h * s);

  // Main renders the WHOLE page in one shot via CDP Page.captureScreenshot and
  // returns it as a single encoded image (`result.bytes`). Only when a page
  // exceeds Chromium's texture cap does it return a few large `result.tiles`
  // (bands) we stitch here. Main does the single final encode honoring the format
  // and quality we pass — so there is no quality-degrading double-encode.
  // Near-lossless JPEG for print. 98 keeps photographic detail crisp (larger file
  // than 95, but this is a print/export source, not a web asset).
  const jpegQuality =
    typeof quality === "number" && quality > 1 ? Math.round(quality) : 98;
  const result = await desktop.export.renderSvg({
    svg: svgDetails,
    width: renderW,
    height: renderH,
    fontFaceCss,
    format: isPng ? "png" : "jpeg",
    quality: jpegQuality,
  });

  const outMime = (result.format || (isPng ? "png" : "jpeg")) === "png" ? "image/png" : "image/jpeg";

  let blob;
  if (result.bytes) {
    // Common path: the entire page is ONE image already encoded in main — wrap it
    // directly, no canvas round-trip (no extra decode/re-encode, no softening).
    blob = new Blob([result.bytes], { type: outMime });
  } else if (result.tiles && result.tiles.length) {
    // Rare band fallback (page larger than the 16384px texture cap): stitch the
    // vertical/horizontal bands onto a full-size canvas, then encode once.
    const canvas = document.createElement("canvas");
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, result.width, result.height);
    for (const tile of result.tiles) {
      const tb = new Blob([tile.bytes], { type: outMime });
      const bmp = await createImageBitmap(tb);
      ctx.drawImage(bmp, tile.x, tile.y, tile.w, tile.h);
      bmp.close();
    }
    blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outMime, jpegQuality / 100)
    );
    // toBlob resolves null if the canvas exceeds Chromium's max area (~268M px)
    // or the encode fails — surface a clear error instead of passing null into
    // embedImageDpi (which would throw a confusing "blob.arrayBuffer is not a
    // function"). Frees the giant canvas either way.
    canvas.width = canvas.height = 0;
    if (!blob) {
      throw new Error(
        `Export failed: page ${result.width}×${result.height}px is too large to assemble.`
      );
    }
  } else {
    throw new Error("renderSvg returned no image data (neither bytes nor tiles)");
  }

  // Embed the design's print resolution (DPI) into the file metadata so viewers
  // report the resolution the user set (not the default 96). embedImageDpi patches
  // the raw JPEG/PNG density bytes without decoding. dpi = outputPixels /
  // (logicalPixels / designDpi); at scale 1 (the default 200-DPI case) this is
  // exactly the DPI the user set on the theme.
  const designDpi = typeof dpi === "number" && dpi > 0 ? dpi : 200;
  const dpiX = w > 0 ? Math.round((result.width * designDpi) / w) : designDpi;
  const dpiY = h > 0 ? Math.round((result.height * designDpi) / h) : designDpi;
  return await embedImageDpi(blob, dpiX, dpiY);
}
