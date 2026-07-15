// ── Projects list (Themes tab → "Projects" sub-tab) ──────────────────────────
// Lists the user's own saved designs (the "Your Designs" library from
// savedDesigns.js — the same designs shown on the start screen) and applies one
// as a LAYOUT onto the current design.
//
// Apply behaviour (per product decision):
//   • Replace ALL pages with the chosen design's pages, rescaled to the CURRENT
//     canvas size (geometry + font sizes, mirroring a size conversion).
//   • Do NOT blank the layout's images by default — if the current canvas is
//     empty the applied design keeps its own photos.
//   • If the current canvas ALREADY has placed images, carry them over: blank
//     the incoming layout and refill its empty boxes with the current images
//     (same `changeObjectsInAllPages({ option:"option1" })` path PhotosAction /
//     the customer theme-switch use).
//
// Fully LOCAL: designs come from savedDesigns.js (AppData on desktop, IndexedDB
// on web); apply dispatches straight to the canvas — no network, and it does
// NOT route through the setEditorPages/useThemeSetup pipeline (that is gated on
// cartDetails and re-fetches masks).

import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaRegTrashAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog.jsx";
import {
  listSavedDesigns,
  getDesignById,
  removeSavedDesign,
} from "../../library/utils/helpers/savedDesigns.js";
import { markDesignAbandoned } from "../../library/utils/helpers/designSession.js";
import {
  blankImageUrls,
  collectPlacedImages,
} from "../../library/utils/helpers/blankImages.js";
import {
  getCanvasSize,
  getActiveEditorType,
  getSettings,
} from "../../library/utils/helpers/index.js";
import {
  setCurrentObjectProperties,
  setCalendarSettings,
  replaceSettings,
  applyTheme,
  setPageNumber,
  deSelectSafeArea,
  changeObjectsInAllPages,
  recordThemeBaseline,
} from "../../store/slices/canvas.js";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import { decompressFromBase64 } from "../../library/utils/common-functions/index.js";
import { scaleSourcePagesToTarget } from "../../library/utils/common-functions/scaleDesignPages.js";
import { EDITOR_TYPES } from "../../library/utils/constants/index.js";
import BlankImagePlaceholder from "../../assets/images/blankImagePlaceholder.png";

// Saved-design pages_c decompresses to a BARE pages array (savedDesigns.js
// stores `compressData(JSON.stringify(pages))`), whereas theme-sourced pages_c
// is wrapped as `{ pages: [...] }`. Normalise both to the array.
const decodePages = (pages_c) => {
  const decoded = decompressFromBase64(pages_c);
  return Array.isArray(decoded) ? decoded : decoded?.pages;
};

// Project/brand-scope flags that must survive an apply (user permissions /
// upload limits) — not design-controlled. Same list ThemesAction preserves.
const PRESERVED_SETTINGS_KEYS = [
  "allowImageDelete",
  "maxImageUploadLimit",
  "applyMaximumImageUploadLimit",
  "allowBackgroundRemover",
];

