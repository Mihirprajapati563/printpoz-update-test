import React, { useState, useEffect, useRef, useCallback } from "react";
import { Form, Button, Dropdown } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
    FiAlignLeft,
    FiAlignCenter,
    FiAlignRight,
    FiAlignJustify
} from "react-icons/fi";
import { ReactComponent as LeftAlignIcon } from "../../../assets/icons/left_align_icon.svg";
import { ReactComponent as RightAlignIcon } from "../../../assets/icons/right_align_icon.svg";
import { ReactComponent as CenterAlignIcon } from "../../../assets/icons/center_align_icon.svg";
import { ReactComponent as TopAlignIcon } from "../../../assets/icons/text_valign_top.svg";
import { ReactComponent as BottomAlignIcon } from "../../../assets/icons/text_valign_bottom.svg";
import { ReactComponent as MiddleAlignIcon } from "../../../assets/icons/text_valign_center.svg";
import { ReactComponent as JustifyAlignIcon } from "../../../assets/icons/justify_align_icon.svg";
import {
    BiMinusBack,
    BiMinusFront,
    BiTrash,
    BiText,
    BiColorFill
} from "react-icons/bi";
import {
    MdFormatColorText,
    MdKeyboardArrowDown,
    MdKeyboardArrowUp,
    MdTextFields
} from "react-icons/md";
import {
    AiOutlineBgColors,
    AiOutlineFontSize
} from "react-icons/ai";
import {
    TbBoxAlignLeftFilled,
    TbPalette
} from "react-icons/tb";
import {
    FaPlus,
    FaFont,
    FaWandMagicSparkles
} from "react-icons/fa6";
import { FiEdit } from "react-icons/fi";
import { GrPowerReset } from "react-icons/gr";
import { ReactComponent as LockObjectIcon } from "../../../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../../../assets/icons/unlock121.svg";
import styled from "styled-components";
import {
    getActiveObjectprops,
    getSettings,
    getCanvasSize
} from "../../../library/utils/helpers";
import {
    removeObjectInPage,
    sendForward,
    sendBackward,
    setCurrentObjectProperties,
    addObjectInPage
} from "../../../store/slices/canvas";
import { USER_TYPES } from "../../../library/utils/constants";
import ColorPickerModal from "../../../common-components/ColorPickerModal";
import { PrimaryButton } from "../../../common-components/StyledComponents";
import {
    Fontfamilies,
    fontSizes
} from "../../../library/utils/jsons/commonJSON";
import { apiPost } from "../../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../../library/utils/constants/apiurl";
import { getActiveEditorType } from "../../../library/utils/helpers";
import { LiaTimesSolid } from "react-icons/lia";
import { IoClose } from "react-icons/io5";
import { setIsActionActive } from "../../../store/slices/appAlice";
import PositionSettingsPanel from "../position/PositionSettingsPanel";
import { useFontContext } from "../../../library/utils/context/FontContext";
import CustomFontAccordion from "../../text/CustomFontAccordion";
import TextGroupPanel from "../../text/TextGroupPanel";

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
      display: none !important;
    }
    
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
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
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

// Color preview box
const ColorPreview = styled.div`
  width: 40px;
  height: 30px;
  border-radius: 6px;
  border: 2px solid #e9ecef;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--primary);
    transform: scale(1.05);
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
  background: #f8f9fa;
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  border-bottom: 1px solid #e9ecef;
  transition: all 0.2s ease;
  svg {
    color: var(--primary);
  }
  
  &:hover {
    background: #e9ecef;
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
  
  @media (max-width: 768px) {
    &.expanded {
      padding: 12px;
    }
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
      background-color: #1565c0;
      border-color: #1565c0;
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

const StyledDropdown = styled(Dropdown)`
  .dropdown-toggle {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    color: #495057;
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    transition: all 0.2s ease;
    
    &:hover {
      background: #e9ecef;
      border-color: #dee2e6;
    }
    
    &:focus {
      box-shadow: 0 0 0 0.2rem rgba(25, 118, 210, 0.25);
      background: #fff;
      border-color: #1976d2;
    }
    
    &::after {
      margin-left: auto;
    }
  }
  
  .dropdown-menu {
    border-radius: 8px;
    border: 1px solid #e9ecef;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    
    .dropdown-item {
      font-size: 12px;
      padding: 8px 12px;
      transition: all 0.2s ease;
      
      &:hover {
        background: #f8f9fa;
        color: #1976d2;
      }
      
      &.active {
        background: #1976d2;
        color: white;
      }
    }
  }
  
  @media (max-width: 768px) {
    .dropdown-toggle {
      font-size: 11px;
      padding: 6px 8px;
    }
    
    .dropdown-menu {
      .dropdown-item {
        font-size: 11px;
        padding: 6px 8px;
      }
    }
  }
