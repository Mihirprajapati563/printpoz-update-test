import React, { useRef } from "react";
import { PreviewItem } from "../../common-components/StyledComponents.jsx";
import { useSelector } from "react-redux";
import {
  getActiveEditorType,
  getCanvasSize,
  getCurrentPageIndex,
  getSettings,
  getCalendarSettings,
  getAllPages,
  getBillablePages,
} from "../../library/utils/helpers/index.js";
import { EDITOR_TYPES, USER_TYPES } from "../../library/utils/constants/index.js";
import Photo from "../../layout/preview/Photo.jsx";
import Sticker from "../../layout/preview/Sticker.jsx";
import QRCode from "../../layout/preview/QRCode.jsx";
import Text from "../../layout/preview/Text.jsx";
import DynamicCalendar from "../../layout/preview/DynamicCalendar.jsx";
import MultipleDynamicCalendar from "../../components/calendar/MultipleDynamicCalendar.jsx";
import Shape from "../../layout/preview/Shape.jsx";
import { getZoom } from "../../library/utils/helpers/index.js";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";
export const FoldingLayoutPreviewPages = ({
  activePage,
  sortedObjects,
  index,
  totalPages,
  allSafeAreaObjects,
  safeAreas,
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
  const zoomRatio = useSelector(getZoom);
  const svgRef = useRef(null);
  const settings = useSelector(getSettings);

  const isFoldable = settings?.isFoldable;
  const isHalfSheet = Boolean(activePage?.settings?.isHalfSheet);
  const isLayflat = activeEditorType === EDITOR_TYPES.LAYFLATALBUM;
  const isCoverPage = Boolean(activePage?.isCoverPage);
  const calendarSettings = useSelector(getCalendarSettings);
  const Pages = useSelector(getAllPages);
  const billablePages = useSelector(getBillablePages);
  const user = useSelector((state) => state.projectSetup.userDetails);
  const isAdminUser =
    user?.userTypeCode === USER_TYPES.SUPERUSER ||
    user?.userTypeCode === USER_TYPES.ADMIN ||
    user?.userTypeCode === USER_TYPES.EMPLOYEE;

  const isLayflatFullCoverPage = isLayflat && settings?.coverEnabled && settings?.showFullCoverSheet && isCoverPage;
  const layflatSpineWidth = isLayflatFullCoverPage
    ? Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0))
    : 0;
  // Objects on layout[1] (front cover) shift by full spine width — inner solid lines ARE the spine boundary
  const layflatSpineObjectOffset = layflatSpineWidth > 0
    ? layflatSpineWidth
    : 0;

  const monthPageIndex = calendarSettings?.addCover ? Math.max(0, index - 1) : index;

  const calculateSvgDimensions = () => {
    const singleSide = isFoldable && isHalfSheet;
    const spineExtra = isLayflatFullCoverPage ? layflatSpineWidth : 0;

    // Multiply by zoomRatio so SVG renders at correct CSS pixel size (not huge canvas-unit size)
    const width = (singleSide ? trimWidth / 2 : trimWidth + spineExtra) * zoomRatio;
    const height = trimHeight * zoomRatio;

    // ViewBox: offset by bleedMargin to crop bleed area from preview
    const canvasWidth = singleSide ? canvasSize.width / 2 : canvasSize.width + spineExtra;
    const canvasHeight = canvasSize.height;
    const viewBoxX = bleedMargin;
    const viewBoxY = bleedMargin;
    const viewBoxWidth = singleSide
      ? (canvasSize.width / 2) - bleedMargin
      : canvasSize.width + spineExtra - (bleedMargin * 2);
    const viewBoxHeight = canvasSize.height - (bleedMargin * 2);
    const viewBox = `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`;

    return { width, height, viewBox, canvasWidth, canvasHeight };
  };

  const svgDimensions = calculateSvgDimensions();

  const pageClassName = (() => {
    if (isFoldable && isHalfSheet && isLayflat) {
      if (index === 0) return "page front-cover hard";
      if (index === totalPages - 1) return "page back-cover hard";
      return "page";
    }
    if (isFoldable && isHalfSheet) {
      return "page";
    }
    if (index === 0) return "page front-cover hard";
    if (index === totalPages - 1) return "page back-cover hard";
    return "double";
  })();

  const shouldShowFoldableDivider =
    isFoldable &&
    !isHalfSheet &&
    activeEditorType !== EDITOR_TYPES.LAYFLATALBUM;

  const shouldShowLayflatDivider =
    isLayflat &&
    isFoldable &&
    !isHalfSheet &&
    (!settings?.coverEnabled ||
      (settings?.coverEnabled && !settings?.showFullCoverSheet) ||
      (settings?.coverEnabled && settings?.showFullCoverSheet && !isCoverPage));

  // For half-sheet (cover) pages, background should fill the full single-page width
  const isHalfSheetCover = isFoldable && isHalfSheet;
  const bgPatternWidth = isHalfSheetCover ? canvasSize.width / 2 : canvasSize.width;
  const bgPatternHeight = canvasSize.height;

  const renderBackgroundDefs = () => (
    <>
      {activePage.layout[0]?.background?.image && (
        <pattern
          id={`left-bg-prev-${activePage.layout[0].id}`}
          patternUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={bgPatternWidth}
          height={bgPatternHeight}
        >
          <image
            href={activePage.layout[0].background.image}
            x="0"
            y="0"
            width={bgPatternWidth}
            height={bgPatternHeight}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      )}
      {activePage.layout[1]?.background?.image && (
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
            x="0"
            y="0"
            width={canvasSize.width / 2}
            height={canvasSize.height}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      )}
      {activePage.layout[0]?.background?.gradient && (
        activePage.layout[0].background.gradient.type === "radial" ? (
          <radialGradient
            id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
            {...getRadialGradientCoords(
              activePage.layout[0].background.gradient.radialPosition
            )}
          >
            {activePage.layout[0].background.gradient.stops?.map((stop, idx) => (
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
            ))}
          </radialGradient>
        ) : (
          <linearGradient
            id={`gradient-bg-prev-left-${activePage.layout[0].id}`}
            {...getLinearGradientCoords(
              activePage.layout[0].background.gradient.angle || 90
            )}
          >
            {activePage.layout[0].background.gradient.stops?.map((stop, idx) => (
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
            ))}
          </linearGradient>
        )
      )}
      {activePage.layout[1]?.background?.gradient && (
        activePage.layout[1].background.gradient.type === "radial" ? (
          <radialGradient
            id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
            {...getRadialGradientCoords(
              activePage.layout[1].background.gradient.radialPosition
            )}
          >
            {activePage.layout[1].background.gradient.stops?.map((stop, idx) => (
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
            ))}
          </radialGradient>
        ) : (
          <linearGradient
            id={`gradient-bg-prev-right-${activePage.layout[1].id}`}
            {...getLinearGradientCoords(
              activePage.layout[1].background.gradient.angle || 90
            )}
          >
            {activePage.layout[1].background.gradient.stops?.map((stop, idx) => (
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
            ))}
          </linearGradient>
        )
      )}
    </>
  );

  return (
    <>
      <div className={pageClassName}>
        <PreviewItem
          className="border-0 m-0 p-0"
          data-key={index}
          border={"0px solid #ccc"}
          style={{ backgroundColor: index == 1 ? "#e6e6e6" : "#fff" }}
        >
          <div
            className={`WrapperDiv position-relative ${shouldShowFoldableDivider
              ? "WrapperDivLine"
              : shouldShowLayflatDivider
                ? "WrapperDivLineForLayflat"
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
                preserveAspectRatio="none"
              >
                <defs>
                  {renderBackgroundDefs()}
                  {/* Trim clipPath - clips at trim line (inset by bleedMargin); include spine width for layflat full cover */}
                  <clipPath id={`trimClip-${index}`}>
                    <rect x={0} y={0} width={isHalfSheetCover ? canvasSize.width / 2 : canvasSize.width + layflatSpineWidth} height={canvasSize.height} />
                  </clipPath>
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

                {/* Wrap all content in trim clipPath to crop bleed */}
                <g clipPath={`url(#trimClip-${index})`}>
                  {isHalfSheetCover ? (
                    // Cover pages (half-sheet): single background rect filling full width
                    <rect
                      x="0"
                      y="0"
                      width={svgDimensions.canvasWidth || svgDimensions.width}
                      height={svgDimensions.canvasHeight || svgDimensions.height}
                      fill={
                        activePage.layout[0]?.background?.gradient
                          ? `url(#gradient-bg-prev-left-${activePage.layout[0].id})`
                          : activePage.layout[0]?.background?.image
                            ? `url(#left-bg-prev-${activePage.layout[0].id})`
                            : activePage.layout[0]?.background?.color || "#ffffff"
                      }
                    />
                  ) : (
                    // Spread pages: two background rects (left and right)
                    <>
                      <rect
                        x="0"
                        y="0"
                        width={(svgDimensions.canvasWidth || svgDimensions.width) / 2}
                        height={svgDimensions.canvasHeight || svgDimensions.height}
                        fill={
                          activePage.layout[0]?.background?.gradient
                            ? `url(#gradient-bg-prev-left-${activePage.layout[0].id})`
                            : activePage.layout[0]?.background?.image
                              ? `url(#left-bg-prev-${activePage.layout[0].id})`
                              : activePage.layout[0]?.background?.color || "#ffffff"
                        }
                      />
                      <rect
                        x={canvasSize.width / 2 + layflatSpineWidth}
                        y="0"
                        width={canvasSize.width / 2}
                        height={svgDimensions.canvasHeight || svgDimensions.height}
                        fill={
                          activePage.layout[1]?.background?.gradient
                            ? `url(#gradient-bg-prev-right-${activePage.layout[1].id})`
                            : activePage.layout[1]?.background?.image
                              ? `url(#right-bg-prev-${activePage.layout[1].id})`
                              : activePage.layout[1]?.background?.color || "#ffffff"
                        }
                      />
                    </>
                  )}

                  {/* Layflat spine background — rendered BEHIND objects */}
                  {isLayflatFullCoverPage && layflatSpineWidth > 0 && (() => {
                    const spineX = canvasSize.width / 2;
                    const sw = layflatSpineWidth;
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
                      <g id="layflat-spine-bg-preview" className="photobook-spine-bg" pointerEvents="none">
                        <rect x={spineX} y="0" width={isSpreadBg ? sw : sw / 2} height={canvasSize.height}
                          fill={getBgFill(layout0, "left")} />
                        {!isSpreadBg && (
                          <rect x={spineX + sw / 2} y="0" width={sw / 2} height={canvasSize.height}
                            fill={getBgFill(layout1, "right")} />
                        )}
                      </g>
                    );
                  })()}

                  {/*normal Objects */}
                  <g className="allObjects d-inline-block">
                    {sortedObjects.map((item, keyIndex) => (
                      <g
                        key={`${item.id}_${keyIndex}`}
                        className={`position-absolute layoutDiv targetE objTarget_${item.id
                          } ${item.type === "img" && "inset-0 overflow-hidden"}`}
                        style={{
                          transform: `translate(${item.transform.x + (isLayflatFullCoverPage && item.layoutIndex === 1 ? layflatSpineObjectOffset : 0)}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
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
                            size={"large"}
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
                                  transform: `translate(${item.transform.x + (isLayflatFullCoverPage && item.layoutIndex === 1 ? layflatSpineObjectOffset : 0)}px, ${item.transform.y}px) rotate(${item.transform.rotation}deg)`,
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
                {isLayflatFullCoverPage && layflatSpineWidth > 0 && (() => {
                  const spineX = canvasSize.width / 2;
                  const sw = layflatSpineWidth;
                  const outerOffset = Math.max(2, sw * 0.15);
                  return (
                    <g id="layflat-spine-lines-preview" className="photobook-spine photobook-spine-area" pointerEvents="none">
                      {/* Inner solid lines — actual spine boundary (content boundary) */}
                      {[spineX, spineX + sw].map((lx, i) => (
                        <line key={`spine-inner-${i}`}
                          x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                          stroke="#555555" strokeWidth={1.5 / zoomRatio} strokeOpacity="0.9" />
                      ))}
                      {/* Outer dashed lines — safe area beyond spine edges */}
                      {[spineX - outerOffset, spineX + sw + outerOffset].map((lx, i) => (
                        <line key={`spine-outer-${i}`}
                          x1={lx} y1={0} x2={lx} y2={canvasSize.height}
                          stroke="#888888" strokeWidth={1 / zoomRatio} strokeOpacity="0.5"
                          strokeDasharray={`${4 / zoomRatio} ${6 / zoomRatio}`} />
                      ))}
                    </g>
                  );
                })()}

              </svg>
            </div>
            {/* <PageText>{getPageLabel(index)}</PageText> */}
          </div>
        </PreviewItem>
      </div >
    </>
  );
};
