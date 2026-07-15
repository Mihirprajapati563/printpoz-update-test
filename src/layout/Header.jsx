import {
  Box,
  BrandLogo,
  BrandTitle,
  DisplayBetween,
  DisplayStart,
  HeaderWrapper,
  LightPrimaryButton,
  PrimaryButton,
  theme,
} from "../common-components/StyledComponents.jsx";
import {
  RxArrowBottomRight,
  RxArrowLeft,
  RxArrowTopRight,
  RxArrowUp,
  RxDoubleArrowUp,
  RxEyeOpen,
  RxGear,
} from "react-icons/rx";
import { BsCart3 } from "react-icons/bs";
import { TiExport } from "react-icons/ti";
import { useSelector, useDispatch, useStore } from "react-redux";
import {
  getZoom,
  getCurrentActivePage,
  getCurrentActiveSize,
  getAllPages,
  getActiveEditorType,
  getActive,
  getCurrentPageIndex,
  getOrientation,
  getCalendarSettings,
  getSettings,
  getEditorErrors,
  getBillablePages,
  getActiveObjectprops,
  getEditorMenuItems,
  findAnyObjectIsProcessing,
  getTextGroups,
  getAllObjectsSortedByZIndexByPageIndex,
  getSafeAreaFromPage,
} from "../library/utils/helpers/index.js";
import { blankImageUrls, collectPlacedImages } from "../library/utils/helpers/blankImages.js";
import { apiPost } from "../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../library/utils/constants/apiurl.js";
import usePendingPlacedImages, {
  getPendingPlacedImageCounts,
  getRetryableFailedPlacedImages,
} from "../library/utils/custom-hooks/usePendingPlacedImages.js";
import { retryUpload } from "../store/slices/imageUpload.js";
import { uploadImage, reconcilePlacedUploads } from "../store/background-services/imageUploadThunks.js";
import { TbCropLandscapeFilled, TbCropPortraitFilled } from "react-icons/tb";
import { FaSquare, FaArrowLeft } from "react-icons/fa";
import {
  EDITOR_ASSETS,
  EDITOR_TYPES,
  USER_TYPES,
  ORIENTATION,
} from "../library/utils/constants/index.js";
import {
  compressData,
  calculateNewFontSize,
  generatePageSvg,
} from "../library/utils/common-functions/index.js";
import { PhotobookPreview } from "../products-preview/photobook/photoBookPreview.jsx";
import { CanvasPrint3D } from "../products-preview/canvas-print/CanvasPrint3D.jsx";
import { AcralicPrint3D } from "../products-preview/acrylic-print/AcrylicPrint3D.jsx";
import { Container, Row, Col, Form, Spinner, Modal } from "react-bootstrap"; // Import Bootstrap components
import { Calendar3D } from "../products-preview/calendar/Calendar3D.jsx";
import WallPreview from "../products-preview/WallPreview.jsx";
import { EditorSettings } from "../components/popups/EditorSettingsPopup.jsx";
import { SizeSettingsPopup } from "../components/popups/SizeSettingsPopup.jsx";
import ExportOptionsPopup from "../components/popups/ExportOptionsPopup.jsx";
import {
  setActiveIndex,
  setExportAsZip,
  setExportFormat,
  setExportPageType,
  setInitilized,
  setIsCapturingPages,
  setAllPagesCaptured,
  setSvgData,
} from "../store/slices/svgData.js";
import { getEditorConfiguration } from "../store/slices/editorConfigurations.js";
import React, { useState, useEffect, useCallback, act } from "react";

import { BiDotsVerticalRounded, BiSave } from "react-icons/bi";
import { ReactComponent as Undo } from "../assets/icons/undo.svg";
import { ReactComponent as Redo } from "../assets/icons/redo.svg";
import { ActionCreators as UndoActionCreators } from "redux-undo";

// import { MdCropPortrait } from "react-icons/md";
import { DropdownButton, ButtonGroup, Dropdown } from "react-bootstrap"; // Import Dropdown components

import {
  setCurrentObjectProperties,
  setActiveObject,
  applyTheme,
  setCalendarSettings,
  setCanvasSize,
  setCanvasErrors,
  setPageNumber,
  changeObjectsInAllPages,
} from "../store/slices/canvas.js";
import {
  setEditorPages,
  setThemeId,
  setAllThemes,
  setThemeName,
} from "../store/slices/projectSetup.js";
import {
  processProjectPages,
  GetThemeById,
} from "../library/utils/services/theme/index.js";

import { EDITOR_SUB_TYPES } from "../library/utils/constants/index.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import NoticeConfirmationPopup from "../components/popups/NoticeConfirmationPopup.jsx";
import ConfirmationDialog from "../components/popups/ConfirmationDialog.jsx";
import CreateThemeDialog from "../components/popups/CreateThemeDialog.jsx";
import { saveCurrentEditorToLibrary } from "../library/utils/helpers/saveEditorToLibrary.js";
import { toast } from "react-toastify";
import {
  localAssetsEnabled,
  findMissingPlacedOriginals,
} from "../library/utils/upload/localAssetStore.js";
import {
  setActiveActionIndex,
  setIsActionActive,
  setOrderPrice,
} from "../store/slices/appAlice.js";
import { useRef } from "react";
import { FoldingLayoutPreview } from "../products-preview/folding/FoldingLayoutPreview.jsx";
import { useFontContext } from "../library/utils/context/FontContext.jsx";

