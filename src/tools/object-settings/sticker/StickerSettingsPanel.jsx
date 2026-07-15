import React, { useState } from "react";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
    BiHorizontalCenter,
    BiVerticalCenter,
    BiMinusBack,
    BiMinusFront,
    BiTrash
} from "react-icons/bi";
import {
    PiPaintBrushFill,
    PiArrowBendUpLeftFill
} from "react-icons/pi";
import {
    RiShadowLine
} from "react-icons/ri";
import {
    AiOutlineBorder
} from "react-icons/ai";
import {
    TbBoxAlignLeftFilled,
    TbBackground
} from "react-icons/tb";
import {
    FaWandMagicSparkles
} from "react-icons/fa6";
import {
    HiOutlineAdjustmentsHorizontal
} from "react-icons/hi2";
import { GrPowerReset } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { ReactComponent as LockObjectIcon } from "../../../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../../../assets/icons/unlock121.svg";
import styled from "styled-components";
import {
    getActiveObjectprops
} from "../../../library/utils/helpers";
import {
    removeObjectInPage,
    sendForward,
    sendBackward,
    setCurrentObjectProperties,
    addBorderSolidColorToHistory,
    addShadowSolidColorToHistory,
    addToGlobalSolidColorHistory,
} from "../../../store/slices/canvas";
import { USER_TYPES } from "../../../library/utils/constants";
import { EffectsList, ShadowList } from "../../../library/utils/jsons/commonJSON";
import ColorPickerModal from "../../../common-components/ColorPickerModal";
import { LuMinus, LuPlus } from "react-icons/lu";
import PositionSettingsPanel from "../position/PositionSettingsPanel";
import { getBorderSolidColorHistory, getShadowSolidColorHistory, getGlobalSolidColorHistory } from "../../../library/utils/helpers/canvasSliceGetters";

const Wrapper = styled.div`
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

// Mobile Panel Tabs Container
const MobilePanelTabs = styled.div`
  display: none !important;
  @media (max-width: 768px) {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 8px;
    padding: 10px 8px;
    width: 100%;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
    
    /* Inner content wrapper to allow horizontal scroll */
    & > * {
      flex-shrink: 0;
    }
  }
`;

// Individual Panel Tab Button
const PanelTab = styled.button`
  flex-shrink: 0;
  flex: 0 0 auto;
  padding: 8px 16px;
  border: 1px solid ${props => props.$active ? 'var(--primary)' : '#dee2e6'};
  border-radius: 20px;
  background: ${props => props.$active ? 'var(--primary)' : '#fff'};
  color: ${props => props.$active ? '#fff' : '#495057'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  
  &:hover {
    border-color: var(--primary);
  }
`;

// Mobile Panel Content (Bottom Sheet Style)
const MobilePanelContent = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: ${props => props.$show ? 'block' : 'none'};
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    z-index: 1100;
    max-height: 70vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    animation: slideUp 0.3s ease;
    
    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
  }
`;

// Panel Header
const MobilePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
  
  h6 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  
  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f0f0f0;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: #e0e0e0;
    }
  }
`;

// Panel Body
const MobilePanelBody = styled.div`
  padding: 16px;
  min-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

// Overlay for closing panel
const MobileOverlay = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: ${props => props.$show ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.3);
    z-index: 1099;
  }
