import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLiveResize } from "./liveResizeStore";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentObjectProperties, setActiveObject, updateMultipleObjects } from "../../store/slices/canvas";
import { INLINE_FORMAT_REGEX } from "../../library/utils/textStyleUtils";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";
import { getMonthYear } from "../../library/utils/common-functions";
import {
  getCalendarSettings,
  getActiveObjectprops,
  getActiveObject,
  getCanvasSize,
  getPageSettings,
  getSettings,
} from "../../library/utils/helpers";
import {
  getMonthName,
  convertNumberToLanguage,
} from "../calendar/DynamicCalendar";
import { USER_TYPES } from "../../library/utils/constants/index.js";
import CustomCaret from "./CustomCaret";

// Firefox measures glyph advance widths slightly wider than Chrome inside
// SVG <foreignObject>, which can push the last word of a line onto an extra
// line (and because the box height is fixed from stored data, the extra line
// gets clipped). Give Firefox a few pixels of horizontal slack so the wrap
// point matches Chrome. This constant is invisible in Chrome.
const IS_FIREFOX =
  typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().indexOf("firefox") !== -1;
const FIREFOX_WRAP_SLACK = IS_FIREFOX ? 8 : 0;


function Text(props) {
  const dispatch = useDispatch();
  const textRef = useRef(null);
  const foreignObjectRef = useRef(null);
  const canvasSize = useSelector(getCanvasSize);
  const textContentRef = useRef(null);
  const [firstRender, setFirstRender] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  // Tracks the height value that was last dispatched by the Firefox height-fix
  // effect. When item.height changes to exactly this value, the effect was
  // triggered by our own dispatch and should NOT re-run (prevents loop).
  // When item.height differs (e.g. after undo), we clear this ref so the
  // effect re-runs and fixes the height again.
  const firefoxFixedHeightRef = useRef(null);
  const calendarSetings = useSelector(getCalendarSettings);
  const lastTapRef = useRef(0);
  const userDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetails);
  const pageSettings = useSelector(getPageSettings);
  const settings = useSelector(getSettings);
  const { item: rawItem, zoomRatio, pageIndex, isActive } = props;
  // Live-resize override: while THIS text is being resized, ItemDragger pushes the
  // live geometry here (no redux dispatch → no MainCanvas re-render). Merge it so
  // React reflows the text in the live box. isLiveResizing gates the self-managing
  // height effects (font auto-grow, Firefox fix) OFF during the gesture so they
  // don't dispatch to redux mid-resize (which would both re-introduce the lag and
  // fight the live geometry); they re-run normally once the resize commits.
  const liveResize = useLiveResize(rawItem.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const isLiveResizing = liveResize != null;

  // Determine effective canvas width for cover pages (half-sheet)
  const isCoverHalfSheet = settings?.isFoldable === true && pageSettings?.isHalfSheet === true;
  const effectiveCanvasWidth = isCoverHalfSheet ? canvasSize.width / 2 : canvasSize.width;

  // Check if using new renderer (version 2+) or legacy
  const useNewRenderer = item.editorVersion && item.editorVersion >= 2;

  // Check if this text object is currently selected
  const isSelected = isActive;

  const hasGradient =
    item.gradient &&
    item.gradient.stops &&
    item.gradient.stops.length >= 2;

  const hasBgGradient =
    item.bgGradient &&
    item.bgGradient.stops &&
    item.bgGradient.stops.length >= 2;

  const getBgGradientCss = () => {
    if (!hasBgGradient) return null;
    const sortedStops = [...item.bgGradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops
      .map((s) => `${s.color?.slice(0, 7) || "#000"} ${s.position}%`)
      .join(", ");
    return item.bgGradient.type === "radial"
      ? `radial-gradient(circle at ${item.bgGradient.radialPosition?.x ?? 50}% ${
          item.bgGradient.radialPosition?.y ?? 50
        }%, ${stopsStr})`
      : `linear-gradient(${item.bgGradient.angle || 90}deg, ${stopsStr})`;
  };

  const getTextGradientStyle = () => {
    if (!hasGradient) return { color: item.color };
    const sortedStops = [...item.gradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops
      .map((s) => `${s.color?.slice(0, 7) || "#000"} ${s.position}%`)
      .join(", ");
    const css =
      item.gradient.type === "radial"
        ? `radial-gradient(circle at ${item.gradient.radialPosition?.x ?? 50}% ${
            item.gradient.radialPosition?.y ?? 50
          }%, ${stopsStr})`
        : `linear-gradient(${item.gradient.angle || 90}deg, ${stopsStr})`;
    return {
      backgroundImage: css,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
    };
  };


  if (
    item.subtype &&
    calendarSetings !== null &&
    calendarSetings !== undefined
  ) {
    const startMonth = parseInt(calendarSetings.startMonth);
    const startYear = parseInt(calendarSetings.startYear);
    const language = calendarSetings.language || "en";
    const { month, year } = getMonthYear(startMonth, startYear, pageIndex);
    if (item.subtype === "month") {
      // Use language-specific month name
      const monthstr = getMonthName(month, language, "full");
      item.text = "" + monthstr;
    } else if (item.subtype === "year") {
      // Convert year to language-specific numbers
      item.text = "" + convertNumberToLanguage(year, language);
    }
  }

  //console.log("zoomRatio", zoomRatio);
  // Get dynamic spacing values with fallback defaults
  const dynamicLineHeight = item.spacing?.lineHeight ?? 1.2;
  const dynamicLetterSpacing = item.spacing?.letterSpacing ?? 0;
  const lineHeight = dynamicLineHeight * parseInt(item.font.size);

  // Track previous text and font to detect actual content changes vs alignment changes
  const previousTextRef = useRef(item.text);
  const previousFontRef = useRef(JSON.stringify(item.font));


  // item.text have multiple line, so want to loop through each line and want to console.log each line
  // console.log(item.text);
  item.text.split("\n").map((line) => {
    // console.log("Lines:" + line);
  });

  // Exit edit mode when object is deselected
  useEffect(() => {
    if (!isSelected && isEditing) {
      setIsEditing(false);
    }
  }, [isSelected, isEditing]);

  // Auto-activate edit mode when a new text object is dropped with autoFocus: true
  useEffect(() => {
    if (item.autoFocus && useNewRenderer && isSelected && !isEditing && textContentRef.current) {
      // 1. Enter edit mode
      setIsEditing(true);

      // 2. Erase the autoFocus flag from Redux so it doesn't loop during undo/redo
      dispatch(
        setCurrentObjectProperties({
          autoFocus: false,
          history: false, // Don't pollute history with the flag clearing
        })
      );

      // 3. Focus and select all text after DOM update
      requestAnimationFrame(() => {
        if (textContentRef.current) {
          if (item.richText) {
            textContentRef.current.innerHTML = item.richText;
          } else {
            textContentRef.current.innerText = item.text;
          }
          textContentRef.current.focus();

          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textContentRef.current);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    }
  }, [item.autoFocus, useNewRenderer, isSelected, isEditing, item.richText, item.text, item.id, dispatch]);


  useEffect(() => {
    if (!textContentRef.current) return;

    const targetHtml = item.richText || "";
    const targetText = item.text || "";

    if (isEditing) {

      if (item.richText) {
        if (textContentRef.current.innerHTML !== targetHtml) {
          textContentRef.current.innerHTML = targetHtml;
        }
      } else {
        if (textContentRef.current.innerText !== targetText) {
          textContentRef.current.innerText = targetText;
        }
      }
    } else {
      // When not editing, always sync Redux -> DOM
      if (item.richText) {
        textContentRef.current.innerHTML = targetHtml;
      } else {
        textContentRef.current.innerText = targetText;
      }
    }
  }, [item.richText, item.text, isEditing]);

  // Auto-resize for NEW renderer (version 2+)
  useEffect(() => {
    if (useNewRenderer && firstRender && !isEditing) {
      // Calculate max width based on effective canvas width (90% of canvas width)
      // For cover pages (half-sheet), use half canvas width
      const maxWidth = Math.floor(effectiveCanvasWidth * 0.9);

      // Measure text width to size the box appropriately (fit to content)
      const widthMeasureDiv = document.createElement("div");
      widthMeasureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-family: ${item.font.family};
        font-size: ${parseInt(item.font.size)}px;
        font-weight: ${item.font.weight};
        font-style: ${item.font.style || "normal"};
      `;
      widthMeasureDiv.textContent = item.text;
      document.body.appendChild(widthMeasureDiv);
      const measuredTextWidth = widthMeasureDiv.offsetWidth + 20; // +20px padding
      document.body.removeChild(widthMeasureDiv);

      // Measure height (wrapping if needed, but we prefer nowrap for initial single line)
      const measureDiv = document.createElement("div");
      measureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        word-wrap: break-word;
        white-space: pre-wrap;
        width: ${maxWidth + FIREFOX_WRAP_SLACK}px;
        font-family: ${item.font.family};
        font-size: ${parseInt(item.font.size)}px;
        font-weight: ${item.font.weight};
        font-style: ${item.font.style || "normal"};
        line-height: ${dynamicLineHeight};
        letter-spacing: ${dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal'};
      `;
      measureDiv.textContent = item.text;
      document.body.appendChild(measureDiv);

      const measuredHeight = measureDiv.offsetHeight + 10;
      document.body.removeChild(measureDiv);

      // Determine width:
      // - If item already has a large width (> 350), keep it (likely pasted/edited)
      // - If item has small default width (≤ 350), expand to 90% canvas width
      // - Always constrain to not exceed canvas bounds
      let newWidth = item.width;
      let newHeight = Math.max(item.height, measuredHeight);

      if (item.width === 300 && item.height === 60) {
        newWidth = Math.min(measuredTextWidth, maxWidth);
        newWidth = Math.max(newWidth, 100);

        if (newWidth !== item.width || newHeight !== item.height) {
          dispatch(
            setCurrentObjectProperties({
              width: newWidth,
              height: newHeight,
              history: false,
            })
          );
        }
      }

      // Deselect the object after initial dispatch processing
      // Only deselect if this text is the sole active object — do NOT fire when
      // the text is part of a multi-select group (isActive would be false then),
      // because that would call deSelectActiveObject and wipe activeObjects.
      if (isActive) {
        dispatch(setCurrentObjectProperties(null));
      }
      setFirstRender(false);
    }
  }, [useNewRenderer, firstRender, isEditing, item.text, item.font, item.width, item.height, dispatch, effectiveCanvasWidth]);

  // Auto-resize when font changes for NEW renderer (version 2+)
  // This handles font family/size/weight/style changes AFTER first render
  useEffect(() => {
    if (isLiveResizing) return; // skip auto-grow while resizing (commits on release)
    if (!useNewRenderer || firstRender || isEditing) return;
    if (!item.text || !item.font) return;

    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ${item.font.family};
      font-size: ${parseInt(item.font.size)}px;
      font-weight: ${item.font.weight};
      font-style: ${item.font.style || "normal"};
      line-height: ${dynamicLineHeight};
      letter-spacing: ${dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal'};
      width: ${item.width + FIREFOX_WRAP_SLACK}px;
    `;
    measureDiv.textContent = item.text;
    document.body.appendChild(measureDiv);

    const measuredHeight = measureDiv.offsetHeight + 10;
    document.body.removeChild(measureDiv);

    // Adjust height to fit text content (both grow and shrink).
    // GUARD on isActive: setCurrentObjectProperties writes to the ACTIVE object,
    // not to this text box. If this box isn't active (e.g. a calendar month/year
    // label whose font changed via the calendar panel while the CALENDAR is
    // selected), an unguarded dispatch stamps this text's measured height onto
    // whatever IS active — collapsing the selected calendar's height. When
    // inactive this effect can't correctly resize itself anyway, so skip it.
    if (isActive && measuredHeight > item.height) {
      dispatch(
        setCurrentObjectProperties({
          height: measuredHeight,
          history: false,
        })
      );
    }
  }, [isActive, isLiveResizing, useNewRenderer, firstRender, isEditing, item.font.family, item.font.size, item.font.weight, item.font.style, item.text, item.width, item.height, dynamicLineHeight, dynamicLetterSpacing, dispatch]);

  // Firefox-only: measure the REAL rendered text inside the foreignObject.
  // Temporarily expand the foreignObject + wrapper to a large height so text
  // reflows unconstrained, read the inner div's actual height via
  // getBoundingClientRect, then restore and dispatch the true height to Redux.
  // Re-runs when item.height changes (e.g. after undo) so the fix reapplies.
  useEffect(() => {
    if (isLiveResizing) return; // skip the Firefox height-fix while resizing
    if (!IS_FIREFOX) return;
    if (!useNewRenderer || isEditing) return;
    if (item.subtype === "month" || item.subtype === "year") return;
    if (!textContentRef.current || !foreignObjectRef.current) return;

    // If item.height is exactly the value we last dispatched, this render was
    // triggered by our own fix — skip to prevent an infinite dispatch loop.
    // If the height changed to a different value (e.g. undo restored original),
    // clear the ref so the effect runs and fixes the height again.
    if (firefoxFixedHeightRef.current !== null) {
      if (item.height === firefoxFixedHeightRef.current) return;
      firefoxFixedHeightRef.current = null;
    }

    // Double rAF so Firefox finishes foreignObject layout before we measure.
    let innerRafId;
    const outerRafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(() => {
        const el = textContentRef.current;
        const fo = foreignObjectRef.current;
        if (!el || !fo) return;

        // Find the wrapper div (direct child of foreignObject)
        const wrapper = fo.querySelector(':scope > div');

        // 1. Temporarily expand foreignObject and wrapper so text is unconstrained
        const origFoHeight = fo.getAttribute('height');
        const origWrapperHeight = wrapper ? wrapper.style.height : null;
        fo.setAttribute('height', '99999');
        if (wrapper) wrapper.style.height = 'auto';

        // 2. Measure the inner text div's actual rendered height via offsetHeight.
        // offsetHeight works in CSS pixels which equals SVG user units inside
        // foreignObject at any zoom level — no CTM conversion needed.
        // (getBoundingClientRect is affected by the SVG zoom/scale and returns
        // screen pixels that produce wildly wrong values when divided by a tiny
        // CTM scaleY.)
        const realHeight = el.offsetHeight;

        // 3. Restore original dimensions
        fo.setAttribute('height', origFoHeight);
        if (wrapper && origWrapperHeight !== null) wrapper.style.height = origWrapperHeight;

        // 4. If Firefox needs more height, update Redux so both parent <g>
        //    wrapper and foreignObject receive the corrected value.
        if (realHeight > item.height + 2) {
          const newHeight = realHeight + 4;
          firefoxFixedHeightRef.current = newHeight;
          dispatch(
            updateMultipleObjects({
              updates: [
                {
                  id: item.id,
                  areaType: item.areaType,
                  height: newHeight,
                },
              ],
              history: false,
            })
          );
        }
      });
    });

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId) cancelAnimationFrame(innerRafId);
    };
  }, [
    isLiveResizing,
    useNewRenderer,
    isEditing,
    item.id,
    item.areaType,
    item.subtype,
    item.height,
    dispatch,
  ]);

  // Auto-resize for LEGACY renderer (using getBBox)
  useEffect(() => {
    if (useNewRenderer) return; // Skip for new renderer

    // Use requestAnimationFrame to ensure the SVG has re-rendered with updated font before measuring
    const measureAndResize = () => {
      if (textRef.current) {
        const bbox = textRef.current.getBBox();

        let newWidth = item.width;
        let newHeight = item.height;
        if (item.width < bbox.width) {
          newWidth = bbox.width;
        }
        if (item.height < bbox.height) {
          newHeight = bbox.height;
        }
        // CRITICAL: Only dispatch if THIS specific text is active, not just any text
        // setCurrentObjectProperties updates the ACTIVE object, so non-active texts would corrupt it
        const isThisTextActive = isActive && item.type === "text";

        if (isThisTextActive && (newWidth !== item.width || newHeight !== item.height)) {
          dispatch(
            setCurrentObjectProperties({
              width: newWidth,
              height: newHeight,
              history: false,
            })
          );
        }
      }

      // deselect the object if it's the first render
      // Only deselect if this text is the sole active object — do NOT fire when
      // the text is part of a multi-select group (isActive would be false then),
      // because that would call deSelectActiveObject and wipe activeObjects.
      if (firstRender) {
        if (isActive) {
          dispatch(setCurrentObjectProperties(null));
        }
        setFirstRender(false);
      }
    };

    requestAnimationFrame(measureAndResize);
  }, [useNewRenderer, item.text, item.font]);

  const calculateTextX = () => {
    if (item.alignment.horizontal === "center") {
      return item.width / 2;
    }
    if (item.alignment.horizontal === "right") {
      return item.width;
    }
    return 0; // 'left' alignment
  };

  const calculateTextY = () => {
    const numberOfLines = item.text.split("\n").length;
    const totalTextHeight = (numberOfLines - 1) * lineHeight;

    if (item.alignment.vertical === "middle") {
      // Centering vertically by subtracting half of the total text height
      let y = item.height / 2 - totalTextHeight / 2;
      return y;
    }
    if (item.alignment.vertical === "bottom") {
      // Aligning to the bottom by subtracting the total text height from the item's height
      return item.height - totalTextHeight - lineHeight / 4; // 'hanging' alignment
    }
    return lineHeight / 4; // 'top' alignment
  };

  // Calculate and expand height if needed
  const calculateAndExpandHeight = useCallback((text) => {
    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ${item.font.family};
      font-size: ${parseInt(item.font.size)}px;
      font-weight: ${item.font.weight};
      font-style: ${item.font.style || "normal"};
      line-height: ${dynamicLineHeight};
      letter-spacing: ${dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal'};
      width: ${item.width + FIREFOX_WRAP_SLACK}px;
    `;
    measureDiv.textContent = text;
    document.body.appendChild(measureDiv);

    const measuredHeight = measureDiv.offsetHeight + 10;
    document.body.removeChild(measureDiv);

    // Only expand height, never shrink
    if (measuredHeight > item.height) {
      dispatch(
        setCurrentObjectProperties({
          height: measuredHeight,
          history: false,
        })
      );
    }
  }, [dispatch, item.font, item.width, item.height]);

  // Listen for 'text-edit-activate' custom DOM event from the floating toolbar Edit button.
  // This fires SYNCHRONOUSLY within the user's tap event chain, which is critical for
  // iOS Safari — it only allows focus() on contentEditable elements within a user gesture.
  useEffect(() => {
    const handleEditActivate = (e) => {
      if (e.detail?.id !== item.id) return;
      if (!useNewRenderer || isEditing) return;
      if (item.subtype === "month" || item.subtype === "year") return;

      // Step 1 (SYNCHRONOUS — within user gesture for iOS):
      // Set contentEditable and focus BEFORE React re-renders.
      if (textContentRef.current) {
        textContentRef.current.contentEditable = 'true';
        textContentRef.current.focus();
      }

      // Step 2: Update React state. This triggers a re-render where
      // {!isEditing && item.text} becomes false, clearing static children.
      setIsEditing(true);

      // Step 3: AFTER React re-renders, set text content and select all.
      // rAF fires after the React commit phase, so the div is now empty
      // and ready for our imperative text + selection.
      requestAnimationFrame(() => {
        if (textContentRef.current) {
          textContentRef.current.innerText = item.text;
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textContentRef.current);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    };

    document.addEventListener('text-edit-activate', handleEditActivate);
    return () => document.removeEventListener('text-edit-activate', handleEditActivate);
  }, [item.id, item.text, item.subtype, useNewRenderer, isEditing]);

  // Handle text input (real-time updates)
  const handleInput = useCallback((e) => {
    const newText = e.target.innerText || "";
    const newHtml = e.target.innerHTML || "";

    // Check if there's inline formatting (u, s, strike, b, i, etc.)
    const hasInlineFormatting = INLINE_FORMAT_REGEX.test(newHtml);

    // Update Redux for real-time preview sync
    dispatch(
      setCurrentObjectProperties({
        text: newText,
        ...(hasInlineFormatting ? { richText: newHtml } : { richText: null }),
      })
    );

    // Auto-expand height if needed
    calculateAndExpandHeight(newText);
  }, [dispatch, calculateAndExpandHeight]);

  // Handle blur to finalize editing
  const handleBlur = useCallback((e) => {
    const newText = e.target.innerText || "";
    const newHtml = e.target.innerHTML || "";

    const hasInlineFormatting = INLINE_FORMAT_REGEX.test(newHtml);

    // Final save with rich text if inline formatting exists
    dispatch(
      setCurrentObjectProperties({
        text: newText,
        ...(hasInlineFormatting ? { richText: newHtml } : { richText: null }),
      })
    );

    setIsEditing(false);
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX: Custom UP/DOWN arrow key handler
  //
  // The browser cannot correctly compute visual line positions for keyboard
  // navigation inside a contentEditable element that lives inside an SVG
  // <foreignObject>. As a result, pressing ↓ sends the caret to the end of
  // the line instead of the character directly below the current position.
  //
  // Solution: intercept ↑ / ↓, read the current caret's SCREEN coordinates,
  // project a point one line-height above/below, and use caretRangeFromPoint
  // (or caretPositionFromPoint) to find the correct DOM position at that point.
  // ─────────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!isEditing) return;

    const isDown = e.key === "ArrowDown";
    const isUp   = e.key === "ArrowUp";
    if (!isDown && !isUp) return;

    // Native browser box-model mapping bug in SVGs specifically affects single-line vertical jumps (preserving X).
    // Paragraph jumps via Ctrl/Meta do not rely on X-coordinates and work correctly natively.
    // Let the browser handle Ctrl + Up/Down (paragraph jumps) directly.
    if (e.ctrlKey || e.metaKey) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Instead of using the entire selection range (which could be multiple lines if Shift is held),
    // we need to track exactly where the caret's "focus" node is (the leading edge of the selection).
    const focusRange = document.createRange();
    focusRange.setStart(selection.focusNode, selection.focusOffset);
    focusRange.collapse(true);

    // Get the pixel rect of the current caret focus point.
    let caretRect = null;
    const rects = focusRange.getClientRects();

    if (rects.length > 0) {
      // Pick the rect that represents where the caret VISUALLY sits.
      // For collapsed ranges getClientRects usually returns exactly one rect,
      // but at soft-wrap boundaries it can return two (end-of-line + start-of-next).
      // We want the one on the LOWER visual line when navigating ↓ and the
      // one on the UPPER visual line when navigating ↑.
      if (rects.length === 1) {
        caretRect = rects[0];
      } else {
        // Soft-wrap boundaries yield two rects. 
        const sorted = Array.from(rects).sort((a, b) => a.top - b.top);
        caretRect = isDown ? sorted[sorted.length - 1] : sorted[0];
      }
    } else {
      caretRect = focusRange.getBoundingClientRect();
    }

    if (!caretRect || (caretRect.width === 0 && caretRect.height === 0)) return;

    // We now know where the caret is on screen.  Compute a probe point that
    // is one font-size (in screen pixels) above or below the caret's midpoint.
    // Using the midpoint of the caret height avoids landing on a line boundary.
    const fontSize = parseInt(item.font.size);
    // Convert local fontSize to approximate screen pixels using the CTM
    const foreignObj = textContentRef.current?.closest('foreignObject');
    const svg = foreignObj?.ownerSVGElement;
    let screenLineHeight = fontSize; // fallback

    if (svg && foreignObj) {
      const ctm = foreignObj.getScreenCTM();
      if (ctm) {
        // Scale factor: how many screen pixels per SVG unit
        const scaleY = Math.sqrt(ctm.b * ctm.b + ctm.d * ctm.d);
        screenLineHeight = fontSize * scaleY * dynamicLineHeight;
      }
    }

    // Target X = current caret horizontal midpoint (preserves column)
    // Target Y = current caret vertical midpoint ± one line's worth of pixels
    const targetX = caretRect.left + (caretRect.width / 2);
    const caretMidY = caretRect.top + caretRect.height / 2;
    const offset = screenLineHeight * (isDown ? 1 : -1);
    const targetY = caretMidY + offset;

    // Use the browser API to find the DOM position at the target screen point
    let targetRange = null;

    if (document.caretRangeFromPoint) {
      // Chrome / Safari / modern browsers
      targetRange = document.caretRangeFromPoint(targetX, targetY);
    } else if (document.caretPositionFromPoint) {
      // Firefox
      const pos = document.caretPositionFromPoint(targetX, targetY);
      if (pos) {
        targetRange = document.createRange();
        targetRange.setStart(pos.offsetNode, pos.offset);
        targetRange.collapse(true);
      }
    }

    // Only apply the new range if it falls inside our contentEditable element
    if (
      targetRange &&
      textContentRef.current &&
      textContentRef.current.contains(targetRange.startContainer)
    ) {
      e.preventDefault(); 
      if (e.shiftKey) {
        // If Shift is held, we EXTEND the selection to the new target coordinate 
        //, preserving the original anchor node!
        selection.extend(targetRange.startContainer, targetRange.startOffset);
      } else {
        // If Shift is not held, we MOVE the caret to the new target coordinate
        selection.removeAllRanges();
        selection.addRange(targetRange);
      }
    }
  }, [isEditing, item.font.size, dynamicLineHeight]);

  // Handle double click to enter edit mode
  const handleDoubleClick = useCallback((e) => {
    // Don't allow editing for calendar subtypes
    if (item.subtype === "month" || item.subtype === "year") return;

    // e.stopPropagation();
    e.preventDefault();

    // LEGACY RENDERER: Use popup editor instead of inline editing
    if (!useNewRenderer) {
      // First, ensure the text object is selected (in case another object was selected)
      dispatch(setActiveObject({ id: item.id, areaType: item.areaType }));

      // Defer textEditMode to next frame so setActiveObject completes first
      // This prevents the flicker caused by two back-to-back dispatches
      requestAnimationFrame(() => {
        dispatch(setCurrentObjectProperties({ textEditMode: true }));
      });
      return;
    }

    setIsEditing(true);


    // Check if editing is disabled for customer
    if (
      user?.userTypeCode === USER_TYPES.CUSTOMER &&
      item?.disableObjectEditing === true
    ) {
      return;
    }

    // Set textEditMode flag to trigger edit popup
    // dispatch(
    //   setCurrentObjectProperties({
    //     textEditMode: true,
    //   })
    // );

    // Focus the element after state update
    requestAnimationFrame(() => {
      if (textContentRef.current) {
        // Load richText (HTML) if available, otherwise plain text
        if (item.richText) {
          textContentRef.current.innerHTML = item.richText;
        } else {
          textContentRef.current.innerText = item.text;
        }
        textContentRef.current.focus();

        // Place cursor at end / select all
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(textContentRef.current);
        // range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
  }, [item.subtype, item.text, item.richText]);

  // With this:
const handleTouchEnd = useCallback((e) => {
  const now = Date.now();
  const timeSinceLastTap = now - lastTapRef.current;

  if (timeSinceLastTap < 350 && timeSinceLastTap > 0) {
    // Double tap detected
    e.preventDefault(); // 🔑 Prevents iOS from firing a ghost click/zoom
    lastTapRef.current = 0; // Reset so triple-tap doesn't re-trigger
    handleDoubleClick(e);
  } else {
    lastTapRef.current = now;
  }
}, [handleDoubleClick]);

// Add this useEffect:
useEffect(() => {
  const element = foreignObjectRef.current?.closest('g') || textRef.current?.closest('g');
  if (!element) return;

  const listener = (e) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 350 && timeSinceLastTap > 0) {
      e.preventDefault();
      lastTapRef.current = 0;
      handleDoubleClick(e);
    } else {
      lastTapRef.current = now;
    }
  };

  element.addEventListener('touchend', listener, { passive: false }); // passive:false allows preventDefault
  return () => element.removeEventListener('touchend', listener);
}, [handleDoubleClick]);

// And REMOVE onTouchEnd from both <g> elements since the useEffect handles it now

  // Handle mouse events to allow text selection when editing
  const handleMouseDown = useCallback((e) => {
    if (isEditing) {
      // Allow default behavior for text selection
      e.stopPropagation();
    }
  }, [isEditing]);

  const handleClick = useCallback((e) => {
    if (isEditing) {
      e.stopPropagation();
    }
  }, [isEditing]);

  // Handle legacy text input for SVG
  const onInputEdit = useCallback((e) => {
    dispatch(
      setCurrentObjectProperties({
        id: item.id, // Ensure you're updating the correct object
        text: e.target.textContent,
      })
    );
  }, [dispatch, item.id]);

  // Get horizontal alignment CSS for new renderer
  const getHorizontalAlign = () => {
    switch (item.alignment?.horizontal) {
      case "center":
        return "center";
      case "right":
        return "right";
      case "justify":
        return "justify";
      default:
        return "left";
    }
  };

  // Get vertical alignment CSS for new renderer
  const getVerticalAlign = () => {
    switch (item.alignment?.vertical) {
      case "middle":
        return "center";
      case "bottom":
        return "flex-end";
      default:
        return "flex-start"; // top
    }
  };

  // ============================================
  // NEW RENDERER (Version 2+): foreignObject
  // Supports word-wrap, justify, all alignments
  // With inline editing support
  // ============================================
  if (useNewRenderer) {
    const textColorStyle = getTextGradientStyle();
    const bgGradientCss = getBgGradientCss();
    return (
      <g
        className="fade-animate"
        key={item.id + "Text"}
        style={{
          cursor: isEditing ? "text" : "default",
          touchAction: "none",
          WebkitTouchCallout: "none",
        }}
        onDoubleClick={handleDoubleClick}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background gradient definition */}
        {hasBgGradient && <TextBackgroundGradientDef item={item} />}

        {/* Background Rectangle */}
        <rect
          x={0}
          y={0}
          width={item.width}
          height={item.height}
          fill={hasBgGradient ? `url(#text-bg-gradient-${item.id})` : (item.bgcolor || "none")}
          stroke={item.style.border.color || "none"}
          strokeWidth={item.style.border.width || 0}
          rx={item.style.border.radius || 0}
          pointerEvents="all"
        />

        {/* Render caret BEFORE foreignObject so it paints underneath and never
            intercepts touch/pointer events on iOS Safari */}
        <CustomCaret 
          isEditing={isEditing} 
          containerRef={textContentRef} 
          item={item} 
          dynamicLineHeight={dynamicLineHeight} 
          caretWidth={5}
          caretColor={item.color}
        />

        {/* Text using foreignObject for all alignments */}
        {/* pointerEvents="none" when not editing so clicks pass through to Canvas's parent g for selection */}
        <foreignObject
          ref={foreignObjectRef}
          x={0}
          y={0}
          width={item.width + FIREFOX_WRAP_SLACK}
          height={item.height}
          style={{ overflow: item.subtype ? "visible" : "hidden" }}
          pointerEvents={isEditing ? "all" : "none"}
          className={item.subtype ? `cal-${item.subtype}` : undefined}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: getVerticalAlign(),
              padding: 0,
              margin: 0,
              boxSizing: "border-box",
              overflow: "visible", // prevent browser forced overlay scroll
              // Firefox reserves scrollbar gutter width inside foreignObject
              // even when overflow is visible, shrinking the available text
              // width and causing a word to wrap onto an extra line. Disable.
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              pointerEvents: isEditing ? "auto" : "none",
              ...(hasBgGradient && { background: bgGradientCss }),
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
          >
            <div
              ref={textContentRef}
              contentEditable={isEditing}
              suppressContentEditableWarning={true}
              className={item.subtype ? `cal-${item.subtype}-text` : undefined}
              onBlur={handleBlur}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              onScroll={(e) => {
                // Prevent browser text shifting when navigating around hidden bounds
                if (e.target.scrollTop !== 0) e.target.scrollTop = 0;
                if (e.target.scrollLeft !== 0) e.target.scrollLeft = 0;
              }}
              style={{
                fontFamily: item.font.family,
                fontSize: `${parseInt(item.font.size)}px`,
                fontWeight: item.font.weight,
                fontStyle: item.font.style || "normal",
                textDecoration: item.font.decoration || "none",
                textTransform: item.textTransform || "none",
                color: item.color,
                ...textColorStyle,
                textAlign: getHorizontalAlign(),
                textJustify: item.alignment?.horizontal === "justify" ? "inter-word" : "auto",
                lineHeight: dynamicLineHeight,
                letterSpacing: dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal',
                // Half-leading compensation only when vertically centered.
                // Applying it for top/bottom alignment causes Firefox to clip
                // the first line's ascenders inside foreignObject.
                marginTop: (dynamicLineHeight > 1 && item.alignment?.vertical === "middle")
                  ? `-${((dynamicLineHeight - 1) * parseInt(item.font.size)) / 2}px`
                  : '0',
                whiteSpace: item.subtype ? "nowrap" : "pre-wrap",
                wordBreak: item.subtype ? "normal" : "break-word",
                overflowWrap: item.subtype ? "normal" : "anywhere",
                boxSizing: "border-box",
                // Force identical advance-width measurement across browsers.
                // Firefox applies kerning/ligatures inside SVG foreignObject
                // while Chrome does not, which can push a word onto an extra
                // line (e.g. "world." wrapping differently). The CSS kerning
                // properties aren't always honored in Firefox SVG contexts,
                // so we also use the lower-level font-feature-settings.
                fontFeatureSettings: '"kern" 0, "liga" 0, "calt" 0, "clig" 0',
                fontKerning: "none",
                fontVariantLigatures: "none",
                textRendering: "geometricPrecision",
                overflow: "visible",  // physically prevent browser scrolling box model
                // Firefox reserves scrollbar gutter width inside foreignObject
                // even with overflow:visible; disable to reclaim those pixels.
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                opacity: item.style.opacity,
                filter: `brightness(${item.style.effects.brightness}%) contrast(${item.style.effects.contrast}%) saturate(${item.style.effects.saturation}%) grayscale(${item.style.effects.grayscale}%) sepia(${item.style.effects.sepia}%) blur(${item.style.effects.blur}px)`,
                outline: "none",
                minHeight: "1em",
                cursor: isEditing ? "text" : "inherit",
                userSelect: isEditing ? "text" : "none",
                WebkitUserSelect: isEditing ? "text" : "none",
                MozUserSelect: isEditing ? "text" : "none",
                WebkitTouchCallout: isEditing ? "default" : "none",
                touchAction: isEditing ? "manipulation" : "none", // suppress iOS 300ms delay & double-tap-zoom when editing
                pointerEvents: isEditing ? "auto" : "none",
                caretColor: "transparent", // Hide the native caret
              }}
            >
              {/* Content managed entirely via useEffect to prevent dual-rendering during edit transitions */}
            </div>
          </div>
        </foreignObject>
      </g>
    );
  }

  // ============================================
  // LEGACY RENDERER: Original SVG-based rendering
  // Exact code from main branch - NO justify support
  // ============================================
  return (
    <g
      className={`fade-animate${item.subtype ? ` cal-${item.subtype}` : ""}`}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      key={item.id + "Text"}
      style={{
        cursor: item.editable ? "text" : "default",
        touchAction: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* Gradient definitions */}
      {hasGradient && <TextGradientDef item={item} />}
      {hasBgGradient && <TextBackgroundGradientDef item={item} />}

      {/* Background Rectangle */}
      <rect
        x={0}
        y={0}
        width={item.width}
        height={item.height}
        fill={hasBgGradient ? `url(#text-bg-gradient-${item.id})` : (item.bgcolor || "none")}
        stroke={item.style.border.color || "none"}
        strokeWidth={item.style.border.width || 0}
        rx={item.style.border.radius || 0}
      />

      {/* Text */}
      <text
        ref={textRef}
        x={calculateTextX()} // Calculate x position based on alignment
        y={calculateTextY()} // Calculate y position based on alignment
        fontSize={parseInt(item.font.size)} // Adjust font size based on zoom
        fontWeight={item.font.weight}
        fontFamily={item.font.family}
        textDecoration={item.font.decoration}
        fontStyle={item.font.style}
        fill={hasGradient ? `url(#text-gradient-${item.id})` : item.color}
        xmlSpace="preserve"
        textAnchor={
          item.alignment.horizontal === "center"
            ? "middle"
            : item.alignment.horizontal === "right"
              ? "end"
              : "start"
        }
        dominantBaseline={
          item.alignment.vertical === "middle"
            ? "middle"
            : item.alignment.vertical === "bottom"
              ? "baseline"
              : "hanging"
        }
      >
        {item.text.split("\n").map((line, index) => (
          <tspan
            key={index}
            x={calculateTextX()} // Set the x position for each line
            dy={index === 0 ? 0 : `${dynamicLineHeight}em`} // Dynamic line height
            style={{
              opacity: item.style.opacity,
              letterSpacing: dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal',
              filter: `brightness(${item.style.effects.brightness}%) contrast(${item.style.effects.contrast}%) saturate(${item.style.effects.saturation}%) grayscale(${item.style.effects.grayscale}%) sepia(${item.style.effects.sepia}%) blur(${item.style.effects.blur}px)`,
              fontSize: `${parseInt(item.font.size)}px`,
              fontWeight: item.font.weight,
              fontFamily: item.font.family,
              fontStyle: item.font.style,
              textDecoration: item.font.decoration,
            }}
          >
            {line.trim() === "" ? "\u00A0" : line}{" "}
            {/* Handle blank lines by inserting a non-breaking space */}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// Memoized: with stable `item` identity (see getAllObjectsSortedByZIndex) and
// primitive isActive/zoomRatio/pageIndex props, this re-renders only when THIS
// text object actually changes — not on every drag/zoom frame of another object.
export default React.memo(Text);

const TextGradientDef = ({ item }) => {
  if (!item.gradient || !item.gradient.stops || item.gradient.stops.length < 2) return null;

  const sortedStops = [...item.gradient.stops].sort((a, b) => a.position - b.position);
  const isRadial = item.gradient.type === "radial";

  return (
    <defs>
      {isRadial ? (
        <radialGradient
          id={`text-gradient-${item.id}`}
          {...getRadialGradientCoords(item.gradient.radialPosition)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </radialGradient>
      ) : (
        <linearGradient
          id={`text-gradient-${item.id}`}
          {...getLinearGradientCoords(item.gradient.angle || 90)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </linearGradient>
      )}
    </defs>
  );
};

const TextBackgroundGradientDef = ({ item }) => {
  if (!item.bgGradient || !item.bgGradient.stops || item.bgGradient.stops.length < 2) return null;

  const sortedStops = [...item.bgGradient.stops].sort((a, b) => a.position - b.position);
  const isRadial = item.bgGradient.type === "radial";

  return (
    <defs>
      {isRadial ? (
        <radialGradient
          id={`text-bg-gradient-${item.id}`}
          {...getRadialGradientCoords(item.bgGradient.radialPosition)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </radialGradient>
      ) : (
        <linearGradient
          id={`text-bg-gradient-${item.id}`}
          {...getLinearGradientCoords(item.bgGradient.angle || 90)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </linearGradient>
      )}
    </defs>
  );
};
