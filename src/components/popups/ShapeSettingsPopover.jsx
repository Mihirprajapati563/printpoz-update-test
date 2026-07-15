import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ColorPickerBox } from "../../common-components/StyledComponents";
import { BiHorizontalCenter } from "react-icons/bi";
import { PiPaintBrushFill } from "react-icons/pi";
import { FiZoomOut, FiZoomIn } from "react-icons/fi";
import {
  BiMinusBack,
  BiMinusFront,
  BiTrash,
  BiBorderRadius,
} from "react-icons/bi";

import { AiOutlineBorder } from "react-icons/ai";
import { PiArrowBendUpLeftFill } from "react-icons/pi";
import { RiShadowLine } from "react-icons/ri";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { HiOutlineAdjustmentsHorizontal } from "react-icons/hi2";
import { TbBoxAlignLeftFilled } from "react-icons/tb";
import { GrPowerReset } from "react-icons/gr";
import Form from "react-bootstrap/Form";
import { EffectsList, ShadowList } from "../../library/utils/jsons/commonJSON";
import { getActiveObjectprops } from "../../library/utils/helpers";
import { useDispatch, useSelector } from "react-redux";
import {
  removeObjectInPage,
  sendForward,
  sendBackward,
  setCurrentObjectProperties,
} from "../../store/slices/canvas";
import { SketchPicker } from "react-color";
import ColorPickerWithOpacity from "./ColorPickerWithOpacity";
import { isMobile } from "react-device-detect";
import { USER_TYPES } from "../../library/utils/constants";
import { setActiveActionIndex, setIsActionActive } from "../../store/slices/appAlice";
import { getEditorMenuItems } from "../../library/utils/helpers";
const Wrapper = styled.div`
  background: #fff;
  border-radius: 15px;
  position: absolute;
  z-index: 1000;
`;
const IconWrapper = styled.div`
  text-align: center;
  color: ${(props) => (props.disabled ? "#b3b3b3" : "#696969")};
  padding: 15px;
  cursor: pointer;

  & .name {
    text-transform: uppercase;
    color: ${(props) => (props.disabled ? "#b3b3b3" : "#696969")};
  }

  &.pr:hover {
    border-top-right-radius: 15px;
    border-bottom-right-radius: 15px;
  }
  &.pl:hover {
    border-top-left-radius: 15px;
    border-bottom-left-radius: 15px;
  }
  &:hover {
    background: ${(props) => (props.disabled ? "" : "#eee")};
  }
  &.active {
    background: #eee;
  }
`;
const DashedSeparator = styled.div`
  height: 72px;
  border-left: 2px dashed #696969;
`;
const OpacitySlider = styled.div`
  width: 250px;
  .form-range::-webkit-slider-thumb {
    width: 15px;
    -webkit-appearance: none;
    height: 15px;
    background: #fff;
    border: 1px solid #000;
  }
  .form-range::-webkit-slider-runnable-track {
    height: 5px;
  }

  & .form-range {
    height: 0.5rem;
  }
  & .form-label {
    font-size: 12px;
  }
`;

const ShadowSlider = styled.div`
  width: 250px;
  .form-range::-webkit-slider-thumb {
    width: 15px;
    -webkit-appearance: none;
    height: 15px;
    background: #fff;
    border: 1px solid #000;
  }
  .form-range::-webkit-slider-runnable-track {
    height: 5px;
  }

  & .form-range {
    height: 0.5rem;
  }
  & .form-label {
    font-size: 12px;
  }
`;

const BorderSlider = styled.div`
  width: 250px;
  .form-range::-webkit-slider-thumb {
    width: 15px;
    -webkit-appearance: none;
    height: 15px;
    background: #fff;
    border: 1px solid #000;
  }
  .form-range::-webkit-slider-runnable-track {
    height: 5px;
  }

  & .form-range {
    height: 0.5rem;
  }
  & .form-label {
    font-size: 12px;
  }
`;

const DoneBtn = styled.div`
  background-color: var(--primary);
  border-color: var(--primary);
  &:hover {
    background-color: #356d95 !important;
    border-color: var(--primary);
  }
`;

