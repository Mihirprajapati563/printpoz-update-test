import React, { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  getActiveObjectprops,
  getCanvasSize,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  sendBackward,
  sendForward,
  removeObjectInPage,
  deSelectActiveObject,
} from "../../store/slices/canvas";
import {
  openMagicWrite,
  setIsMultiSelectMode,
  setTextToolbarDialog,
  setSmartTextSelection,
} from "../../store/slices/appAlice";

// Import your SVGs
import { ReactComponent as LockObjectIcon } from "../../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../../assets/icons/unlock121.svg";

import { BiMinusBack, BiMinusFront, BiTrash } from "react-icons/bi";
import {
  FaMagic,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaTags,
  FaLock,
  FaUnlock,
  FaChevronRight,
  FaChevronLeft,
  FaRegEdit,
} from "react-icons/fa";
import { MdFormatLineSpacing, MdSelectAll } from "react-icons/md";
import { FaUnderline, FaStrikethrough, FaBold, FaItalic } from "react-icons/fa";
import {
  toggleTextDecoration,
  toggleTextTransform,
  hasDecoration,
  getTextEditableElement,
  INLINE_FORMAT_REGEX,
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
  getFontVariantLabel,
} from "../../library/utils/textStyleUtils";
import { useFontContext } from "../../library/utils/context/FontContext";
import { Fontfamilies } from "../../library/utils/jsons/commonJSON";

import { USER_TYPES } from "../../library/utils/constants";
import { getUserDetails } from "../../library/utils/services/theme";
import { fontSizes } from "../../library/utils/jsons/commonJSON";

// ─── Styled Components ───────────────────────────────────────────────

const ToolbarOuter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  box-sizing: border-box;
  margin-bottom: 10px;
  min-height: 64px;
`;

// Creates the visible "card" that holds the items and the arrows
const ToolbarCard = styled.div`
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e6e6e6;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  max-width: calc(100vw - 32px);
  min-height: 44px;
  overflow: hidden; /* Keeps scroll gradients inside the rounded corners */
`;

// Single scrollable track (Fixes the iOS nested scroll bug)
const ScrollArea = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  overflow-x: auto;
  scroll-behavior: smooth;
  touch-action: pan-x;
  
  /* Hide standard scrollbars for clean UX */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  
  /* Force smooth hardware scrolling on iOS */
  -webkit-overflow-scrolling: touch; 
`;

// Gradient Arrow Indicator for UX
const ScrollIndicator = styled.button`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$direction === "right" ? "right: 0;" : "left: 0;")}
  width: 45px;
  background: ${(p) =>
    p.$direction === "right"
      ? "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 60%)"
      : "linear-gradient(to left, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 60%)"};
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$direction === "right" ? "flex-end" : "flex-start")};
  padding: 0 8px;
  border: none;
  color: #7B61FF;
  cursor: pointer;
  z-index: 10;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transition: opacity 0.2s ease;
  
  svg {
    width: 14px;
    height: 14px;
    filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));
  }
`;

// Icon-only button (Force explicit SVG sizes so iOS Safari doesn't collapse them)
const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-width: 34px; /* iOS Fix */
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--primary, #7B61FF)" : "#2b2b2b")};
  cursor: pointer;
  flex-shrink: 0; /* iOS Fix */
  transition: background 0.12s ease;

  &:hover {
    background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7")};
  }

  svg {
    width: 17px !important;
    height: 17px !important;
    min-width: 17px;
    min-height: 17px;
    display: block;
    color: inherit;
    fill: currentColor;
    flex-shrink: 0;
  }
`;

const TextBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--primary, #7B61FF)" : "#2b2b2b")};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  ${(p) => p.$mobileOnly && `
    @media (min-width: 769px) {
      display: none;
    }
  `}

  &:hover {
    background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7")};
  }
  
  svg {
    width: 14px !important;
    height: 14px !important;
    min-width: 14px;
    min-height: 14px;
    display: block;
    flex-shrink: 0;
    margin-right: 6px;
    fill: currentColor;
  }
`;

const Sep = styled.div`
  width: 1px;
  height: 18px;
  background: #ececec;
  margin: 0 4px;
  border-radius: 2px;
  flex-shrink: 0;

  ${(p) => p.$mobileOnly && `
    @media (min-width: 769px) {
      display: none;
    }
  `}
`;

const FontNameBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  height: 34px;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "#fff")};
  color: #1e1e1e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 160px;

  &:hover {
    background: #f7f7f8;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const SizeGroup = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  height: 34px;
  flex-shrink: 0;
  position: relative;
`;

const SizeBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 100%;
  border: none;
  background: #fff;
  cursor: pointer;
  color: #333;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f7;
  }

  svg {
    width: 12px !important;
    height: 12px !important;
    color: inherit;
    fill: currentColor;
  }
`;

const SizeValBtn = styled.button`
  min-width: 36px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: #1e1e1e;
  line-height: 30px;
  height: 100%;
  border: none;
  background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "#fff")};
  padding: 0 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease;

  &:hover {
    background: #f5f5f7;
  }
`;

// Custom font size dropdown — rendered via portal, positioned to match SizeGroup
const SizeDropdown = styled.div`
  position: fixed;
  max-height: 260px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1060;
  padding: 4px 0;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }
`;

const SizeDropdownItem = styled.button`
  display: block;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: ${(props) => (props.$active ? "#f0f0f0" : "transparent")};
  color: #333;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: #e8f0fe;
  }
`;

// Color indicator "A" button
const ColorBtn = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-width: 34px;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "transparent")};
  cursor: pointer;
  padding: 2px 0;
  flex-shrink: 0;

  &:hover {
    background: ${(p) => (p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7")};
  }

  .color-letter {
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    color: #333;
  }

  .color-bar {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    margin-top: 2px;
  }
`;


// ─── Main Component ──────────────────────────────────────────────────

const baseReferenceWidth = 500;

function TextFloatingToolbar() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const canvasSize = useSelector(getCanvasSize);
  const activeDialog = useSelector((state) => state.appSlice.textToolbarDialog);
  const isMultiSelectMode = useSelector(
    (state) => state.appSlice.isMultiSelectMode
  );
  const user = getUserDetails();
  const userType = user?.userTypeCode || -1;

  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Dynamically track selection inline styles for real-time UI button lighting
  const [selectionStyle, setSelectionStyle] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    uppercase: false,
  });

  const sizeDropdownRef = useRef(null);
  const sizeGroupRef = useRef(null);
  const scrollContainerRef = useRef(null);
  // Persists the last known selection range for partial formatting operations
  const savedRangeRef = useRef(null);
  const savedEditableRef = useRef(null);

  const isTextSelected = activeObjectProps && activeObjectProps.type === "text";
  const isLegacyText =
    isTextSelected &&
    (!activeObjectProps?.editorVersion || activeObjectProps?.editorVersion < 2);
  const isCalendarLocked =
    activeObjectProps?.subtype === "month" || activeObjectProps?.subtype === "year";

  // ─── Scroll Detection Logic for UX Arrows ──────────────────────
  const checkScrollability = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // Using Math.ceil and -1 to avoid sub-pixel rounding errors on high DPI displays
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
    }
  }, []);

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [checkScrollability]);

  // Track partial text selection formatting for the UI
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!isTextSelected) return;
      
      const editable = getTextEditableElement();
      const selection = window.getSelection();
      
      if (editable && selection && editable.editableElement.contains(selection.anchorNode)) {
        // Save the range and editable so we can restore it before execCommand
        // We only save the range for non-collapsed selections to avoid interference 
        // with typing focus, but we always update selectionStyle for the UI.
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

  // Re-check scroll on load/render
  useEffect(() => {
    if (isTextSelected) {
      const timer = setTimeout(checkScrollability, 50);
      return () => clearTimeout(timer);
    }
  }, [isTextSelected, checkScrollability]);

  const handleArrowScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // ─── Close size dropdown on outside click ─────────────────────
  useEffect(() => {
    if (!showSizeDropdown) return;
    const handleClickOutside = (e) => {
      const inGroup = sizeGroupRef.current?.contains(e.target);
      const inDropdown = sizeDropdownRef.current?.contains(e.target);
      if (!inGroup && !inDropdown) {
        setShowSizeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSizeDropdown]);

  // ─── Font size helpers ──────────────────────────────────────────

  const currentDisplaySize =
    isTextSelected
      ? Math.round(
          (activeObjectProps?.font?.size || 36) /
            (canvasSize.width / baseReferenceWidth)
        ) || 36
      : 36;

  const settextFontSize = useCallback(
    (value) => {
      if (!isTextSelected) return;
      const baseSize = Number(value);
      const scaledSize = Math.round(baseSize * (canvasSize.width / baseReferenceWidth));

      const payload = {
        font: { ...activeObjectProps.font, size: scaledSize },
      };

      // Measure and adjust height using actual object spacing values
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
    [activeObjectProps, canvasSize, dispatch, isTextSelected]
  );

  const incrementFontSize = () => {
    const idx = fontSizes.indexOf(currentDisplaySize);
    const next =
      idx >= 0 && idx < fontSizes.length - 1
        ? fontSizes[idx + 1]
        : currentDisplaySize + 2;
    settextFontSize(next);
  };

  const decrementFontSize = () => {
    const idx = fontSizes.indexOf(currentDisplaySize);
    const prev = idx > 0 ? fontSizes[idx - 1] : Math.max(1, currentDisplaySize - 2);
    settextFontSize(prev);
  };

  const handleSizeSelect = (size) => {
    settextFontSize(size);
    setShowSizeDropdown(false);
  };

  // ─── Action handlers ────────────────────────────────────────────

  const handleMagicWords = () => dispatch(openMagicWrite("edit"));
  const handleBackward = () => dispatch(sendBackward());
  const handleForward = () => dispatch(sendForward());

  const handleRemove = () => {
    dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
    dispatch(setCurrentObjectProperties(null));
  };

  const handleLock = () => {
    dispatch(setCurrentObjectProperties({ locked: !activeObjectProps?.locked }));
  };

  const handleMultiSelectToggle = () => {
    const nextMode = !isMultiSelectMode;
    dispatch(setIsMultiSelectMode(nextMode));
    if (!nextMode) {
      dispatch(deSelectActiveObject());
    }
  };

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

    // Whole-object toggle
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

  const { resolveFont, isFontLoaded, loadFont } = useFontContext();

  // Resolve font weight list for the current font
  const currentFontFwList = (() => {
    const fontId = activeObjectProps?.font?.id;
    if (fontId) {
      const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
      if (resolved?.styles) {
        return resolved.styles.map((s) => ({ name: s.label, value: s.weight }));
      }
    }
    const systemFont = Fontfamilies.find((f) => f.name === activeObjectProps?.font?.family);
    return systemFont?.fw || [];
  })();

  const currentVariantLabel = getFontVariantLabel(
    currentFontFwList,
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

  const hasOnlyRegularVariant = currentFontFwList.length === 1 && currentFontFwList[0].name === "Regular";

  const boldDisabled = !isTextSelected || hasOnlyRegularVariant;
  const italicDisabled = !isTextSelected || hasOnlyRegularVariant;

  const handleToggleBold = async () => {
    if (!isTextSelected) return;

    if (savedRangeRef.current && savedEditableRef.current) {
      restoreSelection();
      const editable = getTextEditableElement();
      if (editable) {
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
    }

    if (boldDisabled) return;

    const fontId = activeObjectProps?.font?.id;
    const fStyle = activeObjectProps?.font?.style || "normal";
    let newStyleId = activeObjectProps?.font?.styleId;

    if (isBoldActive) {
      const regularVariant = findRegularVariant(currentFontFwList, currentVariantLabel);
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
        })
      );
    } else {
      const boldVariant = findBoldVariant(currentFontFwList, fStyle);
      const newWeight = String(boldVariant.value);
      const newLabel = boldVariant.name;
      const hasTrueBold = currentFontFwList.some((fw) => Number(fw.value) >= 700);

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
        })
      );
    }
  };

  const handleToggleItalic = async () => {
    if (!isTextSelected) return;

    // Partial selection: use execCommand
    const editable = getTextEditableElement();
    const selection = window.getSelection();
    const hasSelection = editable && selection && !selection.isCollapsed;

    if (hasSelection) {
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

    if (italicDisabled) return;

    const fontId = activeObjectProps?.font?.id;
    const currentWeight = activeObjectProps?.font?.weight || "400";
    let newStyleId = activeObjectProps?.font?.styleId;

    if (isItalicActive) {
      const nonItalicVariant = findNonItalicVariant(currentFontFwList, currentVariantLabel);
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
        })
      );
    } else {
      const italicVariant = findItalicVariant(currentFontFwList, currentWeight);
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
        })
      );
    }
  };

  // ─── Dialog toggle ─────────────────────────────────────────────

  const toggleDialog = (name) => {
    dispatch(setTextToolbarDialog(activeDialog === name ? null : name));
  };

  const captureSmartTextSelection = useCallback(() => {
    if (!isTextSelected) return null;
    const fullText = activeObjectProps?.text || "";
    if (!fullText.trim()) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const selectedValue = selection.toString();
    if (!selectedValue || !selectedValue.trim()) return null;
    const editable = getTextEditableElement();
    if (editable && !editable.editableElement.contains(selection.anchorNode)) {
      return null;
    }
    const normalizedSource = fullText.toLowerCase();
    const normalizedTarget = selectedValue.trim().toLowerCase();
    const startIndex = normalizedSource.indexOf(normalizedTarget);
    if (startIndex === -1) return null;
    const endIndex = startIndex + normalizedTarget.length;
    return {
      start: startIndex,
      end: endIndex,
      text: fullText.slice(startIndex, endIndex),
    };
  }, [activeObjectProps, isTextSelected]);

  const handleSmartTextMouseDown = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const selectionPayload = captureSmartTextSelection();
    dispatch(setSmartTextSelection(selectionPayload));
  }, [captureSmartTextSelection, dispatch]);

  // Clear dialog when text is deselected
  useEffect(() => {
    if (!isTextSelected && activeDialog) {
      dispatch(setTextToolbarDialog(null));
    }
  }, [isTextSelected, activeDialog, dispatch]);

  // ─── Don't render if no text selected ───────────────────────────

  if (!isTextSelected) return null;

  const hAlign = activeObjectProps?.alignment?.horizontal || "left";

  // ─── Render ─────────────────────────────────────────────────────

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <ToolbarOuter
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
      onMouseDown={stopPropagation}
      onWheel={stopPropagation}
    >
      <ToolbarCard>
        
        {/* Left Scroll Indicator */}
        <ScrollIndicator 
           $direction="left" 
           $visible={canScrollLeft} 
           onClick={() => handleArrowScroll("left")}
           aria-label="Scroll left"
        >
          <FaChevronLeft />
        </ScrollIndicator>

        <ScrollArea ref={scrollContainerRef} onScroll={checkScrollability}>
          <TextBtn
            $active={isMultiSelectMode}
            $mobileOnly
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleMultiSelectToggle}
            title={isMultiSelectMode ? "Done selecting" : "Select multiple objects"}
          >
            <MdSelectAll />
            {isMultiSelectMode ? "Done" : "Select"}
          </TextBtn>

          <Sep $mobileOnly />

          {isLegacyText && !isCalendarLocked && (
            <>
              <TextBtn
                $active={activeDialog === "legacyEdit"}
                onClick={() => toggleDialog("legacyEdit")}
                title="Edit legacy text"
              >
                <FaRegEdit style={{ marginRight: 6 }} /> Edit Text
              </TextBtn>
              <Sep />
            </>
          )}

          {/* Edit Text button for new renderer (v2+) - triggers inline editing */}
          {!isLegacyText && !isCalendarLocked && (
            <>
              <TextBtn
                onClick={() => {
                  // Dispatch a synchronous DOM event so Text.jsx can handle
                  // focus() within the same user gesture chain (critical for iOS Safari)
                  document.dispatchEvent(new CustomEvent('text-edit-activate', {
                    detail: { id: activeObjectProps?.id }
                  }));
                }}
                title="Edit text inline"
              >
                <FaRegEdit style={{ marginRight: 6 }} /> Edit
              </TextBtn>
              <Sep />
            </>
          )}

          {/* ── Font Name ── */}
          <FontNameBtn
            $active={activeDialog === "font"}
            onClick={() => toggleDialog("font")}
            title="Change Font"
          >
            <span>{activeObjectProps?.font?.family || "Arial"}</span>
          </FontNameBtn>

          <Sep />

          {/* ── Font Size ── */}
          <SizeGroup ref={sizeGroupRef}>
            <SizeBtn 
              onMouseDown={(e) => e.preventDefault()}
              onClick={decrementFontSize} 
              title="Decrease font size"
            >
              —
            </SizeBtn>
            <SizeValBtn
              $active={showSizeDropdown}
              onClick={() => setShowSizeDropdown(!showSizeDropdown)}
              title="Select font size"
            >
              {currentDisplaySize}
            </SizeValBtn>
            <SizeBtn 
              onMouseDown={(e) => e.preventDefault()}
              onClick={incrementFontSize} 
              title="Increase font size"
            >
              +
            </SizeBtn>
          </SizeGroup>

          {showSizeDropdown && createPortal(
            <SizeDropdown
              ref={sizeDropdownRef}
              style={(() => {
                const rect = sizeGroupRef.current?.getBoundingClientRect();
                if (!rect) return { display: 'none' };
                return {
                  top: rect.bottom + 4,
                  left: rect.left,
                  width: rect.width,
                };
              })()}
            >
              {fontSizes.map((size) => (
                <SizeDropdownItem
                  key={size}
                  $active={size === currentDisplaySize}
                  onClick={() => handleSizeSelect(size)}
                >
                  {size}
                </SizeDropdownItem>
              ))}
            </SizeDropdown>,
            document.body
          )}

          <Sep />

          {/* ── Text Color ── */}
          <ColorBtn
            $active={activeDialog === "colors"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDialog("colors")}
            title="Text Color"
          >
            <span className="color-letter">A</span>
            <span
              className="color-bar"
              style={{ background: activeObjectProps?.color || "#000" }}
            />
          </ColorBtn>

          <Sep />

          {/* ── Bold & Italic ── */}
          <IconBtn
            $active={isUIBoldActive}
            disabled={boldDisabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBold}
            title={boldDisabled ? `Bold unavailable (${currentVariantLabel})` : "Bold"}
            style={boldDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
          >
            <FaBold />
          </IconBtn>
          <IconBtn
            $active={isUIItalicActive}
            disabled={italicDisabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleItalic}
            title={italicDisabled ? `Italic unavailable (${currentVariantLabel})` : "Italic"}
            style={italicDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
          >
            <FaItalic />
          </IconBtn>

          {/* ── Text Style Toggles (Underline, Strikethrough, Uppercase) ── */}
          <IconBtn
            $active={isUIUnderlineActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleDecoration("underline")}
            title="Underline"
          >
            <FaUnderline />
          </IconBtn>
          <IconBtn
            $active={isUIStrikethroughActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggleDecoration("line-through")}
            title="Strikethrough"
          >
            <FaStrikethrough />
          </IconBtn>
          <IconBtn
            $active={isUIUppercaseActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleUppercase}
            title="Uppercase"
          >
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, letterSpacing: '0.02em' }}>aA</span>
          </IconBtn>

          <Sep />

          {/* ── Alignment ── */}
          <IconBtn
            $active={activeDialog === "alignment"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDialog("alignment")}
            title="Text Alignment"
          >
            {hAlign === "center" ? (
              <FaAlignCenter />
            ) : hAlign === "right" ? (
              <FaAlignRight />
            ) : hAlign === "justify" ? (
              <FaAlignJustify />
            ) : (
              <FaAlignLeft />
            )}
          </IconBtn>

          {/* ── Spacing ── */}
          <IconBtn
            $active={activeDialog === "spacing"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleDialog("spacing")}
            title="Spacing"
          >
            <MdFormatLineSpacing />
          </IconBtn>

          <Sep />

          {/* ── Position  (text button)── */}
          <TextBtn
            $active={activeDialog === "position"}
            onClick={() => toggleDialog("position")}
            title="Position & Rotate"
          >
            Position
          </TextBtn>

          {/* ── Smart Text (admins only) ── */}
          {userType !== USER_TYPES.CUSTOMER && (
            <>
              <Sep />
              <TextBtn
                $active={activeDialog === "linked"}
                onMouseDown={handleSmartTextMouseDown}
                onClick={() => toggleDialog("linked")}
                title="Mark as Smart Text, let customers personalize this text"
              >
                <FaTags /> Smart Text
              </TextBtn>
            </>
          )}

          <Sep />

          {/* ── Action Buttons ── */}
          {((activeObjectProps?.disableBackwardForward !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <>
              <IconBtn onClick={handleMagicWords} title="Magic Words">
                <FaMagic />
              </IconBtn>
              <IconBtn onClick={handleBackward} title="Send Backward">
                <BiMinusBack />
              </IconBtn>
              <IconBtn onClick={handleForward} title="Bring Forward">
                <BiMinusFront />
              </IconBtn>
            </>
          )}

          {/* ── Lock/Unlock ── */}
          {((activeObjectProps?.disabledForClient !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <IconBtn
              onClick={handleLock}
              title={activeObjectProps?.locked ? "Unlock" : "Lock"}
            >
              {activeObjectProps?.locked ? <LockObjectIcon /> : <UnLockObjectIcon />}
            </IconBtn>
          )}

          {/* ── Remove ── */}
          {((activeObjectProps &&
            activeObjectProps?.disabledForClient !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <>
              <Sep />
              <IconBtn
                onClick={handleRemove}
                title="Remove"
                style={{ color: "#dc3545" }}
              >
                <BiTrash />
              </IconBtn>
            </>
          )}
        </ScrollArea>

        {/* Right Scroll Indicator */}
        <ScrollIndicator 
           $direction="right" 
           $visible={canScrollRight} 
           onClick={() => handleArrowScroll("right")}
           aria-label="Scroll right"
        >
          <FaChevronRight />
        </ScrollIndicator>

      </ToolbarCard>
    </ToolbarOuter>
  );
}

export default TextFloatingToolbar;
