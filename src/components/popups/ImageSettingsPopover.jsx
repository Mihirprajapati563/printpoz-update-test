import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ColorPickerBox } from "../../common-components/StyledComponents";
import { BiHorizontalCenter, BiImage, BiRefresh } from "react-icons/bi";
import { PiPaintBrushFill } from "react-icons/pi";
import { FiZoomOut, FiZoomIn } from "react-icons/fi";
import {
  BiMinusBack,
  BiMinusFront,
  BiTrash,
  BiBorderRadius,
  BiExpand,
} from "react-icons/bi";

import { AiOutlineBorder } from "react-icons/ai";
import { PiArrowBendUpLeftFill } from "react-icons/pi";
import { RiShadowLine } from "react-icons/ri";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { HiOutlineAdjustmentsHorizontal } from "react-icons/hi2";
import { TbBackground, TbBoxAlignLeftFilled } from "react-icons/tb";
import { GrPowerReset } from "react-icons/gr";
import Form from "react-bootstrap/Form";
import { EffectsList, ShadowList } from "../../library/utils/jsons/commonJSON";
import { getActiveObjectprops, getSettings } from "../../library/utils/helpers";
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
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { useSearchParams } from "react-router-dom";
import { refreshProjectImages } from "../../store/slices/imageUpload";
import { v4 as uuidv4 } from "uuid";
import { getEditorMenuItems } from "../../library/utils/helpers";
import { setActiveActionIndex, setIsActionActive } from "../../store/slices/appAlice";
import { toast } from "react-toastify";
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
function ImageSettings({ style, onChanges }) {
  const [steps, setSteps] = useState("");
  const dispatch = useDispatch();
  const { activeActionIndex } = useSelector((state) => state.appSlice);
  const activeObjectProps = useSelector(getActiveObjectprops);
  const isActive = useSelector((state) => state.appSlice.isActionActive);
  const projectSetup = useSelector((state) => state.projectSetup);
  const usersDetails = localStorage.getItem("userDetails");
  const users = JSON.parse(usersDetails);
  const userType = users?.userTypeCode || -1;
  const settings = useSelector(getSettings);
  const [searchParams] = useSearchParams();
  const editorMenuItems = useSelector(getEditorMenuItems);
  const setFlipX = () => {
    dispatch(
      setCurrentObjectProperties({
        flip: {
          ...activeObjectProps.flip,
          x: !activeObjectProps.flip.x,
        },
      })
    );
  };

  useEffect(() => {
    onChanges();
  }, [steps]);

  const setFlipY = () => {
    dispatch(
      setCurrentObjectProperties({
        flip: {
          ...activeObjectProps.flip,
          y: !activeObjectProps.flip.y,
        },
      })
    );
  };
  const zoomOut = () => {
    const image = activeObjectProps.image;
    if (
      image.scale === undefined ||
      activeObjectProps.image.scale === NaN
    ) {
      dispatch(
        setCurrentObjectProperties({
          image: {
            ...image,
            scale: 1,
          },
        })
      );
      return;
    }

    let currentPositionX = image.positionX;
    let currentPositionY = image.positionY;

    // STEP 1: compute box size
    const boxWidth =
      activeObjectProps.width *
      (activeObjectProps.transform?.scale?.x ?? 1);

    const boxHeight =
      activeObjectProps.height *
      (activeObjectProps.transform?.scale?.y ?? 1);

    // STEP 2: compute minimum COVER scale
    const minScaleX = boxWidth / image.width;
    const minScaleY = boxHeight / image.height;
    const minCoverScale = Math.max(minScaleX, minScaleY);

    // STEP 3: zoom out by step, then SNAP
    let scalVal = image.scale - 0.1;

    if (scalVal < minCoverScale) {
      scalVal = minCoverScale;
    }

    scalVal = Number(scalVal.toFixed(4));

    // STEP 4: compute new image size
    const newImageWidth = image.width * scalVal;
    const newImageHeight = image.height * scalVal;

    // STEP 5: keep image inside box
    if (currentPositionX + newImageWidth < boxWidth) {
      currentPositionX = boxWidth - newImageWidth;  // Align to the right side of the rectangle
    }

    if (currentPositionY + newImageHeight < boxHeight) {
      currentPositionY = boxHeight - newImageHeight;  // Align to the bottom of the rectangle
    }

    dispatch(
      setCurrentObjectProperties({
        image: {
          ...image,
          scale: scalVal,
          positionX: currentPositionX,
          positionY: currentPositionY,
        },
      })
    );
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
            scale: 1,
          },
        })
      );
      return;
    }
    let scalVal = activeObjectProps.image.scale + 0.1;
    // allow to zoom in till 2 only
    if (scalVal > 15) {
      scalVal = 15;
    }
    let currentPositionX = activeObjectProps.image.positionX;
    let currentPositionY = activeObjectProps.image.positionY;

    let newImageWidth = activeObjectProps.image.width * scalVal;
    let newImageHeight = activeObjectProps.image.height * scalVal;
    let widthIncreased = newImageWidth - activeObjectProps.image.width;
    let heightIncreased = newImageHeight - activeObjectProps.image.height;

    currentPositionX = currentPositionX - widthIncreased / 2;
    currentPositionY = currentPositionY - heightIncreased / 2;
    dispatch(
      setCurrentObjectProperties({
        image: {
          ...activeObjectProps.image,
          scale: parseFloat(scalVal.toFixed(1)),
          // positionX: currentPositionX,
          // positionY: currentPositionY
        },
      })
    );
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

  
  const handleFitToPhoto = () => {
    const image = activeObjectProps?.image;
    if (!image?.originalWidth || !image?.originalHeight) return;

    const photoWidth = image.originalWidth;
    const photoHeight = image.originalHeight;

    const frameWidth = activeObjectProps.width;
    const frameHeight = activeObjectProps.height;

    const photoAspect = photoWidth / photoHeight;
    const frameAspect = frameWidth / frameHeight;

    let newWidth;
    let newHeight;

    // Dynamic decision
    if (photoAspect > frameAspect) {
      // Photo is wider → fit by width
      newWidth = frameWidth;
      newHeight = Math.round(frameWidth / photoAspect);
    } else {
      // Photo is taller → fit by height
      newHeight = frameHeight;
      newWidth = Math.round(frameHeight * photoAspect);
    }

    dispatch(
      setCurrentObjectProperties({
        width: newWidth,
        height: newHeight,
        image: {
          ...image,
          width: newWidth,
          height: newHeight,
          scale: 1,
          positionX: 0,
          positionY: 0,
        },
      })
    );
  };
  

  // remove background
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
        } else {
          toast.error(response.message || "Something went wrong");
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

  // Auto background removal: run only once when autoBackgroundRemove is true, image is present, and no processing is happening for customer only
  useEffect(() => {
    if (
      userType === USER_TYPES.CUSTOMER &&
      activeObjectProps?.autoBackgroundRemove &&
      activeObjectProps?.autoBackgroundRemove === true &&
      (activeObjectProps?.url || activeObjectProps?.urls?.length > 0) &&
      !activeObjectProps?.isProcessing
    ) {
      handleRemoveBackground();
    }
  }, [activeObjectProps]);

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
        <Wrapper style={style} className="shadow-sm  objectSettingsPopover p-2">
          <div className="d-flex justify-content-between align-items-center popover-container-mob">
            {steps === "" && (
              <>
                {
                  activeObjectProps?.url && activeObjectProps?.url !== "" && (

                    <>
                      <IconWrapper
                        className={`pl`}
                        // disabled={activeObjectProps?.locked}
                        onClick={zoomOut}
                      >
                        <FiZoomOut fontSize={30} />
                        <div className="name mt-2">zoom out</div>
                      </IconWrapper>
                      <IconWrapper
                        // disabled={activeObjectProps?.locked}
                        onClick={zoomIn}
                      >
                        <FiZoomIn fontSize={30} />
                        <div className="name mt-2">zoom in</div>
                      </IconWrapper>
                      <IconWrapper
                        className={`${activeObjectProps.flip.x ? "active" : ""}`}
                        // disabled={activeObjectProps?.locked}
                        onClick={setFlipX}
                      >
                        <BiHorizontalCenter fontSize={30} />
                        <div className="name mt-2">flip</div>
                      </IconWrapper>
                      <IconWrapper
                        // disabled={activeObjectProps?.locked}
                        onClick={handleFitToPhoto}
                      >
                        <BiExpand fontSize={30} />
                        <div className="name mt-2">fit</div>
                      </IconWrapper>
                    </>
                  )
                }

                {((activeObjectProps?.disableBackwardForward !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                    <>
                      <IconWrapper
                        className={`${!activeObjectProps?.url || activeObjectProps?.url === "" ? "pl" : ""}`}
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
                {(activeObjectProps?.url && activeObjectProps?.url !== "" &&
                  ((settings.allowBackgroundRemover && settings.allowBackgroundRemover === true &&
                    userType === USER_TYPES.CUSTOMER) ||
                    userType !== USER_TYPES.CUSTOMER)) && (
                    <IconWrapper
                      className=""
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveBackground();
                      }}
                    >
                      <TbBackground fontSize={30} />
                      <div className="name mt-2">remove bG</div>
                    </IconWrapper>
                  )}
                {activeObjectProps?.url && activeObjectProps?.url !== "" && (
                  <IconWrapper
                    className=""
                    // disabled={activeObjectProps?.locked}
                    // onClick={() => setSteps("edit")}
                    onClick={() => handleOpenEditAction()}
                  >
                    <PiPaintBrushFill fontSize={30} />
                    <div className="name mt-2">edit</div>
                  </IconWrapper>
                )}
                {activeObjectProps && !activeObjectProps?.url && <>
                  <IconWrapper
                    onClick={() => {
                      dispatch(setActiveActionIndex(0));
                      dispatch(setIsActionActive(true));
                    }}
                  >
                    <BiImage fontSize={30} />
                    <div className="name mt-2">Select Image</div>
                  </IconWrapper>
                </>}
                {activeObjectProps && activeObjectProps?.url && activeObjectProps?.url !== "" && <>
                  <IconWrapper
                    onClick={() => {
                      dispatch(setCurrentObjectProperties({
                        url: "",
                        urls: [],
                      }));
                    }}
                  >
                    <BiRefresh fontSize={30} />
                    <div className="name mt-2">Clear Image</div>
                  </IconWrapper>
                </>}

                {((activeObjectProps &&
                  activeObjectProps?.disabledForClient !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
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
            {steps === "edit" && (
              <>
                <IconWrapper className="p-1" onClick={() => setSteps("")}>
                  <PiArrowBendUpLeftFill fontSize={30} />
                  <div className="name mt-2">back</div>
                </IconWrapper>
                <DashedSeparator className="mx-2 dash-popup" />

                <IconWrapper onClick={() => setSteps("border")}>
                  <AiOutlineBorder fontSize={30} />
                  <div className="name mt-2">border</div>
                </IconWrapper>

                {/* display radius image in when mask is not applied */}
                {(activeObjectProps.masking === null ||
                  activeObjectProps.masking === undefined ||
                  activeObjectProps.masking.path === null ||
                  activeObjectProps.masking.path ===
                  "M0 0 L24 0 L24 24 L0 24 Z") && (
                    <IconWrapper onClick={() => setSteps("borderradius")}>
                      <BiBorderRadius fontSize={30} />
                      <div className="name mt-2">radius</div>
                    </IconWrapper>
                  )}

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
            )}

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

export default ImageSettings;

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
    // lets set inside the effect property of object

    dispatch(
      setCurrentObjectProperties({
        effects: {
          ...activeObjectProps.effects,
          brightness: parseInt(value),
        },
      })
    );

    // dispatch(setCurrentObjectProperties({ brightness: value }))
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
    <>
      <IconWrapper className="pl" onClick={() => resetEffectSettings()}>
        <GrPowerReset fontSize={30} />
        <div className="name mt-2">reset</div>
      </IconWrapper>
      <DashedSeparator className="mx-2" />
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.effects.brightness}
          onChange={(e) => setBrightnessOfElement(e.target.value)}
          min={-100}
          defaultValue={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">BRIGHTNESS</Form.Label>
          {/* <Form.Label className='m-0'>{activeObjectProps.effects.brightness}</Form.Label> */}
          <Form.Control
            type="number"
            className="m-0"
            value={activeObjectProps.effects.brightness}
            onChange={(e) => setBrightnessOfElement(e.target.value)}
            min="-100"
            max="100"
          />
        </div>
      </OpacitySlider>
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.effects.contrast}
          onChange={(e) => setcontrastOfElement(e.target.value)}
          min={-100}
          defaultValue={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">CONTRAST</Form.Label>
          {/* <Form.Label className='m-0'>{activeObjectProps.effects.contrast}</Form.Label> */}
          <Form.Control
            type="number"
            className="m-0"
            value={activeObjectProps.effects.contrast}
            onChange={(e) => setcontrastOfElement(e.target.value)}
            min="-100"
            max="100"
          />
        </div>
      </OpacitySlider>
      <OpacitySlider className="opacity Slider px-3">
        <Form.Range
          value={activeObjectProps.effects.saturation}
          onChange={(e) => setsaturationOfElement(e.target.value)}
          min={-100}
          defaultValue={0}
          max={100}
        />
        <div className="d-flex mt-2 align-items-center justify-content-between">
          <Form.Label className="m-0">SATURATION</Form.Label>

          {/* <Form.Label className='m-0'>{activeObjectProps.effects.saturation}</Form.Label> */}
          <Form.Control
            type="number"
            className="m-0"
            value={activeObjectProps.effects.saturation}
            onChange={(e) => setsaturationOfElement(e.target.value)}
            min="-100"
            max="100"
          />
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
      <IconWrapper className="p-1">
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
      activeObjectProps.type === "img"
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
              <div
                style={{ position: "absolute", zIndex: "2" }}
                className="color-picker-mob-dialog"
              >
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
  const handleColorChange = (color) => {
    setColor(color.hex);
  };

  const handleColorPickerClick = () => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "img"
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
          max={200}
          step={1}
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
            <div
              style={{ position: "absolute", zIndex: "2" }}
              className="color-picker-mob-dialog"
            >
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