const EffectsWrapper = styled.div`
  cursor: pointer;
  padding: 5px;
  &.selected {
    border: 1px solid #ccc;
  }
`;
function ShapeSettings({ style, onChanges }) {
  const [steps, setSteps] = useState("");
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const isActive = useSelector((state) => state.appSlice.isActionActive);
  const users = localStorage.getItem("userDetails");
  const userType = JSON.parse(users)?.userTypeCode || -1;
  const editorMenuItems = useSelector(getEditorMenuItems);
  useEffect(() => {
    onChanges();
  }, [steps]);

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

  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const setColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        fill: value,
      })
    );
  };

  const handleColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "shape"
    ) {
      setDisplayColorPicker(!displayColorPicker);
    }
  };

  const handleColorPickerClose = () => {
    setDisplayColorPicker(false);
  };

  const handleOpenEditAction = () => {
    const editActionIndex = editorMenuItems.findIndex(
      (item) => item.title === "Edit"
    );
    if (editActionIndex !== -1) {
      dispatch(setActiveActionIndex(editActionIndex));
      dispatch(setIsActionActive(true));
    }
  };
  return (
    <>
      {(!isMobile || (isMobile && !isActive)) && (
        <Wrapper style={style} className="shadow-sm objectSettingsPopover p-2">
          <div className="d-flex justify-content-between align-items-center popover-container-mob">
            {steps === "" && (
              <>
                {/* <div className="px-3">
                  <div className="d-flex1 justify-content-between">
                    <div className="d-flex flex-column">
                      <ColorPickerBox
                        // disable={activeObjectProps?.locked}
                        onClick={handleColorPickerClick}
                        bgimage="/images/background/bg_first_item_plus.webp"
                      />
                      {displayColorPicker && (
                        <div style={{ position: "absolute", zIndex: "2" }}>
                          <div
                            style={{
                              position: "fixed",
                              top: "0px",
                              right: "0px",
                              bottom: "0px",
                              left: "0px",
                            }}
                            onClick={handleColorPickerClose}
                          />
                          <ColorPickerWithOpacity
                            color={activeObjectProps?.fill || "#000000FF"} // Default to black with full opacity
                            onChange={(hexColor) => {
                              setColor(hexColor);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <IconWrapper
                  // disabled={activeObjectProps?.locked}
                  onClick={() => setSteps("border")}
                >
                  <AiOutlineBorder fontSize={30} />
                  <div className="name mt-2">border</div>
                </IconWrapper>
                {activeObjectProps.shape === "rect" && (
                  <>
                    <IconWrapper
                      // disabled={activeObjectProps?.locked}
                      onClick={() => setSteps("borderradius")}
                    >
                      <BiBorderRadius fontSize={30} />
                      <div className="name mt-2">radius</div>
                    </IconWrapper>
                  </>
                )}

                <IconWrapper
                  // disabled={activeObjectProps?.locked}
                  onClick={() => setSteps("shadow")}
                >
                  <RiShadowLine fontSize={30} />
                  <div className="name mt-2">shadow</div>
                </IconWrapper>
                <IconWrapper
                  className=""
                  // disabled={activeObjectProps?.locked}
                  onClick={() => setSteps("opacity")}
                >
                  <TbBoxAlignLeftFilled fontSize={30} />
                  <div className="name mt-2">opacity</div>
                </IconWrapper> */}
                {((activeObjectProps?.disableBackwardForward !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                    <>
                      <IconWrapper
                        className=""
                        // disabled={activeObjectProps?.locked}
                        onClick={SendBackward}
                      >
                        <BiMinusBack fontSize={30} />
                        <div className="name mt-2">backward</div>
                      </IconWrapper>
                      <IconWrapper
                        className=""
                        // disabled={activeObjectProps?.locked}
                        onClick={BrignForward}
                      >
                        <BiMinusFront fontSize={30} />
                        <div className="name mt-2">forward</div>
                      </IconWrapper>
                    </>
                  )}
                <IconWrapper className='' onClick={() => handleOpenEditAction()}>
                  <PiPaintBrushFill fontSize={30} />
                  <div className='name mt-2'>edit</div>
                </IconWrapper>

                {((activeObjectProps &&
                  activeObjectProps?.disabledForClient !== true &&
                  userType == USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                    <>
                      <DashedSeparator className="mx-2 dash-popup" />
                      <IconWrapper
                        className="pr"
                        onClick={removeElement}
                        disabled={
                          activeObjectProps?.disabledForClient &&
                          userType === USER_TYPES.CUSTOMER
                        }
                      >
                        <BiTrash fontSize={30} />
                        <div className="name mt-2">remove</div>
                      </IconWrapper>
                    </>
                  )}
              </>
            )}
            {/* {steps === "edit" && (
              <>
                <IconWrapper className="pl" onClick={() => setSteps("")}>
                  <PiArrowBendUpLeftFill fontSize={30} />
                  <div className="name mt-2">back</div>
                </IconWrapper>
                <DashedSeparator className="mx-2" />

                <IconWrapper onClick={() => setSteps("border")}>
                  <AiOutlineBorder fontSize={30} />
                  <div className="name mt-2">border</div>
                </IconWrapper>
                <IconWrapper onClick={() => setSteps("borderradius")}>
                  <BiBorderRadius fontSize={30} />
                  <div className="name mt-2">radius</div>
                </IconWrapper>

                <IconWrapper onClick={() => setSteps("shadow")}>
                  <RiShadowLine fontSize={30} />
                  <div className="name mt-2">shadow</div>
                </IconWrapper>
                <IconWrapper className="" onClick={() => setSteps("effect")}>
                  <FaWandMagicSparkles fontSize={30} />
                  <div className="name mt-2">effects</div>
                </IconWrapper>
                <IconWrapper className="" onClick={() => setSteps("adjust")}>
                  <HiOutlineAdjustmentsHorizontal fontSize={30} />
                  <div className="name mt-2">adjust</div>
                </IconWrapper>
                <IconWrapper className="pr" onClick={() => setSteps("opacity")}>
                  <TbBoxAlignLeftFilled fontSize={30} />
                  <div className="name mt-2">opacity</div>
                </IconWrapper>
              </>
            )} */}

            {steps === "shadow" && (
              <ImageShadows
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
            {steps === "opacity" && (
              <SetOpacity
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
            {steps === "adjust" && (
              <Adjustments
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
            {steps === "effect" && (
              <Effects
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
            {steps === "border" && (
              <SetBorder
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
            {steps === "borderradius" && (
              <SetBorderRadius
                activeObjectProps={activeObjectProps}
                setSteps={setSteps}
              />
            )}
          </div>
        </Wrapper>
      )}
    </>
  );
}

export default ShapeSettings;

const SetOpacity = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();

  const setOpacityOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ opacity: value }));
  };
  return (
    <>
      <IconWrapper className="pl" onClick={() => setOpacityOfElement(1)}>
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps?.opacity}
          onChange={(e) => setOpacityOfElement(e.target.value)}
          min={0}
          max={1}
          step={0.01}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">OPACITY</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.opacity * 100}
          </Form.Label>
        </div>
      </OpacitySlider>
      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};

const Adjustments = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();
  const setBrightnessOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ brightness: value }));
  };
  const setcontrastOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ contrast: value }));
  };
  const setsaturationOfElement = (value) => {
    dispatch(setCurrentObjectProperties({ saturation: value }));
  };



  return (
    <>
      <IconWrapper className="pl">
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.brightness}
          onChange={(e) => setBrightnessOfElement(e.target.value)}
          min={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">BRIGHTNESS</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps.brightness}
          </Form.Label>
        </div>
      </OpacitySlider>
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.contrast}
          onChange={(e) => setcontrastOfElement(e.target.value)}
          min={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">CONTRAST</Form.Label>
          <Form.Label className="m-0">{activeObjectProps.contrast}</Form.Label>
        </div>
      </OpacitySlider>
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.saturation}
          onChange={(e) => setsaturationOfElement(e.target.value)}
          min={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">SATURATION</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps.saturation}
          </Form.Label>
        </div>
      </OpacitySlider>
      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};
