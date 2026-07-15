import {
  ActionTitle,
  BodyText,
  Box,
  ButtonComponent,
  DisplayBetween,
  DisplayCenter,
  DisplayEnd,
  EmptyPhotoWrapper,
  FlexBox,
  HighLightTex,
  PhotoItem,
  ThumbsBox,
  ThumbsIcon,
  FavoriteButton,
  PhotoWrapper,
  PhotoGrid,
  DeleteButton,
  ImageButtonContainer,
  SelectCheckbox,
} from "../../common-components/StyledComponents.jsx";
import { LiaTimesSolid } from "react-icons/lia";
import { ImSpinner2 } from "react-icons/im";
import styled, { keyframes } from "styled-components";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Modal, ModalBody } from "react-bootstrap";
import { CommonLoaderContainer, CommonLoader } from "../../common-components/StyledComponents.jsx";
import {
  setActiveActionIndex,
  setIsActionActive,
} from "../../store/slices/appAlice.js";
import {
  setCurrentObjectProperties,
  changeObjectsInAllPages,
  setActiveObject,
  setSettings,
} from "../../store/slices/canvas.js";
import { ReactComponent as PhotoIcon } from "../../assets/icons/image_icon.svg";
import { ReactComponent as AutoCreateIcon } from "../../assets/icons/auto_create_icon.svg";
import {
  addObjectInPage,
  changeObjectInPage,
  addPhotoToHistory,
} from "../../store/slices/canvas.js";
import {
  getActiveObject,
  getCurrentActiveSize,
  getActiveEditorType,
  getActiveObjectprops,
  getSettings,
  getAllObjectsSortedByZIndex,
  getAllObjects,
} from "../../library/utils/helpers/index.js";
import { EDITOR_SUB_TYPES, EDITOR_TYPES } from "../../library/utils/constants/index.js";


import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PhotoModal } from "./AddPhotosPopup.jsx";
import { v4 as uuidv4 } from "uuid";

import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";

import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { FaHeart, FaRegHeart, FaTrashAlt, FaPlus, FaRegImages } from "react-icons/fa";
import { AsyncImage } from "loadable-image";
import ImageLoader from "../../common-components/Loaders.js";
import { PageLoader } from "../../common-components/Loaders.js";
import ScrollLoader from "../../common-components/ScrollLoader.jsx";
import AutoCreateV2PopUp from "./AutoCreateV2PopUp.jsx";
import { USER_TYPES } from "../../library/utils/constants/index.js";
import AddFistTimePhotoModal from "./AddPhotosFirstTime.jsx";
import { getCurrentActivePageObjects, getAllObjectsOfAllLayoutsOfCurrentPage } from "../../library/utils/helpers/index.js";

import EmptyPhoto from "../../assets/images/Blank_Photo.webp";

import ImageWithLoader from "../../common-components/ImageWithLoader.jsx";
import AIKidsPhotoBookModal from "../../components/popups/AIKidsPhotoBookModal";
import { selectAiKidsPhotobookModalOpen, selectProcessingStatus } from "../../store/slices/aiKidsPhotobookSlice.js";
import { openAiKidsPhotobookModal, closeAiKidsPhotobookModal } from "../../store/slices/aiKidsPhotobookSlice.js";
import { refreshProjectImages, setTotalUploadedImages, removeImage, releasePreviewUrl } from "../../store/slices/imageUpload.js";
import { prioritizeUpload } from "../../store/background-services/imageUploadThunks.js";
import {
  localAssetsEnabled,
  fetchLocalGallery,
  setLocalFavorite,
  removeLocalAssets,
} from "../../library/utils/upload/localAssetStore.js";
import RecentlyUsedSection from "../../common-components/RecentlyUsedSection.jsx";
import AllInView from "../../common-components/AllInView.jsx";
import { toast } from "react-toastify";

// Reference-mode (desktop): asset ids whose original file was found missing and
// already surfaced to the user this session, so the "re-add" toast fires ONCE per
// image (not on every gallery re-fetch / infinite-scroll page).
const missingOriginalToasted = new Set();

// Surface a single toast for any reference-mode gallery items whose original file
// is gone (moved/deleted). Deduped by asset id across the session.
function notifyMissingOriginals(items) {
  if (!localAssetsEnabled || !Array.isArray(items)) return;
  const fresh = items.filter(
    (it) => it && it.originalMissing && it._id && !missingOriginalToasted.has(it._id)
  );
  if (fresh.length === 0) return;
  fresh.forEach((it) => missingOriginalToasted.add(it._id));
  const names = fresh
    .map((it) => it.file_name || it.name || "an image")
    .slice(0, 3)
    .join(", ");
  const extra = fresh.length > 3 ? ` and ${fresh.length - 3} more` : "";
  toast.warning(
    `${fresh.length} image${fresh.length > 1 ? "s are" : " is"} missing (${names}${extra}). ` +
      `The original file was moved or deleted — please add it again.`,
    { position: "top-center", autoClose: 6000 }
  );
}

let lastVisitedPage = 1;
let lastScrollTop = 0;
let lastScrollLeft = 0;
let isRestoringScroll = false; // Flag to prevent Intersection Observer from firing during scroll restore

// Module-level cache to persist data across tab switches
let cachedProjectImages = [];
let cachedTotalPages = 1;
let cachedHasMore = true;
let isDataLoaded = false;
let cachedScrollTop = 0;
let cachedScrollLeft = 0;
// Gallery sort options → backend { field, order }. The backend's getProjectImages
// accepts sortField "_id" (record/added order — ObjectId is monotonic), and
// (per backend) "file_name" and "created_at". ⚠️ If the backend uses different
// field names for those two, change them here in ONE place.
const SORT_CONFIG = {
  added_desc: { label: "Recently added", field: "_id", order: "desc" },
  added_asc: { label: "Earliest added", field: "_id", order: "asc" },
  // created_desc: { label: "Latest created",    field: "created_at", order: "desc" },
  // created_asc:  { label: "Earliest created",  field: "created_at", order: "asc"  },
  // name_asc:     { label: "File name (A–Z)",   field: "file_name",  order: "asc"  },
  // name_desc:    { label: "File name (Z–A)",   field: "file_name",  order: "desc" },
};

// Resolve a sort key to its backend { field, order }. Tolerates the legacy
// "asc"/"desc" values so a stale cached value never breaks the fetch.
const resolveSort = (key) => {
  if (key === "asc") return SORT_CONFIG.added_asc;
  if (key === "desc") return SORT_CONFIG.added_desc;
  return SORT_CONFIG[key] || SORT_CONFIG.added_asc;
};

// Gallery sort key. Default "Earliest added" (oldest _id first) — the gallery
// reads top-to-bottom in upload order, so freshly uploaded images land at the
// BOTTOM. Persisted in localStorage so the user's explicit choice survives a
// full page reload (an in-memory-only default reset on every reload).
// Key bumped to _v3 when the default flipped to "Earliest added": browsers that
// had a sort persisted under an earlier key ("added_desc" from the old default,
// or a choice made while testing) would otherwise override the new default on
// reload. The bump resets everyone to the new default once; explicit picks after
// that persist under this key as normal.
const SORT_STORAGE_KEY = "photoGallerySortOrder_v3";
const readStoredSortOrder = () => {
  try {
    const v = window.localStorage.getItem(SORT_STORAGE_KEY);
    return v && SORT_CONFIG[v] ? v : "added_asc";
  } catch {
    return "added_asc";
  }
};
let cachedSortOrder = readStoredSortOrder();

// Memoized selector (defined outside component to avoid re-creation)
const selectPhotoHistory = (state) =>
  state.canvas.present?.photoHistory ||
  state.canvas.photoHistory ||
  [];

// Probes an image URL via the browser to get EXIF-corrected natural dimensions.
// This is necessary because phones store JPEG files with raw landscape pixel
// dimensions but include an EXIF orientation tag. Browsers apply the rotation
// automatically when rendering <img> elements, so naturalWidth/naturalHeight
// reflect the visually correct (portrait) size.
function getExifAwareDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null); // fall back to DB values on error
    img.src = url;
  });
}

// Memoized ImageItem to prevent re-rendering every image when one changes
// Skeleton shimmer for a tile whose thumbnail hasn't been generated yet. Reads
// as "loading" (intentional) instead of the old gray broken-image icon (which
// read as "error"). Used while an upload is queued/preparing.
const shimmer = keyframes`
  0% { background-position: -150% 0; }
  100% { background-position: 150% 0; }
`;

const SkeletonTile = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    100deg,
    #cdd2d9 30%,
    #e3e7ec 50%,
    #cdd2d9 70%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.3s ease-in-out infinite;
`;

// The photo is shown WHOLE inside the uniform square cell: object-fit:contain
// scales it to fit, centered, letterboxing on white (landscape → bars top/bottom,
// portrait → bars left/right). The `&&` doubles this class's specificity so it
// BEATS PhotoWrapper's generic `img { height:auto; border-radius:5px }` descendant
// rule — without it the photo rendered at natural height, top-left, "half"-size
// and off-center. NO fade-in (flicker).
const ThumbImg = styled.img`
  && {
    position: absolute;
    inset: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    object-position: center;
    border-radius: 0;
    margin: 0;
    background-color: transparent;
  }
