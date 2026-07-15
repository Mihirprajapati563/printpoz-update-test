import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import {
  DisplayStart,
  PreviewItemAddPage,
  PageText,
  PageTextWrapper,
  PageWrapper,
  PreviewItem,
  ScrollContainer,
  PreviewItemDropIndicator,
  PrimaryButton,
  PaginationButton,
} from "../common-components/StyledComponents.jsx";
import { FooterJSON } from "../library/utils/jsons/commonJSON.js";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllPages,
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getAllObjectsSortedByZIndexByPageIndex,
  getCalendarSettings,
  getSafeAreas,
  getActiveSafeArea,
  getSafeAreaFromPage,
  getAllSafeAreaObjectsSortedByZIndexByPageIndex,
  getSettings,
  getAllPagesSettings,
  getMaxPages,
  getCurrentActivePageObjects,
  getAllObjectsOfAllLayoutsOfCurrentPage,
  getTotalPages,
  getPageSettings,
  getBillablePages,
} from "../library/utils/helpers/index.js";
import {
  setPageNumber,
  setCurrentObjectProperties,
  editorType,
  changePageOrder,
  setActiveObject,
  addNewPage,
  setActiveSide,
  setActiveSafeArea,
  deSelectSafeArea,
  setPageLayout,
  setEntireSpreadLayout,
} from "../store/slices/canvas.js";
import { setLayoutMode } from "../store/slices/appAlice.js";
import {
  EDITOR_SUB_TYPES,
  EDITOR_TYPES,
  EDITOR_ASSETS,
  USER_TYPES,
} from "../library/utils/constants/index.js";
import {
  getPhotoBookPagelabel,
  getPageLabelForTwoSideProduct,
  getPageLabelForFoldableProduct,
  getPageLabelForLayflatWithCover,
  decompressFromBase64,
  scaleLayout,
} from "../library/utils/common-functions/index.js";
import {
  calculateZoomRatio,
  getResolutionScaleValueBySize,
} from "../library/utils/common-functions/index.js";
import { apiPost } from "../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../library/utils/constants/apiurl.js";
import { BiMinus, BiPlus, BiShuffle } from "react-icons/bi";
import { RiFileLine, RiBookOpenLine } from "react-icons/ri";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import Text from "./preview/Text.jsx";
import Photo from "./preview/Photo.jsx";
import Sticker from "./preview/Sticker.jsx";
import QRCode from "./preview/QRCode.jsx";
import Shape from "./preview/Shape.jsx";
import DynamicCalendar from "./preview/DynamicCalendar.jsx";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { IoAddCircleOutline } from "react-icons/io5";
import MultipleDynamicCalendar from "../components/calendar/MultipleDynamicCalendar.jsx";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../library/utils/helpers/gradientUtils";
import useCachedUrl from "../hooks/useCachedUrl.js";

// Thin wrapper that resolves background image URLs through the offline cache
const CachedSvgImage = ({ href, ...props }) => {
  const resolvedHref = useCachedUrl(href);
  return <image href={resolvedHref} {...props} />;
};

