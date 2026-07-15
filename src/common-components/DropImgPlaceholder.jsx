import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import DropImageBgPlaceholder from "../assets/svg/dropimgbg.svg";
import DropImageText from "../assets/svg/dropimgtext.svg";
const PlaceholderWrapper = styled.div`
  background-image: url(${DropImageText});
  background-size: cover;
  background-size: cover;
  height: 230px;
  background-position: center;
  text-align: center;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

function DropImagePlaceholder(props) {
  const dispatch = useDispatch();
  const { item, zoomRatio } = props;

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
          filter: `brightness(${item.brightness}%) contrast(${item.contrast}%) saturate(${item.saturation}%)`,
        }}
        key={item.id + "img"}
        className="img_placeholder noPointer position-absolute inset-0 p-5"
      >
        <img src={DropImageBgPlaceholder} alt="" />
      </PlaceholderWrapper>
    </>
  );
}

export default DropImagePlaceholder;
