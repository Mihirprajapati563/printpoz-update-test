import { createSlice, original } from "@reduxjs/toolkit";
import { act } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  defaultPhotoObject,
  defaultTextObject,
  defaultStickerObject,
  defaultShapeObject,
  defaultCalendarObject,
  defaultQRCodeObject,
} from "../../library/utils/jsons/defaultObjects.js";
import {
  EDITOR_SUB_TYPES,
  EDITOR_TYPES,
  ERROR_MESSAGES,
  USER_TYPES,
  EDITOR_VERSION,
} from "../../library/utils/constants/index.js";
import { getDynamicStartYear } from "../../library/utils/common-functions/index.js";

const initialState = {
  activeObject: null,
  // Multi-select: parallel array of { id, areaType } for every selected object.
  // When length === 1 → activeObject/activeObjectprops are also set (full backward-compat).
  // When length  > 1 → activeObject is null so single-item toolbars auto-hide.
  activeObjects: [],
  editorType: EDITOR_TYPES.CALENDER,
  orientation: "S",
  activeSide: 0,
  minPages: 5,
  maxPages: 50,
  canvasSize: {
    width: 2400,
    height: 1200,
    depth: 0, // used in canvas size for thickness of canvas
    safeMargin: 0, // used in canvas as the trim margihn
    bleedMargin: 0, // used in canvas as the bleed margin
    dpi: 0, // dots per inch – used for unit conversion (px ↔ cm/mm/in)
  },
  menuItems: [],

  calendarSettings: {
    startMonth: 1,
    startYear: getDynamicStartYear(),
    addCover: false,
    noOfMonthsPerPage: 1,
    weeksColumns: 1,
  },
  settings: {
    subtype: EDITOR_SUB_TYPES.CALENDER.WALL_CALENDER,
    selectedMenuItems: [
      "Photos",
      "Layout",
      "Background",
      "Calendar",
      "Stickers",
      "QR Code",
      "Text",
      "Masks",
      "Themes",
      "Errors",
      "Ideas",
    ],
    isFoldable: false,
    allowSticker: true,
    allowImage: true,
    allowText: true,
    allowBackgroundRemover: false,
    exportFullPage: true,
    exportSafeArea: false,
    coverEnabled: false,
    hideLastCover: false,
    exportSpine: false,
    maxImageUploadLimit: 0,
    applyMaximumImageUploadLimit: false,
    allowImageDelete: true,
  },
  customFonts: [], // Custom fonts loaded from backend
  zoomRatio: 1,
  canvasScale: 1,
  pages: [
    {
      id: `pages_${uuidv4()}`,
      pageNumber: 1,
      title: "Front Cover",
      bgColor: "#fff",
      layout: [],
      settings: {
        onlyAllowObjectInSafeArea: false,
        isHalfSheet: false,
      },
      isPageEdited: false,
    },
  ],
  copyObjectId: null,
  copyObjectAreaType: null,
  // Multi-object clipboard: array of deep-cloned object snapshots.
  // Populated by copyObject when activeObjects.length >= 1.
  copiedObjects: [],
  activePageIndex: 0,
  activeObjectprops: null,
  isDragger: false,
  canvasErrors: [],
  activeSafeArea: null,
  showSafeAreaGuidePopup: false,
  shapeGradientHistory: [],
  shapeSolidColorHistory: [],
  textGradientHistory: [],
  textSolidColorHistory: [],
  backgroundSolidColorHistory: [],
  borderSolidColorHistory: [],
  shadowSolidColorHistory: [],
  globalGradientHistory: [],
  globalSolidColorHistory: [],
  // Linked text groups: { [groupKey]: { label, value } }
  // e.g. { coupleName: { label: "Couple Name", value: "Vivien & Hiral" } }
  textGroups: {},
  backgroundImageHistory: [],
  stickerHistory: [],
  maskHistory: [],
  photoHistory: [],
  shapeHistory: [],
  themeBaselineVersion: null,
};

// Helper function to mark a page as edited
const markPageEdited = (state, pageIndex) => {
  if (state.pages[pageIndex]) {
    state.pages[pageIndex].isPageEdited = true;
  }
};

// ── Optimistic image placement swap (see optimistic_image_placement_plan.md) ──
// An image placed while still uploading renders a local thumbnail blob and
// carries `pendingImageId` (the upload pipeline's imageId). When the upload
// completes, every such object is silently swapped to its server source.
//
// These helpers are PURE and never mutate their input: they are used both by
// the reducer (on `present`) and by the redux-undo wrapper in store.jsx to
// patch `past`/`future` snapshots — immer-produced states are frozen in dev,
// and snapshots share structure, so we rebuild only the changed paths.

export function patchPendingImageObject(obj, payload) {
  if (
    !obj ||
    obj.type !== "img" ||
    !payload?.pendingImageId ||
    obj.pendingImageId !== payload.pendingImageId
  ) {
    return null;
  }
  const largeEntry = Array.isArray(payload.urls)
    ? payload.urls.find((u) => u.size === "large")
    : null;
  const patched = {
    ...obj,
    url: payload.url,
    urls: payload.urls || [],
    image_id: payload.serverId || obj.image_id || null,
    image: {
      ...obj.image,
      // Server dimensions are authoritative; placement already used the
      // real natural dims so these are usually identical.
      originalWidth: parseInt(largeEntry?.w) || obj.image?.originalWidth || 0,
      originalHeight: parseInt(largeEntry?.h) || obj.image?.originalHeight || 0,
    },
  };
  delete patched.pendingImageId;
  return patched;
}

// Allocation-free on no-match. The store.jsx undo wrapper calls this once per
// finished upload across ALL ~300 history snapshots, and the overwhelming
// majority of (snapshot, object) pairs do NOT carry the pendingImageId. The old
// version `.map()`d every list of every layout of every page of every snapshot,
// allocating a throwaway array each time — a bulk-completion freeze with big
// batches. This scans first and clones (via slice/spread) ONLY the lists that
// actually contain a match, leaving every unchanged ref intact.
export function patchPendingImageObjects(pages, payload) {
  if (!Array.isArray(pages) || !payload?.pendingImageId) {
    return { pages, changed: false };
  }
  let pagesChanged = false;
  let nextPages = pages;
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (!page || !Array.isArray(page.layout)) continue;
    let layoutChanged = false;
    let nextLayout = page.layout;
    for (let l = 0; l < page.layout.length; l++) {
      const layout = page.layout[l];
      if (!layout) continue;
      let updates = null;
      for (const key of ["objects", "safeAreaObjects"]) {
        const list = layout[key];
        if (!Array.isArray(list)) continue;
        let nextList = null; // created lazily on the first match
        for (let i = 0; i < list.length; i++) {
          const patched = patchPendingImageObject(list[i], payload);
          if (patched) {
            if (!nextList) nextList = list.slice();
            nextList[i] = patched;
          }
        }
        if (nextList) {
          if (!updates) updates = {};
          updates[key] = nextList;
        }
      }
      if (updates) {
        if (!layoutChanged) {
          nextLayout = page.layout.slice();
          layoutChanged = true;
        }
        nextLayout[l] = { ...layout, ...updates };
      }
    }
    if (layoutChanged) {
      if (!pagesChanged) {
        nextPages = pages.slice();
        pagesChanged = true;
      }
      // Placement already marked the page edited, so this is a no-op in
      // practice — kept for safety so the swap is always export-visible.
      nextPages[p] = { ...page, layout: nextLayout, isPageEdited: true };
    }
  }
  return { pages: pagesChanged ? nextPages : pages, changed: pagesChanged };
}

// For photobook full cover page 0: ensure layout[1] exists so spread background
// actions can apply to both sides even if the theme only saved layout[0].
// Decide which side (0 = left, 1 = right) a just-selected object should make
// active. layoutIndex alone is wrong when a template / theme stuffs every
// object into layout[0] yet still renders across both pages of a spread —
// in that case clicking a visually-right object would incorrectly set
// activeSide = 0. Fall back to the object's actual horizontal position on
// spread-eligible pages so the toolbar L/R highlight matches what the user
// clicked.
const resolveActiveSide = (state, layoutIndex, clickedObj) => {
  if (!clickedObj || !clickedObj.transform) return layoutIndex;
  const page = state.pages?.[state.activePageIndex];
  const pageSettings = page?.settings;
  const isPhotobook = state.editorType === EDITOR_TYPES.PHOTOBOOK;
  const isFoldableFullSheet =
    state.settings?.isFoldable === true && pageSettings?.isHalfSheet !== true;
  const isSpreadishPage = isPhotobook || isFoldableFullSheet;
  if (!isSpreadishPage) return layoutIndex;
  const canvasWidth = Number(state.canvasSize?.width) || 0;
  if (canvasWidth <= 0) return layoutIndex;
  const halfWidth = canvasWidth / 2;
  const objCenterX =
    (clickedObj.transform?.x || 0) + (clickedObj.width || 0) / 2;
  return objCenterX >= halfWidth ? 1 : 0;
};

const ensureFullCoverLayout1 = (state, page) => {
  if (
    state.editorType === EDITOR_TYPES.PHOTOBOOK &&
    state.settings?.showFullCoverSheet &&
    state.activePageIndex === 0 &&
    page &&
    (!page.layout[1])
  ) {
    page.layout[1] = {
      id: `layout_${uuidv4()}`,
      background: { color: null, image: null, flip: false },
      objects: [],
      safeAreaObjects: [],
    };
  }
};

const isMultiHistoryDebugEnabled = () =>
  typeof window !== "undefined" && window.__MULTI_HISTORY_DEBUG__ !== false;

const logCanvasHistoryDebug = (label, payload) => {
  if (!isMultiHistoryDebugEnabled()) return;
};

// Helper: estimate text height based on font size, width, and text content.
// This avoids the need for DOM measurement inside a Redux reducer.
// Uses average character width estimation (similar to Canvas.jsx's measureDiv approach).
// const estimateTextHeight = (text, obj) => {
//   if (!text || !obj) return obj?.height || 60;
//   const fontSize = parseInt(obj.font?.size) || 24;
//   const lineHeight = obj.spacing?.lineHeight ?? 1.2;
//   const containerWidth = obj.width || 300;

//   // Count explicit newlines
//   const lines = text.split("\n");
//   let totalLines = 0;
//   const avgCharWidth = fontSize * 0.55; // Rough average character width
//   const charsPerLine = Math.max(1, Math.floor(containerWidth / avgCharWidth));

//   for (const line of lines) {
//     // Each explicit line wraps based on character count
//     totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
//   }

//   const estimatedHeight = totalLines * fontSize * lineHeight + 10; // +10 padding
//   return Math.max(estimatedHeight, fontSize * lineHeight + 10); // Minimum one line
// };

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: build contentSegments for a word-only (selection) link.
//
// Finds ALL case-insensitive occurrences of `selectedText` inside `fullText` and
// returns an array of alternating static/linked segments.  This is the single
// source of truth for this logic — both linkTextToGroup (at link time) and
// setTextGroups (at reload time) call it, so the behaviour is identical and we
// never need to serialise the segment array to the database.
//
// Returns [] if selectedText is empty or not found.
// ─────────────────────────────────────────────────────────────────────────────
const buildSegmentsFromWord = (
  fullText,
  selectedText,
  groupKey,
  groupValue,
) => {
  if (!fullText || !selectedText) return [];
  const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  const segments = [];
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        type: "static",
        value: fullText.slice(lastIdx, match.index),
      });
    }
    // The linked segment always carries the group's current value so the
    // rendered text reflects whatever the user last typed in the dialog.
    segments.push({
      type: "linked",
      key: groupKey,
      value: groupValue ?? selectedText,
    });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < fullText.length) {
    segments.push({ type: "static", value: fullText.slice(lastIdx) });
  }
  return segments;
};

// Helper: update all text objects matching a groupKey across all pages
// For objects with contentSegments, updates the linked segment value
// For objects with groupKey but no segments (full-text link), replaces the entire text
// Also auto-resizes the object height to fit the new text content
const propagateTextGroupValue = (state, groupKey, newValue, skipObjectId) => {
  const currentExample = state.textGroups?.[groupKey]?.example;
  state.pages.forEach((page, pageIndex) => {
    page.layout.forEach((layout, layoutIndex) => {
      const updateInArray = (arr) => {
        if (!arr || !Array.isArray(arr)) return;
        arr.forEach((obj, objIndex) => {
          if (obj.type !== "text" || obj.groupKey !== groupKey) return;
          if (skipObjectId && obj.id === skipObjectId) return;

          if (obj.contentSegments && Array.isArray(obj.contentSegments)) {
            // Update linked segments and rebuild text
            const updatedSegments = obj.contentSegments.map((seg) =>
              seg.type === "linked" && seg.key === groupKey ?
                { ...seg, value: newValue }
              : seg,
            );
            obj.contentSegments = updatedSegments;
            if (currentExample !== undefined) {
              obj.groupExample = currentExample;
            }
            obj.text = updatedSegments.map((s) => s.value).join("");
          } else {
            // Full-text link: replace entire text
            obj.text = newValue;
            if (currentExample !== undefined) {
              obj.groupExample = currentExample;
            }
          }

          // Auto-resize: estimate new height so the bounding box fits
          // const newHeight = estimateTextHeight(obj.text, obj);
          // if (newHeight > obj.height) {
          //   obj.height = newHeight;
          // }

          markPageEdited(state, pageIndex);
        });
      };
      updateInArray(layout.objects);
      updateInArray(layout.safeAreaObjects);
    });
  });
};

// Recompute spine width when page count changes (full cover photobook/layflat)
// and shift layout[0] right-half objects so they stay anchored to the right page
// as the inner spine line moves. layout[1] objects are handled by render-time offset.
const recomputeSpineAndShiftCoverObjects = (state) => {
  const isPhotobookFullCover =
    state.editorType === EDITOR_TYPES.PHOTOBOOK &&
    state.settings?.showFullCoverSheet === true;
  const isLayflatFullCover =
    state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
    state.settings?.coverEnabled === true &&
    state.settings?.showFullCoverSheet === true;
  if (!isPhotobookFullCover && !isLayflatFullCover) return;
  const paperThickness = Number(state.settings?.paperThickness || 0);
  if (paperThickness <= 0) return;

  const prevSpineWidth = Number(state.settings.spineWidth) || 0;

  let nextSpineWidth = 0;
  if (isPhotobookFullCover) {
    const pageCount = state.pages && state.pages.length > 3
      ? (state.pages.length - 3) * 2
      : 0;
    nextSpineWidth = Math.round(pageCount * paperThickness);
  } else if (isLayflatFullCover) {
    const interiorPageCount = state.pages && state.pages.length > 1
      ? (state.pages.filter((p) => !p.isCoverPage).length) * 2
      : 0;
    nextSpineWidth = Math.round(interiorPageCount * paperThickness);
  }

  state.settings.spineWidth = nextSpineWidth;

  const rightDelta = nextSpineWidth - prevSpineWidth;
  if (rightDelta === 0 || !state.pages.length) return;
  const halfWidth = state.canvasSize.width / 2;
  const layout0 = state.pages[0]?.layout?.[0];
  if (!layout0) return;
  const shiftObjects = (objects) => {
    if (!Array.isArray(objects)) return;
    objects.forEach((obj) => {
      if (!obj?.transform) return;
      const objCenterX = obj.transform.x + (obj.width || 0) / 2;
      if (objCenterX >= halfWidth) {
        obj.transform.x += rightDelta;
      }
    });
  };
  shiftObjects(layout0.objects);
  shiftObjects(layout0.safeAreaObjects);
};

