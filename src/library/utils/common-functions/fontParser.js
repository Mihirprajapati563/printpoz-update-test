/**
 * Font Parser Utility
 * Zero-dependency binary reader that extracts metadata from uploaded font files
 * (.ttf, .otf, .woff, .woff2) by reading internal name, OS/2 and head tables.
 * Falls back to filename-based heuristics when tables are missing.
 */

// ---------------------------------------------------------------------------
// Tiny binary reader helpers (big-endian, which is what OpenType uses)
// ---------------------------------------------------------------------------

function getUint16(view, offset) {
  return view.getUint16(offset, false); // big-endian
}

function getUint32(view, offset) {
  return view.getUint32(offset, false);
}

// ---------------------------------------------------------------------------
// Read a string from a name record.
// platformID 3 (Windows) uses UTF-16BE; platformID 1 (Mac) uses single-byte.
// ---------------------------------------------------------------------------

function decodeNameString(data, stringOffset, length, platformID) {
  const start = stringOffset;
  if (platformID === 3 || platformID === 0) {
    // UTF-16 BE
    const codes = [];
    for (let i = 0; i < length; i += 2) {
      codes.push(getUint16(data, start + i));
    }
    return String.fromCharCode(...codes);
  }
  // Mac Roman (single-byte)
  const bytes = [];
  for (let i = 0; i < length; i++) {
    bytes.push(data.getUint8(start + i));
  }
  return String.fromCharCode(...bytes);
}

// ---------------------------------------------------------------------------
// Locate a table in the sfnt directory
// ---------------------------------------------------------------------------

