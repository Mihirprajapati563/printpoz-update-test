import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { EDITOR_TYPES } from "../library/utils/constants/index.js";
import {
  Box,
  CanvasBox,
  CanvasWrapper,
  CommonLoader,
  CommonLoaderContainer,
  ContentWrapper,
  MainContentWrapper,
} from "../common-components/StyledComponents.jsx";
import { SideBar } from "./Sidebar";
import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { TopActions } from "./TopActions";
import { BottmActions } from "./BottomActions";
import MainCanvas from "../components/canvas/Canvas";
import useInitializeProject from "../library/utils/custom-hooks/useInitializeProject";
import {
  getActiveEditorType,
  getAllPagesLength,
  getAllPages,
  getActiveObjectprops,
  getActiveObjects,
  getAllObjectsSortedByZIndex,
} from "../library/utils/helpers";
import useThemeSetup from "../library/utils/custom-hooks/useThemeSetup";
import useEditorSnapshot from "../library/utils/custom-hooks/useEditorSnapshot";
import useExitPrompt from "../library/utils/custom-hooks/useExitPrompt";
import usePendingPlacedImages from "../library/utils/custom-hooks/usePendingPlacedImages";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { selectFaceSwapProgress } from "../store/slices/aiKidsPhotobookSlice";
import FaceSwapProgressBar from "../components/popups/ai-kids-photobook/FaceSwapProgressBar";
import UploadProgressToast from "../components/popups/UploadProgressToast";
import UpdateBanner from "../components/UpdateBanner";
import { FontProvider, useFontContext } from "../library/utils/context/FontContext";
import { patchTextFontIds } from "../store/slices/canvas";
import { decompressFromBase64, compressData } from "../library/utils/common-functions/index.js";
import { resetImageLoadState } from "../library/utils/image/progressiveImage";
import { setAllThemes } from "../store/slices/projectSetup";
import TextFloatingToolbar from "../tools/text/TextFloatingToolbar";
import TextToolbarDialogPanel from "../tools/text/TextToolbarDialogPanel";
import ImageFloatingToolbar from "../tools/image/ImageFloatingToolbar";
import ImageToolbarDialogPanel from "../tools/image/ImageToolbarDialogPanel";
import MultiImageFloatingToolbar from "../tools/image/MultiImageFloatingToolbar";
import MultiImageToolbarDialogPanel from "../tools/image/MultiImageToolbarDialogPanel";
import StickerFloatingToolbar from "../tools/sticker/StickerFloatingToolbar";
import StickerToolbarDialogPanel from "../tools/sticker/StickerToolbarDialogPanel";
import ShapeFloatingToolbar from "../tools/shape/ShapeFloatingToolbar";
import ShapeToolbarDialogPanel from "../tools/shape/ShapeToolbarDialogPanel";
import QRCodeFloatingToolbar from "../tools/qrcode/QRCodeFloatingToolbar";
import QRCodeToolbarDialogPanel from "../tools/qrcode/QRCodeToolbarDialogPanel";
import SmartTextCustomerDialog from "../components/dialogs/SmartTextCustomerDialog";
import AccessDenied from "../common-components/AccessDenied";
import SessionExpiredModal from "../components/popups/SessionExpiredModal";
import { onSessionExpired, clearSessionExpiredCallback } from "../library/utils/common-services/apiCall";

/**
 * Patch fontId / styleId into every text object across ALL theme sizes
 * stored in projectSetup.allThemes[].pages_c AND allThemes[].pages.
 * Runs once after loadDesignFonts resolves, keeping all sizes in sync
 * so that switching sizes doesn't lose font identifiers.
 *
 * Both fields are updated:
 *   - pages_c  → compressed (gzip + base64) page data
 *   - pages    → uncompressed JSON string of page data
 */
