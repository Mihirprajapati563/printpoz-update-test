import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Moveable from "react-moveable";
import {
  getPageSettings,
  getSettings,
  getCanvasSize,
} from "../../library/utils/helpers";
import { setPageSettings } from "../../store/slices/canvas";
const SVGClippper = () => {
  const svg = document.getElementById("canvasWrapper");
  const moveableRef = useRef(null);
  const dispatch = useDispatch();
  const settings = useSelector(getSettings);
  const pageSettings = useSelector(getPageSettings);
  const insetEdge = pageSettings?.insetEdge || {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  const canvasSize = useSelector(getCanvasSize);

  return (
    <Moveable
      ref={moveableRef}
      target={
        !pageSettings?.lockArea && pageSettings?.safeAreaAdded ? svg : null
      }
      draggable={false}
      startDragRotate={0}
      throttleDragRotate={0}
      origin={false}
      clippable={!pageSettings?.lockArea}
      clipRelative={true}
      defaultClipPath={`inset(${(insetEdge?.top / canvasSize.height) * 100}% ${
        (insetEdge?.right / canvasSize.width) * 100
      }% ${(insetEdge?.bottom / canvasSize.height) * 100}% ${
        (insetEdge?.left / canvasSize.width) * 100
      }%)`}
      clipTargetBounds={false}
      keepRatio={false}
      onDrag={(e) => {
        e.target.style.transform = e.transform;
      }}
      onClip={(e) => {
        function parseInsetClip(clipStyle) {
          const match = clipStyle.match(/inset\(([^)]+)\)/);
          if (!match) return null;

          const values = match[1].split(" ").map((v) => parseFloat(v));
          const [top, right, bottom, left] =
            values.length === 1
              ? [values[0], values[0], values[0], values[0]]
              : values.length === 2
              ? [values[0], values[1], values[0], values[1]]
              : values.length === 3
              ? [values[0], values[1], values[2], values[1]]
              : values;

          return {
            top: (top / 100) * canvasSize.height,
            right: (right / 100) * canvasSize.width,
            bottom: (bottom / 100) * canvasSize.height,
            left: (left / 100) * canvasSize.width,
          };
        }

        // Example usage
        const edges = parseInsetClip(e.clipStyle);
        dispatch(setPageSettings({ insetEdge: edges }));
        e.target.style.clipPath = e.clipStyle;
      }}
    />
  );
};

export default SVGClippper;