export const Header = () => {
  // loop thourgh layout and update widht and height of each layout using canvasSize.width and canvasSize.height
  const { patchFontIdsOnPages } = useFontContext();
  const [user, setUser] = useState(null);
  const canvasSize = useSelector(getCurrentActiveSize);
  const layouts = useSelector(getCurrentActivePage);
  const pages = useSelector(getAllPages);
  const activeEditorType = useSelector(getActiveEditorType);
  const zoomRatio = useSelector(getZoom);
  const { brand_logo, brandname, redirect_url, editor_favicon_icon } =
    useSelector((state) => state.brandDetails);
  const currentPageIndex = useSelector(getCurrentPageIndex);
  const activeOrientation = useSelector(getOrientation);
  const [show, setShow] = useState(false);
  const [showEditorSettngs, setShowEditorSettngs] = useState(false);
  const [showSizeSettings, setShowSizeSettings] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showPdfExport, setShowPdfExport] = useState(false); // For customer PDF export when is_downloadable is true
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false); // Loading state for customer PDF download
  const activeObjectProps = useSelector(getActiveObjectprops);
  const projectSetup = useSelector((state) => state.projectSetup);
  const configuration = useSelector(getEditorConfiguration);
  const storeId = useSelector((state) => state.editorConfigurations.store_id);
  const themeDetails = useSelector((state) => state.projectSetup.themeDetails);
  const allThemes = useSelector((state) => state.projectSetup.allThemes);
  const currentPageSVG = useSelector((state) => state.svgData.currentPageSVG);
  const firstPageSVG = useSelector((state) => state.svgData.firstPageSVG);
  const svgDataContent = useSelector((state) => state.svgData.svgContent);
  const allPagesCaptured = useSelector((state) => state.svgData.allPagesCaptured);
  const isCapturingPages = useSelector((state) => state.svgData.isCapturingPages);
  const calendarSetings = useSelector(getCalendarSettings);
  const settings = useSelector(getSettings);
  const dispatch = useDispatch();
  const store = useStore();
  const isAnyObjetInProcessing = useSelector(findAnyObjectIsProcessing);
  const canUndo = useSelector((state) => state.canvas.past.length > 0);
  const canRedo = useSelector((state) => state.canvas.future.length > 0);
  const [displaySize, setDisplaySize] = useState({
    width: 0,
    height: 0,
    depth: 0,
  }); // depth used in canvas size

  const handleUndo = useCallback(() => {
    if (canUndo) dispatch(UndoActionCreators.undo());
  }, [canUndo, dispatch]);

  const handleRedo = useCallback(() => {
    if (canRedo) dispatch(UndoActionCreators.redo());
  }, [canRedo, dispatch]);
  const canvasError = useSelector(getEditorErrors);
  const [showNotice, setShowNotice] = useState(false);
  const [uneditedPages, setUneditedPages] = useState([]); // list of unedited page numbers
  const [isSaving, setIsSaving] = useState(false); // flag to check if saving is in progress
  const [isOrdering, setIsOrdering] = useState(false); // flag to check if ordering is in progress
  const orderPrice = useSelector((state) => state.appSlice.orderPrice); // calculated order price for customer
  // True when the theme was opened with blanked images (Design Selection size modal).
  // Orientation changes re-source pages from the theme's originals, so blank them too.
  const themeImagesBlanked = useSelector((state) => state.appSlice.themeImagesBlanked);
  const billablePages = useSelector(getBillablePages); // get billable pages
  const isExporting = useSelector((state) => state.svgData.startExport);
  const menuItems = useSelector(getEditorMenuItems);
  const textGroups = useSelector(getTextGroups);

  // Key to control whether to show unedited pages dialog or just send edited pages directly
  // Set to true to skip the dialog and send only edited pages SVG array
  const SKIP_UNEDITED_PAGES_DIALOG = false;

  // Confirmation dialog state
  const [showSaveThemeDialog, setShowSaveThemeDialog] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isUpdatingThemeWithSvg, setIsUpdatingThemeWithSvg] = useState(false);
  const [saveAsNewThemeFlag, setSaveAsNewThemeFlag] = useState(false);
  const [themeNameInput, setThemeNameInput] = useState("");

  // Check if theme is already saved
  const isThemeSaved = !!(themeDetails && themeDetails.theme_id);

  // State for Create Theme Dialog
  const [showCreateThemeDialog, setShowCreateThemeDialog] = useState(false);
  const [isNewThemeDialog, setIsNewThemeDialog] = useState(false); // true when opening from "Create New Theme" menu

  // In-app replacement for window.prompt() (unsupported in the Electron renderer).
  // `namePrompt` holds the open dialog's config + the promise resolver; null when closed.
  const [namePrompt, setNamePrompt] = useState(null); // { message, value, resolve }
  const promptForName = (message, defaultValue = "") =>
    new Promise((resolve) => {
      setNamePrompt({ message, value: defaultValue, resolve });
    });
  const closeNamePrompt = (result) => {
    setNamePrompt((current) => {
      if (current) current.resolve(result);
      return null;
    });
  };

  // Navigation hook for URL updates without reload
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const u_id = searchParams.get("u_id");
  const c_id = searchParams.get("c_id");
  const isAdminViewingAsCustomer = !!u_id && !!c_id;

  const isAdminOrEmployee = user && (
    user?.userTypeCode === USER_TYPES.SUPERUSER ||
    user?.userTypeCode === USER_TYPES.ADMIN ||
    user?.userTypeCode === USER_TYPES.EMPLOYEE
  );

  const isCustomer = user && user?.userTypeCode === USER_TYPES.CUSTOMER;

  const showAdminOptions = isAdminOrEmployee && !c_id;
  const showCustomerOptions = isCustomer || !!c_id;
  const showExportOption = showAdminOptions || isAdminViewingAsCustomer || isCustomer;

  // User hydration
  useEffect(() => {
    const users = localStorage.getItem("userDetails");
    setUser(users ? JSON.parse(users) : null);
  }, []);

  // Watch for DOM capture completion and resolve pending promise
  useEffect(() => {
    if (allPagesCaptured && window._captureResolve) {
      clearInterval(window._captureCheckInterval);
      window._captureResolve();
      window._captureResolve = null;
      window._captureCheckInterval = null;
    }
  }, [allPagesCaptured]);

  // Turn off PDF download loading state when export completes
  // Only trigger when isExporting transitions from true to false while isDownloadingPdf is true
  const prevIsExportingRef = useRef(false);
  useEffect(() => {
    const prevIsExporting = prevIsExportingRef.current;
    prevIsExportingRef.current = isExporting;

    // Only turn off loading if:
    // 1. isDownloadingPdf is true (we started a PDF download)
    // 2. isExporting changed from true to false (export just completed)
    if (isDownloadingPdf && prevIsExporting && !isExporting) {
      // Export has completed, turn off loading
      setIsDownloadingPdf(false);
    }
  }, [isExporting, isDownloadingPdf]);

  // Theme dialog logic
  useEffect(() => {
    if (!projectSetup.isInitialized) return;

    const hasThemeId =
      projectSetup?.themeDetails?.theme_id ||
      projectSetup?.cartDetails?.theme_id;

    // Check URL parameters to see if we expect a theme to be loaded
    const urlHasThemeId = searchParams.get("t_id");
    const urlHasCartId = searchParams.get("cart_order_id");
    const isNew = searchParams.get("new") === "1";

    if (isNew && !hasThemeId) {
      setShowCreateThemeDialog(true);
    } else if (!hasThemeId && !urlHasThemeId && !urlHasCartId) {
      // setShowCreateThemeDialog(true);
    } else {
      setShowCreateThemeDialog(false);
    }
  }, [
    projectSetup.isInitialized,
    projectSetup?.themeDetails?.theme_id,
    projectSetup?.cartDetails?.theme_id,
    searchParams,
  ]);

  const handleClose = () => setShow(false);

  // While any product preview is open, show "Preview" as the window/document
  // title for EVERY editor type (previously the editor's own document.title —
  // e.g. the brand/"Advanced Photo Editor" text — stayed visible in the window
  // title bar). Restore the prior title when the preview closes.
  useEffect(() => {
    if (!show) return undefined;
    const previousTitle = document.title;
    document.title = "Preview";
    return () => {
      document.title = previousTitle;
    };
  }, [show]);

  const handleSettingClose = () => {
    setShowEditorSettngs(false);
    setShowSizeSettings(false);
  };

  const handleCreateThemeClose = () => {
    setShowCreateThemeDialog(false);
    setIsNewThemeDialog(false);
  };

  // Open Create New Theme dialog (from menu)
  const openNewThemeDialog = () => {
    if (activeObjectProps?.isProcessing) return;
    // Deselect any active object before opening dialog
    dispatch(setActiveObject(null));
    dispatch(setCurrentObjectProperties(null));
    setIsNewThemeDialog(true);
    setShowCreateThemeDialog(true);
  };

  // Back to the Theme/Design Selection page. Carries the session token so the
  // design page can resolve the user, and forwards the `cat` (category) param so
  // the user returns to the same theme-browse view they came from instead of the
  // top-level category grid.
  const handleBackToDesign = () => {
    let token = u_id;
    if (!token) {
      try {
        token = JSON.parse(localStorage.getItem("userDetails") || "null")?.token || null;
      } catch (_) {
        token = null;
      }
    }
    const cat = searchParams.get("cat");
    const params = new URLSearchParams();
    if (token) params.set("u_id", token);
    if (cat) params.set("cat", cat);
    const qs = params.toString();
    navigate(`/design${qs ? `?${qs}` : ""}`);
  };

  // Handle navigation after theme creation (updates URL without reload)
  const handleThemeCreated = (newThemeId) => {
    if (newThemeId) {
      // Add the new theme id to the URL, PRESERVING the existing query params
      // (u_id, cat, …). Read them from the router's `searchParams` — NOT
      // window.location.search: on desktop the app uses HashRouter, so the query
      // lives in the hash and window.location.search is empty. Rebuilding from it
      // dropped u_id, which hid the editor's Back button (gated on `u_id && !c_id`)
      // right after creating a theme from the "Set Up Your Design" modal.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("t_id", newThemeId);
      // The theme now has a server id, so it is no longer a brand-new/blank
      // intent. Drop `new` (and any stray `restore`) so that on a later reload
      // RootGate takes the deep-link branch — matches this theme's durable local
      // snapshot on `t_id` and resumes with `restore=1`, restoring the user's
      // "Update Theme" edits. Left in place, `new=1` short-circuits RootGate to a
      // blank editor and `useThemeSetup` re-fetches the pristine server theme,
      // discarding every local change made since creation.
      nextParams.delete("new");
      nextParams.delete("restore");
      navigate(`/?${nextParams.toString()}`);
    }
  };

  const exportLayout = (asset_type) => {
    const updatedLayouts = layouts.layout.map((layout) => {
      // Filter out objects that are img or text
      const filteredObjects = layout.objects.filter(
        (obj) => obj.type === "img" || obj.type === "text"
      );
      const imgObjectsCount = filteredObjects.filter(
        (obj) => obj.type === "img"
      ).length;

      return {
        ...layout,
        width:
          activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
            (settings?.isFoldable && settings?.isFoldable === true)
            ? canvasSize.width / 2
            : canvasSize.width,
        height: canvasSize.height,
        objects:
          asset_type === EDITOR_ASSETS.LAYOUT ?
            filteredObjects
            : layout.objects,
        totalImgObjects:
          asset_type === EDITOR_ASSETS.LAYOUT ?
            imgObjectsCount
            : layout.totalImgObjects,
      };
    });
    const totalImgObjectsCount = updatedLayouts.reduce(
      (acc, layout) => acc + layout.totalImgObjects,
      0
    );

    saveLayout(updatedLayouts, totalImgObjectsCount, asset_type);
  };

  const saveLayout = async (layouts, totalImgObjectsCount, asset_type) => {
    // lets ask for name of the layout. window.prompt() is unsupported in the
    // Electron renderer, so use an in-app modal that works on web + desktop.
    const layoutName = await promptForName(
      "Please enter the name. this help to review and approve",
      "Name"
    );
    if (layoutName == null || layoutName == "") {
      alert("Name must be filled out");
      return false;
    }

    const layoutJsonString = JSON.stringify({ layout: layouts });
    const compressedBase64 = compressData(layoutJsonString);

    // if its photobook than check its cover page  or inner page, so we can calculate number of layouts to pass. if cover than 1 else 2
    let numberOfLayouts = layouts.length;
    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
      (currentPageIndex === 0 || currentPageIndex === 1)
    ) {
      numberOfLayouts = 1;
    }
    if (numberOfLayouts < 1) {
      alert("No layout found to save");
      return;
    }

    const data = {
      status: 1, // under review
      layout_c: compressedBase64,
      layout: layoutJsonString,
      display_in_web: true,
      number_of_layouts: numberOfLayouts,
      spread: numberOfLayouts === 1 ? false : true,
      number_of_images: totalImgObjectsCount,
      asset_type: asset_type,
      editor_type: activeEditorType,
      brand_id: "",
      name: layoutName,
    };

    // Include canvas page preview as idea image when available
    if (asset_type === EDITOR_ASSETS.IDEA && currentPageSVG) {
      data.image = currentPageSVG;
    }

    // save layout
    apiPost(ENDPOINTS.saveLayouts, data)
      .then((response) => {
        if (response && response.items) {
        }
      })
      .catch(() => {});
  };
  // mask content need to remvoe to save space. will laod mask content only when we load theme by id
  const removeMaskContent = () => {
    const updatedPages = pages.filter(p => p).map((page) => {
      const updatedLayouts = page?.layout?.map((layout) => {
        if (!layout) return layout; // preserve null entries as-is
        let updatedObjects = layout.objects.map((obj) => {
          if (obj.type === "img" && obj.masking && obj.masking.path) {
            // obj has key masking and it has key path that only need to remove
            return {
              ...obj,
              masking: {
                ...obj.masking,
                path: null,
              },
            };
          }
          return obj;
        });
        let updatedSafeAreaObjects =
          layout?.safeAreaObjects?.length > 0
            ? layout?.safeAreaObjects?.map((obj) => {
              if (obj.type === "img" && obj.masking && obj.masking.path) {
                // obj has key masking and it has key path that only need to remove
                return {
                  ...obj,
                  masking: {
                    ...obj.masking,
                    path: null,
                  },
                };
              }
              return obj;
            })
            : [];
        return {
          ...layout,
          objects: updatedObjects,
          safeAreaObjects: updatedSafeAreaObjects,
        };
      });
      return {
        ...page,
        layout: updatedLayouts,
      };
    });
    return updatedPages;
  };
  const getAllPagesToSave = (asset_type, name) => {
    // remove mask content from the pages to make smaller request payload(As need to store multiple times)
    let without_mask_pages = removeMaskContent();
    without_mask_pages.forEach((page) => {
      page?.layout?.forEach((layout, index) => {
        if (!layout) return; // skip null layout entries
        // Create a new object with the updated properties
        const updatedLayout = {
          ...layout,
          width:
            activeEditorType === EDITOR_TYPES.PHOTOBOOK
              ? canvasSize.width / 2
              : canvasSize.width,
          height: canvasSize.height,
          objects: layout.objects.map((obj) => ({ ...obj })), // Ensure objects are copied as well
        };

        // Replace the original layout with the new object
        page.layout[index] = updatedLayout;
      });
    });
    // Patch fontId/styleId into text objects before saving — ensures font
    // metadata is always present even if patchTextFontIds was overwritten
    patchFontIdsOnPages(without_mask_pages);

    // ── 1. Build smart_text payload ───────────────────────────────────────
    // Must happen BEFORE stripping — groupKey/contentSegments are still on objects here.
    // We save per-object link metadata so reloading can restore word-only (segment) links.
    const buildSmartTextPayload = () => {
      if (!textGroups || Object.keys(textGroups).length === 0) return null;

      // groupObjects: { [groupKey]: { [objectId]: { linkMode, contentSegments? } } }
      const groupObjects = {};

      without_mask_pages.forEach((page) => {
        (page.layout || []).forEach((layout) => {
          if (!layout) return; // skip null layout entries
          [
            ...(layout.objects || []),
            ...(layout.safeAreaObjects || []),
          ].forEach((obj) => {
            if (!obj.groupKey) return;
            const gk = obj.groupKey;
            if (!groupObjects[gk]) groupObjects[gk] = {};

            const isWordLink = Array.isArray(obj.contentSegments) && obj.contentSegments.length > 0;
            groupObjects[gk][obj.id] = {
              linkMode: isWordLink ? "selection" : "full",
              // For word-only links: save ONLY the selected word (not the entire segment
              // array — segments are regenerated on reload from obj.text + selectedText).
              // obj.groupExample stores the original selected word set during linkTextToGroup.
              ...(isWordLink ? { selectedText: obj.groupExample } : {}),
            };
          });
        });
      });

      const result = {};
      Object.entries(textGroups).forEach(([key, group]) => {
        const objs = groupObjects[key] || {};
        result[key] = {
          ...group,
          // Flat list of IDs kept for quick lookup
          objectIds: Object.keys(objs),
          // Full per-object metadata for accurate reload
          objects: objs,
        };
      });
      return result;
    };
    const smartText = buildSmartTextPayload();

    // ── 2. Strip Smart Text fields before serializing pages ───────────────
    // groupKey/groupLabel/contentSegments/groupExample now live in smart_text only.
    // IMPORTANT: for word-only (selection) links, obj.text currently contains the
    // group value applied (e.g. "y----urself"). We restore it to the original template
    // text (e.g. "yourself") using contentSegments + groupExample BEFORE stripping.
    // This ensures pages_c always stores the original word so buildSegmentsFromWord
    // can find it correctly on reload without needing any extra saved fields.
    const SMART_TEXT_FIELDS = ["groupKey", "groupLabel", "contentSegments", "groupExample"];
    without_mask_pages.forEach((page) => {
      (page.layout || []).forEach((layout) => {
        if (!layout) return; // skip null layout entries
        const stripFields = (obj) => {
          const clean = { ...obj };

          // Restore template text for word-only links before stripping
          if (
            Array.isArray(obj.contentSegments) &&
            obj.contentSegments.length > 0 &&
            obj.groupExample
          ) {
            // Replace each linked segment with the original selected word (groupExample)
            // so the saved text looks like the pre-link original, not the applied value.
            clean.text = obj.contentSegments
              .map((seg) =>
                seg.type === "linked" ? obj.groupExample : seg.value
              )
              .join("");
          }

          SMART_TEXT_FIELDS.forEach((f) => delete clean[f]);
          // Strip internal database _id if present
          delete clean._id;
          return clean;
        };
        layout.objects = (layout.objects || []).map(stripFields);
        layout.safeAreaObjects = (layout.safeAreaObjects || []).map(stripFields);
      });
    });

    const pagesJsonString = JSON.stringify({ pages: without_mask_pages });
    const compressedBase64 = compressData(pagesJsonString);

    let numberOfPages = pages.length;
    // lets count number of layouts in the theme
    let numberOfLayouts = 0;
    pages.forEach((page) => {
      numberOfLayouts += page.layout.length;
    });
    // count image object in all pages
    let totalImgObjectsCount = 0;
    pages.forEach((page) => {
      page.layout.forEach((layout) => {
        if (!layout) return; // skip null layout entries
        const imgObjectsCount = layout.objects.filter(
          (obj) => obj.type === "img"
        ).length;
        totalImgObjectsCount += imgObjectsCount;
      });
    });

    const finalSettings = { ...settings };
    if ((activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && canvasSize?.shape === "circle") {
      finalSettings.shape = "circle";
    } else {
      delete finalSettings.shape;
    }

    const themeData = {
      pages_c: compressedBase64,
      pages: pagesJsonString,
      orientation: activeOrientation,
      width: canvasSize.width,
      height: canvasSize.height,
      safe_margin: canvasSize.safeMargin,
      bleed_margin: canvasSize.bleedMargin,
      size: `${canvasSize.width - canvasSize.depth * 2}x${canvasSize.height - canvasSize.depth * 2}`,
      depth: canvasSize.depth,
      dpi: canvasSize.dpi,
      images_count: totalImgObjectsCount,
      number_of_pages: numberOfPages,
      number_of_layouts: numberOfLayouts,
      cal_settings: calendarSetings || null,
      settings: finalSettings,
      ...(smartText ? { smart_text: smartText } : {}),
    };

    if (asset_type === EDITOR_ASSETS.THEME) {
      return {
        status: 1, // under review
        theme: themeData,
        name: name,
        id: "",
        display_in_web: true,
        assets_type: EDITOR_ASSETS.THEME,
        editor_type: activeEditorType,
        platform: "web",
        brand_id: user?.brand_id ? user.brand_id : null,
      };
    } else if (asset_type === EDITOR_ASSETS.PROJECT) {
      return {
        status: 1, // under review
        name: name,
        width: canvasSize.width,
        height: canvasSize.height,
        depth: canvasSize.depth,
        safe_margin: canvasSize.safeMargin,
        bleed_margin: canvasSize.bleedMargin,
        size: `${canvasSize.width - canvasSize.depth * 2}x${canvasSize.height - canvasSize.depth * 2
          }`,
        images_count: totalImgObjectsCount,
        pages: pagesJsonString,
        pages_c: compressedBase64,
        display_in_web: true,
        number_of_pages: numberOfPages,
        number_of_layouts: numberOfLayouts,
        assets_type: EDITOR_ASSETS.PROJECT,
        editor_type: activeEditorType,
        orientation: activeOrientation,
        platform: "web",
        brand_id: user?.brand_id ? user.brand_id : "",
        cal_settings: calendarSetings || null,
        settings: finalSettings,
        ...(smartText ? { smart_text: smartText } : {}),
      };
    }

    return null;
  };
  /**
   * Get SVG array from DOM-captured SVGs stored in redux.
   * Uses store.getState() to get fresh state after capture completes.
   * Returns the same payload format as used in exportAsJPG API:
   * { svgDetails, fonts, w, h }
   */
  const getDomCapturedSvgArray = () => {
    // Get fresh state from store (not stale closure)
    const freshSvgContent = store.getState().svgData.svgContent;

    if (!freshSvgContent || freshSvgContent.length === 0) {
      return [];
    }

    // Sort by pageIndex and format for API
    const sortedSvgs = [...freshSvgContent].sort((a, b) => a.pageIndex - b.pageIndex);

    return sortedSvgs.map((svgObj) => ({
      svgDetails: svgObj.svgContent,
      fonts: svgObj.fonts || [],
      w: svgObj.width,
      h: svgObj.height,
    }));
  };

  /**
   * Trigger DOM-based SVG capture and wait for completion.
   * Returns a promise that resolves when all pages are captured.
   * @param {boolean} editedPagesOnly - If true, only capture pages with isPageEdited === true
   */
  const triggerDomCaptureAndWait = async (editedPagesOnly = false) => {
    // Reset capture state
    dispatch(setAllPagesCaptured(false));

    // Call Canvas capture function directly if available
    if (window.__canvasCaptureAllPages) {
      await window.__canvasCaptureAllPages(editedPagesOnly);
      return;
    }

    // Fallback to old polling method if direct call not available
    return new Promise((resolve) => {
      window._captureEditedPagesOnly = editedPagesOnly;
      dispatch(setIsCapturingPages(true));

      const checkCapture = setInterval(() => {
        const currentState = store.getState().svgData;
        if (currentState.allPagesCaptured && !currentState.isCapturingPages) {
          clearInterval(checkCapture);
          resolve();
        }
      }, 200);

      setTimeout(() => {
        clearInterval(checkCapture);
        resolve();
      }, 120000);
    });
  };

  // ── Optimistic placement: Save/Order/Export upload gate ──────────────
  // Photos placed while still uploading reference local blob: URLs, which
  // are meaningless outside this tab — they must NEVER reach saved project
  // JSON, theme JSON, or exported SVG (they would print blank). Each
  // persisting action below self-gates: while placed uploads are pending we
  // show a small wait modal and re-run the action automatically once every
  // placed photo has its server URL (decision: "wait automatically").
  const { pendingCount: pendingPlacedCount, failedCount: failedPlacedCount } =
    usePendingPlacedImages();
  const [uploadGateAction, setUploadGateAction] = useState(null); // { label, run }

  // Click-time imperative read — no ref/render staleness.
  const placedUploadsBlocked = () => {
    // First resolve any placement whose upload already finished but whose one-shot
    // swap missed it (the object was placed AFTER the upload completed — common on
    // desktop's near-instant local saves). Without this, such objects keep a stale
    // pendingImageId and the gate would block export forever.
    dispatch(reconcilePlacedUploads());
    const counts = getPendingPlacedImageCounts(store.getState());
    return counts.pendingCount > 0 || counts.failedCount > 0;
  };

  // Wait-automatically: run the gated action once every placed upload settles
  useEffect(() => {
    if (!uploadGateAction) return;
    if (pendingPlacedCount === 0 && failedPlacedCount === 0) {
      const { run } = uploadGateAction;
      setUploadGateAction(null);
      run();
    }
  }, [uploadGateAction, pendingPlacedCount, failedPlacedCount]);

  // Desktop reference mode: block order/export when a PLACED photo's original
  // file is missing on disk (moved/deleted). Unlike the pending-upload gate this
  // will NOT resolve by waiting — the user must re-add the image — so we warn and
  // abort rather than queue the action. Best-effort: never blocks on checker error.
  const missingOriginalsBlocked = async () => {
    if (!localAssetsEnabled) return false;
    try {
      const missing = await findMissingPlacedOriginals(
        store.getState().canvas.present.pages,
        projectSetup?.cartDetails?._id
      );
      if (missing.length > 0) {
        toast.error(
          `${missing.length} placed image${missing.length > 1 ? "s are" : " is"} missing its original file. ` +
            `Please re-add ${missing.length > 1 ? "them" : "it"} from the Photos panel before continuing.`,
          { position: "top-center", autoClose: 6000 }
        );
        return true;
      }
    } catch {
      /* best-effort — a checker failure must not block the user */
    }
    return false;
  };

  const retryFailedPlacedUploads = () => {
    const failed = getRetryableFailedPlacedImages(store.getState());
    failed.forEach((img) => {
      dispatch(retryUpload({ imageId: img.imageId }));
      dispatch(uploadImage(img));
    });
  };

  const saveProject = async ({ manual = false } = {}) => {
    if (activeObjectProps?.isProcessing || isAnyObjetInProcessing) return;
    if (placedUploadsBlocked()) {
      setUploadGateAction({ label: "Save", run: () => saveProject({ manual }) });
      return;
    }

    // ── Save the customer's project ON THIS DEVICE (no API) ──────────────────
    // Mirrors the admin "Update Theme" local save (saveCurrentEditorToLibrary):
    // the current editor state is persisted to the on-device store — the durable
    // offline-resume snapshot, the full 300-step undo/redo history, and the Saved
    // Designs library entry (keyed `cart:<cartOrderId>`) — with NO server round-
    // trip. Saving therefore works fully offline, and reopening the project
    // (RootGate matches the `c_id` deep-link to the snapshot → restore=1, and
    // useInitializeProject stands down) continues from this latest local state.
    setIsSaving(true);
    try {
      const savedId = await saveCurrentEditorToLibrary();
      if (savedId) {
        if (manual) {
          toast.success("Saved on this device.", {
            position: "top-center",
            autoClose: 1500,
          });
        }
      } else if (manual) {
        toast.error("Couldn't save on this device. Please try again.", {
          position: "top-center",
        });
      }
    } catch (error) {
      // Best-effort: leave the baseline stale so the change is retried on the
      // next auto-save tick.
      if (manual) {
        toast.error("Couldn't save on this device. Please try again.", {
          position: "top-center",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const orderProject = async (isConfirm) => {
    if (activeObjectProps?.isProcessing) return;
    if (placedUploadsBlocked()) {
      setUploadGateAction({ label: "Order", run: () => orderProject(isConfirm) });
      return;
    }
    if (await missingOriginalsBlocked()) return;

    const hasCanvasErrors = canvasError.length > 0;

    // Check for unedited pages
    const uneditedPagesList = pages
      .map((page, index) => ({ page, displayNumber: index + 1 }))
      .filter(({ page }) => !page.isPageEdited)
      .map(({ displayNumber }) => displayNumber);

    const hasUneditedPages = uneditedPagesList.length > 0;

    // If SKIP_UNEDITED_PAGES_DIALOG is true, skip the dialog and proceed with edited pages only
    if (SKIP_UNEDITED_PAGES_DIALOG) {
      // Skip dialog, proceed directly with edited pages only
      isConfirm = true;
    }

    /* COMMENTED OUT: Unedited pages dialog logic - controlled by SKIP_UNEDITED_PAGES_DIALOG
    if (!isConfirm && (hasCanvasErrors || hasUneditedPages)) {
      setUneditedPages(uneditedPagesList);
      setShowNotice(true);
      return;
    }
    */
    // When dialog is skipped, still check for canvas errors
    if (!SKIP_UNEDITED_PAGES_DIALOG && !isConfirm && (hasCanvasErrors || hasUneditedPages)) {
      // Deselect any active object before opening dialog
      dispatch(setActiveObject(null));
      dispatch(setCurrentObjectProperties(null));
      setUneditedPages(uneditedPagesList);
      setShowNotice(true);
      return;
    }

    // Nothing left to gate on — proceed with the local save.
    if (!(isConfirm || (!hasCanvasErrors && !hasUneditedPages))) {
      return;
    }

    setIsOrdering(true);

    // ── Save the customer's ORDER ON THIS DEVICE (no API) ────────────────────
    // A customer Order no longer posts the project to the server cart. It
    // persists the current editor state to the on-device Saved Designs library
    // (AppData on desktop / IndexedDB on web) — the SAME local store the "Save"
    // button and the offline-resume snapshot write to (saveCurrentEditorToLibrary
    // → key `cart:<cartOrderId>`), so ordering works fully offline and the order
    // shows up under "Your Designs" on the Design Selection page. On success we
    // route the customer there so they can see it. NO server round-trip, no
    // redirect to the web `/cart` (which requires the network and doesn't exist
    // offline).
    try {
      const savedId = await saveCurrentEditorToLibrary();
      if (savedId) {
        toast.success("Order saved on this device.", {
          position: "top-center",
          autoClose: 1500,
        });
        // Hold the "Saving" loader (the Order button shows "Saving" + spinner
        // while `isOrdering` is true) for ~1.5s before leaving the editor. The
        // on-device save above is near-instant, so without this deliberate pause
        // the spinner would flash by imperceptibly; the short hold reads as
        // "saving" and lets the success toast register before we route away.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Go to Design Selection so the just-saved order is visible under
        // "Your Designs". Re-attach the live token so that page authenticates.
        const params = new URLSearchParams();
        if (u_id) params.set("u_id", u_id);
        navigate(`/design${params.toString() ? `?${params.toString()}` : ""}`);
        return;
      }
      toast.error("Couldn't save the order on this device. Please try again.", {
        position: "top-center",
      });
    } catch (error) {
      toast.error("Couldn't save the order on this device. Please try again.", {
        position: "top-center",
      });
    } finally {
      setIsOrdering(false);
    }
  };

  const savePageAsThemeImage = () => {
    // we need to send svg content to
    if (activeObjectProps?.isProcessing) return;
    if (!themeDetails?.theme_id) {
      alert("Theme is not saved yet, please save theme first");
      return;
    }
    if (!currentPageSVG) {
      alert("Page is not saved yet, please save page first");
      return;
    }
    const data = {
      image: currentPageSVG,
      theme_id: themeDetails.theme_id,
      fonts: currentPageSVG.fonts || [],
    };

    //  add quantity to data  only for print editor
    if (activeEditorType === EDITOR_TYPES.PRINT) {
      data.quantity = pages.length > 0 ? pages.length : 1;
    } else {
      data.billablePages = billablePages;
    }

    apiPost(ENDPOINTS.savePageAsThemeImage, data)
      .then((response) => {
        if (response && response.items) {
        }
      })
      .catch(() => {});
  };

  const saveAsTheme = async (saveAsNewTheme = false, themeName = "") => {
    if (activeObjectProps?.isProcessing) return;
    if (placedUploadsBlocked()) {
      setUploadGateAction({
        label: "Save Theme",
        run: () => saveAsTheme(saveAsNewTheme, themeName),
      });
      return;
    }

    // Validate theme name
    if (!themeName || themeName.trim() === "" || themeName === "Theme Name") {
      toast.warning("Theme name is required", { position: "top-center" });
      return false;
    }

    // ── UPDATE an existing theme → save ON THIS DEVICE (no API) ────────────────
    // New themes are created on the SERVER via the Create Theme dialog. Once a
    // theme exists (has a server id), editing it and clicking "Update Theme"
    // persists to the local Saved Designs library (AppData on desktop /
    // IndexedDB on web) so updates work fully offline. "Save as New Theme" /
    // "Clone Theme" still create a brand-new theme on the server (block below).
    if (isThemeSaved && !saveAsNewTheme) {
      setIsSavingTheme(true);
      try {
        dispatch(setThemeName(themeName.trim()));
        const savedId = await saveCurrentEditorToLibrary();
        if (!savedId) throw new Error("Couldn't update the theme on this device.");
        toast.success("Theme updated on this device.", {
          position: "top-center",
          autoClose: 1500,
        });
      } catch (error) {
        toast.error(error.message || "Error updating theme. Please try again.", {
          position: "top-center",
        });
      } finally {
        setIsSavingTheme(false);
      }
      return;
    }

    const baseData = getAllPagesToSave(EDITOR_ASSETS.THEME, themeName.trim());

    if (
      themeDetails &&
      themeDetails != null &&
      themeDetails.theme_id &&
      !saveAsNewTheme
    ) {
      baseData._id = themeDetails.theme_id;
    } else {
      // Ensure no _id is present for new thematic clones
      delete baseData._id;
    }

    if (firstPageSVG) {
      baseData.image = firstPageSVG;
    }

    // add billable pages to data
    if (activeEditorType === EDITOR_TYPES.PRINT) {
      baseData.quantity = pages.length > 0 ? pages.length : 1;
    } else {
      baseData.billablePages = billablePages;
    }

    setIsSavingTheme(true);
    let masterThemeId = null;

    try {
      // Generate a list of API requests tailored for each theme size currently available in Redux "allThemes"
      const themesToSave = allThemes && allThemes.length > 0 ? [...allThemes] : [baseData.theme];
      let firstSavedThemeResponse = null;

      // Identify the size signature of the active editor so we can pipe live generated (but unsaved) DOM data into it
      let activeSizeCheck = `${canvasSize.width}x${canvasSize.height}`;
      if (activeEditorType === EDITOR_TYPES.CANVAS) {
        activeSizeCheck = `${canvasSize.width - canvasSize.depth * 2}x${canvasSize.height - canvasSize.depth * 2}`;
      }

      // If the currently active size isn't found in allThemes (which happens when converting sizes manually),
      // force it into the themes queue so it gets saved properly!
      if (!themesToSave.some(t => t.size === activeSizeCheck)) {
        themesToSave.push(baseData.theme);
      }

      for (let i = 0; i < themesToSave.length; i++) {
        const themeOption = themesToSave[i];

        // Either this size matches the live "baseData.theme" which has actively parsed `pages` and text changes embedded,
        // or it's a dormant background size configuration we just want to flush settings changes to.
        const isActiveSize = themeOption.size === activeSizeCheck;

        // Clone payload body and inject targeted dimensions/pages.
        // For the active size: use freshly-generated pages_c/pages from baseData (captures any edits).
        // For other sizes: preserve their existing pages_c/pages but always propagate the latest
        //   settings (e.g. hideLastCover, coverEnabled) so all sizes stay in sync.
        // Margins are stored on allThemes entries as camelCase (safeMargin/bleedMargin)
        // — by the convert/add-size flows — but the backend persists/reads them as
        // snake_case (safe_margin/bleed_margin). Without writing the snake_case keys
        // per size they get dropped on save and come back empty after reload.
        const themeSafeMargin = isActiveSize
          ? (Number(canvasSize.safeMargin) || 0)
          : (Number(themeOption.safeMargin ?? themeOption.safe_margin) || 0);
        const themeBleedMargin = isActiveSize
          ? (Number(canvasSize.bleedMargin) || 0)
          : (Number(themeOption.bleedMargin ?? themeOption.bleed_margin) || 0);

        const payload = {
          ...baseData,
          theme: {
            ...themeOption,
            safe_margin: themeSafeMargin,
            bleed_margin: themeBleedMargin,
            // keep camelCase in sync too, so anything reading either shape is correct
            safeMargin: themeSafeMargin,
            bleedMargin: themeBleedMargin,
            pages_c: isActiveSize ? baseData.theme.pages_c : themeOption.pages_c,
            pages: isActiveSize ? baseData.theme.pages : themeOption.pages,
            smart_text: baseData.theme.smart_text,
            settings: baseData.theme.settings,
            cal_settings: baseData.theme.cal_settings,
          }
        };

        // // When saving as new theme, strip internal variant IDs
        // if (saveAsNewTheme) {
        //   delete payload.theme._id;
        //   delete payload.theme.id;
        // }

        const response = await apiPost(ENDPOINTS.saveAsTheme, payload);

        if (response && response.items && response.status === 1) {
          if (!firstSavedThemeResponse) firstSavedThemeResponse = response;
          if (!masterThemeId && response.items._id) {
            masterThemeId = response.items._id;
          }
        } else {
          throw new Error(response?.message || `Failed to save theme size: ${themeOption.size}`);
        }
      }

      if (masterThemeId && firstSavedThemeResponse) {
        dispatch(setThemeId(masterThemeId));
        getTheme(masterThemeId);

        // Show success toast with appropriate message
        const actionText = saveAsNewTheme
          ? "Theme cloned successfully!"
          : (isThemeSaved ? "Theme updated successfully!" : "Theme saved successfully!");
        toast.success(actionText, {
          position: "top-center",
          autoClose: 1000,
        });

        // Navigate to the cloned theme's URL without reload, PRESERVING the
        // existing query params (u_id/cat) via the router's searchParams — see
        // handleThemeCreated for why window.location.search drops u_id (and hides
        // the Back button) on desktop HashRouter.
        if (saveAsNewTheme) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("t_id", masterThemeId);
          // The clone is a real server theme now — clear any lingering `new`/
          // `restore` intent so a reload resumes it from the local snapshot via
          // RootGate's deep-link branch (see handleThemeCreated).
          nextParams.delete("new");
          nextParams.delete("restore");
          navigate(`/?${nextParams.toString()}`);
        }
      }
    } catch (error) {
      toast.error(error.message || "Error saving theme. Please try again.", {
        position: "top-center"
      });
    } finally {
      setIsSavingTheme(false);
    }
  };

  /**
   * Update Theme
   * Persists the current design to the on-device Saved Designs library (AppData
   * on desktop / IndexedDB on web) — no API round-trip, works fully offline. The
   * former server-only SVG capture is dropped (SVGs were render data for the
   * backend; the library keeps its own thumbnail). Shown once the theme has been
   * saved at least once (isThemeSaved).
   */
  const updateThemeWithSvg = async () => {
    if (activeObjectProps?.isProcessing || isUpdatingThemeWithSvg) return;
    if (!isThemeSaved) return;
    if (placedUploadsBlocked()) {
      setUploadGateAction({ label: "Update Theme", run: () => updateThemeWithSvg() });
      return;
    }

    setIsUpdatingThemeWithSvg(true);
    try {
      const savedId = await saveCurrentEditorToLibrary();
      if (!savedId) throw new Error("Couldn't update the theme on this device.");
      toast.success("Theme updated on this device.", {
        position: "top-center",
        autoClose: 1500,
      });
    } catch (error) {
      toast.error(error.message || "Error updating theme. Please try again.", {
        position: "top-center",
      });
    } finally {
      setIsUpdatingThemeWithSvg(false);
    }
  };

  // Function to open save theme confirmation dialog
  const openSaveThemeDialog = (saveAsNew = false) => {
    if (activeObjectProps?.isProcessing) return;
    // Deselect any active object before opening dialog
    dispatch(setActiveObject(null));
    dispatch(setCurrentObjectProperties(null));
    setSaveAsNewThemeFlag(saveAsNew);
    // Set initial theme name
    const defaultName = themeDetails?.theme_name || "Theme Name";
    setThemeNameInput(defaultName);
    setShowSaveThemeDialog(true);
  };

  // Function to handle confirmation and save theme (receives name from dialog)
  const confirmSaveTheme = (inputName) => {
    setShowSaveThemeDialog(false);
    if (inputName) {
      saveAsTheme(saveAsNewThemeFlag, inputName);
    }
  };

  const getTheme = async (themeid) => {
    // Remember current canvas size to find matching theme
    const currentSize = `${canvasSize.width}x${canvasSize.height}`;

    const themeData = await GetThemeById(
      themeid,
      canvasSize,
      activeEditorType,
      activeOrientation
    );

    if (!themeData) {
      return;
    }

    // Find the theme variant that matches our current canvas size
    let matchingTheme = null;
    if (themeData.theme && Array.isArray(themeData.theme)) {
      matchingTheme = themeData.theme.find(t => t.size === currentSize);
    }

    // If we found a matching size, load its pages
    // Otherwise, don't update pages (they're already correct from what we just saved)
    if (matchingTheme && matchingTheme.pages_c) {
      dispatch(setCurrentObjectProperties(null));
      dispatch(setEditorPages(matchingTheme.pages_c));
      // Also restore the canvas size from the matching theme
      dispatch(setCanvasSize({
        width: parseFloat(matchingTheme.width),
        height: parseFloat(matchingTheme.height),
        depth: parseFloat(matchingTheme.depth) || 0,
        safeMargin: Number(matchingTheme.safeMargin ?? matchingTheme.safe_margin) || 0,
        bleedMargin: Number(matchingTheme.bleedMargin ?? matchingTheme.bleed_margin) || 0,
        shape: matchingTheme.shape || (themeData.shape) || "rectangle",
      }));
    }
    // If no matching size found, pages remain unchanged (current working state)

    dispatch(setThemeId(themeid));
    dispatch(setThemeName(themeData.name));

    if (
      user != null &&
      (user?.userTypeCode === USER_TYPES.SUPERUSER ||
        user?.userTypeCode === USER_TYPES.ADMIN ||
        user?.userTypeCode === USER_TYPES.EMPLOYEE)
    ) {
      const normalizedThemes = themeData.theme.map((theme) => ({
        ...theme,
        safeMargin: Number(theme.safeMargin ?? theme.safe_margin) || 0,
        bleedMargin: Number(theme.bleedMargin ?? theme.bleed_margin) || 0,
      }));

      dispatch(setAllThemes(normalizedThemes));
    }
  };

  const exportPage = (
    exportPageType = "ALL",
    format = "jpeg",
    exportAsZip = false
  ) => {
    dispatch(setExportPageType(exportPageType));
    dispatch(setExportFormat(format));
    dispatch(setExportAsZip(exportAsZip));
    dispatch(setInitilized(true));
  };

  const handleExportOptions = async (options) => {
    if (placedUploadsBlocked()) {
      setUploadGateAction({ label: "Export", run: () => handleExportOptions(options) });
      return;
    }
    if (await missingOriginalsBlocked()) {
      return;
    }
    const { format, pageType, exportAsZip } = options;
    // Clear existing SVG content to force fresh capture for admin export
    // This ensures admin export always captures fresh pages
    dispatch(setSvgData({ svgContent: null, pageIndex: null }));
    dispatch(setAllPagesCaptured(false));
    exportPage(pageType, format, exportAsZip);
  };

  /**
   * Handle customer PDF export flow:
   * 1. Start loading
   * 2. Capture all pages SVGs
   * 3. Send SVG array to save API
   * 4. Trigger PDF download
   * 5. Stop loading
   */
  const handleCustomerPdfExport = async (options) => {
    const { format, pageType, exportAsZip } = options;

    if (activeObjectProps?.isProcessing || isAnyObjetInProcessing) return;
    if (placedUploadsBlocked()) {
      setUploadGateAction({ label: "Download PDF", run: () => handleCustomerPdfExport(options) });
      return;
    }
    if (await missingOriginalsBlocked()) return;

    setIsDownloadingPdf(true);

    try {
      // Step 1: Capture ALL pages SVGs (for PDF download, we always want all pages)
      // Pass false to capture all pages, not just edited ones
      await triggerDomCaptureAndWait(false);

      // Small delay to ensure Redux state is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Get SVG array from captured SVGs
      const svgArray = getDomCapturedSvgArray();

      // Step 3: Send SVG array to save API
      let data = getAllPagesToSave(EDITOR_ASSETS.PROJECT, "Project Name");
      data.cart_order_id = projectSetup.cartDetails._id;
      data.theme_id = projectSetup.cartDetails.theme_id;
      data.svg_array = svgArray;

      if (activeEditorType === EDITOR_TYPES.PRINT) {
        data.quantity = pages.length > 0 ? pages.length : 1;
      } else {
        data.billablePages = billablePages;
      }

      if (firstPageSVG) {
        data.image = firstPageSVG;
      }

      await apiPost(ENDPOINTS.saveProject, data);

      // Step 4: Trigger PDF export (this will download the PDF)
      exportPage(pageType, format, exportAsZip);

      // Note: Loading will be turned off by useExportPages hook when PDF download completes
      // But we set a fallback timeout in case something goes wrong
      setTimeout(() => {
        setIsDownloadingPdf(false);
      }, 60000); // 60 second fallback

    } catch (error) {
      setIsDownloadingPdf(false);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setDisplaySize({
      ...displaySize,
      [id]: value,
    });
  };
  const changeOrientation = (orientation) => {
    // Capture currently-placed images before re-sourcing pages for the new
    // orientation (the local `pages` below shadows the canvas selector). Used to
    // re-fill the new blank theme so a blanked-mode design keeps its photos.
    const placedImagesBefore = themeImagesBlanked ? collectPlacedImages(pages) : [];
    let width = 1000;
    let height = 1000;
    switch (orientation) {
      case "S":
        width = 2400;
        height = 2400;
        if (
          activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM ||
          settings?.isFoldable
        ) {
          width *= 2;
        }
        break;
      case "L":
        width = 3600;
        height = 2400;
        if (
          activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM ||
          settings?.isFoldable
        ) {
          width *= 2;
        }

        break;
      case "P":
        width = 2400;
        height = 3600;
        if (
          activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM ||
          settings?.isFoldable
        ) {
          width *= 2;
        }

        break;
    }
    const oldWidth = canvasSize.width;
    const oldHeight = canvasSize.height;

    dispatch(
      setCanvasSize({
        ...canvasSize,
        width: width + canvasSize.depth,
        height: height + canvasSize.depth,
        depth: canvasSize.depth,
      })
    );

    // check if theme exist in seleced orientation if yes than load it
    if (allThemes) {
      // alltheme is array of all themes, lets filter out theme with selected orientation
      const theme = allThemes.find(
        (theme) => theme.orientation === orientation
      );
      if (theme) {
        //  let width = parseInt(theme.width);
        // let height = parseInt(theme.height);
        if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
          width /= 2;
        }
        const pages = processProjectPages(theme.pages_c, width, height);
        dispatch(setCurrentObjectProperties(null));
        if (themeImagesBlanked) {
          // Keep images blank (don't restore originals on orientation change) but
          // carry the user's placed photos into the new orientation's empty boxes.
          // applyTheme writes the canvas synchronously so the re-fill isn't clobbered.
          dispatch(applyTheme(blankImageUrls(pages)));
          if (placedImagesBefore.length > 0) {
            dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
          }
        } else {
          dispatch(setEditorPages(pages));
        }

        if (calendarSetings) {
          const newFontSize = calculateNewFontSize(
            calendarSetings.fontSize,
            oldWidth,
            oldHeight,
            width,
            height,
            "average"
          );

          //  dispatch(setCalendarSettings({ fontSize: newFontSize }));

          // lets calculate how much width and height is increased or decreased
        }

        // need to scale calender settings as well
      } else {
        // use first theme and convert it to selected orientation
        if (allThemes && allThemes.length > 0) {
          const theme = allThemes[0];

          if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
            width /= 2;
          }
          const pages = processProjectPages(theme.pages_c, width, height);
          dispatch(setCurrentObjectProperties(null));
          if (themeImagesBlanked) {
            // Keep images blank (don't restore originals) but carry the user's
            // placed photos into the new orientation's empty boxes.
            dispatch(applyTheme(blankImageUrls(pages)));
            if (placedImagesBefore.length > 0) {
              dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
            }
          } else {
            dispatch(setEditorPages(pages));
          }
        }
      }
    }
  };
  const openPreviewModel = () => {
    // Deselect any active object before opening preview
    dispatch(setActiveObject(null));
    dispatch(setCurrentObjectProperties(null));
    setShow(true);
  };
  const openEditorSetting = () => {
    // Deselect any active object before opening dialog
    dispatch(setActiveObject(null));
    dispatch(setCurrentObjectProperties(null));
    setShowEditorSettngs(true);
  };
  const openSizeSettings = () => {
    // Deselect any active object before opening dialog
    dispatch(setActiveObject(null));
    dispatch(setCurrentObjectProperties(null));
    setShowSizeSettings(true);
  };
  const getBorderStyle = (orientation) => {
    return activeOrientation === orientation
      ? { border: `var(--primary) 2px solid` }
      : { border: `2px solid transparent` };
  };

  // Fetch order price for customer — only after theme+pages are fully set up.
  // isThemeApplied fires after useThemeSetup adjusts pages to the correct qty.
  // isInitialized fires too early (before page count is finalized) and would
  // send a wrong page count to the backend, corrupting the cart quantity.
  const isThemeApplied = useSelector((state) => state.projectSetup.isThemeApplied);
  useEffect(() => {
    if (!showCustomerOptions) return;
    if (!projectSetup.isInitialized) return;
    if (!isThemeApplied) return;
    const cartDetails = projectSetup.cartDetails;
    if (!cartDetails?._id) return;
    if (!user?._id) return;

    // Debounce: pages.length can transition (e.g., 1 → 24) while state hydrates;
    // wait for it to settle before firing the API.
    const timer = setTimeout(() => {
      const payload = {
        brand_id: cartDetails.brand_id,
        store_id: storeId,
        user_id: user._id,
        cart_order_id: cartDetails._id,
      };
      // Print editor uses `quantity` (page count), all others use `pages` (billable pages)
      if (activeEditorType === EDITOR_TYPES.PRINT) {
        payload.quantity = pages.length > 0 ? pages.length : 1;
      } else {
        payload.pages = billablePages;
      }

      apiPost(ENDPOINTS.calculateOrderAmount, payload)
        .then((res) => {
          const amount = res?.items?.totalAmount ?? null;
          if (amount != null) dispatch(setOrderPrice(amount));
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [showCustomerOptions, projectSetup.isInitialized, isThemeApplied, projectSetup.cartDetails?._id, billablePages, pages.length, activeEditorType, storeId, user?._id]);

  // NOTE: the periodic 30s customer auto-save that used to run here (→ saveProject
  // → saveCurrentEditorToLibrary) has been REMOVED as redundant. An in-progress
  // design is persisted to the Saved Designs library ("Your Projects") when the
  // editor closes/unmounts (useEditorSnapshot.writeSnapshot on `force`), and a
  // crash is covered by the 15s offline snapshot — so a timer that re-saved the
  // same local state every 30s added nothing. The library id always comes from
  // deriveDesignId, so the manual Save button / Order / Update-Theme update that
  // SAME entry rather than forking a duplicate.

  return (
    <>
      <HeaderWrapper className="header-wrapper" id="header">
        <DisplayBetween className="header-grid-mob">
          <Box className="d-flex align-items-center">
            <Link
              to={redirect_url ? redirect_url : "/ "}
              className="text-decoration-none"
            >
              <div className="d-flex align-items-center gap-2">
                <svg
                  width="8"
                  className="arrow_title"
                  height="12"
                  viewBox="0 0 8 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.07463 1L1 6L6.07463 11"
                    style={{ stroke: "var(--primary)" }}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {(brand_logo && (
                  <BrandLogo
                    src={`${brand_logo}`}
                    alt="brandlogo"
                    title={
                      brandname
                        ? brandname
                        : `${activeEditorType.charAt(0).toUpperCase() +
                        activeEditorType.slice(1).toLowerCase()
                        }-Designer`
                    }
                  />
                )) || (
                    <BrandTitle>
                      {brandname
                        ? brandname
                        : `${activeEditorType.charAt(0).toUpperCase() +
                        activeEditorType.slice(1).toLowerCase()
                        }-Designer`}
                    </BrandTitle>
                  )}
              </div>
            </Link>
            {isAdminViewingAsCustomer && (
              <span
                className="badge ms-3 py-1 px-2 d-none d-sm-inline-block"
                style={{
                  backgroundColor: "#fff3cd",
                  color: "#856404",
                  border: "1px solid #ffeeba",
                  fontSize: "0.75rem",
                  borderRadius: "12px",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                Viewing as Customer
              </span>
            )}
          </Box>

          <Box className="header-icon-container-mob">
            <DisplayStart>
              {/* {
                                  user && (user.userTypeCode === USER_TYPES.SUPERUSER || user.userTypeCode == USER_TYPES.ADMIN) &&
                                  <>
                                      <LightPrimaryButton onClick={() => exportAsJPG()} mr="10px">
                                          <span>Export JPG </span>
                                      </LightPrimaryButton>
                                      <LightPrimaryButton onClick={() => exportLayout(EDITOR_ASSETS.LAYOUT)} mr="10px">
                                          <span>Export Layout </span>
                                      </LightPrimaryButton>

                                      <LightPrimaryButton onClick={() => exportLayout(EDITOR_ASSETS.IDEA)} mr="10px">
                                          <span>Export as Idea </span>
                                      </LightPrimaryButton>
                                      <LightPrimaryButton onClick={() => saveAsTheme()} mr="10px">
                                          <span>Export as Theme </span>
                                      </LightPrimaryButton>
                                  </>
                              } */}

              {u_id && !c_id && (
                <ButtonGroup className="me-3">
                  <LightPrimaryButton
                    className="btn-light btn-light-mob"
                    onClick={handleBackToDesign}
                    title="Back to designs"
                    aria-label="Back to designs"
                  >
                    <FaArrowLeft size={16} className="me-1" />
                    <span>Back</span>
                  </LightPrimaryButton>
                </ButtonGroup>
              )}

              <ButtonGroup className="me-3">
                <LightPrimaryButton
                  className="btn-light btn-light-mob px-2"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  style={{ borderRight: "1px solid #dee2e6", opacity: canUndo ? 1 : 0.4 }}
                >
                  <Undo style={{ width: 18, height: 18 }} />
                </LightPrimaryButton>
                <LightPrimaryButton
                  className="btn-light btn-light-mob px-2"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  style={{ opacity: canRedo ? 1 : 0.4 }}
                >
                  <Redo style={{ width: 18, height: 18 }} />
                </LightPrimaryButton>
              </ButtonGroup>

              {showAdminOptions && (
                <>
                  {/* <ButtonGroup className="me-3">
                      <LightPrimaryButton
                        className="btn-light btn-light-mob"
                        onClick={() => changeOrientation("S")}
                        style={getBorderStyle("S")}
                      >
                        <FaSquare size={24} className="mr-2" title="Square" /> S
                      </LightPrimaryButton>
                      <LightPrimaryButton
                        className="btn-light btn-light-mob"
                        onClick={() => changeOrientation("L")}
                        style={getBorderStyle("L")}
                      >
                        <TbCropLandscapeFilled
                          size={24}
                          className="mr-2"
                          title="Landscape"
                        />{" "}
                        L
                      </LightPrimaryButton>
                      <LightPrimaryButton
                        className="btn-light btn-light-mob"
                        onClick={() => changeOrientation("P")}
                        style={getBorderStyle("P")}
                        border={getBorderStyle("P")}
                      >
                        <TbCropPortraitFilled
                          size={24}
                          className="mr-2"
                          title="Portrait"
                        />{" "}
                        P
                      </LightPrimaryButton>
                    </ButtonGroup> */}
                  <ButtonGroup className="me-3">
                    <LightPrimaryButton
                      className="btn-light btn-light-mob"
                      onClick={() => openSizeSettings()}
                      aria-label="Manage size"
                    >
                      <span className="manage-size-arrow me-1" aria-hidden="true">
                        ⤢
                      </span>
                      <span>Manage Size</span>
                    </LightPrimaryButton>
                  </ButtonGroup>
                  <ButtonGroup className="me-2">
                    <LightPrimaryButton
                      onClick={() => openSaveThemeDialog(false)}
                      disabled={isSavingTheme}
                      className="save-theme-btn"
                    >
                      {isSavingTheme ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          <span className="d-none d-lg-inline">Saving...</span>
                        </>
                      ) : (
                        <>
                          <BiSave size={20} className="me-1" />
                          <span className="">
                            {isThemeSaved ? "Update Theme" : "Save Theme"}
                          </span>
                        </>
                      )}
                    </LightPrimaryButton>
                  </ButtonGroup>
                </>
              )}
              {showAdminOptions && (
                <>
                  <DropdownButton
                    id="dropdown-basic-button"
                    title={<BiDotsVerticalRounded size={24} />}
                    className="me-2 header-dropdown-mob"
                  >
                    <Dropdown.Item
                      onClick={() => exportLayout(EDITOR_ASSETS.LAYOUT)}
                    >
                      Save as Layout
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => exportLayout(EDITOR_ASSETS.IDEA)}
                    >
                      Save as Idea
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => openSaveThemeDialog(true)}>
                      {isThemeSaved ? "Clone Theme" : "Save as New Theme"}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => openNewThemeDialog()}>
                      Create New Theme
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => savePageAsThemeImage()}>
                      Save Page as Theme Image
                    </Dropdown.Item>
                    {isThemeSaved && (
                      <Dropdown.Item
                        onClick={() => updateThemeWithSvg()}
                        disabled={isUpdatingThemeWithSvg}
                      >
                        {isUpdatingThemeWithSvg ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Updating...
                          </>
                        ) : (
                          "Update Theme (Quick)"
                        )}
                      </Dropdown.Item>
                    )}
                  </DropdownButton>
                </>
              )}
              {activeEditorType &&
                activeEditorType !== EDITOR_TYPES.PRINT &&
                activeEditorType !== EDITOR_TYPES.CUSTOME_PRODUCT &&
                activeEditorType !== EDITOR_TYPES.CUSTOME_PRODUCT &&
                activeEditorType !== EDITOR_TYPES.CARD &&
                activeEditorType !== EDITOR_TYPES.WALLART &&
                activeEditorType !== EDITOR_TYPES.CANVAS &&
                activeEditorType !== EDITOR_TYPES.ACRYLIC &&
                activeEditorType !== EDITOR_TYPES.PHOTO_FRAME &&
                activeEditorType !== EDITOR_TYPES.PHOTO_MAGNET &&
                activeEditorType !== EDITOR_TYPES.PHOTO_STRIP &&
                activeEditorType !== EDITOR_TYPES.GREETING_CARD &&
                activeEditorType !== EDITOR_TYPES.GIFTCARD &&
                activeEditorType !== EDITOR_TYPES.VISITING_CARD && (
                  <LightPrimaryButton
                    ml="10px"
                    onClick={() => openPreviewModel()}
                  >
                    <RxEyeOpen size={24} />
                    <span>Preview</span>
                  </LightPrimaryButton>
                )}

              {showAdminOptions && (
                <LightPrimaryButton
                  ml="10px"
                  mr="10px"
                  onClick={() => openEditorSetting()}
                >
                  <RxGear size={24} />
                  <span>Settings</span>
                </LightPrimaryButton>
              )}
              {showExportOption && (
                <LightPrimaryButton
                  disabled={isExporting}
                  ml="10px"
                  onClick={() => {
                    // Deselect any active object before opening dialog
                    dispatch(setActiveObject(null));
                    dispatch(setCurrentObjectProperties(null));
                    setShowExportOptions(true);
                  }}
                >
                  {isExporting ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      <span>Exporting</span>
                    </>
                  ) : (
                    <>
                      <TiExport size={24} />
                      <span>Export</span>
                    </>
                  )}
                </LightPrimaryButton>
              )}
              {showAdminOptions && (
                <>
                  {/* editor theme color  */}
                  {/* <Dropdown>
                        <Dropdown.Toggle variant="success" id="dropdown-basic">
                          Theme
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          {getAvailableThemes().map((theme) => (
                            <Dropdown.Item
                              key={theme.name}
                              onClick={() => changeTheme(theme.name)}
                            >
                              {theme.name}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown> */}
                </>
              )}

              {showCustomerOptions && (
                <>
                  <LightPrimaryButton
                    ml="10px"
                    className="btn"
                    disabled={isSaving || isOrdering}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveProject({ manual: true });
                    }}
                  >
                    <BiSave size={24} />
                    <span className="btn-save d-none d-sm-block me-2">
                      {isSaving ? "Saving" : "Save"}
                    </span>
                    {isSaving && (
                      <Spinner animation="border" role="status" size="sm" />
                    )}
                  </LightPrimaryButton>

                  {orderPrice != null && (
                    <span
                      style={{
                        marginLeft: "10px",
                        padding: "6px 12px",
                        fontWeight: 600,
                        fontSize: "1rem",
                        color: "var(--primary)",
                        backgroundColor: "var(--secondary)",
                        borderRadius: "6px",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{orderPrice}</span>
                    </span>
                  )}

                  {!projectSetup?.cartDetails?.is_downloadable && (
                  <PrimaryButton
                    ml="10px"
                    className="btn"
                    onClick={() => orderProject(false)}
                    disabled={isSaving || isOrdering || isAnyObjetInProcessing}
                  >
                    <BsCart3 size={24} />
                    <span className="btn-order me-2">
                      {isOrdering ? "Saving" : "Order"}
                    </span>
                    {isOrdering && (
                      <Spinner animation="border" role="status" size="sm" />
                    )}
                  </PrimaryButton>
                  )}

                  {/* PDF Export button for customers when is_downloadable is true.
                      Hidden when the Export button is visible (admin viewing as
                      customer) so the two never show at once. */}
                  {(projectSetup?.cartDetails?.is_downloadable) && !showExportOption && (
                    <LightPrimaryButton
                      ml="10px"
                      className="btn"
                      onClick={() => {
                        // Deselect any active object before opening dialog
                        dispatch(setActiveObject(null));
                        dispatch(setCurrentObjectProperties(null));
                        setShowPdfExport(true);
                      }}
                      disabled={isSaving || isOrdering || isAnyObjetInProcessing || isDownloadingPdf}
                    >
                      <TiExport size={24} />
                      <span className="d-none d-sm-block me-2">
                        {isDownloadingPdf ? "Downloading..." : "Download"}
                      </span>
                      {isDownloadingPdf && (
                        <Spinner animation="border" role="status" size="sm" />
                      )}
                    </LightPrimaryButton>
                  )}
                </>
              )}
            </DisplayStart>
          </Box>
        </DisplayBetween>
      </HeaderWrapper>
      {show && activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
        <PhotobookPreview show={show} handleClose={handleClose} />
      )}
      {show &&
        activeEditorType === EDITOR_TYPES.CANVAS &&
        canvasSize?.depth > 0 &&
        !settings?.isFoldable && (
          <CanvasPrint3D
            show={show}
            handleClose={handleClose}
            depth={canvasSize?.depth}
          />
        )}
      {show &&
        activeEditorType === EDITOR_TYPES.CALENDER &&
        zoomRatio &&
        settings &&
        settings.subtype !== EDITOR_SUB_TYPES.CALENDER.WALL_CALENDER &&
        !settings?.isFoldable && (
          <Calendar3D
            show={show}
            handleClose={handleClose}
            cal_settings={settings}
            zoomRatio={zoomRatio}
          />
        )}
      {show &&
        activeEditorType === EDITOR_TYPES.CALENDER &&
        zoomRatio &&
        settings &&
        settings.subtype === EDITOR_SUB_TYPES.CALENDER.WALL_CALENDER &&
        !settings?.isFoldable && (
          <WallPreview show={show} handleClose={handleClose} />
        )}
      {show &&
        activeEditorType === EDITOR_TYPES.ACRYLIC &&
        settings.subtype === EDITOR_SUB_TYPES.ACRYLIC.WALL &&
        !settings?.isFoldable && (
          <WallPreview show={show} handleClose={handleClose} />
        )}
      {show &&
        activeEditorType === EDITOR_TYPES.ACRYLIC &&
        settings.subtype === EDITOR_SUB_TYPES.ACRYLIC.TABLE &&
        !settings?.isFoldable && (
          <AcralicPrint3D
            show={show}
            handleClose={handleClose}
            subtype={settings.subtype}
          />
        )}
      {show &&
        settings?.isFoldable &&
        settings?.isFoldable === true &&
        activeEditorType !== EDITOR_TYPES.PHOTOBOOK && (
          <FoldingLayoutPreview show={show} handleClose={handleClose} />
        )}

      {showEditorSettngs && (
        <EditorSettings
          show={showEditorSettngs}
          handleClose={handleSettingClose}
        ></EditorSettings>
      )}
      {showSizeSettings && (
        <SizeSettingsPopup
          handleClose={handleSettingClose}
          saveTheme={saveAsTheme}
        ></SizeSettingsPopup>
      )}
      {/* Optimistic placement: wait for placed uploads before save/order/export */}
      <Modal
        show={!!uploadGateAction}
        centered
        backdrop="static"
        keyboard={false}
        size="sm"
      >
        <Modal.Body className="text-center py-4">
          {failedPlacedCount > 0 ? (
            <>
              <p className="mb-1 fw-semibold" style={{ fontSize: "15px" }}>
                {failedPlacedCount} placed photo{failedPlacedCount !== 1 ? "s" : ""} failed to upload
              </p>
              <p className="text-muted mb-3" style={{ fontSize: "13px" }}>
                “{uploadGateAction?.label}” needs every placed photo uploaded.
                Retry now, or replace/remove the failed photos on the canvas.
              </p>
              <div className="d-flex gap-2 justify-content-center">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={retryFailedPlacedUploads}
                >
                  Retry failed uploads
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setUploadGateAction(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <Spinner animation="border" size="sm" className="mb-2" />
              <p className="mb-1 fw-semibold" style={{ fontSize: "15px" }}>
                Finishing {pendingPlacedCount} upload{pendingPlacedCount !== 1 ? "s" : ""}…
              </p>
              <p className="text-muted mb-3" style={{ fontSize: "13px" }}>
                “{uploadGateAction?.label}” will continue automatically.
              </p>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setUploadGateAction(null)}
              >
                Cancel
              </button>
            </>
          )}
        </Modal.Body>
      </Modal>
      {/* In-app name prompt (replaces window.prompt(), unsupported in Electron) */}
      <Modal
        show={!!namePrompt}
        onHide={() => closeNamePrompt(null)}
        centered
      >
        <Modal.Body className="py-4">
          <p className="mb-2 fw-semibold" style={{ fontSize: "14px" }}>
            {namePrompt?.message}
          </p>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              closeNamePrompt((namePrompt?.value || "").trim());
            }}
          >
            <Form.Control
              autoFocus
              type="text"
              value={namePrompt?.value || ""}
              onChange={(e) =>
                setNamePrompt((current) =>
                  current ? { ...current, value: e.target.value } : current
                )
              }
            />
            <div className="d-flex gap-2 justify-content-end mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => closeNamePrompt(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                OK
              </button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      {showExportOptions && (
        <ExportOptionsPopup
          show={showExportOptions}
          onHide={() => setShowExportOptions(false)}
          onExport={handleExportOptions}
        />
      )}
      {/* PDF Export popup for customers when is_downloadable is true */}
      {showPdfExport && (
        <ExportOptionsPopup
          show={showPdfExport}
          onHide={() => setShowPdfExport(false)}
          onExport={handleCustomerPdfExport}
          pdfOnly={true}
        />
      )}
      {/* notice confirmation model */}
      <NoticeConfirmationPopup
        show={showNotice}
        uneditedPages={uneditedPages}
        handleClose={() => {
          if (uneditedPages.length > 0) {
            // If unedited pages dialog, just close
            setShowNotice(false);
            setUneditedPages([]);
          } else {
            // If canvas errors dialog, navigate to errors
            let errorIndex = menuItems.findIndex(
              (item) => item.title === "Errors"
            );
            dispatch(setActiveActionIndex(errorIndex));
            dispatch(setIsActionActive(true));
            setShowNotice(false);
          }
        }}
        isOrdering={isOrdering}
        onOrder={(confirm) => {
          orderProject(confirm);
        }}
      />

      {/* Save Theme Confirmation Dialog */}
      <ConfirmationDialog
        show={showSaveThemeDialog}
        onClose={() => setShowSaveThemeDialog(false)}
        onConfirm={confirmSaveTheme}
        title={
          saveAsNewThemeFlag
            ? (isThemeSaved ? "Clone Theme" : "Save as New Theme")
            : (isThemeSaved ? "Update Theme" : "Save Theme")
        }
        message={
          saveAsNewThemeFlag
            ? "Create a copy of this theme with a new name."
            : (isThemeSaved
              ? "Update the existing theme with current changes."
              : "Save this design as a new theme.")
        }
        confirmText={
          saveAsNewThemeFlag
            ? (isThemeSaved ? "Clone" : "Save as New")
            : (isThemeSaved ? "Update" : "Save")
        }
        cancelText="Cancel"
        loading={isSavingTheme}
        showInput={true}
        inputLabel="Theme Name"
        inputPlaceholder="Enter theme name..."
        inputValue={themeNameInput}
        inputRequired={true}
      />

      {/* Create Theme Dialog - Shows when no theme ID exists or when creating new theme */}
      <CreateThemeDialog
        show={showCreateThemeDialog}
        onClose={handleCreateThemeClose}
        isNewTheme={isNewThemeDialog}
        onThemeCreated={handleThemeCreated}
      />
    </>
  );
};