function patchFontIdsInAllThemes(fontList, allThemes, dispatch) {
  if (!fontList || fontList.length === 0 || !allThemes || allThemes.length === 0) return;

  // Build lookup: fontName → { fontId, styles[] }
  const lookup = new Map();
  fontList.forEach((font) => {
    if (font.name) lookup.set(font.name, font);
  });

  // Helper: patch font IDs on a pages array (mutates in place), returns true if anything changed
  const patchPages = (pages) => {
    let changed = false;
    pages.forEach((page) => {
      if (!page.layout) return;
      page.layout.forEach((layout) => {
        if (!layout) return; // skip null layout entries
        const arrays = [layout.objects, layout.safeAreaObjects].filter(Boolean);
        arrays.forEach((arr) => {
          arr.forEach((obj) => {
            if (obj.type !== "text" || !obj.font?.family) return;
            if (obj.font.id && obj.font.fontId && obj.font.styleId) return;

            const font = lookup.get(obj.font.family);
            if (!font) return;

            if (!obj.font.id) { obj.font.id = font.fontId; changed = true; }
            if (!obj.font.fontId) { obj.font.fontId = font.fontId; changed = true; }

            if (!obj.font.styleId) {
              const weight = parseInt(obj.font.weight, 10) || 400;
              const style = obj.font.style || "normal";
              const matchedStyle = font.styles?.find(
                (s) => s.weight === weight && s.style === style
              ) || font.styles?.find(
                (s) => s.weight === weight
              ) || (font.styles?.length > 0 ? font.styles[0] : null);

              if (matchedStyle?.styleId) {
                obj.font.styleId = matchedStyle.styleId;
                changed = true;
              }
            }
          });
        });
      });
    });
    return changed;
  };

  let anyChanged = false;
  const updatedThemes = allThemes.map((theme) => {
    // We need at least one of pages_c or pages to patch
    if (!theme.pages_c && !theme.pages) return theme;

    const updatedFields = {};

    // --- Patch pages_c (compressed) ---
    if (theme.pages_c) {
      try {
        const decompressed = decompressFromBase64(theme.pages_c);
        if (decompressed?.pages && Array.isArray(decompressed.pages)) {
          if (patchPages(decompressed.pages)) {
            const jsonStr = JSON.stringify(decompressed);
            updatedFields.pages_c = compressData(jsonStr);
            updatedFields.pages = jsonStr; // keep both in sync
          }
        }
      } catch (_) {
        // Skip themes that fail to decompress
      }
    }

    // --- Patch pages (uncompressed JSON string) if not already handled above ---
    if (!updatedFields.pages && theme.pages) {
      try {
        const parsed = typeof theme.pages === "string" ? JSON.parse(theme.pages) : theme.pages;
        if (parsed?.pages && Array.isArray(parsed.pages)) {
          if (patchPages(parsed.pages)) {
            const jsonStr = JSON.stringify(parsed);
            updatedFields.pages = jsonStr;
            // Also update pages_c to stay in sync
            updatedFields.pages_c = compressData(jsonStr);
          }
        }
      } catch (_) {
        // Skip themes with invalid pages JSON
      }
    }

    if (Object.keys(updatedFields).length === 0) return theme;

    anyChanged = true;
    return { ...theme, ...updatedFields };
  });

  if (anyChanged) {
    dispatch(setAllThemes(updatedThemes));
  }
}

/**
 * DesignFontGate — triggers loadDesignFonts when pages land in Redux.
 * Must be rendered inside FontProvider so it can access useFontContext.
 * Shows a subtle overlay while design fonts are loading.
 *
 * NOTE: We do NOT depend on isThemeApplied (local hook state) because
 * it can be set to true BEFORE pages are dispatched to Redux.
 * Instead we simply watch for pages.length > 0 in Redux.
 */
