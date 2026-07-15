// ── Blank-theme random-layout generator ──────────────────────────────────────
// Shared core for "create a blank photobook/layflat design where every page is
// filled with a RANDOM layout" — used by both the in-editor Themes-tab dialog
// (BlankThemeDialog) and the design-selection "Blank" card (CreateNewDesignModal).
//
// It does NOT hand-roll object scaling. It reuses the exact proven path the Layout
// sidebar's Shuffle uses: pre-scale each catalog layout to the target canvas with
// `scaleLayout` (identical to LayoutsAction.scaleLayouts), then per page dispatch
// `setEntireSpreadLayout` (2-up spread pages) / `setPageLayout` (single pages).
// Those reducers own the scaling/bleed math and read `canvasSize` from the store —
// so the CALLER must dispatch setEditorType + setCanvasSize (+ clean settings)
// BEFORE calling this. Image boxes stay EMPTY (blank = user fills later).

import { v4 as uuidv4 } from "uuid";
import { store } from "../../../store/store.jsx";
import { EDITOR_TYPES, EDITOR_ASSETS } from "../constants/index.js";
import { ENDPOINTS } from "../constants/apiurl.js";
import { apiPost } from "../common-services/apiCall.js";
import { readAssetCache, writeAssetCache } from "./assetsCache.js";
import { decompressFromBase64, scaleLayout } from "../common-functions/index.js";
import {
  applyTheme,
  setPageNumber,
  setActiveSide,
  setPageLayout,
  setEntireSpreadLayout,
  setCurrentObjectProperties,
} from "../../../store/slices/canvas.js";

export const BLANK_THEME_MAX_PAGES = 200;
export const BLANK_THEME_MIN_PAGES = 2;
export const BLANK_THEME_MAX_IMAGES = 15;

// A fresh blank page — the apply reducers create the layout sides from the empty
// `layout: []`, so we don't need to pre-shape them.
const makeBlankPage = (index) => ({
  id: `pages_${uuidv4()}`,
  title: index === 0 ? "Front Cover" : "page" + (index + 1),
  bgColor: "#fff",
  layout: [],
  settings: { isHalfSheet: false },
  isPageEdited: false,
});

const groupByCount = (layouts) => {
  const byCount = {};
  layouts.forEach((l) => {
    const c = l.number_of_images;
    (byCount[c] || (byCount[c] = [])).push(l);
  });
  return byCount;
};

