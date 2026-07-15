// Scale a set of source pages to a target canvas size — the SINGLE source of
// truth used by BOTH the Manage-Size "convert" flow (SizeSettingsPopup) and the
// "apply a saved design as a layout" flow (ProjectsList), so text and images
// resize IDENTICALLY in both.
//
// Widths passed in are already adjusted for the editor type (e.g. photobook
// half-width). Pure: returns a new pages array.
//
// Key detail: font size scales by `Math.min(scaleX, scaleY)` on `obj.font.size`
// (the real font-size field — NOT `obj.text.fontSize`, which does not exist),
// and images scale via `image.width/height/positionX/positionY`. Do NOT swap in
// the generic `scalePages`/`scaleLayout` here — those scale the wrong font
// property (so text never resizes) and mutate `image.scale` instead.
export const scaleSourcePagesToTarget = (
  pagesToScale,
  adjustedSourceWidth,
  sourceHeight,
  adjustedTargetWidth,
  targetHeight
) => {
  const scaleX = adjustedTargetWidth / adjustedSourceWidth;
  const scaleY = targetHeight / sourceHeight;

  const scaleObject = (obj) => ({
    ...obj,
    width: (obj.width || 100) * scaleX,
    height: (obj.height || 100) * scaleY,
    transform: obj.transform
      ? {
          ...obj.transform,
          x: (obj.transform.x || 0) * scaleX,
          y: (obj.transform.y || 0) * scaleY,
        }
      : obj.transform,
    ...(obj.type === "text" && obj.font
      ? {
          font: {
            ...obj.font,
            size: Math.round((obj.font.size || 16) * Math.min(scaleX, scaleY)),
          },
        }
      : {}),
    ...(obj.image
      ? {
          image: {
            ...obj.image,
            width: (obj.image.width || 100) * scaleX,
            height: (obj.image.height || 100) * scaleY,
            positionX: (obj.image.positionX || 0) * scaleX,
            positionY: (obj.image.positionY || 0) * scaleY,
          },
        }
      : {}),
  });

  return (pagesToScale || []).map((page) => {
    const scaledLayout = (page.layout || []).map((layoutItem) => {
      if (!layoutItem) return layoutItem;
      return {
        ...layoutItem,
        objects: (layoutItem.objects || []).map(scaleObject),
        // safeAreaObjects scale the same way (SizeSettingsPopup's original only
        // scaled `objects`; scaling these too keeps safe-area content correct
        // and is a superset that leaves object-only designs unchanged).
        safeAreaObjects: (layoutItem.safeAreaObjects || []).map(scaleObject),
        width: layoutItem.width ? layoutItem.width * scaleX : adjustedTargetWidth,
        height: layoutItem.height ? layoutItem.height * scaleY : targetHeight,
      };
    });

    return {
      ...page,
      layout: scaledLayout,
    };
  });
};
