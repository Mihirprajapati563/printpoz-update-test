import { createSlice } from "@reduxjs/toolkit";

// Ruler visibility is a pure VIEW preference (like the unit preference in
// unitConversion.js) — it must NOT live in canvas.present.settings, since that
// is serialized into saved project/theme JSON. Persist it in localStorage so
// the user's choice survives reloads.
const RULER_PREF_KEY = "editorShowRuler";
const RULER_UNIT_KEY = "editorRulerUnit"; // ruler's OWN unit, independent of the print-unit pref
const RULER_ORIGIN_KEY = "editorRulerOrigin"; // where 0 sits: center (spine) / start / end. NB: the LEFT ruler ignores "center" (treats it as start) — no vertical spine.
const VALID_RULER_UNITS = ["px", "in", "cm", "mm"];
const VALID_RULER_ORIGINS = ["center", "start", "end"];
const readShowRuler = () => {
  try {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(RULER_PREF_KEY) === "true";
    }
  } catch (e) { /* localStorage unavailable */ }
  return false;
};
const readRulerUnit = () => {
  try {
    if (typeof window !== "undefined") {
      const u = window.localStorage.getItem(RULER_UNIT_KEY);
      if (u && VALID_RULER_UNITS.includes(u)) return u;
    }
  } catch (e) { /* localStorage unavailable */ }
  return "px";
};
const readRulerOrigin = () => {
  try {
    if (typeof window !== "undefined") {
      const o = window.localStorage.getItem(RULER_ORIGIN_KEY);
      if (o && VALID_RULER_ORIGINS.includes(o)) return o;
    }
  } catch (e) { /* localStorage unavailable */ }
  return "center";
};

const initialState = {
  showRuler: readShowRuler(),
  rulerUnit: readRulerUnit(),
  rulerOrigin: readRulerOrigin(),
  activeActionIndex: 0,
  isActionActive: false,
  isUploadAcvtive: false,
  isDisplayPreview: window.innerWidth > 768 ? true : false,
  textCaptions: [],
  showMagicWrite: false,
  magicWriteMode: "create",
  showMagicMenu: false,
  isMultiSelectMode: false,
  textToolbarDialog: null, // 'font' | 'position' | 'alignment' | 'colors' | 'spacing' | null
  imageToolbarDialog: null, // 'position' | 'border' | 'shadow' | 'adjustments' | 'effects' | null
  multiImageToolbarDialog: null, // 'border' | 'shadow' | 'adjustments' | 'effects' | 'opacity' | null
  stickerToolbarDialog: null, // 'position' | 'border' | 'shadow' | 'adjustments' | null
  shapeToolbarDialog: null, // 'position' | 'border' | 'shadow' | null
  qrcodeToolbarDialog: null, // 'position' | null
  smartTextSelection: null,
  // "page" | "spread" — drives Layouts tab + footer shuffle target AND the
  // image "Set as Background" scope. Kept in app state (not canvas) since it's
  // pure UI mode and shouldn't be part of canvas undo history.
  layoutMode: "page",
  // Session flag: the current theme was opened with blanked images (Design
  // Selection size modal → `blank_img=1`). When true, any later in-editor size
  // change (Manage Size popup) must KEEP images blank instead of restoring the
  // theme's original sample photos. Pure view/session state — never serialized
  // into saved project/theme JSON (same rationale as layoutMode / showRuler).
  themeImagesBlanked: false,
  orderPrice: null,
  lastAssetsUpdate: {
    background: 0,
    clipart: 0,
    mask: 0,
  },
};

