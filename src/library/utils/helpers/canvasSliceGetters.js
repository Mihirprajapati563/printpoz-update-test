// import constants of editor types
import { createSelector } from "@reduxjs/toolkit";
import { EDITOR_TYPES } from "../constants";
import { v4 as uuidv4 } from "uuid";
//export const getZoom = state => state.canvas.present.pages[state.canvas.present.activePageIndex].zoomRatio;
export const getZoom = (state) => state.canvas.present.zoomRatio;
export const getCanvasScale = (state) => state.canvas.present.canvasScale;

export const getCurrentActiveSize = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.canvasSize;
    // return state.canvas.present.pages[state.canvas.present.activePageIndex].size;
  }
};

export const getMinPages = (state) => {
  //  min page 1 is only for editortype print otherwise 5
  if (state.canvas.present.editorType === EDITOR_TYPES.PRINT) {
    return 1;
  } else {
    return state.canvas.present.minPages;
  }
};
export const getMaxPages = (state) => {
  return state.canvas.present.maxPages;
};
export const getTotalPages = (state) => {
  return state.canvas.present.pages.length;
};

export const getActiveEditorType = (state) => {
  return state.canvas.present.editorType;
};
export const getCurrentActivePage = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.pages[state.canvas.present.activePageIndex];
  }
};
export const getCurrentPageIndex = (state) => {
  return state.canvas.present.activePageIndex;
};
// export const getAllPages = (state) => {
//   return state.canvas.present.pages;
// };
const selectCanvas = (state) => state.canvas.present;
export const getAllPages = createSelector(
  [selectCanvas, (_, forPreviewLayoutFlat = false) => forPreviewLayoutFlat],
  (canvas, forPreviewLayoutFlat) => {
    let pages = [...canvas.pages];
    if (
      forPreviewLayoutFlat === true &&
      (!pages[0]?.isCoverPage || !pages[pages.length - 1]?.isCoverPage) &&
      canvas.editorType === EDITOR_TYPES.LAYFLATALBUM
    ) {
      pages = [
        {
          id: "virtual_front_cover_layflat",
          pageNumber: 0,
          title: 0,
          bgColor: "#fff",
          layout: [
            {
              "id": "virtual_front_cover_layflat_layout",
              "name": "Layout_1",
              "width": "3200",
              "height": "1600",
              "background": {
                "color": "#4a90e2ff",
                "opacity": 1
              },
              "objects": [],
              "safeAreaObjects": [],
              "safeArea": []
            }
          ],
          isCoverPage: true,
          settings: { isHalfSheet: true },
        },
        ...pages,
        {
          id: "virtual_back_cover_layflat",
          pageNumber: pages.length + 1,
          title: pages.length + 1,
          bgColor: "#fff",
          layout: [
            {
              "id": "virtual_back_cover_layflat_layout",
              "name": "Layout_1",
              "width": "3200",
              "height": "1600",
              "background": {
                "color": "#4a90e2ff",
                "opacity": 1
              },
              "objects": [],
              "safeAreaObjects": [],
              "safeArea": []
            }
          ],
          isCoverPage: true,
          settings: { isHalfSheet: true },
        },
      ];
    }

    return pages;
  }
);

export const getAllPagesLength = (state) => {
  return state.canvas.present.pages.length;
};

