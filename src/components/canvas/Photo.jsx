import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CanvasImageSkeleton,
  CommonLoader,
  CommonLoaderContainer,
  Dragger,
} from "../../common-components/StyledComponents";
import { FaArrowsAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { getDragger } from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  setDragger,
} from "../../store/slices/canvas";
import LazyLoad from "react-lazyload";
import { IoAddCircleOutline, IoWarning } from "react-icons/io5";
import { FaHandRock } from "react-icons/fa";
import { AiOutlineDrag } from "react-icons/ai";
import { BiSolidError } from "react-icons/bi";
import DropImageBgPlaceholder from "../../assets/svg/dropimgbg.svg";
import DropImagetext from "../../assets/svg/dropimgtext.svg";
import { USER_TYPES } from "../../library/utils/constants";
import { Spinner, OverlayTrigger, Tooltip } from "react-bootstrap";
import { checkImagePrintQuality, isLowQuality } from "../../library/utils/common-functions";
import { useProgressiveImage, queryLiveImageEls, applyLiveImageTransformEls, pickVariantUrl } from "../../library/utils/image/progressiveImage";
import { useLiveResize } from "./liveResizeStore";
const PlaceholderWrapper = styled.div`
  background-image: url(${DropImagetext});
  background-size: cover;
  background-size: cover;

  background-position: center;
  text-align: center;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

function generateRoundedRectPath(width, height, radius) {
  // Ensure the radius is not larger than half of the smallest dimension
  const effectiveRadius = Math.min(radius, width / 2, height / 2);

  if (effectiveRadius <= 0) {
    return `M0,0 H${width} V${height} H0 Z`;
  }

  // Create the path with rounded corners using the `arc` (A) command
  const path = `
        M${effectiveRadius},0
        H${width - effectiveRadius}
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${width},${effectiveRadius}
        V${height - effectiveRadius}
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${width - effectiveRadius
    },${height}
        H${effectiveRadius}
        A${effectiveRadius},${effectiveRadius} 0 0 1 0,${height - effectiveRadius
    }
        V${effectiveRadius}
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${effectiveRadius},0
        Z
    `;

  return path.trim(); // Return the path string
}

function Photo({ item: rawItem, isActive, zoomRatio }) {
  // Live-resize override: while THIS image is being resized, ItemDragger pushes
  // the live geometry here (no redux dispatch → no MainCanvas re-render). We merge
  // it over the redux item so React reflows the real geometry for this one object.
  // null at all other times, so this is a no-op outside an active resize.
  const liveResize = useLiveResize(rawItem.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const { url, opacity, border, effects, width, height } = item;

  // const getActiveCanvasObjProps = useSelector(getActiveObjectprops);
  // const getActiveCanvasObj = useSelector(getActiveObject);
  // Removed expensive global subscriptions: active object tracking is now handled via isActive prop from Canvas.

  const dispatch = useDispatch();
  const [isDragging, setIsDragging] = useState(false);
  const isDragger = useSelector(getDragger);
  const isPointerDraggingRef = useRef(false);
  // Pan start point. A REF (not state) so the document mousemove listener — which
  // is bound once when a drag begins — always reads the current value with no
  // stale-closure risk, and so a drag started without a pointer event (e.g. the
  // toolbar Crop button flips the redux dragger flag) can be lazy-initialized on
  // the first move instead of feeding undefined coordinates into the math.
  const startPosRef = useRef(null);
  // Inner-pan performance refs:
  //  - panCtmInvRef/panSvgRef: inverse screen-matrix cached once at grab time
  //    (the container transform is constant during a pan, so it never changes).
  //  - panLatestRef/panRafRef: coalesce high-frequency pointer events into ONE
  //    redux dispatch per animation frame (a full Canvas re-render per raw
  //    mousemove — up to 1000/sec on gaming mice — was the lag).
  const panCtmInvRef = useRef(null);
  const panSvgRef = useRef(null);
  const panLatestRef = useRef(null);
  const panRafRef = useRef(null);
  // Holds the latest computed pan position {positionX, positionY}. During a pan
  // we move the image + ghost imperatively (no per-frame redux dispatch → no
  // MainCanvas re-render → smooth) and commit this to redux once on mouse-up.
  const panLatestPosRef = useRef(null);
  // Cached DOM targets for the pan (img elements + ghost), queried ONCE at the
  // first pan frame and reused each frame — avoids a per-frame document query
  // scan over the (footer-heavy) DOM. Cleared on mouse-up.
  const panElsRef = useRef(null);
  // The ⊕ pan handle is a DOM child of the <g> react-moveable controls. We attach
  // a NON-React mousedown/touchstart listener to it (below) and stopPropagation,
  // so the event never bubbles to Moveable's gesto listener on the parent — i.e.
  // Moveable never starts a whole-object drag from the handle. This keeps the
  // container fixed during a pan WITHOUT disabling/aborting Moveable's drag able
  // (doing that broke rotate, which uses that able internally). startPanRef holds
  // the latest startPan so the imperative listener always calls the fresh closure.
  const dragIconRef = useRef(null);
  const startPanRef = useRef(null);
  const [draggerIconSize, setDraggerIconSize] = useState(20);
  // Initialize from the actual url so a freshly-placed image renders directly
  // instead of flashing the drop-image placeholder for one frame before the
  // useEffect below corrects it (that one-frame flash was the click→select "blink").
  const [isPlaceholder, setIsPlaceholder] = useState(!item.url || item.url === "");
  const [imageTransform, setImageTransform] = useState("");
  const [imageQuality, setImageQuality] = useState("good");
  const userDetail = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetail);
  

  // Size and position for the drag icon

  // Calculate the center position for the drag icon

  const imageCenterX = width / 2;
  const imageCenterY = height / 2;

  // Sync Redux dragger → local isDragging (only when activated externally,
  // e.g. from toolbar Crop button). Only the active photo should respond so
  // we short-circuit for all inactive photos to avoid a global drag overlay.
  useEffect(() => {
    if (!isActive) {
      if (!isPointerDraggingRef.current) {
        setIsDragging(false);
      }
      return;
    }

    if (isDragger) {
      setIsDragging(true);
    } else if (!isPointerDraggingRef.current) {
      setIsDragging(false);
    }
  }, [isActive, isDragger]);

  useEffect(() => {
    if (!item.url || item.url === "") {
      setIsPlaceholder(true);
    } else {
      setIsPlaceholder(false);
    }
    // lets calculate dragger icon size to 20% of image width
    let draggerSize = width * 0.1;
    // let set minimum and maximum size for dragger icon
    draggerSize = Math.max(
      20,
      Math.min(window.innerWidth < 768 ? 200 : 100, draggerSize)
    );
    setDraggerIconSize(draggerSize);
  }, [item]);

  useEffect(() => {
    // `imageTransform` ONLY feeds the GhostImage (the pan-time overlay) — the
    // visible <img> uses item.image.scale inline. During a resize the scale
    // changes every frame and the ghost isn't shown, so recomputing this each
    // frame is pure waste (an extra Photo re-render per frame). Skip while
    // resizing; it recomputes once when the resize commits (liveResize → null).
    if (liveResize) return;
    const transform = [
      item.flip.x ? `translate(${item.image.width}px) scaleX(-1)` : "",
      item.flip.y ? "scaleY(-1)" : "",
      item.image.scale
        ? `scale(${parseFloat(item.image.scale.toFixed(4))})`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    setImageTransform(transform);
  }, [item.flip.x, item.flip.y, item.image.scale, liveResize]);

  useEffect(() => {
    // Skip the quality recompute during a resize — item.image/width/height change
    // every frame, and checkImagePrintQuality + a setState per frame is wasted work
    // (the warning isn't needed mid-drag). Recomputes once when the resize commits.
    if (liveResize) return;
    // Check if image quality is low
    if (item.image && item.image.width && item.image.height && width && height) {
      const lowQuality = checkImagePrintQuality(
        parseFloat(item.image.originalWidth),
        parseFloat(item.image.originalHeight),
        width,
        height,
        parseFloat(item.image.scale),
        200,
      );
      setImageQuality(lowQuality);
    } else {
      setImageQuality("good");
    }
  }, [item.image, width, height, liveResize]);

  // Begin an inner-image pan. Shared by the native drag-handle listener (below)
  // and the React handlers used for locked/customer images.
  const startPan = (clientX, clientY) => {
    if (!isActive) return;
    if (clientX == null || clientY == null) return;
    if (isPointerDraggingRef.current) return; // guard pointer+mouse double-fire
    isPointerDraggingRef.current = true;
    setIsDragging(true);
    // Store the raw pointer start point AND the image pan position at grab time.
    // handleMouseMove maps these through the element's screen matrix to get the
    // local delta (rotation/flip/zoom aware).
    startPosRef.current = {
      clientX,
      clientY,
      posX: item.image.positionX,
      posY: item.image.positionY,
    };

    // Cache the inverse screen-CTM ONCE. During an inner-pan only image.positionX/Y
    // (inside the element) changes — the container's transform, and therefore the
    // rect's screen matrix, stays constant — so recomputing it every mousemove was
    // pure overhead.
    const refEl = document.querySelector(
      `rect.page-img-rect[data-id="${item.id}"]`
    );
    const ctm = refEl?.getScreenCTM?.();
    panSvgRef.current = refEl?.ownerSVGElement || null;
    panCtmInvRef.current = ctm ? ctm.inverse() : null;

    panLatestPosRef.current = null; // reset; flushPan fills it, mouse-up commits it
    dispatch(setDragger(true)); // Suppress Moveable whole-object handlers during pan
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    startPan(clientX, clientY);
  };

  // Keep the imperative listener pointing at the latest startPan closure.
  startPanRef.current = startPan;

  // Attach a NON-React mousedown/touchstart listener directly on the ⊕ handle.
  // stopPropagation here (bubble phase, on the child) prevents the event from
  // reaching react-moveable's gesto listener on the parent <g>, so Moveable never
  // starts a whole-object drag during a pan — without disabling its drag able
  // (which is what broke rotate). No pointerdown (it caused a click-like feel),
  // and preventDefault stops the browser's native image-drag/selection.
  useEffect(() => {
    const node = dragIconRef.current;
    if (!node) return;
    const onNativeStart = (e) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      startPanRef.current?.(cx, cy);
    };
    node.addEventListener("mousedown", onNativeStart);
    node.addEventListener("touchstart", onNativeStart, { passive: false });
    return () => {
      node.removeEventListener("mousedown", onNativeStart);
      node.removeEventListener("touchstart", onNativeStart);
    };
  }, [isActive, isDragging, isPlaceholder, item.isProcessing]);

  // Does the actual pan math + dispatch. Runs at most once per animation frame
  // (scheduled by handleMouseMove) so a burst of raw pointer events collapses to
  // a single Canvas re-render per frame.
  const flushPan = () => {
    panRafRef.current = null;
    if (!isDragging) return;
    const latest = panLatestRef.current;
    if (!latest) return;
    const { clientX, clientY } = latest;

    // Lazy-init the start point when a drag began without a pointer event
    // (e.g. toolbar Crop flips the dragger flag). Anchor here on the first move.
    if (
      !startPosRef.current ||
      !Number.isFinite(startPosRef.current.clientX) ||
      !Number.isFinite(startPosRef.current.clientY)
    ) {
      startPosRef.current = {
        clientX,
        clientY,
        posX: item.image?.positionX ?? 0,
        posY: item.image?.positionY ?? 0,
      };
      return;
    }
    const startPosition = startPosRef.current;

    // Map the start point and current point through the element's screen matrix
    // (cached once in startPan) to get the local delta — rotation/flip/zoom aware.
    let dxLocal;
    let dyLocal;
    const inv = panCtmInvRef.current;
    const svgEl = panSvgRef.current;
    if (inv && svgEl) {
      const pStart = svgEl.createSVGPoint();
      pStart.x = startPosition.clientX;
      pStart.y = startPosition.clientY;
      const pNow = svgEl.createSVGPoint();
      pNow.x = clientX;
      pNow.y = clientY;
      const localStart = pStart.matrixTransform(inv);
      const localNow = pNow.matrixTransform(inv);
      dxLocal = localNow.x - localStart.x;
      dyLocal = localNow.y - localStart.y;
    } else {
      // Fallback (CTM unavailable): manual inverse rotation + flip + zoom.
      const dxScreen = (clientX - startPosition.clientX) / zoomRatio;
      const dyScreen = (clientY - startPosition.clientY) / zoomRatio;
      const rad = ((item?.transform?.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      dxLocal = dxScreen * cos + dyScreen * sin;
      dyLocal = -dxScreen * sin + dyScreen * cos;
      if (item?.flip?.x) dxLocal = -dxLocal;
      if (item?.flip?.y) dyLocal = -dyLocal;
    }

    let newX = startPosition.posX + dxLocal;
    let newY = startPosition.posY + dyLocal;

    // Clamp so the image always covers the frame.
    const imageScale = item?.image?.scale || 1;
    const minX = width - item?.image?.width * imageScale;
    const minY = height - item?.image?.height * imageScale;
    newX = Math.max(Math.min(newX, 0), minX);
    newY = Math.max(Math.min(newY, 0), minY);

    // Apply IMPERATIVELY (no per-frame redux dispatch → no MainCanvas re-render →
    // smooth). Updates BOTH the main canvas image AND the footer/preview thumbnails
    // (so the footer live preview tracks the pan), then the unclipped GhostImage
    // preview so it stays aligned. Committed to redux once on mouse-up. Because the
    // <img>/ghost live inside the memoized Photo (item unchanged during pan), an
    // unrelated re-render won't clobber these writes.
    const nextImage = { ...item.image, positionX: newX, positionY: newY };
    // Query the targets ONCE (the ghost only exists after the first re-render that
    // turned on isDragging, so we lazily cache on the first frame), then reuse.
    if (!panElsRef.current) {
      panElsRef.current = {
        imgEls: queryLiveImageEls(item.id),
        ghostEl: document.querySelector(`image.ghostImage[data-id="${item.id}"]`),
      };
    }
    applyLiveImageTransformEls(panElsRef.current.imgEls, nextImage, panSvgRef.current);
    if (panElsRef.current.ghostEl) {
      panElsRef.current.ghostEl.setAttribute(
        "transform",
        `translate(${newX}, ${newY}) ${imageTransform}`
      );
    }
    panLatestPosRef.current = { positionX: newX, positionY: newY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    // Ignore events without usable coordinates (prevents non-finite SVGPoint).
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    // Throttle to one dispatch per frame: just record the latest pointer position
    // and let the rAF callback do the work.
    panLatestRef.current = { clientX, clientY };
    if (panRafRef.current == null) {
      panRafRef.current = requestAnimationFrame(flushPan);
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      e.preventDefault();

      setIsDragging(false);
      isPointerDraggingRef.current = false;
      startPosRef.current = null;
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      panLatestRef.current = null;
      panCtmInvRef.current = null;
      panSvgRef.current = null;
      panElsRef.current = null; // drop cached DOM targets
      dispatch(setDragger(false));
      const finalPos = panLatestPosRef.current;
      panLatestPosRef.current = null;
      if (finalPos) {
        // Commit the panned position once. history:true is the undo checkpoint
        // (redux was untouched during the pan), so one Ctrl+Z restores pre-pan.
        dispatch(
          setCurrentObjectProperties({
            ...item,
            image: {
              ...item.image,
              positionX: finalPos.positionX,
              positionY: finalPos.positionY,
            },
            history: true,
          })
        );
      }
      //draggerRef.current.style.display = 'flex';
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // add for touch device
      document.addEventListener("touchmove", handleMouseMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // add for touch device
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // add for touch device
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  function generateScaledClipPath(
    baseWidth,
    baseHeight,
    targetWidth,
    targetHeight
  ) {
    // Calculate the scaling factors for X and Y axes
    const scaleX = targetWidth / baseWidth;
    const scaleY = targetHeight / baseHeight;

    // Return the scale values
    return { scaleX, scaleY };
  }

  // Calculate scaling factors

  const baseWidth = item.masking?.width || 0;
  const baseHeight = item.masking?.height || 0;
  const { scaleX, scaleY } = generateScaledClipPath(
    baseWidth,
    baseHeight,
    width,
    height
  );

  return (
    <g
      filter={`url(#shadow_photo_item_${item.id})`}
      className="photo-item fade-animate"
      onTouchStart={
        (item?.locked ||
          (item?.disabledForClient &&
            user?.userTypeCode === USER_TYPES.CUSTOMER)) &&
          !item?.isProcessing &&
          window.innerWidth > 768
          ? handleMouseDown
          : () => { }
      }
      onMouseDown={
        (item?.locked ||
          (item?.disabledForClient &&
            user?.userTypeCode === USER_TYPES.CUSTOMER)) &&
          !item?.isProcessing &&
          window.innerWidth > 768
          ? handleMouseDown
          : () => { }
      }
      onPointerDown={
        (item?.locked ||
          (item?.disabledForClient &&
            user?.userTypeCode === USER_TYPES.CUSTOMER)) &&
          window.innerWidth <= 768 &&
          item?.image &&
          item?.image !== null &&
          item?.image !== undefined &&
          !item?.isProcessing
          ? handleMouseDown
          : () => { }
      }
    >
      {/* generate dynamic shadow */}
      <BoxShadowItem item={item} />

      <g
        className="page-item--positioning-container"
        style={{ opacity: item.opacity }}
      >
        <g clipPath={`url(#clip-custom-${item.id})`}>
          <MaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
          <g>
            <PhotoItem
              item={item}
              width={width}
              height={height}
              isPlaceholder={isPlaceholder}
              isDragging={isDragging}
              imageTransform={imageTransform}
              isActive={isActive}
            />
          </g>
        </g>
      </g>

      <BorderMaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
      {/* Dim full-image preview shown while panning. It renders UNCLIPPED at the
          live positionX/positionY, so it extends past the frame and grows the
          photo-item bounding box during a pan. That is safe now because the
          object container pins its rotation pivot to the FRAME centre (viewBox
          space) in Canvas.jsx rather than the content bbox centre — so the
          moving ghost no longer drifts the rotated container. */}
      {!isPlaceholder && isDragging && !item.flip.x && (
        <GhostImage
          item={item}
          isDragging={isDragging}
          imageTransform={imageTransform}
        />
      )}
      {!isPlaceholder &&
        !isDragging &&
        isActive &&
        !item.isProcessing && (
          // <g className="drag-icon" onMouseDown={handleMouseDown} transform={`translate(${imageCenterX}, ${imageCenterY})`} style={{ cursor: 'grab' }} >
          <g
            ref={dragIconRef}
            className="drag-icon"
            transform={`translate(${imageCenterX}, ${imageCenterY})`}
            style={{ cursor: "grab" }}
          >
            <circle
              className="drag-icon"
              r={draggerIconSize / 1.5}
              fill="#37373796"
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
            />
            <AiOutlineDrag
              className="drag-icon"
              fill="#ffffff"
              x={-draggerIconSize / 2}
              y={-draggerIconSize / 2}
              size={draggerIconSize}
            />
          </g>
        )}

      {/* Low Quality Warning Icon */}
      {/* {!isPlaceholder && imageQuality !== "good" && (
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id={`low-quality-tooltip-${item.id}`} color="white">
              <p className="lh-1">
                {imageQuality === "low" ?
                  "This image is slightly low in quality and may lose sharpness when printed. For best results, consider resizing the placeholder or adjusting zoom."
                  : imageQuality === "poor" ?
                    "This image is too poor in quality and will appear blurry or pixelated when printed. Please replace it with a higher-resolution image"
                    : "This image is very high-resolution for the selected placeholder. The final print will be sharp, but you might lose detail due to downscaling"}
              </p>
            </Tooltip>
          }
        >
          <g transform={`translate(${imageCenterX}, ${imageCenterY})`} className="not-exportable">
            <IoWarning size={"5%"} color={imageQuality === "low" ? "#ffff00" : imageQuality === "poor" ? "#ff0000" : "#00ff00"} />
          </g>
        </OverlayTrigger>
      )} */}
    </g>
  );
}

