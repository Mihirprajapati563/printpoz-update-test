import React, { useState, useEffect, useRef } from "react";
import Moveable from "react-moveable";
import { useDispatch, useSelector } from "react-redux";
import {
  getActiveObject,
  getActiveObjectprops,
  getCurrentActivePageObjects,
  getZoom,
} from "../../library/utils/helpers";
import { setCurrentObjectProperties } from "../../store/slices/canvas";
import { flushSync } from "react-dom";
const ItemDragger = () => {
  const dispatch = useDispatch();
  const activeObject = useSelector(getActiveObject);
  const zoomRatio = useSelector(getZoom);
  const getActivepageObjects = useSelector(getCurrentActivePageObjects);
  //     const dispatch = useDispatch
  const [elementGuidelines, setElementGuidelines] = useState([]);
  const [targetWidth, setTargetWidth] = useState("");
  const [targetHeight, setTargetHeight] = useState("");
  const [resizeTranslate, setResizeTranslate] = useState("");
  const [rotate, setRotate] = useState(0);
  const [textFontSize, setTextFontSize] = useState(0);
  const [keepratio, setKeepratio] = useState(false);
  const [defaultTextWidth, setDefaultTextWidth] = useState("");
  const [defaultFontSize, setDefaultFontSize] = useState("");
  //   const [scaledValues, setScaledValues] = useState({});
  const moveableRef = useRef(null);

  //   const getActiveObject = store?.getters?.getActiveObject;
  const getActiveCanvasObjProps = useSelector(getActiveObjectprops);
  //   const getZoom = store?.getters?.getZoom;
  const getObjects = getActivepageObjects?.length;

  useEffect(() => {
    setElementGuidelines((prev) => [
      ...prev,
      document.querySelector(".WrapperDiv"),
    ]);
  }, []);
  useEffect(() => {
    if (activeObject && activeObject?.target && moveableRef.current) {
      if (moveableRef.current) {
        moveableRef.current.dragStart(activeObject.e, activeObject.target);
      }
    }
  }, [activeObject]);

  useEffect(() => {
    const updateMoveable = () => {
      moveableRef.current?.updateRect();
      moveableRef.current?.updateTarget();
    };

    updateMoveable();
  }, [getActiveCanvasObjProps, getZoom]);

  useEffect(() => {
    const newarr = getActivepageObjects?.at(-1);
    if (newarr?.id) {
      const element = document.querySelector(`div[data-id-t="${newarr?.id}"]`);
      if (!elementGuidelines.includes(element)) {
        setElementGuidelines((prev) => [...prev, element]);
      }
    }
  }, [getObjects]);

  const onDrag = ({ target, left, top, moveable }) => {
    target.style.left = `${left}px`;
    target.style.top = `${top}px`;
    dispatch(
      setCurrentObjectProperties({
        top: parseInt(getActiveObjectTarget().style.top) / zoomRatio,
        left: parseInt(getActiveObjectTarget().style.left) / zoomRatio,
      })
    );
  };

  const onDragend = () => {
    dispatch(
      setCurrentObjectProperties({
        top: parseInt(getActiveObjectTarget().style.top) / zoomRatio,
        left: parseInt(getActiveObjectTarget().style.left) / zoomRatio,
      })
    );
  };

  const getActiveObjectTarget = () => {
    return activeObject && activeObject?.target;
  };

  const onRotate = ({ target, drag, rotate }) => {
    const beforeTranslate = drag.beforeTranslate;
    const activeobj = getActiveCanvasObjProps;

    // Apply the rotation and translation to the target
    target.style.transform = drag.transform;

    // Store the rotation angle for use in onRotateEnd
    setRotate(rotate);
    setResizeTranslate(beforeTranslate);
  };

  const onRotateEnd = () => {
    const activeobj = getActiveCanvasObjProps;
    // Update the object properties in the store with the new rotation angle

    // devide by zoomRatio to get the actual value for resizeTranslate, there are four values in resizeTranslate array

    let newResizeTranslate = resizeTranslate.map((value) => value / zoomRatio);
    dispatch(
      setCurrentObjectProperties({
        rotate: rotate,
        translate: newResizeTranslate,
        left: activeobj.left, // Ensure position remains stable
        top: activeobj.top,
      })
    );

    // Ensure the Moveable component reflects the final state
    moveableRef.current?.updateRect();
  };

  //   const onResizeStart = e => {
  //     const activeobj = getActiveCanvasObjProps;
  //     if (activeobj.type === 'img') {
  //       if (activeobj.url.includes('pexels.com')) {
  //         e.target.firstChild.style.backgroundImage = `url(${activeobj.url.split("?")[0]}?auto=compress&cs=tinysrgb&h=650&w=940)`;
  //       }

  //       if (activeobj?.url?.includes('unsplash.com')) {
  //         e.target.firstChild.style.backgroundImage = `url(${activeobj.url.split("w=")[0]}w=400)`;
  //       }
  //     }
  //   };

  const onResize = ({ target, width, height, drag }) => {
    const beforeTranslate = drag.beforeTranslate;
    const activeobj = getActiveCanvasObjProps;

    if (activeobj.type === "text") {
      target.style.width = `${width}px`;
      target.style.height = `auto`;
    } else {
      target.style.width = `${width}px`;
      target.style.height = `${height}px`;

      dispatch(
        setCurrentObjectProperties({
          width: width / zoomRatio,
          height: height / zoomRatio,
        })
      );
    }

    if (activeobj.type === "text" && keepratio) {
      const boxWidthinPercent = (width / defaultTextWidth) * 100;
      const fontsize = (defaultFontSize / 100) * boxWidthinPercent;
      target.firstElementChild.firstElementChild.style.fontSize = `${fontsize}px`;
      setTextFontSize(fontsize);
      target.style.width = `${width}px`;
      target.style.height = `auto`;
    }
    // Additional conditions for other types...

    target.style.transform =
      activeobj.rotate !== 0
        ? `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px) rotate(${activeobj.rotate}deg)`
        : `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;

    setTargetWidth(width);
    setTargetHeight(height);
    setResizeTranslate(beforeTranslate);
    moveableRef.current?.updateRect();
  };

  const onResizeEnd = ({ target }) => {
    const activeobj = getActiveCanvasObjProps;

    // if (activeobj.type === 'img') {
    //   if (activeobj.url.includes('pexels.com')) {
    //     target.firstChild.style.backgroundImage = `url(${activeobj.url.split("?")[0]}?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)`;
    //   }

    //   if (activeobj.url.includes('unsplash.com')) {
    //     target.firstChild.style.backgroundImage = `url(${activeobj.url.split("w=")[0]}w=1080)`;
    //   }
    // }

    // const left = activeobj.left + (resizeTranslate[0] / zoomRatio);
    // const top = activeobj.top + (resizeTranslate[1] / zoomRatio);

    const left = activeobj.left;
    const top = activeobj.top;

    if (activeobj.type === "text") {
      dispatch(
        setCurrentObjectProperties({
          left,
          top,

          width: targetWidth / zoomRatio,
          fs: parseInt(textFontSize / zoomRatio),
        })
      );
    } else {
      // devide all value by ratio
      let resizeTranslateCopy = resizeTranslate.map(
        (value) => value / zoomRatio
      );

      dispatch(
        setCurrentObjectProperties({
          left: left,
          top: top,
          translate: resizeTranslateCopy,
          width: targetWidth / zoomRatio,
          height: targetHeight / zoomRatio,
        })
      );
    }
    moveableRef.current?.updateRect();
  };

  //   const onRound = ({ target, borderRadius }) => {
  //     target.style.borderRadius = borderRadius;
  //     target.firstElementChild.style.borderRadius = borderRadius;
  //   };

  //   const onClick = ({ target, hasTarget, containsTarget, targetIndex }) => {
  //   };

  const onBeforeResize = (e) => {
    const activeobj = getActiveCanvasObjProps;
    if (activeobj.type === "text") {
      setDefaultTextWidth(activeobj.width);
      setDefaultFontSize(activeobj.fontSize);
    }

    if (e.inputEvent.shiftKey) {
      setKeepratio(true);
    } else {
      if (
        (JSON.stringify(e.startFixedDirection) === JSON.stringify([1, -1]) ||
          JSON.stringify(e.startFixedDirection) === JSON.stringify([1, 1]) ||
          JSON.stringify(e.startFixedDirection) === JSON.stringify([-1, -1]) ||
          JSON.stringify(e.startFixedDirection) === JSON.stringify([-1, 1])) &&
        activeobj.type === "text"
      ) {
        setKeepratio(true);
      } else {
        setKeepratio(false);
      }
    }
  };

  return (
    <Moveable
      origin={false}
      snappable={true}
      snapThreshold={5}
      snapRenderThreshold={1}
      isDisplayInnerSnapDigit={true}
      snapGap={true}
      snapDirections={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        center: true,
        middle: true,
      }}
      elementSnapDirections={{
        top: true,
        right: true,
        left: true,
        bottom: true,
      }}
      snapDigit={0}
      flushSync={flushSync}
      className="moveable"
      ref={moveableRef}
      target={activeObject?.target}
      draggable={true}
      rotatable={true}
      resizable={true}
      triggerAblesSimultaneously={true}
      throttleDrag={getActiveCanvasObjProps?.type === "Line" ? 0.3 : 0.5}
      throttleResize={0}
      edge={true}
      elementGuidelines={elementGuidelines}
      onDrag={onDrag}
      onDragEnd={onDragend}
      onRotate={onRotate}
      onRotateEnd={onRotateEnd}
      //   onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeEnd={onResizeEnd}
      //   onClick={onClick}
      onBeforeResize={onBeforeResize}
      keepRatio={keepratio}
      renderDirections={
        getActiveCanvasObjProps?.type === "img"
          ? ["nw", "n", "ne", "w", "e", "sw", "s", "se"]
          : ["nw", "ne", "w", "e", "sw", "se"]
      }
    />
  );
};

export default ItemDragger;
