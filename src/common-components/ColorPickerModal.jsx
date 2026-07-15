import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { SketchPicker } from "react-color";
import { MdClose } from "react-icons/md";
import { FaTrash, FaPen } from "react-icons/fa";
import styled from "styled-components";
import {
  ColorPickerModalOverlay,
  ColorPickerModalContainer,
  ColorPickerModalHeader,
  ColorPickerCloseButton,
  ColorPickerContent,
  PrimaryButton,
  LightPrimaryButton,
} from "./StyledComponents";
import {
  rgbaToHex,
  hexToRgba,
  generateGradientCompanion,
  MAX_GRADIENT_COLORS,
} from "../utils/colorUtils";
import {
  GRADIENT_PRESETS,
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../library/utils/helpers/gradientUtils";

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e6e6e6;
`;

const Tab = styled.button`
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: ${(props) => (props.$active ? "#fff" : "#f5f5f5")};
  color: ${(props) => (props.$active ? "var(--primary)" : "#666")};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: ${(props) =>
    props.$active ? "2px solid var(--primary)" : "2px solid transparent"};
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.$active ? "#fff" : "#eee")};
  }
`;

const TabContent = styled.div`
  padding: 0;
`;

const GradientSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const GradientPreview = styled.div`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  background: ${(props) => props.$gradient};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
`;

const HistoryLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 4px 12px;
  width: 100%;
`;

const GradientHistoryLabel = styled.div`
  font-size: 12px;
  color: #333;
  font-weight: 500;
`;

const SeeAllButton = styled.button`
  font-size: 11px;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-weight: 500;
  flex-shrink: 0;
  &:hover { text-decoration: underline; }
`;

const SeeAllOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: auto;
`;

const SeeAllHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e6e6e6;
  flex-shrink: 0;
`;

const SeeAllBackButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #333;
  display: flex;
  align-items: center;
  padding: 0;
  font-size: 16px;
  &:hover { color: var(--primary); }
`;

const SeeAllTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #333;
`;

const SeeAllGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(52px, 1fr));
  gap: 12px;
  padding: 18px;
  overflow-y: auto;
  flex: 1;
  align-content: flex-start;
`;

const GradientHistoryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 8px 12px;
  overflow-x: auto;
  width: 100%;
  max-width: 280px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 3px;
  }
`;

const GradientStyleLabel = styled.div`
  font-size: 12px;
  color: #333;
  padding: 8px 12px 4px 12px;
  font-weight: 500;
  width: 100%;
  text-align: left;
`;

const GradientStyleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 12px 12px;
  overflow-x: auto;
  width: 100%;
  max-width: 280px;
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const GradientStyleButton = styled.button`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  border: 2px solid ${(props) => (props.$selected ? "var(--primary)" : "transparent")};
  background: ${(props) => props.$gradient};
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: ${(props) =>
    props.$selected
      ? "0 0 0 2px rgba(64,132,181,0.3), 0 1px 3px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.15)"};
  transition: all 0.15s ease;
  padding: 0;

  &:hover {
    transform: scale(1.05);
  }
`;

const GradientHistoryItem = styled.div`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  background: ${(props) => props.$gradient};
  border: 2px solid ${(props) => (props.$selected ? "var(--primary)" : "transparent")};
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: ${(props) =>
    props.$selected
      ? "0 0 0 2px rgba(64,132,181,0.3), 0 1px 3px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.15)"};
  transition: all 0.15s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const GradientStyleItem = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 5px;
  background: ${(props) => props.$gradient};
  border: 2px solid ${(props) => (props.$selected ? "var(--primary)" : "transparent")};
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: ${(props) =>
    props.$selected
      ? "0 0 0 2px rgba(64,132,181,0.3), 0 1px 3px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.15)"};
  transition: all 0.15s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const ColorStopsLabel = styled.div`
  font-size: 13px;
  color: #333;
  font-weight: 500;
  padding: 12px 12px 8px 12px;
  width: 100%;
  text-align: left;
`;

const ColorStopsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 12px 12px;
  overflow-x: auto;
  width: 100%;
  max-width: 280px;
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 480px) {
    max-width: calc(100vw - 80px);
  }
`;

const ColorStopWrapper = styled.div`
  position: relative;
  flex-shrink: 0;

  &:hover .remove-btn,
  &.selected .remove-btn {
    opacity: 1;
    visibility: visible;
  }
`;

const ColorStop = styled.div`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  background: ${(props) => props.color};
  border: 2px solid ${(props) => (props.$selected ? "var(--primary)" : "transparent")};
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: ${(props) =>
    props.$selected
      ? "0 0 0 2px rgba(64,132,181,0.3), 0 1px 3px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.15)"};

  &:hover {
    transform: scale(1.05);
  }
`;

const RemoveButton = styled.button`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  background: #ff4444;
  border: 1.5px solid #fff;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  z-index: 1;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;

  &:hover {
    background: #cc0000;
  }
`;