export const getDragger = (state) => {
  return state.canvas.present.isDragger;
};
export const getCurrentActivePageObjects = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.pages[state.canvas.present.activePageIndex]
      .layout[state.canvas.present.activeSide]?.objects;
  }
};
export const getCurrentActivePageSide = (state) => {
  return state.canvas.present.activeSide;
};
export const getIsSpreadPage = (state) => {
  const pages = state.canvas.present.pages;
  const idx = state.canvas.present.activePageIndex;
  if (!pages || !pages[idx]) return false;

  // Direct evidence: data already has two non-null layouts (post-merge or
  // post-content). Skip the structural checks below.
  if (pages[idx].layout.filter(Boolean).length > 1) return true;

  const { editorType, settings } = state.canvas.present;
  const currentPageSettings = pages[idx]?.settings;
  const totalPages = pages.length;

  // Photobook full cover page 0 is a spread even before its layout[1] is loaded.
  if (
    editorType === EDITOR_TYPES.PHOTOBOOK &&
    settings?.showFullCoverSheet &&
    idx === 0
  ) {
    return true;
  }

  // Photobook interior spread (positions 2..totalPages-3 — skip the front
  // cover, inside front blank, inside back blank, and back cover). Eligible by
  // structure even if no content has been added yet.
  if (
    editorType === EDITOR_TYPES.PHOTOBOOK &&
    idx !== 0 &&
    idx !== 1 &&
    idx !== totalPages - 1 &&
    idx !== totalPages - 2
  ) {
    return true;
  }

  // Foldable (e.g. layflat) full-sheet interior pages render as a spread —
  // half-sheet (cover) pages remain single-side.
  if (
    settings?.isFoldable === true &&
    currentPageSettings?.isHalfSheet !== true
  ) {
    return true;
  }

  return false;
};
export const getActivePageBgColor = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.pages[state.canvas.present.activePageIndex]
      .layout[state.canvas.present.activeSide]?.background?.color;
  }
  return "#ffffff";
};

export const getActivePageBgImage = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.pages[state.canvas.present.activePageIndex]
      .layout[state.canvas.present.activeSide]?.background?.image;
  }
  return null;
};

export const getActivePageBgGradient = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    return state.canvas.present.pages[state.canvas.present.activePageIndex]
      .layout[state.canvas.present.activeSide]?.background?.gradient;
  }
  return null;
};

export const getActivePageBackgroundFlip = (state) => {
  if (state.canvas.present.pages[state.canvas.present.activePageIndex]) {
    const flip = state.canvas.present.pages[state.canvas.present.activePageIndex]
      .layout[state.canvas.present.activeSide]?.background?.flip;
    if (flip === undefined) {
      return false;
    }
    return flip;
  }
  return false;
};

export const getActiveObject = (state) => {
  return state.canvas.present.activeObject;
};
export const getActiveObjectprops = (state) => {
  return state.canvas.present.activeObjectprops;
};
// Returns the full multi-select array: [{ id, areaType }]
// Length > 1 means the editor is in multi-select mode.
export const getActiveObjects = (state) => {
  return state.canvas.present.activeObjects ?? [];
};

export const getCanvasSize = (state) => {
  return state.canvas.present.canvasSize;
};
export const getSettings = (state) => {
  return state.canvas.present.settings;
};
export const getOrientation = (state) => {
  return state.canvas.present.orientation;
};
export const getCalendarSettings = (state) => {
  // return null if activeEditorType is not calendar
  if (state.canvas.present.editorType !== "calendar") return null;
  return state.canvas.present.calendarSettings;
};

const selectPages = (state) => state.canvas.present.pages;
const selectActivePageIndex = (state) => state.canvas.present.activePageIndex;

// PERFORMANCE: the canvas object list adds layoutIndex/objIndex to each object.
// A fresh `{...obj}` on every recompute gives every item a NEW reference, which
// defeats the React.memo on Photo/Text/Shape/Sticker — so all N objects re-render
// on every drag/zoom frame (the main-canvas lag). With Immer, an UNCHANGED object
// keeps its identity across dispatches (only the edited object gets a new ref), so
// we cache the wrapped item per underlying object and reuse it when neither the
// object nor its indices changed. Result: only the object that actually changed
// gets a new reference → only it re-renders. (WeakMap → entries GC with the object.)
const wrappedObjectCache = new WeakMap(); // obj -> { wrapped, layoutIndex, objIndex }
function wrapObjectStable(obj, layoutIndex, objIndex) {
  const cached = wrappedObjectCache.get(obj);
  if (cached && cached.layoutIndex === layoutIndex && cached.objIndex === objIndex) {
    return cached.wrapped;
  }
  const wrapped = { ...obj, layoutIndex, objIndex };
  wrappedObjectCache.set(obj, { wrapped, layoutIndex, objIndex });
  return wrapped;
}

