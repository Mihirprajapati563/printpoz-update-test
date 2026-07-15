import React, { useEffect, useState } from "react";
import { useLiveResize } from "./liveResizeStore";
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
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";

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

function Shape({ item: rawItem, zoomRatio }) {
  // Live-resize override (no redux dispatch during the gesture → no MainCanvas
  // re-render). Merged over the redux item so React reflows the real geometry.
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
      filter={`url(#shadow_shape_item_${item.id})`}
      className="shape-item-svg fade-animate"
    >
      {/* generate dynamic shadow */}
      <BoxShadowItem item={item} />

      {/* gradient definition for shape fill */}
      <GradientDef item={item} />

      <g
        className="page-item--positioning-container"
        style={{ opacity: item.opacity }}
      >
        <g clipPath={`url(#clip-custom-${item.id})`}>
          {/* <MaskPath item={item} scaleX={scaleX} scaleY={scaleY} /> */}
          <g>
            <ShapeItem item={item} width={width} height={height} />
          </g>
        </g>
      </g>

      {/* <BorderMaskPath item={item} scaleX={scaleX} scaleY={scaleY} /> */}
    </g>
  );
}

export default React.memo(Shape);

const BorderMaskPath = ({ item, scaleX, scaleY }) => {
  return (
    <>
      {item.masking &&
      item.masking.path &&
      item.masking.path !== "M0 0 L24 0 L24 24 L0 24 Z" ? (
        <>
          {/* we need to find way to set radius when there is border radius and can allow only in rectangle*/}
          <path
            className="page_shape_item"
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
            className="page_shape_item"
            transform={`scale(${scaleX}, ${scaleY})`}
            // d="M0 0 L24 0 L24 24 L0 24 Z"
            d={generateRoundedRectPath(24, 24, item.border?.radius || 0)}
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
              transform={`scale(${scaleX}, ${scaleY})`}
              // d="M0 0 L24 0 L24 24 L0 24 Z"
              d={generateRoundedRectPath(24, 24, item.border?.radius || 0)}
              fill="transparent"
              stroke="black"
            />
          )}
        </clipPath>
      </defs>
    </>
  );
};

const ShapeItem = ({ item, width, height }) => {
  // Determine fill value - gradient takes priority
  const getFillValue = () => {
    if (
      item.gradient &&
      item.gradient.stops &&
      item.gradient.stops.length >= 2
    ) {
      return `url(#shape-gradient-${item.id})`;
    }
    return item.fill || "transparent";
  };

  const style = {
    fill: getFillValue(),
    opacity: item.opacity,
    // stroke: item.border.color,
    // strokeWidth: item.border.width,
    strokeDasharray: item.border.style === "dashed" ? "5, 5" : "none",
  };

  // calculate scale value based on 24x24 and width and height
  const scaleX = width / 24;
  const scaleY = height / 24;

  switch (item.shape) {
    case "rect":
      return (
        <>
          <g style={style}>
            {/* <filter id="image_effect_-" width="130%" height="130%">
                    <feColorMatrix in="SourceGraphic" type="matrix" values="0.3 0.7 0 0 0  0.3 0.7 0 0 0  0.3 0.7 0 0 0  0 0 0 1 0">
                    </feColorMatrix>
                </filter> */}
            {/* {getFilter(item.effect, "shape_effect_" + item.id)} */}

            <ShapeRectangle
              item={item}
              width={width}
              height={height}
              scaleX={scaleX}
            />
          </g>
        </>
      );
    case "circle":
      return (
        <g style={style}>
          <ShapeCircle
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );
    case "heart":
      return (
        <g style={style}>
          <ShapeHeart
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );
    case "star":
      return (
        <g style={style}>
          <ShapeStar
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );
    case "line":
      return (
        <g style={style}>
          <ShapeLine
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );
    case "triangle":
      return (
        <g style={style}>
          <ShapeTriangle
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );
    case "arrow":
      return (
        <g style={style}>
          <ShapeArrow
            item={item}
            width={width}
            height={height}
            scaleX={scaleX}
          />
        </g>
      );

    default:
      return null;
  }
};
const ShapeRectangle = ({ item, width, height, scaleX, scaleY }) => {
  return (
    <>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={item.border.radius * scaleX}
        ry={item.border.radius * scaleX}
        data-id={item.id}
        stroke={item.border.color}
        strokeWidth={item.border.width * scaleX}
        className="page-shape-rect"
      />
    </>
  );
};
const ShapeCircle = ({ item, width, height, scaleX, scaleY }) => {
  return (
    <circle
      cx={width / 2}
      cy={height / 2}
      r={width / 2}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={item.border.width * scaleX}
      fill={item.fill}
    />
  );
};
const ShapeHeart = ({ item, width, height, scaleX, scaleY }) => {
  const scaleWidth = width / 24; // Assuming the original width of the heart is 50
  const scaleHeight = height / 24; // Assuming the original height of the heart is 50

  const pathData = `
    M12 4.248c-3.148-5.402-12-3.825-12 2.944 0 4.661 5.571 9.427 12 15.808 6.43-6.381 12-11.147 12-15.808 0-6.792-8.875-8.306-12-2.944z
  `;

  return (
    <path
      d={pathData}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={(item.border.width * scaleX) / scaleWidth}
      fill={item.fill}
      transform={`scale(${scaleWidth}, ${scaleHeight})`}
    />
  );
};