export const canvasSlice = createSlice({
  name: "canvas",
  initialState,
  reducers: {
    setZoom: (state, action) => {
      state.zoomRatio = action.payload;
    },
    setMinPages: (state, action) => {
      state.minPages = action.payload;
    },
    setMaxPages: (state, action) => {
      state.maxPages = action.payload;
    },
    setCanvasScale: (state, action) => {
      state.canvasScale = action.payload;
    },
    setCanvasSize: (state, action) => {
      const prevCanvasSize = { ...state.canvasSize };
      state.canvasSize = action.payload;
      const editorType = state.editorType;

      const incomingSafe =
        action.payload.safeMargin ??
        action.payload.safe_margin ??
        prevCanvasSize.safeMargin;

      const incomingBleed =
        action.payload.bleedMargin ??
        action.payload.bleed_margin ??
        prevCanvasSize.bleedMargin;

      // Coerce to Number so downstream layout math (setPageLayout /
      // setEntireSpreadLayout add `+ bleed` to transform.x/y) never concatenates a
      // string margin into a string coordinate — a string "1712.3" coord makes
      // marquee (drag-select) filters do string arithmetic → NaN → nothing selects
      // until reload. A truthy "0" string would slip past `|| 0`, so coerce first.
      state.canvasSize.safeMargin = Number(incomingSafe) || 0;
      state.canvasSize.bleedMargin = Number(incomingBleed) || 0;

      const incomingDpi = action.payload.dpi ?? prevCanvasSize.dpi;
      state.canvasSize.dpi =
        incomingDpi && !isNaN(incomingDpi) && incomingDpi > 0 ?
          Number(incomingDpi)
        : 200;
      let width = action.payload.width;
      const height = action.payload.height;
      // check there is depth in canvas size then set it
      if (
        action.payload.depth &&
        action.payload.depth !== null &&
        action.payload.depth !== undefined
      ) {
        state.canvasSize.depth = action.payload.depth;
      } else {
        state.canvasSize.depth = 0;
      }
      if (
        editorType === EDITOR_TYPES.PHOTOBOOK ||
        editorType === EDITOR_TYPES.LAYFLATALBUM ||
        state.settings?.isFoldable
      ) {
        width = width / 2;
      }
      if (width > height) {
        state.orientation = "L";
      } else if (width < height) {
        state.orientation = "P";
      } else {
        state.orientation = "S";
      }

      // Preserve circular shape — if payload includes shape, sync to both stores;
      // if payload omits shape, restore from settings so it isn't silently lost.
      if (action.payload.shape) {
        state.settings.shape = action.payload.shape;
        state.canvasSize.shape = action.payload.shape;
      } else if (state.settings?.shape) {
        state.canvasSize.shape = state.settings.shape;
      }
    },
    setDepth: (state, action) => {
      if (
        action.payload.depth &&
        action.payload.depth !== null &&
        action.payload.depth !== undefined
      ) {
        state.canvasSize.depth = action.payload.depth;
      } else {
        state.canvasSize.depth = 0;
      }
    },
    resetEditor: (state, action) => {
      state.pages = [];
      state.activePageIndex = 0;
      state.textGroups = {};

      if (state.editorType === EDITOR_TYPES.CALENDER) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "1",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 24;
      } else if (state.editorType === EDITOR_TYPES.PHOTOBOOK) {
        // loop through 20 pages and add it
        for (let i = 1; i <= 13; i++) {
          state.pages.push({
            id: `pages_${uuidv4()}`,
            pageNumber: i,
            title: i,
            bgColor: "#fff",
            layout: [],
          });
        }
        state.maxPages = 100;
        state.minPages = 5;
      } else if (
        state.editorType === EDITOR_TYPES.ACRYLIC ||
        state.editorType === EDITOR_TYPES.CANVAS
      ) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "1",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 1;
        state.minPages = 1;
      } else if (state.editorType === EDITOR_TYPES.PRINT) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "1",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 200;
        state.minPages = 1;
      } else if (state.editorType === EDITOR_TYPES.VISITING_CARD) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "Front",
          bgColor: "#fff",
          layout: [],
        });
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 2,
          title: "Back",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 2;
        state.minPages = 1;
      } else if (state.editorType === EDITOR_TYPES.CUSTOME_PRODUCT) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "1",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 10;
        state.minPages = 1;
      } else if (state.editorType === EDITOR_TYPES.GREETING_CARD) {
        state.pages.push({
          id: `pages_${uuidv4()}`,
          pageNumber: 1,
          title: "1",
          bgColor: "#fff",
          layout: [],
        });
        state.maxPages = 2;
        state.minPages = 1;
      } else if (state.editorType === EDITOR_TYPES.LAYFLATALBUM) {
        for (let i = 1; i <= 10; i++) {
          let obj = {
            id: `pages_${uuidv4()}`,
            pageNumber: i,
            title: i,
            bgColor: "#fff",
            layout: [],
            settings: {},
          };
          state.pages.push(obj);
        }
        state.maxPages = 100;
        state.minPages = 5;
      }

      // reset all settings
      state.settings = {
        selectedMenuItems: [
          "Photos",
          "Layout",
          "Background",
          "Calendar",
          "Stickers",
          "QR Code",
          "Text",
          "Masks",
          "Themes",
          "Errors",
          "Ideas",
        ],
        isFoldable: false,
        allowSticker: true,
        allowImage: true,
        allowText: true,
        allowBackgroundRemover: false,
        exportFullPage: true,
        exportSafeArea: false,
        hideLastCover: false,
        maxImageUploadLimit: 0,
        applyMaximumImageUploadLimit: false,
        allowImageDelete: true,
      };

      // if layflat album then isFoldable true
      if (state.editorType === EDITOR_TYPES.LAYFLATALBUM) {
        state.settings.isFoldable = true;
      }

      // set default subtype
      if (state.editorType === EDITOR_TYPES.CALENDER) {
        state.settings.subtype = EDITOR_SUB_TYPES.CALENDER.WALL_CALENDER;
      } else if (state.editorType === EDITOR_TYPES.ACRYLIC) {
        state.settings.subtype = EDITOR_SUB_TYPES.ACRYLIC.WALL;
      } else if (state.editorType === EDITOR_TYPES.CUSTOME_PRODUCT) {
        state.settings.subtype = EDITOR_SUB_TYPES.CUSTOME_PRODUCT.T_SHIRT;
      } else if (state.editorType === EDITOR_TYPES.GREETING_CARD) {
        state.settings.subtype = EDITOR_SUB_TYPES.GREETING_CARD.SINGLE_SIDE;
      } else {
        state.settings.subtype = "";
      }
    },
    setEditorType: (state, action) => {
      state.editorType = action.payload;
    },
    // Full replace of state.settings with no merging and no cover/spine side
    // effects. Use on theme switch so the new theme's settings fully supersede
    // the previous theme's (e.g. previous theme had spineWidth/coverEnabled/
    // showFullCoverSheet but the new theme does not — merging would leak those
    // into the new theme and keep spine/cover rendered).
    replaceSettings: (state, action) => {
      state.settings = action.payload || {};
    },
    setSettings: (state, action) => {
      let dataObj = { ...action.payload };
      if (
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        dataObj.isFoldable !== true
      ) {
        dataObj.isFoldable = true;
      }
      // The cover merge/split below is destructive when re-run unnecessarily.
      // SettingAction dispatches `setSettings({ ...settings, [key]: value })` —
      // every toggle (e.g. hideLastCover) includes `coverEnabled: true` in the
      // payload even when cover state is unchanged. LAYFLAT (below) gates merge/
      // split on actual transitions of coverEnabled/showFullCoverSheet. PHOTOBOOK
      // (further below) instead reconciles by DATA SHAPE vs the effective
      // showFullCoverSheet, so size-switching self-heals any merge-state drift.
      const wasLayflatCoverEnabled =
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        state.settings?.coverEnabled === true;
      const wasLayflatFullCover =
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        state.settings?.showFullCoverSheet === true;
      const willBeLayflatCoverEnabled = action?.payload?.coverEnabled === true;
      const willBeLayflatFullCover = action?.payload?.showFullCoverSheet === true;
      const layflatCoverTransition =
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        (wasLayflatCoverEnabled !== willBeLayflatCoverEnabled ||
          wasLayflatFullCover !== willBeLayflatFullCover);
      // settings has diffent key value pairs, in setting one value get updated
      // just update setting with old values and new value
      if (
        action?.payload?.coverEnabled &&
        action?.payload?.coverEnabled === true &&
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        layflatCoverTransition
      ) {
        if (
          action?.payload?.showFullCoverSheet &&
          action?.payload?.showFullCoverSheet === true
        ) {
          // Collect existing half-sheet cover pages before removing them so we
          // can preserve their content in the new full-spread cover page.
          const existingFrontCover = state.pages.find(
            (p) => p.isCoverPage === true && p.settings?.isHalfSheet === true && p.title !== "Back Cover"
          );
          const existingBackCover = state.pages.find(
            (p) => p.isCoverPage === true && p.settings?.isHalfSheet === true && p.title === "Back Cover"
          );
          // Also handle the case where it's already a full-spread cover (no isHalfSheet)
          const existingFullCover = state.pages.find(
            (p) => p.isCoverPage === true && !p.settings?.isHalfSheet
          );

          // Build the merged layout for the new full-spread cover:
          // layout[0] = back cover content (left side of spread)
          // layout[1] = front cover content (right side of spread)
          let mergedLayout0 = null;
          let mergedLayout1 = null;

          const halfWidth = state.canvasSize.width / 2;

          if (existingFullCover) {
            // Already full spread — keep as-is
            mergedLayout0 = existingFullCover.layout?.[0] || null;
            mergedLayout1 = existingFullCover.layout?.[1] || null;
          } else {
            if (existingBackCover?.layout?.[0]) {
              // Back cover objects are at x=0..halfWidth — correct for layout[0] (left side)
              mergedLayout0 = JSON.parse(JSON.stringify(existingBackCover.layout[0]));
            }
            if (existingFrontCover?.layout?.[0]) {
              // Front cover objects are at x=0..halfWidth (half-sheet coords).
              // In layout[1] (right side of spread), they must be at x=halfWidth..canvasWidth.
              // Shift all object x positions by +halfWidth.
              const frontLayoutCopy = JSON.parse(JSON.stringify(existingFrontCover.layout[0]));
              const shiftObjects = (objects) => {
                if (!Array.isArray(objects)) return;
                objects.forEach((obj) => {
                  if (obj?.transform) obj.transform.x += halfWidth;
                });
              };
              shiftObjects(frontLayoutCopy.objects);
              shiftObjects(frontLayoutCopy.safeAreaObjects);
              mergedLayout1 = frontLayoutCopy;
            }
          }

          state.pages = state.pages.filter((page) => page.isCoverPage !== true);
          const newCoverLayout = [];
          if (mergedLayout0) newCoverLayout.push(mergedLayout0);
          else newCoverLayout.push({ id: `layout_${uuidv4()}`, background: { color: null, image: null, flip: false }, objects: [], safeAreaObjects: [] });
          if (mergedLayout1) newCoverLayout.push(mergedLayout1);
          else newCoverLayout.push({ id: `layout_${uuidv4()}`, background: { color: null, image: null, flip: false }, objects: [], safeAreaObjects: [] });

          state.pages.unshift({
            id: `pages_${uuidv4()}`,
            pageNumber: 1,
            title: "Front Cover",
            bgColor: "#fff",
            isCoverPage: true,
            layout: newCoverLayout,
          });
        } else {
          // Converting full-spread → two half-sheet covers: preserve layout content.
          const existingFullCover = state.pages.find(
            (p) => p.isCoverPage === true && !p.settings?.isHalfSheet
          );

          // layout[1] = front cover (right side), layout[0] = back cover (left side)
          const halfWidthReverse = state.canvasSize.width / 2;
          let frontLayout = null;
          let backLayout = null;
          if (existingFullCover?.layout?.[1]) {
            // Front cover objects are at x=halfWidth..canvasWidth — shift back to x=0..halfWidth
            frontLayout = JSON.parse(JSON.stringify(existingFullCover.layout[1]));
            const shiftBack = (objects) => {
              if (!Array.isArray(objects)) return;
              objects.forEach((obj) => {
                if (obj?.transform) obj.transform.x -= halfWidthReverse;
              });
            };
            shiftBack(frontLayout.objects);
            shiftBack(frontLayout.safeAreaObjects);
          }
          if (existingFullCover?.layout?.[0]) {
            // Back cover objects are at x=0..halfWidth — correct as-is for half-sheet
            backLayout = JSON.parse(JSON.stringify(existingFullCover.layout[0]));
          }

          dataObj.showFullCoverSheet = false;
          state.pages = state.pages.filter((page) => page.isCoverPage !== true);
          state.pages.unshift({
            id: `pages_${uuidv4()}`,
            pageNumber: 1,
            title: "Front Cover",
            bgColor: "#fff",
            isCoverPage: true,
            layout: frontLayout ? [frontLayout] : [],
            settings: {
              isHalfSheet: true,
            },
          });
          state.pages.push({
            id: `pages_${uuidv4()}`,
            pageNumber: state.pages.length,
            title: "Back Cover",
            bgColor: "#fff",
            isCoverPage: true,
            layout: backLayout ? [backLayout] : [],
            settings: {
              isHalfSheet: true,
            },
          });
        }
      } else if (
        // Only strip covers when coverEnabled actually transitions from
        // true → false. Settings dispatches that spread `...settings` (e.g.
        // toggling hideLastCover while cover is OFF) carry coverEnabled:false
        // through every dispatch; without the transition check we'd re-filter
        // (and re-emit showFullCoverSheet:false) on every unrelated toggle.
        action?.payload?.coverEnabled === false &&
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        layflatCoverTransition
      ) {
        dataObj.showFullCoverSheet = false;
        dataObj.coverEnabled = false;
        state.pages = state.pages.filter((page) => page.isCoverPage !== true);
      }
      // PHOTOBOOK full-cover toggle: merge front + back cover into a single
      // spread page (mirroring how layflat handles it), so the canvas/footer
      // can render layout[0] (back, left) + spine + layout[1] (front, right).
      // Without this, only the front cover renders — the back cover stays at
      // the last page index and the right half of the spread is blank.
      //
      // Idempotency: gate on the data shape (cover.layout.length), not just
      // the settings transition. A project saved with full cover ON persists
      // the merged shape; if any post-load setSettings dispatches showFullCoverSheet:true
      // while state.settings hasn't caught up yet, a transition-only guard
      // would re-merge already-merged data and double-shift the front cover.
      if (state.editorType === EDITOR_TYPES.PHOTOBOOK) {
        const wasFullCover = state.settings?.showFullCoverSheet === true;
        // Full cover and a visible back cover are mutually exclusive — the
        // full-cover spread already contains the back. Turning "Hide Back
        // Cover" OFF while full cover is on therefore exits full cover too;
        // the split below then restores the separate back cover page.
        const hideLastCoverTurningOff =
          state.settings?.hideLastCover === true &&
          action?.payload?.hideLastCover === false;
        if (wasFullCover && hideLastCoverTurningOff) {
          dataObj.showFullCoverSheet = false;
        }
        // RESULTING (effective) full-cover state — NOT a transition flag. When
        // the payload omits showFullCoverSheet (partial settings edits do), fall
        // back to the existing setting so an unrelated change is read as "leave
        // unchanged", never as "turn off" (which would split a merged cover on
        // every edit). Read dataObj first so the forced exit above still drives it.
        const willBeFullCover =
          (dataObj.showFullCoverSheet ?? state.settings?.showFullCoverSheet) === true;
        const alreadyMerged = (state.pages[0]?.layout?.length || 0) >= 2;
        const halfWidth = state.canvasSize.width / 2;

        // Reconcile the page DATA SHAPE to the effective setting (not the
        // settings transition). Loading a size whose pages_c merge-state has
        // drifted out of sync with showFullCoverSheet — e.g. switching from an
        // already-ON size into one whose pages are still un-merged — used to
        // leave page 0 rendering only layout[0] (the back cover) with a blank
        // right half ("back cover on page one, front missing"). Driving off the
        // data shape is idempotent and self-heals that drift on every load.
        //
        // ON: front (state.pages[0]) and back (state.pages[last]) covers exist
        // separately. Merge them onto the front cover page; empty the back
        // cover so it stays in the array (other code keys on Pages.length-1
        // for the back cover slot) but no longer holds duplicate content.
        if (
          willBeFullCover &&
          !alreadyMerged &&
          state.pages.length >= 2
        ) {
          dataObj.hideLastCover = true;
          const front = state.pages[0];
          const back = state.pages[state.pages.length - 1];
          if (front && back) {
            const shiftObjects = (objects, dx) => {
              if (!Array.isArray(objects)) return;
              objects.forEach((obj) => {
                if (obj?.transform) obj.transform.x += dx;
              });
            };
            const emptyLayout = () => ({
              id: `layout_${uuidv4()}`,
              background: { color: null, image: null, flip: false },
              objects: [],
              safeAreaObjects: [],
            });
            const backLayout = back.layout?.[0]
              ? JSON.parse(JSON.stringify(back.layout[0]))
              : emptyLayout();
            const frontLayout = front.layout?.[0]
              ? JSON.parse(JSON.stringify(front.layout[0]))
              : emptyLayout();
            // Shift front cover content into the right half of the spread.
            shiftObjects(frontLayout.objects, halfWidth);
            shiftObjects(frontLayout.safeAreaObjects, halfWidth);
            front.layout = [backLayout, frontLayout];
            // Empty the back cover page; content now lives in the merged spread.
            back.layout = [emptyLayout()];
          }
        }

        // OFF: split the merged cover back into separate front and back pages.
        // Same data-shape rule — only split when the data is actually merged
        // AND the effective setting is OFF (omitted flag = unchanged, never OFF).
        if (
          !willBeFullCover &&
          alreadyMerged &&
          state.pages.length >= 2
        ) {
          dataObj.hideLastCover = false;
          const cover = state.pages[0];
          const back = state.pages[state.pages.length - 1];
          if (cover?.layout && back) {
            const shiftObjects = (objects, dx) => {
              if (!Array.isArray(objects)) return;
              objects.forEach((obj) => {
                if (obj?.transform) obj.transform.x += dx;
              });
            };
            const emptyLayout = () => ({
              id: `layout_${uuidv4()}`,
              background: { color: null, image: null, flip: false },
              objects: [],
              safeAreaObjects: [],
            });
            const mergedBack = cover.layout[0]
              ? JSON.parse(JSON.stringify(cover.layout[0]))
              : emptyLayout();
            const mergedFront = cover.layout[1]
              ? JSON.parse(JSON.stringify(cover.layout[1]))
              : emptyLayout();
            // Front cover objects were shifted +halfWidth at merge; reverse it.
            shiftObjects(mergedFront.objects, -halfWidth);
            shiftObjects(mergedFront.safeAreaObjects, -halfWidth);
            cover.layout = [mergedFront];
            back.layout = [mergedBack];
          }
        }
      }
      // Payloads from theme load / CreateThemeDialog can carry showFullCoverSheet
      // without an explicit hideLastCover (the Settings panel always spreads the
      // full settings object, so its toggles keep working). When the dispatcher
      // expressed no opinion, back-cover visibility must follow full cover —
      // the merge/split branches above only handle actual cover transitions
      // with pages already present.
      if (
        state.editorType === EDITOR_TYPES.PHOTOBOOK &&
        dataObj.hideLastCover === undefined &&
        typeof dataObj.showFullCoverSheet === "boolean"
      ) {
        dataObj.hideLastCover = dataObj.showFullCoverSheet;
      }
      // Capture spine width before merge so we can compute the delta after
      const prevSpineWidth = Number(state.settings.spineWidth) || 0;
      state.settings = {
        ...state.settings,
        ...dataObj,
      };
      // Auto-calculate spineWidth when paperThickness is set and full cover is enabled
      if (
        state.settings.showFullCoverSheet === true &&
        state.editorType === EDITOR_TYPES.PHOTOBOOK &&
        state.settings.paperThickness !== undefined &&
        state.settings.paperThickness > 0
      ) {
        // Photobook billable pages = (pages.length - 3) * 2
        const pageCount = state.pages && state.pages.length > 3
          ? (state.pages.length - 3) * 2
          : 0;
        state.settings.spineWidth = Math.round(pageCount * state.settings.paperThickness);
      } else if (state.editorType === EDITOR_TYPES.PHOTOBOOK) {
        state.settings.spineWidth = state.settings.spineWidth || 0;
      } else if (
        state.settings.showFullCoverSheet === true &&
        state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
        state.settings.paperThickness !== undefined &&
        state.settings.paperThickness > 0
      ) {
        // Layflat billable pages = interior pages only (exclude cover page at index 0)
        const interiorPageCount = state.pages && state.pages.length > 1
          ? (state.pages.filter((p) => !p.isCoverPage).length) * 2
          : 0;
        state.settings.spineWidth = Math.round(interiorPageCount * state.settings.paperThickness);
      } else if (state.editorType === EDITOR_TYPES.LAYFLATALBUM) {
        state.settings.spineWidth = state.settings.spineWidth || 0;
      }
      // Shift layout[0] objects on page 0 when spine width changes for a full-cover photobook or layflat.
      //
      // Render-time offsets applied in Canvas.jsx (no store change needed for layout[1]):
      //   layout[0] left-half objects:  visual x = stored x + 0 (no render offset — inner left line IS spineX)
      //   layout[0] right-half objects: visual x = stored x + sw (right-side objects shift by full spine width)
      //   layout[1] objects:            visual x = stored x + sw (same full spine width, auto via render)
      //
      // When spine width changes, only right-half layout[0] objects need a store-level adjustment
      // to compensate for the change in render-time offset (delta of sw).
      // Left-half objects have zero render offset so their stored x never needs correction.
      // layout[1] objects get NO store shift — their render-time offset updates automatically.
      const isPhotobookFullCover = state.editorType === EDITOR_TYPES.PHOTOBOOK && state.settings.showFullCoverSheet === true;
      const isLayflatFullCover = state.editorType === EDITOR_TYPES.LAYFLATALBUM && state.settings.coverEnabled === true && state.settings.showFullCoverSheet === true;
      if (isPhotobookFullCover || isLayflatFullCover) {
        const nextSpineWidth = Number(state.settings.spineWidth) || 0;
        // Delta of the right-side render-time offset (full spine width)
        const rightDelta = nextSpineWidth - prevSpineWidth;
        if (rightDelta !== 0 && state.pages.length > 0) {
          const halfWidth = state.canvasSize.width / 2;
          const layout0 = state.pages[0]?.layout?.[0];
          if (layout0) {
            const shiftObjects = (objects) => {
              if (!Array.isArray(objects)) return;
              objects.forEach((obj) => {
                if (!obj?.transform) return;
                const objCenterX = obj.transform.x + (obj.width || 0) / 2;
                if (objCenterX >= halfWidth) {
                  // Right-half (front cover) objects: compensate for delta of full spine width
                  obj.transform.x += rightDelta;
                }
                // Left-half (back cover) objects: no render offset, no store shift needed
              });
            };
            shiftObjects(layout0.objects);
            shiftObjects(layout0.safeAreaObjects);
          }
        }
      }
      // Ensure recently added boolean flags always have a defined default
      // so they are always included in the save payload.
      if (state.settings.hideLastCover === undefined) {
        state.settings.hideLastCover = false;
      }
      // Footer/BottomActions only stop the user from navigating ONTO a hidden
      // back cover — they never move the user OFF it. If the active page is the
      // trailing back cover at the moment hideLastCover takes effect, snap to
      // the nearest visible page or the canvas keeps rendering the hidden page.
      const hidesTrailingCover =
        state.settings.hideLastCover === true &&
        (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
          (state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
            state.settings.coverEnabled === true &&
            state.settings.showFullCoverSheet !== true));
      if (
        hidesTrailingCover &&
        state.pages.length >= 2 &&
        state.activePageIndex === state.pages.length - 1
      ) {
        state.activePageIndex = state.pages.length - 2;
        state.activeSide = 0;
      }
      // if (state.settings.showFullCoverSheet === undefined) {
      //   state.settings.showFullCoverSheet = false;
      // }
    },
    addNewPage(state, action) {
      // add page at specifc index
      let addAtPosition = action.payload.index;
      const newPage = {
        id: `pages_${uuidv4()}`,
        title:
          state.activePageIndex === 0 ?
            "Front Cover"
          : "page" + state.activePageIndex + 1,
        bgColor: "#fff",
        layout: [],
      };

      state.activeSide = 0;
      // add page at specific position
      if (addAtPosition !== null && addAtPosition !== undefined) {
        state.pages.splice(addAtPosition, 0, newPage);
        state.activePageIndex = addAtPosition;
      }
      recomputeSpineAndShiftCoverObjects(state);
    },
    addNewBlankPage(state, action) {
      const newPage = {
        id: `pages_${uuidv4()}`,
        title:
          state.activePageIndex === 0 ?
            "Front Cover"
          : "page" + state.activePageIndex + 1,
        bgColor: "#fff",
        layout: [],
        settings: {
          isHalfSheet: false,
        },
      };

      state.activeSide = 0;

      const isPhotobook = state.editorType === EDITOR_TYPES.PHOTOBOOK;
      const isLayflat = state.editorType === EDITOR_TYPES.LAYFLATALBUM;
      const showFullCoverSheet = state.settings?.showFullCoverSheet === true;
      const coverEnabled = state.settings?.coverEnabled === true;
      const len = state.pages.length;

      // Decide where to splice the new page so the trailing book structure
      // (back cover, inside-back-blank) stays at the end.
      let insertAt;

      if (isPhotobook) {
        // Photobook structure is always
        //   [front, insideFront, ...interior..., insideBack, back]
        // even with hideLastCover or showFullCoverSheet — only RENDERING of
        // the back cover changes, the data still has both the inside-back-
        // blank (at len-2) and the back cover (at len-1). New interior pages
        // always slot in BEFORE the inside-back-blank.
        if (len > 3) {
          insertAt = len - 2;
        } else {
          insertAt = len;
        }
      } else if (isLayflat) {
        if (coverEnabled && !showFullCoverSheet) {
          // Cover enabled (not full): [front, ...interior..., back].
          // With hideLastCover the back is hidden but still in the array.
          // Either way, insert right before the back cover.
          insertAt = Math.max(1, len - 1);
        } else {
          // Full cover (covers merged into a single index-0 page) or no
          // cover at all — no trailing back cover to reserve, so append.
          insertAt = len;
        }
      } else {
        insertAt = len;
      }

      newPage.title = "page" + (insertAt + 1);
      state.pages.splice(insertAt, 0, newPage);
      state.activePageIndex = insertAt;
    },
    removePage(state, action) {
      state.pages.splice(state.activePageIndex, 1);
      if (state.activePageIndex > 0) {
        state.activePageIndex = state.activePageIndex - 1;
      } else {
        state.activePageIndex = 0;
      }
      recomputeSpineAndShiftCoverObjects(state);
    },
    copyPage(state, action) {
      // copy the current page
      // create clone of current page and replace all ids
      let newPage = JSON.parse(
        JSON.stringify(state.pages[state.activePageIndex]),
      );
      newPage.id = `pages_${uuidv4()}`;
      newPage.title = "page" + (state.pages.length + 1);
      newPage.layout.forEach((layout, layoutIndex) => {
        if (!layout) return;
        layout.id = `layout_${uuidv4()}`;
        layout.objects.forEach((obj) => {
          obj.id = uuidv4();
        });
        layout?.safeArea?.forEach((safeArea) => {
          safeArea.id = uuidv4();
        });
        layout?.safeAreaObjects?.forEach((safeAreaObject) => {
          safeAreaObject.id = uuidv4();
        });
      });
      // if editor type is photobook then add new page at second last position
      if (
        (state.editorType === EDITOR_TYPES.PHOTOBOOK &&
          state.pages.length > 2) ||
        (state.editorType === EDITOR_TYPES.LAYFLATALBUM &&
          state.settings.coverEnabled === true)
      ) {
        state.pages.splice(state.pages.length - 2, 0, newPage);
        state.activePageIndex = state.pages.length - 3;
      } else {
        state.pages.push(newPage);
        state.activePageIndex = state.pages.length - 1;
      }
      recomputeSpineAndShiftCoverObjects(state);
    },

    createPrintPages(state, action) {
      const totalPagesToCreate = action.payload.pageCount;
      const copyFrom = action.payload.pageDetails;

      // lets create total pages and add it to pages by taking copy from copyFrom. just changing the title and id
      for (let i = 1; i <= totalPagesToCreate; i++) {
        let newPage = JSON.parse(JSON.stringify(copyFrom));
        newPage.id = `pages_${uuidv4()}`;
        newPage.title = "page" + i;
        newPage.layout.forEach((layout) => {
          if (!layout) return;
          layout.id = `layout_${uuidv4()}`;
          layout?.objects?.forEach((obj) => {
            obj.id = uuidv4();
          });
          layout?.safeArea?.forEach((safeArea) => {
            safeArea.id = uuidv4();
          });
          layout?.safeAreaObjects?.forEach((safeAreaObject) => {
            safeAreaObject.id = uuidv4();
          });
        });
        state.pages.push(newPage);
      }
      recomputeSpineAndShiftCoverObjects(state);
    },
    setPageNumber(state, action) {
      state.activePageIndex = action.payload;
      if (
        state.editorType === EDITOR_TYPES.PHOTOBOOK &&
        (action.payload === 1 || action.payload === state.pages.length - 2)
      ) {
        state.activeSide = 0;
      }
      // Clear the active object on page change. Without this the previously
      // selected object lingers (and its handles can render against a page
      // that no longer contains it), and activeSide can desync from the
      // user's actual selection.
      state.activeObject = null;
      state.activeObjectprops = null;
      state.activeObjects = [];
    },
    changePageOrder(state, action) {
      const fromIndex = action.payload.fromIndex;
      const toIndex = action.payload.toIndex;
      const page = state.pages[fromIndex];
      state.pages.splice(fromIndex, 1);
      state.pages.splice(toIndex, 0, page);
    },
    addObjectInPage(state, action) {
      const user = localStorage.getItem("userDetails");
      const userData = JSON.parse(user);

      // find active safe area in active side
      const activeSafeArea = state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.find((safeArea) => safeArea.id === state.activeSafeArea?.id);

      let currentPageSettings = state.pages[state.activePageIndex].settings;
      let isFoldable = state.settings?.isFoldable || false;
      let isHalfSheet =
        state.pages[state.activePageIndex].settings?.isHalfSheet || false;
      // check if safe area is active and active safe area is present in active side
      const isActiveSafeArea =
        state?.activeSafeArea &&
        state?.activeSafeArea !== null &&
        state?.activeSafeArea !== undefined &&
        activeSafeArea;

      if (
        state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea &&
        state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea
          ?.length > 0 &&
        userData?.userTypeCode === USER_TYPES.CUSTOMER &&
        !state.activeSafeArea
      ) {
        state.showSafeAreaGuidePopup = true;
        return;
      }
      // return if there is no activeside or page doesnt have layout or active side layout is empty
      if (state.activeSide === -1) {
        return;
      }
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        !state.pages[state.activePageIndex].layout[state.activeSide].length ===
          0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: {
            color: null,
            image: null,
            flip: false,
          },
        };
        state.pages[state.activePageIndex].layout[state.activeSide] =
          newPayload;
      }

      let maxZIndex = 0;
      const zIndices = state.pages[state.activePageIndex].layout.flatMap(
        (layout) => {
          if (!layout) return [];
          if (isActiveSafeArea && !layout?.safeAreaObjects) {
            layout.safeAreaObjects = [];
          }

          return layout[isActiveSafeArea ? "safeAreaObjects" : "objects"]?.map(
            (obj) => obj.zIndex,
          );
        },
      );
      if (zIndices.length !== 0) {
        maxZIndex = Math.max(...zIndices);
      }
      maxZIndex = maxZIndex + 1;

      if (action.payload.type === "text") {
        let textObj = {
          ...defaultTextObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          editorVersion: EDITOR_VERSION, // Stamp version for backwards compatibility
          transform: {
            ...defaultPhotoObject.transform,
            x: isActiveSafeArea ? state.activeSafeArea.left : action.payload.x,
            y: isActiveSafeArea ? state.activeSafeArea.top : action.payload.y,
          },
          font: {
            ...defaultTextObject.font,
          },
        };

        if (action.payload.text) {
          textObj.text = action.payload.text;
        }
        if (action.payload.subtype) {
          textObj.subtype = action.payload.subtype;
        }
        if (
          action.payload.month !== null &&
          action.payload.month !== undefined
        ) {
          textObj.month = action.payload.month;
        }
        if (action.payload.year !== null && action.payload.year !== undefined) {
          textObj.year = action.payload.year;
        }
        if (action.payload.noOfMonthsPerPage) {
          textObj.noOfMonthsPerPage = action.payload.noOfMonthsPerPage;
        }
        // Support linked text groups from templates/themes
        if (action.payload.groupKey) {
          textObj.groupKey = action.payload.groupKey;
          if (action.payload.contentSegments) {
            textObj.contentSegments = action.payload.contentSegments;
          }
          // Auto-register the group if it doesn't exist
          if (!state.textGroups[action.payload.groupKey]) {
            state.textGroups[action.payload.groupKey] = {
              label: action.payload.groupLabel || action.payload.groupKey,
              value: textObj.text || "",
              example: textObj.text || "",
            };
          }
        }
        // Apply custom width/height if provided (for clipboard paste, etc.)
        if (action.payload.width) {
          textObj.width = action.payload.width;
        }
        if (action.payload.height) {
          textObj.height = action.payload.height;
        }
        if (action.payload.autoFocus) {
          textObj.autoFocus = action.payload.autoFocus;
        }
        const scalingFactor =
          isActiveSafeArea ?
            state?.activeSafeArea?.width / 500
          : state.canvasSize.width / 500; // 500 considering base width as per text size regular
        textObj.font.size = Math.round(16 * scalingFactor);
        textObj.y = 0;
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          textObj.transform.x =
            isActiveSafeArea ?
              state?.activeSafeArea?.left
            : state.canvasSize.width / 2;
        }
        textObj.zIndex = maxZIndex;
        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(textObj);
        state.activeObject = textObj;
        state.activeObjectprops = textObj;
        markPageEdited(state, state.activePageIndex);
      } else if (action.payload.type === "img") {
        let imgObj = {
          ...defaultPhotoObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          transform: {
            ...defaultPhotoObject.transform,
            x: action.payload.x,
            y: action.payload.y,
          },
        };

        imgObj.transform.x =
          isActiveSafeArea ?
            state?.activeSafeArea?.left + 30
          : action.payload.x;
        imgObj.transform.y =
          isActiveSafeArea ? state?.activeSafeArea?.top + 30 : action.payload.y;
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          const halfWidth = state.canvasSize.width / 2;
          // Callers like PhotosAction.handlePhotoClick compute the offset from
          // the previous active object's transform.x, which is in SPREAD
          // coordinates (already past halfWidth for right-side objects). The
          // old code unconditionally added halfWidth, which double-shifted the
          // image off the right edge of the canvas. Only shift when the
          // incoming x is page-relative (i.e. still in the left half).
          imgObj.transform.x = isActiveSafeArea
            ? state?.activeSafeArea?.left
            : action.payload.x >= halfWidth
              ? action.payload.x
              : action.payload.x + halfWidth;
        }

        // calculate width and height based on canvas size(half image)
        imgObj.width =
          isActiveSafeArea ? state?.activeSafeArea?.width / 2
          : isFoldable === true && isHalfSheet === true ?
            state.canvasSize.width / 4
          : state.canvasSize.width / 2;
        imgObj.height =
          isActiveSafeArea ?
            state?.activeSafeArea?.height / 2
          : state.canvasSize.height / 2;
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          imgObj.width = imgObj.width / 2;
        }
        if (
          isFoldable === true &&
          isHalfSheet !== true &&
          state.activeSide !== 1
        ) {
          imgObj.width = imgObj.width / 2;
        } else if (
          !isFoldable &&
          state.activeSide !== 1 &&
          state.editorType === EDITOR_TYPES.PHOTOBOOK
        ) {
          imgObj.width = imgObj.width / 2;
        }
        // Adjust height to match image's natural aspect ratio
        if (action.payload.width && action.payload.height) {
          const imageAspectRatio = action.payload.width / action.payload.height;
          imgObj.height = imgObj.width / imageAspectRatio;
          // Cap height to half canvas to avoid oversized images
          const maxHeight = isActiveSafeArea
            ? state?.activeSafeArea?.height / 2
            : state.canvasSize.height / 2;
          if (imgObj.height > maxHeight) {
            imgObj.height = maxHeight;
            imgObj.width = maxHeight * imageAspectRatio;
          }
        }
        // check height and width of canvas
        imgObj.url = action.payload.url;
        imgObj.image_id = action.payload.image_id;
        imgObj.urls = action.payload.urls;
        // Optimistic placement: image is still uploading, url is a local
        // thumbnail blob — the swap reducer patches it when upload completes
        if (action.payload.pendingImageId) {
          imgObj.pendingImageId = action.payload.pendingImageId;
        }

        // set image width and height
        imgObj.image = {};

        imgObj.image.width = action.payload.width;
        imgObj.image.height = action.payload.height;
        imgObj.image.positionX = 0;
        imgObj.image.positionY = 0;
        imgObj.image.scale = 1;
        imgObj.image.originalWidth = action.payload.width;
        imgObj.image.originalHeight = action.payload.height;

        const imageAspectRatio = imgObj.image.width / imgObj.image.height;
        const rectAspectRatio = imgObj.width / imgObj.height;
        if (imgObj.width > 0 && imgObj.height > 0) {
          if (imageAspectRatio > rectAspectRatio) {
            // Resize based on height (image is wider than rectangle)
            imgObj.image.height = imgObj.height;
            imgObj.image.width = imgObj.height * imageAspectRatio;
            imgObj.image.positionX = (imgObj.width - imgObj.image.width) / 2;
          } else {
            // Resize based on width (image is taller or same ratio as rectangle)
            imgObj.image.width = parseFloat(imgObj.width);
            imgObj.image.height = parseFloat(imgObj.width) / imageAspectRatio;
            imgObj.image.positionY = (imgObj.height - imgObj.image.height) / 2;
          }
        }

        imgObj.zIndex = maxZIndex;
        imgObj._t = Date.now(); // Timestamp for tracking recently used
        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(imgObj);

        state.activeObject = imgObj;
        state.activeObjectprops = imgObj;
        markPageEdited(state, state.activePageIndex);

        // Auto-add to photo history
        if (action.payload.image_id && action.payload.urls) {
          const photoAssetId = action.payload.image_id;
          const isDuplicate = state.photoHistory.some(
            (item) => item.assetId === photoAssetId,
          );
          if (!isDuplicate) {
            const largeUrl = action.payload.urls.find(
              (u) => u.size === "large",
            );
            const smallUrl = action.payload.urls.find(
              (u) => u.size === "small",
            );
            const thumbnailUrl = action.payload.urls.find(
              (u) => u.size === "thumbnail",
            );
            const historyItem = {
              id: Date.now(),
              assetId: photoAssetId,
              url: largeUrl?.url || action.payload.urls[0]?.url,
              thumbnailUrl: thumbnailUrl?.url || smallUrl?.url || largeUrl?.url,
              name: action.payload.name || null,
              width: largeUrl?.w || 0,
              height: largeUrl?.h || 0,
              urls: action.payload.urls,
              _t: Date.now(),
            };
            state.photoHistory = [historyItem, ...state.photoHistory].slice(
              0,
              30,
            );
          } else {
            const existingIndex = state.photoHistory.findIndex(
              (item) => item.assetId === photoAssetId,
            );
            if (existingIndex >= 0) {
              const existingItem = state.photoHistory[existingIndex];
              existingItem.id = Date.now();
              existingItem._t = Date.now();
              state.photoHistory = [
                existingItem,
                ...state.photoHistory.filter((_, i) => i !== existingIndex),
              ];
            }
          }
        }
      } else if (action.payload.type === "sticker") {
        let imgObj = {
          ...defaultStickerObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          transform: {
            ...defaultStickerObject.transform,
            x:
              isActiveSafeArea ? state?.activeSafeArea?.left : action.payload.x,
            y: isActiveSafeArea ? state?.activeSafeArea?.top : action.payload.y,
          },
        };

        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          // Same defensive shift as the img branch — avoid double-shifting when
          // the caller already supplied a spread-coordinate x.
          const halfWidth = state.canvasSize.width / 2;
          imgObj.transform.x = isActiveSafeArea
            ? state?.activeSafeArea?.left
            : action.payload.x >= halfWidth
              ? action.payload.x
              : action.payload.x + halfWidth;
        }

        // calculate width and height based on canvas size(half image)
        imgObj.width =
          isActiveSafeArea ? state?.activeSafeArea?.width / 2
          : isFoldable === true && isHalfSheet === true ?
            state.canvasSize.width / 4
          : state.canvasSize.width / 2;
        imgObj.height =
          isActiveSafeArea ?
            state?.activeSafeArea?.height / 2
          : state.canvasSize.height / 2;
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          imgObj.width =
            isActiveSafeArea ?
              state?.activeSafeArea?.width / 2
            : imgObj.width / 2;
        }
        if (
          isFoldable === true &&
          isHalfSheet !== true &&
          state.activeSide !== 1
        ) {
          imgObj.width = imgObj.width / 2;
        } else if (
          !isFoldable &&
          state.activeSide !== 1 &&
          state.editorType === EDITOR_TYPES.PHOTOBOOK
        ) {
          imgObj.width = imgObj.width / 2;
        }
        imgObj.url = action.payload.urls.find(
          (item) => item.size === "large",
        ).url;
        imgObj.urls = action.payload.urls;
        imgObj.sticker_id = action.payload._id;

        // set image width and height
        imgObj.image = {};

        imgObj.image.width = action.payload.width;
        imgObj.image.height = action.payload.height;
        imgObj.image.positionX = 0;
        imgObj.image.positionY = 0;

        if (
          imgObj.width > imgObj.image.width ||
          imgObj.height > imgObj.image.height
        ) {
          let ratio = 1;
          if (imgObj.width > imgObj.image.width) {
            ratio = imgObj.image.width / imgObj.image.height;
            imgObj.image.width = imgObj.width;
            imgObj.image.height = imgObj.image.height * ratio;
          }
          if (imgObj.height > imgObj.image.height) {
            ratio = imgObj.image.height / imgObj.image.width;
            imgObj.image.height = imgObj.height;
            imgObj.image.width = imgObj.image.width * ratio;
          }
        }

        imgObj.zIndex = maxZIndex;
        imgObj._t = Date.now(); // Timestamp for tracking recently used
        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(imgObj);
        state.activeObject = imgObj;
        state.activeObjectprops = imgObj;
        markPageEdited(state, state.activePageIndex);

        // Auto-add to sticker history
        if (action.payload._id && action.payload.urls) {
          const stickerAssetId = action.payload._id;
          const isDuplicate = state.stickerHistory.some(
            (item) => item.assetId === stickerAssetId,
          );
          if (!isDuplicate) {
            const largeUrl = action.payload.urls.find(
              (u) => u.size === "large",
            );
            const thumbnailUrl = action.payload.urls.find(
              (u) => u.size === "thumbnail",
            );
            const historyItem = {
              id: Date.now(),
              assetId: stickerAssetId,
              url: largeUrl?.url || action.payload.urls[0]?.url,
              thumbnailUrl: thumbnailUrl?.url || largeUrl?.url,
              name: action.payload.name || null,
              width: Number(largeUrl?.w) || 100,
              height: Number(largeUrl?.h) || 100,
              _t: Date.now(),
            };
            state.stickerHistory = [historyItem, ...state.stickerHistory].slice(
              0,
              30,
            );
          } else {
            const existingIndex = state.stickerHistory.findIndex(
              (item) => item.assetId === stickerAssetId,
            );
            if (existingIndex >= 0) {
              const existingItem = state.stickerHistory[existingIndex];
              existingItem.id = Date.now();
              existingItem._t = Date.now();
              state.stickerHistory = [
                existingItem,
                ...state.stickerHistory.filter((_, i) => i !== existingIndex),
              ];
            }
          }
        }
      } else if (action.payload.type === "shape") {
        let shapeObj = {
          ...defaultShapeObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          transform: {
            ...defaultShapeObject.transform,
            x:
              isActiveSafeArea ?
                state?.activeSafeArea?.left + 30
              : action.payload.x,
            y:
              isActiveSafeArea ?
                state?.activeSafeArea?.top + 30
              : action.payload.y,
          },
        };
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          shapeObj.transform.x =
            isActiveSafeArea ?
              state.activeSafeArea?.left
            : action.payload.x + state.canvasSize.width / 2;
        }

        // calculate width and height based on canvas size(half image)

        let minwidth =
          isActiveSafeArea ?
            state.activeSafeArea?.width
          : state.canvasSize.width;

        let minheight =
          isActiveSafeArea ?
            state.activeSafeArea?.height
          : state.canvasSize.height;

        let minSize = Math.min(minwidth, minheight);
        shapeObj.width = minSize / 2;
        shapeObj.height = minSize / 2;
        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          shapeObj.width > state.canvasSize.width
        ) {
          shapeObj.width = shapeObj.width / 2;
        }
        shapeObj.shape = action.payload.shape;

        shapeObj.zIndex = maxZIndex;
        shapeObj._t = Date.now(); // Timestamp for tracking recently used

        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(shapeObj);
        state.activeObject = shapeObj;
        state.activeObjectprops = shapeObj;
        markPageEdited(state, state.activePageIndex);

        // Auto-add to shape history
        if (shapeObj.shape) {
          const shapeType = shapeObj.shape;
          const isDuplicate = state.shapeHistory.some(
            (item) => item.shapeType === shapeType,
          );
          if (!isDuplicate) {
            const historyItem = {
              id: Date.now(),
              shapeType: shapeType,
              _t: Date.now(),
            };
            state.shapeHistory = [historyItem, ...state.shapeHistory].slice(
              0,
              30,
            );
          } else {
            const existingIndex = state.shapeHistory.findIndex(
              (item) => item.shapeType === shapeType,
            );
            if (existingIndex >= 0) {
              const existingItem = state.shapeHistory[existingIndex];
              existingItem.id = Date.now();
              existingItem._t = Date.now();
              state.shapeHistory = [
                existingItem,
                ...state.shapeHistory.filter((_, i) => i !== existingIndex),
              ];
            }
          }
        }

        // before safeArea
        //  {
        //   let shapeObj = {
        //     ...defaultShapeObject,
        //     id: uuidv4(),
        //     areaType: "safeArea",
        //     transform: {
        //       ...defaultShapeObject.transform,
        //       x: action.payload.x,
        //       y: action.payload.y,
        //     },
        //   };

        //   shapeObj.transform.x = state.activeSafeArea.left;
        //   shapeObj.transform.y = state.activeSafeArea.top;
        //   if (
        //     state.editorType === EDITOR_TYPES.PHOTOBOOK &&
        //     state.activeSide === 1
        //   ) {
        //     shapeObj.transform.x =
        //       state.activeSafeArea.left + state.canvasSize.width / 2;
        //   }

        //   // calculate width and height based on canvas size(half image)
        //   let minSize = Math.min(
        //     state.canvasSize.width -
        //       (state.canvasSize.width -
        //         (state.activeSafeArea.left + state.activeSafeArea.width) +
        //         state.activeSafeArea.left),
        //     state.canvasSize.height -
        //       (state.canvasSize.height -
        //         (state.activeSafeArea.top + state.activeSafeArea.height) +
        //         state.activeSafeArea.top)
        //   );
        //   shapeObj.width = minSize / 2;
        //   shapeObj.height = minSize / 2;
        //   if (
        //     state.editorType === EDITOR_TYPES.PHOTOBOOK &&
        //     shapeObj.width > state.canvasSize.width
        //   ) {
        //     shapeObj.width = shapeObj.width / 2;
        //   }
        //   shapeObj.shape = action.payload.shape;

        //   shapeObj.zIndex = maxZIndex;
        //   if (
        //     !state.pages[state.activePageIndex].layout[state.activeSide]
        //       .safeAreaObjects
        //   ) {
        //     state.pages[state.activePageIndex].layout[
        //       state.activeSide
        //     ].safeAreaObjects = [];
        //   }
        //   state.pages[state.activePageIndex].layout[
        //     state.activeSide
        //   ].safeAreaObjects.push(shapeObj);
        //   state.activeObject = shapeObj;
      } else if (action.payload.type === "qrcode") {
        let qrObj = {
          ...defaultQRCodeObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          transform: {
            ...defaultQRCodeObject.transform,
            x: isActiveSafeArea ? state?.activeSafeArea?.left + 30 : action.payload.x || 30,
            y: isActiveSafeArea ? state?.activeSafeArea?.top + 30 : action.payload.y || 30,
          },
        };

        if (
          (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
            (isFoldable === true && isHalfSheet !== true)) &&
          state.activeSide === 1
        ) {
          qrObj.transform.x = isActiveSafeArea
            ? state?.activeSafeArea?.left + 30
            : (action.payload.x || 30) + state.canvasSize.width / 2;
        }

        const qrSize = isActiveSafeArea
          ? Math.min(state.activeSafeArea.width, state.activeSafeArea.height) / 4
          : Math.min(state.canvasSize.width, state.canvasSize.height) / 4;
        qrObj.width = qrSize;
        qrObj.height = qrSize;

        qrObj.qrUrl = action.payload.url || "";
        qrObj.qrSvgPaths = action.payload.qrSvgPaths || "";
        if (action.payload.metadata) qrObj.metadata = action.payload.metadata;
        if (action.payload.qrFgColor) qrObj.qrFgColor = action.payload.qrFgColor;
        if (action.payload.qrBgColor) qrObj.qrBgColor = action.payload.qrBgColor;
        if (action.payload.qrLevel) qrObj.qrLevel = action.payload.qrLevel;

        qrObj.zIndex = maxZIndex;
        qrObj._t = Date.now();

        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(qrObj);
        state.activeObject = qrObj;
        state.activeObjectprops = qrObj;
        markPageEdited(state, state.activePageIndex);

      } else if (action.payload.type === "calendar") {
        let obj = {
          ...defaultCalendarObject,
          id: uuidv4(),
          areaType: isActiveSafeArea ? "safeArea" : "",
          transform: {
            ...defaultCalendarObject.transform,
            x:
              isActiveSafeArea ?
                state.activeSafeArea.left + 30
              : action.payload.x,
            y:
              isActiveSafeArea ?
                state.activeSafeArea.top + 30
              : action.payload.y,
          },
        };

        // calculate width and height based on canvas size(half image)
        obj.width =
          isActiveSafeArea ?
            state.activeSafeArea.width / 2
          : state.canvasSize.width / 2;
        obj.height =
          isActiveSafeArea ?
            state.activeSafeArea.height / 2
          : state.canvasSize.height / 2;

        obj.calendar_id = action.payload._id ? action.payload._id : null;

        obj.zIndex = maxZIndex;
        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(obj);

        state.activeObject = obj;
        markPageEdited(state, state.activePageIndex);
      } else if (action.payload.type === "multiple-calendar") {
        let obj = {
          ...defaultCalendarObject,
          areaType: isActiveSafeArea ? "safeArea" : "",
          month:
            (
              action.payload?.month !== undefined &&
              action.payload?.month !== null
            ) ?
              action.payload?.month
            : 1,
          type: "multiple-calendar",
          id: uuidv4(),
          noOfMonthsPerPage: action.payload?.noOfMonthsPerPage || 1,
          transform: {
            ...defaultCalendarObject.transform,
            x:
              isActiveSafeArea ?
                state.activeSafeArea.left + action.payload.x
              : action.payload.x,
            y:
              isActiveSafeArea ?
                state.activeSafeArea.top + action.payload.y
              : action.payload.y,
          },
        };

        // calculate width and height based on canvas size(half image)
        obj.width =
          isActiveSafeArea ?
            state.activeSafeArea.width / 2.5
          : state.canvasSize.width / 2.5;
        obj.height =
          isActiveSafeArea ?
            state.activeSafeArea.height / 2.5
          : state.canvasSize.height / 2.5;

        obj.calendar_id = action.payload._id ? action.payload._id : null;

        obj.zIndex = maxZIndex;
        state.pages[state.activePageIndex].layout[state.activeSide][
          isActiveSafeArea ? "safeAreaObjects" : "objects"
        ].push(obj);

        state.activeObject = obj;
        markPageEdited(state, state.activePageIndex);
      }
    },
    copyObject(state, action) {
      // ── Multi-select copy ────────────────────────────────────────────────
      if (state.activeObjects && state.activeObjects.length > 1) {
        const snapshots = [];
        state.activeObjects.forEach(({ id, areaType }) => {
          const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
          // Search all layouts on the current page
          state.pages[state.activePageIndex].layout.forEach((layout, lIdx) => {
            if (!layout) return;
            const obj = layout[arrKey]?.find((o) => o.id === id);
            if (!obj) return;
            snapshots.push({
              // Deep-clone the object
              ...JSON.parse(JSON.stringify(obj)),
              _srcPageIndex: state.activePageIndex,
              _srcLayoutIndex: lIdx,
              _srcAreaType: areaType,
            });
          });
        });
        if (snapshots.length > 0) {
          state.copiedObjects = snapshots;
          state.copyObjectId = null; // clear single-object clipboard
          return;
        }
      }

      // ── Single-object copy (backward-compat) ─────────────────────────────
      let currentID = state.activeObject?.id;
      let areaType = state.activeObject?.areaType;
      if (!currentID) return;

      // Find and snapshot the object from state (works across layouts)
      let snapshot = null;
      state.pages[state.activePageIndex].layout.some((layout, lIdx) => {
        if (!layout) return false;
        const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
        const obj = layout[arrKey]?.find((o) => o.id === currentID);
        if (obj) {
          snapshot = {
            ...JSON.parse(JSON.stringify(obj)),
            _srcPageIndex: state.activePageIndex,
            _srcLayoutIndex: lIdx,
            _srcAreaType: areaType,
          };
          return true;
        }
        return false;
      });

      if (snapshot) {
        state.copiedObjects = [snapshot];
      }
      // Also keep legacy copyObjectId for clipboard-image interop in Canvas.jsx
      state.copyObjectId = currentID;
      state.copyObjectAreaType = areaType;
    },

    pasteObject(state, action) {
      // Guard: need a valid active side
      if (state.activeSide === -1) {
        return;
      }

      // If the page has no layout yet, initialize layout[activeSide] on-the-fly
      if (state.pages[state.activePageIndex].layout.length === 0) {
        state.pages[state.activePageIndex].layout[state.activeSide] = {
          id: `layout_${uuidv4()}`,
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: { color: null, image: null, flip: false },
        };
      }

      // ── Multi-object paste (copiedObjects array) ──────────────────────────
      if (state.copiedObjects && state.copiedObjects.length > 0) {
        // Compute max zIndex across all layouts on this page
        let maxZIndex = 0;
        state.pages[state.activePageIndex].layout.forEach((layout) => {
          if (!layout) return;
          ['objects', 'safeAreaObjects'].forEach((key) => {
            layout[key]?.forEach((obj) => {
              if ((obj.zIndex || 0) > maxZIndex) maxZIndex = obj.zIndex;
            });
          });
        });

        // Determine if all copied objects came from a single side
        const srcLayoutIndices = [...new Set(
          state.copiedObjects.map((src) => src._srcLayoutIndex ?? state.activeSide)
        )];
        const copiedFromMultipleSides = srcLayoutIndices.length > 1;

        // Determine if this is a cross-page paste (any snapshot came from a
        // different page than the currently active one). When pasting across
        // pages we preserve the original x/y exactly (no +80 nudge, no
        // cross-side half-width shift) so the object lands in the same visual
        // spot on the new page.
        const isCrossPagePaste = state.copiedObjects.some(
          (src) =>
            src._srcPageIndex !== undefined &&
            src._srcPageIndex !== state.activePageIndex,
        );

        // Iterate clones in ascending source-zIndex order so the new zIndex
        // assignments (++maxZIndex per clone) preserve the source's relative
        // stack. Without this, snapshots are in selection order — and on
        // cross-page paste (no positional offset) any flipped relative order
        // becomes visually obvious as "z-index got lower" between siblings.
        const orderedCopies = [...state.copiedObjects].sort(
          (a, b) => (a.zIndex || 0) - (b.zIndex || 0),
        );

        const lastPasted = [];
        orderedCopies.forEach((src) => {
          const srcLayoutIdx = src._srcLayoutIndex ?? state.activeSide;
          // Cross-page paste: preserve original side so position stays intact —
          // but only if the target page actually has that layout slot. If it
          // doesn't (e.g., copying from a spread side onto a single-side page),
          // fall back to the user's currently active side rather than conjuring
          // a phantom layout slot the page wasn't designed for.
          let targetLayoutIdx;
          if (isCrossPagePaste) {
            const targetPageLayouts = state.pages[state.activePageIndex].layout;
            targetLayoutIdx = targetPageLayouts[srcLayoutIdx]
              ? srcLayoutIdx
              : state.activeSide;
          } else {
            targetLayoutIdx = copiedFromMultipleSides ? srcLayoutIdx : state.activeSide;
          }
          const arrKey = src._srcAreaType === "safeArea" ? "safeAreaObjects" : "objects";

          // Ensure target layout slot exists
          if (!state.pages[state.activePageIndex].layout[targetLayoutIdx]) {
            state.pages[state.activePageIndex].layout[targetLayoutIdx] = {
              id: `layout_${uuidv4()}`,
              objects: [],
              safeAreaObjects: [],
              safeArea: [],
              background: { color: null, image: null, flip: false },
            };
          }
          const targetLayout = state.pages[state.activePageIndex].layout[targetLayoutIdx];
          if (!targetLayout[arrKey]) targetLayout[arrKey] = [];

          // Deep-clone and assign fresh id + offset + zIndex
          const clone = JSON.parse(JSON.stringify(src));
          delete clone._srcPageIndex;
          delete clone._srcLayoutIndex;
          delete clone._srcAreaType;
          clone.id = uuidv4();
          maxZIndex += 1;
          clone.zIndex = maxZIndex;
          if (clone.transform && !isCrossPagePaste) {
            clone.transform.x = (clone.transform.x || 0) + 80;
            clone.transform.y = (clone.transform.y || 0) + 80;
            // When pasting single-side copy across sides, adjust x coordinate
            if (!copiedFromMultipleSides) {
              const halfWidth = state.canvasSize.width / 2;
              if (srcLayoutIdx === 0 && targetLayoutIdx === 1) {
                clone.transform.x += halfWidth;
              } else if (srcLayoutIdx === 1 && targetLayoutIdx === 0) {
                clone.transform.x -= halfWidth;
              }
            }
          }

          targetLayout[arrKey].push(clone);
          lastPasted.push(clone);
        });

        markPageEdited(state, state.activePageIndex);

        // Update selection state
        if (lastPasted.length === 1) {
          state.activeObject = lastPasted[0];
          state.activeObjectprops = lastPasted[0];
          state.activeObjects = [{ id: lastPasted[0].id, areaType: lastPasted[0].areaType || '' }];
        } else {
          state.activeObject = null;
          state.activeObjectprops = null;
          state.activeObjects = lastPasted.map((o) => ({ id: o.id, areaType: o.areaType || '' }));
        }
        return;
      }

      // ── Legacy single-object paste (copyObjectId) ────────────────────────
      let copyObjectId = state.copyObjectId;
      let copyObjectAreaType = state.copyObjectAreaType;
      if (
        !copyObjectId ||
        copyObjectId === null ||
        copyObjectId === undefined ||
        copyObjectId === "" ||
        copyObjectId === "undefined" ||
        copyObjectId === "null"
      ) {
        return;
      }
      // get object by copyObjectId
      // let find in all pages and all layouts
      let objectToCopy = null;
      let layoutIndex = -1;
      let objectIndex = -1;
      let pageIndex = -1;

      state.pages.forEach((page, pIndex) => {
        page.layout.forEach((layout, lIndex) => {
          if (!layout) return; // skip null layout slots
          if (!layout.safeAreaObjects) {
            layout.safeAreaObjects = [];
          }
          layout[
            copyObjectAreaType === "safeArea" ? "safeAreaObjects" : "objects"
          ].forEach((obj, oIndex) => {
            if (obj.id === copyObjectId) {
              // Deep clone all properties to preserve nested objects
              objectToCopy = {
                ...obj,
                transform: obj.transform ? { ...obj.transform } : undefined,
                font: obj.font ? { ...obj.font } : undefined,
                style:
                  obj.style ?
                    {
                      ...obj.style,
                      shadow:
                        obj.style?.shadow ? { ...obj.style.shadow } : undefined,
                      border:
                        obj.style?.border ? { ...obj.style.border } : undefined,
                      effects:
                        obj.style?.effects ?
                          { ...obj.style.effects }
                        : undefined,
                    }
                  : undefined,
                shadow: obj.shadow ? { ...obj.shadow } : undefined,
                border: obj.border ? { ...obj.border } : undefined,
                effects: obj.effects ? { ...obj.effects } : undefined,
                masking: obj.masking ? { ...obj.masking } : undefined,
                image: obj.image ? { ...obj.image } : undefined,
                urls: obj.urls ? [...obj.urls] : undefined,
                contentSegments:
                  obj.contentSegments ?
                    obj.contentSegments.map((seg) => ({ ...seg }))
                  : undefined,
              };
              layoutIndex = lIndex;
              objectIndex = oIndex;
              pageIndex = pIndex;
              // break the loop by returning from the forEach callback
              return;
            }
          });
        });
      });

      if (objectToCopy === null) {
        return;
      }

      // Cross-page paste: preserve x/y exactly so the object lands in the same
      // visual spot on the new page (pages share the same size). Same-page
      // paste keeps the small bottom-right nudge so the duplicate is visible.
      const isCrossPagePaste = state.activePageIndex !== pageIndex;
      // For cross-page paste, target the source's layout slot — but only if
      // the target page already has that slot. Otherwise fall back to the
      // currently active side instead of conjuring a phantom layout slot the
      // page wasn't designed for (e.g., copying from a spread onto a cover).
      const targetSide =
        isCrossPagePaste &&
        state.pages[state.activePageIndex].layout[layoutIndex]
          ? layoutIndex
          : state.activeSide;

      if (!isCrossPagePaste) {
        if (state.activeSide === layoutIndex) {
          objectToCopy.transform.x = objectToCopy.transform.x + 80;
          objectToCopy.transform.y = objectToCopy.transform.y + 80;
        }

        if (layoutIndex == 0 && state.activeSide == 1) {
          objectToCopy.transform.x =
            objectToCopy.transform.x + state.canvasSize.width / 2;
        }

        if (layoutIndex == 1 && state.activeSide == 0) {
          objectToCopy.transform.x =
            objectToCopy.transform.x - state.canvasSize.width / 2;
        }
      }

      // assign new id
      objectToCopy.id = uuidv4();

      let maxZIndex = 0;
      const zIndices = state.pages[state.activePageIndex].layout.flatMap(
        (layout) => {
          if (!layout) return []; // skip null layout slots
          const arr = layout[
            copyObjectAreaType === "safeArea" ? "safeAreaObjects" : "objects"
          ];
          return Array.isArray(arr) ? arr.map((obj) => obj.zIndex) : [];
        },
      );
      if (zIndices.length !== 0) {
        maxZIndex = Math.max(...zIndices);
      }
      maxZIndex = maxZIndex + 1;
      objectToCopy.zIndex = maxZIndex;

      // Ensure the target layout slot exists (may be null on an uninitialized page side)
      if (!state.pages[state.activePageIndex].layout[targetSide]) {
        state.pages[state.activePageIndex].layout[targetSide] = {
          id: `layout_${uuidv4()}`,
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: { color: null, image: null, flip: false },
        };
      }

      state.pages[state.activePageIndex].layout[targetSide][
        copyObjectAreaType === "safeArea" ? "safeAreaObjects" : "objects"
      ].push(objectToCopy);
      // make new object selected
      state.activeObject = objectToCopy;
      state.activeObjects = [{ id: objectToCopy.id, areaType: objectToCopy.areaType || '' }];
      state.activeObjectprops = objectToCopy;
      markPageEdited(state, state.activePageIndex);
    },
    removeObjectInPage(state, action) {
      // check user type
      const user = localStorage.getItem("userDetails");
      const userData = JSON.parse(user);

      // check if user is customer and object is disabled for customer then return
      if (
        userData?.userTypeCode === USER_TYPES.CUSTOMER &&
        state.activeObjectprops?.disabledForClient
      ) {
        return;
      }
      // Locate the object across ALL sides of the active page (both objects and
      // safeAreaObjects), not just layout[activeSide]. On a spread the selected
      // object can live on the non-active side — searching only activeSide made
      // Delete silently no-op there even though every other control (which all
      // search all layouts) still worked. This was the "only the delete button
      // doesn't work" bug.
      const activePageLayouts =
        state.pages[state.activePageIndex]?.layout || [];
      let objectsList = null;
      let index = -1;
      for (const layout of activePageLayouts) {
        if (index !== -1) break;
        if (!layout) continue;
        for (const key of ["objects", "safeAreaObjects"]) {
          const list = layout[key];
          if (!Array.isArray(list)) continue;
          const idx = list.findIndex((x) => x.id === action.payload.id);
          if (idx !== -1) {
            objectsList = list;
            index = idx;
            break;
          }
        }
      }
      if (index !== -1) {
        // Capture properties of the object being deleted for history cleanup
        const deletedObj = objectsList[index];
        const deletedGroupKey = deletedObj?.groupKey || null;
        const deletedType = deletedObj?.type;
        const deletedImageId = deletedObj?.image_id;
        const deletedStickerId = deletedObj?.sticker_id;
        const deletedShapeType = deletedObj?.shape;

        objectsList.splice(index, 1);
        markPageEdited(state, state.activePageIndex);

        // Auto-remove from history if no instances remain across all pages
        if (deletedType === "img" && deletedImageId) {
          let stillExists = false;
          for (const page of state.pages) {
            for (const side of page.layout || []) {
              const allObjs = [
                ...(side.objects || []),
                ...(side.safeAreaObjects || []),
              ];
              if (
                allObjs.some(
                  (o) => o.type === "img" && o.image_id === deletedImageId,
                )
              ) {
                stillExists = true;
                break;
              }
            }
            if (stillExists) break;
          }
          if (!stillExists) {
            state.photoHistory = state.photoHistory.filter(
              (item) => item.assetId !== deletedImageId,
            );
          }
        } else if (deletedType === "sticker" && deletedStickerId) {
          let stillExists = false;
          for (const page of state.pages) {
            for (const side of page.layout || []) {
              const allObjs = [
                ...(side.objects || []),
                ...(side.safeAreaObjects || []),
              ];
              if (
                allObjs.some(
                  (o) =>
                    o.type === "sticker" && o.sticker_id === deletedStickerId,
                )
              ) {
                stillExists = true;
                break;
              }
            }
            if (stillExists) break;
          }
          if (!stillExists) {
            state.stickerHistory = state.stickerHistory.filter(
              (item) => item.assetId !== deletedStickerId,
            );
          }
        } else if (deletedType === "shape" && deletedShapeType) {
          let stillExists = false;
          for (const page of state.pages) {
            for (const side of page.layout || []) {
              const allObjs = [
                ...(side.objects || []),
                ...(side.safeAreaObjects || []),
              ];
              if (
                allObjs.some(
                  (o) => o.type === "shape" && o.shape === deletedShapeType,
                )
              ) {
                stillExists = true;
                break;
              }
            }
            if (stillExists) break;
          }
          if (!stillExists) {
            state.shapeHistory = state.shapeHistory.filter(
              (item) => item.shapeType !== deletedShapeType,
            );
          }
        }

        // Auto-cleanup: if the deleted object had a Smart Text group,
        // check if any remaining object still references it. If not, remove the group.
        if (deletedGroupKey && state.textGroups?.[deletedGroupKey]) {
          let stillReferenced = false;
          for (const page of state.pages) {
            for (const side of page.layout || []) {
              const allObjs = [
                ...(side.objects || []),
                ...(side.safeAreaObjects || []),
              ];
              if (allObjs.some((o) => o.groupKey === deletedGroupKey)) {
                stillReferenced = true;
                break;
              }
            }
            if (stillReferenced) break;
          }
          if (!stillReferenced) {
            delete state.textGroups[deletedGroupKey];
          }
        }
      }
    },

    changeObjectsInAllPages(state, action) {
      // auto create image objects in all pages
      // return if there is no activeside or page doesnt have layout

      // lets in action we pass all images to set in empty image objects

      const allImages = [...action.payload.images];
      const option = action.payload.option;

      // loop thourgh pages
      state.pages.forEach((page, pageIndex) => {
        page.layout.some((layout, idx) => {
          // check layout.objects with image type having empty url
          let matchingObjects;
          if (option === "option1") {
            // replace only empty images box
            matchingObjects = layout.objects?.filter(
              (x) =>
                x.type === "img" &&
                x.url === "" &&
                !x.displaySameImage &&
                !x.isTemplateSwapable,
            );
            let matchingSafeAreaObjects =
              layout?.safeAreaObjects?.filter(
                (x) =>
                  x.type === "img" &&
                  x.url === "" &&
                  !x.displaySameImage &&
                  !x.isTemplateSwapable,
              ) || [];
            matchingObjects = [...matchingObjects, ...matchingSafeAreaObjects];
          } else if (option === "option2") {
            // replace all images
            matchingObjects = layout.objects?.filter(
              (x) =>
                x.type === "img" && !x.displaySameImage && !x.isTemplateSwapable,
            );
            let matchingSafeAreaObjects =
              layout?.safeAreaObjects?.filter(
                (x) =>
                  x.type === "img" &&
                  !x.displaySameImage &&
                  !x.isTemplateSwapable,
              ) || [];
            matchingObjects = [...matchingObjects, ...matchingSafeAreaObjects];
          }

          if (!matchingObjects || matchingObjects.length === 0) {
            return;
          }

          // Loop through each matching object
          matchingObjects?.forEach((obj, index) => {
            let objectIndex = layout.objects?.findIndex((x) => x.id === obj.id);
            let safeAreaObjectIndex = layout?.safeAreaObjects?.findIndex(
              (x) => x.id === obj.id,
            );

            if (objectIndex !== -1 || safeAreaObjectIndex !== -1) {
              let currentObj =
                page.layout[idx][
                  objectIndex !== -1 ? "objects" : "safeAreaObjects"
                ][objectIndex !== -1 ? objectIndex : safeAreaObjectIndex];
              // currentObj has the image object and inside image object there are width and height and position

              // lets get imgObj from allImages, after using first image remove it from allImages
              if (allImages.length === 0) {
                return;
              }

              let imgDetails = allImages.shift();

              let imgObj = {};
              const largeUrl = imgDetails.urls.find((item) => item.size === "large");
              imgObj.width = parseInt(largeUrl?.w || imgDetails.originalWidth || imgDetails.width || 0);
              imgObj.height = parseInt(largeUrl?.h || imgDetails.originalHeight || imgDetails.height || 0);
              imgObj.positionX = 0;
              imgObj.positionY = 0;
              imgObj.scale = 1;

              const imageAspectRatio = imgObj.width && imgObj.height ? imgObj.width / imgObj.height : 1;
              const rectAspectRatio = currentObj.width / currentObj.height;

              if (currentObj.width > 0 && currentObj.height > 0) {
                if (imageAspectRatio > rectAspectRatio) {
                  // Resize based on height (image is wider than rectangle)
                  imgObj.height = currentObj.height;
                  imgObj.width = currentObj.height * imageAspectRatio;
                  imgObj.positionX = (currentObj.width - imgObj.width) / 2;
                } else {
                  // Resize based on width (image is taller or same ratio as rectangle)
                  imgObj.width = currentObj.width;
                  imgObj.height = currentObj.width / imageAspectRatio;
                  imgObj.positionY = (currentObj.height - imgObj.height) / 2;
                }
                // Vertical (portrait) images: anchor to top-left instead of centering
                if (imageAspectRatio < 1) {
                  imgObj.positionX = 0;
                  imgObj.positionY = 0;
                }
              }
              // Project-image API returns docs with `_id`; the manual-click path
              // (PhotosAction.handlePhotoClick) stores it as `image_id` on the
              // canvas object. Mirror that here so the Photos tab usage counter
              // and the "Used in this project" recent strip stay in sync.
              const placedImageId = imgDetails._id || imgDetails.image_id;
              let newobj = {
                ...currentObj,
                url: imgDetails.urls.find((item) => item.size === "large").url,
                image_id: placedImageId,
                urls: imgDetails.urls,
                image: {
                  ...currentObj.image,
                  width: imgObj.width,
                  height: imgObj.height,
                  positionX: imgObj.positionX,
                  positionY: imgObj.positionY,
                  scale: imgObj.scale,
                  originalWidth: parseInt(largeUrl?.w || imgDetails.originalWidth || imgDetails.width || 0),
                  originalHeight: parseInt(largeUrl?.h || imgDetails.originalHeight || imgDetails.height || 0),
                },
              };
              // Optimistic placement marker (see changeObjectInPage) — set
              // for still-uploading images, cleared otherwise so stale
              // markers can't survive an Auto-Create refill.
              if (imgDetails.pendingImageId) {
                newobj.pendingImageId = imgDetails.pendingImageId;
              } else {
                delete newobj.pendingImageId;
              }
              page.layout[idx][
                objectIndex !== -1 ? "objects" : "safeAreaObjects"
              ][objectIndex !== -1 ? objectIndex : safeAreaObjectIndex] =
                newobj;
              markPageEdited(state, pageIndex);
              state.pages = [...state.pages];
            }
          });
        });
      });
    },

    changeObjectInPage(state, action) {
      // return if there is no activeside or page doesnt have layout
      if (
        state.activeSide === -1 ||
        state.pages[state.activePageIndex].layout.length === 0
      ) {
        return;
      }

      // loop through state.pages[state.activePageIndex].layout and find the object with id and update it

      if (action.payload.type === "text") {
      } else if (action.payload.type === "img") {
        let layoutIndex = -1;
        let objectIndex = -1;
        state.pages[state.activePageIndex].layout.some((layout, idx) => {
          objectIndex = layout[
            (
              state.activeObject?.areaType &&
              state.activeObject?.areaType === "safeArea"
            ) ?
              "safeAreaObjects"
            : "objects"
          ]?.findIndex((x) => x.id == action.payload?.id);
          if (objectIndex !== -1) {
            layoutIndex = idx;
            return true; // Stop iterating once the object is found
          }
          return false;
        });

        if (objectIndex !== -1) {
          let currentObj =
            state.pages[state.activePageIndex].layout[layoutIndex][
              (
                state.activeObject?.areaType &&
                state.activeObject?.areaType === "safeArea"
              ) ?
                "safeAreaObjects"
              : "objects"
            ][objectIndex];
          // currentObj has the image object and inside image object there are width and height and position

          let imgObj = {};
          imgObj.width = action.payload.data.width || action.payload.data.originalWidth || 0;
          imgObj.height = action.payload.data.height || action.payload.data.originalHeight || 0;
          imgObj.positionX = 0;
          imgObj.positionY = 0;
          imgObj.scale = 1;

          const imageAspectRatio = imgObj.width && imgObj.height ? imgObj.width / imgObj.height : 1;
          const rectAspectRatio = currentObj.width / currentObj.height;

          if (currentObj.width > 0 && currentObj.height > 0) {
            if (imageAspectRatio > rectAspectRatio) {
              // Resize based on height (image is wider than rectangle)
              imgObj.height = currentObj.height;
              imgObj.width = currentObj.height * imageAspectRatio;
              imgObj.positionX = (currentObj.width - imgObj.width) / 2;
            } else {
              // Resize based on width (image is taller or same ratio as rectangle)
              imgObj.width = currentObj.width;
              imgObj.height = currentObj.width / imageAspectRatio;
              imgObj.positionY = (currentObj.height - imgObj.height) / 2;
            }
          }

          let newobj = {
            ...currentObj,
            url: action.payload.data.url,
            image_id: action.payload.data.image_id,
            urls: action.payload.data.urls,
            image: {
              ...currentObj.image,
              width: imgObj.width,
              height: imgObj.height,
              positionX: imgObj.positionX,
              positionY: imgObj.positionY,
              scale: imgObj.scale,
              originalWidth: action.payload.data.width,
              originalHeight: action.payload.data.height,
            },
          };
          // Optimistic placement marker — set when placing a still-uploading
          // image, and explicitly cleared when a normal image replaces a
          // pending one (the ...currentObj spread would otherwise leak it
          // and a later swap would clobber the user's replacement).
          if (action.payload.data.pendingImageId) {
            newobj.pendingImageId = action.payload.data.pendingImageId;
          } else {
            delete newobj.pendingImageId;
          }
          state.pages[state.activePageIndex].layout[layoutIndex][
            (
              state.activeObject?.areaType &&
              state.activeObject?.areaType === "safeArea"
            ) ?
              "safeAreaObjects"
            : "objects"
          ][objectIndex] = newobj;
          markPageEdited(state, state.activePageIndex);
          state.pages = [...state.pages];

          // set active object
          // state.activeObject = newobj;
          state.activeObjectprops = newobj;
        }
      }
    },

    // Silent source swap for optimistically-placed images (dispatched from
    // the upload thunk when an upload completes). Must NEVER be recorded in
    // undo history (listed in ignoredCanvasActions in store.jsx); store.jsx
    // additionally applies the same patch to past/future snapshots so undo
    // can never resurrect a dead blob: URL.
    replaceImageSourceAcrossPages(state, action) {
      const result = patchPendingImageObjects(state.pages, action.payload);
      if (!result.changed) return;
      state.pages = result.pages;
      // Keep floating-toolbar props in sync if the swapped object is selected
      const patchedActive = patchPendingImageObject(
        state.activeObjectprops,
        action.payload
      );
      if (patchedActive) state.activeObjectprops = patchedActive;
    },

    repositionObjects(state, action) {
      const { oldIndex, newIndex } = action.payload;
      const newArr = [
        ...state.pages[state.activePageIndex].layout[state.activeSide].objects,
      ];
      const [movedItem] = newArr.splice(oldIndex, 1);
      newArr.splice(newIndex, 0, movedItem);
      state.pages[state.activePageIndex].layout[state.activeSide].objects =
        newArr;
    },

    sendForward(state, action) {
      // if (state.activeObjectprops?.locked == true) {
      //   return;
      // }
      // lets get selected object id
      let currentID = state.activeObject?.id;
      let areaType = state.activeObject?.areaType;
      if (!currentID) {
        return;
      }
      let layoutIndex = -1;
      let objectIndex = -1;
      state.pages[state.activePageIndex].layout.some((layout, idx) => {
        if (!layout) return false;
        objectIndex = layout[
          areaType === "safeArea" ? "safeAreaObjects" : "objects"
        ]?.findIndex((x) => x.id === currentID);
        if (objectIndex !== -1 && objectIndex !== undefined) {
          layoutIndex = idx;
          return true;
        }
        return false;
      });

      if (objectIndex !== -1) {
        const currentObj =
          state.pages[state.activePageIndex].layout[layoutIndex][
            areaType === "safeArea" ? "safeAreaObjects" : "objects"
          ][objectIndex];
        const currentObjectIndex = currentObj.zIndex;
        const nearesMaxIndex = findNearestMaxZIndex(
          currentObjectIndex,
          state.pages[state.activePageIndex].layout,
          areaType,
        );
        if (
          nearesMaxIndex &&
          nearesMaxIndex.layoutIndex !== null &&
          nearesMaxIndex.objIndex !== null
        ) {
          state.pages[state.activePageIndex].layout[layoutIndex][
            areaType === "safeArea" ? "safeAreaObjects" : "objects"
          ][objectIndex].zIndex = nearesMaxIndex.zIndex;
          state.pages[state.activePageIndex].layout[nearesMaxIndex.layoutIndex][
            areaType === "safeArea" ? "safeAreaObjects" : "objects"
          ][nearesMaxIndex.objIndex].zIndex = currentObjectIndex;
        }
      }
    },
    sendBackward(state, action) {
      // lets get seelcted object id
      let currentID = state.activeObject?.id;
      let areaType = state.activeObject?.areaType;
      // if (state.activeObjectprops?.locked == true) {
      //   return;
      // }

      if (!currentID) {
        return;
      }
      let layoutIndex = -1;
      let objectIndex = -1;
      state.pages[state.activePageIndex].layout.some((layout, idx) => {
        if (!layout) return false;
        objectIndex = layout[
          areaType === "safeArea" ? "safeAreaObjects" : "objects"
        ]?.findIndex((x) => x.id === currentID);

        if (objectIndex !== -1 && objectIndex !== undefined) {
          layoutIndex = idx;
          return true; // Stop iterating once the object is found
        }
        return false;
      });

      if (objectIndex !== -1) {
        const currentObj =
          state.pages[state.activePageIndex].layout[layoutIndex][
            areaType === "safeArea" ? "safeAreaObjects" : "objects"
          ][objectIndex];

        const currentObjectIndex = currentObj.zIndex;

        let neareastMinObject = findNearestMinZIndex(
          currentObjectIndex,
          state.pages[state.activePageIndex].layout,
          areaType,
        );
        if (
          neareastMinObject &&
          neareastMinObject.layoutIndex !== null &&
          neareastMinObject.objIndex !== null
        ) {
          state.pages[state.activePageIndex].layout[layoutIndex][
            areaType === "safeArea" ? "safeAreaObjects" : "objects"
          ][objectIndex].zIndex = neareastMinObject.zIndex;
          state.pages[state.activePageIndex].layout[
            neareastMinObject.layoutIndex
          ][areaType === "safeArea" ? "safeAreaObjects" : "objects"][
            neareastMinObject.objIndex
          ].zIndex = currentObjectIndex;
        }
      }
    },
    setCurrentObjectProperties(state, action) {
      const keys = Object.keys(action?.payload ? action.payload : {});
      var isLocked = false;
      if (
        state.activeObjectprops?.locked !== undefined &&
        state.activeObjectprops?.locked !== null
      ) {
        isLocked = state.activeObjectprops?.locked;
      }
      if (action.payload === null) {
        canvasSlice.caseReducers.deSelectActiveObject(state);
        return;
      }

      // if (
      //   keys[0] !== "locked" &&
      //   keys[0] !== "image" &&
      //   action.payload?.type !== "img" &&
      //   isLocked
      // ) {
      //   return;
      // }

      let currentID = state.activeObject?.id;
      let areaType = state.activeObject?.areaType;
      if (!currentID) {
        return;
      }


      // Check if page exists
      const currentPage = state.pages?.[state.activePageIndex];
      if (!currentPage) {
        return;
      }

      const arrKey =
        areaType && areaType === "safeArea" ? "safeAreaObjects" : "objects";

      // Locate the active object across ALL layouts of the current page — not
      // just state.activeSide. activeSide can drift out of sync with the
      // active object (e.g. on a spread page where the selection lives in
      // layout[1] while activeSide is still 0), and the previous lookup would
      // silently miss the object and skip the update — which is why actions
      // like "Set as Background" would do nothing for the user.
      let owningLayoutIndex = -1;
      let indexLayout = -1;
      for (let i = 0; i < (currentPage.layout?.length || 0); i++) {
        const layout = currentPage.layout[i];
        if (!layout) continue;
        const arr = layout[arrKey];
        if (!Array.isArray(arr)) continue;
        const idx = arr.findIndex((x) => x.id === currentID);
        if (idx !== -1) {
          owningLayoutIndex = i;
          indexLayout = idx;
          break;
        }
      }

      if (indexLayout !== -1) {
        let currentObj =
          state.pages[state.activePageIndex].layout[owningLayoutIndex][
            arrKey
          ][indexLayout];

        // Note: Legacy text objects without editorVersion will continue to use
        // the legacy SVG renderer. They should NOT be auto-upgraded when edited
        // to maintain backwards compatibility and consistent rendering.

        let upgradeProps = {};
        if (currentObj.type === "text" && !currentObj.editorVersion) {
          // Upgrade legacy text to current version when any property is changed
          // upgradeProps.editorVersion = EDITOR_VERSION;
        }

        let newobj = { ...currentObj, ...action.payload, ...upgradeProps };
        state.pages[state.activePageIndex].layout[owningLayoutIndex][
          arrKey
        ][indexLayout] = newobj;
        markPageEdited(state, state.activePageIndex);
        state.pages = [...state.pages];
        state.activeObjectprops = newobj;

        // Auto-sync linked text groups: when text changes on a grouped object, propagate
        if (
          action.payload.text !== undefined &&
          newobj.type === "text" &&
          newobj.groupKey &&
          state.textGroups[newobj.groupKey]
        ) {
          const groupKey = newobj.groupKey;

          if (newobj.contentSegments && Array.isArray(newobj.contentSegments)) {
            // Partial link: extract the new value for the linked segment only.
            // Rebuild segment boundaries from adjacent static text to isolate the linked word.
            const segments = newobj.contentSegments;
            const fullNewText = action.payload.text;
            let linkedValue = fullNewText; // fallback

            // Find the linked segment index
            const linkedIdx = segments.findIndex(
              (s) => s.type === "linked" && s.key === groupKey,
            );
            if (linkedIdx !== -1) {
              // Calculate the static prefix length (all segments before the linked one)
              const prefixLen = segments
                .slice(0, linkedIdx)
                .reduce((sum, s) => sum + (s.value || "").length, 0);
              // Calculate the static suffix length (all segments after the linked one)
              const suffixLen = segments
                .slice(linkedIdx + 1)
                .reduce((sum, s) => sum + (s.value || "").length, 0);
              // The linked segment's new value is in the middle
              const endPos = fullNewText.length - suffixLen;
              if (prefixLen <= endPos) {
                linkedValue = fullNewText.slice(prefixLen, endPos);
              }
              // Update the segment value in place
              segments[linkedIdx] = {
                ...segments[linkedIdx],
                value: linkedValue,
              };
            }

            state.textGroups[groupKey].value = linkedValue;
            propagateTextGroupValue(state, groupKey, linkedValue, currentID);
          } else {
            // Full-text link: propagate entire text
            state.textGroups[groupKey].value = action.payload.text;
            propagateTextGroupValue(
              state,
              groupKey,
              action.payload.text,
              currentID,
            );
          }
          state.pages = [...state.pages];
        }

        if (action.payload.applyToAll) {
          // lets first check its font object
          if (
            newobj.subtype &&
            (action.payload.font ||
              action.payload.color ||
              action.payload.bgcolor ||
              action.payload.gradient !== undefined ||
              action.payload.bgGradient !== undefined)
          ) {
            // loop though all pages and all layouts and find the text objects with subtype match and replace font
            state.pages.forEach((page, pageIndex) => {
              page.layout.forEach((layout, idx) => {
                layout[
                  areaType && areaType === "safeArea" ?
                    "safeAreaObjects"
                  : "objects"
                ].forEach((obj, oIndex) => {
                  if (obj.subtype === newobj.subtype) {
                    if (action.payload.font) {
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].font = newobj.font;
                    } else if (action.payload.gradient !== undefined) {
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].gradient = newobj.gradient;
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].color = newobj.color;
                    } else if (action.payload.bgGradient !== undefined) {
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].bgGradient = newobj.bgGradient;
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].bgcolor = newobj.bgcolor;
                    } else if (action.payload.color) {
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].color = newobj.color;
                    } else if (action.payload.bgcolor) {
                      state.pages[pageIndex].layout[idx][
                        areaType && areaType === "safeArea" ?
                          "safeAreaObjects"
                        : "objects"
                      ][oIndex].bgcolor = newobj.bgcolor;
                    }
                  }
                });
              });
            });
          }
        }
      }
    },

    updateObjectById(state, action) {
      const { id, ...props } = action.payload || {};
      if (!id) return;
      const page = state.pages?.[state.activePageIndex];
      if (!page) return;
      let found = false;
      page.layout.forEach((layout) => {
        if (!layout || found) return;
        ["objects", "safeAreaObjects"].forEach((key) => {
          if (found) return;
          const arr = layout[key];
          if (!arr) return;
          const idx = arr.findIndex((o) => o.id === id);
          if (idx !== -1) {
            arr[idx] = { ...arr[idx], ...props };
            if (state.activeObjectprops?.id === id) {
              state.activeObjectprops = arr[idx];
            }
            if (state.activeObject?.id === id) {
              state.activeObject = arr[idx];
            }
            found = true;
          }
        });
      });
      if (found) {
        markPageEdited(state, state.activePageIndex);
        state.pages = [...state.pages];
      }
    },

    // ====== TEXT GROUPS (Linked/Replaceable Text) ======

    // Create or update a text group's default value and propagate to all linked objects
    // payload: { groupKey, label?, value }
    setTextGroupValue(state, action) {
      const { groupKey, label, value } = action.payload;
      if (!groupKey) return;

      if (!state.textGroups[groupKey]) {
        state.textGroups[groupKey] = {
          label: label || groupKey,
          value: value || "",
          example: "",
        };
      } else {
        if (label !== undefined) state.textGroups[groupKey].label = label;
        if (value !== undefined) state.textGroups[groupKey].value = value;
      }

      // Propagate to all objects with this groupKey
      propagateTextGroupValue(
        state,
        groupKey,
        state.textGroups[groupKey].value,
      );
      state.pages = [...state.pages];
    },

    // Update only the example (placeholder hint) for a group — NOT propagated to canvas objects
    // payload: { groupKey, example }
    setTextGroupExample(state, action) {
      const { groupKey, example } = action.payload;
      if (!groupKey || !state.textGroups[groupKey]) return;
      const normalizedExample = example ?? "";
      state.textGroups[groupKey].example = normalizedExample;

      // Synchronize the example to all text objects so save/load picks it up
      state.pages.forEach((page, pageIndex) => {
        page.layout.forEach((layout) => {
          const syncArray = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            arr.forEach((obj) => {
              if (obj.type !== "text" || obj.groupKey !== groupKey) return;
              if (obj.groupExample === normalizedExample) return;
              obj.groupExample = normalizedExample;
              markPageEdited(state, pageIndex);
            });
          };
          syncArray(layout.objects);
          syncArray(layout.safeAreaObjects);
        });
      });
    },

    // Update the maxChars limit for a group and sync to canvas objects
    // payload: { groupKey, maxChars }
    setTextGroupMaxChar(state, action) {
      const { groupKey, maxChars } = action.payload;
      if (!groupKey || !state.textGroups[groupKey]) return;
      const normalizedMaxChars = maxChars;
      state.textGroups[groupKey].maxChars = normalizedMaxChars;

      // Synchronize to all text objects so they enforce the new limit
      state.pages.forEach((page, pageIndex) => {
        page.layout.forEach((layout) => {
          const syncArray = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            arr.forEach((obj) => {
              if (obj.type !== "text" || obj.groupKey !== groupKey) return;
              if (obj.maxChars === normalizedMaxChars) return;
              obj.maxChars = normalizedMaxChars;
              markPageEdited(state, pageIndex);
            });
          };
          syncArray(layout.objects);
          syncArray(layout.safeAreaObjects);
        });
      });
    },

    // Link the currently active text object to a group
    // payload: { groupKey, label?, linkMode: "full" | "selection", selectionStart?, selectionEnd? }
    linkTextToGroup(state, action) {
      const {
        groupKey,
        label,
        linkMode,
        selectionStart,
        selectionEnd,
        selectedText: payloadSelectedText,
        maxChars,
      } = action.payload;
      if (!groupKey || !state.activeObject?.id) return;

      const currentID = state.activeObject.id;
      const areaType = state.activeObject.areaType;
      const currentPage = state.pages?.[state.activePageIndex];
      const currentLayout = currentPage?.layout?.[state.activeSide];
      if (!currentPage || !currentLayout) return;

      const objectsArray =
        areaType === "safeArea" ?
          currentLayout.safeAreaObjects
        : currentLayout.objects;
      if (!objectsArray) return;

      const idx = objectsArray.findIndex((x) => x.id === currentID);
      if (idx === -1) return;

      const obj = objectsArray[idx];
      if (obj.type !== "text") return;

      if (
        linkMode === "selection" &&
        (payloadSelectedText ||
          (selectionStart !== undefined && selectionEnd !== undefined))
      ) {
        // Partial text link: we want to replace ALL occurrences of the selected text (case-insensitive)
        const originalText = obj.text || "";
        // Prefer the explicitly passed selectedText from the payload (avoids wrong-position slice)
        // Fall back to slicing by position if not provided
        const selectedText =
          payloadSelectedText ||
          originalText.slice(selectionStart, selectionEnd);

        if (!selectedText) return; // Safety check

        // Ensure the group exists; default value AND example = the selected text so it shows immediately
        if (!state.textGroups[groupKey]) {
          state.textGroups[groupKey] = {
            label: label || groupKey,
            value: selectedText,
            example: selectedText,
            maxChars,
          };
        } else {
          if (!state.textGroups[groupKey].value) {
            // Group exists but has no value yet — seed it with the selected text
            state.textGroups[groupKey].value = selectedText;
          }
          if (!state.textGroups[groupKey].example) {
            // Seed example too if not set
            state.textGroups[groupKey].example = selectedText;
          }
          if (maxChars !== undefined) {
            state.textGroups[groupKey].maxChars = maxChars;
          }
        }
        // Delegate to shared helper — same logic used at reload time so
        // we never need to serialise segments to the DB.
        // Initial segment value = selectedText (the literal word the user highlighted).
        // The group's stored .value is applied by propagateTextGroupValue later.
        const segments = buildSegmentsFromWord(
          originalText,
          selectedText,
          groupKey,
          selectedText,
        );

        obj.contentSegments = segments.length > 0 ? segments : null;
        obj.groupKey = groupKey;
        obj.groupLabel = label || groupKey;
        obj.groupExample = selectedText;
        if (maxChars !== undefined) obj.maxChars = maxChars;
        state.textGroups[groupKey].example =
          state.textGroups[groupKey].example || selectedText;

        // Rebuild obj.text from segments so the canvas re-renders immediately
        obj.text = (
          segments.length > 0 ?
            segments
          : [{ type: "static", value: originalText }])
          .map((s) => s.value)
          .join("");
      } else {
        // Full text link: ensure group exists
        const fullTextExample = obj.text || "";
        if (!state.textGroups[groupKey]) {
          // First link for this group — seed value & example from the object's text
          state.textGroups[groupKey] = {
            label: label || groupKey,
            value: fullTextExample,
            example: fullTextExample,
            maxChars,
          };
        } else {
          // Group exists — block if text doesn't match the group's stored value
          const groupValue = state.textGroups[groupKey].value || "";
          if (
            groupValue &&
            fullTextExample.toLowerCase() !== groupValue.toLowerCase()
          ) {
            return; // Abort — UI already showed the mismatch alert
          }
          if (!state.textGroups[groupKey].example) {
            state.textGroups[groupKey].example = fullTextExample;
          }
          if (maxChars !== undefined) {
            state.textGroups[groupKey].maxChars = maxChars;
          }
        }

        obj.groupKey = groupKey;
        obj.groupLabel = label || groupKey;
        obj.contentSegments = null; // No segments needed for full link
        obj.groupExample =
          state.textGroups[groupKey].example || fullTextExample;
        if (state.textGroups[groupKey].maxChars !== undefined) {
          obj.maxChars = state.textGroups[groupKey].maxChars;
        }

        // Adopt the group's canonical value (will match since we validated above)
        if (state.textGroups[groupKey].value !== undefined) {
          obj.text = state.textGroups[groupKey].value;
        }
      }

      // Update active object props
      state.activeObjectprops = { ...obj };
      markPageEdited(state, state.activePageIndex);
      state.pages = [...state.pages];
    },

    // Unlink the currently active text object from its group
    unlinkTextFromGroup(state, action) {
      if (!state.activeObject?.id) return;

      const currentID = state.activeObject.id;
      const areaType = state.activeObject.areaType;
      const currentPage = state.pages?.[state.activePageIndex];
      const currentLayout = currentPage?.layout?.[state.activeSide];
      if (!currentPage || !currentLayout) return;

      const objectsArray =
        areaType === "safeArea" ?
          currentLayout.safeAreaObjects
        : currentLayout.objects;
      if (!objectsArray) return;

      const idx = objectsArray.findIndex((x) => x.id === currentID);
      if (idx === -1) return;

      const obj = objectsArray[idx];

      // Flatten segments back to plain text if they exist
      if (obj.contentSegments && Array.isArray(obj.contentSegments)) {
        obj.text = obj.contentSegments.map((s) => s.value).join("");
      }
      delete obj.groupKey;
      delete obj.groupLabel;
      delete obj.contentSegments;
      delete obj.groupExample;

      state.activeObjectprops = { ...obj };
      markPageEdited(state, state.activePageIndex);
      state.pages = [...state.pages];
    },

    // Remove a text group entirely and unlink all objects referencing it
    // payload: { groupKey }
    removeTextGroup(state, action) {
      const { groupKey } = action.payload;
      if (!groupKey || !state.textGroups[groupKey]) return;

      delete state.textGroups[groupKey];

      // Unlink all objects with this groupKey
      state.pages.forEach((page, pageIndex) => {
        page.layout.forEach((layout) => {
          const cleanArray = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            arr.forEach((obj) => {
              if (obj.groupKey === groupKey) {
                if (obj.contentSegments && Array.isArray(obj.contentSegments)) {
                  obj.text = obj.contentSegments.map((s) => s.value).join("");
                }
                delete obj.groupKey;
                delete obj.groupLabel;
                delete obj.contentSegments;
                delete obj.groupExample;
                markPageEdited(state, pageIndex);
              }
            });
          };
          cleanArray(layout.objects);
          cleanArray(layout.safeAreaObjects);
        });
      });
      state.pages = [...state.pages];
    },

    // Bulk-set textGroups — used when loading a saved project or theme.
    // payload: { [groupKey]: { label, value, example?, objectIds? } }
    // objectIds is used to re-attach groupKey to the correct canvas objects so
    // that propagateTextGroupValue (which filters by obj.groupKey) can reach them.
    setTextGroups(state, action) {
      const incoming = action.payload || {};

      // ── Step 1: Normalize groups into runtime state (strip save-only fields) ──
      const normalized = {};
      Object.keys(incoming).forEach((groupKey) => {
        const group = incoming[groupKey] || {};
        normalized[groupKey] = {
          label: group.label || groupKey,
          value: group.value || "",
          example: group.example || "",
        };
        if (group.maxChars !== undefined)
          normalized[groupKey].maxChars = group.maxChars;
      });
      state.textGroups = normalized;

      // ── Step 2: Build reverse lookup maps ─────────────────────────────────
      // idToGroup:    { objectId → groupKey }  — for fast per-object lookup
      // idToMeta:     { objectId → { linkMode, contentSegments? } } — rich metadata
      const idToGroup = {};
      const idToMeta = {};

      Object.keys(incoming).forEach((groupKey) => {
        const group = incoming[groupKey] || {};

        // New format: per-object metadata map  { [objectId]: { linkMode, contentSegments? } }
        if (group.objects && typeof group.objects === "object") {
          Object.entries(group.objects).forEach(([id, meta]) => {
            idToGroup[id] = groupKey;
            idToMeta[id] = meta || {};
          });
        }

        // Legacy / fallback format: flat objectIds array
        const objectIds = group.objectIds || [];
        objectIds.forEach((id) => {
          if (!idToGroup[id]) {
            // don't overwrite from the richer objects map
            idToGroup[id] = groupKey;
            idToMeta[id] = { linkMode: "full" }; // legacy entries are full-text by default
          }
        });
      });

      // ── Step 3: Re-attach groupKey + restore link structure ───────────────
      if (Object.keys(idToGroup).length > 0) {
        state.pages.forEach((page) => {
          (page.layout || []).forEach((layout) => {
            const relink = (arr) => {
              if (!Array.isArray(arr)) return;
              arr.forEach((obj) => {
                const gk = idToGroup[obj.id];
                if (!gk || obj.type !== "text") return;

                const group = normalized[gk];
                const meta = idToMeta[obj.id] || {};

                obj.groupKey = gk;
                obj.groupLabel = group.label;
                obj.groupExample =
                  meta.selectedText || group.example || group.value;

                if (meta.linkMode === "selection" && meta.selectedText) {
                  // ── Word-only link ─────────────────────────────────────────
                  // Regenerate contentSegments on-the-fly from the object's current
                  // text + the stored selectedText (the word originally highlighted).
                  // This avoids saving the full segment array to the database — only
                  // a single short string is stored, not hundreds of objects.
                  // The group's current .value is passed as groupValue so the linked
                  // segments already carry the latest text (e.g. after edits since save).
                  const segs = buildSegmentsFromWord(
                    obj.text,
                    meta.selectedText,
                    gk,
                    group.value || meta.selectedText,
                  );
                  obj.contentSegments = segs.length > 0 ? segs : null;
                  // Rebuild obj.text from the new segments
                  if (obj.contentSegments) {
                    obj.text = obj.contentSegments.map((s) => s.value).join("");
                  }
                } else {
                  // ── Full-text link ─────────────────────────────────────────
                  obj.contentSegments = null;
                }
              });
            };
            relink(layout.objects);
            relink(layout.safeAreaObjects);
          });
        });
      }

      // ── Step 4: Propagate each group's current value to all linked objects ─
      // For full-text objects this replaces obj.text.
      // For word-only objects, propagateTextGroupValue updates the linked segments
      // in-place (obj.contentSegments was just rebuilt above with the current value,
      // so this is effectively a no-op for them — but kept for consistency).
      Object.keys(normalized).forEach((groupKey) => {
        if (normalized[groupKey].value) {
          propagateTextGroupValue(state, groupKey, normalized[groupKey].value);
        }
      });

      state.pages = [...state.pages];
    },

    addShapeGradientToHistory(state, action) {
      const gradientData = action.payload;
      if (
        !gradientData ||
        !gradientData.stops ||
        gradientData.stops.length < 2
      ) {
        return;
      }

      const isDuplicate = state.shapeGradientHistory.some(
        (item) => item.css === gradientData.css,
      );

      if (!isDuplicate) {
        const historyItem = {
          id: Date.now(),
          stops: gradientData.stops,
          type: gradientData.type || "linear",
          angle: gradientData.angle || 90,
          radialPosition: gradientData.radialPosition,
          css: gradientData.css,
        };
        state.shapeGradientHistory = [
          ...state.shapeGradientHistory,
          historyItem,
        ];
      }
    },

    addShapeSolidColorToHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) {
        return;
      }

      const isDuplicate = state.shapeSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );

      if (!isDuplicate) {
        const historyItem = {
          id: Date.now(),
          color: colorData.color,
          rgba: colorData.rgba,
        };
        state.shapeSolidColorHistory = [
          ...state.shapeSolidColorHistory,
          historyItem,
        ];
      }
    },

    addTextGradientToHistory(state, action) {
      const gradientData = action.payload;
      if (!gradientData || !gradientData.stops || gradientData.stops.length < 2)
        return;
      const isDuplicate = state.textGradientHistory.some(
        (item) => item.css === gradientData.css,
      );
      if (!isDuplicate) {
        state.textGradientHistory = [
          ...state.textGradientHistory,
          {
            id: Date.now(),
            stops: gradientData.stops,
            type: gradientData.type || "linear",
            angle: gradientData.angle || 90,
            radialPosition: gradientData.radialPosition,
            css: gradientData.css,
          },
        ];
      }
    },

    addTextSolidColorToHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) return;
      const isDuplicate = state.textSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );
      if (!isDuplicate) {
        state.textSolidColorHistory = [
          ...state.textSolidColorHistory,
          { id: Date.now(), color: colorData.color },
        ];
      }
    },

    addBackgroundSolidColorToHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) return;
      const isDuplicate = state.backgroundSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );
      if (!isDuplicate) {
        state.backgroundSolidColorHistory = [
          ...state.backgroundSolidColorHistory,
          { id: Date.now(), color: colorData.color },
        ];
      }
    },

    addBorderSolidColorToHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) return;
      const isDuplicate = state.borderSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );
      if (!isDuplicate) {
        state.borderSolidColorHistory = [
          ...state.borderSolidColorHistory,
          { id: Date.now(), color: colorData.color },
        ];
      }
    },

    addShadowSolidColorToHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) return;
      const isDuplicate = state.shadowSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );
      if (!isDuplicate) {
        state.shadowSolidColorHistory = [
          ...state.shadowSolidColorHistory,
          { id: Date.now(), color: colorData.color },
        ];
      }
    },

    addToGlobalGradientHistory(state, action) {
      const gradientData = action.payload;
      if (!gradientData || !gradientData.stops || gradientData.stops.length < 2)
        return;
      const isDuplicate = state.globalGradientHistory.some(
        (item) => item.css === gradientData.css,
      );
      if (!isDuplicate) {
        state.globalGradientHistory = [
          ...state.globalGradientHistory,
          {
            id: Date.now(),
            stops: gradientData.stops,
            type: gradientData.type || "linear",
            angle: gradientData.angle || 90,
            radialPosition: gradientData.radialPosition,
            css: gradientData.css,
          },
        ].slice(-50);
      }
    },

    addToGlobalSolidColorHistory(state, action) {
      const colorData = action.payload;
      if (!colorData || !colorData.color) return;
      const isDuplicate = state.globalSolidColorHistory.some(
        (item) => item.color === colorData.color,
      );
      if (!isDuplicate) {
        state.globalSolidColorHistory = [
          ...state.globalSolidColorHistory,
          { id: Date.now(), color: colorData.color },
        ].slice(-50);
      }
    },

    addBackgroundImageToHistory(state, action) {
      const backgroundData = action.payload;

      if (!backgroundData || !backgroundData._id || !backgroundData.urls) {
        return;
      }

      const isDuplicate = state.backgroundImageHistory.some(
        (item) => item.assetId === backgroundData._id,
      );

      if (!isDuplicate) {
        const largeUrl = backgroundData.urls.find(
          (u) => u.size === "large",
        )?.url;
        const thumbnailUrl = backgroundData.urls.find(
          (u) => u.size === "thumbnail",
        )?.url;

        const historyItem = {
          id: Date.now(),
          assetId: backgroundData._id,
          url: largeUrl || backgroundData.urls[0]?.url,
          thumbnailUrl: thumbnailUrl || largeUrl,
          name: backgroundData.name || null,
          _t: Date.now(), // Timestamp for tracking recently used
        };

        state.backgroundImageHistory = [
          historyItem,
          ...state.backgroundImageHistory,
        ].slice(0, 30);
      } else {
        const existingIndex = state.backgroundImageHistory.findIndex(
          (item) => item.assetId === backgroundData._id,
        );
        if (existingIndex >= 0) {
          const existingItem = state.backgroundImageHistory[existingIndex];
          existingItem.id = Date.now();
          existingItem._t = Date.now();

          state.backgroundImageHistory = [
            existingItem,
            ...state.backgroundImageHistory.filter(
              (_, i) => i !== existingIndex,
            ),
          ];
        }
      }
    },

    addStickerToHistory(state, action) {
      const stickerData = action.payload;

      if (!stickerData || !stickerData._id || !stickerData.urls) {
        return;
      }

      const isDuplicate = state.stickerHistory.some(
        (item) => item.assetId === stickerData._id,
      );

      if (!isDuplicate) {
        const largeUrl = stickerData.urls.find((u) => u.size === "large")?.url;
        const thumbnailUrl = stickerData.urls.find(
          (u) => u.size === "thumbnail",
        )?.url;

        const historyItem = {
          id: Date.now(),
          assetId: stickerData._id,
          url: largeUrl || stickerData.urls[0]?.url,
          thumbnailUrl: thumbnailUrl || largeUrl,
          name: stickerData.name || null,
          width:
            Number(stickerData.urls.find((u) => u.size === "large")?.w) || 100,
          height:
            Number(stickerData.urls.find((u) => u.size === "large")?.h) || 100,
          _t: Date.now(),
        };

        state.stickerHistory = [historyItem, ...state.stickerHistory].slice(
          0,
          30,
        );
      } else {
        const existingIndex = state.stickerHistory.findIndex(
          (item) => item.assetId === stickerData._id,
        );
        if (existingIndex >= 0) {
          const existingItem = state.stickerHistory[existingIndex];
          existingItem.id = Date.now();
          existingItem._t = Date.now();

          state.stickerHistory = [
            existingItem,
            ...state.stickerHistory.filter((_, i) => i !== existingIndex),
          ];
        }
      }
    },

    addMaskToHistory(state, action) {
      const maskData = action.payload;

      if (!maskData || !maskData._id || !maskData.urls || !maskData.urls[0]) {
        return;
      }

      const isDuplicate = state.maskHistory.some(
        (item) => item.assetId === maskData._id,
      );

      if (!isDuplicate) {
        const historyItem = {
          id: Date.now(),
          assetId: maskData._id,
          d: maskData.urls[0].d,
          width: parseInt(maskData.urls[0].w),
          height: parseInt(maskData.urls[0].h),
          name: maskData.name || null,
          _t: Date.now(),
        };

        state.maskHistory = [historyItem, ...state.maskHistory].slice(0, 30);
      } else {
        const existingIndex = state.maskHistory.findIndex(
          (item) => item.assetId === maskData._id,
        );
        if (existingIndex >= 0) {
          const existingItem = state.maskHistory[existingIndex];
          existingItem.id = Date.now();
          existingItem._t = Date.now();

          state.maskHistory = [
            existingItem,
            ...state.maskHistory.filter((_, i) => i !== existingIndex),
          ];
        }
      }
    },

    addPhotoToHistory(state, action) {
      const photoData = action.payload;

      if (!photoData || !photoData._id || !photoData.urls) {
        return;
      }

      const isDuplicate = state.photoHistory.some(
        (item) => item.assetId === photoData._id,
      );

      if (!isDuplicate) {
        const largeUrl = photoData.urls.find((u) => u.size === "large");
        const smallUrl = photoData.urls.find((u) => u.size === "small");
        const thumbnailUrl = photoData.urls.find((u) => u.size === "thumbnail");

        const historyItem = {
          id: Date.now(),
          assetId: photoData._id,
          url: largeUrl?.url || photoData.urls[0]?.url,
          thumbnailUrl: thumbnailUrl?.url || smallUrl?.url || largeUrl?.url,
          name: photoData.name || null,
          width: largeUrl?.w || 0,
          height: largeUrl?.h || 0,
          urls: photoData.urls,
          _t: Date.now(),
        };

        state.photoHistory = [historyItem, ...state.photoHistory].slice(0, 30);
      } else {
        const existingIndex = state.photoHistory.findIndex(
          (item) => item.assetId === photoData._id,
        );
        if (existingIndex >= 0) {
          const existingItem = state.photoHistory[existingIndex];
          existingItem.id = Date.now();
          existingItem._t = Date.now();

          state.photoHistory = [
            existingItem,
            ...state.photoHistory.filter((_, i) => i !== existingIndex),
          ];
        }
      }
    },

    removePhotoFromHistory(state, action) {
      // action.payload: the assetId (image_id) to remove
      const assetId = action.payload;
      if (!assetId) return;

      // Only remove if no canvas object on any page still references this image
      let stillExists = false;
      for (const page of state.pages) {
        for (const side of page.layout || []) {
          const allObjs = [
            ...(side.objects || []),
            ...(side.safeAreaObjects || []),
          ];
          if (allObjs.some((o) => o.type === "img" && o.image_id === assetId)) {
            stillExists = true;
            break;
          }
        }
        if (stillExists) break;
      }
      if (!stillExists) {
        state.photoHistory = state.photoHistory.filter(
          (item) => item.assetId !== assetId,
        );
      }
    },

    addShapeToHistory(state, action) {
      const shapeType = action.payload;

      if (!shapeType) {
        return;
      }

      const isDuplicate = state.shapeHistory.some(
        (item) => item.shapeType === shapeType,
      );

      if (!isDuplicate) {
        const historyItem = {
          id: Date.now(),
          shapeType: shapeType,
          _t: Date.now(),
        };

        state.shapeHistory = [historyItem, ...state.shapeHistory].slice(0, 30);
      } else {
        const existingIndex = state.shapeHistory.findIndex(
          (item) => item.shapeType === shapeType,
        );
        if (existingIndex >= 0) {
          const existingItem = state.shapeHistory[existingIndex];
          existingItem.id = Date.now();
          existingItem._t = Date.now();

          state.shapeHistory = [
            existingItem,
            ...state.shapeHistory.filter((_, i) => i !== existingIndex),
          ];
        }
      }
    },

    setActiveObject(state, action) {
      // let value = action.payload;
      // let currentID = value?.id;
      // let areaType = value?.areaType;

      const value = action.payload;
      const currentID = value?.id;
      const areaType = value?.areaType;
      const isShiftPressed = value?.isShiftPressed ?? false;
      const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";

      // The active page can momentarily be out of range right after a size switch /
      // theme reload swaps in a shorter `pages` array while a stale selection is
      // re-resolved. Bail out safely instead of dereferencing an undefined page.
      const activePage = state.pages?.[state.activePageIndex];
      if (!activePage || !Array.isArray(activePage.layout)) return;

      // ── Find the clicked object in the current page layout ──────────────────
      let layoutIndex = -1;
      let objectIndex = -1;
      state.pages[state.activePageIndex].layout.some((layout, idx) => {
        if (!layout) return false;
        const i = layout[arrKey]?.findIndex((x) => x.id === currentID);
        if (i !== -1 && i !== undefined) {
          layoutIndex = idx;
          objectIndex = i;
          return true;
        }
        return false;
      });

      if (objectIndex === -1) return;

      const clickedObj =
        state.pages[state.activePageIndex].layout[layoutIndex][arrKey][objectIndex];

      // Skip objects that are still processing (e.g., AI face-swap)
      if (clickedObj?.isProcessing) return;

      if (isShiftPressed) {
        // ── Shift-click: toggle this object in the multi-select array ──────────
        const existingIdx = state.activeObjects.findIndex((o) => o.id === currentID);
        if (existingIdx !== -1) {
          state.activeObjects.splice(existingIdx, 1); // deselect
        } else {
          state.activeObjects.push({ id: currentID, areaType });
        }

        if (state.activeObjects.length === 0) {
          // Everything deselected
          state.activeObject = null;
          state.activeObjectprops = null;
        } else if (state.activeObjects.length === 1) {
          // Collapsed back to a single selection — resolve its props from state
          const solo = state.activeObjects[0];
          const soloArrKey = solo.areaType === "safeArea" ? "safeAreaObjects" : "objects";
          let soloLayoutIdx = -1, soloObjIdx = -1;
          state.pages[state.activePageIndex].layout.some((layout, idx) => {
            if (!layout) return false;
            const i = layout[soloArrKey]?.findIndex((x) => x.id === solo.id);
            if (i !== -1 && i !== undefined) {
              soloLayoutIdx = idx;
              soloObjIdx = i;
              return true;
            }
            return false;
          });
          if (soloObjIdx !== -1) {
            const soloObj =
              state.pages[state.activePageIndex].layout[soloLayoutIdx][soloArrKey][soloObjIdx];
            // activeObject without `.target` — ItemDragger resolves it from the DOM
            state.activeObject = { id: solo.id, areaType: solo.areaType };
            state.activeObjectprops = soloObj;
            state.activeSide = resolveActiveSide(state, soloLayoutIdx, soloObj);
          }
        } else {
          // Genuinely multiple objects selected — hide single-item toolbars
          state.activeObject = null;
          state.activeObjectprops = null;
          state.activeSide = resolveActiveSide(state, layoutIndex, clickedObj);
        }
      } else {
        // ── Normal click: single selection (clears any existing multi-select) ──
        state.activeObjects = [{ id: currentID, areaType }];
        state.activeObjectprops = clickedObj;
        state.activeObject = value;
        state.activeSide = resolveActiveSide(state, layoutIndex, clickedObj);
      }
    },

    // Programmatic multi-select (e.g., lasso tool). Payload: [{ id, areaType }]
    setActiveObjects(state, action) {
      const ids = action.payload ?? [];
      state.activeObjects = ids;
      // Same guard as setActiveObject: never resolve selection props against an
      // active page that no longer exists (out-of-range index after a size swap).
      const activePage = state.pages?.[state.activePageIndex];
      if (!activePage || !Array.isArray(activePage.layout)) return;
      // Resolve props for single-selection backward compat
      if (ids.length === 1) {
        const solo = ids[0];
        const soloArrKey = solo.areaType === "safeArea" ? "safeAreaObjects" : "objects";
        let soloLayoutIdx = -1, soloObjIdx = -1;
        state.pages[state.activePageIndex].layout.some((layout, idx) => {
          if (!layout) return false;
          const i = layout[soloArrKey]?.findIndex((x) => x.id === solo.id);
          if (i !== -1 && i !== undefined) {
            soloLayoutIdx = idx;
            soloObjIdx = i;
            return true;
          }
          return false;
        });
        if (soloObjIdx !== -1) {
          state.activeObject = { id: solo.id, areaType: solo.areaType };
          state.activeObjectprops =
            state.pages[state.activePageIndex].layout[soloLayoutIdx][soloArrKey][soloObjIdx];
          state.activeSide = soloLayoutIdx;
        }
      } else if (ids.length > 1) {
        state.activeObject = null;
        state.activeObjectprops = null;
        // Sync activeSide using a majority vote over the SELECTED objects'
        // visual position. Position is more reliable than layoutIndex
        // because templates can stuff every object into layout[0] yet still
        // span both pages — and a marquee can pick up an outlier whose
        // stored bounds overlap the gesture but visually belongs on the
        // other side. Tallying by left/right x gives the side the user
        // actually targeted.
        const layouts = state.pages[state.activePageIndex].layout;
        const canvasWidth = Number(state.canvasSize?.width) || 0;
        const halfWidth = canvasWidth / 2;
        let leftCount = 0;
        let rightCount = 0;
        let fallbackLayoutIndex = -1;
        for (const id of ids) {
          const arrKey =
            id.areaType === "safeArea" ? "safeAreaObjects" : "objects";
          let foundObj = null;
          let foundLayoutIdx = -1;
          for (let i = 0; i < layouts.length; i++) {
            const layout = layouts[i];
            if (!layout) continue;
            const obj = layout[arrKey]?.find((x) => x.id === id.id);
            if (obj) {
              foundObj = obj;
              foundLayoutIdx = i;
              break;
            }
          }
          if (!foundObj) continue;
          if (fallbackLayoutIndex === -1) fallbackLayoutIndex = foundLayoutIdx;
          if (canvasWidth > 0 && foundObj.transform) {
            const objCenterX =
              (foundObj.transform.x || 0) + (foundObj.width || 0) / 2;
            if (objCenterX >= halfWidth) rightCount++;
            else leftCount++;
          } else {
            // No canvas width to compare against — fall back to layoutIndex.
            if (foundLayoutIdx === 1) rightCount++;
            else leftCount++;
          }
        }
        if (rightCount > 0 || leftCount > 0) {
          state.activeSide = rightCount > leftCount ? 1 : 0;
        } else if (fallbackLayoutIndex !== -1) {
          state.activeSide = fallbackLayoutIndex;
        }
      } else {
        state.activeObject = null;
        state.activeObjectprops = null;
      }
    },

    deSelectActiveObject(state) {
      if (state.activeObject || state.activeObjects.length > 0) {
        state.activeObject = null;
        state.activeObjectprops = null;
        state.activeObjects = [];
      }
    },

    selectAllObjects(state) {
      const page = state.pages?.[state.activePageIndex];
      if (!page?.layout?.length) return;

      // Collect selectable objects from EVERY layout side on the current page
      // (not only activeSide, so Ctrl+A always grabs the full spread).
      const allIds = [];
      page.layout.forEach((layout) => {
        if (!layout) return;
        layout.objects?.forEach((o) => {
          if (!o.isProcessing && !o.disabledForClient && !o.locked) {
            allIds.push({ id: o.id, areaType: "" });
          }
        });
        layout.safeAreaObjects?.forEach((o) => {
          if (!o.isProcessing && !o.disabledForClient && !o.locked) {
            allIds.push({ id: o.id, areaType: "safeArea" });
          }
        });
      });

      state.activeObjects = allIds;
      if (allIds.length === 1) {
        const solo = allIds[0];
        const soloArrKey = solo.areaType === "safeArea" ? "safeAreaObjects" : "objects";
        let soloLayoutIdx = -1, soloObjIdx = -1;
        state.pages[state.activePageIndex].layout.some((layout, idx) => {
          if (!layout) return false;
          const i = layout[soloArrKey]?.findIndex((x) => x.id === solo.id);
          if (i !== -1 && i !== undefined) {
            soloLayoutIdx = idx;
            soloObjIdx = i;
            return true;
          }
          return false;
        });
        if (soloObjIdx !== -1) {
          state.activeObject = { id: solo.id, areaType: solo.areaType };
          state.activeObjectprops =
            state.pages[state.activePageIndex].layout[soloLayoutIdx][soloArrKey][soloObjIdx];
          state.activeSide = soloLayoutIdx;
        }
      } else {
        state.activeObject = null;
        state.activeObjectprops = null;
      }
    },

  // Batch-update transforms/sizes for multiple objects at once.
    // Payload: { updates: Array of { id, areaType, transform?, width?, height?, ... }, history: boolean }
    updateMultipleObjects(state, action) {
      const { updates = [] } = action.payload ?? {};
      updates.forEach(({ id, areaType, ...props }) => {
        // Strip internal-only keys that should never land on an object
        const { history, ...updateProps } = props;
        const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
        state.pages[state.activePageIndex].layout.some((layout) => {
          if (!layout) return false;
          const idx = layout[arrKey]?.findIndex((o) => o.id === id);
          if (idx !== -1 && idx !== undefined) {
            const oldObj = layout[arrKey][idx];
            layout[arrKey][idx] = {
              ...oldObj,
              ...updateProps,
              ...(updateProps.transform && { transform: { ...oldObj.transform, ...updateProps.transform } }),
              ...(updateProps.image && { image: { ...oldObj.image, ...updateProps.image } }),
              ...(updateProps.font && { font: { ...oldObj.font, ...updateProps.font } }),
              ...(updateProps.border && { border: { ...oldObj.border, ...updateProps.border } }),
              ...(updateProps.shadow && { shadow: { ...oldObj.shadow, ...updateProps.shadow } }),
              ...(updateProps.effects && { effects: { ...oldObj.effects, ...updateProps.effects } }),
            };
            return true;
          }
          return false;
        });
      });
      markPageEdited(state, state.activePageIndex);
      // Force a distinct state for redux-undo checkpoints on group gesture end.
      // Without this, some history:true commits can be coalesced if object values
      // are already equal to present state at dispatch time.
      if (action.payload?.history === true) {
        state._historyNonce = (state._historyNonce ?? 0) + 1;
      }
      state.pages = [...state.pages];
    },

    // Pushes a dedicated undo checkpoint without mutating document content.
    // Used by multi-select gesture start so each gesture gets one undo step.
    checkpointHistory(state) {
      state._historyNonce = (state._historyNonce ?? 0) + 1;
    },

    // Delete every object currently in activeObjects.
    // Respects the same customer/locked guards as removeObjectInPage.
    removeMultipleObjectsInPage(state) {
      if (!state.activeObjects.length) return;
      const userData = (() => {
        try { return JSON.parse(localStorage.getItem("userDetails")); } catch { return null; }
      })();
      const isCustomer = userData?.userTypeCode === USER_TYPES.CUSTOMER;

      state.activeObjects.forEach(({ id, areaType }) => {
        const arrKey = areaType === "safeArea" ? "safeAreaObjects" : "objects";
        state.pages[state.activePageIndex].layout.some((layout) => {
          if (!layout) return false;
          const objectsList = layout[arrKey];
          const idx = objectsList?.findIndex((o) => o.id === id);
          if (idx === undefined || idx === -1) return false;
          const obj = objectsList[idx];
          if (isCustomer && obj?.disabledForClient) return true; // skip
          objectsList.splice(idx, 1);
          return true;
        });
      });

      markPageEdited(state, state.activePageIndex);
      state.pages = [...state.pages];
      state.activeObjects = [];
      state.activeObject = null;
      state.activeObjectprops = null;
    },

    setPageLayout(state, action) {
      // check if active side is 1 and layout array is empty than add one blank layout for active side 0
      if (
        state.activeSide === 1 &&
        state.pages[state.activePageIndex].layout.length === 0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: {
            color: null,
            image: null,
            flip: false,
          },
        };
        state.pages[state.activePageIndex].layout[0] = newPayload;
      }

      let currentPageSettings = state.pages[state.activePageIndex].settings;
      let isFoldable = state?.settings?.isFoldable;
      let isHalfSheet =
        state?.pages[state.activePageIndex]?.settings?.isHalfSheet;

      let baseWidth = action.payload.width;
      let baseHeight = action.payload.height;
      let objects = action.payload.objects;
      // loop thorugh objects and set width and height based on state.canvasSize

      // create copy variable of state.canvasSize
      let canvasSize = { ...state.canvasSize };
      let left = 0,
        top = 0,
        right = 0,
        bottom = 0,
        max = 0;
      let calWidth = 0,
        calHeight = 0;
      const surroundgap = 40;
      if (state.editorType === EDITOR_TYPES.CALENDER) {
        // when thre calender, some part of the canvas habing calener object with specif width and height. so remaining part will be available to set layout.
        // so lets first find the width and height of the calender object and then set the remaining width and height to canvasSize
        // find object from active layout.

        if (state.pages[state.activePageIndex].layout[0]) {
          let calenderObj = state.pages[
            state.activePageIndex
          ].layout[0].objects.find((obj) => obj.type === "calendar");

          // we have 4 things in calendar object, width, height, x, y  based on this we need to find big area and then set the canvasSize
          if (calenderObj) {
            left = calenderObj.transform.x;
            top = calenderObj.transform.y;
            right =
              state.canvasSize.width -
              calenderObj.transform.x -
              calenderObj.width;
            bottom =
              state.canvasSize.height -
              calenderObj.transform.y -
              calenderObj.height;
            // now lets check which value is bigger among left, right, top, bottom
            // if its left side bigger than we will use left side area for layout. same for right, top and bottom
            calWidth = calenderObj.width;
            calHeight = calenderObj.height;
            max = Math.max(left, top, right, bottom);

            if (max === left || max === right) {
              const adjustment = max === right ? left : right;
              canvasSize.width =
                canvasSize.width - calenderObj.width - adjustment;
            } else if (max === top || max === bottom) {
              const adjustment = max === bottom ? top : bottom;
              canvasSize.height =
                canvasSize.height - calenderObj.height - adjustment;
            }

            canvasSize.width = canvasSize.width - surroundgap;
            canvasSize.height = canvasSize.height - surroundgap;
          }
        }
      }
      let scaleFactorWidth = baseWidth / canvasSize.width;
      let scaleFactorHeight = baseHeight / canvasSize.height;
      if (state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true) {
        scaleFactorWidth = baseWidth / (state.canvasSize.width / 2);
      }
      const bleed = Number(state.canvasSize.bleedMargin) || 0;
      const isSpread = state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true;
      const perSideFullWidth = isSpread ? state.canvasSize.width / 2 : state.canvasSize.width;
      let newObjects = [];
      let maxZIndex = 0;
      const zIndices = state.pages[state.activePageIndex].layout.flatMap(
        (layout) => (layout ? layout.objects.map((obj) => obj.zIndex) : []),
      );
      if (zIndices.length !== 0) {
        maxZIndex = Math.max(...zIndices);
      }
      let newZIndex = maxZIndex + 1;

      objects.forEach((obj) => {
        //also calculate left and right based on state.canvasSize
        let x = obj.transform.x / scaleFactorWidth;
        let y = obj.transform.y / scaleFactorHeight;
        let width = obj.width / scaleFactorWidth;
        let height = obj.height / scaleFactorHeight;
        // Offset layout objects to stay within the trim area (inside bleed margin)
        if (state.editorType !== EDITOR_TYPES.CALENDER && bleed > 0) {
          const effectiveH = state.canvasSize.height - 2 * bleed;
          y = y * (effectiveH / state.canvasSize.height) + bleed;
          height = height * (effectiveH / state.canvasSize.height);
          if (isSpread) {
            // Spreads have bleed only on the outer edge, not at the gutter/spine
            const effectiveW = perSideFullWidth - bleed; // one-sided bleed per page
            const scaleX = effectiveW / perSideFullWidth;
            if (state.activeSide === 0) {
              // Left page: outer bleed on left, gutter (no bleed) on right
              x = x * scaleX + bleed;
            } else {
              // Right page: gutter (no bleed) on left, outer bleed on right
              x = x * scaleX;
            }
            width = width * scaleX;
          } else {
            // Single page: bleed on all 4 sides
            const effectiveW = state.canvasSize.width - 2 * bleed;
            x = x * (effectiveW / state.canvasSize.width) + bleed;
            width = width * (effectiveW / state.canvasSize.width);
          }
        }
        if (state.activeSide === 1) {
          //if its sperad sheet then there is 2 side
          x = x + state.canvasSize.width / 2;
        }
        // generate unique id for each object
        let newid = uuidv4();
        let newObj = {};

        if (calWidth > 0 && calHeight > 0) {
          if (max === right) {
            x = x + calWidth + left;
          }
          if (max === bottom) {
            y = y + calHeight + top;
          }
          x = x + surroundgap / 2;
          y = y + surroundgap / 2;
        }
        if (obj.type === "text") {
          const newFont = {
            ...obj.font,
            size: Math.round(obj.font.size / scaleFactorWidth),
          };
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            width: width,
            height: height,
            id: newid,
            font: newFont,
          };
        } else if (obj.type === "img") {
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            image: {
              width: 8000,
              height: 12000,
              positionX: 0,
              positionY: 0,
              scale: 1,
            },
            width: width,
            height: height,
            id: newid,
            url: "",
            urls: [],
            ...(obj.masking && { masking: { ...obj.masking } }),
          };

        } else {
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            image: {
              width: 8000,
              height: 12000,
              positionX: 0,
              positionY: 0,
              scale: 1,
            },
            width: width,
            height: height,
            id: newid,
          };
        }

        newObj.zIndex = newZIndex;
        newObjects.push(newObj);
        newZIndex = newZIndex + 1;
      });

      // Filter out existing text and image objects
      const existingObjects =
        state.pages[state.activePageIndex].layout[state.activeSide]?.objects ||
        [];
      // const filteredExistingObjects = existingObjects.filter(obj => obj.type !== 'text' && obj.type !== 'img');
      const filteredExistingObjects = existingObjects.filter((obj) => {
        if (obj.type === "text") {
          return obj.subtype === "year" || obj.subtype === "month";
        }
        return obj.type !== "img";
      });
      // get all image objects
      const oldImageObjects = existingObjects.filter(
        (obj) => obj.type === "img",
      );
      //remove objects having empty url
      const newObjectsWithUrl = oldImageObjects.filter((obj) => obj.url);


      // lets loops thourgh new objects and set url to image objects
      newObjects.forEach((obj) => {
        if (obj.type === "img") {
          // check if newObjectsWithUrl has any object
          if (newObjectsWithUrl.length === 0) {
            //breack the loop
            return;
          }
          let imgDetails = newObjectsWithUrl.shift();

          let imgObj = {};
          imgObj.width = imgDetails.image.originalWidth;
          imgObj.height = imgDetails.image.originalHeight;
          imgObj.positionX = 0;
          imgObj.positionY = 0;
          imgObj.scale = 1;

          const imageAspectRatio = imgObj.width / imgObj.height;
          const rectAspectRatio = obj.width / obj.height;
          if (obj.width > 0 && obj.height > 0) {
            if (imageAspectRatio > rectAspectRatio) {
              // Resize based on height (image is wider than rectangle)
              imgObj.height = obj.height;
              imgObj.width = obj.height * imageAspectRatio;
              imgObj.positionX = (obj.width - imgObj.width) / 2;
            } else {
              // Resize based on width (image is taller or same ratio as rectangle)
              imgObj.width = obj.width;
              imgObj.height = obj.width / imageAspectRatio;
              imgObj.positionY = (obj.height - imgObj.height) / 2;
            }
          }

          obj.url = imgDetails.url;
          obj.image = {
            ...obj.image,
            width: imgObj.width,
            height: imgObj.height,
            positionX: imgObj.positionX,
            positionY: imgObj.positionY,
            scale: imgObj.scale,
            originalWidth: imgDetails.image.originalWidth,
            originalHeight: imgDetails.image.originalHeight,
          };
          obj.urls = imgDetails.urls;
          if (imgDetails.image_id) {
            obj.image_id = imgDetails.image_id;
          }
        }
      });

      // Merge the filtered existing objects with the new objects
      const mergedObjects = [...filteredExistingObjects, ...newObjects];
      // Create new payload with merged objects
      const newPayload = {
        ...action.payload,
        id: uuidv4(),
        objects: mergedObjects,
        safeAreaObjects: [],
        safeArea: [],
      };
      state.pages[state.activePageIndex].layout[state.activeSide] = newPayload;
      markPageEdited(state, state.activePageIndex);

      // replace objects with new objects, this is complettly replacing the objects
      // const newPayload = { ...action.payload, id: uuidv4(), objects: newObjects };
      // state.pages[state.activePageIndex].layout[state.activeSide] = newPayload;
    },

    setEntireSpreadLayout(state, action) {
      let layouts = action.payload; // expects an array of layout objects (typically 2 for a spread)
      let isFoldable = state?.settings?.isFoldable;


      // Collect all old image objects across the entire spread
      let allOldImageObjects = [];
      let allFilteredExistingObjects = [];

      for (let pageSide = 0; pageSide < layouts.length; pageSide++) {
        const existingObjects = state.pages[state.activePageIndex].layout[pageSide]?.objects || [];
        allFilteredExistingObjects[pageSide] = existingObjects.filter((obj) => {
          if (obj.type === "text") {
            return obj.subtype === "year" || obj.subtype === "month";
          }
          return obj.type !== "img";
        });

        // get all image objects
        const sideImages = existingObjects.filter((obj) => obj.type === "img");
        // keep only those with valid urls
        const sideImagesWithUrl = sideImages.filter((obj) => obj.url);
        allOldImageObjects.push(...sideImagesWithUrl);
      }

      // Loop through the new layouts and allocate collected images to the new slots sequentially
      for (let pageSide = 0; pageSide < layouts.length; pageSide++) {
        let layoutData = layouts[pageSide];
        if (!layoutData) continue;

        let baseWidth = layoutData.width;
        let baseHeight = layoutData.height;
        let objects = layoutData.objects || [];

        let scaleFactorWidth = baseWidth / state.canvasSize.width;
        let scaleFactorHeight = baseHeight / state.canvasSize.height;
        if (state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true) {
          scaleFactorWidth = baseWidth / (state.canvasSize.width / 2);
        }
        const spreadBleed = Number(state.canvasSize.bleedMargin) || 0;
        const spreadPerSideFullWidth = (state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true)
          ? state.canvasSize.width / 2
          : state.canvasSize.width;

        let newObjects = [];
        let maxZIndex = 0;
        const zIndices = state.pages[state.activePageIndex].layout.flatMap((layout) => {
          if (!layout) return [];
          return layout.objects.map((obj) => obj.zIndex);
        });
        if (zIndices.length !== 0) {
          maxZIndex = Math.max(...zIndices);
        }
        let newZIndex = maxZIndex + 1;

        objects.forEach((obj) => {
          let x = obj.transform.x / scaleFactorWidth;
          let y = obj.transform.y / scaleFactorHeight;
          let width = obj.width / scaleFactorWidth;
          let height = obj.height / scaleFactorHeight;
          // Offset layout objects to stay within the trim area (inside bleed margin).
          // Spreads have bleed only on outer edges (not gutter/spine).
          // Right-side objects are stored in full-spread coords (x already includes canvasWidth/2),
          // so the same formula x*scaleX+bleed works for both pages:
          //   pageSide=0: maps [0, W/2] → [bleed, W/2]
          //   pageSide=1: maps [W/2, W] → [W/2, W-bleed]
          if (spreadBleed > 0) {
            const effectiveH = state.canvasSize.height - 2 * spreadBleed;
            y = y * (effectiveH / state.canvasSize.height) + spreadBleed;
            height = height * (effectiveH / state.canvasSize.height);
            const effectiveW = spreadPerSideFullWidth - spreadBleed; // one-sided bleed per page
            const scaleX = effectiveW / spreadPerSideFullWidth;
            x = x * scaleX + spreadBleed;
            width = width * scaleX;
          }

          let newid = uuidv4();
          let newObj = {};

          if (obj.type === "text") {
            const newFont = {
              ...obj.font,
              size: Math.round(obj.font.size / scaleFactorWidth),
            };
            newObj = {
              ...obj,
              transform: { x, y, rotation: obj.transform.rotation },
              width,
              height,
              id: newid,
              font: newFont,
            };
          } else if (obj.type === "img") {
            newObj = {
              ...obj,
              transform: { x, y, rotation: obj.transform.rotation },
              image: {
                width: 8000,
                height: 12000,
                positionX: 0,
                positionY: 0,
                scale: 1,
              },
              width,
              height,
              id: newid,
              url: "",
              urls: [],
              ...(obj.masking && { masking: { ...obj.masking } }),
            };

            // allocate next available image
            if (allOldImageObjects.length > 0) {
              let imgDetails = allOldImageObjects.shift();

              let imgObj = {};
              imgObj.width = imgDetails.image.originalWidth;
              imgObj.height = imgDetails.image.originalHeight;
              imgObj.positionX = 0;
              imgObj.positionY = 0;
              imgObj.scale = 1;

              const imageAspectRatio = imgObj.width / imgObj.height;
              const rectAspectRatio = newObj.width / newObj.height;
              if (newObj.width > 0 && newObj.height > 0) {
                if (imageAspectRatio > rectAspectRatio) {
                  imgObj.height = newObj.height;
                  imgObj.width = newObj.height * imageAspectRatio;
                  imgObj.positionX = (newObj.width - imgObj.width) / 2;
                } else {
                  imgObj.width = newObj.width;
                  imgObj.height = newObj.width / imageAspectRatio;
                  imgObj.positionY = (newObj.height - imgObj.height) / 2;
                }
              }

              newObj.url = imgDetails.url;
              newObj.image = {
                ...newObj.image,
                width: imgObj.width,
                height: imgObj.height,
                positionX: imgObj.positionX,
                positionY: imgObj.positionY,
                scale: imgObj.scale,
                originalWidth: imgDetails.image.originalWidth,
                originalHeight: imgDetails.image.originalHeight,
              };
              newObj.urls = imgDetails.urls;
              if (imgDetails.image_id) {
                newObj.image_id = imgDetails.image_id;
              }
            }
          } else {
            newObj = {
              ...obj,
              transform: { x, y, rotation: obj.transform.rotation },
              image: {
                width: 8000,
                height: 12000,
                positionX: 0,
                positionY: 0,
                scale: 1,
              },
              width,
              height,
              id: newid,
            };
          }

          newObj.zIndex = newZIndex;
          newObjects.push(newObj);
          newZIndex = newZIndex + 1;
        });

        const mergedObjects = [...(allFilteredExistingObjects[pageSide] || []), ...newObjects];

        const newPayload = {
          ...layoutData,
          id: uuidv4(),
          objects: mergedObjects,
          safeArea: [],
          safeAreaObjects: [],
        };
        state.pages[state.activePageIndex].layout[pageSide] = newPayload;
      }
      markPageEdited(state, state.activePageIndex);
    },

    setPageIdeaLayout(state, action) {
      if (
        state.activeSide === 1 &&
        state.pages[state.activePageIndex].layout.length === 0
      ) {
        const blankPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: { color: null, image: null, flip: false },
        };
        state.pages[state.activePageIndex].layout[0] = blankPayload;
      }

      const { objects, ...payloadRest } = action.payload;
      let isFoldable = state?.settings?.isFoldable;
      let baseWidth = payloadRest.width;
      let baseHeight = payloadRest.height;

      let canvasSize = { ...state.canvasSize };

      let left = 0,
        top = 0,
        right = 0,
        bottom = 0,
        max = 0;
      let calWidth = 0,
        calHeight = 0;
      const surroundgap = 40;
      if (state.editorType === EDITOR_TYPES.CALENDER) {
        if (state.pages[state.activePageIndex].layout[0]) {
          let calenderObj = state.pages[
            state.activePageIndex
          ].layout[0].objects.find((obj) => obj.type === "calendar");
          if (calenderObj) {
            left = calenderObj.transform.x;
            top = calenderObj.transform.y;
            right =
              state.canvasSize.width -
              calenderObj.transform.x -
              calenderObj.width;
            bottom =
              state.canvasSize.height -
              calenderObj.transform.y -
              calenderObj.height;
            calWidth = calenderObj.width;
            calHeight = calenderObj.height;
            max = Math.max(left, top, right, bottom);
            if (max === left || max === right) {
              const adjustment = max === right ? left : right;
              canvasSize.width =
                canvasSize.width - calenderObj.width - adjustment;
            } else if (max === top || max === bottom) {
              const adjustment = max === bottom ? top : bottom;
              canvasSize.height =
                canvasSize.height - calenderObj.height - adjustment;
            }
            canvasSize.width = canvasSize.width - surroundgap;
            canvasSize.height = canvasSize.height - surroundgap;
          }
        }
      }

      let scaleFactorWidth = baseWidth / canvasSize.width;
      let scaleFactorHeight = baseHeight / canvasSize.height;
      if (state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true) {
        scaleFactorWidth = baseWidth / (state.canvasSize.width / 2);
      }

      let maxZIndex = 0;
      const zIndices = state.pages[state.activePageIndex].layout.flatMap(
        (layout) => {
          if (!layout) return [];
          return layout.objects.map((obj) => obj.zIndex);
        }
      );
      if (zIndices.length !== 0) {
        maxZIndex = Math.max(...zIndices);
      }
      let newZIndex = maxZIndex + 1;

      let newObjects = [];
      objects.forEach((obj) => {
        let x = obj.transform.x / scaleFactorWidth;
        let y = obj.transform.y / scaleFactorHeight;
        let width = obj.width / scaleFactorWidth;
        let height = obj.height / scaleFactorHeight;

        if (state.activeSide === 1) {
          x = x + state.canvasSize.width / 2;
        }

        if (calWidth > 0 && calHeight > 0) {
          if (max === right) {
            x = x + calWidth + left;
          }
          if (max === bottom) {
            y = y + calHeight + top;
          }
          x = x + surroundgap / 2;
          y = y + surroundgap / 2;
        }

        let newid = uuidv4();
        let newObj = {};

        if (obj.type === "text") {
          const newFont = {
            ...obj.font,
            size: Math.round(obj.font.size / scaleFactorWidth),
          };
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            width: width,
            height: height,
            id: newid,
            font: newFont,
          };
        } else if (obj.type === "img") {
          const imageData = {
            width: 8000,
            height: 12000,
            positionX: 0,
            positionY: 0,
            scale: 1,
          };
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            image: imageData,
            width: width,
            height: height,
            id: newid,
            url: "",
            urls: [],
            ...(obj.masking && { masking: { ...obj.masking } }),
          };
        } else {
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            width: width,
            height: height,
            id: newid,
          };
        }

        newObj.zIndex = newZIndex;
        newObjects.push(newObj);
        newZIndex = newZIndex + 1;
      });

      const existingObjects =
        state.pages[state.activePageIndex].layout[state.activeSide]?.objects ||
        [];
      const filteredExistingObjects = existingObjects.filter((obj) => {
        if (obj.type === "calendar" || obj.type === "multiple-calendar")
          return true;
        if (
          obj.type === "text" &&
          (obj.subtype === "year" || obj.subtype === "month")
        )
          return true;
        return false;
      });

      const existingSafeAreaObjects =
        state.pages[state.activePageIndex].layout[state.activeSide]
          ?.safeAreaObjects || [];
      const oldImageObjects = [
        ...existingObjects,
        ...existingSafeAreaObjects,
      ].filter((obj) => obj.type === "img" && obj.url && obj.url.trim() !== "");

      const selectedImage = oldImageObjects.reduce((acc, img) => {
        if (!acc) return img;
        const accTime = acc?._t || 0;
        const imgTime = img?._t || 0;
        if (imgTime > accTime) return img;
        if (imgTime < accTime) return acc;
        return (img?.zIndex || 0) > (acc?.zIndex || 0) ? img : acc;
      }, null);

      newObjects.forEach((obj) => {
        if (obj.type === "img" && (!obj.url || obj.url.trim() === "")) {
          if (!selectedImage) return;
          const imgDetails = selectedImage;
          let imgObj = {};
          imgObj.width =
            imgDetails.image.originalWidth || imgDetails.image.width;
          imgObj.height =
            imgDetails.image.originalHeight || imgDetails.image.height;
          imgObj.positionX = 0;
          imgObj.positionY = 0;
          imgObj.scale = 1;
          const imageAspectRatio = imgObj.width / imgObj.height;
          const rectAspectRatio = obj.width / obj.height;
          if (obj.width > 0 && obj.height > 0) {
            if (imageAspectRatio > rectAspectRatio) {
              imgObj.height = obj.height;
              imgObj.width = obj.height * imageAspectRatio;
              imgObj.positionX = (obj.width - imgObj.width) / 2;
            } else {
              imgObj.width = obj.width;
              imgObj.height = obj.width / imageAspectRatio;
              imgObj.positionY = (obj.height - imgObj.height) / 2;
            }
          }
          obj.url = imgDetails.url;
          obj.image = {
            ...obj.image,
            width: imgObj.width,
            height: imgObj.height,
            positionX: imgObj.positionX,
            positionY: imgObj.positionY,
            scale: imgObj.scale,
            originalWidth:
              imgDetails.image.originalWidth || imgDetails.image.width,
            originalHeight:
              imgDetails.image.originalHeight || imgDetails.image.height,
          };
          obj.urls = imgDetails.urls || [];
        }
      });

      const mergedObjects = [...filteredExistingObjects, ...newObjects];
      const newPayload = {
        ...payloadRest,
        id: uuidv4(),
        objects: mergedObjects,
        safeAreaObjects: [],
        safeArea: [],
      };
      state.pages[state.activePageIndex].layout[state.activeSide] = newPayload;
      markPageEdited(state, state.activePageIndex);
    },

    setSpreadPageIdeaLayout(state, action) {
      const { objects, pageSide, ...payloadRest } = action.payload;
      let baseWidth = payloadRest.width;
      let baseHeight = payloadRest.height;

      let isFoldable = state?.settings?.isFoldable;
      let scaleFactorWidth = baseWidth / state.canvasSize.width;
      let scaleFactorHeight = baseHeight / state.canvasSize.height;
      if (state.editorType === EDITOR_TYPES.PHOTOBOOK || isFoldable === true) {
        scaleFactorWidth = baseWidth / (state.canvasSize.width / 2);
      }

      let maxZIndex = 0;
      const zIndices = state.pages[state.activePageIndex].layout.flatMap(
        (layout) => {
          if (!layout) return [];
          return layout.objects.map((obj) => obj.zIndex);
        }
      );
      if (zIndices.length !== 0) {
        maxZIndex = Math.max(...zIndices);
      }
      let newZIndex = maxZIndex + 1;

      let newObjects = [];
      objects.forEach((obj) => {
        let x = obj.transform.x / scaleFactorWidth;
        let y = obj.transform.y / scaleFactorHeight;
        let width = obj.width / scaleFactorWidth;
        let height = obj.height / scaleFactorHeight;

        let newid = uuidv4();
        let newObj = {};

        if (obj.type === "text") {
          const newFont = {
            ...obj.font,
            size: Math.round(obj.font.size / scaleFactorWidth),
          };
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            width: width,
            height: height,
            id: newid,
            font: newFont,
          };
        } else if (obj.type === "img") {
          const imageData = {
            width: 8000,
            height: 12000,
            positionX: 0,
            positionY: 0,
            scale: 1,
          };
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            image: imageData,
            width: width,
            height: height,
            id: newid,
            url: "",
            urls: [],
            ...(obj.masking && { masking: { ...obj.masking } }),
          };
        } else {
          newObj = {
            ...obj,
            transform: { x: x, y: y, rotation: obj.transform.rotation },
            width: width,
            height: height,
            id: newid,
          };
        }

        newObj.zIndex = newZIndex;
        newObjects.push(newObj);
        newZIndex = newZIndex + 1;
      });

      const existingObjects =
        state.pages[state.activePageIndex].layout[pageSide]?.objects || [];
      const filteredExistingObjects = existingObjects.filter((obj) => {
        if (obj.type === "calendar" || obj.type === "multiple-calendar")
          return true;
        if (
          obj.type === "text" &&
          (obj.subtype === "year" || obj.subtype === "month")
        )
          return true;
        return false;
      });

      const existingSafeAreaObjects =
        state.pages[state.activePageIndex].layout[pageSide]?.safeAreaObjects ||
        [];
      const oldImageObjects = [
        ...existingObjects,
        ...existingSafeAreaObjects,
      ].filter((obj) => obj.type === "img" && obj.url && obj.url.trim() !== "");

      const selectedImage = oldImageObjects.reduce((acc, img) => {
        if (!acc) return img;
        const accTime = acc?._t || 0;
        const imgTime = img?._t || 0;
        if (imgTime > accTime) return img;
        if (imgTime < accTime) return acc;
        return (img?.zIndex || 0) > (acc?.zIndex || 0) ? img : acc;
      }, null);

      newObjects.forEach((obj) => {
        if (obj.type === "img" && (!obj.url || obj.url.trim() === "")) {
          if (!selectedImage) return;
          const imgDetails = selectedImage;
          let imgObj = {};
          imgObj.width =
            imgDetails.image.originalWidth || imgDetails.image.width;
          imgObj.height =
            imgDetails.image.originalHeight || imgDetails.image.height;
          imgObj.positionX = 0;
          imgObj.positionY = 0;
          imgObj.scale = 1;
          const imageAspectRatio = imgObj.width / imgObj.height;
          const rectAspectRatio = obj.width / obj.height;
          if (obj.width > 0 && obj.height > 0) {
            if (imageAspectRatio > rectAspectRatio) {
              imgObj.height = obj.height;
              imgObj.width = obj.height * imageAspectRatio;
              imgObj.positionX = (obj.width - imgObj.width) / 2;
            } else {
              imgObj.width = obj.width;
              imgObj.height = obj.width / imageAspectRatio;
              imgObj.positionY = (obj.height - imgObj.height) / 2;
            }
          }
          obj.url = imgDetails.url;
          obj.image = {
            ...obj.image,
            width: imgObj.width,
            height: imgObj.height,
            positionX: imgObj.positionX,
            positionY: imgObj.positionY,
            scale: imgObj.scale,
            originalWidth:
              imgDetails.image.originalWidth || imgDetails.image.width,
            originalHeight:
              imgDetails.image.originalHeight || imgDetails.image.height,
          };
          obj.urls = imgDetails.urls || [];
        }
      });

      const mergedObjects = [...filteredExistingObjects, ...newObjects];
      const newPayload = {
        ...payloadRest,
        id: uuidv4(),
        objects: mergedObjects,
        safeArea: [],
        safeAreaObjects: [],
      };
      state.pages[state.activePageIndex].layout[pageSide] = newPayload;
      markPageEdited(state, state.activePageIndex);
    },

    setActiveSide(state, action) {
      state.activeSide = action.payload;
    },
    setBackgroundColor(state, action) {
      if (state.activeSide === -1) {
        return;
      }
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        !state.pages[state.activePageIndex].layout[state.activeSide].length ===
          0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: {
            color: action.payload,
            image: null,
            flip: false,
          },
        };
        state.pages[state.activePageIndex].layout[state.activeSide] =
          newPayload;
      }
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.color = action.payload;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.image = undefined;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.gradient = undefined;
      markPageEdited(state, state.activePageIndex);
    },
    setGradientBackground(state, action) {
      if (state.activeSide === -1) {
        return;
      }
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        !state.pages[state.activePageIndex].layout[state.activeSide].length ===
          0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: {
            color: null,
            image: null,
            flip: false,
            gradient: action.payload,
          },
        };
        state.pages[state.activePageIndex].layout[state.activeSide] =
          newPayload;
      }
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.gradient = action.payload;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.color = undefined;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.image = undefined;
      markPageEdited(state, state.activePageIndex);
    },
    setFlipBackground(state, action) {
      if (state.activeSide === -1) {
        return;
      }
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        !state.pages[state.activePageIndex].layout[state.activeSide].length ===
          0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
        };
        state.pages[state.activePageIndex].layout[state.activeSide] =
          newPayload;
      }
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.flip = action.payload;
      markPageEdited(state, state.activePageIndex);
    },
    setBackgroundImage(state, action) {
      if (state.activeSide === -1) {
        return;
      }
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        !state.pages[state.activePageIndex].layout[state.activeSide].length ===
          0
      ) {
        const newPayload = {
          id: uuidv4(),
          objects: [],
          safeAreaObjects: [],
          safeArea: [],
          background: {
            color: null,
            image: null,
            flip: false,
          },
        };
        state.pages[state.activePageIndex].layout[state.activeSide] =
          newPayload;
      }
      let backgroundPayload = action.payload;
      let url = backgroundPayload.urls.find(
        (backgroundPayload) => backgroundPayload.size === "large",
      ).url;

      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.image = url;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.bg_id = backgroundPayload._id;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.color = undefined;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.gradient = undefined;
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background.isSpread = false;
      markPageEdited(state, state.activePageIndex);
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ].background._t = new Date().getTime();
    },
    setBackgroundColorSpread(state, action) {
      if (state.activeSide === -1) return;
      const page = state.pages[state.activePageIndex];
      ensureFullCoverLayout1(state, page);
      page.layout.forEach((layout) => {
        if (!layout) return;
        if (!layout.background) layout.background = { color: null, image: null, flip: false };
        layout.background.color = action.payload;
        layout.background.image = undefined;
        layout.background.gradient = undefined;
        layout.background.isSpread = false; // solid color — no spread rendering needed
      });
      markPageEdited(state, state.activePageIndex);
    },
    setGradientBackgroundSpread(state, action) {
      if (state.activeSide === -1) return;
      const page = state.pages[state.activePageIndex];
      ensureFullCoverLayout1(state, page);
      page.layout.forEach((layout) => {
        if (!layout) return;
        if (!layout.background) layout.background = { color: null, image: null, flip: false };
        layout.background.gradient = action.payload;
        layout.background.color = undefined;
        layout.background.image = undefined;
        layout.background.isSpread = false; // gradients render the same on both sides
      });
      markPageEdited(state, state.activePageIndex);
    },
    setFlipBackgroundSpread(state, action) {
      if (state.activeSide === -1) return;
      const page = state.pages[state.activePageIndex];
      ensureFullCoverLayout1(state, page);
      page.layout.forEach((layout) => {
        if (!layout) return;
        if (!layout.background) layout.background = { flip: false };
        layout.background.flip = action.payload;
      });
      markPageEdited(state, state.activePageIndex);
    },
    setBackgroundImageSpread(state, action) {
      if (state.activeSide === -1) return;
      const page = state.pages[state.activePageIndex];
      ensureFullCoverLayout1(state, page);
      const backgroundPayload = action.payload;
      const url = backgroundPayload.urls.find((u) => u.size === "large").url;
      page.layout.forEach((layout) => {
        if (!layout) return;
        if (!layout.background) layout.background = { color: null, image: null, flip: false };
        layout.background.image = url;
        layout.background.bg_id = backgroundPayload._id;
        layout.background.color = undefined;
        layout.background.gradient = undefined;
        layout.background.isSpread = true; // signals canvas to render as one continuous image
        layout.background._t = new Date().getTime();
      });
      markPageEdited(state, state.activePageIndex);
    },
    applyTheme(state, action) {
      const normalizedPages = action.payload.map((page) => ({
        ...page,
        isPageEdited:
          typeof page.isPageEdited === "boolean" ? page.isPageEdited : false,
      }));

      state.pages = normalizedPages;

      // Keep the active page index in range. A freshly-applied theme/size variant
      // can have FEWER pages than the previously-active index (size variants may
      // differ in page count), which would otherwise strand `activePageIndex` past
      // the end of the new `pages` — the next selection resolve (setActiveObject)
      // then dereferences `pages[activePageIndex].layout` on `undefined` and throws.
      if (
        !Number.isInteger(state.activePageIndex) ||
        state.activePageIndex >= state.pages.length
      ) {
        state.activePageIndex = 0;
      }

      // ── Auto-sync cover settings for LAYFLATALBUM ────────────────────────
      // If the saved pages contain cover pages (isCoverPage: true) but
      // settings.coverEnabled is false (e.g. backend didn't persist it),
      // we derive the correct cover state from the page data so the
      // "Enable Cover Page" toggle reflects reality after reload.
      if (state.editorType === EDITOR_TYPES.LAYFLATALBUM) {
        const hasCoverPages = normalizedPages.some((p) => p.isCoverPage === true);
        if (hasCoverPages && !state.settings.coverEnabled) {
          state.settings = { ...state.settings, coverEnabled: true };
          // Detect full-cover-sheet vs split covers (half-sheet)
          const isFullCoverSheet = normalizedPages.some(
            (p) => p.isCoverPage === true && p.settings?.isHalfSheet !== true
          );
          if (isFullCoverSheet && !state.settings.showFullCoverSheet) {
            state.settings = { ...state.settings, showFullCoverSheet: true };
          }
        }
      }

      // Populate gradient history from existing shape objects
      const gradientHistory = [];
      state.pages.forEach((page) => {
        page?.layout?.forEach((layout) => {
          // Check objects
          layout?.objects?.forEach((obj) => {
            if (
              obj.type === "shape" &&
              obj.gradient &&
              obj.gradient.stops &&
              obj.gradient.stops.length >= 2
            ) {
              const sortedStops = [...obj.gradient.stops].sort(
                (a, b) => a.position - b.position,
              );
              const stopsStr = sortedStops
                .map((s) => `${s.color.slice(0, 7)} ${s.position}%`)
                .join(", ");
              const cssStr =
                obj.gradient.type === "radial" ?
                  `radial-gradient(circle at ${
                    obj.gradient.radialPosition?.x ?? 50
                  }% ${obj.gradient.radialPosition?.y ?? 50}%, ${stopsStr})`
                : `linear-gradient(${
                    obj.gradient.angle ?? 90
                  }deg, ${stopsStr})`;

              // Check if this gradient is already in history
              const isDuplicate = gradientHistory.some(
                (item) => item.css === cssStr,
              );
              if (!isDuplicate) {
                gradientHistory.push({
                  id: Date.now() + Math.random(),
                  stops: obj.gradient.stops,
                  type: obj.gradient.type || "linear",
                  angle: obj.gradient.angle ?? 90,
                  radialPosition: obj.gradient.radialPosition,
                  css: cssStr,
                });
              }
            }
          });

          // Check safe area objects
          layout?.safeAreaObjects?.forEach((obj) => {
            if (
              obj.type === "shape" &&
              obj.gradient &&
              obj.gradient.stops &&
              obj.gradient.stops.length >= 2
            ) {
              const sortedStops = [...obj.gradient.stops].sort(
                (a, b) => a.position - b.position,
              );
              const stopsStr = sortedStops
                .map((s) => `${s.color.slice(0, 7)} ${s.position}%`)
                .join(", ");
              const cssStr =
                obj.gradient.type === "radial" ?
                  `radial-gradient(circle at ${
                    obj.gradient.radialPosition?.x ?? 50
                  }% ${obj.gradient.radialPosition?.y ?? 50}%, ${stopsStr})`
                : `linear-gradient(${
                    obj.gradient.angle ?? 90
                  }deg, ${stopsStr})`;

              // Check if this gradient is already in history
              const isDuplicate = gradientHistory.some(
                (item) => item.css === cssStr,
              );
              if (!isDuplicate) {
                gradientHistory.push({
                  id: Date.now() + Math.random(),
                  stops: obj.gradient.stops,
                  type: obj.gradient.type || "linear",
                  angle: obj.gradient.angle ?? 90,
                  radialPosition: obj.gradient.radialPosition,
                  css: cssStr,
                });
              }
            }
          });
        });
      });

      state.shapeGradientHistory = gradientHistory;

      // Populate solid color history from existing shape objects
      const solidColorHistory = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          // Check objects
          layout?.objects?.forEach((obj) => {
            if (obj.type === "shape" && obj.fill && !obj.gradient) {
              // Check if this solid color is already in history
              const isDuplicate = solidColorHistory.some(
                (item) => item.color === obj.fill,
              );
              if (!isDuplicate) {
                solidColorHistory.push({
                  id: Date.now() + Math.random(),
                  color: obj.fill,
                  rgba: obj.fill,
                });
              }
            }
          });

          // Check safe area objects
          layout?.safeAreaObjects?.forEach((obj) => {
            if (obj.type === "shape" && obj.fill && !obj.gradient) {
              // Check if this solid color is already in history
              const isDuplicate = solidColorHistory.some(
                (item) => item.color === obj.fill,
              );
              if (!isDuplicate) {
                solidColorHistory.push({
                  id: Date.now() + Math.random(),
                  color: obj.fill,
                  rgba: obj.fill,
                });
              }
            }
          });
        });
      });

      state.shapeSolidColorHistory = solidColorHistory;

      // Populate background image history from existing page layouts
      // Collect backgrounds with their timestamps for proper ordering
      const backgroundHistory = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const bg = layout?.background;
          if (bg && bg.image && bg.bg_id) {
            const isDuplicate = backgroundHistory.some(
              (item) => item.assetId === bg.bg_id,
            );

            if (!isDuplicate) {
              backgroundHistory.push({
                id: Date.now() + Math.random(),
                assetId: bg.bg_id,
                url: bg.image,
                thumbnailUrl: bg.image, // Fallback since theme doesn't store thumbnail
                name: null,
                _t: bg._t || 0, // Track timestamp for sorting
              });
            }
          }
        });
      });

      // Sort by timestamp (most recent first) - items without _t go to end
      backgroundHistory.sort((a, b) => (b._t || 0) - (a._t || 0));
      state.backgroundImageHistory = backgroundHistory;

      // Populate sticker history from existing sticker objects in pages
      const stickerHistoryItems = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const collectStickers = (objects) => {
            objects?.forEach((obj) => {
              if (obj.type === "sticker" && obj.sticker_id && obj.url) {
                const isDuplicate = stickerHistoryItems.some(
                  (item) => item.assetId === obj.sticker_id,
                );
                if (!isDuplicate) {
                  stickerHistoryItems.push({
                    id: Date.now() + Math.random(),
                    assetId: obj.sticker_id,
                    url: obj.url,
                    thumbnailUrl:
                      obj.urls?.find((u) => u.size === "thumbnail")?.url ||
                      obj.url,
                    name: obj.name || null,
                    width: obj.image?.width || 100,
                    height: obj.image?.height || 100,
                    _t: obj._t || 0, // Track timestamp for sorting
                  });
                }
              }
            });
          };
          collectStickers(layout?.objects);
          collectStickers(layout?.safeAreaObjects);
        });
      });
      // Sort by timestamp (most recent first)
      stickerHistoryItems.sort((a, b) => (b._t || 0) - (a._t || 0));
      state.stickerHistory = stickerHistoryItems;

      // Populate mask history from existing masked image objects in pages
      const maskHistoryItems = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const collectMasks = (objects) => {
            objects?.forEach((obj) => {
              if (
                obj.type === "img" &&
                obj.masking &&
                obj.masking.mask_id &&
                obj.masking.path
              ) {
                const isDuplicate = maskHistoryItems.some(
                  (item) => item.assetId === obj.masking.mask_id,
                );
                if (!isDuplicate) {
                  maskHistoryItems.push({
                    id: Date.now() + Math.random(),
                    assetId: obj.masking.mask_id,
                    d: obj.masking.path,
                    width: obj.masking.width || 24,
                    height: obj.masking.height || 24,
                    name: null,
                    _t: obj._t || 0, // Track timestamp for sorting
                  });
                }
              }
            });
          };
          collectMasks(layout?.objects);
          collectMasks(layout?.safeAreaObjects);
        });
      });
      // Sort by timestamp (most recent first)
      maskHistoryItems.sort((a, b) => (b._t || 0) - (a._t || 0));
      state.maskHistory = maskHistoryItems;

      // Populate photo history from existing image objects in pages
      const photoHistoryItems = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const collectPhotos = (objects) => {
            objects?.forEach((obj) => {
              if (obj.type === "img" && obj.image_id && obj.url) {
                const isDuplicate = photoHistoryItems.some(
                  (item) => item.assetId === obj.image_id,
                );
                if (!isDuplicate) {
                  const largeUrl = obj.urls?.find((u) => u.size === "large");
                  const smallUrl = obj.urls?.find((u) => u.size === "small");
                  photoHistoryItems.push({
                    id: Date.now() + Math.random(),
                    assetId: obj.image_id,
                    url: largeUrl?.url || obj.url,
                    thumbnailUrl: smallUrl?.url || obj.url,
                    name: null,
                    width: largeUrl?.w || obj.image?.width || 0,
                    height: largeUrl?.h || obj.image?.height || 0,
                    urls: obj.urls || [],
                    _t: obj._t || 0, // Track timestamp for sorting
                  });
                }
              }
            });
          };
          collectPhotos(layout?.objects);
          collectPhotos(layout?.safeAreaObjects);
        });
      });
      // Sort by timestamp (most recent first)
      photoHistoryItems.sort((a, b) => (b._t || 0) - (a._t || 0));
      state.photoHistory = photoHistoryItems;

      // Populate shape history from existing shape objects in pages
      const shapeHistoryItems = [];
      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const collectShapes = (objects) => {
            objects?.forEach((obj) => {
              if (obj.type === "shape" && obj.shape) {
                const isDuplicate = shapeHistoryItems.some(
                  (item) => item.shapeType === obj.shape,
                );
                if (!isDuplicate) {
                  shapeHistoryItems.push({
                    id: Date.now() + Math.random(),
                    shapeType: obj.shape,
                    _t: obj._t || 0, // Track timestamp for sorting
                  });
                }
              }
            });
          };
          collectShapes(layout?.objects);
          collectShapes(layout?.safeAreaObjects);
        });
      });
      // Sort by timestamp (most recent first)
      shapeHistoryItems.sort((a, b) => (b._t || 0) - (a._t || 0));
      state.shapeHistory = shapeHistoryItems;

      // ── Populate globalGradientHistory and globalSolidColorHistory from ALL pages ──
      const buildGradientCss = (gradient) => {
        if (!gradient || !gradient.stops || gradient.stops.length < 2)
          return null;
        const sortedStops = [...gradient.stops].sort(
          (a, b) => a.position - b.position,
        );
        const stopsStr = sortedStops
          .map((s) => `${(s.color || "#000000").slice(0, 7)} ${s.position}%`)
          .join(", ");
        return gradient.type === "radial" ?
            `radial-gradient(circle at ${gradient.radialPosition?.x ?? 50}% ${gradient.radialPosition?.y ?? 50}%, ${stopsStr})`
          : `linear-gradient(${gradient.angle ?? 90}deg, ${stopsStr})`;
      };

      const globalGradients = [];
      const globalSolids = [];

      const addGradient = (gradient) => {
        const css = buildGradientCss(gradient);
        if (!css) return;
        if (!globalGradients.some((g) => g.css === css)) {
          globalGradients.push({
            id: Date.now() + Math.random(),
            stops: gradient.stops,
            type: gradient.type || "linear",
            angle: gradient.angle ?? 90,
            radialPosition: gradient.radialPosition,
            css,
          });
        }
      };

      const addSolid = (color) => {
        if (!color || color === "transparent") return;
        const hex = color.slice(0, 9);
        if (!globalSolids.some((s) => s.color === hex)) {
          globalSolids.push({ id: Date.now() + Math.random(), color: hex });
        }
      };

      action.payload.forEach((page) => {
        page?.layout?.forEach((layout) => {
          // Background gradient / solid color
          const bg = layout?.background;
          if (bg) {
            if (
              bg.gradient &&
              bg.gradient.stops &&
              bg.gradient.stops.length >= 2
            ) {
              addGradient(bg.gradient);
            } else if (bg.color) {
              addSolid(bg.color);
            }
          }

          const collectObjects = (objects) => {
            objects?.forEach((obj) => {
              if (obj.type === "shape") {
                if (
                  obj.gradient &&
                  obj.gradient.stops &&
                  obj.gradient.stops.length >= 2
                ) {
                  addGradient(obj.gradient);
                } else if (obj.fill) {
                  addSolid(obj.fill);
                }
              } else if (obj.type === "text") {
                // Text color gradient / solid
                if (
                  obj.gradient &&
                  obj.gradient.stops &&
                  obj.gradient.stops.length >= 2
                ) {
                  addGradient(obj.gradient);
                } else if (obj.color) {
                  addSolid(obj.color);
                }
                // Text background gradient / solid
                if (
                  obj.bgGradient &&
                  obj.bgGradient.stops &&
                  obj.bgGradient.stops.length >= 2
                ) {
                  addGradient(obj.bgGradient);
                } else if (obj.bgcolor && obj.bgcolor !== "transparent") {
                  addSolid(obj.bgcolor);
                }
              }
            });
          };

          collectObjects(layout?.objects);
          collectObjects(layout?.safeAreaObjects);
        });
      });

      state.globalGradientHistory = globalGradients.slice(-50);
      state.globalSolidColorHistory = globalSolids.slice(-50);
      // ─── Reconstruct textGroups from objects ──────────────────────
      // When a theme is saved, text objects retain their groupKey and
      // contentSegments. Rebuild the textGroups dictionary so the
      // Smart Text dialog and propagation work after load.
      const reconstructedGroups = {};
      state.pages.forEach((page) => {
        page?.layout?.forEach((layout) => {
          const scanArray = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            arr.forEach((obj) => {
              if (obj.type !== "text" || !obj.groupKey) return;
              const gk = obj.groupKey;
              if (reconstructedGroups[gk]) return; // already found

              // Determine the current value for this group
              let value = "";
              if (obj.contentSegments && Array.isArray(obj.contentSegments)) {
                // Partial link: extract the linked segment's value
                const linkedSeg = obj.contentSegments.find(
                  (s) => s.type === "linked" && s.key === gk,
                );
                value = linkedSeg?.value || "";
              } else {
                // Full text link
                value = obj.text || "";
              }

              reconstructedGroups[gk] = {
                label: obj.groupLabel || gk,
                value,
                example: obj.groupExample || "",
              };
              if (obj.maxChars !== undefined) {
                reconstructedGroups[gk].maxChars = obj.maxChars;
              }
            });
          };
          if (!layout) return;
          scanArray(layout.objects);
          scanArray(layout.safeAreaObjects);
        });
      });
      state.textGroups = reconstructedGroups;
    },
    setDragger(state, action) {
      state.isDragger = action.payload;
    },
    setCalendarSettings(state, action) {
      if (action.payload === null) {
        // clear all settings
        state.calendarSettings = {
          ...state.calendarSettings,
          backgroundColor: "",
          alternativeBgColor: "",
          textColor: "",
          headerBgColor: "",
          headerTextColor: "",
          weekendTextColor: "",
          weekendBgColor: "",
          monthBgColor: "",
          monthTextColor: "",
          fontSize: 0,
          fontFamily: "",
          fontWeight: "",
          borderWidth: 0,
          borderColor: "",
          borderRadius: 0,
          cellMargin: 0,
          dayNameFormat: "",
          addCover: false,
          noOfMonthsPerPage: 1,
          weeksColumns: 1,
        };
        return;
      }
      if (action.payload.startMonth) {
        state.calendarSettings.startMonth = action.payload.startMonth;
      }
      if (action.payload.startYear) {
        state.calendarSettings.startYear = action.payload.startYear;
      }
      if (action.payload.backgroundColor) {
        state.calendarSettings.backgroundColor = action.payload.backgroundColor;
      }
      if (action.payload.alternativeBgColor) {
        state.calendarSettings.alternativeBgColor =
          action.payload.alternativeBgColor;
      }
      if (action.payload.textColor) {
        state.calendarSettings.textColor = action.payload.textColor;
      }
      if (action.payload.headerBgColor) {
        state.calendarSettings.headerBgColor = action.payload.headerBgColor;
      }
      if (action.payload.headerTextColor) {
        state.calendarSettings.headerTextColor = action.payload.headerTextColor;
      }
      if (action.payload.weekendTextColor) {
        state.calendarSettings.weekendTextColor =
          action.payload.weekendTextColor;
      }
      if (action.payload.weekendBgColor) {
        state.calendarSettings.weekendBgColor = action.payload.weekendBgColor;
      }
      if (action.payload.fontSize) {
        state.calendarSettings.fontSize = action.payload.fontSize;
      }
      if (action.payload.fontFamily) {
        state.calendarSettings.fontFamily = action.payload.fontFamily;
      }
      if (action.payload.fontWeight) {
        state.calendarSettings.fontWeight = action.payload.fontWeight;
      }
      if (
        action.payload.borderWidth !== undefined &&
        action.payload.borderWidth !== null
      ) {
        state.calendarSettings.borderWidth = action.payload.borderWidth;
      }
      if (action.payload.borderColor) {
        state.calendarSettings.borderColor = action.payload.borderColor;
      }

      if (
        action.payload.borderRadius !== undefined &&
        action.payload.borderRadius !== null
      ) {
        state.calendarSettings.borderRadius = action.payload.borderRadius;
      }
      if (
        action.payload.cellMargin !== undefined &&
        action.payload.cellMargin !== null
      ) {
        state.calendarSettings.cellMargin = action.payload.cellMargin;
      }
      if (
        action.payload.dayNameFormat !== undefined &&
        action.payload.dayNameFormat !== null
      ) {
        state.calendarSettings.dayNameFormat = action.payload.dayNameFormat;
      }
      if (
        action.payload.language !== undefined &&
        action.payload.language !== null
      ) {
        state.calendarSettings.language = action.payload.language;
      }
      if (action.payload.monthBgColor) {
        state.calendarSettings.monthBgColor = action.payload.monthBgColor;
      }
      if (action.payload.monthTextColor) {
        state.calendarSettings.monthTextColor = action.payload.monthTextColor;
      }
      if (
        action.payload.noOfMonthsPerPage !== undefined &&
        action.payload.noOfMonthsPerPage !== null
      ) {
        state.calendarSettings.noOfMonthsPerPage =
          action.payload.noOfMonthsPerPage;
      }
      if (
        action.payload.weeksColumns !== undefined &&
        action.payload.weeksColumns !== null
      ) {
        state.calendarSettings.weeksColumns = action.payload.weeksColumns;
      }
    },
    updateCalendarSettingsInAllPages(state, action) {
      // Update the global calendarSettings
      const patch = action.payload || {};
      Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined) {
          state.calendarSettings[key] = value;
        }
      });
      // Also persist to every calendar object across all pages
      state.pages.forEach((page) => {
        (page.layout || []).forEach((layout) => {
          (layout.objects || []).forEach((obj) => {
            if (obj.type === "calendar" || obj.type === "multiple-calendar") {
              obj.calendarSettings = { ...obj.calendarSettings, ...patch };
            }
            if (obj.type === "text" && (obj.subtype === "month" || obj.subtype === "year")) {
               if (patch.monthTextColor !== undefined) {
                 obj.color = patch.monthTextColor;
               }
               if (patch.fontFamily !== undefined) {
                 obj.font.family = patch.fontFamily;
               }
               if (patch.fontWeight !== undefined) {
                 obj.font.weight = patch.fontWeight;
               }
            }
          });
        });
      });
      // Sync activeObjectprops so the active calendar's UI reflects the change
      if (state.activeObjectprops?.type === "calendar" || state.activeObjectprops?.type === "multiple-calendar") {
        state.activeObjectprops = {
          ...state.activeObjectprops,
          calendarSettings: {
            ...state.activeObjectprops.calendarSettings,
            ...patch,
          },
        };
      }
    },
    setCanvasErrors(state, action) {
      state.canvasErrors = action.payload;
    },
    setPageSettings(state, action) {
      state.pages[state.activePageIndex].settings = {
        ...state.pages[state.activePageIndex].settings,
        ...action.payload,
      };
    },
    addSafeAreaInPage(state, action) {
      // return if there is no activeside or page doesnt have layout
      if (
        state.activeSide === -1 ||
        state.pages[state.activePageIndex].layout.length === 0 ||
        !state.pages[state.activePageIndex].layout[state.activeSide] ||
        state.activeObjectprops?.isProcessing
      ) {
        return;
      }
      let isFoldable = state.settings?.isFoldable;
      let isHalfSheet =
        state.pages[state.activePageIndex].settings?.isHalfSheet;
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea
      ) {
        state.pages[state.activePageIndex].layout[state.activeSide].safeArea =
          [];
      }
      let left = 30;
      if (
        (state.editorType === EDITOR_TYPES.PHOTOBOOK ||
          (isFoldable === true && isHalfSheet !== true)) &&
        state.activeSide === 1
      ) {
        left = state.canvasSize.width / 2 + 30;
      }
      let minWidth = state.canvasSize.width;
      let minHeight = state.canvasSize.height;
      let minSize = Math.min(minWidth, minHeight);
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.push({
        ...action.payload,
        left,
        top: 30,
        height: minSize / 2,
        width: minSize / 2,
        pageIndex: state.activePageIndex,
        layoutIndex: state.activeSide,
      });
    },

    setActiveSafeArea(state, action) {
      const user = localStorage.getItem("userDetails");
      const userData = JSON.parse(user);
      const { areaId, layoutIndex, pageIndex, target } = action.payload;
      // deselect safe area if acurrent safe area is selected

      if (
        state.activeSafeArea?.id === areaId &&
        userData?.userTypeCode !== USER_TYPES.CUSTOMER
      ) {
        state.activeSafeArea = null;
        return;
      }
      state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.forEach((safeArea) => {
        if (safeArea.id === areaId) {
          state.activeSafeArea = {
            ...safeArea,
            target,
          };
        }
      });
    },
    deSelectSafeArea(state) {
      const user = localStorage.getItem("userDetails");
      const userData = JSON.parse(user);

      // always one safe area should be selected for customer if there is safe areas present in active page side
      if (
        userData?.userTypeCode === USER_TYPES.CUSTOMER &&
        state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea
          ?.length > 0
      ) {
        return;
      }
      state.activeSafeArea = null;
    },
    setCurrentSafeAreaProperties(state, action) {
      if (
        !state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea
          ?.length > 0 ||
        !state.activeSafeArea ||
        (state.activeSafeArea?.isLocked && action.payload.isLocked !== false)
      ) {
        return;
      }
      let safeAreaIndex = state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.findIndex(
        (safeArea) => safeArea.id === state.activeSafeArea.id,
      );
      if (safeAreaIndex === -1) {
        return;
      }

      state.pages[state.activePageIndex].layout[state.activeSide].safeArea[
        safeAreaIndex
      ] = {
        ...action.payload,
        target: null,
      };

      state.activeSafeArea = {
        ...state.activeSafeArea,
        ...action.payload,
      };
    },
    removeSafeArea(state) {
      // check user type
      const user = localStorage.getItem("userDetails");
      const userData = JSON.parse(user);

      if (
        userData?.userTypeCode === USER_TYPES.CUSTOMER ||
        state.activeSafeArea?.isLocked ||
        state.activeObject ||
        state.activeObjectprops
      ) {
        return;
      }

      if (
        !state.pages[state.activePageIndex].layout[state.activeSide]?.safeArea
          ?.length > 0 ||
        !state.activeSafeArea
      ) {
        return;
      }
      let safeAreaIndex = state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.findIndex(
        (safeArea) => safeArea.id === state.activeSafeArea.id,
      );
      if (safeAreaIndex === -1) {
        return;
      }

      state.pages[state.activePageIndex].layout[
        state.activeSide
      ]?.safeArea?.splice(safeAreaIndex, 1);
      state.activeSafeArea = null;
    },
    setShowSafeAreaGuidePopup(state, action) {
      state.showSafeAreaGuidePopup = action.payload.value;
    },
    setEditorMenuItems(state, action) {
      state.menuItems = action.payload;
    },
    setCustomFonts(state, action) {
      state.customFonts = action.payload;
    },
    /**
     * Patch font.id and font.styleId on all text objects across all pages.
     * Called after loadDesignFonts resolves legacy fonts (by name) from the API.
     * payload: Array<{ name: string, fontId: string, styles: Array<{ weight, style, styleId }> }>
     */
    patchTextFontIds(state, action) {
      const fontList = action.payload;
      if (!fontList || fontList.length === 0) return;

      // Build a lookup: fontName → { fontId, styles[] }
      const lookup = new Map();
      fontList.forEach((font) => {
        if (font.name) lookup.set(font.name, font);
      });

      state.pages.forEach((page) => {
        if (!page.layout) return;
        page.layout.forEach((layout) => {
          const arrays = [layout.objects, layout.safeAreaObjects].filter(
            Boolean,
          );
          arrays.forEach((arr) => {
            arr.forEach((obj) => {
              if (obj.type !== "text" || !obj.font?.family) return;
              // Skip only if all IDs are already populated
              if (obj.font.id && obj.font.fontId && obj.font.styleId) return;

              const font = lookup.get(obj.font.family);
              if (!font) return;

              // Patch font ID if missing
              if (!obj.font.id) obj.font.id = font.fontId;
              if (!obj.font.fontId) obj.font.fontId = font.fontId;

              // Patch styleId if missing — find matching style based on weight + style
              if (!obj.font.styleId) {
                const weight = parseInt(obj.font.weight, 10) || 400;
                const style = obj.font.style || "normal";
                const matchedStyle =
                  font.styles?.find(
                    (s) => s.weight === weight && s.style === style,
                  ) ||
                  font.styles?.find((s) => s.weight === weight) ||
                  (font.styles?.length > 0 ? font.styles[0] : null);

                if (matchedStyle?.styleId) {
                  obj.font.styleId = matchedStyle.styleId;
                }
              }
            });
          });
        });
      });
    },
    replaceImageWithNewImage(state, action) {
      state.pages.map((page) => {
        page.layout.map((layout) => {
          layout.objects.map((obj) => {
            if (obj.id === action.payload.id) {
              obj.url = action.payload.sizes?.find(
                (url) => url.size == "large",
              )?.url;
              obj.urls = action.payload.sizes;
            }
          });
        });
      });
    },
    setObjectProcessingStatus(state, action) {
      const { id, isProcessing } = action.payload;
      state.pages.map((page, pageIndex) => {
        page.layout.map((layout, layoutIndex) => {
          // Update objects in normal area
          if (layout.objects && Array.isArray(layout.objects)) {
            layout.objects.map((obj, objIndex) => {
              if (obj.id === id) {
                state.pages[pageIndex].layout[layoutIndex].objects[
                  objIndex
                ].isProcessing = isProcessing;
              }
            });
          }
          // Update objects in safe area
          if (layout.safeAreaObjects && Array.isArray(layout.safeAreaObjects)) {
            layout.safeAreaObjects.map((obj, objIndex) => {
              if (obj.id === id) {
                state.pages[pageIndex].layout[layoutIndex].safeAreaObjects[
                  objIndex
                ].isProcessing = isProcessing;
              }
            });
          }
        });
      });
    },
    swapTextPlaceholders(state, action) {
      state.pages.map((page, pageIndex) => {
        page.layout.map((layout, layoutIndex) => {
          // Update objects in normal area
          if (layout.objects && Array.isArray(layout.objects)) {
            layout.objects.map((obj, objIndex) => {
              if (
                obj?.type === "text" &&
                obj?.isTemplateSwapable &&
                obj?.isTemplateSwapable === true
              ) {
                // find action.payload.replace from text
                const name = obj.text.match(
                  new RegExp(action.payload.replace, "g"),
                );
                if (name) {
                  // replace action.payload.replace with action.payload.text
                  const newText = obj.text.replace(
                    new RegExp(action.payload.replace, "g"),
                    action.payload.text,
                  );
                  state.pages[pageIndex].layout[layoutIndex].objects[
                    objIndex
                  ].text = newText;
                }
              }
            });
          }
          // Update objects in safe area
          if (layout.safeAreaObjects && Array.isArray(layout.safeAreaObjects)) {
            layout.safeAreaObjects.map((obj, objIndex) => {
              if (
                obj?.type === "text" &&
                obj?.isTemplateSwapable &&
                obj?.isTemplateSwapable === true
              ) {
                // find #name# from text
                const name = obj.text.match(/#name#/g);
                if (name) {
                  // replace #name# with action.payload.text
                  const newText = obj.text.replace(
                    /#name#/g,
                    action.payload.text,
                  );
                  state.pages[pageIndex].layout[layoutIndex].safeAreaObjects[
                    objIndex
                  ].text = newText;
                }
              }
            });
          }
        });
      });
    },
    recordThemeBaseline(state, action) {
      state.themeBaselineVersion = action.payload?.timestamp || Date.now();
    },
  },
});

