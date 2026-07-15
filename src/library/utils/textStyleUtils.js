export const toggleTextDecoration = (currentDecoration, targetDecoration) => {
  const current = (currentDecoration || "none").trim();

  if (current === "none" || current === "") {
    return targetDecoration;
  }

  const decorations = current.split(/\s+/);
  const index = decorations.indexOf(targetDecoration);

  if (index >= 0) {
    decorations.splice(index, 1);
    return decorations.length === 0 ? "none" : decorations.join(" ");
  } else {
    decorations.push(targetDecoration);
    return decorations.join(" ");
  }
};

export const hasDecoration = (decoration, target) =>
  (decoration || "none") !== "none" &&
  (decoration || "").split(/\s+/).includes(target);

export const toggleTextTransform = (
  currentTransform,
  targetTransform = "uppercase",
) => (currentTransform === targetTransform ? "none" : targetTransform);

export const getTextEditableElement = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node = selection.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

  while (node) {
    if (node.contentEditable === "true") {
      return {
        selection,
        range: selection.getRangeAt(0),
        editableElement: node,
      };
    }
    node = node.parentElement;
  }
  return null;
};

export const INLINE_FORMAT_REGEX = /<(u|s|strike|span|b|i|em|strong)\b/i;

const BOLD_DISABLE_LABELS = [
  "Bold",
  "Semi Bold",
  "Black",
  "Extra Bold",
  "Semi Bold Italic",
  "Bold Italic",
  "Extra Bold Italic",
  "Black Italic",
];

const ITALIC_DISABLE_LABELS = [
  "Thin Italic",
  "Extra Light Italic",
  "Light Italic",
  "Regular Italic",
  "Medium Italic",
  "Semi Bold Italic",
  "Bold Italic",
  "Extra Bold Italic",
  "Black Italic",
];

export const getFontVariantLabel = (fwList, fontObj) => {
  if (
    fontObj?.label &&
    !fontObj?.isSyntheticBold &&
    !fontObj?.isSyntheticItalic
  ) {
    return fontObj.label;
  }

  let baseWeight = fontObj?.weight || "400";
  if (fontObj?.isSyntheticBold) {
    baseWeight = fontObj?.baseWeight || "400";
  }

  let baseStyle = fontObj?.style || "normal";
  if (fontObj?.isSyntheticItalic) {
    baseStyle = fontObj?.baseStyle || "normal";
  }

  if (!fwList || fwList.length === 0) {
    const w = parseInt(baseWeight, 10) || 400;
    let label =
      w >= 900 ? "Black"
      : w >= 700 ? "Bold"
      : w >= 500 ? "Medium"
      : "Regular";
    if (baseStyle === "italic") label += " Italic";
    return label;
  }

  const w = String(baseWeight);
  if (baseStyle === "italic") {
    const italicMatch = fwList.find(
      (fw) =>
        String(fw.value) === w && fw.name.toLowerCase().includes("italic"),
    );
    if (italicMatch) return italicMatch.name;
  }

  const match = fwList.find(
    (fw) => String(fw.value) === w && !fw.name.toLowerCase().includes("italic"),
  );

  if (match) return match.name;

  const any = fwList.find((fw) => String(fw.value) === w);
  return any ? any.name : "Regular";
};

export const isBoldDisabled = (label) => BOLD_DISABLE_LABELS.includes(label);

export const isBoldVariantActive = (label) => BOLD_DISABLE_LABELS.includes(label);

export const findRegularVariant = (fwList, currentLabel) => {
  if (!fwList || fwList.length === 0) return { name: "Regular", value: 400 };

  const isItalic = (currentLabel || "").toLowerCase().includes("italic");

  if (isItalic) {
    const regItalic = fwList.find(
      (fw) => fw.name === "Regular Italic"
    );
    if (regItalic) return regItalic;
    const italicVariants = fwList.filter((fw) =>
      fw.name.toLowerCase().includes("italic")
    );
    if (italicVariants.length > 0) {
      return italicVariants.reduce((min, fw) =>
        Number(fw.value) < Number(min.value) ? fw : min
      );
    }
  }

  const regular = fwList.find((fw) => fw.name === "Regular");
  if (regular) return regular;

  const light = fwList.find((fw) => Number(fw.value) <= 400);
  if (light) return light;

  return fwList[0];
};

