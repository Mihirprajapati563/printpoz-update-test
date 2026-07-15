/**
 * Data-Driven SVG Generator
 * 
 * This utility generates SVG markup directly from JSON page data,
 * eliminating the need for DOM-based serialization (svgRef cloning).
 * 
 * It replicates the output structure of getSVGDataToExport:
 * {
 *   pageIndex,
 *   svgContent,
 *   width,
 *   height,
 *   safeAreaImages: [{ safeAreaId, svgContent, width, height }],
 *   fonts: [{ name, weights }]
 * }
 */

import {
    getLinearGradientCoords,
    getRadialGradientCoords,
} from "../helpers/gradientUtils";
import { USER_TYPES, EDITOR_TYPES } from "../constants/index.js";
import { Fontfamilies } from "../../utils/jsons/commonJSON.js";
import {
    getMonthName,
    convertNumberToLanguage,
} from "../../../components/calendar/DynamicCalendar";
import { getMonthYear } from "./index.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape special XML characters in text content
 */
function escapeXml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Generate a rounded rectangle path
 */
function generateRoundedRectPath(width, height, radius) {
    const effectiveRadius = Math.min(radius, width / 2, height / 2);
    return `M${effectiveRadius},0 H${width - effectiveRadius} A${effectiveRadius},${effectiveRadius} 0 0 1 ${width},${effectiveRadius} V${height - effectiveRadius} A${effectiveRadius},${effectiveRadius} 0 0 1 ${width - effectiveRadius},${height} H${effectiveRadius} A${effectiveRadius},${effectiveRadius} 0 0 1 0,${height - effectiveRadius} V${effectiveRadius} A${effectiveRadius},${effectiveRadius} 0 0 1 ${effectiveRadius},0 Z`.trim();
}

/**
 * Generate filter SVG for photo effects
 */
function generatePhotoFilter(item) {
    const hasAnyEffect =
        item.effect ||
        item.effects?.brightness !== 0 ||
        item.effects?.contrast !== 0 ||
        item.effects?.saturation !== 0;

    if (!hasAnyEffect) return "";

    const filterId = `image_effect_${item.id}`;
    const brightnessValue = item.effects?.brightness || 0;
    const contrastValue = item.effects?.contrast || 0;
    const saturationValue = item.effects?.saturation || 0;

    // Brightness Calculation
    const brightnessIntercept = brightnessValue !== 0 ? brightnessValue / 255 : 0;

    // Contrast Calculation
    const contrastSlope =
        contrastValue !== 0 ? Math.max((contrastValue + 100) / 100, 0.01) : 1;
    const contrastIntercept = contrastValue !== 0 ? (1 - contrastSlope) / 2 : 0;

    // Saturation Calculation
    const saturationSlope =
        saturationValue !== 0 ? (saturationValue + 100) / 100 : 1;

    let filterContent = "";

    // Effect filters
    if (item.effect === "bw") {
        filterContent += `<feColorMatrix in="SourceGraphic" type="matrix" values="0.5 0.7 0 0 0 0.5 0.7 0 0 0 0.3 0.7 0 0 0 0 0 0 1 0"/>`;
    } else if (item.effect === "blur") {
        filterContent += `<feGaussianBlur in="SourceGraphic" stdDeviation="25"/>`;
    } else if (item.effect === "grayscale") {
        filterContent += `<feColorMatrix in="SourceGraphic" type="saturate" values="0"/>`;
    } else if (item.effect === "sepia") {
        filterContent += `<feColorMatrix in="SourceGraphic" type="matrix" values="0.34 0.67 0.12 0 0  0.25 0.67 0.13 0 0  0.17 0.33 0.11 0 0  0 0 0 1 0"/>`;
    } else if (item.effect === "invert") {
        filterContent += `<feColorMatrix in="SourceGraphic" type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/>`;
    } else if (item.effect === "hue-rotate") {
        filterContent += `<feColorMatrix in="SourceGraphic" type="hueRotate" values="180"/>`;
    }

    // Brightness adjustment
    if (brightnessValue !== 0) {
        filterContent += `<feComponentTransfer>
      <feFuncR type="linear" slope="1" intercept="${brightnessIntercept}"/>
      <feFuncG type="linear" slope="1" intercept="${brightnessIntercept}"/>
      <feFuncB type="linear" slope="1" intercept="${brightnessIntercept}"/>
    </feComponentTransfer>`;
    }

    // Contrast adjustment
    if (contrastValue !== 0) {
        filterContent += `<feComponentTransfer>
      <feFuncR type="linear" slope="${contrastSlope}" intercept="${contrastIntercept}"/>
      <feFuncG type="linear" slope="${contrastSlope}" intercept="${contrastIntercept}"/>
      <feFuncB type="linear" slope="${contrastSlope}" intercept="${contrastIntercept}"/>
    </feComponentTransfer>`;
    }

    // Saturation adjustment
    if (saturationValue !== 0) {
        const s = saturationSlope;
        filterContent += `<feColorMatrix type="matrix" values="${0.213 + 0.787 * s} ${0.715 - 0.715 * s} ${0.072 - 0.072 * s} 0 0 ${0.213 - 0.213 * s} ${0.715 + 0.285 * s} ${0.072 - 0.072 * s} 0 0 ${0.213 - 0.213 * s} ${0.715 - 0.715 * s} ${0.072 + 0.928 * s} 0 0 0 0 0 1 0"/>`;
    }

    return `<filter id="${filterId}">${filterContent}</filter>`;
}

/**
 * Generate filter SVG for sticker effects
 */
