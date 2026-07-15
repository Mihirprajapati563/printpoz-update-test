import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { SketchPicker } from "react-color";

import styled from "styled-components";

import { FaTrash, FaPen } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

import {
  rgbaToHex,
  hexToRgba,
  generateGradientCompanion,
  MAX_GRADIENT_COLORS,
} from "../../utils/colorUtils";

import {
  GRADIENT_PRESETS,
  getLinearGradientCoords,
  getRadialGradientCoords,
  generateGradientCss,
  getPresetFromGradient,
} from "../../library/utils/helpers/gradientUtils";

const PickerWrapper = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  width: 250px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ContentWrapper = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 0 0 8px 8px;
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e6e6e6;
`;

const PickerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 6px 0;
`;

const CloseButton = styled.button`
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background: #f0f0f0;
    color: #333;
  }
`;

const ApplyButton = styled.button`
  display: block;
  width: calc(100% - 24px);
  margin: 0 12px 12px 12px;
  padding: 10px 0;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #356d95;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(64, 132, 181, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
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

  &:first-child {
    border-radius: 8px 0 0 0;
  }

  &:last-child {
    border-radius: 0 8px 0 0;
  }

  &:hover {
    background: ${(props) => (props.$active ? "#fff" : "#eee")};
  }
`;

const TabContent = styled.div`
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const GradientSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const ColorStopsLabel = styled.div`
  font-size: 13px;
  color: #333;
  font-weight: 500;
  padding: 12px 12px 8px 12px;
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
  border-radius: 8px;
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
  grid-template-columns: repeat(4, minmax(48px, 1fr));
  gap: 10px;
  padding: 10px;
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
  max-width: 100%;
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



const GradientStyleLabel = styled.div`
  font-size: 12px;
  color: #333;
  font-weight: 500;
  padding: 8px 12px 4px 12px;
`;

const GradientStyleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 8px 12px;
`;

const GradientStyleButton = styled.button`
  width: 35px;
  height: 35px;
  border-radius: 5px;
  border: 2px solid ${(props) => (props.$selected ? "var(--primary)" : "transparent")};
  cursor: pointer;
  flex-shrink: 0;
  background: ${(props) => props.$gradient};
  box-shadow: ${(props) =>
    props.$selected
      ? "0 0 0 2px rgba(64,132,181,0.3), 0 1px 3px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.15)"};
  transition: all 0.15s ease;
  padding: 0;

  &:hover {
    transform: scale(1.08);
  }
`;

const ColorStopsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 12px 12px;
  overflow-x: auto;
  max-width: 100%;
  /* Hide scrollbar but keep scroll functionality */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */

  &::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }
`;

const ColorStopWrapper = styled.div`
  position: relative;
  flex-shrink: 0;

  /* Show remove button on hover or when selected */
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
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
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
  /* Hidden by default, shown on parent hover */
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
  box-sizing: border-box;
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

  .sketch-picker {
    box-shadow: none !important;
    padding: 0 !important;
    width: 100% !important;
    border-radius: 0 !important;
  }

  /* Hide the hex/RGB input fields row */
  .sketch-picker > div:nth-child(3) {
    display: none !important;
  }

  /* Hide the preset colors row */
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

  /* Hide number input spinners */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  -moz-appearance: textfield;
`;

const getInitialColor = (color) => {
  if (typeof color === "string") {
    return hexToRgba(color);
  }
  return color || { r: 0, g: 0, b: 0, a: 1 };
};

const redistributeStops = (stops) => {
  const totalStops = stops.length;

  return stops.map((stop, index) => ({
    ...stop,
    position: Math.round((index / (totalStops - 1)) * 100),
  }));
};

