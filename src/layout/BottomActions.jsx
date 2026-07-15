import { ReactComponent as ZoomIn } from "../assets/icons/zoom-in.svg";
import { ReactComponent as ZoomOut } from "../assets/icons/zoom-out.svg";
import { ReactComponent as Single } from "../assets/icons/apps_one.svg";
import { ReactComponent as Four } from "../assets/icons/apps_four.svg";
import { HiArrowNarrowLeft } from "react-icons/hi";
import { HiArrowNarrowRight } from "react-icons/hi";
import { FaAngleUp } from "react-icons/fa";
import { FaAngleDown } from "react-icons/fa";
import { Col, Row } from "react-bootstrap";
import {
  BodyText,
  Box,
  DisplayBetween,
  DisplayStart,
  IconButton,
  IconButtonBox,
  PaginationButton,
  ZoomButtonBox,
} from "../common-components/StyledComponents.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  getCurrentPageIndex,
  getCanvasScale,
  getAllPagesLength,
  getActiveEditorType,
  getSettings,
  getAllPagesSettings,
} from "../library/utils/helpers";
import {
  setCanvasScale,
  setPageNumber,
  setCurrentObjectProperties,
  deSelectSafeArea,
} from "../store/slices/canvas";
import { useEffect, useState } from "react";
import {
  getPhotoBookPagelabel,
  getPageLabelForTwoSideProduct,
  getPageLabelForFoldableProduct,
  getPageLabelForLayflatWithCover
} from "../library/utils/common-functions/index.js";
import { EDITOR_SUB_TYPES, EDITOR_TYPES } from "../library/utils/constants/index.js";
import { setIsDisplayPreview } from "../store/slices/appAlice";
import { ShuffleLayoutControls } from "./Footer.jsx";

