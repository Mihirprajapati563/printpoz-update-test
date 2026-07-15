import {
  ActionTitle,
  BodyText,
  Box,
  DisplayBetween,
  DisplayStart,
  LayoutPaginationBox,
  LayoutPaginationItem,
  LayoutSpreadItem,
} from "../../common-components/StyledComponents.jsx";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { LiaTimesSolid } from "react-icons/lia";
import { BiMinus, BiPlus, BiShuffle } from "react-icons/bi";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive, setLayoutMode } from "../../store/slices/appAlice.js";
import { ReactComponent as Filter } from "../../assets/icons/filter_icon.svg";
import {
  TempLayoutPages,
  TempLayoutSpreads,
} from "../../library/utils/jsons/commonJSON.js";
import { useEffect, useRef, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  setPageLayout,
  setEntireSpreadLayout,
  setCurrentObjectProperties,
  setActiveSide,
} from "../../store/slices/canvas.js";
import {
  calculateZoomRatio,
  getResolutionScaleValueBySize,
} from "../../library/utils/common-functions/index.js";
import LayoutImgPlaceholder from "./LayoutsImgPlaceholder.jsx";
import LayoutText from "./LayoutsText.jsx";
import { EDITOR_TYPES } from "../../library/utils/constants/index.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { withAssetCache } from "../../library/utils/helpers/assetsCache.js";
import { toast } from "react-toastify";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { EDITOR_ASSETS } from "../../library/utils/constants/index.js";
import {
  decompressFromBase64,
  scaleLayout,
} from "../../library/utils/common-functions/index.js";
import {
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getTotalPages,
  getCurrentActivePageObjects,
  getCurrentActivePage,
  getAllObjectsOfAllLayoutsOfCurrentPage,
  getPageSettings,
  getSettings,
} from "../../library/utils/helpers/index.js";
import { PageLoader } from "../../common-components/Loaders.js";
import { PrimaryButton } from "../../common-components/StyledComponents.jsx";
import { BiCollection } from "react-icons/bi";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog.jsx";
import AutoLayoutDialog from "./AutoLayoutDialog.jsx";
import {
  regenerateOpenDesignLayoutsAsSingleUndo,
  isBlankGeneratorSupported,
} from "../../library/utils/helpers/blankThemeGenerator.js";

