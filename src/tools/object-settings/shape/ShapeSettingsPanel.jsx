import React, { useState } from "react";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { GrPowerReset } from "react-icons/gr";
import styled from "styled-components";
import {
  getActiveObjectprops,
  getSettings,
} from "../../../library/utils/helpers";
import { getShapeGradientHistory, getShapeSolidColorHistory, getGlobalGradientHistory, getGlobalSolidColorHistory, getBorderSolidColorHistory, getShadowSolidColorHistory } from "../../../library/utils/helpers/canvasSliceGetters";
import {
  sendForward,
  sendBackward,
  setCurrentObjectProperties,
  addShapeGradientToHistory,
  addShapeSolidColorToHistory,
  addToGlobalGradientHistory,
  addToGlobalSolidColorHistory,
  addBorderSolidColorToHistory,
  addShadowSolidColorToHistory,
} from "../../../store/slices/canvas";
import ColorPickerModal from "../../../common-components/ColorPickerModal";
import PositionSettingsPanel from "../position/PositionSettingsPanel";
import { IconSliderControl } from "../sticker/StickerSettingsPanel";

const Wrapper = styled.div`
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  height: 100%;
  overflow-y: auto;

  @media (max-width: 768px) {
    border-radius: 0;
    border: none;
    height: auto;
    max-height: none;
    overflow-y: visible;
    background: transparent;
  }
`;

const ActionButton = styled(Button)`
  background-color: #f8f9fa;
  border-color: #e9ecef;
  color: #495057;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: #e9ecef;
    border-color: #dee2e6;
    color: #495057;
    transform: translateY(-1px);
  }

  &:focus {
    box-shadow: 0 0 0 0.2rem rgba(25, 118, 210, 0.25);
  }

  &.active {
    background-color: var(--primary);
    border-color: var(--primary);
    color: white;

    &:hover {
      background-color: var(--primary);
      border-color: var(--primary);
      color: white;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    font-size: 11px;
    padding: 6px 8px;

    svg {
      width: 16px;
      height: 16px;
    }
  }
`;

const SliderContainer = styled.div`
  .form-range {
    height: 4px;

    &::-webkit-slider-thumb {
      width: 16px;
      -webkit-appearance: none;
      height: 16px;
      background: #fff;
      border: 2px solid var(--primary);
      border-radius: 50%;
      cursor: pointer;
    }

    &::-webkit-slider-runnable-track {
      height: 4px;
      background: #e9ecef;
      border-radius: 2px;
    }
  }

  .form-label {
    font-size: 12px;
    color: #495057;
    margin-bottom: 6px;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    padding: 4px;

    .form-label {
      font-size: 11px;
    }
  }
`;

const SettingSection = styled.div`
  margin-bottom: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;

  @media (max-width: 768px) {
    margin-bottom: 8px;
    border-radius: 6px;
  }
`;

const SectionHeader = styled.div`
  padding: 12px 16px;
  background: #f8f9fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  font-size: 14px;
  color: #495057;
  border-bottom: 1px solid #e9ecef;

  &:hover {
    background: #e9ecef;
  }

  svg {
    color: var(--primary);
  }

  @media (max-width: 768px) {
    padding: 10px 12px;
    font-size: 13px;
  }
`;

const SectionContent = styled.div`
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;

  &.expanded {
    max-height: 500px;
    padding: 16px;
  }
`;