export const appSlice = createSlice({
  name: "appSlice",
  initialState,
  reducers: {
    setIsActionActive: (state, action) => {
      state.isActionActive = action.payload;
    },
    setIsUploadAcvtive: (state, action) => {
      state.isUploadAcvtive = action.payload;
    },
    setIsDisplayPreview: (state, action) => {
      state.isDisplayPreview = action.payload;
    },
    setTextCaptions: (state, action) => {
      state.textCaptions = action.payload;
    },
    setActiveActionIndex: (state, action) => {
      state.activeActionIndex = action.payload;
    },
    openMagicWrite: (state, action) => {
      state.showMagicWrite = true;
      state.magicWriteMode = action.payload || "create";
    },
    closeMagicWrite: (state) => {
      state.showMagicWrite = false;
      state.magicWriteMode = "create"; 
    },
    setShowMagicWrite: (state, action) => {
      state.showMagicWrite = action.payload;
      if (action.payload === true) {
        state.magicWriteMode = "create";
      }
    },
    setShowMagicMenu: (state, action) => {
      state.showMagicMenu = action.payload;
    },
    setIsMultiSelectMode: (state, action) => {
      state.isMultiSelectMode = action.payload;
    },
    setTextToolbarDialog: (state, action) => {
      state.textToolbarDialog = action.payload;
    },
    setImageToolbarDialog: (state, action) => {
      state.imageToolbarDialog = action.payload;
    },
    setMultiImageToolbarDialog: (state, action) => {
      state.multiImageToolbarDialog = action.payload;
    },
    setStickerToolbarDialog: (state, action) => {
      state.stickerToolbarDialog = action.payload;
    },
    setShapeToolbarDialog: (state, action) => {
      state.shapeToolbarDialog = action.payload;
    },
    setQrcodeToolbarDialog: (state, action) => {
      state.qrcodeToolbarDialog = action.payload;
    },
    setSmartTextSelection: (state, action) => {
      state.smartTextSelection = action.payload;
    },
    setLayoutMode: (state, action) => {
      // Coerce to one of the two valid values to avoid bad payloads.
      state.layoutMode = action.payload === "spread" ? "spread" : "page";
    },
    setThemeImagesBlanked: (state, action) => {
      state.themeImagesBlanked = action.payload === true;
    },
    setOrderPrice: (state, action) => {
      state.orderPrice = action.payload;
    },
    refreshAssets: (state, action) => {
      const type = action.payload; // "background" | "clipart" | "mask"
      if (type && state.lastAssetsUpdate[type] !== undefined) {
        state.lastAssetsUpdate[type] = Date.now();
      }
    },
    setShowRuler: (state, action) => {
      const next = action.payload === true;
      state.showRuler = next;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RULER_PREF_KEY, next ? "true" : "false");
        }
      } catch (e) { /* localStorage unavailable */ }
    },
    setRulerUnit: (state, action) => {
      const next = VALID_RULER_UNITS.includes(action.payload) ? action.payload : "px";
      state.rulerUnit = next;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RULER_UNIT_KEY, next);
        }
      } catch (e) { /* localStorage unavailable */ }
    },
    setRulerOrigin: (state, action) => {
      const next = VALID_RULER_ORIGINS.includes(action.payload) ? action.payload : "center";
      state.rulerOrigin = next;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RULER_ORIGIN_KEY, next);
        }
      } catch (e) { /* localStorage unavailable */ }
    },
  },
});

export const {
  setIsActionActive,
  setIsUploadAcvtive,
  setIsDisplayPreview,
  setTextCaptions,
  setActiveActionIndex,
  openMagicWrite,
  closeMagicWrite,
  setShowMagicWrite,
  setShowMagicMenu,
  setIsMultiSelectMode,
  setTextToolbarDialog,
  setImageToolbarDialog,
  setMultiImageToolbarDialog,
  setStickerToolbarDialog,
  setShapeToolbarDialog,
  setQrcodeToolbarDialog,
  setSmartTextSelection,
  setLayoutMode,
  setThemeImagesBlanked,
  setOrderPrice,
  refreshAssets,
  setShowRuler,
  setRulerUnit,
  setRulerOrigin,
} = appSlice.actions;

export default appSlice.reducer;
