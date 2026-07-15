import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { setCurrentObjectProperties } from "../../store/slices/canvas";

function Text(props) {
  const dispatch = useDispatch();
  const { item, zoomRatio } = props;

  const onInputedit = (e) => {
    dispatch(
      setCurrentObjectProperties({
        text: [e.target.innerText],
      })
    );
  };

  return (
    <div
      key={item.id + "Text"}
      class={`${item.editable === false ? "noPointer" : "noPointer"}`}
    >
      <div
        key={item.id + "TExt222" + item.fontfamily}
        onBlur={(e) => onInputedit(e)}
        class="wordbsreak noPointer select-text"
        style={{
          color: item.color,
          fontSize: parseInt(item.fontSize) * zoomRatio + "px",
          fontWeight: item.fw,
          fontFamily: item.fontfamily,
          textDecoration: item.underline === true ? "underline" : "none",
          fontStyle: item.italic === true ? "italic" : "normal",
          lineHeight: item.lineHeight,
          textTransform: item.textTransform,
          textAlign: item.align,
        }}
      >
        <div>
          <span contentEditable="true" suppressContentEditableWarning={true}>
            {item.text}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Text;