// Pick a random layout with `target` images; if none exist, fall out to the
// nearest available count (mirrors LayoutsAction's shuffle fallback). Prefers a
// layout NOT already used (tracked in `usedIds`) so pages don't repeat the same
// layout — only falls back to a repeat when every candidate is already used.
// Returns a DEEP-CLONED layout array (the apply reducers mutate their payload).
const pickLayout = (byCount, target, usedIds) => {
  let pool = byCount[target];
  if (!pool || pool.length === 0) {
    for (let step = 1; step <= 25; step++) {
      const up = byCount[target + step];
      const down = target - step >= 1 ? byCount[target - step] : null;
      if (up && up.length) { pool = up; break; }
      if (down && down.length) { pool = down; break; }
    }
  }
  if (!pool || pool.length === 0) return null;
  const fresh = pool.filter((l) => l._id == null || !usedIds.has(l._id));
  const choosePool = fresh.length > 0 ? fresh : pool;
  const picked = choosePool[Math.floor(Math.random() * choosePool.length)];
  if (picked._id != null) usedIds.add(picked._id);
  return JSON.parse(JSON.stringify(picked.layout_c.layout));
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Which page indices render as a 2-up spread (need a spread layout) vs a single
// page. Mirrors LayoutsAction's spread-eligibility predicate exactly.
const isSpreadIndex = (editorType, settings, i, total) => {
  if (editorType === EDITOR_TYPES.PHOTOBOOK) {
    if (settings?.showFullCoverSheet && i === 0) return true;
    return i !== 0 && i !== total - 1 && i !== 1 && i !== total - 2;
  }
  if (settings?.isFoldable === true) return true; // full-sheet foldable pages
  return false; // layflat (non-foldable) → single full-width page layouts
};

// In-memory RAW layout catalog for this session, keyed by number_of_layouts
// (1 = page, 2 = spread). Holds the undecompressed catalog items so we scale them
// per target size on demand.
const rawLayoutPools = {};
const durableKey = (numberOfLayouts) => `blankgen_pool_${numberOfLayouts}`;

// Cache-FIRST layout catalog fetch: reuse the in-memory pool, then the durable
// local cache (AppData / localStorage), and only hit the layouts API when there
// is nothing stored locally. Once fetched, the catalog is persisted so future
// generates (this session or later) don't call the API again.
const getRawLayouts = async (numberOfLayouts) => {
  if (Array.isArray(rawLayoutPools[numberOfLayouts])) {
    return rawLayoutPools[numberOfLayouts];
  }
  // Durable local store (survives app restarts).
  const cached = await readAssetCache("layouts", durableKey(numberOfLayouts));
  if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
    rawLayoutPools[numberOfLayouts] = cached.items;
    return cached.items;
  }
  // Nothing stored locally → fetch the full catalog once and persist it.
  const data = {
    filter: {
      status: { $in: [1, 3] },
      display_in_web: true,
      number_of_layouts: numberOfLayouts,
      spread: numberOfLayouts === 2,
      number_of_images: { $gte: 1 },
      asset_type: EDITOR_ASSETS.LAYOUT,
    },
    skip: 0,
    limit: 10000000,
    sortField: "_id",
    sortOrder: "desc",
  };
  const response = await apiPost(ENDPOINTS.getLayouts, data);
  const items = Array.isArray(response?.items) ? response.items : [];
  rawLayoutPools[numberOfLayouts] = items;
  if (items.length > 0) {
    writeAssetCache("layouts", durableKey(numberOfLayouts), {
      items,
      totalCount: items.length,
    });
  }
  return items;
};

// Scale the (locally cached) raw catalog for a given layout count to the target
// canvas, grouped by image count.
const fetchLayoutPool = async (numberOfLayouts, fullWidth, height, splitby) => {
  const items = await getRawLayouts(numberOfLayouts);
  const scaled = items
    .map((item) => {
      const decompressed = decompressFromBase64(item.layout_c);
      if (!decompressed || !Array.isArray(decompressed.layout)) return null;
      decompressed.layout = decompressed.layout.map((l) =>
        scaleLayout(l, fullWidth / splitby, height)
      );
      return {
        _id: item._id,
        number_of_images: item.number_of_images,
        layout_c: decompressed,
      };
    })
    .filter(Boolean);
  return groupByCount(scaled);
};

/**
 * Generate a blank design of `pageCount` pages, each filled with a random layout
 * whose image-count is a random value in [minImages, maxImages]. Reads editorType
 * / canvasSize / settings from the CURRENT canvas store (the caller must have set
 * them). Dispatches the pages onto the canvas and returns the resulting pages
 * array (deep-cloned, serialisable) so a caller can persist it.
 *
 * @returns {Promise<Array>} the generated pages, or null if no layouts available.
 */
