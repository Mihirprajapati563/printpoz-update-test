import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import styled, { css } from "styled-components";
import {
  getActiveObjectprops,
  getCanvasSize,
} from "../../library/utils/helpers";
import {
  getTextGradientHistory,
  getTextSolidColorHistory,
  getGlobalGradientHistory,
  getGlobalSolidColorHistory,
} from "../../library/utils/helpers/canvasSliceGetters";
import {
  setCurrentObjectProperties,
  addTextGradientToHistory,
  addTextSolidColorToHistory,
  addToGlobalGradientHistory,
  addToGlobalSolidColorHistory,
} from "../../store/slices/canvas";
import { setTextToolbarDialog, setSmartTextSelection } from "../../store/slices/appAlice";
import { useFontContext } from "../../library/utils/context/FontContext";
import CustomFontAccordion from "./CustomFontAccordion";
import PositionSettingsPanel from "../object-settings/position/PositionSettingsPanel";
import ColorPickerWithOpacity from "../../components/popups/ColorPickerWithOpacity";
import {
  Fontfamilies,
  fontSizes,
  TempBackgroudColors,
} from "../../library/utils/jsons/commonJSON";
import {
  ActionInnerTitle,
  BackgroundColorItemSmall,
  FlexBox,
  TextAlignButton,
  Box,
} from "../../common-components/StyledComponents";
import TextGroupPanel from "./TextGroupPanel";
import { getUserDetails } from "../../library/utils/services/theme";
import { USER_TYPES } from "../../library/utils/constants";
import { ReactComponent as LeftAlignIcon } from "../../assets/icons/left_align_icon.svg";
import { ReactComponent as RightAlignIcon } from "../../assets/icons/right_align_icon.svg";
import { ReactComponent as CenterAlignIcon } from "../../assets/icons/center_align_icon.svg";
import { ReactComponent as JustifyAlignIcon } from "../../assets/icons/justify_align_icon.svg";
import { ReactComponent as TopAlignIcon } from "../../assets/icons/text_valign_top.svg";
import { ReactComponent as BottomAlignIcon } from "../../assets/icons/text_valign_bottom.svg";
import { ReactComponent as MiddleAlignIcon } from "../../assets/icons/text_valign_center.svg";
import { IoClose } from "react-icons/io5";
import { FaUnderline, FaStrikethrough, FaBold, FaItalic } from "react-icons/fa";
import {
  toggleTextDecoration,
  toggleTextTransform,
  hasDecoration,
  getTextEditableElement,
  INLINE_FORMAT_REGEX,
  getFontVariantLabel,
  isBoldDisabled,
  isBoldVariantActive,
  findRegularVariant,
  findBoldVariant,
  isItalicDisabled,
  isItalicVariantActive,
  findNonItalicVariant,
  findItalicVariant,
  isInlineBoldActive,
  isInlineUppercaseActive,
  toggleInlineUppercase,
} from "../../library/utils/textStyleUtils";

// ─── Floating Panel Styled Components ────────────────────────────────

const PanelOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
`;

const LegacyTextarea = styled.textarea`
  width: 100%;
  min-height: 140px;
  padding: 12px;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.4;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--primary, #7b61ff);
    box-shadow: 0 0 0 3px rgba(123, 97, 255, 0.12);
  }
`;

const PanelContainer = styled.div`
  position: fixed;
  z-index: 1051;
  width: 320px;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 576px) {
    width: min(360px, calc(100vw - 32px));
    min-width: 240px;
    height: auto;
    max-height: 60vh;
    border-radius: 18px 18px 14px 14px;
    box-shadow: 0 20px 40px rgba(13, 18, 22, 0.28);
  }

  ${(p) =>
    p.$isMobile &&
    css`
      width: min(360px, calc(100vw - 32px));
      min-width: 240px;
      height: auto;
      max-height: 60vh;
    `}
`;

const DragGrip = styled.div`
  display: flex;
  justify-content: center;
  padding: 6px 0 2px;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  .grip-dots {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: #ccc;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #0d1216;
    pointer-events: none;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  color: #222;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #111;
  }
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
`;

const PanelBody = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
  }

  @media (max-width: 576px) {
    padding: 16px 16px 20px;
  }
`;

// ─── Spacing Controls ────────────────────────────────────────────────

const SpacingSliderContainer = styled.div`
  margin-bottom: 16px;
`;

const SpacingSliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #495057;
  font-weight: 500;
`;

const SpacingSliderInput = styled.input`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e9ecef;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--primary, #4a90d9);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: var(--primary, #4a90d9);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
`;

const SpacingValueInput = styled.input`
  width: 55px;
  padding: 4px 8px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--primary, #4a90d9);
  }
