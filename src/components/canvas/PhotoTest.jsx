import { useEffect, useState } from "react";
import { Dragger } from "../../common-components/StyledComponents";
import { FaArrowsAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  getActiveObject,
  getActiveObjectprops,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  setDragger,
} from "../../store/slices/canvas";
import LazyLoad from "react-lazyload";
import { IoAddCircleOutline } from "react-icons/io5";
import { FaHandRock } from "react-icons/fa";
import { AiOutlineDrag } from "react-icons/ai";
import DropImageBgPlaceholder from "../../assets/svg/dropimgbg.svg";
import DropImageText from "../../assets/svg/dropimgtext.svg";
const PlaceholderWrapper = styled.div`
  background-image: url(${DropImageText});
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

  // Create the path with rounded corners using the `arc` (A) command
  const path = `
        M${effectiveRadius},0 
        H${width - effectiveRadius} 
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${width},${effectiveRadius} 
        V${height - effectiveRadius} 
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${
    width - effectiveRadius
  },${height} 
        H${effectiveRadius} 
        A${effectiveRadius},${effectiveRadius} 0 0 1 0,${
    height - effectiveRadius
  } 
        V${effectiveRadius} 
        A${effectiveRadius},${effectiveRadius} 0 0 1 ${effectiveRadius},0 
        Z
    `;

  return path.trim(); // Return the path string
}

function PhotoTest({ item, zoomRatio }) {
  const { url, opacity, border, effects, width, height } = item;

  const getActiveCanvasObjProps = useSelector(getActiveObjectprops);
  const getActiveCanvasObj = useSelector(getActiveObject);

  const dispatch = useDispatch();
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [draggerIconSize, setDraggerIconSize] = useState(20);
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [imageTransform, setImageTransform] = useState("");
  // Size and position for the drag icon

  // Calculate the center position for the drag icon
  const imageCenterX = width / 2;
  const imageCenterY = height / 2;

  useEffect(() => {
    if (!item.url || item.url === "") {
      setIsPlaceholder(true);
    } else {
      setIsPlaceholder(false);
    }
    // lets calculate dragger icon size to 20% of image width
    let draggerSize = width * 0.5;
    // let set minimum and maximum size for dragger icon
    draggerSize = Math.max(20, Math.min(500, draggerSize));
    setDraggerIconSize(draggerSize);
  }, [item]);

  useEffect(() => {
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
  }, [item.flip.x, item.flip.y, item.image.scale]);

  const handleMouseDown = (e) => {
    // Only start dragging when clicking on the center icon

    // if (e.target.classList.contains('drag-icon')) {
    setIsDragging(true);
    setStartPosition({
      x: e.clientX / zoomRatio - item.image.positionX,
      y: e.clientY / zoomRatio - item.image.positionY,
    });
    //setStartPosition({ x: item.image.positionX, y: item.image.positionY });

    dispatch(setDragger(true)); // Optionally dispatch to Redux

    //draggerRef.current.style.display = 'none';
    // }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      let newX = e.clientX / zoomRatio - startPosition.x;
      let newY = e.clientY / zoomRatio - startPosition.y;

      // Calculate boundaries dynamically based on the clipping area's position and size

      const imageScale = item.image.scale || 1;
      const maxX = 0; // Left boundary
      const maxY = 0; // Top boundary

      const imageNewWidth = item.image.width * imageScale;
      const imageNewHeight = item.image.height * imageScale;

      const minX = width - item.image.width * imageScale; // Right boundary based on the image width and clipping area
      const minY = height - item.image.height * imageScale; // Bottom boundary based on the image height and clipping area

      newX = Math.max(Math.min(newX, maxX), minX);
      newY = Math.max(Math.min(newY, maxY), minY);

      dispatch(
        setCurrentObjectProperties({
          ...getActiveCanvasObjProps,
          image: {
            ...getActiveCanvasObjProps.image,
            positionX: newX,
            positionY: newY,
          },
          history: false,
        })
      );
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      dispatch(setDragger(false));
      dispatch(
        setCurrentObjectProperties({
          history: true,
        })
      );
      //draggerRef.current.style.display = 'flex';
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // add for touch device
      document.addEventListener("touchmove", handleMouseMove);
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
            />
          </g>
        </g>
      </g>

      <BorderMaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
      {!isPlaceholder && isDragging && (
        <GhostImage
          item={item}
          isDragging={isDragging}
          imageTransform={imageTransform}
        />
      )}

      {/* <GhostImage item={item} isDragging={isDragging} imageTransform={imageTransform} /> */}
      {!isPlaceholder &&
        !isDragging &&
        getActiveCanvasObj &&
        getActiveCanvasObj.id === item.id && (
          <g
            className="drag-icon"
            onTouchStart={handleMouseDown}
            onMouseDown={handleMouseDown}
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
    </g>
  );
}

export default PhotoTest;

const BorderMaskPath = ({ item, scaleX, scaleY }) => {
  const r = (item.width * item.border?.radius || 0) / 24;

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
  const r = (item.width * item.border?.radius || 0) / 24;
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
              // d="M0 0 L24 0 L24 24 L0 24 Z"
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

const PhotoItem2 = ({
  item,
  width,
  height,
  isPlaceholder,
  isDragging,
  imageTransform,
}) => {
  const filterId = item.effect ? `url(#image_effect_${item.id})` : "none";

  return (
    <>
      <g filter={item.effect ? filterId : null} key={`image-effect-${item.id}`}>
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
        />
        <image
          class="page_photo_item"
          data-id={item.id}
          href={item.url ? item.url : DropImageText}
          data-cy="svg-image"
          transform={`translate(${item.image?.positionX}, ${item.image?.positionY})`}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            ...(imageTransform ? { transform: imageTransform } : {}),
          }}
          preserveAspectRatio="none"
          width={item.image?.width}
          height={item.image?.height}
          opacity="1"
        ></image>
      </g>
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
}) => {
  const filterId = item.effect ? `url(#image_effect_${item.id})` : "none";

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
      <g filter={item.effect ? filterId : null} key={`image-effect-${item.id}`}>
        {/* <filter id="image_effect_-" width="130%" height="130%">
                    <feColorMatrix in="SourceGraphic" type="matrix" values="0.3 0.7 0 0 0  0.3 0.7 0 0 0  0.3 0.7 0 0 0  0 0 0 1 0">
                    </feColorMatrix>
                </filter> */}
        {/* {getFilter(item.effect, "image_effect_" + item.id)} */}
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
        />
        <foreignObject x={0} y={0} width={width} height={height}>
          <div
            class="page_photo_item"
            data-id={item.id}
            style={{
              // position: "absolute",
              width: width,
              height: height,
            }}
          >
            {!isPlaceholder && (
              <PhotoHolder
                item={item}
                isDragging={isDragging}
                imageTransform={imageTransform}
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
            values="0.3 0.7 0 0 0 0.3 0.7 0 0 0 0.3 0.7 0 0 0 0 0 0 1 0"
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
          values="0.3 0.7 0 0 0 0.3 0.7 0 0 0 0.3 0.7 0 0 0 0 0 0 1 0"
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
                        ${0.213 + 0.787 * saturationSlope} ${
            0.715 - 0.715 * saturationSlope
          } ${0.072 - 0.072 * saturationSlope} 0 0
                        ${0.213 - 0.213 * saturationSlope} ${
            0.715 + 0.285 * saturationSlope
          } ${0.072 - 0.072 * saturationSlope} 0 0
                        ${0.213 - 0.213 * saturationSlope} ${
            0.715 - 0.715 * saturationSlope
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
        className="page_photo_item img_placeholder noPointer position-absolute inset-0 p-5"
      >
        <img
          class="page_photo_item"
          src={DropImageBgPlaceholder}
          alt=""
          width="50%"
          height="50%"
        />
      </PlaceholderWrapper>
    </>
  );
};

const PhotoHolder = ({ item, isDragging, imageTransform }) => {
  return (
    <>
      {/* <LazyLoad height={item.height} width={item.width}> */}

      <img
        class="page_photo_item"
        //src={sampleBase64Image}
        src={item.url ? item.url : DropImageText}
        alt="image"
        data-id={item.id}
        width={item.image?.width * parseFloat(item.image.scale.toFixed(4))}
        height={item.image?.height * parseFloat(item.image.scale.toFixed(4))}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          marginLeft: `${item.image?.positionX || 0}px`,
          marginTop: `${item.image?.positionY || 0}px`,
          // left: 100,
          // top: item.image?.positionY,
          // borderRadius: '2px',
          // transform: 'translate(20px,20px)'
          // ...(imageTransform ? { transform: imageTransform } : {}),
          //transformOrigin: '0 0',
        }}
      />

      {/* </LazyLoad> */}
    </>
  );
};

const GhostImage = ({ item, isDragging, imageTransform }) => {
  return (
    <>
      <image
        class="page_photo_item"
        href={item.url ? item.url : ""}
        data-cy="ghost-image"
        className="ghostImage"
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
