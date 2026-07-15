export const DEFAULT_DPI = 200;

// ----- Standard unit ↔ inch factors -----
// 1 [unit] = UNIT_TO_INCH[unit] inches
const UNIT_TO_INCH = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
};

// ----- Print-industry unit list (used across dialogs) -----
export const PRINT_UNITS = [
  { value: 'in', label: 'Inches (in)', short: 'in' },
  { value: 'px', label: 'Pixels (px)', short: 'px' },
  { value: 'cm', label: 'Centimeters (cm)', short: 'cm' },
  { value: 'mm', label: 'Millimeters (mm)', short: 'mm' },
];

// ----- Core helpers (unchanged) -----
export function pxToCm(pixels, dpi = DEFAULT_DPI) {
  if (!pixels || isNaN(pixels)) return 0;
  return (pixels / dpi) * 2.54;
}

export function cmToPx(cm, dpi = DEFAULT_DPI) {
  if (!cm || isNaN(cm)) return 0;
  return (cm / 2.54) * dpi;
}

export function pxToMm(pixels, dpi = DEFAULT_DPI) {
  if (!pixels || isNaN(pixels)) return 0;
  return (pixels / dpi) * 25.4;
}

export function mmToPx(mm, dpi = DEFAULT_DPI) {
  if (!mm || isNaN(mm)) return 0;
  return (mm / 25.4) * dpi;
}

export function pxToInches(pixels, dpi = DEFAULT_DPI) {
  if (!pixels || isNaN(pixels)) return 0;
  return pixels / dpi;
}

export function inchesToPx(inches, dpi = DEFAULT_DPI) {
  if (!inches || isNaN(inches)) return 0;
  return inches * dpi;
}

// ----- Generic converters (extended with ft / m) -----
export function convertPxToUnit(pixels, unit, dpi = DEFAULT_DPI) {
  if (!pixels || isNaN(pixels)) return 0;
  if (unit === 'px') return pixels;
  const inchFactor = UNIT_TO_INCH[unit];
  if (!inchFactor) return pxToCm(pixels, dpi);
  return formatDecimal(pixels / (inchFactor * dpi), 4);
}

export function convertUnitToPx(value, unit, dpi = DEFAULT_DPI) {
  if (!value || isNaN(value)) return 0;
  if (unit === 'px') return Number(value);
  const inchFactor = UNIT_TO_INCH[unit];
  if (!inchFactor) return cmToPx(value, dpi);
  return Number(value) * inchFactor * dpi;
}

// ----- Semantic aliases used by dialogs -----
/**
 * Convert a physical measurement (in any PRINT_UNITS unit) to pixels.
 * Returns a rounded integer – safe to store as canvas dimension.
 */
export function convertToPixels(value, unit, dpi = DEFAULT_DPI) {
  if (value === '' || value === null || value === undefined || isNaN(value)) return 0;
  if (unit === 'px') return Math.round(Number(value));
  const inchFactor = UNIT_TO_INCH[unit];
  if (!inchFactor) return 0;
  return Math.round(Number(value) * inchFactor * dpi);
}

/**
 * Convert a pixel value back to the given physical unit.
 * Returns a decimal string suitable for input display.
 */
export function convertPixelsToUnit(pixels, unit, dpi = DEFAULT_DPI) {
  if (!pixels || isNaN(pixels)) return 0;
  if (unit === 'px') return pixels;
  const inchFactor = UNIT_TO_INCH[unit];
  if (!inchFactor) return pixels;
  return formatDecimal(pixels / (inchFactor * dpi), 3);
}

export function formatDecimal(value, decimals = 2) {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Build a human-readable size label in inches from pixel dimensions, e.g.
 * "12 × 6 in". Values round to at most 2 decimals (formatDecimal drops trailing
 * zeros). Used by the size-picker modals so sizes read in inches, not raw pixels.
 */
export function formatInchesLabel(widthPx, heightPx, dpi = DEFAULT_DPI) {
  const w = formatDecimal(pxToInches(widthPx, dpi), 2);
  const h = formatDecimal(pxToInches(heightPx, dpi), 2);
  return `${w} × ${h} in`;
}

export const UNIT_OPTIONS = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'in' },
  { value: 'px', label: 'px' },
];

// ----- Global unit preference (shared across all dialogs) -----
// Persisted in localStorage so the user picks a unit (px/in/cm/mm) once and
// every dialog with a unit selector defaults to it.
const UNIT_PREF_KEY = 'editorUnitPreference';
const VALID_UNITS = ['px', 'in', 'cm', 'mm'];

export function getPreferredUnit(fallback = 'px') {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(UNIT_PREF_KEY);
      if (stored && VALID_UNITS.includes(stored)) return stored;
    }
  } catch (e) { /* localStorage unavailable */ }
  return fallback;
}

export function setPreferredUnit(unit) {
  try {
    if (typeof window !== 'undefined' && VALID_UNITS.includes(unit)) {
      window.localStorage.setItem(UNIT_PREF_KEY, unit);
    }
  } catch (e) { /* localStorage unavailable */ }
}