const findNearestMaxZIndex = (currentObjZIndex, layouts, areaType) => {
  // Step 1: Flatten zIndex values, including their layout and object indexes
  const flattenedZIndices = layouts.flatMap((layout, layoutIndex) => {
    if (!layout) return [];
    return layout[areaType === "safeArea" ? "safeAreaObjects" : "objects"].map(
      (obj, objIndex) => ({
        zIndex: obj.zIndex,
        layoutIndex,
        objIndex,
      })
    );
  });

  // Step 2: Sort by zIndex in ascending order
  flattenedZIndices.sort((a, b) => a.zIndex - b.zIndex);

  // Step 3: Find the smallest zIndex larger than currentObjZIndex
  const nearestMax = flattenedZIndices.find(
    (item) => item.zIndex > currentObjZIndex,
  );

  // If nearestMax is undefined, return the current object itself
  return nearestMax ? nearestMax : (
      { zIndex: currentObjZIndex, layoutIndex: null, objIndex: null }
    );
};

const findNearestMinZIndex = (currentObjZIndex, layouts, areaType) => {
  // Step 1: Flatten zIndex values, including their layout and object indexes
  const flattenedZIndices = layouts.flatMap((layout, layoutIndex) => {
    if (!layout) return [];
    return layout[areaType === "safeArea" ? "safeAreaObjects" : "objects"].map(
      (obj, objIndex) => ({
        zIndex: obj.zIndex,
        layoutIndex,
        objIndex,
      })
    );
  });

  // Step 2: Sort by zIndex in ascending order
  flattenedZIndices.sort((a, b) => a.zIndex - b.zIndex);

  // Step 3: Find the largest zIndex smaller than currentObjZIndex
  const nearestMin = flattenedZIndices
    .reverse()
    .find((item) => item.zIndex < currentObjZIndex);

  // If nearestMin is undefined, return the current object itself
  return nearestMin ? nearestMin : (
      { zIndex: currentObjZIndex, layoutIndex: null, objIndex: null }
    );
};