export default React.memo(Photo);

const BorderMaskPath = ({ item, scaleX, scaleY }) => {
  const r =
    (parseFloat(item.width) * parseFloat(item.border?.radius) || 0) / 24;

  return (
    <>
      {item.masking &&
        item.masking.path &&
        item.masking.path !== "M0 0 L24 0 L24 24 L0 24 Z" ? (
        <>
          {/* we need to find way to set radius when there is border radius and can allow only in rectangle*/}
          <path
            className="page_photo_item"
            data-id={item.id}
            transform={`scale(${scaleX}, ${scaleY})`}
            d={item.masking?.path}
            fill="transparent"
            stroke={item.border?.color}
            strokeWidth={item.border?.width / 24}
          // style={{ vectorEffect: 'non-scaling-stroke' }}
          />
        </>
      ) : (
        <>
          <path
            data-id={item.id}
            className="page_photo_item"
            // transform={`scale(${scaleX}, ${scaleY})`}
            d={generateRoundedRectPath(item.width, item.height, r)}
            fill="transparent"
            stroke={item.border?.color}
            strokeWidth={item.border?.width}
          // style={{ vectorEffect: 'non-scaling-stroke' }}
          />
        </>
      )}
    </>
  );
};

const MaskPath = ({ item, scaleX, scaleY }) => {
  const rectanglePath = "M0 0 L24 0 L24 24 L0 24 Z";
  const r = (item.width * parseFloat(item.border?.radius) || 0) / 24;
  return (
    <>
      <defs>
        <clipPath id={`clip-custom-${item.id}`}>
          {/* if its rectangle lets use mask path default */}
          {item.masking &&
            item.masking.path &&
            item.masking.path !== rectanglePath ? (
            <path
              className="page-item--box"
              transform={`scale(${scaleX}, ${scaleY})`}
              d={item.masking.path}
            />
          ) : (
            <path
              className="page-item--box"
              // transform={`scale(${scaleX}, ${scaleY})`}
              d={generateRoundedRectPath(item.width, item.height, r)}
              fill="transparent"
              stroke="black"
            />
          )}
        </clipPath>
      </defs>
    </>
  );
};