const ShapeStar = ({ item, width, height, scaleX, scaleY }) => {
  // State to control animation classes
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    setAnimate(true);
  }, []);
  const scaleWidth = width / 24; // Assuming the original width of the heart is 50
  const scaleHeight = height / 24; // Assuming the original height of the heart is 50

  const pathData = `
    m11.322 2.923c.126-.259.39-.423.678-.423.289 0 .552.164.678.423.974 1.998 2.65 5.44 2.65 5.44s3.811.524 6.022.829c.403.055.65.396.65.747 0 .19-.072.383-.231.536-1.61 1.538-4.382 4.191-4.382 4.191s.677 3.767 1.069 5.952c.083.462-.275.882-.742.882-.122 0-.244-.029-.355-.089-1.968-1.048-5.359-2.851-5.359-2.851s-3.391 1.803-5.359 2.851c-.111.06-.234.089-.356.089-.465 0-.825-.421-.741-.882.393-2.185 1.07-5.952 1.07-5.952s-2.773-2.653-4.382-4.191c-.16-.153-.232-.346-.232-.535 0-.352.249-.694.651-.748 2.211-.305 6.021-.829 6.021-.829s1.677-3.442 2.65-5.44z
  `;

  return (
    <path
      d={pathData}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={(item.border.width * scaleX) / scaleWidth}
      fill={item.fill}
      transform={`scale(${scaleWidth}, ${scaleHeight})`}
    />
  );
};
const ShapeTriangle = ({ item, width, height, scaleX, scaleY }) => {
  const scaleWidth = width / 24; // Assuming the original width of the heart is 50
  const scaleHeight = height / 24; // Assuming the original height of the heart is 50
  const pathData = `
    M12 2 L22 22 L2 22 Z
  `;

  return (
    <path
      d={pathData}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={(item.border.width * scaleX) / scaleWidth}
      fill={item.fill}
      transform={`scale(${scaleWidth}, ${scaleHeight})`}
    />
  );
};
const ShapeArrow = ({ item, width, height, scaleX, scaleY }) => {
  const scaleWidth = width / 24; // Assuming the original width of the heart is 50
  const scaleHeight = height / 24; // Assuming the original height of the heart is 50
  // const pathData = `M2 12 L22 2 L22 22 Z`;
  const baseWidth = 24; // Base width for the arrow
  const baseHeight = 24;
  const pathData2 = `
    M0,${baseHeight / 2} 
    L${baseWidth - 2},${baseHeight / 2} 
    M${baseWidth - 2},${baseHeight / 2 - 2} 
    L${baseWidth},${baseHeight / 2} 
    L${baseWidth - 2},${baseHeight / 2 + 2} 
    Z
`;

  const pathData1 = `
M3.984,13.008 
h12.188 
L10.547,18.548 
l1.211,1.211 
l8.016-8.016 
l-8.016-8.016 
l-1.211,1.211 
l4.63,4.63 
H3.984 
v2.016 
z
`;

  const pathData = `
M12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C21.0976 11.6834 21.0976 12.3166 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H4C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289Z
`;

  return (
    <path
      d={pathData}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={(item.border.width * scaleX) / scaleWidth}
      fill={item.fill}
      transform={`scale(${scaleWidth}, ${scaleHeight})`}
    />
  );
};

const ShapeLine = ({ item, width, height, scaleX }) => {
  // lets create line from 0,0 to width,0
  const scaleWidth = width / 24; // Assuming the original width of the heart is 50
  const scaleHeight = height / 24; // Assuming the original height of the heart is 50
  let borderWidth = item.border.width * scaleX;
  if (borderWidth <= 0) {
    borderWidth = 1 * scaleX;
  }
  return (
    <line
      x1={0}
      y1={0}
      x2={width}
      y2={height}
      data-id={item.id}
      stroke={item.border.color}
      strokeWidth={borderWidth}
      fill={item.fill}
    />
  );
};

const BoxShadowItem = ({ item }) => {
  const offsetX = item?.shadow?.offsetX || 0; // Fallback to 0 if not defined
  const offsetY = item?.shadow?.offsetY || 0;
  const blurRadius = item?.shadow?.blurRadius || 0;
  return (
    <defs>
      <filter
        id={`shadow_shape_item_${item.id}`}
        width="4"
        height="4"
        x="-1"
        y="-1"
      >
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

// Gradient definition for shape fills
const GradientDef = ({ item }) => {
  if (
    !item.gradient ||
    !item.gradient.stops ||
    item.gradient.stops.length < 2
  ) {
    return null;
  }

  const sortedStops = [...item.gradient.stops].sort(
    (a, b) => a.position - b.position
  );

  const isRadial = item.gradient.type === "radial";

  return (
    <defs>
      {isRadial ? (
        <radialGradient
          id={`shape-gradient-${item.id}`}
          {...getRadialGradientCoords(item.gradient.radialPosition)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </radialGradient>
      ) : (
        <linearGradient
          id={`shape-gradient-${item.id}`}
          {...getLinearGradientCoords(item.gradient.angle || 90)}
        >
          {sortedStops.map((stop, idx) => (
            <stop
              key={idx}
              offset={`${stop.position}%`}
              stopColor={stop.color?.slice(0, 7) || "#000000"}
              stopOpacity={
                stop.color?.length === 9
                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                  : 1
              }
            />
          ))}
        </linearGradient>
      )}
    </defs>
  );
};