const Effects = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();

  const setEffect = (value) => {
    dispatch(setCurrentObjectProperties({ effect: value }));
  };

  return (
    <>
      <IconWrapper className="pl">
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      {EffectsList.map((x, i) => (
        <EffectsWrapper
          onClick={() => setEffect(x.value)}
          className={`${activeObjectProps.effect === x.value ? "selected" : ""
            } text-center me-3 ${i === 0 ? "ms-3" : ""} `}
        >
          <img
            style={{
              filter: `${x.value}(${x.effect})`,
            }}
            src="https://cdn.icon-icons.com/icons2/3361/PNG/512/multimedia_communication_image_placeholder_photography_landscape_image_comics_picture_photo_gallery_image_icon_210828.png"
            width={50}
            height={50}
            alt=""
          />
          <div className="m-0 text-center">{x.label}</div>
        </EffectsWrapper>
      ))}
      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};
const ImageShadows = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

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

  useEffect(() => {
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
        },
      })
    );
  }, []);
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

  const setColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        shadow: {
          ...activeObjectProps.shadow,
          color: value,
        },
      })
    );
  };
  const handleColorChange = (color) => {
    setColor(color.hex);
  };

  const handleColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "shape"
    ) {
      setDisplayColorPicker(!displayColorPicker);
    }
  };

  const handleColorPickerClose = () => {
    setDisplayColorPicker(false);
  };

  return (
    <>
      <IconWrapper className="pl" onClick={() => resetShadowSettings()}>
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />

      {/* lets create box shadow options form that include horizontal length, vertical length, blur radius, spread radius, color */}

      <ShadowSlider>
        <Form.Range
          value={activeObjectProps?.shadow?.offsetX || 0}
          onChange={(e) => setShadowOffsetX(e.target.value)}
          min={-activeObjectProps?.width / 2}
          max={activeObjectProps?.width / 2}
          step={1}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">Horizontal Length</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.shadow?.offsetX}
          </Form.Label>
        </div>

        <Form.Range
          value={activeObjectProps?.shadow?.offsetY || 0}
          onChange={(e) => setShadowOffsetY(e.target.value)}
          min={-activeObjectProps?.height / 2}
          max={activeObjectProps?.height / 2}
          step={1}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">Vertical Length</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.shadow?.offsetY}
          </Form.Label>
        </div>
        <Form.Range
          value={activeObjectProps?.shadow?.blurRadius || 0}
          onChange={(e) => setShadowBlurRadius(e.target.value)}
          min={0}
          max={
            Math.max(activeObjectProps?.width, activeObjectProps?.height) / 5
          }
          step={1}
        />

        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">Spread</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.shadow?.blurRadius}
          </Form.Label>
        </div>
      </ShadowSlider>

      <div className="px-3">
        <div className="d-flex1 justify-content-between">
          <div className="d-flex flex-column">
            <ColorPickerBox
              onClick={handleColorPickerClick}
              bgimage="/images/background/bg_first_item_plus.webp"
            />
            {displayColorPicker ? (
              <div style={{ position: "absolute", zIndex: "2" }}>
                <div
                  style={{
                    position: "fixed",
                    top: "0px",
                    right: "0px",
                    bottom: "0px",
                    left: "0px",
                  }}
                  onClick={handleColorPickerClose}
                />
                <ColorPickerWithOpacity
                  color={activeObjectProps?.shadow?.color || "#000000FF"} // Default to black with full opacity
                  onChange={(hexColor) => {
                    setColor(hexColor);
                  }}
                  onClose={handleColorPickerClose}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};

const SetBorder = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const setBorderWidth = (value) => {
    if (!activeObjectProps.border) {
      resetBorderSettings();
      return;
    }
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          width: value,
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
          color: "#000",
          style: "solid",
        },
      })
    );
  };
  const setColor = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          color: value,
        },
      })
    );
  };
  useEffect(() => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
        },
      })
    );
  }, []);

  const handleColorChange = (color) => {
    setColor(color.hex);
  };

  const handleColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "shape"
    ) {
      setDisplayColorPicker(!displayColorPicker);
    }
  };

  const handleColorPickerClose = () => {
    setDisplayColorPicker(false);
  };

  return (
    <>
      <IconWrapper className="pl" onClick={() => resetBorderSettings()}>
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      <BorderSlider className="opacity Slider px-3">
        <Form.Range
          value={
            activeObjectProps?.border?.width
              ? activeObjectProps?.border?.width
              : 0
          }
          onChange={(e) => setBorderWidth(e.target.value)}
          min={0}
          max={10}
          step={0.1}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">Width</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.border?.width}
          </Form.Label>
        </div>
      </BorderSlider>

      <div className="px-3">
        <div className="d-flex align-items-center justify-content-between">
          <ColorPickerBox
            onClick={handleColorPickerClick}
            bgimage="/images/background/bg_first_item_plus.webp"
          />
          {displayColorPicker ? (
            <div style={{ position: "absolute", zIndex: "2" }}>
              <div
                style={{
                  position: "fixed",
                  top: "0px",
                  right: "0px",
                  bottom: "0px",
                  left: "0px",
                }}
                onClick={handleColorPickerClose}
              />
              <ColorPickerWithOpacity
                color={activeObjectProps?.border?.color}
                onChange={(hexColor) => {
                  setColor(hexColor);
                }}
                onClose={handleColorPickerClose}
              />
            </div>
          ) : null}
        </div>
      </div>
      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};
const SetBorderRadius = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();

  const resetBorderRadiusSettings = () => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          radius: 0,
        },
      })
    );
  };
  const setRadius = (value) => {
    dispatch(
      setCurrentObjectProperties({
        border: {
          ...activeObjectProps.border,
          radius: value,
        },
      })
    );
  };

  return (
    <>
      <IconWrapper className="pl" onClick={() => resetBorderRadiusSettings()}>
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      <BorderSlider className="opacity Slider px-3">
        <Form.Range
          value={
            activeObjectProps?.border?.radius
              ? activeObjectProps?.border?.radius
              : 0
          }
          onChange={(e) => setRadius(e.target.value)}
          min={0}
          max={20}
          step={0.1}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">Radius</Form.Label>
          <Form.Label className="m-0">
            {activeObjectProps?.border?.radius}
          </Form.Label>
        </div>
      </BorderSlider>

      <DoneBtn
        className="btn me-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};
