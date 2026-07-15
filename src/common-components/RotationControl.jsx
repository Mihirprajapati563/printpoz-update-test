import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import styled from "styled-components";
import { Form } from "react-bootstrap";
import { GrPowerReset } from "react-icons/gr";
import { MdRotateRight } from "react-icons/md";

const ROTATION_PRESETS = [0, 45, 90, 135, 180, 225, 270, 315];

const RotationWrapper = styled.div`
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
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
`;

const PresetButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  background: ${(props) => (props.$active ? "var(--primary)" : "#ffffff")};
  border: 1px solid
    ${(props) => (props.$active ? "var(--primary)" : "#e1e4e7")};
  border-radius: 4px;
  color: ${(props) => (props.$active ? "#fff" : "#0d1216")};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 30px;
  width: 100%;

  &:hover {
    background: ${(props) =>
      props.$active ? "var(--primary)" : "#f1f2f4"};
    border-color: ${(props) =>
      props.$active ? "var(--primary)" : "#cbd0d5"};
  }

  &:active {
    transform: translateY(0);
  }
`;

const CustomInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  .rotation-input {
    flex: 1;
    background: #f8f9fa;
    border: 1px solid #e1e4e7;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    color: #0d1216;
    text-align: center;
    transition: all 0.2s ease;
    min-height: 32px;

    &:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 0.15rem rgba(25, 118, 210, 0.2);
      background: #fff;
    }

    /* Hide number input arrows */
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    -moz-appearance: textfield;
  }

  .unit-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 500;
    min-width: 14px;
  }
`;

const ResetButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  
  background: #f8f9fa;
  border: 1px solid #e1e4e7;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: #495057;
  transition: all 0.2s ease;
  min-height: 28px;

  &:hover {
    background: #e9ecef;
    border-color: #cbd0d5;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const SliderRow = styled.div`
  margin-top: 8px;

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
`;

function RotationControl({ rotation = 0, onRotationChange, className = "" }) {
  const [customInputValue, setCustomInputValue] = useState("");
  const [isCustomInputFocused, setIsCustomInputFocused] = useState(false);

  // Normalize rotation to 0-359 range for display
  const normalizedRotation = useMemo(() => {
    const angle = ((rotation % 360) + 360) % 360;
    return Math.round(angle * 100) / 100;
  }, [rotation]);

  // ── Smooth slider drag ────────────────────────────────────────────────────
  // The range slider fires onChange on every pixel of movement. Dispatching a
  // full (history-recording) Redux update per tick floods the 300-step undo
  // stack and re-renders the whole canvas on every event → stutter. Mirror the
  // canvas rotate gesture (ItemDragger onRotate → onRotateEnd): keep the thumb
  // on LOCAL state for instant feedback, push canvas updates at most once per
  // animation frame with history:false (no undo snapshot), and commit ONE
  // history:true checkpoint when the drag ends → a single clean undo step for
  // the whole gesture instead of one per tick.
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(normalizedRotation);
  const draggingRef = useRef(false);
  const latestValueRef = useRef(normalizedRotation);
  const rafRef = useRef(null);

  // While NOT actively dragging, follow external rotation changes (presets,
  // custom input, canvas rotate handle) so the thumb stays in sync.
  useEffect(() => {
    if (!draggingRef.current) {
      setDragValue(normalizedRotation);
      latestValueRef.current = normalizedRotation;
    }
  }, [normalizedRotation]);

  // Cancel any pending frame on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Value shown by the slider/inputs: the live drag value while dragging,
  // otherwise the committed (normalized) rotation.
  const displayRotation = isDragging ? dragValue : normalizedRotation;

  // rAF-throttled live canvas update — coalesces many onChange events into at
  // most one dispatch per frame and records NO undo snapshot.
  const scheduleLiveDispatch = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      onRotationChange(latestValueRef.current, { history: false });
    });
  }, [onRotationChange]);

  // Commit the gesture: flush the final angle as ONE history step.
  const commitSliderDrag = useCallback(() => {
    if (!draggingRef.current) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    draggingRef.current = false;
    setIsDragging(false);
    onRotationChange(latestValueRef.current, { history: true });
  }, [onRotationChange]);

  // Handle preset button click
  const handlePresetClick = useCallback(
    (angle) => {
      onRotationChange(angle);
    },
    [onRotationChange]
  );

  // Handle slider change (live, throttled — no undo snapshot per tick)
  const handleSliderChange = useCallback(
    (e) => {
      const angle = Number(e.target.value);
      latestValueRef.current = angle;
      setDragValue(angle); // synchronous → thumb tracks the pointer, no snap-back
      if (!draggingRef.current) {
        draggingRef.current = true;
        setIsDragging(true);
      }
      scheduleLiveDispatch();
    },
    [scheduleLiveDispatch]
  );

  // Commit when the pointer is released ANYWHERE (handles the common case of
  // dragging the thumb and releasing outside the slider track). The listener is
  // only mounted during an active drag.
  useEffect(() => {
    if (!isDragging) return undefined;
    const handleUp = () => commitSliderDrag();
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isDragging, commitSliderDrag]);

  // Track whether the field was actually edited since focus (vs a focus→blur
  // with no typing) and whether the edit was cancelled (Escape). Enter and
  // Escape both finish through blur, so applyCustomInputValue is the single
  // commit path — it records at most ONE undo step for a real edit and NONE for
  // a no-op focus/blur or a cancel.
  const inputDirtyRef = useRef(false);
  const inputCancelledRef = useRef(false);

  // Handle custom input change (only update local state while typing)
  const handleCustomInputChange = useCallback((e) => {
    inputDirtyRef.current = true;
    setCustomInputValue(e.target.value);
  }, []);

  // Handle custom input focus
  const handleCustomInputFocus = useCallback(() => {
    inputDirtyRef.current = false;
    inputCancelledRef.current = false;
    setCustomInputValue(String(Math.round(normalizedRotation)));
    setIsCustomInputFocused(true);
  }, [normalizedRotation]);

  // Apply custom input value on blur (Enter / Escape both route here via blur).
  const applyCustomInputValue = useCallback(() => {
    const parsedValue = parseFloat(customInputValue);
    // Commit only a real, un-cancelled edit → one undo step. A focus/blur with
    // no typing, or an Escape, records nothing.
    if (inputDirtyRef.current && !inputCancelledRef.current && !isNaN(parsedValue)) {
      // Normalize to 0-359 range
      const normalizedAngle = ((parsedValue % 360) + 360) % 360;
      onRotationChange(normalizedAngle);
    }
    inputDirtyRef.current = false;
    inputCancelledRef.current = false;
    setIsCustomInputFocused(false);
    setCustomInputValue("");
  }, [customInputValue, onRotationChange]);

  // Handle Enter / Escape in custom input. Both finish by blurring the field so
  // the single onBlur handler applies the value exactly once (Enter) or discards
  // it (Escape) — no direct apply() call, which previously double-fired via the
  // synchronous blur re-entry and recorded a redundant undo step.
  const handleCustomInputKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      inputCancelledRef.current = true;
      e.target.blur();
    }
  }, []);

  // Reset rotation to 0
  const handleReset = useCallback(() => {
    onRotationChange(0);
  }, [onRotationChange]);

  // Check if a preset is currently active (follows the live value while dragging)
  const isPresetActive = useCallback(
    (angle) => {
      return Math.abs(displayRotation - angle) < 0.5;
    },
    [displayRotation]
  );

  return (
    <RotationWrapper className={`rotation-control ${className}`}>
      {/* Header */}
      <SectionTitle>
        <div className="d-flex align-items-center gap-1">
          <MdRotateRight size={16} />
          Rotate
        </div>
        <ResetButton
          onClick={handleReset}
          title="Reset rotation to 0°"
          disabled={normalizedRotation === 0}
        >
          <GrPowerReset />
        </ResetButton>
      </SectionTitle>

      {/* Preset Angle Buttons */}
      <PresetGrid>
        {ROTATION_PRESETS.map((angle) => (
          <PresetButton
            key={angle}
            $active={isPresetActive(angle)}
            onClick={() => handlePresetClick(angle)}
            title={`Rotate to ${angle}°`}
          >
            {angle}°
          </PresetButton>
        ))}
      </PresetGrid>

      {/* Custom Input */}
      <CustomInputRow>
        <input
          type="number"
          className="rotation-input"
          value={
            isCustomInputFocused
              ? customInputValue
              : Math.round(displayRotation)
          }
          onChange={handleCustomInputChange}
          onFocus={handleCustomInputFocus}
          onBlur={applyCustomInputValue}
          onKeyDown={handleCustomInputKeyDown}
          min={0}
          max={360}
          step={1}
          placeholder="0"
          title="Enter custom rotation angle"
          aria-label="Custom rotation angle in degrees"
        />
        <span className="unit-label">deg</span>
      </CustomInputRow>

      {/* Slider */}
      <SliderRow>
        <Form.Range
          value={displayRotation}
          onChange={handleSliderChange}
          onPointerUp={commitSliderDrag}
          onKeyUp={commitSliderDrag}
          onBlur={commitSliderDrag}
          min={0}
          max={359}
          step={1}
          title={`Rotation: ${Math.round(displayRotation)}°`}
          aria-label="Rotation angle slider"
        />
      </SliderRow>
    </RotationWrapper>
  );
}

export default RotationControl;