export const DesignFontGate = () => {
  const { loadDesignFonts, resetDesignFonts, isDesignFontsLoading, isDesignFontsReady } = useFontContext();
  const pages = useSelector(getAllPages);
  const allThemes = useSelector((state) => state.projectSetup.allThemes);
  const dispatch = useDispatch();
  const lastFingerprintRef = useRef(null);
  const lastThemeCountRef = useRef(0);
  const isLoadingRef = useRef(false);
  // Always-fresh handle to allThemes for the async font-load callback below.
  // `loadDesignFonts` is async; by the time it resolves, a size switch may have
  // dispatched a NEW allThemes (the per-size design sync in SizeSettingsPopup).
  // Patching the STALE closure `allThemes` and dispatching setAllThemes would
  // REVERT that sync — silently discarding the just-edited size's design and any
  // size added mid-load. Read the latest value via this ref instead of the
  // closure so the font patch merges into current state rather than clobbering it.
  const allThemesRef = useRef(allThemes);
  allThemesRef.current = allThemes;

  useEffect(() => {
    if (!pages || pages.length === 0) return;
    if (isLoadingRef.current) return;

    // Check that at least one page has a non-empty layout (not the initial skeleton with layout: [])
    const hasLayouts = pages.some(
      (page) => page.layout && page.layout.length > 0
    );
    if (!hasLayouts) return;

    // Generate fingerprint from page IDs to detect theme changes
    const fingerprint = pages.map((p) => p.id).join(",");
    const themeCount = allThemes?.length || 0;

    // If pages changed (theme switch), reset and re-trigger
    if (lastFingerprintRef.current !== null && lastFingerprintRef.current !== fingerprint) {
      resetDesignFonts();
    }

    // If allThemes arrived after initial load, re-trigger to pick up fonts from other sizes
    const themesChanged = themeCount > 0 && lastThemeCountRef.current === 0 && isDesignFontsReady;
    if (themesChanged) {
      resetDesignFonts();
    }

    // Skip if same pages already loaded and no new themes
    if (isDesignFontsReady && lastFingerprintRef.current === fingerprint && !themesChanged) return;

    lastFingerprintRef.current = fingerprint;
    lastThemeCountRef.current = themeCount;
    isLoadingRef.current = true;

    // Decompress pages from ALL other theme sizes so their fonts are also loaded
    const extraPages = [];
    if (allThemes && allThemes.length > 0) {
      for (const theme of allThemes) {
        if (!theme.pages_c) continue;
        try {
          const decompressed = decompressFromBase64(theme.pages_c);
          if (decompressed?.pages && Array.isArray(decompressed.pages)) {
            extraPages.push(...decompressed.pages);
          }
        } catch (_) {
          // Skip sizes that fail to decompress
        }
      }
    }

    loadDesignFonts(pages, extraPages).then((fetchedFonts) => {
      isLoadingRef.current = false;
      // Patch font IDs back into Redux text objects for legacy fonts
      if (fetchedFonts && fetchedFonts.length > 0) {
        dispatch(patchTextFontIds(fetchedFonts));
        // Also patch fontId/styleId into allThemes pages_c so size-switching preserves them.
        // Use the ref (latest allThemes) — NOT the stale effect closure — so a size
        // switch that ran while this font load was in flight is not reverted.
        patchFontIdsInAllThemes(fetchedFonts, allThemesRef.current, dispatch);
      }
    }).catch(() => {
      isLoadingRef.current = false;
    });
  }, [pages, allThemes, loadDesignFonts, resetDesignFonts, isDesignFontsReady, dispatch]);

  if (!isDesignFontsLoading) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 13,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <CommonLoader style={{ width: 16, height: 16 }} />
    </div>
  );
};

/**
 * FontGatedLayout — renders inside FontProvider so it can access useFontContext.
 * Shows a loading overlay on the canvas area while design fonts are loading.
 * Header, sidebar, and other UI render normally; only the canvas is gated.
 */
