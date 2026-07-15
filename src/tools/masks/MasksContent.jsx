import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaAngleDown } from "react-icons/fa";
import { FaAngleRight } from "react-icons/fa";
import {
  DisplayStart,
  FlexBox,
  ButtonComponent,
  DisplayCenter,
  Box,
} from "../../common-components/StyledComponents.jsx";
import { TempMasks } from "../../library/utils/jsons/commonJSON.js";
import {
  getActiveObjectprops,
  getSettings,
} from "../../library/utils/helpers/index.js";
import {
  setCurrentObjectProperties,
  addMaskToHistory,
} from "../../store/slices/canvas.js";
import ScrollLoader from "../../common-components/ScrollLoader.jsx";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { withAssetCache } from "../../library/utils/helpers/assetsCache.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import {
  EDITOR_ASSETS,
  EDITOR_SUB_TYPES,
  USER_TYPES,
} from "../../library/utils/constants/index.js";
import { PageLoader } from "../../common-components/Loaders.js";
import RecentlyUsedSection from "../../common-components/RecentlyUsedSection.jsx";
import AllInView, { GridItem } from "../../common-components/AllInView.jsx";

import styled from "styled-components";

let lastVisitedPageMasks = 1;

const MobileContainer = styled.div`
  @media (max-width: 768px) {
    height: auto !important;
    max-height: none !important;
    min-height: auto !important;
    overflow: visible !important;
  }
`;