export const getAllObjectsSortedByZIndex = createSelector(
  [selectPages, selectActivePageIndex],
  (pages, activePageIndex) => {
    // Step 1: Flatten all objects from layouts into an array (stable identities)
    if (!pages[activePageIndex]) return [];
    const allObjects = pages[activePageIndex].layout.flatMap((layout, layoutIndex) =>
      layout
        ? layout.objects.map((obj, objIndex) =>
            wrapObjectStable(obj, layoutIndex, objIndex)
          )
        : []
    );

    // Step 2: Sort objects by zIndex in ascending order as svg renders objects with higher zIndex on top
    allObjects.sort((a, b) => a.zIndex - b.zIndex);
    // Step 3: Return the sorted array
    return allObjects;
  }
);

export const getAllObjectsSortedByZIndexByPageNumber = (state, pageIndex) => {
  // Step 1: Flatten all objects from layouts into an array
  if (!state.canvas.present.pages[pageIndex]) return [];

  const allObjects = state.canvas.present.pages[pageIndex].layout.flatMap(
    (layout, layoutIndex) =>
      layout ? layout.objects.map((obj, objIndex) => ({
        ...obj, // Spread the object properties (like id and zIndex)
        layoutIndex, // Include layoutIndex for reference
        objIndex, // Include objIndex for reference
      })) : []
  );
  // Step 2: Sort objects by zIndex in ascending order as svg renders objects with higher zIndex on top
  allObjects.sort((a, b) => a.zIndex - b.zIndex);
  // Step 3: Return the sorted array
  return allObjects;
};

export const getAllObjectsSortedByZIndexByPageIndex = (page) => {
  // Step 1: Flatten all objects from layouts into an array
  if (!page) return [];

  const allObjects = page.layout.flatMap((layout, layoutIndex) =>
    layout ? layout.objects.map((obj, objIndex) => ({
      ...obj, // Spread the object properties (like id and zIndex)
      layoutIndex, // Include layoutIndex for reference
      objIndex, // Include objIndex for reference
    })) : []
  );
  // Step 2: Sort objects by zIndex in ascending order as svg renders objects with higher zIndex on top
  allObjects.sort((a, b) => a.zIndex - b.zIndex);
  // Step 3: Return the sorted array
  return allObjects;
};

//This Function get me the objects as per the layout inside the page
//Example :Page 1(Sheet 1) inside it layout 1 (Page 1)
export const getAllObjectsSortedByZIndexByPageLayoutNumber = (
  state,
  pageIndex,
  layoutIndex
) => {
  // Step 1: Check if the page and layout exist
  const page = state.canvas.present.pages[pageIndex];
  if (!page || !page.layout[layoutIndex]) return [];

  // Step 2: Get all objects from the specified layout
  const allObjects = page.layout[layoutIndex].objects.map((obj, objIndex) => ({
    ...obj, // Spread the object properties (like id and zIndex)
    layoutIndex, // Include layoutIndex for reference
    objIndex, // Include objIndex for reference
  }));

  // Step 3: Sort objects by zIndex in ascending order
  allObjects.sort((a, b) => a.zIndex - b.zIndex);

  // Step 4: Return the sorted array of objects
  return allObjects;
};

//get editor errors