// Action creators are generated for each case reducer function
export const {
  setCanvasSize,
  setDepth,
  setEditorType,
  resetEditor,
  setZoom,
  getZoom,
  sendForward,
  sendBackward,
  setCanvasScale,
  addNewPage,
  addNewBlankPage,
  removePage,
  copyPage,
  setPageNumber,
  addObjectInPage,
  changeObjectInPage,
  removeObjectInPage,
  setCurrentObjectProperties,
  updateObjectById,
  setActiveObject,
  setActiveObjects,
  updateMultipleObjects,
  checkpointHistory,
  removeMultipleObjectsInPage,
  setPageLayout,
  setEntireSpreadLayout,
  setPageIdeaLayout,
  setSpreadPageIdeaLayout,
  addObjectInLayout,
  deSelectActiveObject,
  selectAllObjects,
  adjustObjectsForNewCanvasSize,
  setActiveSide,
  setTransform,
  setBackgroundColor,
  setGradientBackground,
  setFlipBackground,
  setBackgroundImage,
  setBackgroundColorSpread,
  setGradientBackgroundSpread,
  setFlipBackgroundSpread,
  setBackgroundImageSpread,
  setMinPages,
  setMaxPages,
  setDragger,
  changePageOrder,
  applyTheme,
  changeObjectsInAllPages,
  replaceImageSourceAcrossPages,
  copyObject,
  pasteObject,
  setCalendarSettings,
  updateCalendarSettingsInAllPages,
  setSettings,
  replaceSettings,
  setCanvasErrors,
  createPrintPages,
  setPageSettings,
  addSafeAreaInPage,
  setActiveSafeArea,
  setCurrentSafeAreaProperties,
  deSelectSafeArea,
  removeSafeArea,
  setShowSafeAreaGuidePopup,
  setEditorMenuItems,
  replaceImageWithNewImage,
  setObjectProcessingStatus,
  swapTextPlaceholders,
  addShapeGradientToHistory,
  addShapeSolidColorToHistory,
  addTextGradientToHistory,
  addTextSolidColorToHistory,
  addBackgroundSolidColorToHistory,
  addBorderSolidColorToHistory,
  addShadowSolidColorToHistory,
  addToGlobalGradientHistory,
  addToGlobalSolidColorHistory,
  setCustomFonts,
  patchTextFontIds,
  setTextGroupValue,
  setTextGroupExample,
  setTextGroupMaxChar,
  linkTextToGroup,
  unlinkTextFromGroup,
  removeTextGroup,
  setTextGroups,
  addBackgroundImageToHistory,
  addStickerToHistory,
  addMaskToHistory,
  addPhotoToHistory,
  removePhotoFromHistory,
  addShapeToHistory,
  recordThemeBaseline,
} = canvasSlice.actions;
// Wrap the reducer with undoable to handle undo/redo
// export default undoable(canvasSlice.reducer, {
//   filter: includeAction([setZoom.type, addNewPage.type, removePage.type]), // Track only relevant actions
// });
export default canvasSlice.reducer;
//export default undoable(canvasSlice.reducer);
