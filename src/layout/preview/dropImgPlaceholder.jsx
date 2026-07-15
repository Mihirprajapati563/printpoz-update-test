import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";

const PlaceholderWrapper = styled.div`
  background: #b3b3b3;
  background-size: cover;
  background-size: cover;
  height: 230px;
  background-position: center;
  text-align: center;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.6;
`;

function DropImagePlaceholder(props) {
  const dispatch = useDispatch();
  const { item } = props;

  return (
    <>
      <PlaceholderWrapper>
        <div></div>
      </PlaceholderWrapper>
    </>
  );
}

export default DropImagePlaceholder;
