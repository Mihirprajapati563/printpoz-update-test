export const getResolutionScaleValue = (width, height, wrapper) => {
  if (!wrapper) return null;

  const sizeAspectRatio = width / height;
  const wrapperRect = wrapper.getBoundingClientRect(); // available width and height to set new canvas size
  let containerWidth = wrapperRect.width;
  let containerHeight = wrapperRect.height;
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