function generateStickerFilter(item) {
    if (!item.effect) return "";
    const filterId = `sticker_effect_${item.id}`;

    let filterContent = "";
    switch (item.effect) {
        case "bw":
            filterContent = `<feColorMatrix in="SourceGraphic" type="matrix" values="0.3 0.7 0 0 0 0.3 0.7 0 0 0 0.3 0.7 0 0 0 0 0 0 1 0"/>`;
            break;
        case "blur":
            filterContent = `<feGaussianBlur in="SourceGraphic" stdDeviation="25"/>`;
            break;
        case "grayscale":
            filterContent = `<feColorMatrix in="SourceGraphic" type="saturate" values="0"/>`;
            break;
        case "sepia":
            filterContent = `<feColorMatrix in="SourceGraphic" type="matrix" values="0.34 0.67 0.12 0 0  0.25 0.67 0.13 0 0  0.17 0.33 0.11 0 0  0 0 0 1 0"/>`;
            break;
        case "invert":
            filterContent = `<feColorMatrix in="SourceGraphic" type="invert" values="1"/>`;
            break;
        case "hue-rotate":
            filterContent = `<feColorMatrix in="SourceGraphic" type="hueRotate" values="180"/>`;
            break;
        default:
            return "";
    }

    return `<filter id="${filterId}">${filterContent}</filter>`;
}

/**
 * Generate shadow filter definition
 */
function generateShadowFilter(item, type) {
    const offsetX = item?.shadow?.offsetX || 0;
    const offsetY = item?.shadow?.offsetY || 0;
    const blurRadius = item?.shadow?.blurRadius || 0;
    const shadowColor = item?.shadow?.color || "#000000AD";
    const filterSize = type === "sticker" ? "2" : "4";

    return `<filter id="shadow_${type}_item_${item.id}" width="${filterSize}" height="${filterSize}" x="-1" y="-1">
    <feDropShadow stdDeviation="${blurRadius}" dx="${offsetX}" dy="${offsetY}" floodColor="${shadowColor}"/>
  </filter>`;
}

/**
 * Generate gradient definition for shapes
 */
function generateShapeGradient(item) {
    if (!item.gradient || !item.gradient.stops || item.gradient.stops.length < 2) {
        return "";
    }

    const sortedStops = [...item.gradient.stops].sort((a, b) => a.position - b.position);
    const isRadial = item.gradient.type === "radial";

    const stopsContent = sortedStops
        .map((stop, idx) => {
            const stopColor = stop.color?.slice(0, 7) || "#000000";
            const stopOpacity =
                stop.color?.length === 9
                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                    : 1;
            return `<stop offset="${stop.position}%" stop-color="${stopColor}" stop-opacity="${stopOpacity}"/>`;
        })
        .join("");

    if (isRadial) {
        const coords = getRadialGradientCoords(item.gradient.radialPosition);
        return `<radialGradient id="shape-gradient-${item.id}" cx="${coords.cx}" cy="${coords.cy}" r="${coords.r}" fx="${coords.fx}" fy="${coords.fy}">${stopsContent}</radialGradient>`;
    } else {
        const coords = getLinearGradientCoords(item.gradient.angle || 90);
        return `<linearGradient id="shape-gradient-${item.id}" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}">${stopsContent}</linearGradient>`;
    }
}

// ============================================================================
// OBJECT RENDERERS
// ============================================================================

/**
 * Render a text object to SVG
 */