const PhotoItem = ({
  item,
  width,
  height,
  isPlaceholder,
  isDragging,
  imageTransform,
  isActive,
}) => {
  const hasAnyEffect =
    item.effect ||
    item.effects.brightness !== 0 ||
    item.effects.contrast !== 0 ||
    item.effects.saturation !== 0;

  const filterId = hasAnyEffect ? `url(#image_effect_${item.id})` : "none";

  return (
    <>
      {/* <image class="page_photo_item"
                        data-id={item.id}
                        href={url ? url : "/images/photos/A (1).jpg"}
                        data-cy="svg-image"
                        transform={`translate(${item.image?.positionX}, ${item.image?.positionY})`}
                        style={{
                            cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        preserveAspectRatio="none"
                        width={item.image?.width} height={item.image?.height} opacity="1">

                    </image> */}
      <g
        filter={hasAnyEffect ? filterId : null}
        key={`image-effect-${item.id}`}
        style={{
          cursor: "grab",
        transform: (item.flip?.x || item.flip?.y)
            ? `translate(${item.flip?.x ? item.width : 0}px, ${item.flip?.y ? item.height : 0}px) scale(${item.flip?.x ? -1 : 1}, ${item.flip?.y ? -1 : 1})`
            : "none",
        }}
      >
        {getFilter2(
          item.effect,
          "image_effect_" + item.id,
          item.effects.brightness,
          item.effects.contrast,
          item.effects.saturation
        )}

        <rect
          x={0}
          y={0}
          data-id={item.id}
          className="page-img-rect"
          width={width}
          height={height}
          fill="transparent"
          pointerEvents={isPlaceholder ? "all" : "none"}
        />
        <foreignObject x={0} y={0} width={width} height={height}
          style={{ pointerEvents: isPlaceholder ? "none" : "auto" }}>
          <div
            className="page_photo_item"
            data-id={item.id}
            style={{
              width: width,
              height: height,
            }}
          >
            {!isPlaceholder && (
              <PhotoHolder
                item={item}
                isDragging={isDragging}
                imageTransform={imageTransform}
                isActive={isActive}
              />
            )}
            {isPlaceholder && <PlaceHolder />}
          </div>
        </foreignObject>
      </g>
    </>
  );
};

