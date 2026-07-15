import React, { useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { updateMultipleObjects } from "../../store/slices/canvas";
import { EffectsList } from "../../library/utils/jsons/commonJSON";
import ColorPickerModal from "../../common-components/ColorPickerModal";
import { IconSliderControl } from "../object-settings/sticker/StickerSettingsPanel";

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

const buildUpdates = (selectedImageObjects, props) =>
  selectedImageObjects.map((obj) => ({
    id: obj.id,
    areaType: obj.areaType,
    ...props,
  }));

export function SetOpacityInlineBulk({ selectedImageObjects }) {
  const dispatch = useDispatch();
  const first = selectedImageObjects[0] || {};

  const setOpacity = (value) => {
    dispatch(
      updateMultipleObjects({
        updates: buildUpdates(selectedImageObjects, {
          opacity: parseFloat(value),
        }),
        history: true,
      })
    );
  };

  return (
    <SliderContainer>
      <IconSliderControl
        label="Opacity"
        value={Math.round((first.opacity ?? 1) * 100)}
        min={0}
        max={100}
        step={1}
        jump={5}
        onChange={(value) => setOpacity(value / 100)}
        unit="%"
      />
    </SliderContainer>
  );
}

export function AdjustmentsInlineBulk({ selectedImageObjects }) {
  const dispatch = useDispatch();
  const first = selectedImageObjects[0] || {};

  const applyEffect = (key, value) => {
    dispatch(
      updateMultipleObjects({
        updates: buildUpdates(selectedImageObjects, {
          effects: { [key]: parseInt(value) },
        }),
        history: true,
      })
    );
  };

  return (
    <SliderContainer>
      <IconSliderControl
        label="Brightness"
        value={first.effects?.brightness || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={(v) => applyEffect("brightness", v)}
      />
      <IconSliderControl
        label="Contrast"
        value={first.effects?.contrast || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={(v) => applyEffect("contrast", v)}
      />
      <IconSliderControl
        label="Saturation"
        value={first.effects?.saturation || 0}
        min={-100}
        max={100}
        step={1}
        jump={5}
        onChange={(v) => applyEffect("saturation", v)}
      />
    </SliderContainer>
  );
}

export function EffectsInlineBulk({ selectedImageObjects }) {
  const dispatch = useDispatch();
  const first = selectedImageObjects[0] || {};

  const setEffect = (value) => {
    dispatch(
      updateMultipleObjects({
        updates: buildUpdates(selectedImageObjects, { effect: value }),
        history: true,
      })
    );
  };

  return (
    <SliderContainer>
      <div className="row g-2 mt-2">
        {EffectsList.map((effect, index) => (
          <div key={index} className="col-4 col-md-6">
            <EffectsWrapper
              className={`text-center d-flex align-items-center justify-content-center flex-column g-3 ${
                first.effect === effect.value ? "selected" : ""
              }`}
              onClick={() => setEffect(effect.value)}
            >
              <img
                style={{
                  filter: `${effect.value}(${effect.effect})`,
                  width: "100%",
                  height: "40px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  marginBottom: "4px",
                }}
                src="https://cdn.icon-icons.com/icons2/3361/PNG/512/multimedia_communication_image_placeholder_photography_landscape_image_comics_picture_photo_gallery_image_icon_210828.png"
                alt={effect.label}
              />
              <div
                className="m-0 text-center"
                style={{ fontSize: "10px", fontWeight: "500" }}
              >
                {effect.label}
              </div>
            </EffectsWrapper>
          </div>
        ))}
      </div>
    </SliderContainer>
  );
}

const ColorSwatch = ({ color, onClick, title }) => (
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
    onClick={onClick}
    title={title}
  >
    <div
      style={{
        width: "24px",
        height: "24px",
        backgroundColor: color,
        borderRadius: "50%",
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        position: "relative",
        zIndex: 1,
      }}
    />
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
        backgroundSize: "6px 6px",
        backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
        borderRadius: "6px",
        zIndex: 0,
      }}
    />
  </div>
);

export function ImageShadowsInlineBulk({ selectedImageObjects }) {
  const dispatch = useDispatch();
  const first = selectedImageObjects[0] || {};
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(
    first?.shadow?.color || "#000000"
  );

  const applyShadow = (patch) => {
    dispatch(
      updateMultipleObjects({
        updates: buildUpdates(selectedImageObjects, { shadow: patch }),
        history: true,
      })
    );
  };

  // Bounds derived from first selection — sliders apply to all uniformly.
  const widthBound = first?.width || 100;
  const heightBound = first?.height || 100;

  return (
    <>
      <SliderContainer>
        <IconSliderControl
          label="Horizontal Length"
          value={first?.shadow?.offsetX || 0}
          min={-(widthBound / 2)}
          max={widthBound / 2}
          step={1}
          jump={5}
          onChange={(v) => applyShadow({ offsetX: Math.round(v) })}
        />
        <IconSliderControl
          label="Vertical Length"
          value={first?.shadow?.offsetY || 0}
          min={-(heightBound / 2)}
          max={heightBound / 2}
          step={1}
          jump={5}
          onChange={(v) => applyShadow({ offsetY: Math.round(v) })}
        />
        <IconSliderControl
          label="Spread"
          value={first?.shadow?.blurRadius || 0}
          min={0}
          max={Math.max(widthBound, heightBound) / 5}
          step={1}
          jump={5}
          onChange={(v) => applyShadow({ blurRadius: Math.round(v) })}
        />

        <div className="mt-3 d-flex align-items-center justify-content-between">
          <small className="text-muted">Shadow Color</small>
          <ColorSwatch
            color={first?.shadow?.color || "#000000"}
            onClick={() => {
              setTempColor(first?.shadow?.color || "#000000");
              setShowColorPicker(true);
            }}
            title="Click to choose shadow color"
          />
        </div>
      </SliderContainer>

      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        color={tempColor}
        onChange={(colorResult) =>
          setTempColor(colorResult.rgba || colorResult.hex)
        }
        onConfirm={() => {
          applyShadow({ color: tempColor });
          setShowColorPicker(false);
        }}
        title="Choose Shadow Color"
        showPreview={true}
        showActions={true}
      />
    </>
  );
}

export function SetBorderInlineBulk({ selectedImageObjects }) {
  const dispatch = useDispatch();
  const first = selectedImageObjects[0] || {};
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(
    first?.border?.color || "#000000"
  );

  const applyBorder = (patch) => {
    dispatch(
      updateMultipleObjects({
        updates: buildUpdates(selectedImageObjects, { border: patch }),
        history: true,
      })
    );
  };

  return (
    <>
      <SliderContainer>
        <IconSliderControl
          label="Width"
          value={first?.border?.width || 0}
          min={0}
          max={200}
          step={1}
          jump={5}
          onChange={(v) => applyBorder({ width: parseInt(v) })}
          unit="px"
        />

        <IconSliderControl
          label="Radius"
          value={first?.border?.radius || 0}
          min={0}
          max={20}
          step={0.1}
          jump={1}
          onChange={(v) => applyBorder({ radius: parseFloat(v) })}
          unit="px"
        />

        <div className="mt-3 d-flex align-items-center justify-content-between">
          <small className="text-muted">Border Color</small>
          <ColorSwatch
            color={first?.border?.color || "#000000"}
            onClick={() => {
              setTempColor(first?.border?.color || "#000000");
              setShowColorPicker(true);
            }}
            title="Click to choose border color"
          />
        </div>
      </SliderContainer>

      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        color={tempColor}
        onChange={(colorResult) =>
          setTempColor(colorResult.rgba || colorResult.hex)
        }
        onConfirm={() => {
          applyBorder({ color: tempColor });
          setShowColorPicker(false);
        }}
        title="Choose Border Color"
        showPreview={true}
        showActions={true}
      />
    </>
  );
}
