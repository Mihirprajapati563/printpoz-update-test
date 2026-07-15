export const ALIGNMENT_TYPES = {
  HORIZONTAL: {
    LEFT: "left",
    CENTER: "center",
    RIGHT: "right",
  },
  VERTICAL: {
    TOP: "top",
    MIDDLE: "middle",
    BOTTOM: "bottom",
  },
};

export function getEffectiveBoundingBox(object) {
  if (!object) {
    return {
      effectiveWidth: 0,
      effectiveHeight: 0,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const { width = 0, height = 0, transform = {} } = object;

  const scaleX = transform?.scale?.x || 1;
  const scaleY = transform?.scale?.y || 1;
  const scaledWidth = width * scaleX;
  const scaledHeight = height * scaleY;

  const rotation = transform?.rotation || 0;

  if (rotation === 0) {
    return {
      effectiveWidth: scaledWidth,
      effectiveHeight: scaledHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  const boundingWidth = scaledWidth * cos + scaledHeight * sin;
  const boundingHeight = scaledWidth * sin + scaledHeight * cos;

  const offsetX = (boundingWidth - scaledWidth) / 2;
  const offsetY = (boundingHeight - scaledHeight) / 2;

  return {
    effectiveWidth: boundingWidth,
    effectiveHeight: boundingHeight,
    offsetX,
    offsetY,
  };
}

export function calculateHorizontalAlignment(
  alignment,
  object,
  containerSize,
  containerOffsetX = 0
) {
  if (!object || !containerSize) {
    return 0;
  }

  const { effectiveWidth } = getEffectiveBoundingBox(object);
  const containerWidth = containerSize.width || 0;

  switch (alignment) {
    case ALIGNMENT_TYPES.HORIZONTAL.LEFT:
      return containerOffsetX;

    case ALIGNMENT_TYPES.HORIZONTAL.CENTER:
      return containerOffsetX + (containerWidth - effectiveWidth) / 2;

    case ALIGNMENT_TYPES.HORIZONTAL.RIGHT:
      return containerOffsetX + containerWidth - effectiveWidth;

    default:
      return object.transform?.x || 0;
  }
}

export function calculateVerticalAlignment(
  alignment,
  object,
  containerSize,
  containerOffsetY = 0
) {
  if (!object || !containerSize) {
    return 0;
  }

  const { effectiveHeight } = getEffectiveBoundingBox(object);
  const containerHeight = containerSize.height || 0;

  switch (alignment) {
    case ALIGNMENT_TYPES.VERTICAL.TOP:
      return containerOffsetY;

    case ALIGNMENT_TYPES.VERTICAL.MIDDLE:
      return containerOffsetY + (containerHeight - effectiveHeight) / 2;

    case ALIGNMENT_TYPES.VERTICAL.BOTTOM:
      return containerOffsetY + containerHeight - effectiveHeight;

    default:
      return object.transform?.y || 0;
  }
}

export function calculateAlignmentPosition(
  alignmentType,
  object,
  containerSize,
  containerOffset = { x: 0, y: 0 }
) {
  if (!object || !containerSize) {
    return {};
  }

  const offsetX = containerOffset?.x || 0;
  const offsetY = containerOffset?.y || 0;

  switch (alignmentType) {
    case ALIGNMENT_TYPES.HORIZONTAL.LEFT:
    case ALIGNMENT_TYPES.HORIZONTAL.CENTER:
    case ALIGNMENT_TYPES.HORIZONTAL.RIGHT:
      return {
        x: calculateHorizontalAlignment(
          alignmentType,
          object,
          containerSize,
          offsetX
        ),
      };

    case ALIGNMENT_TYPES.VERTICAL.TOP:
    case ALIGNMENT_TYPES.VERTICAL.MIDDLE:
    case ALIGNMENT_TYPES.VERTICAL.BOTTOM:
      return {
        y: calculateVerticalAlignment(
          alignmentType,
          object,
          containerSize,
          offsetY
        ),
      };

    default:
      return {};
  }
}

export function isHorizontalAlignment(alignmentType) {
  return [
    ALIGNMENT_TYPES.HORIZONTAL.LEFT,
    ALIGNMENT_TYPES.HORIZONTAL.CENTER,
    ALIGNMENT_TYPES.HORIZONTAL.RIGHT,
  ].includes(alignmentType);
}

export function isVerticalAlignment(alignmentType) {
  return [
    ALIGNMENT_TYPES.VERTICAL.TOP,
    ALIGNMENT_TYPES.VERTICAL.MIDDLE,
    ALIGNMENT_TYPES.VERTICAL.BOTTOM,
  ].includes(alignmentType);
}