function findTable(view, tag) {
  const numTables = getUint16(view, 4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const t =
      String.fromCharCode(
        view.getUint8(rec),
        view.getUint8(rec + 1),
        view.getUint8(rec + 2),
        view.getUint8(rec + 3)
      );
    if (t === tag) {
      return {
        offset: getUint32(view, rec + 8),
        length: getUint32(view, rec + 12),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse the `name` table and return a map of nameID -> string
// We prefer platformID 3 (Windows) records over platformID 1 (Mac).
// ---------------------------------------------------------------------------

function parseNameTable(view) {
  const table = findTable(view, "name");
  if (!table) return new Map();

  const off = table.offset;
  const count = getUint16(view, off + 2);
  const storageOffset = off + getUint16(view, off + 4);

  const records = new Map();
  const windowsRecords = new Map();

  for (let i = 0; i < count; i++) {
    const recOff = off + 6 + i * 12;
    const platformID = getUint16(view, recOff);
    const nameID = getUint16(view, recOff + 6);
    const strLength = getUint16(view, recOff + 8);
    const strOffset = getUint16(view, recOff + 10);

    const str = decodeNameString(
      view,
      storageOffset + strOffset,
      strLength,
      platformID
    );

    if (platformID === 3) {
      windowsRecords.set(nameID, str);
    } else if (!records.has(nameID)) {
      records.set(nameID, str);
    }
  }

  // Merge: Windows records take priority
  for (const [id, str] of windowsRecords) {
    records.set(id, str);
  }

  return records;
}

// ---------------------------------------------------------------------------
// Parse the OS/2 table for usWeightClass and fsSelection
// ---------------------------------------------------------------------------

function parseOS2Table(view) {
  const table = findTable(view, "OS/2");
  if (!table) return null;

  const off = table.offset;
  return {
    usWeightClass: getUint16(view, off + 4),
    fsSelection: getUint16(view, off + 62),
  };
}

// ---------------------------------------------------------------------------
// Parse the `head` table for macStyle (fallback italic detection)
// ---------------------------------------------------------------------------

function parseHeadTable(view) {
  const table = findTable(view, "head");
  if (!table) return null;
  return {
    macStyle: getUint16(view, table.offset + 44),
  };
}

// ---------------------------------------------------------------------------
// Weight class -> CSS weight mapping
// ---------------------------------------------------------------------------

function weightClassToCSS(usWeightClass) {
  const rounded = Math.round(usWeightClass / 100) * 100;
  if (rounded < 100) return 100;
  if (rounded > 900) return 900;
  return rounded;
}

// ---------------------------------------------------------------------------
// Heuristic fallbacks from name strings
// ---------------------------------------------------------------------------

function guessWeightFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("thin") || lower.includes("hairline")) return 100;
  if (
    lower.includes("extralight") ||
    lower.includes("extra light") ||
    lower.includes("ultra light") ||
    lower.includes("ultralight")
  )
    return 200;
  if (lower.includes("light")) return 300;
  if (lower.includes("medium")) return 500;
  if (
    lower.includes("semibold") ||
    lower.includes("semi bold") ||
    lower.includes("demibold") ||
    lower.includes("demi bold")
  )
    return 600;
  if (
    lower.includes("extrabold") ||
    lower.includes("extra bold") ||
    lower.includes("ultra bold") ||
    lower.includes("ultrabold")
  )
    return 800;
  if (lower.includes("black") || lower.includes("heavy")) return 900;
  if (lower.includes("bold")) return 700;

  // Check for bare numeric weight in the string (e.g. "Ink-300", "Font 700")
  const numMatch = name.match(/(?:^|[-_ ])([1-9]00)(?:[-_ ]|$)/)
    || name.match(/([1-9]00)(?:italic)?$/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 100 && num <= 900) return num;
  }

  return 400;
}

function guessStyleFromName(name) {
  const lower = name.toLowerCase();
  return lower.includes("italic") || lower.includes("oblique")
    ? "italic"
    : "normal";
}

// ---------------------------------------------------------------------------
// Public API: Parse a single font file
// ---------------------------------------------------------------------------

/**
 * Parse a single font file and extract metadata from its internal
 * `name`, `OS/2` and `head` tables using a zero-dependency binary reader.
 * Falls back to filename-based heuristics when tables are missing or
 * the file cannot be parsed (e.g. WOFF2 with compressed tables).
 * @param {File} file - The font file to parse
 * @returns {Promise<object>} Parsed font metadata
 */
export async function parseFontFile(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  let familyName = "";
  let subfamilyName = "Regular";
  let weight = 400;
  let style = "normal";

  try {
    // Verify this looks like an sfnt font (TrueType or OpenType)
    const sig = getUint32(view, 0);
    const isSfnt =
      sig === 0x00010000 || // TrueType
      sig === 0x4f54544f || // 'OTTO' (CFF OpenType)
      sig === 0x74727565; // 'true' (some TrueType)

    if (isSfnt) {
      // --- Name table ---
      const names = parseNameTable(view);

      // Prefer nameID 16 (Typographic Family) over nameID 1
      familyName = names.get(16) || names.get(1) || "";
      // Prefer nameID 17 (Typographic Subfamily) over nameID 2
      subfamilyName = names.get(17) || names.get(2) || "Regular";

      // --- OS/2 table ---
      const os2 = parseOS2Table(view);
      if (os2) {
        weight = weightClassToCSS(os2.usWeightClass);
        // fsSelection bit 0 = italic
        if ((os2.fsSelection & 1) !== 0) {
          style = "italic";
        }
      } else {
        weight = guessWeightFromName(subfamilyName);
        style = guessStyleFromName(subfamilyName);
      }

      // Fallback italic check via head.macStyle bit 1
      if (style === "normal") {
        const head = parseHeadTable(view);
        if (head && (head.macStyle & 2) !== 0) {
          style = "italic";
        }
      }
    }
  } catch (err) {
    // Parsing failed -- fall through to filename heuristics
  }

  // If binary parsing didn't produce a family name, use filename heuristics
  if (!familyName) {
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    // Try to split on common separators: "Roboto-BoldItalic" -> "Roboto"
    const parts = baseName.split(/[-_]/);
    familyName = parts[0] || baseName;
    const rest = parts.slice(1).join(" ") || "Regular";
    subfamilyName = rest;
    weight = guessWeightFromName(rest);
    style = guessStyleFromName(rest);
  } else if (weight === 400 && /^regular$/i.test(subfamilyName.trim())) {
    // Binary parsing found a family name but weight is generic 400/Regular.
    // Try the filename as a secondary heuristic (common with WOFF2 files
    // where OS/2 tables are compressed and unreadable).
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const filenameWeight = guessWeightFromName(baseName);
    if (filenameWeight !== 400) {
      weight = filenameWeight;
      subfamilyName = baseName.split(/[-_]/).slice(1).join(" ") || subfamilyName;
    }
    const filenameStyle = guessStyleFromName(baseName);
    if (filenameStyle !== "normal") {
      style = filenameStyle;
    }
  }

  const previewUrl = URL.createObjectURL(file);

  return {
    familyName: familyName.trim(),
    subfamilyName: subfamilyName.trim(),
    weight,
    style,
    file,
    previewUrl,
  };
}

/**
 * Parse multiple font files and return a deduplicated array sorted by weight then style.
 * Duplicate styles (same weight + same style) are filtered out, keeping the first occurrence.
 * @param {File[]} files - Array of font files
 * @returns {Promise<object[]>} Array of parsed font metadata
 */
export async function parseFontFiles(files) {
  const parsed = await Promise.all(files.map(parseFontFile));
  const deduplicated = deduplicateFontStyles(parsed);
  deduplicated.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
  return deduplicated;
}

/**
 * Filter out duplicate font styles from an array of parsed font metadata.
 * Two entries are considered duplicates if they have the same weight AND style.
 * Keeps the first occurrence of each weight+style combo.
 * @param {Array<{weight: number, style: string}>} fontStyles - Array of font style objects
 * @returns {Array} Deduplicated array
 */
export function deduplicateFontStyles(fontStyles) {
  const seen = new Set();
  return fontStyles.filter((entry) => {
    const key = `${entry.weight}-${entry.style}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Generate a font ID slug from a font family name
 * @param {string} name - Font family name
 * @returns {string} URL-safe font ID
 */
export function generateFontId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a style ID string from weight and style
 * @param {number} weight - Font weight (100-900)
 * @param {string} style - "normal" or "italic"
 * @returns {string} Style ID (e.g., "400", "400italic")
 */
export function makeStyleId(weight, style) {
  return style === "italic" ? `${weight}italic` : `${weight}`;
}

/**
 * Create a human-readable label for a font style
 * @param {number} weight - Font weight (100-900)
 * @param {string} style - "normal" or "italic"
 * @returns {string} Human-readable label (e.g., "Regular", "Bold Italic")
 */
export function makeStyleLabel(weight, style) {
  const weightLabels = {
    100: "Thin",
    200: "ExtraLight",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
    900: "Black",
  };

  const label = weightLabels[weight] || `Weight ${weight}`;
  return style === "italic" ? `${label} Italic` : label;
}

// Font categories array - used in dropdowns
export const FONT_CATEGORIES = [
  { value: "heading", label: "Heading" },
  { value: "body", label: "Body" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" },
];

// Font scripts array - used in script support checkboxes
export const FONT_SCRIPTS = [
  { value: "latin", label: "Latin" },
  { value: "latin-ext", label: "Latin Extended" },
  { value: "cyrillic", label: "Cyrillic" },
  { value: "cyrillic-ext", label: "Cyrillic Extended" },
  { value: "greek", label: "Greek" },
  { value: "greek-ext", label: "Greek Extended" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "arabic", label: "Arabic" },
  { value: "hebrew", label: "Hebrew" },
  { value: "devanagari", label: "Devanagari" },
  { value: "bengali", label: "Bengali" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "thai", label: "Thai" },
  { value: "chinese-simplified", label: "Chinese Simplified" },
  { value: "chinese-traditional", label: "Chinese Traditional" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
];

// Locale options array
export const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
  { value: "ru", label: "Russian" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
];

// Font weight options
export const FONT_WEIGHT_OPTIONS = [
  { value: 100, label: "Thin (100)" },
  { value: 200, label: "ExtraLight (200)" },
  { value: 300, label: "Light (300)" },
  { value: 400, label: "Regular (400)" },
  { value: 500, label: "Medium (500)" },
  { value: 600, label: "SemiBold (600)" },
  { value: 700, label: "Bold (700)" },
  { value: 800, label: "ExtraBold (800)" },
  { value: 900, label: "Black (900)" },
];

// Accepted font file extensions
export const ACCEPTED_FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2"];
export const ACCEPTED_FONT_MIME =
  ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/x-font-ttf,application/x-font-opentype";