export const ProjectsList = () => {
  const dispatch = useDispatch();
  const canvasSize = useSelector(getCanvasSize);
  const activeEditorType = useSelector(getActiveEditorType);
  const currentSettings = useSelector(getSettings);
  const currentCanvasPages = useSelector((state) => state.canvas.present.pages);

  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
    showCancel: true,
    confirmText: "Yes",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listSavedDesigns();
    setDesigns(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Only designs of the CURRENT product type can be applied onto this canvas.
  const applicable = designs.filter((d) => d.editorType === activeEditorType);

  const applyDesign = async (meta) => {
    try {
      const entry = await getDesignById(meta.id);
      if (!entry?.pages_c) {
        toast.error("This design could not be loaded.");
        return;
      }

      const decodedPages = decodePages(entry.pages_c);
      if (!Array.isArray(decodedPages) || decodedPages.length === 0) {
        toast.error("This design could not be applied.");
        return;
      }

      // Resize the saved design's pages from ITS OWN saved size to the current
      // canvas size using the SAME scaler as the Manage-Size convert flow, so
      // text (font.size × min(scaleX,scaleY)) and images resize identically.
      const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
      const srcWidth = Number(entry.canvasSize?.width) || canvasSize.width;
      const srcHeight = Number(entry.canvasSize?.height) || canvasSize.height;
      const adjSrcWidth = isPhotobook ? srcWidth / 2 : srcWidth;
      const adjTargetWidth = isPhotobook ? canvasSize.width / 2 : canvasSize.width;
      const finalPages = scaleSourcePagesToTarget(
        decodedPages,
        adjSrcWidth,
        srcHeight,
        adjTargetWidth,
        canvasSize.height
      );

      // Images the user has already placed on the current canvas — carried into
      // the applied layout when present.
      const existingImages = collectPlacedImages(currentCanvasPages) || [];

      dispatch(setCalendarSettings(null));
      if (entry.calendarSettings) {
        const cal = { ...entry.calendarSettings };
        if (cal.startMonth) cal.startMonth = null;
        if (cal.startYear) cal.startYear = null;
        dispatch(setCalendarSettings(cal));
      }

      // Full-replace settings (carry over the permission flags).
      const nextSettings = entry.settings || {};
      const preserved = {};
      PRESERVED_SETTINGS_KEYS.forEach((key) => {
        if (currentSettings?.[key] !== undefined && nextSettings[key] === undefined) {
          preserved[key] = currentSettings[key];
        }
      });
      dispatch(replaceSettings({ ...preserved, ...nextSettings }));

      // Defer so the (possibly changed) canvasSize commits first — same 600ms
      // cushion ThemesAction.setupTheme uses for the canvas-size debounce.
      setTimeout(() => {
        dispatch(setCurrentObjectProperties(null));
        if (existingImages.length > 0) {
          // Transplant the current canvas's photos into the new layout.
          dispatch(applyTheme(blankImageUrls(finalPages)));
          dispatch(changeObjectsInAllPages({ images: existingImages, option: "option1" }));
        } else {
          // No images to carry — keep the design's own photos as saved.
          dispatch(applyTheme(finalPages));
        }
        dispatch(deSelectSafeArea());
        dispatch(setPageNumber(0));
        dispatch(UndoActionCreators.clearHistory());
        dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));
        toast.success(`"${meta.name}" applied.`);
      }, 600);
    } catch (e) {
      toast.error(
        e?.message
          ? `Could not apply the design: ${e.message}`
          : "Could not apply the design."
      );
    }
  };

  const handleApplyClick = (meta) => {
    setConfirmDialog({
      show: true,
      title: "Use this design",
      message: `Apply "${meta.name}" as a layout? This replaces all pages of your current design${
        collectPlacedImages(currentCanvasPages)?.length > 0
          ? " and moves your current photos into it."
          : "."
      }`,
      showCancel: true,
      confirmText: "Apply",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, show: false }));
        applyDesign(meta);
      },
    });
  };

  const handleDeleteClick = (meta) => {
    setConfirmDialog({
      show: true,
      title: "Delete design",
      message: `Remove "${meta.name}" from your saved designs? This cannot be undone.`,
      showCancel: true,
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, show: false }));
        const ok = await removeSavedDesign(meta.id);
        if (ok) {
          // Stop the live auto-save from resurrecting this entry. If it is the
          // design currently open in the editor, the next save mints a fresh
          // local id and continues as a NEW design instead of re-adding this one.
          markDesignAbandoned(meta.id);
          refresh();
        } else {
          toast.error("Could not delete the design.");
        }
      },
    });
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString();
    } catch (_) {
      return "";
    }
  };

  return (
    <div
      className="scroll-container-mob"
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        minHeight: 0,
        paddingBottom: "20px",
        padding: "3px",
      }}
    >
      {loading ? (
        <p className="text-muted text-center mt-4" style={{ fontSize: "13px" }}>
          Loading your designs…
        </p>
      ) : applicable.length === 0 ? (
        <p className="text-muted text-center mt-4 px-3" style={{ fontSize: "13px" }}>
          No saved designs for this product yet. Designs you work on are saved
          automatically and will appear here to reuse as layouts.
        </p>
      ) : (
        <div className="row g-2 mt-1 mx-0">
          {applicable.map((meta) => (
            <div className="col-6 mb-3 d-flex" key={meta.id}>
              <div
                className="w-100"
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                  background: "#fff",
                }}
                title={`Apply "${meta.name}"`}
                onClick={() => handleApplyClick(meta)}
              >
                <img
                  src={meta.thumbnail || BlankImagePlaceholder}
                  alt={meta.name}
                  loading="lazy"
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "contain",
                    background: "#f7f7f7",
                    display: "block",
                  }}
                />
                <div className="px-2 py-1">
                  <div
                    className="fw-semibold text-truncate"
                    style={{ fontSize: "12px" }}
                    title={meta.name}
                  >
                    {meta.name || "Untitled design"}
                  </div>
                  <div
                    className="text-muted text-truncate"
                    style={{ fontSize: "10px" }}
                  >
                    {[meta.size, formatDate(meta.updatedAt)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete design ${meta.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(meta);
                  }}
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    border: "none",
                    borderRadius: "50%",
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.9)",
                    color: "#c0392b",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                >
                  <FaRegTrashAlt size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationDialog
        show={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
        showCancelButton={confirmDialog.showCancel}
        confirmText={confirmDialog.confirmText}
      />
    </div>
  );
};