`;

// Every gallery cell is the SAME SQUARE — matches the reference platform exactly
// (its LibraryItemPreview is 120×120). Uniform → the grid never reflows (zero
// vibration). Each photo is shown WHOLE inside (object-fit:contain): the reference
// renders a landscape photo at 114×65 and a portrait at 85.5×114 inside the
// square, i.e. scaled-to-fit + centered + letterboxed.
const GALLERY_CELL_ASPECT = "1 / 1";

const ImageItem = React.memo(({ item, canDelete, usageCount, onSelect, onPhotoClick, onDragStart, onToggleFavorite, onDelete }) => {
  const smallUrlObj = item.urls?.find((u) => u.size === "small");
  const mediumUrlObj = item.urls?.find((u) => u.size === "medium");
  const largeUrlObj = item.urls?.find((u) => u.size === "large");
  const largeUrl = largeUrlObj?.url;
  // Optimistic placement: still-uploading images render as normal tiles
  // (worker thumbnail) with a status badge; select/favorite/delete/drag are
  // disabled until the upload settles.
  const isPending = !!item.isPending;

  // ── Hover preview (floating popover beside the panel) ──────────────────────
  // On hover, show a larger preview of the photo with its filename, pixel
  // dimensions and usage count — anchored just outside the sidebar panel.
  const wrapRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null); // null = not hovering
  // Prefer medium/small for the hover popover — in reference mode `large` is the
  // FULL original file (heavy, and remote-if-missing), so never load it just to
  // preview on hover; the small thumb is plenty at popover size.
  const previewUrl = mediumUrlObj?.url || smallUrlObj?.url || largeUrl || "";
  const dimW = largeUrlObj?.w || mediumUrlObj?.w || item.width;
  const dimH = largeUrlObj?.h || mediumUrlObj?.h || item.height;
  const fileNameRaw =
    item.file_name || item.name || item.original_name || item.fileName || "";
  const fileName = String(fileNameRaw).replace(/\.[^./\\]+$/, ""); // drop extension

  const POP_W = 250;
  const POP_H = 430;
  const showHoverPreview = () => {
    const el = wrapRef.current;
    if (!el || item.noThumb || !previewUrl) return;
    const r = el.getBoundingClientRect();
    const panel = el.closest(".actions-wrapper") || el.closest(".sidebar-wrapper");
    const panelRect = panel ? panel.getBoundingClientRect() : r;
    // Prefer just to the RIGHT of the panel; flip to the left if it won't fit.
    let left = panelRect.right + 12;
    if (left + POP_W > window.innerWidth - 8) {
      left = Math.max(8, panelRect.left - POP_W - 12);
    }
    // Vertically centre on the hovered tile, clamped to the viewport.
    let top = r.top + r.height / 2 - POP_H / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - POP_H - 8));
    setHoverPos({ left, top });
  };
  const hideHoverPreview = () => setHoverPos(null);

  return (
    <PhotoWrapper
      ref={wrapRef}
      onMouseEnter={showHoverPreview}
      onMouseLeave={hideHoverPreview}
      className="position-relative m-0 p-0"
      selected={item.isSelected}
      style={{
        // UNIFORM portrait cell (same for every photo) → the grid never reflows
        // → zero vibration. The photo is shown WHOLE inside (contain) centered on
        // white, so landscape gets bars top/bottom and portrait fills it — the
        // reference look. position:relative anchors the absolute img/skeleton.
        position: 'relative',
        display: 'block',
        width: '100%',
        aspectRatio: GALLERY_CELL_ASPECT,
        background: 'transparent',
        // No card framing — the box-shadow + border made each cell a little white
        // card, so the transparent letterbox read as a white block. Without them
        // the letterbox blends into the sidebar. (Selection border still comes
        // from PhotoWrapper's own `selected` styling.)
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      {canDelete && !isPending && (
        <SelectCheckbox
          className="checkbox"
          type="checkbox"
          onChange={() => onSelect(item)}
          checked={item.isSelected}
        />
      )}
      {item.noThumb ? (
        // Queued but thumbnail not generated yet — soft skeleton shimmer so the
        // photo appears in the grid as "loading" (not a broken-image icon).
        // Becomes a real tile the moment its worker thumbnail lands.
        <SkeletonTile />
      ) : (
        <ThumbImg
          draggable={!isPending}
          src={smallUrlObj?.url}
          alt=""
          onClick={(e) => largeUrl && onPhotoClick(e, item, largeUrl)}
          onTouchStart={(e) => largeUrl && onPhotoClick(e, item, largeUrl)}
          onDragStart={(e) => !isPending && largeUrl && onDragStart(e, item, largeUrl)}
        />
      )}
      {/* Uploading is SILENT now — no "Uploading…/Queued" badge (the tile just
          shows its preview and swaps to the server URL invisibly when done).
          Only FAILED stays loud, since the user needs to retry it. */}
      {isPending && item.pendingStatus === 'failed' && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            backgroundColor: 'rgba(229,57,53,0.9)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 600,
            borderRadius: '4px',
            padding: '2px 5px',
            zIndex: 3,
            pointerEvents: 'none',
            lineHeight: 1.2,
          }}
        >
          ⚠ Failed
        </span>
      )}
      {usageCount > 0 && (
        <span
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '20px',
            height: '20px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            zIndex: 3,
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          {usageCount}
        </span>
      )}
      {!isPending && (
        <div className="position-absolute end-0 bottom-0 pe-1 actionbutton">
          <FavoriteButton
            className="p-0 bg-transparent border-0"
            onClick={() => onToggleFavorite(item)}
          >
            {item.is_favorite ? <FaHeart size={14} /> : <FaRegHeart size={14} />}{" "}
          </FavoriteButton>
          {canDelete && (
            <DeleteButton onClick={() => onDelete(item._id)}>
              <FaTrashAlt size={14} />
            </DeleteButton>
          )}
        </div>
      )}
      {hoverPos &&
        previewUrl &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: hoverPos.left,
              top: hoverPos.top,
              width: POP_W,
              zIndex: 4000,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 10px 35px rgba(0,0,0,0.28)",
              padding: 10,
              pointerEvents: "none", // never steal the hover / flicker
            }}
          >
            <img
              src={smallUrlObj?.url || previewUrl}
              alt=""
              style={{
                width: "100%",
                maxHeight: 360,
                objectFit: "contain",
                display: "block",
                borderRadius: 6,
                background: "#f4f4f5",
              }}
            />
            {fileName && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={fileName}
              >
                {fileName}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              <span>{dimW && dimH ? `${dimW}x${dimH} px` : ""}</span>
              <span>Used {usageCount || 0}</span>
            </div>
          </div>,
          document.body
        )} 
    </PhotoWrapper>
  );
});

export const PhotoAction = () => {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const dispatch = useDispatch();
  const activeObject = useSelector(getActiveObject);
  const activeObjectprops = useSelector(getActiveObjectprops);
  const editorType = useSelector(getActiveEditorType);
  const getActivePageSize = useSelector(getCurrentActiveSize);
  const projectSetup = useSelector((state) => state.projectSetup);
  const imagesPerPage = 20;
  const [projectImages, setProjectImages] = useState(cachedProjectImages);
  // Gallery sort: field is always `_id`; order toggles asc/desc. Held ALSO in a
  // ref so getProjectImages (a stable useCallback) reads the current value
  // without taking sortOrder as a dependency — keeps the fetch + its effects
  // from being recreated on every sort change.
  const [sortOrder, setSortOrder] = useState(cachedSortOrder);
  const sortOrderRef = useRef(cachedSortOrder);
  const [allImages, setAllImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(lastVisitedPage);
  const [totalPages, setTotalPages] = useState(cachedTotalPages);
  const [isOpen, setIsOpen] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const mobileSentinelRef = useRef(null);
  const isFetchingRef = useRef(false); // Guard against duplicate API calls
  const currentPageRef = useRef(currentPage);
  const user = useSelector((state) => state.projectSetup.userDetails);
  const [loading, setLoading] = useState(false);
  const projectId = projectSetup.cartDetails._id;
  const [defaultPhotoOption, setDefaultPhotoOption] = useState(0);
  const { isFirstUpload } = useSelector((state) => state.imageUpload);
  const [isLoadingAllImages, setIsLoadingAllImages] = useState(false);
  const [showAllView, setShowAllView] = useState(false);
  let themeId;
  // const [currentPageSelectedCount, setCurrentPageSelectedCount] = useState(0);
  const batch = useSelector((state) => state.imageUpload.batch);
  const [modalShow, setModalShow] = React.useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const allPageObjects = useSelector(getAllObjects);
  const currentPageObjects = useSelector(getCurrentActivePageObjects);
  const allCurrentPageObjects = useSelector(getAllObjectsOfAllLayoutsOfCurrentPage);
  const settings = useSelector(getSettings);
  const showAiKidsPhotobookModal = useSelector(selectAiKidsPhotobookModalOpen);
  const totalUploadedImages = useSelector((state) => state.imageUpload.totalUploadedImages);

  // "Used in this project" — derived directly from canvas state so it always
  // reflects what's currently placed. The photoHistory slice was a parallel
  // sticky list that lingered after removal and missed images placed via paths
  // that didn't dispatch addPhotoToHistory (drag-drop, AI swap, etc.).
  const recentPhotos = useMemo(() => {
    if (!Array.isArray(allPageObjects)) return [];
    const byId = new Map();
    allPageObjects.forEach((obj) => {
      if (obj.type !== "img" || !obj.image_id || byId.has(obj.image_id)) return;
      const urls = Array.isArray(obj.urls) ? obj.urls : [];
      const large = urls.find((u) => u.size === "large");
      const small = urls.find((u) => u.size === "small");
      const thumb = urls.find((u) => u.size === "thumbnail");
      const resolvedUrl = large?.url || obj.url;
      const resolvedThumb = thumb?.url || small?.url || resolvedUrl;
      // Skip empty boxes / placeholder objects with no actual image source.
      if (!resolvedUrl && !resolvedThumb) return;
      byId.set(obj.image_id, {
        id: obj.image_id,
        assetId: obj.image_id,
        url: resolvedUrl,
        thumbnailUrl: resolvedThumb,
        urls,
        name: null,
        width: large?.w || 0,
        height: large?.h || 0,
      });
    });
    return Array.from(byId.values());
  }, [allPageObjects]);

  // Compute how many times each uploaded image is used across the project.
  // Indexed by image_id (primary) and by large URL (fallback for legacy/template
  // objects that have a url but no image_id set).
  const imageUsageCounts = useMemo(() => {
    const counts = {};
    if (!Array.isArray(allPageObjects)) return counts;
    allPageObjects.forEach((obj) => {
      if (obj.type !== "img") return;
      if (obj.image_id) {
        counts[obj.image_id] = (counts[obj.image_id] || 0) + 1;
      } else if (obj.url) {
        counts[obj.url] = (counts[obj.url] || 0) + 1;
      }
    });
    return counts;
  }, [allPageObjects]);

  // Resolve usage count for a projectImages item — checks by _id first, then large URL.
  const getUsageCount = useCallback((item) => {
    const byId = imageUsageCounts[item._id];
    if (byId) return byId;
    const largeUrl = item.urls?.find((u) => u.size === "large")?.url;
    return (largeUrl && imageUsageCounts[largeUrl]) || 0;
  }, [imageUsageCounts]);

  // Memoize derived values
  const canDeleteImages = useMemo(() =>
    (user?.userTypeCode === USER_TYPES.CUSTOMER && settings?.allowImageDelete === true) ||
    user?.userTypeCode !== USER_TYPES.CUSTOMER,
    [user?.userTypeCode, settings?.allowImageDelete]
  );

  const columnCount = useMemo(() => window.innerWidth > 768 ? 2 : 3, []);

  // Check if there are swappable template images
  const hasSwappableImages = useMemo(() => {
    if (!allPageObjects || !Array.isArray(allPageObjects)) return false;
    return allPageObjects.some(obj => obj.type === 'img' && obj.isTemplateSwapable === true);
  }, [allPageObjects]);

  const { emptyBoxesCount, totalFillableBoxesCount } = useMemo(() => {
    if (!allPageObjects || !Array.isArray(allPageObjects)) {
      return { emptyBoxesCount: 0, totalFillableBoxesCount: 0 };
    }
    const fillableBoxes = allPageObjects.filter(
      (obj) => obj.type === "img" && !obj.displaySameImage && !obj.isTemplateSwapable
    );
    return {
      emptyBoxesCount: fillableBoxes.filter((obj) => (obj.url ?? "") === "").length,
      totalFillableBoxesCount: fillableBoxes.length,
    };
  }, [allPageObjects]);

  const handleShow = (n) => {
    setDefaultPhotoOption(n);
    setShow(true);
  };

  const handleClick = async (selectedOption) => {
    if (selectedOption) {
      const updatedImages = await fetchAllProjectImages(selectedOption);

      // Optimistic placement: still-uploading photos participate in auto
      // flows too. Failed uploads are excluded (they may never finish);
      // option1 only feeds unused photos, mirroring the server-image filter.
      const placeablePending = pendingGalleryItems.filter((item) => {
        if (item.noThumb) return false; // no preview blob yet — nothing to place
        if (item.pendingStatus === "failed") return false;
        if (selectedOption === "option1" && getUsageCount(item) !== 0) return false;
        return true;
      });

      // Dedupe: a just-finished upload can appear both as a settled pending
      // tile and in the fresh server fetch.
      const seen = new Set();
      const merged = [...placeablePending, ...(updatedImages || allImages)].filter((item) => {
        const key = item._id || item.pendingImageId;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // auto set images
      dispatch(
        changeObjectsInAllPages({
          images: merged,
          option: selectedOption,
        })
      );

      // Placed pending images upload first so their swaps land quickly
      placeablePending.forEach((item) => {
        if (item.pendingImageId) prioritizeUpload(item.pendingImageId);
      });
    }
  }

  // ── Optimistic placement: still-uploading images as gallery tiles ──
  // (see optimistic_image_placement_plan.md)
  // Subscribe to a cheap string signature instead of the images array itself:
  // progress dispatches fire several times per second per image and would
  // re-render this whole panel; the signature only changes on status /
  // thumbnail / serverId transitions.
  const reduxStore = useStore();
  const pendingSignature = useSelector((state) =>
    (state.imageUpload.images || [])
      .map((img) => `${img.imageId}:${img.status}:${img.previewUrl ? 1 : 0}:${img.serverId || ""}`)
      .join("|")
  );

  // Server _ids already present in the backend gallery — used to dedupe a
  // just-finished upload out of the pending list the instant the backend tile
  // for it appears (seamless handoff, no duplicate frame).
  const projectImageServerIds = useMemo(
    () => new Set(projectImages.map((p) => p?._id).filter(Boolean)),
    [projectImages]
  );

  // Free preview blobs at the PROVABLY-dead point: once the backend refetch
  // includes an uploaded image's serverId, its tile renders from the server URL
  // (canvas already swapped, gallery bridge tile uses uploadUrls) so the local
  // ≤512px preview blob has no consumer left. Doing it here — not at the swap —
  // keeps the blink-sensitive swap path untouched while still preventing the
  // session-long accumulation of preview blobs.
  useEffect(() => {
    if (projectImageServerIds.size === 0) return;
    const entries = reduxStore.getState().imageUpload.images || [];
    for (const e of entries) {
      if (e.serverId && e.previewUrl && projectImageServerIds.has(e.serverId)) {
        dispatch(releasePreviewUrl({ imageId: e.imageId }));
      }
    }
  }, [projectImageServerIds, dispatch, reduxStore]);

  // serverId → local imageId, for keying. A photo keeps ONE stable React key
  // across its whole life (queued → uploading → uploaded → backend tile) so it
  // never remounts (no upload-success blink). Pending tiles key by their
  // pendingImageId; the backend tile that represents the same photo maps its
  // serverId back to that imageId here.
  const serverIdToPending = useMemo(() => {
    const m = new Map();
    (reduxStore.getState().imageUpload.images || []).forEach((e) => {
      if (e.serverId) m.set(e.serverId, e.imageId);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduxStore, pendingSignature]);

  const pendingGalleryItems = useMemo(() => {
    const entries = reduxStore.getState().imageUpload.images || [];
    const items = [];
    for (const entry of entries) {
      // Already in the backend gallery (the batch refetch landed) → let the
      // backend tile render it. Dropping it here as the backend tile appears at
      // the SAME newest-first top position with the SAME server URL = seamless
      // (no vanish-gap, no jump, no duplicate).
      if (entry.serverId && projectImageServerIds.has(entry.serverId)) continue;

      if (entry.status === "uploaded") {
        // Finished but not yet refetched into the backend list. Keep it visible
        // with its PERMANENT server URLs (no badge) so the photo never blinks
        // out between "done" and the refetch — and because it's the same URL the
        // backend tile will use, that tile mounts cache-warm = no reload flash.
        const urls =
          Array.isArray(entry.uploadUrls) && entry.uploadUrls.length
            ? entry.uploadUrls
            : entry.previewUrl
              ? [
                { size: "small", url: entry.previewUrl, w: entry.width || 0, h: entry.height || 0 },
                { size: "large", url: entry.previewUrl, w: entry.width || 0, h: entry.height || 0 },
              ]
              : [];
        if (!urls.length) continue; // nothing to show (rare: no server URL)
        if (entry.serverId) {
          // Has a server id → render it EXACTLY like the backend tile it's about
          // to become: real `_id` (serverId) so it's DELETABLE/placeable right
          // away (the old isPending tile had no delete button), and `isPending`
          // is false. `pendingImageId` is kept ONLY so galleryKeyOf gives it the
          // same stable key as while it was uploading (no remount = no blink).
          // The dedup above drops it once projectImages includes that serverId.
          items.push({
            _id: entry.serverId,
            image_id: entry.serverId,
            isPending: false,
            pendingImageId: entry.imageId,
            urls,
            is_favorite: false,
            isSelected: false,
          });
        } else {
          // No server id yet (rare) → keep a silent, non-deletable pending tile.
          items.push({
            _id: `pending_${entry.imageId}`,
            isPending: true,
            noThumb: false,
            pendingImageId: entry.imageId,
            pendingStatus: "uploaded",
            urls,
            is_favorite: false,
            isSelected: false,
          });
        }
        continue;
      }

      // queued | uploading | failed — show ALL of them immediately so every
      // selected photo appears in the grid right away. The worker thumbnail
      // (and its EXIF-corrected dims) trickle in a few at a time; until an
      // entry has one it renders as a skeleton-shimmer (noThumb) tile and
      // becomes a real preview the moment its thumbnail lands.
      const hasThumb = !!entry.previewUrl;
      const dims = { w: entry.width || 0, h: entry.height || 0 };
      items.push({
        _id: `pending_${entry.imageId}`,
        isPending: true,
        noThumb: !hasThumb,
        pendingImageId: entry.imageId,
        pendingStatus: entry.status,
        urls: hasThumb
          ? [
            { size: "small", url: entry.previewUrl, ...dims },
            { size: "large", url: entry.previewUrl, ...dims },
          ]
          : [],
        is_favorite: false,
        isSelected: false,
      });
    }
    // Selection order (first-selected first). galleryImages places these
    // relative to the backend list based on the active sort order.
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduxStore, pendingSignature, projectImageServerIds]);

  // Merge pending (still-uploading + just-uploaded-not-yet-refetched) tiles with
  // the backend list. A still-uploading image has no server record yet, so it
  // can't be interleaved into a name/date sort spread across unloaded pages —
  // so it's PINNED:
  //  • "Recently added" (newest-added first): pending belong at the TOP →
  //    prepend, reversed (last-selected first), matching optimistic-placement UX.
  //  • every other sort (oldest-added, file name, created date): pending pinned
  //    at the BOTTOM in selection order. They drop into their real sorted
  //    position after upload + the batch refetch.
  const galleryImages = useMemo(() => {
    if (pendingGalleryItems.length === 0) return projectImages;
    const s = resolveSort(sortOrder);
    const pinTop = s.field === "_id" && s.order === "desc";

    // Is the batch still ACTIVELY uploading? (anything queued or uploading —
    // not failed, not finished). The batch refetch only fires once everything
    // is terminal, so while this is true `projectImages` is still the pre-batch
    // list and none of the new uploads live in it yet.
    const stillActive = pendingGalleryItems.some(
      (p) => p.pendingStatus === "queued" || p.pendingStatus === "uploading"
    );

    if (stillActive) {
      // ── Mid-upload: keep the WHOLE pending group pinned at the most-recent
      // end in STABLE selection order. Do NOT _id-sort completed tiles here:
      // a tile would jump out of its slot the instant it finishes (init/resize
      // order ≠ selection order), which looked like tiles shuffling mid-upload
      // — a finished image briefly landing at the end of the batch. Since
      // projectImages is still the pre-batch list, pinning the batch on top is
      // already the correct order; it stays put until the batch settles.
      return pinTop
        ? [...[...pendingGalleryItems].reverse(), ...projectImages]
        : [...projectImages, ...pendingGalleryItems];
    }

    // ── Batch settled (no active uploads left). Split the leftover tiles:
    //  • completed — upload finished WITH a real serverId (bridge tiles kept
    //    visible until the batch refetch absorbs them). These have a real _id,
    //    so they're sorted INTO the backend list by _id (ONE resettle to the
    //    authoritative backend order).
    //  • pinned — failed / no-server-id tiles: no _id to sort by, so they stay
    //    pinned (retry candidates).
    //
    // Why the completed tiles must be _id-sorted (not pinned): the page-1
    // refetch returns only the newest ~20 images, so when a batch pushes the
    // total over one page, the completed uploads whose _id is OLDER than
    // page-1's newest stay as bridge tiles. Pinning them all to the top shoved
    // those older-but-finished uploads ABOVE the newer page-1 images,
    // scrambling the order until pagination absorbed them ("new uploads jump
    // to the bottom / scrolling fixes it"). Sorting by _id drops each into its
    // true position instead.
    const pinned = [];
    const completed = [];
    for (const p of pendingGalleryItems) {
      (p.isPending ? pinned : completed).push(p);
    }

    // ObjectId hex strings are fixed-length and byte-monotonic, so plain string
    // comparison reproduces MongoDB's _id sort order exactly.
    const byId = (a, b) => {
      const x = String(a?._id || "");
      const y = String(b?._id || "");
      if (x === y) return 0;
      return s.order === "asc" ? (x < y ? -1 : 1) : (x > y ? -1 : 1);
    };
    const realIdItems = completed.length
      ? [...completed, ...projectImages].sort(byId)
      : projectImages;

    return pinTop
      ? [...[...pinned].reverse(), ...realIdItems]
      : [...realIdItems, ...pinned];
  },
    [pendingGalleryItems, projectImages, sortOrder]
  );

  const unusedGalleryImages = useMemo(
    () => galleryImages.filter((item) => getUsageCount(item) === 0),
    [galleryImages, getUsageCount]
  );

  // ONE stable React key for a photo across its whole lifecycle (queued →
  // uploading → uploaded → backend tile). Pending tiles (and the uploaded bridge
  // tile) key by their local pendingImageId; the backend tile maps its serverId
  // back to that imageId. Same key end-to-end → React reconciles in place, never
  // unmount+remount → no image reload = no upload-success blink.
  const galleryKeyOf = useCallback((item) => {
    if (item.pendingImageId) return `pk_${item.pendingImageId}`;
    const pid = serverIdToPending.get(item._id);
    return pid ? `pk_${pid}` : item._id;
  }, [serverIdToPending]);

  // Keep cache in sync with state
  useEffect(() => {
    cachedProjectImages = projectImages;
  }, [projectImages]);

  useEffect(() => {
    cachedTotalPages = totalPages;
  }, [totalPages]);

  useEffect(() => {
    cachedHasMore = hasMore;
  }, [hasMore]);

  // Reset cache when batch upload changes (force refresh)
  useEffect(() => {
    // refetch images only if there is any change in batch upload.
    if (batch.length > 0) {
      // Reset cache and state
      cachedProjectImages = [];
      cachedTotalPages = 1;
      cachedHasMore = true;
      cachedScrollTop = 0;
      cachedScrollLeft = 0;
      isDataLoaded = false;
      // NOTE: do NOT setProjectImages([]) here. getProjectImages(1) REPLACES
      // the list when the fresh page-1 response arrives (see line ~712), so
      // clearing first only makes the whole gallery blink empty during the
      // refetch — and with finished uploads no longer shown as pending tiles,
      // that blink would make them briefly vanish before reappearing in
      // backend order. Keeping the old list visible until the refetch lands
      // gives a seamless transition into the backend's order.
      setTotalPages(1);
      setHasMore(true);
      setCurrentPage(1);
      getProjectImages(1);
    }
  }, [batch]);

  // Keep ref in sync with currentPage
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    setIsOpen(true);
    return () => {
      setIsOpen(false);
      lastVisitedPage = currentPageRef.current;
      // scrollTop is saved continuously via scroll listener, no need to read ref here
    };
  }, []);

  // Save scroll position to cache
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      cachedScrollTop = el.scrollTop;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  });

  // Track horizontal scroll state for mobile
  useEffect(() => {
    const mobileEl = mobileScrollContainerRef.current;
    if (!mobileEl) return;
    const handleMobileScroll = () => {
      cachedScrollLeft = mobileEl.scrollLeft;
    };
    mobileEl.addEventListener('scroll', handleMobileScroll, { passive: true });
    return () => mobileEl.removeEventListener('scroll', handleMobileScroll);
  });

  // Initial load: fetch all pages up to lastVisitedPage only if data not already loaded
  useEffect(() => {
    if (user && !isDataLoaded) {
      const targetPage = lastVisitedPage > 1 ? lastVisitedPage : 1;
      // Only fetch if we don't have cached data
      if (cachedProjectImages.length === 0) {
        setProjectImages([]);
        setCurrentPage(targetPage);
        // If emptyBoxesCount > imagesPerPage, fetch that many (rounded up to page boundary) in one call for AutoCreate
        const smartLimit = emptyBoxesCount > imagesPerPage
          ? Math.ceil(emptyBoxesCount / imagesPerPage) * imagesPerPage
          : null;
        getProjectImages(1, true, targetPage, smartLimit);
      } else {
        // Use cached data, just update state
        isDataLoaded = true;
        setCurrentPage(targetPage);
      }
    }
  }, [user]);

  // Restore scroll position after data is loaded
  // Using useLayoutEffect to apply scroll BEFORE paint to prevent blink
  useLayoutEffect(() => {
    if (!isDataLoaded || projectImages.length === 0) return;

    const hasScrollPosition = cachedScrollTop > 0 || cachedScrollLeft > 0;
    if (!hasScrollPosition) return;

    // Apply scroll synchronously before browser paint
    if (scrollContainerRef.current && cachedScrollTop > 0) {
      scrollContainerRef.current.scrollTop = cachedScrollTop;
    }
    if (mobileScrollContainerRef.current && cachedScrollLeft > 0) {
      mobileScrollContainerRef.current.scrollLeft = cachedScrollLeft;
    }
  }, [isDataLoaded, projectImages.length]);

  // Intersection Observer for infinite scroll (Desktop Vertical)
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isFetchingMore && !loading && !isRestoringScroll) {
          const nextPage = currentPageRef.current + 1;
          setCurrentPage(nextPage);
          getProjectImages(nextPage);
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
  }, [hasMore, isFetchingMore, loading]);

  // Intersection Observer for infinite scroll (Mobile Horizontal)
  useEffect(() => {
    if (!mobileSentinelRef.current) return;
    const mobileObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isFetchingMore && !loading && !isRestoringScroll) {
          const nextPage = currentPageRef.current + 1;
          setCurrentPage(nextPage);
          getProjectImages(nextPage);
        }
      },
      {
        root: mobileScrollContainerRef.current,
        rootMargin: '200px 200px 200px 200px', // Pre-fetch before scrolling to the absolute end horizontally
        threshold: 0,
      }
    );
    mobileObserver.observe(mobileSentinelRef.current);
    return () => mobileObserver.disconnect();
  }, [hasMore, isFetchingMore, loading]);

  useEffect(() => {
    // if any of the object selected , lets deselect it
    if (show) dispatch(setCurrentObjectProperties(null));
  }, [show]);

  useEffect(() => {
    // deselect active object when AutoCreate dialog opens
    if (modalShow) dispatch(setCurrentObjectProperties(null));
  }, [modalShow]);

  // open ai kids photobook modal  on mount if editor type id photo book and subtype is ai kids photobook
  useEffect(() => {
    if (editorType === EDITOR_TYPES.PHOTOBOOK && settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && !settings?.templateSwapped && user?.userTypeCode === USER_TYPES.CUSTOMER) {
      dispatch(openAiKidsPhotobookModal());
    }
  }, [editorType, settings?.subtype, settings?.templateSwapped, user?.userTypeCode]);




  const autoCreate = () => { };

  const getProjectImages = useCallback(async (pageNumber = 1, isReset = false, loadUpToPage = null, customLimit = null) => {
    // Guard: prevent duplicate concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Use isFetchingMore for page > 1 or multiple page loads, loading for first page / reset
    if (isReset || (pageNumber === 1 && !loadUpToPage)) {
      setLoading(true);
    } else if (pageNumber > 1 || loadUpToPage) {
      setIsFetchingMore(true);
    }

    const filter = { status: 1 };
    if (projectId) filter.cart_order_id = projectId;
    if (themeId) filter.theme_id = themeId;
    if (user) {
      if (!projectId) filter.user_id = user._id;
      filter.userTypeCode = user?.userTypeCode;
    }

    const skipOffset = loadUpToPage ? 0 : (pageNumber - 1) * imagesPerPage;
    const limitCount = customLimit || (imagesPerPage * (loadUpToPage || 1));

    try {
      const sortCfg = resolveSort(sortOrderRef.current);
      // Desktop: source the gallery from the local on-disk index (user photos are
      // stored locally, never uploaded). Same response shape → rest is unchanged.
      const response = localAssetsEnabled
        ? await fetchLocalGallery({
            projectId,
            skip: skipOffset,
            limit: limitCount,
            sortField: sortCfg.field,
            sortOrder: sortCfg.order,
          })
        : await apiPost(ENDPOINTS.getProjectImages, {
            filter,
            skip: skipOffset,
            limit: limitCount,
            sortField: sortCfg.field,
            sortOrder: sortCfg.order,
          });
      if (response?.items) {
        const transformedResponse = transformResponseArray(response.items);

        // Desktop reference mode: warn (once per image) about any photo whose
        // original file has gone missing so the user knows to re-add it.
        notifyMissingOriginals(transformedResponse);

        // Mark data as loaded
        isDataLoaded = true;

        // Auto-fill single empty image slot on first upload
        const imageObjects = Array.isArray(allPageObjects)
          ? allPageObjects.filter((obj) => obj.type === "img")
          : [];
        const singleImage = imageObjects[0];
        if (
          imageObjects.length === 1 &&
          singleImage &&
          !singleImage.displaySameImage &&
          !singleImage.isTemplateSwapable &&
          ((singleImage.url ?? "") === "" || (singleImage.urls ?? []).length === 0) &&
          user?.userTypeCode === USER_TYPES.CUSTOMER
        ) {
          dispatch(
            changeObjectsInAllPages({ images: transformedResponse, option: "option2" })
          );
        }

        // Append for infinite scroll (page > 1), replace for page 1 or restore
        if (pageNumber === 1 || loadUpToPage) {
          setProjectImages(transformedResponse);
        } else {
          setProjectImages(prev => [...prev, ...transformedResponse]);
        }

        const totalCount = response.totalCount || 0;
        dispatch(setTotalUploadedImages(totalCount));
        const calculatedTotalPages = Math.ceil(totalCount / imagesPerPage);
        setTotalPages(calculatedTotalPages);

        // After a customLimit fetch, advance currentPage so infinite scroll continues correctly
        const effectivePage = customLimit
          ? Math.ceil(customLimit / imagesPerPage)
          : (loadUpToPage || pageNumber);
        if (customLimit) {
          setCurrentPage(effectivePage);
        }
        setHasMore(effectivePage < calculatedTotalPages);
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
      isFetchingRef.current = false;
    }
  }, [projectId, user, allPageObjects, dispatch]);

  // Switch sort order (asc/desc): set the ref first so the immediate refetch
  // uses it, reset pagination/cache, and reload page 1 in the new order.
  const handleSortChange = useCallback((newOrder) => {
    if (newOrder === sortOrderRef.current) return;
    sortOrderRef.current = newOrder;
    cachedSortOrder = newOrder;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, newOrder);
    } catch {
      /* localStorage unavailable — fall back to in-memory only */
    }
    setSortOrder(newOrder);
    cachedProjectImages = [];
    cachedTotalPages = 1;
    cachedHasMore = true;
    isDataLoaded = false;
    setTotalPages(1);
    setHasMore(true);
    setCurrentPage(1);
    getProjectImages(1, true);
  }, [getProjectImages]);

  const handlePhotoClick = useCallback(async (e, item, link) => {
    const urlObj = item.urls.find((urlItem) => urlItem.size === "large");

    // Probe the image via the browser to get EXIF-corrected ORIENTATION.
    // Phones shoot portrait images but store them as landscape JPEG with EXIF rotation;
    // the DB stores raw pixel w/h (landscape) while browsers render with rotation applied,
    // so naturalWidth/naturalHeight give the visually-correct aspect.
    //
    // IMPORTANT (perf): probe the SMALL variant, not "large". Downloading the
    // full-size original (up to 30MB) just to read its dimensions blocked the
    // click for seconds. The small variant is tens of KB and gives the same
    // EXIF-correct aspect (browsers apply orientation to naturalWidth/Height).
    // Full-resolution MAGNITUDE still comes from the large variant's metadata,
    // so the print-quality check (originalWidth/Height) stays accurate.
    const probeObj =
      item.urls.find((u) => u.size === "small") ||
      item.urls.find((u) => u.size === "medium") ||
      urlObj;

    let imageW = parseInt(urlObj?.w || 0);
    let imageH = parseInt(urlObj?.h || 0);
    // Pending (still-uploading) items: w/h already come EXIF-corrected from
    // the resize worker. Probing would decode the thumbnail blob and return
    // THUMB dims, corrupting originalWidth/Height — skip it.
    if (!item.isPending && probeObj?.url) {
      const natural = await getExifAwareDimensions(probeObj.url);
      if (natural && natural.w > 0 && natural.h > 0) {
        // Apply the probe's EXIF-correct orientation/aspect while keeping the
        // full-resolution magnitude from the large metadata.
        const longSide = Math.max(imageW, imageH) || Math.max(natural.w, natural.h);
        if (natural.h >= natural.w) {
          imageH = longSide;
          imageW = Math.round((longSide * natural.w) / natural.h);
        } else {
          imageW = longSide;
          imageH = Math.round((longSide * natural.h) / natural.w);
        }
      }
    }

    // Detect if user explicitly clicked an image on the canvas.
    // Canvas click sets activeObject = { id, areaType, ... } WITHOUT 'type'.
    // addObjectInPage sets activeObject = imgObj which HAS 'type: "img"'.
    // We only replace when user intentionally selected a canvas image.
    const isCanvasSelectedImage =
      activeObject &&
      activeObject.id &&
      !activeObject.type &&
      activeObjectprops?.type === "img";

    // Also replace when the selected object is an empty image frame (no photo applied yet)
    const isEmptyImageBox =
      activeObject?.id &&
      activeObjectprops?.type === "img" &&
      !activeObjectprops?.url;

    // Find the first empty image box on the current page (both sides, for layflat/photobook)
    const firstEmptyBox = allCurrentPageObjects?.find(
      (o) => o.type === "img" && !o.url && !o.isProcessing
    );

    // Calculate offset position if there's an auto-activated photo (from previous sidebar add)
    // New photo will be placed 30px right and 30px down from the active photo
    let offsetX = 30;
    let offsetY = 30;
    if (activeObject && activeObject.type === "img" && activeObject.transform) {
      offsetX = (activeObject.transform.x || 0) + 30;
      offsetY = (activeObject.transform.y || 0) + 30;
    }

    let obj = {
      id: `Photos_${uuidv4()}`,
      type: "img",
      x: offsetX,
      y: offsetY,
      rotate: 0,
      top: 0,
      left: 0,
      scaleX: 1,
      scaleY: 1,
      zoom: 1,
      width: imageW,
      height: imageH,
      opacity: 1,
      borderRadius: 0,
      url: urlObj.url,
      urls: item.urls,
      image_id: item._id,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      orientation: 0,
      adjustment: "cover",
      filter: "",
      isFlip: false,
    };

    if (item.isPending) {
      // The upload can finish between this tile rendering as "pending" and this
      // click dispatching (near-instant on desktop's local saves). If it's ALREADY
      // done, place it as a settled image with its real source — stamping a
      // pendingImageId now would leave an object whose one-shot swap already fired,
      // so it never resolves and blocks the Save/Export gate forever.
      const liveEntry = (reduxStore.getState().imageUpload.images || []).find(
        (img) => img.imageId === item.pendingImageId
      );
      if (
        liveEntry &&
        liveEntry.status === "uploaded" &&
        liveEntry.serverId &&
        Array.isArray(liveEntry.uploadUrls) &&
        liveEntry.uploadUrls.length
      ) {
        const lg =
          liveEntry.uploadUrls.find((u) => u.size === "large") || liveEntry.uploadUrls[0];
        obj.image_id = liveEntry.serverId;
        obj.urls = liveEntry.uploadUrls;
        if (lg?.url) obj.url = lg.url;
        // no pendingImageId — it's already a real, swapped image
      } else {
        // Optimistic placement: url is the local worker thumbnail; the swap
        // reducer replaces it with the server source when the upload finishes.
        obj.image_id = null;
        obj.pendingImageId = item.pendingImageId;
      }
    }

    // If user explicitly clicked an image on canvas, or selected an empty image frame, replace it
    if ((isCanvasSelectedImage || isEmptyImageBox) && !activeObjectprops?.isProcessing) {
      const ss = { id: activeObject.id, data: obj, type: "img" };
      dispatch(changeObjectInPage(ss));
    } else if (firstEmptyBox) {
      // Auto-fill the first empty image box on the current page
      dispatch(changeObjectInPage({ id: firstEmptyBox.id, data: obj, type: "img" }));
    } else if (
      (settings.allowImage && user?.userTypeCode === USER_TYPES.CUSTOMER) ||
      user?.userTypeCode !== USER_TYPES.CUSTOMER
    ) {
      // Add new photo (auto-activates for offset positioning of next add)
      dispatch(addObjectInPage(obj));
    }

    if (item.isPending) {
      // The user wants THIS image — move it to the front of the upload
      // queue so its silent blob→URL swap happens as soon as possible.
      prioritizeUpload(item.pendingImageId);
    } else {
      dispatch(addPhotoToHistory(item));
    }
  }, [activeObject, activeObjectprops, currentPageObjects, allCurrentPageObjects, settings.allowImage, user, dispatch]);

  const handleRecentPhotoClick = useCallback((e, historyItem) => {
    const reconstructedItem = {
      _id: historyItem.assetId,
      urls: historyItem.urls || [
        { size: "large", url: historyItem.url, w: historyItem.width, h: historyItem.height },
        { size: "small", url: historyItem.thumbnailUrl || historyItem.url },
        { size: "thumbnail", url: historyItem.thumbnailUrl || historyItem.url },
      ],
      name: historyItem.name,
    };
    handlePhotoClick(e, reconstructedItem, historyItem.url);
  }, [handlePhotoClick]);

  const dragElement = useCallback((e, item, link) => {
    const urlObj = item.urls.find((urlItem) => urlItem.size === "large");
    const sUrl = item.urls.find((urlItem) => urlItem.size === "small");
    const mUrl = item.urls.find((urlItem) => urlItem.size === "medium");

    // dataTransfer.setData MUST be called synchronously in dragstart — cannot await.
    // Use raw DB dimensions here; EXIF-corrected dimensions are not available sync.
    // The placed image uses adjustment:"cover" so initial w/h only affects aspect ratio hint.
    const imageW = parseInt(urlObj?.w || 0);
    const imageH = parseInt(urlObj?.h || 0);

    let obj = {
      id: `Photos_${uuidv4()}`,
      type: "img",
      rotate: 0,
      top: 0,
      left: 0,
      scaleX: 1,
      scaleY: 1,
      zoom: 1,
      width: imageW,
      height: imageH,
      opacity: 1,
      borderRadius: 0,
      url: urlObj.url,
      urls: item.urls,
      image_id: item._id,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      orientation: 0,
      adjustment: "cover",
      filter: "",
      isFlip: false,
    };
    var j = JSON.stringify(obj);
    e.dataTransfer.setData("imgs", j);
  }, []);

  const toggleFavorite = useCallback((item) => {
    (localAssetsEnabled
      ? setLocalFavorite(projectId, item._id, !item.is_favorite)
      : apiPost(
          item.is_favorite
            ? ENDPOINTS.removeProjectImageAsFavroite
            : ENDPOINTS.addProjectImageAsFavroite,
          { _id: item._id }
        ))
      .then((response) => {
        if (response?.status === 1) {
          setProjectImages(prev =>
            prev.map((img) =>
              img._id === item._id ? { ...img, is_favorite: !img.is_favorite } : img
            )
          );
        }
      })
      .catch((error) => {
      });
  }, [projectId]);

  const deleteImage = useCallback((id) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;

    (localAssetsEnabled
      ? removeLocalAssets(projectId, [id])
      : apiPost(ENDPOINTS.deleteProjectImage, { _id: id }))
      .then((response) => {
        if (response?.status === 1) {
          setProjectImages(prev => prev.filter(img => img._id !== id));
          setSelectedPhotos(prev => prev.filter(img => img._id !== id));
          dispatch(setTotalUploadedImages(totalUploadedImages - 1));
          // Also drop any current-session upload-slice entry for this image,
          // otherwise the vanish-gap bridge re-adds it as a pending tile the
          // instant its serverId leaves projectImageServerIds — so the deleted
          // photo would never disappear from the sidebar.
          const uploadEntry = (reduxStore.getState().imageUpload.images || [])
            .find((e) => e.serverId === id);
          if (uploadEntry) dispatch(removeImage({ imageId: uploadEntry.imageId }));
        }
      })
      .catch((error) => {
      });
  }, [totalUploadedImages, dispatch, reduxStore, projectId]);

  // check photo is selected or not when call api
  function transformResponseArray(responseArray) {
    return responseArray.map((response) => {
      return {
        ...response,
        isSelected: selectedPhotos.some((photo) => photo._id === response._id), // Check global selection
      };
    });
  }

  // handle select photo
  const handleSelectPhoto = useCallback((item) => {
    setProjectImages(prev =>
      prev.map((image) =>
        image._id === item._id ? { ...image, isSelected: !image.isSelected } : image
      )
    );
    setSelectedPhotos(prev =>
      prev.some((image) => image._id === item._id)
        ? prev.filter((image) => image._id !== item._id)
        : [...prev, { ...item, isSelected: !item.isSelected }]
    );
  }, []);

  // Handle selecting all photos
  const handleAllSelect = () => {
    const allSelected = projectImages.every((image) => image.isSelected); // Check if all images are selected

    const newPhotos = projectImages.map((image) => ({
      ...image,
      isSelected: !allSelected, // Toggle selection based on current state
    }));

    setProjectImages(newPhotos);


    // Optionally update the separate `selectedPhotos` state
    if (!allSelected) {
      setSelectedPhotos((prevSelectedPhotos) => [
        ...prevSelectedPhotos,
        ...newPhotos.filter(
          (image) =>
            !prevSelectedPhotos.some((photo) => photo._id === image._id)
        ),
      ]); // Add all to selected
    } else {
      setSelectedPhotos((prevSelectedPhotos) =>
        prevSelectedPhotos.filter(
          (image) => !projectImages.some((photo) => image._id === photo._id)
        )
      ); // Clear selected photos
    }
  };

  // handle delete selecte photo of current page
  const handleDeleteSelectedPhoto = async () => {
    const isConfirm = window.confirm(
      "Are you sure you want to delete selected photos?"
    );
    if (isConfirm) {
      // The actual ids being deleted (selected photos that exist in the backend list).
      const deletedIds = selectedPhotos
        .filter((selectedPhoto) =>
          projectImages.some((photo) => selectedPhoto._id === photo._id)
        )
        .map((image) => image._id);

      setProjectImages((prevProjectImages) =>
        prevProjectImages.filter(
          (photo) =>
            !selectedPhotos.some(
              (selectedPhoto) => selectedPhoto._id === photo._id
            )
        )
      );
      setSelectedPhotos((prevSelectedPhotos) =>
        prevSelectedPhotos.filter(
          (selectedPhoto) =>
            !projectImages.some((photo) => photo._id === selectedPhoto._id)
        )
      );
      try {
        (localAssetsEnabled
          ? removeLocalAssets(projectId, [...deletedIds])
          : apiPost(ENDPOINTS.deleteMultipleProjectImages, {
              images_id: [...deletedIds],
            }))
          .then(async (response) => {
            if (response && response.status === 1) {
              // Drop any current-session upload-slice entries for the deleted
              // images. Without this the vanish-gap bridge keeps re-adding them
              // as tiles forever, because their serverId will never reappear in
              // projectImageServerIds (backend deleted them) — mirrors the
              // single-delete cleanup in deleteImage().
              const deletedIdSet = new Set(deletedIds);
              const uploadEntries = reduxStore.getState().imageUpload.images || [];
              uploadEntries.forEach((e) => {
                if (e.serverId && deletedIdSet.has(e.serverId)) {
                  dispatch(removeImage({ imageId: e.imageId }));
                }
              });
              await getProjectImages();
              setCurrentPage(1);
            }
          })
          .catch((error) => {
          });
      } catch (error) {
      }
    }
  };

  const fetchAllProjectImages = async (selectedOption) => {
    try {
      setIsLoadingAllImages(true);

      const imagesCount = totalFillableBoxesCount;

      const filter = {
        status: 1,
      };

      if (projectId) {
        filter.cart_order_id = projectId;
      }
      if (themeId) {
        filter.theme_id = themeId;
      }
      if (user) {
        if (!projectId) {
          filter.user_id = user._id;
        }
        filter.userTypeCode = user?.userTypeCode;
      }

      let updatedImages = []

      if (selectedOption === "option1") {
        // Only feed unused photos into empty slots so we never duplicate an
        // image that's already placed on the canvas.
        updatedImages = projectImages.filter((item) => getUsageCount(item) === 0);
      }
      else {
        updatedImages = [...allImages, ...projectImages];
      }
      setAllImages(updatedImages);

      if (imagesCount > projectImages.length) {
        const sortCfg = resolveSort(sortOrderRef.current);
        const response = localAssetsEnabled
          ? await fetchLocalGallery({ projectId, skip: projectImages.length, limit: imagesCount - projectImages.length, sortField: sortCfg.field, sortOrder: sortCfg.order })
          : await apiPost(ENDPOINTS.getProjectImages, { filter, skip: projectImages.length, limit: imagesCount - projectImages.length, sortField: sortCfg.field, sortOrder: sortCfg.order });
        if (response && response.status === 1 && response.items.length > 0) {
          const fetched = selectedOption === "option1"
            ? response.items.filter((item) => getUsageCount(item) === 0)
            : response.items;
          updatedImages = [...updatedImages, ...fetched];
          setAllImages(updatedImages);
        }
      }

      return updatedImages;
    } catch (error) {
      return allImages;
    } finally {
      setIsLoadingAllImages(false);
    }
  };

  // When "See all" is clicked, hide action content and show AllInView
  if (showAllView) {
    return (
      <div className="container photo-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <AllInView
            title="Used in this project"
            items={recentPhotos}
            onItemClick={(item) => handleRecentPhotoClick({ preventDefault: () => { } }, item)}
            onBack={() => setShowAllView(false)}
            objectFit="cover"
            itemBg="#f8f9fa"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="photo-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: "2px" }}>
        <DisplayBetween
          className="heading-action-mob"
          style={{
            flexShrink: 0,
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <ActionTitle>Photos</ActionTitle>
          {/* Mobile: Select All in header row */}
          <div className="d-flex d-md-none align-items-center gap-3">
            {((user?.userTypeCode === USER_TYPES.CUSTOMER &&
              settings?.allowImageDelete === true) ||
              user?.userTypeCode !== USER_TYPES.CUSTOMER) && projectImages.length > 1 && (
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    style={{ accentColor: `var(--primary)`, width: '16px', height: '16px' }}
                    onChange={handleAllSelect}
                    checked={projectImages.every((image) => image.isSelected)}
                  />
                  <span style={{ fontSize: "12px", whiteSpace: 'nowrap' }}>
                    {selectedPhotos.length > 0
                      ? `(${selectedPhotos.length}) Selected`
                      : "Select All"}
                  </span>
                  {selectedPhotos.length > 0 && (
                    <FaTrashAlt
                      size={14}
                      className="text-danger cursor-pointer"
                      onClick={handleDeleteSelectedPhoto}
                    />
                  )}
                </div>
              )}
            <LiaTimesSolid
              onClick={() => {
                dispatch(setIsActionActive(false));
                dispatch(setActiveActionIndex(null));
              }}
              className="cursor-pointer"
            />
          </div>
          {/* Desktop: Just X button */}
          <LiaTimesSolid
            onClick={() => {
              dispatch(setIsActionActive(false));
              dispatch(setActiveActionIndex(null));
            }}
            className="cursor-pointer d-none d-md-block"
          />
        </DisplayBetween>
        {/* Reference note when working on an existing theme (both customer & admin):
            tells the user how many photos the theme needs. totalFillableBoxesCount
            is the number of fillable image frames across the whole theme. */}
        {projectSetup?.themeDetails?.theme_id && totalFillableBoxesCount > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              margin: "8px 2px 2px",
              padding: "9px 11px",
              background: "var(--secondary, #eff8ff)",
              borderLeft: "3px solid var(--primary, #4084b5)",
              borderRadius: 6,
              color: "var(--foreground, #1f4f73)",
              fontSize: "12.5px",
              lineHeight: 1.4,
            }}
          >
            <FaRegImages
              size={15}
              style={{ marginTop: 1, flexShrink: 0, color: "var(--primary, #4084b5)" }}
            />
            <span>
              This theme uses{" "}
              <strong>
                {totalFillableBoxesCount} {totalFillableBoxesCount === 1 ? "photo" : "photos"}
              </strong>
              . Upload at least {totalFillableBoxesCount}{" "}
              {totalFillableBoxesCount === 1 ? "image" : "images"} to fill every frame in your design.
            </span>
          </div>
        )}
        {loading && <PageLoader className="mt-5" />}
        <div
          className="d-flex flex-column w-100"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden", /* Prevent outer scroll */
            padding: "2px"
          }}
        >
          {((galleryImages.length > 0 || (editorType === EDITOR_TYPES.PHOTOBOOK && settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER)) && (
            <div className="d-flex flex-column h-100">
              {/* ===== MOBILE HORIZONTAL SCROLL LAYOUT ===== */}
              <div className="mobile-horizontal-photos flex-shrink-0">
                {/* Top row with Autofill button */}
                {(editorType === EDITOR_TYPES.PHOTOBOOK ||
                  editorType === EDITOR_TYPES.CALENDER || editorType === EDITOR_TYPES.LAYFLATALBUM) && !(settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER) && (
                    <div
                      className="mobile-autofill-btn"
                      onClick={() => setModalShow(true)}
                    >
                      Autofill
                    </div>
                  )}

                <div className="mobile-horizontal-photos-container">
                  {/* Add Photos Button */}
                  {!(settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER) && (
                    <div
                      className="mobile-add-photo-btn"
                      onClick={() => handleShow(0)}
                    >
                      <FaPlus className="icon" />
                      <span className="text">Add<br />photos</span>
                    </div>
                  )}

                  {/* Horizontal Scrollable Photos */}
                  <div
                    className="mobile-photos-scroll-row"
                    ref={mobileScrollContainerRef}
                  >
                    {galleryImages.map((item, index) => (
                      <div
                        key={item._id || `mobile-photo-${index}`}
                        className="mobile-photo-item"
                        onClick={(e) => {
                          const largeUrl = item.urls?.find(
                            (urlItem) => urlItem.size === "large"
                          )?.url;
                          if (largeUrl) {
                            handlePhotoClick(e, item, largeUrl);
                          }
                        }}
                        draggable={!item.isPending}
                        onDragStart={(e) => {
                          if (item.isPending) return;
                          const largeUrl = item.urls?.find(
                            (urlItem) => urlItem.size === "large"
                          )?.url;
                          if (largeUrl) {
                            dragElement(e, item, largeUrl);
                          }
                        }}
                      >
                        {/* Status badge on still-uploading photos */}
                        {item.isPending && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '3px',
                              left: '3px',
                              backgroundColor: item.pendingStatus === 'failed' ? 'rgba(229,57,53,0.9)' : 'rgba(0,0,0,0.65)',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 600,
                              borderRadius: '3px',
                              padding: '1px 4px',
                              zIndex: 3,
                              pointerEvents: 'none',
                              lineHeight: 1.2,
                            }}
                          >
                            {item.pendingStatus === 'failed' ? '⚠' : item.pendingStatus === 'queued' ? 'Queued' : 'Uploading…'}
                          </span>
                        )}
                        {/* Checkbox on each photo */}
                        {!item.isPending && ((user?.userTypeCode === USER_TYPES.CUSTOMER &&
                          settings?.allowImageDelete === true) ||
                          user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
                            <input
                              type="checkbox"
                              className="mobile-photo-checkbox"
                              style={{
                                position: 'absolute',
                                top: '3px',
                                left: '3px',
                                width: '14px',
                                height: '14px',
                                accentColor: 'var(--primary)',
                                zIndex: 2,
                              }}
                              checked={item.isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectPhoto(item);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        {item.noThumb ? (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              background: '#f1f3f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <PhotoIcon width="22px" height="22px" style={{ opacity: 0.35 }} />
                          </div>
                        ) : (
                          <img
                            src={
                              item.urls?.find(
                                (urlItem) => urlItem.size === "small"
                              )?.url
                            }
                            alt={`photo-${index + 1}`}
                            draggable={false}
                          />
                        )}
                        {(() => { const c = getUsageCount(item); return c > 0 && <span className="photo-count-badge">{c}</span>; })()}
                      </div>
                    ))}

                    {/* Sentinel element for Mobile horizontal infinite scroll detection */}
                    <div ref={mobileSentinelRef} style={{ width: '1px', height: '100%', flexShrink: 0 }} />

                    {/* Horizontal loading indicator */}
                    {isFetchingMore && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', flexShrink: 0 }}>
                        <ImSpinner2
                          style={{
                            fontSize: "24px",
                            color: "var(--primary)",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* ===== DESKTOP BUTTONS (hidden on mobile) ===== */}
              <Box mt="10px" className="d-none d-md-block flex-shrink-0">
                {
                  !(settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER) && (
                    <ButtonComponent
                      onClick={() => {
                        handleShow(0);
                      }}
                      padding="8px 30px 8px 30px"
                      className="flex-grow-1"
                    >
                      <DisplayCenter>
                        <PhotoIcon width="20px" height="20px" />
                        <Box ml="10px">Add Photos</Box>
                      </DisplayCenter>
                    </ButtonComponent>
                  )}

                {(editorType === EDITOR_TYPES.PHOTOBOOK ||
                  editorType === EDITOR_TYPES.CALENDER || editorType === EDITOR_TYPES.LAYFLATALBUM) && !(settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER) && (
                    <ButtonComponent
                      onClick={async () => {
                        autoCreate();
                        setModalShow(true);
                      }}
                      padding="8px 30px 8px 30px"
                      className="mt-md-2"
                    >
                      <DisplayCenter>
                        <AutoCreateIcon width="24px" height="24px" />
                        <Box ml="10px">Auto Create</Box>
                      </DisplayCenter>
                    </ButtonComponent>
                  )}

                {(editorType === EDITOR_TYPES.PHOTOBOOK && settings?.subtype === EDITOR_SUB_TYPES.PHOTOBOOK.AI_GENERATED_FOR_KIDS && user?.userTypeCode === USER_TYPES.CUSTOMER) && hasSwappableImages && (
                  <ButtonComponent
                    onClick={() => {
                      dispatch(openAiKidsPhotobookModal());
                    }}
                    padding="8px 30px 8px 30px"
                    className="mt-md-2"
                  >
                    <DisplayCenter>
                      <AutoCreateIcon width="24px" height="24px" />
                      <Box ml="10px">Change Kid's Image</Box>
                    </DisplayCenter>
                  </ButtonComponent>
                )}
              </Box>

              <AutoCreateV2PopUp
                show={modalShow}
                onHide={() => setModalShow(false)}
                handleClick={handleClick}
                selectedPhotosCount={allImages.length}
                emptyBoxesCount={emptyBoxesCount}
                totalFillableBoxesCount={totalFillableBoxesCount}
                availableImagesCount={galleryImages.length}
                unusedImagesCount={unusedGalleryImages.length}
                onUpload={() => { setModalShow(false); handleShow(0); }}
              />

              <Modal show={isLoadingAllImages} size="md" centered>
                <Modal.Body>
                  <div className="d-flex justify-content-center align-items-center mt-4">
                    <CommonLoaderContainer text="Your Images Are Being Prepared for Automated Design" textAlign="center" color="var(--primary)">
                      <CommonLoader />
                    </CommonLoaderContainer>
                  </div>.
                </Modal.Body>
              </Modal>

              {/* Scrollable Container for Images */}
              <div
                ref={scrollContainerRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  minHeight: 0,
                  marginTop: "10px",
                  paddingRight: "4px" // Give scrollbar a bit of breathing room
                }}
                className="scroll-container-mob"
              >
                {/* Recently Used Photos Section */}
                <div className="mt-2">
                  <RecentlyUsedSection
                    title="Used in this project"
                    items={recentPhotos}
                    itemSize={55}
                    objectFit="cover"
                    itemBg="#f8f9fa"
                    onItemClick={(item) => handleRecentPhotoClick({ preventDefault: () => { } }, item)}
                    onSeeAll={() => setShowAllView(true)}
                  />
                </div>


                {/* before masonary view */}
                {/* <Box className="">
              <PhotoGrid>
                {projectImages.map((item, index) => (
                  <PhotoWrapper
                    className=""
                    key={`Photos-item-${index + 1}`}
                  >

                    <SelectCheckbox
                      className="checkbox"
                      type="checkbox"
                      onChange={() => {
                        handleSelectPhoto(item);
                      }}
                      checked={item.isSelected}
                    />
                    <AsyncImage
                      draggable={true}
                      key={`item-img-${item._id}`}
                      onClick={(e) => {
                        const largeUrl = item.urls?.find(
                          (urlItem) => urlItem.size === "large"
                        )?.url;
                        if (largeUrl) {
                          handlePhotoClick(e, item, largeUrl);
                        }
                      }}
                      onTouchStart={(e) => {
                        const largeUrl = item.urls?.find(
                          (urlItem) => urlItem.size === "large"
                        )?.url;
                        if (largeUrl) {
                          handlePhotoClick(e, item, largeUrl);
                        }
                      }}
                      onDragStart={(e) => {
                        const largeUrl = item.urls?.find(
                          (urlItem) => urlItem.size === "large"
                        )?.url;
                        if (largeUrl) {
                          dragElement(e, item, largeUrl);
                        }
                      }}
                      style={{
                        width: window.innerWidth > 768 ? "100%" : "80px",
                        height: "auto",
                        aspectRatio:
                          window.innerWidth > 768 ? 9 / 12 : 1 / 1,
                        objectFit: "contain"
                      }}
                      src={
                        item.urls?.find(
                          (urlItem) => urlItem.size === "small"
                        )?.url || ""
                      }
                      alt={`photo-${index + 1}`}
                      loader={<ImageLoader />}
                      className={`${item.isSelected ? "selected-photoItem" : ""
                        } photo-img-cover-mob photo-item`}
                    />
                    <ImageButtonContainer className="d-none d-md-flex">
                      <FavoriteButton
                        onClick={() => toggleFavorite(item)}
                      >
                        {item.is_favorite ? (
                          <FaHeart size={14} />
                        ) : (
                          <FaRegHeart size={14} />
                        )}{" "}
                      </FavoriteButton>
                      <DeleteButton onClick={() => deleteImage(item._id)}>
                        <FaTrashAlt size={14} />
                      </DeleteButton>
                    </ImageButtonContainer>
                  </PhotoWrapper>
                ))}
              </PhotoGrid>
            </Box> */}

                {/* after masonary view - DESKTOP ONLY */}
                {galleryImages.length > 0 && (
                  <Box className="mt-2 p-1 desktop-masonry-photos">
                    {!!galleryImages ? (
                      <>
                        {/* Sort control — field is always `_id`; toggles asc/desc.
                            asc = oldest first (new uploads land at the end). */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '6px',
                            marginBottom: '8px',
                            fontSize: '12px',
                            color: '#6b7280',
                          }}
                        >
                          <span>Sort</span>
                          <select
                            value={sortOrder}
                            onChange={(e) => handleSortChange(e.target.value)}
                            style={{
                              fontSize: '12px',
                              padding: '3px 6px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              background: '#fff',
                              color: '#374151',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="added_desc">Recently added</option>
                            <option value="added_asc">Earliest added</option>
                            {/* <option value="name_asc">File name (A–Z)</option> */}
                            {/* <option value="name_desc">File name (Z–A)</option>
                            <option value="created_desc">Latest created</option>
                            <option value="created_asc">Earliest created</option> */}
                          </select>
                        </div>
                        {/* Uniform fixed-cell grid (reference look). Every cell is
                            the SAME square (GALLERY_CELL_ASPECT), so a skeleton
                            becoming its photo never changes a tile's size → the
                            grid CANNOT reflow → zero vibration. Each photo is shown
                            WHOLE inside its cell (object-fit:contain) — no cropping.
                            galleryKeyOf gives each photo one stable key for its
                            whole lifecycle → no remount on upload-success/swap. */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                            gap: '12px',
                            width: '100%',
                          }}
                        >
                          {galleryImages.map((item) => (
                            <ImageItem
                              key={galleryKeyOf(item)}
                              item={item}
                              canDelete={canDeleteImages}
                              usageCount={getUsageCount(item)}
                              onSelect={handleSelectPhoto}
                              onPhotoClick={handlePhotoClick}
                              onDragStart={dragElement}
                              onToggleFavorite={toggleFavorite}
                              onDelete={deleteImage}
                            />
                          ))}
                        </div>

                        {/* Sentinel element for infinite scroll detection */}
                        <div ref={sentinelRef} style={{ height: '1px', width: '100%' }} />

                        {/* Bottom loading indicator */}
                        {isFetchingMore && (
                          <ScrollLoader />
                        )}
                      </>
                    ) : (
                      <Box mt="15px" height="100%">
                        <EmptyPhotoWrapper>
                          <img src={EmptyPhoto} alt="blank" />
                        </EmptyPhotoWrapper>
                      </Box>
                    )}
                  </Box>
                )}
              </div> {/* End Scrollable Container */}
            </div>
          )) ||
            (!loading && user && (
              <div
                className="scroll-container-mob"
                style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
              >
                <AddFistTimePhotoModal handleShow={(n) => handleShow(n)} />
              </div>
            ))}


        </div>

        {/* all select check box */}
        {((user?.userTypeCode === USER_TYPES.CUSTOMER &&
          settings?.allowImageDelete === true) ||
          user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
            <div className="bg-white z-10 w-100 px-2 pt-lg-2 pb-0 bulk-select-footer">
              <div
                className={`d-flex align-items-center gap-2 justify-content-${selectedPhotos.length > 0 ? "between" : "start"
                  }   align-items-center`}
              >
                {projectImages.length > 1 && (
                  <>
                    <input
                      type="checkbox"
                      style={{
                        accentColor: `var(--primary)`,
                      }}
                      onChange={handleAllSelect}
                      checked={projectImages.every((image) => image.isSelected)}
                    />
                  </>
                )}
                <p style={{ fontSize: "13px" }} className="mb-0">
                  {selectedPhotos.length > 0
                    ? `selected(${selectedPhotos.length})`
                    : projectImages.length > 1
                      ? "Select All"
                      : ""}
                </p>
                {selectedPhotos.length > 0 && (
                  <span
                    className="border-0 p-0 m-0 bg-transparent text-danger"
                    onClick={handleDeleteSelectedPhoto}
                  >
                    <FaTrashAlt className="m-0 p-0 h-max" size={15} />
                  </span>
                )}
              </div>
            </div>
          )}
      </div>

      <PhotoModal
        show={show}
        handleClose={handleClose}
        defaultPhotoOption={defaultPhotoOption}
      />
      <AIKidsPhotoBookModal
        show={showAiKidsPhotobookModal}
        onHide={() => {
          dispatch(closeAiKidsPhotobookModal());
        }}
      />
    </>
  );
};
