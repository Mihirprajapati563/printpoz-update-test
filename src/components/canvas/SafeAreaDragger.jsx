import React, { useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import {
  getActiveSafeArea,
  getCanvasSize,
  getZoom,
  getCanvasScale,
} from "../../library/utils/helpers/index.js";
import { setCurrentSafeAreaProperties } from "../../store/slices/canvas";
import { useSelector, useDispatch } from "react-redux";
import { USER_TYPES } from "../../library/utils/constants/index.js";
function SafeAreaDragger() {
  const moveableRef = useRef(null);
  const activeSafeArea = useSelector(getActiveSafeArea);
  const [initialSize, setInitialSize] = useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });
  const zoomRatio = useSelector(getZoom);
  const canvasScale = useSelector(getCanvasScale);
  // Moveable lives inside the canvas-box `transform: scale`; its `zoom` prop is the
  // INVERSE so control lines stay a true 1px on screen (else Firefox drops them).
  const moveableZoom = 1 / (canvasScale || 1);
  const userDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetails);
  const canvasSize = useSelector(getCanvasSize);
  const dispatch = useDispatch();

  const onResize = (e) => {
    const x = e.dist[0];
    const y = e.dist[1];
    const direction = e.direction;
    const width = initialSize.width + x;
    const height = initialSize.height + y;

    // if direction is -1 then left and top will be negative so we need to add x and y to initialSize.left and initialSize.top
    const left = direction[0] === -1 ? initialSize.left - x : initialSize.left;
    const top = direction[1] === -1 ? initialSize.top - y : initialSize.top;

    dispatch(
      setCurrentSafeAreaProperties({
        ...activeSafeArea,
        width,
        height,
        left,
        top,
      })
    );
  };

  const onResizeStart = (e) => {
    setInitialSize({
      left: activeSafeArea.left,
      top: activeSafeArea.top,
      width: activeSafeArea.width,
      height: activeSafeArea.height,
    });
  };

  return (
    user?.userTypeCode !== USER_TYPES.CUSTOMER &&
    activeSafeArea?.target &&
    !activeSafeArea?.isLocked && (
      <Moveable
        zoom={moveableZoom}
        target={activeSafeArea.target}
        draggable
        resizable
        origin={false}
        throttleResize={0}
        throttleDrag={0}
        onDragStart={(e) => {
          const left = activeSafeArea.left;
          const top = activeSafeArea.top;

          setInitialSize({ ...initialSize, left, top });

          dispatch(
            setCurrentSafeAreaProperties({
              ...activeSafeArea,
              left,
              top,
            })
          );
        }}
        onDrag={({ target, beforeTranslate }) => {
          const [dx, dy] = beforeTranslate;

          const left = initialSize.left + dx;
          const top = initialSize.top + dy;

          dispatch(
            setCurrentSafeAreaProperties({
              ...activeSafeArea,
              left,
              top,
            })
          );
        }}
        onResize={onResize}
        onResizeStart={onResizeStart}
      />
    )
  );
}

export default SafeAreaDragger;
