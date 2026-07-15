// Utility function to group photos by date
import pako from "pako";
import CryptoJS from "crypto-js";
import { CRYPTO_SECRET } from "../constants";
import { isDesktop } from "../../../desktop";
export const groupPhotosByDate = (photos) => {
  return photos.reduce((groups, photo) => {
    const { date } = photo;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(photo);
    return groups;
  }, {});
};
export const getMonthYear = (startMonth, startYear, pageIndex) => {
  let month = startMonth + pageIndex;
  let year = startYear;

  if (month > 12) {
    // Calculate how many years to add
    const yearsToAdd = Math.floor((month - 1) / 12);
    // Calculate the new month (1-12 range)
    month = ((month - 1) % 12) + 1;
    // Add the calculated years
    year += yearsToAdd;
  }

  return { month, year };
};

export const hasAllClasses = (element, classes) => {
  return classes.every((cls) => element.classList.contains(cls));
};
export const hasAnyClass = (element, classes) => {
  return classes.some((cls) => element.classList.contains(cls));
};

export const getResolutionScaleValue = (width, height, wrapper) => {
  if (!wrapper) {
    return null;
  }
  const sizeAspectRatio = width / height;
  const wrapperRect = wrapper.getBoundingClientRect(); // available width and height to set new canvas size
  let containerWidth = wrapperRect.width;

  let containerHeight = wrapperRect.height - 15; // add some space for shadow

  const containerAspectRatio = containerWidth / containerHeight;

  let newWidth = 0,
    newHeight = 0;
  if (sizeAspectRatio > containerAspectRatio) {
    // Width is the limiting factor
    newWidth = containerWidth;
    newHeight = containerWidth / sizeAspectRatio;
  } else {
    // Height is the limiting factor
    newHeight = containerHeight;
    newWidth = containerHeight * sizeAspectRatio;
  }

  return { newWidth, newHeight };
};
export const getResolutionScaleValueBySize = (
  width,
  height,
  containerWidth,
  containerHeight
) => {
  const sizeAspectRatio = width / height;

  const containerAspectRatio = containerWidth / containerHeight;

  let newWidth = 0,
    newHeight = 0;
  if (sizeAspectRatio > containerAspectRatio) {
    // Width is the limiting factor
    newWidth = containerWidth;
    newHeight = containerWidth / sizeAspectRatio;
  } else {
    // Height is the limiting factor
    newHeight = containerHeight;
    newWidth = containerHeight * sizeAspectRatio;
  }

  return { width: newWidth, height: newHeight };
};

// Function to calculate the zoom ratio
export const calculateZoomRatio = (
  originalWidth,
  originalHeight,
  newWidth,
  newHeight
) => {
  const widthScale = newWidth / originalWidth;
  const heightScale = newHeight / originalHeight;
  return Math.min(widthScale, heightScale);
};
/*
 * @param {number} width - actual width
 * @param {number} height - actual height
 * @param {number} wrapperWidth - width of the wrapper
 * @param {number} wrapperHeight - height of the wrapper
 */
export const getScaledValues = (width, height, wrapperWidth, wrapperHeight) => {
  const sizeAspectRatio = width / height;
  const containerAspectRatio = wrapperWidth / wrapperHeight;

  let newWidth = 0,
    newHeight = 0;
  if (sizeAspectRatio > containerAspectRatio) {
    // Width is the limiting factor
    newWidth = wrapperWidth;
    newHeight = wrapperWidth / sizeAspectRatio;
  } else {
    // Height is the limiting factor
    newHeight = wrapperHeight;
    newWidth = wrapperHeight * sizeAspectRatio;
  }

  return { newWidth, newHeight };
};

export const getPhotoBookPagelabel = (index, totalPages) => {
  if (index === 0) {
    return "Front Cover";
  }
  if (index === totalPages - 1) {
    return "Back Cover";
  }
  let pageLabel = "";
  if (index * 2 - 2 !== 0) {
    pageLabel = index * 2 - 2 + (index !== totalPages - 2 ? "-" : "");
  }
  if (index !== totalPages - 2) {
    pageLabel = pageLabel + (index * 2 - 1);
  }
  return "Page " + pageLabel;
};
export const getPageLabelForTwoSideProduct = (index) => {
  if (index === 0) {
    return "Front Side";
  }
  if (index === 1) {
    return "Back Side";
  }
  return "";
};
export const getPageLabel = (index, totalPages) => {
  return index + 1;
};