`;

const FontStyleContainer = styled.div`
  .font-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .font-control-label {
    font-size: 11px;
    font-weight: 500;
    color: #6c757d;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .font-size-input {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: #495057;
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 0 0.2rem rgba(25, 118, 210, 0.25);
      background: #fff;
    }
  }
  
  @media (max-width: 768px) {
    .font-control-label {
      font-size: 20px;
    }
    
    .font-size-input {
      font-size: 11px;
      padding: 6px 8px;
    }
  }
`;

const AlignmentContainer = styled.div`
  .alignment-group {
    padding: 10px;
    
  }
  
  .alignment-label {
    font-size: 12px;
    font-weight: 600;
    color: #495057;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .alignment-buttons {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  
  .align-btn {
    flex: 1;
    background: #ffffff;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    
    &:hover {
      border-color: var(--primary);
      background: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px var(--primary);
    }
    
    &.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
      box-shadow: 0 4px 15px var(--primary);
      
      svg {
        filter: brightness(0) invert(1);
      }
    }
    
    svg {
      width: 18px;
      height: 18px;
      transition: all 0.3s ease;
    }
  }
  
  @media (max-width: 768px) {
    .alignment-group {
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .alignment-label {
      font-size: 11px;
      margin-bottom: 8px;
    }
    
    .alignment-buttons {
      gap: 6px;
    }
    
    .align-btn {
      padding: 10px;
      min-height: 40px;
      
      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
`;

function TextSettingPanel() {
    const dispatch = useDispatch();
    const activeObjectProps = useSelector(getActiveObjectprops);
    const settings = useSelector(getSettings);
    const canvasSize = useSelector(getCanvasSize);
    const [expandedSection, setExpandedSection] = useState(null);
    const [mobileActivePanel, setMobileActivePanel] = useState(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [tempColor, setTempColor] = useState('#000000');
    const [colorPickerType, setColorPickerType] = useState('text'); // 'text' or 'background'

    // Track if font family change was user-initiated (not from syncing with selected object)
    const userChangedFontFamilyRef = useRef(false);
    const isCustomFontRef = useRef(false); // Track if current font is from backend (not static Fontfamilies)

    // Custom fonts from backend
    const { resolveFont, isFontLoaded, loadFont } = useFontContext();

    // Font style states
    const [fontFamily, setFontFamily] = useState('Arial');
    const [fontSize, setFontSize] = useState(16);
    const [fontWeight, setFontWeight] = useState('400');
    const [fwList, setFwList] = useState([]);
    const baseReferenceWidth = 500;

    // Text editing states
    const [showEditSection, setShowEditSection] = useState(false);
    const [editText, setEditText] = useState('');

    // AI Generated Texts states
    const [aiCaptions, setAiCaptions] = useState([]);
    const [loadingCaptions, setLoadingCaptions] = useState(false);

    // Get user type for conditional rendering
    const users = localStorage.getItem("userDetails");
    const userType = JSON.parse(users)?.userTypeCode || -1;
    const editorType = useSelector(getActiveEditorType);
    const projectSetup = useSelector((state) => state.projectSetup);

    // Panel definitions for mobile tabs
    const panels = [
        { id: 'position', label: 'Position' },
        { id: 'font', label: 'Font' },
        { id: 'colors', label: 'Colors' },
        { id: 'alignment', label: 'Align' },
    ];

    // Close mobile panel
    const closeMobilePanel = () => {
        setMobileActivePanel(null);
    };

    // Font style effect to sync with active object
    useEffect(() => {
        if (activeObjectProps && activeObjectProps.type === 'text') {
            if (activeObjectProps.font) {
                userChangedFontFamilyRef.current = false; // Sync, not user action
                setFontFamily(activeObjectProps.font.family || 'Arial');
                setFontSize(activeObjectProps.font.size || 16);
                // Ensure font weight is always a string
                setFontWeight(String(activeObjectProps.font.weight || '400'));
            }
            // Sync edit text with active object text
            if (activeObjectProps.text && !showEditSection) {
                setEditText(activeObjectProps.text);
            }
        }
    }, [activeObjectProps, showEditSection]);

    // Update font weight list when font family changes
    useEffect(() => {
        // Skip static Fontfamilies lookup for custom fonts — fwList is already set by handleCustomVariantSelect
        if (isCustomFontRef.current) {
            isCustomFontRef.current = false;
            return;
        }

        const selectedFont = Fontfamilies.find(font => font.name === fontFamily);
        if (selectedFont) {
            setFwList(selectedFont.fw || []);

            // Only normalize weight when user explicitly changed the font family
            if (userChangedFontFamilyRef.current && activeObjectProps?.font?.weight && selectedFont.fw?.length > 0) {
                const currentWeight = String(activeObjectProps.font.weight);
                const isWeightSupported = selectedFont.fw.some(
                    (fw) => String(fw.value) === currentWeight
                );

                // If current weight not supported, normalize to first available
                if (!isWeightSupported) {
                    const normalizedWeight = String(selectedFont.fw[0].value);
                    setFontWeight(normalizedWeight);
                    dispatch(setCurrentObjectProperties({
                        font: {
                            ...activeObjectProps.font,
                            weight: normalizedWeight,
                        },
                    }));
                }
                userChangedFontFamilyRef.current = false;
            }
        }
    }, [fontFamily, activeObjectProps?.font?.weight, dispatch]);

    // Callback for CustomFontAccordion when a variant is selected
    const handleCustomVariantSelect = useCallback((font, styleEntry) => {
        const weight = styleEntry.weight;
        const style = styleEntry.style || "normal";

        isCustomFontRef.current = true;
        userChangedFontFamilyRef.current = true;
        setFontFamily(font.name);
        setFontWeight(String(weight));

        // Build weight list from backend styles
        const newFwList = font.styles.map((s) => ({
            name: s.label,
            value: s.weight,
        }));
        setFwList(newFwList);

        dispatch(setCurrentObjectProperties({
            font: {
                ...activeObjectProps.font,
                family: font.name,
                id: font.fontId,
                styleId: styleEntry.styleId,
                weight: String(weight),
                style: style,
            },
        }));
    }, [activeObjectProps, dispatch]);

    // Calculate font size for canvas scaling
    const calculateFontSize = (baseSize, referenceWidth = baseReferenceWidth) => {
        return baseSize * (canvasSize.width / referenceWidth);
    };

    // Add Text Function
    const handleAddText = () => {
        const obj = {};
        obj.type = "text";
        obj.x = 10;
        obj.y = 50;
        obj.width = 300;
        obj.height = 60;
        dispatch(setCurrentObjectProperties(null));
        dispatch(addObjectInPage(obj));
    };

    // Text manipulation functions
    const removeElement = () => {
        dispatch(removeObjectInPage({ id: activeObjectProps.id, data: null }));
        dispatch(setCurrentObjectProperties(null));
    };

    const SendBackward = () => {
        dispatch(sendBackward());
    };

    const BringForward = () => {
        dispatch(sendForward());
    };

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Color picker handlers
    const handleColorPickerOpen = (type = 'text') => {
        setColorPickerType(type);
        const currentColor = type === 'text'
            ? activeObjectProps?.color || '#000000'
            : activeObjectProps?.bgcolor || '#ffffff';
        setTempColor(currentColor);
        setShowColorPicker(true);
    };

    const handleColorPickerClose = () => {
        setShowColorPicker(false);
    };

    const handleColorChange = (color) => {
        // Use RGBA color to preserve opacity
        const colorValue = color.rgba || color.hex;
        setTempColor(colorValue);
    };

    const handleColorConfirm = () => {
        if (colorPickerType === 'text') {
            dispatch(setCurrentObjectProperties({ color: tempColor }));
        } else {
            dispatch(setCurrentObjectProperties({ bgcolor: tempColor }));
        }
        setShowColorPicker(false);
    };

    // AI Generated Texts handlers
    const handleGenerateCaptions = async () => {
        setLoadingCaptions(true);
        try {
            const themeId = projectSetup?.themeDetails?.theme_id || null;
            const data = {
                theme_id: themeId,
                editor_type: editorType,
            };

            const response = await apiPost(ENDPOINTS.getTextCaptions, data);
            if (response && response.status === 1 && response.items?.suggestions) {
                setAiCaptions(response.items.suggestions);
            } else {
                setAiCaptions([]);
            }
        } catch (error) {
            setAiCaptions([]);
        } finally {
            setLoadingCaptions(false);
        }
    };

    const handleAiCaptionClick = (caption) => {
        const obj = {
            type: 'text',
            x: 10,
            y: 50,
            text: caption,
            width: 300,
            height: 60
        };
        dispatch(setCurrentObjectProperties(null));
        dispatch(addObjectInPage(obj));
    };

    // Load AI captions on component mount
    useEffect(() => {
        if (userType !== USER_TYPES.CUSTOMER && aiCaptions.length === 0) {
            handleGenerateCaptions();
        }
    }, [userType, editorType]);

    // Font style handlers
    const handleFontFamilyChange = (value) => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        userChangedFontFamilyRef.current = true;
        isCustomFontRef.current = false; // Switching to static font
        setFontFamily(value);
        const { id: _removedId, ...fontWithoutId } = activeObjectProps.font || {};
        dispatch(setCurrentObjectProperties({
            font: {
                ...fontWithoutId,
                family: value
            }
        }));
    };

    const handleFontSizeChange = (value) => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        const scaledSize = calculateFontSize(parseInt(value));
        setFontSize(parseInt(value));
        dispatch(setCurrentObjectProperties({
            font: {
                ...activeObjectProps.font,
                size: scaledSize
            }
        }));
    };

    const handleFontWeightChange = async (value) => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        const weightValue = String(value);
        setFontWeight(weightValue);

        // If this is a custom font, load the WOFF2 for the new weight
        const fontId = activeObjectProps?.font?.id;
        let newStyleId = activeObjectProps?.font?.styleId;
        if (fontId) {
            const fontStyle = activeObjectProps?.font?.style || "normal";
            if (!isFontLoaded(activeObjectProps.font.family, parseInt(value, 10), fontStyle)) {
                await loadFont(fontId, parseInt(value, 10), fontStyle);
            }
            // Resolve the correct styleId for the new weight
            const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
            if (resolved?.styles) {
                const w = parseInt(value, 10) || 400;
                const matched = resolved.styles.find((s) => s.weight === w && s.style === fontStyle)
                    || resolved.styles.find((s) => s.weight === w);
                if (matched?.styleId) newStyleId = matched.styleId;
            }
        }

        dispatch(setCurrentObjectProperties({
            font: {
                ...activeObjectProps.font,
                weight: weightValue,
                styleId: newStyleId
            }
        }));
    };

    const handleEditClick = () => {
        if (activeObjectProps && activeObjectProps.text) {
            setEditText(activeObjectProps.text);
        }
        setShowEditSection(!showEditSection);
    };

    const handleApplyText = () => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        dispatch(setCurrentObjectProperties({
            text: editText
        }));
        setShowEditSection(false);
    };

    const handleCancelEdit = () => {
        setEditText('');
        setShowEditSection(false);
    };

    // Alignment handlers based on TextAction.jsx business logic
    const handleHorizontalAlign = (value) => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        dispatch(setCurrentObjectProperties({
            alignment: {
                ...activeObjectProps.alignment,
                horizontal: value
            }
        }));
    };

    const handleVerticalAlign = (value) => {
        if (!activeObjectProps || activeObjectProps.type !== 'text') return;

        dispatch(setCurrentObjectProperties({
            alignment: {
                ...activeObjectProps.alignment,
                vertical: value
            }
        }));
    };

    // Render panel content based on active panel for mobile bottom sheet
    const renderPanelContent = (panelId) => {
        switch (panelId) {
            case 'position':
                return <PositionSettingsPanel />;
            case 'font':
                return (
                    <>
                        {/* Old Font dropdowns — replaced by CustomFontAccordion */}
                        {/* <div className="mb-3">
                            <div className="small text-muted mb-2">Font Family</div>
                            <StyledDropdown>
                                <Dropdown.Toggle variant="outline-secondary" id="font-family-dropdown-mobile">
                                    {fontFamily}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    {Fontfamilies.map((font, index) => (
                                        <Dropdown.Item
                                            key={index}
                                            onClick={() => handleFontFamilyChange(font.name)}
                                            className={fontFamily === font.name ? 'active' : ''}
                                            style={{ fontFamily: font.value }}
                                        >
                                            {font.name}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </StyledDropdown>
                        </div>
                        <div className="mb-3">
                            <div className="small text-muted mb-2">Font Size</div>
                            <StyledDropdown>
                                <Dropdown.Toggle variant="outline-secondary" id="font-size-dropdown-mobile">
                                    {Math.round(activeObjectProps?.font?.size / (canvasSize.width / baseReferenceWidth)) || fontSize}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    {fontSizes.slice(0, 100).map((size, index) => (
                                        <Dropdown.Item
                                            key={index}
                                            onClick={() => handleFontSizeChange(size)}
                                            className={Math.round(activeObjectProps?.font?.size / (canvasSize.width / baseReferenceWidth)) === size ? 'active' : ''}
                                        >
                                            {size}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </StyledDropdown>
                        </div>
                        <div className="mb-3">
                            <div className="small text-muted mb-2">Font Weight</div>
                            <StyledDropdown>
                                <Dropdown.Toggle variant="outline-secondary" id="font-weight-dropdown-mobile">
                                    {fwList.find(fw => fw.value == fontWeight)?.name || 'Regular'}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    {fwList.map((weight, index) => (
                                        <Dropdown.Item
                                            key={index}
                                            onClick={() => handleFontWeightChange(weight.value)}
                                            className={fontWeight == weight.value ? 'active' : ''}
                                        >
                                            {weight.name}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </StyledDropdown>
                        </div> */}

                        {/* Custom Fonts from Backend — Accordion Style (Mobile Panel) */}
                        <CustomFontAccordion
                            fontFamily={fontFamily}
                            activeFont={activeObjectProps?.font}
                            onVariantSelect={handleCustomVariantSelect}
                            isTextSelected={activeObjectProps?.type === 'text'}
                            fontSize={fontSize}
                            onFontSizeChange={handleFontSizeChange}
                            canvasSize={canvasSize}
                        />
                    </>
                );
            case 'colors':
                return (
                    <>
                        <div className="d-flex align-items-center justify-content-between mb-3 p-2 bg-light rounded">
                            <span className="small">Text Color</span>
                            <ColorPreview
                                style={{ backgroundColor: activeObjectProps?.color || '#000000' }}
                                onClick={() => handleColorPickerOpen('text')}
                            />
                        </div>
                        <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                            <span className="small">Background Color</span>
                            <ColorPreview
                                style={{ backgroundColor: activeObjectProps?.bgcolor || 'transparent' }}
                                onClick={() => handleColorPickerOpen('background')}
                            />
                        </div>
                    </>
                );
            case 'alignment':
                return (
                    <>
                        <div className="mb-4">
                            <div className="small text-muted mb-2">Horizontal Alignment</div>
                            <div className="d-flex gap-2">
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.horizontal === 'left' ? 'active' : ''}`}
                                    onClick={() => handleHorizontalAlign('left')}
                                >
                                    <LeftAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.horizontal === 'center' ? 'active' : ''}`}
                                    onClick={() => handleHorizontalAlign('center')}
                                >
                                    <CenterAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.horizontal === 'right' ? 'active' : ''}`}
                                    onClick={() => handleHorizontalAlign('right')}
                                >
                                    <RightAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                            </div>
                        </div>
                        <div>
                            <div className="small text-muted mb-2">Vertical Alignment</div>
                            <div className="d-flex gap-2">
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.vertical === 'top' ? 'active' : ''}`}
                                    onClick={() => handleVerticalAlign('top')}
                                >
                                    <TopAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.vertical === 'middle' ? 'active' : ''}`}
                                    onClick={() => handleVerticalAlign('middle')}
                                >
                                    <MiddleAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                                <ActionButton
                                    className={`flex-fill ${activeObjectProps?.alignment?.vertical === 'bottom' ? 'active' : ''}`}
                                    onClick={() => handleVerticalAlign('bottom')}
                                >
                                    <BottomAlignIcon style={{ width: 18, height: 18 }} />
                                </ActionButton>
                            </div>
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {/* ===== MOBILE VIEW: Panel Tabs + Bottom Sheet (only when text selected) ===== */}
            {activeObjectProps?.type === "text" && (
                <>
                    <div className="d-md-none w-100" style={{ overflow: 'visible' }}>
                        <div
                            style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerMove={(e) => e.stopPropagation()}
                        >
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
                </>
            )}

            {/* ===== DESKTOP VIEW: Original Layout (hidden on mobile using Bootstrap) ===== */}
            <div className="d-none d-md-block">
                <div className="container position-relative mt-3 sticker-container sticker-container-mob">
                    <Wrapper className="border-0 px-1">
                        <div className="">
                            <div className="d-flex align-items-center justify-content-between">
                                <h6>Text</h6>
                                <LiaTimesSolid
                                    onClick={() => dispatch(setIsActionActive(false))}
                                    className="cursor-pointer"
                                />
                            </div>

                            {/*  Add Text Button */}
                            <div className="mb-3 mt-3">
                                <PrimaryButton onClick={handleAddText} className="w-100">
                                    <FaPlus className="me-2" />
                                    Add Text
                                </PrimaryButton>
                            </div>

                            {/* AI Generated Texts Section */}

                            <SettingSection>
                                <SectionHeader onClick={() => toggleSection('aiTexts')}>
                                    <div className="d-flex align-items-center">
                                        <span>AI Generated Captions</span>
                                    </div>
                                    {expandedSection === 'aiTexts' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                                </SectionHeader>
                                <SectionContent className={expandedSection === 'aiTexts' ? 'expanded' : ''}>
                                    <SliderContainer>
                                        {loadingCaptions ? (
                                            <div className="text-center py-3">
                                                <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                                <small className="text-muted">Generating AI text ideas...</small>
                                            </div>
                                        ) : (
                                            <>
                                                {aiCaptions.length > 0 ? (
                                                    <>
                                                        <div className="ai-captions-container">
                                                            {aiCaptions.map((caption, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="ai-caption-item"
                                                                    onClick={() => handleAiCaptionClick(caption)}
                                                                    style={{
                                                                        background: '#f8f9fa',
                                                                        border: '1px solid #e9ecef',
                                                                        borderRadius: '8px',
                                                                        padding: '12px',
                                                                        marginBottom: '8px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        fontSize: '13px',
                                                                        lineHeight: '1.4',
                                                                        color: '#495057'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.target.style.background = '#e3f2fd';
                                                                        e.target.style.borderColor = '#1976d2';
                                                                        e.target.style.color = '#1976d2';
                                                                        e.target.style.transform = 'translateY(-1px)';
                                                                        e.target.style.boxShadow = '0 2px 8px rgba(25, 118, 210, 0.15)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.target.style.background = '#f8f9fa';
                                                                        e.target.style.borderColor = '#e9ecef';
                                                                        e.target.style.color = '#495057';
                                                                        e.target.style.transform = 'translateY(0)';
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                >
                                                                    {caption}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center py-3">
                                                        <small className="text-muted">No AI text suggestions available</small>
                                                        <div className="mt-2">
                                                            <ActionButton
                                                                onClick={handleGenerateCaptions}
                                                                size="sm"
                                                            >
                                                                <FaWandMagicSparkles className="me-1" size={12} />
                                                                Generate AI Texts
                                                            </ActionButton>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </SliderContainer>
                                </SectionContent>
                            </SettingSection>


                            {
                                activeObjectProps?.type === "text" && (
                                    <>

                                        {/* Transform and Layer Controls */}
                                        <div div className="mb-3">
                                            <div className="row g-2">
                                                {/* Backward/Forward Buttons */}
                                                {((activeObjectProps?.disableBackwardForward !== true &&
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
                                                    )}

                                                {/* Lock/Unlock Button */}
                                                {((activeObjectProps?.disabledForClient !== true &&
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
                                                        </div>
                                                    )}

                                                {/* Delete Button */}
                                                {((activeObjectProps &&
                                                    activeObjectProps?.disabledForClient !== true &&
                                                    userType === USER_TYPES.CUSTOMER) ||
                                                    userType !== USER_TYPES.CUSTOMER) && (
                                                        <div className="col-3 col-md-4">
                                                            <ActionButton onClick={removeElement} className="w-100" title="Remove Text">
                                                                <BiTrash style={{ height: "20px", width: "20px" }} />
                                                            </ActionButton>
                                                        </div>
                                                    )}


                                                {/* Edit Text Button */}
                                                <div className="col-3 col-md-4">
                                                    <ActionButton
                                                        onClick={handleEditClick}
                                                        className={`w-100 ${showEditSection ? 'active' : ''}`}
                                                        title="Edit Text"
                                                    >
                                                        <FiEdit className="" style={{ height: "20px", width: "16px" }} />
                                                    </ActionButton>
                                                </div>
                                            </div>
                                        </div>


                                        {/* Edit Text Section */}
                                        {showEditSection && (
                                            <div className="mb-3">
                                                <div className="mb-3">
                                                    <textarea
                                                        className="form-control"
                                                        value={editText}
                                                        onChange={(e) => {
                                                            dispatch(setCurrentObjectProperties({
                                                                text: e.target.value
                                                            }))
                                                            setEditText(e.target.value)
                                                        }}
                                                        placeholder="Enter your text here..."
                                                        rows={3}
                                                        style={{
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e9ecef',
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <PrimaryButton
                                                        className="btn btn-outline-secondary btn-sm flex-fill"
                                                        onClick={handleCancelEdit}
                                                        style={{
                                                            fontSize: '11px',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px'
                                                        }}
                                                    >
                                                        DONE
                                                    </PrimaryButton>
                                                </div>
                                            </div>
                                        )}

                                        {/* Old Font Controls — replaced by CustomFontAccordion below */}
                                        {/* <div className="mb-3">
                                            <FontStyleContainer>
                                                <div className="font-control mb-3">
                                                    <div className="font-control-label">
                                                        Font Family
                                                    </div>
                                                    <StyledDropdown>
                                                        <Dropdown.Toggle variant="outline-secondary" id="font-family-dropdown">
                                                            {fontFamily}
                                                        </Dropdown.Toggle>
                                                        <Dropdown.Menu>
                                                            {Fontfamilies.map((font, index) => (
                                                                <Dropdown.Item
                                                                    key={index}
                                                                    onClick={() => handleFontFamilyChange(font.name)}
                                                                    className={fontFamily === font.name ? 'active' : ''}
                                                                    style={{ fontFamily: font.value }}
                                                                >
                                                                    {font.name}
                                                                </Dropdown.Item>
                                                            ))}
                                                        </Dropdown.Menu>
                                                    </StyledDropdown>
                                                </div>
                                                <div className="row g-2">
                                                    <div className="col">
                                                        <div className="font-control">
                                                            <div className="font-control-label">
                                                                Font Size
                                                            </div>
                                                            <StyledDropdown>
                                                                <Dropdown.Toggle variant="outline-secondary" id="font-size-dropdown">
                                                                    {Math.round(activeObjectProps?.font?.size / (canvasSize.width / baseReferenceWidth)) || fontSize}
                                                                </Dropdown.Toggle>
                                                                <Dropdown.Menu>
                                                                    {fontSizes.slice(0, 100).map((size, index) => (
                                                                        <Dropdown.Item
                                                                            key={index}
                                                                            onClick={() => handleFontSizeChange(size)}
                                                                            className={Math.round(activeObjectProps?.font?.size / (canvasSize.width / baseReferenceWidth)) === size ? 'active' : ''}
                                                                        >
                                                                            {size}
                                                                        </Dropdown.Item>
                                                                    ))}
                                                                </Dropdown.Menu>
                                                            </StyledDropdown>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="row g-2 mt-2">
                                                    <div className="col">
                                                        <div className="font-control">
                                                            <div className="font-control-label">
                                                                Font Weight
                                                            </div>
                                                            <StyledDropdown>
                                                                <Dropdown.Toggle variant="outline-secondary" id="font-weight-dropdown">
                                                                    {fwList.find(fw => fw.value == fontWeight)?.name || 'Regular'}
                                                                </Dropdown.Toggle>
                                                                <Dropdown.Menu>
                                                                    {fwList.map((weight, index) => (
                                                                        <Dropdown.Item
                                                                            key={index}
                                                                            onClick={() => handleFontWeightChange(weight.value)}
                                                                            className={fontWeight == weight.value ? 'active' : ''}
                                                                        >
                                                                            {weight.name}
                                                                        </Dropdown.Item>
                                                                    ))}
                                                                </Dropdown.Menu>
                                                            </StyledDropdown>
                                                        </div>
                                                    </div>
                                                </div>
                                            </FontStyleContainer>
                                        </div> */}

                                        {/* Custom Fonts from Backend */}
                                        <CustomFontAccordion
                                            fontFamily={fontFamily}
                                            activeFont={activeObjectProps?.font}
                                            onVariantSelect={handleCustomVariantSelect}
                                            isTextSelected={activeObjectProps?.type === 'text'}
                                            fontSize={fontSize}
                                            onFontSizeChange={handleFontSizeChange}
                                            canvasSize={canvasSize}
                                        />

                                        {/* Position Section */}
                                        <PositionSettingsPanel />

                                        {/* alignment section */}
                                        <SettingSection>
                                            <SectionHeader onClick={() => toggleSection('alignment')}>
                                                <div className="d-flex align-items-center">
                                                    <TbBoxAlignLeftFilled className="me-2" />
                                                    Alignment
                                                </div>
                                                {expandedSection === 'alignment' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                                            </SectionHeader>
                                            <SectionContent className={expandedSection === 'alignment' ? 'expanded' : ''}>
                                                {/* Text Alignment Controls */}
                                                <div className="mb-3">
                                                    <AlignmentContainer>
                                                        {/* Horizontal Alignment */}
                                                        <div className="">
                                                            <div className="alignment-label">
                                                                {/* <TbBoxAlignLeftFilled size={14} /> */}
                                                                Horizontal Alignment
                                                            </div>
                                                            <div className="alignment-buttons">
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.horizontal === 'left' ? 'active' : ''}`}
                                                                    onClick={() => handleHorizontalAlign('left')}
                                                                    title="Align Left"
                                                                >
                                                                    <LeftAlignIcon />
                                                                </div>
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.horizontal === 'center' ? 'active' : ''}`}
                                                                    onClick={() => handleHorizontalAlign('center')}
                                                                    title="Align Center"
                                                                >
                                                                    <CenterAlignIcon />
                                                                </div>
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.horizontal === 'right' ? 'active' : ''}`}
                                                                    onClick={() => handleHorizontalAlign('right')}
                                                                    title="Align Right"
                                                                >
                                                                    <RightAlignIcon />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Vertical Alignment */}
                                                        <div className="mt-4">
                                                            <div className="alignment-label">
                                                                {/* <TbBoxAlignLeftFilled size={14} style={{ transform: 'rotate(90deg)' }} /> */}
                                                                Vertical Alignment
                                                            </div>
                                                            <div className="alignment-buttons">
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.vertical === 'top' ? 'active' : ''}`}
                                                                    onClick={() => handleVerticalAlign('top')}
                                                                    title="Align Top"
                                                                >
                                                                    <TopAlignIcon />
                                                                </div>
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.vertical === 'middle' ? 'active' : ''}`}
                                                                    onClick={() => handleVerticalAlign('middle')}
                                                                    title="Align Middle"
                                                                >
                                                                    <MiddleAlignIcon />
                                                                </div>
                                                                <div
                                                                    className={`align-btn ${activeObjectProps?.alignment?.vertical === 'bottom' ? 'active' : ''}`}
                                                                    onClick={() => handleVerticalAlign('bottom')}
                                                                    title="Align Bottom"
                                                                >
                                                                    <BottomAlignIcon />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AlignmentContainer>
                                                </div>
                                            </SectionContent>


                                        </SettingSection>

                                        {/* Colors Section */}
                                        <SettingSection>
                                            <SectionHeader onClick={() => toggleSection('colors')}>
                                                <div className="d-flex align-items-center">
                                                    <TbPalette className="me-2" />
                                                    <span>Colors</span>
                                                </div>
                                                {expandedSection === 'colors' ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                                            </SectionHeader>
                                            <SectionContent className={expandedSection === 'colors' ? 'expanded' : ''}>
                                                <SliderContainer>
                                                    {/* Text Color */}
                                                    <div className="mb-4">
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <small className="text-muted fw-medium">Text Color</small>
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
                                                                onClick={() => handleColorPickerOpen('text')}
                                                                title="Click to choose text color"
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
                                                                        backgroundColor: activeObjectProps?.color || '#000000',
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
                                                    </div>

                                                    {/* Background Color */}
                                                    <div className="mb-3">
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <small className="text-muted fw-medium">Background Color</small>
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
                                                                onClick={() => handleColorPickerOpen('background')}
                                                                title="Click to choose background color"
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
                                                                        backgroundColor: activeObjectProps?.bgcolor || 'transparent',
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
                                                    </div>
                                                </SliderContainer>
                                            </SectionContent>
                                        </SettingSection>

                                        {/* Smart Text Groups */}
                                        <SettingSection>
                                            <SectionContent>
                                                <TextGroupPanel />
                                            </SectionContent>
                                        </SettingSection>
                                    </>
                                )}
                        </div>
                    </Wrapper>
                </div>
            </div>

            {/* Color Picker Modal - Outside DesktopWrapper for mobile access */}
            <ColorPickerModal
                isOpen={showColorPicker}
                onClose={handleColorPickerClose}
                color={tempColor}
                onChange={handleColorChange}
                onConfirm={handleColorConfirm}
                title={colorPickerType === 'text' ? 'Choose Text Color' : 'Choose Background Color'}
                showPreview={true}
                showActions={true}
            />
        </>
    );
}

export default TextSettingPanel;