export const ShuffleLayoutControls = () => {
  const dispatch = useDispatch();
  const canvasSize = useSelector(getCanvasSize);
  const editorType = useSelector(getActiveEditorType);
  const settings = useSelector(getSettings);
  const currentActivePageObjects = useSelector(getCurrentActivePageObjects);
  const allLayoutObjectOfCurrentPage = useSelector(getAllObjectsOfAllLayoutsOfCurrentPage);
  const activePageIndex = useSelector(getCurrentPageIndex);
  const totalEditorPages = useSelector(getTotalPages);
  const currentPageSettings = useSelector(getPageSettings);

  // Read/write the layout mode through Redux so the Layouts sidebar tab,
  // the footer toggle, and consumers like ImageFloatingToolbar (Set as
  // Background) all agree on whether the user is in "page" or "spread" mode.
  const activeLayout = useSelector((state) => state.appSlice.layoutMode);
  const setActiveLayout = useCallback(
    (mode) => {
      dispatch(setLayoutMode(mode));
      // Default activeSide to Left whenever the user enters Spread mode —
      // any per-side operation (e.g. adding a new photo) should land on the
      // left page until the user explicitly switches back to Page mode and
      // picks a side.
      if (mode === "spread") dispatch(setActiveSide(0));
    },
    [dispatch]
  );
  const activeSide = useSelector((state) => state.canvas.present.activeSide);
  const [spreadEditorPages, setSpreadEditorPages] = useState(false);
  const [pageLayouts, setPageLayouts] = useState([]);
  const [spreadLayouts, setSpreadLayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [currentPageImageCount, setCurrentPageImageCount] = useState(0);
  const [maxImageCountOfLayout, setMaxImageCountOfLayout] = useState(0);
  const [lastAppliedId, setLastAppliedId] = useState(null);

  // Instant switch — no API call on toggle
  const allLayouts = activeLayout === "spread" ? spreadLayouts : pageLayouts;

  // Track previous page index so we can auto-flip only on actual page
  // navigation. Other dep changes (settings tweaks, etc.) shouldn't reset
  // the user's manual Page/Spread selection while they're still on the same
  // page.
  const prevActivePageIndexRef = React.useRef(activePageIndex);
  useEffect(() => {
    const isInteriorPhotobookSpread =
      editorType === EDITOR_TYPES.PHOTOBOOK &&
      activePageIndex !== 0 &&
      activePageIndex !== totalEditorPages - 1 &&
      activePageIndex !== 1 &&
      activePageIndex !== totalEditorPages - 2;
    const isFoldableFullSheet =
      settings?.isFoldable === true && currentPageSettings?.isHalfSheet !== true;
    const isPhotobookFullCover =
      editorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet && activePageIndex === 0;
    const spreadEligible = isInteriorPhotobookSpread || isFoldableFullSheet || isPhotobookFullCover;

    setSpreadEditorPages(spreadEligible);

    const pageChanged = prevActivePageIndexRef.current !== activePageIndex;
    prevActivePageIndexRef.current = activePageIndex;

    if (!spreadEligible) {
      // Spread isn't even an option — force "page" regardless of manual state.
      if (activeLayout === "spread") setActiveLayout("page");
    } else if (pageChanged) {
      // Default to spread when navigating onto a spread-eligible page.
      // User can still manually flip to "page" afterwards and that choice
      // sticks until they navigate again.
      setActiveLayout("spread");
    }
  }, [activePageIndex, currentPageSettings, settings, editorType, totalEditorPages, activeLayout, setActiveLayout]);

  // Exactly mirrors LayoutsAction's scaleLayouts
  function scaleLayouts(responseArray, newWidth, newHeight) {
    let splitby = 1;
    if (editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true)) {
      splitby = 2;
    }
    responseArray.forEach((entry) => {
      entry.layout_c.layout = entry.layout_c.layout.map((layout) => {
        return scaleLayout(layout, newWidth / splitby, newHeight);
      });
    });
    return responseArray;
  }

  const fetchSingle = async (isSpread) => {
    const data = {
      filter: {
        status: { $in: [1, 3] },
        display_in_web: true,
        number_of_layouts: isSpread ? 2 : 1,
        spread: isSpread,
        number_of_images: { $gte: 1 },
        asset_type: EDITOR_ASSETS.LAYOUT,
      },
      skip: 0,
      limit: 10000000,
      sortField: "_id",
      sortOrder: "desc",
    };
    const response = await apiPost(ENDPOINTS.getLayouts, data);
    if (response?.items) {
      return scaleLayouts(
        response.items.map((item) => ({ ...item, layout: "", layout_c: decompressFromBase64(item.layout_c) })),
        canvasSize.width,
        canvasSize.height
      );
    }
    return [];
  };

  // Fetch both page + spread layouts in parallel on mount — toggle is instant
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pg, sp] = await Promise.all([fetchSingle(false), fetchSingle(true)]);
        setPageLayouts(pg);
        setSpreadLayouts(sp);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canvasSize]);

  // Update max image count whenever the active layout set changes
  useEffect(() => {
    let maxCount = 0;
    allLayouts.forEach((l) => { if (l.number_of_images > maxCount) maxCount = l.number_of_images; });
    setMaxImageCountOfLayout(maxCount);
  }, [allLayouts]);

  // Exactly mirrors LayoutsAction's image count useEffect
  useEffect(() => {
    if (activeLayout !== "spread") {
      const imageCount = currentActivePageObjects?.filter(obj => obj.type === 'img').length;
      setCurrentPageImageCount(imageCount > 0 ? imageCount : 0);
    } else {
      const imageCount = allLayoutObjectOfCurrentPage?.filter(obj => obj.type === 'img').length;
      setCurrentPageImageCount(imageCount > 0 ? imageCount : 0);
    }
  }, [currentActivePageObjects, activeLayout, allLayoutObjectOfCurrentPage]);

  // Exactly mirrors LayoutsAction's shuffleLayout — plus lastAppliedId guard
  const shuffleLayout = (byNumber) => {
    setShuffling(true);
    const imageObjects = activeLayout !== "spread"
      ? currentActivePageObjects?.filter(obj => obj.type === 'img')
      : allLayoutObjectOfCurrentPage?.filter(obj => obj.type === 'img');
    const imageCount = byNumber && byNumber === -1
      ? imageObjects?.length > 1 ? imageObjects?.length - 1 : 0
      : byNumber && byNumber === 1
        ? imageObjects?.length > 0 ? imageObjects?.length + 1 : 1
        : imageObjects?.length > 0 ? imageObjects?.length : 1;

    if (imageCount === 0) {
      alert("No images found on current page to shuffle");
      setShuffling(false);
      return;
    }

    let compatibleLayouts = allLayouts?.filter(layout => layout.number_of_images === imageCount) || [];
    // For the +/- buttons, if no layout has the exact target count, fall to the
    // next available count in the button's direction — higher for "+", lower for
    // "-" — searching up to 25 photos. Only warn if nothing in range has a layout.
    let usedFallbackCount = null;
    if (compatibleLayouts.length === 0 && (byNumber === 1 || byNumber === -1)) {
      for (let step = 1; step <= 25; step++) {
        const targetCount = imageCount + byNumber * step;
        if (targetCount < 1 || targetCount > 25) break;
        const next = allLayouts?.filter(layout => layout.number_of_images === targetCount) || [];
        if (next.length > 0) {
          compatibleLayouts = next;
          usedFallbackCount = targetCount;
          break;
        }
      }
    }
    if (compatibleLayouts.length === 0) {
      alert(`No compatible layouts found with ${imageCount} image(s)`);
      setShuffling(false);
      return;
    }

    // Always pick a different layout than the last applied
    if (compatibleLayouts.length > 1 && lastAppliedId) {
      const filtered = compatibleLayouts.filter(l => l._id !== lastAppliedId);
      if (filtered.length > 0) compatibleLayouts = filtered;
    }

    const randomLayout = compatibleLayouts[Math.floor(Math.random() * compatibleLayouts.length)];
    setLastAppliedId(randomLayout._id);
    dispatch(setCurrentObjectProperties(null));
    if (activeLayout !== "spread") {
      dispatch(setPageLayout(randomLayout.layout_c.layout[0]));
    } else {
      dispatch(setEntireSpreadLayout(randomLayout.layout_c.layout));
    }
    if (usedFallbackCount != null) {
      toast.info(
        `No layout with ${imageCount} photos exists — used a ${usedFallbackCount}-photo layout instead.`
      );
    }
    setShuffling(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0px", flexWrap: "nowrap", justifyContent: "center", borderRadius: "10px", border: "1px solid #ddd", overflow: "hidden" }}>
      {/* L / R side selector — always clickable. Any side switch clears
          the current selection so activeSide and activeObject can never
          desync. Clicking the side that's already active is a no-op. */}
      {spreadEditorPages && (
        <div style={{ display: "flex", overflow: "hidden", marginRight: "4px", borderRadius: "10px" }}>
          {[
            { side: 0, label: "L", tip: "Left side" },
            { side: 1, label: "R", tip: "Right side" },
          ].map(({ side, label, tip }, idx) => (
            <OverlayTrigger
              key={side}
              placement="top"
              overlay={<Tooltip><strong>{tip}</strong></Tooltip>}
            >
              <button
                onClick={() => {
                  if (activeSide === side) return;
                  dispatch(setCurrentObjectProperties(null));
                  dispatch(setActiveSide(side));
                }}
                style={{
                  padding: "5px 12px",
                  minWidth: 34,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    activeSide === side ? "var(--primary)" : "#fff",
                  color: activeSide === side ? "#fff" : "#555",
                  transition: "background 0.15s, color 0.15s",
                  borderRight: idx === 0 ? "1px solid #ddd" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {label}
              </button>
            </OverlayTrigger>
          ))}
        </div>
      )}

      {/* Page / Spread rounded toggle — only when spread pages available */}
      {spreadEditorPages && (
        <div style={{ display: "flex", overflow: "hidden", marginRight: "4px", borderRadius: "10px" }}>
          {["page", "spread"].map((mode) => (
            <OverlayTrigger
              key={mode}
              placement="top"
              overlay={<Tooltip><strong>{mode === "page" ? "Page" : "Spread"}</strong></Tooltip>}
            >
              <button
                onClick={() => setActiveLayout(mode)}
                style={{
                  padding: "5px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: activeLayout === mode ? "var(--primary)" : "#fff",
                  color: activeLayout === mode ? "#fff" : "#555",
                  transition: "background 0.15s, color 0.15s",
                  textTransform: "capitalize",
                  borderRight: mode === "page" ? "1px solid #ddd" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {mode === "page" ? <RiFileLine size={20} /> : <RiBookOpenLine size={20} />}
              </button>
            </OverlayTrigger>
          ))}
        </div>
      )}


      {/* − / Change Layout / + — same disabled conditions as LayoutsAction */}
      <OverlayTrigger placement="top" overlay={<Tooltip><strong>Fewer Images</strong></Tooltip>}>
        <PaginationButton
          padding="5px 12px"
          onClick={() => !(shuffling || loading || currentPageImageCount <= 1) && shuffleLayout(-1)}
          style={{
            opacity: shuffling || loading || currentPageImageCount <= 1 ? 0.4 : 1,
            cursor: shuffling || loading || currentPageImageCount <= 1 ? "not-allowed" : "pointer",
          }}
        >
          <BiMinus size={20} />
        </PaginationButton>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={<Tooltip><strong>Change Layout</strong></Tooltip>}>
        <PaginationButton
          padding="5px 12px"
          onClick={() => !(shuffling || loading || currentPageImageCount <= 0) && shuffleLayout()}
          style={{
            opacity: shuffling || loading || currentPageImageCount <= 0 ? 0.4 : 1,
            cursor: shuffling || loading || currentPageImageCount <= 0 ? "not-allowed" : "pointer",
          }}
        >
          <BiShuffle size={20} />
        </PaginationButton>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={<Tooltip><strong>More Images</strong></Tooltip>}>
        <PaginationButton
          padding="5px 12px"
          onClick={() => !(shuffling || loading || currentPageImageCount >= maxImageCountOfLayout) && shuffleLayout(1)}
          style={{
            opacity: shuffling || loading || currentPageImageCount >= maxImageCountOfLayout ? 0.4 : 1,
            cursor: shuffling || loading || currentPageImageCount >= maxImageCountOfLayout ? "not-allowed" : "pointer",
          }}
        >
          <BiPlus size={20} />
        </PaginationButton>
      </OverlayTrigger>
    </div>
  );
};

export const Footer = ({ styleclass }) => {
  return (
    <DndProvider backend={HTML5Backend}>
      <PreviewAllPages styleclass={styleclass} />
    </DndProvider>
  );
};

// Skeleton shimmer for a single page thumbnail
const PageSkeleton = () => (
  <div
    style={{
      display: "inline-block",
      width: 120,
      height: 80,
      margin: "10px 14px",
      borderRadius: 3,
      background: "linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)",
      backgroundSize: "200% 100%",
      animation: "footerSkeletonShimmer 1.4s ease-in-out infinite",
    }}
  />
);

// Inject shimmer keyframes once (no styled-component dependency)
if (typeof document !== "undefined" && !document.getElementById("footer-skeleton-style")) {
  const s = document.createElement("style");
  s.id = "footer-skeleton-style";
  s.textContent = `@keyframes footerSkeletonShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
  document.head.appendChild(s);
}

const PreviewAllPages = ({ styleclass }) => {
  const AllPages = useSelector(getAllPages);
  const allPagesSettings = useSelector(getAllPagesSettings);
  const activeEditorType = useSelector(getActiveEditorType);
  const settings = useSelector(getSettings);
  const isThemeApplied = useSelector((state) => state.projectSetup.isThemeApplied);

  // Mouse-wheel → SMOOTH horizontal scroll of the page strip. A plain vertical
  // wheel (the common case) glides the footer pages sideways. (Pure CSS can't
  // remap the wheel axis — that needs JS.) Native non-passive listener because
  // React's synthetic onWheel is passive, so e.preventDefault() there is a no-op.
  //
  // Smoothness: instead of jumping scrollLeft per event (jerky, and Firefox sends
  // coarse "line" deltas), each wheel feeds a `target` and a requestAnimationFrame
  // loop eases scrollLeft toward it (~18% of the remaining gap per frame), giving
  // a momentum-like glide. Re-runs when the view switches between the skeleton and
  // the real strip so the ref points at the mounted ScrollContainer.
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let target = el.scrollLeft;
    let raf = null;

    const tick = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target;
        raf = null;
        return;
      }
      el.scrollLeft += diff * 0.18; // ease toward target
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e) => {
      // Nothing to scroll horizontally → leave normal page scrolling alone.
      if (el.scrollWidth <= el.clientWidth) return;
      // Use whichever axis the wheel/trackpad moved most.
      let delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      // Normalise non-pixel deltas (Firefox line mode / page mode) to pixels so
      // the speed feels the same across browsers.
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= el.clientWidth;
      e.preventDefault();
      // Re-sync to the real position when idle so a new gesture starts cleanly.
      if (raf === null) target = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;
      target = Math.max(0, Math.min(max, target + delta));
      if (raf === null) raf = requestAnimationFrame(tick);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [isThemeApplied]);

  // Pre-compute cumulative calendar counts per page — O(n) instead of O(n²)
  const calendarCounts = useMemo(() => {
    const counts = [];
    let prevMultiCalCount = 0;
    let prevCalCount = 0;
    AllPages.forEach((page) => {
      counts.push({ prevMultiCalCount, prevCalCount });
      if (!page) return;
      (page.layout || []).forEach((layout) => {
        if (layout?.objects) {
          prevMultiCalCount += layout.objects.filter((o) => o.type === "multiple-calendar").length;
          prevCalCount += layout.objects.filter((o) => o.type === "calendar").length;
        }
      });
    });
    return counts;
  }, [AllPages]);

  if (!isThemeApplied) {
    return (
      <div
        style={{
          padding: "0px",
          border: "1px solid lightgray",
          borderRadius: "4px",
          backgroundColor: "#f9f9f9",
          overflowX: "auto",
        }}
      >
        <ScrollContainer ref={scrollRef} className={styleclass}>
          {Array.from({ length: 12 }).map((_, i) => (
            <PageSkeleton key={i} />
          ))}
        </ScrollContainer>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "0px",
        border: "1px solid lightgray",
        borderRadius: "4px",
        backgroundColor: "#f9f9f9",
        overflowX: "auto",
      }}
    >
      <ScrollContainer ref={scrollRef} className={styleclass}>
        {AllPages.map((activePage, index) => {
          if (!activePage) return null;
          // Hide the last cover page thumbnail when hideLastCover is enabled.
          // Photobook: always applicable. Layflat: only when a separate back
          // cover exists (coverEnabled && !showFullCoverSheet) — full-cover
          // mode merges front/back into one spread page so there's nothing to
          // hide.
          const hideLastForPhotobook =
            activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
            settings?.hideLastCover;
          const hideLastForLayflat =
            activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
            settings?.hideLastCover &&
            settings?.coverEnabled &&
            !settings?.showFullCoverSheet;
          if (
            (hideLastForPhotobook || hideLastForLayflat) &&
            index === AllPages.length - 1
          ) {
            return null;
          }
          const { prevMultiCalCount, prevCalCount } = calendarCounts[index] || { prevMultiCalCount: 0, prevCalCount: 0 };

          return (
            <Page
              key={`${activePage.id}_${index}`}
              index={index}
              activePage={activePage}
              totalPages={AllPages.length}
              pageSettings={activePage.settings}
              allPagesSettings={allPagesSettings}
              prevMultiCalCount={prevMultiCalCount}
              prevCalCount={prevCalCount}
            />
          );
        })}
      </ScrollContainer>
    </div>
  );
};

const Page = React.memo(({
  activePage,
  index,
  totalPages,
  pageSettings,
  allPagesSettings = [],
  prevMultiCalCount = 0,
  prevCalCount = 0,
}) => {
  const dispatch = useDispatch();
  const canvasSize = useSelector(getCanvasSize);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const activeEditorType = useSelector(getActiveEditorType);
  const [previewBoxSize, setPreviewBoxSize] = useState({
    width: 120,
    height: 80,
  });
  const [zoomRatio, setZoomRatio] = useState(1);
  const calendarSettings = useSelector(getCalendarSettings);
  const activeSafeArea = useSelector(getActiveSafeArea);
  const settings = useSelector(getSettings);
  const billablePages = useSelector(getBillablePages);
  const user = useSelector((state) => state.projectSetup.userDetails);

  // Compute sorted objects & safe areas only when this page's data changes
  const sortedObjects = useMemo(
    () => getAllObjectsSortedByZIndexByPageIndex(activePage),
    [activePage]
  );
  const safeAreaObjects = useMemo(
    () => getAllSafeAreaObjectsSortedByZIndexByPageIndex(activePage),
    [activePage]
  );
  const pageSafeAreas = useMemo(
    () => getSafeAreaFromPage(activePage, index),
    [activePage, index]
  );

  // Pre-compute calendar-type subsets once per sortedObjects change
  const calendarObjects = useMemo(
    () => sortedObjects.filter((o) => o.type === "calendar"),
    [sortedObjects]
  );
  const multiCalObjects = useMemo(
    () => sortedObjects.filter((o) => o.type === "multiple-calendar"),
    [sortedObjects]
  );
  const safeCalendarObjects = useMemo(
    () => safeAreaObjects.filter((o) => o.type === "calendar"),
    [safeAreaObjects]
  );
  const safeMultiCalObjects = useMemo(
    () => safeAreaObjects.filter((o) => o.type === "multiple-calendar"),
    [safeAreaObjects]
  );
  const setPageIndex = (index) => {
    dispatch(setPageNumber(index));
    dispatch(deSelectSafeArea());
    dispatch(setCurrentObjectProperties(null));
  };
  const maxPages = useSelector(getMaxPages);
  const updatePreviewCanvasSize = () => {
    const newLayoutBoxSize = getResolutionScaleValueBySize(
      canvasSize.width,
      canvasSize.height,
      180,
      100
    );
    if (newLayoutBoxSize) {
      const newZoomRatio = calculateZoomRatio(
        canvasSize.width,
        canvasSize.height,
        newLayoutBoxSize.width,
        newLayoutBoxSize.height
      );
      setZoomRatio(newZoomRatio);
      setPreviewBoxSize(newLayoutBoxSize);
    }
  };

  useEffect(() => {
    updatePreviewCanvasSize();
  }, [canvasSize]);

  const getPageLabel = (index) => {
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK)
      return getPhotoBookPagelabel(index, totalPages);
    else if (
      activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
      settings?.isFoldable &&
      !settings?.coverEnabled
    )
      return getPageLabelForFoldableProduct(index, allPagesSettings);
    else if (
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true
    )
      return getPageLabelForLayflatWithCover(
        index,
        totalPages,
        settings?.showFullCoverSheet
      );
    else if (
      activeEditorType === EDITOR_TYPES.VISITING_CARD ||
      (activeEditorType === EDITOR_TYPES.GREETING_CARD &&
        settings?.subtype === EDITOR_SUB_TYPES.GREETING_CARD.DOUBLE_SIDE)
    )
      return getPageLabelForTwoSideProduct(index);
    else return index + 1;
  };
  const movePage = (fromIndex, toIndex) => {
    dispatch(changePageOrder({ fromIndex, toIndex }));
  };

  const addNewPageAtPosition = (index) => {
    // Maximum-pages limit disabled — customers can insert unlimited pages.
    /*
    if (
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK
        ? totalPages * 2 - 6
        : EDITOR_TYPES.LAYFLATALBUM
          ? settings?.coverEnabled === true
            ? totalPages * 2 - 4
            : totalPages * 2
          : totalPages) >= maxPages
    ) {
      alert("you reached the maximum pages allowed " + maxPages);
      return;
    }
    */
    dispatch(addNewPage({ index }));

    // Your logic to add a new page at the specified index
  };

  const canMove = (sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) {
      return false;
    }

    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      if (
        sourceIndex === 0 ||
        sourceIndex === totalPages - 1 ||
        sourceIndex === 1 ||
        sourceIndex === totalPages - 2
      ) {
        return false;
      }

      if (
        targetIndex === 0 ||
        targetIndex === totalPages - 1 ||
        targetIndex === 1 ||
        targetIndex === totalPages - 2
      ) {
        return false;
      }
    }

    if (
      activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      settings?.showFullCoverSheet === false
    ) {
      if (sourceIndex === 0 || sourceIndex === totalPages - 1) {
        return false;
      }

      if (targetIndex === 0 || targetIndex === totalPages - 1) {
        return false;
      }
    }

    if (
      activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      settings?.showFullCoverSheet === true
    ) {
      if (sourceIndex === 0) {
        return false;
      }

      if (targetIndex === 0) {
        return false;
      }
    }
    return true;
  };

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [, ref] = useDrag({
    type: ItemType,
    item: { index },
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover(item) {
      // Update only on hover to keep track of the target index
      if (canMove(item.index, index)) {
        setHoveredIndex(index);
      }
    },
    drop(item) {
      // Call handleDrop only when the item is dropped
      if (canMove(item.index, index)) {
        // for photobook we are not allowing to change position of first, last page and cover page.
        movePage(item.index, index);
      }
      setHoveredIndex(null);
    },
    leave() {
      setHoveredIndex(null); // Hide the indicator when the dragged item leaves
    },
    collect: (monitor) => {
      if (!monitor.isOver()) {
        setHoveredIndex(null);
      }
    },
  });

  const getWidth = (index) => {
    if (
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
        (index === 1 || index === totalPages - 2)) ||
      (activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
        settings?.isFoldable &&
        settings?.isFoldable === true &&
        pageSettings?.isHalfSheet &&
        pageSettings?.isHalfSheet === true)
    ) {
      return previewBoxSize.width / 2;
    }
    return previewBoxSize.width;
  };

  const getHeight = () => {
    return previewBoxSize.height;
  };
  const getCanvasWidth = () => {
    // Check if we need to double the width for cover-enabled layflat albums
    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet;

    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
      (activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
        settings?.isFoldable &&
        settings?.isFoldable === true)
    ) {
      const baseWidth = canvasSize.width / 2;
      return shouldDoubleWidth ? baseWidth * 2 : baseWidth;
    }
    return canvasSize.width;
  };

  // Helper: compute SVG transform for background flip (backward-compat with boolean)
  const getFlipTransform = (flip, imgWidth, imgHeight) => {
    const flipX = typeof flip === "boolean" ? flip : (flip?.x || false);
    const flipY = typeof flip === "boolean" ? false : (flip?.y || false);
    if (!flipX && !flipY) return undefined;
    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;
    const tx = flipX ? -imgWidth : 0;
    const ty = flipY ? -imgHeight : 0;
    return `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
  };
  const svgDimensions = useMemo(() => {
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isPhotobookFullCover = isPhotobook && settings?.showFullCoverSheet;
    const isLayflatFullCoverSvg = activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled && settings?.showFullCoverSheet;
    const spineWidth =
      ((isPhotobookFullCover || isLayflatFullCoverSvg) && index === 0)
        ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
        : 0;
    const isSpecialPage =
      (index === 0 && !isPhotobookFullCover) ||
      index === totalPages - 1 ||
      index === 1 ||
      index === totalPages - 2;

    const shouldDoubleWidth =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      !settings?.isFoldable &&
      settings?.coverEnabled &&
      settings?.showFullCoverSheet &&
      index === 0;

    const canvasWidth = parseFloat(canvasSize.width);
    const canvasHeight = parseFloat(canvasSize.height);

    const isHalfSheet = pageSettings?.isHalfSheet === true;
    // Layflat fallback: a saved cover page with hideLastCover (cover on,
    // full-spread off) is always a half-sheet, even if its persisted
    // settings.isHalfSheet got stripped.
    const isLayflatHalfCoverPage =
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      settings?.coverEnabled === true &&
      !settings?.showFullCoverSheet &&
      activePage?.isCoverPage === true;
    const useHalfWidth =
      (isPhotobook && isSpecialPage) ||
      (activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
        settings?.isFoldable &&
        (isHalfSheet || isLayflatHalfCoverPage) &&
        !shouldDoubleWidth);

    const width = useHalfWidth
      ? (canvasWidth / 2) * zoomRatio
      : ((shouldDoubleWidth ? canvasWidth * 2 : canvasWidth) + spineWidth) * zoomRatio;
    const viewBoxWidth = useHalfWidth
      ? canvasWidth / 2
      : (shouldDoubleWidth ? canvasWidth * 2 : canvasWidth) + spineWidth;
    const viewBox = [0, 0, viewBoxWidth, canvasHeight].join(" ");

    return { width, viewBox };
  }, [activeEditorType, settings, index, totalPages, billablePages, canvasSize, zoomRatio, pageSettings]);

  const isPhotobookFullCoverPage =
    activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
    settings?.showFullCoverSheet &&
    index === 0;
  const isLayflatFullCoverPage =
    activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
    settings?.coverEnabled &&
    settings?.showFullCoverSheet &&
    index === 0;
  const isFullCoverSpinePage = isPhotobookFullCoverPage || isLayflatFullCoverPage;
  const photobookSpineWidth = isFullCoverSpinePage
    ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
    : 0;
  const getLayoutXOffset = (layoutIndex, xPosition = 0) => {
    if (!isFullCoverSpinePage) return 0;
    if (layoutIndex !== 1 && xPosition < canvasSize.width / 2) return 0;
    const sw = photobookSpineWidth;
    // Right-side objects shift by full spine width — inner solid lines are the spine boundary
    return sw;
  };
  const getSafeAreaLeft = (safeArea) => {
    if (!isFullCoverSpinePage || safeArea.left < canvasSize.width / 2) return safeArea.left;
    const sw = photobookSpineWidth;
    return safeArea.left + sw;
  };
  return (
    <>
      <div style={{ position: "relative", display: "inline-block" }}>
        <PreviewItem
          className={currentActivePageNumber === index ? "active" : ""}
          onClick={() => setPageIndex(index)}
          ref={(node) => ref(drop(node))}
          style={{ display: "flex", backgroundColor: "#fff" }}
        >
          {activeEditorType === EDITOR_TYPES.PHOTOBOOK && index === 1 && (
            <div
              className="WrapperDivLine2"
              style={{
                width: `${getWidth(index)}px`,
                height: `${getHeight()}px`,
                backgroundColor: "#e6e6e6",
              }}
            ></div>
          )}

          <div
            className={`WrapperDiv position-relative ${(activeEditorType == EDITOR_TYPES.PHOTOBOOK &&
              index !== 0 &&
              index !== totalPages - 1 &&
              index !== 1 &&
              index !== totalPages - 2) ||
              (activeEditorType !== EDITOR_TYPES.PHOTOBOOK &&
                settings?.isFoldable &&
                settings?.isFoldable === true &&
                pageSettings?.isHalfSheet !== true &&
                activeEditorType !== EDITOR_TYPES.LAYFLATALBUM)
              ? "WrapperDivLine"
              : activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
                settings?.isFoldable &&
                settings?.isFoldable === true &&
                (!settings?.coverEnabled ||
                  (settings?.coverEnabled &&
                    settings?.coverEnabled === true &&
                    !pageSettings?.isHalfSheet &&
                    !settings?.showFullCoverSheet) ||
                  (settings?.coverEnabled &&
                    settings?.coverEnabled === true &&
                    !activePage?.isCoverPage &&
                    settings?.showFullCoverSheet))
                ? "WrapperDivLineForLayflat"
                : ""
              } `}
            style={{
              backgroundColor: activePage.bgColor,
              width: `${svgDimensions.width}px`,
              height: `${previewBoxSize.height}px`,
            }}
          >
            <div className="containerWrapperD">
              <svg
                width={svgDimensions.width}
                height={previewBoxSize.height}
                viewBox={svgDimensions.viewBox}
              >
                <defs>
                  {activePage.layout[0]?.background?.image && (
                    <pattern
                      id={`left-bg-prev-${activePage.layout[0].id}`}
                      patternUnits="objectBoundingBox"
                      width="1"
                      height="1"
                    >
                      <CachedSvgImage
                        href={activePage.layout[0].background?.image}
                        x="0"
                        y="0"
                        width={getCanvasWidth()}
                        height={canvasSize.height}
                        preserveAspectRatio="xMidYMid slice"
                        transform={getFlipTransform(activePage.layout[0]?.background?.flip, getCanvasWidth(), canvasSize.height)}
                      />
                    </pattern>
                  )}
                  {/* Pattern for the right side background image */}
                  {activePage.layout[1]?.background?.image && (
                    <pattern
                      id={`right-bg-prev-${activePage.layout[1].id}`}
                      patternUnits="objectBoundingBox"
                      width="1"
                      height="1"
                    >
                      <CachedSvgImage
                        href={activePage.layout[1].background?.image}
                        x="0"
                        y="0"
                        width={getCanvasWidth()}
                        height={canvasSize.height}
                        preserveAspectRatio="xMidYMid slice"
                        transform={getFlipTransform(activePage.layout[1]?.background?.flip, getCanvasWidth(), canvasSize.height)}
                      />
                    </pattern>
                  )}
                  {/* Gradient for left side background - supports linear and radial */}
                  {activePage.layout[0]?.background?.gradient &&
                    (activePage.layout[0].background.gradient.type ===
                      "radial" ? (
                      <radialGradient
                        id={`gradient-bg-footer-left-${activePage.layout[0].id}`}
                        {...getRadialGradientCoords(
                          activePage.layout[0].background.gradient
                            .radialPosition
                        )}
                      >
                        {activePage.layout[0].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </radialGradient>
                    ) : (
                      <linearGradient
                        id={`gradient-bg-footer-left-${activePage.layout[0].id}`}
                        {...getLinearGradientCoords(
                          activePage.layout[0].background.gradient.angle || 90
                        )}
                      >
                        {activePage.layout[0].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
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
                        id={`gradient-bg-footer-right-${activePage.layout[1].id}`}
                        {...getRadialGradientCoords(
                          activePage.layout[1].background.gradient
                            .radialPosition
                        )}
                      >
                        {activePage.layout[1].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </radialGradient>
                    ) : (
                      <linearGradient
                        id={`gradient-bg-footer-right-${activePage.layout[1].id}`}
                        {...getLinearGradientCoords(
                          activePage.layout[1].background.gradient.angle || 90
                        )}
                      >
                        {activePage.layout[1].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </linearGradient>
                    ))}

                  <clipPath id={`clipPathFooter-${index}`}>
                    {pageSafeAreas &&
                      pageSafeAreas.length > 0 &&
                      pageSafeAreas.map((safeArea, index) => (
                        <rect
                          key={safeArea.id}
                          x={getSafeAreaLeft(safeArea)}
                          y={safeArea.top}
                          width={safeArea.width}
                          height={safeArea.height}
                        />
                      ))}
                  </clipPath>
                </defs>

                {/* if foldable layout is not applied */}
                {!settings?.isFoldable && (
                  <>
                    {/* left single page to select active side*/}
                    {activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                      <rect
                        id={`left-part-prev-${activePage.layout[0]?.id}`}
                        x="0"
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        fill={
                          activePage.layout[0]?.background?.gradient
                            ? `url(#gradient-bg-footer-left-${activePage.layout[0].id})`
                            : activePage.layout[0]?.background?.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background?.color ||
                              "#ffffff"
                        }
                      />
                    )}

                    {isFullCoverSpinePage && photobookSpineWidth > 0 && (() => {
                      const spineX = canvasSize.width / 2;
                      const sw = photobookSpineWidth;
                      const layout0 = activePage.layout[0];
                      const layout1 = activePage.layout[1];
                      const isSpreadBg = layout0?.background?.isSpread;
                      const getBgFill = (layout, side) => {
                        if (!layout) return "#ffffff";
                        if (layout.background?.gradient) return `url(#gradient-bg-footer-${side}-${layout.id})`;
                        if (layout.background?.image) return isSpreadBg ? `url(#left-bg-prev-${layout0?.id})` : `url(#${side}-bg-prev-${layout.id})`;
                        return layout.background?.color || "#ffffff";
                      };
                      return (
                        <g id="photobook-spine-bg-footer" className="photobook-spine-bg" pointerEvents="none">
                          <rect x={spineX} y="0" width={isSpreadBg ? sw : sw / 2} height={canvasSize.height}
                            fill={getBgFill(layout0, "left")} />
                          {!isSpreadBg && (
                            <rect x={spineX + sw / 2} y="0" width={sw / 2} height={canvasSize.height}
                              fill={getBgFill(layout1, "right")} />
                          )}
                        </g>
                      );
                    })()}

                    {/* full page svg block*/}
                    {activeEditorType !== EDITOR_TYPES.PHOTOBOOK && (
                      <rect
                        id={`left-part-prev-${activePage.layout[0]?.id}`}
                        x="0"
                        y="0"
                        width={canvasSize.width}
                        height={canvasSize.height}
                        fill={
                          activePage.layout[0]?.background?.gradient
                            ? `url(#gradient-bg-footer-left-${activePage.layout[0].id})`
                            : activePage.layout[0]?.background?.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background?.color ||
                              "#ffffff"
                        }
                      />
                    )}

                    {/* right  side svg block*/}
                    {activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                      <rect
                        id="right-part-prev-"
                        x={canvasSize.width / 2 + photobookSpineWidth}
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        fill={
                          activePage.layout[1]?.background?.gradient
                            ? `url(#gradient-bg-footer-right-${activePage.layout[1].id})`
                            : activePage.layout[1]?.background?.image
                              ? `url(#right-bg-prev-${activePage.layout[1].id})`
                              : activePage.layout[1]?.background?.color ||
                              "#ffffff"
                        }
                      />
                    )}
                  </>
                )}

                {/* if foldable layout is applied */}
                {settings?.isFoldable && settings.isFoldable === true && (
                  <>
                    {/* left single page to select active side*/}
                    {!pageSettings?.isHalfSheet && (
                      <rect
                        id={`left-part-prev-${activePage.layout[0]?.id}`}
                        x="0"
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        fill={
                          activePage.layout[0]?.background?.gradient
                            ? `url(#gradient-bg-footer-left-${activePage.layout[0].id})`
                            : activePage.layout[0]?.background?.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background?.color ||
                              "#ffffff"
                        }
                      />
                    )}

                    {/* full page svg block*/}
                    {pageSettings?.isHalfSheet &&
                      pageSettings?.isHalfSheet === true && (
                        <rect
                          id={`left-part-prev-${activePage.layout[0]?.id}`}
                          x="0"
                          y="0"
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          fill={
                            activePage.layout[0]?.background?.gradient
                              ? `url(#gradient-bg-footer-left-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background?.image
                                ? `url(#left-bg-prev-${activePage.layout[0].id})`
                                : activePage.layout[0]?.background?.color ||
                                "#ffffff"
                          }
                        />
                      )}

                    {/* right  side svg block*/}
                    {!pageSettings?.isHalfSheet && (
                      <rect
                        id="right-part-prev-"
                        x={canvasSize.width / 2 + photobookSpineWidth}
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        fill={
                          activePage.layout[1]?.background?.gradient
                            ? `url(#gradient-bg-footer-right-${activePage.layout[1].id})`
                            : activePage.layout[1]?.background?.image
                              ? `url(#right-bg-prev-${activePage.layout[1].id})`
                              : activePage.layout[1]?.background?.color ||
                              "#ffffff"
                        }
                      />
                    )}
                  </>
                )}

                {/* normal objects */}
                <g className={`allObjects d-inline-block`}>
                  <g className="no-clipping">
                    {sortedObjects // Sort by zIndex in ascending order
                      .map((item, keyIndex) => (
                        //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                        <g
                          key={`${item.id}_${keyIndex}`}
                          className={`position-absolute layoutDiv targetE objTarget_${item.id
                            } ${item.type === "img" && "inset-0 overflow-hidden"
                            }`}
                        >
                          <g
                            className="page-item"
                            width={item.width}
                            height={item.height}
                            data-index={item.zIndex}
                            data-id-t={item.id} // Unique identifier for your SVG group
                            style={{
                              transform: `translate(${item.transform.x + getLayoutXOffset(item.layoutIndex, item.transform.x)}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                              transformOrigin: "center center",
                              transformBox: "fill-box",
                              overflow: "hidden",
                              width: item.width,
                              height: item.height,

                            }}
                          >
                            {/* {item.type === 'text' && <Text item={item} zoomRatio={zoomRatio} />}  */}
                            {item.type === "text" && (
                              <Text
                                item={item}
                                zoomRatio={zoomRatio}
                                pageIndex={(() => {
                                  if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return index;
                                  const calendarCount = (calendarObjects.length + multiCalObjects.length) || 1;
                                  if (calendarCount <= 1) return index;
                                  const subtypeObjs = sortedObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                  const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                  const mappedIdx = Math.min(idx, calendarCount - 1);
                                  return (prevCalCount + prevMultiCalCount) + mappedIdx;
                                })()}
                              />
                            )}
                            {item.type === "img" && (
                              <Photo item={item} zoomRatio={zoomRatio} size="small" />
                            )}
                            {item.type === "sticker" && (
                              <Sticker item={item} zoomRatio={zoomRatio} />
                            )}
                            {item.type === "qrcode" && (
                              <QRCode item={item} zoomRatio={zoomRatio} />
                            )}
                            {item.type === "shape" && <Shape item={item} />}
                            {item.type === "calendar" &&
                              activeEditorType === EDITOR_TYPES.CALENDER && (
                                <DynamicCalendar
                                  calIndex={calendarObjects.findIndex(o => o.id === item.id) + 1}
                                  calendarCount={calendarObjects.length}
                                  pageIndex={index}
                                  calendarMonthOffset={prevCalCount + Math.max(0, calendarObjects.findIndex(o => o.id === item.id))}
                                  item={item}
                                  zoomRatio={zoomRatio}
                                />
                              )}
                            {item.type === "multiple-calendar" &&
                              activeEditorType === EDITOR_TYPES.CALENDER && (
                                <MultipleDynamicCalendar
                                  currentMonth={prevMultiCalCount + Math.max(0, multiCalObjects.findIndex(o => o.id === item.id))}
                                  pageIndex={index}
                                  item={item}
                                  zoomRatio={zoomRatio}
                                />
                              )}
                          </g>
                        </g>
                      ))}
                  </g>
                </g>

                {pageSafeAreas &&
                  pageSafeAreas.length > 0 &&
                  pageSafeAreas.map((safeArea, index) => (
                    <>
                      <rect
                        key={index}
                        x={getSafeAreaLeft(safeArea)}
                        y={safeArea.top}
                        width={safeArea.width}
                        height={safeArea.height}
                        fill="transparent"
                        stroke={
                          activeSafeArea?.id === safeArea.id ? "#03fc03" : "red"
                        }
                        strokeWidth={5}
                        strokeDasharray="30,20" // <== Proper dashed border
                        className="not-exportable"
                      />
                    </>
                  ))}

                {/* safe area objects */}
                <g className={`allObjects d-inline-block`}>
                  <g clipPath={`url(#clipPathFooter-${index})`}>
                    {safeAreaObjects &&
                      safeAreaObjects.length > 0 &&
                      safeAreaObjects // Sort by zIndex in ascending order
                        .map((item, keyIndex) => (
                          //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                          <g
                            key={`${item?.id}_${keyIndex}`}
                            className={`position-absolute layoutDiv1 targetE1 objTarget1_${item?.id
                              } ${item.type === "img" && "inset-0 overflow-hidden"
                              }`}
                          >
                            <g
                              className={`page-item `}
                              width={item.width}
                              height={item.height}
                              data-index={item.zIndex}
                              data-id-t={item?.id} // Unique identifier for your SVG group
                              style={{
                                transform: `translate(${item.transform.x + getLayoutXOffset(item.layoutIndex, item.transform.x)}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                transformOrigin: "center center",
                                transformBox: "fill-box",
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
                                    if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return index;
                                    const calendarCount = (safeCalendarObjects.length + safeMultiCalObjects.length) || 1;
                                    if (calendarCount <= 1) return index;
                                    const subtypeObjs = safeAreaObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                    const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                    const mappedIdx = Math.min(idx, calendarCount - 1);
                                    return (prevCalCount + prevMultiCalCount) + mappedIdx;
                                  })()}
                                />
                              )}
                              {item.type === "img" && (
                                <Photo item={item} zoomRatio={zoomRatio} size="small" />
                              )}
                              {item.type === "sticker" && (
                                <Sticker item={item} zoomRatio={zoomRatio} />
                              )}
                              {item.type === "qrcode" && (
                                <QRCode item={item} zoomRatio={zoomRatio} />
                              )}
                              {/* {item.type === 'sticker' && <StickerTest item={item} zoomRatio={zoomRatio} />} */}
                              {item.type === "shape" && (
                                <Shape item={item} zoomRatio={zoomRatio} />
                              )}
                              {item.type === "calendar" &&
                                activeEditorType === EDITOR_TYPES.CALENDER && (
                                  <DynamicCalendar
                                    calIndex={safeCalendarObjects.findIndex(o => o.id === item.id) + 1}
                                    calendarCount={safeCalendarObjects.length}
                                    pageIndex={currentActivePageNumber}
                                    calendarMonthOffset={prevCalCount + Math.max(0, safeCalendarObjects.findIndex(o => o.id === item.id))}
                                    item={item}
                                    zoomRatio={zoomRatio}
                                  />
                                )}
                              {item.type === "multiple-calendar" &&
                                activeEditorType === EDITOR_TYPES.CALENDER && (
                                  <MultipleDynamicCalendar
                                    currentMonth={prevMultiCalCount + Math.max(0, safeMultiCalObjects.findIndex(o => o.id === item.id))}
                                    pageIndex={index}
                                    item={item}
                                    zoomRatio={zoomRatio}
                                  />
                                )}
                            </g>
                          </g>
                        ))}
                  </g>
                </g>

                {/* Spine guide lines — rendered ABOVE all objects (matching Canvas behavior) */}
                {isFullCoverSpinePage && photobookSpineWidth > 0 && (() => {
                  const spineX = canvasSize.width / 2;
                  const sw = photobookSpineWidth;
                  const outerOffset = Math.max(2, sw * 0.15);
                  return (
                    <g id="photobook-spine-lines-footer" className="photobook-spine photobook-spine-area" pointerEvents="none">
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

              </svg>
            </div>
          </div>

          {activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
            index === totalPages - 2 && (
              <div
                className="WrapperDivLine2"
                style={{
                  width: `${getWidth(index)}px`,
                  height: `${getHeight()}px`,
                  backgroundColor: "#e6e6e6",
                }}
              ></div>
            )}
        </PreviewItem>
        <PageText>{getPageLabel(index)}</PageText>
        {hoveredIndex === index && ( // Only show the indicator if this index is hovered
          <PreviewItemDropIndicator visible={true}>
            {/* add plus icon to add new page */}
          </PreviewItemDropIndicator>
        )}

        {(() => {
          // Decides whether to render the "+" add-page button to the right of
          // this page thumbnail. Standard photobook/layflat-with-cover books
          // reserve the back blank and back cover at the end and so block the
          // last two positions; configurations without a separate back cover
          // (full cover sheet, hidden last cover, no cover) allow inserting at
          // the end of the book.
          if (index === 0) return false;
          const isLast = index === totalPages - 1;
          const isSecondLast = index === totalPages - 2;

          if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
            // Photobook always reserves the inside-back blank (N-2) and the
            // back-cover slot (N-1) at the end — even when hideLastCover hides
            // the cover thumbnail or showFullCoverSheet merges front+back into
            // one spread (which auto-enables hideLastCover). The inside-back
            // blank is still a special page (right side blank, mirrors page 1),
            // so a "+" after it would land between the blank and the cover slot
            // — not a valid insertion point in any mode.
            return !isLast && !isSecondLast;
          }

          if (activeEditorType === EDITOR_TYPES.LAYFLATALBUM) {
            if (settings?.coverEnabled && !settings?.showFullCoverSheet) {
              // Back cover at the last index is hidden via hideLastCover; the
              // visible last page becomes totalPages-2, so allow "+" there.
              if (settings?.hideLastCover) return !isLast;
              return !isLast && !isSecondLast;
            }
            return true;
          }

          return false;
        })() && (
            <div
              onClick={() => addNewPageAtPosition(index + 1)}
              class="preview-add-page-button"
            >
              <IoAddCircleOutline />
            </div>
          )}
      </div>
    </>
  );
});
const ItemType = "PAGE";

const PreviewPages = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <PreviewAllPages />
    </DndProvider>
  );
};
