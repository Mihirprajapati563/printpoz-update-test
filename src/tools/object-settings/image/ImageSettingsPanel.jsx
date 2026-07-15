import React, { useState, useEffect } from "react";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { GrPowerReset } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import styled from "styled-components";
import {
  getActiveObjectprops,
  getSettings
} from "../../../library/utils/helpers";
import {
  removeObjectInPage,
  sendForward,
  sendBackward,
  setCurrentObjectProperties,
} from "../../../store/slices/canvas";
import { EffectsList, ShadowList } from "../../../library/utils/jsons/commonJSON";
import { apiPost } from "../../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../../library/utils/constants/apiurl";
import { useSearchParams } from "react-router-dom";
import { refreshProjectImages } from "../../../store/slices/imageUpload";
import { v4 as uuidv4 } from "uuid";
import { USER_TYPES } from "../../../library/utils/constants";
import ColorPickerModal from "../../../common-components/ColorPickerModal";
import { IconSliderControl } from "../sticker/StickerSettingsPanel";
import PositionSettingsPanel from "../position/PositionSettingsPanel";

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
    
    & > * {
      flex-shrink: 0;
    }
  }
`;

// Individual Panel Tab Button
const PanelTab = styled.button`
  flex-shrink: 0;
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
  flex: 0 0 auto;
  
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