export async function generateRandomLayoutPages(dispatch, { pageCount, minImages, maxImages }) {
  const present = store.getState().canvas.present;
  const editorType = present.editorType;
  const canvasSize = present.canvasSize || {};
  const settings = present.settings || {};

  const total = Math.max(
    1,
    Math.min(BLANK_THEME_MAX_PAGES, Math.round(Number(pageCount) || 1))
  );
  const mn = Math.max(1, Math.round(Number(minImages) || 1));
  const mx = Math.max(mn, Math.round(Number(maxImages) || mn));

  const usesHalfWidthLayout =
    editorType === EDITOR_TYPES.PHOTOBOOK || settings?.isFoldable === true;
  const splitby = usesHalfWidthLayout ? 2 : 1;
  const fullWidth = Number(canvasSize.width);
  const height = Number(canvasSize.height);
  if (!fullWidth || !height) return null;

  const spreadFlags = Array.from({ length: total }, (_, i) =>
    isSpreadIndex(editorType, settings, i, total)
  );
  const needSpread = spreadFlags.some(Boolean);
  const needSingle = spreadFlags.some((s) => !s);

  const [spreadByCount, pageByCount] = await Promise.all([
    needSpread ? fetchLayoutPool(2, fullWidth, height, splitby) : Promise.resolve({}),
    needSingle ? fetchLayoutPool(1, fullWidth, height, splitby) : Promise.resolve({}),
  ]);

  const spreadEmpty = needSpread && Object.keys(spreadByCount).length === 0;
  const pageEmpty = needSingle && Object.keys(pageByCount).length === 0;
  if (spreadEmpty && pageEmpty) return null;

  // Build N blank pages with the correct product structure.
  const blankPages = Array.from({ length: total }, (_, i) => makeBlankPage(i));
  if (editorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled) {
    blankPages[0].isCoverPage = true;
    if (!settings?.showFullCoverSheet && total > 1) {
      blankPages[total - 1].isCoverPage = true;
    }
  }

  dispatch(setCurrentObjectProperties(null));
  dispatch(applyTheme(blankPages));

  // Track layouts already used so no two pages get the SAME layout (with ~2000
  // layouts in the catalog there's plenty of variety). Shared across spread and
  // page pools since layout _ids are globally unique.
  const usedIds = new Set();
  for (let i = 0; i < total; i++) {
    const target = randInt(mn, mx);
    dispatch(setPageNumber(i));
    if (spreadFlags[i]) {
      const layout = pickLayout(spreadByCount, target, usedIds);
      if (layout) dispatch(setEntireSpreadLayout(layout));
    } else {
      dispatch(setActiveSide(0));
      const layout = pickLayout(pageByCount, target, usedIds);
      if (layout && layout[0]) dispatch(setPageLayout(layout[0]));
    }
  }

  dispatch(setPageNumber(0));

  // Read back the fully-built pages (deep-clone so callers can serialise/persist
  // without touching frozen store state).
  return JSON.parse(JSON.stringify(store.getState().canvas.present.pages));
}

// ── In-editor "Auto Layout" (regenerate the CURRENTLY OPEN design) ────────────
// Distinct from generateRandomLayoutPages above (which builds a fresh blank book).
// This re-rolls the layouts of the design the user already has open — keeping
// their photos (reflowed into new arrangements) or clearing to empty boxes —
// WITHOUT touching cover pages. Powers the Layout-tab "Generate Layout" dialog and
// "Shuffle All" button. Same page-vs-spread + no-repeat + nearest-count machinery.

/** Photobook / layflat are the only spread-based products this feature targets. */
export const isBlankGeneratorSupported = (editorType) =>
  editorType === EDITOR_TYPES.PHOTOBOOK ||
  editorType === EDITOR_TYPES.LAYFLATALBUM;

// A cover / structural page we must NEVER regenerate. Layflat marks covers with
// `isCoverPage`; photobook covers are the first + last pages (front/back cover).
const isCoverIndex = (editorType, page, i, total) => {
  if (page?.isCoverPage === true) return true;
  if (editorType === EDITOR_TYPES.PHOTOBOOK) return i === 0 || i === total - 1;
  return false;
};

// Whether a given OPEN page renders as a 2-up spread (needs a spread layout) vs a
// single page. Mirrors LayoutsAction's live spread-eligibility (incl. per-page
// `isHalfSheet` for foldable) so the pool we pick from matches what the page shows.
const pageUsesSpread = (editorType, settings, page, i, total) => {
  if (editorType === EDITOR_TYPES.PHOTOBOOK) {
    if (settings?.showFullCoverSheet && i === 0) return true;
    return i !== 0 && i !== total - 1 && i !== 1 && i !== total - 2;
  }
  if (settings?.isFoldable === true) return page?.settings?.isHalfSheet !== true;
  return false; // layflat (non-foldable) → single full-width page
};

