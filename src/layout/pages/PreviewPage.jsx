import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { applyTheme, setCanvasSize, setEditorType, setZoom, setCanvasScale, setSettings } from "../../store/slices/canvas";
import { setAllThemes, setEditorPages, setThemeId } from "../../store/slices/projectSetup";
import { GetThemeById, processProjectPages } from "../../library/utils/services/theme/index.js";
import { CommonLoader, CommonLoaderContainer } from "../../common-components/StyledComponents";
import { PhotobookPreview } from "../../products-preview/photobook/photoBookPreview";
import { FoldingLayoutPreview } from "../../products-preview/folding/FoldingLayoutPreview";
import { EDITOR_TYPES } from "../../library/utils/constants";
import { getActiveEditorType, getAllPages, getSettings } from "../../library/utils/helpers";
import { FontProvider } from "../../library/utils/context/FontContext";
import { DesignFontGate } from "../index.jsx";
import { convertToPixels } from "../../library/utils/common-functions/unitConversion";

export const PreviewPage = () => {
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const activeEditorType = useSelector(getActiveEditorType);
    const AllPages = useSelector(getAllPages);
    const settings = useSelector(getSettings);

    // Show "Preview" in the window/document title on the standalone preview
    // route (any editor type) instead of the default document title.
    useEffect(() => {
        const previousTitle = document.title;
        document.title = "Preview";
        return () => {
            document.title = previousTitle;
        };
    }, []);

    const themeId = searchParams.get("theme_id");
    const dimensionParam = searchParams.get("dimension"); // e.g. "12x18"
    const unitParam = searchParams.get("unit") || "in"; // default to inches
    const dpiParam = searchParams.get("dpi") || 200; // Optional custom DPI from URL

    useEffect(() => {
        const loadPreviewData = async () => {
            if (!themeId) {
                setLoading(false);
                return;
            }

            try {
                dispatch(setZoom(1));
                dispatch(setCanvasScale(1));

                let initialCanvasSize = {};
                if (dimensionParam) {
                    const [w, h] = dimensionParam.split("x");
                    if (w && h) {
                        initialCanvasSize = { width: parseFloat(w), height: parseFloat(h) };
                    }
                }

                const themeData = await GetThemeById(
                    themeId,
                    initialCanvasSize, // this helps GetThemeById fetch the right size if backend supports it
                    null, // editorType
                    null, // orientation
                );

                if (themeData && themeData.theme && themeData.theme.length > 0) {
                    dispatch(setEditorType(themeData.editor_type));
                    dispatch(setThemeId(themeId));
                    dispatch(setAllThemes(themeData.theme));

                    // Filter based on dimension and unit if provided
                    let selectedTheme = themeData.theme[0];
                    if (dimensionParam) {
                        const [targetW, targetH] = dimensionParam.split("x").map(Number);

                        if (targetW && targetH) {
                            const matchedTheme = themeData.theme.find(t => {
                                // Priorities for scaling DPI: 1. URL Param -> 2. Theme's DPI -> 3. Fallback (200)
                                const themeDpi = dpiParam ? parseInt(dpiParam, 10) : (parseInt(t.dpi, 10) || 200); 
                                const targetW_px = convertToPixels(targetW, unitParam, themeDpi);
                                const targetH_px = convertToPixels(targetH, unitParam, themeDpi);

                                const themeW = parseFloat(t.width);
                                const themeH = parseFloat(t.height);

                                // Allow a small rounding margin of error (e.g., +/- 5 pixels)
                                const margin = 5;
                                const widthMatches = Math.abs(themeW - targetW_px) <= margin;
                                const heightMatches = Math.abs(themeH - targetH_px) <= margin;
                                const isFlippedMatch = Math.abs(themeW - targetH_px) <= margin && Math.abs(themeH - targetW_px) <= margin;

                                return (widthMatches && heightMatches) || isFlippedMatch;
                            });

                            if (matchedTheme) {
                                selectedTheme = matchedTheme;
                            }
                        }
                    }

                    // set up canvas size
                    let layoutWidth = parseFloat(selectedTheme.width) || 2400;
                    let themeHeight = parseFloat(selectedTheme.height) || 1200;

                    // For layflat album we don't divide by 2, for photobook we might divide by 2 
                    // depend on the scale mechanism in useInitializeProject/useThemeSetup
                    if (themeData.editor_type === EDITOR_TYPES.PHOTOBOOK) {
                        layoutWidth /= 2;
                    }

                    dispatch(setCanvasSize({
                        width: parseFloat(selectedTheme.width) || 2400, // store actual width in state, although processProjectPages uses layoutWidth
                        height: themeHeight,
                        depth: parseFloat(selectedTheme.depth) || 0,
                        safeMargin: parseFloat(selectedTheme.safe_margin) || 0,
                        bleedMargin: parseFloat(selectedTheme.bleed_margin) || 0,
                        dpi: parseInt(selectedTheme.dpi, 10) || 300,
                    }));

                    const scaledPages = processProjectPages(
                        selectedTheme.pages_c,
                        layoutWidth,
                        themeHeight
                    );

                    // Mark covers if they are in the expected positions for Photobook/Layflat themes
                    if (scaledPages.length >= 2) {
                        if (themeData.editor_type === EDITOR_TYPES.PHOTOBOOK || themeData.editor_type === EDITOR_TYPES.LAYFLATALBUM) {
                            // Ensure first and last pages are flagged as covers for correct rendering in previews
                            scaledPages[0].isCoverPage = true;
                            scaledPages[scaledPages.length - 1].isCoverPage = true;
                            
                            // For Layflat albums, covers are typically half-sheet in the foldable preview
                            if (themeData.editor_type === EDITOR_TYPES.LAYFLATALBUM) {
                                scaledPages[0].settings = { ...(scaledPages[0].settings || {}), isHalfSheet: true };
                                scaledPages[scaledPages.length - 1].settings = { ...(scaledPages[scaledPages.length - 1].settings || {}), isHalfSheet: true };
                            }
                        }
                    }

                    dispatch(setEditorPages(scaledPages));
                    
                    // Fire setSettings BEFORE applyTheme so that if setSettings injects blank covers (standard reducer behavior), 
                    // the subsequent applyTheme will overwrite them with the actual theme content.
                    dispatch(setSettings(selectedTheme.settings || {}));
                    dispatch(applyTheme(scaledPages));
                    
                    // Allow Redux dispatches and canvas cleanup to propagate before rendering turnkey plugins
                    setTimeout(() => {
                        setIsReady(true);
                    }, 500);
                }
            } catch (err) {
            } finally {
                setLoading(false);
            }
        };
        loadPreviewData();
    }, [themeId, dimensionParam, unitParam, dpiParam, dispatch]);

    if (loading) {
        return (
            <CommonLoaderContainer className="position-absolute w-100 h-100">
                <CommonLoader />
            </CommonLoaderContainer>
        );
    }

    if (!themeId || !AllPages || AllPages.length === 0) {
        return (
            <div className="d-flex align-items-center justify-content-center h-100 w-100 position-absolute">
                <h3>Preview not available</h3>
            </div>
        );
    }

    return (
        <FontProvider>
            <DesignFontGate />
            <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
                {isReady && activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                    <PhotobookPreview show={true} handleClose={() => {}} />
                )}
                {isReady && settings?.isFoldable === true && activeEditorType !== EDITOR_TYPES.PHOTOBOOK && (
                    <FoldingLayoutPreview show={true} handleClose={() => {}} />
                )}
                {/* Fallback component for unsupported types or just leave empty? The user mentioned photobook & layflat only */}
            </div>
        </FontProvider>
    );
};