const FontGatedLayout = ({ isActive, displayPreview, faceSwapProgress }) => {
  const { isDesignFontsLoading, isDesignFontsReady } = useFontContext();

  // Reset image load-tracking when the editor unmounts (project close /
  // navigate away) so a fresh project doesn't inherit the previous session's
  // "already loaded" set. The live URLs in Redux are untouched.
  useEffect(() => {
    return () => resetImageLoadState();
  }, []);

  const pages = useSelector(getAllPages);
  const activeObjectProps = useSelector(getActiveObjectprops);
  const activeObjects = useSelector(getActiveObjects);
  const allPageObjects = useSelector(getAllObjectsSortedByZIndex);

  // Check if a text object is currently selected
  const isTextSelected = activeObjectProps && activeObjectProps.type === "text";

  // Check if an image object is currently selected
  const isImageSelected = activeObjectProps && activeObjectProps.type === "img";

  // Check if a sticker is currently selected
  const isStickerSelected = activeObjectProps && activeObjectProps.type === "sticker";

  // Check if a shape is currently selected
  const isShapeSelected = activeObjectProps && activeObjectProps.type === "shape";

  // Check if a QR code is currently selected
  const isQrCodeSelected = activeObjectProps && activeObjectProps.type === "qrcode";

  // Multi-image selection: 2+ objects selected, all of type "img"
  const isMultiImageSelected = (() => {
    if (!activeObjects || activeObjects.length < 2) return false;
    const resolved = activeObjects
      .map(({ id }) => allPageObjects.find((o) => o.id === id))
      .filter(Boolean);
    if (resolved.length < 2) return false;
    return resolved.every((o) => o.type === "img");
  })();
  const multiImageCount = isMultiImageSelected ? activeObjects.length : 0;

  // Check if pages have any text objects that need fonts
  const hasTextObjects = pages?.some((page) =>
    page.layout?.some((layout) => {
      if (!layout) return false;
      return [...(layout.objects || []), ...(layout.safeAreaObjects || [])].some(
        (obj) => obj.type === "text" && obj.font?.family
      );
    })
  );

  // Block canvas if:
  // 1. Fonts are actively loading, OR
  // 2. Pages have text objects but fonts aren't ready yet
  const shouldBlockCanvas = isDesignFontsLoading || (hasTextObjects && !isDesignFontsReady);

  return (
    <>
      <Header />
      <MainContentWrapper>
        <SideBar />
        <ContentWrapper className={!isActive ? "extended" : ""}>
          <CanvasWrapper
            className={`d-flex flex-column flex-fill centerArea ${displayPreview ? "centerArea--footer-open" : ""
              } ${isActive ? "centerArea--panel-open" : ""}`}
          >
            <Box
              className="editor-toolbar-slot"
              style={{
                width: "100%",
                minHeight: "60px",
                height: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // marginBottom: "10px",
              }}
            >
              {isMultiImageSelected ? (
                <MultiImageFloatingToolbar count={multiImageCount} />
              ) : isTextSelected ? (
                <TextFloatingToolbar />
              ) : isImageSelected ? (
                <ImageFloatingToolbar />
              ) : isStickerSelected ? (
                <StickerFloatingToolbar />
              ) : isShapeSelected ? (
                <ShapeFloatingToolbar />
              ) : isQrCodeSelected ? (
                <QRCodeFloatingToolbar />
              ) : (
                <TopActions />
              )}
            </Box>
            {shouldBlockCanvas ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <CommonLoader />
              </div>
            ) : (
              <MainCanvas isToolPanelOpen={isActive} />
            )}
          </CanvasWrapper>
          <Box>
            <BottmActions />
            <div style={{ display: displayPreview ? 'block' : 'none' }}>
              <Footer styleclass={isActive ? "extended" : ""} />
            </div>
            {/* using the above code since the old code was making the canvas blink! */}
            {/* {displayPreview && (
              <Footer styleclass={isActive ? "extended" : ""} />
            )} */}
          </Box>
        </ContentWrapper>
      </MainContentWrapper>
      <TextToolbarDialogPanel />
      <ImageToolbarDialogPanel />
      <MultiImageToolbarDialogPanel />
      <StickerToolbarDialogPanel />
      <ShapeToolbarDialogPanel />
      <QRCodeToolbarDialogPanel />
      <SmartTextCustomerDialog />
      <ToastContainer />
      <UploadProgressToast />
      <UpdateBanner />
      {faceSwapProgress.showProgressBar && <FaceSwapProgressBar />}
    </>
  );
};