const AddColorButton = styled.button`
  width: 37px;
  height: 37px;
  border-radius: 5px;
  border: 2px solid transparent;
  background: ${(props) =>
    props.bgimage
      ? `url(${props.bgimage}) no-repeat center center / cover`
      : props.color || "transparent"};
  border-box;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: all 0.15s ease;

  &::after {
    content: "+";
    font-size: 18px;
    color: #666;
    font-weight: 400;
  }

  &:hover {
    transform: scale(1.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ColorPickerArea = styled.div`
  padding: 0 10px;
  width: 100%;
  display: flex;
  justify-content: center;

  .sketch-picker {
    box-shadow: none !important;
    padding: 0 !important;
    width: 220px !important;
    border-radius: 0 !important;
  }

  .sketch-picker > div:nth-child(3) {
    display: none !important;
  }

  .sketch-picker > div:nth-child(4) {
    display: none !important;
  }
`;

const BottomControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px;
  border-top: 1px solid #eee;
  justify-content: space-between;
`;

const IconButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f5;
    border-color: #ccc;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const InputGroup = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  height: 28px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0 4px;
  gap: 4px;
  background: #fff;
  min-width: 0;
`;

const ColorCircle = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${(props) => props.color};
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`;

const HexInput = styled.input`
  font-size: 11px;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  border: none;
  background: transparent;
  width: 46px;
  text-transform: uppercase;
  padding: 0;

  &:focus {
    outline: none;
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 14px;
  background: #e0e0e0;
  flex-shrink: 0;
`;

const OpacityInput = styled.input`
  font-size: 11px;
  color: #333;
  border: none;
  background: transparent;
  width: 24px;
  text-align: right;
  padding: 0;

  &:focus {
    outline: none;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  -moz-appearance: textfield;
`;

const PRESET_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8C471",
  "#82E0AA",
  "#F1948A",
  "#85C1E9",
  "#D2B4DE",
  "#000000",
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
];

const getInitialColor = (color) => {
  if (typeof color === "string") {
    return hexToRgba(color);
  }
  return color || { r: 0, g: 0, b: 0, a: 1 };
};

const getInitialSolidHex = (color) => {
  if (typeof color === "string") {
    const rgba = hexToRgba(color);
    return rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);
  }
  if (color && color.r !== undefined) {
    return rgbaToHex(color.r, color.g, color.b, color.a || 1);
  }
  return "#000000FF";
};

const getInitialGradientStops = (gradient, color) => {
  if (gradient && gradient.stops && gradient.stops.length >= 2) {
    return gradient.stops.map((stop, idx) => ({
      id: idx + 1,
      color: stop.color,
      position: stop.position,
    }));
  }
  const initBaseHex = typeof color === "string" ? color.slice(0, 7) : "#000000";
  return [
    { id: 1, color: initBaseHex + "FF", position: 0 },
    {
      id: 2,
      color: generateGradientCompanion(initBaseHex) + "FF",
      position: 100,
    },
  ];
};

const redistributeStops = (stops) => {
  const totalStops = stops.length;
  return stops.map((stop, index) => ({
    ...stop,
    position: Math.round((index / (totalStops - 1)) * 100),
  }));
};