function ShapeSettingsPanel() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const settings = useSelector(getSettings);
  const shapeGradientHistory = useSelector(getShapeGradientHistory);
  const shapeSolidColorHistory = useSelector(getShapeSolidColorHistory);
  const globalGradientHistory = useSelector(getGlobalGradientHistory);
  const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);
  const borderSolidColorHistory = useSelector(getBorderSolidColorHistory);
  const shadowSolidColorHistory = useSelector(getShadowSolidColorHistory);
  const [expandedSection, setExpandedSection] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(
    activeObjectProps?.border?.color || "#000000"
  );
  const [showShapeColorPicker, setShowShapeColorPicker] = useState(false);
  const [tempShapeColor, setTempShapeColor] = useState(
    activeObjectProps?.fill || "#000000"
  );
  const [showShadowColorPicker, setShowShadowColorPicker] = useState(false);
  const [tempShadowColor, setTempShadowColor] = useState(
    activeObjectProps?.shadow?.color || "#000000"
  );
  const [savedGradient, setSavedGradient] = useState(
    activeObjectProps?.gradient || null
  );
  const [initialSolidColor, setInitialSolidColor] = useState(
    activeObjectProps?.fill || "#000000"
  );
  const [solidColorChanged, setSolidColorChanged] = useState(false);

  const SendBackward = () => {
    dispatch(sendBackward());
  };

  const BringForward = () => {
    dispatch(sendForward());
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Border control functions
  const setBorderWidth = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          width: parseFloat(value),
        },
      })
    );
  };

  const setBorderColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          color: value,
        },
      })
    );
  };

  const setBorderRadius = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          radius: parseFloat(value),
        },
      })
    );
  };

  const resetBorderSettings = () => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          width: 0,
          color: "#000000",
          radius: 0,
        },
      })
    );
  };

  const handleColorPickerOpen = () => {
    setTempColor(activeObjectProps?.border?.color || "#000000");
    setShowColorPicker(true);
  };

  const handleColorPickerClose = () => {
    setShowColorPicker(false);
  };

  const handleColorChange = (colorResult) => {
    // Use RGBA color to preserve opacity
    const colorValue = colorResult.rgba || colorResult.hex;
    setTempColor(colorValue);
  };

  const handleColorConfirm = (result) => {
    // Apply color from the result (supports both live apply and button apply)
    const colorValue = result?.color || result?.rgba || tempColor;
    setBorderColor(colorValue);
    
    if (result && result.type === "solid") {
      dispatch(addBorderSolidColorToHistory(result));
      dispatch(addToGlobalSolidColorHistory({ color: result.color }));
    } else if (typeof result === "string") {
      dispatch(addBorderSolidColorToHistory({ color: result }));
      dispatch(addToGlobalSolidColorHistory({ color: result }));
    }
  };

  // Shape color control functions
  const setShapeColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        fill: value,
        gradient: null, // Clear gradient when setting solid color
      })
    );
  };

  // Set gradient on shape
  const setShapeGradient = (gradientData) => {
    // Extract only the necessary gradient properties (exclude css)
    const gradient = {
      type: gradientData.type,
      angle: gradientData.angle,
      stops: gradientData.stops,
      ...(gradientData.radialPosition && {
        radialPosition: gradientData.radialPosition,
      }),
    };

    dispatch(
      setCurrentObjectProperties({
        fill: null, // Clear solid fill when setting gradient
        gradient: gradient,
      })
    );
  };

  const handleShapeColorPickerOpen = () => {
    const savedGradient = activeObjectProps?.gradient;
    const savedFill = activeObjectProps?.fill;

    setTempShapeColor(savedFill);
    setSavedGradient(savedGradient);
    setInitialSolidColor(savedFill);
    setSolidColorChanged(false);
    setShowShapeColorPicker(true);
  };

  const handleShapeColorPickerClose = () => {
    setShowShapeColorPicker(false);
  };

  const handleShapeColorChange = (colorResult) => {
    // Real-time preview (optional) - only for solid colors
    if (colorResult.hexWithAlpha) {
      setTempShapeColor(colorResult.hexWithAlpha);
    } else if (colorResult.rgba) {
      setTempShapeColor(colorResult.rgba);
    } else if (colorResult.hex) {
      setTempShapeColor(colorResult.hex);
    }
  };

  const handleShapeColorConfirm = (result) => {
    // Handle the new format from ColorPickerModal
    if (result && result.type === "solid") {
      // Apply solid color
      setShapeColor(result.color);
      // Save solid color to history
      dispatch(addShapeSolidColorToHistory(result));
      dispatch(addToGlobalSolidColorHistory({ color: result.color }));
    } else if (result && (result.type === "linear" || result.type === "radial")) {
      // Apply gradient (type is "linear" or "radial", not "gradient")
      setShapeGradient(result);
      // Save gradient to history
      dispatch(addShapeGradientToHistory(result));
      dispatch(addToGlobalGradientHistory(result));
    } else if (typeof result === "string") {
      // Fallback for legacy string format
      setShapeColor(result);
    } else {
      // Fallback to temp color
      setShapeColor(tempShapeColor);
    }
  };

  // Shadow control functions
  const setShadowOffsetX = (value) => {
    if (!activeObjectProps.shadow) {
      resetShadowSettings();
      return;
    }
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
          offsetX: Math.round(value),
        },
      })
    );
  };

  const setShadowOffsetY = (value) => {
    if (!activeObjectProps.shadow) {
      resetShadowSettings();
      return;
    }
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
          offsetY: Math.round(value),
        },
      })
    );
  };

  const setShadowBlurRadius = (value) => {
    if (!activeObjectProps.shadow) {
      resetShadowSettings();
      return;
    }
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
          blurRadius: Math.round(value),
        },
      })
    );
  };

  const resetShadowSettings = () => {
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          offsetX: 0,
          offsetY: 0,
          blurRadius: 0,
          color: "#000000",
        },
      })
    );
  };

  const setShadowColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
          color: value,
        },
      })
    );
  };

  const handleShadowColorPickerOpen = () => {
    setTempShadowColor(activeObjectProps?.shadow?.color || "#000000");
    setShowShadowColorPicker(true);
  };

  const handleShadowColorPickerClose = () => {
    setShowShadowColorPicker(false);
  };

  const handleShadowColorChange = (colorResult) => {
    // Use RGBA color to preserve opacity
    const colorValue = colorResult.rgba || colorResult.hex;
    setTempShadowColor(colorValue);
  };

  const handleShadowColorConfirm = (result) => {
    // Apply color from the result (supports both live apply and button apply)
    const colorValue = result?.color || result?.rgba || tempShadowColor;
    setShadowColor(colorValue);
    
    if (result && result.type === "solid") {
      dispatch(addShadowSolidColorToHistory(result));
      dispatch(addToGlobalSolidColorHistory({ color: result.color }));
    } else if (typeof result === "string") {
      dispatch(addShadowSolidColorToHistory({ color: result }));
      dispatch(addToGlobalSolidColorHistory({ color: result }));
    }
  };

  // Opacity control function
  const setOpacityOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ opacity: parseFloat(value) }));
  };

  if (!activeObjectProps || activeObjectProps.type !== "shape") {
    return null;
  }

  return (
    <Wrapper className="border-0 px-1">
      <div className="">
        {/* Transform and Layer Controls */}
        <div className="mb-3">
          <div className="row g-2">
            {/* Backward/Forward Buttons - Top Row (Conditional) */}
            {/* {((activeObjectProps?.disableBackwardForward !== true &&
                            userType === USER_TYPES.CUSTOMER) ||
                            userType !== USER_TYPES.CUSTOMER) && (
                                <>
                                    <div className="col-3 col-md-6">
                                        <ActionButton onClick={SendBackward} className="w-100" title="Send Backward">
                                            <BiMinusBack style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    </div>
                                    <div className="col-3 col-md-6">
                                        <ActionButton onClick={BringForward} className="w-100" title="Bring Forward">
                                            <BiMinusFront style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    </div>
                                </>
                            )} */}

            {/* Lock/Unlock Button */}
            {/* {((activeObjectProps?.disabledForClient !== true &&
                            userType === USER_TYPES.CUSTOMER) ||
                            userType !== USER_TYPES.CUSTOMER) && (
                                <div className="col-3 col-md-4">
                                    {!activeObjectProps?.locked ? (
                                        <ActionButton
                                            onClick={() => dispatch(setCurrentObjectProperties({ locked: true }))}
                                            className="w-100"
                                            title="Lock Object"
                                        >
                                            <UnLockObjectIcon style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    ) : (
                                        <ActionButton
                                            onClick={() => dispatch(setCurrentObjectProperties({ locked: false }))}
                                            className="w-100"
                                            title="Unlock Object"
                                        >
                                            <LockObjectIcon style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    )}
                                </div>)} */}

            {/* Delete Button */}
            {/* {((activeObjectProps &&
                            activeObjectProps?.disabledForClient !== true &&
                            userType === USER_TYPES.CUSTOMER) ||
                            userType !== USER_TYPES.CUSTOMER) && (
                                <div className="col-3 col-md-4">
                                    <ActionButton onClick={removeElement} className="w-100" title="Remove Shape">
                                        <BiTrash style={{ height: "20px", width: "20px" }} />
                                    </ActionButton>
                                </div>
                            )} */}
          </div>
        </div>
        
        {/* Position Section */}
        <PositionSettingsPanel />

        {/* Shape Color Section */}
        <div className="mb-3 d-flex align-items-center justify-content-between bg-white p-3 shadow-sm border rounded mb-2">
          <small className="fw-semibold">Shape Color</small>
          <div
            style={{
              position: "relative",
              width: "50px",
              height: "30px",
              backgroundColor: "#f8f9fa",
              border: "2px solid #e9ecef",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            onClick={handleShapeColorPickerOpen}
            title="Click to choose shape color"
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
            }}
          >
            {/* Color Preview Circle */}
            <div
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: activeObjectProps?.fill || "#000000",
                borderRadius: "50%",
                border: "2px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                position: "relative",
                zIndex: 1,
              }}
            />
            {/* Background Pattern for Transparency */}
            <div
              style={{
                position: "absolute",
                top: "4px",
                left: "4px",
                right: "4px",
                bottom: "4px",
                backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                                             linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                borderRadius: "4px",
                zIndex: 0,
              }}
            />
          </div>
        </div>

        {/* Border Section */}
        <SettingSection>
          {/* <SectionHeader onClick={() => toggleSection('border')}>
                        <div className="d-flex align-items-center">
                            <TbBoxAlignLeftFilled className="me-2" />
                            <span>Border</span>
                        </div>
                        {expandedSection === 'border' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                    </SectionHeader> */}
          <SectionContent className="expanded">
            <SliderContainer>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold">Border </span>
                <ActionButton
                  onClick={resetBorderSettings}
                  style={{ padding: "4px 8px" }}
                >
                  <GrPowerReset />
                </ActionButton>
              </div>

              <IconSliderControl
                label="Width"
                value={activeObjectProps?.border?.width || 0}
                min={0}
                max={10}
                step={0.1}
                jump={0.1}
                onChange={(val) => setBorderWidth(val)}
                unit="px"
              />
              {activeObjectProps.shape === "rect" && (
                <>
                  <IconSliderControl
                    label="Radius"
                    value={activeObjectProps?.border?.radius || 0}
                    min={0}
                    max={20}
                    step={0.1}
                    jump={1}
                    onChange={(val) => setBorderRadius(val)}
                    unit="px"
                  />
                </>
              )}

              <div className="mt-3 d-flex align-items-center justify-content-between">
                <small className="text-muted">Border Color</small>
                <div
                  style={{
                    position: "relative",
                    width: "50px",
                    height: "30px",
                    backgroundColor: "#f8f9fa",
                    border: "2px solid #e9ecef",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                  onClick={handleColorPickerOpen}
                  title="Click to choose border color"
                  onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                  }}
                >
                  {/* Color Preview Circle */}
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      backgroundColor:
                        activeObjectProps?.border?.color || "#000000",
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      position: "relative",
                      zIndex: 1,
                    }}
                  />
                  {/* Background Pattern for Transparency */}
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      left: "4px",
                      right: "4px",
                      bottom: "4px",
                      backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                                             linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                      borderRadius: "4px",
                      zIndex: 0,
                    }}
                  />
                </div>
              </div>
            </SliderContainer>
          </SectionContent>
        </SettingSection>

        {/* Opacity Section */}
        <SettingSection>
          {/* <SectionHeader onClick={() => toggleSection('opacity')}>
                        <div className="d-flex align-items-center">
                            <TbOpacity className="me-2" />
                            <span>Opacity</span>

                        </div>

                        <span className="text-muted small">
                            {Math.round((activeObjectProps?.opacity || 1) * 100)}%
                        </span>
                    </SectionHeader> */}
          <SectionContent className="expanded">
            <SliderContainer>
              <IconSliderControl
                label="Opacity"
                value={Math.round((activeObjectProps?.opacity || 1) * 100)}
                min={0}
                max={100}
                step={1}
                jump={5}
                onChange={(val) => setOpacityOfElement(val / 100)}
                unit="%"
              />
            </SliderContainer>
          </SectionContent>
        </SettingSection>

        {/* Shadow Section */}
        <SettingSection>
          {/* <SectionHeader onClick={() => toggleSection('shadow')}>
                        <div className="d-flex align-items-center">
                            <RiShadowLine className="me-2" />
                            <span>Shadow</span>
                        </div>
                        {expandedSection === 'shadow' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                    </SectionHeader> */}
          <SectionContent className="expanded">
            <SliderContainer>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted fw-semibold">Shadow</span>
                <ActionButton
                  onClick={resetShadowSettings}
                  style={{ padding: "4px 8px" }}
                >
                  <GrPowerReset />
                </ActionButton>
              </div>

              {/* Horizontal Offset (X) */}
              <IconSliderControl
                label="Horizontal Offset"
                value={activeObjectProps?.shadow?.offsetX || 0}
                min={-(activeObjectProps?.width / 2) || -50}
                max={activeObjectProps?.width / 2 || 50}
                step={1}
                jump={5}
                onChange={(val) => setShadowOffsetX(val)}
                unit="px"
              />

              {/* Vertical Offset (Y) */}
              <IconSliderControl
                label="Vertical Offset"
                value={activeObjectProps?.shadow?.offsetY || 0}
                min={-(activeObjectProps?.height / 2) || -50}
                max={activeObjectProps?.height / 2 || 50}
                step={1}
                jump={5}
                onChange={(val) => setShadowOffsetY(val)}
                unit="px"
              />

              {/* Blur Radius (Spread) */}
              <IconSliderControl
                label="Spread"
                value={activeObjectProps?.shadow?.blurRadius || 0}
                min={0}
                max={
                  Math.max(
                    activeObjectProps?.width,
                    activeObjectProps?.height
                  ) / 5 || 50
                }
                step={1}
                jump={5}
                onChange={(val) => setShadowBlurRadius(val)}
                unit="px"
              />

              {/* Shadow Color */}
              <div className="mt-3 d-flex align-items-center justify-content-between">
                <small className="text-muted">Shadow Color</small>
                <div
                  style={{
                    position: "relative",
                    width: "50px",
                    height: "30px",
                    backgroundColor: "#f8f9fa",
                    border: "2px solid #e9ecef",
                    borderRadius: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                  onClick={handleShadowColorPickerOpen}
                  title="Click to choose shadow color"
                  onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                  }}
                >
                  {/* Color Preview Circle */}
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      backgroundColor:
                        activeObjectProps?.shadow?.color || "#000000",
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      position: "relative",
                      zIndex: 1,
                    }}
                  />
                  {/* Background Pattern for Transparency */}
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      left: "4px",
                      right: "4px",
                      bottom: "4px",
                      backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                                             linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                                             linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                      borderRadius: "4px",
                      zIndex: 0,
                    }}
                  />
                </div>
              </div>
            </SliderContainer>
          </SectionContent>
        </SettingSection>
      </div>

      {/* Border Color Picker Modal */}
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={handleColorPickerClose}
        color={tempColor}
        onChange={handleColorChange}
        onConfirm={handleColorConfirm}
        title="Choose Border Color"
        externalSolidColorHistory={[...borderSolidColorHistory, ...globalSolidColorHistory.filter(g => !borderSolidColorHistory.some(b => b.color === g.color))]}
        liveApply
      />

      {/* Shape Color Picker Modal */}
      <ColorPickerModal
        isOpen={showShapeColorPicker}
        onClose={handleShapeColorPickerClose}
        color={tempShapeColor}
        gradient={savedGradient}
        initialTab={savedGradient ? "gradient" : "solid"}
        onChange={handleShapeColorChange}
        onConfirm={handleShapeColorConfirm}
        title="Choose Shape Color"
        showGradientTab={true}
        initialSolidColor={initialSolidColor}
        onSolidColorChanged={setSolidColorChanged}
        externalGradientHistory={[...shapeGradientHistory, ...globalGradientHistory.filter(g => !shapeGradientHistory.some(s => s.css === g.css))]}
        externalSolidColorHistory={[...shapeSolidColorHistory, ...globalSolidColorHistory.filter(g => !shapeSolidColorHistory.some(s => s.color === g.color))]}
        liveApply
      />

      {/* Shadow Color Picker Modal */}
      <ColorPickerModal
        isOpen={showShadowColorPicker}
        onClose={handleShadowColorPickerClose}
        color={tempShadowColor}
        onChange={handleShadowColorChange}
        onConfirm={handleShadowColorConfirm}
        title="Choose Shadow Color"
        externalSolidColorHistory={[...shadowSolidColorHistory, ...globalSolidColorHistory.filter(g => !shadowSolidColorHistory.some(s => s.color === g.color))]}
        liveApply
      />
    </Wrapper>
  );
}