`;

// Desktop Wrapper (hide on mobile)
const DesktopWrapper = styled.div`
  display: block;
  
  @media (max-width: 768px) {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
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

const SliderContainer = styled.div`
  .form-range {
    height: 4px;

    &::-webkit-slider-thumb {
      width: 16px;
      -webkit-appearance: none;
      height: 16px;
      background: #fff;
      border: 2px solid #1976d2;
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

const EffectsWrapper = styled.div`
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
  font-size: 11px;
  border: 1px solid #e9ecef;
  margin: 2px;

  &:hover {
    border-color: #1976d2;
  }

  &.selected {
    background: #e3f2fd;
    border-color: #1976d2;
    color: #1976d2;
  }
`;

const ColorPreview = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 4px;
  border: 2px solid #e9ecef;
  cursor: pointer;
  background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><rect x="0" y="0" width="8" height="8" fill="%23000"/><rect x="8" y="8" width="8" height="8" fill="%23000"/></svg>');
  background-size: 16px 16px;

  &:hover {
    border-color: #1976d2;
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

  &:hover {
    background-color: #e9ecef;
    border-color: #dee2e6;
    color: #495057;
  }

  &:focus {
    box-shadow: 0 0 0 0.2rem rgba(25, 118, 210, 0.25);
  }

  &.active {
    background-color: #e3f2fd;
    border-color: #1976d2;
    color: #1976d2;
  }

  &.btn-success {
    background: #28a745;
    border-color: #28a745;
    color: white;

    &:hover {
      background: #218838;
      border-color: #1e7e34;
      color: white;
    }
  }

  &.btn-danger {
    background: #dc3545;
    border-color: #dc3545;
    color: white;

    &:hover {
      background: #c82333;
      border-color: #bd2130;
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

function StickerSettingsPanel() {
    const dispatch = useDispatch();
    const activeObjectProps = useSelector(getActiveObjectprops);
    const borderSolidColorHistory = useSelector(getBorderSolidColorHistory);
    const shadowSolidColorHistory = useSelector(getShadowSolidColorHistory);
    const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);
    const [expandedSection, setExpandedSection] = useState(null);
    const [mobileActivePanel, setMobileActivePanel] = useState(null);
    const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
    const [showShadowColorPicker, setShowShadowColorPicker] = useState(false);
    const [tempBorderColor, setTempBorderColor] = useState('#000000');
    const [tempShadowColor, setTempShadowColor] = useState('#000000');

    // Get user type for conditional rendering
    const users = localStorage.getItem("userDetails");
    const userType = JSON.parse(users)?.userTypeCode || -1;

    // Panel definitions for mobile tabs
    const panels = [
        { id: 'position', label: 'Position' },
        { id: 'border', label: 'Border' },
        { id: 'shadow', label: 'Shadow' },
        { id: 'opacity', label: 'Opacity' },
        { id: 'adjustments', label: 'Adjustments' },
        { id: 'effects', label: 'Effects' },
    ];

    // Close mobile panel
    const closeMobilePanel = () => {
        setMobileActivePanel(null);
    };

    // Section toggle function
    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Flip functions - exact logic from StickerSettingsPopover
    const setFlipX = () => {
        dispatch(
            setCurrentObjectProperties({
                flip: {
                    ...activeObjectProps.flip,
                    x: !activeObjectProps.flip.x,
                },
            })
        );
    };

    const setFlipY = () => {
        dispatch(
            setCurrentObjectProperties({
                flip: {
                    ...activeObjectProps.flip,
                    y: !activeObjectProps.flip.y,
                },
            })
        );
    };

    // Layer management functions
    const SendBackward = () => {
        dispatch(sendBackward());
    };

    const BrignForward = () => {
        dispatch(sendForward());
    };

    // Remove function - exact logic from StickerSettingsPopover
    const removeElement = () => {
        dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
        dispatch(setCurrentObjectProperties(null));
    };

    // Opacity function - exact logic from StickerSettingsPopover
    const setOpacityOfElement = (value) => {
        dispatch(setCurrentObjectProperties({ opacity: parseFloat(value) }));
    };

    // Adjustment functions - exact logic from StickerSettingsPopover
    const setBrightnessOfElement = (value) => {
        dispatch(setCurrentObjectProperties({ brightness: parseFloat(value) }));
    };

    const setcontrastOfElement = (value) => {
        dispatch(setCurrentObjectProperties({ contrast: parseFloat(value) }));
    };

    const setsaturationOfElement = (value) => {
        dispatch(setCurrentObjectProperties({ saturation: parseFloat(value) }));
    };

    // Effect function - exact logic from StickerSettingsPopover
    const setEffect = (value) => {
        dispatch(setCurrentObjectProperties({ effect: value }));
    };

    // Border functions - exact logic from StickerSettingsPopover
    const setBorderWidth = (value) => {
        if (!activeObjectProps.border) {
            resetBorderSettings();
            return;
        }
        dispatch(
            setCurrentObjectProperties({
                border: {
                    ...activeObjectProps.border,
                    width: parseFloat(value),
                },
            })
        );
    };

    const setBorderRadius = (value) => {
        if (!activeObjectProps.border) {
            resetBorderSettings();
            return;
        }
        dispatch(
            setCurrentObjectProperties({
                border: {
                    ...activeObjectProps.border,
                    radius: parseFloat(value),
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

    const resetBorderSettings = () => {
        dispatch(
            setCurrentObjectProperties({
                border: {
                    ...activeObjectProps.border,
                    width: 0,
                    color: "#000000",
                    style: "solid",
                    radius: 0,
                },
            })
        );
    };

    // Shadow functions - exact logic from StickerSettingsPopover
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

    const resetShadowSettings = () => {
        dispatch(
            setCurrentObjectProperties({
                shadow: {
                    ...activeObjectProps.shadow,
                    offsetX: 0,
                    offsetY: 0,
                    blurRadius: 0,
                    color: "#000000",
                },
            })
        );
    };

    // Border color picker handlers
    const handleBorderColorPickerOpen = () => {
        setTempBorderColor(activeObjectProps?.border?.color || '#000000');
        setShowBorderColorPicker(true);
    };

    const handleBorderColorPickerClose = () => {
        setShowBorderColorPicker(false);
    };

    const handleBorderColorChange = (colorResult) => {
        // Use RGBA color to preserve opacity
        const colorValue = colorResult.rgba || colorResult.hex;
        setTempBorderColor(colorValue);
    };

    const handleBorderColorConfirm = (result) => {
        // Use the temp color which now includes opacity
        const colorValue = result?.rgba || result?.hex || result?.color || tempBorderColor;
        setBorderColor(colorValue);
        setShowBorderColorPicker(false);
        
        if (result && result.type === "solid") {
            dispatch(addBorderSolidColorToHistory(result));
            dispatch(addToGlobalSolidColorHistory({ color: result.color }));
        } else if (typeof result === "string") {
            dispatch(addBorderSolidColorToHistory({ color: result }));
            dispatch(addToGlobalSolidColorHistory({ color: result }));
        }
    };

    // Shadow color picker handlers
    const handleShadowColorPickerOpen = () => {
        setTempShadowColor(activeObjectProps?.shadow?.color || '#000000');
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
        // Use the temp color which now includes opacity
        const colorValue = result?.rgba || result?.hex || result?.color || tempShadowColor;
        setShadowColor(colorValue);
        setShowShadowColorPicker(false);
        
        if (result && result.type === "solid") {
            dispatch(addShadowSolidColorToHistory(result));
            dispatch(addToGlobalSolidColorHistory({ color: result.color }));
        } else if (typeof result === "string") {
            dispatch(addShadowSolidColorToHistory({ color: result }));
            dispatch(addToGlobalSolidColorHistory({ color: result }));
        }
    };

    const resetAdjustmentsSettings = () => {
        dispatch(
            setCurrentObjectProperties({
                brightness: 0,
                contrast: 0,
                saturation: 0,
            })
        );
    };

    if (!activeObjectProps || activeObjectProps.type !== "sticker") {
        return null;
    }

    // Render panel content based on active panel
    const renderPanelContent = (panelId) => {
        switch (panelId) {
            case 'position':
                return <PositionSettingsPanel />;
            case 'border':
                return (
                    <>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="fw-semibold d-none d-md-inline">Border Settings</span>
                            <ActionButton className="reset-button" onClick={resetBorderSettings} size="sm">
                                <GrPowerReset />
                            </ActionButton>
                        </div>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Width"
                                value={activeObjectProps?.border?.width || 0}
                                min={0}
                                max={200}
                                step={1}
                                jump={5}
                                onChange={setBorderWidth}
                                unit="px"
                            />
                        </SliderContainer>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Radius"
                                value={activeObjectProps?.border?.radius || 0}
                                min={0}
                                max={200}
                                step={1}
                                jump={5}
                                onChange={setBorderRadius}
                                unit="px"
                            />
                        </SliderContainer>
                        <div className="d-flex align-items-center justify-content-between">
                            <span className="small">Border Color</span>
                            <ColorPreview
                                style={{ backgroundColor: activeObjectProps?.border?.color || '#000000' }}
                                onClick={handleBorderColorPickerOpen}
                            />
                        </div>
                    </>
                );
            case 'shadow':
                return (
                    <>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="fw-semibold d-none d-md-inline">Shadow Settings</span>
                            <ActionButton className="reset-button" onClick={resetShadowSettings} size="sm">
                                <GrPowerReset />
                            </ActionButton>
                        </div>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Blur Shadow"
                                value={activeObjectProps?.shadow?.blurRadius || 0}
                                min={0}
                                max={50}
                                step={1}
                                jump={5}
                                onChange={setShadowBlurRadius}
                                unit="px"
                            />
                        </SliderContainer>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Offset X"
                                value={activeObjectProps?.shadow?.offsetX || 0}
                                min={-2500}
                                max={2500}
                                step={1}
                                jump={50}
                                onChange={setShadowOffsetX}
                                unit="px"
                            />
                        </SliderContainer>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Offset Y"
                                value={activeObjectProps?.shadow?.offsetY || 0}
                                min={-2500}
                                max={2500}
                                step={1}
                                jump={50}
                                onChange={setShadowOffsetY}
                                unit="px"
                            />
                        </SliderContainer>
                        <div className="d-flex align-items-center justify-content-between">
                            <span className="small">Shadow Color</span>
                            <ColorPreview
                                style={{ backgroundColor: activeObjectProps?.shadow?.color || '#000000' }}
                                onClick={handleShadowColorPickerOpen}
                            />
                        </div>
                    </>
                );
            case 'opacity':
                return (
                    <>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="fw-semibold d-none d-md-inline">Opacity</span>
                            <span>{Math.round((activeObjectProps?.opacity || 1) * 100)}%</span>
                        </div>
                        <SliderContainer>
                            <IconSliderControl
                                label=""
                                value={Math.round((activeObjectProps?.opacity || 1) * 100)}
                                min={0}
                                max={100}
                                step={1}
                                jump={5}
                                onChange={(val) => setOpacityOfElement(val / 100)}
                                unit="%"
                                hideLabel={true}
                            />
                        </SliderContainer>
                    </>
                );
            case 'adjustments':
                return (
                    <>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <span className="fw-semibold d-none d-md-inline">Adjustments</span>
                            <ActionButton className="reset-button" onClick={resetAdjustmentsSettings} size="sm">
                                <GrPowerReset />
                            </ActionButton>
                        </div>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Brightness"
                                value={activeObjectProps?.brightness || 0}
                                min={-100}
                                max={100}
                                step={1}
                                jump={5}
                                onChange={setBrightnessOfElement}
                            />
                        </SliderContainer>
                        <SliderContainer className="mb-3">
                            <IconSliderControl
                                label="Contrast"
                                value={activeObjectProps?.contrast || 0}
                                min={-100}
                                max={100}
                                step={1}
                                jump={5}
                                onChange={setcontrastOfElement}
                            />
                        </SliderContainer>
                        <SliderContainer>
                            <IconSliderControl
                                label="Saturation"
                                value={activeObjectProps?.saturation || 0}
                                min={-100}
                                max={100}
                                step={1}
                                jump={5}
                                onChange={setsaturationOfElement}
                            />
                        </SliderContainer>
                    </>
                );
            case 'effects':
                return (
                    <>
                        <div className="d-flex align-items-center mb-2">
                            <span className="fw-semibold d-none d-md-inline">Effects</span>
                        </div>
                        <div className="row g-2">
                            {EffectsList.map((effect, index) => (
                                <div key={index} className="col-4">
                                    <EffectsWrapper
                                        className={`text-center d-flex align-items-center justify-content-center flex-column g-3 ${activeObjectProps?.effect === effect.value ? 'selected' : ''}`}
                                        onClick={() => setEffect(effect.value)}
                                    >
                                        <img
                                            style={{
                                                filter: `${effect.value}(${effect.effect})`,
                                                width: '100%',
                                                height: '40px',
                                                objectFit: 'cover',
                                                borderRadius: '4px',
                                                marginBottom: '4px'
                                            }}
                                            src="https://cdn.icon-icons.com/icons2/3361/PNG/512/multimedia_communication_image_placeholder_photography_landscape_image_comics_picture_photo_gallery_image_icon_210828.png"
                                            alt={effect.label}
                                        />
                                        <div className="m-0 text-center" style={{ fontSize: '10px', fontWeight: '500' }}>
                                            {effect.label}
                                        </div>
                                    </EffectsWrapper>
                                </div>
                            ))}
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {/* ===== MOBILE VIEW: Inline Tabs + Content ===== */}
            <div className="d-md-none w-100" style={{ overflow: 'visible' }}>
                <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                    <MobilePanelTabs className="mobile-panel-tabs" style={{ minWidth: 'max-content' }}>
                        {panels.map((panel) => (
                            <PanelTab
                                key={panel.id}
                                $active={mobileActivePanel === panel.id}
                                onClick={() => setMobileActivePanel(panel.id)}
                            >
                                {panel.label}
                            </PanelTab>
                        ))}
                    </MobilePanelTabs>
                </div>
            </div>

            {/* Mobile Panel Overlay */}
            <MobileOverlay $show={!!mobileActivePanel} onClick={closeMobilePanel} />

            {/* Mobile Panel Content (Bottom Sheet) */}
            <MobilePanelContent $show={!!mobileActivePanel} className="mobile-panel-content">
                <MobilePanelHeader>
                    <h6>{panels.find(p => p.id === mobileActivePanel)?.label || ''}</h6>
                    <div className="close-btn" onClick={closeMobilePanel}>
                        <IoClose size={18} />
                    </div>
                </MobilePanelHeader>
                <MobilePanelBody>
                    {mobileActivePanel && renderPanelContent(mobileActivePanel)}
                </MobilePanelBody>
            </MobilePanelContent>

            {/* ===== DESKTOP VIEW: Original Layout ===== */}
            <DesktopWrapper className="desktop-only-content">
                <Wrapper className="p-1">
                    {/* Position Section */}
                    <PositionSettingsPanel />

                    {/* Action Buttons */}
                    <div className="mb-3">
                        <div className="row g-2">
                            {/* Backward/Forward Buttons - Top Row (Conditional) */}
                            {/* {(!activeObjectProps?.disablebackword && userType !== USER_TYPES.CUSTOMER) && (
                                <>
                                    <div className="col-6 col-md-6">
                                        <ActionButton onClick={SendBackward} className="w-100" title="Send Backward">
                                            <BiMinusBack style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    </div>
                                    <div className="col-6 col-md-6">
                                        <ActionButton onClick={BrignForward} className="w-100" title="Bring Forward">
                                            <BiMinusFront style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    </div>
                                </>
                            )} */}

                            {/* Flip Controls */}
                            {/* <div className="col-3 col-md-4">
                                <ActionButton
                                    onClick={setFlipX}
                                    className={`w-100 ${activeObjectProps.flip?.x ? 'active' : ''}`}
                                    title="Flip Sticker"
                                >
                                    <BiHorizontalCenter style={{ height: "24px", width: "24px" }} />
                                </ActionButton>
                            </div> */}
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
                                                className="w-100 active"
                                                title="Unlock Object"
                                            >
                                                <LockObjectIcon style={{ height: "20px", width: "20px" }} />
                                            </ActionButton>
                                        )}
                                    </div>
                                )} */}

                            {/* Delete Button */}
                            {/* {((activeObjectProps &&
                                activeObjectProps?.disabledForClient !== true &&
                                userType === USER_TYPES.CUSTOMER) ||
                                userType !== USER_TYPES.CUSTOMER) && (
                                    <div className="col-3 col-md-4">
                                        <ActionButton onClick={removeElement} className="w-100" title="Remove Sticker">
                                            <BiTrash style={{ height: "20px", width: "20px" }} />
                                        </ActionButton>
                                    </div>
                                )} */}

                        </div>
                    </div>

                    {/* Border Section */}
                    <SettingSection>
                        {/* <SectionHeader onClick={() => toggleSection('border')}>
                            <div className="d-flex align-items-center">
                                <AiOutlineBorder className="me-2" />
                                <span>Border</span>
                            </div>
                            {expandedSection === 'border' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                        </SectionHeader> */}
                        {/* <SectionContent className={expandedSection === 'border' ? 'expanded' : ''}> */}
                        <SectionContent className="expanded">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <span className="fw-semibold d-none d-md-inline">Border</span>
                                <ActionButton className="reset-button" onClick={resetBorderSettings} size="sm">
                                    <GrPowerReset className="" />
                                </ActionButton>
                            </div>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Width"
                                    value={activeObjectProps?.border?.width || 0}
                                    min={0}
                                    max={200}
                                    step={1}
                                    jump={5}
                                    onChange={setBorderWidth}
                                    unit="px"
                                />
                            </SliderContainer>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Radius"
                                    value={activeObjectProps?.border?.radius || 0}
                                    min={0}
                                    max={200}
                                    step={1}
                                    jump={5}
                                    onChange={setBorderRadius}
                                    unit="px"
                                />
                            </SliderContainer>
                            <div className="d-flex align-items-center justify-content-between">
                                <span className="small">Border Color</span>
                                <ColorPreview
                                    style={{ backgroundColor: activeObjectProps?.border?.color || '#000000' }}
                                    onClick={handleBorderColorPickerOpen}
                                />
                            </div>
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
                        {/* <SectionContent className={expandedSection === 'shadow' ? 'expanded' : ''}> */}
                        <SectionContent className="expanded">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <span className="fw-semibold d-none d-md-inline">Shadow</span>
                                <ActionButton className="reset-button" onClick={resetShadowSettings} size="sm">
                                    <GrPowerReset className="" />
                                </ActionButton>
                            </div>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Blur Shadow"
                                    value={activeObjectProps?.shadow?.blurRadius || 0}
                                    min={0}
                                    max={50}
                                    step={1}
                                    jump={5}
                                    onChange={setShadowBlurRadius}
                                    unit="px"
                                />
                            </SliderContainer>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Offset X"
                                    value={activeObjectProps?.shadow?.offsetX || 0}
                                    min={-2500}
                                    max={2500}
                                    step={1}
                                    jump={50}
                                    onChange={setShadowOffsetX}
                                    unit="px"
                                />
                            </SliderContainer>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Offset Y"
                                    value={activeObjectProps?.shadow?.offsetY || 0}
                                    min={-2500}
                                    max={2500}
                                    step={1}
                                    jump={50}
                                    onChange={setShadowOffsetY}
                                    unit="px"
                                />
                            </SliderContainer>
                            <div className="d-flex align-items-center justify-content-between">
                                <span className="small">Shadow Color</span>
                                <ColorPreview
                                    style={{ backgroundColor: activeObjectProps?.shadow?.color || '#000000' }}
                                    onClick={handleShadowColorPickerOpen}
                                />
                            </div>
                        </SectionContent>
                    </SettingSection>

                    {/* Opacity Section */}
                    <SettingSection>
                        {/* <SectionHeader onClick={() => toggleSection('opacity')}>
                            <div className="d-flex align-items-center">
                                <TbBoxAlignLeftFilled className="me-2" />
                                <span>Opacity</span>
                            </div>
                            <span className="text-muted small">
                                {Math.round((activeObjectProps?.opacity || 1) * 100)}%
                            </span>
                        </SectionHeader> */}
                        {/* <SectionContent className={expandedSection === 'opacity' ? 'expanded' : ''}> */}
                        <SectionContent className="expanded">
                            <div className="d-flex align-items-center justify-content-between">
                                <span className="fw-semibold d-none d-md-inline">Opacity</span>
                                <span>{Math.round((activeObjectProps?.opacity || 1) * 100)}%</span>
                            </div>
                            <SliderContainer>
                                <IconSliderControl
                                    label=""
                                    value={Math.round((activeObjectProps?.opacity || 1) * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    jump={5}
                                    onChange={(val) => setOpacityOfElement(val / 100)}
                                    unit="%"
                                    hideLabel={true}
                                />
                            </SliderContainer>
                        </SectionContent>
                    </SettingSection>

                    {/* Adjustments Section */}
                    <SettingSection>
                        {/* <SectionHeader onClick={() => toggleSection('adjustments')}>
                            <div className="d-flex align-items-center">
                                <HiOutlineAdjustmentsHorizontal className="me-2" />
                                <span>Adjustments</span>
                            </div>
                            {expandedSection === 'adjustments' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                        </SectionHeader> */}
                        {/* <SectionContent className={expandedSection === 'adjustments' ? 'expanded' : ''}> */}
                        <SectionContent className="expanded">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <span className="fw-semibold d-none d-md-inline">Adjustments</span>
                                <ActionButton className="reset-button" onClick={resetAdjustmentsSettings} size="sm">
                                    <GrPowerReset className="me-" />
                                </ActionButton>
                            </div>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Brightness"
                                    value={activeObjectProps?.brightness || 0}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    jump={5}
                                    onChange={setBrightnessOfElement}
                                />
                            </SliderContainer>
                            <SliderContainer className="mb-3">
                                <IconSliderControl
                                    label="Contrast"
                                    value={activeObjectProps?.contrast || 0}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    jump={5}
                                    onChange={setcontrastOfElement}
                                />
                            </SliderContainer>
                            <SliderContainer>
                                <IconSliderControl
                                    label="Saturation"
                                    value={activeObjectProps?.saturation || 0}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    jump={5}
                                    onChange={setsaturationOfElement}
                                />
                            </SliderContainer>
                        </SectionContent>
                    </SettingSection>

                    {/* Effects Section */}
                    <SettingSection>
                        {/* <SectionHeader onClick={() => toggleSection('effects')}>
                            <div className="d-flex align-items-center">
                                <FaWandMagicSparkles className="me-2" />
                                <span>Effects</span>
                            </div>
                            {expandedSection === 'effects' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                        </SectionHeader> */}
                        {/* <SectionContent className={expandedSection === 'effects' ? 'expanded' : ''}> */}
                        <SectionContent className="expanded">
                            <div className="d-flex align-items-center mb-2">
                                <span className="fw-semibold d-none d-md-inline">Effects</span>
                            </div>
                            <div className="row g-2">
                                {EffectsList.map((effect, index) => (
                                    <div key={index} className="col-4 col-md-6">
                                        <EffectsWrapper
                                            className={`text-center d-flex align-items-center justify-content-center flex-column g-3 ${activeObjectProps?.effect === effect.value ? 'selected' : ''}`}
                                            onClick={() => setEffect(effect.value)}
                                        >
                                            <img
                                                style={{
                                                    filter: `${effect.value}(${effect.effect})`,
                                                    width: '100%',
                                                    height: '40px',
                                                    objectFit: 'cover',
                                                    borderRadius: '4px',
                                                    marginBottom: '4px'
                                                }}
                                                src="https://cdn.icon-icons.com/icons2/3361/PNG/512/multimedia_communication_image_placeholder_photography_landscape_image_comics_picture_photo_gallery_image_icon_210828.png"
                                                alt={effect.label}
                                            />
                                            <div className="m-0 text-center" style={{ fontSize: '10px', fontWeight: '500' }}>
                                                {effect.label}
                                            </div>
                                        </EffectsWrapper>
                                    </div>
                                ))}
                            </div>
                        </SectionContent>
                    </SettingSection>
                </Wrapper>
            </DesktopWrapper>

            {/* Color Picker Modals - Outside Desktop Wrapper for mobile access */}
            <ColorPickerModal
                isOpen={showBorderColorPicker}
                onClose={handleBorderColorPickerClose}
                color={tempBorderColor}
                onChange={handleBorderColorChange}
                onConfirm={handleBorderColorConfirm}
                title="Choose Border Color"
                externalSolidColorHistory={[...borderSolidColorHistory, ...globalSolidColorHistory.filter(g => !borderSolidColorHistory.some(b => b.color === g.color))]}
            />
            <ColorPickerModal
                isOpen={showShadowColorPicker}
                onClose={handleShadowColorPickerClose}
                color={tempShadowColor}
                onChange={handleShadowColorChange}
                onConfirm={handleShadowColorConfirm}
                title="Choose Shadow Color"
                externalSolidColorHistory={[...shadowSolidColorHistory, ...globalSolidColorHistory.filter(g => !shadowSolidColorHistory.some(s => s.color === g.color))]}
            />
        </>
    );
}

export default StickerSettingsPanel;


export function IconSliderControl({
    label,
    value = 0,
    min = -100,
    max = 100,
    step = 1,
    jump = 5,
    onChange,
    unit = '',
    hideLabel = false,
}) {
    const safeValue = Number(value) || 0;
    const formattedValue = Number.isNaN(safeValue)
        ? 0
        : parseFloat(safeValue.toFixed(2));

    const increase = () =>
        onChange(Math.min(max, safeValue + jump));

    const decrease = () =>
        onChange(Math.max(min, safeValue - jump));

    return (
        <>
            {/* Header - only show if not hidden */}
            {!hideLabel && label && (
                <div className="d-flex mt-2 align-items-center justify-content-between">
                    <Form.Label className="m-0 small">{label}</Form.Label>
                    <Form.Label className="m-0 small fw-semibold">
                        {formattedValue}{unit}
                    </Form.Label>
                </div>
            )}

            {/* Slider Row */}
            <div className={`d-flex ${hideLabel ? '' : 'pt-2'} align-items-center gap-2`}>
                {/* Minus */}
                <button
                    type="button"
                    className="btn btn-sm btn-light d-flex align-items-center"
                    onClick={decrease}
                >
                    <LuMinus size={10} />
                </button>

                {/* Slider */}
                <Form.Range
                    className="flex-grow-1"
                    value={safeValue}
                    onChange={(e) => onChange(Number(e.target.value))}
                    min={min}
                    max={max}
                    step={step}
                />

                {/* Plus */}
                <button
                    type="button"
                    className="btn btn-sm btn-light d-flex align-items-center"
                    onClick={increase}
                >
                    <LuPlus size={10} />
                </button>
            </div>
        </>
    );
}