function renderTextObject(item, pageIndex, calendarSettings, allObjects = [], allPages = []) {
    // Some saved text boxes carry a NEGATIVE width/height (created by dragging a
    // resize handle past the opposite edge). A negative value is invalid on SVG
    // <rect>/<foreignObject> — it throws "attribute width: A negative value is
    // not valid" and breaks both the on-screen render and the offscreen thumbnail
    // render. Use the magnitude so the box is valid and sized as the user drew it.
    const width = Math.abs(Number(item.width) || 0);
    const height = Math.abs(Number(item.height) || 0);
    const lineHeight = 1.2 * parseInt(item.font.size);

    // Month page index calculation to compensate for cover page
    const monthPageIndex = calendarSettings?.addCover ? Math.max(0, pageIndex - 1) : pageIndex;

    // Handle calendar text subtypes
    let textContent = item.text;
    if (item.subtype && calendarSettings) {
        const startMonth = parseInt(calendarSettings.startMonth);
        const startYear = parseInt(calendarSettings.startYear);
        const language = calendarSettings.language || "en";

        // Calculate correct month page index mapping
        let targetMonthPageIndex = monthPageIndex;
        if (item.subtype === "month" || item.subtype === "year") {
            const calendars = allObjects.filter(o => o.type === "calendar" || o.type === "multiple-calendar");
            const calendarCount = calendars.length || 1;
            if (calendarCount > 1) {
                const subtypeObjs = allObjects.filter(o => o.type === "text" && o.subtype === item.subtype);
                const idx = subtypeObjs.findIndex(o => o.id === item.id);
                const mappedIdx = Math.min(idx, calendarCount - 1);
                // Sum calendar objects from all previous pages (skip cover)
                const coverOffset = calendarSettings?.addCover ? 1 : 0;
                let prevCount = 0;
                for (let p = coverOffset; p < pageIndex; p++) {
                    (allPages[p]?.layout || []).forEach(layout => {
                        if (layout?.objects) prevCount += layout.objects.filter(o => o.type === "calendar" || o.type === "multiple-calendar").length;
                    });
                }
                targetMonthPageIndex = prevCount + mappedIdx;
            }
        }

        const { month, year } = getMonthYear(startMonth, startYear, targetMonthPageIndex);

        if (item.subtype === "month") {
            textContent = getMonthName(month, language, "full");
        } else if (item.subtype === "year") {
            textContent = String(convertNumberToLanguage(year, language));
        }
    }

    // Check if new renderer (version 2+)
    const useNewRenderer = item.editorVersion && item.editorVersion >= 2;

    // Calculate text positioning
    const calculateTextX = () => {
        if (item.alignment.horizontal === "center") return width / 2;
        if (item.alignment.horizontal === "right") return width;
        return 0;
    };

    const calculateTextY = () => {
        const lines = textContent.split("\n");
        const numberOfLines = lines.length;
        const totalTextHeight = (numberOfLines - 1) * lineHeight;

        if (item.alignment.vertical === "middle") {
            return height / 2 - totalTextHeight / 2;
        }
        if (item.alignment.vertical === "bottom") {
            return height - totalTextHeight - lineHeight / 4;
        }
        return lineHeight / 4;
    };

    const getHorizontalAlign = () => {
        switch (item.alignment?.horizontal) {
            case "center": return "center";
            case "right": return "right";
            case "justify": return "justify";
            default: return "left";
        }
    };

    const getVerticalAlign = () => {
        switch (item.alignment?.vertical) {
            case "middle": return "center";
            case "bottom": return "flex-end";
            default: return "flex-start";
        }
    };

    // Background rectangle
    const bgRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${item.bgcolor || "none"}" stroke="${item.style?.border?.color || "none"}" stroke-width="${item.style?.border?.width || 0}" rx="${item.style?.border?.radius || 0}"/>`;

    if (useNewRenderer) {
        // New renderer uses foreignObject
        const textStyle = `
      font-family: ${item.font.family};
      font-size: ${parseInt(item.font.size)}px;
      font-weight: ${item.font.weight};
      font-style: ${item.font.style || "normal"};
      text-decoration: ${item.font.decoration || "none"};
      color: ${item.color};
      text-align: ${getHorizontalAlign()};
      text-justify: ${item.alignment?.horizontal === "justify" ? "inter-word" : "auto"};
      line-height: 1.2;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: hidden;
      opacity: ${item.style?.opacity || 1};
    `.replace(/\n/g, " ").trim();

        const containerStyle = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: ${getVerticalAlign()};
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      overflow: hidden;
    `.replace(/\n/g, " ").trim();

        return `<g class="fade-animate">
      ${bgRect}
      <foreignObject x="0" y="0" width="${width}" height="${height}" style="overflow: hidden;"${item.groupKey ? ` data-smart-text-id="${item.groupKey}"` : ""}>
        <div xmlns="http://www.w3.org/1999/xhtml" style="${containerStyle}">
          <div style="${textStyle}">${escapeXml(textContent)}</div>
        </div>
      </foreignObject>
    </g>`;
    }

    // Legacy renderer uses SVG text
    const textAnchor =
        item.alignment.horizontal === "center"
            ? "middle"
            : item.alignment.horizontal === "right"
                ? "end"
                : "start";

    const dominantBaseline =
        item.alignment.vertical === "middle"
            ? "middle"
            : item.alignment.vertical === "bottom"
                ? "baseline"
                : "hanging";

    const lines = textContent.split("\n");
    const tspans = lines
        .map((line, index) => {
            const content = line.trim() === "" ? "\u00A0" : escapeXml(line);
            const style = `opacity: ${item.style?.opacity || 1}; font-size: ${parseInt(item.font.size)}px; font-weight: ${item.font.weight}; font-family: ${item.font.family}; font-style: ${item.font.style || "normal"}; text-decoration: ${item.font.decoration || "none"};`;
            return `<tspan x="${calculateTextX()}" dy="${index === 0 ? 0 : "1.2em"}" style="${style}">${content}</tspan>`;
        })
        .join("");

    return `<g class="fade-animate">
    ${bgRect}
    <text x="${calculateTextX()}" y="${calculateTextY()}" font-size="${parseInt(item.font.size)}" font-weight="${item.font.weight}" font-family="${item.font.family}" text-decoration="${item.font.decoration || "none"}" font-style="${item.font.style || "normal"}" fill="${item.color}" xml:space="preserve" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}"${item.groupKey ? ` data-smart-text-id="${item.groupKey}"` : ""}>
      ${tspans}
    </text>
  </g>`;
}

/**
 * Render a photo object to SVG
 */
function renderPhotoObject(item) {
    const { width, height } = item;
    // Export must use the LARGE (full-resolution) variant for print quality.
    // The canvas may DISPLAY a lighter variant (progressive loading), but the
    // object also carries the full `urls` set — prefer its large entry, falling
    // back to item.url (which is already the large URL for normally-placed photos).
    const largeUrl = Array.isArray(item.urls)
        ? item.urls.find((u) => u && u.size === "large" && u.url)?.url
        : null;
    const url = largeUrl || item.url;
    const isPlaceholder = !url || url === "";

    // Calculate scaling factors for masking
    const baseWidth = item.masking?.width || 24;
    const baseHeight = item.masking?.height || 24;
    const scaleX = width / baseWidth;
    const scaleY = height / baseHeight;
    const r = (parseFloat(width) * parseFloat(item.border?.radius) || 0) / 24;

    // Check for effects
    const hasAnyEffect =
        item.effect ||
        item.effects?.brightness !== 0 ||
        item.effects?.contrast !== 0 ||
        item.effects?.saturation !== 0;
    const filterId = hasAnyEffect ? `url(#image_effect_${item.id})` : null;

    // Generate image transform
    const imageTransformParts = [];
    if (item.flip?.x) {
        imageTransformParts.push(`translate(${item.image?.width || width}px) scaleX(-1)`);
    }
    if (item.flip?.y) {
        imageTransformParts.push("scaleY(-1)");
    }
    if (item.image?.scale) {
        imageTransformParts.push(`scale(${parseFloat(item.image.scale.toFixed(4))})`);
    }
    const imageTransform = imageTransformParts.join(" ");

    // Generate clip path
    const rectanglePath = "M0 0 L24 0 L24 24 L0 24 Z";
    const isCustomMask = item.masking?.path && item.masking.path !== rectanglePath;

    const clipPathContent = isCustomMask
        ? `<path class="page-item--box" transform="scale(${scaleX}, ${scaleY})" d="${item.masking.path}"/>`
        : `<path class="page-item--box" d="${generateRoundedRectPath(width, height, r)}" fill="transparent" stroke="black"/>`;

    // Generate border path
    const borderPath = isCustomMask
        ? `<path class="page_photo_item" data-id="${item.id}" transform="scale(${scaleX}, ${scaleY})" d="${item.masking.path}" fill="transparent" stroke="${item.border?.color || "none"}" stroke-width="${(item.border?.width || 0) / 24}"/>`
        : `<path data-id="${item.id}" class="page_photo_item" d="${generateRoundedRectPath(width, height, r)}" fill="transparent" stroke="${item.border?.color || "none"}" stroke-width="${item.border?.width || 0}"/>`;

    // Generate defs (shadow filter, effects filter, clip path)
    let defs = generateShadowFilter(item, "photo");
    if (hasAnyEffect) {
        defs += generatePhotoFilter(item);
    }
    defs += `<clipPath id="clip-custom-${item.id}">${clipPathContent}</clipPath>`;

    // Generate image content
    let imageContent = "";
    if (!isPlaceholder) {
        const flipStyle = item.flip?.x ? `transform: translate(${width}px) scaleX(-1);` : "";
        imageContent = `<g ${hasAnyEffect ? `filter="${filterId}"` : ""} style="cursor: grab; ${flipStyle}">
      <rect x="0" y="0" data-id="${item.id}" class="page-img-rect" width="${width}" height="${height}" fill="transparent"/>
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="page_photo_item" data-id="${item.id}" style="width: ${width}px; height: ${height}px;">
          <img src="${url}" alt="image" data-id="${item.id}" width="${item.image?.width || width}" height="${item.image?.height || height}" style="cursor: grab; position: relative; left: ${item.image?.positionX || 0}px; top: ${item.image?.positionY || 0}px; ${imageTransform ? `transform: ${imageTransform}; transform-origin: 0 0;` : ""}"/>
        </div>
      </foreignObject>
    </g>`;
    } else {
        // Placeholder
        imageContent = `<rect x="0" y="0" data-id="${item.id}" class="page-img-rect" width="${width}" height="${height}" fill="#f0f0f0"/>`;
    }

    return `<g filter="url(#shadow_photo_item_${item.id})" class="photo-item fade-animate">
    <defs>${defs}</defs>
    <g class="page-item--positioning-container" style="opacity: ${item.opacity || 1}">
      <g clip-path="url(#clip-custom-${item.id})">
        ${imageContent}
      </g>
    </g>
    ${borderPath}
  </g>`;
}

/**
 * Render a sticker object to SVG
 */
function renderStickerObject(item) {
    const { width, height, url } = item;

    // Calculate scaling factors
    const baseWidth = item.masking?.width || 24;
    const baseHeight = item.masking?.height || 24;
    const scaleX = width / baseWidth;
    const scaleY = height / baseHeight;
    const r = (width * (item.border?.radius || 0)) / 24;

    // Generate clip path
    const rectanglePath = "M0 0 L24 0 L24 24 L0 24 Z";
    const isCustomMask = item.masking?.path && item.masking.path !== rectanglePath;

    const clipPathContent = isCustomMask
        ? `<path class="page-item--box" transform="scale(${scaleX}, ${scaleY})" d="${item.masking.path}"/>`
        : `<path class="page-item--box" d="${generateRoundedRectPath(width, height, r)}" fill="transparent" stroke="black"/>`;

    // Generate border path
    const borderPath = isCustomMask
        ? `<path class="page_sticker_item" data-id="${item.id}" transform="scale(${scaleX}, ${scaleY})" d="${item.masking.path}" fill="transparent" stroke="${item.border?.color || "none"}" stroke-width="${item.border?.width || 0}"/>`
        : `<path data-id="${item.id}" class="page_sticker_item" d="${generateRoundedRectPath(width, height, r)}" fill="transparent" stroke="${item.border?.color || "none"}" stroke-width="${item.border?.width || 0}"/>`;

    const filterId = item.effect ? `url(#sticker_effect_${item.id})` : null;
    const flipStyle = item.flip?.x ? `transform: translate(${width}px) scaleX(-1);` : "";

    // Generate defs
    let defs = generateShadowFilter(item, "sticker");
    if (item.effect) {
        defs += generateStickerFilter(item);
    }
    defs += `<clipPath id="clip-custom-${item.id}">${clipPathContent}</clipPath>`;

    return `<g filter="url(#shadow_sticker_item_${item.id})" class="sticker-item-svg fade-animate">
    <defs>${defs}</defs>
    <g class="page-item--positioning-container" style="opacity: ${item.opacity || 1}">
      <g clip-path="url(#clip-custom-${item.id})">
        <g ${item.effect ? `filter="${filterId}"` : ""}>
          <rect x="0" y="0" data-id="${item.id}" class="page-sticker-rect" width="${width}" height="${height}" fill="transparent"/>
          <image class="page_sticker_item" data-id="${item.id}" href="${url}" data-cy="svg-image" style="cursor: grab; ${flipStyle}" preserveAspectRatio="xMidYMid meet" width="${width}" height="${height}" opacity="1"/>
        </g>
      </g>
    </g>
    ${borderPath}
  </g>`;
}

/**
 * Render a shape object to SVG
 */
function renderShapeObject(item) {
    const { width, height, shape } = item;
    const scaleX = width / 24;
    const scaleY = height / 24;

    // Determine fill value
    const fillValue =
        item.gradient && item.gradient.stops && item.gradient.stops.length >= 2
            ? `url(#shape-gradient-${item.id})`
            : item.fill || "transparent";

    const strokeDasharray = item.border?.style === "dashed" ? "5, 5" : "none";

    // Generate defs
    let defs = generateShadowFilter(item, "shape");
    defs += generateShapeGradient(item);

    // Generate shape content based on type
    let shapeContent = "";
    switch (shape) {
        case "rect":
            shapeContent = `<rect x="0" y="0" width="${width}" height="${height}" rx="${(item.border?.radius || 0) * scaleX}" ry="${(item.border?.radius || 0) * scaleX}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${(item.border?.width || 0) * scaleX}" class="page-shape-rect"/>`;
            break;
        case "circle":
            shapeContent = `<circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${(item.border?.width || 0) * scaleX}" fill="${item.fill || "transparent"}"/>`;
            break;
        case "heart":
            const heartPath = "M12 4.248c-3.148-5.402-12-3.825-12 2.944 0 4.661 5.571 9.427 12 15.808 6.43-6.381 12-11.147 12-15.808 0-6.792-8.875-8.306-12-2.944z";
            shapeContent = `<path d="${heartPath}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${((item.border?.width || 0) * scaleX) / scaleX}" fill="${item.fill || "transparent"}" transform="scale(${scaleX}, ${scaleY})"/>`;
            break;
        case "star":
            const starPath = "m11.322 2.923c.126-.259.39-.423.678-.423.289 0 .552.164.678.423.974 1.998 2.65 5.44 2.65 5.44s3.811.524 6.022.829c.403.055.65.396.65.747 0 .19-.072.383-.231.536-1.61 1.538-4.382 4.191-4.382 4.191s.677 3.767 1.069 5.952c.083.462-.275.882-.742.882-.122 0-.244-.029-.355-.089-1.968-1.048-5.359-2.851-5.359-2.851s-3.391 1.803-5.359 2.851c-.111.06-.234.089-.356.089-.465 0-.825-.421-.741-.882.393-2.185 1.07-5.952 1.07-5.952s-2.773-2.653-4.382-4.191c-.16-.153-.232-.346-.232-.535 0-.352.249-.694.651-.748 2.211-.305 6.021-.829 6.021-.829s1.677-3.442 2.65-5.44z";
            shapeContent = `<path d="${starPath}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${((item.border?.width || 0) * scaleX) / scaleX}" fill="${item.fill || "transparent"}" transform="scale(${scaleX}, ${scaleY})"/>`;
            break;
        case "triangle":
            const trianglePath = "M12 2 L22 22 L2 22 Z";
            shapeContent = `<path d="${trianglePath}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${((item.border?.width || 0) * scaleX) / scaleX}" fill="${item.fill || "transparent"}" transform="scale(${scaleX}, ${scaleY})"/>`;
            break;
        case "arrow":
            const arrowPath = "M12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C21.0976 11.6834 21.0976 12.3166 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H4C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289Z";
            shapeContent = `<path d="${arrowPath}" data-id="${item.id}" stroke="${item.border?.color || "none"}" stroke-width="${((item.border?.width || 0) * scaleX) / scaleX}" fill="${item.fill || "transparent"}" transform="scale(${scaleX}, ${scaleY})"/>`;
            break;
        case "line":
            let borderWidth = (item.border?.width || 0) * scaleX;
            if (borderWidth <= 0) borderWidth = 1 * scaleX;
            shapeContent = `<line x1="0" y1="0" x2="${width}" y2="${height}" data-id="${item.id}" stroke="${item.border?.color || "#000"}" stroke-width="${borderWidth}" fill="${item.fill || "transparent"}"/>`;
            break;
        default:
            shapeContent = "";
    }

    return `<g filter="url(#shadow_shape_item_${item.id})" class="shape-item-svg fade-animate">
    <defs>${defs}</defs>
    <g class="page-item--positioning-container" style="opacity: ${item.opacity || 1}">
      <g style="fill: ${fillValue}; stroke-dasharray: ${strokeDasharray};">
        ${shapeContent}
      </g>
    </g>
  </g>`;
}

/**
 * Render a calendar object to SVG (simplified - actual calendar rendering is complex)
 */
function renderCalendarObject(item, pageIndex, calendarSettings) {
    // Calendar rendering is complex and depends on DynamicCalendar component logic
    // For data-driven generation, we need to replicate the calendar grid logic
    // This is a placeholder that would need the full calendar rendering implementation
    const { width, height } = item;

    return `<g class="calendar-item fade-animate">
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" stroke="#ccc" stroke-width="1"/>
    <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#666">Calendar</text>
  </g>`;
}

function renderQRCodeObject(item) {
    const { width, height, qrUrl, qrFgColor, qrBgColor, qrSvgPaths } = item;
    const r = (width * (item.border?.radius || 0)) / 24;

    const clipPathContent = `<path class="page-item--box" d="${generateRoundedRectPath(width, height, r)}" fill="transparent"/>`;
    const borderPath = `<path data-id="${item.id}" class="page_qrcode_item" d="${generateRoundedRectPath(width, height, r)}" fill="transparent" stroke="${item.border?.color || "none"}" stroke-width="${item.border?.width || 0}"/>`;

    const defs = generateShadowFilter(item, "qrcode") +
        `<clipPath id="clip-qrcode-${item.id}">${clipPathContent}</clipPath>`;

    let qrContent;
    if (qrSvgPaths && qrSvgPaths.trim()) {
        qrContent = `<svg x="0" y="0" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${qrSvgPaths}</svg>`;
    } else if (qrUrl) {
        qrContent = `<rect x="0" y="0" width="${width}" height="${height}" fill="${qrBgColor || "#FFFFFF"}"/>
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(8, width * 0.06)}" fill="${qrFgColor || "#000000"}">QR: ${qrUrl.slice(0, 30)}</text>`;
    } else {
        qrContent = `<rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 4"/>`;
    }

    return `<g filter="url(#shadow_qrcode_item_${item.id})" class="qrcode-item-svg fade-animate">
    <defs>${defs}</defs>
    <g class="page-item--positioning-container" style="opacity: ${item.opacity || 1}">
      <g clip-path="url(#clip-qrcode-${item.id})">
        ${qrContent}
      </g>
    </g>
    ${borderPath}
  </g>`;
}

/**
 * Render an object based on its type
 */
function renderObject(item, pageIndex, calendarSettings, allObjects = [], allPages = []) {
    // Skip non-exportable items
    if (item.notExportable) {
        return "";
    }

    const transform = `translate(${item.transform?.x || 0}, ${item.transform?.y || 0}) rotate(${item.transform?.rotation || 0})`;

    let objectContent = "";
    switch (item.type) {
        case "text":
            objectContent = renderTextObject(item, pageIndex, calendarSettings, allObjects, allPages);
            break;
        case "img":
            objectContent = renderPhotoObject(item);
            break;
        case "sticker":
            objectContent = renderStickerObject(item);
            break;
        case "qrcode":
            objectContent = renderQRCodeObject(item);
            break;
        case "shape":
            objectContent = renderShapeObject(item);
            break;
        case "calendar":
        case "multiplecalendar":
            // monthPageIndex calculation for consistency
            const monthPageIndex = calendarSettings?.addCover ? Math.max(0, pageIndex - 1) : pageIndex;
            objectContent = renderCalendarObject(item, monthPageIndex, calendarSettings);
            break;
        default:
            return "";
    }

    return `<g transform="${transform}" width="${item.width}" height="${item.height}" style="overflow: hidden;">
    ${objectContent}
  </g>`;
}

// ============================================================================
// BACKGROUND RENDERING
// ============================================================================

/**
 * Generate background pattern definition for image backgrounds
 * Matches Canvas.jsx pattern generation exactly
 */
function generateLayoutBackgroundPattern(layoutId, layoutIndex, background, width, height, flip = false) {
    if (!background?.image) return "";

    // Backward compat: flip can be boolean (old: horizontal only) or { x, y }
    const flipX = typeof flip === "boolean" ? flip : (flip?.x || false);
    const flipY = typeof flip === "boolean" ? false : (flip?.y || false);

    let flipTransform = "";
    if (flipX || flipY) {
        const sx = flipX ? -1 : 1;
        const sy = flipY ? -1 : 1;
        const tx = flipX ? -width : 0;
        const ty = flipY ? -height : 0;
        flipTransform = `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
    }

    return `<pattern id="layout-${layoutIndex}-bg-${layoutId}" patternUnits="objectBoundingBox" width="1" height="1">
    <image href="${background.image}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"${flipTransform ? ` transform="${flipTransform}"` : ""}/>
  </pattern>`;
}

/**
 * Generate gradient definition for layout backgrounds
 * Matches Canvas.jsx gradient generation exactly
 */
function generateLayoutBackgroundGradient(layoutId, layoutIndex, background) {
    if (!background?.gradient || !background.gradient.stops || background.gradient.stops.length < 2) {
        return "";
    }

    const sortedStops = [...background.gradient.stops].sort((a, b) => a.position - b.position);
    const isRadial = background.gradient.type === "radial";

    const stopsContent = sortedStops
        .map((stop, index) => {
            const stopColor = stop.color?.slice(0, 7) || "#000000";
            const stopOpacity =
                stop.color?.length === 9
                    ? parseInt(stop.color.slice(7, 9), 16) / 255
                    : 1;
            return `<stop offset="${stop.position}%" stop-color="${stopColor}" stop-opacity="${stopOpacity}"/>`;
        })
        .join("");

    if (isRadial) {
        const coords = getRadialGradientCoords(background.gradient.radialPosition);
        return `<radialGradient id="gradient-bg-layout-${layoutIndex}-${layoutId}" cx="${coords.cx}" cy="${coords.cy}" r="${coords.r}" fx="${coords.fx}" fy="${coords.fy}">${stopsContent}</radialGradient>`;
    } else {
        const coords = getLinearGradientCoords(background.gradient.angle || 90);
        return `<linearGradient id="gradient-bg-layout-${layoutIndex}-${layoutId}" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}">${stopsContent}</linearGradient>`;
    }
}

