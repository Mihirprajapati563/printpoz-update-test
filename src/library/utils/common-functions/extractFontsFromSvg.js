import { Fontfamilies } from "../jsons/commonJSON";

/**
 * Extract fonts from SVG content string for PDF export.
 * Handles both foreignObject divs with inline styles and standard SVG text/tspan elements.
 * @param {string} svgContent - The SVG content as a string
 * @returns {Array<{name: string, weights: string}>} - Array of font objects with name and weights
 */
export function extractFontsFromSvg(svgContent) {
  if (!svgContent || typeof svgContent !== "string") {
    return [];
  }

  const allFonts = [];
  const fontFamiliesFound = new Set();

  // Helper function to add font with validation
  const addFontWithValidation = (fontFamily, fontWeight) => {
    if (!fontFamily || fontFamiliesFound.has(fontFamily)) return;

    // Clean up font family name
    const cleanFontFamily = fontFamily.replace(/["']/g, "").trim();
    if (!cleanFontFamily) return;

    fontFamiliesFound.add(cleanFontFamily);

    // Find the font in Fontfamilies to validate weight
    const fontData = Fontfamilies.find(
      (f) => f.value === cleanFontFamily || f.name === cleanFontFamily
    );

    let validatedWeight = fontWeight || "400";

    // Normalize weight values
    if (validatedWeight === "normal") validatedWeight = "400";
    if (validatedWeight === "bold") validatedWeight = "700";

    // If font data exists, validate the weight
    if (fontData?.fw?.length) {
      const weightStr = String(validatedWeight);
      const isWeightSupported = fontData.fw.some(
        (fw) => String(fw.value) === weightStr
      );

      // If weight not supported, use first available weight
      if (!isWeightSupported) {
        validatedWeight = fontData.fw[0].value;
      }
    }

    allFonts.push({ name: cleanFontFamily, weights: String(validatedWeight) });
  };

  // Parse SVG string to DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgElement = doc.documentElement;

  // Check for parsing errors
  const parserError = svgElement.querySelector("parsererror");
  if (parserError) {
    return [];
  }

  // Method 1: Find SVG <text> elements with font-family attribute
  const textElements = svgElement.querySelectorAll("text[font-family]");
  textElements.forEach((textEl) => {
    const fontFamily = textEl.getAttribute("font-family") || "";
    const fontWeight = textEl.getAttribute("font-weight") || "400";
    addFontWithValidation(fontFamily, fontWeight);
  });

  // Method 2: Find foreignObject elements with contenteditable divs (inline styles)
  const foreignObjects = svgElement.querySelectorAll(
    "foreignObject div[contenteditable]"
  );
  foreignObjects.forEach((textDiv) => {
    const fontFamily = textDiv.style?.fontFamily || "";
    const fontWeight = textDiv.style?.fontWeight || "400";
    addFontWithValidation(fontFamily, fontWeight);
  });

  // Method 3: Find foreignObject divs with inline style containing font-family
  const styledDivs = svgElement.querySelectorAll(
    'foreignObject div[style*="font-family"]'
  );
  styledDivs.forEach((div) => {
    const style = div.getAttribute("style") || "";
    const fontFamilyMatch = style.match(/font-family:\s*["']?([^;"']+)["']?/i);
    const fontWeightMatch = style.match(/font-weight:\s*(\d+|normal|bold)/i);

    if (fontFamilyMatch) {
      const fontFamily = fontFamilyMatch[1].trim();
      const fontWeight = fontWeightMatch ? fontWeightMatch[1] : "400";
      addFontWithValidation(fontFamily, fontWeight);
    }
  });

  // Method 4: Find tspan elements with inline style containing font-family
  const tspanElements = svgElement.querySelectorAll(
    'tspan[style*="font-family"]'
  );
  tspanElements.forEach((tspan) => {
    const style = tspan.getAttribute("style") || "";
    const fontFamilyMatch = style.match(/font-family:\s*["']?([^;"']+)["']?/i);
    const fontWeightMatch = style.match(/font-weight:\s*(\d+|normal|bold)/i);

    if (fontFamilyMatch) {
      const fontFamily = fontFamilyMatch[1].trim();
      const fontWeight = fontWeightMatch ? fontWeightMatch[1] : "400";
      addFontWithValidation(fontFamily, fontWeight);
    }
  });

  // Method 5: Find text elements with inline style containing font-family
  const styledTextElements = svgElement.querySelectorAll(
    'text[style*="font-family"]'
  );
  styledTextElements.forEach((textEl) => {
    const style = textEl.getAttribute("style") || "";
    const fontFamilyMatch = style.match(/font-family:\s*["']?([^;"']+)["']?/i);
    const fontWeightMatch = style.match(/font-weight:\s*(\d+|normal|bold)/i);

    if (fontFamilyMatch) {
      const fontFamily = fontFamilyMatch[1].trim();
      const fontWeight = fontWeightMatch ? fontWeightMatch[1] : "400";
      addFontWithValidation(fontFamily, fontWeight);
    }
  });

  return allFonts;
}

export default extractFontsFromSvg;