export const LayoutAction = () => {
  const dispatch = useDispatch();
  // Layout mode is shared across the sidebar tab, the footer shuffle toggle,
  // and image "Set as Background" — drive it through Redux.
  const activeLayout = useSelector((state) => state.appSlice.layoutMode);
  const setActiveLayout = useCallback(
    (mode) => {
      dispatch(setLayoutMode(mode));
      // Mirror Footer.jsx: entering Spread mode anchors activeSide to Left.
      if (mode === "spread") dispatch(setActiveSide(0));
    },
    [dispatch]
  );
  const [spreadEditorPages, setSpreadEditorPages] = useState(false);
  const [activeIndex, setActiveIndex] = useState(1);
  const [activateAll, setActivateAll] = useState(false);
  // Exact image-count chosen from the "More" dropdown (>=8). When set it
  // overrides the 1-7 / "8+" buttons and the "Display All" toggle; null = no
  // dropdown selection (the numeric buttons drive the filter as before).
  const [exactCountFilter, setExactCountFilter] = useState(null);
  const [layoutBoxSize, setLayoutBoxSize] = useState({ width: 80, height: 80 });
  const [layoutDisplayRatio, setLayoutDisplayRatio] = useState(1);
  const canvasSize = useSelector(getCanvasSize);
  const editorType = useSelector(getActiveEditorType);
  const activePageIndex = useSelector(getCurrentPageIndex);
  const totalEditorPages = useSelector(getTotalPages);
  const currentActivePageObjects = useSelector(getCurrentActivePageObjects);
  const currentActivePage = useSelector(getCurrentActivePage);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [layouts, setLayouts] = useState([]);
  const imagesPerPage = 50;
  const [loading, setLoading] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  // Auto Layout (whole-book) — Generate Layout dialog + one-click Shuffle All.
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [showShuffleAllConfirm, setShowShuffleAllConfirm] = useState(false);
  const [shufflingAll, setShufflingAll] = useState(false);
  const autoLayoutSupported = isBlankGeneratorSupported(editorType);
  const [allLayouts, setAllLayouts] = useState([]);
  const [currentPageImageCount, setCurrentPageImageCount] = useState(0);
  const [maxImageCountOfLayout, setMaxImageCountOfLayout] = useState(0);
  const allLayoutObjectOfCurrentPage = useSelector(getAllObjectsOfAllLayoutsOfCurrentPage);
  const currentPageSettings = useSelector(getPageSettings);
  const settings = useSelector(getSettings);
  useEffect(() => {
    let numberOfLayouts = 1;
    if (activeLayout === "spread") {
      numberOfLayouts = 2;
    }

    const fullCoverSpineWidth = (editorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet)
      ? (Number(settings?.spineWidth) || 0) : 0;

    const canvasW = Number(canvasSize.width);
    const canvasH = Number(canvasSize.height);
    const spreadWidth = activeLayout === "spread"
      ? canvasW + fullCoverSpineWidth
      : canvasW;

    const newLayoutBoxSize = getResolutionScaleValueBySize(
      ((editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true)) && activeLayout !== "spread")
        ? canvasW / 2
        : spreadWidth,
      canvasH,
      80 * numberOfLayouts,
      80 * numberOfLayouts
    );
    if (newLayoutBoxSize) {
      const newZoomRatio = calculateZoomRatio(
        ((editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true)) && activeLayout !== "spread")
          ? canvasW / 2
          : spreadWidth,
        canvasH,
        newLayoutBoxSize.width,
        newLayoutBoxSize.height
      );
      setLayoutBoxSize(newLayoutBoxSize);
      setLayoutDisplayRatio(newZoomRatio);
    }
  }, [layouts, settings, activeLayout, canvasSize, editorType]);

  useEffect(() => {
    setCurrentPage(1);
    getLayouts(1);
  }, [activeIndex, activateAll, exactCountFilter, activeLayout, settings, currentPageSettings]);

  // Auto-flip only on page navigation; preserve the user's manual choice
  // (e.g. they explicitly switched to "Page" mode while on a spread page).
  const prevActivePageIndexRef = useRef(activePageIndex);
  useEffect(() => {
    const isInteriorPhotobookSpread =
      editorType === EDITOR_TYPES.PHOTOBOOK &&
      activePageIndex !== 0 &&
      activePageIndex !== totalEditorPages - 1 &&
      activePageIndex !== 1 &&
      activePageIndex !== totalEditorPages - 2;
    const isFoldableFullSheet =
      settings?.isFoldable && settings?.isFoldable === true && currentPageSettings?.isHalfSheet !== true;
    const isPhotobookFullCover =
      editorType === EDITOR_TYPES.PHOTOBOOK && settings?.showFullCoverSheet && activePageIndex === 0;
    const spreadEligible = isInteriorPhotobookSpread || isFoldableFullSheet || isPhotobookFullCover;

    setSpreadEditorPages(spreadEligible);

    const pageChanged = prevActivePageIndexRef.current !== activePageIndex;
    prevActivePageIndexRef.current = activePageIndex;

    if (!spreadEligible) {
      if (activeLayout === "spread") setActiveLayout("page");
    } else if (pageChanged) {
      setActiveLayout("spread");
    }
  }, [activePageIndex, currentPageSettings, settings, editorType, totalEditorPages, activeLayout, setActiveLayout]);

  const handleLayoutChange = (event) => {
    setActiveLayout(event.target.value);
  };
  const handlePageClick = (index) => {
    setActiveIndex(index);
    setActivateAll(false);
    setExactCountFilter(null); // clicking a numeric button cancels the dropdown
  };
  const handleActivateAllClick = () => {
    setActivateAll(true);
    setActiveIndex(0);
    setExactCountFilter(null); // "Display All" cancels the dropdown
  };
  const handleMoreSelect = (event) => {
    const value = event.target.value;
    if (!value) {
      setExactCountFilter(null);
      return;
    }
    setExactCountFilter(Number(value));
    setActivateAll(false); // remove the "Display All" highlight
  };

  const addLayout = (item, index) => {
    dispatch(setCurrentObjectProperties(null));
    dispatch(setPageLayout(item));
    return;
  };
  const addSpreadLayout = (items) => {
    dispatch(setCurrentObjectProperties(null));
    dispatch(setEntireSpreadLayout(items));
    return;
  };

  useEffect(() => {
    getLayouts(currentPage);
  }, [currentPage, canvasSize]);
  useEffect(() => {
    // Switching Page/Spread can change the available image-count range, so
    // drop any stale exact-count dropdown selection.
    setExactCountFilter(null);
    fetchAllLayouts();
  }, [activeLayout]);

  const processResponseItems = (response) => {
    const decompressedLayouts = response.items.map((item) => {
      const decompressedLayout = decompressFromBase64(item.layout_c);
      return {
        ...item,
        layout: "",
        layout_c: decompressedLayout,
      };
    });

    return decompressedLayouts;
  };
  const getLayouts = (pageNumber = 1) => {
    setLoading(true); // Start loading
    let numberOfLayouts = 1;
    if (activeLayout === "spread") {
      numberOfLayouts = 2;
    }

    const data = {
      filter: {
        status: { $in: [1, 3] },
        display_in_web: true,
        number_of_layouts: numberOfLayouts,
        spread: numberOfLayouts === 2 ? true : false,
        number_of_images:
          exactCountFilter != null
            ? exactCountFilter
            : activeIndex == 0
              ? null
              : activeIndex === 8
                ? { $gte: 8 }
                : activeIndex,
        asset_type: EDITOR_ASSETS.LAYOUT,
      },
      skip: (pageNumber - 1) * imagesPerPage,
      limit: imagesPerPage,
      sortField: "_id",
      sortOrder: "desc",
    };

    // Fetch Layouts (offline-first: replay the cached layouts catalog when
    // offline, refresh the cache on every successful online fetch).
    withAssetCache("layouts", data, () => apiPost(ENDPOINTS.getLayouts, data))
      .then((response) => {
        if (response && response.items) {
          const decompressedLayouts = processResponseItems(response);
          const newLayoutSize = {
            width: canvasSize.width,
            height: canvasSize.height,
          };
          const scaledLayout = scaleLayouts(
            decompressedLayouts,
            newLayoutSize.width,
            newLayoutSize.height
          );
          setLayouts(scaledLayout);
          let totalCount = response.totalCount || 0;
          setTotalPages(Math.ceil(totalCount / imagesPerPage));
        }
      })
      .catch((error) => {
      })
      .finally(() => {
        setLoading(false);
      });
  };

  function scaleLayouts(responseArray, newWidth, newHeight) {
    let splitby = 1;
    if (editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true)) {
      splitby = 2;
    }
    responseArray.forEach((entry) => {
      // Access the layout object inside layout_c and scale it
      entry.layout_c.layout = entry.layout_c.layout.map((layout) => {
        return scaleLayout(layout, newWidth / splitby, newHeight);
      });
    });

    return responseArray;
  }

  // fetch all layouts
  const fetchAllLayouts = async () => {
    try {
      let numberOfLayouts = 1;
      if (activeLayout === "spread") {
        numberOfLayouts = 2;
      }
      const data = {
        filter: {
          status: { $in: [1, 3] },
          display_in_web: true,
          number_of_layouts: numberOfLayouts,
          spread: numberOfLayouts === 2 ? true : false,
          number_of_images: { $gte: 1 },
          asset_type: EDITOR_ASSETS.LAYOUT,
        },
        skip: 0,
        limit: 10000000,
        sortField: "_id",
        sortOrder: "desc",
      };
      // Offline-first: cache the full layouts catalog so Shuffle keeps working
      // without a connection.
      const response = await withAssetCache("layouts", data, () =>
        apiPost(ENDPOINTS.getLayouts, data)
      );
      if (response && response.items) {
        const decompressedLayouts = processResponseItems(response);
        const newLayoutSize = {
          width: canvasSize.width,
          height: canvasSize.height,
        };
        const scaledLayout = scaleLayouts(
          decompressedLayouts,
          newLayoutSize.width,
          newLayoutSize.height
        );
        setAllLayouts(scaledLayout);
        let maxImageCount = 0;
        scaledLayout.forEach((layout) => {
          if (layout.number_of_images > maxImageCount) {
            maxImageCount = layout.number_of_images;
          }
        });
        setMaxImageCountOfLayout(maxImageCount);
      }

    } catch (error) {
    }

  }

  // Shuffle layout function
  const shuffleLayout = (byNumber) => {
    setShuffling(true);

    // Count image objects in current page
    const imageObjects = activeLayout !== "spread" ? currentActivePageObjects?.filter(obj => obj.type === 'img') : allLayoutObjectOfCurrentPage?.filter(obj => obj.type === 'img');
    const imageCount = byNumber && byNumber === -1 ? imageObjects?.length > 1 ? imageObjects?.length - 1 : 0 : byNumber && byNumber === 1 ? imageObjects?.length > 0 ? imageObjects?.length + 1 : 1 : imageObjects?.length > 0 ? imageObjects?.length : 1;

    if (imageCount === 0) {
      alert("No images found on current page to shuffle");
      setShuffling(false);
      return;
    }

    // Filter layouts with same image count
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

    // Get random layout from compatible layouts
    const randomIndex = Math.floor(Math.random() * compatibleLayouts.length);
    const randomLayout = compatibleLayouts[randomIndex];

    // if (!randomLayout.layout_c.layout[0]?.objects || randomLayout.layout_c.layout[0].objects.length === 0) {
    //   setShuffling(false);
    //   return;
    // }

    // Apply the random layout
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

  }

  // Whole-book re-roll: keep every page's photos, preserve each page's photo count
  // 1:1, leave covers untouched. Reads pages fresh from the store per page (the
  // engine handles that) — do NOT loop over `shuffleLayout` (its selector reads
  // don't refresh inside a sync loop).
  const shuffleAllPages = async () => {
    setShufflingAll(true);
    try {
      dispatch(setCurrentObjectProperties(null));
      // Single-undo wrapper: the whole shuffle reverts with one Ctrl+Z / undo click.
      const pages = await regenerateOpenDesignLayoutsAsSingleUndo(dispatch, {
        mode: "keep",
        preserveImageCount: true,
      });
      if (pages) {
        toast.success("All pages shuffled! Press Ctrl+Z to undo.");
      } else {
        toast.info("No pages with photos to shuffle.");
      }
    } catch (e) {
      toast.error("Could not shuffle all pages.");
    } finally {
      setShufflingAll(false);
      setShowShuffleAllConfirm(false);
    }
  };

  // current page image count
  useEffect(() => {
    if (activeLayout !== "spread") {
      let imageCount = currentActivePageObjects?.filter(obj => obj.type === 'img').length;
      setCurrentPageImageCount(imageCount > 0 ? imageCount : 0);
    }
    else {
      let imageCount = allLayoutObjectOfCurrentPage?.filter(obj => obj.type === 'img').length;
      setCurrentPageImageCount(imageCount > 0 ? imageCount : 0);
    }
  }, [currentActivePageObjects, activeLayout, allLayoutObjectOfCurrentPage]);

  return (
    <>
      <div className="sticker-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '2px' }}>
        <DisplayBetween className="heading-action-mob"
          style={{ 
            flexShrink: 0,
            borderBottom: '1px solid #f0f0f0' 
          }}>
          <ActionTitle>Layout</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>

        <div className="scroll-container-mob" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, paddingBottom: '20px', padding:"2px" }}>
          {autoLayoutSupported && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                border: "1.5px solid rgba(64,132,181,0.35)",
                background: "rgba(64,132,181,0.06)",
              }}
            >
              <DisplayStart style={{ marginBottom: "8px" }}>
                <BiCollection size={16} style={{ color: "var(--primary)" }} />
                <BodyText fontweight="700" ml="7px" style={{ color: "var(--primary)" }}>
                  Auto Layout
                </BodyText>
              </DisplayStart>
              <div className="d-flex gap-2">
                <PrimaryButton
                  className="flex-fill d-flex align-items-center justify-content-center gap-1 p-2"
                  style={{ fontSize: "12.5px" }}
                  onClick={() => setShowGenDialog(true)}
                  disabled={shufflingAll}
                >
                  Generate Layout
                </PrimaryButton>
                <PrimaryButton
                  className="flex-fill d-flex align-items-center justify-content-center gap-1 p-2"
                  style={{ fontSize: "12.5px", background: "#fff", color: "var(--primary)" }}
                  onClick={() => setShowShuffleAllConfirm(true)}
                  disabled={shufflingAll}
                >
                  <BiShuffle size={15} /> Shuffle All
                </PrimaryButton>
              </div>
              <BodyText
                fontsize="11px"
                style={{ color: "#6b7280", marginTop: "7px", lineHeight: 1.4 }}
              >
                Fill or re-roll every page's layout. Cover pages stay untouched.
              </BodyText>
            </div>
          )}

          <DisplayStart mt="15px">
            {(editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true)) && (
              <Box className="radio me-3">
                <input
                  id="pages"
                  name="radio"
                  type="radio"
                  value="page"
                  onChange={handleLayoutChange}
                  style={{
                    "&::before:checked": {
                      backgroundColor: "var(--primary)"
                    }

                  }}
                  checked={activeLayout === "page"}
                />
                <label htmlFor="pages" className="radio-label">
                  Pages
                </label>
              </Box>
            )}

            {spreadEditorPages && (
              <Box className="radio">
                <input
                  id="spreads"
                  name="radio"
                  type="radio"
                  value="spread"
                  onChange={handleLayoutChange}
                  checked={activeLayout === "spread"}
                />
                <label htmlFor="spreads" className="radio-label">
                  Spreads
                </label>
              </Box>
            )}
          </DisplayStart>
          <DisplayBetween mt="15px" width="100%">
            <Box>
              <DisplayStart>
                <Filter />
                <BodyText fontweight="700" ml="7px">
                  Filter by Photos
                </BodyText>
              </DisplayStart>
            </Box>
            <Box>
              <BodyText
                fontweight="700"
                style={{ color: "var(--primary)" }}
                onClick={handleActivateAllClick}
              >
                Display All
              </BodyText>
            </Box>
          </DisplayBetween>
          <LayoutPaginationBox style={{ flexWrap: "nowrap", gap: "6px" }}>
            {/* {[1, 2, 3, 4, 5, 6, 7, "8+",].map((item, index) => ( */}
            {[1, 2, 3, 4, 5, 6, 7].map((item, index) => (
              <LayoutPaginationItem
                key={index}
                className={
                  exactCountFilter == null &&
                  (activateAll || activeIndex === index + 1)
                    ? "active"
                    : ""
                }
                onClick={() => handlePageClick(index + 1)}
              >
                {item}
              </LayoutPaginationItem>
            ))}
            {maxImageCountOfLayout >= 8 && (
              <select
                value={exactCountFilter ?? ""}
                onChange={handleMoreSelect}
                title="Filter by an exact number of photos"
                style={{
                  fontFamily: "Roboto",
                  fontSize: "12px",
                  fontWeight: 700,
                  height: "19px",
                  lineHeight: "17px",
                  boxSizing: "border-box",
                  borderRadius: "9.5px",
                  padding: "0 2px",
                  marginLeft: "2px",
                  flex: "0 0 auto",
                  cursor: "pointer",
                  textAlign: "center",
                  textAlignLast: "center",
                  verticalAlign: "middle",
                  color: exactCountFilter != null ? "var(--primary)" : "#000",
                  backgroundColor: "#f6f6f6",
                  border:
                    exactCountFilter != null
                      ? "1px solid var(--primary)"
                      : "1px solid #f6f6f6",
                }}
              >
                <option value="">More</option>
                {Array.from({ length: 18 }, (_, i) => i + 8).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            )}
          </LayoutPaginationBox>

          {/* Shuffle Layout Buttons with Tooltips */}
          <div className="d-flex justify-content-center mt-3 mb-3 gap-2">
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="minus-tooltip">
                  <strong>Change Layout By Reducing Images</strong><br />
                </Tooltip>
              }
            >
              <PrimaryButton
                className="d-flex align-items-center gap-2 p-2"
                onClick={() => shuffleLayout(-1)}
                disabled={shuffling || loading || currentPageImageCount <= 1}
              >
                <BiMinus size={18} />
              </PrimaryButton>
            </OverlayTrigger>

            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="shuffle-tooltip">
                  <strong>Shuffle Layout</strong><br />
                </Tooltip>
              }
            >
              <PrimaryButton
                onClick={shuffleLayout}
                disabled={shuffling || loading || currentPageImageCount <= 0}
                className="d-flex align-items-center gap-2 p-2"
              >
                <BiShuffle size={18} />
              </PrimaryButton>

            </OverlayTrigger>

            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="plus-tooltip">
                  <strong>Change Layout By Adding More Images</strong><br />
                </Tooltip>
              }
            >
              <PrimaryButton
                onClick={() => shuffleLayout(1)}
                disabled={shuffling || loading || currentPageImageCount >= maxImageCountOfLayout}
                className="d-flex align-items-center gap-2 p-2"
              >
                <BiPlus size={18} />
              </PrimaryButton>
            </OverlayTrigger>
          </div>

          {loading && <PageLoader />}

          {activeLayout === "page" && (
            <Box
              draggable={true}
              className="layout-box photo-box side-bar-scroll layout-svg-mob"
            >
              {layouts.map((layout, layoutindex) => (
                <svg
                  className={`d-inline-block`}
                  key={uuidv4()}
                  onClick={(e) =>
                    addLayout(layout.layout_c.layout[0], layoutindex)
                  }
                  width={layoutBoxSize.width}
                  height={layoutBoxSize.height}
                  style={{
                    cursor: "pointer",
                    border: "1px solid #ccc9c9",
                    margin: "5px",
                  }}
                  viewBox={[
                    0,
                    0,
                    (editorType === EDITOR_TYPES.PHOTOBOOK || (settings?.isFoldable && settings?.isFoldable === true))
                      ? canvasSize.width / 2
                      : canvasSize.width,
                    canvasSize.height,
                  ]}
                >
                  {layout.layout_c.layout[0].objects.map((item, index) => {
                    return (
                      <g
                        key={`${item.id}-${index}`}
                        className={`  ${item.type === "img" && "inset-0 overflow-hidden"
                          }`}
                      >
                        <g
                          className="page-item"
                          data-id-t={item.id} // Unique identifier for your SVG group
                          style={{
                            transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                            transformOrigin: "center center",
                            transformBox: "fill-box",
                          }}
                        >
                          {/* {item.type === 'text' && <LayoutText item={item} />} */}
                          {item.type === "img" && (
                            <LayoutImgPlaceholder item={item} />
                          )}
                          {item.type === "text" && <LayoutText item={item} />}
                          {/* {item.type === 'sticker' && <Sticker item={item} zoomRatio={zoomRatio} />} */}
                        </g>
                      </g>
                    );
                  })}
                </svg>
              ))}
            </Box>
          )}

          {/* spread layout grids */}
          {activeLayout === "spread" && (
            <Box className="layout-box photo-box side-bar-scroll">
              {layouts.map((layout, layoutindex) => (
                <svg
                  className={`d-inline-block position-relative`}
                  key={uuidv4()}
                  onClick={(e) =>
                    addSpreadLayout(layout.layout_c.layout, layoutindex)
                  }
                  width={layoutBoxSize.width}
                  height={layoutBoxSize.height}
                  style={{
                    cursor: "pointer",
                    border: "1px solid #ccc9c9",
                    margin: "5px",
                  }}
                  viewBox={[
                    0,
                    0,
                    editorType === EDITOR_TYPES.PHOTOBOOK
                      ? Number(canvasSize.width) + (settings?.showFullCoverSheet ? (Number(settings?.spineWidth) || 0) : 0)
                      : Number(canvasSize.width),
                    Number(canvasSize.height),
                  ]}
                >
                  {layout.layout_c.layout.map((lay, layindex) => {
                    // loop through all the objects in the layout
                    return lay.objects.map((item, index) => {
                      return (
                        <g
                          key={`${layindex}-${item.id}-${index}`}
                          className={`position-absolute  ${item.type === "img" && "inset-0 overflow-hidden"
                            }`}
                        >
                          <g
                            className="page-item"
                            data-id-t={item.id} // Unique identifier for your SVG group
                            style={{
                              transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                              transformOrigin: "center center",
                              transformBox: "fill-box",
                            }}
                          >
                            {/* {item.type === 'text' && <LayoutText item={item} />} */}
                            {item.type === "img" && (
                              <LayoutImgPlaceholder item={item} />
                            )}
                            {item.type === "text" && <LayoutText item={item} />}
                            {/* {item.type === 'sticker' && <Sticker item={item} zoomRatio={zoomRatio} />} */}
                          </g>
                        </g>
                      );
                    });
                  })}
                </svg>
                //<LayoutPageItem width={layoutBoxSize.width} height={layoutBoxSize.height} key={uuidv4()} onClick={(e) => addLayout(item, index)} src={item.src} alt={`layout-${index + 1}`} />

                // <LayoutPageItem width={layoutBoxSize.width} height={layoutBoxSize.height} key={`Layoyt-item-${index + 1}`} onClick={(e) => addLayout(item, index)} src={item.src} alt={`layout-${index + 1}`} />
              ))}
            </Box>
          )}

          {/* {activeLayout === 'spread' && <Box className="photo-box side-bar-scroll">
                {TempLayoutSpreads.map((item, index) => (
                    <LayoutSpreadItem key={`Layoyt-item-${index + 1}`} src={item.src} alt={`layout-${index + 1}`} />
                ))
                }
            </Box>} */}
        </div>
      </div >

      <AutoLayoutDialog
        show={showGenDialog}
        onClose={() => setShowGenDialog(false)}
      />

      <ConfirmationDialog
        show={showShuffleAllConfirm}
        title="Shuffle all pages?"
        message="This will change the layout of every page. Your photos are kept and cover pages stay untouched."
        confirmText="Shuffle All"
        cancelText="Cancel"
        loading={shufflingAll}
        onConfirm={shuffleAllPages}
        onClose={() => setShowShuffleAllConfirm(false)}
      />
    </>
  );
};
