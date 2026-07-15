/**
 * fontLoader.js
 * FontFace API utilities for dynamically loading font files at runtime.
 * Used by FontContext to load WOFF2 fonts on demand.
 */

import { isDesktop, desktop } from "../../../desktop";

// In-flight load promises to prevent duplicate requests for the same font
const loadingPromises = new Map();

// Track which fonts are already registered in document.fonts
const registeredFonts = new Set();

// ── Export font registry ───────────────────────────────────────────
// The desktop client-side export renders each page in a FRESH offscreen document,
// which has none of this document's loaded fonts. So we record where every font
// came from here, letting the exporter rebuild self-contained @font-face rules
// (data: URIs for custom fonts; the css2 URL for Google fonts). Web export is
// unaffected — the server loads fonts itself.
const customFontSources = new Map(); // fontKey -> { family, fileUrl, format, weight, style }
const googleFontSources = new Map(); // family(lowercased) -> { familyValue, variants:Set<"weight|style"> }

/** All custom (non-Google) font variants loaded this session. */
export function getCustomFontSources() {
  return Array.from(customFontSources.values());
}

/** All Google font families loaded this session, with their variants. */
export function getGoogleFontSources() {
  return Array.from(googleFontSources.values()).map((e) => ({
    familyValue: e.familyValue,
    variants: Array.from(e.variants).map((v) => {
      const [weight, style] = v.split("|");
      return { weight: Number(weight), style };
    }),
  }));
}

/**
 * Build a unique key for a font variant
 * @param {string} familyName - CSS font-family name (e.g. "Bungee Shade")
 * @param {number|string} weight - Font weight (e.g. 400)
 * @param {string} style - Font style ("normal" or "italic")
 * @returns {string} Unique key
 */
function fontKey(familyName, weight, style) {
  return `${familyName}__${weight}__${style || "normal"}`;
}

/**
 * Detect the correct font format from a file URL
 * @param {string} url - Font file URL
 * @returns {string} Format string for FontFace descriptor
 */
function detectFormat(url) {
  const lower = url.toLowerCase();
  if (lower.includes(".woff2")) return "woff2";
  if (lower.includes(".woff")) return "woff";
  if (lower.includes(".ttf")) return "truetype";
  if (lower.includes(".otf")) return "opentype";
  return "woff2"; // default for CDN fonts
}

/**
 * Check if a specific font variant is already loaded in the browser
 * @param {string} familyName - CSS font-family name
 * @param {number|string} weight - Font weight
 * @param {string} style - Font style
 * @returns {boolean}
 */
export function isFontLoaded(familyName, weight = 400, style = "normal") {
  return registeredFonts.has(fontKey(familyName, weight, style));
}

/**
 * Load a single font variant via the FontFace API
 * Returns immediately if already loaded. Deduplicates in-flight requests.
 *
 * @param {string} familyName - CSS font-family name to register (e.g. "Bungee Shade")
 * @param {string} fileUrl - URL to the font file (WOFF2/WOFF/TTF/OTF)
 * @param {number|string} weight - Font weight (100-900)
 * @param {string} style - Font style ("normal" or "italic")
 * @returns {Promise<boolean>} true if loaded successfully, false on error
 */
export async function loadFontFile(familyName, fileUrl, weight = 400, style = "normal") {
  const key = fontKey(familyName, weight, style);

  // Already loaded — skip
  if (registeredFonts.has(key)) {
    return true;
  }

  // Already loading — return existing promise
  if (loadingPromises.has(key)) {
    return loadingPromises.get(key);
  }

  const format = detectFormat(fileUrl);

  // Record the source so desktop export can embed this font self-contained.
  customFontSources.set(key, {
    family: familyName,
    fileUrl,
    format,
    weight: String(weight),
    style: style || "normal",
  });

  const descriptors = {
    weight: String(weight),
    style: style || "normal",
    display: "swap",
  };

  const promise = (async () => {
    try {
      let fontFace;
      // Desktop: load from the on-disk font cache (download once, then reuse
      // across sessions). On a miss, fetch the URL, register from the bytes, and
      // write them to the cache for next time. Web keeps the plain url() source.
      if (isDesktop && desktop?.fonts) {
        let buf = null;
        try {
          buf = await desktop.fonts.cacheGet(fileUrl);
        } catch {
          buf = null;
        }
        if (!buf) {
          try {
            const res = await fetch(fileUrl);
            if (res.ok) {
              buf = await res.arrayBuffer();
              desktop.fonts.cachePut(fileUrl, buf).catch(() => {});
            }
          } catch {
            buf = null;
          }
        }
        fontFace = buf
          ? new FontFace(familyName, buf, descriptors)
          : new FontFace(familyName, `url("${fileUrl}") format("${format}")`, descriptors);
      } else {
        fontFace = new FontFace(familyName, `url("${fileUrl}") format("${format}")`, descriptors);
      }

      await fontFace.load();
      document.fonts.add(fontFace);
      registeredFonts.add(key);
      return true;
    } catch (err) {
      return false;
    } finally {
      loadingPromises.delete(key);
    }
  })();

  loadingPromises.set(key, promise);
  return promise;
}