export const getEditorErrors = createSelector(
  [(state) => state.canvas.present.pages],
  (pages) => {
    const errors = [];
    // will add page wise errors if image is blank or text has value "Enter Text" or "Enter Title" or "Enter Subtitle" or "Enter Description" or "Sample Text"
    pages.forEach((page, pIndex) => {
      page?.layout?.forEach((layout, lIndex) => {
        //make sure layout is not null
        if (layout === null) {
          return;
        }
        // find from normal objects
        layout.objects.forEach((obj, oIndex) => {
          const objErrors = {};
          if (obj.type === "img") {
            if (obj.url === "") {
              objErrors.type = "img";
              objErrors.pageIndex = pIndex;
              objErrors.layoutIndex = lIndex;
              objErrors.objectIndex = oIndex;
              errors.push({
                message: "Image boxe is empty. Please fill it",
                pageIndex: pIndex,
                title: "Empty image box",
                type: "image",
                objectId: obj.id,
                layoutIndex: lIndex,
                objectIndex: oIndex,
              });
            }
          }
          if (obj.type === "text") {
            if (
              obj.text === "Enter Text" ||
              obj.text === "Enter Title" ||
              obj.text === "Enter Subtitle" ||
              obj.text === "Enter Description" ||
              obj.text === "Sample Text"
            ) {
              objErrors.type = "text";
              objErrors.pageIndex = pIndex;
              objErrors.layoutIndex = lIndex;
              objErrors.objectIndex = oIndex;
              errors.push({
                message: "Initial text  haven't been changed.Please change them",
                pageIndex: pIndex,
                title: "Initial Text",
                type: "text",
                objectId: obj.id,
                layoutIndex: lIndex,
                objectIndex: oIndex,
              });
            }
          }
        });

        // find from safe area objects
        layout?.safeAreaObjects &&
          layout?.safeAreaObjects?.forEach((obj, oIndex) => {
            const objErrors = {};
            if (obj.type === "img") {
              if (obj.url === "") {
                objErrors.type = "img";
                objErrors.pageIndex = pIndex;
                objErrors.layoutIndex = lIndex;
                objErrors.objectIndex = oIndex;
                errors.push({
                  message: "Image boxe is empty. Please fill it",
                  pageIndex: pIndex,
                  title: "Empty image box",
                  type: "image",
                  objectId: obj.id,
                  layoutIndex: lIndex,
                  objectIndex: oIndex,
                });
              }
            }
            if (obj.type === "text") {
              if (
                obj.text === "Enter Text" ||
                obj.text === "Enter Title" ||
                obj.text === "Enter Subtitle" ||
                obj.text === "Enter Description" ||
                obj.text === "Sample Text"
              ) {
                objErrors.type = "text";
                objErrors.pageIndex = pIndex;
                objErrors.layoutIndex = lIndex;
                objErrors.objectIndex = oIndex;
                errors.push({
                  message:
                    "Initial text  haven't been changed.Please change them",
                  pageIndex: pIndex,
                  title: "Initial Text",
                  type: "text",
                  objectId: obj.id,
                  layoutIndex: lIndex,
                  objectIndex: oIndex,
                });
              }
            }
          });
      });
    });

    return errors;
  }
);

// get billable pages
export const getBillablePages = (state) => {
  var billablePages = 0;
  if (
    state.canvas.present.pages &&
    state.canvas.present.pages.length > 0 &&
    state.canvas.present.pages !== undefined &&
    state.canvas.present.pages !== null &&
    state.canvas.present.editorType &&
    state.canvas.present.editorType !== undefined &&
    state.canvas.present.editorType !== null
  ) {
    if (state.canvas.present.editorType === EDITOR_TYPES.PHOTOBOOK) {
      billablePages = (state.canvas.present.pages.length - 3) * 2;
    } else if (
      state.canvas.present.editorType === EDITOR_TYPES.LAYFLATALBUM &&
      state.canvas.present?.settings?.coverEnabled === true &&
      !state.canvas.present?.settings?.showFullCoverSheet
    ) {
      billablePages = (state.canvas.present.pages.length - 2) * 2;
    } else if (
      state.canvas.present.editorType === EDITOR_TYPES.LAYFLATALBUM &&
      state.canvas.present?.settings?.coverEnabled === true &&
      state.canvas.present?.settings?.showFullCoverSheet
    ) {
      billablePages = (state.canvas.present.pages.length - 1) * 2;
    } else if (
      state.canvas.present.editorType === EDITOR_TYPES.LAYFLATALBUM &&
      !state.canvas.present?.settings?.coverEnabled
    ) {
      billablePages = state.canvas.present.pages.length * 2;
    } else {
      billablePages = state.canvas.present.pages.length;
    }
  }
  return billablePages;
};

// get page settings
export const getPageSettings = (state) => {
  const page = state.canvas.present.pages[state.canvas.present.activePageIndex];
  return page?.settings;
};

