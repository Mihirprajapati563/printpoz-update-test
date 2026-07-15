import {
  ActionInnerTitle,
  ActionTitle,
  Box,
  DisplayBetween,
  ButtonComponent,
  DisplayCenter,
  FlexBox,
  BackgroundColorItem,
  ColorPickerTrigger,
  BackgroundImageItem,
  BackgroundItem,
  StyledTabs,
  SearchBox,
  SearchInput,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import {
  TempBackgroudColors,
  TempBackgroundImgs,
} from "../../library/utils/jsons/commonJSON";
import {
  setBackgroundColor,
  setGradientBackground,
  setFlipBackground,
  setBackgroundColorSpread,
  setGradientBackgroundSpread,
  setFlipBackgroundSpread,
  addBackgroundSolidColorToHistory,
  addToGlobalGradientHistory,
  addToGlobalSolidColorHistory,
} from "../../store/slices/canvas";
import { BackgroundSlider } from "./BackgroundsSlider";
import ColorPickerWithOpacity from "../../components/popups/ColorPickerWithOpacity";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getActivePageBgColor,
  getActivePageBgImage,
  getActivePageBackgroundFlip,
  getCurrentActivePageSide,
  getActivePageBgGradient,
  getIsSpreadPage,
} from "../../library/utils/helpers";
import {
  getBackgroundSolidColorHistory,
  getGlobalGradientHistory,
  getGlobalSolidColorHistory,
} from "../../library/utils/helpers/canvasSliceGetters";
import styled from "styled-components";

let lastScrollTopBackgrounds = 0;