/**
 * Determine the fill value for a layout background
 */
function getLayoutBackgroundFill(layoutId, layoutIndex, background) {
    if (background?.gradient && background.gradient.stops?.length >= 2) {
        return `url(#gradient-bg-layout-${layoutIndex}-${layoutId})`;
    }
    if (background?.image) {
        return `url(#layout-${layoutIndex}-bg-${layoutId})`;
    }
    return background?.color || "#ffffff";
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate SVG content for a page purely from data
 *
 * @param {Object} options - The options object
 * @param {Object} options.page - The page data object
 * @param {number} options.pageIndex - The page index
 * @param {Object} options.canvasSize - Canvas dimensions { width, height, bleed, safe }
 * @param {Array} options.safeAreas - Array of safe area definitions
 * @param {Array} options.allObjects - All objects sorted by z-index
 * @param {Array} options.allSafeAreaObjects - Safe area objects sorted by z-index
 * @param {Object} options.calendarSettings - Calendar settings
 * @param {string} options.watermarkData - Watermark text
 * @param {string} options.watermarkColor - Watermark color
 * @param {boolean} options.isPreviewBook - Whether this is a preview book
 * @param {string} options.userTypeCode - User type code
 * @param {Object} options.settings - Global settings
 * @param {Object} options.currentPageSettings - Page-specific settings
 * @param {boolean} options.includeGuides - Whether to include print guides
 * @returns {Object} - SVG data object matching getSVGDataToExport output
 */
export function generatePageSvg(options) {
    const {
        page,
        pageIndex,
        canvasSize,
        safeAreas = [],
        allObjects = [],
        allSafeAreaObjects = [],
        calendarSettings,
        watermarkData,
        watermarkColor,
        isPreviewBook,
        userTypeCode,
        settings,
        currentPageSettings,
        includeGuides = false,
    } = options;

    // Guard against missing data
    if (!page || !canvasSize) {
        return {
            pageIndex,
            svgContent: "",
            width: 0,
            height: 0,
            safeAreaImages: [],
            fonts: [],
        };
    }

    // Determine page type
    const layouts = page.layout || [];
    const numLayouts = layouts.length;
    const isFoldable = settings?.isFoldable && settings?.isFoldable === true;
    // Check both currentPageSettings and page.settings for isHalfSheet
    const isHalfSheet = currentPageSettings?.isHalfSheet || page.settings?.isHalfSheet || false;
    const isCoverPage = page.isCoverPage || page.isCover || false;

    // Get additional context for special page detection
    const activeEditorType = options.activeEditorType || null;
    const totalPages = options.totalPages || 0;

    // Determine if this is a "special page" for photobook (half-width pages)
    // Matches Canvas.jsx calculateSvgDimensions logic:
    // - Cover page (isCover)
    // - Page index 0 or 1
    // - Second to last page (Pages.length - 2)
    const isPhotobook = activeEditorType === EDITOR_TYPES.PHOTOBOOK;
    const isPhotobookSpecialPage = isPhotobook && (
        isCoverPage ||
        pageIndex === 0 ||
        pageIndex === 1 ||
        (totalPages > 2 && pageIndex === totalPages - 2)
    );

    // Determine if this is a single-side export (half width)
    // Same logic as Canvas.jsx calculateSvgDimensions:
    // (isPhotobook && isSpecialPage) || (isFoldable && isHalfSheet)
    const isSingleSideExport = isPhotobookSpecialPage || (isFoldable && isHalfSheet);
    const isCircular = (activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && (page?.settings?.shape === "circle" || page?.shape === "circle" || canvasSize?.shape === "circle");

    // Determine which layout to use for single-side export
    // Based on page type, NOT page.activeSide (which may not be set):
    // - Front cover (pageIndex === 0 or isCoverPage): layout index 0 (right side visually)
    // - First inner page (pageIndex === 1): layout index 0
    // - Second-to-last page / back cover (pageIndex === totalPages - 2): layout index 1 (left side visually)
    // - Foldable half-sheet: layout index 0 by default
    let activeSide = 0;
    if (isPhotobook) {
        if (pageIndex === totalPages - 2 && totalPages > 2) {
            // Back cover / second-to-last page uses layout 1 (left side)
            activeSide = 1;
        } else {
            // Front cover, first inner page use layout 0 (right side)
            activeSide = 0;
        }
    } else if (isFoldable && isHalfSheet) {
        // Foldable half-sheets default to layout 0
        activeSide = 0;
    }

    // Calculate canvas dimensions and viewBox offsets
    const canvasHeight = canvasSize.height;
    const fullSpreadWidth = canvasSize.width;
    const halfWidth = fullSpreadWidth / 2;
    let totalCanvasWidth;
    let layoutWidth;
    let layoutsToRender;
    let viewBoxOffsetX = 0; // X offset for viewBox when exporting a specific side

    if (isSingleSideExport) {
        // Single side export: half width output
        // Canvas.jsx ALWAYS uses viewBox [0, 0, halfWidth, height] for special pages
        // Special pages have objects starting from x=0, not from halfWidth
        totalCanvasWidth = halfWidth;
        layoutWidth = halfWidth;
        // NO viewBox offset - Canvas.jsx always starts at 0 for special pages
        viewBoxOffsetX = 0;
        // Only render layout[0] - special pages only use the first layout
        layoutsToRender = layouts[0] ? [{ layout: layouts[0], index: 0 }] : [];
    } else if (numLayouts >= 2) {
        // Full spread: render both layouts side by side
        totalCanvasWidth = fullSpreadWidth;
        layoutWidth = halfWidth;
        layoutsToRender = layouts.map((layout, index) => ({ layout, index }));
    } else {
        // Single layout page (not a spread)
        totalCanvasWidth = fullSpreadWidth;
        layoutWidth = fullSpreadWidth;
        layoutsToRender = layouts.map((layout, index) => ({ layout, index }));
    }

    // Generate defs content for layout backgrounds
    let defsContent = "";
    const backgroundRects = [];

    layoutsToRender.forEach(({ layout, index }) => {
        if (!layout) return;

        const background = layout.background || {};
        const layoutId = layout.id || `layout-${index}`;
        const flip = background.flip || false;

        // Generate pattern for image background
        defsContent += generateLayoutBackgroundPattern(
            layoutId,
            index,
            background,
            layoutWidth,
            canvasHeight,
            flip
        );

        // Generate gradient for gradient background
        defsContent += generateLayoutBackgroundGradient(layoutId, index, background);

        // Calculate x position for this layout
        // For single-side export: always x=0 (special pages have content starting from 0)
        // For spreads: layout[0] at x=0, layout[1] at x=halfWidth
        let xOffset = isSingleSideExport ? 0 : (index * halfWidth);

        // Determine fill value
        const fillValue = getLayoutBackgroundFill(layoutId, index, background);

        // Generate the background rect for this layout
        backgroundRects.push(
            `<rect id="layout-${index}-part-${layoutId}" x="${xOffset}" y="0" width="${layoutWidth}" height="${canvasHeight}" fill="${fillValue}" opacity="${background.opacity || 1}"/>`
        );
    });

    // If no layouts exist, create a default white background
    if (backgroundRects.length === 0) {
        backgroundRects.push(
            `<rect x="0" y="0" width="${totalCanvasWidth}" height="${canvasHeight}" fill="#ffffff"/>`
        );
    }

    // Safe area clip path
    if (safeAreas.length > 0) {
        const safeAreaRects = safeAreas
            .map((sa) => `<rect x="${sa.left}" y="${sa.top}" width="${sa.width}" height="${sa.height}"/>`)
            .join("");
        defsContent += `<clipPath id="safe-area-clip">${safeAreaRects}</clipPath>`;
    }

    // Shape clip path for custom products
    if (isCircular) {
        defsContent += `<clipPath id="product-shape-clip-${pageIndex}"><ellipse cx="${totalCanvasWidth / 2}" cy="${canvasHeight / 2}" rx="${totalCanvasWidth / 2}" ry="${canvasHeight / 2}"/></clipPath>`;
    }

    // For single-side exports, only render objects from layout[0]
    // Special pages only have content in layout[0] starting from x=0
    let filteredObjects = allObjects;
    let filteredSafeAreaObjects = allSafeAreaObjects;
    
    if (isSingleSideExport) {
        filteredObjects = allObjects.filter((obj) => obj.layoutIndex === 0);
        filteredSafeAreaObjects = allSafeAreaObjects.filter((obj) => obj.layoutIndex === 0);
    }

    // Render objects
    const objectsContent = filteredObjects
        .map((obj) => renderObject(obj, pageIndex, calendarSettings, filteredObjects, options.allPages || []))
        .join("\n");

    // Render safe area objects
    const safeAreaObjectsContent = filteredSafeAreaObjects
        .map((obj) => renderObject(obj, pageIndex, calendarSettings, filteredSafeAreaObjects, options.allPages || []))
        .join("\n");

    // Generate print guides if requested
    let printGuidesContent = "";
    if (includeGuides) {
        if (isCircular) {
            // Bleed area ellipse
            printGuidesContent += `<ellipse class="print-guides" cx="${totalCanvasWidth / 2}" cy="${canvasHeight / 2}" rx="${totalCanvasWidth / 2}" ry="${canvasHeight / 2}" fill="none" stroke="red" stroke-width="1" stroke-dasharray="5,5"/>`;

            // Safe area ellipses
            safeAreas.forEach((sa) => {
                printGuidesContent += `<ellipse class="print-guides" cx="${totalCanvasWidth / 2}" cy="${canvasHeight / 2}" rx="${sa.width / 2}" ry="${sa.height / 2}" fill="none" stroke="green" stroke-width="1" stroke-dasharray="5,5"/>`;
            });
        } else {
            // Bleed area rectangle
            printGuidesContent += `<rect class="print-guides" x="0" y="0" width="${totalCanvasWidth}" height="${canvasHeight}" fill="none" stroke="red" stroke-width="1" stroke-dasharray="5,5"/>`;

            // Safe area rectangles
            safeAreas.forEach((sa) => {
                printGuidesContent += `<rect class="print-guides" x="${sa.left}" y="${sa.top}" width="${sa.width}" height="${sa.height}" fill="none" stroke="green" stroke-width="1" stroke-dasharray="5,5"/>`;
            });
        }
    }

    // Generate watermark if needed
    let watermarkContent = "";
    if (isPreviewBook && userTypeCode === USER_TYPES.CUSTOMER) {
        watermarkContent = `<text x="${totalCanvasWidth / 2}" y="${canvasHeight / 2}" font-size="200" font-weight="400" fill="${watermarkColor || "#000000"}" fill-opacity="0.5" text-anchor="middle" transform="rotate(-30 ${totalCanvasWidth / 2} ${canvasHeight / 2})" style="pointer-events:none; user-select:none;">${escapeXml(watermarkData)}</text>`;
    }

    // Assemble full SVG
    // For single-side exports, viewBox is always [0, 0, halfWidth, height] (matching Canvas.jsx)
    const viewBoxX = 0; // Canvas.jsx never uses offset for special pages
    const viewBoxWidth = totalCanvasWidth;
    const fullSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalCanvasWidth}" height="${canvasHeight}" viewBox="${viewBoxX} 0 ${viewBoxWidth} ${canvasHeight}" ${isCircular ? `clip-path="url(#product-shape-clip-${pageIndex})"` : ""}>
    <defs>${defsContent}</defs>
    ${backgroundRects.join("\n    ")}
    ${objectsContent}
    ${safeAreaObjectsContent}
    ${printGuidesContent}
    ${watermarkContent}
  </svg>`;

    // Generate safe area images
    const safeAreaImages = safeAreas.map((safeArea) => {
        const { left, top, width, height, id } = safeArea;

        // Create a cropped SVG with adjusted viewBox
        const croppedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}" ${isCircular ? `clip-path="url(#product-shape-clip-${pageIndex})"` : ""}>
      <defs>${defsContent}</defs>
      ${backgroundRects.join("\n      ")}
      ${objectsContent}
      ${safeAreaObjectsContent}
      ${watermarkContent}
    </svg>`;

        return {
            safeAreaId: id,
            svgContent: croppedSvg,
            width,
            height,
        };
    });

    // Extract fonts from rendered objects
    const allFonts = [];

    // Extract fonts from text objects
    filteredObjects
        .filter((obj) => obj.type === "text")
        .forEach((obj) => {
            if (obj.font) {
                let fontWeight = obj.font.weight?.toLowerCase() === "normal" ? "300" : obj.font.weight;
                allFonts.push({
                    name: obj.font.family,
                    weights: fontWeight || "300",
                    font_id: obj.font.id || obj.font.fontId || null,
                    style_id: obj.font.styleId || null,
                });
            }
        });

    // Extract fonts from safe area text objects
    filteredSafeAreaObjects
        .filter((obj) => obj.type === "text")
        .forEach((obj) => {
            if (obj.font) {
                let fontWeight = obj.font.weight?.toLowerCase() === "normal" ? "300" : obj.font.weight;
                allFonts.push({
                    name: obj.font.family,
                    weights: fontWeight || "300",
                    font_id: obj.font.id || obj.font.fontId || null,
                    style_id: obj.font.styleId || null,
                });
            }
        });

    // Extract calendar fonts
    if (calendarSettings?.fontFamily) {
        let calFontWeight = calendarSettings.fontWeight;
        if (!calFontWeight) {
            const found = Fontfamilies.find((f) => f.value === calendarSettings.fontFamily);
            calFontWeight = found?.fw?.[0]?.value || "300";
        }
        allFonts.push({
            name: calendarSettings.fontFamily,
            weights: calFontWeight,
        });
    }

    return {
        pageIndex,
        svgContent: fullSvgContent,
        width: totalCanvasWidth,
        height: canvasHeight,
        safeAreaImages,
        fonts: allFonts,
    };
}

export default generatePageSvg;