function ColorPickerModal({
  isOpen,
  onClose,
  color,
  onChange,
  onGradientChange,
  onConfirm,
  title = "Choose Color",
  showActions = true,
  initialTab = "solid",
  gradient = null,
  showGradientTab = false,
  initialSolidColor = null,
  onSolidColorChanged = null,
  externalGradientHistory = [],
  externalSolidColorHistory = [],
  liveApply = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentColor, setCurrentColor] = useState(() =>
    getInitialColor(color)
  );
  const [storedSolidHex, setStoredSolidHex] = useState(() =>
    getInitialSolidHex(color)
  );
  const [gradientStops, setGradientStops] = useState(() =>
    getInitialGradientStops(gradient, color)
  );
  const [selectedStopId, setSelectedStopId] = useState(1);
  const [hexInputValue, setHexInputValue] = useState("");
  const [opacityInputValue, setOpacityInputValue] = useState("");
  const [solidColorModified, setSolidColorModified] = useState(false);
  const [gradientHistory, setGradientHistory] = useState([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [solidColorHistory, setSolidColorHistory] = useState([]);
  const [selectedSolidHistoryIndex, setSelectedSolidHistoryIndex] = useState(-1);
  const [selectedGradientStyle, setSelectedGradientStyle] = useState(() => {
    if (gradient?.type === "radial") {
      const x = gradient.radialPosition?.x ?? 50;
      const y = gradient.radialPosition?.y ?? 50;
      if (x === 0 && y === 0) return GRADIENT_PRESETS[4];
      return GRADIENT_PRESETS[3];
    }
    const angle = gradient?.angle ?? 90;
    const preset = GRADIENT_PRESETS.find(
      (p) => p.type === "linear" && p.angle === angle
    );
    return preset || GRADIENT_PRESETS[1]; // Default to linear-90
  });
  const [lastGradientState, setLastGradientState] = useState(null);
  const [solidColorChangedSinceLastSave, setSolidColorChangedSinceLastSave] = useState(false);
  const [seeAllSolid, setSeeAllSolid] = useState(false);
  const [seeAllGradient, setSeeAllGradient] = useState(false);

  const hexInputRef = useRef(null);
  const savedGradientStopsRef = useRef(null);
  const originalSolidColorRef = useRef(null);
  const lastSavedSolidColorRef = useRef(null);
  const liveApplyTimerRef = useRef(null);
  // Track the color that was applied to the object when the modal opened,
  // so we can revert on cancel when liveApply is enabled
  const openColorRef = useRef(null);
  const openGradientRef = useRef(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (liveApplyTimerRef.current) clearTimeout(liveApplyTimerRef.current);
    };
  }, []);

  const baseHex = useMemo(() => storedSolidHex.slice(0, 7), [storedSolidHex]);

  const selectedStop = useMemo(
    () => gradientStops.find((stop) => stop.id === selectedStopId),
    [gradientStops, selectedStopId]
  );

  const selectedStopColor = useMemo(
    () =>
      selectedStop
        ? hexToRgba(selectedStop.color)
        : { r: 0, g: 0, b: 255, a: 1 },
    [selectedStop]
  );

  const gradientCss = useMemo(() => {
    const sortedStops = [...gradientStops].sort(
      (a, b) => a.position - b.position
    );
    const stopsStr = sortedStops
      .map((stop) => `${stop.color.slice(0, 7)} ${stop.position}%`)
      .join(", ");

    if (selectedGradientStyle?.type === "radial") {
      const x = selectedGradientStyle?.position?.x ?? 50;
      const y = selectedGradientStyle?.position?.y ?? 50;
      return `radial-gradient(circle at ${x}% ${y}%, ${stopsStr})`;
    }

    const angle = selectedGradientStyle?.angle ?? 90;
    return `linear-gradient(${angle}deg, ${stopsStr})`;
  }, [gradientStops, selectedGradientStyle]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setActiveTab(initialTab);

      let initSolidHex;
      if (gradient?.stops?.length >= 2) {
        initSolidHex = gradient.stops[0].color;
      } else if (initialSolidColor) {
        initSolidHex = getInitialSolidHex(initialSolidColor);
      } else {
        initSolidHex = getInitialSolidHex(color);
      }

      originalSolidColorRef.current = initSolidHex;
      // Store the opening state so we can revert on cancel
      openColorRef.current = initSolidHex;
      openGradientRef.current = gradient ? { ...gradient } : null;
      setStoredSolidHex(initSolidHex);
      setCurrentColor(hexToRgba(initSolidHex));

      // Merge external solid color history with current color
      let mergedSolidHistory = [...externalSolidColorHistory];
      const isDuplicateSolid = mergedSolidHistory.some((item) => item.color === initSolidHex);
      if (!isDuplicateSolid && initSolidHex) {
        mergedSolidHistory = [...mergedSolidHistory, {
          id: Date.now(),
          color: initSolidHex,
          rgba: `rgba(${hexToRgba(initSolidHex).r}, ${hexToRgba(initSolidHex).g}, ${hexToRgba(initSolidHex).b}, ${hexToRgba(initSolidHex).a})`,
        }];
      }
      setSolidColorHistory(mergedSolidHistory);
      const solidIndex = mergedSolidHistory.findIndex((item) => item.color === initSolidHex);
      setSelectedSolidHistoryIndex(solidIndex !== -1 ? solidIndex : -1);

      // Set lastSavedSolidColorRef to current color since it's already in history
      lastSavedSolidColorRef.current = initSolidHex;
      setSolidColorChangedSinceLastSave(false);

      // Merge external gradient history with current gradient
      let mergedHistory = [...externalGradientHistory];

      if (gradient?.stops?.length >= 2) {
        const stops = gradient.stops.map((stop, idx) => ({
          id: idx + 1,
          color: stop.color,
          position: stop.position,
        }));

        setGradientStops(stops);
        savedGradientStopsRef.current = stops;
        setSelectedStopId(1);

        // Set the gradient style from the passed gradient
        if (gradient.type === "radial") {
          const x = gradient.radialPosition?.x ?? 50;
          const y = gradient.radialPosition?.y ?? 50;
          if (x === 0 && y === 0) {
            setSelectedGradientStyle(GRADIENT_PRESETS[4]);
          } else {
            setSelectedGradientStyle(GRADIENT_PRESETS[3]);
          }
        } else {
          const angle = gradient.angle ?? 90;
          const preset = GRADIENT_PRESETS.find(
            (p) => p.type === "linear" && p.angle === angle
          );
          setSelectedGradientStyle(preset || GRADIENT_PRESETS[1]);
        }

        // Add current gradient to history if not already present
        const sortedStops = [...stops].sort((a, b) => a.position - b.position);
        const stopsStr = sortedStops
          .map((s) => `${s.color.slice(0, 7)} ${s.position}%`)
          .join(", ");
        const cssStr =
          gradient.type === "radial"
            ? `radial-gradient(circle at ${gradient.radialPosition?.x ?? 50}% ${gradient.radialPosition?.y ?? 50
            }%, ${stopsStr})`
            : `linear-gradient(${gradient.angle ?? 90}deg, ${stopsStr})`;
        const currentGradientItem = {
          id: Date.now(),
          stops: stops,
          type: gradient.type || "linear",
          angle: gradient.angle ?? 90,
          radialPosition: gradient.radialPosition,
          css: cssStr,
        };

        // Check if current gradient is already in external history
        const isDuplicate = mergedHistory.some((item) => item.css === cssStr);
        if (!isDuplicate) {
          mergedHistory = [...mergedHistory, currentGradientItem];
        }

        setGradientHistory(mergedHistory);
        const currentIndex = mergedHistory.findIndex((item) => item.css === cssStr);
        setSelectedHistoryIndex(currentIndex !== -1 ? currentIndex : mergedHistory.length - 1);

        // Save last gradient state
        setLastGradientState({
          stops,
          style: gradient.type === "radial" ?
            (gradient.radialPosition?.x === 0 && gradient.radialPosition?.y === 0 ? GRADIENT_PRESETS[4] : GRADIENT_PRESETS[3]) :
            (GRADIENT_PRESETS.find((p) => p.type === "linear" && p.angle === (gradient.angle ?? 90)) || GRADIENT_PRESETS[1])
        });
      } else {
        savedGradientStopsRef.current = null;
        setGradientHistory(mergedHistory);
        setSelectedHistoryIndex(-1);
        setSelectedGradientStyle(GRADIENT_PRESETS[1]); // Default to linear-90

        // If there's external history but no current gradient, restore last gradient state if available
        if (mergedHistory.length > 0 && lastGradientState) {
          setGradientStops(lastGradientState.stops);
          setSelectedGradientStyle(lastGradientState.style);
          savedGradientStopsRef.current = lastGradientState.stops;
        }
      }
      setSolidColorModified(false);
    } else if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, initialTab, color, gradient, initialSolidColor, externalGradientHistory, externalSolidColorHistory]);

  useEffect(() => {
    if (typeof color === "string") {
      setCurrentColor(hexToRgba(color));
    } else if (color && color.r !== undefined) {
      setCurrentColor(color);
    }
  }, [color]);

  useEffect(() => {
    if (selectedStop) {
      setHexInputValue(
        selectedStop.color.replace("#", "").slice(0, 6).toUpperCase()
      );
      const opacity = Math.round(hexToRgba(selectedStop.color).a * 100);
      setOpacityInputValue(opacity.toString());
    }
  }, [selectedStop?.color, selectedStop?.id]);

  // Handle clicking on a gradient history item
  const handleHistoryItemClick = useCallback(
    (index) => {
      const historyItem = gradientHistory[index];
      if (historyItem) {
        setSelectedHistoryIndex(index);
        // Load the gradient stops from history
        const loadedStops = historyItem.stops.map((stop, i) => ({
          ...stop,
          id: i + 1,
        }));
        setGradientStops(loadedStops);
        setSelectedStopId(1);

        // Restore gradient style from history
        if (historyItem.type === "radial") {
          const x = historyItem.radialPosition?.x ?? 50;
          const y = historyItem.radialPosition?.y ?? 50;
          if (x === 0 && y === 0) {
            setSelectedGradientStyle(GRADIENT_PRESETS[4]);
          } else {
            setSelectedGradientStyle(GRADIENT_PRESETS[3]);
          }
        } else {
          const angle = historyItem.angle ?? 90;
          const preset = GRADIENT_PRESETS.find(
            (p) => p.type === "linear" && p.angle === angle
          );
          setSelectedGradientStyle(preset || GRADIENT_PRESETS[1]);
        }
      }
    },
    [gradientHistory]
  );

  // Handle clicking on a solid color history item
  const handleSolidHistoryItemClick = useCallback(
    (index) => {
      const historyItem = solidColorHistory[index];
      if (historyItem) {
        setSelectedSolidHistoryIndex(index);
        setStoredSolidHex(historyItem.color);
        setCurrentColor(hexToRgba(historyItem.color));
        setSolidColorModified(true);
        // Reset tracking flag since this color is already in history
        setSolidColorChangedSinceLastSave(false);
        lastSavedSolidColorRef.current = historyItem.color;
        if (onSolidColorChanged) {
          onSolidColorChanged(true);
        }
      }
    },
    [solidColorHistory, onSolidColorChanged]
  );

  const handleSolidTabClick = useCallback(() => {
    if (activeTab === "gradient" && gradientStops.length >= 2) {
      // Save current gradient to history when switching away from gradient tab
      const newHistoryItem = {
        id: Date.now(),
        stops: [...gradientStops],
        type: selectedGradientStyle?.type || "linear",
        angle: selectedGradientStyle?.angle ?? 90,
        radialPosition: selectedGradientStyle?.position,
        css: gradientCss,
      };
      // Check if this gradient is already in history (avoid duplicates)
      const isDuplicate = gradientHistory.some(
        (item) => item.css === gradientCss
      );
      if (!isDuplicate) {
        setGradientHistory((prev) => [...prev, newHistoryItem]);
      }
      savedGradientStopsRef.current = [...gradientStops];
    }

    if (activeTab === "gradient" && gradientStops.length > 0) {
      const firstStopColor = gradientStops[0].color;
      setStoredSolidHex(firstStopColor);
      setCurrentColor(hexToRgba(firstStopColor));
    }
    setSolidColorModified(false);
    setActiveTab("solid");
  }, [
    activeTab,
    gradientStops,
    gradientCss,
    gradientHistory,
    selectedGradientStyle,
  ]);

  const handleGradientTabClick = useCallback(() => {
    // Save current solid color to history when switching away from solid tab
    // Only save if the color was actually changed since last save
    if (activeTab === "solid" && storedSolidHex && solidColorChangedSinceLastSave) {
      const isDuplicateSolid = solidColorHistory.some(
        (item) => item.color === storedSolidHex
      );
      if (!isDuplicateSolid) {
        const newSolidHistoryItem = {
          id: Date.now(),
          color: storedSolidHex,
          rgba: `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${currentColor.a})`,
        };
        setSolidColorHistory((prev) => [...prev, newSolidHistoryItem]);
        lastSavedSolidColorRef.current = storedSolidHex;
        setSolidColorChangedSinceLastSave(false);
      }
    }

    if (solidColorModified) {
      const newStops = [
        { id: 1, color: storedSolidHex, position: 0 },
        {
          id: 2,
          color: generateGradientCompanion(baseHex) + "FF",
          position: 100,
        },
      ];
      setGradientStops(newStops);
      savedGradientStopsRef.current = null;
      setSelectedStopId(1);
      setSelectedHistoryIndex(-1);
    } else if (
      savedGradientStopsRef.current &&
      savedGradientStopsRef.current.length >= 2
    ) {
      setGradientStops(savedGradientStopsRef.current);
      setSelectedStopId(savedGradientStopsRef.current[0]?.id || 1);
    } else if (lastGradientState) {
      // Restore last gradient state when switching back to gradient tab
      setGradientStops(lastGradientState.stops);
      setSelectedGradientStyle(lastGradientState.style);
      setSelectedStopId(1);
    } else if (!gradient) {
      setGradientStops([
        { id: 1, color: baseHex + "FF", position: 0 },
        {
          id: 2,
          color: generateGradientCompanion(baseHex) + "FF",
          position: 100,
        },
      ]);
      setSelectedStopId(1);
    }
    setActiveTab("gradient");
  }, [
    activeTab,
    storedSolidHex,
    solidColorHistory,
    solidColorChangedSinceLastSave,
    currentColor,
    solidColorModified,
    baseHex,
    gradient,
    selectedHistoryIndex,
    gradientHistory,
    lastGradientState,
  ]);

  const handleColorChange = useCallback(
    (colorResult) => {
      const { rgb, hex } = colorResult;
      const { r, g, b, a } = rgb;
      const rgbaString = `rgba(${r}, ${g}, ${b}, ${a})`;
      const hexAlpha = Math.round(a * 255)
        .toString(16)
        .padStart(2, "0");
      const hexWithAlpha = `${hex}${hexAlpha}`;

      if (showGradientTab) {
        setCurrentColor(rgb);
        setStoredSolidHex(hexWithAlpha);
        // Track if user modified the solid color
        if (
          originalSolidColorRef.current &&
          originalSolidColorRef.current !== hexWithAlpha
        ) {
          setSolidColorModified(true);
          if (onSolidColorChanged) {
            onSolidColorChanged(true);
          }
        }
        // Track if color changed since last save to history
        if (lastSavedSolidColorRef.current !== hexWithAlpha) {
          setSolidColorChangedSinceLastSave(true);
        }
        if (onChange) {
          onChange({
            ...colorResult,
            rgba: rgbaString,
            hexWithAlpha: hexWithAlpha,
            rgb: rgb,
          });
        }
        // Live apply for solid tab with gradient modal
        if (liveApply && onConfirm) {
          if (liveApplyTimerRef.current) clearTimeout(liveApplyTimerRef.current);
          liveApplyTimerRef.current = setTimeout(() => {
            onConfirm({
              type: "solid",
              color: hexWithAlpha,
              rgba: rgbaString,
            });
          }, 50);
        }
      } else {
        // Also update storedSolidHex for non-gradient modals so that
        // handleConfirm (Apply button) uses the correct current color
        setCurrentColor(rgb);
        setStoredSolidHex(hexWithAlpha);
        if (onChange) {
          onChange({
            ...colorResult,
            rgba: rgbaString,
            hexWithAlpha: hexWithAlpha,
            rgb: rgb,
          });
        }
        // Live apply for non-gradient modal
        if (liveApply && onConfirm) {
          if (liveApplyTimerRef.current) clearTimeout(liveApplyTimerRef.current);
          liveApplyTimerRef.current = setTimeout(() => {
            onConfirm({
              type: "solid",
              color: hexWithAlpha,
              rgba: rgbaString,
            });
          }, 50);
        }
      }
    },
    [showGradientTab, onChange, onSolidColorChanged, liveApply, onConfirm]
  );

  const handleGradientColorChange = useCallback(
    (colorObj) => {
      const { r, g, b, a } = colorObj.rgb;
      const hexColor = rgbaToHex(r, g, b, a);
      const newStops = gradientStops.map((stop) =>
        stop.id === selectedStopId ? { ...stop, color: hexColor } : stop
      );
      setGradientStops(newStops);

      // Live apply gradient changes
      if (liveApply && onConfirm) {
        if (liveApplyTimerRef.current) clearTimeout(liveApplyTimerRef.current);
        liveApplyTimerRef.current = setTimeout(() => {
          const sortedStops = [...newStops].sort((a, b) => a.position - b.position);
          const stopsStr = sortedStops
            .map((s) => `${s.color.slice(0, 7)} ${s.position}%`)
            .join(", ");
          const style = selectedGradientStyle;
          const css = style?.type === "radial"
            ? `radial-gradient(circle at ${style?.position?.x ?? 50}% ${style?.position?.y ?? 50}%, ${stopsStr})`
            : `linear-gradient(${style?.angle ?? 90}deg, ${stopsStr})`;
          const gradientData = {
            type: style?.type || "linear",
            angle: style?.angle || 90,
            ...(style?.type === "radial" && {
              radialPosition: style?.position || { x: 50, y: 50 },
            }),
            stops: newStops.map((stop) => ({
              color: stop.color,
              position: stop.position,
            })),
            css,
          };
          onConfirm(gradientData);
        }, 50);
      }
    },
    [selectedStopId, gradientStops, liveApply, onConfirm, selectedGradientStyle]
  );

  const handleAddColorStop = useCallback(() => {
    if (gradientStops.length >= MAX_GRADIENT_COLORS) return;
    const newId = Math.max(...gradientStops.map((s) => s.id)) + 1;
    const lastStop = gradientStops[gradientStops.length - 1];
    const lastStopHex = lastStop?.color?.slice(0, 7) || baseHex;
    const newStop = { id: newId, color: lastStopHex + "FF", position: 100 };
    setGradientStops(redistributeStops([...gradientStops, newStop]));
    setSelectedStopId(newId);
  }, [gradientStops, baseHex]);

  const handleDeleteColorStop = useCallback(
    (stopIdToDelete = selectedStopId) => {
      if (gradientStops.length <= 2) return;
      const filteredStops = gradientStops.filter(
        (stop) => stop.id !== stopIdToDelete
      );
      setGradientStops(redistributeStops(filteredStops));
      if (stopIdToDelete === selectedStopId) {
        setSelectedStopId(filteredStops[0].id);
      }
    },
    [gradientStops, selectedStopId]
  );

  const handleHexInputChange = useCallback(
    (e) => {
      const value = e.target.value.toUpperCase();
      setHexInputValue(value);
      const cleanValue = value.replace(/[^0-9A-F]/g, "");
      if (cleanValue.length === 6) {
        const currentAlpha = selectedStop?.color.slice(7, 9) || "FF";
        const fullHex = `#${cleanValue}${currentAlpha}`;
        setGradientStops((stops) =>
          stops.map((stop) =>
            stop.id === selectedStopId ? { ...stop, color: fullHex } : stop
          )
        );
      }
    },
    [selectedStop, selectedStopId]
  );

  const handleHexInputBlur = useCallback(() => {
    if (selectedStop) {
      setHexInputValue(
        selectedStop.color.replace("#", "").slice(0, 6).toUpperCase()
      );
    }
  }, [selectedStop]);

  const handleOpacityInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setOpacityInputValue(value);
      const intVal = parseInt(value);
      if (!isNaN(intVal) && intVal >= 0 && intVal <= 100) {
        const currentHex = selectedStop?.color.slice(0, 7) || "#0000FF";
        const alpha = Math.round((intVal / 100) * 255)
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
        setGradientStops((stops) =>
          stops.map((stop) =>
            stop.id === selectedStopId
              ? { ...stop, color: `${currentHex}${alpha}` }
              : stop
          )
        );
      }
    },
    [selectedStop, selectedStopId]
  );

  const handleOpacityInputBlur = useCallback(() => {
    if (selectedStop) {
      const opacity = Math.round(hexToRgba(selectedStop.color).a * 100);
      setOpacityInputValue(opacity.toString());
    }
  }, [selectedStop]);

  const handleEditClick = useCallback(() => {
    hexInputRef.current?.focus();
    hexInputRef.current?.select();
  }, []);

  const handleConfirm = useCallback(() => {
    if (activeTab === "solid") {
      // Save solid color to internal history when applying
      if (storedSolidHex && solidColorChangedSinceLastSave) {
        const isDuplicateSolid = solidColorHistory.some(
          (item) => item.color === storedSolidHex
        );
        if (!isDuplicateSolid) {
          const newSolidHistoryItem = {
            id: Date.now(),
            color: storedSolidHex,
            rgba: `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${currentColor.a})`,
          };
          setSolidColorHistory((prev) => [...prev, newSolidHistoryItem]);
          lastSavedSolidColorRef.current = storedSolidHex;
          setSolidColorChangedSinceLastSave(false);
        }
      }

      if (onConfirm) {
        onConfirm({
          type: "solid",
          color: storedSolidHex,
          rgba: `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${currentColor.a})`,
        });
      }
    } else if (activeTab === "gradient") {
      const gradientData = {
        type: selectedGradientStyle?.type || "linear",
        angle: selectedGradientStyle?.angle || 90,
        ...(selectedGradientStyle?.type === "radial" && {
          radialPosition: selectedGradientStyle?.position || { x: 50, y: 50 },
        }),
        stops: gradientStops.map((stop) => ({
          color: stop.color,
          position: stop.position,
        })),
        css: gradientCss,
      };

      // Save current gradient state for tab switching
      setLastGradientState({
        stops: gradientStops,
        style: selectedGradientStyle,
      });

      if (onGradientChange) {
        onGradientChange(gradientData);
      }
      if (onConfirm) {
        onConfirm(gradientData);
      }
    }
    onClose();
  }, [
    activeTab,
    storedSolidHex,
    solidColorHistory,
    solidColorChangedSinceLastSave,
    currentColor,
    gradientStops,
    gradientCss,
    selectedGradientStyle,
    onGradientChange,
    onConfirm,
    onClose,
  ]);

  const handleCancel = useCallback(() => {
    // When liveApply is enabled, we must revert to the original color
    // because intermediate changes were already applied to the object
    if (liveApply && onConfirm && openColorRef.current) {
      // Cancel any pending live apply timer
      if (liveApplyTimerRef.current) {
        clearTimeout(liveApplyTimerRef.current);
        liveApplyTimerRef.current = null;
      }

      if (openGradientRef.current) {
        // Revert to original gradient
        const origGradient = openGradientRef.current;
        const sortedStops = [...(origGradient.stops || [])].sort((a, b) => a.position - b.position);
        const stopsStr = sortedStops
          .map((s) => `${(s.color || '').slice(0, 7)} ${s.position}%`)
          .join(", ");
        const css = origGradient.type === "radial"
          ? `radial-gradient(circle at ${origGradient.radialPosition?.x ?? 50}% ${origGradient.radialPosition?.y ?? 50}%, ${stopsStr})`
          : `linear-gradient(${origGradient.angle ?? 90}deg, ${stopsStr})`;
        onConfirm({
          type: origGradient.type || "linear",
          angle: origGradient.angle || 90,
          ...(origGradient.type === "radial" && {
            radialPosition: origGradient.radialPosition || { x: 50, y: 50 },
          }),
          stops: origGradient.stops || [],
          css,
        });
      } else {
        // Revert to original solid color
        const rgba = hexToRgba(openColorRef.current);
        onConfirm({
          type: "solid",
          color: openColorRef.current,
          rgba: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`,
        });
      }
    }
    onClose();
  }, [onClose, liveApply, onConfirm]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        handleCancel();
      }
    },
    [handleCancel]
  );

  useEffect(() => {
    if(activeTab === "solid") {
      setSeeAllSolid(false);
    } else if(activeTab === "gradient") {
      setSeeAllGradient(false);
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const reversedSolidHistory = [...solidColorHistory].reverse();
  const reversedGradientHistory = [...gradientHistory].reverse();

  return (
    <ColorPickerModalOverlay onClick={handleOverlayClick}>
      <ColorPickerModalContainer style={{ position: "relative" }}>
        <ColorPickerModalHeader>
          <h5>{title}</h5>
          <ColorPickerCloseButton onClick={handleCancel}>
            <MdClose />
          </ColorPickerCloseButton>
        </ColorPickerModalHeader>

        {showGradientTab && (
          <TabsContainer>
            <Tab
              $active={activeTab === "solid"}
              onClick={handleSolidTabClick}
              type="button"
            >
              Solid
            </Tab>
            <Tab
              $active={activeTab === "gradient"}
              onClick={handleGradientTabClick}
              type="button"
            >
              Gradient
            </Tab>
          </TabsContainer>
        )}

        <div style={{ position: "relative", overflow: "hidden" }}>
        {/* See All Solid Colors Overlay */}
        {seeAllSolid && activeTab === "solid" && activeTab !== "gradient" && (
          <SeeAllOverlay>
            <SeeAllHeader>
              <SeeAllBackButton type="button" onClick={() => setSeeAllSolid(false)} title="Back">
                &#8592;
              </SeeAllBackButton>
              <SeeAllTitle>Used in this project</SeeAllTitle>
            </SeeAllHeader>
            <SeeAllGrid>
              {reversedSolidHistory.map((item, index) => {
                const originalIndex = solidColorHistory.length - 1 - index;
                return (
                  <GradientStyleItem
                    key={item.id}
                    style={{ background: item.color }}
                    $selected={selectedSolidHistoryIndex === originalIndex}
                    onClick={() => { handleSolidHistoryItemClick(originalIndex); setSeeAllSolid(false); }}
                    title={`Color: ${item.color}`}
                  />
                );
              })}
            </SeeAllGrid>
          </SeeAllOverlay>
        )}

        {/* See All Gradient Colors Overlay */}
        {seeAllGradient && activeTab === "gradient" && activeTab !== "solid" && (
          <SeeAllOverlay>
            <SeeAllHeader>
              <SeeAllBackButton type="button" onClick={() => setSeeAllGradient(false)} title="Back">
                &#8592;
              </SeeAllBackButton>
              <SeeAllTitle>Used in this project</SeeAllTitle>
            </SeeAllHeader>
            <SeeAllGrid>
              {reversedGradientHistory.map((item, index) => {
                const originalIndex = gradientHistory.length - 1 - index;
                return (
                  <GradientStyleItem
                    key={item.id}
                    $gradient={item.css}
                    $selected={selectedHistoryIndex === originalIndex}
                    onClick={() => { handleHistoryItemClick(originalIndex); setSeeAllGradient(false); }}
                    title={`Gradient ${originalIndex + 1} (${item.stops.length} colors)`}
                  />
                );
              })}
            </SeeAllGrid>
          </SeeAllOverlay>
        )}

        <ColorPickerContent>
          <TabContent>
            {activeTab === "solid" ? (
              <>
                {/* Solid Color History Gallery */}
                {solidColorHistory.length > 0 && (
                  <>
                    <HistoryLabelRow>
                      <GradientHistoryLabel>Used in this project</GradientHistoryLabel>
                      {solidColorHistory.length > 4 && (
                        <SeeAllButton type="button" onClick={() => setSeeAllSolid(true)}>See all</SeeAllButton>
                      )}
                    </HistoryLabelRow>
                    <GradientHistoryRow>
                      {reversedSolidHistory.map((item, index) => {
                        const originalIndex = solidColorHistory.length - 1 - index;
                        return (
                          <GradientHistoryItem
                            key={item.id}
                            style={{ background: item.color }}
                            $selected={selectedSolidHistoryIndex === originalIndex}
                            onClick={() => handleSolidHistoryItemClick(originalIndex)}
                            title={`Color: ${item.color}`}
                          />
                        );
                      })}
                    </GradientHistoryRow>
                  </>
                )}
                <SketchPicker
                  color={showGradientTab ? currentColor : color}
                  onChange={showGradientTab ? undefined : handleColorChange}
                  onChangeComplete={
                    showGradientTab ? handleColorChange : undefined
                  }
                  disableAlpha={false}
                  presetColors={PRESET_COLORS}
                />
              </>
            ) : (
              <GradientSection>
                {/* Gradient History Gallery */}
                {gradientHistory.length > 0 && (
                  <>
                    <HistoryLabelRow>
                      <GradientHistoryLabel>Used in this project</GradientHistoryLabel>
                      {gradientHistory.length > 4 && (
                        <SeeAllButton type="button" onClick={() => setSeeAllGradient(true)}>See all</SeeAllButton>
                      )}
                    </HistoryLabelRow>
                    <GradientHistoryRow>
                      {reversedGradientHistory.map((item, index) => {
                        const originalIndex = gradientHistory.length - 1 - index;
                        return (
                          <GradientHistoryItem
                            key={item.id}
                            $gradient={item.css}
                            $selected={selectedHistoryIndex === originalIndex}
                            onClick={() => handleHistoryItemClick(originalIndex)}
                            title={`Gradient ${originalIndex + 1} (${item.stops.length} colors)`}
                          />
                        );
                      })}
                    </GradientHistoryRow>
                  </>
                )}

                {/* Gradient Style Presets */}
                <GradientStyleLabel>Styles</GradientStyleLabel>
                <GradientStyleRow>
                  {GRADIENT_PRESETS.map((preset) => {
                    const sortedStops = [...gradientStops].sort(
                      (a, b) => a.position - b.position
                    );
                    const stopsStr = sortedStops
                      .map((s) => `${s.color.slice(0, 7)} ${s.position}%`)
                      .join(", ");
                    const previewCss =
                      preset.type === "radial"
                        ? `radial-gradient(circle at ${
                            preset.position?.x ?? 50
                        }% ${preset.position?.y ?? 50}%, ${stopsStr})`
                        : `linear-gradient(${preset.angle}deg, ${stopsStr})`;

                    return (
                      <GradientStyleButton
                        key={preset.id}
                        $selected={selectedGradientStyle?.id === preset.id}
                        $gradient={previewCss}
                        onClick={() => setSelectedGradientStyle(preset)}
                        title={preset.label}
                        type="button"
                      />
                    );
                  })}
                </GradientStyleRow>

                <ColorStopsLabel>Gradient colors</ColorStopsLabel>
                <ColorStopsRow>
                  {gradientStops.map((stop) => (
                    <ColorStopWrapper
                      key={stop.id}
                      className={selectedStopId === stop.id ? "selected" : ""}
                    >
                      <ColorStop
                        color={stop.color}
                        $selected={selectedStopId === stop.id}
                        onClick={() => setSelectedStopId(stop.id)}
                      />
                      {gradientStops.length > 2 && (
                        <RemoveButton
                          className="remove-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteColorStop(stop.id);
                          }}
                        >
                          ×
                        </RemoveButton>
                      )}
                    </ColorStopWrapper>
                  ))}
                  {gradientStops.length < 10 && (
                    <AddColorButton
                      onClick={handleAddColorStop}
                      type="button"
                      bgimage="/images/background/bg_first_item_plus.webp"
                    />
                  )}
                </ColorStopsRow>

                <ColorPickerArea>
                  <SketchPicker
                    color={selectedStopColor}
                    onChangeComplete={handleGradientColorChange}
                    disableAlpha={false}
                  />
                </ColorPickerArea>

                <BottomControls>
                  {gradientStops.length > 2 && (
                    <IconButton
                      type="button"
                      onClick={() => handleDeleteColorStop(selectedStopId)}
                      title="Delete selected color"
                    >
                      <FaTrash size={12} />
                    </IconButton>
                  )}
                  <InputGroup>
                    <ColorCircle color={selectedStop?.color || "#7681FFFF"} />
                    <HexInput
                      ref={hexInputRef}
                      type="text"
                      value={hexInputValue}
                      onChange={handleHexInputChange}
                      onBlur={handleHexInputBlur}
                      maxLength={7}
                      placeholder="FFFFFF"
                    />
                    <Separator />
                    <OpacityInput
                      type="number"
                      min="0"
                      max="100"
                      value={opacityInputValue}
                      onChange={handleOpacityInputChange}
                      onBlur={handleOpacityInputBlur}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#999",
                        paddingRight: "4px",
                      }}
                    >
                      %
                    </span>
                  </InputGroup>
                  <IconButton
                    type="button"
                    title="Edit color"
                    onClick={handleEditClick}
                  >
                    <FaPen size={11} />
                  </IconButton>
                </BottomControls>
              </GradientSection>
            )}
          </TabContent>
        </ColorPickerContent>
        </div>

        {showActions && ! ((activeTab === "solid"&& seeAllSolid) || (activeTab === "gradient" && seeAllGradient)) && (
          <div className="d-flex w-100 justify-content-between py-3 px-3">
            <LightPrimaryButton onClick={handleCancel}>
              Cancel
            </LightPrimaryButton>
            <PrimaryButton onClick={handleConfirm}>Apply Color</PrimaryButton>
          </div>
        )}
      </ColorPickerModalContainer>
    </ColorPickerModalOverlay>
  );
}

export default ColorPickerModal;
