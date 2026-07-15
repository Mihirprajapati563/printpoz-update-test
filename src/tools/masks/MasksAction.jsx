import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ActionTitle,
  Box,
  DisplayBetween,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import { MasksContent } from "./MasksContent";

let lastScrollTopMasks = 0;

export const MasksAction = () => {
  const dispatch = useDispatch();
  const [showAllView, setShowAllView] = useState(false);
  const scrollMasksRef = useRef(null);
  const needsScrollRestoreMasks = useRef(lastScrollTopMasks > 0);

  // Continuously save scroll position on every scroll event
  useEffect(() => {
    const el = scrollMasksRef.current;
    if (!el) return;
    const handler = () => {
      lastScrollTopMasks = el.scrollTop;
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  });

  // Restore scroll position after masks load on mount
  // Using useLayoutEffect pattern for synchronous restore to prevent blink
  const handleMasksDataLoaded = useCallback(() => {
    if (!needsScrollRestoreMasks.current || lastScrollTopMasks === 0) return;
    
    // Apply scroll synchronously before browser paint
    if (scrollMasksRef.current && lastScrollTopMasks > 0) {
      scrollMasksRef.current.scrollTop = lastScrollTopMasks;
    }
    needsScrollRestoreMasks.current = false;
  }, []);

  return (
    <div
      className="mask-container sticker-container-mob"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Heading - with inline styles for fixed position */}
      {!showAllView && (
        <DisplayBetween
          className="heading-action-mob"
          style={{
            background: "#fff",
            flexShrink: 0,
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <ActionTitle>Masks</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
            style={{ cursor: "pointer" }}
          />
        </DisplayBetween>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollMasksRef}
        className="scroll-container-mob"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: 0,
          padding: showAllView ? "0" : "0 8px", // Remove padding when full view
        }}
      >
        <MasksContent
          showAllView={showAllView}
          setShowAllView={setShowAllView}
          onDataLoaded={handleMasksDataLoaded}
        />
      </div>
    </div>
  );
};
