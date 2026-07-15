import {
  StickerShapeIcon,
  ActionTitle,
  Box,
  DisplayBetween,
  FlexBox,
  SearchBox,
  SearchInput,
  StickerItem,
  ActionWrapperBox,
} from "../../common-components/StyledComponents.jsx";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice.js";
import { ImSpinner2 } from "react-icons/im";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { withAssetCache } from "../../library/utils/helpers/assetsCache.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import {
  EDITOR_ASSETS,
  USER_TYPES,
} from "../../library/utils/constants/index.js";
import {
  addObjectInPage,
  addStickerToHistory,
  addShapeToHistory,
} from "../../store/slices/canvas.js";
import { MdOutlineRectangle } from "react-icons/md";
import { MdOutlineCircle } from "react-icons/md";
import { PiLineVerticalBold } from "react-icons/pi";
import { IoMdHeartEmpty } from "react-icons/io";
import { MdOutlineStarBorder } from "react-icons/md";
import { LuTriangle } from "react-icons/lu";
import { FaArrowRight } from "react-icons/fa";
import { IoMdArrowForward } from "react-icons/io";
import { PageLoader } from "../../common-components/Loaders.js";
import { getSettings } from "../../library/utils/helpers/canvasSliceGetters.js";
import SVGRenderer, { isSvgUrl } from "../../common-components/SVGRenderer.jsx";
import styled from "styled-components";
import RecentlyUsedSection from "../../common-components/RecentlyUsedSection.jsx";
import AllInView, { GridItem } from "../../common-components/AllInView.jsx";
import CachedImage from "../../common-components/CachedImage.jsx";

let lastVisitedPageStickers = 1;
let lastScrollTopStickers = 0;
let lastScrollLeftStickers = 0;
let isRestoringScrollStickers = false;

// Module-level cache to persist data across tab switches
let cachedStickers = [];
let cachedTotalPagesStickers = 1;
let cachedHasMoreStickers = true;
let isDataLoadedStickers = false;
let cachedScrollTopStickers = 0;
let cachedScrollLeftStickers = 0;

// Shape icon mapping for rendering shape history items
const SHAPE_ICON_MAP = {
  rect: { Icon: MdOutlineRectangle, label: "Rectangle" },
  circle: { Icon: MdOutlineCircle, label: "Circle" },
  line: { Icon: PiLineVerticalBold, label: "Line" },
  heart: { Icon: IoMdHeartEmpty, label: "Heart" },
  star: { Icon: MdOutlineStarBorder, label: "Star" },
  triangle: { Icon: LuTriangle, label: "Triangle" },
  arrow: { Icon: IoMdArrowForward, label: "Arrow" },
};

// Mobile-friendly container
const MobileContainer = styled.div`
  @media (max-width: 768px) {
    height: auto !important;
    max-height: 70vh !important;
    min-height: auto !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    grid-template-rows: none !important;
    -webkit-overflow-scrolling: touch;
  }
`;

// Horizontal scroll container for shapes
const ShapesScrollRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: scroll;
  overflow-y: hidden;
  padding: 4px 0;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior: contain;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

// Shape item button - compact
const ShapeButton = styled.div`
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e9ecef;
    border-color: var(--primary);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 22px;
    height: 22px;
    color: #495057;
  }
`;

// Horizontal scroll container for stickers
const StickersScrollRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: scroll;
  overflow-y: hidden;
  padding: 4px 0;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior: contain;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

// Sticker item for horizontal scroll - compact
const StickerScrollItem = styled.div`
  flex: 0 0 auto;
  width: 55px;
  height: 55px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--primary);
  }

  &:active {
    transform: scale(0.95);
  }

  img, svg {
    width: 45px;
    height: 45px;
    object-fit: contain;
  }
`;

// Desktop grid container (hidden on mobile)
const DesktopGrid = styled.div`
  @media (max-width: 768px) {
    display: none !important;
  }
`;

