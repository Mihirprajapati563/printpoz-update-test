import React, { useEffect, useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  getActiveObjectprops,
  getSettings,
  getEditorMenuItems,
  getCurrentActiveSize,
  getPageSettings,
  getActivePageBgImage,
  getActiveSideBounds,
  getIsSpreadPage,
  getAllObjectsOfAllLayoutsOfCurrentPage,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  sendBackward,
  sendForward,
  removeObjectInPage,
  setBackgroundImage,
  addBackgroundImageToHistory,
  removePhotoFromHistory,
  deSelectActiveObject,
} from "../../store/slices/canvas";
import {
  setImageToolbarDialog,
  setActiveActionIndex,
  setIsActionActive,
  setIsMultiSelectMode,
} from "../../store/slices/appAlice";
import { ReactComponent as LockObjectIcon } from "../../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../../assets/icons/unlock121.svg";
import {
  BiMinusBack,
  BiMinusFront,
  BiTrash,
  BiHorizontalCenter,
  BiVerticalCenter,
  BiExpand,
  BiImage,
  BiRefresh,
  BiCrop,
} from "react-icons/bi";
import { FiZoomOut, FiZoomIn } from "react-icons/fi";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { TbBackground } from "react-icons/tb";
import { PiPaintBrushFill } from "react-icons/pi";
import { USER_TYPES } from "../../library/utils/constants";
import { getUserDetails } from "../../library/utils/services/theme";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { useSearchParams } from "react-router-dom";
import { refreshProjectImages } from "../../store/slices/imageUpload";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog";
import { setDragger } from "../../store/slices/canvas";
import { LiaCompressArrowsAltSolid } from "react-icons/lia";
import { MdSelectAll } from "react-icons/md";

