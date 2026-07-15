import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  updateMultipleObjects,
  removeMultipleObjectsInPage,
  deSelectActiveObject,
} from "../../store/slices/canvas";
import { getAllObjectsSortedByZIndex } from "../../library/utils/helpers";
import { MdSwapHoriz, MdDelete, MdClose } from "react-icons/md";

const ICON_SIZE = 15;

const Btn = ({ title, onClick, children, danger }) => {
  const hoverOn  = (e) => (e.currentTarget.style.background = "var(--accent)");
  const hoverOff = (e) => (e.currentTarget.style.background = "transparent");
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            4,
        background:     "transparent",
        border:         "none",
        borderRadius:   4,
        color:          danger ? "var(--destructive)" : "var(--foreground)",
        cursor:         "pointer",
        padding:        "3px 7px",
        transition:     "background 0.12s",
        minHeight:      28,
        fontSize:       11,
        fontWeight:     500,
        whiteSpace:     "nowrap",
      }}
    >
      {children}
    </button>
  );
};

const Divider = () => (
  <span style={{
    width:      1,
    height:     16,
    background: "var(--border)",
    margin:     "0 2px",
    flexShrink: 0,
    alignSelf:  "center",
  }} />
);

const MultiSelectToolbar = ({ activeObjects, style }) => {
  const dispatch       = useDispatch();
  const allPageObjects = useSelector(getAllObjectsSortedByZIndex);

  // Resolve all selected objects from the page
  const selectedObjects = useMemo(() =>
    activeObjects
      .map(({ id, areaType }) => {
        const found = allPageObjects.find((o) => o.id === id);
        return found ? { ...found, areaType } : null;
      })
      .filter(Boolean),
  [activeObjects, allPageObjects]);

  // Image-only subset for swap feature
  const imgObjects = useMemo(() =>
    selectedObjects.filter((o) => o.type === "img"),
  [selectedObjects]);

  // Toolbar visible when 2+ objects of any type are selected
  if (selectedObjects.length < 2) return null;

  // Swap ONLY the image URL between selected frames.
  // Every other property (size, crop, position, masking, etc.) stays on the original frame.
  // For 2 frames: A ↔ B.
  // For N frames: forward cycle — A gets B's url, B gets C's url, … last gets A's url.
  const swapImages = (e) => {
    e.stopPropagation();
    const n = imgObjects.length;
    const updates = imgObjects.map((obj, i) => {
      const src = imgObjects[(i + 1) % n];

      // Natural pixel dimensions of the incoming image file
      const srcImgW = src.image?.width  ?? 8000;
      const srcImgH = src.image?.height ?? 12000;

      // Destination frame dimensions (canvas units)
      const frameW = obj.width;
      const frameH = obj.height;

      // Compute a "cover" scale so the image always fills the frame
      // (same as CSS object-fit: cover — no gaps possible)
      const scale = Math.max(frameW / srcImgW, frameH / srcImgH);

      // Center the image inside the frame
      const positionX = (frameW - srcImgW * scale) / 2;
      const positionY = (frameH - srcImgH * scale) / 2;

      return {
        id:       obj.id,
        areaType: obj.areaType,
        url:      src.url  ?? "",
        urls:     src.urls ?? [],
        image: {
          width:  srcImgW,
          height: srcImgH,
          scale,
          positionX,
          positionY,
        },
      };
    });
    dispatch(updateMultipleObjects({ updates, history: true }));
  };

  return (
    <div
      style={{
        position:            "fixed",
        zIndex:              9999,
        display:             "flex",
        alignItems:          "center",
        padding:             "4px 6px",
        borderRadius:        10,
        background:          "var(--background)",
        backdropFilter:      "blur(10px)",
        WebkitBackdropFilter:"blur(10px)",
        border:              "1px solid var(--border)",
        boxShadow:           "0 6px 24px rgba(0,0,0,0.35)",
        color:               "var(--foreground)",
        userSelect:          "none",
        ...style,
      }}
    >
      {/* Count badge */}
      <span style={{
        fontSize:     10,
        fontWeight:   600,
        color:        "var(--muted-foreground)",
        paddingRight: 7,
        marginRight:  3,
        borderRight:  "1px solid var(--border)",
      }}>
        {selectedObjects.length} selected
      </span>

      {imgObjects.length >= 2 && (
        <>
          <Btn
            title={imgObjects.length === 2 ? "Swap images between the 2 frames" : `Cycle images across ${imgObjects.length} frames`}
            onClick={(e) => swapImages(e)}
          >
            <MdSwapHoriz size={ICON_SIZE + 1} />
            Swap Images
          </Btn>
          <Divider />
        </>
      )}

      <Btn
        title={`Delete ${selectedObjects.length} selected objects`}
        onClick={() => dispatch(removeMultipleObjectsInPage())}
        danger
      >
        <MdDelete size={ICON_SIZE} />
      </Btn>

      <Btn title="Deselect all (Esc)" onClick={() => dispatch(deSelectActiveObject())}>
        <MdClose size={ICON_SIZE} />
      </Btn>
    </div>
  );
};

export default MultiSelectToolbar;
