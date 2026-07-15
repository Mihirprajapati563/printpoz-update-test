import React, { useEffect, useState } from "react";

// redux imports
import { useSelector } from "react-redux";

// static image
import BackGround from "../assets/images/desktop-bg.jpg";
import MobileBG from "../assets/images/mobile-bg.jpg";
import Spiral from "../assets/images/spiral.png";
import Screw from "../assets/images/screw.png";

// styled component
import {
  PhotoModalStyled,
  PhotoModalCloseHeader,
  PhotoModalBody,
  WallContainer,
  TopLeftScrew,
  TopRightScrew,
  BottomLeftScrew,
  BottomRightScrew,
} from "../common-components/StyledComponents";

// preveiw objects
import Sticker from "../layout/preview/Sticker";
import QRCode from "../layout/preview/QRCode";
import Photo from "../layout/preview/Photo";
import Text from "../layout/preview/Text";
import DynamicCalendar from "../layout/preview/DynamicCalendar";
import Shape from "../layout/preview/Shape";

// utils import
import { EDITOR_TYPES } from "../library/utils/constants";
import {
  getActiveEditorType,
  getAllPages,
  getCanvasSize,
  getCurrentPageIndex,
  getAllObjectsSortedByZIndexByPageIndex,
  getSafeAreas,
  getAllSafeAreaObjects,
  getCalendarSettings,
} from "../library/utils/helpers";
import {
  calculateZoomRatio,
  getResolutionScaleValueBySize,
} from "../library/utils/common-functions";
import MultipleDynamicCalendar from "../components/calendar/MultipleDynamicCalendar";

function WallPreview({ show, handleClose }) {
  const AllPages = useSelector(getAllPages);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const sortedObjects = getAllObjectsSortedByZIndexByPageIndex(
    AllPages[currentActivePageNumber],
    0
  );
  const [DesktopBackGround, setDesktopBackGround] = useState(BackGround); // desktop background
  const [MobileBackGround, setMobileBackGround] = useState(MobileBG); // mobile background

  return (
    <PhotoModalStyled
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
      fullscreen
    >
      <PhotoModalCloseHeader closeButton />
      <PhotoModalBody className="d-flex justify-content-center align-items-center">
        <WallContainer
          desktopBackGroundImage={DesktopBackGround}
          mobileBackGroundImage={MobileBackGround}
        >
          <div className="position-absolute">
            <Page
              key={AllPages[currentActivePageNumber].id}
              data={AllPages[currentActivePageNumber].id}
              index={currentActivePageNumber}
              activePage={AllPages[currentActivePageNumber]}
              sortedObjects={sortedObjects}
              totalPages={0}
            />
          </div>
        </WallContainer>
      </PhotoModalBody>
    </PhotoModalStyled>
  );
}

export default WallPreview;

