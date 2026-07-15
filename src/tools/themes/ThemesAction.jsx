import {
  ActionTitle,
  Box,
  DisplayBetween,
  SearchBox,
  SearchInput,
  ThemeItem,
} from "../../common-components/StyledComponents.jsx";
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice.js";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";
import ScrollLoader from "../../common-components/ScrollLoader.jsx";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog.jsx";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import useCachedUrl from "../../hooks/useCachedUrl.js";
import {
  apiPost,
  apiGet,
} from "../../library/utils/common-services/apiCall.js";
import {
  withAssetCache,
  withAssetDetailCache,
} from "../../library/utils/helpers/assetsCache.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import {
  EDITOR_ASSETS,
  EDITOR_TYPES,
  USER_TYPES,
  ORIENTATION,
} from "../../library/utils/constants/index.js";
import {
  getCanvasSize,
  getActiveEditorType,
  getOrientation,
  getSettings,
} from "../../library/utils/helpers/index.js";
import {
  setEditorType,
  setCurrentObjectProperties,
  applyTheme,
  setCalendarSettings,
  setCanvasSize,
  setSettings,
  replaceSettings,
} from "../../store/slices/canvas.js";
import {
  setEditorPages,
  setThemeId,
  setAllThemes,
  setThemeName,
} from "../../store/slices/projectSetup.js";
import {
  decompressFromBase64,
  scalePages,
  getMaskIds,
  replaceMaskIdWithPath,
} from "../../library/utils/common-functions/index.js";
import { GetThemeById, processProjectPages } from "../../library/utils/services/theme/index.js";
import Select from "react-dropdown-select";
import { PageLoader } from "../../common-components/Loaders.js";
import BlankImagePlaceholder from "../../assets/images/blankImagePlaceholder.png";
import { ProjectsList } from "./ProjectsList.jsx";
import BlankThemeDialog from "./BlankThemeDialog.jsx";

// Project/brand-scope flags that must NOT be wiped by a theme switch.
// These represent user permissions / product-level config and are set once
// at init (e.g. from brandDetails or user role), not per theme.
const PRESERVED_SETTINGS_KEYS = [
  "allowImageDelete",
  "maxImageUploadLimit",
  "applyMaximumImageUploadLimit",
  "allowBackgroundRemover",
];

let lastScrollTopThemes = 0;
let lastVisitedPageThemes = 1;

