import React, { useEffect, useRef, useState, useCallback } from "react";
import { useFontContext } from "../../library/utils/context/FontContext.jsx";
import { ImSpinner2 } from "react-icons/im";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  addObjectInPage,
  setActiveObject,
  setActiveObjects,
  setCurrentObjectProperties,
  setZoom,
  setCanvasScale,
  setActiveSide,
  changeObjectInPage,
  removeObjectInPage,
  copyObject,
  pasteObject,
  setPageNumber,
  setActiveSafeArea,
  deSelectSafeArea,
  removeSafeArea,
  setShowSafeAreaGuidePopup,
  setSettings,
  setActiveActionIndex,
  deSelectActiveObject,
  selectAllObjects,
  removeMultipleObjectsInPage,
} from "../../store/slices/canvas";
import {
  closeMagicWrite,
  setIsMultiSelectMode,
} from "../../store/slices/appAlice";
import { MagicWritePanel } from "../../tools/text/magic-write/MagicWritePanel";
import {
  getActiveEditorType,
  getAllPages,
  getZoom,
  getCanvasSize,
  getActiveObject,
  getActiveObjects,
  getDragger,
  getCurrentActivePageObjects,
  getCurrentPageIndex,
  getCanvasScale,
  getAllObjectsSortedByZIndex,
  getAllObjectsSortedByZIndexByPageIndex,
  getCurrentActivePageSide,
  getActiveObjectprops,
  getCalendarSettings,
  getSettings,
  getPageSettings,
  getSafeAreas,
  getActiveSafeArea,
  getAllSafeAreaObjects,
  getSafeAreaFromPage,
  getSafeAreaGuideStatus,
  getTotalSafeAreaCount,
  getBillablePages,
} from "../../library/utils/helpers";
import { preloadImages, pickVariantUrl, queryLiveImageEls, applyLiveImageTransformEls } from "../../library/utils/image/progressiveImage";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";
import Text from "./Text";
import ItemDragger from "./ItemDragger";
import Photo from "./Photo";
import PhotoTest from "./PhotoTest";
import Sticker from "./Sticker";
import QRCode from "./QRCode";
import StickerTest from "./StickerTest";
import Shape from "./Shape";
import CanvasLayout from "../canvas-print-layout/CanvasLayout.jsx";
import {
  getResolutionScaleValue,
  calculateZoomRatio,
  hasAnyClass,
  handleImageUploadLimit,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_MB,
} from "../../library/utils/common-functions";
import { toast } from "react-toastify";
import {
  EDITOR_SUB_TYPES,
  EDITOR_TYPES,
  USER_TYPES,
} from "../../library/utils/constants/index.js";
import useExportPages from "../../library/utils/custom-hooks/useExportPages";
import {
  setSvgData,
  setStartExport,
  setInitilized,
  setCurrentPageSVG,
  setFirstPageSVG,
  setAllPagesCaptured,
  setIsCapturingPages,
  setCaptureProgress,
} from "../../store/slices/svgData";
import DynamicCalendar from "../calendar/DynamicCalendar";
import { Fontfamilies } from "../../library/utils/jsons/commonJSON";
import { Page } from "openai/pagination.mjs";
import MultipleDynamicCalendar from "../../components/calendar/MultipleDynamicCalendar";
import Moveable from "react-moveable";
import SafeAreaDragger from "./SafeAreaDragger";
import SafeAreaPopup from "../../components/popups/SafeAreaPopup";
import CanvasRulers from "./CanvasRulers";
import { ProgressModal, ElapsedTime } from "../../common-components/ProgressModal.jsx";
import { usePdfExport } from "../../contexts/PdfExportContext.jsx";
import { isDesktop } from "../../desktop";
import { debug } from "openai/core";
import {
  refreshProjectImages,
  setLimitReached,
} from "../../store/slices/imageUpload";
import { selectProcessingStatus } from "../../store/slices/aiKidsPhotobookSlice";
import { v4 as uuidv4 } from "uuid";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { apiMultiPartPost, getUserDetails } from "../../library/utils/common-services/apiCall";
import {
  createPageRenderWaiter,
  preparePagesToCapture,
} from "../../library/utils/canvas/captureHelpers";
import { uploadImageOptimized } from "../../library/utils/upload/uploadManager";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import useCachedUrl from "../../hooks/useCachedUrl";

// Canvas is always rendered slightly smaller so there's permanent gutter on all
// sides for the measurement rulers (CanvasRulers). Applied unconditionally so
// toggling the ruler never resizes the canvas (no blink). Tune here if needed.
const RULER_RESERVE_SCALE = 0.95;

/**
 * Thin wrapper around <image> that resolves the href through the local image
 * cache so background images display correctly when the app is offline.
 */
const CachedSvgImage = ({ href, ...props }) => {
  const resolvedHref = useCachedUrl(href);
  return <image href={resolvedHref} {...props} />;
};

