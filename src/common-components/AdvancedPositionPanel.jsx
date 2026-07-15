import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { BsLock, BsUnlock } from "react-icons/bs";
import { useSelector } from "react-redux";
import { convertPxToUnit, convertUnitToPx, formatDecimal, UNIT_OPTIONS, DEFAULT_DPI, getPreferredUnit, setPreferredUnit } from "../library/utils/common-functions/unitConversion";
import { getCanvasSize } from "../library/utils/helpers/index.js";

const PanelWrapper = styled.div`
  background-color: #fff;
  overflow: hidden;

  @media (min-width: 768px) {
    padding: 0.5rem;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }

  @media (max-width: 767.98px) {
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e1e4e7;
    border-radius: 8px;
    margin-bottom: 12px;
    background-color: #fff;
  }
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #0d1216;
  margin-bottom: 12px;
`;

const InputGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 12px;
`;

const UnitSelectorWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

const UnitDropdown = styled.select`
  padding: 6px 10px;
  border: 1px solid #e1e4e7;
  border-radius: 4px;
  font-size: 12px;
  color: #0d1216;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 0.15rem rgba(25, 118, 210, 0.2);
    background: #fff;
  }

  &:hover {
    border-color: #cbd0d5;
  }
`;

const UnitLabel = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: #6c757d;
`;

const InputLabel = styled.label`
  font-size: 11px;
  font-weight: 500;
  color: #6c757d;
`;

const LockButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: ${(props) => (props.$locked ? "var(--primary)" : "#f8f9fa")};
  border: 1px solid ${(props) => (props.$locked ? "var(--primary)" : "#e1e4e7")};
  border-radius: 4px;
  color: ${(props) => (props.$locked ? "#fff" : "#495057")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.$locked ? "var(--primary)" : "#e9ecef")};
    border-color: ${(props) => (props.$locked ? "var(--primary)" : "#cbd0d5")};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.ratio-group {
    flex-direction: column;
    align-items: flex-start;

    ${InputLabel} {
      margin: 0;
    }
  }

  &.ratio-group ${LockButton} {
    width: 48px;
    height: 32px;
  }
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e1e4e7;
  border-radius: 4px;
  font-size: 12px;
  color: #0d1216;
  background: #f8f9fa;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 0.15rem rgba(25, 118, 210, 0.2);
    background: #fff;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  -moz-appearance: textfield;