export const BottmActions = () => {
  const dispatch = useDispatch();

  const activeEditorType = useSelector(getActiveEditorType);
  const canvasScale = useSelector(getCanvasScale);
  const currentActivePageNumber = useSelector(getCurrentPageIndex);
  const allPagesLength = useSelector(getAllPagesLength);
  const settings = useSelector(getSettings)
  const allPagesSettings = useSelector(getAllPagesSettings)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1210);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isPreviewActive = useSelector(
    (state) => state.appSlice.isDisplayPreview
  );
  const [displayPageNav, setDisplayPageNav] = useState(false);
  const [displayPreviewOption, setDisplayPreviewOption] = useState(false);
  useEffect(() => {
    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
      activeEditorType === EDITOR_TYPES.PRINT ||
      activeEditorType === EDITOR_TYPES.VISITING_CARD ||
      activeEditorType === EDITOR_TYPES.CALENDER ||
      activeEditorType === EDITOR_TYPES.GREETING_CARD ||
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM
    ) {
      setDisplayPageNav(true);
      setDisplayPreviewOption(true);
    } else {
      setDisplayPageNav(false);
      setDisplayPreviewOption(false);
      dispatch(setIsDisplayPreview(false));
    }
  }, [activeEditorType]);

  const scalePercentage = () => {
    // canvasScale =1 means 100% scale,  max scale is 2 and min scale is 0.5
    // lets calculate the percentage of scale
    const percentage = canvasScale * 100;
    return parseInt(percentage);
  };
  const displayPreview = () => {
    // if true then set false and if false then set true
    if (isPreviewActive) {
      dispatch(setIsDisplayPreview(false));
    } else {
      dispatch(setIsDisplayPreview(true));
    }
  };

  const setScaleIn = () => {
    // allow max scale 1.5
    if (canvasScale >= 2) return;
    dispatch(setCanvasScale(canvasScale + 0.1));
  };
  const setScaleOut = () => {
    // allow min scale 0.3
    if (canvasScale <= 0.3) return;
    dispatch(setCanvasScale(canvasScale - 0.1));
  };

  const handlePreviousPage = () => {
    if (currentActivePageNumber > 0) {
      dispatch(setCurrentObjectProperties(null));
      dispatch(deSelectSafeArea());
      dispatch(setPageNumber(currentActivePageNumber - 1));
    }
  };
  const handleNextPage = () => {
    // hideLastCover hides the trailing back cover from navigation. Applies to
    // photobook always, and to layflat when a separate back cover exists
    // (coverEnabled && !showFullCoverSheet).
    const hidesLastCover =
      settings?.hideLastCover &&
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
        (activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
          settings?.coverEnabled &&
          !settings?.showFullCoverSheet));
    const lastNavigable = hidesLastCover ? allPagesLength - 2 : allPagesLength - 1;
    if (currentActivePageNumber < lastNavigable) {
      dispatch(setCurrentObjectProperties(null));
      dispatch(deSelectSafeArea());
      dispatch(setPageNumber(currentActivePageNumber + 1));
    }
  };
  const getPageLabel = (index) => {
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      if (index === 0 && settings?.showFullCoverSheet) return "Full Cover";
      return getPhotoBookPagelabel(index, allPagesLength);
    }
    else if (settings?.isFoldable && !settings?.coverEnabled)
      return getPageLabelForFoldableProduct(index, allPagesSettings);
    else if (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled === true)
      return getPageLabelForLayflatWithCover(index, allPagesLength, settings?.showFullCoverSheet);
    else if (activeEditorType === EDITOR_TYPES.VISITING_CARD || (activeEditorType === EDITOR_TYPES.GREETING_CARD && settings?.subtype === EDITOR_SUB_TYPES.GREETING_CARD.DOUBLE_SIDE))
      return `${getPageLabelForTwoSideProduct(index)}`;
    else return index + 1;
  };
  return (
    <>
      {/* Mobile only: shuffle controls centered above pagination */}
      {displayPageNav && isMobile && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", paddingTop: "6px" }}>
          <ShuffleLayoutControls />
        </div>
      )}

      {/* Pagination + zoom row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          position: "relative",
          paddingLeft: "20px",
          paddingRight: "20px",
          marginTop: "10px",
          minHeight: "40px",
        }}
      >
        {/* Left: preview toggle */}
        <div style={{ display: "flex", alignItems: "center", zIndex: 1, justifySelf: "start" }}>
          {displayPreviewOption && (
            <Box className="icon-18">
              <IconButtonBox>
                <IconButton onClick={displayPreview}>
                  {isPreviewActive ? <FaAngleDown /> : <FaAngleUp />}
                </IconButton>
              </IconButtonBox>
            </Box>
          )}
        </div>

        {/* Center: page navigation — horizontally centered in grid */}
        {displayPageNav && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifySelf: "center",
            }}
          >
            <PaginationButton className="pagination-btn-mob" onClick={handlePreviousPage}>
              <HiArrowNarrowLeft size={21} />
            </PaginationButton>
            <PaginationButton className="page-number-p-mob" padding="5px 20px">
              <BodyText fontsize="20" fontweight="700" className="body-text-pagination">
                {getPageLabel(currentActivePageNumber)}
              </BodyText>
            </PaginationButton>
            <PaginationButton className="pagination-btn-mob" onClick={handleNextPage}>
              <HiArrowNarrowRight size={21} />
            </PaginationButton>
          </div>
        )}

        {/* Right: desktop → shuffle + zoom; mobile → zoom only */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "end", zIndex: 1 }}>
          {displayPageNav && !isMobile && <ShuffleLayoutControls />}
          <Box className="icon-18">
            <ZoomButtonBox>
              <ZoomIn onClick={() => setScaleIn()} className="cursor-pointer" />
              <BodyText className="ms-3 me-4 zoom-value-mob">
                {scalePercentage()}%
              </BodyText>
              <ZoomOut onClick={() => setScaleOut()} className="cursor-pointer" />
            </ZoomButtonBox>
          </Box>
        </div>
      </div>
    </>
  );
};