export const BackgroundAction = () => {
  const dispatch = useDispatch();
  const activePageBgColor = useSelector(getActivePageBgColor);
  const activePageBgImage = useSelector(getActivePageBgImage);
  const activePageBackgroundFlip = useSelector(getActivePageBackgroundFlip);
  const activePageBgGradient = useSelector(getActivePageBgGradient);
  const backgroundSolidColorHistory = useSelector(
    getBackgroundSolidColorHistory,
  );
  const globalGradientHistory = useSelector(getGlobalGradientHistory);
  const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [bgApplyMode, setBgApplyMode] = useState("page");
  const activeSide = useSelector(getCurrentActivePageSide);
  const isSpreadPage = useSelector(getIsSpreadPage);
  const lastBgColorRef = useRef(null);
  const scrollBgRef = useRef(null);
  const needsScrollRestoreBg = useRef(lastScrollTopBackgrounds > 0);

  useEffect(() => {
    const el = scrollBgRef.current;
    if (!el) return;
    const handler = () => {
      lastScrollTopBackgrounds = el.scrollTop;
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  });

  const handleBgDataLoaded = useCallback(() => {
    if (!needsScrollRestoreBg.current || lastScrollTopBackgrounds === 0) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (scrollBgRef.current && lastScrollTopBackgrounds > 0) {
          scrollBgRef.current.scrollTop = lastScrollTopBackgrounds;
        }
        needsScrollRestoreBg.current = false;
      }, 100);
    });
  }, []);

  const handleFlipXChange = (event) => {
    const newFlipX = event.target.checked;
    setFlipX(newFlipX);
    const flipAction = bgApplyMode === "spread" ? setFlipBackgroundSpread : setFlipBackground;
    dispatch(flipAction({ x: newFlipX, y: flipY }));
  };

  const handleFlipYChange = (event) => {
    const newFlipY = event.target.checked;
    setFlipY(newFlipY);
    const flipAction = bgApplyMode === "spread" ? setFlipBackgroundSpread : setFlipBackground;
    dispatch(flipAction({ x: flipX, y: newFlipY }));
  };

  useEffect(() => {
    // Backward compat: old format was just a boolean (horizontal only)
    if (typeof activePageBackgroundFlip === "boolean") {
      setFlipX(activePageBackgroundFlip);
      setFlipY(false);
    } else {
      setFlipX(activePageBackgroundFlip?.x || false);
      setFlipY(activePageBackgroundFlip?.y || false);
    }
  }, [activeSide, activePageBackgroundFlip]);

  const handleColorClick = (color) => {
    lastBgColorRef.current = color;
    const colorAction = bgApplyMode === "spread" ? setBackgroundColorSpread : setBackgroundColor;
    dispatch(colorAction(color));
  };

  const lastBgGradientRef = useRef(null);

  const handleGradientChange = useCallback(
    (gradientData) => {
      lastBgGradientRef.current = gradientData;
      const gradientAction = bgApplyMode === "spread" ? setGradientBackgroundSpread : setGradientBackground;
      dispatch(
        gradientAction({
          type: gradientData.type || "linear",
          angle: gradientData.angle || 90,
          ...(gradientData.type === "radial" && {
            radialPosition: gradientData.radialPosition || { x: 50, y: 50 },
          }),
          stops: gradientData.stops,
        }),
      );
    },
    [dispatch, bgApplyMode],
  );

  const handleColorPickerClick = () => {
    setDisplayColorPicker(!displayColorPicker);
  };

  const handleColorPickerClose = useCallback(() => {
    setDisplayColorPicker(false);
    if (lastBgGradientRef.current) {
      dispatch(addToGlobalGradientHistory(lastBgGradientRef.current));
      lastBgGradientRef.current = null;
    } else if (lastBgColorRef.current) {
      dispatch(
        addBackgroundSolidColorToHistory({ color: lastBgColorRef.current }),
      );
      dispatch(addToGlobalSolidColorHistory({ color: lastBgColorRef.current }));
      lastBgColorRef.current = null;
    }
  }, [dispatch]);

  return (
    <>
      <div
        className="sticker-container sticker-container-mob"
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <DisplayBetween
          className="heading-action-mob"
          style={{ flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}
        >
          <ActionTitle>Background</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>
        {isSpreadPage && (
          <div style={{ flexShrink: 0, padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
            <div
              style={{
                display: "flex",
                background: "#f0f0f0",
                borderRadius: "6px",
                padding: "2px",
                gap: "2px",
              }}
            >
              {["page", "spread"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBgApplyMode(mode)}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                    background: bgApplyMode === mode ? "#fff" : "transparent",
                    boxShadow: bgApplyMode === mode ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                    color: bgApplyMode === mode ? "var(--primary, #333)" : "#888",
                    textTransform: "capitalize",
                    transition: "all 0.15s",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          ref={scrollBgRef}
          className="scroll-container-mob"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            paddingBottom: "20px",
          }}
        >
          <Box mt="15px">
            <ActionInnerTitle>Color</ActionInnerTitle>
            <FlexBox mt="15px" gap="6px">
              <ColorPickerTrigger onClick={handleColorPickerClick} />
              {displayColorPicker ?
                <div style={{ position: "absolute", zIndex: "4", top: "20px" }}>
                  <div
                    style={{
                      position: "fixed",
                      top: "0px",
                      right: "0px",
                      bottom: "0px",
                      left: "0px",
                      zIndex: "1",
                    }}
                    onClick={handleColorPickerClose}
                  />
                  <div style={{ position: "relative", zIndex: "2" }}>
                    <ColorPickerWithOpacity
                      color={activePageBgColor}
                      hasBackgroundImage={!!activePageBgImage}
                      initialGradient={activePageBgGradient}
                      onChange={(hexColor) => handleColorClick(hexColor)}
                      onGradientChange={handleGradientChange}
                      externalGradientHistory={globalGradientHistory}
                      externalSolidColorHistory={[
                        ...backgroundSolidColorHistory,
                        ...globalSolidColorHistory.filter(
                          (g) =>
                            !backgroundSolidColorHistory.some(
                              (b) => b.color === g.color,
                            ),
                        ),
                      ]}
                      onClose={handleColorPickerClose}
                    />
                  </div>
                </div>
              : null}
              {TempBackgroudColors.map((item, index) => (
                <BackgroundColorItem
                  onClick={() => handleColorClick(item.bgcolor)}
                  key={`bgcolor-${index}`}
                  bgcolor={item.bgcolor}
                />
              ))}
            </FlexBox>
          </Box>
          {/* <Box mt="15px">
                        <ButtonComponent padding="5px">
                            <DisplayCenter>
                                <Box ml="1px" pt="5px" pb="5px">
                                    Upload Background
                                </Box>
                            </DisplayCenter>
                        </ButtonComponent>
                    </Box> */}
          <Box mt="15px">
            <ActionInnerTitle>Flip Background</ActionInnerTitle>
            <FlexBox
              mt="15px"
              gap="10px"
              style={{ flexDirection: "row", flexWrap: "nowrap" }}
            >
              <label
                htmlFor="flipBackgroundX"
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  id="flipBackgroundX"
                  name="flipBackgroundX"
                  checked={flipX}
                  onChange={handleFlipXChange}
                />
                <span style={{ marginLeft: "5px", fontSize: "14px" }}>
                  Horizontal
                </span>
              </label>
              <label
                htmlFor="flipBackgroundY"
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  id="flipBackgroundY"
                  name="flipBackgroundY"
                  checked={flipY}
                  onChange={handleFlipYChange}
                />
                <span style={{ marginLeft: "5px", fontSize: "14px" }}>
                  Vertical
                </span>
              </label>
            </FlexBox>
          </Box>

          {/* <Box mt="15px">

                <FlexBox mt="15px" className="side-bar-scroll">
                    {TempBackgroundImgs.map((item, index) => (
                        <BackgroundImageItem key={`Layoyt-item-${index + 1}`} onClick={() => handleImageClick(item.src)} src={item.src} alt={`layout-${index + 1}`} />
                    ))}
                </FlexBox>
            </Box> */}
          <Box mt="15px">
            <BackgroundSlider onDataLoaded={handleBgDataLoaded} applyMode={bgApplyMode} />
          </Box>
        </div>
      </div>
    </>
  );
};