`;

const PositionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

function AdvancedPositionPanel({
  width = 0,
  height = 0,
  x = 0,
  y = 0,
  onDimensionChange,
  className = "",
}) {
  const [widthValue, setWidthValue] = useState("");
  const [heightValue, setHeightValue] = useState("");
  const [xValue, setXValue] = useState("");
  const [yValue, setYValue] = useState("");
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(getPreferredUnit('cm'));
  
  const canvasSize = useSelector(getCanvasSize);
  const activeDpi = (canvasSize?.dpi && !isNaN(canvasSize.dpi))
    ? canvasSize.dpi
    : DEFAULT_DPI;

  useEffect(() => {
    if (!aspectRatioLocked && width && height) {
      setAspectRatio(width / height);
    }
  }, [width, height, aspectRatioLocked]);

  useEffect(() => {
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setWidthValue(formatDecimal(convertPxToUnit(width, selectedUnit, activeDpi), decimals).toString());
  }, [width, selectedUnit, activeDpi]);

  useEffect(() => {
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setHeightValue(formatDecimal(convertPxToUnit(height, selectedUnit, activeDpi), decimals).toString());
  }, [height, selectedUnit, activeDpi]);

  useEffect(() => {
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setXValue(formatDecimal(convertPxToUnit(x, selectedUnit, activeDpi), decimals).toString());
  }, [x, selectedUnit, activeDpi]);

  useEffect(() => {
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setYValue(formatDecimal(convertPxToUnit(y, selectedUnit, activeDpi), decimals).toString());
  }, [y, selectedUnit, activeDpi]);

  const handleUnitChange = useCallback((e) => {
    setSelectedUnit(e.target.value);
    setPreferredUnit(e.target.value); // share the choice with every other dialog
  }, []);

  const handleWidthChange = useCallback(
    (e) => {
      const value = e.target.value;
      setWidthValue(value);

      if (aspectRatioLocked && aspectRatio) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) return;

        const newWidthPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
        const newHeightPx = newWidthPx / aspectRatio;
        const decimals = selectedUnit === 'px' ? 0 : 2;
        setHeightValue(
          formatDecimal(convertPxToUnit(newHeightPx, selectedUnit, activeDpi), decimals).toString()
        );
      }
    },
    [aspectRatioLocked, aspectRatio, selectedUnit, activeDpi]
  );

  const handleHeightChange = useCallback(
    (e) => {
      const value = e.target.value;
      setHeightValue(value);

      if (aspectRatioLocked && aspectRatio) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) return;

        const newHeightPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
        const newWidthPx = newHeightPx * aspectRatio;
        const decimals = selectedUnit === 'px' ? 0 : 2;
        setWidthValue(
          formatDecimal(convertPxToUnit(newWidthPx, selectedUnit, activeDpi), decimals).toString()
        );
      }
    },
    [aspectRatioLocked, aspectRatio, selectedUnit, activeDpi]
  );

  const handleXChange = useCallback((e) => {
    setXValue(e.target.value);
  }, []);

  const handleYChange = useCallback((e) => {
    setYValue(e.target.value);
  }, []);

  const applyWidthValue = useCallback(() => {
    const numValue = parseFloat(widthValue);
    if (isNaN(numValue) || numValue < 0) return;

    const newWidthPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setWidthValue(formatDecimal(numValue, decimals).toString());

    if (aspectRatioLocked && aspectRatio) {
      const newHeightPx = newWidthPx / aspectRatio;
      setHeightValue(
        formatDecimal(convertPxToUnit(newHeightPx, selectedUnit, activeDpi), decimals).toString()
      );
      onDimensionChange?.({ width: newWidthPx, height: newHeightPx });
    } else {
      onDimensionChange?.({ width: newWidthPx });
    }
  }, [widthValue, aspectRatioLocked, aspectRatio, onDimensionChange, selectedUnit, activeDpi]);

  const applyHeightValue = useCallback(() => {
    const numValue = parseFloat(heightValue);
    if (isNaN(numValue) || numValue < 0) return;

    const newHeightPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
    const decimals = selectedUnit === 'px' ? 0 : 2;
    setHeightValue(formatDecimal(numValue, decimals).toString());

    if (aspectRatioLocked && aspectRatio) {
      const newWidthPx = newHeightPx * aspectRatio;
      setWidthValue(
        formatDecimal(convertPxToUnit(newWidthPx, selectedUnit, activeDpi), decimals).toString()
      );
      onDimensionChange?.({ width: newWidthPx, height: newHeightPx });
    } else {
      onDimensionChange?.({ height: newHeightPx });
    }
  }, [heightValue, aspectRatioLocked, aspectRatio, onDimensionChange, selectedUnit, activeDpi]);

  const applyXValue = useCallback(() => {
    const numValue = parseFloat(xValue);
    if (isNaN(numValue)) return;

    const decimals = selectedUnit === 'px' ? 0 : 2;
    setXValue(formatDecimal(numValue, decimals).toString());
    const newXPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
    onDimensionChange?.({ x: newXPx });
  }, [xValue, onDimensionChange, selectedUnit, activeDpi]);

  const applyYValue = useCallback(() => {
    const numValue = parseFloat(yValue);
    if (isNaN(numValue)) return;

    const decimals = selectedUnit === 'px' ? 0 : 2;
    setYValue(formatDecimal(numValue, decimals).toString());
    const newYPx = convertUnitToPx(numValue, selectedUnit, activeDpi);
    onDimensionChange?.({ y: newYPx });
  }, [yValue, onDimensionChange, selectedUnit, activeDpi]);

  const toggleAspectRatioLock = useCallback(() => {
    setAspectRatioLocked((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e, applyFn) => {
    if (e.key === "Enter") {
      applyFn();
      e.target.blur();
    }
  }, []);

  return (
    <PanelWrapper className={`advanced-position-panel ${className}`}>
      <SectionTitle>Transform</SectionTitle>

      <UnitSelectorWrapper>
        <UnitLabel>Unit:</UnitLabel>
        <UnitDropdown value={selectedUnit} onChange={handleUnitChange}>
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </UnitDropdown>
      </UnitSelectorWrapper>

      <InputGrid>
        <InputGroup>
          <InputLabel>Width</InputLabel>
          <StyledInput
            type="number"
            value={widthValue}
            onChange={handleWidthChange}
            onBlur={applyWidthValue}
            onKeyDown={(e) => handleKeyDown(e, applyWidthValue)}
            step={selectedUnit === 'px' ? '1' : '0.01'}
            min="0"
            placeholder={`0 ${selectedUnit}`}
          />
        </InputGroup>

        <InputGroup>
          <InputLabel>Height</InputLabel>
          <StyledInput
            type="number"
            value={heightValue}
            onChange={handleHeightChange}
            onBlur={applyHeightValue}
            onKeyDown={(e) => handleKeyDown(e, applyHeightValue)}
            step={selectedUnit === 'px' ? '1' : '0.01'}
            min="0"
            placeholder={`0 ${selectedUnit}`}
          />
        </InputGroup>

        <InputGroup className="ratio-group">
          <InputLabel>Ratio</InputLabel>
          <LockButton
            $locked={aspectRatioLocked}
            onClick={toggleAspectRatioLock}
            title={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {aspectRatioLocked ? <BsLock /> : <BsUnlock />}
          </LockButton>
        </InputGroup>
      </InputGrid>

      <PositionGrid>
        <InputGroup>
          <InputLabel>X</InputLabel>
          <StyledInput
            type="number"
            value={xValue}
            onChange={handleXChange}
            onBlur={applyXValue}
            onKeyDown={(e) => handleKeyDown(e, applyXValue)}
            step={selectedUnit === 'px' ? '1' : '0.01'}
            placeholder={`0 ${selectedUnit}`}
          />
        </InputGroup>

        <InputGroup>
          <InputLabel>Y</InputLabel>
          <StyledInput
            type="number"
            value={yValue}
            onChange={handleYChange}
            onBlur={applyYValue}
            onKeyDown={(e) => handleKeyDown(e, applyYValue)}
            step={selectedUnit === 'px' ? '1' : '0.01'}
            placeholder={`0 ${selectedUnit}`}
          />
        </InputGroup>
      </PositionGrid>
    </PanelWrapper>
  );
}

export default AdvancedPositionPanel;
