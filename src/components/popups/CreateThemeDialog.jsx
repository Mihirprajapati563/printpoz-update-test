/**
 * CreateThemeDialog Component
 *
 * Shows when user opens the editor without a theme ID.
 * Allows user to set up a new theme with name and size.
 *
 * Features:
 * - Theme name input
 * - Canvas size settings (width, height, depth)
 * - Save Theme button to create and save the theme
 * - Maybe Later button to close and continue without saving
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Button, Form, Spinner, Row, Col, OverlayTrigger, Tooltip } from "react-bootstrap";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { store } from "../../store/store.jsx";
import {
    getActiveEditorType,
    getCanvasSize,
    getAllPages,
    getSettings,
    getBillablePages,
    getOrientation as getActiveOrientation,
} from "../../library/utils/helpers/index.js";
import {
    EDITOR_TYPES,
    EDITOR_ASSETS,
    EDITOR_SUB_TYPES,
    USER_TYPES,
} from "../../library/utils/constants/index.js";
import { setCanvasSize, setEditorType, setSettings, applyTheme, setPageNumber } from "../../store/slices/canvas.js";
import { v4 as uuidv4 } from "uuid";
import {
    setThemeId,
    setThemeName,
    setAllThemes,
    setEditorPages,
} from "../../store/slices/projectSetup.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { compressData } from "../../library/utils/common-functions/index.js";
import {
    deriveDesignId,
    saveDesignToLibrary,
    ensureActiveLocalDesignId,
} from "../../library/utils/helpers/savedDesigns.js";
import { generateDesignThumbnail } from "../../library/utils/helpers/designThumbnail.js";
import { getUrlParam } from "../../library/utils/helpers/session.js";
import { PRINT_UNITS, convertToPixels, convertPixelsToUnit, getPreferredUnit, setPreferredUnit } from "../../library/utils/common-functions/unitConversion.js";
import { AiFillInfoCircle } from "react-icons/ai";
import { recommendedSizes } from "./SizeSettingsPopup.jsx";
import { getUserDetails } from "../../library/utils/services/theme/index.js";

const StyledModal = styled(Modal)`
    .modal-dialog {
    margin: 0 auto;
    height: auto;
    max-width: 550px;
    display: flex;
    align-items: center;
    min-height: calc(100vh - 2rem);

    @media (max-width: 768px) {
        min-height: calc(100vh - 1rem);
        width: calc(100% - 1rem);
    }
   }

  .modal-content {
  border-radius: 12px;
  border: none;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

  .modal-header {
    border-bottom: 1px solid #eee;
    padding: 16px 24px;
    background: linear-gradient(
      135deg,
      var(--primary) 0%,
      color-mix(in srgb, var(--primary) 80%, #000) 100%
    );
    border-radius: 12px 12px 0 0;
    flex-shrink: 0;
  }

  .modal-title {
    font-weight: 600;
    color: white;
    font-size: 20px;
  }

    .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1 1 auto;
    }

  .modal-footer {
    border-top: 1px solid #eee;
    padding: 16px 24px;
    gap: 12px;
    justify-content: space-between;
    flex-shrink: 0;
    }

  .btn-close {
    filter: brightness(0) invert(1);
  }
`;

const FormSection = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h6`
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InfoBadge = styled.span`
  background: linear-gradient(135deg, #f2f2f2 0%, #e6e6e6 100%);
  color: var(--primary);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
`;

const SizeInputRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 576px) {
    flex-direction: column;
  }
`;

const SizeInputGroup = styled.div`
  flex: 1;
  min-width: 100px;
`;

const StyledFormControl = styled(Form.Control)`
  border-radius: 8px;
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  font-size: 15px;
  transition: all 0.2s;

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 0.2rem rgba(0, 0, 0, 0.25);
  }
`;

const StyledFormSelect = styled(Form.Select)`
  border-radius: 8px;
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  font-size: 15px;
  transition: all 0.2s;
  cursor: pointer;
  background-color: white;

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 0.2rem rgba(0, 0, 0, 0.25);
  }

  &:hover {
    border-color: #adb5bd;
  }
`;

const StyledFormLabel = styled(Form.Label)`
  font-weight: 500;
  color: #495057;
  margin-bottom: 6px;
  font-size: 13px;
`;

const PreviewBox = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  
`;

const PreviewCanvas = styled.div`
  width: 60px;
  height: 60px;
  background: white;
  border: 2px solid var(--primary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #666;
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${(props) => props.previewWidth || 40}px;
    height: ${(props) => props.previewHeight || 40}px;
    max-width: 50px;
    max-height: 50px;
    background: linear-gradient(
      135deg,
      var(--primary) 0%,
      var(--secondary) 100%
    );
    border-radius: 2px;
  }

  /* Center spine divider — photobook/layflat spreads are two pages side by side */
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: ${(props) => Math.min(props.previewHeight || 40, 50)}px;
    background: rgba(255, 255, 255, 0.85);
    z-index: 1;
    display: ${(props) => (props.isSpread ? "block" : "none")};
  }
`;

const PreviewInfo = styled.div`
  flex: 1;

  .size-text {
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }

  .orientation-text {
    color: #666;
    font-size: 12px;
    margin-top: 2px;
  }
`;

const MaybeLaterButton = styled(Button)`
  background: transparent;
  border: 1px solid #ccc;
  color: #666;
  font-weight: 500;
  border-radius: 8px;
  padding: 10px 20px;

  &:hover {
    background: #f8f9fa;
    border-color: #aaa;
    color: #333;
  }
