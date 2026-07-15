import {
  ActionInnerTitle,
  ActionTitle,
  Box,
  DisplayBetween,
  FlexBox,
  PhotoWrapper,
  SearchBox,
  SearchInput,
  StickerItem,
  StyledTabs,
} from "../../common-components/StyledComponents.jsx";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice.js";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";
import ScrollLoader from "../../common-components/ScrollLoader.jsx";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import {
  withAssetCache,
  withAssetDetailCache,
} from "../../library/utils/helpers/assetsCache.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { EDITOR_ASSETS } from "../../library/utils/constants/index.js";
import {
  setBackgroundImage,
  setBackgroundImageSpread,
  addBackgroundImageToHistory,
} from "../../store/slices/canvas.js";
import Select from "react-dropdown-select";
import { PageLoader } from "../../common-components/Loaders.js";
import RecentlyUsedSection from "../../common-components/RecentlyUsedSection.jsx";
import AllInView from "../../common-components/AllInView.jsx";
import CachedImage from "../../common-components/CachedImage.jsx";
import { cacheImageUrl } from "../../library/utils/helpers/imageCache.js";

let lastVisitedPageBg = 1;

export const BackgroundSlider = ({ onDataLoaded, applyMode = "page" } = {}) => {
  const dispatch = useDispatch();
  const [searchText, setSearchText] = useState("");
  const [backgroundCategory, setBackgroundCategory] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const imagesPerPage = 20;
  const [showAllView, setShowAllView] = useState(false);

  const selectBackgroundImageHistory = (state) =>
    state.canvas.present?.backgroundImageHistory ||
    state.canvas.backgroundImageHistory ||
    [];
  const recentBackgrounds = useSelector(selectBackgroundImageHistory);
  const backgroundRefreshSignal = useSelector((state) => state.appSlice.lastAssetsUpdate.background);

  const handleClick = (item) => {
    const bgAction = applyMode === "spread" ? setBackgroundImageSpread : setBackgroundImage;
    dispatch(bgAction(item));
    dispatch(addBackgroundImageToHistory(item));
  };

  const handleRecentClick = (historyItem) => {
    const reconstructedItem = {
      _id: historyItem.assetId,
      urls: [
        { size: "large", url: historyItem.url },
        { size: "thumbnail", url: historyItem.thumbnailUrl || historyItem.url },
      ],
      name: historyItem.name,
    };
    const bgAction = applyMode === "spread" ? setBackgroundImageSpread : setBackgroundImage;
    dispatch(bgAction(reconstructedItem));
    dispatch(addBackgroundImageToHistory(reconstructedItem));
  };

  useEffect(() => {
    const data = {
      filter: {
        status: 1,
        sample: true,
        type: EDITOR_ASSETS.BACKGROUND,
      },
    };

    // Offline-first: cache the category listing so the filter dropdown stays
    // populated without a connection.
    withAssetDetailCache(
      "backgrounds",
      { categories: data },
      () => apiPost(ENDPOINTS.getBackgroundCategory, data),
      (res) => !!res && Array.isArray(res.items),
    )
      .then((response) => {
        if (
          response &&
          response.items &&
          response.items.length > 0
        ) {
          setBackgroundCategory(response.items);
        }
      })
      .catch(() => {});
  }, []);

  // Wrap API call for hook
  const fetchBackgrounds = useCallback(
    async (page, skip, limit) => {
      const data = {
        filter: {
          status: 1,
          tagId: selectedCategoryIds.length > 0 ? selectedCategoryIds : null,
          type: EDITOR_ASSETS.BACKGROUND,
          display_in_web: true,
          search: searchText,
        },
        skip: skip ?? (page - 1) * imagesPerPage,
        limit: limit ?? imagesPerPage,
      };
      // Offline-first: serve cached backgrounds when offline; refresh on success.
      const response = await withAssetCache("backgrounds", data, () =>
        apiPost(ENDPOINTS.getBackgrounds, data),
      );
      return {
        items: response?.items || [],
        totalCount: response?.totalCount || 0,
      };
    },
    [searchText, selectedCategoryIds],
  );

  const {
    items: backgrounds,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    scrollContainerRef,
    resetAndFetch,
    currentPageRef: bgCurrentPageRef,
  } = useInfiniteScroll({
    fetchFn: fetchBackgrounds,
    itemsPerPage: imagesPerPage,
    enabled: true,
    direction: "vertical",
    restoreToPage: lastVisitedPageBg,
    cacheKey: "backgrounds",
    refreshSignal: backgroundRefreshSignal,
  });

  const handleDropdownChange = (selectedOptions) => {
    const selectedIds = selectedOptions.map((option) => option._id);
    setSelectedCategoryIds(selectedIds);
    // resetAndFetch will be triggered via fetchBackgrounds dependency change
  };

  // Save visited page on unmount so it can be restored on next mount
  useEffect(() => {
    return () => {
      lastVisitedPageBg = bgCurrentPageRef.current;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Signal parent once when first backgrounds batch loads (for scroll restoration)
  const hasSignaledBgDataRef = useRef(false);
  useEffect(() => {
    if (
      backgrounds.length > 0 &&
      !hasSignaledBgDataRef.current &&
      onDataLoaded
    ) {
      hasSignaledBgDataRef.current = true;
      onDataLoaded();
    }
  }, [backgrounds.length, onDataLoaded]);

  // Pre-cache the large URL for every visible background so it's available
  // offline when the user applies it to the canvas. The sidebar thumbnail only
  // caches the small URL; the canvas always uses the large URL.
  useEffect(() => {
    backgrounds.forEach((item) => {
      const largeUrl = item.urls?.find((u) => u.size === "large")?.url;
      if (largeUrl) cacheImageUrl(largeUrl); // no-op when offline or already cached
    });
  }, [backgrounds]);

  if (showAllView) {
    return (
      <AllInView
        title="Used in this project"
        items={recentBackgrounds}
        onItemClick={handleRecentClick}
        onBack={() => setShowAllView(false)}
        objectFit="cover"
        itemBg="#f8f9fa"
      />
    );
  }

  return (
    <>
      <div className="">
        <Box mt="15px">
          <SearchBox>
            <Box
              className="search-icon"
              onClick={(e) => {
                e.preventDefault();
                resetAndFetch();
              }}
            >
              <SearchIcon />
            </Box>
            <SearchInput
              type="text"
              value={searchText}
              placeholder="Search Background"
              onInput={async (e) => {
                e.preventDefault();
                const value = e.target.value;
                setSearchText(value);
                if (!value.trim()) {
                  resetAndFetch();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  resetAndFetch();
                }
              }}
            />
            <Box className="filter-icon">
              <FilterIcon />
            </Box>
          </SearchBox>
        </Box>
        <Box mt="15px">
          <Select
            multi
            options={backgroundCategory.filter((item) =>
              item.name.toLowerCase(),
            )}
            labelField="name"
            valueField="_id"
            placeholder="Select Categories"
            onChange={handleDropdownChange}
            searchBy="name"
            searchable
            clearable
            style={{ width: "100%", marginBottom: "20px" }}
          />
        </Box>

        <RecentlyUsedSection
          title="Used in this project"
          items={recentBackgrounds}
          onItemClick={handleRecentClick}
          itemSize={60}
          objectFit="cover"
          onSeeAll={() => setShowAllView(true)}
        />

        {loading && <PageLoader />}
        <div className="mt-3">
          <div
            style={{
              display: "flex",
              gap: "7px",
              width: "100%",
            }}
          >
            {Array.from({ length: 2 }).map((_, colIndex) => (
              <div
                key={`col-${colIndex}`}
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                {backgrounds
                  .filter((_, i) => i % 2 === colIndex)
                  .map((item) => {
                    if (!item.urls || item.urls.length === 0) return null;
                    const smallUrlObj =
                      item.urls.find((u) => u.size === "small") ||
                      item.urls.find((u) => u.size === "medium") ||
                      item.urls.find((u) => u.size === "large");
                    return (
                      <PhotoWrapper
                        key={item._id}
                        style={{
                          marginBottom: "7px",
                          display: "inline-block",
                          width: "100%",
                        }}
                      >
                        <CachedImage
                          src={smallUrlObj?.url}
                          alt={item.name || "background"}
                          loading="lazy"
                          style={{
                            width: "100%",
                            display: "block",
                            aspectRatio:
                              smallUrlObj?.w && smallUrlObj?.h ?
                                `${smallUrlObj.w} / ${smallUrlObj.h}`
                              : "auto",
                            backgroundColor: "#f0f0f0",
                            cursor: "pointer",
                          }}
                          onClick={() => handleClick(item)}
                        />
                      </PhotoWrapper>
                    );
                  })}
              </div>
            ))}
          </div>

          {/* Sentinel + loader for infinite scroll */}
          <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />
          {isFetchingMore && <ScrollLoader />}
          {!hasMore && backgrounds.length > 0 && (
            <p
              style={{
                textAlign: "center",
                color: "#999",
                fontSize: "12px",
                padding: "10px 0",
                margin: 0,
              }}
            >
              All backgrounds loaded
            </p>
          )}
        </div>
      </div>
    </>
  );
};