/**
 * Load multiple font variants in parallel
 * @param {Array<{familyName: string, fileUrl: string, weight: number|string, style: string}>} fonts
 * @returns {Promise<boolean[]>} Array of success/failure results
 */
export async function loadFontFiles(fonts) {
  return Promise.all(
    fonts.map((f) => loadFontFile(f.familyName, f.fileUrl, f.weight, f.style))
  );
}

/**
 * Find the nearest available weight from a list of available weights
 * @param {number[]} availableWeights - Sorted array of available weights
 * @param {number} targetWeight - Desired weight
 * @returns {number} Nearest available weight
 */
export function findNearestWeight(availableWeights, targetWeight) {
  if (!availableWeights || availableWeights.length === 0) return 400;
  if (availableWeights.includes(targetWeight)) return targetWeight;

  let nearest = availableWeights[0];
  let minDiff = Math.abs(targetWeight - nearest);

  for (const w of availableWeights) {
    const diff = Math.abs(targetWeight - w);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = w;
    }
  }

  return nearest;
}

/**
 * Track which Google Font families have already been injected via <link>
 */
const injectedGoogleFonts = new Set();

/**
 * Load a Google Font family + specific weights/styles via the Google Fonts CSS2 API.
 * Injects a <link> tag into <head>. Deduplicates by family name.
 *
 * @param {string} familyValue - CSS font-family value (e.g. "Noto Sans Gujarati", "Poppins")
 * @param {Array<{weight: number, style: string}>} variants - Weight/style combos to load
 * @returns {Promise<boolean>} true when stylesheet loaded
 */
export function loadGoogleFont(familyValue, variants = [{ weight: 400, style: "normal" }]) {
  // Build a unique key for this family + variants combo
  const variantKey = variants.map((v) => `${v.weight}${v.style === "italic" ? "i" : ""}`).sort().join(",");
  const key = `${familyValue}__${variantKey}`;

  // Record for desktop export (rebuilt as a css2 link in the offscreen window).
  const famLower = familyValue.toLowerCase();
  if (!googleFontSources.has(famLower)) {
    googleFontSources.set(famLower, { familyValue, variants: new Set() });
  }
  for (const v of variants) {
    googleFontSources.get(famLower).variants.add(`${v.weight}|${v.style || "normal"}`);
  }

  if (injectedGoogleFonts.has(key)) return Promise.resolve(true);
  injectedGoogleFonts.add(key);

  return new Promise((resolve) => {
    try {
      // Build Google Fonts CSS2 URL
      // Format: family=Poppins:ital,wght@0,400;0,700;1,400
      const tuples = [];
      for (const v of variants) {
        const ital = v.style === "italic" ? 1 : 0;
        tuples.push(`${ital},${v.weight}`);
      }
      // Sort tuples for consistent URL
      tuples.sort();

      const familyParam = `${familyValue.replace(/ /g, "+")}:ital,wght@${tuples.join(";")}`;
      const url = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => {
        // Mark all variants as registered so isFontLoaded returns true
        for (const v of variants) {
          registeredFonts.add(fontKey(familyValue, v.weight, v.style || "normal"));
        }
        resolve(true);
      };
      link.onerror = () => {
        injectedGoogleFonts.delete(key);
        resolve(false);
      };
      document.head.appendChild(link);
    } catch (err) {
      injectedGoogleFonts.delete(key);
      resolve(false);
    }
  });
}

/**
 * Load multiple Google Font families in parallel
 * @param {Array<{familyValue: string, variants: Array<{weight: number, style: string}>}>} fonts
 * @returns {Promise<boolean[]>}
 */
export function loadGoogleFonts(fonts) {
  return Promise.all(fonts.map((f) => loadGoogleFont(f.familyValue, f.variants)));
}

/**
 * Get all currently registered font keys (for debugging)
 * @returns {string[]}
 */
export function getRegisteredFonts() {
  return Array.from(registeredFonts);
}
