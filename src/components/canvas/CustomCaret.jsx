import React, { useState, useEffect, useCallback, useRef } from 'react';

const CustomCaret = ({ 
  isEditing, 
  containerRef, 
  item, 
  dynamicLineHeight,
  caretWidth = 2,
  caretColor = "var(--primary, #00C4CC)"
}) => {
  const [caretPos, setCaretPos] = useState({ left: 0, top: 0, height: 0, visible: false });
  const [isNavigating, setIsNavigating] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // Track the last arrow-key direction so updateCaretPosition can pick the
  // correct rect when the collapsed range sits on a soft-wrap boundary.
  //
  //  ↓ / →  →  prefer the LOWER rect  (navDirection = "forward")
  //  ↑ / ←  →  prefer the UPPER rect  (navDirection = "backward")
  //  null   →  no preference (click / programmatic move)
  // ─────────────────────────────────────────────────────────────────────────────
  const navDirectionRef = useRef(null);
  const navTimeoutRef   = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        navDirectionRef.current = "forward";
        setIsNavigating(true);
        clearTimeout(navTimeoutRef.current);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        navDirectionRef.current = "backward";
        setIsNavigating(true);
        clearTimeout(navTimeoutRef.current);
      }
    };
  
    const onKeyUp = (e) => {
      if (e.key.startsWith("Arrow")) {
        navTimeoutRef.current = setTimeout(() => {
          setIsNavigating(false);
          navDirectionRef.current = null;
        }, 200);
      }
    };
  
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup",   onKeyUp);
  
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup",   onKeyUp);
      clearTimeout(navTimeoutRef.current);
    };
  }, []);

  const updateCaretPosition = useCallback(() => {
    if (!isEditing || !containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Hide custom caret when there is an active text selection
    if (!range.collapsed) {
      setCaretPos(prev => prev.visible ? { ...prev, visible: false } : prev);
      return;
    }

    // Ensure the caret is within the contenteditable container
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    // ── Rect selection ────────────────────────────────────────────────────────
    //
    // At soft-wrap boundaries a collapsed range can produce two client rects:
    //   [0] = end of the line above    (higher top value in screen space)
    //   [1] = start of the line below  (lower  top value in screen space)
    //
    // Which one to display depends on what navigation just happened:
    //   • ↓ / → : the caret moved INTO the lower line  → pick the rect with
    //             the LARGER top  (i.e. the lower one on screen)
    //   • ↑ / ← : the caret moved INTO the upper line  → pick the rect with
    //             the SMALLER top (i.e. the upper one on screen)
    //   • click / no key : default to the last rect (original behaviour)
    //
    let rect = null;
    const clientRects = range.getClientRects();

    if (clientRects.length > 1) {
      const sorted = Array.from(clientRects).sort((a, b) => a.top - b.top);
      const dir = navDirectionRef.current;

      if (dir === "forward") {
        rect = sorted[sorted.length - 1]; // lowest rect  → line we moved INTO
      } else if (dir === "backward") {
        rect = sorted[0];                 // highest rect → line we moved INTO
      } else {
        rect = sorted[sorted.length - 1]; // default: last (original behaviour)
      }
    } else if (clientRects.length === 1) {
      rect = clientRects[0];
    } else {
      rect = range.getBoundingClientRect();
    }
    
    // Fallback: empty text node or empty div – use the container's top-left
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      const parentElement = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentElement 
        : range.startContainer;
      
      const parentRect = (parentElement || containerRef.current).getBoundingClientRect();
      rect = {
        left:   parentRect.left,
        top:    parentRect.top,
        height: parseInt(item.font.size) * dynamicLineHeight,
        width:  0
      };
    }

    if (!rect) return;
    
    const fallbackHeight = parseInt(item.font.size) * dynamicLineHeight;

    // ── Coordinate mapping: screen/viewport → SVG local ──────────────────────
    const foreignObj = containerRef.current.closest('foreignObject');
    const svg = foreignObj?.ownerSVGElement;

    if (svg && foreignObj) {
      const ctm = foreignObj.getScreenCTM();
      if (ctm) {
        const inverseCtm = ctm.inverse();

        const ptTopLeft = svg.createSVGPoint();
        ptTopLeft.x = rect.left;
        ptTopLeft.y = rect.top;
        const localTopLeft = ptTopLeft.matrixTransform(inverseCtm);

        const ptBottomLeft = svg.createSVGPoint();
        ptBottomLeft.x = rect.left;
        ptBottomLeft.y = rect.top + (rect.height || fallbackHeight);
        const localBottomLeft = ptBottomLeft.matrixTransform(inverseCtm);

        const localHeight = Math.abs(localBottomLeft.y - localTopLeft.y);
        const fontSize = parseInt(item.font.size);
        const leading = Math.max(0, (localHeight - fontSize) / 2);

        const calculatedTop = localTopLeft.y + leading;

        const isOutOfBounds = calculatedTop < -localHeight || calculatedTop > item.height + localHeight;

        setCaretPos({
          left:    localTopLeft.x,
          top:     calculatedTop,
          height:  fontSize || fallbackHeight,
          visible: !isOutOfBounds
        });
        return;
      }
    }

    // Fallback if SVG/CTM is unavailable
    const containerRect = containerRef.current.getBoundingClientRect();
    const scale = containerRect.height / item.height || 1; 

    const localTop    = (rect.top  - containerRect.top)  / scale;
    const localLeft   = (rect.left - containerRect.left) / scale;
    const localHeight = (rect.height / scale) || fallbackHeight;
    
    const fontSize = parseInt(item.font.size);
    const leading  = Math.max(0, (localHeight - fontSize) / 2);
    const calculatedTop = localTop + leading;

    const isOutOfBounds = calculatedTop < -localHeight || calculatedTop > item.height + localHeight;

    setCaretPos({
      left:    localLeft,
      top:     calculatedTop,
      height:  fontSize || fallbackHeight,
      visible: !isOutOfBounds
    });

  }, [isEditing, containerRef, item, dynamicLineHeight]);

  // Subscribe to all navigation/mutation events
  useEffect(() => {
    if (!isEditing) {
      setCaretPos(prev => prev.visible ? { ...prev, visible: false } : prev);
      return;
    }

    let rafId = null;
    const handleEvent = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => updateCaretPosition());
    };

    // iOS Safari: selectionchange is unreliable inside SVG foreignObject.
    // We also listen to touchend (with a short delay so the selection settles)
    // and touchstart (to immediately hide caret so it doesn't flash at old pos).
    const handleTouchEnd = () => {
      // Small delay so iOS finalizes the selection before we read it
      setTimeout(handleEvent, 50);
    };

    const handleTouchStart = () => {
      // Immediately hide caret during touch to prevent flash at stale position
      setCaretPos(prev => prev.visible ? { ...prev, visible: false } : prev);
    };

    document.addEventListener('selectionchange', handleEvent);
    
    const el = containerRef.current;
    const localEvents = ['input', 'focus'];
    localEvents.forEach(evt => el?.addEventListener(evt, handleEvent));
    el?.addEventListener('touchend', handleTouchEnd);
    el?.addEventListener('touchstart', handleTouchStart);
    
    handleEvent();

    return () => {
      document.removeEventListener('selectionchange', handleEvent);
      localEvents.forEach(evt => el?.removeEventListener(evt, handleEvent));
      el?.removeEventListener('touchend', handleTouchEnd);
      el?.removeEventListener('touchstart', handleTouchStart);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isEditing, updateCaretPosition, containerRef]);

  if (!isEditing || !caretPos.visible) return null;

  const resolvedWidth = caretWidth > 2 ? caretWidth : Math.max(caretWidth, Math.round(parseInt(item.font.size) * 0.035));

  return (
    <>
      <rect 
        x={caretPos.left}
        y={caretPos.top}
        height={caretPos.height}
        width={resolvedWidth}
        fill={caretColor}
        pointerEvents="none"
        style={{
          animation: isNavigating ? "none" : "svg-caret-blink 1s step-end infinite",
        }}
      />
      <style>
        {`
          @keyframes svg-caret-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>
    </>
  );
};

export default CustomCaret;