// get all page all layouts safe areas
export const getSafeAreas = createSelector(
  [selectPages, selectActivePageIndex],
  (pages, activePageIndex) => {
    let safeAreas = [];
    pages[activePageIndex]?.layout?.forEach((lay) => {
      if (lay?.safeArea && Array.isArray(lay.safeArea)) {
        safeAreas.push(...lay.safeArea);
      }
    });
    return safeAreas;
  }
);

// get active safe area
export const getActiveSafeArea = (state) => {
  return state.canvas.present.activeSafeArea;
};

// get all safe area objects of current active page
export const getAllSafeAreaObjects = createSelector(
  [selectPages, selectActivePageIndex],
  (pages, activePageIndex) => {
    // Step 1: Flatten all objects from layouts into an array
    if (!pages[activePageIndex])
      return [];
    const allObjects = pages[
      activePageIndex
    ].layout.flatMap((layout, layoutIndex) =>
      layout && Array.isArray(layout.safeAreaObjects)
        ? layout.safeAreaObjects.map((obj, objIndex) => ({
          ...obj,
          layoutIndex,
          objIndex,
        }))
        : []
    );

    // Step 2: Sort objects by zIndex in ascending order as svg renders objects with higher zIndex on top
    allObjects.sort((a, b) => a.zIndex - b.zIndex);
    // Step 3: Return the sorted array
    return allObjects;
  }
);

// get sorted all safe area objects by zindex from page
export const getAllSafeAreaObjectsSortedByZIndexByPageIndex = (page) => {
  if (!page) return [];
  let allObjects = [];

  page.layout.forEach((layout, layoutIndex) => {
    if (layout && layout.safeAreaObjects && Array.isArray(layout.safeAreaObjects)) {
      layout.safeAreaObjects.forEach((obj, objIndex) => {
        allObjects.push({
          ...obj,
          layoutIndex,
          objIndex,
        });
      });
    }
  });

  allObjects.sort((a, b) => a.zIndex - b.zIndex);
  return allObjects;
};

// get all safe area from page
export const getSafeAreaFromPage = (page) => {
  let safeAreas = [];
  if (!page) return [];
  page.layout.forEach((layout) => {
    if (layout && layout.safeArea && Array.isArray(layout.safeArea)) {
      safeAreas.push(...layout.safeArea);
    }
  });
  return safeAreas;
};

// get safe area guide popup status
export const getSafeAreaGuideStatus = (state) => {
  return state.canvas.present.showSafeAreaGuidePopup;
};

// get total safe area count
export const getTotalSafeAreaCount = (state) => {
  let totalSafeAreaCount = 0;
  state.canvas.present.pages.forEach((page) => {
    page?.layout?.forEach((layout) => {
      if (layout?.safeArea && Array.isArray(layout.safeArea)) {
        totalSafeAreaCount += layout.safeArea.length;
      }
    });
  });
  return totalSafeAreaCount;
};

// get editor menu items
export const getEditorMenuItems = (state) => {
  return state.canvas.present.menuItems;
};

// // get custom fonts
// export const getCustomFonts = (state) => {
//   return state.canvas.present.customFonts || [];
// };

const getPages = (state) => state.canvas.present.pages;

// get all
export const getAllObjects = createSelector([getPages], (pages) => {
  const allObjects = [];
  pages.forEach((page) => {
    page?.layout?.forEach((layout) => {
      if (layout?.objects && Array.isArray(layout.objects)) {
        allObjects.push(...layout.objects);
      }
      if (layout?.safeAreaObjects && Array.isArray(layout?.safeAreaObjects)) {
        allObjects.push(...layout.safeAreaObjects);
      }
    });
  });
  return allObjects;
});

// getAllPagesSettings
export const getAllPagesSettings = createSelector(
  [(state) => state.canvas.present.pages],
  (pages) => pages.map((page) => page?.settings)
);

// get all objects of all layouts of currenct page
export const getAllObjectsOfAllLayoutsOfCurrentPage = createSelector(
  [(state) => state.canvas.present.pages[state.canvas.present.activePageIndex]?.layout],
  (layouts) => {
    const allObjects = [];
    layouts?.forEach((layout) => {
      if (layout?.objects && Array.isArray(layout.objects)) {
        allObjects.push(...layout.objects);
      }
      if (layout?.safeAreaObjects && Array.isArray(layout?.safeAreaObjects)) {
        allObjects.push(...layout.safeAreaObjects);
      }
    });
    return allObjects;
  }
);