const getFilter = (effect, id) => {
  if (!effect) return null;

  switch (effect) {
    case "bw":
      return (
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.5 0.7 0 0 0 0.5 0.7 0 0 0 0.5 0.7 0 0 0 0 0 0 1 0"
          />
        </filter>
      );
    case "blur":
      return (
        <filter id={id}>
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation="25" // Direct value for blur radius
          />
        </filter>
      );
    case "grayscale":
      return (
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="saturate"
            values="0" // Direct value for grayscale (0% saturation)
          />
        </filter>
      );
    case "sepia":
      return (
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.34 0.67 0.12 0 0  0.25 0.67 0.13 0 0  0.17 0.33 0.11 0 0  0 0 0 1 0" // Direct value for sepia (100% effect)
          />
        </filter>
      );
    case "invert":
      return (
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="invert"
            values="1" // Direct value for invert (100% effect)
          />
        </filter>
      );
    case "hue-rotate":
      return (
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="hueRotate"
            values="180deg" // Direct value for hue rotation
          />
        </filter>
      );
    default:
      return null;
  }
};

const getFilter2 = (
  effect,
  id,
  brightnessValue = 0,
  contrastValue = 0,
  saturationValue = 0
) => {
  // If there's no effect and all values are 0 (normal state), return null (no filter applied)
  const noEffectApplied =
    !effect &&
    brightnessValue === 0 &&
    contrastValue === 0 &&
    saturationValue === 0;
  if (noEffectApplied) return null;

  // Brightness Calculation
  const brightnessSlope =
    brightnessValue !== 0 ? Math.max((brightnessValue + 100) / 100, 0.01) : 1; // Ensure slope is > 0
  const brightnessIntercept = brightnessValue !== 0 ? brightnessValue / 255 : 0; // Adjust intercept for brightness

  // Contrast Calculation (Keep it > 0)
  const contrastSlope =
    contrastValue !== 0 ? Math.max((contrastValue + 100) / 100, 0.01) : 1;
  const contrastIntercept = contrastValue !== 0 ? (1 - contrastSlope) / 2 : 0; // Adjust contrast intercept

  // Saturation Calculation (Keep it > 0)
  const saturationSlope =
    saturationValue !== 0 ? (saturationValue + 100) / 100 : 1; // No change when 0

  return (
    <filter id={id}>
      {/* Apply the selected effect */}
      {effect === "bw" && (
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0.5 0.7 0 0 0 0.5 0.7 0 0 0 0.3 0.7 0 0 0 0 0 0 1 0"
        />
      )}
      {effect === "blur" && (
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation="25" // Direct value for blur radius
        />
      )}
      {effect === "grayscale" && (
        <feColorMatrix
          in="SourceGraphic"
          type="saturate"
          values="0" // Direct value for grayscale (0% saturation)
        />
      )}
      {effect === "sepia" && (
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0.34 0.67 0.12 0 0  0.25 0.67 0.13 0 0  0.17 0.33 0.11 0 0  0 0 0 1 0" // Sepia effect
        />
      )}
      {effect === "invert" && (
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"
        />
      )}
      {effect === "hue-rotate" && (
        <feColorMatrix
          in="SourceGraphic"
          type="hueRotate"
          values="180deg" // Hue rotation
        />
      )}

      {/* Brightness adjustment (only apply if value is different from 0) */}
      {brightnessValue !== 0 && (
        <feComponentTransfer>
          <feFuncR type="linear" slope={1} intercept={brightnessIntercept} />
          <feFuncG type="linear" slope={1} intercept={brightnessIntercept} />
          <feFuncB type="linear" slope={1} intercept={brightnessIntercept} />
        </feComponentTransfer>
      )}

      {/* Contrast adjustment (only apply if value is different from 0) */}
      {contrastValue !== 0 && (
        <feComponentTransfer>
          <feFuncR
            type="linear"
            slope={contrastSlope}
            intercept={contrastIntercept}
          />
          <feFuncG
            type="linear"
            slope={contrastSlope}
            intercept={contrastIntercept}
          />
          <feFuncB
            type="linear"
            slope={contrastSlope}
            intercept={contrastIntercept}
          />
        </feComponentTransfer>
      )}

      {/* Saturation adjustment */}
      {saturationValue !== 0 && (
        <feColorMatrix
          type="matrix"
          values={`
                        ${0.213 + 0.787 * saturationSlope} ${0.715 - 0.715 * saturationSlope
            } ${0.072 - 0.072 * saturationSlope} 0 0
                        ${0.213 - 0.213 * saturationSlope} ${0.715 + 0.285 * saturationSlope
            } ${0.072 - 0.072 * saturationSlope} 0 0
                        ${0.213 - 0.213 * saturationSlope} ${0.715 - 0.715 * saturationSlope
            } ${0.072 + 0.928 * saturationSlope} 0 0
                        0 0 0 1 0
                    `}
        />
      )}
    </filter>
  );
};