export const hexToRgba = (hex, alpha) => {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper function to convert Uint8Array to base64
function uint8ArrayToBase64(uint8Array) {
  let binary = "";
  const bytes = new Uint8Array(uint8Array);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
// Function to compress and convert to base64
export const compressData = (jsonString) => {
  // Step 1: Compress the JSON string
  const compressed = pako.gzip(jsonString);

  // Step 2: Convert compressed data to base64 string
  //const base64String = btoa(String.fromCharCode(...new Uint8Array(compressed)));
  const base64String = uint8ArrayToBase64(new Uint8Array(compressed));

  return base64String;
};
// decompress the data and return the layout to call  const decompressedLayouts = loadLayout(compressed);
// Function to decompress from base64 string
export function decompressFromBase64(base64String) {
  try {
    // Convert base64 to Uint8Array
    const compressedBytes = base64ToUint8Array(base64String);

    // Decompress the data using pako
    const decompressed = pako.ungzip(compressedBytes, { to: "string" });

    // Convert decompressed string back to JSON
    const jsonData = JSON.parse(decompressed);

    return jsonData;
  } catch (err) {
  }
}
// Helper function to convert base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
export const scalePages = (pages, newWidth, newHeight) => {
  pages.forEach((page, pageindex) => {
    page.layout.forEach((item, index) => {
      //const newWidth = canvasSize.width / 2;
      // const newHeight = canvasSize.height;
      if (item !== null) {
        scaleLayout(item, newWidth, newHeight);
      }

      //  decompressedTheme.pages[pageindex].layout[index] = cp;
    });
  });
  return pages;
};

export const calculateNewFontSize = (
  oldFontSize,
  oldWidth,
  oldHeight,
  newWidth,
  newHeight,
  mode = "average"
) => {
  let scaleFactor;

  if (mode === "width") {
    scaleFactor = newWidth / oldWidth;
  } else if (mode === "height") {
    scaleFactor = newHeight / oldHeight;
  } else if (mode === "average") {
    scaleFactor = Math.sqrt((newWidth / oldWidth) * (newHeight / oldHeight));
  } else {
    return 1;
  }

  return oldFontSize * scaleFactor;
};

// Function to scale a single layout object (same as before)
export const scaleLayout = (layout, newWidth, newHeight) => {
  //create a copy of the layout object
  // let layout = JSON.parse(JSON.stringify(layout));


  const originalWidth = layout.width;
  const originalHeight = layout.height;

  const widthScale = newWidth / originalWidth;
  const heightScale = newHeight / originalHeight;

  // Update layout dimensions
  layout.width = newWidth;
  layout.height = newHeight;

  // Scale each object in the layout
  layout.objects = layout.objects.map((obj) => {
    // Scale width and height of the object
    obj.width *= widthScale;
    obj.height *= heightScale;

    // Scale position (x, y) in transform
    if (obj.transform) {
      obj.transform.x *= widthScale;
      obj.transform.y *= heightScale;
    }
    if (obj.type === "text" && obj.text && obj.text.fontSize) {
      obj.text.fontSize *= Math.max(widthScale, heightScale);
    }
    if (
      obj.type === "img" &&
      obj.image &&
      obj.image.width &&
      obj.image.height
    ) {
      // obj.image.width *= widthScale;
      // obj.image.height *= heightScale;
      // there is zoom value set of image object that need to scale as well
      obj.image.scale *= Math.max(widthScale, heightScale);
    }

    // Scale shadow properties if present
    if (obj.shadow) {
      if (obj.shadow.offset) {
        obj.shadow.offsetX *= widthScale;
        obj.shadow.offsetY *= heightScale;
      }
      obj.shadow.blurRadius *= Math.max(widthScale, heightScale);
      obj.shadow.spread *= Math.max(widthScale, heightScale);
    }

    // Scale masking properties if present
    if (obj.masking && obj.masking.width && obj.masking.height) {
      if (
        obj.masking.path &&
        obj.masking.path !== null &&
        obj.masking.path !== "M0 0 L24 0 L24 24 L0 24 Z"
      ) {
        // Skip scaling for rectangle mask
        // obj.masking.width *= widthScale;
        //obj.masking.height *= heightScale;  // this is creating issue in masking because width and heigh is based on path
      }
    }

    return obj;
  });
  return layout;
};

export const getMaskIds = (pages) => {
  const maskIds = [];

  pages.forEach((page) => {
    page.layout.forEach((layout) => {
      //lets continue if layout is null
      if (layout === null) {
        return;
      }
      layout.objects.forEach((obj) => {
        if (obj.type === "img" && obj.masking && obj.masking.mask_id) {
          maskIds.push(obj.masking.mask_id);
        }
      });
      layout?.safeAreaObjects?.forEach((obj) => {
        if (obj.type === "img" && obj.masking && obj.masking.mask_id) {
          maskIds.push(obj.masking.mask_id);
        }
      });
    });
  });
  return maskIds;
};
export const replaceMaskIdWithPath = (pages, maskDetails) => {
  // pages IS READ ONLY, LETS MAKE COPY OF IT AND RETURN AFTER MODIFICATION
  let pagesCopy = JSON.parse(JSON.stringify(pages));
  maskDetails.forEach((item) => {
    pagesCopy.forEach((page) => {
      page.layout.forEach((layout) => {
        if (!layout) return; // skip null layout entries
        layout.objects.forEach((obj) => {
          if (
            obj.type === "img" &&
            obj.masking &&
            obj.masking.mask_id &&
            obj.masking.mask_id === item._id
          ) {
            obj.masking.path = item.urls[0].d;
          }
        });
        layout?.safeAreaObjects?.forEach((obj) => {
          if (
            obj.type === "img" &&
            obj.masking &&
            obj.masking.mask_id &&
            obj.masking.mask_id === item._id
          ) {
            obj.masking.path = item.urls[0].d;
          }
        });
      });
    });
  });
  return pagesCopy;
};

export const Encrypt = (data) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), CRYPTO_SECRET).toString();
};