// Total image objects across every layout side of a page (a spread counts both
// sides, matching how spread layouts group by number_of_images).
const countPageImages = (page) => {
  if (!page || !Array.isArray(page.layout)) return 0;
  return page.layout.reduce(
    (sum, side) =>
      sum + (Array.isArray(side?.objects) ? side.objects.filter((o) => o.type === "img").length : 0),
    0
  );
};

/** Interior (non-cover) page count of the open design — for dialog copy. */
export function getOpenDesignInteriorInfo() {
  const present = store.getState().canvas.present;
  const editorType = present.editorType;
  const pages = present.pages || [];
  const total = pages.length;
  let interior = 0;
  let withPhotos = 0;
  for (let i = 0; i < total; i++) {
    if (isCoverIndex(editorType, pages[i], i, total)) continue;
    interior += 1;
    if (countPageImages(pages[i]) > 0) withPhotos += 1;
  }
  return { total, interior, withPhotos };
}

/**
 * Re-roll the layouts of the currently OPEN photobook/layflat design.
 *
 * @param {"keep"|"empty"} opts.mode
 *   - "keep": reflow each interior page's existing photos into a new random layout
 *     (pages with 0 photos are skipped — nothing to reflow).
 *   - "empty": clear interior pages to fresh empty boxes with a random layout.
 * @param {number} opts.minImages / opts.maxImages — photos per PHYSICAL page.
 *   Ignored per-page when `preserveImageCount` keeps the current count.
 * @param {boolean} opts.preserveImageCount — keep mode only: re-roll each page to
 *   its CURRENT photo count 1:1 (used by "Shuffle All"; never drops a photo).
 * @returns {Promise<Array|null>} the resulting pages (deep-cloned), or null if no
 *   layouts / nothing to regenerate.
 */