export const MainLayout = () => {
  const [tabHeight, setTabHeight] = useState("calc(100vh - 342px)");
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const project = useInitializeProject();
  const theme = useThemeSetup();
  // Local crash/offline resume: snapshots the live editor state to localStorage
  // at intervals (+ on close), and — when entered with restore=1 — rehydrates
  // that state directly into redux so the user continues exactly where they
  // left off without any server fetch.
  useEditorSnapshot();
  const isPreviewActive = useSelector(
    (state) => state.appSlice.isDisplayPreview
  );
  const [displayPreview, setDisplayPreview] = useState(false);
  const activeEditorType = useSelector(getActiveEditorType);
  const allPagesLength = useSelector(getAllPagesLength);
  const faceSwapProgress = useSelector(selectFaceSwapProgress);

  // Enable exit prompt to warn users before leaving the editor
  // useExitPrompt(true, "You might have some unsaved changes. Are you sure you want to leave?");

  // Optimistic placement: placed images still uploading reference local
  // blob URLs that die on reload — warn before leaving until they settle.
  const { pendingCount: pendingPlacedCount, failedCount: failedPlacedCount } =
    usePendingPlacedImages();
  useExitPrompt(
    pendingPlacedCount + failedPlacedCount > 0,
    "Some placed photos are still uploading. If you leave now they will be lost from your design."
  );

  // Listen for session expiry (401) — show re-login modal for all users
  useEffect(() => {
    onSessionExpired(() => {
      setShowSessionExpired(true);
    });
    return () => clearSessionExpiredCallback();
  }, []);

  // DEV-ONLY: manual trigger to preview the Session Expired modal without a real
  // 401. Exposes window.__showSessionExpired() and a Ctrl+Alt+E shortcut. Guarded
  // to development so it never ships. Remove once the flow is verified.
  // useEffect(() => {
  //   if (process.env.NODE_ENV !== "development") return;
  //   window.__showSessionExpired = () => setShowSessionExpired(true);
  //   const onKey = (e) => {
  //     if (e.ctrlKey && e.altKey && (e.key === "e" || e.key === "E")) {
  //       setShowSessionExpired(true);
  //     }
  //   };
  //   window.addEventListener("keydown", onKey);
  //   return () => {
  //     window.removeEventListener("keydown", onKey);
  //     delete window.__showSessionExpired;
  //   };
  // }, []);

  useEffect(() => {
    const updateHeight = () => {
      const scrollBarHeight =
        window.innerHeight - document.documentElement.clientHeight;
      setTabHeight(`calc(100vh - ${scrollBarHeight}px - 342px)`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    // NOTE: we intentionally do NOT clear userDetails/brandDetails on unload.
    // Doing so wiped the login session every time the editor closed/reloaded, so
    // a logged-in user was bounced back to the Login page on the next app open.
    // The session must persist; logout (when added) is the only thing that should
    // clear it.

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);
  useEffect(() => {
    if (allPagesLength > 1) {
      setDisplayPreview(true);
    } else {
      setDisplayPreview(false);
    }
    if (isPreviewActive) {
      setDisplayPreview(true);
    } else {
      setDisplayPreview(false);
    }
  }, [activeEditorType, allPagesLength, isPreviewActive]);

  useEffect(() => {
    if (project.isInitialized) {
      setIsInitialized(true);
    } else {
      setIsInitialized(false);
    }
  }, [project.isInitialized]);

  // Auto-show session expired modal when token is invalid on initial load
  useEffect(() => {
    if (project.error) {
      const authErrors = ["invalid token", "failed to load user", "unauthorized"];
      const isAuthError = authErrors.some((msg) =>
        project.error.toLowerCase().includes(msg)
      );
      if (isAuthError) {
        setShowSessionExpired(true);
      }
    }
  }, [project.error]);

  const isActive = useSelector((state) => state.appSlice.isActionActive);

  if (project.error) {
    return (
      <>
        <AccessDenied error={project.error} />
        {showSessionExpired && (
          <SessionExpiredModal />
        )}
      </>
    );
  }

  if (!isInitialized) {
    return (
      <CommonLoaderContainer className="position-absolute w-100  h-100">
        <CommonLoader />
      </CommonLoaderContainer>
    );
  }

  return (
    <FontProvider>
      <DesignFontGate />
      <FontGatedLayout
        isActive={isActive}
        displayPreview={displayPreview}
        faceSwapProgress={faceSwapProgress}
      />
      {showSessionExpired && (
        <SessionExpiredModal
          onLoginSuccess={() => setShowSessionExpired(false)}
        />
      )}
    </FontProvider>
  );
};