export const MasksContent = ({ showAllView, setShowAllView, onDataLoaded }) => {
  const dispatch = useDispatch();

  const activeObjectProps = useSelector(getActiveObjectprops);

  const perPageLimit = 20;
  const userDetail = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetail);
  const settings = useSelector(getSettings);

  const selectMaskHistory = (state) =>
    state.canvas.present?.maskHistory || state.canvas.maskHistory || [];

  const recentMasks = useSelector(selectMaskHistory);
  const maskRefreshSignal = useSelector((state) => state.appSlice.lastAssetsUpdate.mask);

  // Wrap API call for hook
  const fetchMasks = useCallback(async (page, skip, limit) => {
    const data = {
      filter: {
        status: 1,
        type: EDITOR_ASSETS.MASK,
        display_in_web: true,
      },
      skip: skip ?? (page - 1) * perPageLimit,
      limit: limit ?? perPageLimit,
    };
    // Offline-first: serve cached masks when the network/API is unavailable, and
    // write-through the freshest listing whenever online.
    const response = await withAssetCache("masks", data, () =>
      apiPost(ENDPOINTS.getMask, data),
    );
    return {
      items: response?.items || [],
      totalCount: response?.totalCount || 0,
    };
  }, []);

  const {
    items: masks,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    scrollContainerRef,
    currentPageRef: masksCurrentPageRef,
  } = useInfiniteScroll({
    fetchFn: fetchMasks,
    itemsPerPage: perPageLimit,
    enabled: true,
    direction: "vertical",
    restoreToPage: lastVisitedPageMasks,
    cacheKey: "masks",
    refreshSignal: maskRefreshSignal,
  });

  // Save visited page on unmount so it can be restored on next mount
  useEffect(() => {
    return () => {
      lastVisitedPageMasks = masksCurrentPageRef.current;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Signal parent once when first masks batch loads (for scroll restoration)
  const hasSignaledMaskDataRef = useRef(false);
  useEffect(() => {
    if (masks.length > 0 && !hasSignaledMaskDataRef.current && onDataLoaded) {
      hasSignaledMaskDataRef.current = true;
      onDataLoaded();
    }
  }, [masks.length, onDataLoaded]);

  const isImageObjectSelected = () => {
    return (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "img"
    );
  };
  const hasMask = () => {
    return (
      activeObjectProps &&
      activeObjectProps.masking &&
      activeObjectProps.masking.path &&
      activeObjectProps.masking.path !== "M0 0 L24 0 L24 24 L0 24 Z"
    );
  };
  const setMask = (item) => {
    // disallow customer user  when image object is disabled for client and editor sub type is custom_shape
    if (
      activeObjectProps?.disabledForClient === true &&
      user?.userTypeCode === USER_TYPES.CUSTOMER
    ) {
      return;
    }
    if (isImageObjectSelected()) {
      dispatch(
        setCurrentObjectProperties({
          masking: {
            ...activeObjectProps.masking,
            path: item.urls[0].d,
            mask_id: item._id,
            width: parseInt(item.urls[0].w),
            height: parseInt(item.urls[0].h),
          },
          _t: Date.now(), // Update timestamp for recently used tracking
        }),
      );
      dispatch(addMaskToHistory(item));
    } else {
      alert("Please select an image to apply mask");
    }
  };

  const handleRecentMaskClick = (historyItem) => {
    const reconstructedMask = {
      _id: historyItem.assetId,
      urls: [
        {
          d: historyItem.d,
          w: String(historyItem.width),
          h: String(historyItem.height),
        },
      ],
      name: historyItem.name,
    };
    setMask(reconstructedMask);
  };
  const removeMask = () => {
    // disallow customer user  when image object is disabled for client and editor sub type is custom_shape
    if (
      activeObjectProps?.disabledForClient === true &&
      user?.userTypeCode === USER_TYPES.CUSTOMER
    ) {
      return;
    }

    dispatch(
      setCurrentObjectProperties({
        masking: {
          path: null,
          width: 24,
          height: 24,
        },
      }),
    );
  };

  // When "See all" is clicked, hide action content and show AllInView
  if (showAllView) {
    return (
      <MobileContainer className="container mt-3">
        <AllInView
          title="Used in this project"
          items={recentMasks}
          onBack={() => setShowAllView(false)}
          itemBg="#f8f9fa"
          renderItem={(item, index) => {
            const scaleX = 70 / item.width;
            const scaleY = 70 / item.height;
            return (
              <GridItem
                key={`all-mask-${item.id}`}
                $bg="#f8f9fa"
                onClick={() => handleRecentMaskClick(item)}
                title={item.name || "Used in this project"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 70 70">
                  <path transform={`scale(${scaleX}, ${scaleY})`} d={item.d} />
                </svg>
              </GridItem>
            );
          }}
        />
      </MobileContainer>
    );
  }

  return (
    <>
      <div className="">
        {isImageObjectSelected() && hasMask() && (
          <Box mt="10px">
            <ButtonComponent onClick={removeMask} padding="8px 30px 8px 30px">
              <DisplayCenter>
                {/* <PhotoIcon width="20px" height="20px" /> */}
                <Box ml="10px">Remove Mask</Box>
              </DisplayCenter>
            </ButtonComponent>
          </Box>
        )}

        {/* Recently Used Masks Section */}
        <RecentlyUsedSection
          title="Used in this project"
          items={recentMasks}
          itemSize={50}
          itemBg="#f8f9fa"
          onSeeAll={() => setShowAllView(true)}
          renderItem={(item, index) => {
            const scaleX = 50 / item.width;
            const scaleY = 50 / item.height;
            return (
              <div
                key={`recent-mask-${item.id}`}
                onClick={() => handleRecentMaskClick(item)}
                title={item.name || "Used in this project"}
                style={{
                  cursor: "pointer",
                  width: 50,
                  height: 50,
                  borderRadius: 8,
                  background: "#f8f9fa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width={50} height={50} viewBox="0 0 50 50">
                  <path transform={`scale(${scaleX}, ${scaleY})`} d={item.d} />
                </svg>
              </div>
            );
          }}
        />

        {loading && <PageLoader />}

        {/* Mask items grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px",
            padding: "10px 4px",
          }}
        >
          {masks.map((item, index) => (
            <MaskItemData
              key={item._id || index}
              item={item}
              onClick={() => setMask(item)}
            />
          ))}
        </div>

        {/* Sentinel + loader for infinite scroll */}
        <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />
        {isFetchingMore && <ScrollLoader />}
      </div>
    </>
  );
};

const MaskItemData = React.memo(({ item, onClick }) => {
  const w = parseInt(item.urls[0].w) || 100;
  const h = parseInt(item.urls[0].h) || 100;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: "10px",
        aspectRatio: "1",
        width: "100%",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <path d={item.urls[0].d} />
      </svg>
    </div>
  );
});
