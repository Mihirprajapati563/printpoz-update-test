import { configureStore } from "@reduxjs/toolkit";
import canvasReducer, { patchPendingImageObjects } from "./slices/canvas";
import appReducer from "./slices/appAlice";
import imageUploadReducer from "./slices/imageUpload";
import projectSetup from "./slices/projectSetup";
import svgDataReducer from "./slices/svgData";
import brandReducer from "./slices/brandDetails";
import aiKidsPhotobookReducer from "./slices/aiKidsPhotobookSlice";
import editorConfigurations from "./slices/editorConfigurations";
import undoable from "redux-undo";

// Custom filter function to check if the action should be recorded in history

const historyFilter = (action) => {
  // Only record canvas actions to avoid bloating history with mouse coordinates or unrelated events
  // Explicitly ignore spammy UI actions that shouldn't clog up the undo stack
  const ignoredCanvasActions = [
    "canvas/setEditorMenuItems",
    "canvas/setZoom",
    // "canvas/setActiveObject",
    "canvas/applyTheme",
    "canvas/setCanvasSize",
    "canvas/setEditorType",
    "canvas/setSettings",
    "canvas/setCalendarSettings",
    "canvas/setDragger",
    "canvas/createPrintPages",
    "canvas/deSelectSafeArea",
    // "canvas/setPageNumber",
    "canvas/setTextGroups",
    "canvas/setCurrentSafeAreaProperties",
    "canvas/setActiveSide",
    "canvas/setStartExport",
    "canvas/setSvgData",
    "canvas/setAllPagesCaptured",
    "canvas/setIsCapturingPages",
    "canvas/setCaptureProgress",
    "canvas/setCurrentPageSVG",
    "canvas/setFirstPageSVG",
    "canvas/setShowSafeAreaGuidePopup",
    "canvas/setMinPages",
    "canvas/setMaxPages",
    "canvas/patchTextFontIds",
    // Optimistic-placement swap: silent url replacement when an upload
    // finishes — must never create an undo step (history snapshots are
    // patched separately in customUndoableCanvasReducer below)
    "canvas/replaceImageSourceAcrossPages",
  ];

  if (
    ignoredCanvasActions.includes(action.type) ||
    !action.type.startsWith("canvas/")
  ) {
    return false;
  }

  // Ignore selection-clearing dispatches so Ctrl+Z doesn't wipe initial theme
  if (
    action.type === "canvas/setCurrentObjectProperties" &&
    action.payload === null
  ) {
    return false;
  }
  const isRecorded = action.payload?.history !== false;
  return isRecorded;
};

const undoableCanvasReducer = undoable(canvasReducer, {
  limit: 300, // Set the maximum number of undo steps to 300
  filter: historyFilter,
});

