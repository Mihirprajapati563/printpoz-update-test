import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { setCurrentObjectProperties } from "../../store/slices/canvas";

function LayoutText(props) {
  const textRef = useRef(null);

  const { item, newwidth, newheight } = props;
  const effectiveWidth = Number.isFinite(newwidth) ? newwidth : item.width || 0;
  const effectiveHeight = Number.isFinite(newheight) ? newheight : item.height || 0;
  const lineHeight = 1.2 * parseInt(item.font.size);

  const calculateTextX = () => {
    if (item.alignment.horizontal === "center") {
      return effectiveWidth / 2;
    }
    if (item.alignment.horizontal === "right") {
      return effectiveWidth;
    }
    return 0; // 'left' alignment
  };
  const calculateTextY = () => {
    const numberOfLines = item.text.split("\n").length;
    const totalTextHeight = (numberOfLines - 1) * lineHeight;

    if (item.alignment.vertical === "middle") {
      // Centering vertically by subtracting half of the total text height
      let y = effectiveHeight / 2 - totalTextHeight / 2;
      return y;
    }
    if (item.alignment.vertical === "bottom") {
      // Aligning to the bottom by subtracting the total text height from the item's height
      return effectiveHeight - totalTextHeight - lineHeight / 4; // 'hanging' alignment
    }
    return lineHeight / 4; // 'top' alignment
  };

  return (
    <g
      style={{
        cursor: item.editable ? "text" : "default",
      }}
    >
      {/* Background Rectangle */}
      <rect
        x={0}
        y={0}
        width={effectiveWidth} // Adjust width dynamically based on text length
        height={effectiveHeight} // Adjust height dynamically based on font size
        fill={item.bgcolor || "none"} // Background color (or none if not specified)
        stroke={item.style.border.color || "none"} // Border color (or none if not specified)
        strokeWidth={item.style.border.width || 0} // Border width
        rx={item.style.border.radius || 0} // Border radius for rounded corners
      />

      {/* Text */}
      <text
        ref={textRef}
        x={calculateTextX()} // Calculate x position based on alignment
        y={calculateTextY()} // Calculate y position based on alignment
        fontSize={parseInt(item.font.size)} // Adjust font size based on zoom
        fontWeight={item.font.weight}
        fontFamily={item.font.family}
        textDecoration={item.font.decoration}
        fontStyle={item.font.style}
        fill={item.color}
        textAnchor={
          item.alignment.horizontal === "center"
            ? "middle"
            : item.alignment.horizontal === "right"
            ? "end"
            : "start"
        }
        dominantBaseline={
          item.alignment.vertical === "middle"
            ? "middle"
            : item.alignment.vertical === "bottom"
            ? "baseline"
            : "hanging"
        }
      >
        {item.text.split("\n").map((line, index) => (
          <tspan
            key={index}
            x={calculateTextX()} // Set the x position for each line
            dy={index === 0 ? 0 : "1.2em"} // Offset subsequent lines (1.2em is a common line height)
            contentEditable={item.editable === true ? "true" : "false"}
            suppressContentEditableWarning={true}
            style={{
              opacity: item.style.opacity,
              filter: `brightness(${item.style.effects.brightness}%) contrast(${item.style.effects.contrast}%) saturate(${item.style.effects.saturation}%) grayscale(${item.style.effects.grayscale}%) sepia(${item.style.effects.sepia}%) blur(${item.style.effects.blur}px)`,
            }}
          >
            {line.trim() === "" ? "\u00A0" : line}{" "}
            {/* Handle blank lines by inserting a non-breaking space */}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export default LayoutText;