`;

// ─── Main Component ──────────────────────────────────────────────────

const baseReferenceWidth = 500;
const MOBILE_BREAKPOINT = 576;

const DIALOG_TITLES = {
  font: "Font",
  alignment: "Text Alignment",
  position: "Position",
  colors: "Colors",
  spacing: "Spacing",
  linked: "Smart Text",
  legacyEdit: "Edit Text",
};

function TextToolbarDialogPanel() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const canvasSize = useSelector(getCanvasSize);
  const activeDialog = useSelector((state) => state.appSlice.textToolbarDialog);
  const savedSmartTextSelection = useSelector((state) => state.appSlice.smartTextSelection);
  const textGradientHistory = useSelector(getTextGradientHistory);
  const textSolidColorHistory = useSelector(getTextSolidColorHistory);
  const globalGradientHistory = useSelector(getGlobalGradientHistory);
  const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);

  const lastTextColorRef = useRef(null);
  const lastTextGradientRef = useRef(null);
  const lastBGColorRef = useRef(null);
  const lastBGGradientRef = useRef(null);
  const user = getUserDetails();
  const userType = user?.userTypeCode || USER_TYPES.CUSTOMER;
  const isAdmin = userType !== USER_TYPES.CUSTOMER;

  // ─── Drag state with per-dialog position memory ───────────────
  const DEFAULT_POS = { x: 100, y: 70 };
  const savedPositionsRef = useRef({});
  const [panelPos, setPanelPos] = useState(DEFAULT_POS);
  const panelPosRef = useRef(DEFAULT_POS);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const prevDialogRef = useRef(null);
  const panelRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);
  const [legacyTextValue, setLegacyTextValue] = useState("");

  useEffect(() => {
    panelPosRef.current = panelPos;
  }, [panelPos]);

  useEffect(() => {
    if (activeDialog !== "linked" && savedSmartTextSelection) {
      dispatch(setSmartTextSelection(null));
    }
  }, [activeDialog, savedSmartTextSelection, dispatch]);

  // Clamp position so panel stays within viewport
  const clampPos = useCallback((pos) => {
    const pw = panelRef.current?.offsetWidth || 300;
    const ph = panelRef.current?.offsetHeight || 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(pos.x, vw - pw)),
      y: Math.max(0, Math.min(pos.y, vh - ph)),
    };
  }, []);

  const computeMobileDefaultPos = useCallback(() => {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const panelWidth = panelRef.current?.offsetWidth || Math.min(vw - 32, 360);
    const estimatedHeight = panelRef.current?.offsetHeight || Math.min(vh * 0.6, 420);
    const x = Math.max(10, (vw - panelWidth) / 2);
    const y = 12;
    return { x, y };
  }, [panelRef]);

  // Restore saved position when dialog changes, save position when leaving
  useEffect(() => {
    if (prevDialogRef.current && prevDialogRef.current !== activeDialog) {
      savedPositionsRef.current[prevDialogRef.current] = { ...panelPosRef.current };
    }
    if (activeDialog && prevDialogRef.current !== activeDialog) {
      const saved = savedPositionsRef.current[activeDialog];
      const defaultPos = isMobile ? computeMobileDefaultPos() : { ...DEFAULT_POS };
      setPanelPos(clampPos(saved || defaultPos));
    }
    prevDialogRef.current = activeDialog;
  }, [activeDialog, clampPos, computeMobileDefaultPos, isMobile]);

  // Clamp position on window resize so dialog never goes off-screen
  useEffect(() => {
    const handleResize = () => {
      setPanelPos((prev) => clampPos(prev));
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPos]);

  const startDragging = useCallback((clientX, clientY, inputType) => {
    dragRef.current = {
      dragging: true,
      offsetX: clientX - panelPosRef.current.x,
      offsetY: clientY - panelPosRef.current.y,
      inputType,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragRef.current.dragging) return;
      const isTouch = dragRef.current.inputType === "touch";
      const point = isTouch ? event.touches?.[0] : event;
      if (!point) return;
      event.preventDefault();
      const rawX = point.clientX - dragRef.current.offsetX;
      const rawY = point.clientY - dragRef.current.offsetY;
      setPanelPos(clampPos({ x: rawX, y: rawY }));
    },
    [clampPos]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current.dragging) return;
    const isTouch = dragRef.current.inputType === "touch";
    dragRef.current.dragging = false;
    if (isTouch) {
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    } else {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
    }
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event) => {
      const target = event.target;
      if (target?.closest("[data-no-drag='true']")) {
        return;
      }

      if (event.type === "touchstart") {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        startDragging(touch.clientX, touch.clientY, "touch");
        document.addEventListener("touchmove", handlePointerMove, { passive: false });
        document.addEventListener("touchend", handlePointerUp);
        document.addEventListener("touchcancel", handlePointerUp);
        return;
      }

      if (event.button !== 0) return;
      event.preventDefault();
      startDragging(event.clientX, event.clientY, "mouse");
      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("mouseup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, startDragging]
  );

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const { resolveFont, isFontLoaded, loadFont } = useFontContext();

  // Font state
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(35);
  const [fwList, setFwList] = useState([]);
  const [fontStyle, setFontStyle] = useState("400");
  const [applyToAll, setApplyToAll] = useState(false);
  const [textId, setTextId] = useState("");

  // Color state
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [displayBGColorPicker, setDisplayBGColorPicker] = useState(false);

  // Dynamically track selection inline styles for real-time UI button lighting
  const [selectionStyle, setSelectionStyle] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    uppercase: false,
  });

  const userChangedFontFamilyRef = useRef(false);
  const isCustomFontRef = useRef(false);
  // Persists the last known selection range for partial formatting operations
  const savedRangeRef = useRef(null);
  const savedEditableRef = useRef(null);

  const isTextSelected =
    activeObjectProps && activeObjectProps.type === "text";

  const isLegacyText =
    isTextSelected &&
    (!activeObjectProps?.editorVersion || activeObjectProps?.editorVersion < 2);

  const isCalendarText =
    isTextSelected &&
    (activeObjectProps?.subtype === "year" || activeObjectProps?.subtype === "month");

  // ─── Sync state from active object ──────────────────────────────

  // Track partial text selection formatting for the UI
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!isTextSelected) return;
      
      const editable = getTextEditableElement();
      const selection = window.getSelection();
      
      if (editable && selection && editable.editableElement.contains(selection.anchorNode)) {
        // Save the range and editable so we can restore it before execCommand
        if (!selection.isCollapsed) {
          savedRangeRef.current = selection.getRangeAt(0).cloneRange();
        } else {
          savedRangeRef.current = null;
        }
        savedEditableRef.current = editable.editableElement;

        setSelectionStyle({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikethrough: document.queryCommandState("strikeThrough"),
          uppercase: isInlineUppercaseActive(),
        });
      } else {
        savedRangeRef.current = null;
        savedEditableRef.current = null;
        setSelectionStyle({
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          uppercase: false,
        });
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [isTextSelected]);

  // Restore saved selection into the editable element before execCommand
  const restoreSelection = () => {
    if (savedRangeRef.current && savedEditableRef.current) {
      savedEditableRef.current.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!isTextSelected) return;
    if (textId === activeObjectProps.id) return;

    setTextId(activeObjectProps.id);
    userChangedFontFamilyRef.current = false;

    if (activeObjectProps.font?.id) {
      const resolved = resolveFont(activeObjectProps.font.id, activeObjectProps.font.family);
      if (resolved && resolved.styles) {
        const newFwList = resolved.styles.map((s) => ({
          name: s.label,
          value: s.weight,
        }));
        setFwList(newFwList);
        isCustomFontRef.current = true;
      }
    }

    setFontFamily(activeObjectProps.font.family);
    setFontSize(activeObjectProps.font.size);
    setFontStyle(activeObjectProps.font.weight);
  }, [activeObjectProps, resolveFont, isTextSelected]);

  useEffect(() => {
    if (isCustomFontRef.current) {
      isCustomFontRef.current = false;
      return;
    }
    const newRec = Fontfamilies.find((x) => x.name === fontFamily);
    if (!newRec) return;
    setFwList(newRec.fw);

    if (userChangedFontFamilyRef.current) {
      let fStyle = newRec.fw[0].value;
      if (activeObjectProps?.font?.weight) {
        const isWeightSupported = newRec.fw.some(
          (fw) => String(fw.value) === String(activeObjectProps.font.weight)
        );
        if (isWeightSupported) fStyle = activeObjectProps.font.weight;
      }
      setFontWeight("" + fStyle);
      userChangedFontFamilyRef.current = false;
    }
  }, [fontFamily]);

  // Reset color pickers when dialog changes
  useEffect(() => {
    setDisplayColorPicker(false);
    setDisplayBGColorPicker(false);
  }, [activeDialog]);

  // Sync legacy edit textarea with current text
  useEffect(() => {
    if (!isTextSelected) return;
    if (activeDialog === "legacyEdit") {
      setLegacyTextValue(activeObjectProps?.text || "");
    }
  }, [activeDialog, activeObjectProps?.text, isTextSelected]);

  // ─── Handlers ───────────────────────────────────────────────────

  const calculateFontSize = (baseSize) => {
    const scalingFactor = canvasSize.width / baseReferenceWidth;
    return Math.round(baseSize * scalingFactor);
  };

  const settextFontSize = useCallback(
    (size) => {
      if (!isTextSelected) return;
      const scaledSize = calculateFontSize(Number(size));
      const payload = {
        font: { ...activeObjectProps.font, size: scaledSize },
        applyToAll,
      };

      const dynLineHeight = activeObjectProps.spacing?.lineHeight ?? 1.2;
      const dynLetterSpacing = activeObjectProps.spacing?.letterSpacing ?? 0;
      const measureDiv = document.createElement("div");
      measureDiv.style.cssText = `
        position:absolute;visibility:hidden;white-space:pre-wrap;word-break:break-word;
        font-family:${activeObjectProps.font.family};font-size:${scaledSize}px;
        font-weight:${activeObjectProps.font.weight};font-style:${activeObjectProps.font.style || "normal"};
        line-height:${dynLineHeight};letter-spacing:${dynLetterSpacing ? `${dynLetterSpacing / 1000}em` : "normal"};
        width:${activeObjectProps.width}px;
      `;
      measureDiv.textContent = activeObjectProps.text || "";
      document.body.appendChild(measureDiv);
      const measuredHeight = measureDiv.offsetHeight + 10;
      document.body.removeChild(measureDiv);

      const minHeight = Math.ceil(scaledSize * dynLineHeight) + 10;
      const newHeight = Math.max(measuredHeight, minHeight);
      payload.height = newHeight;

      dispatch(setCurrentObjectProperties(payload));
    },
    [activeObjectProps, applyToAll, canvasSize, dispatch, isTextSelected]
  );

  const handleFontSizeFromAccordion = useCallback(
    (size) => settextFontSize(size),
    [settextFontSize]
  );

  const handleCustomVariantSelect = useCallback(
    (font, styleEntry) => {
      const weight = styleEntry.weight;
      const style = styleEntry.style || "normal";

      isCustomFontRef.current = true;
      userChangedFontFamilyRef.current = true;
      setFontFamily(font.name);
      setFontStyle(String(weight));

      const newFwList = font.styles.map((s) => ({
        name: s.label,
        value: s.weight,
      }));
      setFwList(newFwList);

      dispatch(
        setCurrentObjectProperties({
          font: {
            ...activeObjectProps.font,
            family: font.name,
            id: font.fontId,
            styleId: styleEntry.styleId,
            weight: String(weight),
            style: style,
            label: styleEntry.label,
          },
          applyToAll,
        })
      );
    },
    [activeObjectProps, applyToAll, dispatch]
  );

  const setFontWeight = async (value) => {
    if (!isTextSelected) return;
    setFontStyle(value);

    const fontId = activeObjectProps?.font?.id;
    let newStyleId = activeObjectProps?.font?.styleId;
    if (fontId) {
      const fStyle = activeObjectProps?.font?.style || "normal";
      if (!isFontLoaded(activeObjectProps.font.family, value, fStyle)) {
        await loadFont(fontId, parseInt(value, 10) || 400, fStyle);
      }
      // Resolve the correct styleId for the new weight
      const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
      if (resolved?.styles) {
        const w = parseInt(value, 10) || 400;
        const matched = resolved.styles.find((s) => s.weight === w && s.style === fStyle)
          || resolved.styles.find((s) => s.weight === w);
        if (matched?.styleId) newStyleId = matched.styleId;
      }
    }

    dispatch(
      setCurrentObjectProperties({
        font: { ...activeObjectProps.font, weight: value, styleId: newStyleId },
        applyToAll,
      })
    );
  };

  const setAlign = (value) => {
    if (!isTextSelected) return;
    dispatch(
      setCurrentObjectProperties({
        alignment: { ...activeObjectProps.alignment, horizontal: value },
        applyToAll,
      })
    );
  };

  const setVAlign = (value) => {
    if (!isTextSelected) return;
    dispatch(
      setCurrentObjectProperties({
        alignment: { ...activeObjectProps.alignment, vertical: value },
        applyToAll,
      })
    );
  };

  const setLetterSpacing = (value) => {
    if (!isTextSelected) return;
    const numValue = parseFloat(value) || 0;
    dispatch(
      setCurrentObjectProperties({
        spacing: {
          ...(activeObjectProps.spacing || {}),
          letterSpacing: Math.max(-200, Math.min(800, numValue)),
        },
        applyToAll,
      })
    );
  };

  const setLineHeight = (value) => {
    if (!isTextSelected) return;
    const numValue = parseFloat(value) || 1.2;
    dispatch(
      setCurrentObjectProperties({
        spacing: {
          ...(activeObjectProps.spacing || {}),
          lineHeight: Math.max(0.5, Math.min(2.5, numValue)),
        },
        applyToAll,
      })
    );
  };

  const setColor = (value) => {
    if (!isTextSelected) return;
    lastTextColorRef.current = value;
    lastTextGradientRef.current = null;
    dispatch(setCurrentObjectProperties({ color: value, gradient: null, applyToAll }));
  };

  const setBGColor = (value) => {
    if (!isTextSelected) return;
    lastBGColorRef.current = value;
    lastBGGradientRef.current = null;
    dispatch(setCurrentObjectProperties({ bgcolor: value, bgGradient: null, applyToAll }));
  };

  const handleColorPickerClose = useCallback(() => {
    setDisplayColorPicker(false);
    if (lastTextGradientRef.current) {
      dispatch(addTextGradientToHistory(lastTextGradientRef.current));
      dispatch(addToGlobalGradientHistory(lastTextGradientRef.current));
      lastTextGradientRef.current = null;
    } else if (lastTextColorRef.current) {
      dispatch(addTextSolidColorToHistory({ color: lastTextColorRef.current }));
      dispatch(addToGlobalSolidColorHistory({ color: lastTextColorRef.current }));
      lastTextColorRef.current = null;
    }
  }, [dispatch]);

  const handleBGColorPickerClose = useCallback(() => {
    setDisplayBGColorPicker(false);
    if (lastBGGradientRef.current) {
      dispatch(addToGlobalGradientHistory(lastBGGradientRef.current));
      lastBGGradientRef.current = null;
    } else if (lastBGColorRef.current) {
      dispatch(addToGlobalSolidColorHistory({ color: lastBGColorRef.current }));
      lastBGColorRef.current = null;
    }
  }, [dispatch]);

  const setTextGradient = useCallback(
    (gradientData) => {
      if (!isTextSelected) return;
      lastTextGradientRef.current = gradientData;
      lastTextColorRef.current = null;
      dispatch(
        setCurrentObjectProperties({
          gradient: {
            type: gradientData.type,
            angle: gradientData.angle,
            stops: gradientData.stops,
            ...(gradientData.radialPosition && { radialPosition: gradientData.radialPosition }),
          },
          color: gradientData.stops?.[0]?.color?.slice(0, 9) || activeObjectProps?.color || "#000000",
          applyToAll,
        })
      );
    },
    [dispatch, applyToAll, activeObjectProps?.color, isTextSelected]
  );

  const setTextBGGradient = useCallback(
    (gradientData) => {
      if (!isTextSelected) return;
      lastBGGradientRef.current = gradientData;
      lastBGColorRef.current = null;
      dispatch(
        setCurrentObjectProperties({
          bgGradient: {
            type: gradientData.type,
            angle: gradientData.angle,
            stops: gradientData.stops,
            ...(gradientData.radialPosition && { radialPosition: gradientData.radialPosition }),
          },
          bgcolor: gradientData.stops?.[0]?.color?.slice(0, 9) || activeObjectProps?.bgcolor || "#000000",
          applyToAll,
        })
      );
    },
    [dispatch, applyToAll, activeObjectProps?.bgcolor, isTextSelected]
  );

  const handleClose = () => {
    dispatch(setTextToolbarDialog(null));
  };

  // ─── Text Style Toggle Handlers ────────────────────────────────

  const handleToggleDecoration = (decorationType) => {
    if (!isTextSelected) return;

    // Partial selection: restore saved range, then execCommand
    if (savedRangeRef.current && savedEditableRef.current) {
      restoreSelection();
      const editable = getTextEditableElement();
      if (editable) {
        const command = decorationType === "underline" ? "underline" : "strikeThrough";
        document.execCommand(command, false, null);
        const newText = editable.editableElement.innerText || "";
        const newHtml = editable.editableElement.innerHTML || "";
        const hasInlineFormatting = INLINE_FORMAT_REGEX.test(newHtml);
        dispatch(
          setCurrentObjectProperties({
            text: newText,
            ...(hasInlineFormatting ? { richText: newHtml } : { richText: null }),
          })
        );
        return;
      }
    }

    const currentDecoration = activeObjectProps?.font?.decoration || "none";
    const newDecoration = toggleTextDecoration(currentDecoration, decorationType);
    dispatch(
      setCurrentObjectProperties({
        font: { ...activeObjectProps.font, decoration: newDecoration },
        richText: null,
      })
    );
  };

  const handleToggleUppercase = () => {
    if (!isTextSelected) return;
    
    const editable = getTextEditableElement();

    // If we have a custom selection, apply inline formatting
    if (editable && !editable.selection.isCollapsed) {
      toggleInlineUppercase();
      dispatch(
        setCurrentObjectProperties({
          richText: editable.editableElement.innerHTML,
        })
      );
      return;
    }

    // Otherwise (not in edit mode OR collapsed selection), fallback to whole-object toggle
    const currentTransform = activeObjectProps?.textTransform || "none";
    const newTransform = toggleTextTransform(currentTransform);
  
    const dynLineHeight = activeObjectProps.spacing?.lineHeight ?? 1.2;
    const dynLetterSpacing = activeObjectProps.spacing?.letterSpacing ?? 0;
    const fontSize = activeObjectProps.font?.size || 16;

    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position:absolute;visibility:hidden;white-space:pre-wrap;word-break:break-word;
      font-family:${activeObjectProps.font.family};font-size:${fontSize}px;
      font-weight:${activeObjectProps.font.weight};font-style:${activeObjectProps.font.style || "normal"};
      line-height:${dynLineHeight};letter-spacing:${dynLetterSpacing ? `${dynLetterSpacing / 1000}em` : "normal"};
      text-transform:${newTransform};width:${activeObjectProps.width}px;
    `;
    measureDiv.textContent = activeObjectProps.text || "";
    document.body.appendChild(measureDiv);
    const measuredHeight = measureDiv.offsetHeight + 10;
    document.body.removeChild(measureDiv);

    const minHeight = Math.ceil(fontSize * dynLineHeight) + 10;
    const newHeight = Math.max(measuredHeight, minHeight);

    dispatch(setCurrentObjectProperties({
      textTransform: newTransform,
      height: newHeight,
    }));
  };

  const currentVariantLabel = getFontVariantLabel(
    fwList,
    activeObjectProps?.font || {}
  );

  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  const hasSelection = selection && !selection.isCollapsed;

  const isBoldVariantFromDropdown = isBoldVariantActive(currentVariantLabel);
  const isBoldActive =
    (hasSelection && isInlineBoldActive()) ||
    parseInt(activeObjectProps?.font?.weight, 10) >= 700 ||
    isBoldVariantFromDropdown;
  const isItalicVariantFromDropdown = isItalicVariantActive(currentVariantLabel);
  const isItalicActive =
    activeObjectProps?.font?.style === "italic" ||
    isItalicVariantFromDropdown;
  const isUppercaseActive = activeObjectProps?.textTransform === "uppercase";

  const editableNode = getTextEditableElement();
  const currentSelection = window.getSelection();
  const hasActiveFocus = editableNode && currentSelection && editableNode.editableElement.contains(currentSelection.anchorNode);
  const hasNonCollapsedSelection = hasActiveFocus && !currentSelection.isCollapsed;

  const isUIBoldActive = hasActiveFocus ? selectionStyle.bold : isBoldActive;
  const isUIItalicActive = hasActiveFocus ? selectionStyle.italic : isItalicActive;
  const isUIUppercaseActive = hasNonCollapsedSelection ? selectionStyle.uppercase : (isUppercaseActive || selectionStyle.uppercase);
  const isUIUnderlineActive = hasActiveFocus ? selectionStyle.underline : hasDecoration(activeObjectProps?.font?.decoration, "underline");
  const isUIStrikethroughActive = hasActiveFocus ? selectionStyle.strikethrough : hasDecoration(activeObjectProps?.font?.decoration, "line-through");

  const hasOnlyRegularVariant = fwList.length === 1 && fwList[0].name === "Regular";

  const boldDisabledFlag = !isTextSelected || hasOnlyRegularVariant;
  const italicDisabledFlag = !isTextSelected || hasOnlyRegularVariant;

  const handleToggleBold = async () => {
    if (!isTextSelected) return;

    const editable = getTextEditableElement();
    const selection = window.getSelection();
    const hasSelection = editable && selection && !selection.isCollapsed;

    if (hasSelection) {
      restoreSelection(); // Ensure selection is restored before execCommand
      document.execCommand("bold", false, null);
      const newText = editable.editableElement.innerText || "";
      const newHtml = editable.editableElement.innerHTML || "";
      const hasInlineFormatting = INLINE_FORMAT_REGEX.test(newHtml);
      dispatch(
        setCurrentObjectProperties({
          text: newText,
          ...(hasInlineFormatting ? { richText: newHtml } : { richText: null }),
        })
      );
      return;
    }

    if (boldDisabledFlag) return;

    const fontId = activeObjectProps?.font?.id;
    const fStyle = activeObjectProps?.font?.style || "normal";
    let newStyleId = activeObjectProps?.font?.styleId;

    if (isBoldActive) {
      const regularVariant = findRegularVariant(fwList, currentVariantLabel);
      const newWeight = String(regularVariant.value);
      const newLabel = regularVariant.name;

      if (fontId) {
        if (!isFontLoaded(activeObjectProps.font.family, newWeight, fStyle)) {
          await loadFont(fontId, parseInt(newWeight, 10), fStyle);
        }
        const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
        if (resolved?.styles) {
          const matched = resolved.styles.find((s) => s.weight === parseInt(newWeight, 10) && s.style === fStyle)
            || resolved.styles.find((s) => String(s.weight) === newWeight);
          if (matched?.styleId) newStyleId = matched.styleId;
        }
      }
      setFontStyle(newWeight);
      dispatch(
        setCurrentObjectProperties({
          font: {
            ...activeObjectProps.font,
            weight: newWeight,
            styleId: newStyleId,
            label: newLabel,
            isSyntheticBold: false,
            baseWeight: undefined,
          },
          applyToAll,
        })
      );
    } else {
      const boldVariant = findBoldVariant(fwList, fStyle);
      const newWeight = String(boldVariant.value);
      const newLabel = boldVariant.name;
      const hasTrueBold = fwList.some((fw) => Number(fw.value) >= 700);

      if (fontId) {
        if (!isFontLoaded(activeObjectProps.font.family, newWeight, fStyle)) {
          await loadFont(fontId, parseInt(newWeight, 10), fStyle);
        }
        const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
        if (resolved?.styles) {
          const matched = resolved.styles.find((s) => s.weight === parseInt(newWeight, 10) && s.style === fStyle)
            || resolved.styles.find((s) => String(s.weight) === newWeight);
          if (matched?.styleId) newStyleId = matched.styleId;
        }
      }
      setFontStyle(newWeight);
      dispatch(
        setCurrentObjectProperties({
          font: {
            ...activeObjectProps.font,
            weight: newWeight,
            styleId: newStyleId,
            label: newLabel,
            isSyntheticBold: !hasTrueBold,
            baseWeight: !hasTrueBold ? (activeObjectProps?.font?.weight || "400") : undefined,
          },
          applyToAll,
        })
      );
    }
  };

  const handleToggleItalic = async () => {
    if (!isTextSelected) return;

    // Partial selection: restore saved range, then use execCommand
    if (savedRangeRef.current && savedEditableRef.current) {
      restoreSelection();
      const editable = getTextEditableElement();
      if (editable) {
        document.execCommand("italic", false, null);
        const newText = editable.editableElement.innerText || "";
        const newHtml = editable.editableElement.innerHTML || "";
        const hasInlineFormatting = INLINE_FORMAT_REGEX.test(newHtml);
        dispatch(
          setCurrentObjectProperties({
            text: newText,
            ...(hasInlineFormatting ? { richText: newHtml } : { richText: null }),
          })
        );
        return;
      }
    }

    if (italicDisabledFlag) return;

    const fontId = activeObjectProps?.font?.id;
    const currentWeight = activeObjectProps?.font?.weight || "400";
    let newStyleId = activeObjectProps?.font?.styleId;

    if (isItalicActive) {
      const nonItalicVariant = findNonItalicVariant(fwList, currentVariantLabel);
      const newStyle = "normal";
      const newLabel = nonItalicVariant.name;
      const newWeight = String(nonItalicVariant.value);

      if (fontId) {
        if (!isFontLoaded(activeObjectProps.font.family, newWeight, newStyle)) {
          await loadFont(fontId, parseInt(newWeight, 10), newStyle);
        }
        const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
        if (resolved?.styles) {
          const matched = resolved.styles.find((s) => s.weight === parseInt(newWeight, 10) && s.style === newStyle)
            || resolved.styles.find((s) => String(s.weight) === newWeight && s.style === newStyle);
          if (matched?.styleId) newStyleId = matched.styleId;
        }
      }
      setFontStyle(newWeight);
      dispatch(
        setCurrentObjectProperties({
          font: {
            ...activeObjectProps.font,
            style: newStyle,
            weight: newWeight,
            styleId: newStyleId,
            label: newLabel,
            isSyntheticItalic: false,
            baseStyle: undefined,
          },
          applyToAll,
        })
      );
    } else {
      const italicVariant = findItalicVariant(fwList, currentWeight);
      const hasTrueItalic = italicVariant !== null;
      const newStyle = "italic";
      const newWeight = hasTrueItalic ? String(italicVariant.value) : currentWeight;
      const newLabel = hasTrueItalic ? italicVariant.name : undefined;

      if (fontId && hasTrueItalic) {
        if (!isFontLoaded(activeObjectProps.font.family, newWeight, newStyle)) {
          await loadFont(fontId, parseInt(newWeight, 10), newStyle);
        }
        const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
        if (resolved?.styles) {
          const matched = resolved.styles.find((s) => s.weight === parseInt(newWeight, 10) && s.style === newStyle)
            || resolved.styles.find((s) => s.style === newStyle);
          if (matched?.styleId) newStyleId = matched.styleId;
        }
      }
      setFontStyle(newWeight);
      dispatch(
        setCurrentObjectProperties({
          font: {
            ...activeObjectProps.font,
            style: newStyle,
            weight: newWeight,
            styleId: newStyleId,
            ...(newLabel ? { label: newLabel } : {}),
            isSyntheticItalic: !hasTrueItalic,
            baseStyle: !hasTrueItalic ? (activeObjectProps?.font?.style || "normal") : undefined,
          },
          applyToAll,
        })
      );
    }
  };

  const measureLegacyHeight = useCallback(
    (textValue) => {
      const measureDiv = document.createElement("div");
      measureDiv.style.cssText = `
        position:absolute;
        visibility:hidden;
        white-space:pre-wrap;
        word-break:break-word;
        font-family:${activeObjectProps?.font?.family || "Arial"};
        font-size:${parseInt(activeObjectProps?.font?.size, 10) || 24}px;
        font-weight:${activeObjectProps?.font?.weight || "normal"};
        line-height:${activeObjectProps?.spacing?.lineHeight || 1.2};
        width:${activeObjectProps?.width || 280}px;
      `;
      measureDiv.textContent = textValue || "";
      document.body.appendChild(measureDiv);
      const measuredHeight = measureDiv.offsetHeight + 10;
      document.body.removeChild(measureDiv);
      return measuredHeight;
    },
    [activeObjectProps]
  );

  const handleLegacyInput = useCallback(
    (value) => {
      setLegacyTextValue(value);
      if (!isTextSelected) return;
      const measuredHeight = measureLegacyHeight(value || "");
      const payload = { text: value || "" };
      if (measuredHeight > (activeObjectProps?.height || 0)) {
        payload.height = measuredHeight;
      }
      dispatch(setCurrentObjectProperties(payload));
    },
    [dispatch, measureLegacyHeight, activeObjectProps?.height, isTextSelected]
  );

  const handleLegacySave = useCallback(() => {
    dispatch(setTextToolbarDialog(null));
  }, [dispatch]);

  // ─── Don't render if no dialog active or no text selected ───────

  if (!activeDialog || !isTextSelected) return null;

  const title = DIALOG_TITLES[activeDialog] || "Text";

  // ─── Render dialog content based on activeDialog ────────────────

  const renderContent = () => {
    switch (activeDialog) {
      case "font":
        return (
          <>
            {isCalendarText && (
              <Box mt="10px">
                <FlexBox gap="6px">
                  <label htmlFor="applyToAllToolbar">
                    <input
                      type="checkbox"
                      id="applyToAllToolbar"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                    />
                    <span style={{ marginLeft: "10px" }} title="Apply to all similar text">
                      Apply to All
                    </span>
                  </label>
                </FlexBox>
              </Box>
            )}
            <CustomFontAccordion
              fontFamily={fontFamily}
              activeFont={activeObjectProps?.font}
              onVariantSelect={handleCustomVariantSelect}
              isTextSelected={isTextSelected}
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeFromAccordion}
              canvasSize={canvasSize}
            />
          </>
        );

      case "alignment":
        return (
          <>
            <Box mt="10px">
              <ActionInnerTitle fontweight="500">Text Style</ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleToggleBold}
                  disabled={boldDisabledFlag}
                  className={isUIBoldActive ? "active" : ""}
                  title={boldDisabledFlag ? `Bold unavailable (${currentVariantLabel})` : "Bold"}
                  style={boldDisabledFlag ? { opacity: 0.35, pointerEvents: 'none' } : {}}
                >
                  <FaBold />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleToggleItalic}
                  disabled={italicDisabledFlag}
                  className={isUIItalicActive ? "active" : ""}
                  title={italicDisabledFlag ? `Italic unavailable (${currentVariantLabel})` : "Italic"}
                  style={italicDisabledFlag ? { opacity: 0.35, pointerEvents: 'none' } : {}}
                >
                  <FaItalic />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleToggleDecoration("underline")}
                  className={isUIUnderlineActive ? "active" : ""}
                  title="Underline"
                >
                  <FaUnderline />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleToggleDecoration("line-through")}
                  className={isUIStrikethroughActive ? "active" : ""}
                  title="Strikethrough"
                >
                  <FaStrikethrough />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleToggleUppercase}
                  className={isUIUppercaseActive ? "active" : ""}
                  title="Uppercase"
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>aA</span>
                </TextAlignButton>
              </FlexBox>
            </Box>
            <Box mt="10px">
              <ActionInnerTitle fontweight="500">Horizontal Alignment</ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlign("left")}
                  className={activeObjectProps?.alignment?.horizontal === "left" ? "active" : ""}
                >
                  <LeftAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlign("center")}
                  className={activeObjectProps?.alignment?.horizontal === "center" ? "active" : ""}
                >
                  <CenterAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlign("right")}
                  className={activeObjectProps?.alignment?.horizontal === "right" ? "active" : ""}
                >
                  <RightAlignIcon />
                </TextAlignButton>
                {!isLegacyText && (
                  <TextAlignButton
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setAlign("justify")}
                    className={activeObjectProps?.alignment?.horizontal === "justify" ? "active" : ""}
                  >
                    <JustifyAlignIcon />
                  </TextAlignButton>
                )}
              </FlexBox>
            </Box>

            <Box mt="15px">
              <ActionInnerTitle fontweight="500">Vertical Alignment</ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setVAlign("top")}
                  className={activeObjectProps?.alignment?.vertical === "top" ? "active" : ""}
                >
                  <TopAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setVAlign("middle")}
                  className={activeObjectProps?.alignment?.vertical === "middle" ? "active" : ""}
                >
                  <MiddleAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setVAlign("bottom")}
                  className={activeObjectProps?.alignment?.vertical === "bottom" ? "active" : ""}
                >
                  <BottomAlignIcon />
                </TextAlignButton>
              </FlexBox>
            </Box>
          </>
        );

      case "position":
        return (
          <Box mt="10px">
            <PositionSettingsPanel />
          </Box>
        );

      case "colors":
        return (
          <>
            <Box mt="10px">
              <ActionInnerTitle fontweight="500">Text Color</ActionInnerTitle>
              <FlexBox mt="10px" gap="6px" wrap="wrap">
                <BackgroundColorItemSmall
                  onClick={() => setDisplayColorPicker(!displayColorPicker)}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />
                <BackgroundColorItemSmall
                  onClick={() => setColor("#000000")}
                  bgimage="/images/background/remove_bg_color.png"
                />
                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setColor(item.bgcolor)}
                    key={`tc-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
              {displayColorPicker && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}
                    onClick={handleColorPickerClose}
                  />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <ColorPickerWithOpacity
                      color={activeObjectProps?.color || "#000000"}
                      initialGradient={activeObjectProps?.gradient || null}
                      onChange={(hexColor) => setColor(hexColor)}
                      onGradientChange={setTextGradient}
                      externalGradientHistory={[...textGradientHistory, ...globalGradientHistory.filter(g => !textGradientHistory.some(t => t.css === g.css))]}
                      externalSolidColorHistory={[...textSolidColorHistory, ...globalSolidColorHistory.filter(g => !textSolidColorHistory.some(t => t.color === g.color))]}
                      onClose={handleColorPickerClose}
                    />
                  </div>
                </div>
              )}
            </Box>

            <Box mt="15px">
              <ActionInnerTitle fontweight="500">Background Color</ActionInnerTitle>
              <FlexBox mt="10px" gap="6px" wrap="wrap">
                <BackgroundColorItemSmall
                  onClick={() => setDisplayBGColorPicker(!displayBGColorPicker)}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />
                <BackgroundColorItemSmall
                  onClick={() => setBGColor("transparent")}
                  bgimage="/images/background/remove_bg_color.png"
                />
                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setBGColor(item.bgcolor)}
                    key={`bg-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
              {displayBGColorPicker && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}
                    onClick={handleBGColorPickerClose}
                  />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <ColorPickerWithOpacity
                      color={activeObjectProps?.bgcolor || "#000000"}
                      initialGradient={activeObjectProps?.bgGradient || null}
                      onChange={(hexColor) => setBGColor(hexColor)}
                      onGradientChange={setTextBGGradient}
                      externalGradientHistory={globalGradientHistory}
                      externalSolidColorHistory={globalSolidColorHistory}
                      onClose={handleBGColorPickerClose}
                    />
                  </div>
                </div>
              )}
            </Box>
          </>
        );

      case "spacing":
        return (
          <Box mt="10px">
            <SpacingSliderContainer>
              <SpacingSliderLabel>
                <span>Letter Spacing</span>
                <SpacingValueInput
                  type="number"
                  value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                  onChange={(e) => setLetterSpacing(e.target.value)}
                  min={-200}
                  max={800}
                  step={1}
                />
              </SpacingSliderLabel>
              <SpacingSliderInput
                type="range"
                min={-200}
                max={800}
                step={1}
                value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                onChange={(e) => setLetterSpacing(e.target.value)}
              />
            </SpacingSliderContainer>

            <SpacingSliderContainer>
              <SpacingSliderLabel>
                <span>Line Height</span>
                <SpacingValueInput
                  type="number"
                  value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                  onChange={(e) => setLineHeight(e.target.value)}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                />
              </SpacingSliderLabel>
              <SpacingSliderInput
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                onChange={(e) => setLineHeight(e.target.value)}
              />
            </SpacingSliderContainer>
          </Box>
        );

      case "legacyEdit":
        return (
          <Box mt="8px">
            <ActionInnerTitle fontweight="500">Edit Text</ActionInnerTitle>
            <p style={{ fontSize: "12px", color: "#6c757d", margin: "6px 0 12px" }}>
              Update the selected legacy text. Height will auto-expand if needed.
            </p>
            <LegacyTextarea
              value={legacyTextValue}
              onChange={(e) => handleLegacyInput(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 8 }}>
              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={() => dispatch(setTextToolbarDialog(null))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleLegacySave}
                disabled={!legacyTextValue?.trim() && !(activeObjectProps?.text || "").length}
              >
                Save
              </button>
            </div>
          </Box>
        );

      case "linked":
        if (!isAdmin) {
          return (
            <Box mt="10px">
              <p style={{ fontSize: "12px", color: "#868e96" }}>
                Smart Text controls are available for admin users only.
              </p>
            </Box>
          );
        }
        return (
          <Box mt="10px">
            <TextGroupPanel savedSelection={savedSmartTextSelection} />
          </Box>
        );

      default:
        return null;
    }
  };

  const stopPropagation = (e) => e.stopPropagation();

  return ReactDOM.createPortal(
    <>
      <PanelOverlay onClick={handleClose} />
      <PanelContainer
        ref={panelRef}
        style={{ top: panelPos.y, left: panelPos.x }}
        $isMobile={isMobile}
        onPointerDown={stopPropagation}
        onTouchStart={stopPropagation}
        onMouseDown={stopPropagation}
        onWheel={stopPropagation}
      >
        <DragGrip
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <div className="grip-dots" />
        </DragGrip>
        <PanelHeader
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <h3>{title}</h3>
          <CloseButton data-no-drag="true" onClick={handleClose} title="Close">
            <button class="close" type="button" style={{border:"none", background:"none"}}>&#x2715;</button>
          </CloseButton>
        </PanelHeader>
        <PanelBody>
          {renderContent()}
        </PanelBody>
      </PanelContainer>
    </>,
    document.body
  );
}

export default TextToolbarDialogPanel;