// ─── SetBorderInlineShape ────────────────────────────────────────────
// Shared border panel for Shape dialog — mirrors ShapeSettingsPanel border section exactly
export function SetBorderInlineShape({ activeObjectProps }) {
  const dispatch = useDispatch();
  const borderSolidColorHistory = useSelector(getBorderSolidColorHistory);
  const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(activeObjectProps?.border?.color || "#000000");

  const setBorderWidth = (value) => {
    dispatch(setCurrentObjectProperties({ border: { ...activeObjectProps.border, width: parseFloat(value) } }));
  };

  const setBorderRadius = (value) => {
    dispatch(setCurrentObjectProperties({ border: { ...activeObjectProps.border, radius: parseFloat(value) } }));
  };

  const setBorderColor = (value) => {
    dispatch(setCurrentObjectProperties({ border: { ...activeObjectProps.border, color: value } }));
  };

  const handleColorPickerOpen = () => {
    setTempColor(activeObjectProps?.border?.color || "#000000");
    setShowColorPicker(true);
  };

  const handleColorPickerClose = () => setShowColorPicker(false);

  const handleColorChange = (colorResult) => {
    const colorValue = colorResult.rgba || colorResult.hex;
    setTempColor(colorValue);
  };

  const handleColorConfirm = (result) => {
    const colorValue = result?.color || result?.rgba || tempColor;
    setBorderColor(colorValue);
    if (result && result.type === "solid") {
      dispatch(addBorderSolidColorToHistory(result));
      dispatch(addToGlobalSolidColorHistory({ color: result.color }));
    } else if (typeof result === "string") {
      dispatch(addBorderSolidColorToHistory({ color: result }));
      dispatch(addToGlobalSolidColorHistory({ color: result }));
    }
    setShowColorPicker(false);
  };

  return (
    <>
      <SliderContainer>
        <IconSliderControl
          label="Width"
          value={activeObjectProps?.border?.width || 0}
          min={0}
          max={10}
          step={0.1}
          jump={0.1}
          onChange={setBorderWidth}
          unit="px"
        />
        {activeObjectProps?.shape === "rect" && (
          <IconSliderControl
            label="Radius"
            value={activeObjectProps?.border?.radius || 0}
            min={0}
            max={20}
            step={0.1}
            jump={1}
            onChange={setBorderRadius}
            unit="px"
          />
        )}
        <div className="mt-3 d-flex align-items-center justify-content-between">
          <small className="text-muted">Border Color</small>
          <div
            style={{
              position: "relative",
              width: "50px",
              height: "30px",
              backgroundColor: "#f8f9fa",
              border: "2px solid #e9ecef",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            onClick={handleColorPickerOpen}
            title="Click to choose border color"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: activeObjectProps?.border?.color || "#000000",
                borderRadius: "50%",
                border: "2px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        </div>
      </SliderContainer>
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={handleColorPickerClose}
        color={tempColor}
        onChange={handleColorChange}
        onConfirm={handleColorConfirm}
        title="Choose Border Color"
        externalSolidColorHistory={[
          ...borderSolidColorHistory,
          ...globalSolidColorHistory.filter(
            (g) => !borderSolidColorHistory.some((b) => b.color === g.color)
          ),
        ]}
        liveApply
      />
    </>
  );
}

export default ShapeSettingsPanel;