export const Decrypt = (data) => {
  return CryptoJS.AES.decrypt(data, CRYPTO_SECRET).toString(CryptoJS.enc.Utf8);
};

// function to check image quality
export const isLowQuality = (
  imageWidth,
  imageHeight,
  placeholderWidthInches,
  placeholderHeightInches,
  minPPI = 300
) => {
  const requiredWidth = placeholderWidthInches * minPPI;
  const requiredHeight = placeholderHeightInches * minPPI;
  return imageWidth < requiredWidth || imageHeight < requiredHeight;
};

export const checkImagePrintQuality = (
  imageWidth, // original image width in px
  imageHeight, // original image height in px
  placeholderWidth, // placeholder width in px
  placeholderHeight, // placeholder height in px
  zoomFactor = 1,
  canvasDPI = 200,
  minDPI = 100, // minimum DPI threshold for good quality
  autoFit = true // flag to indicate image is auto-fitted to fill placeholder
) => {
  // 1. Auto-fit zoom factor to cover placeholder
  let fitZoom = 1;
  if (autoFit) {
    const fitZoomW = placeholderWidth / imageWidth;
    const fitZoomH = placeholderHeight / imageHeight;
    fitZoom = Math.max(fitZoomW, fitZoomH);
  }

  // 2. Total applied zoom = autoFit zoom * zoomFactor
  const totalZoom = fitZoom * zoomFactor;

  // 3. Scaled image size
  const scaledImageWidth = imageWidth * totalZoom;
  const scaledImageHeight = imageHeight * totalZoom;

  // Portion of image shown inside placeholder (in % of original image)
  const usedImageWidth = (placeholderWidth / scaledImageWidth) * imageWidth;
  const usedImageHeight = (placeholderHeight / scaledImageHeight) * imageHeight;

  // Placeholder size in inches (based on canvas DPI)
  const placeholderWidthInch = placeholderWidth / canvasDPI;
  const placeholderHeightInch = placeholderHeight / canvasDPI;

  // Effective DPI
  const dpiX = usedImageWidth / placeholderWidthInch;
  const dpiY = usedImageHeight / placeholderHeightInch;
  const effectiveDPI = Math.min(dpiX, dpiY);

  // Quality Status
  let quality = "good";
  if (effectiveDPI < minDPI) {
    quality = "poor";
  } else if (effectiveDPI < canvasDPI) {
    quality = "low";
  } else if (effectiveDPI > 600) {
    quality = "high";
  }

  return quality;
};

export const getPageLabelForFoldableProduct = (
  index,
  allPagesSettings = []
) => {
  let pageCount = 0;

  // Sum page count before the current index
  for (let i = 0; i < index; i++) {
    const item = allPagesSettings[i];
    if (item?.isHalfSheet) {
      pageCount += 1;
    } else {
      pageCount += 2;
    }
  }

  const currentItem = allPagesSettings[index];
  if (currentItem?.isHalfSheet) {
    return `Page ${pageCount + 1}`;
  } else {
    return `Page ${pageCount + 1} - ${pageCount + 2}`;
  }
};
export const getPageLabelForLayflatWithCover = (
  index,
  totalPages,
  fullSheetCover = false
) => {
  if (!fullSheetCover) {
    if (index === 0) return "Front Cover";
    if (index === totalPages - 1) return "Back Cover";
  } else {
    if (index === 0) return "Cover";
  }

  // Middle spreads
  const spreadNumber = index; // since index 1 => first spread
  const startPage = (spreadNumber - 1) * 2 + 1;
  const endPage = startPage + 1;

  return `Page ${startPage}-${endPage}`;
};

