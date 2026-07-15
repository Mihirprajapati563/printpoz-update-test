export function calculateImageResize(currentObject, newWidth, newHeight, initialState = null) {
  if (!currentObject || currentObject.type !== "img" || !currentObject.image) {
    return { width: newWidth, height: newHeight };
  }

  const moveX = newWidth - (currentObject.width || 0);
  const moveY = newHeight - (currentObject.height || 0);

  let currentScale = currentObject.image.scale || 1;
  let scaleX = currentScale;
  let scaleY = currentScale;
  let currentPositionX = currentObject.image.positionX || 0;
  let currentPositionY = currentObject.image.positionY || 0;

  // Use initial state positions if provided (for drag-resize continuity)
  const initialImagePositionX = initialState?.image?.positionX ?? currentPositionX;
  const initialImagePositionY = initialState?.image?.positionY ?? currentPositionY;

  // --- Width axis ---
  if (moveX !== 0) {
    
    const imageMaxWidth =
      currentObject.image.width * currentScale - Math.abs(currentPositionX);

    if (newWidth > imageMaxWidth) {
      if (currentPositionX < 0) {
        currentPositionX = initialImagePositionX + moveX;
        if (currentPositionX > 0) currentPositionX = 0;

        const coveredAfterShift =
          currentObject.image.width * currentScale - Math.abs(currentPositionX);
        if (newWidth > coveredAfterShift) {
          scaleX = (newWidth + Math.abs(currentPositionX)) / currentObject.image.width;
        }
      } else {
        scaleX = newWidth / currentObject.image.width;
      }
    }
  }

  // --- Height axis ---
  if (moveY !== 0) {
    const imageMaxHeight =
      currentObject.image.height * currentScale - Math.abs(currentPositionY);

    if (newHeight > imageMaxHeight) {
      if (currentPositionY < 0) {
        currentPositionY = initialImagePositionY + moveY;
        if (currentPositionY > 0) currentPositionY = 0;

        const coveredAfterShift =
          currentObject.image.height * currentScale - Math.abs(currentPositionY);
        if (newHeight > coveredAfterShift) {
          scaleY = (newHeight + Math.abs(currentPositionY)) / currentObject.image.height;
        }
      } else {
        scaleY = newHeight / currentObject.image.height;
      }
    }
  }

  let newScale = currentScale;
  if (moveX !== 0 && moveY !== 0) {
    newScale = Math.max(scaleX, scaleY);
  } else if (moveX !== 0) {
    newScale = scaleX;
  } else if (moveY !== 0) {
    newScale = scaleY;
  }

  const minScaleForWidth = newWidth / currentObject.image.width;
  const minScaleForHeight = newHeight / currentObject.image.height;
  newScale = Math.max(newScale, minScaleForWidth, minScaleForHeight);
  const scaledImageWidth = currentObject.image.width * newScale;
  const scaledImageHeight = currentObject.image.height * newScale;

  currentPositionX = Math.min(0, Math.max(currentPositionX, -(scaledImageWidth - newWidth)));
  currentPositionY = Math.min(0, Math.max(currentPositionY, -(scaledImageHeight - newHeight)));

  return {
    width: newWidth,
    height: newHeight,
    image: {
      ...currentObject.image,
      scale: newScale,
      positionX: currentPositionX,
      positionY: currentPositionY,
    },
  };
}

export function calculateTextResize(currentObject, newWidth, newHeight) {
  if (!currentObject || currentObject.type !== "text") {
    return { width: newWidth, height: newHeight };
  }

  const minWidth = 50;
  const minHeight = parseInt(currentObject.font?.size || 24) * 1.2 + 10;

  const validatedWidth = Math.max(newWidth, minWidth);
  const validatedHeight = Math.max(newHeight, minHeight);

  return {
    width: validatedWidth,
    height: validatedHeight,
  };
}

export function applyDimensionChange(currentObject, newWidth, newHeight) {
  if (!currentObject) {
    return { width: newWidth, height: newHeight };
  }

  if (currentObject.type === "img" && currentObject.url) {
    return calculateImageResize(currentObject, newWidth, newHeight);
  }

  if (currentObject.type === "text") {
    return calculateTextResize(currentObject, newWidth, newHeight);
  }

  return { width: newWidth, height: newHeight };
}
