import {
  ActionInnerTitle,
  ActionTitle,
  BackgroundColorItem,
  BackgroundColorItemSmall,
  Box,
  ButtonComponent,
  CollapseButton,
  DisplayBetween,
  DisplayCenter,
  DisplayStart,
  FlexBox,
  HighLightTex,
  MaskItem,
  StyledCollapse,
  TextAlignButton,
  TextSelect,
  ThemeTitle,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import {
  setIsActionActive,
  openMagicWrite,
  setShowMagicWrite,
} from "../../store/slices/appAlice";
import { IoClose } from "react-icons/io5";
import { FaPlus } from "react-icons/fa";
import { FaMinus, FaMagic } from "react-icons/fa";
import { ReactComponent as LeftAlignIcon } from "../../assets/icons/left_align_icon.svg";
import { ReactComponent as RightAlignIcon } from "../../assets/icons/right_align_icon.svg";
import { ReactComponent as CenterAlignIcon } from "../../assets/icons/center_align_icon.svg";
import { ReactComponent as TopAlignIcon } from "../../assets/icons/text_valign_top.svg";
import { ReactComponent as BottomAlignIcon } from "../../assets/icons/text_valign_bottom.svg";
import { ReactComponent as MiddleAlignIcon } from "../../assets/icons/text_valign_center.svg";

import { ReactComponent as JustifyAlignIcon } from "../../assets/icons/justify_align_icon.svg";
import {
  Fontfamilies,
  fontSizes,
  TempBackgroudColors,
  TempThemes,
} from "../../library/utils/jsons/commonJSON";
import { useEffect, useState, useRef, useCallback } from "react";
import { ReactComponent as BirthdayIcon } from "../../assets/icons/birthday_icon.svg";
import { ReactComponent as WeddingIcon } from "../../assets/icons/wedding_icon.svg";
import { ReactComponent as TravelIcon } from "../../assets/icons/travel_icon.svg";
import { ReactComponent as GraduationIcon } from "../../assets/icons/graduation_icon.svg";
import { ReactComponent as ChristmasIcon } from "../../assets/icons/christmas_icon.svg";
import { v4 as uuidv4 } from "uuid";
import {
  getActiveEditorType,
  getCanvasSize,
  getActiveObjectprops,
  getCurrentActivePage,
  getCurrentActiveSize,
  getSettings,
} from "../../library/utils/helpers";
import {
  addObjectInPage,
  setCurrentObjectProperties,
  addTextGradientToHistory,
  addTextSolidColorToHistory,
  addToGlobalGradientHistory,
  addToGlobalSolidColorHistory,
} from "../../store/slices/canvas";
import {
  getTextGradientHistory,
  getTextSolidColorHistory,
  getGlobalGradientHistory,
  getGlobalSolidColorHistory,
} from "../../library/utils/helpers/canvasSliceGetters";
import { SketchPicker } from "react-color";
import ColorPickerWithOpacity from "../../components/popups/ColorPickerWithOpacity";
import { CaptionsAI } from "./CaptionByAI";
import { USER_TYPES } from "../../library/utils/constants";
import styled from "styled-components";
import PositionSettingsPanel from "../object-settings/position/PositionSettingsPanel";
import TextGroupPanel from "./TextGroupPanel";
import { getUserDetails } from "../../library/utils/services/theme";
import { BiFontFamily } from "react-icons/bi";
import FontManagementDialog from "../../components/popups/FontManagementDialog";
import { useFontContext } from "../../library/utils/context/FontContext";
import CustomFontAccordion from "./CustomFontAccordion";


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
    &::-webkit-scrollbar {
      display: none;
    }

    & > * {
      flex-shrink: 0;
    }
  }
`;

const PanelTab = styled.button`
  flex: 0 0 auto;
  padding: 8px 16px;
  border: 1px solid ${props => props.$active ? 'var(--primary)' : '#dee2e6'};
  border-radius: 20px;
  background: ${props => props.$active ? 'var(--primary)' : '#fff'};
  color: ${props => props.$active ? '#fff' : '#495057'};
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
`;

// Bottom Sheet Components to match Image/Sticker panels
const MobilePanelContent = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: ${props => props.$show ? 'block' : 'none'};
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    z-index: 10001;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -5px 20px rgba(0,0,0,0.1);
    animation: slideUp 0.3s ease-out;
    padding-bottom: env(safe-area-inset-bottom);
    overscroll-behavior: contain;
    max-height: 70vh;

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  }
`;

const MobilePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;

  h6 { margin: 0; font-size: 14px; font-weight: 600; }
  .close-btn {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    background: #f0f0f0; border-radius: 50%; cursor: pointer;
  }
`;

const MobilePanelBody = styled.div`
  padding: 16px;
  min-height: 200px;
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
`;

const MobileOverlay = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: ${props => props.$show ? 'block' : 'none'};
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.3);
    z-index: 10000;
  }
`;

// Spacing Controls Styled Components
const SpacingSliderContainer = styled.div`
  margin-bottom: 16px;
  margin-top: 10px;
`;

const SpacingSliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #495057;
  font-weight: 500;
