import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addObjectInPage,
  setActiveObject,
  setCurrentObjectProperties,
  setZoom,
  setActiveSide,
  changeObjectInPage,
  removeObjectInPage,
} from "../../store/slices/canvas";
import {
  getActiveObject,
  getCurrentActivePageObjects,
  getCurrentPageIndex,
  getCanvasScale,
} from "../../library/utils/helpers";
import Text from "./Text";
import ItemDragger from "./ItemDragger";
import Photo from "./Photo";
import DropImagePlaceholder from "../dropImgPlaceholder";
import {
  getResolutionScaleValue,
  calculateZoomRatio,
  hasAnyClass,
} from "../../library/utils/common-functions";
import { EDITOR_TYPES } from "../../library/utils/constants/index.js";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import MaskImage from "./MaskImage";

const MainCanvas = () => {
  const dispatch = useDispatch();
  const Pages = useSelector((state) => state.canvas.pages);
  const zoomRatio = useSelector((state) => state.canvas.zoomRatio);
  const canvasScale = useSelector(getCanvasScale);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const currentActivePageObjects = useSelector(getCurrentActivePageObjects);
  const activeObject = useSelector(getActiveObject);
  const canvasSize = useSelector((state) => state.canvas.canvasSize);
  const activeEditorType = useSelector((state) => state.canvas.editorType);
  const wrapperRef = useRef(null);
  const [selectedSide, setSelectedSide] = useState(-1);

  const [isCover, setIsCover] = useState(false); // in photobook we are goign to display 2 pages at a time left and right. and cover always be half size of canvas size in width, so we will devide canvassize width by 2 to get cover page

  const initialFetchCall = async () => {
    try {
      const data = { brand_id: "", project_id: "1", user_id: "1" };
      const projectData = await apiPost(ENDPOINTS.getProjectDetails, data);
    } catch (error) {
    }
  };

  useEffect(() => {
    initialFetchCall();
  }, []);

  const handleLeftSideClick = useCallback(() => {
    setSelectedSide(0);
    dispatch(setActiveSide(0));
  }, [dispatch]);

  const handleRightSideClick = useCallback(() => {
    setSelectedSide(1);
    dispatch(setActiveSide(1));
  }, [dispatch]);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        activeObject &&
        activeObject.target &&
        !activeObject.target.contains(event.target)
      ) {
        if (
          hasAnyClass(event.target, ["rightSide", "leftSide", "pages-outer"])
        ) {
          dispatch(setCurrentObjectProperties(null));
        }
      }
    },
    [activeObject, dispatch]
  );

  // also when user presess escape key then deselect the active object
  // add key event handler

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        dispatch(setCurrentObjectProperties(null));
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dispatch]);

  // on delete key press remove the active object
  useEffect(() => {
    const handleDelete = (event) => {
      if (event.key === "Delete") {
        if (activeObject && activeObject.id) {
          dispatch(removeObjectInPage({ id: activeObject.id, data: null }));
          dispatch(setCurrentObjectProperties(null)); // deselecting  the object
        }
      }
    };
    document.addEventListener("keydown", handleDelete);
    return () => {
      document.removeEventListener("keydown", handleDelete);
    };
  }, [dispatch, activeObject]);

  const updateCanvasSize = () => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const result = getResolutionScaleValue(
        canvasSize.width,
        canvasSize.height,
        wrapper
      );
      if (result) {
        const { newWidth, newHeight } = result;
        const newZoomRatio = calculateZoomRatio(
          canvasSize.width,
          canvasSize.height,
          newWidth,
          newHeight
        );
        dispatch(setCurrentObjectProperties(null));
        dispatch(setZoom(newZoomRatio));
      }
    }
  };

  useEffect(() => {
    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
      (currentActivePageNumber === 0 ||
        currentActivePageNumber === Pages.length - 1)
    ) {
      setIsCover(true);
    } else {
      setIsCover(false);
    }
  }, [currentActivePageNumber]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [Pages.length]);

  const setCurrentTarget = (e, id) => {
    const obj = { e: e, target: e.currentTarget, id: id };
    // check currentactivepageobjects is undefined or not
    if (!currentActivePageObjects) return;

    dispatch(setActiveObject(obj));
  };

  const onCanvasDrop = (e) => {
    e.preventDefault();

    // get position of drop
    let left = e.nativeEvent.offsetX;
    let top = e.nativeEvent.offsetY;

    const obj = JSON.parse(e.dataTransfer.getData("imgs"));
    if (e.target.classList.contains("layoutDiv")) {
      const ss = { id: e.target.attributes[0].value, data: obj, type: "img" };
      dispatch(changeObjectInPage(ss));
    } else {
      obj.type = "img";
      obj.left = left;
      obj.top = top;
      dispatch(addObjectInPage(obj));
    }
  };

  const editonDblClick = (event, type) => {
    if (type === "text") {
      if (event.target.classList.contains("targetE")) {
        const element = event.target.firstChild.firstChild;
        element.contentEditable = true;

        element.focus();

        var range = document.createRange();
        range.selectNodeContents(element);
        var selection = window.getSelection();

        selection.removeAllRanges();
        selection.addRange(range);
      }
      dispatch(
        setCurrentObjectProperties({
          editable: true,
        })
      );
    }
  };
  const onsetobj = (event, type) => {
    if (type === "text") {
      dispatch(
        setCurrentObjectProperties({
          editable: false,
        })
      );
    }
  };

  return (
    <>
      <div
        className="CanvasWrapper d-flex justify-content-center align-items-start m-0 position-relative overflow-hidden"
        ref={wrapperRef}
      >
        <div className="position-absolute inset-0 d-flex align-items-center pages-outer">
          {Pages.map(
            (canvas, index) =>
              `${currentActivePageNumber}` === `${index}` && (
                <div key={index} className={`canvas-box position-relative`}>
                  <div
                    onDragEnter={(e) => e.preventDefault()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onCanvasDrop}
                    className={`WrapperDiv position-relative ${
                      !isCover ? "WrapperDivLine" : ""
                    } `}
                    style={{
                      transform: `scale(${canvasScale})`,
                      backgroundColor: canvas.bgColor,
                      width: `${
                        (canvasSize.width / (isCover ? 2 : 1)) * zoomRatio
                      }px`,
                      height: `${canvasSize.height * zoomRatio}px`,
                    }}
                  >
                    <div className="containerWrapperD">
                      <div
                        className={`leftSide d-inline-block ${
                          selectedSide === 0 && !isCover ? "selected-left" : ""
                        }`}
                        onClick={handleLeftSideClick}
                        style={{
                          width: (canvasSize.width * zoomRatio) / 2,
                          height: canvasSize.height * zoomRatio + "px",
                          backgroundColor:
                            canvas.layout &&
                            canvas.layout[0] &&
                            canvas.layout[0].background &&
                            canvas.layout[0].background.color
                              ? canvas.layout[0].background.color
                              : undefined,
                          backgroundImage:
                            canvas.layout &&
                            canvas.layout[0] &&
                            canvas.layout[0].background &&
                            canvas.layout[0].background.image
                              ? `url(${canvas.layout[0].background.image})`
                              : undefined,
                        }}
                      >
                        {canvas.layout &&
                          canvas.layout[0]?.objects.map(
                            (item, key) =>
                              //create div only if there is item.type img or text
                              (item.type === "img" || item.type === "text") && (
                                <div
                                  key={key}
                                  onMouseDown={(e) =>
                                    setCurrentTarget(e, item.id)
                                  }
                                  onDoubleClick={(e) =>
                                    editonDblClick(e, item.type)
                                  }
                                  onBlur={(e) => onsetobj(e, item.type)}
                                  data-id-t={item.id}
                                  className={`position-absolute layoutDiv targetE objTarget_${key} ${
                                    item.type === "img" &&
                                    "inset-0 overflow-hidden"
                                  }`}
                                  style={{
                                    width: item.width * zoomRatio + "px",
                                    height:
                                      item.type === "text"
                                        ? "auto"
                                        : item.height * zoomRatio + "px",
                                    top: item.top * zoomRatio + "px",
                                    left: item.left * zoomRatio + "px",
                                    transform: item.translate
                                      ? `translate(${
                                          item.translate[0] * zoomRatio
                                        }px, ${
                                          item.translate[1] * zoomRatio
                                        }px) rotate(${item.rotate}deg)`
                                      : `rotate(${item.rotate}deg)`,
                                  }}
                                >
                                  {item.type === "text" && (
                                    <Text item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "img" && item.url !== "" && (
                                    <Photo item={item} />
                                  )}
                                  {item.type === "img" && item.url === "" && (
                                    <DropImagePlaceholder item={item} />
                                  )}
                                </div>
                              )
                          )}
                      </div>

                      {/* if its photobook and cover page then no need to add right side , as cover as only single sinde always */}

                      {index !== 0 && (
                        <div
                          className={`rightSide d-inline-block ${
                            selectedSide === 1 && !isCover
                              ? "selected-right"
                              : ""
                          }`}
                          onClick={handleRightSideClick}
                          style={{
                            width: (canvasSize.width * zoomRatio) / 2,
                            height: canvasSize.height * zoomRatio + "px",
                            backgroundColor:
                              canvas.layout &&
                              canvas.layout[1] &&
                              canvas.layout[1].background &&
                              canvas.layout[1].background.color
                                ? canvas.layout[1].background.color
                                : undefined,
                            backgroundImage:
                              canvas.layout &&
                              canvas.layout[1] &&
                              canvas.layout[1].background &&
                              canvas.layout[1].background.image
                                ? `url(${canvas.layout[1].background.image})`
                                : undefined,
                          }}
                        >
                          {canvas.layout &&
                            canvas.layout[1]?.objects.map(
                              (item, key) =>
                                (item.type === "img" ||
                                  item.type === "text") && (
                                  <div
                                    key={key}
                                    onMouseDown={(e) =>
                                      setCurrentTarget(e, item.id)
                                    }
                                    onDoubleClick={(e) =>
                                      editonDblClick(e, item.type)
                                    }
                                    onBlur={(e) => onsetobj(e, item.type)}
                                    data-id-t={item.id}
                                    className={`position-absolute layoutDiv targetE objTarget_${key} ${
                                      item.type === "img" &&
                                      "inset-0 overflow-hidden"
                                    }`}
                                    style={{
                                      width: item.width * zoomRatio + "px",
                                      height:
                                        item.type === "text"
                                          ? "auto"
                                          : item.height * zoomRatio + "px",
                                      top: item.top * zoomRatio + "px",
                                      left: item.left * zoomRatio + "px",
                                      transform: item.translate
                                        ? `translate(${
                                            item.translate[0] * zoomRatio
                                          }px, ${
                                            item.translate[1] * zoomRatio
                                          }px) rotate(${item.rotate}deg)`
                                        : `rotate(${item.rotate}deg)`,
                                    }}
                                  >
                                    {item.type === "text" && (
                                      <Text item={item} zoomRatio={zoomRatio} />
                                    )}
                                    {item.type === "img" && item.url !== "" && (
                                      <Photo item={item} />
                                    )}
                                    {item.type === "img" && item.url === "" && (
                                      <DropImagePlaceholder item={item} />
                                    )}
                                  </div>
                                )
                            )}
                        </div>
                      )}
                    </div>
                  </div>

                  <ItemDragger />
                </div>
              )
          )}
        </div>
      </div>
    </>
  );
};

export default MainCanvas;