const PlaceHolder = (item) => {
  return (
    <>
      {/* <img class="page_photo_item" src="/images/dropimgbg.svg" alt="" width="50%" height="50%" /> */}
      <PlaceholderWrapper
        style={{
          opacity: item.opacity,
          backgroundSize:
            item.adjustment === "cover" || item.adjustment === "burn_effect"
              ? "cover"
              : item.adjustment === "contain"
                ? "contain"
                : item.adjustment === "stretch"
                  ? "100% 100%"
                  : "",
          backgroundRepeat: item.adjustment === "tile" ? "repeat" : "no-repeat",
          backgroundPosition: "center center",
          borderRadius: item.borderRadius + "px",
        }}
        key={item.id + "img"}
        className="page_photo_item img_placeholder noPointer  inset-0 p-5"
      >
        <img
          className="page_photo_item"
          src={DropImageBgPlaceholder}
          alt=""
          width="50%"
          height="50%"
        />
      </PlaceholderWrapper>
    </>
  );
};

const PhotoHolder = ({ item, isDragging, imageTransform, isActive }) => {
  // const activeObjectProps = useSelector(getActiveObjectprops);

  // Optimistic placement: while an object still carries pendingImageId its
  // url is a local thumbnail blob. Surface a badge when the upload failed
  // (or its queue entry vanished) so the user knows to retry/replace.
  // Narrow primitive selector — re-renders only when the status changes.
  const pendingUploadStatus = useSelector((state) => {
    if (!item.pendingImageId) return null;
    const entry = (state.imageUpload?.images || []).find(
      (img) => img.imageId === item.pendingImageId
    );
    return entry ? entry.status : "missing";
  });
  const showUploadFailedBadge =
    pendingUploadStatus === "failed" || pendingUploadStatus === "missing";

  // Progressive display ladder: paint cached/`small` → `medium` baseline → `large`
  // ALWAYS (the rungs are first-paint only; the canvas rests at full res). Live URLs
  // in Redux (item.url / item.urls) are untouched, so save/order/export always emit
  // the live URL. Optimistic-upload previews (blob:) pass straight through.
  const displaySrc = useProgressiveImage(item);

  // Is the inner image zoomed IN past cover-fit? Drives the GPU-layer hint below
  // ONLY (it no longer gates the variant — the canvas always settles at `large`).
  // `cover-fit` = the minimum scale that fills the frame.
  const coverScale = Math.max(
    (item.width || 1) / (item.image?.width || 1),
    (item.height || 1) / (item.image?.height || 1)
  );
  const isZoomedIn = (item.image?.scale || coverScale) > coverScale * 1.5;

  // Loading skeleton: show a shimmer over the box until the image first paints
  // (e.g. after a page refresh, while the bitmap downloads). `loaded` LATCHES true
  // on the first load and never resets — so a later progressive medium→large swap
  // or the pending→real silent swap does NOT flash a skeleton over an already
  // visible image. New objects mount fresh (loaded:false) since Photo is keyed
  // per object id. onError also latches so a failed load can't get stuck shimmering.
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  // Cached/already-complete images may have their load event fire before React
  // attaches the handler — sync from `img.complete` so they never flash a skeleton.
  useLayoutEffect(() => {
    if (loaded) return;
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [loaded, displaySrc]);

  return (
    <div
      className="postion-relative"
      style={{ position: "relative", width: item.width, height: item.height }}
    >
      {showUploadFailedBadge && (
        <div
          className="position-absolute"
          title="Upload failed — retry from the Photos panel"
          style={{
            top: 4,
            right: 4,
            zIndex: (item.zIndex || 1) + 1,
            background: "rgba(229,57,53,0.92)",
            color: "#fff",
            borderRadius: "4px",
            padding: "2px 6px",
            fontSize: "11px",
            fontWeight: 600,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          ⚠ Upload failed
        </div>
      )}
      {/* <img
                class="page_photo_item"
                //src={sampleBase64Image}
                src={item.url ? item.url : "/images/dropimgtext.svg"}
                alt="image"
                data-id={item.id}
                width={item.image?.width} height={item.image?.height}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    position: "relative",
                    left: item.image?.positionX,
                    top: item.image?.positionY,
                    borderRadius: '2px',
                    ...(imageTransform ? { transform: imageTransform } : {}),
                    transformOrigin: '0 0',

                }} // this was not supprted in mobile due to position and transform
            /> */}
      {/* <img
                class="page_photo_item"
                //src={sampleBase64Image}
                src={item.url ? item.url : "/images/dropimgtext.svg"}
                alt="image"
                data-id={item.id}
                width={item.image?.width * parseFloat(item.image.scale.toFixed(4))} height={item.image?.height * parseFloat(item.image.scale.toFixed(4))}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    marginLeft: `${item.image?.positionX || 0}px`,
                    marginTop: `${item.image?.positionY || 0}px`,

                }}

            /> */}

      <img
        ref={imgRef}
        className="page_photo_item"
        key={"img-" + item.id + "img2"}
        //src={sampleBase64Image}
        src={item.url ? displaySrc || item.url : DropImagetext}
        alt="image"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        data-id={item.id}
        // FIXED intrinsic size — zoom is applied via the CSS `scale()` below, NOT
        // by multiplying width/height. Changing width/height re-rasterizes the
        // full-res source bitmap every frame (the zoom lag, brutal on low-end);
        // a `scale()` transform is GPU-composited from the already-decoded
        // texture, so zoom is smooth at any source resolution.
        width={item.image?.width}
        height={item.image?.height}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          // translate = pan (GPU), scale = zoom (GPU). transformOrigin 0 0 keeps
          // the top-left anchor identical to the old width/height model, so all
          // position/clamp math in state stays correct.
          transform: `translate(${item.image?.positionX || 0}px, ${item.image?.positionY || 0}px) scale(${parseFloat((item.image?.scale ?? 1).toFixed(4))})`,
          transformOrigin: "0 0",
          // Promote to a GPU compositing layer ONLY while actually panning
          // (isDragging) or zoomed in (isZoomedIn) — NOT on mere selection. Layering
          // a full-res image on every select cost a `Layerize` pass per selection
          // (seen in the profiles); cover-fit selected images don't need a layer.
          willChange: isZoomedIn || isDragging ? "transform" : "auto",
        }}
      // loadingPlaceholder={<ImageLoader2 />}
      // loader={<ImageLoader />}
      />

      {!loaded && (
        <CanvasImageSkeleton className="not-exportable" data-id={item.id} />
      )}

      {item?.isProcessing === true && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            zIndex: item.zIndex + 1,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <CommonLoaderContainer
            style={{ zIndex: item.zIndex + 1 }}
            text={
              item?.width >= 300 ? "Processing..." : ""
            }
            fontSize="2rem"
          >
            <CommonLoader
              width={item?.width >= 300 ? "100px" : "60px"}
              borderWidth={item?.width >= 300 ? "30px" : "20px"}
            />
          </CommonLoaderContainer>
        </div>
      )}
    </div>
  );
};