// Custom wrapper to preserve UI states when time-traveling (prevents page jumps and zooming)
const customUndoableCanvasReducer = (state, action) => {
  // Restore a persisted FULL undo/redo stack (desktop offline resume). Installs
  // the captured redux-undo state verbatim, bypassing the undoable reducer, so
  // the entire { past, present, future } is rehydrated in one shot. Guarded to a
  // well-formed payload; anything malformed leaves state untouched.
  if (action.type === "canvas/restoreHistory") {
    const restored = action.payload;
    if (
      restored &&
      typeof restored === "object" &&
      restored.present &&
      Array.isArray(restored.past) &&
      Array.isArray(restored.future)
    ) {
      return {
        ...restored,
        limit: typeof restored.limit === "number" ? restored.limit : 300,
        index:
          typeof restored.index === "number" ? restored.index : restored.past.length,
        _latestUnfiltered: restored._latestUnfiltered || restored.present,
      };
    }
    return state; // malformed payload — do not corrupt the live stack
  }

  const isUndoRedo = action.type === "@@redux-undo/UNDO" || action.type === "@@redux-undo/REDO";

  // Capture UI state before undo/redo
  let preservedUIState = {};
  if (isUndoRedo && state?.present) {
    preservedUIState = {
      activeObject: state.present.activeObject,
      activeObjectprops: state.present.activeObjectprops,
      // activePage: state.present.activePage, // Not used in the UI
      // activePageIndex: state.present.activePageIndex, // Not used in the UI
      activeSide: state.present.activeSide,
      zoomRatio: state.present.zoomRatio,
      isDragger: state.present.isDragger,
      canvasScale: state.present.canvasScale,
      showSafeAreaGuidePopup: state.present.showSafeAreaGuidePopup,
    };
  }

  // Run the actual undoable reducer
  const newState = undoableCanvasReducer(state, action);

  // Re-inject preserved UI state into the restored present so only Document history changes
  if (isUndoRedo && newState?.present) {
    newState.present = {
      ...newState.present,
      ...preservedUIState,
    };
  }

  // Optimistic-placement swap: the slice reducer patched `present`, but undo
  // snapshots taken between placement and upload completion still reference
  // the local blob: URL. Without this, any later Ctrl+Z (even for an
  // unrelated edit) would silently resurrect the blob version and the swap
  // would never re-fire. Patch every snapshot with the same pure helper —
  // snapshots are frozen (immer autoFreeze in dev), so the helper rebuilds
  // only the changed paths and shares the rest.
  if (
    action.type === "canvas/replaceImageSourceAcrossPages" &&
    newState?.past
  ) {
    // redux-undo shares structure: consecutive snapshots that didn't touch
    // `pages` reuse the SAME pages array reference. Memoize the patch by that
    // reference so the (page × layout × object) walk runs once per distinct
    // pages array instead of once per snapshot — across 300 snapshots that is
    // the difference between O(snapshots) and O(distinct-edits) work per swap.
    const pagesCache = new Map();
    const patchSnapshot = (snapshot) => {
      if (!snapshot?.pages) return snapshot;
      let result = pagesCache.get(snapshot.pages);
      if (!result) {
        result = patchPendingImageObjects(snapshot.pages, action.payload);
        pagesCache.set(snapshot.pages, result);
      }
      return result.changed ? { ...snapshot, pages: result.pages } : snapshot;
    };
    let pastChanged = false;
    const nextPast = newState.past.map((snap) => {
      const patched = patchSnapshot(snap);
      if (patched !== snap) pastChanged = true;
      return patched;
    });
    let futureChanged = false;
    const nextFuture = (newState.future || []).map((snap) => {
      const patched = patchSnapshot(snap);
      if (patched !== snap) futureChanged = true;
      return patched;
    });
    // CRITICAL: redux-undo keeps `_latestUnfiltered` = the present as of the
    // last RECORDED action. Our swap is a FILTERED action, so redux-undo
    // updates `present` but does NOT touch `_latestUnfiltered` — it still
    // holds the pre-swap blob version. The NEXT recorded edit pushes that
    // stale blob snapshot into `past` (redux-undo's `insert` always pushes
    // `_latestUnfiltered`), so a later Ctrl+Z resurrects the blurry preview
    // and the loaded server image then replaces it ("blurry, then swaps").
    // Patch it here too so history can never carry the blob.
    const nextLatest = patchSnapshot(newState._latestUnfiltered);
    const latestChanged = nextLatest !== newState._latestUnfiltered;
    if (pastChanged || futureChanged || latestChanged) {
      return {
        ...newState,
        past: pastChanged ? nextPast : newState.past,
        future: futureChanged ? nextFuture : newState.future,
        _latestUnfiltered: nextLatest,
      };
    }
  }

  return newState;
};

export const store = configureStore({
  reducer: {
    canvas: customUndoableCanvasReducer,
    appSlice: appReducer,
    imageUpload: imageUploadReducer,
    projectSetup: projectSetup,
    svgData: svgDataReducer,
    brandDetails: brandReducer,
    aiKidsPhotobook: aiKidsPhotobookReducer,
    editorConfigurations: editorConfigurations,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      // Dev-only deep scan of the ENTIRE store (including up to 300
      // redux-undo canvas snapshots) on EVERY dispatch. During bulk
      // image uploads (many dispatches/second) it froze the dev build
      // and made dev performance unrepresentative of production.
      immutableCheck: false,
    }),
});