export async function regenerateOpenDesignLayouts(
  dispatch,
  { mode = "keep", minImages = 1, maxImages = 4, preserveImageCount = false } = {}
) {
  const present = store.getState().canvas.present;
  const editorType = present.editorType;
  const canvasSize = present.canvasSize || {};
  const settings = present.settings || {};
  const pages = present.pages || [];
  const total = pages.length;
  if (total === 0) return null;

  // Land the user back on the page they started on (a re-roll that jumps to the
  // cover is jarring).
  const startPageIndex = Math.min(
    Math.max(Number(present.activePageIndex) || 0, 0),
    total - 1
  );

  const mn = Math.max(1, Math.round(Number(minImages) || 1));
  const mx = Math.max(mn, Math.round(Number(maxImages) || mn));

  const usesHalfWidthLayout =
    editorType === EDITOR_TYPES.PHOTOBOOK || settings?.isFoldable === true;
  const splitby = usesHalfWidthLayout ? 2 : 1;
  const fullWidth = Number(canvasSize.width);
  const height = Number(canvasSize.height);
  if (!fullWidth || !height) return null;

  // Classify every interior page once (index + spread/single).
  const interior = [];
  for (let i = 0; i < total; i++) {
    if (isCoverIndex(editorType, pages[i], i, total)) continue;
    interior.push({
      index: i,
      spread: pageUsesSpread(editorType, settings, pages[i], i, total),
    });
  }
  if (interior.length === 0) return null;

  const needSpread = interior.some((p) => p.spread);
  const needSingle = interior.some((p) => !p.spread);

  const [spreadByCount, pageByCount] = await Promise.all([
    needSpread ? fetchLayoutPool(2, fullWidth, height, splitby) : Promise.resolve({}),
    needSingle ? fetchLayoutPool(1, fullWidth, height, splitby) : Promise.resolve({}),
  ]);

  // Bail only if NONE of the pools we actually need has any layouts (offline with
  // an empty cache, or a product with no catalog). A partial pool still proceeds —
  // pickLayout just returns null for the missing kind and that page is left as-is.
  const haveSpread = Object.keys(spreadByCount).length > 0;
  const havePage = Object.keys(pageByCount).length > 0;
  if (!((needSpread && haveSpread) || (needSingle && havePage))) return null;

  dispatch(setCurrentObjectProperties(null));

  // "empty" mode: blank the interior pages FIRST (keep covers exactly) so the
  // subsequent per-page apply produces empty boxes with nothing to reflow. Covers
  // and page structure/settings are preserved; only the interior layout is cleared.
  if (mode === "empty") {
    const blanked = pages.map((p, i) =>
      isCoverIndex(editorType, p, i, total) ? p : { ...p, layout: [] }
    );
    dispatch(applyTheme(JSON.parse(JSON.stringify(blanked))));
  }

  // Fill/re-roll each interior page. Read the page FRESH from the store each
  // iteration — selectors captured in a component don't refresh inside a sync
  // loop, so we must read state.pages[index] directly to count the right page.
  const usedIds = new Set();
  for (const { index, spread } of interior) {
    const freshPage = store.getState().canvas.present.pages[index];
    const perPageFactor = spread ? 2 : 1;

    let target;
    if (mode === "keep") {
      const currentCount = countPageImages(freshPage);
      if (currentCount <= 0) continue; // nothing to reflow → leave the page as-is
      target = preserveImageCount
        ? currentCount
        : randInt(mn * perPageFactor, mx * perPageFactor);
    } else {
      target = randInt(mn * perPageFactor, mx * perPageFactor);
    }

    dispatch(setPageNumber(index));
    if (spread) {
      const layout = pickLayout(spreadByCount, target, usedIds);
      if (layout) dispatch(setEntireSpreadLayout(layout));
    } else {
      dispatch(setActiveSide(0));
      const layout = pickLayout(pageByCount, target, usedIds);
      if (layout && layout[0]) dispatch(setPageLayout(layout[0]));
    }
  }

  // Restore the user's original page + a clean selection.
  dispatch(setPageNumber(startPageIndex));
  dispatch(setActiveSide(0));
  dispatch(setCurrentObjectProperties(null));

  return JSON.parse(JSON.stringify(store.getState().canvas.present.pages));
}

/**
 * Like `regenerateOpenDesignLayouts`, but the WHOLE re-roll lands as a SINGLE undo
 * step so Ctrl+Z / the Header undo button revert it wholesale (instead of unwinding
 * it page-by-page, or clearing history entirely). Prior undo history is preserved.
 *
 * How: snapshot the redux-undo canvas stack BEFORE generating (it's an immutable
 * object — the in-between dispatches build new state objects, never mutating it),
 * run the generation (which pollutes the live stack with per-page steps), then
 * `restoreHistory` a rebuilt stack = [...priorPast, preGenPresent] with the
 * generated present on top. One Ctrl+Z pops back to the pre-generation design.
 *
 * @returns {Promise<Array|null>} generated pages, or null (then history is left
 *   untouched — nothing was applied).
 */
export async function regenerateOpenDesignLayoutsAsSingleUndo(dispatch, opts) {
  const before = store.getState().canvas;
  const priorPast = Array.isArray(before?.past) ? before.past : [];
  const preGenPresent = before?.present;
  const limit = typeof before?.limit === "number" ? before.limit : 300;

  const pages = await regenerateOpenDesignLayouts(dispatch, opts);
  if (!pages) return null;

  const generatedPresent = store.getState().canvas.present;

  let past = [...priorPast, preGenPresent];
  if (past.length > limit) past = past.slice(past.length - limit);

  dispatch({
    type: "canvas/restoreHistory",
    payload: {
      past,
      present: generatedPresent,
      future: [], // a fresh action always invalidates the redo branch
      _latestUnfiltered: generatedPresent,
      index: past.length,
      limit,
    },
  });

  return pages;
}
