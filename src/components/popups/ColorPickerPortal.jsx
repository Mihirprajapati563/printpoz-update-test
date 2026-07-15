import ReactDOM from "react-dom";
import { useEffect, useState } from "react";
import ColorPickerWithOpacity from "./ColorPickerWithOpacity";

const PICKER_WIDTH = 248;
const PICKER_HEIGHT = 420;
const MARGIN = 8;

const ColorPickerPortal = ({ anchorRect, onClose, ...pickerProps }) => {
  const [style, setStyle] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRect) return;

    // Center horizontally within the sidebar actions panel
    let left;
    const panel = document.querySelector(".actions-wrapper");
    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      left = panelRect.left + (panelRect.width - PICKER_WIDTH) / 2;
    } else {
      left = anchorRect.left + anchorRect.width / 2 - PICKER_WIDTH / 2;
    }

    // Clamp to viewport edges
    if (left < MARGIN) left = MARGIN;
    if (left + PICKER_WIDTH > window.innerWidth - MARGIN) {
      left = window.innerWidth - PICKER_WIDTH - MARGIN;
    }

    // Vertical: open below anchor, flip above if no room
    let top = anchorRect.bottom + 4;
    if (top + PICKER_HEIGHT > window.innerHeight - MARGIN) {
      top = anchorRect.top - PICKER_HEIGHT - 4;
    }
    if (top < MARGIN) top = MARGIN;

    setStyle({ top, left });
  }, [anchorRect]);

  return ReactDOM.createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />
      <div style={{ position: "fixed", ...style, zIndex: 9999 }}>
        <ColorPickerWithOpacity {...pickerProps} onClose={onClose} />
      </div>
    </>,
    document.body
  );
};

export default ColorPickerPortal;
