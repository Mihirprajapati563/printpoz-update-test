import React, { useRef } from "react";
import { useSelector } from "react-redux";
import { useLiveResize } from "../../components/canvas/liveResizeStore";
import { getMonthYear } from "../../library/utils/common-functions";
import { getCalendarSettings } from "../../library/utils/helpers";
import {
  getLinearGradientCoords,
  getRadialGradientCoords,
} from "../../library/utils/helpers/gradientUtils";
import {
  getMonthName,
  convertNumberToLanguage,
} from "../../components/calendar/DynamicCalendar";

// Must match canvas/Text.jsx — Firefox measures advance widths wider inside
// SVG <foreignObject>, so the canvas reserves a few pixels of horizontal slack
// and the preview/footer must do the same or wrap points diverge.
const IS_FIREFOX =
  typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().indexOf("firefox") !== -1;
const FIREFOX_WRAP_SLACK = IS_FIREFOX ? 8 : 0;

function Text(props) {
  const foreignObjectRef = useRef(null);
  const calendarSetings = useSelector(getCalendarSettings);
  const { item: rawItem, zoomRatio, pageIndex } = props;
  // Live-resize override: mirrors the canvas text resize into the footer thumbnail.
  const liveResize = useLiveResize(rawItem.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;

  // Check if using new renderer (version 2+) or legacy
  const useNewRenderer = item.editorVersion && item.editorVersion >= 2;

  // Handle calendar-specific text (month/year)
  if (
    item.subtype &&
    calendarSetings !== null &&
    calendarSetings !== undefined
  ) {
    const startMonth = parseInt(calendarSetings.startMonth);
    const startYear = parseInt(calendarSetings.startYear);
    const language = calendarSetings.language || "en";

    const { month, year } = getMonthYear(startMonth, startYear, pageIndex);
    if (item.subtype === "month") {
      // Use language-specific month name
      const monthstr = getMonthName(month, language, "full");
      item.text = "" + monthstr;
    } else if (item.subtype === "year") {
      // Convert year to language-specific numbers
      item.text = "" + convertNumberToLanguage(year, language);
    }
  }

  // Get dynamic spacing values with fallback defaults
  const dynamicLineHeight = item.spacing?.lineHeight ?? 1.2;
  const dynamicLetterSpacing = item.spacing?.letterSpacing ?? 0;
  const lineHeight = dynamicLineHeight * parseInt(item.font.size);

  const hasGradient =
    item.gradient &&
    item.gradient.stops &&
    item.gradient.stops.length >= 2;

  const hasBgGradient =
    item.bgGradient &&
    item.bgGradient.stops &&
    item.bgGradient.stops.length >= 2;

  const getBgGradientCss = () => {
    if (!hasBgGradient) return null;
    const sortedStops = [...item.bgGradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops
      .map((s) => `${s.color?.slice(0, 7) || "#000"} ${s.position}%`)
      .join(", ");
    return item.bgGradient.type === "radial"
      ? `radial-gradient(circle at ${item.bgGradient.radialPosition?.x ?? 50}% ${
          item.bgGradient.radialPosition?.y ?? 50
        }%, ${stopsStr})`
      : `linear-gradient(${item.bgGradient.angle || 90}deg, ${stopsStr})`;
  };

  const getTextGradientStyle = () => {
    if (!hasGradient) return { color: item.color };
    const sortedStops = [...item.gradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops
      .map((s) => `${s.color?.slice(0, 7) || "#000"} ${s.position}%`)
      .join(", ");
    const css =
      item.gradient.type === "radial"
        ? `radial-gradient(circle at ${item.gradient.radialPosition?.x ?? 50}% ${
            item.gradient.radialPosition?.y ?? 50
          }%, ${stopsStr})`
        : `linear-gradient(${item.gradient.angle || 90}deg, ${stopsStr})`;
    return {
      backgroundImage: css,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
    };
  };

  // Get horizontal alignment CSS for new renderer
  const getHorizontalAlign = () => {
    switch (item.alignment?.horizontal) {
      case "center":
        return "center";
      case "right":
        return "right";
      case "justify":
        return "justify";
      default:
        return "left";
    }
  };

  // Get vertical alignment CSS for new renderer
  const getVerticalAlign = () => {
    switch (item.alignment?.vertical) {
      case "middle":
        return "center";
      case "bottom":
        return "flex-end";
      default:
        return "flex-start"; // top
    }
  };

  // Calculate text X position for legacy renderer
  const calculateTextX = () => {
    if (item.alignment.horizontal === "center") {
      return item.width / 2;
    }
    if (item.alignment.horizontal === "right") {
      return item.width;
    }
    return 0; // 'left' alignment
  };

  // Calculate text Y position for legacy renderer — must match canvas/Text.jsx
  // exactly, including the lineHeight/4 padding canvas adds to top/bottom so
  // legacy SVG text positions identically in the editor and the preview/footer.
  const calculateTextY = () => {
    const numberOfLines = item.text.split("\n").length;
    const totalTextHeight = (numberOfLines - 1) * lineHeight;

    if (item.alignment.vertical === "middle") {
      let y = item.height / 2 - totalTextHeight / 2;
      return y;
    }
    if (item.alignment.vertical === "bottom") {
      return item.height - totalTextHeight - lineHeight / 4;
    }
    return lineHeight / 4; // 'top' alignment
  };

  // Shared text style for both richText and plain text branches
  const getTextDivStyle = () => ({
    fontFamily: item.font.family,
    fontSize: `${parseInt(item.font.size)}px`,
    fontWeight: item.font.weight,
    fontStyle: item.font.style || "normal",
    textDecoration: item.font.decoration || "none",
    textTransform: item.textTransform || "none",
    textAlign: getHorizontalAlign(),
    textJustify: item.alignment?.horizontal === "justify" ? "inter-word" : "auto",
    lineHeight: dynamicLineHeight,
    letterSpacing: dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal',
    // Half-leading compensation only when vertically centered.
    // Applying it for top/bottom alignment causes Firefox to clip
    // the first line's ascenders inside foreignObject.
    marginTop: (dynamicLineHeight > 1 && item.alignment?.vertical === "middle")
      ? `-${((dynamicLineHeight - 1) * parseInt(item.font.size)) / 2}px`
      : '0',
    whiteSpace: item.subtype ? "nowrap" : "pre-wrap",
    wordBreak: item.subtype ? "normal" : "break-word",
    overflowWrap: item.subtype ? "normal" : "anywhere",
    boxSizing: "border-box",
    // Match canvas: disable kerning/ligatures so glyph advance widths
    // (especially for script fonts) are identical between canvas and preview.
    fontFeatureSettings: '"kern" 0, "liga" 0, "calt" 0, "clig" 0',
    fontKerning: "none",
    fontVariantLigatures: "none",
    textRendering: "geometricPrecision",
    overflow: "visible",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    opacity: item.style.opacity,
    filter: `brightness(${item.style.effects.brightness}%) contrast(${item.style.effects.contrast}%) saturate(${item.style.effects.saturation}%) grayscale(${item.style.effects.grayscale}%) sepia(${item.style.effects.sepia}%) blur(${item.style.effects.blur}px)`,
    outline: "none",
    minHeight: "1em",
    cursor: "inherit",
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    pointerEvents: "none",
  });

  // ============================================
  // NEW RENDERER (Version 2+): foreignObject
  // Supports word-wrap, justify, all alignments
  // ============================================
  if (useNewRenderer) {
    const textColorStyle = getTextGradientStyle();
    const bgGradientCss = getBgGradientCss();
    return (
      <g
        className="fade-animate"
        key={item.id + "Text"}
        style={{
          cursor: item.editable ? "text" : "default",
        }}
      >
        {/* Background gradient definition */}
        {hasBgGradient && <TextBackgroundGradientDef item={item} />}

        {/* Background Rectangle */}
        <rect
          x={0}
          y={0}
          width={item.width}
          height={item.height}
          fill={hasBgGradient ? `url(#text-bg-gradient-${item.id})` : (item.bgcolor || "none")}
          stroke={item.style.border.color || "none"}
          strokeWidth={item.style.border.width || 0}
          rx={item.style.border.radius || 0}
        />

        {/* Text using foreignObject for all alignments — overflow must
            match canvas/Text.jsx: clip non-calendar text to item.height so
            preview/footer don't show content the canvas would hide. Calendar
            month/year (subtype) stays visible since its sizing is dynamic. */}
        <foreignObject
          ref={foreignObjectRef}
          x={0}
          y={0}
          width={item.width + FIREFOX_WRAP_SLACK}
          height={item.height}
          style={{ overflow: item.subtype ? "visible" : "hidden" }}
          className={item.subtype ? `cal-${item.subtype}` : undefined}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: getVerticalAlign(),
              padding: 0,
              margin: 0,
              boxSizing: "border-box",
              overflow: "visible",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              pointerEvents: "none",
              ...(hasBgGradient && { background: bgGradientCss }),
            }}
          >
            {item.richText ? (
              <div
                className={item.subtype ? `cal-${item.subtype}-text` : undefined}
                style={{
                  ...getTextDivStyle(),
                  ...textColorStyle,
                }}
                dangerouslySetInnerHTML={{ __html: item.richText }}
              />
            ) : (
              <div
                className={item.subtype ? `cal-${item.subtype}-text` : undefined}
                style={{
                  ...getTextDivStyle(),
                  ...textColorStyle,
                }}
              >
                {item.text}
              </div>
            )}
          </div>
        </foreignObject>
      </g>
    );
  }

  // ============================================
  // LEGACY RENDERER: Original SVG-based rendering
  // Exact code from main branch - NO justify support
  // ============================================
  return (
    <g
      className={`fade-animate${item.subtype ? ` cal-${item.subtype}` : ""}`}
      key={item.id + "Text"}
      style={{
        cursor: item.editable ? "text" : "default",
      }}
    >
      {/* Gradient definitions */}
      {hasGradient && <TextGradientDef item={item} />}
      {hasBgGradient && <TextBackgroundGradientDef item={item} />}

      {/* Background Rectangle */}
      <rect
        x={0}
        y={0}
        width={item.width}
        height={item.height}
        fill={hasBgGradient ? `url(#text-bg-gradient-${item.id})` : (item.bgcolor || "none")}
        stroke={item.style.border.color || "none"}
        strokeWidth={item.style.border.width || 0}
        rx={item.style.border.radius || 0}
      />

      {/* Text */}
      <text
        x={calculateTextX()} // Calculate x position based on alignment
        y={calculateTextY()} // Calculate y position based on alignment
        fontSize={parseInt(item.font.size)} // Adjust font size based on zoom
        fontWeight={item.font.weight}
        fontFamily={item.font.family}
        textDecoration={item.font.decoration}
        fontStyle={item.font.style}
        fill={hasGradient ? `url(#text-gradient-${item.id})` : item.color}
        xmlSpace="preserve"
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
        style={{
          opacity: item.style.opacity,
          filter: `brightness(${item.style.effects.brightness}%) contrast(${item.style.effects.contrast}%) saturate(${item.style.effects.saturation}%) grayscale(${item.style.effects.grayscale}%) sepia(${item.style.effects.sepia}%) blur(${item.style.effects.blur}px)`,
        }}
      >
        {item.text.split("\n").map((line, index) => (
          <tspan
            key={index}
            x={calculateTextX()} // Set the x position for each line
            dy={index === 0 ? "0" : `${dynamicLineHeight}em`} // First line at 0, subsequent lines at line-height
            contentEditable={item.editable === true ? "true" : "false"}
            suppressContentEditableWarning={true}
            style={{
              opacity: item.style.opacity,
              letterSpacing: dynamicLetterSpacing ? `${dynamicLetterSpacing / 1000}em` : 'normal',
              textTransform: item.textTransform || "none",
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

export default Text;

const TextGradientDef = ({ item }) => {
if (!item.gradient || !item.gradient.stops || item.gradient.stops.length < 2) return null;

const sortedStops = [...item.gradient.stops].sort((a, b) => a.position - b.position);
const isRadial = item.gradient.type === "radial";

return (
  <defs>
    {isRadial ? (
      <radialGradient
        id={`text-gradient-${item.id}`}
        {...getRadialGradientCoords(item.gradient.radialPosition)}
      >
        {sortedStops.map((stop, idx) => (
          <stop
            key={idx}
            offset={`${stop.position}%`}
            stopColor={stop.color?.slice(0, 7) || "#000000"}
            stopOpacity={
              stop.color?.length === 9
                ? parseInt(stop.color.slice(7, 9), 16) / 255
                : 1
            }
          />
        ))}
      </radialGradient>
    ) : (
      <linearGradient
        id={`text-gradient-${item.id}`}
        {...getLinearGradientCoords(item.gradient.angle || 90)}
      >
        {sortedStops.map((stop, idx) => (
          <stop
            key={idx}
            offset={`${stop.position}%`}
            stopColor={stop.color?.slice(0, 7) || "#000000"}
            stopOpacity={
              stop.color?.length === 9
                ? parseInt(stop.color.slice(7, 9), 16) / 255
                : 1
            }
          />
        ))}
      </linearGradient>
    )}
  </defs>
);
};

const TextBackgroundGradientDef = ({ item }) => {
if (!item.bgGradient || !item.bgGradient.stops || item.bgGradient.stops.length < 2) return null;

const sortedStops = [...item.bgGradient.stops].sort((a, b) => a.position - b.position);
const isRadial = item.bgGradient.type === "radial";

return (
  <defs>
    {isRadial ? (
      <radialGradient
        id={`text-bg-gradient-${item.id}`}
        {...getRadialGradientCoords(item.bgGradient.radialPosition)}
      >
        {sortedStops.map((stop, idx) => (
          <stop
            key={idx}
            offset={`${stop.position}%`}
            stopColor={stop.color?.slice(0, 7) || "#000000"}
            stopOpacity={
              stop.color?.length === 9
                ? parseInt(stop.color.slice(7, 9), 16) / 255
                : 1
            }
          />
        ))}
      </radialGradient>
    ) : (
      <linearGradient
        id={`text-bg-gradient-${item.id}`}
        {...getLinearGradientCoords(item.bgGradient.angle || 90)}
      >
        {sortedStops.map((stop, idx) => (
          <stop
            key={idx}
            offset={`${stop.position}%`}
            stopColor={stop.color?.slice(0, 7) || "#000000"}
            stopOpacity={
              stop.color?.length === 9
                ? parseInt(stop.color.slice(7, 9), 16) / 255
                : 1
            }
          />
        ))}
      </linearGradient>
    )}
  </defs>
);
};
