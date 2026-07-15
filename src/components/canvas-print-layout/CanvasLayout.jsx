import { useEffect, useState } from "react";
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

function CanvasLayout({ canvasSize }) {
  if (!canvasSize) {
    return null;
  }
  const thinknessinPixel = canvasSize.depth;
  const canvasWidth = canvasSize.width;
  const canvasHeight = canvasSize.height;
  // https://designer.ezycreate.com/designer

  return (
    <g className="corner-canvas-item-svg">
      {/* create rectangle at top left corner */}
      <ShapeRectangle
        x={0}
        y={0}
        width={thinknessinPixel}
        height={thinknessinPixel}
      />

      {/* create rectangle at right top corner */}
      <ShapeRectangle
        x={canvasWidth - thinknessinPixel}
        y={0}
        width={thinknessinPixel}
        height={thinknessinPixel}
      />

      {/* create rectangle at left bottom corner */}
      <ShapeRectangle
        x={0}
        y={canvasHeight - thinknessinPixel}
        width={thinknessinPixel}
        height={thinknessinPixel}
      />
      {/* create rectangle at right bottom corner */}
      <ShapeRectangle
        x={canvasWidth - thinknessinPixel}
        y={canvasHeight - thinknessinPixel}
        width={thinknessinPixel}
        height={thinknessinPixel}
      />

      {/* create line from top left to top right corner , by top space of  thinknessinPixel */}
      <ShapeLine
        x1={thinknessinPixel}
        y1={thinknessinPixel}
        x2={canvasWidth - thinknessinPixel}
        y2={thinknessinPixel}
      />

      {/* create line from top right to bottom right corner , by right space of  thinknessinPixel */}
      <ShapeLine
        x1={canvasWidth - thinknessinPixel}
        y1={thinknessinPixel}
        x2={canvasWidth - thinknessinPixel}
        y2={canvasHeight - thinknessinPixel}
      />

      {/* create line from bottom right to bottom left corner , by bottom space of  thinknessinPixel */}
      <ShapeLine
        x1={canvasWidth - thinknessinPixel}
        y1={canvasHeight - thinknessinPixel}
        x2={thinknessinPixel}
        y2={canvasHeight - thinknessinPixel}
      />

      {/* create line from bottom left to top left corner , by left space of  thinknessinPixel */}
      <ShapeLine
        x1={thinknessinPixel}
        y1={canvasHeight - thinknessinPixel}
        x2={thinknessinPixel}
        y2={thinknessinPixel}
      />
    </g>
  );
}

export default CanvasLayout;

const ShapeRectangle = ({ x, y, width, height }) => {
  // create rect with white background and black border

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={"#f6f6f6"}
        strokeWidth={0}
        fill="#f6f6f6"
        className="page-canvas-corner-rect"
      />
    </>
  );
};
const ShapeLine = ({ x1, y1, x2, y2 }) => {
  //create dotted line with red color

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="white"
      strokeWidth="5"
      strokeDasharray="12, 25"
    />
  );
};
