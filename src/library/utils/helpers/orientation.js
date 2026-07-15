/**
 * Orientation helpers — a single source of truth for "is this size Landscape,
 * Portrait or Square?".
 *
 * Spread products (photobook, layflat, and any foldable editor) store the FULL
 * SPREAD width — two pages side by side — so a 1200×600 "size" is really two
 * 600×600 pages. Orientation must therefore be judged per SINGLE page (width / 2),
 * exactly the rule the setCanvasSize reducer uses when it stores state.orientation
 * (canvas.js). Displaying orientation from the raw spread width wrongly labels a
 * 1200×600 photobook "Landscape" when each page is actually Square.
 *
 * Always compute display orientation through here so every size dropdown, tile,
 * table and preview agrees with the stored orientation.
 */

import { EDITOR_TYPES } from "../constants/index.js";

// A spread product renders two half-width pages, so its stored width is twice a
// single page. Mirrors the setCanvasSize reducer's condition.
const isHalfWidthSpread = (editorType, settings) =>
  editorType === EDITOR_TYPES.PHOTOBOOK ||
  editorType === EDITOR_TYPES.LAYFLATALBUM ||
  settings?.isFoldable === true;

// Per-page width for orientation/display: full width for normal products, half
// the stored spread width for spread products. Exported so visual size previews
// (thumbnail rectangles) can draw the SINGLE page, matching the orientation label.
export const perPageWidth = (width, editorType, settings) =>
  isHalfWidthSpread(editorType, settings) ? Number(width) / 2 : Number(width);

// Full orientation word ("Landscape" | "Portrait" | "Square"), judged per single
// page for spread products.
export const getSizeOrientation = (width, height, editorType, settings) => {
  const w = perPageWidth(width, editorType, settings);
  const h = Number(height);
  if (w > h) return "Landscape";
  if (w < h) return "Portrait";
  return "Square";
};