// Memoized theme grid item to prevent re-renders when sibling items change
const ThemeGridItem = React.memo(({ theme, onClick }) => {
  const imgUrl =
    (
      theme?.theme_images &&
      theme.theme_images.length > 0 &&
      theme.theme_images[0]?.url
    ) ?
      theme.theme_images[0].url
    : BlankImagePlaceholder;
  // Resolve through the offline image cache so the preview renders from AppData
  // when offline (online it returns imgUrl unchanged + caches the bytes). The
  // local placeholder is a non-remote url and passes straight through.
  const resolvedImgUrl = useCachedUrl(imgUrl);
  return (
    <div className="col-6 mb-4 d-flex justify-content-center">
      <ThemeItem
        src={resolvedImgUrl}
        alt={theme.name}
        title={theme.name}
        className="img-fluid theme-item"
        loading="lazy"
        onClick={onClick}
      />
    </div>
  );
});
export const ThemesAction = () => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState("");
  // Panel sub-tabs — "projects" (the user's own saved designs) opens first,
  // "themes" is the catalog below.
  const [activeSubTab, setActiveSubTab] = useState("projects");

  const [themeCategories, setThemeCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const canvasSize = useSelector(getCanvasSize);
  const activeEditorType = useSelector(getActiveEditorType);
  const activeOrientation = useSelector(getOrientation);
  const currentSettings = useSelector(getSettings);
  const cartDetails = useSelector((state) => state.projectSetup.cartDetails);

  // Keep refs up-to-date so fetchThemes can read latest values without
  // changing its identity when user/cartDetails load async from redux/localStorage.
  const userRef = useRef(user);
  const cartDetailsRef = useRef(cartDetails);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    cartDetailsRef.current = cartDetails;
  }, [cartDetails]);

  const [isUserInitialized, setIsUserInitialized] = useState(false);

  const themesPerPage = 20;

  const initUser = () => {
    if (user != null) {
      setIsUserInitialized(true);
      return;
    }
    const users = localStorage.getItem("userDetails");
    if (!users) {
      setUser(null);
      setIsUserInitialized(true);
      return;
    }
    const userObj = JSON.parse(users);
    setUser(userObj);
    setIsUserInitialized(true);
  };

  useEffect(() => {
    initUser();

    const data = {
      filter: {
        status: 1,
        sample: true,
        type: EDITOR_ASSETS.THEME,
      },
    };

    // Offline-first: cache the theme category listing so filters stay usable
    // without a connection.
    withAssetDetailCache(
      "themes",
      { categories: data },
      () => apiPost(ENDPOINTS.getThemesCategory, data),
      (res) => !!res && Array.isArray(res.items),
    )
      .then((response) => {
        if (
          response &&
          response.items &&
          response.items.length > 0
        ) {
          setThemeCategories(response.items);
        }
      })
      .catch(() => {});
  }, []);

  // Wrap API call for the hook
  const fetchThemes = useCallback(
    async (page, skip, limit) => {
      // Read via refs so this function's identity stays stable while
      // user/cartDetails load asynchronously (avoids spurious page-1 resets).
      const u = userRef.current;
      const cd = cartDetailsRef.current;
      const data = {
        filter: {
          status:
            (
              u != null &&
              (u?.userTypeCode === USER_TYPES.SUPERUSER ||
                u?.userTypeCode === USER_TYPES.ADMIN ||
                u?.userTypeCode === USER_TYPES.EMPLOYEE)
            ) ?
              { $in: [1, 3] }
            : 1,
          tagId: selectedCategoryIds.length > 0 ? selectedCategoryIds : null,
          editor_type: activeEditorType,
          display_in_web: true,
          search: searchText,
          brand_id: u?.brand_id ? u.brand_id : null,
          userTypeCode: u?.userTypeCode ? u?.userTypeCode : null,
          product_id: cd?.product_id ? cd.product_id : null,
        },
        skip: skip ?? (page - 1) * themesPerPage,
        limit: limit ?? themesPerPage,
        sort: { createdAt: -1 },
      };

      // Offline-first: replay the cached themes listing when offline, refresh on
      // every successful online fetch. Heavy page payloads are stripped BEFORE
      // caching so the cached catalog stays lightweight (matches online path).
      const response = await withAssetCache("themes", data, async () => {
        const apiRes = await apiPost(ENDPOINTS.getThemes, data);
        if (apiRes && apiRes.items) {
          // Strip heavy data from items
          apiRes.items.forEach((item) => {
            delete item.pages_c;
            delete item.theme;
          });
        }
        return apiRes;
      });
      return {
        items: response?.items || [],
        totalCount: response?.totalCount || 0,
      };
    },
    [searchText, selectedCategoryIds, activeEditorType], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const {
    items: themes,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    scrollContainerRef,
    resetAndFetch,
    currentPageRef: themesCurrentPageRef,
  } = useInfiniteScroll({
    fetchFn: fetchThemes,
    itemsPerPage: themesPerPage,
    enabled: isUserInitialized,
    direction: "vertical",
    restoreToPage: lastVisitedPageThemes,
    cacheKey: "themes",
  });

  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: () => { },
    showCancel: true,
    confirmText: "Yes",
  });

  // "Blank" card — build a fresh design with random layouts. Only meaningful for
  // spread-based products (photobook / layflat).
  const [showBlankDialog, setShowBlankDialog] = useState(false);
  const isBlankThemeSupported =
    activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
    activeEditorType === EDITOR_TYPES.LAYFLATALBUM;

  const handleClick = (theme) => {
    setConfirmDialog({
      show: true,
      title: "Apply Theme",
      message: "Do you want to apply this theme?",
      showCancel: true,
      confirmText: "Yes",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, show: false }));
        const themeData = await GetThemeById(
          theme._id,
          canvasSize,
          activeEditorType,
          activeOrientation,
        );

        if (!themeData) {
          setConfirmDialog({
            show: true,
            title: "Theme Unavailable",
            message: "The selected theme is not available for the current product size. Please try another theme.",
            showCancel: false,
            confirmText: "OK",
            onConfirm: () => setConfirmDialog((prev) => ({ ...prev, show: false })),
          });
          return;
        }

        setupTheme(themeData, theme._id);
      },
    });
  };

  const setupTheme = (themeData, themeid) => {
    if (!themeData && !themeData.pages_c) {
      return;
    }
    dispatch(setCalendarSettings(null));

    // Determine target canvas dims + pick the raw-base64 variant whose pages
    // must be applied. For admin: prefer variant matching current canvas size,
    // else theme[0]. For customer: match orientation or fall back to theme[0].
    const isAdminLike =
      user != null &&
      (user?.userTypeCode === USER_TYPES.SUPERUSER ||
        user?.userTypeCode === USER_TYPES.ADMIN ||
        user?.userTypeCode === USER_TYPES.EMPLOYEE);

    let targetWidth = canvasSize.width;
    let targetHeight = canvasSize.height;
    let selectedVariant = null;

    if (isAdminLike) {
      const sizeToCheck = `${canvasSize.width}x${canvasSize.height}`;
      selectedVariant =
        themeData.theme.find((item) => item.size === sizeToCheck) ||
        themeData.theme[0];
      if (selectedVariant) {
        targetWidth = parseFloat(selectedVariant.width);
        targetHeight = parseFloat(selectedVariant.height);
        // Use NEW theme's margins only — do NOT fall back to previous canvasSize
        // margins. Previously `|| canvasSize?.safeMargin` caused margins from the
        // OLD theme to persist when the new theme declares 0/undefined.
        dispatch(
          setCanvasSize({
            ...canvasSize,
            width: targetWidth,
            height: targetHeight,
            depth: parseFloat(selectedVariant.depth) || 0,
            safeMargin: parseFloat(selectedVariant.safe_margin) || 0,
            bleedMargin: parseFloat(selectedVariant.bleed_margin) || 0,
          }),
        );
      }
    } else {
      // Customer: keep canvas size, pick orientation-matching variant.
      selectedVariant =
        themeData.theme.find((t) => t.orientation === activeOrientation) ||
        themeData.theme[0];
    }

    // Re-scale pages by decompressing the chosen variant's RAW base64 directly
    // to the target size. GetThemeById already produced a decoded themeData.pages_c,
    // but that was scaled for a potentially different variant (theme[0] by default)
    // and chaining scalePages on top introduces non-commutative errors in
    // `obj.image.scale *= Math.max(widthScale, heightScale)` — the image crop shifts.
    // processProjectPages mirrors SizeSettingsPopup's path (single scale from raw),
    // guaranteeing identical object positions + image zoom as "resize to same size".
    let scaledPagesForDispatch = themeData.pages_c;
    if (
      selectedVariant?.pages_c &&
      typeof selectedVariant.pages_c === "string" &&
      targetWidth &&
      targetHeight
    ) {
      const layoutWidth =
        themeData.editor_type === EDITOR_TYPES.PHOTOBOOK
          ? targetWidth / 2
          : targetWidth;
      scaledPagesForDispatch = processProjectPages(
        selectedVariant.pages_c,
        layoutWidth,
        targetHeight,
      );
    }

    if (themeData.theme[0].cal_settings) {
      let calSettings = { ...themeData.theme[0].cal_settings };
      if (themeData.theme[0].cal_settings.startMonth) {
        calSettings.startMonth = null;
      }
      if (themeData.theme[0].cal_settings.startYear) {
        calSettings.startYear = null;
      }

      dispatch(setCalendarSettings(calSettings));
    }
    // Full-replace settings so OLD theme's spineWidth / coverEnabled /
    // showFullCoverSheet / paperThickness / hideLastCover / isFoldable don't
    // leak into the new theme (which may not declare them). setSettings merges
    // with existing state.settings — use replaceSettings here instead.
    // Carry over project/brand-scope flags (user rights, upload limits) that
    // are NOT theme-controlled so a theme switch doesn't silently downgrade them.
    const nextThemeSettings = themeData.theme[0].settings || {};
    const preserved = {};
    PRESERVED_SETTINGS_KEYS.forEach((key) => {
      if (currentSettings?.[key] !== undefined && nextThemeSettings[key] === undefined) {
        preserved[key] = currentSettings[key];
      }
    });
    dispatch(replaceSettings({ ...preserved, ...nextThemeSettings }));

    // Defer page/theme dispatches so the new canvasSize commits first and
    // Canvas.jsx's 500ms canvasSize-change debounce (src/components/canvas/Canvas.jsx:1603)
    // runs updateCanvasSize before pages apply. 600ms = 500ms debounce + 100ms cushion.
    // Reduced from 1000ms (400ms saved per theme switch) now that pages are also
    // freshly rescaled via processProjectPages so viewport + pages stay consistent.
    setTimeout(() => {
      dispatch(setCurrentObjectProperties(null));
      dispatch(setEditorType(themeData.editor_type));
      dispatch(setEditorPages(scaledPagesForDispatch));
      dispatch(setThemeId(themeid));
      dispatch(setThemeName(themeData.name));
      if (
        user != null &&
        (user?.userTypeCode === USER_TYPES.SUPERUSER ||
          user?.userTypeCode === USER_TYPES.ADMIN ||
          user?.userTypeCode === USER_TYPES.EMPLOYEE)
      ) {
        dispatch(setAllThemes(themeData.theme));
      }
    }, 600);
  };

  const handleDropdownChange = (selectedOptions) => {
    const selectedIds = selectedOptions.map((option) => option._id);
    setSelectedCategoryIds(selectedIds);
    // resetAndFetch will be triggered via fetchThemes dependency change
  };

  // Scroll preservation
  const needsScrollRestoreThemes = useRef(lastScrollTopThemes > 0);
  const isFirstMountThemes = useRef(true);

  // Continuously save scroll position on every scroll event
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = () => {
      lastScrollTopThemes = el.scrollTop;
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  });

  // Restore scroll position after themes load on mount
  // Using useLayoutEffect to apply scroll BEFORE paint to prevent blink
  useLayoutEffect(() => {
    if (!needsScrollRestoreThemes.current) return;
    if (themes.length === 0 && !isFirstMountThemes.current) return;
    
    // Apply scroll synchronously before browser paint
    if (scrollContainerRef.current && lastScrollTopThemes > 0) {
      scrollContainerRef.current.scrollTop = lastScrollTopThemes;
    }
    needsScrollRestoreThemes.current = false;
    isFirstMountThemes.current = false;
  }, [themes.length]);

  // Save visited page on unmount so it can be restored on next mount
  useEffect(() => {
    return () => {
      lastVisitedPageThemes = themesCurrentPageRef.current;
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
          <ActionTitle>{activeSubTab === "projects" ? "Your Projects" : "Themes"}</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>

        {/* Sub-tab switcher: Projects (default) | Themes */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            gap: "4px",
            padding: "8px 6px 6px",
          }}
        >
          {[
            { key: "projects", label: "Projects" },
            { key: "themes", label: "Themes" },
          ].map((tab) => {
            const active = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSubTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: active ? "var(--primary, #4084b5)" : "#e5e7eb",
                  background: active ? "var(--primary, #4084b5)" : "#fff",
                  color: active ? "#fff" : "var(--foreground, #374151)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeSubTab === "projects" && <ProjectsList />}

        <div
          ref={scrollContainerRef}
          className="scroll-container-mob"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            paddingBottom: "20px",
            padding: "3px",
            display: activeSubTab === "themes" ? "block" : "none",
          }}
        >
          <Box mt="15px">
            <SearchBox>
              <Box
                className="search-icon"
                onClick={() => {
                  resetAndFetch();
                }}
              >
                <SearchIcon />
              </Box>
              <SearchInput
                type="text"
                placeholder="Search theme"
                onChange={(e) => {
                  e.preventDefault();
                  const value = e.target.value;
                  setSearchText(value);
                  if (!value.trim()) {
                    resetAndFetch();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    resetAndFetch();
                  }
                }}
              />
              <Box className="filter-icon">
                <FilterIcon />
              </Box>
            </SearchBox>
          </Box>

          {themeCategories.length > 0 && (
            <Box mt="15px">
              <Select
                multi
                options={themeCategories.filter((item) =>
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
          )}

          {loading && <PageLoader />}
          <div className="mt-3">
            <div className="row">
              {isBlankThemeSupported && (
                <div className="col-6 mb-4 d-flex justify-content-center">
                  <div
                    role="button"
                    title="Start from a blank design with random layouts"
                    onClick={() => setShowBlankDialog(true)}
                    className="theme-item d-flex flex-column align-items-center justify-content-center"
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      border: "2px dashed var(--primary, #4084b5)",
                      borderRadius: "8px",
                      background: "rgba(64,132,181,0.06)",
                      cursor: "pointer",
                      color: "var(--primary, #4084b5)",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "34px", lineHeight: 1, fontWeight: 300 }}>+</span>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Blank</span>
                  </div>
                </div>
              )}
              {themes.map((theme) => (
                <ThemeGridItem
                  key={theme._id}
                  theme={theme}
                  onClick={() => handleClick(theme)}
                />
              ))}
            </div>

            {/* Sentinel + loader for infinite scroll */}
            <div ref={sentinelRef} style={{ height: "1px", width: "100%" }} />
            {isFetchingMore && <ScrollLoader />}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        show={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
        showCancelButton={confirmDialog.showCancel}
        confirmText={confirmDialog.confirmText}
      />

      {isBlankThemeSupported && (
        <BlankThemeDialog
          show={showBlankDialog}
          onHide={() => setShowBlankDialog(false)}
        />
      )}
    </>
  );
};