const ColorPickerWithOpacity = ({
  color,
  onChange,
  onGradientChange,
  hasBackgroundImage = false,
  initialGradient = null,
  externalGradientHistory = [],
  externalSolidColorHistory = [],
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(() => {
    if (
      initialGradient &&
      initialGradient.stops &&
      initialGradient.stops.length >= 2
    ) {
      return "gradient";
    }
    return "solid";
  });

  const [hasUserInteractedWithGradient, setHasUserInteractedWithGradient] =
    useState(false);
  const [hasUserChangedSolidColor, setHasUserChangedSolidColor] =
    useState(false);
  const [currentColor, setCurrentColor] = useState(() =>
    getInitialColor(color)
  );
  const [selectedStopId, setSelectedStopId] = useState(1);
  const [hexInputValue, setHexInputValue] = useState("");
  const [opacityInputValue, setOpacityInputValue] = useState("");
  const [gradientHistory, setGradientHistory] = useState(() => [...externalGradientHistory]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  const pickerRef = useRef(null);

  const [solidColorHistory, setSolidColorHistory] = useState(() => {
    const hist = [...externalSolidColorHistory];
    const currentHex = typeof color === "string" ? color : null;
    if (currentHex && !hist.some((h) => h.color === currentHex)) {
      hist.push({ id: Date.now(), color: currentHex });
    }
    return hist;
  });
  const [selectedSolidHistoryIndex, setSelectedSolidHistoryIndex] = useState(() => {
    const hist = [...externalSolidColorHistory];
    const currentHex = typeof color === "string" ? color : null;
    if (currentHex && !hist.some((h) => h.color === currentHex)) {
      hist.push({ id: Date.now(), color: currentHex });
    }
    return hist.findIndex((h) => h.color === currentHex);
  });
  
  const [selectedGradientStyle, setSelectedGradientStyle] = useState(() =>
    getPresetFromGradient(initialGradient)
  );

  const [seeAllSolid, setSeeAllSolid] = useState(false);
  const [seeAllGradient, setSeeAllGradient] = useState(false);

  const hexInputRef = useRef(null);
  const initializedRef = useRef(false);
  const savedGradientRef = useRef(null);

  const [gradientStops, setGradientStops] = useState([
    { id: 1, color: "#0000FFFF", position: 0 },
    {
      id: 2,
      color: generateGradientCompanion("#0000FF") + "FF",
      position: 100,
    },
  ]);

  const baseHex = useMemo(() => {
    if (typeof currentColor === "object" && currentColor.r !== undefined) {
      return rgbaToHex(currentColor.r, currentColor.g, currentColor.b, 1).slice(
        0,
        7
      );
    }
    if (typeof color === "string") {
      return color.slice(0, 7);
    }
    return "#0000FF";
  }, [color, currentColor]);

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

    const angle = selectedGradientStyle?.angle ?? 180;
    return `linear-gradient(${angle}deg, ${stopsStr})`;
  }, [gradientStops, selectedGradientStyle]);

  useEffect(() => {
    if (
      !initializedRef.current &&
      initialGradient &&
      initialGradient.stops &&
      initialGradient.stops.length >= 2
    ) {
      const mappedStops = initialGradient.stops.map((stop, index) => ({
        id: index + 1,
        color: stop.color,
        position: stop.position,
      }));

      setGradientStops(mappedStops);
      savedGradientRef.current = mappedStops;

      const gradientType = initialGradient?.type || "linear";
      const gradientAngle = initialGradient?.angle ?? 180;
      const gradientRadialPosition = initialGradient?.radialPosition || { x: 50, y: 50 };

      const sortedStops = [...mappedStops].sort((a, b) => a.position - b.position);
      const stopsStr = sortedStops.map((s) => `${s.color.slice(0, 7)} ${s.position}%`).join(", ");
      const initialCss =
        gradientType === "radial"
          ? `radial-gradient(circle at ${gradientRadialPosition.x ?? 50}% ${gradientRadialPosition.y ?? 50}%, ${stopsStr})`
          : `linear-gradient(${gradientAngle}deg, ${stopsStr})`;

      const initialHistoryItem = {
        id: Date.now(),
        stops: mappedStops,
        type: gradientType,
        angle: gradientAngle,
        radialPosition: gradientRadialPosition,
        css: initialCss,
      };

      setGradientHistory((prev) => {
        const isDuplicate = prev.some((h) => h.css === initialCss);
        if (isDuplicate) {
          setSelectedHistoryIndex(prev.findIndex((h) => h.css === initialCss));
          return prev;
        }
        setSelectedHistoryIndex(prev.length);
        return [...prev, initialHistoryItem];
      });
      initializedRef.current = true;
    }
  }, [initialGradient]);

  // Sync currentColor with prop
  useEffect(() => {
    if (typeof color === "string") {
      setCurrentColor(hexToRgba(color));
    } else if (color && color.r !== undefined) {
      setCurrentColor(color);
    }
  }, [color]);

  // Update gradient stops when baseHex changes (only in solid tab)
  useEffect(() => {
    if (activeTab === "solid" && !initialGradient) {
      setGradientStops((prevStops) => {
        const newStops = [...prevStops];
        if (newStops[0]) {
          newStops[0] = { ...newStops[0], color: baseHex + "FF" };
        }
        if (newStops[1]) {
          newStops[1] = {
            ...newStops[1],
            color: generateGradientCompanion(baseHex) + "FF",
          };
        }
        return newStops;
      });
    }
  }, [baseHex, activeTab, initialGradient]);

  // Notify parent when gradient changes
  useEffect(() => {
    if (activeTab === "gradient" && onGradientChange) {
      if (hasBackgroundImage && !hasUserInteractedWithGradient) {
        return;
      }
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
      onGradientChange(gradientData);
    }
  }, [
    gradientStops,
    activeTab,
    onGradientChange,
    gradientCss,
    hasBackgroundImage,
    hasUserInteractedWithGradient,
    selectedGradientStyle,
  ]);

  // Sync hex/opacity input values with selected stop
  useEffect(() => {
    if (selectedStop) {
      setHexInputValue(
        selectedStop.color.replace("#", "").slice(0, 6).toUpperCase()
      );
      const opacity = Math.round(hexToRgba(selectedStop.color).a * 100);
      setOpacityInputValue(opacity.toString());
    }
  }, [selectedStop?.color, selectedStop?.id]);

  const handleColorChange = useCallback(
    (colorObj) => {
      const { r, g, b, a } = colorObj.rgb;
      const hexColorWithOpacity = rgbaToHex(r, g, b, a);
      setCurrentColor(colorObj.rgb);
      setHasUserChangedSolidColor(true);
      onChange(hexColorWithOpacity);
    },
    [onChange]
  );

  const handleGradientColorChange = useCallback(
    (colorObj) => {
      const { r, g, b, a } = colorObj.rgb;
      const hexColor = rgbaToHex(r, g, b, a);
      setHasUserInteractedWithGradient(true);
      setGradientStops((stops) =>
        stops.map((stop) =>
          stop.id === selectedStopId ? { ...stop, color: hexColor } : stop
        )
      );
    },
    [selectedStopId]
  );

  const handleAddColorStop = useCallback(() => {
    if (gradientStops.length >= MAX_GRADIENT_COLORS) {
      return;
    }
    setHasUserInteractedWithGradient(true);
    const newId = Math.max(...gradientStops.map((s) => s.id)) + 1;
    const lastStop = gradientStops[gradientStops.length - 1];
    const lastStopHex = lastStop?.color?.slice(0, 7) || baseHex;
    const newStop = {
      id: newId,
      color: lastStopHex + "FF",
      position: 100,
      isUserAdded: true,
    };
    setGradientStops(redistributeStops([...gradientStops, newStop]));
    setSelectedStopId(newId);
  }, [gradientStops, baseHex]);

  const handleDeleteColorStop = useCallback(
    (stopIdToDelete = selectedStopId) => {
      if (gradientStops.length <= 2) return;
      setHasUserInteractedWithGradient(true);
      const filteredStops = gradientStops.filter(
        (stop) => stop.id !== stopIdToDelete
      );
      const redistributedStops = redistributeStops(filteredStops);
      setGradientStops(redistributedStops);
      if (stopIdToDelete === selectedStopId) {
        setSelectedStopId(null);
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
        setHasUserInteractedWithGradient(true);
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
        setHasUserInteractedWithGradient(true);
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

  const handleSolidHistoryItemClick = useCallback(
    (index) => {
      const historyItem = solidColorHistory[index];
      if (!historyItem) return;
      setSelectedSolidHistoryIndex(index);
      const rgbaColor = hexToRgba(historyItem.color);
      setCurrentColor(rgbaColor);
      setHasUserChangedSolidColor(true);
      onChange(historyItem.color);
    },
    [solidColorHistory, onChange]
  );

  const handleTabClick = useCallback(
    (e, tab) => {
      e.preventDefault();
      e.stopPropagation();

      if (tab === "solid" && activeTab === "gradient") {
        if (gradientStops.length >= 2 && hasUserInteractedWithGradient) {
          const newHistoryItem = {
            id: Date.now(),
            stops: [...gradientStops],
            type: selectedGradientStyle?.type || "linear",
            angle: selectedGradientStyle?.angle ?? 180,
            radialPosition: selectedGradientStyle?.position || { x: 50, y: 50 },
            css: gradientCss,
          };
          const isDuplicate = gradientHistory.some((item) => item.css === gradientCss);
          if (!isDuplicate) {
            setGradientHistory((prev) => [...prev, newHistoryItem]);
          }
          savedGradientRef.current = [...gradientStops];
        }

        if (gradientStops.length > 0 && hasUserInteractedWithGradient) {
          const firstStopColor = gradientStops[0].color;
          const rgbaColor = hexToRgba(firstStopColor);
          setCurrentColor(rgbaColor);
          onChange(firstStopColor);
        }
        setHasUserChangedSolidColor(false);
      } else if (tab === "gradient" && activeTab === "solid") {
        // Save current solid color to history when switching to gradient
        if (hasUserChangedSolidColor && baseHex) {
          const solidHexFull = baseHex + "FF";
          const isDuplicateSolid = solidColorHistory.some((h) => h.color === solidHexFull || h.color.slice(0, 7) === baseHex);
          if (!isDuplicateSolid) {
            const newSolidItem = { id: Date.now(), color: solidHexFull };
            setSolidColorHistory((prev) => [...prev, newSolidItem]);
            setSelectedSolidHistoryIndex(solidColorHistory.length);
          }
        }

        if (hasUserChangedSolidColor) {
          const newGradientStops = [
            { id: 1, color: baseHex + "FF", position: 0 },
            { id: 2, color: generateGradientCompanion(baseHex) + "FF", position: 100 },
          ];
          setGradientStops(newGradientStops);
          setSelectedStopId(1);
          setHasUserInteractedWithGradient(true);
          setSelectedHistoryIndex(-1);
          savedGradientRef.current = null;
        } else if (savedGradientRef.current && savedGradientRef.current.length >= 2) {
          setGradientStops(savedGradientRef.current);
          setSelectedStopId(savedGradientRef.current[0].id);
          setHasUserInteractedWithGradient(true);
        }
      }
      setActiveTab(tab);
    },
    [
      activeTab,
      gradientStops,
      onChange,
      hasUserChangedSolidColor,
      hasUserInteractedWithGradient,
      baseHex,
      gradientCss,
      gradientHistory,
      solidColorHistory,
    ]
  );

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
        setHasUserInteractedWithGradient(true);

        // Restore the gradient style (type, angle, radialPosition)
        if (historyItem.type || historyItem.angle !== undefined) {
          // Find the matching preset or create a custom style object
          const restoredStyle = {
            id:
              historyItem.type === "radial"
                ? `radial-${historyItem.radialPosition?.x ?? 50}`
                : `linear-${historyItem.angle ?? 180}`,
            type: historyItem.type || "linear",
            angle: historyItem.angle ?? 180,
            position: historyItem.radialPosition || { x: 50, y: 50 },
            label: historyItem.type === "radial" ? "Radial" : "Linear",
          };
          setSelectedGradientStyle(restoredStyle);
        }
      }
    },
    [gradientHistory]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        if (onClose) onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if(activeTab === "solid") {
      setSeeAllSolid(false);
    } else if(activeTab === "gradient") {
      setSeeAllGradient(false);
    }
  }, [activeTab]);

  const reversedSolidHistory = [...solidColorHistory].reverse();
  const reversedGradientHistory = [...gradientHistory].reverse();

  return (
    <PickerWrapper ref={pickerRef} onClick={(e) => e.stopPropagation()}>
      <PickerHeader>
        <CloseButton type="button" onClick={onClose} title="Close">
          <IoClose />
        </CloseButton>
      </PickerHeader>
      <TabsContainer>
        <Tab
          $active={activeTab === "solid"}
          onClick={(e) => handleTabClick(e, "solid")}
          type="button"
        >
          Solid
        </Tab>
        <Tab
          $active={activeTab === "gradient"}
          onClick={(e) => handleTabClick(e, "gradient")}
          type="button"
        >
          Gradient
        </Tab>
      </TabsContainer>

      <ContentWrapper>
      {/* See All Solid Colors Overlay */}
      {seeAllSolid && activeTab === "solid" && activeTab !== "gradient" && (
        <SeeAllOverlay onClick={(e) => e.stopPropagation()}>
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
                  $gradient={item.color}
                  style={{ background: item.color }}
                  $selected={selectedSolidHistoryIndex === originalIndex}
                  onClick={() => { handleSolidHistoryItemClick(originalIndex); setSeeAllSolid(false); }}
                  title={item.color}
                />
              );
            })}
          </SeeAllGrid>
        </SeeAllOverlay>
      )}

      {/* See All Gradient Colors Overlay */}
      {seeAllGradient && activeTab === "gradient" && activeTab !== "solid" && (
        <SeeAllOverlay onClick={(e) => e.stopPropagation()}>
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
                <GradientHistoryItem
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

      <TabContent>
        {activeTab === "solid" ? (
          <>
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
                        $gradient={item.color}
                        style={{ background: item.color }}
                        $selected={selectedSolidHistoryIndex === originalIndex}
                        onClick={() => handleSolidHistoryItemClick(originalIndex)}
                        title={item.color}
                      />
                    );
                  })}
                </GradientHistoryRow>
              </>
            )}
            <SketchPicker
              color={currentColor}
              onChange={handleColorChange}
              disableAlpha={false}
              width="calc(100% - 4px)"
              styles={{
                default: {
                  picker: {
                    boxShadow: 'none',
                    padding: '0px 0px 12px 0px',
                    margin: '0 2px',
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'transparent'
                  },
                  saturation: {
                    width: '100%',
                    paddingBottom: '75%',
                    position: 'relative'
                  },
                  controls: {
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%'
                  }
                }
              }}
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

            {/* Gradient Style Selector */}
            <GradientStyleLabel>Styles</GradientStyleLabel>
            <GradientStyleRow>
              {GRADIENT_PRESETS.map((preset) => {
                const previewStops = gradientStops
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map(
                    (s) => `${s.color?.slice(0, 7) || s.color} ${s.position}%`
                  )
                  .join(", ");
                const previewCss =
                  preset.type === "radial"
                    ? `radial-gradient(circle at ${preset.position?.x ?? 50}% ${
                        preset.position?.y ?? 50
                      }%, ${previewStops})`
                    : `linear-gradient(${preset.angle}deg, ${previewStops})`;
                return (
                  <GradientStyleButton
                    key={preset.id}
                    type="button"
                    $selected={selectedGradientStyle?.id === preset.id}
                    $gradient={previewCss}
                    title={preset.label}
                    onClick={() => {
                      setSelectedGradientStyle(preset);
                      setHasUserInteractedWithGradient(true);
                    }}
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
                  title={`Add color (${gradientStops.length}/10)`}
                />
              )}
            </ColorStopsRow>

            <ColorPickerArea>
              <SketchPicker
                color={selectedStopColor}
                onChangeComplete={handleGradientColorChange}
                disableAlpha={false}
                width="calc(100% - 4px)"
                styles={{
                  default: {
                    picker: {
                      boxShadow: 'none',
                      padding: '0px 0px 12px 0px',
                      margin: '0 2px',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'transparent'
                    },
                    saturation: {
                      width: '100%',
                      paddingBottom: '75%',
                      position: 'relative'
                    },
                    controls: {
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%'
                    }
                  }
                }}
              />
            </ColorPickerArea>

            <BottomControls>
              {gradientStops.length > 2 && (
                <IconButton
                  onClick={() => handleDeleteColorStop()}
                  type="button"
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
      </ContentWrapper>
      {onClose && (
        <ApplyButton type="button" onClick={onClose}>
          Apply
        </ApplyButton>
      )}
    </PickerWrapper>
  );
};

export default ColorPickerWithOpacity;
