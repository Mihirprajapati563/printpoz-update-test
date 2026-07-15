/**
 * Google Font Fetcher Utility
 * Fetches actual TTF font files from Google Fonts CDN by parsing the CSS response.
 * Uses a TTF-compatible user-agent to get .ttf URLs instead of woff2.
 */

// User-agent that forces Google Fonts to return TTF URLs
const TTF_USER_AGENT =
  "Mozilla/4.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36";

/**
 * Build a Google Fonts CSS2 API URL from a family name.
 * Requests all available weights (100..900) in both normal and italic.
 * @param {string} familyName - e.g. "Roboto", "Open Sans"
 * @returns {string} Google Fonts CSS2 URL
 */
function buildGoogleFontsUrl(familyName) {
  const encoded = encodeURIComponent(familyName);
  // Request full weight range with italic axis
  return `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap`;
}

/**
 * Extract font family name from a Google Fonts URL.
 * Supports both css and css2 API formats.
 * @param {string} url - Google Fonts CSS URL
 * @returns {string|null} Font family name or null
 */
export function extractFamilyFromUrl(url) {
  if (!url) return null;
  // Match family= parameter (handles + for spaces)
  const match = url.match(/family=([^&:;]+)/);
  if (match) {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  }
  return null;
}

/**
 * Parse Google Fonts CSS response to extract @font-face declarations.
 * Each declaration contains a src url and font metadata.
 * @param {string} css - Raw CSS text from Google Fonts
 * @returns {Array<{url: string, weight: number, style: string, family: string}>}
 */
function parseFontFacesFromCSS(css) {
  const facesMap = new Map();

  // Split CSS into blocks, keeping the comment above each @font-face
  // Google Fonts CSS2 includes comments like /* latin */ before each block
  const blocks = css.split(/@font-face\s*\{/);

  for (let i = 1; i < blocks.length; i++) {
    const blockContent = blocks[i].split("}")[0];
    // The comment/subset label is in the preceding text
    const precedingText = blocks[i - 1] || "";

    // Extract src url
    const urlMatch = blockContent.match(/src:\s*url\(([^)]+)\)/);
    if (!urlMatch) continue;
    const url = urlMatch[1].replace(/['"]/g, "");

    // Extract font-weight
    const weightMatch = blockContent.match(/font-weight:\s*(\d+)/);
    const weight = weightMatch ? parseInt(weightMatch[1], 10) : 400;

    // Extract font-style
    const styleMatch = blockContent.match(/font-style:\s*(\w+)/);
    const style = styleMatch ? styleMatch[1] : "normal";

    // Extract font-family
    const familyMatch = blockContent.match(/font-family:\s*['"]?([^'";]+)['"]?/);
    const family = familyMatch ? familyMatch[1].trim() : "";

    // Check if this block is the 'latin' subset (preferred for preview)
    const isLatin = /\/\*\s*latin\s*\*\//.test(precedingText) &&
      !/\/\*\s*latin-ext\s*\*\//.test(precedingText);

    // Deduplicate by weight+style — Google Fonts CSS2 returns multiple
    // @font-face blocks per variant for different unicode-range subsets.
    // Prefer the 'latin' subset which covers standard ASCII characters.
    const key = `${weight}_${style}`;
    if (!facesMap.has(key) || isLatin) {
      facesMap.set(key, { url, weight, style, family });
    }
  }

  return Array.from(facesMap.values());
}

/**
 * Fetch the Google Fonts CSS and parse it to get TTF file URLs.
 * Uses a CORS proxy approach — fetches via the browser since Google Fonts
 * CSS endpoint doesn't have CORS restrictions for CSS requests.
 * @param {string} input - Google Fonts URL or font family name
 * @returns {Promise<{familyName: string, faces: Array}>}
 */
export async function fetchGoogleFontCSS(input) {
  let cssUrl;
  let familyName;

  if (input.startsWith("http")) {
    cssUrl = input;
    familyName = extractFamilyFromUrl(input);
  } else {
    // Treat as family name
    familyName = input.trim();
    cssUrl = buildGoogleFontsUrl(familyName);
  }

  if (!familyName) {
    throw new Error("Could not determine font family name from input.");
  }

  // Fetch CSS with TTF user-agent via a fetch request
  // Google Fonts serves different formats based on user-agent
  // We need to use a proxy or server-side fetch for the TTF user-agent trick
  // Since we're in a browser, we'll fetch the CSS and it will return woff2 URLs
  // Then we'll try to convert the URL pattern to get TTF
  const response = await fetch(cssUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Fonts CSS: ${response.status} ${response.statusText}. Please check the font name or URL.`);
  }

  const css = await response.text();
  const faces = parseFontFacesFromCSS(css);

  if (faces.length === 0) {
    throw new Error("No font faces found in the Google Fonts response. Please check the font name or URL.");
  }

  return { familyName, faces };
}

/**
 * Download a font file from a URL and convert it to a File object.
 * @param {string} url - Font file URL
 * @param {string} fileName - Desired file name
 * @returns {Promise<File>} File object
 */
async function downloadFontFile(url, fileName) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download font file: ${response.status}`);
  }
  const blob = await response.blob();

  // Determine extension from URL or content type
  let ext = ".woff2";
  if (url.includes(".ttf")) ext = ".ttf";
  else if (url.includes(".otf")) ext = ".otf";
  else if (url.includes(".woff2")) ext = ".woff2";
  else if (url.includes(".woff")) ext = ".woff";

  const finalName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
  const mimeType = blob.type || "font/woff2";

  return new File([blob], finalName, { type: mimeType });
}

/**
 * Fetch all font files for a Google Font family.
 * Downloads each variant (weight + style) as a File object.
 * @param {string} input - Google Fonts URL or font family name
 * @param {function} onProgress - Optional callback (current, total) for progress
 * @returns {Promise<{familyName: string, files: File[]}>}
 */
export async function fetchGoogleFontFiles(input, onProgress) {
  const { familyName, faces } = await fetchGoogleFontCSS(input);

  const files = [];
  const total = faces.length;

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const styleSuffix = face.style === "italic" ? "_italic" : "";
    const fileName = `${familyName.replace(/\s+/g, "-")}-${face.weight}${styleSuffix}`;

    try {
      const file = await downloadFontFile(face.url, fileName);
      files.push(file);
    } catch (err) {
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  if (files.length === 0) {
    throw new Error("Failed to download any font files. Please try again.");
  }

  return { familyName, files };
}