// ─── Styled Components (identical to TextFloatingToolbar) ────────────

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

  /* Hide standard scrollbars for clean UX */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  /* Force smooth hardware scrolling on iOS */
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

  ${(p) => p.$mobileOnly && `
    @media (min-width: 769px) {
      display: none;
    }
  `}

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

  ${(p) => p.$mobileOnly && `
    @media (min-width: 769px) {
      display: none;
    }
  `}

  &:hover {
    background: ${(p) =>
      p.$active ? "var(--primary-light, #F0ECFF)" : "#f5f5f7"};
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

// ─── Main Component ──────────────────────────────────────────────────

function ImageFloatingToolbar() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const activeDialog = useSelector(
    (state) => state.appSlice.imageToolbarDialog
  );
  const settings = useSelector(getSettings);
  const canvasSize = useSelector(getCurrentActiveSize);
  const pageSettings = useSelector(getPageSettings);
  const editorMenuItems = useSelector(getEditorMenuItems);
  const activeBackgroundImage = useSelector(getActivePageBgImage);
  const activeSideBounds = useSelector(getActiveSideBounds);
  const isSpreadPage = useSelector(getIsSpreadPage);
  const layoutMode = useSelector((state) => state.appSlice.layoutMode);
  const allCurrentPageObjects = useSelector(getAllObjectsOfAllLayoutsOfCurrentPage);
  const isMultiSelectMode = useSelector((state) => state.appSlice.isMultiSelectMode);
  const projectSetup = useSelector((state) => state.projectSetup);
  const user = getUserDetails();
  const userType = user?.userTypeCode || -1;
  const [searchParams] = useSearchParams();
  const autoRemoveTriggeredRef = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showBgRemoveConfirm, setShowBgRemoveConfirm] = useState(false);
  const scrollContainerRef = useRef(null);
  const isImageSelected =
    activeObjectProps && activeObjectProps.type === "img";
  const hasBackgroundImage = Boolean(activeBackgroundImage);

  const hasUrl =
    isImageSelected &&
    activeObjectProps?.url &&
    activeObjectProps?.url !== "";

  // ─── Scroll Detection Logic ────────────────────────────────────
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
    if (isImageSelected) {
      const timer = setTimeout(checkScrollability, 50);
      return () => clearTimeout(timer);
    }
  }, [isImageSelected, checkScrollability]);

  const handleArrowScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 150;
      scrollContainerRef.current.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // ─── Dialog toggle ─────────────────────────────────────────────

  const toggleDialog = useCallback(
    (name) => {
      dispatch(setImageToolbarDialog(activeDialog === name ? null : name));
    },
    [activeDialog, dispatch]
  );

  // Clear dialog when image is deselected
  useEffect(() => {
    if (!isImageSelected && activeDialog) {
      dispatch(setImageToolbarDialog(null));
    }
  }, [isImageSelected, activeDialog, dispatch]);

  // ─── Auto background removal (from ImageSettingsPopover) ──────

  useEffect(() => {
    if (
      userType === USER_TYPES.CUSTOMER &&
      activeObjectProps?.autoBackgroundRemove === true &&
      (activeObjectProps?.url || activeObjectProps?.urls?.length > 0) &&
      !activeObjectProps?.isProcessing &&
      !autoRemoveTriggeredRef.current
    ) {
      autoRemoveTriggeredRef.current = true;
      handleRemoveBackground();
    }
    if (!activeObjectProps?.autoBackgroundRemove) {
      autoRemoveTriggeredRef.current = false;
    }
  }, [activeObjectProps?.id, activeObjectProps?.autoBackgroundRemove]);

  // ─── Image actions ─────────────────────────────────────────────

  const zoomOut = useCallback(() => {
    if (!isImageSelected) return;
    const image = activeObjectProps.image;
    if (image.scale === undefined || isNaN(image.scale)) {
      dispatch(
        setCurrentObjectProperties({ image: { ...image, scale: 1 } })
      );
      return;
    }

    const boxWidth =
      activeObjectProps.width * (activeObjectProps.transform?.scale?.x ?? 1);
    const boxHeight =
      activeObjectProps.height * (activeObjectProps.transform?.scale?.y ?? 1);
    const minCoverScale = Math.max(
      boxWidth / image.width,
      boxHeight / image.height
    );

    let scalVal = image.scale - 0.1;
    if (scalVal < minCoverScale) scalVal = minCoverScale;
    scalVal = Number(scalVal.toFixed(4));

    const newImageWidth = image.width * scalVal;
    const newImageHeight = image.height * scalVal;
    let posX = image.positionX;
    let posY = image.positionY;
    if (posX + newImageWidth < boxWidth) posX = boxWidth - newImageWidth;
    if (posY + newImageHeight < boxHeight) posY = boxHeight - newImageHeight;

    dispatch(
      setCurrentObjectProperties({
        image: { ...image, scale: scalVal, positionX: posX, positionY: posY },
      })
    );
  }, [activeObjectProps, dispatch, isImageSelected]);

  const zoomIn = useCallback(() => {
    if (!isImageSelected) return;
    const image = activeObjectProps.image;
    if (image.scale === undefined || isNaN(image.scale)) {
      dispatch(
        setCurrentObjectProperties({ image: { ...image, scale: 1 } })
      );
      return;
    }
    let scalVal = image.scale + 0.1;
    if (scalVal > 15) scalVal = 15;
    dispatch(
      setCurrentObjectProperties({
        image: { ...image, scale: parseFloat(scalVal.toFixed(1)) },
      })
    );
  }, [activeObjectProps, dispatch, isImageSelected]);

  const handleFlipX = useCallback(() => {
    if (!isImageSelected) return;
    dispatch(
      setCurrentObjectProperties({
        flip: { ...activeObjectProps.flip, x: !activeObjectProps.flip?.x },
      })
    );
  }, [activeObjectProps, dispatch, isImageSelected]);

  const handleFlipY = useCallback(() => {
    if (!isImageSelected) return;
    dispatch(
      setCurrentObjectProperties({
        flip: { ...activeObjectProps.flip, y: !activeObjectProps.flip?.y },
      })
    );
  }, [activeObjectProps, dispatch, isImageSelected]);

  const handleFitToPage = useCallback(() => {
     if (!isImageSelected || !canvasSize || !activeSideBounds) return;

    const image = activeObjectProps.image;

    // Honor the footer's Page/Spread toggle. "Spread" mode on a spread-eligible
    // page fills the whole canvas; "Page" mode (or pages that aren't spread
    // pages at all) falls back to the active side's bounds.
    const useSpreadBounds = isSpreadPage && layoutMode === "spread";
    const currentScope = useSpreadBounds ? "spread" : "page";

    // Click behavior with a saved snapshot:
    //   - Same scope as before → user wants to toggle OFF (restore original).
    //   - Different scope     → user wants to RE-FIT to the new scope (e.g.,
    //                           switched from Page mode to Spread mode and
    //                           clicked again to expand the background to the
    //                           whole spread). Drop into the fit path below.
    if (activeObjectProps.fitToPageSnapshot) {
      const snapshot = activeObjectProps.fitToPageSnapshot;
      const previousScope = snapshot.scope || "page";
      if (previousScope === currentScope) {
        dispatch(
          setCurrentObjectProperties({
            x: snapshot.x ?? 0,
            y: snapshot.y ?? 0,
            width: snapshot.width,
            height: snapshot.height,
            transform: snapshot.transform || {},
            locked: snapshot.locked ?? false,
            // Restore original stacking position if it was captured.
            ...(typeof snapshot.zIndex === "number"
              ? { zIndex: snapshot.zIndex }
              : {}),
            // Restore the original mask shape (a non-rectangular mask was
            // cleared when the image was promoted to background so it could
            // fill the whole page edge-to-edge).
            ...(snapshot.masking ? { masking: snapshot.masking } : {}),
            image: {
              ...image,
              scale: snapshot.image.scale,
              positionX: snapshot.image.positionX,
              positionY: snapshot.image.positionY,
            },
            fitToPageSnapshot: null,
          })
        );
        return;
      }
      // Different scope → fall through and re-fit. Preserve the ORIGINAL
      // pre-background snapshot rather than capturing the current (already
      // fitted) state so toggling off later still restores to the true
      // pre-background state.
    }

    const snapshot = activeObjectProps.fitToPageSnapshot
      ? { ...activeObjectProps.fitToPageSnapshot, scope: currentScope }
      : {
          width: activeObjectProps.width,
          height: activeObjectProps.height,
          x: activeObjectProps.x ?? 0,
          y: activeObjectProps.y ?? 0,
          locked: activeObjectProps.locked ?? false,
          zIndex: activeObjectProps.zIndex,
          transform: { ...activeObjectProps.transform },
          // Capture the current mask so we can restore it on toggle off.
          // Default (rectangular) masks don't need to be cleared, but a
          // shaped mask would clip the background to its shape — store it
          // either way and let the dispatch below reset to a rectangle.
          masking: activeObjectProps.masking
            ? { ...activeObjectProps.masking }
            : null,
          image: {
            scale: image.scale,
            positionX: image.positionX,
            positionY: image.positionY,
          },
          scope: currentScope,
        };
    const effectiveWidth = useSpreadBounds
      ? canvasSize.width
      : activeSideBounds.size.width;
    const effectiveHeight = useSpreadBounds
      ? canvasSize.height
      : activeSideBounds.size.height;
    const sideOffsetX = useSpreadBounds ? 0 : activeSideBounds.offset.x;

    if (!effectiveWidth || !effectiveHeight) return;

    const imageAspectRatio = image.width / image.height;
    const pageAspectRatio = effectiveWidth / effectiveHeight;

    let newScale;
    let posX = 0;
    let posY = 0;

    if (imageAspectRatio > pageAspectRatio) {
      newScale = effectiveHeight / image.height;
      posX = -((image.width * newScale - effectiveWidth) / 2);
    } else {
      newScale = effectiveWidth / image.width;
      posY = -((image.height * newScale - effectiveHeight) / 2);
    }

    // Push the background image below every other object on the current page.
    // We find the minimum zIndex across all layouts of the page and place this
    // object one step below it so all foreground content stays visible above.
    let minZ = 0;
    if (Array.isArray(allCurrentPageObjects)) {
      allCurrentPageObjects.forEach((o) => {
        if (!o || o.id === activeObjectProps.id) return;
        if (typeof o.zIndex === "number" && o.zIndex < minZ) minZ = o.zIndex;
      });
    }
    const backgroundZIndex = minZ - 1;

    dispatch(
      setCurrentObjectProperties({
        x: sideOffsetX,
        y: 0,
        transform: { ...activeObjectProps.transform, x: sideOffsetX, y: 0 },
        width: effectiveWidth,
        height: effectiveHeight,
        locked: true,
        zIndex: backgroundZIndex,
        // Reset the mask to a plain rectangle so a previously-applied shape
        // mask doesn't clip the background — the original mask is preserved
        // in snapshot.masking and restored when the user toggles off.
        masking: {
          path: "M0 0 L24 0 L24 24 L0 24 Z",
          width: 24,
          height: 24,
        },
        image: {
          ...image,
          scale: parseFloat(newScale.toFixed(4)),
          positionX: posX,
          positionY: posY,
        },
        fitToPageSnapshot: snapshot,
      })
    );
  }, [
    activeObjectProps,
    canvasSize,
    dispatch,
    isImageSelected,
    activeSideBounds,
    isSpreadPage,
    layoutMode,
    allCurrentPageObjects,
  ]);

  const handleFitToPhoto = useCallback(() => {
    if (!isImageSelected) return;

    const image = activeObjectProps?.image;
    if (!image?.originalWidth || !image?.originalHeight) return;

    const frameWidth = activeObjectProps.width;
    const frameHeight = activeObjectProps.height;
    if (!frameWidth || !frameHeight) return;

    const photoAspect = image.originalWidth / image.originalHeight;
    const frameAspect = frameWidth / frameHeight;

    let newWidth;
    let newHeight;

    if (photoAspect > frameAspect) {
      newWidth = frameWidth;
      newHeight = Math.round(frameWidth / photoAspect);
    } else {
      newHeight = frameHeight;
      newWidth = Math.round(frameHeight * photoAspect);
    }

    dispatch(
      setCurrentObjectProperties({
        width: newWidth,
        height: newHeight,
        image: {
          ...image,
          width: newWidth,
          height: newHeight,
          scale: 1,
          positionX: 0,
          positionY: 0,
        },
        fitToPageSnapshot: null,
      })
    );
  }, [activeObjectProps, dispatch, isImageSelected]);

  const handleRemoveBackground = useCallback(async () => {
    if (!isImageSelected) return;
    try {
      if (
        activeObjectProps.type === "img" &&
        (activeObjectProps?.urls || activeObjectProps.url)
      ) {
        let urls;
        if (activeObjectProps?.urls?.length > 0) {
          urls = activeObjectProps.urls.filter((img) => img.size === "large");
        } else {
          urls = [{ url: activeObjectProps.url }];
        }
        dispatch(
          setCurrentObjectProperties({ isProcessing: true, locked: true })
        );
        const data = {};
        data.url = urls[0]?.url || "";
        data.userTypeCode = userType || -1;
        const cart_order_id = searchParams.get("c_id");
        if (cart_order_id) data.cart_order_id = cart_order_id;
        const usersDetails = localStorage.getItem("userDetails");
        const users = usersDetails ? JSON.parse(usersDetails) : null;
        if (users?._id) data.user_id = users._id;
        if (projectSetup)
          data.theme_id = projectSetup?.themeDetails?.theme_id || "";
        data.brand_id = users?.brand_id || "";

        const response = await apiPost(ENDPOINTS.removeBackground, data);
        if (response.status === 1) {
          const respUrls = response.items;
          const largeImage = respUrls.find((u) => u.size === "large");
          if (activeObjectProps.type === "img" && largeImage?.url && respUrls.length > 0) {
            const updateData = {
              ...activeObjectProps,
              url: largeImage.url,
              urls: respUrls,
            };
            if (activeObjectProps?.autoBackgroundRemove) {
              updateData.autoBackgroundRemove = false;
            }
            dispatch(setCurrentObjectProperties({ ...updateData }));
            dispatch(refreshProjectImages(uuidv4()));
            setShowBgRemoveConfirm(false); // Close dialog on success
          }
        } else {
          toast.error(response.message || "Something went wrong");
        }
      }
    } catch (error) {
    } finally {
      dispatch(
        setCurrentObjectProperties({
          isProcessing: false,
          locked: false,
          autoBackgroundRemove: false,
        })
      );
    }
  }, [activeObjectProps, dispatch, isImageSelected, projectSetup, searchParams, userType]);

  const handleApplyAsBackground = useCallback(() => {
    if (!isImageSelected) return;

    const image = activeObjectProps?.image;
    const largeUrl =
      image?.urls?.find((item) => item.size === "large")?.url ||
      image?.url ||
      activeObjectProps?.url;
    if (!largeUrl) return;

    const thumbUrl =
      image?.urls?.find((item) => item.size === "thumbnail")?.url ||
      image?.urls?.[0]?.url ||
      largeUrl;

    const backgroundPayload = {
      _id:
        image?.assetId ||
        image?._id ||
        activeObjectProps?.id ||
        `img-${activeObjectProps?.id}`,
      urls: [
        { size: "large", url: largeUrl },
        { size: "thumbnail", url: thumbUrl },
      ],
      name: image?.name || activeObjectProps?.name || "Custom Background",
    };

    dispatch(setBackgroundImage(backgroundPayload));
    dispatch(addBackgroundImageToHistory(backgroundPayload));
    dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
    dispatch(setCurrentObjectProperties(null));
  }, [activeObjectProps, dispatch, isImageSelected]);

  const handleBackward = useCallback(() => dispatch(sendBackward()), [dispatch]);
  const handleForward = useCallback(() => dispatch(sendForward()), [dispatch]);

  const handleRemove = useCallback(() => {
    dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
    dispatch(setCurrentObjectProperties(null));
  }, [activeObjectProps, dispatch]);

  const handleLock = useCallback(() => {
    dispatch(
      setCurrentObjectProperties({ locked: !activeObjectProps?.locked })
    );
  }, [activeObjectProps, dispatch]);

  const handleOpenEditAction = useCallback(() => {
    const editActionIndex = editorMenuItems.findIndex(
      (item) => item.title === "Edit"
    );
    if (editActionIndex !== -1) {
      dispatch(setActiveActionIndex(editActionIndex));
      dispatch(setIsActionActive(true));
    }
  }, [dispatch, editorMenuItems]);

  const handleSelectImage = useCallback(() => {
    dispatch(setActiveActionIndex(0));
    dispatch(setIsActionActive(true));
  }, [dispatch]);

  const handleMultiSelectToggle = useCallback(() => {
    const nextMode = !isMultiSelectMode;
    dispatch(setIsMultiSelectMode(nextMode));
    if (!nextMode) dispatch(deSelectActiveObject());
  }, [dispatch, isMultiSelectMode]);

  const handleClearImage = useCallback(() => {
    const imageId = activeObjectProps?.image_id;
    dispatch(setCurrentObjectProperties({ url: "", urls: [], image_id: null }));
    if (imageId) {
      dispatch(removePhotoFromHistory(imageId));
    }
  }, [activeObjectProps, dispatch]);

  // ─── Don't render if no image selected ──────────────────────────

  if (!isImageSelected) return null;

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
            onClick={handleMultiSelectToggle}
            title={isMultiSelectMode ? "Done selecting" : "Select multiple objects"}
          >
            <MdSelectAll />
            {isMultiSelectMode ? "Done" : "Select"}
          </TextBtn>

          {/* ── Zoom Out / In ── */}
          {hasUrl && (
            <>
              <IconBtn onClick={zoomOut} title="Zoom Out">
                <FiZoomOut />
              </IconBtn>
              <IconBtn onClick={zoomIn} title="Zoom In">
                <FiZoomIn />
              </IconBtn>

              <Sep />

              <IconBtn
                $active={activeObjectProps.flip?.x}
                onClick={handleFlipX}
                title="Flip Horizontal"
              >
                <BiHorizontalCenter />
              </IconBtn>

              <IconBtn
                $active={activeObjectProps.flip?.y}
                onClick={handleFlipY}
                title="Flip Vertical"
              >
                <BiVerticalCenter />
              </IconBtn>


              <IconBtn onClick={handleFitToPhoto} title="Fit to Photo">
                <LiaCompressArrowsAltSolid />
              </IconBtn>

              <TextBtn
                onClick={handleFitToPage}
                title="Fit to Page"
                $active={Boolean(activeObjectProps.fitToPageSnapshot)}
              >
                <TbBackground /> Set as Background
              </TextBtn>
              {/* <TextBtn
                onClick={handleApplyAsBackground}
                title={
                  hasBackgroundImage
                    ? "Replace existing page background with this image"
                    : "Set this image as the page background"
                }
              >
                <TbBackground />
                {hasBackgroundImage ? "Replace Background" : "Set as Background"}
              </TextBtn> */}

              <IconBtn
                $mobileOnly
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(setDragger(true));
                }}
                title="Crop / Adjust"
              >
                <BiCrop />
              </IconBtn>

              <Sep />
            </>
          )}

          {/* ── Dialog Buttons ── */}
          <TextBtn
            $active={activeDialog === "position"}
            onClick={() => toggleDialog("position")}
            title="Position & Rotate"
          >
            Position
          </TextBtn>

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

          {hasUrl && (
            <>
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
            </>
          )}

          <Sep />

          {/* ── Remove Background ── */}
          {hasUrl &&
            ((settings.allowBackgroundRemover === true &&
              userType === USER_TYPES.CUSTOMER) ||
              userType !== USER_TYPES.CUSTOMER) && (
              <>
                <TextBtn
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBgRemoveConfirm(true);
                  }}
                  title="Remove Background"
                  $active={showBgRemoveConfirm}
                >
                  Remove Background
                </TextBtn>

                <ConfirmationDialog
                  show={showBgRemoveConfirm}
                  onClose={() => setShowBgRemoveConfirm(false)}
                  onConfirm={() => {
                    setShowBgRemoveConfirm(false); // Close dialog immediately
                    handleRemoveBackground();       // Run API in background
                  }}
                  title="Remove Background"
                  message="Are you sure you want to remove the background of this image?"
                  confirmText="Remove"
                  cancelText="Cancel"
                  confirmVariant="danger"
                />
              </>
            )}

          {/* ── Edit (open sidebar) ── */}
          {hasUrl && (
            <IconBtn onClick={handleOpenEditAction} title="Edit Image">
              <PiPaintBrushFill />
            </IconBtn>
          )}

          {/* ── Select Image (when no URL) ── */}
          {!hasUrl && (
            <IconBtn onClick={handleSelectImage} title="Select Image">
              <BiImage />
            </IconBtn>
          )}

          {/* ── Clear Image ── */}
          {hasUrl && (
            <IconBtn onClick={handleClearImage} title="Clear Image">
              <BiRefresh />
            </IconBtn>
          )}



          <Sep />

          {/* ── Layer Actions ── */}
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

          {/* ── Lock/Unlock ── */}
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

export default ImageFloatingToolbar;