`;

const SpacingSliderInput = styled.input`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e9ecef;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--primary, #7D2AE8);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: var(--primary, #7D2AE8);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
`;

const SpacingValueInput = styled.input`
  width: 55px;
  padding: 4px 8px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  
  &:focus {
    outline: none;
    border-color: var(--primary, #7D2AE8);
  }
`;

export const TextAction = () => {
  const [openSection, setOpenSection] = useState(null);
  const dispatch = useDispatch();
  const currentPage = useSelector(getCurrentActiveSize);
  const canvasSize = useSelector(getCanvasSize);
  const activeObjectProps = useSelector(getActiveObjectprops);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(35);
  const [fwList, setFwList] = useState([]);
  const [fontStyle, setFontStyle] = useState("400");
  const baseReferenceWidth = 500;
  const [textId, setTextId] = useState("");
  const userChangedFontFamilyRef = useRef(false);
  const [applyToAll, setApplyToAll] = useState(false);
  let fStyle = "";
  const isLegacyText =
    activeObjectProps?.type === "text" &&
    (!activeObjectProps?.editorVersion || activeObjectProps?.editorVersion < 2);

  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [displayBGColorPicker, setDisplayBGColorPicker] = useState(false);

  const textGradientHistory = useSelector(getTextGradientHistory);
  const textSolidColorHistory = useSelector(getTextSolidColorHistory);
  const globalGradientHistory = useSelector(getGlobalGradientHistory);
  const globalSolidColorHistory = useSelector(getGlobalSolidColorHistory);

  const lastTextColorRef = useRef(null);
  const lastTextGradientRef = useRef(null);
  const lastTextBGColorRef = useRef(null);
  const lastTextBGGradientRef = useRef(null);

  const [mobileActivePanel, setMobileActivePanel] = useState(null);

  const user = getUserDetails();
  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false);

  // Custom fonts from backend — only resolveFont needed for activeObject sync
  const { resolveFont, isFontLoaded, loadFont } = useFontContext();
  const isCustomFontRef = useRef(false); // Track if current font is from backend (not static Fontfamilies)

  // Callback for CustomFontAccordion when a variant is selected
  const handleCustomVariantSelect = useCallback((font, styleEntry) => {
    const weight = styleEntry.weight;
    const style = styleEntry.style || "normal";

    // Mark as custom font BEFORE setting fontFamily so the useEffect skips static lookup
    isCustomFontRef.current = true;
    userChangedFontFamilyRef.current = true;
    setFontFamily(font.name);
    setFontStyle(String(weight));

    // Build weight list from backend styles for the font weight dropdown
    const newFwList = font.styles.map((s) => ({
      name: s.label,
      value: s.weight,
    }));
    setFwList(newFwList);

    // Apply font to the active text object with fontId and styleId
    dispatch(
      setCurrentObjectProperties({
        font: {
          ...activeObjectProps.font,
          family: font.name,
          id: font.fontId,
          styleId: styleEntry.styleId,
          weight: String(weight),
          style: style,
          label: styleEntry.label,
          // Clear synthetic styles since the user made an explicit variant choice
          isSyntheticBold: false,
          baseWeight: undefined,
          isSyntheticItalic: false,
          baseStyle: undefined,
        },
        applyToAll: applyToAll,
      })
    );
  }, [activeObjectProps, applyToAll, dispatch]);

  const mobilePanels = [
    { id: "position", label: "Position" },
    { id: "font", label: "Font" },
    { id: "spacing", label: "Spacing" },
    { id: "alignment", label: "Alignment" },
    // { id: "color", label: "Colors" },
    ...(user?.userTypeCode !== USER_TYPES.CUSTOMER ? [{ id: "linked", label: "Linked" }] : []),
  ];

  const closeMobilePanel = () => {
    setMobileActivePanel(null);
  };

  // const usersDetails = localStorage.getItem("userDetails");
  // const user = JSON.parse(usersDetails);
  const settings = useSelector(getSettings);
  const isSuperAdmin = user?.userTypeCode === USER_TYPES.SUPERUSER;

  useEffect(() => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "text"
    ) {
      if (textId === activeObjectProps.id) {
        return;
      }
      setTextId(activeObjectProps.id);
      userChangedFontFamilyRef.current = false; // Sync, not user action

      // If this text object uses a custom font (has font.id), resolve fwList from backend
      if (activeObjectProps.font?.id) {
        const resolved = resolveFont(activeObjectProps.font.id, activeObjectProps.font.family);
        if (resolved && resolved.styles) {
          const newFwList = resolved.styles.map((s) => ({
            name: s.label,
            value: s.weight,
          }));
          setFwList(newFwList);
          isCustomFontRef.current = true; // Prevent fontFamily useEffect from overwriting fwList
        }
      }

      setFontFamily(activeObjectProps.font.family);
      setFontSize(activeObjectProps.font.size);
      setFontStyle(activeObjectProps.font.weight);
    }
  }, [activeObjectProps, resolveFont]);

  useEffect(() => {
    // Skip static Fontfamilies lookup for custom fonts — fwList is already set by handleCustomVariantSelect
    if (isCustomFontRef.current) {
      isCustomFontRef.current = false;
      return;
    }

    let newREc = Fontfamilies.find((x) => x.name === fontFamily);

    if (newREc === undefined) {
      return;
    }
    setFwList(newREc.fw);

    // Only normalize weight when user explicitly changed the font family
  if (userChangedFontFamilyRef.current) {
    let fStyle = newREc.fw[0].value;
    if (
      activeObjectProps &&
      activeObjectProps.font &&
      activeObjectProps.font.weight
    ) {
      const currentWeight = activeObjectProps.font.weight;
      // Check if current weight is supported by this font
      const isWeightSupported = newREc.fw.some(
        (fw) => String(fw.value) === String(currentWeight)
      );
      
      if (isWeightSupported) {
        fStyle = currentWeight;
      }
      // If not supported, use first available weight (already set above)
    }
    setFontWeight("" + fStyle);
    userChangedFontFamilyRef.current = false;
  }
  }, [fontFamily]);

  useEffect(() => {
    if (!activeObjectProps) {
      return;
    }
    // Only normalize font weight when fwList changes due to user action, not selection sync
    if (
      userChangedFontFamilyRef.current &&
      fwList &&
      fwList.length > 0 &&
      activeObjectProps.font
    ) {
      const currentWeight = activeObjectProps.font.weight;
      
      // If no weight set, use first available
      if (!currentWeight || currentWeight === "") {
        setFontWeight("" + fwList[0].value);
      } else {
        // Check if current weight is in the available list
        const isWeightSupported = fwList.some(
          (fw) => String(fw.value) === String(currentWeight)
        );
        
        // If weight not supported, normalize to first available weight
        if (!isWeightSupported) {
          setFontWeight("" + fwList[0].value);
        }
      }
    }
  }, [fwList]);

  const handleToggle = (section) => {
    setOpenSection(openSection === section ? null : section);
  };
  const calculateFontSize = (baseSize, referenceWidth = baseReferenceWidth) => {
    const scalingFactor = canvasSize.width / referenceWidth;
    return Math.round(baseSize * scalingFactor);
  };

  const settextFontSize = (e) => {
    if (!isTextObjectSelected()) return;

    const baseSize = Number(e.target.value);
    const scaledSize = calculateFontSize(baseSize);

    const dynLineHeight = activeObjectProps.spacing?.lineHeight ?? 1.2;
    const dynLetterSpacing = activeObjectProps.spacing?.letterSpacing ?? 0;

    // Measure wrapped text for height
    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ${activeObjectProps.font.family};
      font-size: ${scaledSize}px;
      font-weight: ${activeObjectProps.font.weight};
      font-style: ${activeObjectProps.font.style || "normal"};
      line-height: ${dynLineHeight};
      letter-spacing: ${dynLetterSpacing ? `${dynLetterSpacing / 1000}em` : "normal"};
      width: ${activeObjectProps.width}px;
    `;
    measureDiv.textContent = activeObjectProps.text || "";
    document.body.appendChild(measureDiv);
    const measuredHeight = measureDiv.offsetHeight + 10;
    document.body.removeChild(measureDiv);

    // Measure longest line without wrapping for width
    const widthMeasure = document.createElement("div");
    widthMeasure.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: nowrap;
      font-family: ${activeObjectProps.font.family};
      font-size: ${scaledSize}px;
      font-weight: ${activeObjectProps.font.weight};
      font-style: ${activeObjectProps.font.style || "normal"};
      line-height: ${dynLineHeight};
    `;
    const lines = (activeObjectProps.text || "").split("\n");
    let measuredWidth = 0;
    lines.forEach((line) => {
      widthMeasure.textContent = line || " ";
      document.body.appendChild(widthMeasure);
      measuredWidth = Math.max(measuredWidth, widthMeasure.offsetWidth);
      document.body.removeChild(widthMeasure);
    });
    measuredWidth = Math.ceil(measuredWidth) + 10; // padding

    const payload = {
      font: {
        ...activeObjectProps.font,
        size: scaledSize,
      },
      applyToAll,
    };

    const minHeight = Math.ceil(scaledSize * dynLineHeight) + 10;
    const newHeight = Math.max(measuredHeight, minHeight);
    payload.height = newHeight;

    if (measuredWidth > 0 && measuredWidth < activeObjectProps.width) {
      payload.width = measuredWidth;
    }

    dispatch(setCurrentObjectProperties(payload));
  };
  // Wrapper for CustomFontAccordion font size change (receives plain number)
  const handleFontSizeFromAccordion = useCallback((size) => {
    settextFontSize({ target: { value: size } });
  }, [settextFontSize]);

  const setAlign = (value) => {
    if (isTextObjectSelected()) {
      dispatch(
        setCurrentObjectProperties({
          alignment: {
            ...activeObjectProps.alignment,
            horizontal: value,
          },
          applyToAll: applyToAll,
        })
      );
    }
  };
  const isTextObjectSelected = () => {
    return (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "text"
    );
  };
  const isCalendarTextObjectSelected = () => {
    return (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "text" &&
      (activeObjectProps.subtype === "year" ||
        activeObjectProps.subtype === "month")
    );
  };
  const setVAlign = (value) => {
    if (isTextObjectSelected()) {
      dispatch(
        setCurrentObjectProperties({
          alignment: {
            ...activeObjectProps.alignment,
            vertical: value,
          },
          applyToAll: applyToAll,
        })
      );
    }
  };

  // Spacing control handlers
  const setLetterSpacing = (value) => {
    if (!isTextObjectSelected()) return;
    const numValue = parseFloat(value) || 0;
    dispatch(
      setCurrentObjectProperties({
        spacing: {
          ...(activeObjectProps.spacing || {}),
          letterSpacing: Math.max(-200, Math.min(800, numValue)),
        },
        applyToAll: applyToAll,
      })
    );
  };

  const setLineHeight = (value) => {
    if (!isTextObjectSelected()) return;
    const numValue = parseFloat(value) || 1.2;
    dispatch(
      setCurrentObjectProperties({
        spacing: {
          ...(activeObjectProps.spacing || {}),
          lineHeight: Math.max(0.5, Math.min(2.5, numValue)),
        },
        applyToAll: applyToAll,
      })
    );
  };

  const setColor = (value) => {
    if (isTextObjectSelected()) {
      lastTextColorRef.current = value;
      lastTextGradientRef.current = null;
      dispatch(
        setCurrentObjectProperties({ color: value, gradient: null, applyToAll: applyToAll })
      );
    }
  };

  const setTextGradient = useCallback(
    (gradientData) => {
      if (!isTextObjectSelected()) return;
      lastTextGradientRef.current = gradientData;
      lastTextColorRef.current = null;
      dispatch(
        setCurrentObjectProperties({
          gradient: {
            type: gradientData.type,
            angle: gradientData.angle,
            stops: gradientData.stops,
            ...(gradientData.radialPosition && { radialPosition: gradientData.radialPosition }),
          },
          color: gradientData.stops?.[0]?.color?.slice(0, 9) || activeObjectProps?.color || "#000000",
          applyToAll,
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, applyToAll, activeObjectProps?.color]
  );

  const handleColorChange = (color) => {
    setColor(color.hex);
  };

  const handleColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "text"
    ) {
      setDisplayColorPicker(!displayColorPicker);
    }
  };

  const handleColorPickerClose = useCallback(() => {
    setDisplayColorPicker(false);
    if (lastTextGradientRef.current) {
      dispatch(addTextGradientToHistory(lastTextGradientRef.current));
      dispatch(addToGlobalGradientHistory(lastTextGradientRef.current));
      lastTextGradientRef.current = null;
    } else if (lastTextColorRef.current) {
      dispatch(addTextSolidColorToHistory({ color: lastTextColorRef.current }));
      dispatch(addToGlobalSolidColorHistory({ color: lastTextColorRef.current }));
      lastTextColorRef.current = null;
    }
  }, [dispatch]);

  const setTextBGGradient = useCallback(
    (gradientData) => {
      if (!isTextObjectSelected()) return;
      lastTextBGGradientRef.current = gradientData;
      lastTextBGColorRef.current = null;
      dispatch(
        setCurrentObjectProperties({
          bgGradient: {
            type: gradientData.type,
            angle: gradientData.angle,
            stops: gradientData.stops,
            ...(gradientData.radialPosition && { radialPosition: gradientData.radialPosition }),
          },
          bgcolor: gradientData.stops?.[0]?.color?.slice(0, 9) || activeObjectProps?.bgcolor || "#000000",
          applyToAll,
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, applyToAll, activeObjectProps?.bgcolor]
  );

  // bacground color picker
  const setBGColor = (value) => {
    if (isTextObjectSelected()) {
      lastTextBGColorRef.current = value;
      lastTextBGGradientRef.current = null;
      dispatch(
        setCurrentObjectProperties({ bgcolor: value, bgGradient: null, applyToAll: applyToAll })
      );
    }
  };

  const handleBGColorChange = (color) => {
    setBGColor(color.hex);
  };

  const handleBGColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "text"
    ) {
      setDisplayBGColorPicker(!displayBGColorPicker);
    }
  };

  const handleBGColorPickerClose = () => {
    setDisplayBGColorPicker(false);
    if (lastTextBGGradientRef.current) {
      dispatch(addTextGradientToHistory(lastTextBGGradientRef.current));
      dispatch(addToGlobalGradientHistory(lastTextBGGradientRef.current));
      lastTextBGGradientRef.current = null;
    } else if (lastTextBGColorRef.current) {
      dispatch(addTextSolidColorToHistory({ color: lastTextBGColorRef.current }));
      dispatch(addToGlobalSolidColorHistory({ color: lastTextBGColorRef.current }));
      lastTextBGColorRef.current = null;
    }
  };

  const setFFamily = (value) => {
    if (!isTextObjectSelected()) {
      return;
    }
    userChangedFontFamilyRef.current = true; // User explicitly changed font
    isCustomFontRef.current = false; // Switching to static font
    setFontFamily(value);
    const { id: _removedId, ...fontWithoutId } = activeObjectProps.font || {};
    dispatch(
      setCurrentObjectProperties({
        font: {
          ...fontWithoutId,
          family: value,
          // Clear synthetic styles since the user made an explicit family choice
          isSyntheticBold: false,
          baseWeight: undefined,
          isSyntheticItalic: false,
          baseStyle: undefined,
        },
        applyToAll: applyToAll,
      })
    );
  };
  const setFontWeight = async (value) => {
    if (!isTextObjectSelected()) {
      return;
    }
    let weight = value;
    if (fStyle && fStyle !== "") {
      weight = fStyle;
      fStyle = "";
    }

    setFontStyle(weight);

    // If this is a custom font, load the new weight via FontFace API
    const fontId = activeObjectProps?.font?.id;
    let newStyleId = activeObjectProps?.font?.styleId;
    if (fontId) {
      const fontStyle = activeObjectProps?.font?.style || "normal";
      if (!isFontLoaded(activeObjectProps.font.family, weight, fontStyle)) {
        await loadFont(fontId, parseInt(weight, 10) || 400, fontStyle);
      }
      // Resolve the correct styleId for the new weight
      const resolved = resolveFont(fontId, activeObjectProps?.font?.family);
      if (resolved?.styles) {
        const w = parseInt(weight, 10) || 400;
        const matched = resolved.styles.find((s) => s.weight === w && s.style === fontStyle)
          || resolved.styles.find((s) => s.weight === w);
        if (matched?.styleId) newStyleId = matched.styleId;
      }
    }

    dispatch(
      setCurrentObjectProperties({
        font: {
          ...activeObjectProps.font,
          weight: weight,
          styleId: newStyleId,
          // Clear synthetic styles when explicitly choosing a weight from the dropdown
          isSyntheticBold: false,
          baseWeight: undefined,
          isSyntheticItalic: false,
          baseStyle: undefined,
        },
        applyToAll: applyToAll,
      })
    );
  };
  const onCaptionClick = (captions) => {
    const obj = {};
    obj.type = "text";
    obj.x = 10;
    obj.y = 50;
    obj.text = captions;

    obj.width = 300;
    obj.height = 60;
    dispatch(setCurrentObjectProperties(null));
    dispatch(addObjectInPage(obj));
  };
  const addTextinCanvas = () => {
    const obj = {};
    obj.type = "text";
    obj.x = 10;
    obj.y = 50;

    obj.width = 300;
    obj.height = 60;
    dispatch(setCurrentObjectProperties(null));
    dispatch(addObjectInPage(obj));
  };
  const handleApplyAll = (e) => {
    setApplyToAll(e.target.checked);
  };

  const renderMobilePanelContent = () => {
    switch (mobileActivePanel) {
      case "position":
        return <PositionSettingsPanel />;
      case "font":
        return (
          <>
            {isCalendarTextObjectSelected() && (
              <Box mt="15px">
                <FlexBox mt="15px" gap="6px">
                  <label htmlFor="applytoAllextMobile">
                    <input
                      type="checkbox"
                      id="applytoAllextMobile"
                      name="applytoAllext"
                      checked={applyToAll}
                      onChange={handleApplyAll}
                    />
                    <span
                      style={{ marginLeft: "10px" }}
                      title="This will set  all similar type text with selected settings"
                    >
                      Apply to All
                    </span>
                  </label>
                </FlexBox>
              </Box>
            )}
            {/* <Box mt="15px">
              <ActionInnerTitle fontweight="500">Font Styles</ActionInnerTitle>
              <Box mt="10px">
                <TextSelect
                  value={fontFamily}
                  onChange={(e) => setFFamily(e.target.value)}
                >
                  {Fontfamilies.map((x) => (
                    <option style={{ fontFamily: x.value }} value={x.value}>
                      {x.name}
                    </option>
                  ))}
                </TextSelect>
              </Box>
              <DisplayBetween mt="10px">
                <Box>
                  <TextSelect
                    value={
                      Math.round(
                        activeObjectProps?.font?.size /
                        (canvasSize.width / baseReferenceWidth)
                      ) || "36"
                    }
                    width="75px"
                    onChange={(e) => settextFontSize(e)}
                  >
                    {fontSizes.map((x) => (
                      <option value={x}>{x}</option>
                    ))}
                  </TextSelect>
                </Box>
                <Box>
                  <TextSelect
                    value={fontStyle}
                    width="90px"
                    onChange={(e) => setFontWeight(e.target.value)}
                  >
                    {fwList.map((x) => (
                      <option value={x.value}>{x.name}</option>
                    ))}
                  </TextSelect>
                </Box>
              </DisplayBetween>
            </Box> */}

            {/* Custom Fonts from Backend — Accordion Style (Mobile) */}
            <CustomFontAccordion
              fontFamily={fontFamily}
              activeFont={activeObjectProps?.font}
              onVariantSelect={handleCustomVariantSelect}
              isTextSelected={isTextObjectSelected()}
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeFromAccordion}
              canvasSize={canvasSize}
            />
          </>
        );
      case "spacing":
        return (
          <>
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">Spacing</ActionInnerTitle>
              
              {/* Letter Spacing - Mobile */}
              <SpacingSliderContainer>
                <SpacingSliderLabel>
                  <span>Letter Spacing</span>
                  <SpacingValueInput
                    type="number"
                    value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                    onChange={(e) => setLetterSpacing(e.target.value)}
                    min={-200}
                    max={800}
                    step={1}
                  />
                </SpacingSliderLabel>
                <SpacingSliderInput
                  type="range"
                  min={-200}
                  max={800}
                  step={1}
                  value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                  onChange={(e) => setLetterSpacing(e.target.value)}
                />
              </SpacingSliderContainer>

              {/* Line Height - Mobile */}
              <SpacingSliderContainer>
                <SpacingSliderLabel>
                  <span>Line Height</span>
                  <SpacingValueInput
                    type="number"
                    value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                    onChange={(e) => setLineHeight(e.target.value)}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                  />
                </SpacingSliderLabel>
                <SpacingSliderInput
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                  onChange={(e) => setLineHeight(e.target.value)}
                />
              </SpacingSliderContainer>
            </Box>
          </>
        );
      case "alignment":
        return (
          <>
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">
                Horizontal Alignment
              </ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onClick={() => setAlign("left")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "left"
                      ? "active"
                    : ""
                  }
                >
                  <LeftAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setAlign("center")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "center"
                      ? "active"
                    : ""
                  }
                >
                  <CenterAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setAlign("right")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "right"
                      ? "active"
                    : ""
                  }
                >
                  <RightAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setAlign("justify")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "justify"
                      ? "active"
                    : ""
                  }
                >
                  <JustifyAlignIcon />
                </TextAlignButton>
              </FlexBox>
            </Box>

            <Box mt="15px">
              <ActionInnerTitle fontweight="500">
                Vertical Alignment
              </ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onClick={() => setVAlign("top")}
                  className={
                    activeObjectProps?.alignment.vertical === "top"
                      ? "active"
                    : ""
                  }
                >
                  <TopAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setVAlign("middle")}
                  className={
                    activeObjectProps?.alignment.vertical === "middle"
                      ? "active"
                    : ""
                  }
                >
                  <MiddleAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setVAlign("bottom")}
                  className={
                    activeObjectProps?.alignment.vertical === "bottom"
                      ? "active"
                    : ""
                  }
                >
                  <BottomAlignIcon />
                </TextAlignButton>
              </FlexBox>
            </Box>
          </>
        );
      // case "color":
      //   return (
      //     <>
      //       <Box mt="15px">
      //         <ActionInnerTitle fontweight="500">Text Color</ActionInnerTitle>
      //         <FlexBox mt="15px" gap="6px" wrap="nowrap">
      //           <BackgroundColorItemSmall
      //             onClick={handleColorPickerClick}
      //             bgimage="/images/background/bg_first_item_plus.webp"
      //           />
      //           <BackgroundColorItemSmall
      //             onClick={() => setColor("#000000")}
      //             key={`bgcolor-blank`}
      //             bgimage="/images/background/remove_bg_color.png"
      //           />

      //           {displayColorPicker ? (
      //             <div
      //               style={{
      //                 position: "absolute",
      //                 zIndex: "2",
      //                 bottom: window.innerWidth < 768 ? "0px" : "40px",
      //               }}
      //             >
      //               <div
      //                 style={{
      //                   position: "fixed",
      //                   top: 0,
      //                   right: 0,
      //                   bottom: 0,
      //                   left: 0,
      //                 }}
      //                 onClick={handleColorPickerClose}
      //               />
      //               <ColorPickerWithOpacity
      //                 color={
      //                     activeObjectProps?.color
      //                     ? activeObjectProps?.color
      //                   : "#000000"
      //                 }
      //                 onChange={(hexColor) => {
      //                   setColor(hexColor);
      //                 }}
      //               />
      //             </div>
      //           ) : null}

      //           {TempBackgroudColors.map((item, index) => (
      //             <BackgroundColorItemSmall
      //               onClick={() => setColor(item.bgcolor)}
      //               key={`bgcolor-${index}`}
      //               bgcolor={item.bgcolor}
      //             />
      //           ))}
      //         </FlexBox>
      //       </Box>

      //       <Box mt="15px">
      //         <ActionInnerTitle fontweight="500">
      //           Background Color
      //         </ActionInnerTitle>
      //         <FlexBox mt="15px" gap="6px" wrap="nowrap">
      //           <BackgroundColorItemSmall
      //             onClick={handleBGColorPickerClick}
      //             bgimage="/images/background/bg_first_item_plus.webp"
      //           />
      //           <BackgroundColorItemSmall
      //             onClick={() => setBGColor("transparent")}
      //             key={`bgcolor-blank`}
      //             bgimage="/images/background/remove_bg_color.png"
      //           />

      //           {displayBGColorPicker ? (
      //             <div
      //               style={{
      //                 position: "absolute",
      //                 zIndex: "2",
      //                 bottom: window.innerWidth < 768 ? "0px" : "40px",
      //               }}
      //             >
      //               <div
      //                 style={{
      //                   position: "fixed",
      //                   top: "0px",
      //                   right: "0px",
      //                   bottom: "0px",
      //                   left: "0px",
      //                 }}
      //                 onClick={handleBGColorPickerClose}
      //               />
      //               <ColorPickerWithOpacity
      //                 color={
      //                     activeObjectProps?.bgcolor
      //                     ? activeObjectProps?.bgcolor
      //                   : "#000000"
      //                 }
      //                 onChange={(hexColor) => {
      //                   setBGColor(hexColor);
      //                 }}
      //               />
      //             </div>
      //           ) : null}

      //           {TempBackgroudColors.map((item, index) => (
      //             <BackgroundColorItemSmall
      //               onClick={() => setBGColor(item.bgcolor)}
      //               key={`bgcolor-${index}`}
      //               bgcolor={item.bgcolor}
      //             />
      //           ))}
      //         </FlexBox>
      //       </Box>
      //     </>
      //   );
      
      case "linked":
        return <TextGroupPanel />;
      default:
        return null;
    }
  };

  // return if active object type is not text
  if (!isTextObjectSelected()) {
    return (
      <>
        <div className="sticker-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '2px' }}>
          <DisplayBetween className="heading-action-mob" style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
            <ActionTitle>Text</ActionTitle>
            <LiaTimesSolid
              onClick={() => dispatch(setIsActionActive(false))}
              className="cursor-pointer"
            />
          </DisplayBetween>

          <div className="scroll-container-mob" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingBottom: '20px' }}>
            <Box mt="10px">
              {((settings.allowText &&
                user?.userTypeCode === USER_TYPES.CUSTOMER) ||
                user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
                <ButtonComponent
                  onClick={() => addTextinCanvas()}
                  color="#232323"
                  rounded="7px"
                >
                  <DisplayCenter>
                    <FaPlus width="17px" height="17px" />
                    <Box ml="10px">Add Text</Box>
                  </DisplayCenter>
                </ButtonComponent>
              )}
            </Box>
          
            <Box mt="8px">
              {((settings.allowText &&
                user?.userTypeCode === USER_TYPES.CUSTOMER) ||
                user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
                <ButtonComponent
                  onClick={() => dispatch(openMagicWrite("create"))}
                  color="#7D2AE8"
                  rounded="7px"
                >
                  <DisplayCenter>
                    <FaMagic width="17px" height="17px" />
                    <Box ml="10px">Smart Caption</Box>
                  </DisplayCenter>
                </ButtonComponent>
              )}
            </Box>
            {/* {((settings.allowText &&
              user?.userTypeCode === USER_TYPES.CUSTOMER) ||
              user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
              <Box className="">
                <CaptionsAI onCaptionClick={onCaptionClick} />
              </Box>
            )} */}

            {isSuperAdmin && (
              <Box mt="8px">
                <ButtonComponent
                  onClick={() => setIsFontDialogOpen(true)}
                  color="#495057"
                  rounded="7px"
                >
                  <DisplayCenter>
                    <BiFontFamily width="17px" height="17px" />
                    <Box ml="10px">Font Management</Box>
                  </DisplayCenter>
                </ButtonComponent>
              </Box>
            )}
          </div>
        </div>

        {/* Font Management Dialog */}
        {isFontDialogOpen && (
          <FontManagementDialog
            isOpen={isFontDialogOpen}
            onClose={() => setIsFontDialogOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* ===== MOBILE VIEW: Heading + Tabs + Bottom Sheet ===== */}
      <div className="d-md-none w-100">
        <DisplayBetween
          className="heading-action-mob d-flex justify-content-between w-100"
          style={{
            padding: '10px 12px',
            background: '#fff',
            flexShrink: 0,
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <ActionTitle>Text</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            style={{ cursor: 'pointer' }}
          />
        </DisplayBetween>

        <Box mt="10px" px="8px">
          {((settings.allowText &&
            user?.userTypeCode === USER_TYPES.CUSTOMER) ||
            user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
            <ButtonComponent
              onClick={() => addTextinCanvas()}
              color="#232323"
              rounded="7px"
            >
              <DisplayCenter>
                <FaPlus width="17px" height="17px" />
                <Box ml="10px">Add Text</Box>
              </DisplayCenter>
            </ButtonComponent>
          )}
        </Box>

        <Box mt="10px" px="8px">
          {((settings.allowText &&
            user?.userTypeCode === USER_TYPES.CUSTOMER) ||
            user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
            <ButtonComponent
              onClick={() => dispatch(openMagicWrite("create"))}
              color="#7D2AE8"
              rounded="7px"
            >
              <DisplayCenter>
                <FaMagic width="17px" height="17px" />
                <Box ml="10px">Smart Caption</Box>
              </DisplayCenter>
            </ButtonComponent>
          )}
        </Box>

        {isSuperAdmin && (
          <Box mt="10px" px="8px">
            <ButtonComponent
              onClick={() => setIsFontDialogOpen(true)}
              color="#495057"
              rounded="7px"
            >
              <DisplayCenter>
                <BiFontFamily width="17px" height="17px" />
                <Box ml="10px">Font Management</Box>
              </DisplayCenter>
            </ButtonComponent>
          </Box>
        )}

        <div
          style={{
            width: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            marginTop: "10px",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
        >
          <MobilePanelTabs
            className="mobile-panel-tabs"
            // style={{ minWidth: "max-content" }}
          >
            {mobilePanels.map((panel) => (
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
          <h6>{mobilePanels.find(p => p.id === mobileActivePanel)?.label || ""}</h6>
          <div className="close-btn" onClick={closeMobilePanel}>
            <IoClose size={18} />
          </div>
        </MobilePanelHeader>
        <MobilePanelBody>
          {mobileActivePanel && renderMobilePanelContent()}
        </MobilePanelBody>
      </MobilePanelContent>

      {/* ===== DESKTOP VIEW (hidden on mobile) ===== */}
      <div className="d-none d-md-block">
        <div className="sticker-container sticker-container-mob p-2">
          <DisplayBetween className="heading-action-mob">
            <ActionTitle>Text</ActionTitle>
            <LiaTimesSolid
              onClick={() => dispatch(setIsActionActive(false))}
              className="cursor-pointer"
            />
          </DisplayBetween>
          <div className="scroll-container-mob">
            <Box mt="10px">
              {((settings.allowText &&
                user?.userTypeCode === USER_TYPES.CUSTOMER) ||
                user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
                <ButtonComponent
                  onClick={() => addTextinCanvas()}
                  color="#232323"
                  rounded="7px"
                >
                  <DisplayCenter>
                    <FaPlus width="17px" height="17px" />
                    <Box ml="10px">Add Text</Box>
                  </DisplayCenter>
                </ButtonComponent>
              )}
            </Box>
            <Box mt="10px">
              {((settings.allowText &&
                user?.userTypeCode === USER_TYPES.CUSTOMER) ||
                user?.userTypeCode !== USER_TYPES.CUSTOMER) && (
                <ButtonComponent
                  onClick={() => dispatch(setShowMagicWrite(true))}
                  color="#232323"
                  rounded="7px"
                >
                  <DisplayCenter>
                    <FaMagic width="17px" height="17px" color="#fff" />
                    <Box ml="10px" color="#fff">
                      Smart Caption
                    </Box>
                  </DisplayCenter>
                </ButtonComponent>
              )}
            </Box>

            {isCalendarTextObjectSelected() && (
              <Box mt="15px">
                <FlexBox mt="15px" gap="6px">
                  <label htmlFor="applytoAllext">
                    <input
                      type="checkbox"
                      id="applytoAllext"
                      name="applytoAllext"
                      checked={applyToAll}
                      onChange={handleApplyAll}
                    />
                    <span
                      style={{ marginLeft: "10px" }}
                      title="This will set  all similar type text with selected settings"
                    >
                      Apply to All
                    </span>
                  </label>
                </FlexBox>
              </Box>
            )}

            {/* Position Settings Panel */}
            <Box mt="15px">
               <PositionSettingsPanel />
            </Box>

            {/* Old Font Styles dropdown — replaced by CustomFontAccordion below */}
            {/* <Box mt="15px">
              <ActionInnerTitle fontweight="500">Font Styles</ActionInnerTitle>
              <Box mt="10px">
                <TextSelect
                  value={fontFamily}
                  onChange={(e) => setFFamily(e.target.value)}
                >
                  {Fontfamilies.map((x) => (
                    <option style={{ fontFamily: x.value }} value={x.value}>
                      {x.name}
                    </option>
                  ))}
                </TextSelect>
              </Box>
              <DisplayBetween mt="10px">
                <Box>
                  <TextSelect
                    value={
                      Math.round(
                        activeObjectProps?.font?.size /
                        (canvasSize.width / baseReferenceWidth)
                      ) || "36"
                    }
                    width="75px"
                    onChange={(e) => settextFontSize(e)}
                  >
                    {fontSizes.map((x) => (
                      <option value={x}>{x}</option>
                    ))}
                  </TextSelect>
                </Box>
                <Box>
                  <TextSelect
                    value={fontStyle}
                    width="90px"
                    onChange={(e) => setFontWeight(e.target.value)}
                  >
                    {fwList.map((x) => (
                      <option value={x.value}>{x.name}</option>
                    ))}
                  </TextSelect>
                </Box>
              </DisplayBetween>
            </Box> */}

            {/* Custom Fonts from Backend — Accordion Style */}
            <CustomFontAccordion
              fontFamily={fontFamily}
              activeFont={activeObjectProps?.font}
              onVariantSelect={handleCustomVariantSelect}
              isTextSelected={isTextObjectSelected()}
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeFromAccordion}
              canvasSize={canvasSize}
            />

            {/* horizontal alignment box */}
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">
                Horizontal Alignment
              </ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onClick={() => setAlign("left")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "left"
                      ? "active"
                    : ""
                  }
                >
                  <LeftAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setAlign("center")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "center"
                      ? "active"
                    : ""
                  }
                >
                  <CenterAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setAlign("right")}
                  className={
                    activeObjectProps?.alignment?.horizontal === "right"
                      ? "active"
                    : ""
                  }
                >
                  <RightAlignIcon />
                </TextAlignButton>
                {!isLegacyText && (
                  <TextAlignButton
                    onClick={() => setAlign("justify")}
                    className={
                    activeObjectProps?.alignment?.horizontal === "justify"
                      ? "active"
                      : ""
                    }
                  >
                    <JustifyAlignIcon />
                  </TextAlignButton>
                )}

                {/* <TextAlignButton onClick={() => setAlign("justify")} className={activeObjectProps?.alignment.horizontal === "justify" ? "active" : ""}>
                        <JustifyAlignIcon />
                    </TextAlignButton> */}
              </FlexBox>
            </Box>

            {/* vertical aligment box */}
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">
                Vertical Alignment
              </ActionInnerTitle>
              <FlexBox mt="10px" gap="17px">
                <TextAlignButton
                  onClick={() => setVAlign("top")}
                  className={
                    activeObjectProps?.alignment.vertical === "top"
                      ? "active"
                    : ""
                  }
                >
                  <TopAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setVAlign("middle")}
                  className={
                    activeObjectProps?.alignment.vertical === "middle"
                      ? "active"
                    : ""
                  }
                >
                  <MiddleAlignIcon />
                </TextAlignButton>
                <TextAlignButton
                  onClick={() => setVAlign("bottom")}
                  className={
                    activeObjectProps?.alignment.vertical === "bottom"
                      ? "active"
                    : ""
                  }
                >
                  <BottomAlignIcon />
                </TextAlignButton>
              </FlexBox>
            </Box>

  {/* Text Spacing Controls */}
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">Spacing</ActionInnerTitle>
              
              {/* Letter Spacing */}
              <SpacingSliderContainer>
                <SpacingSliderLabel>
                  <span>Letter Spacing</span>
                  <SpacingValueInput
                    type="number"
                    value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                    onChange={(e) => setLetterSpacing(e.target.value)}
                    min={-200}
                    max={800}
                    step={1}
                  />
                </SpacingSliderLabel>
                <SpacingSliderInput
                  type="range"
                  min={-200}
                  max={800}
                  step={1}
                  value={activeObjectProps?.spacing?.letterSpacing ?? 0}
                  onChange={(e) => setLetterSpacing(e.target.value)}
                />
              </SpacingSliderContainer>

              {/* Line Height */}
              <SpacingSliderContainer>
                <SpacingSliderLabel>
                  <span>Line Height</span>
                  <SpacingValueInput
                    type="number"
                    value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                    onChange={(e) => setLineHeight(e.target.value)}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                  />
                </SpacingSliderLabel>
                <SpacingSliderInput
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={activeObjectProps?.spacing?.lineHeight ?? 1.2}
                  onChange={(e) => setLineHeight(e.target.value)}
                />
              </SpacingSliderContainer>
            </Box>

            {/* Text Color and Background Color are handled by the Text Floating Toolbar
                (TextToolbarDialogPanel "colors" dialog) which correctly routes gradient
                application to text color vs background color. Commented out here. */}
            {/*
            <Box mt="15px">
              <ActionInnerTitle fontweight="500">Text Color</ActionInnerTitle>
              <FlexBox mt="15px" gap="6px" wrap="nowrap">
                <BackgroundColorItemSmall
                  onClick={handleColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />
                <BackgroundColorItemSmall
                  onClick={() => setColor("#000000")}
                  key={`bgcolor-blank`}
                  bgimage="/images/background/remove_bg_color.png"
                />

                {displayColorPicker ? (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: "2",
                      bottom: window.innerWidth < 768 ? "0px" : "40px",
                    }}
                  >
                    <div
                      style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                      }}
                      onClick={handleColorPickerClose}
                    />
                    <ColorPickerWithOpacity
                      color={
                          activeObjectProps?.color
                          ? activeObjectProps?.color
                        : "#000000"
                      }
                      initialGradient={activeObjectProps?.gradient || null}
                      onChange={(hexColor) => setColor(hexColor)}
                      onGradientChange={setTextGradient}
                      externalGradientHistory={[...textGradientHistory, ...globalGradientHistory.filter(g => !textGradientHistory.some(t => t.css === g.css))]}
                      externalSolidColorHistory={[...textSolidColorHistory, ...globalSolidColorHistory.filter(g => !textSolidColorHistory.some(t => t.color === g.color))]}
                    />
                  </div>
                ) : null}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setColor(item.bgcolor)}
                    key={`bgcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            <Box mt="15px">
              <ActionInnerTitle fontweight="500">
                Background Color
              </ActionInnerTitle>
              <FlexBox mt="15px" gap="6px" wrap="nowrap">
                <BackgroundColorItemSmall
                  onClick={handleBGColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />
                <BackgroundColorItemSmall
                  onClick={() => setBGColor("transparent")}
                  key={`bgcolor-blank`}
                  bgimage="/images/background/remove_bg_color.png"
                />

                {displayBGColorPicker ? (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: "2",
                      bottom: window.innerWidth < 768 ? "0px" : "40px",
                    }}
                  >
                    <div
                      style={{
                        position: "fixed",
                        top: "0px",
                        right: "0px",
                        bottom: "0px",
                        left: "0px",
                      }}
                      onClick={handleBGColorPickerClose}
                    />
                    <ColorPickerWithOpacity
                      color={
                          activeObjectProps?.bgcolor
                          ? activeObjectProps?.bgcolor
                        : "#000000"
                      } // Default to black with full opacity
                      initialGradient={activeObjectProps?.bgGradient || null}
                      onChange={(hexColor) => {
                        setBGColor(hexColor);
                      }}
                      onGradientChange={setTextBGGradient}
                      externalGradientHistory={globalGradientHistory}
                      externalSolidColorHistory={globalSolidColorHistory}
                    />
                  </div>
                ) : null}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setBGColor(item.bgcolor)}
                    key={`bgcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>
            */}

            {/* Smart Text Groups Panel */}
            <TextGroupPanel />
          </div>
        </div>
      </div>

      {/* Font Management Dialog (rendered at top level for correct z-index) */}
      {isFontDialogOpen && (
        <FontManagementDialog
          isOpen={isFontDialogOpen}
          onClose={() => setIsFontDialogOpen(false)}
        />
      )}
    </>
  );
};
