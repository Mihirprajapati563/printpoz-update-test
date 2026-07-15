import React, { useEffect, useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  getActiveObjectprops,
  getEditorMenuItems,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  sendBackward,
  sendForward,
  removeObjectInPage,
  deSelectActiveObject,
} from "../../store/slices/canvas";
import {
  setActiveActionIndex,
  setIsActionActive,
  setIsMultiSelectMode,
  setQrcodeToolbarDialog,
} from "../../store/slices/appAlice";
import { ReactComponent as LockObjectIcon } from "../../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../../assets/icons/unlock121.svg";
import { BiMinusBack, BiMinusFront, BiTrash } from "react-icons/bi";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { MdSelectAll } from "react-icons/md";
import { IoQrCodeOutline } from "react-icons/io5";
import { USER_TYPES } from "../../library/utils/constants";
import { getUserDetails } from "../../library/utils/services/theme";
import { FaRegEdit } from "react-icons/fa";

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
  justify-content: ${(p) => (p.$direction === "right" ? "flex-end" : "flex-start")};
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

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-width: 34px;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? "var(--primary-light, #EFF8FF)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--primary, #4084B5)" : "#2b2b2b")};
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s ease;

  &:hover {
    background: ${(p) => (p.$active ? "var(--primary-light, #EFF8FF)" : "#f5f5f7")};
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
  background: ${(p) => (p.$active ? "var(--primary-light, #EFF8FF)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--primary, #4084B5)" : "#2b2b2b")};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  ${(p) =>
    p.$mobileOnly &&
    `
    @media (min-width: 769px) {
      display: none;
    }
  `}

  &:hover {
    background: ${(p) => (p.$active ? "var(--primary-light, #EFF8FF)" : "#f5f5f7")};
  }

  svg {
    width: 14px !important;
    height: 14px !important;
    min-width: 14px;
    min-height: 14px;
    display: block;
    flex-shrink: 0;
    margin-right: 6px;
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

const UrlLabel = styled.span`
  font-size: 11px;
  color: #6b7280;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
  flex-shrink: 0;
`;

function QRCodeFloatingToolbar() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const editorMenuItems = useSelector(getEditorMenuItems);
  const activeDialog = useSelector((state) => state.appSlice.qrcodeToolbarDialog);
  const isMultiSelectMode = useSelector((state) => state.appSlice.isMultiSelectMode);
  const user = getUserDetails();
  const userType = user?.userTypeCode || -1;

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef(null);

  const isQrSelected = activeObjectProps && activeObjectProps.type === "qrcode";

  const checkScrollability = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
    }
  }, []);

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [checkScrollability]);

  useEffect(() => {
    if (isQrSelected) {
      const timer = setTimeout(checkScrollability, 50);
      return () => clearTimeout(timer);
    }
  }, [isQrSelected, checkScrollability]);

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
      dispatch(setQrcodeToolbarDialog(activeDialog === name ? null : name));
    },
    [activeDialog, dispatch]
  );

  useEffect(() => {
    if (!isQrSelected && activeDialog) {
      dispatch(setQrcodeToolbarDialog(null));
    }
  }, [isQrSelected, activeDialog, dispatch]);

  const handleBackward = useCallback(() => dispatch(sendBackward()), [dispatch]);
  const handleForward = useCallback(() => dispatch(sendForward()), [dispatch]);

  const handleRemove = useCallback(() => {
    dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
    dispatch(setCurrentObjectProperties(null));
  }, [activeObjectProps, dispatch]);

  const handleLock = useCallback(() => {
    dispatch(setCurrentObjectProperties({ locked: !activeObjectProps?.locked }));
  }, [activeObjectProps, dispatch]);

  const handleOpenEditAction = useCallback(() => {
    const qrActionIndex = editorMenuItems.findIndex((item) => item.title === "QR Code");
    if (qrActionIndex !== -1) {
      dispatch(setActiveActionIndex(qrActionIndex));
      dispatch(setIsActionActive(true));
    }
  }, [dispatch, editorMenuItems]);

  const handleMultiSelectToggle = useCallback(() => {
    const nextMode = !isMultiSelectMode;
    dispatch(setIsMultiSelectMode(nextMode));
    if (!nextMode) dispatch(deSelectActiveObject());
  }, [dispatch, isMultiSelectMode]);

  if (!isQrSelected) return null;

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
          <TextBtn
            $active={isMultiSelectMode}
            $mobileOnly
            onClick={handleMultiSelectToggle}
            title={isMultiSelectMode ? "Done selecting" : "Select multiple objects"}
          >
            <MdSelectAll />
            {isMultiSelectMode ? "Done" : "Select"}
          </TextBtn>

          <TextBtn onClick={handleOpenEditAction} title="Edit">
          <FaRegEdit style={{ marginRight: 6 }} /> Edit
          </TextBtn>

          <TextBtn
            $active={activeDialog === "position"}
            onClick={() => toggleDialog("position")}
            title="Position, Size & Rotate"
          >
            Position
          </TextBtn>

          <Sep />

          {((activeObjectProps?.disableBackwardForward !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <>
              <IconBtn onClick={handleBackward} title="Send Backward">
                <BiMinusBack />
              </IconBtn>
              <IconBtn onClick={handleForward} title="Bring Forward">
                <BiMinusFront />
              </IconBtn>
            </>
          )}

          {((activeObjectProps?.disabledForClient !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <IconBtn
              onClick={handleLock}
              title={activeObjectProps?.locked ? "Unlock" : "Lock"}
            >
              {activeObjectProps?.locked ? (
                <LockObjectIcon style={{ width: 16, height: 16 }} />
              ) : (
                <UnLockObjectIcon style={{ width: 16, height: 16 }} />
              )}
            </IconBtn>
          )}

          {((activeObjectProps &&
            activeObjectProps?.disabledForClient !== true &&
            userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <>
              <Sep />
              <IconBtn
                onClick={handleRemove}
                title="Remove QR Code"
                style={{ color: "#dc3545" }}
              >
                <BiTrash />
              </IconBtn>
            </>
          )}
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

export default QRCodeFloatingToolbar;