const MainCanvas = ({ isToolPanelOpen = false }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const { getFontByName } = useFontContext();
  const exportPageSVG = useExportPages({ runForPreview: false });
  // Centered export-progress dialog for the editor (JPEG/PNG/PDF/ZIP). The 3D
  // preview flows render their own <ProgressModal>, so this one is gated to the
  // non-preview export to avoid two modals stacking.
  const { exportProgress } = usePdfExport();

  const [showSafeAreaGuideFirstTime, setShowSafeAreaGuideFirstTime] =
    useState(false);
  const [notShowSelectedPage, setNotShowSelectedPage] = useState(false);
  const [isDeviceFileUploading, setIsDeviceFileUploading] = useState(false);
  // Multi-select mode: when ON every object click acts like Shift+click (adds to selection).
  // Enabled by the canvas toggle button or by a long-press gesture on mobile.
  const isMultiSelectMode = useSelector(
    (state) => state.appSlice.isMultiSelectMode
  );
  // Ref so that touch/mouse closures always read the latest value without stale captures.
  const isMultiSelectModeRef = useRef(false);

  const Pages = useSelector(getAllPages);
  const svgData = useSelector((state) => state.svgData);
  const isPreviewActive = useSelector(
    (state) => state.appSlice.isDisplayPreview
  );

  const zoomRatio = useSelector(getZoom);
  const canvasScale = useSelector(getCanvasScale);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const currentActivePageObjects = useSelector(getCurrentActivePageObjects);
  const activeObject = useSelector(getActiveObject);
  const activeObjects = useSelector(getActiveObjects);
  const isDragger = useSelector(getDragger);
  const getActiveCanvasObjProps = useSelector(getActiveObjectprops);
  const activeSide = useSelector(getCurrentActivePageSide);
  const activePage = Pages[currentActivePageNumber];
  const canvasSize = useSelector(getCanvasSize);
  const activeEditorType = useSelector(getActiveEditorType);
  const calendarSettings = useSelector(getCalendarSettings);
  const wrapperRef = useRef(null);
  const allObjects = useSelector(getAllObjectsSortedByZIndex);

  // Preload (warm the browser cache for) the current page's images AND its
  // neighbors so the canvas paints without waiting on the network at display
  // time, and flipping to the next/prev page is download-free. Keyed on the
  // page index + page count only — NOT on Pages identity — so it does not
  // re-run on every drag/edit frame. The live URLs in Redux are untouched.
  useEffect(() => {
    if (!Array.isArray(Pages) || Pages.length === 0) return;
    const urls = [];
    const collectPage = (pageIdx) => {
      const page = Pages[pageIdx];
      if (!page || !Array.isArray(page.layout)) return;
      for (const layout of page.layout) {
        if (!layout) continue;
        for (const key of ["objects", "safeAreaObjects"]) {
          const list = layout[key];
          if (!Array.isArray(list)) continue;
          for (const obj of list) {
            if (obj && obj.type === "img" && (obj.url || obj.urls)) {
              const u = pickVariantUrl(obj);
              if (u) urls.push(u);
            }
          }
        }
      }
    };
    collectPage(currentActivePageNumber); // highest priority: what's on screen
    collectPage(currentActivePageNumber + 1); // next page → instant forward nav
    collectPage(currentActivePageNumber - 1); // prev page → instant back nav
    preloadImages(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActivePageNumber, Pages.length]);

  const svgRef = useRef(null);
  const pageRenderWaiterRef = useRef(null);
  const outerRef = useRef(null);
  const [isCover, setIsCover] = useState(false); // in photobook we are goign to display 2 pages at a time left and right. and cover always be half size of canvas size in width, so we will devide canvassize width by 2 to get cover page
  const isThemeApplied = useSelector(
    (state) => state.projectSetup.isThemeApplied
  );
  const settings = useSelector(getSettings);
  const isCircularShape = (activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && (settings?.shape === "circle" || canvasSize?.shape === "circle");
  const userDetails = localStorage.getItem("userDetails");
  const user = useSelector((state) => state.projectSetup.userDetails);
  const { waterMarkData, waterMarkColor, isPreviewBook } = useSelector(
    (state) => state.svgData
  );
  const safeAreas = useSelector(getSafeAreas);
  const activeSafeArea = useSelector(getActiveSafeArea);
  const allSafeAreaObjects = useSelector(getAllSafeAreaObjects);
  const showSafeAreaGuide = useSelector(getSafeAreaGuideStatus);
  const totalSafeAreaCount = useSelector(getTotalSafeAreaCount);
  const currentPageSettings = useSelector(getPageSettings);
  const faceSwapProcessStatus = useSelector(selectProcessingStatus);
  const showMagicWrite = useSelector((state) => state.appSlice.showMagicWrite);
  const magicWriteMode = useSelector((state) => state.appSlice.magicWriteMode);
  const billablePages = useSelector(getBillablePages);

  // Month page index calculation to compensate for cover page
  const monthPageIndex = calendarSettings?.addCover ? Math.max(0, currentActivePageNumber - 1) : currentActivePageNumber;

  const canUndo = useSelector((state) => state.canvas.past.length > 0);
  const canRedo = useSelector((state) => state.canvas.future.length > 0);
  const canUndoRef = useRef(canUndo);
  const canRedoRef = useRef(canRedo);

  useEffect(() => {
    canUndoRef.current = canUndo;
    canRedoRef.current = canRedo;
  }, [canUndo, canRedo]);

  // Keep the ref in sync with state so event-handler closures read fresh value
  useEffect(() => { isMultiSelectModeRef.current = isMultiSelectMode; }, [isMultiSelectMode]);

  // Auto-exit multi-select mode when nothing is selected
  useEffect(() => {
    if (activeObjects.length === 0 && isMultiSelectMode) {
      dispatch(setIsMultiSelectMode(false));
    }
  }, [activeObjects.length, dispatch, isMultiSelectMode]);

  // ── Marquee (drag-to-select) ────────────────────────────────────────────
  const selectionRectRef    = useRef(null);   // SVG <rect> element (inside canvas)
  const outerMarqueeRef     = useRef(null);   // HTML <div> overlay (outside canvas)
  const pagesOuterRef       = useRef(null);   // .pages-outer scroll container
  const canvasBoxRef        = useRef(null);   // .canvas-box (zoomed page wrapper)
  const selStartRef         = useRef(null);   // { x, y } in canvas coords
  const outerSelStartRef    = useRef(null);   // { clientX, clientY } for outer drag
  const isDraggingSelRef    = useRef(false);
  const zoomRatioRef        = useRef(zoomRatio);
  useEffect(() => { zoomRatioRef.current = zoomRatio; }, [zoomRatio]);
  const canvasScaleRef      = useRef(canvasScale);
  useEffect(() => { canvasScaleRef.current = canvasScale; }, [canvasScale]);

  // Convert viewport coords → canvas coords using the SVG's current bounding rect
  const toCanvasCoords = useCallback((clientX, clientY) => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoomRatioRef.current,
      y: (clientY - rect.top)  / zoomRatioRef.current,
    };
  }, []);

  // ── Outer rubber-band: drag-to-select starting outside the SVG canvas ───
  // Attaches to the .pages-outer scroll container so users can drag from the
  // gray area around the canvas and still select objects.
  const handleOuterSelectionStart = useCallback((e) => {
    if (e.button !== 0) return;
    // Only trigger when clicking on the background — not on the canvas itself
    // or any interactive child element (objects, buttons, etc.)
    const svgEl = svgRef.current;
    if (svgEl && svgEl.contains(e.target)) return; // click is on/inside SVG — handled by inner handler
    if (e.target.closest('button, input, select, textarea, [role="button"], .moveable-control-box')) return;

    e.preventDefault();

    const containerEl = pagesOuterRef.current;
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    outerSelStartRef.current = { clientX: startX, clientY: startY };
    let isDragging = false;

    const marquee = outerMarqueeRef.current;

    const onMove = (ev) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (!isDragging && dx < 4 && dy < 4) return;
      isDragging = true;

      if (marquee) {
        const scrollLeft = containerEl.scrollLeft;
        const scrollTop  = containerEl.scrollTop;
        const minX = Math.min(ev.clientX, startX) - containerRect.left + scrollLeft;
        const minY = Math.min(ev.clientY, startY) - containerRect.top  + scrollTop;
        const w    = Math.abs(ev.clientX - startX);
        const h    = Math.abs(ev.clientY - startY);
        marquee.style.display = "block";
        marquee.style.left    = `${minX}px`;
        marquee.style.top     = `${minY}px`;
        marquee.style.width   = `${w}px`;
        marquee.style.height  = `${h}px`;
      }
    };

    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);

      if (marquee) marquee.style.display = "none";
      outerSelStartRef.current = null;

      if (!isDragging) {
        dispatch(deSelectActiveObject());
        return;
      }

      // Convert the marquee bounds (client coords) to canvas coords via toCanvasCoords
      const selMinX = Math.min(ev.clientX, startX);
      const selMaxX = Math.max(ev.clientX, startX);
      const selMinY = Math.min(ev.clientY, startY);
      const selMaxY = Math.max(ev.clientY, startY);

      const topLeft     = toCanvasCoords(selMinX, selMinY);
      const bottomRight = toCanvasCoords(selMaxX, selMaxY);

      const state   = store.getState();
      const objects = getAllObjectsSortedByZIndex(state);

      const selected = objects.filter((obj) => {
        const ox = obj.transform?.x ?? 0;
        const oy = obj.transform?.y ?? 0;
        return ox < bottomRight.x && (ox + obj.width)  > topLeft.x &&
               oy < bottomRight.y && (oy + obj.height) > topLeft.y;
      }).map((obj) => ({ id: obj.id, areaType: obj.areaType || "normal" }));

      if (selected.length > 0) dispatch(setActiveObjects(selected));
      else                      dispatch(deSelectActiveObject());
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [dispatch, store, toCanvasCoords]);

  // Long-press refs for mobile multi-select initiation
  const longPressTimerRef = useRef(null);

  // Called by object <g> elements on touchstart — supports long-press to enter multi-select mode
  const handleObjectTouchStart = useCallback((e, id, areaType) => {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      dispatch(setIsMultiSelectMode(true));
      const target = document.querySelector(`g[data-id-t="${id}"]`);
      dispatch(setActiveObject({ e, target: target || e.currentTarget, id, history: false, areaType, isShiftPressed: true }));
    }, 500);
  }, [dispatch]);

  const handleObjectTouchEnd = useCallback((e, id, areaType, itemType, isDisabled) => {
    if (isDisabled) {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      return;
    }
    if (longPressTimerRef.current) {
      // Short tap — cancel long press and do normal select
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      setCurrentTarget(e, id, areaType, itemType);
    }
    // If long press already fired, timer is null — no action needed
  }, []);  // setCurrentTarget is stable enough (redefined each render but captures fresh state)

  const handleObjectTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Touch-based marquee handler (same logic as mouse, uses touches[0])
  const handleTouchSelectionStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    e.stopPropagation();

    const start = toCanvasCoords(touch.clientX, touch.clientY);
    selStartRef.current      = start;
    isDraggingSelRef.current = false;

    const el = selectionRectRef.current;

    const onTouchMove = (ev) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const cur = toCanvasCoords(t.clientX, t.clientY);
      const dx  = Math.abs(cur.x - selStartRef.current.x);
      const dy  = Math.abs(cur.y - selStartRef.current.y);
      if (!isDraggingSelRef.current && dx < 8 && dy < 8) return;
      isDraggingSelRef.current = true;
      ev.preventDefault();
      if (el) {
        el.setAttribute("x",      Math.min(selStartRef.current.x, cur.x));
        el.setAttribute("y",      Math.min(selStartRef.current.y, cur.y));
        el.setAttribute("width",  Math.abs(cur.x - selStartRef.current.x));
        el.setAttribute("height", Math.abs(cur.y - selStartRef.current.y));
        el.style.display = "";
      }
    };

    const onTouchEnd = (ev) => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
      if (el) el.style.display = "none";

      if (!isDraggingSelRef.current) {
        dispatch(deSelectActiveObject());
        selStartRef.current = null;
        return;
      }

      const t      = ev.changedTouches[0];
      const cur    = toCanvasCoords(t.clientX, t.clientY);
      const selMinX = Math.min(selStartRef.current.x, cur.x);
      const selMaxX = Math.max(selStartRef.current.x, cur.x);
      const selMinY = Math.min(selStartRef.current.y, cur.y);
      const selMaxY = Math.max(selStartRef.current.y, cur.y);

      const state    = store.getState();
      const objects  = getAllObjectsSortedByZIndex(state);
      const selected = objects
        .filter((obj) => {
          const ox = obj.transform?.x ?? 0;
          const oy = obj.transform?.y ?? 0;
          return ox < selMaxX && (ox + obj.width)  > selMinX &&
                 oy < selMaxY && (oy + obj.height) > selMinY;
        })
        .map((obj) => ({ id: obj.id, areaType: obj.areaType || "normal" }));

      if (selected.length > 0) dispatch(setActiveObjects(selected));
      else                      dispatch(deSelectActiveObject());

      selStartRef.current      = null;
      isDraggingSelRef.current = false;
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend",  onTouchEnd);
  }, [dispatch, store, toCanvasCoords]);

  const handleSelectionStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const start = toCanvasCoords(e.clientX, e.clientY);
    selStartRef.current      = start;
    isDraggingSelRef.current = false;

    const el = selectionRectRef.current;

    const onMove = (ev) => {
      const cur = toCanvasCoords(ev.clientX, ev.clientY);
      const dx = Math.abs(cur.x - selStartRef.current.x);
      const dy = Math.abs(cur.y - selStartRef.current.y);
      // 4-px threshold before showing the rectangle (prevents flicker on click)
      if (!isDraggingSelRef.current && dx < 4 && dy < 4) return;
      isDraggingSelRef.current = true;

      if (el) {
        const minX = Math.min(selStartRef.current.x, cur.x);
        const minY = Math.min(selStartRef.current.y, cur.y);
        el.setAttribute("x",      minX);
        el.setAttribute("y",      minY);
        el.setAttribute("width",  Math.abs(cur.x - selStartRef.current.x));
        el.setAttribute("height", Math.abs(cur.y - selStartRef.current.y));
        el.style.display = "";
      }
    };

    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);

      if (el) el.style.display = "none";

      if (!isDraggingSelRef.current) {
        // Plain click on empty canvas → deselect
        dispatch(deSelectActiveObject());
        selStartRef.current = null;
        return;
      }

      const cur      = toCanvasCoords(ev.clientX, ev.clientY);
      const selMinX  = Math.min(selStartRef.current.x, cur.x);
      const selMaxX  = Math.max(selStartRef.current.x, cur.x);
      const selMinY  = Math.min(selStartRef.current.y, cur.y);
      const selMaxY  = Math.max(selStartRef.current.y, cur.y);

      // Read current objects from store (fresh — avoids stale closure)
      const state    = store.getState();
      const objects  = getAllObjectsSortedByZIndex(state);

      const selected = objects.filter((obj) => {
        const ox = obj.transform?.x ?? 0;
        const oy = obj.transform?.y ?? 0;
        return ox < selMaxX && (ox + obj.width)  > selMinX &&
               oy < selMaxY && (oy + obj.height) > selMinY;
      }).map((obj) => ({ id: obj.id, areaType: obj.areaType || "normal" }));

      if (selected.length > 0) dispatch(setActiveObjects(selected));
      else                      dispatch(deSelectActiveObject());

      selStartRef.current      = null;
      isDraggingSelRef.current = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [dispatch, store, toCanvasCoords]);

  // Synchronize the DOM element reference when Undo/Redo drastically alters the activeObject state
  // without routing through the usual `setCurrentTarget` mouse event.
  useEffect(() => {
    if (activeObject?.id) {
      if (window.__canvasActiveObjId !== activeObject.id) {
        window.__canvasActiveObjId = activeObject.id;
        // Search the DOM for the new active element by data-id-t or equivalent class
        const targetElement = document.querySelector(`.objTarget1_${activeObject.id}`) || document.querySelector(`g[class*="${activeObject.id}"]`)?.parentElement;
        if (targetElement) {
          window.__canvasActiveObjTarget = targetElement;
        }
      }
    } else {
      window.__canvasActiveObjTarget = null;
      window.__canvasActiveObjId = null;
    }
  }, [activeObject]);

  const handleUndo = useCallback(() => {
    if (canUndoRef.current) {
      dispatch(UndoActionCreators.undo());
    }
  }, [dispatch]);

  const handleRedo = useCallback(() => {
    if (canRedoRef.current) {
      dispatch(UndoActionCreators.redo());
    }
  }, [dispatch]);

  const totalUploadedImages = useSelector(
    (state) => state.imageUpload.totalUploadedImages
  );
  const projectSetup = useSelector((state) => state.projectSetup);
  const projectId = projectSetup?.cartDetails?._id;

  const cartOrderId =
    projectSetup?.cartDetails?._id ||
    projectSetup?.cartDetails?.cart_order_id ||
    projectSetup?.project_id ||
    projectSetup?.themeDetails?.cart_order_id;

  const isAdminUser =
    user?.userTypeCode === USER_TYPES.SUPERUSER ||
    user?.userTypeCode === USER_TYPES.ADMIN ||
    user?.userTypeCode === USER_TYPES.EMPLOYEE;

  // On desktop the user always owns their local project (there may be no server
  // cartOrderId / userTypeCode), so page capture for "All Pages" export must
  // always be allowed — otherwise captureAllPagesSvg returns instantly and the
  // multi-page export silently never starts (single-page export skips this gate,
  // which is why it kept working).
  const shouldCapturePages =
    isDesktop ||
    (user?.userTypeCode === USER_TYPES.CUSTOMER && Boolean(cartOrderId)) ||
    isAdminUser;

  // Initialize page render waiter once
  if (!pageRenderWaiterRef.current) {
    pageRenderWaiterRef.current = createPageRenderWaiter();
  }

  // Notify waiter when page finishes rendering
  useEffect(() => {
    if (pageRenderWaiterRef.current) {
      // Always notify, even if objects are empty - the page still rendered
      pageRenderWaiterRef.current.notifyPageRendered(currentActivePageNumber);
    }
  }, [currentActivePageNumber, currentActivePageObjects, activePage]);


  // Ref to prevent multiple export triggers
  const exportInProgressRef = useRef(false);

  useEffect(() => {
    // Only trigger when initilized becomes true
    if (!svgData?.initilized) {
      // Reset the ref when initilized is false (export completed or cancelled)
      exportInProgressRef.current = false;
      return;
    }

    // Prevent re-triggering if already in progress
    if (exportInProgressRef.current) {
      return;
    }
    exportInProgressRef.current = true;

    const captureAllPages = svgData.exportPageType === "ALL";

    if (captureAllPages) {
      // Check if SVG content already exists (pre-captured by handleCustomerPdfExport)
      const existingSvgContent = svgData.svgContent;
      const hasExistingContent = existingSvgContent && existingSvgContent.length > 0;

      if (hasExistingContent) {
        // SVG content already captured, skip re-capture and go directly to export
        dispatch(setStartExport(true));
      } else {
        // For "ALL" pages export, use DOM capture flow
        const triggerDomCaptureAndExport = async () => {
          try {
            // Reset previous capture state so DOM capture runs fresh
            dispatch(setSvgData({ svgContent: null, pageIndex: null }));
            dispatch(setAllPagesCaptured(false));
            dispatch(setIsCapturingPages(true));

            // Call capture directly instead of waiting for useEffect to trigger
            // This eliminates the React re-render delay
            await captureAllPagesSvg(true, false);

            // Now trigger the export once
            dispatch(setStartExport(true));
          } catch (err) {
            // A failed capture must NEVER wedge the next export. If we bail here
            // without clearing these flags, `initilized` stays true, so the next
            // export click can't produce a false→true transition and this effect
            // never re-fires — the classic "export sometimes doesn't start" bug.
            // Reset everything so a fresh click works.
            dispatch(setIsCapturingPages(false));
            dispatch(setAllPagesCaptured(false));
            dispatch(setStartExport(false));
            dispatch(setInitilized(false));
            exportInProgressRef.current = false;
            toast.error("Couldn't prepare pages for export. Please try again.");
          }
        };

        triggerDomCaptureAndExport();
      }
    } else {
      // For single page export, use existing functionality (no DOM capture needed)
      const exportSinglePage = () => {
        const svg = svgRef.current;
        // Get fresh state values
        const state = store.getState();
        const pageObjects = getCurrentActivePageObjects(state);
        const pageIndex = getCurrentPageIndex(state);
        const pageSafeAreas = getSafeAreas(state);
        const wmData = state.svgData.waterMarkData;
        const wmColor = state.svgData.waterMarkColor;

        if (svg && pageObjects) {
          const objSvg = getSVGDataToExport(
            svg,
            pageIndex,
            pageSafeAreas,
            wmData,
            wmColor,
            false,
            pageObjects
          );

          // Set single page SVG data and trigger export
          dispatch(setSvgData({ svgContent: objSvg, pageIndex: pageIndex }));

          // Use setTimeout to ensure state is updated before triggering export
          setTimeout(() => {
            dispatch(setStartExport(true));
          }, 100);
        } else {
          // Canvas not ready (svg/objects missing). Release the export locks so a
          // retry produces a fresh false→true `initilized` transition instead of
          // silently wedging — otherwise the next export click does nothing.
          dispatch(setStartExport(false));
          dispatch(setInitilized(false));
          exportInProgressRef.current = false;
          toast.error("The canvas isn't ready yet. Please try exporting again.");
        }
      };

      exportSinglePage();
    }
  }, [svgData?.initilized, svgData?.exportPageType, dispatch, store]);

  useEffect(() => {
    // Skip during export to prevent interference with export flow
    const currentSvgData = store.getState().svgData;
    if (currentSvgData.initilized || currentSvgData.isCapturingPages || currentSvgData.startExport) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const svg = svgRef.current;
      if (svg && currentActivePageObjects) {
        const objSvg = getSVGDataToExport(
          svg,
          currentActivePageNumber,
          safeAreas,
          waterMarkData,
          waterMarkColor,
          false,
          currentActivePageObjects
        );
        dispatch(setCurrentPageSVG(objSvg));
        dispatch(
          setSvgData({ svgContent: objSvg, pageIndex: currentActivePageNumber })
        );
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [currentActivePageObjects, activePage, calendarSettings, store]);

  //save first page svg for project image export
  useEffect(() => {
    if (svgData && svgData.svgContent && currentActivePageNumber === 0) {
      setTimeout(() => {
        const page0Objects = getAllObjectsSortedByZIndexByPageIndex(Pages[0]);
        const svgObj = getSVGDataToExport(
          svgRef.current,
          0,
          safeAreas,
          waterMarkData,
          waterMarkColor,
          false,
          page0Objects
        );
        dispatch(setFirstPageSVG(svgObj));
      }, 1000);
    }
  }, [currentActivePageObjects, activePage, calendarSettings]);

  // Yield to the main thread between page captures.
  // Uses setTimeout (NOT requestAnimationFrame) to avoid triggering React's
  // render cycle mid-capture, which causes DOMException conflicts.
  const yieldToMainThread = (ms = 300) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // DOM-based capture of all pages (or only edited pages)
  const captureAllPagesSvg = async (forceFullCapture = false, editedPagesOnly = false) => {
    // Get fresh data from Redux store to avoid stale closure issues
    // Note: canvas uses redux-undo, so state is at canvas.present
    const state = store.getState();
    const freshPages = state.canvas.present?.pages || [];
    const freshCurrentPageNumber = state.canvas.present?.activePageIndex || 0;


    if (!shouldCapturePages) {
      console.warn(
        "[export] captureAllPagesSvg ABORTED — shouldCapturePages is false",
        { userType: user?.userTypeCode, cartOrderId, isDesktop }
      );
      dispatch(setIsCapturingPages(false));
      return;
    }

    const originalPageIndex = freshCurrentPageNumber;

    // When forcing a full capture, clear existing SVG data
    if (forceFullCapture) {
      dispatch(setSvgData({ svgContent: null, pageIndex: null }));
    }

    // Get fresh state AFTER clearing to ensure we don't filter based on stale data
    const freshState = store.getState();
    const freshExistingSvgContent = forceFullCapture ? [] : freshState.svgData.svgContent;

    // Determine which pages to capture using helper
    const freshSettings = freshState.canvas.present?.settings || {};
    const freshEditorType = freshState.canvas.present?.editorType;
    const pagesToCapture = preparePagesToCapture({
      pages: freshPages,
      editedPagesOnly,
      forceFullCapture,
      existingSvgContent: freshExistingSvgContent,
      settings: freshSettings,
      editorType: freshEditorType,
    });

    if (pagesToCapture.length === 0) {
      dispatch(setAllPagesCaptured(true));
      dispatch(setIsCapturingPages(false));
      return;
    }

    // Build SVG array locally — do NOT dispatch during capture to avoid
    // triggering React re-renders that conflict with page switching.
    const capturedSvgs = [];

    // Initialize capture progress
    dispatch(setCaptureProgress({ currentPage: 0, totalPages: pagesToCapture.length }));

    // Capture each page sequentially
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    for (let idx = 0; idx < pagesToCapture.length; idx++) {
      const i = pagesToCapture[idx];
      const isCurrentPage = i === originalPageIndex;

      // Switch to target page
      const canSkipSwitch = isCurrentPage && idx === 0;

      if (!canSkipSwitch) {
        dispatch(setPageNumber(i));

        // Wait for the page render notification from useEffect
        await pageRenderWaiterRef.current.waitForPageRender(i);
      }

      // Yield to main thread so browser can GC between pages
      await yieldToMainThread();

      // Additional settling delay for DOM
      const renderDelay = canSkipSwitch ? 50 : (isMobile ? 300 : 150);
      await new Promise((resolve) => setTimeout(resolve, renderDelay));

      // Wait for any images in the SVG to load
      const svg = svgRef.current;

      if (svg) {
        const images = svg.querySelectorAll('image, img');

        if (images.length > 0) {
          await Promise.all(
            Array.from(images).map((img) => {
              return new Promise((resolve) => {
                if (img.complete || img.naturalWidth > 0) {
                  resolve();
                } else {
                  img.onload = resolve;
                  img.onerror = resolve;
                  const imageTimeout = isMobile ? 1500 : 500;
                  setTimeout(resolve, imageTimeout);
                }
              });
            })
          );
        }

        // Get fresh page data from store for this specific page
        const currentState = store.getState();
        const currentPage = currentState.canvas.present?.pages[i];
        const pageSafeAreas = getSafeAreaFromPage(currentPage);
        const pageObjects = getAllObjectsSortedByZIndexByPageIndex(currentPage);

        const objSvg = getSVGDataToExport(
          svg,
          i,
          pageSafeAreas,
          waterMarkData,
          waterMarkColor,
          false,
          pageObjects
        );

        // Dispatch incrementally to free memory from `capturedSvgs` array
        dispatch(setSvgData({ svgContent: objSvg, pageIndex: i }));

        // Update capture progress (this is safe — it only updates a counter)
        dispatch(setCaptureProgress({ currentPage: idx + 1, totalPages: pagesToCapture.length }));

        // Aggressive GC yield after each heavy serialize
        await new Promise((resolve) => setTimeout(resolve, 0));
        await yieldToMainThread();
      } else {
      }
    }

    // Return to original page BEFORE dispatching SVGs
    if (originalPageIndex !== undefined && originalPageIndex !== null) {
      dispatch(setPageNumber(originalPageIndex));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Mark capture as complete
    dispatch(setAllPagesCaptured(true));
    dispatch(setIsCapturingPages(false));
    dispatch(setCaptureProgress({ currentPage: 0, totalPages: 0 }));
  };

  // Expose captureAllPagesSvg to window for direct access from other components
  // This eliminates the need for the isCapturingPages watcher useEffect
  useEffect(() => {
    if (shouldCapturePages) {
      window.__canvasCaptureAllPages = async (editedPagesOnly = false) => {
        dispatch(setIsCapturingPages(true));
        await captureAllPagesSvg(true, editedPagesOnly);
        return true;
      };
    }

    return () => {
      delete window.__canvasCaptureAllPages;
    };
  }, [shouldCapturePages]);

  // without clipPath
  // const getSVGDataToExport = (svg, index) => {
  //   let svgContent = svg.cloneNode(true);

  //   // hide not exportable objects
  //   const classesToHide = ["not-exportable"];
  //   classesToHide.forEach((cls) => {
  //     const elements = svgContent.querySelectorAll(`.${cls}`);
  //     elements.forEach((el) => el.setAttribute("style", "display:none"));
  //   });

  //   svgContent.setAttribute("width", svg.viewBox.baseVal.width);
  //   svgContent.setAttribute("height", svg.viewBox.baseVal.height);
  //   // Remove the element with the class name 'drag-icon'
  //   const dragIconElements = svgContent.querySelectorAll(".drag-icon");
  //   dragIconElements.forEach((element) => element.remove());
  //   svgContent = new XMLSerializer().serializeToString(svgContent);
  //   const fonts = currentActivePageObjects
  //     ?.filter((item) => item.type === "text")
  //     ?.map((item) => item.font);

  //   // we need to find font family from text objects and add them to fonts array
  //   // llop through fonts and add them to new array
  //   const allFonts = [];

  //   fonts?.forEach((font) => {
  //     const fontFamily = font.family;
  //     let fontWeight = font.weight;
  //     if (fontWeight.toLowerCase() === "normal") {
  //       fontWeight = "300";
  //     }
  //     const fontObj = {
  //       name: fontFamily,
  //       weights: fontWeight ? fontWeight : "300",
  //     };
  //     allFonts.push(fontObj);
  //   });
  //   if (calendarSettings && calendarSettings.fontFamily) {
  //     const cal_font = calendarSettings.fontFamily;

  //     let cal_font_weight = calendarSettings.fontWeight;
  //     if (cal_font_weight === undefined) {
  //       let newREc = Fontfamilies.find((x) => x.value === cal_font);
  //       if (newREc && newREc.fw && newREc.fw.length > 0) {
  //         cal_font_weight = newREc.fw[0].value;
  //       }
  //     }

  //     const fontObj = {
  //       name: cal_font,
  //       weights: cal_font_weight ? cal_font_weight : "300",
  //     };
  //     allFonts.push(fontObj);
  //     //fonts.push(cal_font);
  //   }
  //   const objSvg = {
  //     svgContent: svgContent,
  //     pageIndex: index,
  //     metadata: null,
  //     width: svg.viewBox.baseVal.width,
  //     height: svg.viewBox.baseVal.height,
  //     fonts: allFonts,
  //   };
  //   return objSvg;
  // };

  // with clipPath

  // with safe areas
  const getSVGDataToExport = (
    svg,
    index,
    safeAreas = [],
    waterMarkData,
    waterMarkColor,
    includeGuides = true,
    pageObjects = null,
  ) => {
    // Guard against null svg
    if (!svg) {
      return { fullSvg: "", safeAreasData: [] };
    }

    let svgClone = svg.cloneNode(true);

    // Hide non-exportable objects
    const classesToHide = ["not-exportable"];
    // Hide spine guide lines unless exportSpine is enabled
    if (!settings?.exportSpine) {
      classesToHide.push("photobook-spine-area");
      classesToHide.push("photobook-spine-bg");
    }
    if (!includeGuides) {
      classesToHide.push("print-guides");
    }

    classesToHide.forEach((cls) => {
      svgClone
        .querySelectorAll(`.${cls}`)
        .forEach((el) => el.setAttribute("style", "display:none"));
    });

    // Remove drag icons
    svgClone.querySelectorAll(".drag-icon").forEach((el) => el.remove());

    
    // The export backend rasterizes this SVG by loading it in a headless browser
    // and screenshotting it. The live canvas <img> carries `decoding="async"`
    // (added for display perf), which lets that screenshot fire BEFORE off-screen /
    // below-the-fold images finish decoding — so on a large spread every photo that
    // isn't near the top-left exported BLANK (only the top-left image survived).
    // This is THE regression behind "only one image exports" after the image
    // pipeline change, and it is empirically reproducible against the export API.
    // Strip the attribute on the export clone so every image decodes synchronously
    // and is painted before capture. The live canvas DOM is untouched (keeps async).
    svgClone
      .querySelectorAll("img[decoding]")
      .forEach((imgEl) => imgEl.removeAttribute("decoding"));

    // Progressive display swaps the on-screen photo <img src> down to small/medium
    // variants for fast paint. The exported / saved SVG (used for print AND the
    // project thumbnail) must ALWAYS embed the full-res `large` URL, so rewrite each
    // photo <img> in the clone back to its large variant looked up from the page
    // data by data-id. (Stickers/backgrounds don't go through progressive loading,
    // so they already carry their full-res URL.) Display-only DOM is untouched.
    //
    // SELF-SUFFICIENT: some export paths (exportAsImage / exportCurrentPageAsJPG)
    // don't pass `pageObjects`, so we derive them from the store by `index` when
    // absent. Without this the rewrite is skipped and the exported photo is the
    // CURRENTLY DISPLAYED variant — which for desktop reference-mode photos is the
    // SMALL thumbnail (they carry only small + original), i.e. a low-res export.
    let objectsForRewrite = pageObjects;
    if (!Array.isArray(objectsForRewrite) || !objectsForRewrite.length) {
      const pg = store.getState()?.canvas?.present?.pages?.[index];
      objectsForRewrite = pg ? getAllObjectsSortedByZIndexByPageIndex(pg) : null;
    }
    if (Array.isArray(objectsForRewrite) && objectsForRewrite.length) {
      const largeUrlById = new Map();
      objectsForRewrite.forEach((obj) => {
        if (!obj || obj.type !== "img" || !obj.id) return;
        const largeFromUrls =
          Array.isArray(obj.urls) &&
          obj.urls.find((u) => u && u.size === "large" && u.url)?.url;
        const largeUrl = largeFromUrls || obj.url;
        if (largeUrl) largeUrlById.set(obj.id, largeUrl);
      });
      svgClone
        .querySelectorAll("img.page_photo_item[data-id]")
        .forEach((imgEl) => {
          const largeUrl = largeUrlById.get(imgEl.getAttribute("data-id"));
          if (largeUrl) imgEl.setAttribute("src", largeUrl);
        });
    }

    const viewBox = svg.viewBox.baseVal;
    const canvasWidth = viewBox.width;
    const canvasHeight = viewBox.height;

    // Ensure content is clipped to the canvas area
    const SVG_NS = "http://www.w3.org/2000/svg";
    const defsExists = svgClone.querySelector("defs") || svgClone.insertBefore(document.createElementNS(SVG_NS, "defs"), svgClone.firstChild);
    const clipPathId = `canvasClip-${index}`;

    // Remove existing clipPath with same id to avoid duplicates
    const existingClip = svgClone.querySelector(`#${clipPathId}`);
    if (existingClip) {
      existingClip.remove();
    }

    const clipPathEl = document.createElementNS(SVG_NS, "clipPath");
    clipPathEl.setAttribute("id", clipPathId);

    if (isCircularShape) {
      const clipEllipse = document.createElementNS(SVG_NS, "ellipse");
      clipEllipse.setAttribute("cx", canvasWidth / 2);
      clipEllipse.setAttribute("cy", canvasHeight / 2);
      clipEllipse.setAttribute("rx", canvasWidth / 2);
      clipEllipse.setAttribute("ry", canvasHeight / 2);
      clipPathEl.appendChild(clipEllipse);
    } else {
      const clipRect = document.createElementNS(SVG_NS, "rect");
      clipRect.setAttribute("x", "0");
      clipRect.setAttribute("y", "0");
      clipRect.setAttribute("width", canvasWidth);
      clipRect.setAttribute("height", canvasHeight);
      clipPathEl.appendChild(clipRect);
    }
    defsExists.appendChild(clipPathEl);

    if (isCircularShape) {
      svgClone.setAttribute("clip-path", `url(#${clipPathId})`);
    }

    // === 1. Full SVG export ===
    // Set dimensions directly on svgClone (no second cloneNode needed)
    svgClone.setAttribute("width", canvasWidth);
    svgClone.setAttribute("height", canvasHeight);

    if (isPreviewBook && user?.userTypeCode === USER_TYPES.CUSTOMER) {
      const SVG_NS = "http://www.w3.org/2000/svg";
      const textEl = document.createElementNS(SVG_NS, "text");

      textEl.setAttribute("x", canvasWidth / 2);
      textEl.setAttribute("y", canvasHeight / 2);
      textEl.setAttribute("font-size", "200");
      textEl.setAttribute("font-weight", "400");
      textEl.setAttribute("fill", waterMarkColor);
      textEl.setAttribute("fill-opacity", "0.5");
      textEl.setAttribute("text-anchor", "middle");
      textEl.setAttribute(
        "transform",
        `rotate(-30 ${canvasWidth / 2} ${canvasHeight / 2})`
      );
      textEl.setAttribute("style", "pointer-events:none; user-select:none;");
      textEl.textContent = waterMarkData;
      svgClone.appendChild(textEl);
    }

    // For circular shapes, ensure transparent background outside the ellipse clip
    if (isCircularShape) {
      svgClone.setAttribute("style", "background:transparent");
    }

    const fullSvgSerialized = new XMLSerializer().serializeToString(svgClone);

    // === 2. Safe area specific crops (skip for preview exports — not needed in PDF) ===
    const safeAreaImages = isPreviewBook ? [] : safeAreas.map((safeArea, i) => {
      const { left, top, width, height } = safeArea;

      const safeSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      safeSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      safeSvg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
      safeSvg.setAttribute("width", width);
      safeSvg.setAttribute("height", height);

      // Add the original children inside the new svg
      Array.from(svgClone.childNodes).forEach((node) => {
        safeSvg.appendChild(node.cloneNode(true));
      });

      return {
        safeAreaId: safeArea.id,
        svgContent: new XMLSerializer().serializeToString(safeSvg),
        width,
        height,
      };
    });

    // Fonts - use passed pageObjects or fall back to currentActivePageObjects
    const objectsToUse = pageObjects || currentActivePageObjects;
    const fonts = objectsToUse
      ?.filter((obj) => obj.type === "text")
      .map((obj) => obj.font);
    const allFonts = [];

    // Extract fonts from objects if available
    if (fonts && fonts.length > 0) {
      fonts.forEach((font) => {
        // Find the font in Fontfamilies to get available weights
        const fontData = Fontfamilies.find(
          (f) => f.value === font.family || f.name === font.family
        );

        let fontWeight = font.weight;

        // If font data exists, validate the weight
        if (fontData?.fw?.length) {
          const weightStr = String(fontWeight || "");
          const isWeightSupported = fontData.fw.some(
            (fw) => String(fw.value) === weightStr
          );

          // If weight not supported, use first available weight
          if (!isWeightSupported) {
            fontWeight = fontData.fw[0].value;
          }
        } else {
          // Fallback if font not found in Fontfamilies
          fontWeight = fontWeight || "400";
        }

        // Resolve font_id/style_id from FontContext registry if missing on the object
        let fontId = font.id || font.fontId || null;
        let styleId = font.styleId || null;
        if (!fontId || !styleId) {
          const resolved = getFontByName(font.family);
          if (resolved) {
            if (!fontId) fontId = resolved.fontId;
            if (!styleId) {
              const w = parseInt(font.weight, 10) || 400;
              const s = font.style || "normal";
              const match = resolved.styles?.find((st) => st.weight === w && st.style === s)
                || resolved.styles?.find((st) => st.weight === w)
                || (resolved.styles?.length > 0 ? resolved.styles[0] : null);
              if (match?.styleId) styleId = match.styleId;
            }
          }
        }

        allFonts.push({
          name: font.family,
          weights: String(fontWeight),
          font_id: fontId,
          style_id: styleId,
        });
      });
    }

    if (calendarSettings?.fontFamily) {
      let calFontWeight = calendarSettings.fontWeight;
      if (!calFontWeight) {
        const found = Fontfamilies.find(
          (f) => f.value === calendarSettings.fontFamily
        );
        calFontWeight = found?.fw?.[0]?.value || "400";
      }
      allFonts.push({
        name: calendarSettings.fontFamily,
        weights: String(calFontWeight),
      });
    }

    // If no fonts found from objects, extract from SVG content as fallback
    let finalFonts = allFonts;
    if (allFonts.length === 0) {
      const extractFontsFromSvg = require("../../library/utils/common-functions/extractFontsFromSvg").default;
      finalFonts = extractFontsFromSvg(fullSvgSerialized);
    }

    // Explicitly help GC by nullifying disconnected clone DOM structures
    let returnObj = {
      pageIndex: index,
      svgContent: fullSvgSerialized,
      width: canvasWidth,
      height: canvasHeight,
      safeAreaImages,
      fonts: finalFonts,
      shape: isCircularShape ? "circle" : "rectangle",
    };

    svgClone.remove();
    svgClone = null;

    return returnObj;
  };

  const exportAsImage = async () => {
    const totalPages = Pages.length;
    // loop thorugh all pages and export them
    // lets first clear svg data
    dispatch(
      setSvgData({
        svgContent: null,
        pageIndex: null,
        width: null,
        height: null,
        shape: null,
      })
    );
    for (let i = 0; i < totalPages; i++) {
      dispatch(setPageNumber(i));

      // Wait for 1 second before proceeding to the next iteration
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // lets get svg refrence and set svg content in store.
      const svg = svgRef.current;
      if (svg) {
        const pageSafeAreas = getSafeAreaFromPage(Pages[i]);
        const objSvg = getSVGDataToExport(
          svg,
          i,
          pageSafeAreas,
          waterMarkData,
          waterMarkColor
        );
        dispatch(setSvgData({ svgContent: objSvg, pageIndex: i }));
      }
    }
    dispatch(setStartExport(true)); // this will auto call useExportPages hook and export all pages
  };

  // export current page as jpg
  const exportCurrentPageAsJPG = () => {
    const svg = svgRef.current;
    if (svg) {
      const pageSafeAreas = getSafeAreaFromPage(Pages[currentActivePageNumber]);
      const objSvg = getSVGDataToExport(
        svg,
        currentActivePageNumber,
        pageSafeAreas,
        waterMarkData,
        waterMarkColor
      );
      dispatch(
        setSvgData({ svgContent: objSvg, pageIndex: currentActivePageNumber })
      );
    }
    dispatch(setStartExport(true)); // this will auto call useExportPages hook and export all pages
  };

  const handleLeftSideClick = useCallback(() => {
    dispatch(setActiveSide(0));
  }, [dispatch]);

  const handleRightSideClick = useCallback(() => {
    dispatch(setActiveSide(1));
  }, [dispatch]);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        activeObject &&
        activeObject.target &&
        !activeObject.target.contains(event.target) &&
        !getActiveCanvasObjProps?.isProcessing
      ) {
        if (
          hasAnyClass(event.target, [
            "rightSide",
            "leftSide",
            "pages-outer",
            "top-action-mob",
            "header-grid-mob",
            "canvas-bottom-mob",
          ])
        ) {
          dispatch(setCurrentObjectProperties(null));
        }
      }
    },
    [activeObject, getActiveCanvasObjProps, dispatch]
  );
  const handleOutsideSafeAreaClick = useCallback(
    (event) => {
      if (
        activeSafeArea &&
        activeSafeArea.target &&
        !activeSafeArea.target.contains(event.target)
      ) {
        if (
          hasAnyClass(event.target, [
            "rightSide",
            "leftSide",
            "pages-outer",
            "top-action-mob",
            "header-grid-mob",
            "canvas-bottom-mob",
          ])
        ) {
          dispatch(deSelectSafeArea());
        }
      }
    },
    [dispatch, activeSafeArea]
  );

  // also when user presess escape key then deselect the active object
  // add key event handler

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("mousedown", handleOutsideSafeAreaClick);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousedown", handleOutsideSafeAreaClick);
    };
  }, [handleClickOutside]);

  // on delete key press remove the active object
  useEffect(() => {
    const isPhotobookFullCover =
      activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet;
    // For layflat, page.settings.isHalfSheet may be missing on saved cover
    // pages (legacy saves, or settings dropped by a save/load roundtrip).
    // Fall back to page.isCoverPage when cover is enabled without full-spread.
    const isLayflatHalfCoverPage =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      !settings?.showFullCoverSheet &&
      activePage?.isCoverPage === true;
    if (
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
        ((currentActivePageNumber === 0 && !isPhotobookFullCover) ||
          currentActivePageNumber === Pages.length - 1)) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        (currentPageSettings?.isHalfSheet === true ||
          isLayflatHalfCoverPage === true ))
    ) {
      setIsCover(true);
    } else {
      setIsCover(false);
    }

    const handleKeyPress = (event) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable;

      if ((key === "delete" || key === "backspace") && !isInputFocused) {
        if (activeSafeArea) {
          dispatch(removeSafeArea());
        }
        if (activeObjects && activeObjects.length > 1) {
          dispatch(removeMultipleObjectsInPage());
          dispatch(setCurrentObjectProperties(null));
          dispatch(setIsMultiSelectMode(false));
        } else if (activeObject && activeObject.id) {
          dispatch(
            removeObjectInPage({
              id: activeObject.id,
              data: null,
              history: false,
            })
          );
          dispatch(setCurrentObjectProperties(null));
        }
      } else if (key === "escape") {
        dispatch(setCurrentObjectProperties(null));
        dispatch(deSelectSafeArea());
      } else if (key === "z" && event.ctrlKey && !isInputFocused) {
        event.preventDefault();
        handleUndo();
      } else if (key === "y" && event.ctrlKey && !isInputFocused) {
        event.preventDefault();
        handleRedo();
      } else if (key === "c" && event.ctrlKey && !isInputFocused) {
        // ── Multi-select copy ─────────────────────────────────────────────────
        if (activeObjects && activeObjects.length > 1) {
          dispatch(copyObject());
          window.__canvasCopyObjectId = "__multi__";
          // Write a unique token to OS clipboard so paste can detect external copies
          const token = `__canvas_copy_${Date.now()}__`;
          window.__canvasCopyToken = token;
          navigator.clipboard?.writeText(token).catch(() => {});

        } else if (activeObject && activeObject.id) {
          // ── Single-object copy ────────────────────────────────────────────
          const obj =
            activeObject?.areaType === "safeArea"
              ? allSafeAreaObjects.find((item) => item.id === activeObject.id)
              : currentActivePageObjects.find(
                  (item) => item.id === activeObject.id
                );
          if (obj) {
            dispatch(copyObject(obj));
            window.__canvasCopyObjectId = obj.id;
            // Write a unique token to OS clipboard so paste can detect external copies
            const token = `__canvas_copy_${Date.now()}__`;
            window.__canvasCopyToken = token;
            navigator.clipboard?.writeText(token).catch(() => {});
          }

        } else {
          // No object selected — clear flags so external content can be pasted
          window.__canvasCopyObjectId = null;
          window.__canvasCopyToken = null;
        }

      } else if (key === "v" && event.ctrlKey && !isInputFocused) {
        event.preventDefault();

        // ── Multi-object paste ────────────────────────────────────────────────
        if (window.__canvasCopyObjectId === "__multi__") {
          // Check if clipboard still holds our token (user hasn't copied something else)
          const checkAndPasteMulti = async () => {
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText === window.__canvasCopyToken) {
                dispatch(pasteObject());
                dispatch(setIsMultiSelectMode(true));
              } else {
                // Clipboard changed — treat as external paste
                pasteFromExternalClipboard();
              }
            } catch {
              // Can't read clipboard — assume our copy is still valid
              dispatch(pasteObject());
              dispatch(setIsMultiSelectMode(true));
            }
          };
          checkAndPasteMulti();
          return;
        }

        // ── Single-object or external paste ──────────────────────────────────
        pasteFromExternalClipboard();
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [dispatch, activeObject, activeObjects, getActiveCanvasObjProps, activeSafeArea]);

  // Track mouse position on canvas for paste location
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (svgRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        const isInside =
          event.clientX >= svgRect.left &&
          event.clientX <= svgRect.right &&
          event.clientY >= svgRect.top &&
          event.clientY <= svgRect.bottom;

        window.__canvasMouseInside = isInside;

        if (isInside) {
          // Calculate position relative to canvas, accounting for zoom
          const x = (event.clientX - svgRect.left) / zoomRatio;
          const y = (event.clientY - svgRect.top) / zoomRatio;
          // Store in window for access during paste
          window.__canvasMouseX = Math.max(0, Math.min(x, canvasSize.width - 100));
          window.__canvasMouseY = Math.max(0, Math.min(y, canvasSize.height - 50));
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [zoomRatio, canvasSize.width, canvasSize.height]);

  // Refs so wheel handler always reads latest values without stale closures
  const activeObjectRef = useRef(activeObject);
  useEffect(() => { activeObjectRef.current = activeObject; }, [activeObject]);
  const activeObjPropsRef = useRef(getActiveCanvasObjProps);
  useEffect(() => { activeObjPropsRef.current = getActiveCanvasObjProps; }, [getActiveCanvasObjProps]);

  // The ACTUAL active object's image, read from the live page objects (which
  // revert on Ctrl+Z). `activeObjectprops` is deliberately PRESERVED across
  // undo/redo (store.jsx), so it stays at the last-zoomed scale even after the
  // object itself reverts — using it as the zoom base made re-zoom jump back to
  // the old scale after an undo. The zoom base must come from THIS ref instead.
  const activeObjImageRef = useRef(null);
  useEffect(() => {
    const active = allObjects.find((o) => o.id === activeObject?.id);
    activeObjImageRef.current = active?.image || null;
  }, [allObjects, activeObject]);

  // Tracks whether we've taken a pre-zoom snapshot for this scroll session
  const wheelSessionActiveRef  = useRef(false);
  const wheelHistoryTimerRef   = useRef(null);
  // Accumulated image zoom state during a wheel session. Image zoom is applied
  // imperatively to the <img> DOM each tick (no per-tick redux dispatch → no
  // MainCanvas re-render → smooth on low-end) and committed to redux ONCE when
  // scrolling pauses. Holds the latest {scale, positionX, positionY} so each tick
  // accumulates from the previous one (redux isn't updated mid-gesture).
  const imageZoomLatestRef     = useRef(null);
  // Cached <img> targets for the current zoom session — queried once and reused
  // each wheel tick instead of re-scanning the DOM every tick.
  const zoomImgElsRef          = useRef(null);

  // Ctrl + Mouse Wheel → zoom selected image object in / out
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (event) => {
      const obj = activeObjectRef.current;
      const props = activeObjPropsRef.current;
      const isImageZoom = obj && obj.id && props?.type === "img" && props?.image;

      // Canvas zoom requires Ctrl; image zoom works without Ctrl
      if (!isImageZoom && !event.ctrlKey) return;

      event.preventDefault();

      // ── Canvas zoom (no image selected) ──────────────────────────────────
      if (!isImageZoom) {
        const zoomingIn = event.deltaY < 0;
        const current = canvasScaleRef.current;
        const step = 0.05;
        let next = zoomingIn ? current + step : current - step;
        next = Math.min(2, Math.max(0.3, parseFloat(next.toFixed(2))));
        if (next !== current) dispatch(setCanvasScale(next));
        return;
      }

      // NOTE: we do NOT dispatch a snapshot here. Dispatching mid-zoom re-renders
      // the image and resets its transform back to pre-zoom for a frame, fighting
      // the imperative zoom below — that was the zoom "glitter" (and it re-fired on
      // every discrete wheel step). The undo checkpoint is taken instead on the
      // pause-commit (history:true), so Ctrl+Z still restores the pre-zoom state.
      wheelSessionActiveRef.current = true;

      const image = props.image;
      // Base = accumulated step within this session, else the LIVE object image
      // (reverts on undo), else the (preserved) props image as a last resort.
      const baseImage =
        imageZoomLatestRef.current?.image || activeObjImageRef.current || image;
      const zoomingIn = event.deltaY < 0;
      const boxWidth  = props.width  * (props.transform?.scale?.x ?? 1);
      const boxHeight = props.height * (props.transform?.scale?.y ?? 1);

      // --- Cursor position relative to the image frame ---
      // Convert viewport → canvas coords → frame-local coords.
      // Object position is stored in transform.x / transform.y (not props.x/y).
      let cursorFrameX = boxWidth  / 2;   // fallback: center
      let cursorFrameY = boxHeight / 2;
      const svgEl = svgRef.current;
      if (svgEl) {
        const svgRect = svgEl.getBoundingClientRect();
        const canvasX = (event.clientX - svgRect.left) / zoomRatioRef.current;
        const canvasY = (event.clientY - svgRect.top)  / zoomRatioRef.current;
        cursorFrameX = Math.max(0, Math.min(boxWidth,  canvasX - (props.transform?.x ?? 0)));
        cursorFrameY = Math.max(0, Math.min(boxHeight, canvasY - (props.transform?.y ?? 0)));
      }

      // --- New scale ---
      let scalVal;
      if (zoomingIn) {
        scalVal = baseImage.scale + 0.1;
        if (scalVal > 15) scalVal = 15;
        scalVal = parseFloat(scalVal.toFixed(1));
      } else {
        const minCoverScale = Math.max(boxWidth / image.width, boxHeight / image.height);
        scalVal = baseImage.scale - 0.1;
        if (scalVal < minCoverScale) scalVal = minCoverScale;
        scalVal = Number(scalVal.toFixed(4));
      }

      // --- Zoom toward cursor ---
      // Keep the image-local point under the cursor fixed after scaling.
      const imageLocalX = (cursorFrameX - baseImage.positionX) / baseImage.scale;
      const imageLocalY = (cursorFrameY - baseImage.positionY) / baseImage.scale;
      let posX = cursorFrameX - imageLocalX * scalVal;
      let posY = cursorFrameY - imageLocalY * scalVal;

      // Clamp: image must fully cover the frame
      const newImageW = image.width  * scalVal;
      const newImageH = image.height * scalVal;
      if (posX > 0) posX = 0;
      if (posY > 0) posY = 0;
      if (posX + newImageW < boxWidth)  posX = boxWidth  - newImageW;
      if (posY + newImageH < boxHeight) posY = boxHeight - newImageH;

      const nextImage = { ...baseImage, scale: scalVal, positionX: posX, positionY: posY };
      // Apply the zoom IMPERATIVELY to ALL of this image's <img> elements at once —
      // the main canvas AND the footer/preview thumbnails — so the footer live
      // preview keeps updating without a per-tick redux dispatch (no MainCanvas
      // re-render → smooth on low-end). Committed to redux once on pause. Query the
      // targets ONCE per zoom session (first tick) and reuse, to avoid a per-tick
      // DOM scan.
      if (!imageZoomLatestRef.current || !zoomImgElsRef.current) {
        zoomImgElsRef.current = queryLiveImageEls(obj.id);
      }
      applyLiveImageTransformEls(zoomImgElsRef.current, nextImage, svgRef.current);
      imageZoomLatestRef.current = { image: nextImage };

      // Commit to redux ONCE when scrolling pauses. history:true here is the undo
      // checkpoint: redux-undo pushes the pre-zoom present into `past` and sets the
      // committed zoom as the new present, so a single Ctrl+Z restores pre-zoom.
      if (wheelHistoryTimerRef.current) clearTimeout(wheelHistoryTimerRef.current);
      wheelHistoryTimerRef.current = setTimeout(() => {
        const latest = imageZoomLatestRef.current;
        // Only commit if the same image is still selected (guard against the user
        // switching selection within the pause window).
        if (latest && activeObjectRef.current?.id === obj.id) {
          dispatch(
            setCurrentObjectProperties({ image: latest.image, history: true })
          );
        }
        imageZoomLatestRef.current = null;
        zoomImgElsRef.current = null; // drop cached DOM targets at session end
        wheelSessionActiveRef.current = false;
      }, 250);
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      wrapper.removeEventListener("wheel", handleWheel);
    };
  }, [dispatch]);

  // Show scrollbars only when the canvas itself genuinely overflows the
  // viewport (e.g. Ctrl+wheel zoom). Calculated, not measured: measuring DOM
  // got tripped up by react-moveable's selection chrome and SVG
  // overflow:visible, which made phantom scrollbars appear when an object was
  // dragged below the canvas. Comparing the canvas's *declared* painted size
  // (canvasSize × zoomRatio × CSS zoom) against the wrapper sidesteps both.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pagesOuter = pagesOuterRef.current;
    if (!wrapper || !pagesOuter) return;

    const update = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const cssZoom = canvasBoxRef.current
        ? parseFloat(getComputedStyle(canvasBoxRef.current).zoom) || 1
        : 1;
      const canvasW = canvasSize.width * zoomRatio * cssZoom;
      const canvasH = canvasSize.height * zoomRatio * cssZoom;
      const needsScroll =
        canvasW > wrapperRect.width + 1 ||
        canvasH > wrapperRect.height + 1;
      wrapper.classList.toggle("CanvasWrapper--overflows", needsScroll);
      pagesOuter.classList.toggle("pages-outer--overflows", needsScroll);
    };

    // Defer to next frame so any in-flight layout (panel-open transitions,
    // canvasScale change) has applied before we read getComputedStyle/Rect.
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [
    canvasSize.width,
    canvasSize.height,
    zoomRatio,
    canvasScale,
    isToolPanelOpen,
    isPreviewActive,
    currentActivePageNumber,
    activePage,
  ]);

  // Also re-check on window resize — wrapper grows/shrinks without a state change.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pagesOuter = pagesOuterRef.current;
    if (!wrapper || !pagesOuter) return;
    const onResize = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const cssZoom = canvasBoxRef.current
        ? parseFloat(getComputedStyle(canvasBoxRef.current).zoom) || 1
        : 1;
      const canvasW = canvasSize.width * zoomRatio * cssZoom;
      const canvasH = canvasSize.height * zoomRatio * cssZoom;
      const needsScroll =
        canvasW > wrapperRect.width + 1 ||
        canvasH > wrapperRect.height + 1;
      wrapper.classList.toggle("CanvasWrapper--overflows", needsScroll);
      pagesOuter.classList.toggle("pages-outer--overflows", needsScroll);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [canvasSize.width, canvasSize.height, zoomRatio]);

  const updateCanvasSize = () => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const result = getResolutionScaleValue(
        canvasSize.width,
        canvasSize.height,
        wrapper
      );
      if (result) {
        const { newWidth, newHeight } = result;
        const newZoomRatio = calculateZoomRatio(
          canvasSize.width,
          canvasSize.height,
          newWidth,
          newHeight
        );
        // dispatch(setCurrentObjectProperties(null));
        dispatch(setZoom(newZoomRatio));
      }
    }
  };

  useEffect(() => {
    const isPhotobookFullCover =
      activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet;
    // Same layflat fallback as the keyboard-handler useEffect above —
    // keep these two in sync so isCover never reads stale page settings.
    const isLayflatHalfCoverPage =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      !settings?.showFullCoverSheet &&
      activePage?.isCoverPage === true;
    if (
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
        ((currentActivePageNumber === 0 && !isPhotobookFullCover) ||
          currentActivePageNumber === Pages.length - 1)) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        (currentPageSettings?.isHalfSheet === true ||
          isLayflatHalfCoverPage))
    ) {
      setIsCover(true);
    } else {
      setIsCover(false);
    }

    // if currentActivePageNumber is 1 or last second in photobook lets set active side to 0
    dispatch(setActiveSide(0));
  }, [currentActivePageNumber, currentPageSettings, settings, Pages.length]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [Pages.length, canvasSize, activeEditorType, isToolPanelOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateCanvasSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [isPreviewActive]);

  useEffect(() => {
    if (isThemeApplied) {
      updateCanvasSize();
    }
  }, [isThemeApplied]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateCanvasSize();
    }, 500);
    return () => clearTimeout(timer);
  }, [canvasSize]);
  useEffect(() => {
    if (totalSafeAreaCount > 0 && user?.userTypeCode === USER_TYPES.CUSTOMER) {
      setShowSafeAreaGuideFirstTime(true);
    }
  }, [totalSafeAreaCount]);

  // set first safe area as active safe area in case of customer
  useEffect(() => {
    if (
      !safeAreas?.length ||
      user?.userTypeCode !== USER_TYPES.CUSTOMER
    ) {
      return;
    }

    const hasActiveAreaOnCurrentSide = safeAreas.some(
      (area) =>
        area.id === activeSafeArea?.id && area.layoutIndex === activeSide
    );

    if (hasActiveAreaOnCurrentSide) {
      return;
    }

    const targetArea =
      activeEditorType !== EDITOR_TYPES.PHOTOBOOK && !settings?.isFoldable
        ? safeAreas[0]
        : safeAreas.find((item) => item.layoutIndex === activeSide);

    if (!targetArea) {
      return;
    }

    dispatch(
      setActiveSafeArea({
        areaId: targetArea.id,
        target: null,
      })
    );
  }, [
    safeAreas,
    activeSafeArea?.id,
    user?.userTypeCode,
    currentActivePageNumber,
    activeSide,
    settings?.isFoldable,
    activeEditorType,
  ]);

  // unselect safe area when active side changes because in photobook editor we have two side so possible that one of the sides not have safe area in case of customer
  useEffect(() => {
    dispatch(deSelectSafeArea());
  }, [activeSide]);

  const setCurrentTarget = (e, id, areaType, itemType) => {
    // Manually register DOM pointers (used by undo/redo sync in the effect above)
    window.__canvasActiveObjEvent = e;
    window.__canvasActiveObjTarget = e.currentTarget;
    window.__canvasActiveObjId = id;

    // Shift key, Ctrl key, OR multi-select mode all act as "add to selection"
    const isAddToSelection =
      (e.shiftKey ?? false) || (e.ctrlKey ?? false) || isMultiSelectModeRef.current;

    // PERF: grabbing the ALREADY-selected single object (e.g. to drag it again)
    // would re-dispatch setActiveObject → re-render MainCanvas → re-run the
    // N-object .map. That synchronous, O(N) re-render fires inside pointerdown and
    // is the "laggy at drag start, smooth once moving" hitch (scales with object
    // count). The object is already the moveable target, so skip the redundant
    // dispatch entirely. (First-click on a NOT-yet-selected object still selects.)
    if (!isAddToSelection && activeObjectRef.current?.id === id) {
      return;
    }

    const obj = {
      e: e,
      target: e.currentTarget,
      id: id,
      history: false,
      areaType: areaType,
      isShiftPressed: isAddToSelection,
    };
    dispatch(setActiveObject(obj));
  };

  // Unified paste handler: checks OS clipboard vs our canvas-copy token,
  // then pastes the canvas object, an external image, or external text accordingly.
  const pasteFromExternalClipboard = async () => {
    // No clipboard API at all — fall back to canvas object paste
    if (!navigator?.clipboard) {
      if (window.__canvasCopyObjectId) dispatch(pasteObject());
      return;
    }

    try {
      // Try reading full clipboard (images + text)
      if (navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith("image/"));
          if (imageType) {
            // Clipboard has an image — paste it as a new canvas image
            const blob = await item.getType(imageType);
            const extension = imageType.split('/')[1] || 'png';
            const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: blob.type });
            const uploadedItem = await uploadImageFile(file);
            if (uploadedItem) {
              const largeUrl = uploadedItem.urls?.find((u) => u.size === "large");
              const mouseX = window.__canvasMouseInside ? (window.__canvasMouseX || 50) : 50;
              const mouseY = window.__canvasMouseInside ? (window.__canvasMouseY || 50) : 50;
              const imageObj = createCanvasImageObject({
                url: largeUrl?.url,
                originalWidth: largeUrl?.w || 300,
                originalHeight: largeUrl?.h || 300,
              });
              imageObj.image_id = uploadedItem._id;
              imageObj.urls = uploadedItem.urls;
              imageObj.x = mouseX;
              imageObj.y = mouseY;
              dispatch(setCurrentObjectProperties(null));
              dispatch(addObjectInPage(imageObj));
              window.__canvasCopyObjectId = null;
              window.__canvasCopyToken = null;
            } else if (window.__canvasCopyObjectId) {
              dispatch(pasteObject());
            }
            return;
          }
        }
      }

      // No image — check clipboard text
      if (navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        const isOurToken = clipboardText === window.__canvasCopyToken;

        if (isOurToken && window.__canvasCopyObjectId) {
          // Clipboard still has our token — paste the canvas object
          dispatch(pasteObject());
          return;
        }

        if (clipboardText && clipboardText.trim() && !isOurToken) {
          // Clipboard has external text — add it as a text object
          const mouseX = window.__canvasMouseInside ? (window.__canvasMouseX || 10) : 10;
          const mouseY = window.__canvasMouseInside ? (window.__canvasMouseY || 10) : 10;
          const maxWidth = isCover ? Math.floor(canvasSize.width / 2 * 0.8) : Math.floor(canvasSize.width * 0.8);
          const scaledFontSize = Math.round(16 * (canvasSize.width / 500));
          const measureDiv = document.createElement("div");
          measureDiv.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:Arial;font-size:${scaledFontSize}px;font-weight:300;`;
          measureDiv.textContent = clipboardText.trim();
          document.body.appendChild(measureDiv);
          const measuredWidth = measureDiv.offsetWidth + 20;
          document.body.removeChild(measureDiv);
          dispatch(setCurrentObjectProperties(null));
          dispatch(addObjectInPage({
            type: "text",
            x: mouseX,
            y: mouseY,
            text: clipboardText.trim(),
            width: Math.min(measuredWidth, maxWidth),
          }));
          window.__canvasCopyObjectId = null;
          window.__canvasCopyToken = null;
          return;
        }
      }

      // Clipboard is empty or unreadable — paste canvas object if available
      if (window.__canvasCopyObjectId) {
        dispatch(pasteObject());
      }
    } catch {
      // Any error (e.g. clipboard permission denied) — paste canvas object if available
      if (window.__canvasCopyObjectId) {
        dispatch(pasteObject());
      }
    }
  };

  // Keep as alias for any remaining internal callers
  const fallbackPasteTextOrObject = pasteFromExternalClipboard;

  function createCanvasImageObject({ url, originalWidth, originalHeight }) {
    const id = `Photos_${uuidv4()}`;
    return {
      id,
      type: "img",
      url,
      width: originalWidth,
      height: originalHeight,
      rotate: 0,
      top: 0,
      left: 0,
      scaleX: 1,
      scaleY: 1,
      zoom: 1,
      opacity: 1,
      borderRadius: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      orientation: 0,
      adjustment: "cover",
      filter: "",
      isFlip: false,
      image: {
        url,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
        scale: 1,
        positionX: 0,
        positionY: 0,
      },
    };
  }

  // Helper function to upload image file to server
  const uploadImageFile = async (file) => {
    // Reject images over the 30MB limit (matches the queue-upload guard).
    if (file && typeof file.size === "number" && file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.warning(`This image is larger than ${MAX_IMAGE_UPLOAD_MB}MB and can't be uploaded. Please use an image under ${MAX_IMAGE_UPLOAD_MB}MB.`);
      return null;
    }
    try {
      const batchId = uuidv4();
      const metadata = {
        brand_id: user?.brand_id || "",
        userTypeCode: user?.userTypeCode || "",
        user_id: user?._id || "",
        cart_order_id: projectId || "",
        editor_type: "",
        device: "web",
        batch_id: batchId,
      };

      // Use optimized upload with signed URLs and resizing
      
      const result = await uploadImageOptimized({
        file,
        metadata,
        onProgress: () => {}, // Progress not needed for single-image paste
        onStatusChange: () => {},
      });

      if (result && !result.error) {
        const urls = result.items?.urls || result.urls || [];
        const largeUrl = urls.find((u) => u.size === "large") || urls[0];

        dispatch(refreshProjectImages(batchId));
        return {
          _id: result.items?._id,
          urls: urls,
          url: largeUrl?.url,
          size: largeUrl?.size,
        };
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  const handleImageDragAndDrop = async (e) => {
    const files = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.type.startsWith("image/jpeg") ||
        file.type.startsWith("image/png") ||
        file.type.startsWith("image/jpg") ||
        file.type.startsWith("image/webp")
    );

    if (files.length === 0) return null;

    const file = files[0];

    // Reject images over the 30MB limit before doing any work.
    if (file && typeof file.size === "number" && file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.warning(`This image is larger than ${MAX_IMAGE_UPLOAD_MB}MB and can't be uploaded. Please use an image under ${MAX_IMAGE_UPLOAD_MB}MB.`);
      return null;
    }

    const { shouldStop } = handleImageUploadLimit({
      settings,
      totalUploadedImages,
      user,
      selectedCount: 1,
      userTypeCustomer: USER_TYPES.CUSTOMER,
      dispatch,
      setLimitReachedAction: setLimitReached,
      actionType: "upload",
    });

    if (shouldStop) return null;

    setIsDeviceFileUploading(true);

    try {
      const batchId = uuidv4();
      const metadata = {
        brand_id: user?.brand_id || "",
        userTypeCode: user?.userTypeCode || "",
        user_id: user?._id || "",
        cart_order_id: projectId || "",
        editor_type: "",
        device: "web",
        batch_id: batchId,
      };

      // Use optimized upload with signed URLs and resizing
      const { uploadImageOptimized } = await import("../../library/utils/upload/uploadManager");
      const result = await uploadImageOptimized({
        file,
        metadata,
        onProgress: () => {}, // Progress not needed for single drag-drop
        onStatusChange: () => {},
      });

      if (result && !result.error) {
        const urls = result.items?.urls || result.urls || [];
        const largeUrl = urls.find((u) => u.size === "large") || urls[0];

        dispatch(refreshProjectImages(batchId));

        return {
          id: `Photos_${uuidv4()}`,
          type: "img",
          url: largeUrl?.url,
          urls: urls,
          image_id: result.items?._id,
          width: largeUrl?.w,
          height: largeUrl?.h,
          rotate: 0,
          top: 0,
          left: 0,
          scaleX: 1,
          scaleY: 1,
          zoom: 1,
          opacity: 1,
          borderRadius: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          orientation: 0,
          adjustment: "cover",
          filter: "",
          isFlip: false,
        };
      } else {
        return null;
      }
    } catch (error) {
      return null;
    } finally {
      setIsDeviceFileUploading(false);
    }
  };

  const onCanvasDrop = async (e) => {
    e.preventDefault();

    let imageData = null;

    const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    // Step 1: Get imageData (from file upload OR drag transfer)
    if (hasFiles) {
      imageData = await handleImageDragAndDrop(e);
    } else {
      try {
        imageData = JSON.parse(e.dataTransfer.getData("imgs"));
      } catch (error) {
        return;
      }
    }

    if (!imageData) return;
    // Step 2: Place image on canvas with priority logic
    // Priority 1: Replace if an image object is currently selected
    if (activeObject && activeObject.id) {
      const selectedObj = currentActivePageObjects?.find(
        (item) => item.id === activeObject.id
      );

      if (selectedObj && selectedObj.type === "img") {
        dispatch(changeObjectInPage({ id: activeObject.id, data: imageData, type: "img" }));
        return;
      }
    }

    // Priority 2: Replace if dropped directly on an existing image element
    if (
      e.target.classList.contains("photo-item") ||
      e.target.classList.contains("page_photo_item")
    ) {
      const id = e.target.getAttribute("data-id");
      if (id) {
        dispatch(changeObjectInPage({ id, data: imageData, type: "img" }));
        return;
      }
    }

    // Priority 3: Add new image at drop position
    imageData.type = "img";
    imageData.x = e.nativeEvent.offsetX;
    imageData.y = e.nativeEvent.offsetY;
    dispatch(addObjectInPage(imageData));
  };

  const getWidth = () => {
    // Check if we need to double the width for cover-enabled layflat albums
    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet &&
      currentActivePageNumber === 0;

    // Don't apply half-width for cover pages when showFullCoverSheet is enabled
    if (
      (isCover && !shouldDoubleWidth) ||
      currentActivePageNumber === 1 ||
      currentActivePageNumber === Pages.length - 2
    ) {
      return (canvasSize.width / 2) * zoomRatio;
    }

    const baseWidth = shouldDoubleWidth ? canvasSize.width * 2 : canvasSize.width;
    return baseWidth * zoomRatio;
  };

  const getHeight = () => {
    return canvasSize.height * zoomRatio;
  };
  const getCanvasWidth = () => {
    // Per-side width for the cover spread renderer. For photobook this is
    // always canvasWidth/2 (each cover side is a half-sheet). LAYFLAT doubles
    // because its canvasWidth is single-page; photobook's is already spread.
    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet &&
      currentActivePageNumber === 0;

    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
      (settings?.isFoldable && settings?.isFoldable === true)
    ) {
      const baseWidth = Number(canvasSize.width) / 2;
      return shouldDoubleWidth ? baseWidth * 2 : baseWidth;
    }
    return Number(canvasSize.width) || 0;
  };


  const getPageWidth = () => {
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
    const isLayflatFullCoverPage = activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled && settings?.showFullCoverSheet && currentActivePageNumber === 0;
    const computedSpineWidth =
      (isPhotobookFullCover && currentActivePageNumber === 0) || isLayflatFullCoverPage
        ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
        : 0;
    // Same short-circuit as calculateSvgDimensions for photobook full cover
    // page 0 — keep trim/safe/bleed rects spanning the full spread regardless
    // of any stale isCover state.
    if (isPhotobookFullCover && currentActivePageNumber === 0) {
      // Number() BEFORE the + — canvasSize.width can be a string ("2400"), and
      // "2400" + spineWidth would string-concat into "24000", blowing the
      // bleed/trim/safe rects ~10x past the viewBox and off-screen.
      return Number(canvasSize.width) + computedSpineWidth;
    }
    const isSpecialPage =
      isCover ||
      currentActivePageNumber === 1 ||
      (currentActivePageNumber === 0 && !isPhotobookFullCover) ||
      currentActivePageNumber === Pages.length - 2;

    // Photobook canvasWidth already = spread width; only LAYFLAT doubles here.
    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet &&
      currentActivePageNumber === 0;

    // Layflat fallback: a saved cover page with hideLastCover (cover on,
    // full-spread off) is always a half-sheet, even if its persisted
    // settings.isHalfSheet got stripped.
    const isLayflatHalfCoverPage =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      !settings?.showFullCoverSheet &&
      activePage?.isCoverPage === true;

    if (
      (isPhotobook && isSpecialPage) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        (currentPageSettings?.isHalfSheet === true || isLayflatHalfCoverPage) &&
        !shouldDoubleWidth)
    ) {
      return canvasSize.width / 2;
    }

    // Number() guard — see the full-cover branch above; raw string canvasSize.width
    // would concatenate with computedSpineWidth instead of adding.
    const cw = Number(canvasSize.width) || 0;
    const baseWidth = shouldDoubleWidth ? cw * 2 : cw;
    return baseWidth + computedSpineWidth;
  };


  // Number() so the print-guide rects (bleed/trim/safe) are numeric even when
  // canvasSize stores width/height as strings.
  const pageWidth = Number(getPageWidth()) || 0;
  const pageHeight = Number(canvasSize.height) || 0;

  const safeMargin = parseFloat(canvasSize.safeMargin) || 0;
  const bleedMargin = parseFloat(canvasSize.bleedMargin) || 0;

  // The trim rect should be INSET by bleedMargin (not at 0,0)
  const trimRect = {
    x: bleedMargin,          // Move inward by bleed amount
    y: bleedMargin,          // Move inward by bleed amount
    width: Math.max(0, parseFloat(pageWidth - bleedMargin * 2)),
    height: Math.max(0, parseFloat(pageHeight - bleedMargin * 2)),
  };

  const safeRect = {
    x: bleedMargin + safeMargin,     // Inset further for safe area
    y: bleedMargin + safeMargin,
    width: Math.max(0, parseFloat(pageWidth - (bleedMargin + safeMargin) * 2)),
    height: Math.max(0, parseFloat(pageHeight - (bleedMargin + safeMargin) * 2)),
  };

  const bleedRect = {
    x: 0,                    // At the edge of canvas
    y: 0,
    width: parseFloat(pageWidth),        // Full page width
    height: parseFloat(pageHeight),
  };

  const trimStroke = Math.max(1, 1 / zoomRatio);


  const calculateSvgDimensions = () => {
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isLayflat = activeEditorType === EDITOR_TYPES.LAYFLATALBUM;
    const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
    const isPhotobookFullCoverPage0 =
      isPhotobookFullCover && currentActivePageNumber === 0;

    // Photobook full cover page 0 is always the full spread (front + spine +
    // back). Short-circuit before any isSpecialPage / isCover gating can shrink
    // it to half-width — isCover is React state set in a useEffect so it lags
    // settings changes by one render, and we hit that lag right after the
    // user toggles "Show Full Cover" on.
    if (isPhotobookFullCoverPage0) {
      const sw = Math.round(
        Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0)
      );
      const cw = parseFloat(canvasSize.width);
      const ch = parseFloat(canvasSize.height);
      const totalW = cw + sw;
      return {
        width: totalW * zoomRatio,
        viewBox: [0, 0, totalW, ch].join(" "),
        spineWidth: sw,
      };
    }

    const isSpecialPage =
      isCover ||
      currentActivePageNumber === 1 ||
      (currentActivePageNumber === 0 && !isPhotobookFullCover) ||
      currentActivePageNumber === Pages.length - 2;

    // For PHOTOBOOK, canvasSize.width already represents the SPREAD width
    // (two pages), so spread = canvasWidth + spineWidth — no doubling needed.
    // LAYFLAT canvasSize.width is per-page width, so the cover spread doubles.
    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet &&
      currentActivePageNumber === 0;

    // Spine width derived live from paperThickness × billablePages (never read from stale settings.spineWidth)
    const isLayflatFullCover = isLayflat && settings?.coverEnabled && settings?.showFullCoverSheet;
    const computedSpineWidth = (isPhotobookFullCover && currentActivePageNumber === 0)
    //  ||      (isLayflatFullCover && currentActivePageNumber === 0)
      ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
      : 0;

    const canvasWidth = parseFloat(canvasSize.width);
    const canvasHeight = parseFloat(canvasSize.height);

    // Layflat fallback: a saved cover page with hideLastCover (cover on,
    // full-spread off) is always a half-sheet, even if its persisted
    // settings.isHalfSheet got stripped.
    const isLayflatHalfCoverPage =
      isLayflat &&
      settings?.coverEnabled === true &&
      !settings?.showFullCoverSheet &&
      activePage?.isCoverPage === true;

    const useHalfWidth =
      (isPhotobook && isSpecialPage) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        (currentPageSettings?.isHalfSheet === true || isLayflatHalfCoverPage) &&
        !shouldDoubleWidth);

    const width = useHalfWidth
      ? (canvasWidth / 2) * zoomRatio
      : ((shouldDoubleWidth ? canvasWidth * 2 : canvasWidth) + computedSpineWidth) * zoomRatio;
    const viewBoxWidth = useHalfWidth
      ? canvasWidth / 2
      : (shouldDoubleWidth ? canvasWidth * 2 : canvasWidth) + computedSpineWidth;
    const viewBox = [0, 0, viewBoxWidth, canvasHeight].join(" ");

    return { width, viewBox, spineWidth: computedSpineWidth };
  };

  const shouldShowCenterWrapperLine = () => {
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
    const isLayflatFullCover = activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled && settings?.showFullCoverSheet;

    // When full cover + spine is active on page 0, no center fold — spine replaces it
    if ((isPhotobookFullCover || isLayflatFullCover) && currentActivePageNumber === 0) {
      const liveSpineWidth = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
      if (liveSpineWidth > 0) return false;
    }

    // Never show a center fold line on cover pages — front / back covers are
    // single pages, not spreads. This guards against foldable / hideLastCover
    // configs where the cover would otherwise inherit the "spread" line via
    // the second OR-clause below.
    if (isCover) return false;

    // Photobook back cover (totalPages-1) is also a cover page even though
    // isCover state may briefly be stale; explicitly skip it.
    if (
      isPhotobook &&
      (currentActivePageNumber === 0 ||
        currentActivePageNumber === Pages.length - 1)
    ) {
      return false;
    }

    const isSpecialPage =
      !isCover &&
      currentActivePageNumber !== 1 &&
      (currentActivePageNumber !== 0 || isPhotobookFullCover) &&
      currentActivePageNumber !== Pages.length - 2;

    return (
      (isPhotobook && isSpecialPage) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        currentPageSettings?.isHalfSheet !== true &&
        activeEditorType !== EDITOR_TYPES.LAYFLATALBUM)
    );
  };
  useEffect(() => {
    setNotShowSelectedPage(
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        currentPageSettings?.isHalfSheet === true) ||
      ([0, Pages.length - 2, Pages.length].includes(
        currentActivePageNumber
      ) &&
        !settings?.isFoldable)
    );
  }, [currentActivePageNumber, currentPageSettings, settings]);
  const handleCloseSafeAreaPopup = () => {
    dispatch(setShowSafeAreaGuidePopup({ value: false }));
    setShowSafeAreaGuideFirstTime(false);
  };

  const handleMagicWriteReplace = (text) => {
    if (magicWriteMode === "edit" && getActiveCanvasObjProps?.type === "text") {
      const measureDiv = document.createElement("div");
      measureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ${getActiveCanvasObjProps.font?.family || "Arial"};
        font-size: ${parseInt(getActiveCanvasObjProps.font?.size) || 24}px;
        font-weight: ${getActiveCanvasObjProps.font?.weight || "normal"};
        font-style: ${getActiveCanvasObjProps.font?.style || "normal"};
        line-height: 1.2;
        width: ${getActiveCanvasObjProps.width}px;
      `;
      measureDiv.textContent = text;
      document.body.appendChild(measureDiv);

      const measuredHeight = measureDiv.offsetHeight + 10;
      document.body.removeChild(measureDiv);

      if (measuredHeight > getActiveCanvasObjProps.height) {
        dispatch(setCurrentObjectProperties({ text, height: measuredHeight }));
      } else {
        dispatch(setCurrentObjectProperties({ text }));
      }
    }
    dispatch(closeMagicWrite());
  };

  const handleMagicWriteInsert = (text) => {
    const obj = {
      type: "text",
      x: 10,
      y: 50,
      text: text,
      width: 300,
      height: 60,
    };
    dispatch(setCurrentObjectProperties(null));
    dispatch(addObjectInPage(obj));
    dispatch(closeMagicWrite());
  };

  const handleMagicWriteClose = () => {
    dispatch(closeMagicWrite());
  };

  useEffect(() => {
    if (faceSwapProcessStatus === "completed") {
      let batchId = uuidv4();
      dispatch(refreshProjectImages(batchId));
      dispatch(setSettings({ templateSwapped: true }));
    }
  }, [faceSwapProcessStatus, settings?.templateSwapped]);
  return (
    <>
      {svgData.isCapturingPages && !svgData.isPreviewBook && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "var(--background, #fff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "18px",
              padding: "28px 34px",
              width: "min(90vw, 340px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "4px solid var(--secondary, #eef4fa)",
                borderTopColor: "var(--primary, #4084b5)",
                animation: "spin 0.8s linear infinite",
              }}
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <div
              style={{
                color: "var(--foreground, #1f2937)",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              Preparing your pages…
            </div>
            <div
              style={{
                color: "var(--muted-foreground, #6b7280)",
                fontSize: "12.5px",
                textAlign: "center",
                lineHeight: 1.4,
                marginTop: "-4px",
              }}
            >
              Capturing every page at full resolution for a crisp print.
            </div>
            {svgData.captureProgress?.totalPages > 0 && (
              <>
                <div
                  style={{
                    width: "100%",
                    height: "10px",
                    backgroundColor: "var(--secondary, #eef4fa)",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(svgData.captureProgress.currentPage / svgData.captureProgress.totalPages) * 100}%`,
                      height: "100%",
                      borderRadius: "999px",
                      transition: "width 0.3s ease",
                      backgroundColor: "var(--primary, #4084b5)",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: "var(--muted-foreground, #6b7280)",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  <span>
                    {svgData.captureProgress.currentPage} of {svgData.captureProgress.totalPages} pages
                  </span>
                  <ElapsedTime />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Editor export progress (non-preview). Preview flows render their own. */}
      {!svgData.isPreviewBook && <ProgressModal progress={exportProgress} />}

      <div
        className={`CanvasWrapper d-flex justify-content-center align-items-start m-0 position-relative ${isToolPanelOpen ? "canvas-wrapper--panel-open" : ""
          }`}
        ref={wrapperRef}
        onDragEnter={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onCanvasDrop}
      >
        {/* Full-viewport measurement rulers that hug the canvas (self-gated by showRuler) */}
        <CanvasRulers />

        {/* Device File Upload Loader */}
        {isDeviceFileUploading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <ImSpinner2
              style={{
                fontSize: "36px",
                color: "var(--primary)",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        )}

        {/* Magic Write Panel - Smart modal with Create/Edit modes */}
        {showMagicWrite && (
          <MagicWritePanel
            mode={magicWriteMode}
            selectedText={
              magicWriteMode === "edit" && getActiveCanvasObjProps?.type === "text"
                ? getActiveCanvasObjProps?.text : magicWriteMode === "create" && getActiveCanvasObjProps?.type === "text"
                  ? "" : ""
            }
            onReplace={handleMagicWriteReplace}
            onInsert={handleMagicWriteInsert}
            onClose={handleMagicWriteClose}
          />
        )}

        <div
          ref={pagesOuterRef}
          className={`position-absolute inset-0 pages-outer ${isToolPanelOpen ? "pages-outer--panel-open" : ""
            }`}
          style={{
            display: "flex",
            position: "relative",
          }}
          onMouseDown={handleOuterSelectionStart}
        // style={{
        //   background:
        //     settings.subtype === EDITOR_SUB_TYPES.ACRYLIC.CUSTOM_SHAPE
        //       ? "#ffffff"
        //       : "",
        // }}
        >
          {/* Outer marquee overlay — shown when rubber-band dragging outside the SVG canvas */}
          <div
            ref={outerMarqueeRef}
            style={{
              display:         "none",
              position:        "absolute",
              pointerEvents:   "none",
              zIndex:          9999,
              background:      "color-mix(in srgb, var(--primary) 15%, transparent)",
              border:          "1px dashed var(--primary)",
            }}
          />
          {/* <button onClick={() => exportAsImage('jpeg')}>Export as JPEG</button> */}

          {activePage && (
            <div
              key={currentActivePageNumber}
              ref={canvasBoxRef}
              className={`canvas-box position-relative ${(activeEditorType === EDITOR_TYPES.PHOTOBOOK || activeEditorType === EDITOR_TYPES.LAYFLATALBUM) && isCover ? "mobile-cover" : ""}`}
              style={{
                display: "flex",
                margin: "auto",
                flexShrink: 0,
                zoom: canvasScale * (window.innerWidth <= 768 && (activeEditorType === EDITOR_TYPES.PHOTOBOOK || activeEditorType === EDITOR_TYPES.LAYFLATALBUM) && isCover ? (isToolPanelOpen || isPreviewActive ? 1.2 : 1.5) : 1),
              }}
            >
              {/* Ruler-reserve wrapper: scales ALL visual canvas elements (the page
                  AND any blank facing page) together as one unit so they shrink in
                  sync, and carries the drop-shadow so it hugs the smaller canvas.
                  ItemDragger/SafeAreaDragger are siblings of THIS div (kept outside
                  it), so Moveable's selection renders unscaled + undo re-measures
                  correctly. Applied unconditionally → toggling the ruler never
                  resizes the canvas (no blink). */}
              <div
                className={`ruler-reserve-wrap ${activeEditorType !== EDITOR_TYPES.PHOTOBOOK
                  ? activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT ||
                    (settings?.isFoldable && settings?.isFoldable === true)
                    ? ""
                    : "theme-box-shadow"
                  : ""
                  }`}
                style={{
                  display: "flex",
                  transform: `scale(${RULER_RESERVE_SCALE})`,
                  transformOrigin: "center center",
                }}
              >
              {/* not editable blank page for photo book after cover page */}
              {activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                currentActivePageNumber === 1 && (
                  <div
                    className="WrapperDivLine"
                    style={{
                      width: `${getWidth() + (notShowSelectedPage ? 0 : 2)}px`,
                      height: `${getHeight() + (notShowSelectedPage ? 0 : 4)
                        }px`,
                      backgroundColor: "#e6e6e6",
                    }}
                  ></div>
                )}

              <div
                // don't remove this commented code this is commedted because of this causing 2 times api call
                // onDragEnter={(e) => e.preventDefault()}
                // onDragOver={(e) => e.preventDefault()}
                // onDrop={onCanvasDrop}
                className={`WrapperDiv   ${shouldShowCenterWrapperLine()
                  ? "WrapperDivLine"
                  : activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                    settings?.isFoldable &&
                    settings?.isFoldable === true &&
                    // Never render the spread divider on a cover page. Cover
                    // pages are single sheets — front cover, back cover, and
                    // half-sheet covers — so the center "fold" line doesn't
                    // belong there. Without this guard a cover whose
                    // isHalfSheet flag is missing or stripped would fall into
                    // the interior-spread branch and pick up the divider.
                    !activePage?.isCoverPage &&
                    (!settings?.coverEnabled ||
                      (settings?.coverEnabled &&
                        settings?.coverEnabled === true &&
                        !currentPageSettings?.isHalfSheet &&
                        !settings?.showFullCoverSheet) ||
                      (settings?.coverEnabled &&
                        settings?.coverEnabled === true &&
                        !activePage?.isCoverPage &&
                        settings?.showFullCoverSheet))
                    ? "WrapperDivLineForLayflat"
                    : ""
                  } `}
                style={{
                  //   backgroundColor: activePage.bgColor,
                  width: `${calculateSvgDimensions().width +
                    (notShowSelectedPage ? 0 : 4)
                    }px`,
                  // height: `${calculateSvgDimensions().height +
                  height: `${canvasSize.height * zoomRatio +
                    (notShowSelectedPage ? 0 : 4)
                    }px`,
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  // padding: `${bleedMargin * zoomRatio + 2}px`,
                  // ...(activePage.layout[0]?.background.image &&
                  //   !activePage.layout[0]?.background.color && {
                  //   backgroundImage: `url(${activePage.layout[0]?.background.image || ""
                  //     })`,
                  //   backgroundSize: "cover",
                  //   backgroundPosition: "center",
                  //   backgroundRepeat: "no-repeat",
                  // }),
                  // backgroundColor:
                  //   activePage.layout[0]?.background.color || "#ffffff",
                }}
              >
                <div
                  className="containerWrapperD position-relative"
                  style={{ userSelect: "none", width: "100%", height: "100%" }}
                >
                  <svg
                    ref={svgRef}
                    width={`${calculateSvgDimensions().width}px`}
                    height={`${canvasSize.height * zoomRatio}px`}
                    // height={`${calculateSvgDimensions().height}px`}
                    style={{
                      top: !notShowSelectedPage ? "2px" : "0px",
                      left: !notShowSelectedPage ? "2px" : "0px",
                      userSelect: "none",
                      overflow: "visible",
                      cursor: isMultiSelectMode ? "crosshair" : "default",
                    }}
                    id="canvasWrapper"
                    className="position-absolute z-1"
                    viewBox={calculateSvgDimensions().viewBox}
                    onMouseDown={handleSelectionStart}
                    onTouchStart={handleTouchSelectionStart}
                  >
                    {/* Transparent background rect — sits behind everything; cursor handled on SVG element above */}
                    <rect
                      x={0}
                      y={0}
                      width={pageWidth}
                      height={pageHeight}
                      fill="transparent"
                    />
                    <defs>
                      {/* Spread background: one image spanning the full width, shared by both sides */}
                      {activePage.layout[0]?.background?.isSpread && activePage.layout[0]?.background?.image && (
                        <pattern
                          id={`spread-bg-${activePage.layout[0].id}`}
                          patternUnits="userSpaceOnUse"
                          x="0"
                          y="0"
                          width={(() => {
                            const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
                            const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
                            const isLayflatFullCover = activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                              settings?.coverEnabled && settings?.showFullCoverSheet;
                            const spineWidth = ((isPhotobookFullCover || isLayflatFullCover) && currentActivePageNumber === 0)
                              ? (settings?.spineWidth || 0)
                              : 0;
                            return canvasSize.width + spineWidth;
                          })()}
                          height={canvasSize.height}
                        >
                          <CachedSvgImage
                            href={activePage.layout[0].background.image}
                            x="0"
                            y="0"
                            width={(() => {
                              const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
                              const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
                              const isLayflatFullCover = activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                                settings?.coverEnabled && settings?.showFullCoverSheet;
                              const spineWidth = ((isPhotobookFullCover || isLayflatFullCover) && currentActivePageNumber === 0)
                                ? (settings?.spineWidth || 0)
                                : 0;
                              return canvasSize.width + spineWidth;
                            })()}
                            height={canvasSize.height}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </pattern>
                      )}

                      {activePage.layout[0]?.background?.image && !activePage.layout[0]?.background?.isSpread && (
                        <pattern
                          id={`left-bg-${activePage.layout[0].id}`}
                          patternUnits="objectBoundingBox"
                          width="1"
                          height="1"
                        >
                          <CachedSvgImage
                            href={activePage.layout[0].background?.image}
                            x="0"
                            y="0"
                            transform={
                              (() => {
                                const flip = activePage.layout[0]?.background?.flip;
                                const flipX = typeof flip === "boolean" ? flip : flip?.x;
                                const flipY = typeof flip === "boolean" ? false : flip?.y;
                                if (!flipX && !flipY) return "";
                                const sx = flipX ? -1 : 1;
                                const sy = flipY ? -1 : 1;
                                const tx = flipX ? -getCanvasWidth() : 0;
                                const ty = flipY ? -canvasSize.height : 0;
                                return `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
                              })()
                            }
                            width={getCanvasWidth()}
                            height={canvasSize.height}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </pattern>
                      )}

                      {/* Pattern for the right side background image */}
                      {activePage.layout[1]?.background?.image && (
                        <pattern
                          id={`right-bg-${activePage.layout[1].id}`}
                          patternUnits="objectBoundingBox"
                          width="1"
                          height="1"
                        >
                          <CachedSvgImage
                            href={activePage.layout[1].background?.image}
                            x="0"
                            y="0"
                            transform={
                              (() => {
                                const flip = activePage.layout[1]?.background?.flip;
                                const flipX = typeof flip === "boolean" ? flip : flip?.x;
                                const flipY = typeof flip === "boolean" ? false : flip?.y;
                                if (!flipX && !flipY) return "";
                                const sx = flipX ? -1 : 1;
                                const sy = flipY ? -1 : 1;
                                const tx = flipX ? -getCanvasWidth() : 0;
                                const ty = flipY ? -canvasSize.height : 0;
                                return `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
                              })()
                            }
                            width={getCanvasWidth()}
                            height={canvasSize.height}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </pattern>
                      )}

                      {/* Gradient for left side background - supports linear and radial */}
                      {activePage.layout[0]?.background?.gradient &&
                        (activePage.layout[0].background.gradient.type ===
                          "radial" ? (
                          <radialGradient
                            id={`gradient-bg-left-${activePage.layout[0].id}`}
                            {...getRadialGradientCoords(
                              activePage.layout[0].background.gradient
                                .radialPosition
                            )}
                          >
                            {activePage.layout[0].background.gradient.stops?.map(
                              (stop, index) => (
                                <stop
                                  key={index}
                                  offset={`${stop.position}%`}
                                  stopColor={
                                    stop.color?.slice(0, 7) || "#000000"
                                  }
                                  stopOpacity={
                                    stop.color?.length === 9
                                      ? parseInt(stop.color.slice(7, 9), 16) /
                                      255
                                      : 1
                                  }
                                />
                              )
                            )}
                          </radialGradient>
                        ) : (
                          <linearGradient
                            id={`gradient-bg-left-${activePage.layout[0].id}`}
                            {...getLinearGradientCoords(
                              activePage.layout[0].background.gradient.angle ||
                              90
                            )}
                          >
                            {activePage.layout[0].background.gradient.stops?.map(
                              (stop, index) => (
                                <stop
                                  key={index}
                                  offset={`${stop.position}%`}
                                  stopColor={
                                    stop.color?.slice(0, 7) || "#000000"
                                  }
                                  stopOpacity={
                                    stop.color?.length === 9
                                      ? parseInt(stop.color.slice(7, 9), 16) /
                                      255
                                      : 1
                                  }
                                />
                              )
                            )}
                          </linearGradient>
                        ))}

                      {/* Gradient for right side background - supports linear and radial */}
                      {activePage.layout[1]?.background?.gradient &&
                        (activePage.layout[1].background.gradient.type ===
                          "radial" ? (
                          <radialGradient
                            id={`gradient-bg-right-${activePage.layout[1].id}`}
                            {...getRadialGradientCoords(
                              activePage.layout[1].background.gradient
                                .radialPosition
                            )}
                          >
                            {activePage.layout[1].background.gradient.stops?.map(
                              (stop, index) => (
                                <stop
                                  key={index}
                                  offset={`${stop.position}%`}
                                  stopColor={
                                    stop.color?.slice(0, 7) || "#000000"
                                  }
                                  stopOpacity={
                                    stop.color?.length === 9
                                      ? parseInt(stop.color.slice(7, 9), 16) /
                                      255
                                      : 1
                                  }
                                />
                              )
                            )}
                          </radialGradient>
                        ) : (
                          <linearGradient
                            id={`gradient-bg-right-${activePage.layout[1].id}`}
                            {...getLinearGradientCoords(
                              activePage.layout[1].background.gradient.angle ||
                              90
                            )}
                          >
                            {activePage.layout[1].background.gradient.stops?.map(
                              (stop, index) => (
                                <stop
                                  key={index}
                                  offset={`${stop.position}%`}
                                  stopColor={
                                    stop.color?.slice(0, 7) || "#000000"
                                  }
                                  stopOpacity={
                                    stop.color?.length === 9
                                      ? parseInt(stop.color.slice(7, 9), 16) /
                                      255
                                      : 1
                                  }
                                />
                              )
                            )}
                          </linearGradient>
                        ))}

                      {/* clip path for circular custom product */}
                      {isCircularShape && (
                        <clipPath id={`product-shape-clip-${currentActivePageNumber}`}>
                          <ellipse
                            cx={pageWidth / 2}
                            cy={pageHeight / 2}
                            rx={pageWidth / 2}
                            ry={pageHeight / 2}
                          />
                        </clipPath>
                      )}

                      {/* clip path for safe areas */}
                      <clipPath id="clipPath">
                        {safeAreas &&
                          safeAreas.length > 0 &&
                          safeAreas.map((safeArea, index) => (
                            <rect
                              key={safeArea.id}
                              x={safeArea.left}
                              y={safeArea.top}
                              width={safeArea.width}
                              height={safeArea.height}
                            />
                          ))}
                      </clipPath>
                    </defs>

                    {/* if floldable layout is not applied */}
                    {!settings?.isFoldable && (
                      <>
                        {/* left single page to select active side*/}
                        {activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                          <rect
                            clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                            id={`left-part-${activePage.layout[0]?.id}`}
                            x="0"
                            y="0"
                            width={getCanvasWidth()}
                            height={canvasSize.height}
                            fill={
                              activePage.layout[0]?.background?.gradient
                                ? `url(#gradient-bg-left-${activePage.layout[0].id})`
                                : activePage.layout[0]?.background?.image
                                  ? activePage.layout[0].background.isSpread
                                    ? `url(#spread-bg-${activePage.layout[0].id})`
                                    : `url(#left-bg-${activePage.layout[0].id})`
                                  : activePage.layout[0]?.background?.color ||
                                  "#ffffff"
                            }
                            className={`z-10 leftSide ${activeSide === 0 && !isCover
                              ? "selected-left"
                              : ""
                              }`}
                            onClick={handleLeftSideClick}
                          />
                        )}

                        {/* full page svg block*/}
                        {activeEditorType !== EDITOR_TYPES.PHOTOBOOK && (
                          <rect
                            clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                            id={` left-part-${activePage.layout[0]?.id}`}
                            x="0"
                            y="0"
                            width={getPageWidth()}
                            height={canvasSize.height}
                            fill={
                              activePage.layout[0]?.background?.gradient
                                ? `url(#gradient-bg-left-${activePage.layout[0].id})`
                                : activePage.layout[0]?.background?.image
                                  ? `url(#left-bg-${activePage.layout[0].id})`
                                  : activePage.layout[0]?.background?.color ||
                                  "#ffffff"
                            }
                            className={`leftSide ${activeSide === 0 && !isCover
                              ? "selected-left"
                              : ""
                              }`}
                            onClick={handleLeftSideClick}
                          />
                        )}

                        {/* Spine background — rendered BEHIND objects so background is continuous through the spine.
                            For spread bg = single continuous rect; for per-page bg = half from each layout side. */}
                        {((activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet) ||
                          (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled && settings?.showFullCoverSheet)) &&
                          currentActivePageNumber === 0 &&
                          (() => {
                            const liveSpineWidth = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
                            if (liveSpineWidth <= 0) return null;
                            const spineX = getCanvasWidth();
                            const sw = liveSpineWidth;
                            const layout0 = activePage.layout[0];
                            const layout1 = activePage.layout[1];
                            const isSpreadBg = layout0?.background?.isSpread;
                            const getBgFill = (layout, side) => {
                              if (!layout) return "#ffffff";
                              if (layout.background?.gradient) return `url(#gradient-bg-${side}-${layout.id})`;
                              if (layout.background?.image) return isSpreadBg ? `url(#spread-bg-${layout0?.id})` : `url(#${side}-bg-${layout.id})`;
                              return layout.background?.color || "#ffffff";
                            };
                            return (
                              <g id="photobook-spine-bg" className="photobook-spine-bg" pointerEvents="none">
                                {/* Left half of spine — uses layout[0] (back cover) background */}
                                <rect x={spineX} y="0" width={isSpreadBg ? sw : sw / 2} height={canvasSize.height}
                                  fill={getBgFill(layout0, "left")} />
                                {/* Right half of spine — uses layout[1] (front cover) background */}
                                {!isSpreadBg && (
                                  <rect x={spineX + sw / 2} y="0" width={sw / 2} height={canvasSize.height}
                                    fill={getBgFill(layout1, "right")} />
                                )}
                              </g>
                            );
                          })()}


                        {/* right single page to select active side */}
                        {activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                          !isCover && (
                            <rect
                              clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                              id=" right-part"
                              x={getCanvasWidth() + (
                                settings?.showFullCoverSheet &&
                                  currentActivePageNumber === 0
                                  ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
                                  : 0
                              )}
                              y="0"
                              width={getCanvasWidth()}
                              height={canvasSize.height}
                              fill={
                                activePage.layout[1]?.background?.gradient
                                  ? `url(#gradient-bg-right-${activePage.layout[1].id})`
                                  : activePage.layout[1]?.background?.image
                                    ? activePage.layout[0]?.background?.isSpread
                                      ? `url(#spread-bg-${activePage.layout[0].id})`
                                      : `url(#right-bg-${activePage.layout[1].id})`
                                    : activePage.layout[1]?.background?.color ||
                                    "#ffffff"
                              }
                              className={`rightSide  ${activeSide === 1 && !isCover
                                ? "selected-right"
                                : ""
                                }`}
                              onClick={handleRightSideClick}
                            />
                          )}
                      </>
                    )}

                    {/* if foldable layout is applied */}
                    {settings?.isFoldable && settings?.isFoldable === true && (
                      <>
                        {/* left single page to select active side*/}
                        {!currentPageSettings?.isHalfSheet && (
                          <rect
                            clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                            id={`left-part-${activePage.layout[0]?.id}`}
                            x="0"
                            y="0"
                            width={canvasSize.width / 2}
                            height={canvasSize.height}
                            fill={
                              activePage.layout[0]?.background?.gradient
                                ? `url(#gradient-bg-left-${activePage.layout[0].id})`
                                : activePage.layout[0]?.background?.image
                                  ? activePage.layout[0].background.isSpread
                                    ? `url(#spread-bg-${activePage.layout[0].id})`
                                    : `url(#left-bg-${activePage.layout[0].id})`
                                  : activePage.layout[0]?.background?.color ||
                                  "#ffffff"
                            }
                            className={`z-10 leftSide ${activeSide === 0 && !isCover
                              ? "selected-left"
                              : ""
                              }`}
                            onClick={handleLeftSideClick}
                          />
                        )}

                        {/* full page svg block*/}
                        {currentPageSettings?.isHalfSheet &&
                          currentPageSettings?.isHalfSheet === true && (
                            <rect
                              clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                              id={` left-part-${activePage.layout[0]?.id}`}
                              x="0"
                              y="0"
                              width={canvasSize.width / 2}
                              height={canvasSize.height}
                              fill={
                                activePage.layout[0]?.background?.gradient
                                  ? `url(#gradient-bg-left-${activePage.layout[0].id})`
                                  : activePage.layout[0]?.background?.image
                                    ? activePage.layout[0].background.isSpread
                                      ? `url(#spread-bg-${activePage.layout[0].id})`
                                      : `url(#left-bg-${activePage.layout[0].id})`
                                    : activePage.layout[0]?.background?.color ||
                                    "#ffffff"
                              }
                              className={`leftSide ${activeSide === 0 && !isCover
                                ? "selected-left"
                                : ""
                                }`}
                              onClick={handleLeftSideClick}
                            />
                          )}

                        {/* Spine background for foldable layflat with full cover */}
                        {activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                          settings?.coverEnabled && settings?.showFullCoverSheet &&
                          currentActivePageNumber === 0 &&
                          (() => {
                            const liveSpineWidth = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
                            if (liveSpineWidth <= 0) return null;
                            const spineX = canvasSize.width / 2;
                            const sw = liveSpineWidth;
                            const layout0 = activePage.layout[0];
                            const layout1 = activePage.layout[1];
                            const isSpreadBg = layout0?.background?.isSpread;
                            const getBgFill = (layout, side) => {
                              if (!layout) return "#ffffff";
                              if (layout.background?.gradient) return `url(#gradient-bg-${side}-${layout.id})`;
                              if (layout.background?.image) return isSpreadBg ? `url(#spread-bg-${layout0?.id})` : `url(#${side}-bg-${layout.id})`;
                              return layout.background?.color || "#ffffff";
                            };
                            return (
                              <g id="photobook-spine-bg-foldable" className="photobook-spine-bg" pointerEvents="none">
                                <rect x={spineX} y="0" width={isSpreadBg ? sw : sw / 2} height={canvasSize.height}
                                  fill={getBgFill(layout0, "left")} />
                                {!isSpreadBg && (
                                  <rect x={spineX + sw / 2} y="0" width={sw / 2} height={canvasSize.height}
                                    fill={getBgFill(layout1, "right")} />
                                )}
                              </g>
                            );
                          })()}

                        {/* right single page to select active side */}
                        {!currentPageSettings?.isHalfSheet && (
                          <rect
                            clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                            id=" right-part"
                            x={canvasSize.width / 2 + (
                              activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                              settings?.coverEnabled && settings?.showFullCoverSheet &&
                              currentActivePageNumber === 0
                                ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
                                : 0
                            )}
                            y="0"
                            width={canvasSize.width / 2}
                            height={canvasSize.height}
                            fill={
                              activePage.layout[1]?.background?.gradient
                                ? `url(#gradient-bg-right-${activePage.layout[1].id})`
                                : activePage.layout[1]?.background?.image
                                  ? activePage.layout[0]?.background?.isSpread
                                    ? `url(#spread-bg-${activePage.layout[0].id})`
                                    : `url(#right-bg-${activePage.layout[1].id})`
                                  : activePage.layout[1]?.background?.color ||
                                  "#ffffff"
                            }
                            className={`rightSide  ${activeSide === 1 && !isCover
                              ? "selected-right"
                              : ""
                              }`}
                            onClick={handleRightSideClick}
                          />
                        )}
                      </>
                    )}

                    {/* normal objects */}
                    <g 
                      className={`allObjects d-inline-block`}
                      clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}
                    >
                      <g>
                        {allObjects // Sort by zIndex in ascending order
                          .map((item, key) => (
                            //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                            <g
                              key={item.id}
                              className={`position-absolute layoutDiv1 targetE1 objTarget1_${item.id
                                } ${item.type === "img" && "inset-0 overflow-hidden"
                                }`}
                            >
                              <g
                                className={`page-item ${item?.notExportable &&
                                  item?.notExportable === true &&
                                  user?.userTypeCode !== USER_TYPES.CUSTOMER
                                  ? "not-exportable"
                                  : ""
                                  }`}
                                width={item.width}
                                height={item.height}
                                data-index={item.zIndex}
                                data-id-t={item.id} // Unique identifier for your SVG group
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (
                                    getActiveCanvasObjProps?.isProcessing ||
                                    (user?.userTypeCode ===
                                      USER_TYPES.CUSTOMER &&
                                      item?.disableObjectEditing &&
                                      item?.disableObjectEditing === true)
                                  ) {
                                    return;
                                  }
                                  setCurrentTarget(e, item.id, item.areaType, item.type);
                                }}
                                onTouchStart={(e) => {
                                  const isDisabled = getActiveCanvasObjProps?.isProcessing ||
                                    (user?.userTypeCode === USER_TYPES.CUSTOMER &&
                                      item?.disableObjectEditing === true);
                                  handleObjectTouchStart(e, item.id, item.areaType);
                                  if (isDisabled) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                                }}
                                onTouchMove={handleObjectTouchMove}
                                onTouchEnd={(e) => {
                                  const isDisabled = getActiveCanvasObjProps?.isProcessing ||
                                    (user?.userTypeCode === USER_TYPES.CUSTOMER &&
                                      item?.disableObjectEditing === true);
                                  handleObjectTouchEnd(e, item.id, item.areaType, item.type, isDisabled);
                                }}
                                style={{
                                  transform: `translate(${item.transform.x + (() => {
                                    const isFullCoverPage =
                                      ((activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet) ||
                                        (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled && settings?.showFullCoverSheet)) &&
                                      currentActivePageNumber === 0;
                                    if (!isFullCoverPage) return 0;
                                    const sw = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
                                    if (sw <= 0) return 0;
                                    if (item.layoutIndex === 1) {
                                      // Right side: shift right by full spine width so objects start at inner right spine line
                                      return sw;
                                    }
                                    // Left side (layoutIndex === 0): no shift — objects end at spineX (inner left spine line)
                                    return 0;
                                  })()}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                  // Pivot: while inner-panning an image, the full-image
                                  // GhostImage extends past the frame and grows the content
                                  // bbox. With the default fill-box pivot (= bbox centre) that
                                  // drifts a ROTATED container. So ONLY for the image being
                                  // panned right now (isDragger + active) pin the rotation pivot
                                  // to the frame centre in viewBox space — content-independent.
                                  // Every other case keeps fill-box so react-moveable's
                                  // svgOrigin="50% 50%" resolves correctly (view-box would make
                                  // its % origin resolve against the whole viewBox and send
                                  // onRender into an infinite correction loop on rotated items).
                                  ...(item.type === "img" && isDragger && activeObject?.id === item.id
                                    ? {
                                      transformOrigin: `${item.width / 2}px ${item.height / 2}px`,
                                      transformBox: "view-box",
                                    }
                                    : {
                                      transformOrigin: "center center",
                                      transformBox: "fill-box",
                                    }),
                                  overflow: "hidden",
                                  width: item.width,
                                  height: item.height,

                                }}
                              >
                                {item.type === "text" && (
                                  <Text
                                    item={item}
                                    isActive={activeObject?.id === item.id}
                                    zoomRatio={zoomRatio}
                                    pageIndex={(() => {
                                      if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return monthPageIndex;
                                      const calendars = allObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
                                      const calendarCount = calendars.length || 1;
                                      if (calendarCount <= 1) return monthPageIndex;
                                      const subtypeObjs = allObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                      const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                      const mappedIdx = Math.min(idx, calendarCount - 1);
                                      // Sum calendar objects from all previous pages (skip cover)
                                      const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                      let prevCount = 0;
                                      for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                        (Pages[p]?.layout || []).forEach(layout => {
                                          if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar" || o.type === "multiple-calendar").length;
                                        });
                                      }
                                      return prevCount + mappedIdx;
                                    })()}
                                  />
                                )}
                                {item.type === "img" && (
                                  <Photo item={item} isActive={activeObject?.id === item.id} zoomRatio={zoomRatio} />
                                )}
                                {item.type === "sticker" && (
                                  <Sticker item={item} isActive={activeObject?.id === item.id} zoomRatio={zoomRatio} />
                                )}
                                {/* {item.type === 'sticker' && <StickerTest item={item} isActive={activeObject?.id === item.id} zoomRatio={zoomRatio} />} */}
                                {item.type === "qrcode" && (
                                  <QRCode item={item} zoomRatio={zoomRatio} />
                                )}
                                {item.type === "shape" && (
                                  <Shape item={item} isActive={activeObject?.id === item.id} zoomRatio={zoomRatio} />
                                )}
                                {item.type === "calendar" &&
                                  activeEditorType ===
                                  EDITOR_TYPES.CALENDER && (
                                    <DynamicCalendar
                                      calIndex={allObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id) + 1}
                                      calendarCount={allObjects.filter(o => o.type === "calendar").length}
                                      pageIndex={monthPageIndex}
                                      calendarMonthOffset={(() => {
                                        const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                        let prevCount = 0;
                                        for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                          (Pages[p]?.layout || []).forEach(layout => {
                                            if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar").length;
                                          });
                                        }
                                        const idx = allObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id);
                                        const offset = prevCount + Math.max(0, idx);
                                        return offset;
                                      })()}
                                      item={item}
                                      isActive={activeObject?.id === item.id}
                                      zoomRatio={zoomRatio}
                                    />
                                  )}
                                {item.type === "multiple-calendar" &&
                                  activeEditorType ===
                                  EDITOR_TYPES.CALENDER && (
                                    <MultipleDynamicCalendar
                                      calIndex={allObjects.filter(o => o.type === "multiple-calendar").findIndex(o => o.id === item.id) + 1}
                                      currentMonth={(() => {
                                        // Sum multiple-calendar objects on all previous pages (skip cover)
                                        const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                        let prevCount = 0;
                                        for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                          (Pages[p]?.layout || []).forEach(layout => {
                                            if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "multiple-calendar").length;
                                          });
                                        }
                                        const multiCalObjs = allObjects.filter(o => o.type === "multiple-calendar");
                                        const idx = multiCalObjs.findIndex(o => o.id === item.id);
                                        return prevCount + Math.max(0, idx);
                                      })()}
                                      pageIndex={monthPageIndex}
                                      item={item}
                                      isActive={activeObject?.id === item.id}
                                      zoomRatio={zoomRatio}
                                    />
                                  )}
                              </g>
                            </g>
                          ))}
                      </g>
                    </g>

                    {/* safe areas boundaries */}
                    {safeAreas &&
                      safeAreas.length > 0 &&
                      safeAreas.map((safeArea, index) => (
                        <>
                          <rect
                            x={safeArea.left}
                            y={safeArea.top}
                            width={safeArea.width}
                            height={safeArea.height}
                            fill="transparent"
                            stroke={
                              activeSafeArea?.id === safeArea.id
                                ? "#03fc03"
                                : "red"
                            }
                            strokeWidth={
                              activeSafeArea?.id === safeArea.id &&
                                !activeSafeArea?.isLocked &&
                                user?.userTypeCode !== USER_TYPES.CUSTOMER
                                ? 0
                                : 5
                            }
                            strokeDasharray="30,20" // <== Proper dashed border
                            className="not-exportable"
                            data-safe-area="true"
                            onMouseDown={(e) => {
                              // Stop the mousedown from bubbling to the SVG's
                              // handleSelectionStart, otherwise dragging the safe
                              // area starts a rubber-band marquee at the same
                              // time and selects every object the marquee crosses.
                              e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                              // Same reason as onMouseDown — block the SVG's
                              // handleTouchSelectionStart so touch-drag of the
                              // safe area doesn't also start a marquee.
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              dispatch(
                                setActiveSafeArea({
                                  areaId: safeArea.id,
                                  // pageIndex: safeArea.pageIndex,
                                  // layoutIndex: safeArea.layoutIndex,
                                  target: e.currentTarget,
                                })
                              );
                              dispatch(setActiveSide(safeArea.layoutIndex));
                            }}
                          />
                        </>
                      ))}

                    {/* safe area objects */}
                    <g className={`allObjects d-inline-block`} clipPath={isCircularShape ? `url(#product-shape-clip-${currentActivePageNumber})` : undefined}>
                      <g clipPath={`url(#clipPath)`}>
                        {allSafeAreaObjects &&
                          allSafeAreaObjects.length > 0 &&
                          allSafeAreaObjects // Sort by zIndex in ascending order
                            .map((item, key) => (
                              //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                              <g
                                key={item?.id}
                                className={`position-absolute layoutDiv1 targetE1 objTarget1_${item?.id
                                  } ${item.type === "img" &&
                                  "inset-0 overflow-hidden"
                                  }`}
                              >
                                <g
                                  className={`page-item ${item?.notExportable &&
                                    item?.notExportable === true &&
                                    user?.userTypeCode !== USER_TYPES.CUSTOMER
                                    ? "not-exportable"
                                    : ""
                                    }`}
                                  width={item.width}
                                  height={item.height}
                                  data-index={item.zIndex}
                                  data-id-t={item?.id} // Unique identifier for your SVG group
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                      getActiveCanvasObjProps?.isProcessing ||
                                      (user?.userTypeCode ===
                                        USER_TYPES.CUSTOMER &&
                                        item?.disableObjectEditing &&
                                        item?.disableObjectEditing === true)
                                    ) {
                                      return;
                                    }
                                    setCurrentTarget(
                                      e,
                                      item?.id,
                                      item.areaType
                                    );
                                    // dispatch(setActiveSide(item.layoutIndex));
                                  }}
                                  onTouchStart={(e) => {
                                    const isDisabled = getActiveCanvasObjProps?.isProcessing ||
                                      (user?.userTypeCode === USER_TYPES.CUSTOMER &&
                                        item?.disableObjectEditing === true);
                                    handleObjectTouchStart(e, item?.id, item.areaType);
                                    if (isDisabled) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                                  }}
                                  onTouchMove={handleObjectTouchMove}
                                  onTouchEnd={(e) => {
                                    const isDisabled = getActiveCanvasObjProps?.isProcessing ||
                                      (user?.userTypeCode === USER_TYPES.CUSTOMER &&
                                        item?.disableObjectEditing === true);
                                    handleObjectTouchEnd(e, item?.id, item.areaType, undefined, isDisabled);
                                  }}
                                  style={{
                                    transform: `translate(${item.transform.x + (() => {
                                      const isFullCoverPage =
                                        ((activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet) ||
                                          (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled && settings?.showFullCoverSheet)) &&
                                        currentActivePageNumber === 0;
                                      if (!isFullCoverPage) return 0;
                                      const sw = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
                                      if (sw <= 0) return 0;
                                      if (item.layoutIndex === 1) {
                                        // Right side: shift right by full spine width so objects start at inner right spine line
                                        return sw;
                                      }
                                      // Left side (layoutIndex === 0): no shift — objects end at spineX (inner left spine line)
                                      return 0;
                                    })()}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                    // Pivot: see matching note on the primary object container —
                                    // frame-centre (viewBox) pivot ONLY for the image being
                                    // inner-panned right now; fill-box otherwise so react-moveable
                                    // gestures never see view-box (which would loop onRender).
                                    ...(item.type === "img" && isDragger && activeObject?.id === item.id
                                      ? {
                                        transformOrigin: `${item.width / 2}px ${item.height / 2}px`,
                                        transformBox: "view-box",
                                      }
                                      : {
                                        transformOrigin: "center center",
                                        transformBox: "fill-box",
                                      }),
                                    overflow: "hidden",
                                    width: item.width,
                                    height: item.height,

                                  }}
                                >
                                  {item.type === "text" && (
                                    <Text
                                      item={item}
                                      zoomRatio={zoomRatio}
                                      pageIndex={(() => {
                                        if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return monthPageIndex;
                                        const calendars = allObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
                                        const calendarCount = calendars.length || 1;
                                        if (calendarCount <= 1) return monthPageIndex;
                                        const subtypeObjs = allObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                        const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                        const mappedIdx = Math.min(idx, calendarCount - 1);
                                        // Sum calendar objects from all previous pages (skip cover)
                                        const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                        let prevCount = 0;
                                        for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                          (Pages[p]?.layout || []).forEach(layout => {
                                            if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar" || o.type === "multiple-calendar").length;
                                          });
                                        }
                                        return prevCount + mappedIdx;
                                      })()}
                                    />
                                  )}
                                  {item.type === "img" && (
                                    <Photo item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "sticker" && (
                                    <Sticker
                                      item={item}
                                      zoomRatio={zoomRatio}
                                    />
                                  )}
                                  {/* {item.type === 'sticker' && <StickerTest item={item} zoomRatio={zoomRatio} />} */}
                                  {item.type === "qrcode" && (
                                    <QRCode item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "shape" && (
                                    <Shape item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "calendar" &&
                                    activeEditorType ===
                                    EDITOR_TYPES.CALENDER && (
                                      <DynamicCalendar
                                        calIndex={allObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id) + 1}
                                        calendarCount={allObjects.filter(o => o.type === "calendar").length}
                                        pageIndex={monthPageIndex}
                                        calendarMonthOffset={(() => {
                                          const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                          let prevCount = 0;
                                          for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                            (Pages[p]?.layout || []).forEach(layout => {
                                              if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar").length;
                                            });
                                          }
                                          const idx = allObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id);
                                          return prevCount + Math.max(0, idx);
                                        })()}
                                        item={item}
                                        zoomRatio={zoomRatio}
                                      />
                                    )}
                                  {item.type === "multiple-calendar" &&
                                    activeEditorType ===
                                    EDITOR_TYPES.CALENDER && (
                                      <MultipleDynamicCalendar
                                        calIndex={allObjects.filter(o => o.type === "multiple-calendar").findIndex(o => o.id === item.id) + 1}
                                        currentMonth={(() => {
                                          // Sum multiple-calendar objects on all previous pages (skip cover)
                                          const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                          let prevCount = 0;
                                          for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                            (Pages[p]?.layout || []).forEach(layout => {
                                              if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "multiple-calendar").length;
                                            });
                                          }
                                          const multiCalObjs = allObjects.filter(o => o.type === "multiple-calendar");
                                          const idx = multiCalObjs.findIndex(o => o.id === item.id);
                                          return prevCount + Math.max(0, idx);
                                        })()}
                                        pageIndex={monthPageIndex}
                                        item={item}
                                        zoomRatio={zoomRatio}
                                      />
                                    )}
                                </g>
                              </g>
                            ))}
                      </g>
                    </g>

                    {activeEditorType === EDITOR_TYPES.CANVAS && (
                      <CanvasLayout canvasSize={canvasSize} thickness={1} />
                    )}

                    {/* Spine guide lines — rendered ABOVE all objects so lines are always visible.
                        Transparent (no background fills). Background continuity is handled by bg rects behind objects. */}
                    {((activeEditorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet) ||
                      (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled && settings?.showFullCoverSheet)) &&
                      currentActivePageNumber === 0 &&
                      (() => {
                        const liveSpineWidth = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
                        if (liveSpineWidth <= 0) return null;
                        const spineX = getCanvasWidth();
                        const sw = liveSpineWidth;
                        const outerOffset = Math.max(2, sw * 0.15);
                        return (
                          <g id="photobook-spine" className="photobook-spine photobook-spine-area" pointerEvents="none">
                            {/* Inner solid lines — actual spine boundary (content boundary) */}
                            {[spineX, spineX + sw].map((lx, i) => (
                              <line key={`spine-inner-${i}`}
                                x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                                stroke="#555555" strokeWidth={1.5 / zoomRatio} strokeOpacity="0.9" />
                            ))}
                            {/* Outer dashed lines — safe area beyond spine edges */}
                            {[spineX - outerOffset, spineX + sw + outerOffset].map((lx, i) => (
                              <line key={`spine-outer-${i}`}
                                x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                                stroke="#888888" strokeWidth={1 / zoomRatio} strokeOpacity="0.5"
                                strokeDasharray={`${6 / zoomRatio} ${4 / zoomRatio}`} />
                            ))}
                          </g>
                        );
                      })()}

                    {/* PRINT GUIDES OVERLAY */}
                    <g className="print-guides" pointerEvents="none">
                      {bleedMargin > 0 && (
                        isCircularShape ? (
                          <ellipse
                            cx={pageWidth / 2}
                            cy={pageHeight / 2}
                            rx={bleedRect.width / 2}
                            ry={bleedRect.height / 2}
                            fill="none"
                            stroke="#ff4d4f"
                            strokeWidth={2 / zoomRatio}
                            strokeDasharray={`${6 / zoomRatio} ${6 / zoomRatio}`}
                            pointerEvents="none"
                          />
                        ) : (
                          <rect
                            x={bleedRect.x}
                            y={bleedRect.y}
                            width={bleedRect.width}
                            height={bleedRect.height}
                            fill="none"
                            stroke="#ff4d4f"
                            strokeWidth={2 / zoomRatio}
                            strokeDasharray={`${6 / zoomRatio} ${6 / zoomRatio}`}
                            pointerEvents="none"
                          />
                        )
                      )}

                      {/* Trim line */}
                      {isCircularShape ? (
                        <ellipse
                          cx={pageWidth / 2}
                          cy={pageHeight / 2}
                          rx={trimRect.width / 2}
                          ry={trimRect.height / 2}
                          fill="none"
                          stroke="#e0d5d5ff"
                          strokeWidth={trimStroke}
                          pointerEvents="none"
                        />
                      ) : (
                        <rect
                          x={trimRect.x}
                          y={trimRect.y}
                          width={trimRect.width}
                          height={trimRect.height}
                          fill="none"
                          stroke="#e0d5d5ff"
                          strokeWidth={trimStroke}
                          pointerEvents="none"
                        />
                      )}

                      {/* Safe area */}
                      {safeMargin > 0 && (
                        isCircularShape ? (
                          <ellipse
                            cx={pageWidth / 2}
                            cy={pageHeight / 2}
                            rx={safeRect.width / 2}
                            ry={safeRect.height / 2}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={2 / zoomRatio}
                            strokeDasharray={`${8 / zoomRatio} ${8 / zoomRatio}`}
                            pointerEvents="none"
                          />
                        ) : (
                          <rect
                            x={safeRect.x}
                            y={safeRect.y}
                            width={safeRect.width}
                            height={safeRect.height}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={2 / zoomRatio}
                            strokeDasharray={`${8 / zoomRatio} ${8 / zoomRatio}`}
                            pointerEvents="none"
                          />
                        )
                      )}

                      {/* Spine guide lines rendered inside the spine <g> above */}
                    </g>

                    {/* Marquee selection rectangle — updated via ref, zero React re-renders during drag */}
                    <rect
                      ref={selectionRectRef}
                      x={0} y={0} width={0} height={0}
                      style={{
                        display:       "none",
                        fill:          "color-mix(in srgb, var(--primary) 15%, transparent)",
                        stroke:        "var(--primary)",
                        strokeWidth:   1 / (zoomRatio || 1),
                        strokeDasharray: `${4 / (zoomRatio || 1)} ${2 / (zoomRatio || 1)}`,
                        pointerEvents: "none",
                      }}
                    />

                  </svg>

                  {/* Multi-select mode toggle button — visible on canvas, works on mobile too */}
                  {/* <button
                    title={isMultiSelectMode ? "Exit multi-select mode (Esc)" : "Enter multi-select mode"}
                    onClick={() => {
                      if (isMultiSelectMode) {
                        dispatch(setIsMultiSelectMode(false));
                        dispatch(deSelectActiveObject());
                      } else {
                        dispatch(setIsMultiSelectMode(true));
                      }
                    }}
                    style={{
                      position:     "absolute",
                      bottom:       8,
                      right:        8,
                      zIndex:       100,
                      display:      "flex",
                      alignItems:   "center",
                      gap:          5,
                      padding:      "5px 10px",
                      borderRadius: 6,
                      border:       `1px solid ${isMultiSelectMode ? "var(--primary)" : "var(--border)"}`,
                      background:   isMultiSelectMode ? "var(--primary)"    : "var(--background)",
                      color:        isMultiSelectMode ? "var(--primary-foreground)" : "var(--foreground)",
                      cursor:       "pointer",
                      fontSize:     12,
                      fontWeight:   isMultiSelectMode ? 600 : 400,
                      userSelect:   "none",
                      boxShadow:    "0 2px 8px rgba(0,0,0,0.15)",
                      transition:   "all 0.15s",
                      whiteSpace:   "nowrap",
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z"/>
                    </svg>
                    <span className="d-none d-sm-inline">
                      {isMultiSelectMode ? "Exit Select" : "Multi-Select"}
                    </span>
                  </button> */}

                  {/* left side border to show left active side */}
                  {((activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                    currentActivePageNumber !== 1 &&
                    currentActivePageNumber !== Pages.length - 2 &&
                    !isCover) ||
                    (settings?.isFoldable &&
                      settings?.isFoldable === true &&
                      currentPageSettings?.isHalfSheet !== true)) &&
                    activeSide === 0 && (
                      <div
                        className="selected-left top-0 position-absolute"
                        onClick={handleLeftSideClick}
                        style={{
                          height: `${canvasSize.height * zoomRatio + 4}px`,
                          width: `${currentActivePageNumber == Pages.length - 2 &&
                            !settings?.isFoldable
                            ? calculateSvgDimensions().width + 4
                            : calculateSvgDimensions().width / 2 + 4
                            }px`,
                        }}
                      ></div>
                    )}

                  {/* right side border to show right active side */}
                  {((activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                    !isCover &&
                    currentActivePageNumber !== Pages.length - 2) ||
                    (settings?.isFoldable &&
                      settings?.isFoldable === true &&
                      currentPageSettings?.isHalfSheet !== true)) &&
                    activeSide === 1 && (
                      <div
                        className={`end-0  top-0 position-absolute selected-right`}
                        onClick={handleRightSideClick}
                        style={{
                          height: `${canvasSize.height * zoomRatio + 4}px`,
                          width: `${currentActivePageNumber == Pages.length - 2 &&
                            !settings?.isFoldable
                            ? calculateSvgDimensions().width + 4
                            : calculateSvgDimensions().width / 2 + 4
                            }px`,
                        }}
                      ></div>
                    )}
                </div>
              </div>

              {/* right non editable blank page specialy for photo book before back cover */}
              {activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                currentActivePageNumber === Pages.length - 2 && (
                  <div
                    className="WrapperDivLine"
                    style={{
                      width: `${getWidth()}px`,
                      height: `${getHeight()}px`,
                      backgroundColor: "#e6e6e6",
                    }}
                  ></div>
                )}
              </div>
              {/* /ruler-reserve-wrap. Draggers stay INSIDE .canvas-box (share the
                  zoom transform) but OUTSIDE ruler-reserve-wrap (the 0.95 scale). */}

              <ItemDragger />
              <SafeAreaDragger />
              <SafeAreaPopup
                show={showSafeAreaGuide || showSafeAreaGuideFirstTime}
                onHide={handleCloseSafeAreaPopup}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MainCanvas;