const Page = ({ activePage, sortedObjects, index, key, totalPages }) => {
  const canvasSize = useSelector(getCanvasSize);
  const bleedMargin = canvasSize.bleedMargin || 0;
  const trimWidth = canvasSize.width - bleedMargin * 2;
  const trimHeight = canvasSize.height - bleedMargin * 2;
  const activeEditorType = useSelector(getActiveEditorType);
  const [previewBoxSize, setPreviewBoxSize] = useState({
    width: 120,
    height: 80,
  });
  const [zoomRatio, setZoomRatio] = useState(1);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const safeAreas = useSelector(getSafeAreas);
  const allSafeAreaObjects = useSelector(getAllSafeAreaObjects);
  const calendarSettings = useSelector(getCalendarSettings);
  const AllPages = useSelector(getAllPages);

  const monthPageIndex = calendarSettings?.addCover ? Math.max(0, currentActivePageNumber - 1) : currentActivePageNumber;

  const updatePreviewCanvasSize = () => {
    let maxWidth;
    let maxHeight;
    if (window.innerWidth > 768) {
      maxHeight =
        window.innerHeight /
        (activeEditorType === EDITOR_TYPES.CALENDER ? 2.5 : 3.5);
      maxWidth =
        window.innerWidth /
        (activeEditorType === EDITOR_TYPES.CALENDER ? 2.5 : 3.5);
    } else {
      maxHeight = window.innerHeight / 3;
      maxWidth = window.innerWidth / 3;
    }
    const newLayoutBoxSize = getResolutionScaleValueBySize(
      trimWidth,
      trimHeight,
      maxWidth,
      maxHeight
    );
    if (newLayoutBoxSize) {
      const newZoomRatio = calculateZoomRatio(
        trimWidth,
        trimHeight,
        newLayoutBoxSize.width,
        newLayoutBoxSize.height
      );
      setZoomRatio(newZoomRatio);
      setPreviewBoxSize(newLayoutBoxSize);
    }
  };

  useEffect(() => {
    updatePreviewCanvasSize();
  }, [canvasSize]);

  const getWidth = (index) => {
    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
      (index === 1 || index === totalPages - 2)
    ) {
      return previewBoxSize.width / 2;
    }
    return previewBoxSize.width;
  };

  const getHeight = () => {
    return previewBoxSize.height;
  };
  const getCanvasWidth = () => {
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      return trimWidth / 2;
    }
    return trimWidth;
  };
  const calculateSvgDimensions = (index) => {
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isSpecialPage =
      index === 0 ||
      index === totalPages - 1 ||
      index === 1 ||
      index === totalPages - 2;

    const width =
      isPhotobook && isSpecialPage
        ? (trimWidth / 2) * zoomRatio
        : trimWidth * zoomRatio;
    const viewBoxWidth = isPhotobook && isSpecialPage ? canvasSize.width / 2 : canvasSize.width;
    // Use full canvas for viewBox - this ensures rotation works correctly
    const viewBox = [0, 0, viewBoxWidth, canvasSize.height].join(" ");

    return { width, viewBox, viewBoxWidth };
  };

  return (
    <>
      <div
        style={{ position: "relative", display: "inline-block" }}
        className={`${activeEditorType === EDITOR_TYPES.CALENDER
          ? "calender-container"
          : "acrylic-container"
          }`}
      >
        {/* <PreviewItem> */}
        {activeEditorType === EDITOR_TYPES.PHOTOBOOK && index === 1 && (
          <div
            className="WrapperDivLine2"
            style={{
              width: `${getWidth(index)}px`,
              height: `${getHeight()}px`,
              backgroundColor: "#e6e6e6",
            }}
          ></div>
        )}

        {/* spiral image only in calender */}
        {activeEditorType === EDITOR_TYPES.CALENDER && (
          <img
            src={Spiral}
            className="position-absolute"
            style={{
              height: "8rem",
              width: "100%",
              top: "-4.1rem",
              zIndex: 1,
            }}
          />
        )}
        {/* screw images */}
        {activeEditorType === EDITOR_TYPES.ACRYLIC && (
          <div
            className="position-absolute"
            style={{ width: "100%", height: "100%" }}
          >
            {/* top left */}
            <TopLeftScrew top={"0.3rem"} left={"0.3rem"} src={Screw} />
            {/* top right */}
            <TopRightScrew top={"0.3rem"} right={"0.3rem"} src={Screw} />
            {/* bottom left */}
            <BottomLeftScrew bottom={"0.3rem"} left={"0.3rem"} src={Screw} />
            {/* bottom right */}
            <BottomRightScrew bottom={"0.3rem"} right={"0.3rem"} src={Screw} />
          </div>
        )}

        <div
          className={`WrapperDiv position-relative ${activeEditorType == EDITOR_TYPES.PHOTOBOOK &&
            index !== 0 &&
            index !== totalPages - 1 &&
            index !== 1 &&
            index !== totalPages - 2
            ? "WrapperDivLine"
            : ""
            } `}
          style={{
            backgroundColor: activePage.bgColor,
            width: `${calculateSvgDimensions(index).width}px`,
            height: `${previewBoxSize.height}px`,
          }}
        >
          <div className="containerWrapperD">
            {(() => {
              const svgDimensions = calculateSvgDimensions(index);
              const trimClipId = `trimClip-${index}`;
              // Calculate the scale ratio - how many screen pixels per canvas pixel
              const scaleX = previewBoxSize.width / trimWidth;
              const scaleY = previewBoxSize.height / trimHeight;
              // Offset to shift the SVG so trim area aligns with container origin
              const offsetX = -bleedMargin * scaleX;
              const offsetY = -bleedMargin * scaleY;
              // SVG dimensions should cover the FULL canvas (including bleed)
              const svgWidth = canvasSize.width * scaleX;
              const svgHeight = canvasSize.height * scaleY;
              return (
                <div
                  style={{
                    width: previewBoxSize.width,
                    height: previewBoxSize.height,
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  <svg
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={svgDimensions.viewBox}
                    style={{
                      position: 'absolute',
                      left: offsetX,
                      top: offsetY,
                    }}
                  >
                    <defs>
                      {/* Trim clipPath - clips at trim line (inset by bleedMargin) */}
                      <clipPath id={trimClipId}>
                        <rect x={bleedMargin} y={bleedMargin} width={trimWidth} height={trimHeight} />
                      </clipPath>
                      {activePage.layout[0]?.background.image && (
                        <pattern
                          id={`left-bg-prev-${activePage.layout[0].id}`}
                          patternUnits="userSpaceOnUse"
                          x={0}
                          y={0}
                          width={canvasSize.width}
                          height={canvasSize.height}
                        >
                          <image
                            href={activePage.layout[0].background.image}
                            x={0}
                            y={0}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </pattern>
                      )}
                      {/* Pattern for the right side background image */}
                      {activePage.layout[1]?.background.image && (
                        <pattern
                          id={`right-bg-prev-${activePage.layout[1].id}`}
                          patternUnits="userSpaceOnUse"
                          x={0}
                          y={0}
                          width={canvasSize.width}
                          height={canvasSize.height}
                        >
                          <image
                            href={activePage.layout[1].background.image}
                            x={0}
                            y={0}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </pattern>
                      )}

                      <clipPath id="clipPath">
                        {safeAreas &&
                          safeAreas.length > 0 &&
                          safeAreas.map((safeArea, index) => (
                            <rect
                              key={safeArea.id}
                              x={safeArea.left}
                              y={safeArea.top}
                              width={safeArea.width}
                              height={safeArea.height}
                            />
                          ))}
                      </clipPath>
                    </defs>

                    {/* Apply trimClipId to entire content to cut bleed area */}
                    <g clipPath={`url(#${trimClipId})`}>
                      {/* Background rect - covers full canvas, clipping handles the trim */}
                      {activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                        <rect
                          id={`left-part-prev-${activePage.layout[0]?.id}`}
                          x={0}
                          y={0}
                          width={getCanvasWidth()}
                          height={canvasSize.height}
                          fill={
                            activePage.layout[0]?.background.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background.color || "#ffffff"
                          }
                        />
                      )}
                      {activeEditorType !== EDITOR_TYPES.PHOTOBOOK && (
                        <rect
                          id={`left-part-prev-${activePage.layout[0]?.id}`}
                          x={0}
                          y={0}
                          width={canvasSize.width}
                          height={canvasSize.height}
                          fill={
                            activePage.layout[0]?.background.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background.color || "#ffffff"
                          }
                        />
                      )}

                      {activeEditorType === EDITOR_TYPES.PHOTOBOOK && (
                        <rect
                          id="right-part-prev-"
                          x={canvasSize.width / 2}
                          y={0}
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          fill={
                            activePage.layout[1]?.background.image
                              ? `url(#right-bg-prev-${activePage.layout[1].id})`
                              : activePage.layout[1]?.background.color || "#ffffff"
                          }
                        />
                      )}

                      {/* normal objects - already inside trim clip from parent */}
                      <g className={`allObjects d-inline-block`}>
                        <g className="no-clipping">
                          {sortedObjects // Sort by zIndex in ascending order
                            .map((item, key) =>
                            (
                              //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                              <g
                                key={item.id}
                                className={`position-absolute layoutDiv targetE objTarget_${item.id
                                  } ${item.type === "img" && "inset-0 overflow-hidden"}`}
                              >
                                <g
                                  className="page-item"
                                  width={item.width}
                                  height={item.height}
                                  data-index={item.zIndex}
                                  data-id-t={item.id} // Unique identifier for your SVG group
                                  style={{
                                    transform: `translate(${item.transform.x}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                    transformOrigin: "center center",
                                    transformBox: "fill-box",
                                    overflow: "hidden",
                                    width: item.width,
                                    height: item.height,
                                  }}
                                >
                                  {/* {item.type === 'text' && <Text item={item} zoomRatio={zoomRatio} />}  */}
                                  {item.type === "text" && (
                                    <Text
                                      item={item}
                                      zoomRatio={zoomRatio}
                                      pageIndex={(() => {
                                        if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return monthPageIndex;
                                        const calendars = sortedObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
                                        const calendarCount = calendars.length || 1;
                                        if (calendarCount <= 1) return monthPageIndex;
                                        const subtypeObjs = sortedObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                        const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                        const mappedIdx = Math.min(idx, calendarCount - 1);
                                        // Sum calendar objects from all previous pages (skip cover)
                                        const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                        let prevCount = 0;
                                        for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                          (AllPages[p]?.layout || []).forEach(layout => {
                                            if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar" || o.type === "multiple-calendar").length;
                                          });
                                        }
                                        return prevCount + mappedIdx;
                                      })()}
                                    />
                                  )}
                                  {item.type === "img" && (
                                    <Photo
                                      item={item}
                                      zoomRatio={zoomRatio}
                                      size={"medium"}
                                      showPlaceholder={false}
                                    />
                                  )}
                                  {item.type === "sticker" && (
                                    <Sticker item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "qrcode" && (
                                    <QRCode item={item} zoomRatio={zoomRatio} />
                                  )}
                                  {item.type === "shape" && <Shape item={item} />}
                                  {item.type === "calendar" &&
                                    activeEditorType === EDITOR_TYPES.CALENDER && (
                                      <DynamicCalendar
                                        calIndex={sortedObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id) + 1}
                                        calendarCount={sortedObjects.filter(o => o.type === "calendar").length}
                                        pageIndex={monthPageIndex}
                                        item={item}
                                        zoomRatio={zoomRatio}
                                      />
                                    )}
                                  {item.type === "multiple-calendar" &&
                                    activeEditorType === EDITOR_TYPES.CALENDER && (
                                      <MultipleDynamicCalendar
                                        calIndex={sortedObjects.filter(o => o.type === "multiple-calendar").findIndex(o => o.id === item.id) + 1}
                                        currentMonth={(() => {
                                          const multiCalObjs = sortedObjects.filter(o => o.type === "multiple-calendar");
                                          const count = multiCalObjs.length || 1;
                                          const idx = multiCalObjs.findIndex(o => o.id === item.id);
                                          // Sum multi-calendar objects from all previous pages (skip cover)
                                          const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                          let prevCount = 0;
                                          for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                            (AllPages[p]?.layout || []).forEach(layout => {
                                              if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "multiple-calendar").length;
                                            });
                                          }
                                          return prevCount + Math.max(0, idx);
                                        })()}
                                        pageIndex={monthPageIndex}
                                        item={item}
                                        zoomRatio={zoomRatio}
                                      />
                                    )}
                                </g>
                              </g>
                            ))}
                        </g>
                      </g>
                      {/* safe area objects */}
                      <g className={`allObjects d-inline-block`}>
                        <g clipPath={`url(#clipPath)`}>
                          {allSafeAreaObjects &&
                            allSafeAreaObjects.length > 0 &&
                            allSafeAreaObjects // Sort by zIndex in ascending order
                              .map((item, key) => (
                                //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                                <g
                                  key={item?.id}
                                  className={`position-absolute layoutDiv1 targetE1 objTarget1_${item?.id
                                    } ${item.type === "img" && "inset-0 overflow-hidden"
                                    }`}
                                >
                                  <g
                                    className={`page-item `}
                                    width={item.width}
                                    height={item.height}
                                    data-index={item.zIndex}
                                    data-id-t={item?.id} // Unique identifier for your SVG group
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
                                        pageIndex={(() => {
                                          if (!item.subtype || (item.subtype !== "month" && item.subtype !== "year")) return monthPageIndex;
                                          const calendars = allSafeAreaObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
                                          const calendarCount = calendars.length || 1;
                                          if (calendarCount <= 1) return monthPageIndex;
                                          const subtypeObjs = allSafeAreaObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                                          const idx = subtypeObjs.findIndex(o => o.id === item.id);
                                          const mappedIdx = Math.min(idx, calendarCount - 1);
                                          // Sum calendar objects from all previous pages (skip cover)
                                          const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                          let prevCount = 0;
                                          for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                            (AllPages[p]?.layout || []).forEach(layout => {
                                              if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar" || o.type === "multiple-calendar").length;
                                            });
                                          }
                                          return prevCount + mappedIdx;
                                        })()}
                                      />
                                    )}
                                    {item.type === "img" && (
                                      <Photo
                                        item={item}
                                        zoomRatio={zoomRatio}
                                        size={"medium"}
                                        showPlaceholder={false}
                                      />
                                    )}
                                    {item.type === "sticker" && (
                                      <Sticker item={item} zoomRatio={zoomRatio} />
                                    )}
                                    {item.type === "qrcode" && (
                                      <QRCode item={item} zoomRatio={zoomRatio} />
                                    )}
                                    {/* {item.type === 'sticker' && <StickerTest item={item} zoomRatio={zoomRatio} />} */}
                                    {item.type === "shape" && (
                                      <Shape item={item} zoomRatio={zoomRatio} />
                                    )}
                                    {item.type === "calendar" &&
                                      activeEditorType === EDITOR_TYPES.CALENDER && (
                                        <DynamicCalendar
                                          calIndex={allSafeAreaObjects.filter(o => o.type === "calendar").findIndex(o => o.id === item.id) + 1}
                                          calendarCount={allSafeAreaObjects.filter(o => o.type === "calendar").length}
                                          pageIndex={monthPageIndex}
                                          item={item}
                                          zoomRatio={zoomRatio}
                                        />
                                      )}
                                    {item.type === "multiple-calendar" &&
                                      activeEditorType === EDITOR_TYPES.CALENDER && (
                                        <MultipleDynamicCalendar
                                          calIndex={allSafeAreaObjects.filter(o => o.type === "multiple-calendar").findIndex(o => o.id === item.id) + 1}
                                          currentMonth={(() => {
                                            const multiCalObjs = allSafeAreaObjects.filter(o => o.type === "multiple-calendar");
                                            const count = multiCalObjs.length || 1;
                                            const idx = multiCalObjs.findIndex(o => o.id === item.id);
                                            // Sum multi-calendar objects from all previous pages (skip cover)
                                            const coverOffset = calendarSettings?.addCover ? 1 : 0;
                                            let prevCount = 0;
                                            for (let p = coverOffset; p < currentActivePageNumber; p++) {
                                              (AllPages[p]?.layout || []).forEach(layout => {
                                                if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "multiple-calendar").length;
                                              });
                                            }
                                            return prevCount + Math.max(0, idx);
                                          })()}
                                          pageIndex={monthPageIndex}
                                          item={item}
                                          zoomRatio={zoomRatio}
                                        />
                                      )}
                                  </g>
                                </g>
                              ))}
                        </g>
                      </g>
                    </g>
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>
        {/* </PreviewItem> */}
      </div>
    </>
  );
};
