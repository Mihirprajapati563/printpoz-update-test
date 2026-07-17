import React, { useState, useRef, useEffect } from "react";
import {
  PageText,
  PreviewItem,
} from "../../common-components/StyledComponents.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getCalendarSettings,
  getSettings,
} from "../../library/utils/helpers/index.js";
import { EDITOR_TYPES, USER_TYPES } from "../../library/utils/constants/index.js";
import {
  getPhotoBookPagelabel,
  getPageLabelForTwoSideProduct,
} from "../../library/utils/common-functions/index.js";
import Photo from "../../layout/preview/Photo.jsx";
import Sticker from "../../layout/preview/Sticker.jsx";
import QRCode from "../../layout/preview/QRCode.jsx";
import Text from "../../layout/preview/Text.jsx";
import DynamicCalendar from "../../layout/preview/DynamicCalendar.jsx";
import MultipleDynamicCalendar from "../../components/calendar/MultipleDynamicCalendar.jsx";
import Shape from "../../layout/preview/Shape.jsx";
import { getAllPages, getZoom, getBillablePages } from "../../library/utils/helpers/index.js";
import {
  getResolutionScaleValue,
  calculateZoomRatio,
} from "../../library/utils/common-functions/index.js";
import {
  setCurrentObjectProperties,
  setZoom,
} from "../../store/slices/canvas.js";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";
export const PhotoBookPreviewPages = ({
  activePage,
  sortedObjects,
  index,
  totalPages,
  allSafeAreaObjects,
  safeAreas,
  isPhotobookFullCover,
}) => {
  const canvasSizeRaw = useSelector(getCanvasSize);
  const canvasSize = {
    ...canvasSizeRaw,
    width: Number(canvasSizeRaw?.width) || 0,
    height: Number(canvasSizeRaw?.height) || 0,
    bleedMargin: Number(canvasSizeRaw?.bleedMargin) || 0,
  };
  const bleedMargin = canvasSize.bleedMargin;
  const trimWidth = canvasSize.width - bleedMargin * 2;
  const trimHeight = canvasSize.height - bleedMargin * 2;
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const activeEditorType = useSelector(getActiveEditorType);
  const Pages = useSelector(getAllPages);
  const zoomRatio = useSelector(getZoom);
  const [isSpecialPage, setIsSpecialPge] = useState(true);
  const svgRef = useRef(null);
  const dispatch = useDispatch();
  const calendarSettings = useSelector(getCalendarSettings);
  const settings = useSelector(getSettings);
  const billablePages = useSelector(getBillablePages);
  const user = useSelector((state) => state.projectSetup.userDetails);
  const isAdminUser =
    user?.userTypeCode === USER_TYPES.SUPERUSER ||
    user?.userTypeCode === USER_TYPES.ADMIN ||
    user?.userTypeCode === USER_TYPES.EMPLOYEE;

  const monthPageIndex = calendarSettings?.addCover ? Math.max(0, index - 1) : index;

  // Spine width computed live from paperThickness × billablePages — same formula as Canvas.jsx and Footer.jsx
  // Never use settings.spineWidth (stale stored value) — it can differ from the live calculation and cause width mismatch
  const coverSpineWidth = isPhotobookFullCover && index === 0
    ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
    : 0;
  const coverSpineObjectShift = coverSpineWidth;
  const svgPreserveAspectRatio = coverSpineWidth > 0 ? "none" : "xMidYMid meet";

  // Helper: compute SVG transform for background flip (backward-compat with boolean)
  const getFlipTransform = (flip, imgWidth, imgHeight) => {
    const flipX = typeof flip === "boolean" ? flip : (flip?.x || false);
    const flipY = typeof flip === "boolean" ? false : (flip?.y || false);
    if (!flipX && !flipY) return undefined;
    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;
    const tx = flipX ? -imgWidth : 0;
    const ty = flipY ? -imgHeight : 0;
    return `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
  };
  const getPageLabel = (index) => {
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      return getPhotoBookPagelabel(index, totalPages);
    } else if (activeEditorType === EDITOR_TYPES.VISITING_CARD) {
      return getPageLabelForTwoSideProduct(index);
    } else {
      return index + 1;
    }
  };

  const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;

  const calculateSvgDimensions = () => {
    // const zoomRatio = updateCanvasSize();
    // When full cover is enabled, page 0 is NOT a special single page - it's a full spread
    const isSpecialPage = (index === 0 && !isPhotobookFullCover) || index === totalPages - 1;
    // Second page (index 1) and second-last page (totalPages-2) are single-page views
    const isSecondPage = index === 1;
    const isSecondLastPage = index === totalPages - 2;
    const isSinglePage = isSpecialPage || isSecondPage || isSecondLastPage;

    // Single pages (covers and second pages): use half the width
    const width =
      isPhotobook && isSinglePage
        ? (trimWidth / 2) * zoomRatio
        : (trimWidth + coverSpineWidth) * zoomRatio;

    const height = trimHeight * zoomRatio;

    // ViewBox configuration:
    // - Offset by bleedMargin to crop the bleed area from the preview
    // - Single pages: left half trim area (bleedMargin to canvasWidth/2 - bleedMargin)
    //   No inner bleed at canvas center — bleed only at outer edges
    // - Spreads: full trim area (bleedMargin to canvasWidth - bleedMargin) + spine
    const viewBoxX = bleedMargin;
    const viewBoxY = bleedMargin;
    const viewBoxWidth =
      isPhotobook && isSinglePage
        ? (canvasSize.width / 2) - bleedMargin
        : canvasSize.width - (bleedMargin * 2) + coverSpineWidth;
    const viewBoxHeight = canvasSize.height - (bleedMargin * 2);
    const viewBox = [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight].join(" ");

    return { width, height, viewBox, isSecondPage, isSecondLastPage };
  };

  const svgDimensions = calculateSvgDimensions();

  return (
    <>
      {/* Blank inside page after cover */}
      {index === 1 && (
        <div
          className={` ${index === 0
            ? "page front-cover hard"
            : index === totalPages - 1
              ? "page back-cover hard"
              : index === 1
                ? "single-page"
                : "double"
            }`}
        >
          <PreviewItem
            className="border-0 m-0 p-0"
            data-key={index}
            border={"0px solid #ccc"}
            style={{ backgroundColor: index == 1 ? "#e6e6e6" : "#fff" }}
          >
            <div
              className={`WrapperDiv position-relative ${activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                index !== 0 &&
                index !== 1 &&
                index !== totalPages - 2 &&
                index !== totalPages - 1
                ? "WrapperDivLine"
                : ""
                }`}
              style={{
                backgroundColor: "#e6e6e6",
                marginLeft: "0%",
              }}
            >
              <div className="containerWrapperD">
                <svg
                  ref={svgRef}
                  viewBox={svgDimensions.viewBox}
                  width={svgDimensions.width}
                  height={svgDimensions.height}
                >
                  <defs>
                    <clipPath id={`trimClip-photobook-${index}`}>
                      <rect
                        x={bleedMargin}
                        y={bleedMargin}
                        width={(activeEditorType === EDITOR_TYPES.PHOTOBOOK && (index === 0 || index === 1 || index === totalPages - 2 || index === totalPages - 1)) ? (canvasSize.width / 2) - (bleedMargin * 2) : canvasSize.width - (bleedMargin * 2)}
                        height={canvasSize.height - (bleedMargin * 2)}
                      />
                    </clipPath>
                    {activePage.layout[0]?.background?.image && (
                      <pattern
                        id={`left-bg-prev-${activePage.layout[0].id}`}
                        patternUnits="objectBoundingBox"
                        width="1"
                        height="1"
                      >
                        <image
                          href={activePage.layout[0].background.image}
                          x="0"
                          y="0"
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          preserveAspectRatio="xMidYMid slice"
                          transform={getFlipTransform(activePage.layout[0]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                        />
                      </pattern>
                    )}
                    {activePage.layout[1]?.background?.image && (
                      <pattern
                        id={`right-bg-prev-${activePage.layout[1].id}`}
                        patternUnits="objectBoundingBox"
                        width="1"
                        height="1"
                      >
                        <image
                          href={activePage.layout[1].background.image}
                          x="0"
                          y="0"
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          preserveAspectRatio="xMidYMid slice"
                          transform={getFlipTransform(activePage.layout[1]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                        />
                      </pattern>
                    )}
                    {/* Gradient for left side background - supports linear and radial */}
                    {activePage.layout[0]?.background?.gradient && (
                      activePage.layout[0].background.gradient.type === "radial" ? (
                        <radialGradient
                          id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                          {...getRadialGradientCoords(activePage.layout[0].background.gradient.radialPosition)}
                        >
                          {activePage.layout[0].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </radialGradient>
                      ) : (
                        <linearGradient
                          id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                          {...getLinearGradientCoords(activePage.layout[0].background.gradient.angle || 90)}
                        >
                          {activePage.layout[0].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </linearGradient>
                      )
                    )}
                    {/* Gradient for right side background - supports linear and radial */}
                    {activePage.layout[1]?.background?.gradient && (
                      activePage.layout[1].background.gradient.type === "radial" ? (
                        <radialGradient
                          id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                          {...getRadialGradientCoords(activePage.layout[1].background.gradient.radialPosition)}
                        >
                          {activePage.layout[1].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </radialGradient>
                      ) : (
                        <linearGradient
                          id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                          {...getLinearGradientCoords(activePage.layout[1].background.gradient.angle || 90)}
                        >
                          {activePage.layout[1].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </linearGradient>
                      )
                    )}
                  </defs>
                  {/* Blank page background */}
                  <rect
                    x="0"
                    y="0"
                    width={canvasSize.width}
                    height={canvasSize.height}
                    fill="#e6e6e6"
                  />
                </svg>
              </div>
              {/* <PageText>{getPageLabel(index)}</PageText> */}
            </div>
          </PreviewItem>
        </div>
      )}
      <div
        className={` ${index === 0
          ? (isPhotobookFullCover ? "double" : "page front-cover hard")
          : index === totalPages - 1
            ? "page back-cover hard"
            : (index === totalPages - 2 || index === 1)
              ? "single-page"
              : "double"
          }`}
      >
        <PreviewItem
          className="border-0 m-0 p-0"
          data-key={index}
          border={"0px solid #ccc"}
          style={{ backgroundColor: index == 1 ? "#e6e6e6" : "#fff" }}
        >
          <div
            className={`WrapperDiv position-relative ${activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
              (index !== 0 || isPhotobookFullCover) &&
              index !== 1 &&
              index !== totalPages - 2 &&
              index !== totalPages - 1 &&
              !(isPhotobookFullCover && index === 0 && coverSpineWidth > 0)
              ? "WrapperDivLine"
              : ""
              }`}
            style={{
              backgroundColor: activePage.bgColor,
              marginLeft: index == 1 ? "0%" : "0%",
            }}
          >
            <div className="containerWrapperD">
              <svg
                ref={svgRef}
                viewBox={svgDimensions.viewBox}
                width={svgDimensions.width}
                height={svgDimensions.height}
                preserveAspectRatio={svgPreserveAspectRatio}
              >
                <defs>
                  <clipPath id={`trimClip-photobook-${index}-2`}>
                    <rect
                      x={bleedMargin}
                      y={bleedMargin}
                      width={((index === 0 && !isPhotobookFullCover) || index === 1 || index === totalPages - 2 || index === totalPages - 1) ? (canvasSize.width / 2) - (bleedMargin * 2) : canvasSize.width - (bleedMargin * 2) + coverSpineWidth}
                      height={canvasSize.height - (bleedMargin * 2)}
                    />
                  </clipPath>
                  {/* Background Patterns */}
                  {activePage.layout[0]?.background?.image && (
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
                        x="0"
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        preserveAspectRatio="xMidYMid slice"
                        transform={getFlipTransform(activePage.layout[0]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                      />
                    </pattern>
                  )}
                  {activePage.layout[1]?.background?.image && (
                    <pattern
                      id={`right-bg-prev-${activePage.layout[1].id}`}
                      patternUnits="userSpaceOnUse"
                      x={0}
                      y={0}
                      width={canvasSize.width + coverSpineWidth}
                      height={canvasSize.height}
                    >
                      <image
                        href={activePage.layout[1].background.image}
                        x={canvasSize.width / 2 + coverSpineWidth}
                        y="0"
                        width={canvasSize.width / 2}
                        height={canvasSize.height}
                        preserveAspectRatio="xMidYMid slice"
                        transform={getFlipTransform(activePage.layout[1]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                      />
                    </pattern>
                  )}
                  {/* Gradient for left side background - supports linear and radial */}
                  {activePage.layout[0]?.background?.gradient && (
                    activePage.layout[0].background.gradient.type === "radial" ? (
                      <radialGradient
                        id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                        {...getRadialGradientCoords(activePage.layout[0].background.gradient.radialPosition)}
                      >
                        {activePage.layout[0].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </radialGradient>
                    ) : (
                      <linearGradient
                        id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                        {...getLinearGradientCoords(activePage.layout[0].background.gradient.angle || 90)}
                      >
                        {activePage.layout[0].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </linearGradient>
                    )
                  )}
                  {/* Gradient for right side background - supports linear and radial */}
                  {activePage.layout[1]?.background?.gradient && (
                    activePage.layout[1].background.gradient.type === "radial" ? (
                      <radialGradient
                        id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                        {...getRadialGradientCoords(activePage.layout[1].background.gradient.radialPosition)}
                      >
                        {activePage.layout[1].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </radialGradient>
                    ) : (
                      <linearGradient
                        id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                        {...getLinearGradientCoords(activePage.layout[1].background.gradient.angle || 90)}
                      >
                        {activePage.layout[1].background.gradient.stops?.map(
                          (stop, idx) => (
                            <stop
                              key={idx}
                              offset={`${stop.position}%`}
                              stopColor={stop.color?.slice(0, 7) || "#000000"}
                              stopOpacity={
                                stop.color?.length === 9
                                  ? parseInt(stop.color.slice(7, 9), 16) / 255
                                  : 1
                              }
                            />
                          )
                        )}
                      </linearGradient>
                    )
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
                <g clipPath={`url(#trimClip-photobook-${index}-2)`}>
                  {/* Left Side */}
                  <rect
                    x="0"
                    y="0"
                    width={canvasSize.width / 2}
                    height={canvasSize.height}
                    fill={
                      activePage.layout[0]?.background?.gradient
                        ? `url(#gradient-bg-prev-left-${activePage.layout[0].id})`
                        : activePage.layout[0]?.background?.image
                          ? `url(#left-bg-prev-${activePage.layout[0].id})`
                          : activePage.layout[0]?.background?.color || "#ffffff"
                    }
                  />

                  {/* Spine background — rendered BEHIND objects for continuous background through the spine */}
                  {coverSpineWidth > 0 && (() => {
                    const spineX = canvasSize.width / 2;
                    const sw = coverSpineWidth;
                    const layout0 = activePage.layout[0];
                    const layout1 = activePage.layout[1];
                    const isSpreadBg = layout0?.background?.isSpread;
                    const getBgFill = (layout, side) => {
                      if (!layout) return "#ffffff";
                      if (layout.background?.gradient) return `url(#gradient-bg-prev-${side}-${layout.id})`;
                      if (layout.background?.image) return `url(#${side}-bg-prev-${layout.id})`;
                      return layout.background?.color || "#ffffff";
                    };
                    return (
                      <g className="photobook-spine-bg" pointerEvents="none">
                        <rect x={spineX} y="0" width={isSpreadBg ? sw : sw / 2} height={canvasSize.height}
                          fill={getBgFill(layout0, "left")} />
                        {!isSpreadBg && (
                          <rect x={spineX + sw / 2} y="0" width={sw / 2} height={canvasSize.height}
                            fill={getBgFill(layout1, "right")} />
                        )}
                      </g>
                    );
                  })()}

                  {/* Right Side */}
                  <rect
                    x={canvasSize.width / 2 + coverSpineWidth}
                    y="0"
                    width={canvasSize.width / 2}
                    height={canvasSize.height}
                    fill={
                      index == totalPages - 2
                        ? "#e6e6e6"
                        : activePage.layout[1]?.background?.gradient
                          ? `url(#gradient-bg-prev-right-${activePage.layout[1].id})`
                          : activePage.layout[1]?.background?.image
                            ? `url(#right-bg-prev-${activePage.layout[1].id})`
                            : activePage.layout[1]?.background?.color || "#ffffff"
                    }
                  />

                  {/*normal Objects */}
                  <g className="allObjects d-inline-block">
                    {sortedObjects.map((item, keyIndex) => (
                      <g
                        key={`${item.id}_${keyIndex}`}
                        className={`position-absolute layoutDiv targetE objTarget_${item.id
                          } ${item.type === "img" && "inset-0 overflow-hidden"}`}
                        style={{
                          transform: `translate(${item.transform.x + (
                            // Right side: shift by full spine width so objects start at inner right spine line
                            coverSpineObjectShift > 0 && item.layoutIndex === 1
                              ? coverSpineObjectShift
                              : 0
                            // Left side (layoutIndex === 0): no shift — objects end at spineX (inner left spine line)
                          )}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
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
                              const calendars = sortedObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
                              const calendarCount = calendars.length || 1;
                              if (calendarCount <= 1) return monthPageIndex;
                              const subtypeObjs = sortedObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                              const idx = subtypeObjs.findIndex(o => o.id === item.id);
                              const mappedIdx = Math.min(idx, calendarCount - 1);
                              // Sum calendar objects from all previous pages (skip cover)
                              const coverOffset = calendarSettings?.addCover ? 1 : 0;
                              let prevCount = 0;
                              for (let p = coverOffset; p < index; p++) {
                                (Pages[p]?.layout || []).forEach(layout => {
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
                            size="large"
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
                      </g>
                    ))}
                  </g>

                  {/* safe area objects */}
                  <g className={`allObjects d-inline-block`}>
                    <g clipPath={`url(#clipPath)`}>
                      {allSafeAreaObjects &&
                        allSafeAreaObjects.length > 0 &&
                        allSafeAreaObjects // Sort by zIndex in ascending order
                          .map((item, keyIndex) => (
                            //  avg item dont have z index,  its maintain via how it render in position, last added item come automatically to top
                            <g
                              key={`${item?.id}_${keyIndex}`}
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
                                  transform: `translate(${item.transform.x + (
                                    // Right side: shift by full spine width so objects start at inner right spine line
                                    coverSpineObjectShift > 0 && item.layoutIndex === 1
                                      ? coverSpineObjectShift
                                      : 0
                                    // Left side (layoutIndex === 0): no shift — objects end at spineX (inner left spine line)
                                  )}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
                                  transformOrigin: "center center", transformBox: "fill-box",
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
                                      for (let p = coverOffset; p < index; p++) {
                                        (Pages[p]?.layout || []).forEach(layout => {
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
                                    size={"large"}
                                    zoomRatio={zoomRatio}
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
                                        for (let p = coverOffset; p < index; p++) {
                                          (Pages[p]?.layout || []).forEach(layout => {
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

                {/* Spine guide lines — rendered ABOVE all objects, same as Canvas */}
                {coverSpineWidth > 0 && (() => {
                  const spineX = canvasSize.width / 2;
                  const sw = coverSpineWidth;
                  const outerOffset = Math.max(2, sw * 0.15);
                  return (
                    <g className="photobook-spine photobook-spine-area" pointerEvents="none">
                      {/* Inner solid lines — actual spine boundary (content boundary) */}
                      {[spineX, spineX + sw].map((lx, i) => (
                        <line key={`spine-prev-inner-${i}`}
                          x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                          stroke="#555555" strokeWidth="1.5" strokeOpacity="0.9" />
                      ))}
                      {/* Outer dashed lines — safe area beyond spine edges */}
                      {[spineX - outerOffset, spineX + sw + outerOffset].map((lx, i) => (
                        <line key={`spine-prev-outer-${i}`}
                          x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                          stroke="#888888" strokeWidth="1" strokeOpacity="0.5"
                          strokeDasharray="6 4" />
                      ))}
                    </g>
                  );
                })()}

              </svg>
            </div>
            {/* <PageText>{getPageLabel(index)}</PageText> */}
          </div>
        </PreviewItem>
      </div>
      {index === totalPages - 2 && (
        <div
          className={` ${index === 0
            ? "page front-cover hard"
            : index === totalPages - 1
              ? "page back-cover hard"
              : index === totalPages - 2
                ? "single-page"
                : "double"
            }`}
        >
          <PreviewItem
            className="border-0 m-0 p-0"
            data-key={index}
            border={"0px solid #ccc"}
            style={{ backgroundColor: index == 1 ? "#e6e6e6" : "#fff" }}
          >
            <div
              className={`WrapperDiv position-relative ${activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
                index !== 0 &&
                index !== 1 &&
                index !== totalPages - 2 &&
                index !== totalPages - 1
                ? "WrapperDivLine"
                : ""
                }`}
              style={{
                backgroundColor: "#e6e6e6",
                marginLeft: "0%",
              }}
            >
              <div className="containerWrapperD">
                <svg
                  ref={svgRef}
                  viewBox={svgDimensions.viewBox}
                  width={svgDimensions.width}
                  height={svgDimensions.height}
                >
                  <defs>
                    <clipPath id={`trimClip-photobook-${index}-3`}>
                      <rect
                        x={bleedMargin}
                        y={bleedMargin}
                        width={(index === 0 || index === 1 || index === totalPages - 2 || index === totalPages - 1) ? (canvasSize.width / 2) - (bleedMargin * 2) : canvasSize.width - (bleedMargin * 2)}
                        height={canvasSize.height - (bleedMargin * 2)}
                      />
                    </clipPath>
                    {activePage.layout[0]?.background?.image && (
                      <pattern
                        id={`left-bg-prev-${activePage.layout[0].id}`}
                        patternUnits="objectBoundingBox"
                        width="1"
                        height="1"
                      >
                        <image
                          href={activePage.layout[0].background.image}
                          x="0"
                          y="0"
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          preserveAspectRatio="xMidYMid slice"
                          transform={getFlipTransform(activePage.layout[0]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                        />
                      </pattern>
                    )}
                    {activePage.layout[1]?.background?.image && (
                      <pattern
                        id={`right-bg-prev-${activePage.layout[1].id}`}
                        patternUnits="objectBoundingBox"
                        width="1"
                        height="1"
                      >
                        <image
                          href={activePage.layout[1].background.image}
                          x="0"
                          y="0"
                          width={canvasSize.width / 2}
                          height={canvasSize.height}
                          preserveAspectRatio="xMidYMid slice"
                          transform={getFlipTransform(activePage.layout[1]?.background?.flip, canvasSize.width / 2, canvasSize.height)}
                        />
                      </pattern>
                    )}
                    {/* Gradient for left side background - supports linear and radial */}
                    {activePage.layout[0]?.background?.gradient && (
                      activePage.layout[0].background.gradient.type === "radial" ? (
                        <radialGradient
                          id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                          {...getRadialGradientCoords(activePage.layout[0].background.gradient.radialPosition)}
                        >
                          {activePage.layout[0].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </radialGradient>
                      ) : (
                        <linearGradient
                          id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
                          {...getLinearGradientCoords(activePage.layout[0].background.gradient.angle || 90)}
                        >
                          {activePage.layout[0].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </linearGradient>
                      )
                    )}
                    {/* Gradient for right side background - supports linear and radial */}
                    {activePage.layout[1]?.background?.gradient && (
                      activePage.layout[1].background.gradient.type === "radial" ? (
                        <radialGradient
                          id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                          {...getRadialGradientCoords(activePage.layout[1].background.gradient.radialPosition)}
                        >
                          {activePage.layout[1].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </radialGradient>
                      ) : (
                        <linearGradient
                          id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
                          {...getLinearGradientCoords(activePage.layout[1].background.gradient.angle || 90)}
                        >
                          {activePage.layout[1].background.gradient.stops?.map(
                            (stop, idx) => (
                              <stop
                                key={idx}
                                offset={`${stop.position}%`}
                                stopColor={stop.color?.slice(0, 7) || "#000000"}
                                stopOpacity={
                                  stop.color?.length === 9
                                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                                    : 1
                                }
                              />
                            )
                          )}
                        </linearGradient>
                      )
                    )}
                  </defs>
                  {/* Right-side blank page — should be plain white/gray, not content */}
                  <rect
                    x="0"
                    y="0"
                    width={canvasSize.width}
                    height={canvasSize.height}
                    fill="#e6e6e6"
                  />
                </svg>
              </div>
              {/* <PageText>{getPageLabel(index)}</PageText> */}
            </div>
          </PreviewItem>
        </div>
      )}
    </>
  );
};
