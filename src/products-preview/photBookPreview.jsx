import HTMLFlipBook from "react-pageflip";
import { useState } from "react";
import {
  BodyText,
  Box,
  FlexBox,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  FlipBookContainer,
  FlipBookPages,
  PhotoModalBodyStyled,
} from "../common-components/StyledComponents.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllPages,
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getAllObjectsSortedByZIndexByPageNumber,
  getAllObjectsSortedByZIndexByPageLayoutNumber,
} from "../library/utils/helpers/index.js";
import { EDITOR_TYPES } from "../library/utils/constants/index.js";
import Text from "../layout/preview/Text.jsx";
import Photo from "../layout/preview/Photo.jsx";
import Sticker from "../layout/preview/Sticker.jsx";
import {
  calculateZoomRatio,
  getResolutionScaleValueBySize,
} from "../library/utils/common-functions/index.js";
export const PhobookPreview = ({ show, handleClose }) => {
  const AllPages = useSelector(getAllPages);
  const [previewBoxSize, setPreviewBoxSize] = useState({
    width: "100%",
    height: "100%",
  });
  const activeEditorType = useSelector(getActiveEditorType);
  const canvasSize = useSelector(getCanvasSize);
  const [zoomRatio, setZoomRatio] = useState(1);
  const state = useSelector((state) => state); // Get the entire state
  // Define page width and height based on the canvas size
  const pageWidth = canvasSize.width / 2; // For left/right split
  const pageHeight = canvasSize.height; // Full height
  return (
    <PhotoModalStyled
      dialogClassName="mob_full_screen_modal"
      width="100%"
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
    >
      <PhotoModalHeader>
        <FlexBox
          className="cursor-pointer mob_heading_flex"
          grow={1}
          justify="center"
          onClick={handleClose}
        >
          <BodyText
            className="mob_text_flex"
            fontsize="20px"
            fontweight="600"
            textcolor="#232323"
            ml="80px"
          >
            Preview
          </BodyText>
        </FlexBox>
      </PhotoModalHeader>

      <PhotoModalBodyStyled>
        <FlipBookContainer>
          <HTMLFlipBook width={400} height={500}>
            {AllPages?.map((activePage, pageIndex) => {
              return (
                // Loop through the layouts inside each page and generate a FlipBookPage for each layout
                activePage.layout?.map((layout, layoutIndex) => {
                  const sortedObjects =
                    getAllObjectsSortedByZIndexByPageLayoutNumber(
                      state,
                      pageIndex,
                      layoutIndex
                    );

                  return (
                    <FlipBookPages key={`${pageIndex}-${layoutIndex}`}>
                      <div
                        className={`WrapperDiv position-relative`}
                        style={{
                          backgroundColor: activePage.bgColor,
                          transform: "scale(1)",
                          width: "400px",
                          height: "500px",
                        }}
                      >
                        <div className="containerWrapperD">
                          <svg
                            key={layoutIndex}
                            width={"100%"}
                            height={"100%"}
                            viewBox={[
                              0,
                              0,
                              activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                                pageIndex !== 0 &&
                                pageIndex !== AllPages.length - 1
                                ? canvasSize.width
                                : canvasSize.width / 2,
                              canvasSize.height,
                            ]}
                          >
                            <defs>
                              {/* Define background image pattern for each layout */}
                              {layout.background?.image && (
                                <pattern
                                  id={`bg-pattern-${layout.id}`}
                                  patternUnits="objectBoundingBox"
                                  width="1"
                                  height="1"
                                >
                                  <image
                                    href={layout.background.image}
                                    x="0"
                                    y="0"
                                    width={canvasSize.width / 2}
                                    height={canvasSize.height}
                                    preserveAspectRatio="xMidYMid slice"
                                  />
                                </pattern>
                              )}
                            </defs>

                            {/* Background Rectangle for each layout */}
                            <rect
                              id={`rect-layout-${layout.id}`}
                              x={layoutIndex === 0 ? "0" : canvasSize.width / 2}
                              y="0"
                              width={canvasSize.width / 2}
                              height={canvasSize.height}
                              fill={
                                layout.background?.image
                                  ? `url(#bg-pattern-${layout.id})`
                                  : layout.background?.color || "#ffffff"
                              }
                            />

                            {/* Render all objects in this layout */}
                            <g className="allObjects d-inline-block">
                              <g className="no-clipping">
                                {sortedObjects.map((item) => (
                                  <g
                                    key={item.id}
                                    className={`position-absolute layoutDiv targetE objTarget_${item.id
                                      } ${item.type === "img"
                                        ? "inset-0 overflow-hidden"
                                        : ""
                                      }`}
                                  >
                                    <g
                                      className="page-item"
                                      data-index={item.zIndex}
                                      data-id-t={item.id} // Unique identifier for the SVG group
                                      style={{
                                        transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                        transformOrigin: "center center",
                                        transformBox: "fill-box",
                                        overflow: "hidden",
                                        width: item.width,
                                        height: item.height,
                                      }}
                                    >
                                      {item.type === "text" && (
                                        <Text
                                          item={item}
                                          zoomRatio={zoomRatio}
                                        />
                                      )}
                                      {item.type === "img" && (
                                        <Photo
                                          item={item}
                                          zoomRatio={zoomRatio}
                                          size={"medium"}
                                        />
                                      )}
                                      {item.type === "sticker" && (
                                        <Sticker
                                          item={item}
                                          zoomRatio={zoomRatio}
                                        />
                                      )}
                                    </g>
                                  </g>
                                ))}
                              </g>
                            </g>
                          </svg>
                        </div>
                      </div>
                    </FlipBookPages>
                  );
                })
              );
            })}
          </HTMLFlipBook>
        </FlipBookContainer>
      </PhotoModalBodyStyled>
    </PhotoModalStyled>
  );
};
