import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { setCurrentObjectProperties } from "../../../store/slices/canvas";
import {
  getActiveObjectprops,
  getActiveSafeArea,
  getActiveSideBounds,
  calculateAlignmentPosition,
  ALIGNMENT_TYPES,
} from "../../../library/utils/helpers";
import RotationControl from "../../../common-components/RotationControl";
import AdvancedPositionPanel from "../../../common-components/AdvancedPositionPanel";
import { applyDimensionChange } from "../../../library/utils/common-functions/objectResize";

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #0d1216;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ButtonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
`;

const AlignButton = styled.button`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #e1e4e7;
  border-radius: 4px;
  color: #0d1216;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
  width: 100%;
  
  &:hover {
    background: #f1f2f4;
    border-color: #cbd0d5;
  }
  
  &:active {
    background: #e1e4e7;
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #ffffff;
    border-color: #e1e4e7;
    color: #8898aa;
    
    svg {
      color: #8898aa;
    }
  }

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: #495057;
  }
`;

const PanelContainer = styled.div`
  background-color: #fff;
  overflow: hidden;

  /* Desktop Styles (Default) */
  @media (min-width: 768px) {
    padding: 0.5rem;
    box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.075);
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }

  /* Mobile Styles */
  @media (max-width: 767.98px) {
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e1e4e7;
    border-radius: 8px;
    margin-bottom: 12px;
    background-color: #fff;
  }
`;

const SettingsPanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  /* Mobile Styles */
  @media (max-width: 767.98px) {
    gap: 12px;
  }

  /* Desktop Styles */
  @media (min-width: 768px) {
    gap: 8px;
  }
`;

const AlignTopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="8" y="9" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AlignMiddleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="8" y="7" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AlignBottomIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 19H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="8" y="5" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AlignLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="9" y="8" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AlignCenterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 17V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="7" y="8" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const AlignRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="5" y="8" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function PositionSettingsPanel({ className = "" }) {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const activeSideBounds = useSelector(getActiveSideBounds);
  const activeSafeArea = useSelector(getActiveSafeArea);

  const getContainerBounds = () => {
    const isInSafeArea = activeObjectProps?.areaType === "safeArea" && activeSafeArea;

    if (isInSafeArea && activeSafeArea) {
      return {
        size: {
          width: activeSafeArea.width,
          height: activeSafeArea.height
        },
        offset: {
          x: activeSafeArea.left || 0,
          y: activeSafeArea.top || 0
        }
      };
    }

    return {
      size: activeSideBounds.size,
      offset: activeSideBounds.offset
    };
  };

  const handleAlignment = (alignmentType) => {
    if (!activeObjectProps) return;

    const { size, offset } = getContainerBounds();

    const newPosition = calculateAlignmentPosition(
      alignmentType,
      activeObjectProps,
      size,
      offset
    );

    if (Object.keys(newPosition).length > 0) {
      dispatch(
        setCurrentObjectProperties({
          transform: {
            ...activeObjectProps.transform,
            ...newPosition
          }
        })
      );
    }
  };

  const checkIsAligned = (alignmentType) => {
    if (!activeObjectProps) return false;

    const { size, offset } = getContainerBounds();
    
    const targetPos = calculateAlignmentPosition(
      alignmentType,
      activeObjectProps,
      size,
      offset
    );

    if (!targetPos) return false;

    const TOLERANCE = 1;
    
    if (targetPos.x !== undefined) {
      return Math.abs(activeObjectProps.transform.x - targetPos.x) < TOLERANCE;
    }
    
    if (targetPos.y !== undefined) {
      return Math.abs(activeObjectProps.transform.y - targetPos.y) < TOLERANCE;
    }

    return false;
  };

  const alignmentOptions = [
    {
      id: 'top',
      label: 'Top',
      icon: <AlignTopIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.VERTICAL.TOP),
      disabled: checkIsAligned(ALIGNMENT_TYPES.VERTICAL.TOP)
    },
    {
      id: 'left',
      label: 'Left',
      icon: <AlignLeftIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.HORIZONTAL.LEFT),
      disabled: checkIsAligned(ALIGNMENT_TYPES.HORIZONTAL.LEFT)
    },
    {
      id: 'middle',
      label: 'Middle',
      icon: <AlignMiddleIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.VERTICAL.MIDDLE),
      disabled: checkIsAligned(ALIGNMENT_TYPES.VERTICAL.MIDDLE)
    },
    {
      id: 'center',
      label: 'Center',
      icon: <AlignCenterIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.HORIZONTAL.CENTER),
      disabled: checkIsAligned(ALIGNMENT_TYPES.HORIZONTAL.CENTER)
    },
    {
      id: 'bottom',
      label: 'Bottom',
      icon: <AlignBottomIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.VERTICAL.BOTTOM),
      disabled: checkIsAligned(ALIGNMENT_TYPES.VERTICAL.BOTTOM)
    },
    {
      id: 'right',
      label: 'Right',
      icon: <AlignRightIcon />,
      action: () => handleAlignment(ALIGNMENT_TYPES.HORIZONTAL.RIGHT),
      disabled: checkIsAligned(ALIGNMENT_TYPES.HORIZONTAL.RIGHT)
    }
  ];

  // Handle rotation angle change.
  // `options.history === false` marks a live slider-drag tick: the canvas
  // updates in real time but NO undo snapshot is recorded (mirrors the canvas
  // rotate gesture). Committed changes (drag end, presets, custom input, reset)
  // omit the flag and record a single undo step — identical to the prior
  // behavior, so the undo stack sees one clean entry per gesture.
  const handleRotationChange = useCallback(
    (angle, options) => {
      if (!activeObjectProps?.transform) {
        return;
      }

      const payload = {
        transform: {
          ...activeObjectProps.transform,
          rotation: angle,
        },
      };
      // Live slider tick → history:false (no undo snapshot). Drag-end commit →
      // history:true (one undo step, and clears the last tick's false flag, so
      // the object ends up exactly like a canvas rotate-handle gesture).
      // Presets / custom input / reset pass no flag → recorded as before with no
      // extra field written onto the object.
      if (options?.history === false) {
        payload.history = false;
      } else if (options?.history === true) {
        payload.history = true;
      }

      dispatch(setCurrentObjectProperties(payload));
    },
    [dispatch, activeObjectProps]
  );

  // Handle advanced dimension and position changes
  const handleAdvancedChange = useCallback(
    (changes) => {
      if (!activeObjectProps) return;

      let payload = {};

      // Handle dimension changes (width/height) with proper object type logic
      if (changes.width !== undefined || changes.height !== undefined) {
        const newWidth = changes.width !== undefined ? changes.width : activeObjectProps.width;
        const newHeight = changes.height !== undefined ? changes.height : activeObjectProps.height;

        // Use applyDimensionChange to handle image scaling and text constraints
        const dimensionPayload = applyDimensionChange(
          activeObjectProps,
          newWidth,
          newHeight
        );

        payload = { ...payload, ...dimensionPayload };
      }

      // Handle position changes (x/y)
      if (changes.x !== undefined || changes.y !== undefined) {
        payload.transform = {
          ...activeObjectProps.transform,
        };

        if (changes.x !== undefined) {
          payload.transform.x = changes.x;
        }

        if (changes.y !== undefined) {
          payload.transform.y = changes.y;
        }
      }

      dispatch(setCurrentObjectProperties(payload));
    },
    [dispatch, activeObjectProps]
  );

  if (!activeObjectProps) {
    return null;
  }

  return (
    <SettingsPanelWrapper className={`position-settings-wrapper ${className}`}>
      <PanelContainer className={`align-position-panel`}>
        <SectionTitle>
          Align to page
        </SectionTitle>

        <ButtonGrid>
          {alignmentOptions.map((option) => (
            <AlignButton
              key={option.id}
              onClick={option.action}
              disabled={option.disabled}
              title={`Align to ${option.label}`}
            >
              {option.icon}
              {option.label}
            </AlignButton>
          ))}
        </ButtonGrid>
      </PanelContainer>

      {/* Rotation Control */}
      <RotationControl
        rotation={activeObjectProps?.transform?.rotation || 0}
        onRotationChange={handleRotationChange}
      />

      {/* Advanced Position Panel */}
      <AdvancedPositionPanel
        width={activeObjectProps?.width || 0}
        height={activeObjectProps?.height || 0}
        x={activeObjectProps?.transform?.x || 0}
        y={activeObjectProps?.transform?.y || 0}
        onDimensionChange={handleAdvancedChange}
      />
    </SettingsPanelWrapper>
  );
}

export default PositionSettingsPanel;