const GhostImage = ({ item, isDragging, imageTransform }) => {
  // The ghost is a transient pan-time overlay — use the lightweight `small`
  // variant (falls back to medium/large, then item.url for blob/pending items)
  // so dragging never pulls the full-res bitmap. Display-only: item.url/urls in
  // Redux are untouched, so save/order/export still emit the live full-res URL.
  // The ghost is a transient 0.3-opacity pan overlay — always use the lightweight
  // `small` variant (web AND desktop). On desktop small is still a local file, so
  // it loads just as fast as large but decodes ~6 MB instead of ~96 MB, so starting
  // a pan never triggers a full-res decode. Display-only: item.url/urls untouched.
  const ghostSrc = item.url ? pickVariantUrl(item, ["small", "medium", "large"]) : "";
  return (
    <>
      <image
        href={ghostSrc}
        data-cy="ghost-image"
        data-id={item.id}
        className="page_photo_item ghostImage"
        transform={`translate(${item.image?.positionX}, ${item.image?.positionY}) ${imageTransform}`}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          opacity: 0.3,
        }}
        preserveAspectRatio="none"
        width={item.image?.width}
        height={item.image?.height}
        opacity="1"
      ></image>
    </>
  );
};

const BoxShadowItem = ({ item }) => {
  const offsetX = item?.shadow?.offsetX || 0; // Fallback to 0 if not defined
  const offsetY = item?.shadow?.offsetY || 0;
  const blurRadius = item?.shadow?.blurRadius || 0;
  return (
    <defs>
      <filter id={`shadow_photo_item_${item.id}`} width="2" height="2">
        <feDropShadow
          stdDeviation={blurRadius}
          dx={offsetX}
          dy={offsetY}
          floodColor={item?.shadow?.color || "#000000AD"}
        >
          {/* in flood color last 2 digit represent opacity try 4D for less opacity*/}
        </feDropShadow>
      </filter>
    </defs>
  );
};
