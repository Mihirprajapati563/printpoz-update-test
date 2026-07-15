import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { PiPaintBrushFill } from "react-icons/pi";
import {
  BiMinusBack,
  BiMinusFront,
  BiTrash,
  BiBorderRadius,
} from "react-icons/bi";

import { PiArrowBendUpLeftFill } from "react-icons/pi";
import Form from "react-bootstrap/Form";
import { EffectsList, ShadowList } from "../../library/utils/jsons/commonJSON";
import { getActiveObjectprops, getEditorMenuItems } from "../../library/utils/helpers";
import { useDispatch, useSelector } from "react-redux";
import {
  removeObjectInPage,
  sendForward,
  sendBackward,
  setCurrentObjectProperties,
} from "../../store/slices/canvas";
import {
  setActiveActionIndex,
  setIsActionActive,
  openMagicWrite,
} from "../../store/slices/appAlice";
import { SketchPicker } from "react-color";
import ColorPickerWithOpacity from "./ColorPickerWithOpacity";
import { use } from "react";
import { isMobile } from "react-device-detect";
import { USER_TYPES } from "../../library/utils/constants";
import { FaRegEdit, FaMagic, FaTags } from "react-icons/fa";
import TextGroupPanel from "../../tools/text/TextGroupPanel";

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
function TextSettings({ style, onChanges }) {
  const [steps, setSteps] = useState("");
  const [savedSelection, setSavedSelection] = useState(null);
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const isActive = useSelector((state) => state.appSlice.isActionActive);
  const users = localStorage.getItem("userDetails");
  const userType = JSON.parse(users)?.userTypeCode || -1;
  const editorMenuItems = useSelector(getEditorMenuItems);

  // Capture text selection before mousedown steals focus
  const captureSelectionBeforeClick = () => {
    const text = activeObjectProps?.text || "";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      const selectedText = sel.toString().trim();
      // Case-insensitive search so "john", "JOHN", "John" all resolve correctly
      const startIdx = text.toLowerCase().indexOf(selectedText.toLowerCase());
      if (startIdx !== -1) {
        return {
          start: startIdx,
          end: startIdx + selectedText.length,
          text: selectedText,
        };
      }
    }
    return null;
  };
  

  // check if textEditMode is true then open edit mode
  useEffect(() => {
    if (activeObjectProps?.textEditMode === true) {
      setSteps("edit");
      // reset the flag
      dispatch(setCurrentObjectProperties({ textEditMode: false }));
    }
  }, [activeObjectProps?.textEditMode, dispatch]);

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

  const handleOpenEditAction = () => {
    const editActionIndex = editorMenuItems.findIndex(
      (item) => item.title === "Text"
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
                {((activeObjectProps?.disableBackwardForward !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                  <>
                    <IconWrapper
                      className=""
                      onClick={() => dispatch(openMagicWrite("edit"))}
                    >
                      <FaMagic fontSize={30} />
                      <div className="name mt-2">Magic Words</div>
                    </IconWrapper>
                    {userType !== USER_TYPES.CUSTOMER && (
                      <IconWrapper
                        className=""
                        onMouseDown={(e) => {
                          // Save text selection before mousedown steals focus
                          e.preventDefault();
                          e.stopPropagation();
                          const sel = captureSelectionBeforeClick();
                          setSavedSelection(sel);
                        }}
                        onClick={() => setSteps("linked")}
                      >
                        <FaTags fontSize={30} />
                        <div className="name mt-2">Smart Text</div>
                      </IconWrapper>
                    )}
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
                {!(activeObjectProps?.subtype === "month" || activeObjectProps?.subtype === "year") &&
                  (!activeObjectProps?.editorVersion || activeObjectProps?.editorVersion < 2) && (
                    <IconWrapper
                      className=""
                      // disabled={activeObjectProps?.locked}
                      onClick={() => setSteps("edit")}
                    >
                      <FaRegEdit fontSize={30} />
                      <div className="name mt-2">edit text</div>
                    </IconWrapper>
                  )}

                {((activeObjectProps &&
                  activeObjectProps?.disabledForClient !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && isMobile && (
                    <>
                      <IconWrapper
                        className="pr"
                        onClick={handleOpenEditAction}
                        disabled={
                          activeObjectProps?.disabledForClient &&
                          userType === USER_TYPES.CUSTOMER
                        }
                      >
                        <PiPaintBrushFill fontSize={30} />
                        <div className="name mt-2">edit</div>
                      </IconWrapper>
                    </>
                  )}

                {((activeObjectProps &&
                  activeObjectProps?.disabledForClient !== true &&
                  userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                  <>
                    <DashedSeparator className="mx-2  dash-popup" />
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
            {steps === "linked" && (
              <div
                style={{ display: "flex", flexDirection: "column", minWidth: "320px", maxWidth: "380px", width: "100%", alignSelf: "stretch" }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #e9ecef" }}>
                  <IconWrapper
                    className="pl"
                    onClick={() => { setSteps(""); setSavedSelection(null); }}
                    style={{ padding: "8px" }}
                  >
                    <PiArrowBendUpLeftFill fontSize={20} />
                    <div className="name" style={{ fontSize: "10px", marginTop: "2px" }}>back</div>
                  </IconWrapper>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#495057", marginLeft: "8px" }}>Smart Text</span>
                </div>
                <div style={{ padding: "8px 14px", maxHeight: "320px", overflowY: "auto" }}>
                  <TextGroupPanel savedSelection={savedSelection} />
                </div>
              </div>
            )}
            {steps === "edit" && (
              <>
                <IconWrapper className="pl" onClick={() => setSteps("")}>
                  <PiArrowBendUpLeftFill fontSize={30} />
                  <div className="name mt-2">back</div>
                </IconWrapper>
                <DashedSeparator className="mx-2" />
                <div className="name mt-2">
                  {
                    <EditText
                      activeObjectProps={activeObjectProps}
                      setSteps={setSteps}
                    />
                  }
                </div>
              </>
            )}
          </div>
        </Wrapper>
      )}
    </>
  );
}

export default TextSettings;

const EditText = ({ setSteps, activeObjectProps }) => {
  const dispatch = useDispatch();

  const updateText = (value) => {
    // Calculate required height based on text content
    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ${activeObjectProps.font?.family || "Arial"};
      font-size: ${parseInt(activeObjectProps.font?.size) || 24}px;
      font-weight: ${activeObjectProps.font?.weight || "normal"};
      font-style: ${activeObjectProps.font?.style || "normal"};
      line-height: 1.2;
      width: ${activeObjectProps.width}px;
    `;
    measureDiv.textContent = value;
    document.body.appendChild(measureDiv);

    const measuredHeight = measureDiv.offsetHeight + 10; // Add padding
    document.body.removeChild(measureDiv);

    // Only expand height, never shrink (when text is removed)
    if (measuredHeight > activeObjectProps.height) {
      dispatch(
        setCurrentObjectProperties({
          text: value,
          height: measuredHeight,
        })
      );
    } else {
      dispatch(setCurrentObjectProperties({ text: value }));
    }
  };

  return (
    <>
      <div className="edit-text px-3">
        <div className="d-flex mt-2 align-items-center justify-content-between">
          {/* create text area to edit text */}
          <Form.Control
            as="textarea"
            rows={3}
            value={activeObjectProps.text}
            onChange={(e) => updateText(e.target.value)}
            style={{ resize: "both" }}
          />
        </div>
      </div>
      <DoneBtn
        className="btn mt-3 ms-3 btn-primary btn-sm"
        onClick={() => setSteps("")}
      >
        DONE
      </DoneBtn>
    </>
  );
};