// find status of any object is processing from all objects
export const findAnyObjectIsProcessing = (state) => {
  let anyObjectInProgress = false;
  state.canvas.present.pages.forEach((page) => {
    page?.layout?.forEach((lay) => {
      if (lay?.objects && Array.isArray(lay.objects)) {
        lay.objects.forEach((obj) => {
          if (obj?.isProcessing === true) {
            anyObjectInProgress = true;
          }
        });
      }
      if (lay?.safeAreaObjects && Array.isArray(lay?.safeAreaObjects)) {
        lay.safeAreaObjects.forEach((obj) => {
          if (obj?.isProcessing === true) {
            anyObjectInProgress = true;
          }
        });
      }
    });
  });
  return anyObjectInProgress;
};

// get text groups (linked/replaceable text)
export const getTextGroups = (state) => {
  return state.canvas.present.textGroups || {};
};

// get shape gradient history
export const getShapeGradientHistory = (state) => {
  return state.canvas.present.shapeGradientHistory || [];
};
export const getShapeSolidColorHistory = (state) => {
  return state.canvas.present.shapeSolidColorHistory || [];
};

export const getTextGradientHistory = (state) => {
  return state.canvas.present.textGradientHistory || [];
};

export const getTextSolidColorHistory = (state) => {
  return state.canvas.present.textSolidColorHistory || [];
};

export const getBackgroundSolidColorHistory = (state) => {
  return state.canvas.present.backgroundSolidColorHistory || [];
};

export const getBorderSolidColorHistory = (state) => {
  return state.canvas.present.borderSolidColorHistory || [];
};

export const getShadowSolidColorHistory = (state) => {
  return state.canvas.present.shadowSolidColorHistory || [];
};

export const getGlobalGradientHistory = (state) => {
  return state.canvas.present.globalGradientHistory || [];
};

export const getGlobalSolidColorHistory = (state) => {
  return state.canvas.present.globalSolidColorHistory || [];
};

const selectCanvasSize = (state) => state.canvas.present.canvasSize;
const selectActiveSide = (state) => state.canvas.present.activeSide;
const selectEditorType = (state) => state.canvas.present.editorType;
const selectSettings = (state) => state.canvas.present.settings;

export const getActiveSideBounds = createSelector(
  [
    selectCanvasSize,
    selectActiveSide,
    selectEditorType,
    selectSettings,
    selectActivePageIndex,
    selectPages,
  ],
  (canvasSize, activeSide, editorType, settings, activePageIndex, pages) => {

  if (!canvasSize || !pages || !pages[activePageIndex]) {
    return {
      size: { width: 0, height: 0 },
      offset: { x: 0, y: 0 },
    };
  }

  const currentPageSettings = pages[activePageIndex]?.settings;
  const isFoldable = settings?.isFoldable || false;
  const isHalfSheet = currentPageSettings?.isHalfSheet || false;

  // Determine if this is a multi-side layout
  const isMultiSideLayout =
    editorType === EDITOR_TYPES.PHOTOBOOK ||
    (isFoldable === true && isHalfSheet !== true);

  if (isMultiSideLayout) {
    const sideWidth = canvasSize.width / 2;
    const offsetX = activeSide === 1 ? sideWidth : 0;

    return {
      size: {
        width: sideWidth,
        height: canvasSize.height,
      },
      offset: {
        x: offsetX,
        y: 0,
      },
    };
  }

  // Cover pages (half-sheet) in Layflat Album should use half canvas width
  // so that Align to Page respects per-page dimensions
  if (isHalfSheet === true && isFoldable === true) {
    return {
      size: {
        width: canvasSize.width / 2,
        height: canvasSize.height,
      },
      offset: {
        x: 0,
        y: 0,
      },
    };
  }

  return {
    size: {
      width: canvasSize.width,
      height: canvasSize.height,
    },
    offset: {
      x: 0,
      y: 0,
    },
  };
});
