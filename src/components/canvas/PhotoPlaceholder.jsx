import React, { useState, useRef, useEffect } from "react";
import DropImageBgPlaceholder from "../../assets/svg/dropimgbg.svg";
import DropImageText from "../../assets/svg/dropimgtext.svg";
function PhotoPlaeholder({ item, zoomRatio }) {
  const {
    url,
    style: { opacity, border, effects },
    width,
    height,
  } = item;

  return (
    <g className="photo-placeholder">
      <image
        href={DropImageText}
        width={width}
        height={height}
        data-cy="svg-image"
        data-id={item.id}
        className="page_photo_item"
        style={{
          opacity,
          border,
          effects,
        }}
        preserveAspectRatio="xMidYMid slice"
        opacity="1"
      ></image>

      <image
        data-id={item.id}
        href={DropImageBgPlaceholder}
        className="page_photo_item"
        width={width / 2}
        height={height / 2}
        x={width / 4}
        y={height / 4}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

export default PhotoPlaeholder;
