import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  removeMultipleObjectsInPage,
  deSelectActiveObject,
} from "../../store/slices/canvas";
import { setMultiImageToolbarDialog } from "../../store/slices/appAlice";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { BiTrash } from "react-icons/bi";
import { MdClose } from "react-icons/md";

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

const ToolbarCard = styled.div`
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e6e6e6;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  max-width: calc(100vw - 32px);
  min-height: 44px;
  overflow: hidden;
`;

const ScrollArea = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  overflow-x: auto;
  scroll-behavior: smooth;
  touch-action: pan-x;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  -webkit-overflow-scrolling: touch;
`;

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
  justify-content: ${(p) =>
    p.$direction === "right" ? "flex-end" : "flex-start"};
  padding: 0 8px;
  border: none;
  color: #7b61ff;
  cursor: pointer;
  z-index: 10;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transition: opacity 0.2s ease;

  svg {
    width: 14px;
    height: 14px;
    filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  }
`;

const CountBadge = styled.div`
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  background: #f5f3ff;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-width: 34px;
  border: none;
  border-radius: 8px;
  background: ${(p) =>
    p.$active ? "var(--primary-light, #F0ECFF)" : "transparent"};
  color: ${(p) => (p.$active ? "var(--primary, #7B61FF)" : "#2b2b2b")};
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s ease;

  &:hover {
    background: ${(p) =>
      p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7"};
  }

  svg {
    width: 17px !important;
    height: 17px !important;
    min-width: 17px;
    min-height: 17px;
    display: block;
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
  background: ${(p) =>
    p.$active ? "var(--primary-light, #F0ECFF)" : "transparent"};
  color: ${(p) => (p.$active ? "var(--primary, #7B61FF)" : "#2b2b2b")};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: ${(p) =>
      p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7"};
  }
`;

const Sep = styled.div`
  width: 1px;
  height: 18px;
  background: #ececec;
  margin: 0 4px;
  border-radius: 2px;
  flex-shrink: 0;
`;

function MultiImageFloatingToolbar({ count }) {
  const dispatch = useDispatch();
  const activeDialog = useSelector(
    (state) => state.appSlice.multiImageToolbarDialog
  );

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef(null);

  const checkScrollability = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(
        Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1
      );
    }
  }, []);

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [checkScrollability]);

  useEffect(() => {
    const timer = setTimeout(checkScrollability, 50);
    return () => clearTimeout(timer);
  }, [count, checkScrollability]);

  const handleArrowScroll = (direction) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === "right" ? 150 : -150,
        behavior: "smooth",
      });
    }
  };

  const toggleDialog = useCallback(
    (name) => {
      dispatch(setMultiImageToolbarDialog(activeDialog === name ? null : name));
    },
    [activeDialog, dispatch]
  );

  const handleDeleteAll = useCallback(() => {
    dispatch(removeMultipleObjectsInPage());
    dispatch(setMultiImageToolbarDialog(null));
  }, [dispatch]);

  const handleDeselect = useCallback(() => {
    dispatch(deSelectActiveObject());
    dispatch(setMultiImageToolbarDialog(null));
  }, [dispatch]);

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <ToolbarOuter
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
      onMouseDown={stopPropagation}
      onWheel={stopPropagation}
    >
      <ToolbarCard>
        <ScrollIndicator
          $direction="left"
          $visible={canScrollLeft}
          onClick={() => handleArrowScroll("left")}
          aria-label="Scroll left"
        >
          <FaChevronLeft />
        </ScrollIndicator>

        <ScrollArea ref={scrollContainerRef} onScroll={checkScrollability}>
          <CountBadge>{count} images selected</CountBadge>

          <Sep />

          <TextBtn
            $active={activeDialog === "border"}
            onClick={() => toggleDialog("border")}
            title="Border Settings"
          >
            Border
          </TextBtn>

          <TextBtn
            $active={activeDialog === "shadow"}
            onClick={() => toggleDialog("shadow")}
            title="Shadow Settings"
          >
            Shadow
          </TextBtn>

          <TextBtn
            $active={activeDialog === "adjustments"}
            onClick={() => toggleDialog("adjustments")}
            title="Brightness, Contrast, Saturation, Opacity"
          >
            Adjust
          </TextBtn>

          <TextBtn
            $active={activeDialog === "effects"}
            onClick={() => toggleDialog("effects")}
            title="Image Effects"
          >
            Effects
          </TextBtn>

          <Sep />

          <IconBtn
            onClick={handleDeleteAll}
            title={`Delete ${count} images`}
            style={{ color: "#dc3545" }}
          >
            <BiTrash />
          </IconBtn>

          <IconBtn onClick={handleDeselect} title="Deselect all (Esc)">
            <MdClose />
          </IconBtn>
        </ScrollArea>

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

export default MultiImageFloatingToolbar;