export const findBoldVariant = (fwList, currentStyle) => {
  if (!fwList || fwList.length === 0) return { name: "Bold", value: 700 };

  const isItalic = currentStyle === "italic";

  if (isItalic) {
    const boldItalic = fwList.find((fw) => fw.name === "Bold Italic");
    if (boldItalic) return boldItalic;
    const boldItalicVariants = fwList.filter(
      (fw) =>
        Number(fw.value) >= 700 &&
        fw.name.toLowerCase().includes("italic")
    );
    if (boldItalicVariants.length > 0) return boldItalicVariants[0];
  }

  const bold = fwList.find((fw) => fw.name === "Bold");
  if (bold) return bold;

  const heavy = fwList.find((fw) => Number(fw.value) >= 700);
  if (heavy) return heavy;

  return fwList[fwList.length - 1];
};

export const isItalicDisabled = (label) =>
  ITALIC_DISABLE_LABELS.includes(label);

export const isItalicVariantActive = (label) =>
  ITALIC_DISABLE_LABELS.includes(label);

export const findNonItalicVariant = (fwList, currentLabel) => {
  if (!fwList || fwList.length === 0) return { name: "Regular", value: 400 };

  const baseName = (currentLabel || "").replace(/\s*Italic$/i, "").trim();

  if (baseName) {
    const exactMatch = fwList.find(
      (fw) => fw.name === baseName && !fw.name.toLowerCase().includes("italic")
    );
    if (exactMatch) return exactMatch;
  }

  const currentEntry = fwList.find((fw) => fw.name === currentLabel);
  if (currentEntry) {
    const sameWeight = fwList.find(
      (fw) =>
        String(fw.value) === String(currentEntry.value) &&
        !fw.name.toLowerCase().includes("italic")
    );
    if (sameWeight) return sameWeight;
  }

  const regular = fwList.find(
    (fw) => fw.name === "Regular"
  );

  if (regular) return regular;

  const firstNonItalic = fwList.find(
    (fw) => !fw.name.toLowerCase().includes("italic")
  );

  return firstNonItalic || fwList[0];
};

export const findItalicVariant = (fwList, currentWeight) => {
  if (!fwList || fwList.length === 0)
    return { name: "Regular Italic", value: 400 };

  const w = String(currentWeight || "400");

  const sameWeightItalic = fwList.find(
    (fw) =>
      String(fw.value) === w && fw.name.toLowerCase().includes("italic")
  );

  if (sameWeightItalic) return sameWeightItalic;

  const anyItalic = fwList.find((fw) =>
    fw.name.toLowerCase().includes("italic")
  );
  if (anyItalic) return anyItalic;

  return null;
};

export function isInlineBoldActive() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;

  const editable = getTextEditableElement();
  if (!editable) return false;

  let node = selection.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      const tag = node.tagName?.toLowerCase();
      if (tag === "b" || tag === "strong") return true;

      const fw = node.style?.fontWeight || "";
      if (fw === "bold") return true;
      const fwNum = parseInt(fw, 10);
      if (!Number.isNaN(fwNum) && fwNum >= 600) return true;
    }
    if (node === editable.editableElement) break;
    node = node.parentNode;
  }
  return false;
}

export const isInlineUppercaseActive = () => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;

  const editable = getTextEditableElement();
  if (!editable) return false;

  let node = selection.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      if (node.style.textTransform === "uppercase") return true;
      if (node.style.textTransform === "none" || node.style.textTransform === "initial") return false;
    }
    if (node === editable.editableElement) break;
    node = node.parentNode;
  }
  return false;
};

export const toggleInlineUppercase = () => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return;

  const isActive = isInlineUppercaseActive();
  const range = selection.getRangeAt(0);
  
  // Extract the contents of the selection (this safely splits text nodes if needed)
  const fragment = range.extractContents();

  // Create a span to wrap the extracted contents
  const wrapper = document.createElement("span");
  wrapper.style.textTransform = isActive ? "none" : "uppercase";
  
  // Assign a temporary ID to easily find and reselect the wrapper
  const tempId = `temp-selection-${Date.now()}`;
  wrapper.id = tempId;
  wrapper.appendChild(fragment);

  // Insert the wrapper back into the exact position the range was extracted from
  range.insertNode(wrapper);

  // Reselect the text inside the new wrapper
  const insertedWrapper = document.getElementById(tempId);
  if (insertedWrapper) {
    insertedWrapper.removeAttribute("id");
    const newRange = document.createRange();
    newRange.selectNodeContents(insertedWrapper);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};
