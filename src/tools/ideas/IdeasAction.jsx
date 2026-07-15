import {
  ActionTitle,
  BodyText,
  Box,
  DisplayBetween,
  DisplayStart,
  PrimaryButton,
} from "../../common-components/StyledComponents.jsx";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector, useStore } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice.js";
import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { ImSpinner2 } from "react-icons/im";
import ScrollLoader from "../../common-components/ScrollLoader.jsx";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import {
  setPageIdeaLayout,
  setSpreadPageIdeaLayout,
  setCurrentObjectProperties,
} from "../../store/slices/canvas.js";
import {
  getResolutionScaleValueBySize,
  compressData,
  decompressFromBase64,
  scaleLayout,
} from "../../library/utils/common-functions/index.js";
import PreviewPhoto from "../../layout/preview/Photo.jsx";
import PreviewSticker from "../../layout/preview/Sticker.jsx";
import PreviewQRCode from "../../layout/preview/QRCode.jsx";
import PreviewShape from "../../layout/preview/Shape.jsx";
import PreviewText from "../../layout/preview/Text.jsx";
import {
  EDITOR_TYPES,
  EDITOR_ASSETS,
} from "../../library/utils/constants/index.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { withAssetCache } from "../../library/utils/helpers/assetsCache.js";
import {
  saveIdeaToLibrary,
  listSavedIdeas,
  removeSavedIdea,
} from "../../library/utils/helpers/savedIdeas.js";
import { toast } from "react-toastify";
import {
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getTotalPages,
  getPageSettings,
  getSettings,
  getAllPages,
} from "../../library/utils/helpers/index.js";
import { PageLoader } from "../../common-components/Loaders.js";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";

let lastScrollTopIdeas = 0;
let lastVisitedPageIdeas = 1;

// ── Image-box enrichment ──────────────────────────────────────────────────────
// Fill an idea's image boxes with the CURRENT page's photos so the preview (and
// what gets applied on click) shows the user's own images. Pure — shared by both
// the API ideas and the locally-saved ideas so they render identically.
const fitImageIntoBox = (obj, canvasImg) => {
  const origW = canvasImg.image?.originalWidth || canvasImg.image?.width || 8000;
  const origH = canvasImg.image?.originalHeight || canvasImg.image?.height || 12000;
  const imageAspectRatio = origW / origH;
  const rectAspectRatio = obj.width / obj.height;
  let imgW,
    imgH,
    imgPosX = 0,
    imgPosY = 0;

  if (obj.width > 0 && obj.height > 0) {
    if (imageAspectRatio > rectAspectRatio) {
      imgH = obj.height;
      imgW = obj.height * imageAspectRatio;
      imgPosX = (obj.width - imgW) / 2;
    } else {
      imgW = obj.width;
      imgH = obj.width / imageAspectRatio;
    }
  } else {
    imgW = origW;
    imgH = origH;
  }

  return {
    ...obj,
    url: canvasImg.url,
    urls: canvasImg.urls || [],
    image: {
      width: imgW,
      height: imgH,
      positionX: imgPosX,
      positionY: imgPosY,
      scale: 1,
      originalWidth: origW,
      originalHeight: origH,
    },
  };
};

const enrichIdeaWithImages = (idea, canvasImages, canvasImagesBySide) => {
  if (!idea.layout_c?.layout) return idea;

  const isSpreadIdea = idea.layout_c.layout.length === 2;

  if (isSpreadIdea) {
    const enrichedLayout = idea.layout_c.layout.map((lay, layoutIndex) => {
      const sideImages =
        layoutIndex === 0 ? canvasImagesBySide.left : canvasImagesBySide.right;
      if (sideImages.length === 0) return lay;

      let imgCounter = 0;
      const enrichedObjects = lay.objects.map((obj) => {
        if (obj.type === "img") {
          const canvasImg = sideImages[imgCounter % sideImages.length];
          imgCounter++;
          return fitImageIntoBox(obj, canvasImg);
        }
        return obj;
      });
      return { ...lay, objects: enrichedObjects };
    });
    return { ...idea, layout_c: { ...idea.layout_c, layout: enrichedLayout } };
  }

  let imgCounter = 0;
  const enrichedLayout = idea.layout_c.layout.map((lay) => {
    const enrichedObjects = lay.objects.map((obj) => {
      if (obj.type === "img") {
        const canvasImg = canvasImages[imgCounter % canvasImages.length];
        imgCounter++;
        return fitImageIntoBox(obj, canvasImg);
      }
      return obj;
    });
    return { ...lay, objects: enrichedObjects };
  });
  return { ...idea, layout_c: { ...idea.layout_c, layout: enrichedLayout } };
};