`;

const SaveButton = styled(Button)`
  background: var(--primary);
  border: none;
  font-weight: 500;
  border-radius: 8px;
  padding: 10px 24px;

  &:hover {
    background: color-mix(in srgb, var(--primary) 85%, #000);
  }

  &:disabled {
    background: #ccc;
  }
`;

const CreateThemeDialog = ({ show, onClose, isNewTheme = false, onThemeCreated }) => {
    const dispatch = useDispatch();
    const location = useLocation();
    const user = getUserDetails()

    // Selectors
    const canvasSize = useSelector(getCanvasSize);
    const pages = useSelector(getAllPages);
    const activeEditorType = useSelector(getActiveEditorType);
    const activeOrientation = useSelector(getActiveOrientation);
    const settings = useSelector(getSettings);
    const billablePages = useSelector(getBillablePages);
    const firstPageSVG = useSelector((state) => state.svgData.firstPageSVG);

    // Local state
    const [themeName, setThemeNameLocal] = useState("");
    const [displaySize, setDisplaySize] = useState({
        width: 2400,
        height: 1600,
        depth: 0,
        safeMargin: 0,
        bleedMargin: 0,
        shape: "rectangle",
    });
    const [dpi, setDpi] = useState(200);
    const [sizeUnit, setSizeUnit] = useState(getPreferredUnit());
    const [unitInputValues, setUnitInputValues] = useState({
        width: '',
        height: '',
        safeMargin: '',
        bleedMargin: '',
        paperThickness: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedEditorType, setSelectedEditorType] = useState(activeEditorType || EDITOR_TYPES.PRINT);
    const [selectedEditorSubType, setSelectedEditorSubType] = useState(settings?.subtype || "");
    const [selectedRecommendedSize, setSelectedRecommendedSize] = useState("");
    const [fullCoverEnabled, setFullCoverEnabled] = useState(settings?.showFullCoverSheet || false);
    const [paperThickness, setPaperThickness] = useState(settings?.paperThickness || 0);

    // Initialize display size from canvas
    useEffect(() => {
        if (show && canvasSize) {
            setDisplaySize({
                width: canvasSize.width || 2400,
                height: canvasSize.height || 1600,
                depth: canvasSize.depth || 0,
                safeMargin: canvasSize.safeMargin || 0,
                bleedMargin: canvasSize.bleedMargin || 0,
                shape: canvasSize.shape || settings?.shape || "rectangle",
            });
            setDpi(canvasSize.dpi || 200);
            previousDpi.current = canvasSize.dpi || 200;
            setFullCoverEnabled(settings?.showFullCoverSheet || false);
            setPaperThickness(settings?.paperThickness || 0);
            setSizeUnit(getPreferredUnit());
        }
    }, [show, canvasSize, settings?.showFullCoverSheet, settings?.paperThickness]);

    // Tracks the last physical (non-px) values the user typed, so DPI changes can re-derive px
    const physicalSize = useRef({ width: null, height: null, safeMargin: null, bleedMargin: null, paperThickness: null });

    // Track previous DPI to calculate ratio for resizing
    const previousDpi = useRef(200);

    // Derived display values in selected unit (pixels stored internally)
    const activeDpi = parseInt(dpi, 10) || 200;
    const calculatedSpineWidthPx = Math.round(Math.ceil((billablePages || 0) / 2) * paperThickness);
    const displaySpineWidth = sizeUnit === 'px' ? calculatedSpineWidthPx : convertPixelsToUnit(calculatedSpineWidthPx, sizeUnit, activeDpi);
    const sizeUnitShort = PRINT_UNITS.find((unit) => unit.value === sizeUnit)?.short || sizeUnit;

    // Re-derive px from stored physical values when DPI changes (only in non-px unit)
    useEffect(() => {
        // Calculate the ratio of change
        const ratio = activeDpi / previousDpi.current;

        // If we have physical values stored (user was typing in non-px units), prioritize re-converting those
        const pw = physicalSize.current.width;
        const ph = physicalSize.current.height;
        const psm = physicalSize.current.safeMargin;
        const pbm = physicalSize.current.bleedMargin;
        const ppt = physicalSize.current.paperThickness;

        const hasStoredPhysicalValues =
            pw !== null ||
            ph !== null ||
            psm !== null ||
            pbm !== null ||
            ppt !== null;

        if (sizeUnit !== 'px' && hasStoredPhysicalValues) {
            setDisplaySize((prev) => ({
                ...prev,
                ...(pw !== null ? { width: convertToPixels(pw, sizeUnit, activeDpi) || prev.width } : {}),
                ...(ph !== null ? { height: convertToPixels(ph, sizeUnit, activeDpi) || prev.height } : {}),
                ...(psm !== null ? { safeMargin: convertToPixels(psm, sizeUnit, activeDpi) || prev.safeMargin } : {}),
                ...(pbm !== null ? { bleedMargin: convertToPixels(pbm, sizeUnit, activeDpi) || prev.bleedMargin } : {}),
            }));
            if (ppt !== null) {
                setPaperThickness(convertToPixels(ppt, sizeUnit, activeDpi) || 0);
            }
        } else if (ratio !== 1 && ratio > 0) {
            // Otherwise, scale the existing pixel values by the DPI ratio to maintain physical size
            setDisplaySize((prev) => ({
                ...prev,
                width: Math.round(prev.width * ratio),
                height: Math.round(prev.height * ratio),
                // Also scale depth and margins as they are physical properties
                depth: Math.round(prev.depth * ratio),
                safeMargin: Math.round(prev.safeMargin * ratio),
                bleedMargin: Math.round(prev.bleedMargin * ratio),
            }));
            setPaperThickness((prev) => Math.round(prev * ratio));
        }

        previousDpi.current = activeDpi;
    }, [activeDpi]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleInputChange = (event) => {
        const { id, value } = event.target;
        setDisplaySize((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    // Only update the local raw string while typing; px conversion happens on
    // blur (same pattern as SizeSettingsPopup) so decimals like "9." survive.
    const handleUnitSizeChange = (field, rawValue) => {
        setUnitInputValues((prev) => ({ ...prev, [field]: rawValue }));
    };

    const handleUnitSizeBlur = (field) => {
        const rawValue = unitInputValues[field];
        const numericValue = Number(rawValue);
        const pxValue = convertToPixels(numericValue, sizeUnit, activeDpi);
        const isMargin = field === 'safeMargin' || field === 'bleedMargin';
        const isThickness = field === 'paperThickness';
        const isValid =
            rawValue !== '' &&
            !Number.isNaN(numericValue) &&
            !Number.isNaN(pxValue) &&
            ((isMargin || isThickness) ? pxValue >= 0 : pxValue > 0);

        if (isValid) {
            physicalSize.current[field] = numericValue;
            if (isThickness) {
                setPaperThickness(pxValue);
            } else {
                setDisplaySize((prev) => ({ ...prev, [field]: pxValue }));
            }
        } else {
            // Invalid/empty input — restore the field from the current px value
            physicalSize.current[field] = null;
            const currentPx = isThickness ? paperThickness : displaySize[field];
            setUnitInputValues((prev) => ({
                ...prev,
                [field]: convertPixelsToUnit(currentPx || 0, sizeUnit, activeDpi)?.toString() || '',
            }));
        }
    };

    const syncUnitInputsFromPixels = useCallback(
        (nextSize, unit) => {
            if (unit === 'px') {
                setUnitInputValues({
                    width: '',
                    height: '',
                    safeMargin: '',
                    bleedMargin: '',
                    paperThickness: '',
                });
                return;
            }

            setUnitInputValues({
                width: convertPixelsToUnit(nextSize.width || 0, unit, activeDpi)?.toString() || '',
                height: convertPixelsToUnit(nextSize.height || 0, unit, activeDpi)?.toString() || '',
                safeMargin: convertPixelsToUnit(nextSize.safeMargin || 0, unit, activeDpi)?.toString() || '',
                bleedMargin: convertPixelsToUnit(nextSize.bleedMargin || 0, unit, activeDpi)?.toString() || '',
                paperThickness: convertPixelsToUnit(paperThickness || 0, unit, activeDpi)?.toString() || '',
            });
        },
        [activeDpi, paperThickness]
    );

    const handleUnitChange = (newUnit) => {
        // Reset stored physical values when switching units
        physicalSize.current = { width: null, height: null, safeMargin: null, bleedMargin: null, paperThickness: null };
        setSizeUnit(newUnit);
        setPreferredUnit(newUnit); // share the choice with every other dialog
        if (newUnit === 'px') {
            setUnitInputValues({
                width: '',
                height: '',
                safeMargin: '',
                bleedMargin: '',
                paperThickness: '',
            });
        } else {
            syncUnitInputsFromPixels(displaySize, newUnit);
        }
    };

    // Safe to re-sync on every px change now: typing only mutates the raw
    // strings (never displaySize), so this can't clobber in-progress input.
    useEffect(() => {
        if (sizeUnit === 'px') {
            return;
        }
        syncUnitInputsFromPixels(displaySize, sizeUnit);
    }, [displaySize.width, displaySize.height, displaySize.safeMargin, displaySize.bleedMargin, paperThickness, sizeUnit, syncUnitInputsFromPixels]);

    const handleEditorTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedEditorType(newType);
        setSelectedEditorSubType(""); // Reset subtype when editor type changes

        // Reset depth if not canvas type
        if (newType !== EDITOR_TYPES.CANVAS) {
            setDisplaySize(prev => ({
                ...prev,
                depth: 0
            }));
        }
    };

    const handleEditorSubTypeChange = (e) => {
        setSelectedEditorSubType(e.target.value);
    };

    const handleRecommendedSizeChange = (e) => {
        const value = e.target.value;
        setSelectedRecommendedSize(value);

        if (value) {
            const [width, height] = value.split('x').map(Number);
            setDisplaySize(prev => ({
                width: selectedEditorType === EDITOR_TYPES.CANVAS
                    ? width + (prev.depth * 2)
                    : width,
                height: selectedEditorType === EDITOR_TYPES.CANVAS
                    ? height + (prev.depth * 2)
                    : height,
                depth: prev.depth
            }));
        }
    };

    // Photobook/layflat width is the full SPREAD (two pages side by side), so
    // orientation must be judged per half page — the setCanvasSize reducer
    // applies the same rule when it stores state.orientation.
    const isSpreadProduct =
        selectedEditorType === EDITOR_TYPES.PHOTOBOOK ||
        selectedEditorType === EDITOR_TYPES.LAYFLATALBUM;

    const getOrientation = () => {
        let w = parseFloat(displaySize.width);
        const h = parseFloat(displaySize.height);
        if (isSpreadProduct) {
            w = w / 2;
        }
        if (w > h) return "Landscape";
        if (w < h) return "Portrait";
        return "Square";
    };

    const removeMaskContent = () => {
        const updatedPages = pages.map((page) => {
            const updatedLayouts = page.layout.map((layout) => {
                if (!layout) return layout; // preserve null entries as-is
                let updatedObjects = layout.objects.map((obj) => {
                    if (obj.type === "img" && obj.masking && obj.masking.path) {
                        return {
                            ...obj,
                            masking: {
                                ...obj.masking,
                                path: null,
                            },
                        };
                    }
                    return obj;
                });
                let updatedSafeAreaObjects =
                    layout?.safeAreaObjects?.length > 0
                        ? layout?.safeAreaObjects?.map((obj) => {
                            if (obj.type === "img" && obj.masking && obj.masking.path) {
                                return {
                                    ...obj,
                                    masking: {
                                        ...obj.masking,
                                        path: null,
                                    },
                                };
                            }
                            return obj;
                        })
                        : [];
                return {
                    ...layout,
                    objects: updatedObjects,
                    safeAreaObjects: updatedSafeAreaObjects,
                };
            });
            return {
                ...page,
                layout: updatedLayouts,
            };
        });
        return updatedPages;
    };

    // Canonical photobook page structure (see addNewBlankPage in canvas.js):
    // [Front Cover, insideFront, insideBack, Back Cover]. Layouts stay empty —
    // the canvas lazily creates them (same shape as the Redux initial page).
    // With full cover ON the Back Cover slot stays in data but is hidden via
    // hideLastCover, so the user sees 3 pages; otherwise all 4 are visible.
    const buildDefaultPhotobookPages = () => {
        const makePage = (pageNumber, title) => ({
            id: `pages_${uuidv4()}`,
            pageNumber,
            title,
            bgColor: "#fff",
            layout: [],
            settings: {
                onlyAllowObjectInSafeArea: false,
                isHalfSheet: false,
            },
            isPageEdited: false,
        });
        return [
            makePage(1, "Front Cover"),
            makePage(2, "page2"),
            makePage(3, "page3"),
            makePage(4, "Back Cover"),
        ];
    };

    const layoutHasContent = (layout) =>
        (layout?.objects?.length || 0) > 0 ||
        (layout?.safeAreaObjects?.length || 0) > 0 ||
        !!(layout?.background && (layout.background.color || layout.background.image || layout.background.gradient));

    const handleSaveTheme = async () => {
        // Validate inputs
        if (!themeName.trim()) {
            toast.warning("Please enter a theme name", { position: "top-center" });
            return;
        }

        if (
            displaySize.width <= 0 ||
            displaySize.height <= 0
        ) {
            toast.warning("Width and height must be greater than 0", {
                position: "top-center",
            });
            return;
        }

        setIsSaving(true);

        try {
            // Seed the canonical photobook structure when starting fresh: on a
            // new theme always, and on initial setup when no page has content
            // yet. Pages that already hold objects/backgrounds are never replaced.
            const shouldSeedPhotobookPages =
                selectedEditorType === EDITOR_TYPES.PHOTOBOOK &&
                (isNewTheme ||
                    !pages.some((page) => page?.layout?.some(layoutHasContent)));
            const seededPages = shouldSeedPhotobookPages ? buildDefaultPhotobookPages() : null;
            const effectiveBillablePages = seededPages
                ? (seededPages.length - 3) * 2
                : isNewTheme
                    ? 1
                    : billablePages;

            // First update the editor type and settings
            dispatch(setEditorType(selectedEditorType));
            const settingsPayload = { subtype: selectedEditorSubType };
            if (selectedEditorType === EDITOR_TYPES.PHOTOBOOK) {
                settingsPayload.showFullCoverSheet = fullCoverEnabled;
                // The setSettings merge branch only auto-sets hideLastCover when
                // unmerged cover pages already exist (pages.length >= 2); on a
                // fresh editor that branch is skipped, so set it explicitly.
                settingsPayload.hideLastCover = fullCoverEnabled;
                settingsPayload.paperThickness = fullCoverEnabled ? paperThickness : 0;
                settingsPayload.spineWidth = fullCoverEnabled ? Math.round(Math.ceil((effectiveBillablePages || 0) / 2) * paperThickness) : 0;
            }
            dispatch(setSettings(settingsPayload));

            // Update the canvas size
            dispatch(
                setCanvasSize({
                    width: parseFloat(displaySize.width),
                    height: parseFloat(displaySize.height),
                    depth:
                        selectedEditorType === EDITOR_TYPES.CANVAS
                            ? parseFloat(displaySize.depth) || 0
                            : 0,
                    safeMargin: parseFloat(displaySize.safeMargin) || 0,
                    bleedMargin: parseFloat(displaySize.bleedMargin) || 0,
                    dpi: activeDpi,
                    shape: (selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || selectedEditorType === EDITOR_TYPES.PRINT) ? displaySize.shape : undefined,
                })
            );

            // Ensure shape is also saved in settings for consistency
            if (selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || selectedEditorType === EDITOR_TYPES.PRINT) {
                dispatch(setSettings({ shape: displaySize.shape }));
            }

            // Prepare theme data - if isNewTheme, create empty pages, otherwise use current pages
            let themePagesData;
            let numberOfPages;
            let numberOfLayouts;
            let totalImgObjectsCount;

            if (seededPages) {
                themePagesData = seededPages;
                numberOfPages = seededPages.length;
                numberOfLayouts = 0;
                totalImgObjectsCount = 0;
            } else if (isNewTheme) {
                // Create a single empty page for new theme
                const emptyPage = {
                    layout: [{
                        width: selectedEditorType === EDITOR_TYPES.PHOTOBOOK
                            ? displaySize.width / 2
                            : displaySize.width,
                        height: displaySize.height,
                        objects: [],
                        safeAreaObjects: [],
                    }]
                };
                themePagesData = [emptyPage];
                numberOfPages = 1;
                numberOfLayouts = 1;
                totalImgObjectsCount = 0;
            } else {
                // Use existing pages for initial setup
                const without_mask_pages = removeMaskContent();
                without_mask_pages.forEach((page) => {
                    page.layout.forEach((layout, index) => {
                        if (!layout) return; // skip null layout entries
                        const updatedLayout = {
                            ...layout,
                            width:
                                selectedEditorType === EDITOR_TYPES.PHOTOBOOK
                                    ? displaySize.width / 2
                                    : displaySize.width,
                            height: displaySize.height,
                            objects: layout.objects.map((obj) => ({ ...obj })),
                        };
                        page.layout[index] = updatedLayout;
                    });
                });
                themePagesData = without_mask_pages;
                numberOfPages = pages.length;
                numberOfLayouts = 0;
                pages.forEach((page) => {
                    numberOfLayouts += page.layout.length;
                });

                totalImgObjectsCount = 0;
                pages.forEach((page) => {
                    page.layout.forEach((layout) => {
                        if (!layout) return; // skip null layout entries
                        const imgObjectsCount = layout.objects.filter(
                            (obj) => obj.type === "img"
                        ).length;
                        totalImgObjectsCount += imgObjectsCount;
                    });
                });
            }

            const pagesJsonString = JSON.stringify({ pages: themePagesData });
            const compressedBase64 = compressData(pagesJsonString);

            const theme = {
                pages_c: compressedBase64,
                pages: pagesJsonString,
                orientation: getOrientation().charAt(0), // L, P, or S
                width: parseFloat(displaySize.width),
                height: parseFloat(displaySize.height),
                size: `${displaySize.width - displaySize.depth * 2}x${displaySize.height - displaySize.depth * 2
                    }`,
                depth: parseFloat(displaySize.depth) || 0,
                safe_margin: parseFloat(displaySize.safeMargin) || 0,
                bleed_margin: parseFloat(displaySize.bleedMargin) || 0,
                dpi: activeDpi,
                images_count: totalImgObjectsCount,
                number_of_pages: numberOfPages,
                number_of_layouts: numberOfLayouts,
                cal_settings: null,
                settings: {
                    // `settings` is the useSelector value captured before the
                    // dispatches above, so it still carries the OLD hideLastCover —
                    // override every full-cover-related key explicitly.
                    ...settings,
                    subtype: selectedEditorSubType,
                    ...(selectedEditorType === EDITOR_TYPES.PHOTOBOOK ? {
                        showFullCoverSheet: fullCoverEnabled,
                        hideLastCover: fullCoverEnabled,
                        paperThickness: fullCoverEnabled ? paperThickness : 0,
                        spineWidth: fullCoverEnabled ? Math.round(Math.ceil((billablePages || 0) / 2) * paperThickness) : 0,
                    } : {}),
                },
            };

            const data = {
                status: 1,
                theme: theme,
                name: themeName.trim(),
                display_in_web: true,
                assets_type: EDITOR_ASSETS.THEME,
                editor_type: selectedEditorType,
                platform: "web",
                brand_id: null,
            };

            if (selectedEditorType === EDITOR_TYPES.PRINT) {
                data.quantity = numberOfPages > 0 ? numberOfPages : 1;
            } else {
                data.billablePages = effectiveBillablePages;
            }

            // firstPageSVG is captured from the live canvas BEFORE this dialog
            // applies the new size (Canvas.jsx re-captures ~1s after render), so
            // it's only valid when the dialog didn't change the canvas size.
            // Otherwise send a blank placeholder at the new dimensions — never
            // a preview whose size contradicts the theme's width/height.
            if (!isNewTheme) {
                const newWidth = parseFloat(displaySize.width);
                const newHeight = parseFloat(displaySize.height);
                const sizeUnchanged =
                    Number(canvasSize?.width) === newWidth &&
                    Number(canvasSize?.height) === newHeight;
                if (firstPageSVG && sizeUnchanged) {
                    data.image = firstPageSVG;
                } else {
                    data.image = {
                        pageIndex: 0,
                        svgContent: `<svg xmlns="http://www.w3.org/2000/svg" width="${newWidth}" height="${newHeight}" viewBox="0 0 ${newWidth} ${newHeight}"><rect x="0" y="0" width="${newWidth}" height="${newHeight}" fill="#ffffff"/></svg>`,
                        width: newWidth,
                        height: newHeight,
                        safeAreaImages: [],
                        fonts: [],
                        shape: displaySize.shape || "rectangle",
                    };
                }
            }

            // ── Local fallback: create the theme ON THIS DEVICE when the API is
            // unreachable (offline / server down). The theme is applied to the
            // live editor and stored in the Saved Designs library under a local
            // id, so it appears in the Design Selection "Your Designs" panel
            // immediately. The editor's auto-save keeps updating that same entry
            // (the id is shared via savedDesigns.js), and the first successful
            // "Save Theme" while online re-keys the entry to the server theme id
            // and retires the local one.
            const createThemeLocally = () => {
                dispatch(setThemeName(themeName.trim()));
                dispatch(setAllThemes([{ ...theme, isNew: true }]));

                // The online path applies pages via navigation + the theme-setup
                // hook; offline there is no t_id to load, so apply them directly.
                // (The initial-setup path keeps the pages already on the canvas.)
                if (seededPages) {
                    dispatch(applyTheme(seededPages));
                    dispatch(setPageNumber(0));
                    dispatch(setEditorPages(seededPages));
                } else if (isNewTheme) {
                    // Same single empty page the online path stores, but shaped
                    // like resetEditor's pages (id/pageNumber/title) since it goes
                    // straight onto the live canvas with no server round-trip.
                    const freshPages = [{
                        id: `pages_${uuidv4()}`,
                        pageNumber: 1,
                        title: "1",
                        bgColor: "#fff",
                        layout: [{
                            width: selectedEditorType === EDITOR_TYPES.PHOTOBOOK
                                ? displaySize.width / 2
                                : displaySize.width,
                            height: displaySize.height,
                            objects: [],
                            safeAreaObjects: [],
                        }],
                    }];
                    dispatch(applyTheme(freshPages));
                    dispatch(setPageNumber(0));
                    dispatch(setEditorPages(freshPages));
                }

                // Read the post-dispatch state (dispatch is synchronous) so the
                // library entry matches the live editor exactly.
                const c = store.getState().canvas.present;
                const app = store.getState().appSlice;
                const id = deriveDesignId({
                    localId: ensureActiveLocalDesignId(),
                    canvasSize: c.canvasSize,
                });
                if (!id) {
                    toast.error("Error creating theme. Please try again.", {
                        position: "top-center",
                    });
                    return;
                }
                let thumbnail = null;
                try {
                    thumbnail = generateDesignThumbnail({
                        pages: c.pages,
                        canvasSize: c.canvasSize,
                        editorType: c.editorType,
                        settings: c.settings,
                        calendarSettings: c.calendarSettings,
                    });
                } catch (_) {
                    thumbnail = null;
                }
                // allowEmpty: a just-created theme legitimately has no content yet.
                saveDesignToLibrary(
                    {
                        id,
                        thumbnail,
                        pages: c.pages,
                        canvasSize: c.canvasSize,
                        editorType: c.editorType,
                        orientation: c.orientation,
                        settings: c.settings,
                        calendarSettings: c.calendarSettings,
                        minPages: c.minPages,
                        maxPages: c.maxPages,
                        activeSide: c.activeSide,
                        textGroups: c.textGroups,
                        themeImagesBlanked: !!app.themeImagesBlanked,
                        themeId: null,
                        themeName: themeName.trim(),
                        cartOrderId: null,
                        cat: getUrlParam(location.search, "cat"),
                    }
                    // No allowEmpty: a just-created blank theme is NOT written to
                    // "Your Designs" until it has real content. The editor's
                    // auto-save adds the card once the user designs something,
                    // with a proper thumbnail (no blank placeholder cards).
                );
                if (user?.userTypeCode === USER_TYPES.CUSTOMER) {
                    toast.success(
                        `Design "${themeName.trim()}" created successfully!`,
                        { position: "top-center", autoClose: 2000 }
                    );
                } else {
                    toast.info(
                        `Couldn't reach the server — "${themeName.trim()}" was created on this device. You'll find it under Your Projects; it will be saved online the next time you save while connected.`,
                        { position: "top-center", autoClose: 6000 }
                    );
                }
                onClose();
            };

            if (user?.userTypeCode === USER_TYPES.CUSTOMER) {
                createThemeLocally();
                return;
            }

            // Save theme to API
            const response = await apiPost(ENDPOINTS.saveAsTheme, data);

            if (response && response.items && response.status === 1) {
                const newThemeId = response.items._id;
                if (newThemeId) {
                    dispatch(setThemeId(newThemeId));
                    dispatch(setThemeName(themeName.trim()));

                    // Update allThemes if response includes them
                    if (response.items.theme && Array.isArray(response.items.theme)) {
                        dispatch(setAllThemes(response.items.theme));
                    } else if (response.items.theme && typeof response.items.theme === 'object') {
                        dispatch(setAllThemes([{ ...response.items.theme, isNew: true }]));
                    } else {
                        dispatch(setAllThemes([{ ...theme, isNew: true }]));
                    }

                    // Apply the seeded photobook structure to the live canvas
                    // immediately — setEditorPages alone only updates
                    // projectSetup.themeDetails.pages_c for the setup hook.
                    if (seededPages) {
                        dispatch(applyTheme(seededPages));
                        dispatch(setPageNumber(0));
                        dispatch(setEditorPages(seededPages));
                    } else if (isNewTheme) {
                        // If creating new theme, reset editor to empty state
                        const emptyPages = [{
                            layout: [{
                                width: selectedEditorType === EDITOR_TYPES.PHOTOBOOK
                                    ? displaySize.width / 2
                                    : displaySize.width,
                                height: displaySize.height,
                                objects: [],
                                safeAreaObjects: [],
                            }]
                        }];
                        dispatch(setEditorPages(emptyPages));
                    }

                    toast.success(isNewTheme ? "New theme created successfully!" : "Theme created successfully!", {
                        position: "top-center",
                        autoClose: 1000,
                    });

                    // Navigate to the new theme URL without page reload
                    if (onThemeCreated) {
                        onThemeCreated(newThemeId);
                    }

                    onClose();
                }
            } else {
                // apiPost never throws — a network/offline failure comes back as
                // { error: AxiosError }. Only treat this as a real rejection when
                // the server actually judged the request (a business-rule failure
                // body or a 4xx). Unreachable/offline AND 5xx (API itself down)
                // honor the offline-first contract: create the theme locally.
                const err = response?.error;
                const serverRejected =
                    (response && !err) ||
                    (!!err?.response && err.response.status < 500);
                if (serverRejected) {
                    toast.error(
                        response?.message ||
                            err?.response?.data?.message ||
                            "Failed to create theme",
                        { position: "top-center" }
                    );
                } else {
                    createThemeLocally();
                }
            }
        } catch (error) {
            toast.error("Error creating theme. Please try again.", {
                position: "top-center",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleMaybeLater = () => {
        // Update editor type and settings
        dispatch(setEditorType(selectedEditorType));
        const maybeLaterSettings = { subtype: selectedEditorSubType };
        if (selectedEditorType === EDITOR_TYPES.PHOTOBOOK) {
            maybeLaterSettings.showFullCoverSheet = fullCoverEnabled;
            maybeLaterSettings.hideLastCover = fullCoverEnabled;
            maybeLaterSettings.paperThickness = fullCoverEnabled ? paperThickness : 0;
            maybeLaterSettings.spineWidth = fullCoverEnabled ? Math.round(Math.ceil((billablePages || 0) / 2) * paperThickness) : 0;
        }
        dispatch(setSettings(maybeLaterSettings));

        // Update the canvas size and close without saving
        dispatch(
            setCanvasSize({
                width: parseFloat(displaySize.width),
                height: parseFloat(displaySize.height),
                depth:
                    selectedEditorType === EDITOR_TYPES.CANVAS
                        ? parseFloat(displaySize.depth) || 0
                        : 0,
                safeMargin: parseFloat(displaySize.safeMargin) || 0,
                bleedMargin: parseFloat(displaySize.bleedMargin) || 0,
                dpi: activeDpi,
            })
        );
        onClose();
    };

    // Calculate preview dimensions
    const maxPreviewSize = 40;
    const ratio = Math.min(
        maxPreviewSize / displaySize.width,
        maxPreviewSize / displaySize.height
    );
    const previewWidth = displaySize.width * ratio;
    const previewHeight = displaySize.height * ratio;

    const shouldShowRecomandedSize =
        selectedEditorType !== EDITOR_TYPES.LAYFLATALBUM &&
        selectedEditorType !== EDITOR_TYPES.PHOTOBOOK;

    return (
        <StyledModal
            show={show}
            onHide={handleMaybeLater}
            centered
            backdrop="static"
            keyboard={false}
            style={{ overflowY: "auto" }}
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    {user?.userTypeCode === USER_TYPES.CUSTOMER 
                        ? "Create New Design" 
                        : (isNewTheme ? "Create New Theme" : "Set Up Your Design")}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Theme Name Section */}
                <FormSection>
                    <SectionTitle>
                        {user?.userTypeCode === USER_TYPES.CUSTOMER ? "Design Name" : "Theme Name"}
                        <InfoBadge>Required</InfoBadge>
                    </SectionTitle>
                    <StyledFormControl
                        type="text"
                        placeholder={user?.userTypeCode === USER_TYPES.CUSTOMER ? "Enter a name for your design..." : "Enter a name for your theme..."}
                        value={themeName}
                        onChange={(e) => setThemeNameLocal(e.target.value)}
                        autoFocus
                    />
                </FormSection>

                {/* Editor Type & Subtype Section */}
                <FormSection>
                    <SectionTitle>
                        Editor Configuration
                        <InfoBadge>Select Type</InfoBadge>
                    </SectionTitle>
                    <SizeInputRow>
                        <SizeInputGroup style={{ flex: 1 }}>
                            <StyledFormLabel htmlFor="editorType">Editor Type</StyledFormLabel>
                            <StyledFormSelect
                                id="editorType"
                                value={selectedEditorType}
                                onChange={handleEditorTypeChange}
                            >
                                {Object.keys(EDITOR_TYPES).map((key) => (
                                    <option key={key} value={EDITOR_TYPES[key]}>
                                        {EDITOR_TYPES[key]
                                            .replace(/_/g, ' ')
                                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                                    </option>
                                ))}
                            </StyledFormSelect>
                        </SizeInputGroup>

                        {/* Calendar Subtypes */}
                        {selectedEditorType === EDITOR_TYPES.CALENDER && (
                            <SizeInputGroup style={{ flex: 1 }}>
                                <StyledFormLabel htmlFor="editorSubType">
                                    Calendar Type
                                </StyledFormLabel>
                                <StyledFormSelect
                                    id="editorSubType"
                                    value={selectedEditorSubType}
                                    onChange={handleEditorSubTypeChange}
                                    className="w-100"
                                >
                                    <option value="">Select Calendar Type</option>
                                    {Object.keys(EDITOR_SUB_TYPES.CALENDER).map((key) => (
                                        <option key={key} value={EDITOR_SUB_TYPES.CALENDER[key]}>
                                            {EDITOR_SUB_TYPES.CALENDER[key]
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        )}

                        {/* Acrylic Subtypes */}
                        {selectedEditorType === EDITOR_TYPES.ACRYLIC && (
                            <SizeInputGroup style={{ flex: 1 }}>
                                <StyledFormLabel htmlFor="editorSubType">
                                    Acrylic Type
                                </StyledFormLabel>
                                <StyledFormSelect
                                    id="editorSubType"
                                    value={selectedEditorSubType}
                                    onChange={handleEditorSubTypeChange}
                                >
                                    <option value="">Select Acrylic Type</option>
                                    {Object.keys(EDITOR_SUB_TYPES.ACRYLIC).map((key) => (
                                        <option key={key} value={EDITOR_SUB_TYPES.ACRYLIC[key]}>
                                            {EDITOR_SUB_TYPES.ACRYLIC[key]
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        )}

                        {/* Custom Product Subtypes */}
                        {selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT && (
                            <SizeInputGroup style={{ flex: 1 }}>
                                <StyledFormLabel htmlFor="editorSubType">
                                    Product Type
                                </StyledFormLabel>
                                <StyledFormSelect
                                    id="editorSubType"
                                    value={selectedEditorSubType}
                                    onChange={handleEditorSubTypeChange}
                                >
                                    <option value="">Select Product Type</option>
                                    {Object.keys(EDITOR_SUB_TYPES.CUSTOME_PRODUCT).map((key) => (
                                        <option key={key} value={EDITOR_SUB_TYPES.CUSTOME_PRODUCT[key]}>
                                            {EDITOR_SUB_TYPES.CUSTOME_PRODUCT[key]
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        )}

                        {/* Greeting Card Subtypes */}
                        {selectedEditorType === EDITOR_TYPES.GREETING_CARD && (
                            <SizeInputGroup style={{ flex: 1 }}>
                                <StyledFormLabel htmlFor="editorSubType">
                                    Greeting Card Type
                                </StyledFormLabel>
                                <StyledFormSelect
                                    id="editorSubType"
                                    value={selectedEditorSubType}
                                    onChange={handleEditorSubTypeChange}
                                >
                                    <option value="">Select Card Type</option>
                                    {Object.keys(EDITOR_SUB_TYPES.GREETING_CARD).map((key) => (
                                        <option key={key} value={EDITOR_SUB_TYPES.GREETING_CARD[key]}>
                                            {EDITOR_SUB_TYPES.GREETING_CARD[key]
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        )}

                        {/* Photobook Subtypes */}
                        {selectedEditorType === EDITOR_TYPES.PHOTOBOOK && (
                            <SizeInputGroup style={{ flex: 1 }}>
                                <StyledFormLabel htmlFor="editorSubType">
                                    Photobook Type
                                </StyledFormLabel>
                                <StyledFormSelect
                                    id="editorSubType"
                                    value={selectedEditorSubType}
                                    onChange={handleEditorSubTypeChange}
                                >
                                    <option value="">Select Photobook Type</option>
                                    {Object.keys(EDITOR_SUB_TYPES.PHOTOBOOK).map((key) => (
                                        <option key={key} value={EDITOR_SUB_TYPES.PHOTOBOOK[key]}>
                                            {EDITOR_SUB_TYPES.PHOTOBOOK[key]
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        )}
                    </SizeInputRow>
                </FormSection>

                {/* Canvas Size Section */}
                <FormSection>
                    <SectionTitle>
                        Canvas Size
                    </SectionTitle>

                    {/* DPI + Unit row — above Width/Height */}
                    <SizeInputRow style={{ marginBottom: '12px' }}>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="dpi" className="d-flex align-items-center gap-1">
                                DPI (Dots Per Inch)
                                <OverlayTrigger
                                    placement="top"
                                    overlay={
                                        <Tooltip id="dpi-tooltip-create">
                                            <strong>Resolution:</strong> Controls how pixels map to physical size. Common values: 72 (screen/web), 96 (Windows screen), 150 (standard print), 300 (high-quality print).
                                        </Tooltip>
                                    }
                                >
                                    <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                        <AiFillInfoCircle size={14} />
                                    </span>
                                </OverlayTrigger>
                            </StyledFormLabel>
                            <StyledFormControl
                                type="number"
                                id="dpi"
                                value={dpi}
                                onChange={(e) => setDpi(e.target.value)}
                                min={1}
                                placeholder="200"
                            />
                        </SizeInputGroup>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="sizeUnit">Unit</StyledFormLabel>
                            <StyledFormSelect
                                id="sizeUnit"
                                value={sizeUnit}
                                onChange={(e) => handleUnitChange(e.target.value)}
                                aria-label="Size unit"
                            >
                                {PRINT_UNITS.map((u) => (
                                    <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                            </StyledFormSelect>
                        </SizeInputGroup>
                    </SizeInputRow>

                    <SizeInputRow>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="width">
                                {shouldShowRecomandedSize ? 'Width' : 'Spread Width'}
                            </StyledFormLabel>
                            <StyledFormControl
                                type="number"
                                id="width"
                                value={sizeUnit === 'px' ? displaySize.width : unitInputValues.width}
                                onChange={(e) => sizeUnit === 'px'
                                    ? handleInputChange(e)
                                    : handleUnitSizeChange('width', e.target.value)
                                }
                                onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('width')}
                                min={sizeUnit === 'px' ? 100 : 0.01}
                                step={sizeUnit === 'px' ? 1 : 0.001}
                            />
                        </SizeInputGroup>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="height">
                                Height
                            </StyledFormLabel>
                            <StyledFormControl
                                type="number"
                                id="height"
                                value={sizeUnit === 'px' ? displaySize.height : unitInputValues.height}
                                onChange={(e) => sizeUnit === 'px'
                                    ? handleInputChange(e)
                                    : handleUnitSizeChange('height', e.target.value)
                                }
                                onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('height')}
                                min={sizeUnit === 'px' ? 100 : 0.01}
                                step={sizeUnit === 'px' ? 1 : 0.001}
                            />
                        </SizeInputGroup>
                        {selectedEditorType === EDITOR_TYPES.CANVAS && (
                            <SizeInputGroup>
                                <StyledFormLabel htmlFor="depth">Depth</StyledFormLabel>
                                <StyledFormControl
                                    type="number"
                                    id="depth"
                                    value={displaySize.depth}
                                    onChange={handleInputChange}
                                    min={0}
                                />
                            </SizeInputGroup>
                        )}
                    </SizeInputRow>

                    {/* Margin Settings Row — unit-aware like width/height */}
                    <SizeInputRow style={{ marginTop: '12px' }}>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="safeMargin" className="d-flex align-items-center gap-1">
                                Trim Margin
                                <OverlayTrigger
                                    placement="top"
                                    overlay={
                                        <Tooltip id="trim-margin-tooltip-create">
                                            <strong>Safe Zone:</strong> Everything inside this margin will be visible in print. Keep text, logos, and key details here so they aren't trimmed off.
                                        </Tooltip>
                                    }
                                >
                                    <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                        <AiFillInfoCircle size={14} />
                                    </span>
                                </OverlayTrigger>
                            </StyledFormLabel>
                            <StyledFormControl
                                type="number"
                                id="safeMargin"
                                value={sizeUnit === 'px' ? displaySize.safeMargin : unitInputValues.safeMargin}
                                onChange={(e) => sizeUnit === 'px'
                                    ? handleInputChange(e)
                                    : handleUnitSizeChange('safeMargin', e.target.value)
                                }
                                onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('safeMargin')}
                                min={0}
                                step={sizeUnit === 'px' ? 1 : 0.001}
                                placeholder="0"
                            />
                        </SizeInputGroup>
                        <SizeInputGroup>
                            <StyledFormLabel htmlFor="bleedMargin" className="d-flex align-items-center gap-1">
                                Bleed Margin
                                <OverlayTrigger
                                    placement="top"
                                    overlay={
                                        <Tooltip id="bleed-margin-tooltip-create">
                                            <strong>Bleed Area:</strong> Extend backgrounds or photos into this bleed area. It will be cut away, preventing thin white lines at the edges.
                                        </Tooltip>
                                    }
                                >
                                    <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                        <AiFillInfoCircle size={14} />
                                    </span>
                                </OverlayTrigger>
                            </StyledFormLabel>
                            <StyledFormControl
                                type="number"
                                id="bleedMargin"
                                value={sizeUnit === 'px' ? displaySize.bleedMargin : unitInputValues.bleedMargin}
                                onChange={(e) => sizeUnit === 'px'
                                    ? handleInputChange(e)
                                    : handleUnitSizeChange('bleedMargin', e.target.value)
                                }
                                onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('bleedMargin')}
                                min={0}
                                step={sizeUnit === 'px' ? 1 : 0.001}
                                placeholder="0"
                            />
                        </SizeInputGroup>
                    </SizeInputRow>

                    {/* Shape Row (Only for Custom Product / Print) */}
                    {(selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || selectedEditorType === EDITOR_TYPES.PRINT) && (
                        <SizeInputRow style={{ marginTop: '12px' }}>
                            <SizeInputGroup>
                                <StyledFormLabel htmlFor="shape">Shape</StyledFormLabel>
                                <StyledFormSelect
                                    id="shape"
                                    value={displaySize.shape || "rectangle"}
                                    onChange={handleInputChange}
                                >
                                    <option value="rectangle">Rectangle</option>
                                    <option value="circle">Circle</option>
                                </StyledFormSelect>
                            </SizeInputGroup>
                        </SizeInputRow>
                    )}

                    {/* Full Cover & Spine Settings (Photobook only) */}
                    {selectedEditorType === EDITOR_TYPES.PHOTOBOOK && (
                        <>
                            <SizeInputRow style={{ marginTop: '12px' }}>
                                <SizeInputGroup style={{ flex: 1 }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <Form.Check
                                            type="switch"
                                            id="fullCoverSwitch"
                                            label="Full Cover"
                                            checked={fullCoverEnabled}
                                            onChange={(e) => setFullCoverEnabled(e.target.checked)}
                                        />
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id="full-cover-tooltip-create">
                                                    <strong>Full Cover:</strong> Cover spans across front and back as a single spread. Enables spine support.
                                                </Tooltip>
                                            }
                                        >
                                            <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                                <AiFillInfoCircle size={14} />
                                            </span>
                                        </OverlayTrigger>
                                    </div>
                                </SizeInputGroup>
                            </SizeInputRow>
                            {fullCoverEnabled && (
                                <SizeInputRow style={{ marginTop: '12px' }}>
                                    <SizeInputGroup>
                                        <StyledFormLabel htmlFor="paperThickness" className="d-flex align-items-center gap-1">
                                            Paper Thickness ({sizeUnitShort}/sheet)
                                            <OverlayTrigger
                                                placement="top"
                                                overlay={
                                                    <Tooltip id="paper-thickness-tooltip-create">
                                                        <strong>Paper Thickness:</strong> Thickness of each paper sheet in the currently selected unit. The spine width is auto-calculated as sheet count × paper thickness.
                                                    </Tooltip>
                                                }
                                            >
                                                <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                                    <AiFillInfoCircle size={14} />
                                                </span>
                                            </OverlayTrigger>
                                        </StyledFormLabel>
                                        <StyledFormControl
                                            type="number"
                                            id="paperThickness"
                                            value={sizeUnit === 'px' ? paperThickness : unitInputValues.paperThickness}
                                            onChange={(e) => sizeUnit === 'px'
                                                ? setPaperThickness(parseFloat(e.target.value) || 0)
                                                : handleUnitSizeChange('paperThickness', e.target.value)
                                            }
                                            onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('paperThickness')}
                                            min={0}
                                            step={sizeUnit === 'px' ? 0.1 : 0.001}
                                            placeholder="e.g. 0.5"
                                        />
                                    </SizeInputGroup>
                                    <SizeInputGroup>
                                        <StyledFormLabel>
                                            Spine Width ({sizeUnitShort}, auto)
                                        </StyledFormLabel>
                                        <StyledFormControl
                                            type="text"
                                            value={displaySpineWidth}
                                            readOnly
                                            disabled
                                            style={{ backgroundColor: '#f5f5f5' }}
                                        />
                                    </SizeInputGroup>
                                </SizeInputRow>
                            )}
                        </>
                    )}

                    {/* Preview */}
                    <PreviewBox>
                        <PreviewCanvas previewWidth={previewWidth} previewHeight={previewHeight} isSpread={isSpreadProduct} />
                        <PreviewInfo>
                            <div className="size-text">
                                {displaySize.width} × {displaySize.height} px
                                {isSpreadProduct && ` (${Math.round(parseFloat(displaySize.width) / 2) || 0} × ${displaySize.height} per page)`}
                            </div>
                            <div className="orientation-text">
                                {getOrientation()}{isSpreadProduct ? " pages" : ""}
                            </div>
                        </PreviewInfo>
                    </PreviewBox>
                </FormSection>

                {/* Recommended Sizes dropdown */}
                {shouldShowRecomandedSize && (
                    <FormSection>
                        <SectionTitle>
                            Recommended Sizes
                            <InfoBadge>Select Size</InfoBadge>
                        </SectionTitle>
                        <SizeInputRow>
                            <SizeInputGroup style={{ flex: 1 }} >
                                <StyledFormLabel htmlFor="recommendedSize">Size</StyledFormLabel>
                                <StyledFormSelect
                                    id="recommendedSize"
                                    value={selectedRecommendedSize}
                                    onChange={handleRecommendedSizeChange}
                                >
                                    <option value="">Custom Size</option>
                                    {recommendedSizes.map((size, index) => (
                                        <option key={index} value={`${size.width}x${size.height}`}>
                                            {size.label} - {size.width} × {size.height} px
                                        </option>
                                    ))}
                                </StyledFormSelect>
                            </SizeInputGroup>
                        </SizeInputRow>
                    </FormSection>
                )}

                {/* Info Section */}
                <FormSection>
                    <div
                        style={{
                            background: "#f2f2f2",
                            borderRadius: "8px",
                            padding: "12px",
                            display: "flex",
                            gap: "10px",
                            alignItems: "flex-start",
                        }}
                    >
                        <AiFillInfoCircle
                            size={18}
                            style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }}
                        />
                        <div style={{ fontSize: "13px", color: "#555" }}>
                            {user?.userTypeCode === USER_TYPES.CUSTOMER
                                ? "Start with a blank canvas. This will create a new blank design with the selected configuration and size."
                                : (isNewTheme
                                    ? "Start with a blank canvas. This will create a new empty theme where you can build your design from scratch."
                                    : "Create a theme to save your design and easily reuse it later. You can add more sizes after the initial setup.")
                            }
                        </div>
                    </div>
                </FormSection>
            </Modal.Body>
            <Modal.Footer>
                <MaybeLaterButton onClick={handleMaybeLater} disabled={isSaving}>
                    {user?.userTypeCode === USER_TYPES.CUSTOMER || isNewTheme ? "Cancel" : "Maybe Later"}
                </MaybeLaterButton>
                <SaveButton onClick={handleSaveTheme} disabled={isSaving}>
                    {isSaving ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Creating...
                        </>
                    ) : (
                        user?.userTypeCode === USER_TYPES.CUSTOMER
                            ? "Create New Design"
                            : (isNewTheme ? "Create New Theme" : "Create Theme")
                    )}
                </SaveButton>
            </Modal.Footer>
        </StyledModal>
    );
};

export default CreateThemeDialog;