export const getDynamicStartYear = () => {
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  if (currentMonthIndex >= 9) {
    return currentYear + 1;
  } else {
    return currentYear;
  }
};

export const handleImageUploadLimit = ({
  settings,
  totalUploadedImages,
  user,
  selectedCount,
  userTypeCustomer,
  dispatch,
  setLimitReachedAction,
  actionType = "upload",
}) => {
  const maxLimit = settings?.maxImageUploadLimit || 0;
  const applyMaximumImageUploadLimit = settings?.applyMaximumImageUploadLimit;
  const isCustomer = user?.userTypeCode === userTypeCustomer;

  // Check if limit should be applied
  // Desktop stores photos fully locally (no S3, "infinite memory" per the
  // offline-first design), so the server-plan image cap never applies there.
  const shouldApplyLimit =
    !isDesktop && isCustomer && applyMaximumImageUploadLimit === true && maxLimit > 0;

  if (!shouldApplyLimit) {
    return {
      shouldStop: false,
      allowedCount: selectedCount,
      isLimitReached: false,
      remainingSlots: Infinity,
      skippedCount: 0,
      maxLimit: 0,
    };
  }

  const remainingSlots = Math.max(0, maxLimit - totalUploadedImages);
  const isLimitReached = remainingSlots <= 0;
  const allowedCount = Math.min(selectedCount, remainingSlots);
  const skippedCount = selectedCount - allowedCount;

  const actionVerb =
    actionType === "add"
      ? "add"
      : actionType === "import"
        ? "import"
        : "upload";

  if (isLimitReached) {
    dispatch(setLimitReachedAction(true));
    alert(
      `You have reached the maximum limit of ${maxLimit} images. You cannot ${actionVerb} more images.`
    );

    return {
      shouldStop: true,
      allowedCount: 0,
      isLimitReached: true,
      remainingSlots: 0,
      skippedCount: selectedCount,
      maxLimit,
    };
  }

  if (skippedCount > 0) {
    alert(
      `You can only ${actionVerb} ${remainingSlots} more image(s). ${skippedCount} image(s) will be skipped to stay within the limit of ${maxLimit} images.`
    );
  }

  return {
    shouldStop: false,
    allowedCount,
    isLimitReached: false,
    remainingSlots,
    skippedCount,
    maxLimit,
  };
};

// ── Per-image upload size limit ─────────────────────────────────────
// The backend rejects originals larger than 30 MB; validating on the
// client avoids wasting bandwidth + a resize pass on a file that would
// be refused. Applies to the ORIGINAL selected file (pre-resize).
export const MAX_IMAGE_UPLOAD_MB = 50;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;

/**
 * Split an array of File/Blob into those within the size limit and those
 * over it. A missing/unknown size is treated as valid (never block on
 * uncertainty — the backend is the final gate).
 *
 * @param {Array<File|Blob>} files
 * @param {number} [maxBytes=MAX_IMAGE_UPLOAD_BYTES]
 * @returns {{ valid: File[], oversized: File[] }}
 */
export const filterOversizedImages = (files, maxBytes = MAX_IMAGE_UPLOAD_BYTES) => {
  const valid = [];
  const oversized = [];
  (files || []).forEach((file) => {
    if (file && typeof file.size === "number" && file.size > maxBytes) {
      oversized.push(file);
    } else {
      valid.push(file);
    }
  });
  return { valid, oversized };
};

/**
 * Human-readable "these were skipped" message, or "" when nothing skipped.
 * Lists up to 5 names so the alert stays readable for large batches.
 */
export const buildOversizedAlert = (oversized, maxMB = MAX_IMAGE_UPLOAD_MB) => {
  if (!oversized || oversized.length === 0) return "";
  const names = oversized
    .slice(0, 5)
    .map((f) => f?.name || "image")
    .join(", ");
  const more = oversized.length > 5 ? ` and ${oversized.length - 5} more` : "";
  return (
    `${oversized.length} image(s) larger than ${maxMB}MB were skipped` +
    ` (${names}${more}). Please upload images under ${maxMB}MB.`
  );
};

// Re-export generatePageSvg for convenience
export { generatePageSvg } from "./generatePageSvg.js";