const SliderContainer = styled.div`
  // padding:5px;
  
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
const EffectsWrapper = styled.div`
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
  font-size: 11px;
  border: 1px solid #e9ecef;
  margin: 2px;
  
  &:hover {
    border-color: var(--primary);
  }
  
  &.selected {
    background: #e3f2fd;
    border-color: var(--primary);
    color: var(--primary);
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

const SectionContent = styled.div`
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  
  &.expanded {
    max-height: 500px;
    padding: 16px;
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

function ImageSettingsPanel() {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const settings = useSelector(getSettings);
  const projectSetup = useSelector((state) => state.projectSetup);
  const [expandedSection, setExpandedSection] = useState(null);
  const [mobileActivePanel, setMobileActivePanel] = useState(null);
  const [searchParams] = useSearchParams();

  // Get user type for conditional rendering
  const users = localStorage.getItem("userDetails");
  const userType = JSON.parse(users)?.userTypeCode || -1;

  // Panel definitions
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

  // Exact same functions as ImageSettingsPopover.jsx
  const setFlipX = () => {
    dispatch(
      setCurrentObjectProperties({
        flip: {
          ...activeObjectProps.flip,
          x: !activeObjectProps.flip?.x,
        },
      })
    );
  };

  const zoomOut = () => {
    if (
      activeObjectProps.image.scale === undefined ||
      activeObjectProps.image.scale === NaN
    ) {
      dispatch(
        setCurrentObjectProperties({
          image: {
            ...activeObjectProps.image,
            scale: 0.9,
          },
        })
      );
    } else {
      dispatch(
        setCurrentObjectProperties({
          image: {
            ...activeObjectProps.image,
            scale: activeObjectProps.image.scale - 0.1,
          },
        })
      );
    }
  };

  const zoomIn = () => {
    if (
      activeObjectProps.image.scale === undefined ||
      activeObjectProps.image.scale === NaN
    ) {
      dispatch(
        setCurrentObjectProperties({
          image: {
            ...activeObjectProps.image,
            scale: 1.1,
          },
        })
      );
    } else {
      dispatch(
        setCurrentObjectProperties({
          image: {
            ...activeObjectProps.image,
            scale: activeObjectProps.image.scale + 0.1,
          },
        })
      );
    }
  };

  const removeElement = () => {
    dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
    dispatch(setCurrentObjectProperties(null));
  };

  const SendBackward = () => {
    dispatch(sendBackward());
  };

  const BrignForward = () => {
    dispatch(sendForward());
  };

  const handleRemoveBackground = async () => {
    try {
      if (
        activeObjectProps.type === "img" &&
        (activeObjectProps?.urls || activeObjectProps.url)
      ) {
        let urls;
        if (activeObjectProps?.urls?.length > 0) {
          urls = activeObjectProps?.urls?.filter(
            (image) => image.size === "large"
          );
        } else {
          urls = [{ url: activeObjectProps.url }];
        }
        dispatch(
          setCurrentObjectProperties({
            isProcessing: true,
            locked: true,
          })
        );
        let data = {};
        data.url = urls[0]?.url || "";
        data.userTypeCode = userType || -1;
        let cart_order_id = searchParams.get("c_id");
        if (
          cart_order_id &&
          cart_order_id !== null &&
          cart_order_id !== "" &&
          cart_order_id !== undefined
        ) {
          data.cart_order_id = cart_order_id;
        }
        if (
          users?._id &&
          users?._id !== null &&
          users?._id !== "" &&
          users?._id !== undefined
        ) {
          data.user_id = users?._id;
        }
        if (projectSetup) {
          data.theme_id = projectSetup?.themeDetails?.theme_id || "";
        }
        data.brand_id = users?.brand_id || "";

        const response = await apiPost(ENDPOINTS.removeBackground, data);
        if (response.status === 1) {
          let urls = response.items;
          let largeImage = urls.find((url) => url.size === "large");
          if (
            activeObjectProps.type === "img" &&
            largeImage?.url &&
            urls.length > 0
          ) {
            let data = {
              ...activeObjectProps,
              url: largeImage.url,
              urls: urls,
            };
            if (activeObjectProps?.autoBackgroundRemove) {
              data.autoBackgroundRemove = false;
            }
            dispatch(
              setCurrentObjectProperties({
                ...data,
              })
            );
            let batchId = uuidv4();
            dispatch(refreshProjectImages(batchId));
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(
        setCurrentObjectProperties({
          isProcessing: false,
          locked: false,
          autoBackgroundRemove: false,
        })
      );
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!activeObjectProps || activeObjectProps.type !== "img") {
    return null;
  }

  {/* <span className="fw-semibold"> */}
{/* <span className="fw-semibold d-none d-md-inline"> */}
  
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
              <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ border: { color: '#000000', width: 0 } }))} style={{ padding: '4px 8px' }}>
                <GrPowerReset />
              </ActionButton>
            </div>
            <SetBorderInline activeObjectProps={activeObjectProps} />
          </>
        );
      case 'shadow':
        return (
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold d-none d-md-inline">Shadow Settings</span>
              <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ shadow: { color: '#000000', blur: 0, x: 0, y: 0 } }))} style={{ padding: '4px 8px' }}>
                <GrPowerReset />
              </ActionButton>
            </div>
            <ImageShadowsInline activeObjectProps={activeObjectProps} />
          </>
        );
      case 'opacity':
        return (
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold d-none d-md-inline">Opacity</span>
              <span>{Math.round((activeObjectProps?.opacity || 1) * 100)}%</span>
            </div>
            <SetOpacityInline activeObjectProps={activeObjectProps} />
          </>
        );
      case 'adjustments':
        return (
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold d-none d-md-inline">Adjustments</span>
              <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ effects: { brightness: 0, contrast: 0, saturation: 0 } }))} style={{ padding: '4px 8px' }}>
                <GrPowerReset />
              </ActionButton>
            </div>
            <AdjustmentsInline activeObjectProps={activeObjectProps} />
          </>
        );
      case 'effects':
        return (
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold d-none d-md-inline">Effects</span>
            </div>
            <EffectsInline activeObjectProps={activeObjectProps} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* ===== MOBILE VIEW: Panel Tabs + Bottom Sheet ===== */}
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

      {/* ===== DESKTOP VIEW: Original Layout (hidden on mobile) ===== */}
      <div className="d-none d-md-block">
        <Wrapper className="border-0 px-1">
          <div className="">

            {/* Transform and Layer Controls */}
            <div className="mb-3">
              <div className="row g-2">
              </div>
            </div>

            {/* Position Section */}
            <PositionSettingsPanel />

            {/* Border Section */}
            <SettingSection>
              <SectionContent className="expanded">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fw-semibold d-none d-md-inline">Border</span>
                  <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ border: { color: '#000000', width: 0 } }))} style={{ padding: '4px 8px' }}>
                    <GrPowerReset />
                  </ActionButton>
                </div>
                <SetBorderInline activeObjectProps={activeObjectProps} />
              </SectionContent>
            </SettingSection>

            {/* Shadow Section */}
            <SettingSection>
              <SectionContent className="expanded">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fw-semibold d-none d-md-inline">Shadow</span>
                  <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ shadow: { color: '#000000', blur: 0, x: 0, y: 0 } }))} style={{ padding: '4px 8px' }}>
                    <GrPowerReset />
                  </ActionButton>
                </div>
                <ImageShadowsInline activeObjectProps={activeObjectProps} />
              </SectionContent>
            </SettingSection>

            {/* Opacity Section */}
            <SettingSection>
              <SectionContent className="expanded">
                <SetOpacityInline activeObjectProps={activeObjectProps} />
              </SectionContent>
            </SettingSection>

            {/* Adjustments Section */}
            <SettingSection>
              <SectionContent className="expanded">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fw-semibold d-none d-md-inline">Adjustments</span>
                  <ActionButton onClick={() => dispatch(setCurrentObjectProperties({ effects: { brightness: 0, contrast: 0, saturation: 0 } }))} style={{ padding: '4px 8px' }}>
                    <GrPowerReset />
                  </ActionButton>
                </div>
                <AdjustmentsInline activeObjectProps={activeObjectProps} />
              </SectionContent>
            </SettingSection>

            {/* Effects Section */}
            <SettingSection>
              <SectionContent className="expanded">
                <div className="d-flex align-items-center">
                  <span className="fw-semibold d-none d-md-inline">Effects</span>
                </div>
                <EffectsInline activeObjectProps={activeObjectProps} />
              </SectionContent>
            </SettingSection>

          </div>
        </Wrapper>
      </div>
    </>
  );
}
// Inline Components for List Layout
function SetOpacityInline({ activeObjectProps }) {
  const dispatch = useDispatch();

  const setOpacityOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ opacity: parseFloat(value) }));
  };

  return (
    <SliderContainer>
      <IconSliderControl
        label="Opacity"
        value={Math.round((activeObjectProps?.opacity || 1) * 100)}
        min={0}
        max={100}
        step={1}
        jump={5}
        onChange={(value) => setOpacityOfElement(value / 100)}
        unit="%"
      />
    </SliderContainer>
  );
}

function AdjustmentsInline({ activeObjectProps }) {
  const dispatch = useDispatch();

  const setBrightnessOfElement = (value) => {
    dispatch(
      setCurrentObjectProperties({
        effects: {
          ...activeObjectProps.effects,
          brightness: parseInt(value),
        },
      })
    );
  };

  const setcontrastOfElement = (value) => {
    dispatch(
      setCurrentObjectProperties({
        effects: {
          ...activeObjectProps.effects,
          contrast: parseInt(value),
        },
      })
    );
  };

  const setsaturationOfElement = (value) => {
    dispatch(
      setCurrentObjectProperties({
        effects: {
          ...activeObjectProps.effects,
          saturation: parseInt(value),
        },
      })
    );
  };

  const resetEffectSettings = () => {
    dispatch(
      setCurrentObjectProperties({
        effects: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
        },
      })
    );
  };

  return (
    <SliderContainer>
      {/* <div className="d-flex justify-content-end align-items-center mb-2">
        <ActionButton onClick={resetEffectSettings} style={{ padding: '4px 8px' }}>
          <GrPowerReset />
        </ActionButton>
      </div> */}

      <IconSliderControl
        label="Brightness"
        value={activeObjectProps?.effects?.brightness || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={setBrightnessOfElement}
      />

      <IconSliderControl
        label="Contrast"
        value={activeObjectProps?.effects?.contrast || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={setcontrastOfElement}
      />

      <IconSliderControl
        label="Saturation"
        value={activeObjectProps?.effects?.saturation || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={setsaturationOfElement}
      />
    </SliderContainer>
  );
}

function EffectsInline({ activeObjectProps }) {
  const dispatch = useDispatch();

  const setEffect = (value) => {
    dispatch(setCurrentObjectProperties({ effect: value }));
  };

  const resetEffects = () => {
    dispatch(setCurrentObjectProperties({ effect: null }));
  };

  return (
    <SliderContainer>
      {/* <div className="d-flex justify-content-end align-items-center mb-2">
        <ActionButton onClick={resetEffects} style={{ padding: '4px 8px' }}>
          <GrPowerReset />
        </ActionButton>
      </div> */}

      <div className="row g-2 mt-2">
        {EffectsList.map((effect, index) => (
          <div key={index} className="col-4 col-md-6">
            <EffectsWrapper
              className={`text-center d-flex align-items-center justify-content-center flex-column  g-3 ${activeObjectProps?.effect === effect.value ? 'selected' : ''}`}
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
    </SliderContainer>
  );
}

function ImageShadowsInline({ activeObjectProps }) {
  const dispatch = useDispatch();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(activeObjectProps?.shadow?.color || '#000000');

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
          color: '#000000',
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

  const handleColorPickerOpen = () => {
    setTempColor(activeObjectProps?.shadow?.color || '#000000');
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

  const handleColorConfirm = (color) => {
    // Use the temp color which now includes opacity
    setShadowColor(tempColor);
    setShowColorPicker(false);
  };

  return (
    <>
      <SliderContainer>
        {/* <div className="d-flex justify-content-end align-items-center mb-2">
          <ActionButton onClick={resetShadowSettings} style={{ padding: '4px 8px' }}>
            <GrPowerReset />
          </ActionButton>
        </div> */}

        <IconSliderControl
          label="Horizontal Length"
          value={activeObjectProps?.shadow?.offsetX || 0}
          min={-(activeObjectProps?.width / 2) || -50}
          max={(activeObjectProps?.width / 2) || 50}
          step={1}
          jump={5}
          onChange={setShadowOffsetX}
        />

        <IconSliderControl
          label="Vertical Length"
          value={activeObjectProps?.shadow?.offsetY || 0}
          min={-(activeObjectProps?.height / 2) || -50}
          max={(activeObjectProps?.height / 2) || 50}
          step={1}
          jump={5}
          onChange={setShadowOffsetY}
        />

        <IconSliderControl
          label="Spread"
          value={activeObjectProps?.shadow?.blurRadius || 0}
          min={0}
          max={Math.max(activeObjectProps?.width, activeObjectProps?.height) / 5 || 50}
          step={1}
          jump={5}
          onChange={setShadowBlurRadius}
        />

        {/* Shadow Color */}
        <div className="mt-3 d-flex align-items-center justify-content-between">
          <small className="text-muted">Shadow Color</small>
          <div
            style={{
              position: 'relative',
              width: '50px',
              height: '30px',
              backgroundColor: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
            onClick={handleColorPickerOpen}
            title="Click to choose shadow color"
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            {/* Color Preview Circle */}
            <div
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: activeObjectProps?.shadow?.color || '#000000',
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                position: 'relative',
                zIndex: 1
              }}
            />
            {/* Background Pattern for Transparency */}
            <div
              style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                right: '4px',
                bottom: '4px',
                backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                 linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                 linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                 linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                backgroundSize: '6px 6px',
                backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                borderRadius: '6px',
                zIndex: 0
              }}
            />
          </div>
        </div>
      </SliderContainer>

      {/* Beautiful Color Picker Modal */}
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={handleColorPickerClose}
        color={tempColor}
        onChange={handleColorChange}
        onConfirm={handleColorConfirm}
        title="Choose Shadow Color"
        showPreview={true}
        showActions={true}
      />
    </>
  );
}

function SetBorderInline({ activeObjectProps }) {
  const dispatch = useDispatch();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(activeObjectProps?.border?.color || '#000000');

  const setBorderWidth = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          width: parseInt(value),
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
          color: '#000000',
          radius: 0,
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

  const handleColorPickerOpen = () => {
    setTempColor(activeObjectProps?.border?.color || '#000000');
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

  const handleColorConfirm = (color) => {
    // Use the temp color which now includes opacity
    setBorderColor(tempColor);
    setShowColorPicker(false);
  };

  return (
    <>
      <SliderContainer>
        {/* <div className="d-flex justify-content-between align-items-center mb-2">
          <small className="text-muted">Border Settings</small>
          <ActionButton onClick={resetBorderSettings} style={{ padding: '4px 8px' }}>
            <GrPowerReset />
          </ActionButton>
        </div> */}

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

        <div className="mt-3 d-flex align-items-center justify-content-between">
          <small className="text-muted">Border Color</small>
          <div
            style={{
              position: 'relative',
              width: '50px',
              height: '30px',
              backgroundColor: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
            onClick={handleColorPickerOpen}
            title="Click to choose border color"
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            {/* Color Preview Circle */}
            <div
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: activeObjectProps?.border?.color || '#000000',
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                position: 'relative',
                zIndex: 1
              }}
            />
            {/* Background Pattern for Transparency */}
            <div
              style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                right: '4px',
                bottom: '4px',
                backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                                 linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                                 linear-gradient(45deg, transparent 75%, #ccc 75%), 
                                 linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                backgroundSize: '6px 6px',
                backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                borderRadius: '6px',
                zIndex: 0
              }}
            />
          </div>
        </div>
      </SliderContainer>

      {/* Beautiful Color Picker Modal */}
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={handleColorPickerClose}
        color={tempColor}
        onChange={handleColorChange}
        onConfirm={handleColorConfirm}
        title="Choose Border Color"
        showPreview={true}
        showActions={true}
      />
    </>
  );
}

export default ImageSettingsPanel;

// Named exports for reuse in ImageToolbarDialogPanel
export { SetOpacityInline, AdjustmentsInline, EffectsInline, ImageShadowsInline, SetBorderInline };