export const IdeasAction = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const [activeLayout, setActiveLayout] = useState("page");
  const [spreadEditorPages, setSpreadEditorPages] = useState(false);
  const [layoutBoxSize, setLayoutBoxSize] = useState({ width: 80, height: 80 });
  const canvasSize = useSelector(getCanvasSize);
  const editorType = useSelector(getActiveEditorType);
  const activePageIndex = useSelector(getCurrentPageIndex);
  const totalEditorPages = useSelector(getTotalPages);
  const currentPageSettings = useSelector(getPageSettings);
  const settings = useSelector(getSettings);
  const pages = useSelector(getAllPages);

  // Locally-saved ideas (customer "Save as Idea"). Loaded from on-device storage,
  // so they are present in BOTH offline and online modes.
  const [savedIdeasRaw, setSavedIdeasRaw] = useState([]);
  const [savingIdea, setSavingIdea] = useState(false);

  const itemsPerPage = 20;
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      (editorType === EDITOR_TYPES.PHOTOBOOK &&
        activePageIndex !== 0 &&
        activePageIndex !== totalEditorPages - 1 &&
        activePageIndex !== 1 &&
        activePageIndex !== totalEditorPages - 2) ||
      (settings?.isFoldable &&
        settings?.isFoldable === true &&
        currentPageSettings?.isHalfSheet !== true)
    ) {
      setSpreadEditorPages(true);
    } else {
      setSpreadEditorPages(false);
      if (activeLayout === "spread") setActiveLayout("page");
    }
  }, [
    activePageIndex,
    currentPageSettings,
    settings,
    editorType,
    totalEditorPages,
  ]);

  useEffect(() => {
    let numberOfLayouts = 1;
    if (activeLayout === "spread") {
      numberOfLayouts = 2;
    }

    const newLayoutBoxSize = getResolutionScaleValueBySize(
      (
        (editorType === EDITOR_TYPES.PHOTOBOOK ||
          (settings?.isFoldable && settings?.isFoldable === true)) &&
          activeLayout !== "spread"
      ) ?
        canvasSize.width / 2
      : canvasSize.width,
      canvasSize.height,
      80 * numberOfLayouts,
      80 * numberOfLayouts,
    );
    if (newLayoutBoxSize) {
      setLayoutBoxSize(newLayoutBoxSize);
    }
  }, [settings, canvasSize, editorType, activeLayout]);

  const getCanvasImages = useCallback(() => {
    const activePage = pages?.[activePageIndex];
    if (!activePage || !activePage.layout) return [];

    const canvasImages = [];
    activePage.layout.forEach((layoutItem) => {
      if (layoutItem?.objects) {
        layoutItem.objects.forEach((obj) => {
          if (obj.type === "img" && obj.url && obj.url.trim() !== "") {
            canvasImages.push(obj);
          }
        });
      }
    });
    return canvasImages;
  }, [pages, activePageIndex]);

  const getCanvasImagesBySide = useCallback(() => {
    const activePage = pages?.[activePageIndex];
    if (!activePage || !activePage.layout) return { left: [], right: [] };

    const leftImages = [];
    const rightImages = [];

    if (activePage.layout[0]?.objects) {
      activePage.layout[0].objects.forEach((obj) => {
        if (obj.type === "img" && obj.url && obj.url.trim() !== "") {
          leftImages.push(obj);
        }
      });
    }

    if (activePage.layout[1]?.objects) {
      activePage.layout[1].objects.forEach((obj) => {
        if (obj.type === "img" && obj.url && obj.url.trim() !== "") {
          rightImages.push(obj);
        }
      });
    }

    return { left: leftImages, right: rightImages };
  }, [pages, activePageIndex]);

  const processResponseItems = useCallback((response) => {
    return response.items.map((item) => {
      const decompressedLayout = decompressFromBase64(item.layout_c);
      return {
        ...item,
        layout: "",
        layout_c: decompressedLayout,
      };
    });
  }, []);

  const scaleIdeas = useCallback(
    (responseArray, newWidth, newHeight) => {
      let splitby = 1;
      if (
        editorType === EDITOR_TYPES.PHOTOBOOK ||
        (settings?.isFoldable && settings?.isFoldable === true)
      ) {
        splitby = 2;
      }
      return responseArray.map((entry) => ({
        ...entry,
        layout_c: {
          ...entry.layout_c,
          layout: entry.layout_c.layout.map((layout) =>
            scaleLayout(layout, newWidth / splitby, newHeight),
          ),
        },
      }));
    },
    [editorType, settings],
  );

  // Wrap API call for the hook
  const fetchIdeas = useCallback(
    async (page, skip, limit) => {
      const numberOfLayouts = activeLayout === "spread" ? 2 : 1;
      const isSpread = numberOfLayouts === 2;

      const data = {
        filter: {
          status: { $in: [1, 3] },
          display_in_web: true,
          asset_type: EDITOR_ASSETS.IDEA,
          editor_type: editorType,
          number_of_layouts: numberOfLayouts,
          spread: isSpread,
          number_of_images: isSpread ? { $gte: 1 } : 1,
        },
        skip: skip ?? (page - 1) * itemsPerPage,
        limit: limit ?? itemsPerPage,
        sortField: "_id",
        sortOrder: "desc",
      };

      const response = await withAssetCache(
        "ideas",
        data,
        () => apiPost(ENDPOINTS.getLayouts, data),
      );
      if (!isMountedRef.current) return { items: [], totalCount: 0 };

      if (response && response.items) {
        const decompressedIdeas = processResponseItems(response);
        const scaledIdeas = scaleIdeas(
          decompressedIdeas,
          canvasSize.width,
          canvasSize.height,
        );
        return {
          items: scaledIdeas,
          totalCount: response.totalCount || 0,
        };
      }
      return { items: [], totalCount: 0 };
    },
    [
      canvasSize,
      activeLayout,
      activePageIndex,
      editorType,
      processResponseItems,
      scaleIdeas,
    ],
  );

  const {
    items: ideas,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    scrollContainerRef,
    currentPageRef: ideasCurrentPageRef,
  } = useInfiniteScroll({
    fetchFn: fetchIdeas,
    itemsPerPage: itemsPerPage,
    enabled: true,
    direction: "vertical",
    restoreToPage: lastVisitedPageIdeas,
    cacheKey: "ideas",
  });

  // Memoize enrichment of ideas with canvas images — replaces useState+useEffect pattern
  const displayIdeas = useMemo(() => {
    if (!ideas || ideas.length === 0) return [];

    const canvasImages = getCanvasImages();
    const canvasImagesBySide = getCanvasImagesBySide();

    if (canvasImages.length === 0) return ideas;

    return ideas.map((idea) =>
      enrichIdeaWithImages(idea, canvasImages, canvasImagesBySide),
    );
  }, [ideas, pages, activePageIndex, getCanvasImages, getCanvasImagesBySide]);

  // ── Locally-saved ideas for the current view (Page vs Spread) ───────────────
  const refreshSaved = useCallback(async () => {
    const list = await listSavedIdeas();
    if (isMountedRef.current) setSavedIdeasRaw(list);
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // Filter to this editor type and to the group the active toggle shows, then run
  // saved ideas through the SAME decompress → scale → enrich pipeline as API ideas.
  const savedDisplayIdeas = useMemo(() => {
    const wantSpread = activeLayout === "spread";
    const forActive = savedIdeasRaw.filter(
      (i) => i.editorType === editorType && !!i.spread === wantSpread,
    );
    if (forActive.length === 0) return [];

    let decompressed;
    try {
      decompressed = forActive.map((i) => ({
        ...i,
        _id: i.id,
        layout: "",
        layout_c: decompressFromBase64(i.layout_c),
      }));
    } catch (_) {
      return [];
    }

    const scaled = scaleIdeas(decompressed, canvasSize.width, canvasSize.height);
    const canvasImages = getCanvasImages();
    if (canvasImages.length === 0) return scaled;
    const canvasImagesBySide = getCanvasImagesBySide();
    return scaled.map((idea) =>
      enrichIdeaWithImages(idea, canvasImages, canvasImagesBySide),
    );
  }, [
    savedIdeasRaw,
    activeLayout,
    editorType,
    canvasSize,
    scaleIdeas,
    getCanvasImages,
    getCanvasImagesBySide,
  ]);

  const handleLayoutChange = useCallback((event) => {
    setActiveLayout(event.target.value);
  }, []);

  const addLayout = useCallback(
    (item) => {
      dispatch(setCurrentObjectProperties(null));
      dispatch(setPageIdeaLayout(item));
    },
    [dispatch],
  );

  const addSpreadLayout = useCallback(
    (items) => {
      dispatch(setCurrentObjectProperties(null));
      items.forEach((item, index) => {
        dispatch(setSpreadPageIdeaLayout({ ...item, pageSide: index }));
      });
    },
    [dispatch],
  );

  // ── Save-as-Idea: capture the CURRENT page (local, no API) ───────────────────
  // "Current page" = the current page ENTRY, exactly as the user sees it: a 2-up
  // spread (photobook / foldable full sheet) saves BOTH of its sides as a spread
  // idea; a single-side page saves just that page. It captures ONLY this one
  // entry — never any other page in the document. Mirrors the designer's
  // "Export as Idea" capture so saved ideas share the API idea format + the
  // existing render/apply pipeline.
  const currentSides = useMemo(
    () => (pages?.[activePageIndex]?.layout || []).filter(Boolean),
    [pages, activePageIndex],
  );

  // Photobook front cover (page 0/1) is a single page, not a spread — matches the
  // designer capture (Header.saveLayout) which forces number_of_layouts = 1 there.
  const isPhotobookCover =
    editorType === EDITOR_TYPES.PHOTOBOOK &&
    (activePageIndex === 0 || activePageIndex === 1);

  const willSaveSpread = currentSides.length >= 2 && !isPhotobookCover;

  const canSaveCurrent = useMemo(
    () =>
      currentSides.some(
        (l) =>
          (Array.isArray(l.objects) && l.objects.length > 0) ||
          !!(l.background &&
            (l.background.image || l.background.color || l.background.gradient)),
      ),
    [currentSides],
  );

  const buildIdeaEntry = useCallback(() => {
    // Read fresh state at click time so a page/side change can never be captured
    // stale.
    const c = store.getState().canvas.present;
    const page = c.pages?.[c.activePageIndex];
    const sides = (page?.layout || []).filter(Boolean);
    if (sides.length === 0) return null;

    const usesHalfWidth =
      c.editorType === EDITOR_TYPES.PHOTOBOOK || c.settings?.isFoldable === true;
    const isCover =
      c.editorType === EDITOR_TYPES.PHOTOBOOK &&
      (c.activePageIndex === 0 || c.activePageIndex === 1);

    // Keep each side's objects in their ORIGINAL coordinates (the right side of a
    // spread lives in spread space [w/2, w]) — setSpreadPageIdeaLayout applies
    // each side by index with no offset, so no normalization is wanted here.
    let layoutSides = sides.map((l) => ({
      ...l,
      width: usesHalfWidth ? c.canvasSize.width / 2 : c.canvasSize.width,
      height: c.canvasSize.height,
      objects: (l.objects || []).map((o) => ({ ...o })),
    }));

    let numberOfLayouts = layoutSides.length;
    if (isCover) numberOfLayouts = 1;
    if (numberOfLayouts === 1) layoutSides = layoutSides.slice(0, 1);

    const number_of_images = layoutSides.reduce(
      (n, l) => n + (l.objects || []).filter((o) => o.type === "img").length,
      0,
    );

    const hasContent = layoutSides.some(
      (l) =>
        (l.objects && l.objects.length > 0) ||
        !!(l.background &&
          (l.background.image || l.background.color || l.background.gradient)),
    );
    if (!hasContent) return null;

    const layout_c = compressData(JSON.stringify({ layout: layoutSides }));
    return {
      editorType: c.editorType,
      spread: numberOfLayouts === 2,
      number_of_layouts: numberOfLayouts,
      number_of_images,
      width: c.canvasSize.width,
      height: c.canvasSize.height,
      layout_c,
    };
  }, [store]);

  const handleSaveAsIdea = useCallback(async () => {
    const entry = buildIdeaEntry();
    if (!entry) {
      toast.info("Add something to this page before saving it as an idea.");
      return;
    }
    setSavingIdea(true);
    const id = await saveIdeaToLibrary(entry);
    setSavingIdea(false);
    if (id) {
      toast.success(
        entry.spread ? "Spread saved to your Ideas" : "Page saved to your Ideas",
      );
      // Show the group the new idea landed in (Pages vs Spreads).
      if (entry.spread && spreadEditorPages) setActiveLayout("spread");
      else setActiveLayout("page");
      refreshSaved();
    } else {
      toast.error("Couldn't save the idea. Please try again.");
    }
  }, [buildIdeaEntry, refreshSaved, spreadEditorPages]);

  const handleDeleteSaved = useCallback(async (id) => {
    const ok = await removeSavedIdea(id);
    if (ok) {
      setSavedIdeasRaw((prev) => prev.filter((i) => i.id !== id));
    } else {
      toast.error("Couldn't remove the idea.");
    }
  }, []);

  // ── SVG renderers (shared by API + saved ideas) ─────────────────────────────
  const renderPageIdeaSvg = useCallback(
    (displayIdea, ideaIndex) => (
      <svg
        className="idea-item-svg d-inline-block"
        onClick={() => {
          addLayout(displayIdea.layout_c.layout[0]);
        }}
        width={layoutBoxSize.width}
        height={layoutBoxSize.height}
        style={{
          cursor: "pointer",
          border: "1px solid #ccc9c9",
        }}
        viewBox={[
          0,
          0,
          (
            editorType === EDITOR_TYPES.PHOTOBOOK ||
            (settings?.isFoldable && settings?.isFoldable === true)
          ) ?
            canvasSize.width / 2
          : canvasSize.width,
          canvasSize.height,
        ]}
      >
        <defs>
          {displayIdea.layout_c.layout[0]?.background?.image && (
            <pattern
              id={`idea-page-bg-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
              patternUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={
                (
                  editorType === EDITOR_TYPES.PHOTOBOOK ||
                  (settings?.isFoldable && settings?.isFoldable === true)
                ) ?
                  canvasSize.width / 2
                : canvasSize.width
              }
              height={canvasSize.height}
            >
              <image
                href={displayIdea.layout_c.layout[0].background.image}
                x="0"
                y="0"
                width={
                  (
                    editorType === EDITOR_TYPES.PHOTOBOOK ||
                    (settings?.isFoldable && settings?.isFoldable === true)
                  ) ?
                    canvasSize.width / 2
                  : canvasSize.width
                }
                height={canvasSize.height}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          )}
          {displayIdea.layout_c.layout[0]?.background?.gradient &&
            ((
              displayIdea.layout_c.layout[0].background.gradient.type === "radial"
            ) ?
              <radialGradient
                id={`idea-page-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
                {...getRadialGradientCoords(
                  displayIdea.layout_c.layout[0].background.gradient
                    .radialPosition,
                )}
              >
                {displayIdea.layout_c.layout[0].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </radialGradient>
            : <linearGradient
                id={`idea-page-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
                {...getLinearGradientCoords(
                  displayIdea.layout_c.layout[0].background.gradient.angle || 90,
                )}
              >
                {displayIdea.layout_c.layout[0].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </linearGradient>)}
        </defs>
        {/* Background rect */}
        <rect
          x="0"
          y="0"
          width={
            (
              editorType === EDITOR_TYPES.PHOTOBOOK ||
              (settings?.isFoldable && settings?.isFoldable === true)
            ) ?
              canvasSize.width / 2
            : canvasSize.width
          }
          height={canvasSize.height}
          fill={
            displayIdea.layout_c.layout[0]?.background?.gradient ?
              `url(#idea-page-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id})`
            : displayIdea.layout_c.layout[0]?.background?.image ?
              `url(#idea-page-bg-${ideaIndex}-${displayIdea.layout_c.layout[0].id})`
            : displayIdea.layout_c.layout[0]?.background?.color || "#ffffff"
          }
        />
        {displayIdea.layout_c.layout[0].objects.map((item, index) => {
          const uniqueItem = {
            ...item,
            id: `${item.id}_preview_${ideaIndex}_${index}`,
          };
          return (
            <g
              key={`idea-obj-${ideaIndex}-${index}`}
              className={`${item.type === "img" && "inset-0 overflow-hidden"}`}
            >
              <g
                className="page-item"
                data-id-t={item.id}
                style={{
                  transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                  transformOrigin: "center center",
                  transformBox: "fill-box",
                  overflow: "hidden",
                  width: item.width,
                  height: item.height,
                }}
              >
                {item.type === "img" && (
                  <PreviewPhoto
                    item={uniqueItem}
                    zoomRatio={1}
                    size="small"
                    showPlaceholder={false}
                  />
                )}
                {item.type === "text" && (
                  <PreviewText item={uniqueItem} zoomRatio={1} />
                )}
                {item.type === "sticker" && <PreviewSticker item={uniqueItem} />}
                {item.type === "qrcode" && <PreviewQRCode item={uniqueItem} />}
                {item.type === "shape" && (
                  <PreviewShape item={uniqueItem} zoomRatio={1} />
                )}
              </g>
            </g>
          );
        })}
      </svg>
    ),
    [addLayout, layoutBoxSize, editorType, settings, canvasSize],
  );

  const renderSpreadIdeaSvg = useCallback(
    (displayIdea, ideaIndex) => (
      <svg
        className="idea-item-svg d-inline-block position-relative"
        onClick={() => {
          addSpreadLayout(displayIdea.layout_c.layout);
        }}
        width={layoutBoxSize.width}
        height={layoutBoxSize.height}
        style={{
          cursor: "pointer",
          border: "1px solid #ccc9c9",
        }}
        viewBox={[0, 0, canvasSize.width, canvasSize.height]}
      >
        <defs>
          {/* Left side background */}
          {displayIdea.layout_c.layout[0]?.background?.image && (
            <pattern
              id={`idea-spread-left-bg-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
              patternUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            >
              <image
                href={displayIdea.layout_c.layout[0].background.image}
                x="0"
                y="0"
                width={canvasSize.width / 2}
                height={canvasSize.height}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          )}
          {displayIdea.layout_c.layout[0]?.background?.gradient &&
            ((
              displayIdea.layout_c.layout[0].background.gradient.type === "radial"
            ) ?
              <radialGradient
                id={`idea-spread-left-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
                {...getRadialGradientCoords(
                  displayIdea.layout_c.layout[0].background.gradient
                    .radialPosition,
                )}
              >
                {displayIdea.layout_c.layout[0].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </radialGradient>
            : <linearGradient
                id={`idea-spread-left-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id}`}
                {...getLinearGradientCoords(
                  displayIdea.layout_c.layout[0].background.gradient.angle || 90,
                )}
              >
                {displayIdea.layout_c.layout[0].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </linearGradient>)}
          {/* Right side background */}
          {displayIdea.layout_c.layout[1]?.background?.image && (
            <pattern
              id={`idea-spread-right-bg-${ideaIndex}-${displayIdea.layout_c.layout[1].id}`}
              patternUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            >
              <image
                href={displayIdea.layout_c.layout[1].background.image}
                x={canvasSize.width / 2}
                y="0"
                width={canvasSize.width / 2}
                height={canvasSize.height}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          )}
          {displayIdea.layout_c.layout[1]?.background?.gradient &&
            ((
              displayIdea.layout_c.layout[1].background.gradient.type === "radial"
            ) ?
              <radialGradient
                id={`idea-spread-right-grad-${ideaIndex}-${displayIdea.layout_c.layout[1].id}`}
                {...getRadialGradientCoords(
                  displayIdea.layout_c.layout[1].background.gradient
                    .radialPosition,
                )}
              >
                {displayIdea.layout_c.layout[1].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </radialGradient>
            : <linearGradient
                id={`idea-spread-right-grad-${ideaIndex}-${displayIdea.layout_c.layout[1].id}`}
                {...getLinearGradientCoords(
                  displayIdea.layout_c.layout[1].background.gradient.angle || 90,
                )}
              >
                {displayIdea.layout_c.layout[1].background.gradient.stops?.map(
                  (stop, idx) => (
                    <stop
                      key={idx}
                      offset={`${stop.position}%`}
                      stopColor={stop.color?.slice(0, 7) || "#000000"}
                      stopOpacity={
                        stop.color?.length === 9 ?
                          parseInt(stop.color.slice(7, 9), 16) / 255
                        : 1
                      }
                    />
                  ),
                )}
              </linearGradient>)}
        </defs>
        {/* Left side background rect */}
        <rect
          x="0"
          y="0"
          width={canvasSize.width / 2}
          height={canvasSize.height}
          fill={
            displayIdea.layout_c.layout[0]?.background?.gradient ?
              `url(#idea-spread-left-grad-${ideaIndex}-${displayIdea.layout_c.layout[0].id})`
            : displayIdea.layout_c.layout[0]?.background?.image ?
              `url(#idea-spread-left-bg-${ideaIndex}-${displayIdea.layout_c.layout[0].id})`
            : displayIdea.layout_c.layout[0]?.background?.color || "#ffffff"
          }
        />
        {/* Right side background rect */}
        <rect
          x={canvasSize.width / 2}
          y="0"
          width={canvasSize.width / 2}
          height={canvasSize.height}
          fill={
            displayIdea.layout_c.layout[1]?.background?.gradient ?
              `url(#idea-spread-right-grad-${ideaIndex}-${displayIdea.layout_c.layout[1].id})`
            : displayIdea.layout_c.layout[1]?.background?.image ?
              `url(#idea-spread-right-bg-${ideaIndex}-${displayIdea.layout_c.layout[1].id})`
            : displayIdea.layout_c.layout[1]?.background?.color || "#ffffff"
          }
        />
        {displayIdea.layout_c.layout.map((lay, layindex) =>
          lay.objects.map((item, index) => {
            const uniqueItem = {
              ...item,
              id: `${item.id}_spread_preview_${ideaIndex}_${layindex}_${index}`,
            };
            return (
              <g
                key={`idea-spread-${ideaIndex}-${layindex}-${index}`}
                className={`position-absolute ${item.type === "img" && "inset-0 overflow-hidden"}`}
              >
                <g
                  className="page-item"
                  data-id-t={item.id}
                  style={{
                    transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                    transformOrigin: "center center",
                    transformBox: "fill-box",
                    overflow: "hidden",
                    width: item.width,
                    height: item.height,
                  }}
                >
                  {item.type === "img" && (
                    <PreviewPhoto
                      item={uniqueItem}
                      zoomRatio={1}
                      size="small"
                      showPlaceholder={false}
                    />
                  )}
                  {item.type === "text" && (
                    <PreviewText item={uniqueItem} zoomRatio={1} />
                  )}
                  {item.type === "sticker" && <PreviewSticker item={uniqueItem} />}
                  {item.type === "qrcode" && <PreviewQRCode item={uniqueItem} />}
                  {item.type === "shape" && (
                    <PreviewShape item={uniqueItem} zoomRatio={1} />
                  )}
                </g>
              </g>
            );
          }),
        )}
      </svg>
    ),
    [addSpreadLayout, layoutBoxSize, canvasSize],
  );

  // A saved-idea tile: the shared SVG plus a remove (×) badge.
  const renderSavedTile = (displayIdea, ideaIndex, isSpread) => (
    <div
      className="mb-3 d-flex justify-content-center w-100"
      key={`saved-${isSpread ? "spread" : "page"}-${displayIdea._id}`}
    >
      <div className="position-relative d-inline-block">
        {isSpread
          ? renderSpreadIdeaSvg(displayIdea, `saved-${ideaIndex}`)
          : renderPageIdeaSvg(displayIdea, `saved-${ideaIndex}`)}
        <button
          type="button"
          title="Remove saved idea"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteSaved(displayIdea._id);
          }}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "none",
            background: "#dc3545",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            padding: 0,
            lineHeight: 1,
          }}
        >
          <LiaTimesSolid size={12} />
        </button>
      </div>
    </div>
  );

  // Scroll preservation
  const needsScrollRestoreIdeas = useRef(lastScrollTopIdeas > 0);
  const isFirstMountIdeas = useRef(true);

  // Continuously save scroll position on every scroll event
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = () => {
      lastScrollTopIdeas = el.scrollTop;
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  });

  // Restore scroll position after ideas load on mount
  // Using useLayoutEffect to apply scroll BEFORE paint to prevent blink
  useLayoutEffect(() => {
    if (!needsScrollRestoreIdeas.current) return;
    if (ideas.length === 0 && !isFirstMountIdeas.current) return;

    // Apply scroll synchronously before browser paint
    if (scrollContainerRef.current && lastScrollTopIdeas > 0) {
      scrollContainerRef.current.scrollTop = lastScrollTopIdeas;
    }
    needsScrollRestoreIdeas.current = false;
    isFirstMountIdeas.current = false;
  }, [ideas.length]);

  // Save visited page on unmount so it can be restored on next mount
  useEffect(() => {
    return () => {
      lastVisitedPageIdeas = ideasCurrentPageRef.current;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div
        className="sticker-container sticker-container-mob"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          margin: "2px",
        }}
      >
        <DisplayBetween
          className="heading-action-mob"
          style={{ flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}
        >
          <ActionTitle>Ideas</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>

        {/* Save the current page / spread as a local idea (no API) */}
        <div style={{ flexShrink: 0, padding: "10px 4px 4px" }}>
          <PrimaryButton
            onClick={handleSaveAsIdea}
            disabled={savingIdea || !canSaveCurrent}
            style={{
              width: "100%",
              justifyContent: "center",
              opacity: !canSaveCurrent || savingIdea ? 0.6 : 1,
              cursor: !canSaveCurrent || savingIdea ? "not-allowed" : "pointer",
            }}
          >
            {savingIdea
              ? "Saving…"
              : `＋ Save this ${willSaveSpread ? "Spread" : "Page"} as Idea`}
          </PrimaryButton>
          <BodyText
            style={{
              fontSize: 11,
              color: "#888",
              textAlign: "center",
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            Saved on this device — available offline.
          </BodyText>
        </div>

        <div
          ref={scrollContainerRef}
          className="scroll-container-mob"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            paddingBottom: "20px",
            padding: "2px",
          }}
        >
          <DisplayStart mt="15px">
            {(editorType === EDITOR_TYPES.PHOTOBOOK ||
              (settings?.isFoldable && settings?.isFoldable === true)) && (
              <Box className="radio me-3">
                <input
                  id="ideas-pages"
                  name="ideas-radio"
                  type="radio"
                  value="page"
                  onChange={handleLayoutChange}
                  checked={activeLayout === "page"}
                />
                <label htmlFor="ideas-pages" className="radio-label">
                  Pages
                </label>
              </Box>
            )}
            {spreadEditorPages && (
              <Box className="radio">
                <input
                  id="ideas-spreads"
                  name="ideas-radio"
                  type="radio"
                  value="spread"
                  onChange={handleLayoutChange}
                  checked={activeLayout === "spread"}
                />
                <label htmlFor="ideas-spreads" className="radio-label">
                  Spreads
                </label>
              </Box>
            )}
          </DisplayStart>

          {loading && <PageLoader />}

          {activeLayout === "page" && (
            <div className="mt-3 d-flex flex-column align-items-center">
              {savedDisplayIdeas.length > 0 && (
                <BodyText
                  className="w-100"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    marginBottom: 8,
                  }}
                >
                  Your saved ideas
                </BodyText>
              )}
              {savedDisplayIdeas.map((displayIdea, ideaIndex) =>
                renderSavedTile(displayIdea, ideaIndex, false),
              )}

              {displayIdeas.map((displayIdea, ideaIndex) => (
                <div
                  className="mb-3 d-flex justify-content-center w-100"
                  key={`idea-page-${displayIdea._id || ideaIndex}`}
                >
                  {renderPageIdeaSvg(displayIdea, ideaIndex)}
                </div>
              ))}
            </div>
          )}

          {activeLayout === "spread" && (
            <div className="mt-3 d-flex flex-column align-items-center">
              {savedDisplayIdeas.length > 0 && (
                <BodyText
                  className="w-100"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    marginBottom: 8,
                  }}
                >
                  Your saved ideas
                </BodyText>
              )}
              {savedDisplayIdeas.map((displayIdea, ideaIndex) =>
                renderSavedTile(displayIdea, ideaIndex, true),
              )}

              {displayIdeas.map((displayIdea, ideaIndex) => (
                <div
                  className="mb-3 d-flex justify-content-center w-100"
                  key={`idea-spread-${displayIdea._id || ideaIndex}`}
                >
                  {renderSpreadIdeaSvg(displayIdea, ideaIndex)}
                </div>
              ))}
            </div>
          )}

          {!loading &&
            ideas.length === 0 &&
            savedDisplayIdeas.length === 0 && (
              <div className="text-center py-4">
                <BodyText style={{ color: "#999" }}>No ideas found</BodyText>
              </div>
            )}

          {/* Sentinel + loader for infinite scroll */}
          <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />
          {isFetchingMore && <ScrollLoader />}
        </div>
      </div>
    </>
  );
};
