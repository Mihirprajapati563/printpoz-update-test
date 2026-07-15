import { useEffect, useId, useState } from "react";
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

import DropImageBgPlaceholder from "../../assets/svg/dropimgbg.svg";
import DropImageText from "../../assets/svg/dropimgtext.svg";
const PlaceholderWrapper = styled.div`
  // background-image:url(${DropImageText});
  background: #d5d5d5;
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

function LayoutImgPlaceholder({ item }) {
  const { url, opacity, border, effects, width, height } = item;
  const reactId = useId();
  const clipId = `clip-custom-${reactId.replace(/:/g, "")}-${item.id}`;
  const shadowId = `layout_shadow_photo_item_${reactId.replace(/:/g, "")}-${item.id}`;

  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [imageTransform, setImageTransform] = useState("");

  useEffect(() => {
    const transform = [
      item.flip.x ? "scaleX(-1)" : "",
      item.flip.y ? "scaleY(-1)" : "",
      item.image.scale
        ? `scale(${parseFloat(item.image.scale.toFixed(1))})`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    setImageTransform(transform);
  }, [item.flip.x, item.flip.y, item.image.scale]);

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

  const baseWidth = item.masking?.width || 24;
  const baseHeight = item.masking?.height || 24;
  const { scaleX, scaleY } = generateScaledClipPath(
    baseWidth,
    baseHeight,
    width,
    height
  );

  return (
    <g
      filter={`url(#${shadowId})`}
      className="photo-item"
    >
      {/* generate dynamic shadow */}
      <BoxShadowItem item={item} shadowId={shadowId} />

      <g
        className="page-item--positioning-container"
        style={{ opacity: item.opacity }}
      >
        <g clipPath={`url(#${clipId})`}>
          <MaskPath item={item} scaleX={scaleX} scaleY={scaleY} clipId={clipId} />
          <g>
            <PhotoItem
              item={item}
              width={width}
              height={height}
              isPlaceholder={isPlaceholder}
              imageTransform={imageTransform}
            />
          </g>
        </g>
      </g>

      <BorderMaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
    </g>
  );
}

export default LayoutImgPlaceholder;

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
            strokeWidth={item.border?.width}
          />
        </>
      ) : (
        <>
          <path
            data-id={item.id}
            className="page_photo_item"
            d={generateRoundedRectPath(item.width, item.height, r)}
            fill="transparent"
            stroke={item.border?.color}
            strokeWidth={item.border?.width}
          />
        </>
      )}
    </>
  );
};

const MaskPath = ({ item, scaleX, scaleY, clipId }) => {
  const rectanglePath = "M0 0 L24 0 L24 24 L0 24 Z";
  const r =
    (parseFloat(item.width) * parseFloat(item.border?.radius) || 0) / 24;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
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

const PhotoItem = ({ item, width, height, isPlaceholder }) => {
  const filterId = item.effect ? `url(#image_effect_${item.id})` : "none";
  return (
    <>
      <g filter={item.effect ? filterId : null} key={`image-effect-${item.id}`}>
        {getFilter(item.effect, "image_effect_" + item.id)}

        {isPlaceholder ? (
          <rect
            x={0}
            y={0}
            data-id={item.id}
            className="page-img-rect"
            width={width}
            height={height}
            fill="#d5d5d5"
          />
        ) : (
          <>
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
                className="page_photo_item"
                data-id={item.id}
                style={{
                  width: width,
                  height: height,
                }}
              />
            </foreignObject>
          </>
        )}
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

const PlaceHolder = (item) => {
  return (
    <>
      <PlaceholderWrapper
        style={{
          opacity: item.opacity,
          // backgroundSize:  'cover',
          // backgroundRepeat: 'no-repeat',
          // backgroundPosition: 'center center', borderRadius: item.borderRadius + 'px',
        }}
        key={item.id + "img"}
        className="page_photo_item img_placeholder noPointer  inset-0 p-5"
      >
        {/* <img class="page_photo_item" src="/images/dropimgbg.svg" alt="" width="70%" /> */}
      </PlaceholderWrapper>
    </>
  );
};

const BoxShadowItem = ({ item, shadowId }) => {
  const offsetX = item?.shadow?.offsetX || 0; // Fallback to 0 if not defined
  const offsetY = item?.shadow?.offsetY || 0;
  const blurRadius = item?.shadow?.blurRadius || 0;
  return (
    <defs>
      <filter id={shadowId} width="2" height="2">
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