// Mobile layout container (hidden on desktop)
const MobileLayout = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

// Section label - compact
const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 4px;
  margin-top: 8px;
`;

// Compact search box for mobile
const MobileSearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 6px 10px;
  margin: 8px 0;

  input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 12px;
    outline: none;

    &::placeholder {
      color: #adb5bd;
    }
  }

  svg {
    width: 16px;
    height: 16px;
    color: #6c757d;
    cursor: pointer;
  }
`;

export const StickerAction = () => {
  const dispatch = useDispatch();
  const imagesPerPage = 20;
  
  const [currentPage, setCurrentPage] = useState(lastVisitedPageStickers);
  const [totalPages, setTotalPages] = useState(cachedTotalPagesStickers);
  const [searchText, setSearchText] = useState("");
  const [stickers, setStickers] = useState(cachedStickers);
  const [loading, setLoading] = useState(false);
  const [showAllView, setShowAllView] = useState(null); // null | "stickers" | "shapes"
  
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cachedHasMoreStickers);
  
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const mobileSentinelRef = useRef(null);
  const isFetchingRef = useRef(false);
  const currentPageRef = useRef(currentPage);
  const getStikersRef = useRef(null);

  const userDetails = localStorage.getItem("userDetails");
  const user = userDetails ? JSON.parse(userDetails) : null;
  const settings = useSelector(getSettings);

  const selectStickerHistory = (state) =>
  state.canvas.present?.stickerHistory || state.canvas.stickerHistory || [];

