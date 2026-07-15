import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { getActiveObjectprops } from "../../library/utils/helpers";
import { setStickerToolbarDialog } from "../../store/slices/appAlice";
import PositionSettingsPanel from "../object-settings/position/PositionSettingsPanel";
import {
  SetOpacityInline,
  AdjustmentsInline,
  ImageShadowsInline,
  SetBorderInline,
} from "../object-settings/image/ImageSettingsPanel";
import { GrPowerReset } from "react-icons/gr";
import { setCurrentObjectProperties } from "../../store/slices/canvas";
import { Box } from "../../common-components/StyledComponents";

// ─── Styled Components (same pattern as ImageToolbarDialogPanel) ──────

const MOBILE_BREAKPOINT = 576;

const PanelOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
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
  touch-action: none;

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    width: calc(100vw - 20px);
    max-height: 60vh;
    border-radius: 10px;
  }
`;

const DragGrip = styled.div`
  display: flex;
  justify-content: center;
  padding: 6px 0 2px;
  cursor: grab;
  &:active { cursor: grabbing; }
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
  &:active { cursor: grabbing; }
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
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover { background: #f0f0f0; color: #333; }
`;

const PanelBody = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
`;

const ResetBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: #f8f9fa;
  color: #495057;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover { background: #e9ecef; border-color: #dee2e6; }
`;

// ─── Main Component ───────────────────────────────────────────────────

const DIALOG_TITLES = {
  position: "Position",
  border: "Border",
  shadow: "Shadow",
  adjustments: "Adjustments & Opacity",
};

function StickerToolbarDialogPanel() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const activeDialog = useSelector((state) => state.appSlice.stickerToolbarDialog);

  const DEFAULT_POS = { x: 100, y: 70 };
  const savedPositionsRef = useRef({});
  const [panelPos, setPanelPos] = useState(DEFAULT_POS);
  const panelPosRef = useRef(DEFAULT_POS);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0, inputType: null });
  const prevDialogRef = useRef(null);
  const panelRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);

  const isStickerSelected = activeObjectProps && activeObjectProps.type === "sticker";

  useEffect(() => { panelPosRef.current = panelPos; }, [panelPos]);

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
    const panelWidth = panelRef.current?.offsetWidth || Math.min(vw - 32, 360);
    return { x: Math.max(10, (vw - panelWidth) / 2), y: 12 };
  }, []);

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

  const handlePointerMove = useCallback((event) => {
    if (!dragRef.current.dragging) return;
    const isTouch = dragRef.current.inputType === "touch";
    const point = isTouch ? event.touches?.[0] : event;
    if (!point) return;
    event.preventDefault();
    setPanelPos(clampPos({
      x: point.clientX - dragRef.current.offsetX,
      y: point.clientY - dragRef.current.offsetY,
    }));
  }, [clampPos]);

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

  const handlePointerDown = useCallback((event) => {
    if (event.target?.closest("[data-no-drag='true']")) return;
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
  }, [handlePointerMove, handlePointerUp, startDragging]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleClose = () => dispatch(setStickerToolbarDialog(null));

  if (!activeDialog || !isStickerSelected) return null;

  const title = DIALOG_TITLES[activeDialog] || "Sticker";

  const renderContent = () => {
    switch (activeDialog) {
      case "position":
        return (
          <Box mt="10px" data-no-drag="true">
            <PositionSettingsPanel />
          </Box>
        );
      case "border":
        return (
          <div data-no-drag="true">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold" style={{ fontSize: 13 }}>Border Settings</span>
              <ResetBtn
                onClick={() =>
                  dispatch(setCurrentObjectProperties({ border: { color: "#000000", width: 0, radius: 0 } }))
                }
              >
                <GrPowerReset />
              </ResetBtn>
            </div>
            <SetBorderInline activeObjectProps={activeObjectProps} />
          </div>
        );
      case "shadow":
        return (
          <div data-no-drag="true">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold" style={{ fontSize: 13 }}>Shadow Settings</span>
              <ResetBtn
                onClick={() =>
                  dispatch(setCurrentObjectProperties({ shadow: { color: "#000000", offsetX: 0, offsetY: 0, blurRadius: 0 } }))
                }
              >
                <GrPowerReset />
              </ResetBtn>
            </div>
            <ImageShadowsInline activeObjectProps={activeObjectProps} />
          </div>
        );
      case "adjustments":
        return (
          <div data-no-drag="true">
            <SetOpacityInline activeObjectProps={activeObjectProps} />
            <div className="my-4 border-bottom" />
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold" style={{ fontSize: 13 }}>Adjustments</span>
              <ResetBtn
                onClick={() =>
                  dispatch(setCurrentObjectProperties({ effects: { brightness: 0, contrast: 0, saturation: 0 } }))
                }
              >
                <GrPowerReset />
              </ResetBtn>
            </div>
            <AdjustmentsInline activeObjectProps={activeObjectProps} />
          </div>
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
        onPointerDown={stopPropagation}
        onTouchStart={stopPropagation}
        onMouseDown={stopPropagation}
        onWheel={stopPropagation}
      >
        <DragGrip onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}>
          <div className="grip-dots" />
        </DragGrip>
        <PanelHeader onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}>
          <h3>{title}</h3>
          <CloseButton data-no-drag="true" onClick={handleClose} title="Close">
            <button className="close" type="button" style={{ border: "none", background: "none" }}>&#x2715;</button>
          </CloseButton>
        </PanelHeader>
        <PanelBody>{renderContent()}</PanelBody>
      </PanelContainer>
    </>,
    document.body
  );
}

export default StickerToolbarDialogPanel;
