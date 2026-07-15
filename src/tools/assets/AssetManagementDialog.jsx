/**
 * AssetManagementDialog
 * Full-screen (90%×90%) dialog for managing editor assets.
 * 3 tabs: Backgrounds, Cliparts, Masks.
 *
 * For ADMIN users:
 *   - Sub-tabs: "Uploaded" (own brand) / "Library" (all superuser materials)
 *   - Library has Visible / Hidden toggles with multi-select hide/enable actions
 *
 * PERFORMANCE: Per-view state is cached so switching tabs does NOT re-fetch.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Spinner, Pagination } from "react-bootstrap";
import { FiSearch, FiPlus, FiImage, FiTrash2, FiEdit2, FiEye, FiEyeOff, FiCheck } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import styled from "styled-components";
import { apiPost, apiDelete } from "../../library/utils/common-services/apiCall";
import { withAssetCache } from "../../library/utils/helpers/assetsCache";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import CachedImage from "../../common-components/CachedImage";
import AddAssetDialog from "./AddAssetDialog";
import ViewAssetDialog from "./ViewAssetDialog";
import { getUserDetails } from "../../library/utils/services/theme";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog";
import { USER_TYPES } from "../../library/utils/constants";
import { useDispatch } from "react-redux";
import { refreshAssets } from "../../store/slices/appAlice";

// ─── Config ──────────────────────────────────────────────────────────────────

const ASSET_TABS = [
  { key: "background", label: "Backgrounds", singular: "Background" },
  { key: "clipart", label: "Cliparts", singular: "Clipart" },
  { key: "mask", label: "Masks", singular: "Mask" },
];

const ITEMS_PER_PAGE = 50;

const createTabCache = () => ({
  assets: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  searchText: "",
  loaded: false,
  // Offline pagination guard: set when a forward page couldn't be served from the
  // offline cache. Keeps the current page's data + pagination visible and only
  // disables the "Next" control (see fetchAssets + the Pagination render).
  atOfflineEnd: false,
});

// Build a composite cache key for a specific view
const getCacheKey = (type, subView, libraryFilter) => {
  if (subView === "library") return `${type}_library_${libraryFilter}`;
  return `${type}_uploaded`;
};

// ─── Styled Components ──────────────────────────────────────────────────────

const DialogOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 11100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: amFadeIn 0.2s ease;
  @keyframes amFadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const DialogContainer = styled.div`
  width: 90%;
  height: 90%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: amSlideUp 0.3s ease;
  @keyframes amSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (max-width: 768px) { width: 95%; height: 95%; }
`;

const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
`;

const DialogTitle = styled.div`
  h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin: 0; }
  p { font-size: 0.82rem; color: #6b7280; margin: 4px 0 0 0; }
`;

const CloseButton = styled.button`
  background: none; border: none; padding: 6px; border-radius: 8px;
  cursor: pointer; color: #6b7280; transition: all 0.2s;
  &:hover { background: #f3f4f6; color: #111827; }
`;

const TabBar = styled.div`
  display: flex; gap: 0; padding: 0 24px;
  border-bottom: 2px solid #f0f0f0; flex-shrink: 0;
`;

const TabBtn = styled.button`
  padding: 12px 20px; border: none; background: none;
  font-size: 0.88rem; font-weight: 600;
  color: ${(p) => (p.$active ? "var(--primary, #4084B5)" : "#6b7280")};
  border-bottom: 2px solid ${(p) => (p.$active ? "var(--primary, #4084B5)" : "transparent")};
  margin-bottom: -2px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
  &:hover { color: var(--primary, #4084B5); background: rgba(64, 132, 181, 0.04); }
`;

// Segmented control for Uploaded / Library (Admin only)
const SegmentedControl = styled.div`
  display: inline-flex; border-radius: 10px;
  overflow: hidden; flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #dee2e6;
`;

const SegmentBtn = styled.button`
  padding: 8px 20px; border: none; font-size: 0.82rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em;
  background: ${p => p.$active ? "var(--primary, #4084B5)" : "#fff"};
  color: ${p => p.$active ? "#fff" : "#6b7280"};
  &:hover:not([disabled]) {
    background: ${p => p.$active ? "var(--primary, #4084B5)" : "#f0f4f8"};
    color: ${p => p.$active ? "#fff" : "#374151"};
  }
`;

// Toggle for Visible / Hidden inside Library
const ToggleGroup = styled.div`
  display: inline-flex; border-radius: 10px;
  overflow: hidden; flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #dee2e6;
`;

const ToggleBtn = styled.button`
  padding: 8px 18px; border: none; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; gap: 6px;
  background: ${p => p.$active
    ? (p.$variant === "hidden" ? "#d97706" : "#059669")
    : "#fff"};
  color: ${p => p.$active ? "#fff" : "#6b7280"};
  &:hover:not([disabled]) {
    background: ${p => p.$active
      ? (p.$variant === "hidden" ? "#b45309" : "#047857")
      : "#f0f4f8"};
    color: ${p => p.$active ? "#fff" : "#374151"};
  }
`;

const Divider = styled.div`
  width: 1px; height: 28px; background: #dee2e6; flex-shrink: 0;
`;

// Row that holds the segmented controls below main tabs
const SubControlRow = styled.div`
  display: flex; align-items: center; gap: 14px;
  padding: 12px 24px; border-bottom: 1px solid #edf0f3;
  flex-shrink: 0; background: #f8f9fb; flex-wrap: wrap;
`;

const ToolbarRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  padding: 14px 24px; border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0; flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative; flex: 1; min-width: 200px;
  svg {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%); color: #9ca3af; pointer-events: none;
  }
  input {
    padding-left: 36px; border-radius: 8px; border: 1px solid #e5e7eb;
    height: 38px; font-size: 0.85rem; width: 100%; transition: border-color 0.2s;
    &:focus {
      border-color: var(--primary, #4084B5);
      box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1); outline: none;
    }
  }
`;

const AddButton = styled.button`
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px; background: var(--primary, #4084B5);
  color: #fff; border: none; border-radius: 8px;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  &:hover {
    background: var(--primary-dark, #000000);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 132, 181, 0.3);
  }
`;

const ActionButton = styled.button`
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap; border: none;
  background: ${p => p.$variant === "danger" ? "#ef4444" : "var(--primary, #4084B5)"};
  color: #fff;
  &:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const DialogBody = styled.div`
  flex: 1; overflow-y: auto; padding: 0;
`;

const AssetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px; padding: 20px 24px;
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px; padding: 12px 16px;
  }
`;

const AssetCard = styled.div`
  position: relative; border-radius: 10px; overflow: hidden;
  background: #f8f9fa; border: 2px solid ${p => p.$selected ? "var(--primary, #4084B5)" : "#e9ecef"};
  cursor: ${p => p.$selectable ? "pointer" : "default"}; transition: all 0.2s; aspect-ratio: 1;
  &:hover {
    border-color: var(--primary, #4084B5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
`;

const SelectCheckbox = styled.div`
  position: absolute; top: 8px; right: 8px; z-index: 10;
  width: 22px; height: 22px; border-radius: 6px;
  border: 2px solid ${p => p.$checked ? "var(--primary, #4084B5)" : "rgba(255,255,255,0.8)"};
  background: ${p => p.$checked ? "var(--primary, #4084B5)" : "rgba(0,0,0,0.3)"};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
  color: #fff;
`;

const AssetName = styled.div`
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 6px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: #fff; font-size: 0.7rem; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;

const DeleteBtn = styled.button`
  position: absolute; top: 8px; right: 8px;
  background: rgba(0, 0, 0, 0.6); color: #fff; border: none;
  border-radius: 50%; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 10; transition: all 0.2s;
  &:hover { background: #ef4444; transform: scale(1.1); }
`;

const EditBtn = styled.button`
  position: absolute; top: 8px; right: 44px;
  background: rgba(0, 0, 0, 0.6); color: #fff; border: none;
  border-radius: 50%; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 10; transition: all 0.2s;
  &:hover { background: var(--primary, #4084B5); transform: scale(1.1); }
`;

const NoImagePlaceholder = styled.div`
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #d1d5db;
`;

const EmptyState = styled.div`
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; text-align: center;
  .icon-wrapper {
    width: 56px; height: 56px; border-radius: 50%;
    background: #f3f4f6; display: flex; align-items: center;
    justify-content: center; margin-bottom: 16px; color: #9ca3af;
  }
  h3 { font-size: 0.95rem; font-weight: 600; color: #111827; margin: 0 0 4px 0; }
  p { font-size: 0.82rem; color: #6b7280; margin: 0 0 16px 0; }
`;

const LoadingWrapper = styled.div`
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; gap: 12px;
  color: #6b7280; font-size: 0.85rem;
`;

const FooterRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-top: 1px solid #e9ecef;
  flex-shrink: 0; flex-wrap: wrap; gap: 12px;
`;

const FooterInfo = styled.span`
  font-size: 0.78rem; color: #9ca3af;
`;

const PaginationWrapper = styled.div`
  .pagination {
    margin: 0;
    .page-item .page-link { font-size: 0.78rem; padding: 4px 10px; }
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

const getAssetThumbnail = (item) => {
  if (item.urls?.length > 0) {
    const small = item.urls.find((u) => u.size === "small");
    if (small) return small.url;
    const medium = item.urls.find((u) => u.size === "medium");
    if (medium) return medium.url;
    return item.urls[0]?.url;
  }
  return item.image || null;
};

function AssetManagementDialog({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("background");
  const [subView, setSubView] = useState("uploaded"); // "uploaded" | "library"
  const [libraryFilter, setLibraryFilter] = useState("visible"); // "visible" | "hidden"
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewAssetId, setViewAssetId] = useState(null);
  const [addedTypes, setAddedTypes] = useState({
    background: false,
    clipart: false,
    mask: false,
  });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    show: false,
    assetId: null,
    loading: false,
  });

  // Library multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const user = getUserDetails();
  const isAdmin = user?.userTypeCode === USER_TYPES.ADMIN;
  const isSuperUser = user?.userTypeCode === USER_TYPES.SUPERUSER;

  // Per-view cache — composite keys like "background_uploaded", "background_library_visible"
  const tabCacheRef = useRef({});
  const [, setRenderTick] = useState(0);
  const forceRender = () => setRenderTick((t) => t + 1);

  const currentCacheKey = getCacheKey(activeTab, subView, libraryFilter);

  // Ensure cache entry exists
  const getCache = useCallback((key) => {
    if (!tabCacheRef.current[key]) {
      tabCacheRef.current[key] = createTabCache();
    }
    return tabCacheRef.current[key];
  }, []);

  const cache = getCache(currentCacheKey);
  const activeTabConfig = ASSET_TABS.find((t) => t.key === activeTab);

  // ── Fetch assets ─────────────────────────────────────────────────────────
  const fetchAssets = useCallback(
    (cacheKey, type, page = 1, search = "", opts = {}) => {
      setIsLoading(true);

      const filter = {
        status: 1,
        type,
        ...(search.trim() && { search: search.trim() }),
      };

      if (opts.subView === "library") {
        // Library → do NOT send brand_id (fetches all superuser materials)
        // Hidden sub-tab → additionally send is_hide_from_brand + brand_id
        if (opts.libraryFilter === "hidden") {
          filter.is_hide_from_brand = true;
          if (user?.brand_id) filter.brand_id = user.brand_id;
        }
        else {
          filter.is_visible_from_brand = true;
        }
      } else {
        // Uploaded → filter by this admin/user's brand
        if (user?.brand_id) filter.brand_id = user.brand_id;
      }

      const data = {
        filter,
        skip: (page - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      };
      // Skip auto brand_id injection for Library Visible (no brand filter at all)
      const skipBrandId = opts.subView === "library" && opts.libraryFilter !== "hidden";

      // Offline-first: cache each view's listing under a per-view category so the
      // Asset Management grid (backgrounds / cliparts / masks — including the
      // Library tab) stays browsable with no connection. `cacheKey` already
      // encodes the active tab + sub-view + filter, so every view keeps its own
      // offline copy and its own default-page fallback (no cross-view bleed).
      withAssetCache(`assetmgmt-${cacheKey}`, data, () =>
        apiPost(ENDPOINTS.getEditorTypeWiseList, data),
      )
        .then((response) => {
          const tc = getCache(cacheKey);
          const items = Array.isArray(response?.items) ? response.items : [];

          // Offline forward-miss: an empty page beyond page 1 while we already
          // have a loaded view with data means this page simply isn't in the
          // offline cache. Keep the current page's data + pagination intact and
          // just flag that we can't advance (disables "Next"), instead of wiping
          // the view — otherwise totalPages collapses to 1, the pagination hides,
          // and the user is stranded with no way back to the cached pages.
          if (items.length === 0 && page > 1 && tc.loaded && tc.assets.length > 0) {
            tc.atOfflineEnd = true;
            forceRender();
            return;
          }

          if (items.length > 0) {
            tc.assets = items;
            tc.totalCount = response.totalCount || 0;
            tc.totalPages = Math.ceil(tc.totalCount / ITEMS_PER_PAGE) || 1;
          } else {
            tc.assets = [];
            tc.totalCount = 0;
            tc.totalPages = 1;
          }
          // A page was actually served → forward navigation is valid again.
          tc.atOfflineEnd = false;
          tc.currentPage = page;
          tc.searchText = search;
          tc.loaded = true;
          forceRender();
        })
        .catch((err) => {
          const tc = getCache(cacheKey);
          // Same guard as above: never wipe a good cached view on a paging error.
          if (page > 1 && tc.loaded && tc.assets.length > 0) {
            tc.atOfflineEnd = true;
          } else {
            tc.assets = [];
            tc.totalCount = 0;
            tc.totalPages = 1;
            tc.loaded = true;
          }
          forceRender();
        })
        .finally(() => setIsLoading(false));
    },
    [getCache, user?.brand_id]
  );

  // Helper to fetch current view
  const fetchCurrentView = useCallback(
    (page = 1, search = "") => {
      const key = getCacheKey(activeTab, subView, libraryFilter);
      fetchAssets(key, activeTab, page, search, { subView, libraryFilter });
    },
    [activeTab, subView, libraryFilter, fetchAssets]
  );

  // On first visit of any view — load if not cached
  useEffect(() => {
    if (!cache.loaded) {
      fetchCurrentView(1, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCacheKey]);

  // Clear selection when switching views
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, subView, libraryFilter]);

  // Reconnected → allow forward navigation again on every cached view (the next
  // page can now be fetched from the network), so the offline-disabled "Next"
  // button re-enables without the user having to page back first.
  useEffect(() => {
    const onOnline = () => {
      let changed = false;
      Object.values(tabCacheRef.current).forEach((tc) => {
        if (tc.atOfflineEnd) {
          tc.atOfflineEnd = false;
          changed = true;
        }
      });
      if (changed) setRenderTick((t) => t + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // ── Tab handlers ──────────────────────────────────────────────────────────
  const handleTabChange = useCallback((key) => {
    if (key !== activeTab) setActiveTab(key);
  }, [activeTab]);

  const handleSubViewChange = useCallback((view) => {
    if (view !== subView) setSubView(view);
  }, [subView]);

  const handleLibraryFilterChange = useCallback((filter) => {
    if (filter !== libraryFilter) setLibraryFilter(filter);
  }, [libraryFilter]);

  // ── Search / Pagination ────────────────────────────────────────────────────
  const handleSearch = () => fetchCurrentView(1, cache.searchText);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
  };

  const handleSearchInput = (e) => {
    const val = e.target.value;
    cache.searchText = val;
    forceRender();
    if (!val.trim()) fetchCurrentView(1, "");
  };

  const handlePageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= cache.totalPages && page !== cache.currentPage) {
        fetchCurrentView(page, cache.searchText);
      }
    },
    [cache, fetchCurrentView]
  );

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleAssetAdded = () => {
    setShowAddDialog(false);
    setAddedTypes((prev) => ({ ...prev, [activeTab]: true }));
    fetchCurrentView(cache.currentPage, cache.searchText);
  };

  const handleClose = useCallback(() => {
    Object.keys(addedTypes).forEach((type) => {
      if (addedTypes[type]) {
        dispatch(refreshAssets(type));
      }
    });
    onClose();
  }, [addedTypes, dispatch, onClose]);

  const handleDeleteAssetClick = (id, e) => {
    e.stopPropagation();
    setDeleteConfirmDialog({ show: true, assetId: id, loading: false });
  };

  const handleConfirmDeleteAsset = async () => {
    if (!deleteConfirmDialog.assetId) return;
    setDeleteConfirmDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await apiDelete(ENDPOINTS.deleteEditorSetting + deleteConfirmDialog.assetId);
      if (res && res.status === 1) {
        fetchCurrentView(cache.currentPage, cache.searchText);
        setDeleteConfirmDialog({ show: false, assetId: null, loading: false });
      } else {
        alert(res?.error || res?.message || "Failed to delete asset.");
        setDeleteConfirmDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      alert("Error deleting asset.");
      setDeleteConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // ── Library multi-select actions ───────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a._id)));
    }
  };

  const handleHideMaterials = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const res = await apiPost(ENDPOINTS.hideMaterialFromBrand, {
        type: "material",
        material_ids: Array.from(selectedIds),
        brand_id: [user?.brand_id],
      });
      if (res?.status === 1 || !res?.error) {
        setSelectedIds(new Set());
        // Invalidate both visible and hidden caches for this tab
        const visKey = getCacheKey(activeTab, "library", "visible");
        const hidKey = getCacheKey(activeTab, "library", "hidden");
        if (tabCacheRef.current[visKey]) tabCacheRef.current[visKey].loaded = false;
        if (tabCacheRef.current[hidKey]) tabCacheRef.current[hidKey].loaded = false;
        fetchCurrentView(1, cache.searchText);
      } else {
        alert(res?.error || "Failed to hide materials.");
      }
    } catch (err) {
      alert("Error hiding materials.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableMaterials = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const res = await apiPost(ENDPOINTS.enableMaterialFromBrand, {
        type: "material",
        material_ids: Array.from(selectedIds),
        brand_id: [user?.brand_id],
      });
      if (res?.status === 1 || !res?.error) {
        setSelectedIds(new Set());
        const visKey = getCacheKey(activeTab, "library", "visible");
        const hidKey = getCacheKey(activeTab, "library", "hidden");
        if (tabCacheRef.current[visKey]) tabCacheRef.current[visKey].loaded = false;
        if (tabCacheRef.current[hidKey]) tabCacheRef.current[hidKey].loaded = false;
        fetchCurrentView(1, cache.searchText);
      } else {
        alert(res?.error || "Failed to enable materials.");
      }
    } catch (err) {
      alert("Error enabling materials.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const { assets, currentPage, totalPages, totalCount, searchText, atOfflineEnd } = cache;
  const isLibraryView = isAdmin && subView === "library";

  // ── Render grid ────────────────────────────────────────────────────────────
  const renderedAssetsGrid = useMemo(() => {
    return (
      <AssetsGrid>
        {assets.map((item) => {
          const thumb = getAssetThumbnail(item);

          // Library view → selectable cards, no edit/delete
          if (isLibraryView) {
            const isSelected = selectedIds.has(item._id);
            return (
              <AssetCard
                key={item._id}
                $selectable
                $selected={isSelected}
                onClick={() => toggleSelect(item._id)}
              >
                <SelectCheckbox $checked={isSelected}>
                  {isSelected && <FiCheck size={12} />}
                </SelectCheckbox>
                {thumb ? (
                  <CachedImage src={thumb} alt={item.name || "Asset"} loading="lazy" decoding="async" draggable={false} style={{ contentVisibility: "auto" }} />
                ) : (
                  <NoImagePlaceholder><FiImage size={28} /></NoImagePlaceholder>
                )}
                {item.name && <AssetName title={item.name}>{item.name}</AssetName>}
              </AssetCard>
            );
          }

          // Uploaded view — existing behavior
          const canViewAndEdit =
            isSuperUser ||
            (isAdmin && item.brand_id && item.brand_id === user?.brand_id);

          return (
            <AssetCard key={item._id}>
              {canViewAndEdit && (
                <>
                  <EditBtn
                    title="Edit Asset"
                    onClick={(e) => { e.stopPropagation(); setViewAssetId(item._id); }}
                  >
                    <FiEdit2 size={13} />
                  </EditBtn>
                  <DeleteBtn
                    title="Delete Asset"
                    onClick={(e) => handleDeleteAssetClick(item._id, e)}
                  >
                    <FiTrash2 size={14} />
                  </DeleteBtn>
                </>
              )}
              {thumb ? (
                <CachedImage src={thumb} alt={item.name || "Asset"} loading="lazy" decoding="async" draggable={false} style={{ contentVisibility: "auto" }} />
              ) : (
                <NoImagePlaceholder><FiImage size={28} /></NoImagePlaceholder>
              )}
              {item.name && <AssetName title={item.name}>{item.name}</AssetName>}
            </AssetCard>
          );
        })}
      </AssetsGrid>
    );
  }, [assets, isLibraryView, selectedIds, isSuperUser, isAdmin, user?.brand_id]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <DialogOverlay>
        <DialogContainer onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <DialogHeader>
            <DialogTitle>
              <h2>Asset Management</h2>
              <p>Manage backgrounds, cliparts, and masks for the editor</p>
            </DialogTitle>
            <CloseButton onClick={handleClose} aria-label="Close">
              <IoClose size={22} />
            </CloseButton>
          </DialogHeader>

          {/* Main Tabs (Background / Clipart / Mask) */}
          <TabBar>
            {ASSET_TABS.map((tab) => (
              <TabBtn
                key={tab.key}
                $active={activeTab === tab.key}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </TabBtn>
            ))}
          </TabBar>

          {/* Sub-controls: Uploaded / Library + Visible / Hidden (Admin only) */}
          {isAdmin && (
            <SubControlRow>
              <SegmentedControl>
                <SegmentBtn $active={subView === "uploaded"} onClick={() => handleSubViewChange("uploaded")}>
                  Uploaded
                </SegmentBtn>
                <SegmentBtn $active={subView === "library"} onClick={() => handleSubViewChange("library")}>
                  Library
                </SegmentBtn>
              </SegmentedControl>

              {subView === "library" && (
                <>
                  <Divider />
                  <ToggleGroup>
                    <ToggleBtn $active={libraryFilter === "visible"} onClick={() => handleLibraryFilterChange("visible")}>
                      <FiEye size={13} /> Visible
                    </ToggleBtn>
                    <ToggleBtn $active={libraryFilter === "hidden"} $variant="hidden" onClick={() => handleLibraryFilterChange("hidden")}>
                      <FiEyeOff size={13} /> Hidden
                    </ToggleBtn>
                  </ToggleGroup>
                </>
              )}
            </SubControlRow>
          )}

          {/* Toolbar */}
          <ToolbarRow>
            <SearchWrapper>
              <FiSearch size={16} />
              <input
                type="text"
                placeholder={`Search ${activeTabConfig?.label?.toLowerCase() || "assets"}...`}
                value={searchText}
                onChange={handleSearchInput}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search assets"
              />
            </SearchWrapper>

            {/* Add button only in Uploaded view */}
            {(!isAdmin || subView === "uploaded") && (
              <AddButton onClick={() => setShowAddDialog(true)}>
                <FiPlus size={16} />
                Add {activeTabConfig?.singular}
              </AddButton>
            )}

            {/* Library multi-select actions */}
            {isLibraryView && (
              <>
                <ActionButton
                  onClick={handleSelectAll}
                  style={{ background: "#6b7280" }}
                >
                  {selectedIds.size === assets.length && assets.length > 0 ? "Deselect All" : "Select All"}
                </ActionButton>

                {selectedIds.size > 0 && (
                  libraryFilter === "visible" ? (
                    <ActionButton
                      $variant="danger"
                      onClick={handleHideMaterials}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Spinner animation="border" size="sm" /> : <FiEyeOff size={14} />}
                      Hide ({selectedIds.size})
                    </ActionButton>
                  ) : (
                    <ActionButton onClick={handleEnableMaterials} disabled={actionLoading}>
                      {actionLoading ? <Spinner animation="border" size="sm" /> : <FiEye size={14} />}
                      Show ({selectedIds.size})
                    </ActionButton>
                  )
                )}
              </>
            )}
          </ToolbarRow>

          {/* Body */}
          <DialogBody>
            {isLoading ? (
              <LoadingWrapper><Spinner animation="border" size="sm" /></LoadingWrapper>
            ) : assets.length === 0 ? (
              <EmptyState>
                <div className="icon-wrapper"><FiImage size={22} /></div>
                <h3>No {activeTabConfig?.label?.toLowerCase()} found</h3>
                <p>
                  {totalCount === 0 && !searchText.trim()
                    ? isLibraryView
                      ? `No ${libraryFilter} ${activeTabConfig?.label?.toLowerCase()} in the library`
                      : `Add your first ${activeTabConfig?.singular?.toLowerCase()} to get started`
                    : "No results match your current search"}
                </p>
                {totalCount === 0 && !searchText.trim() && !isLibraryView && (
                  <AddButton onClick={() => setShowAddDialog(true)}>
                    <FiPlus size={16} />
                    Add {activeTabConfig?.singular}
                  </AddButton>
                )}
              </EmptyState>
            ) : (
              renderedAssetsGrid
            )}
          </DialogBody>

          {/* Footer */}
          <FooterRow>
            <FooterInfo>
              {totalCount > 0
                ? `Showing ${Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalCount)}–${Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of ${totalCount} ${activeTabConfig?.label?.toLowerCase()}`
                : `0 ${activeTabConfig?.label?.toLowerCase()}`}
            </FooterInfo>
            {totalPages > 1 && (
              <PaginationWrapper>
                <Pagination>
                  <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                  {currentPage - 10 > 0 && (
                    <>
                      <Pagination.Item onClick={() => handlePageChange(currentPage - 10)}>{currentPage - 10}</Pagination.Item>
                      <Pagination.Ellipsis />
                    </>
                  )}
                  {currentPage > 1 && totalPages < 10 && (
                    <Pagination.Item onClick={() => handlePageChange(currentPage - 1)}>{currentPage - 1}</Pagination.Item>
                  )}
                  <Pagination.Item active>{currentPage}</Pagination.Item>
                  {/* Forward jumps are hidden once the offline cache runs out (atOfflineEnd)
                      so there are no dead-clicks to unreachable pages — only Next is
                      "disabled" and Prev stays usable. */}
                  {currentPage < totalPages && totalPages < 10 && !atOfflineEnd && (
                    <Pagination.Item onClick={() => handlePageChange(currentPage + 1)}>{currentPage + 1}</Pagination.Item>
                  )}
                  {currentPage + 10 <= totalPages && !atOfflineEnd && (
                    <>
                      <Pagination.Ellipsis />
                      <Pagination.Item onClick={() => handlePageChange(currentPage + 10)}>{currentPage + 10}</Pagination.Item>
                    </>
                  )}
                  <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || atOfflineEnd} />
                </Pagination>
              </PaginationWrapper>
            )}
          </FooterRow>
        </DialogContainer>
      </DialogOverlay>

      {/* Confirmation Dialog for Asset Deletion */}
      <ConfirmationDialog
        show={deleteConfirmDialog.show}
        onClose={() => setDeleteConfirmDialog({ show: false, assetId: null, loading: false })}
        onConfirm={handleConfirmDeleteAsset}
        title="Delete Asset"
        message="Are you sure you want to permanently delete this asset? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleteConfirmDialog.loading}
      />

      {/* Add Dialog (only in Uploaded view) */}
      {showAddDialog && (
        <AddAssetDialog
          isOpen={showAddDialog}
          assetType={activeTab}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleAssetAdded}
        />
      )}

      {/* View/Edit Dialog */}
      {viewAssetId && (
        <ViewAssetDialog
          isOpen={true}
          assetId={viewAssetId}
          onClose={() => setViewAssetId(null)}
          onSuccess={handleAssetAdded}
        />
      )}
    </>,
    document.body
  );
}

export default AssetManagementDialog;