const selectShapeHistory = (state) =>
  state.canvas.present?.shapeHistory || state.canvas.shapeHistory || [];

  const recentStickers = useSelector(selectStickerHistory);
  const recentShapes = useSelector(selectShapeHistory);

  // Keep cache in sync with state
  useEffect(() => {
    cachedStickers = stickers;
  }, [stickers]);

  useEffect(() => {
    cachedTotalPagesStickers = totalPages;
  }, [totalPages]);

  useEffect(() => {
    cachedHasMoreStickers = hasMore;
  }, [hasMore]);

  // Save scroll position to cache
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      cachedScrollTopStickers = el.scrollTop;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  });

  useEffect(() => {
    const mobileEl = mobileScrollContainerRef.current;
    if (!mobileEl) return;
    const handleMobileScroll = () => {
      cachedScrollLeftStickers = mobileEl.scrollLeft;
    };
    mobileEl.addEventListener('scroll', handleMobileScroll, { passive: true });
    return () => mobileEl.removeEventListener('scroll', handleMobileScroll);
  });

  // Initial load: fetch all pages up to lastVisitedPage only if data not already loaded
  useEffect(() => {
    if (!isDataLoadedStickers) {
      const targetPage = lastVisitedPageStickers > 1 ? lastVisitedPageStickers : 1;
      setCurrentPage(targetPage);
      // Only fetch if we don't have cached data
      if (cachedStickers.length === 0) {
        setStickers([]);
        getStikers(1, searchText, true, targetPage);
      } else {
        // Use cached data, just update state
        isDataLoadedStickers = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Restore scroll position after data is loaded (whether from cache or API)
  // Using useLayoutEffect to apply scroll BEFORE paint to prevent blink
  useLayoutEffect(() => {
    if (!isDataLoadedStickers || stickers.length === 0) return;
    
    const hasScrollPosition = cachedScrollTopStickers > 0 || cachedScrollLeftStickers > 0;
    if (!hasScrollPosition) return;
    
    // Apply scroll synchronously before browser paint
    if (scrollContainerRef.current && cachedScrollTopStickers > 0) {
      scrollContainerRef.current.scrollTop = cachedScrollTopStickers;
    }
    if (mobileScrollContainerRef.current && cachedScrollLeftStickers > 0) {
      mobileScrollContainerRef.current.scrollLeft = cachedScrollLeftStickers;
    }
  }, [isDataLoadedStickers, stickers.length]);

  // Old scroll restore effect - keeping for API-loaded data path
  useEffect(() => {
    if (!isRestoringScrollStickers || stickers.length === 0) return;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        if (scrollContainerRef.current && lastScrollTopStickers > 0) {
          scrollContainerRef.current.scrollTop = lastScrollTopStickers;
        }
        if (mobileScrollContainerRef.current && lastScrollLeftStickers > 0) {
          mobileScrollContainerRef.current.scrollLeft = lastScrollLeftStickers;
        }
        isRestoringScrollStickers = false;
      }, 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [stickers.length]);

  // Desktop Vertical Observer
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isFetchingRef.current && !loading && !isRestoringScrollStickers) {
          const nextPage = currentPageRef.current + 1;
          setCurrentPage(nextPage);
          getStikersRef.current?.(nextPage, searchText);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '200px',
        threshold: 0,
      }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, searchText]);

  // Mobile Horizontal Observer
  useEffect(() => {
    if (!mobileSentinelRef.current) return;
    const mobileObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isFetchingRef.current && !loading && !isRestoringScrollStickers) {
          const nextPage = currentPageRef.current + 1;
          setCurrentPage(nextPage);
          getStikersRef.current?.(nextPage, searchText);
        }
      },
      {
        root: mobileScrollContainerRef.current,
        rootMargin: '200px 200px 200px 200px',
        threshold: 0,
      }
    );
    mobileObserver.observe(mobileSentinelRef.current);
    return () => mobileObserver.disconnect();
  }, [hasMore, loading, searchText]);

  const handleClick = (sticker) => {
    const large = sticker.urls.find((item) => item.size === "large");
    const obj = {
      ...sticker,
      type: "sticker",
      x: 0,
      y: 0,
      width: Number(large.w) || 100,
      height: Number(large.h) || 100,
      url: large.url, // Required for canvas rendering
    };

    dispatch(addObjectInPage(obj));
    dispatch(addStickerToHistory(sticker));
  };

  const handleRecentStickerClick = (historyItem) => {
    const reconstructedSticker = {
      _id: historyItem.assetId,
      urls: [
        {
          size: "large",
          url: historyItem.url,
          w: historyItem.width,
          h: historyItem.height,
        },
        { size: "thumbnail", url: historyItem.thumbnailUrl || historyItem.url },
      ],
      name: historyItem.name,
    };
    handleClick(reconstructedSticker);
  };

  const getStikers = useCallback((pageNumber = 1, searchQuery = "", isReset = false, loadUpToPage = null) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (pageNumber === 1 && !isReset && !loadUpToPage) {
      setLoading(true);
    } else if (pageNumber > 1 || loadUpToPage) {
      setIsFetchingMore(true);
    }

    const skipOffset = loadUpToPage ? 0 : (pageNumber - 1) * imagesPerPage;
    const limitCount = imagesPerPage * (loadUpToPage || 1);

    const data = {
      filter: {
        status: 1,
        type: EDITOR_ASSETS.STICKER,
        display_in_web: true,
        search: searchQuery,
      },
      skip: skipOffset,
      limit: limitCount,
    };

    // Fetch stickers (offline-first: replay cached listing when offline,
    // write-through the latest listing whenever online).
    withAssetCache("stickers", data, () => apiPost(ENDPOINTS.getStickers, data))
      .then((response) => {
        if (response && response.items) {
          // Mark data as loaded
          isDataLoadedStickers = true;

          if (pageNumber === 1 || loadUpToPage) {
            setStickers(response.items);
          } else {
            setStickers(prev => [...prev, ...response.items]);
          }
          let totalCount = response.totalCount || 0;
          const calcTotal = Math.ceil(totalCount / imagesPerPage);
          setTotalPages(calcTotal);
          setHasMore((loadUpToPage || pageNumber) < calcTotal);
          
          // Update the ref to track the last successfully fetched page
          currentPageRef.current = loadUpToPage || pageNumber;
        }
      })
      .catch((error) => {
      })
      .finally(() => {
        setLoading(false);
        setIsFetchingMore(false);
        isFetchingRef.current = false;
      });
  }, [imagesPerPage]);

  // Store function ref for observers to access latest version
  getStikersRef.current = getStikers;

  const clipartRefreshSignal = useSelector((state) => state.appSlice.lastAssetsUpdate.clipart);

  // Respond to refresh signal
  useEffect(() => {
    if (clipartRefreshSignal > 0) {
      // Clear manual cache
      cachedStickers = [];
      cachedTotalPagesStickers = 1;
      cachedHasMoreStickers = true;
      isDataLoadedStickers = false;
      lastVisitedPageStickers = 1;

      // Reset state and re-fetch
      setStickers([]);
      setCurrentPage(1);
      setHasMore(true);
      getStikers(1, searchText, true);
    }
  }, [clipartRefreshSignal, searchText, getStikers]);

  const addShape = (shape) => {
    const obj = {};
    obj.type = "shape";
    obj.shape = shape;
    obj.x = 30;
    obj.y = 30;
    dispatch(addObjectInPage(obj));
    dispatch(addShapeToHistory(shape));
  };

  const handleRecentShapeClick = (historyItem) => {
    addShape(historyItem.shapeType);
  };

  const showShapes = (user?.userTypeCode === USER_TYPES.CUSTOMER && settings?.allowSticker) ||
    user?.userTypeCode !== USER_TYPES.CUSTOMER;

  // Render AllInView for stickers
  if (showAllView === "stickers") {
    return (
      <div 
        className="sticker-container" 
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <AllInView
            title="Used in this project"
            items={recentStickers}
            onBack={() => setShowAllView(null)}
            objectFit="contain"
            itemBg="#f8f9fa"
            renderItem={(item, index) => (
              <GridItem
                key={`all-sticker-${item.id}`}
                $objectFit="contain"
                $bg="#f8f9fa"
                onClick={() => handleRecentStickerClick(item)}
                title={item.name || "Recent sticker"}
              >
                {isSvgUrl(item.url) ?
                  <SVGRenderer
                    src={item.url}
                    alt={item.name || "Recent sticker"}
                  />
                : <CachedImage
                    src={item.thumbnailUrl || item.url}
                    alt={item.name || "Recent sticker"}
                    loading="lazy"
                  />
                }
              </GridItem>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="sticker-container sticker-container-mob" 
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <DisplayBetween 
          className="heading-action-mob"
          style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0', marginTop: '10px' }}
        >
          <ActionTitle>
            Stickers{" "}
            {showShapes ? "& Shapes" : ""}
          </ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>

        <div 
          ref={scrollContainerRef}
          className="scroll-container-mob"
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden', 
            minHeight: 0,
            paddingBottom: '20px',
            padding:"2px"
          }}
        >
          {/* ===== MOBILE LAYOUT ===== */}
          <MobileLayout>
            {/* Shapes Section - Horizontal Scroll */}
            {showShapes && (
              <>
                <SectionLabel>Shapes</SectionLabel>
                <ShapesScrollRow>
                  <ShapeButton onClick={() => addShape("rect")} title="Rectangle">
                    <MdOutlineRectangle />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("circle")} title="Circle">
                    <MdOutlineCircle />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("line")} title="Line">
                    <PiLineVerticalBold />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("heart")} title="Heart">
                    <IoMdHeartEmpty />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("star")} title="Star">
                    <MdOutlineStarBorder />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("triangle")} title="Triangle">
                    <LuTriangle />
                  </ShapeButton>
                  <ShapeButton onClick={() => addShape("arrow")} title="Arrow">
                    <IoMdArrowForward />
                  </ShapeButton>
                </ShapesScrollRow>
              </>
            )}

            {/* Search Bar - Below Shapes */}
            <MobileSearchBox>
              <SearchIcon
                onClick={(e) => {
                  e.preventDefault();
                  getStikers(1, searchText);
                  setCurrentPage(1);
                }}
              />
              <input
                type="text"
                placeholder="Search stickers..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setStickers([]);
                    setCurrentPage(1);
                    setHasMore(true);
                    getStikers(1, searchText, true);
                  }
                }}
              />
            </MobileSearchBox>

            {/* Recently Used Stickers - Mobile */}
            <RecentlyUsedSection
              title="Used in this project"
              items={recentStickers}
              onItemClick={handleRecentStickerClick}
              itemSize={55}
              objectFit="contain"
              itemBg="#f8f9fa"
              onSeeAll={() => setShowAllView("stickers")}
              renderItem={(item, index) => (
                <StickerScrollItem
                  key={`recent-mob-${item.id}`}
                  onClick={() => handleRecentStickerClick(item)}
                  title={item.name || "Recent sticker"}
                >
                  {isSvgUrl(item.url) ?
                    <SVGRenderer
                      src={item.url}
                      alt={item.name || "Recent sticker"}
                      style={{ width: 55, height: 55, objectFit: "contain" }}
                    />
                  : <CachedImage
                      src={item.thumbnailUrl || item.url}
                      alt={item.name || "Recent sticker"}
                      loading="lazy"
                      style={{ width: 55, height: 55, objectFit: "contain" }}
                    />
                  }
                </StickerScrollItem>
              )}
            />

            {/* Stickers Section - Horizontal Scroll */}
            <SectionLabel>Stickers</SectionLabel>
            {loading ? (
              <PageLoader />
            ) : (
              <StickersScrollRow ref={mobileScrollContainerRef}>
                {stickers.map((sticker, index) => (
                  <StickerScrollItem
                    key={`mob-st-${sticker._id}`}
                    onClick={() => handleClick(sticker)}
                  >
                    {isSvgUrl(sticker.urls.find((item) => item.size === "large").url) ? (
                      <SVGRenderer
                        src={sticker.urls.find((item) => item.size === "large").url}
                        alt={`Sticker ${index + 1}`}
                      />
                    ) : (
                      <CachedImage
                        src={sticker.urls.find((item) => item.size === "large").url}
                        alt={`Sticker ${index + 1}`}
                      />
                    )}
                  </StickerScrollItem>
                ))}
                
                {/* Mobile Sentinel element for infinite scroll detection */}
                <div ref={mobileSentinelRef} style={{ width: '1px', height: '100%', flexShrink: 0 }} />
                
                {isFetchingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', flexShrink: 0 }}>
                    <ImSpinner2 style={{ fontSize: "24px", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
                  </div>
                )}
                
                {!hasMore && stickers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', flexShrink: 0 }}>
                    <p style={{ textAlign: 'center', color: '#999', fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>
                      All loaded
                    </p>
                  </div>
                )}
              </StickersScrollRow>
            )}
          </MobileLayout>

          {/* ===== DESKTOP LAYOUT ===== */}

          <DesktopGrid>
            {showShapes && (
              <>
                <Box mt="15px">
                  <ActionWrapperBox>
                    <StickerShapeIcon>
                      <MdOutlineRectangle
                        size={40}
                        onClick={() => addShape("rect")}
                        title="Add Rectangle"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <MdOutlineCircle
                        size={40}
                        onClick={() => addShape("circle")}
                        title="Add Circle"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <PiLineVerticalBold
                        size={40}
                        onClick={() => addShape("line")}
                        title="Add Line"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <IoMdHeartEmpty
                        size={40}
                        onClick={() => addShape("heart")}
                        title="Add heart"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <MdOutlineStarBorder
                        size={40}
                        onClick={() => addShape("star")}
                        title="Add Star"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <LuTriangle
                        size={40}
                        onClick={() => addShape("triangle")}
                        title="Add Triangle"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                      <IoMdArrowForward
                        size={40}
                        onClick={() => addShape("arrow")}
                        title="Add Arrow"
                        className="cursor-pointer me-2 sticker-demo-icons"
                      />
                    </StickerShapeIcon>
                  </ActionWrapperBox>
                </Box>
              </>
            )}
            <Box mt="15px">
              <SearchBox>
                <Box
                  className="search-icon"
                  onClick={(e) => {
                    e.preventDefault();
                    setStickers([]);
                    setCurrentPage(1);
                    setHasMore(true);
                    getStikers(1, searchText, true);
                  }}
                >
                  <SearchIcon />
                </Box>
                <SearchInput
                  type="text"
                  placeholder="Search Stickers"
                  onInput={async (e) => {
                    e.preventDefault();
                    const value = e.target.value;
                    setSearchText(value);
                    if (!value.trim()) {
                      setStickers([]);
                      setCurrentPage(1);
                      setHasMore(true);
                      getStikers(1, "", true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setStickers([]);
                      setCurrentPage(1);
                      setHasMore(true);
                      getStikers(1, searchText, true);
                    }
                  }}
                />

                <Box className="filter-icon">
                  <FilterIcon />
                </Box>
              </SearchBox>
            </Box>

            {/* Recently Used Stickers - Desktop */}
            <div className="mt-3">
            <RecentlyUsedSection
              title="Used in this project"
              items={recentStickers}
              itemSize={55}
              objectFit="contain"
              itemBg="#f8f9fa"
              onSeeAll={() => setShowAllView("stickers")}
              renderItem={(item, index) => (
                <div
                  key={`recent-desk-${item.id}`}
                  onClick={() => handleRecentStickerClick(item)}
                  title={item.name || "Recent sticker"}
                  style={{
                    cursor: "pointer",
                    width: 55,
                    height: 55,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#f8f9fa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSvgUrl(item.url) ?
                    <SVGRenderer
                      src={item.url}
                      alt={item.name || "Recent sticker"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  : <CachedImage
                      src={item.thumbnailUrl || item.url}
                      alt={item.name || "Recent sticker"}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  }
                </div>
              )}
            />
            </div>

            {loading && <PageLoader />}
            <div className="mt-3">
              <div className="row">
                {stickers.map((sticker, index) => (
                  <div
                    className="col-6 align-items-center mb-4 d-flex justify-content-center sticker-item-block"
                    key={`desk-st-${sticker._id}`}
                  >
                    {" "}
                    {/* Centered */}
                    {isSvgUrl(sticker.urls.find((item) => item.size === "large").url) ? (
                      <SVGRenderer
                        src={sticker.urls.find((item) => item.size === "large").url}
                        alt={`Sticker ${index + 1}`}
                        className="img-fluid sticker-item img-fluid-sticker"
                        style={{
                          width: "80%",
                          height: "auto",
                          cursor: "pointer",
                          aspectRatio: "1/1",
                          objectFit: "contain",
                        }}
                        onClick={() => handleClick(sticker)}
                      />
                    ) : (
                      <CachedImage
                        src={sticker.urls.find((item) => item.size === "large").url}
                        alt={`Sticker ${index + 1}`}
                        className="img-fluid sticker-item img-fluid-sticker"
                        style={{
                          width: "80%",
                          height: "auto",
                          cursor: "pointer",
                          aspectRatio: "1/1",
                          objectFit: "contain",
                        }}
                        onClick={() => handleClick(sticker)}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Desktop Sentinel element for infinite scroll detection */}
              <div ref={sentinelRef} style={{ height: '1px', width: '100%' }} />

              {/* Bottom loading indicator */}
              {isFetchingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}>
                  <ImSpinner2 style={{ fontSize: "36px", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </div>
          </DesktopGrid>
        </div>
      </div>
    </>
  );
};

