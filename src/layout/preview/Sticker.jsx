import { useState, useEffect } from "react";
import styled from "styled-components";
import SVGRenderer, { isSvgUrl } from "../../common-components/SVGRenderer.jsx";
import { useLiveResize } from "../../components/canvas/liveResizeStore";
import { resolveImageUrl } from "../../library/utils/helpers/imageCache.js";

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

function Sticker({ item: rawItem }) {
  // Live-resize override: mirrors the canvas sticker resize into the footer thumbnail.
  const liveResize = useLiveResize(rawItem.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const { url, opacity, border, effects, width, height } = item;

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
      filter={`url(#prev_shadow_sticker_item_${item.id})`}
      className="sticker-item-svg"
    >
      {/* generate dynamic shadow */}
      <BoxShadowItem item={item} />

      <g
        className="page-item--positioning-container"
        style={{ opacity: item.opacity }}
      >
        <g clipPath={`url(#prev_clip-custom-${item.id})`}>
          <MaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
          <g>
            <PhotoItem item={item} width={width} height={height} />
          </g>
        </g>
      </g>

      <BorderMaskPath item={item} scaleX={scaleX} scaleY={scaleY} />
    </g>
  );
}

export default Sticker;

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
            className="page_sticker_item"
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
            className="page_sticker_item"
            // transform={`scale(${scaleX}, ${scaleY})`}
            // d="M0 0 L24 0 L24 24 L0 24 Z"
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

const MaskPath = ({ item, scaleX, scaleY }) => {
  const rectanglePath = "M0 0 L24 0 L24 24 L0 24 Z";
  const r = (item.width * item.border?.radius || 0) / 24;

  return (
    <>
      <defs>
        <clipPath id={`prev_clip-custom-${item.id}`}>
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

const PhotoItem = ({ item, width, height }) => {
  const isSvg = isSvgUrl(item.url);
  const filterId = item.effect ? `url(#sticker_effect_${item.id})` : "none";

  const [resolvedUrl, setResolvedUrl] = useState(item.url);
  useEffect(() => {
    let cancelled = false;
    resolveImageUrl(item.url).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => { cancelled = true; };
  }, [item.url]);

  return (
    <>
      <g filter={item.effect ? filterId : null}>
        {getFilter(item.effect, "sticker_effect_" + item.id)}

        <rect
          x={0}
          y={0}
          data-id={item.id}
          className="page-sticker-rect"
          width={width}
          height={height}
          fill="transparent"
        />

        {isSvg ? (
          <SVGRenderer
            src={resolvedUrl}
            renderAs="foreignObject"
            width={width}
            height={height}
            dataId={item.id}
            className="page_sticker_item"
            style={{
              cursor: "grab",
              transform: [
                item.flip?.x ? `translateX(${item.width}px) scaleX(-1)` : "",
                item.flip?.y ? `translateY(${item.height}px) scaleY(-1)` : "",
              ].filter(Boolean).join(" ") || "none",
            }}
            constrainSize={false}
          />
        ) : (
        <image
          class="page_sticker_item"
          data-id={item.id}
          href={resolvedUrl}
          data-cy="svg-image"
          style={{
            cursor: "grab",
            transform: [
              item.flip?.x ? `translateX(${item.width}px) scaleX(-1)` : "",
              item.flip?.y ? `translateY(${item.height}px) scaleY(-1)` : "",
            ].filter(Boolean).join(" ") || "none",
          }}
          preserveAspectRatio="xMidYMid meet"
          width={item.width}
          height={item.height}
          opacity="1"
        ></image>
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

const BoxShadowItem = ({ item }) => {
  const offsetX = item?.shadow?.offsetX || 0; // Fallback to 0 if not defined
  const offsetY = item?.shadow?.offsetY || 0;
  const blurRadius = item?.shadow?.blurRadius || 0;
  return (
    <defs>
      <filter id={`prev_shadow_sticker_item_${item.id}`} width="2" height="2">
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
