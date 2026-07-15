import React, { useState, useEffect } from "react";
import styled from "styled-components";

const Wrapper = styled.div`
  background: #464646;
  border-radius: 1px;
  top: -10px;
  position: absolute;
  z-index: 100;
  font-size: 10px;
  color: white;
  padding-left: 5px;
  padding-right: 5px;
  border: 1px solid white;
`;
const SmallInput = styled.input`
  width: 55px; /* Adjust the width as needed */
  min-height: calc(1em + 0.5rem + calc(var(--bs-border-width) * 2));
  padding: 2px; /* Adjust the padding as needed */
  font-size: 11px; /* Adjust the font size as needed */
  mozappearance: textfield;
  -webkit-appearance: none;
  margin: 1px;
  background: #666;
  color: white;
`;

function ObjectProperty({
  style,
  objectWidth,
  objectHeight,
  objectRotation,
}) {
  const [width, setWidth] = useState(objectWidth);
  const [height, setHeight] = useState(objectHeight);
  // Normalised committed angle. During a live rotate ItemDragger overwrites the
  // .labelObjectRotationVal node imperatively (redux is frozen); on rotate end this
  // prop updates and React re-renders the committed value.
  const rotationDeg = Math.round(((Number(objectRotation) || 0) % 360 + 360) % 360) % 360;

  const handleWidthChange = (e) => {
    const newWidth = e.target.value;
    setWidth(newWidth);
    // onSizeChange(newWidth, height);
  };

  const handleHeightChange = (e) => {
    const newHeight = e.target.value;
    setHeight(newHeight);
    //  onSizeChange(width, newHeight);
  };
  return (
    <>
      <Wrapper style={style} className="shadow-sm labelObjectProperty">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            {objectWidth && objectHeight && (
              <span>
                W:{parseInt(objectWidth)} H:{parseInt(objectHeight)}{" "}
              </span>
            )}
            {/* Always render so the DOM node exists at 0° for the live-rotate write */}
            <span className="labelObjectRotationVal">∠{rotationDeg}°</span>
          </div>
          {objectWidth && objectHeight && (
            <div className="d-flex align-items-center" style={{ display: "none" }}>

              {/* <div className='d-flex align-items-center'>
                            <span>W:</span>
                            <SmallInput
                                type="number"
                                value={width}
                                onChange={handleWidthChange}
                                className="form-control form-control-sm mx-1"
                               
                                min="0"
                                step="1"
                                pattern="\d*"
                            />
                            <span>H:</span>
                            <SmallInput
                                type="number"
                                value={height}
                                onChange={handleHeightChange}
                                className="form-control form-control-sm mx-1"
                              
                                min="0"
                                step="1"
                                pattern="\d*"
                            />
                        </div> */}
            </div>
          )}
        </div>
      </Wrapper>
    </>
  );
}

export default ObjectProperty;
