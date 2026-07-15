export const GRADIENT_PRESETS = [
  {
    id: "linear-180",
    type: "linear",
    angle: 180,
    label: "Top to Bottom",
  },
  {
    id: "linear-90",
    type: "linear",
    angle: 90,
    label: "Left to Right",
  },
  {
    id: "linear-135",
    type: "linear",
    angle: 135,
    label: "Diagonal",
  },
  {
    id: "radial-center",
    type: "radial",
    position: { x: 50, y: 50 },
    label: "Center Radial",
  },
  {
    id: "radial-corner",
    type: "radial",
    position: { x: 0, y: 0 },
    label: "Corner Radial",
  },
];

export const getLinearGradientCoords = (angle) => {
  switch (angle) {
    case 0:
      return { x1: "0%", y1: "100%", x2: "0%", y2: "0%" };
    case 90:
      return { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };
    case 180:
      return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
    case 270:
      return { x1: "100%", y1: "0%", x2: "0%", y2: "0%" };
    case 45:
      return { x1: "0%", y1: "100%", x2: "100%", y2: "0%" };
    case 135:
      return { x1: "0%", y1: "0%", x2: "100%", y2: "100%" };
    case 225:
      return { x1: "100%", y1: "100%", x2: "0%", y2: "0%" };
    case 315:
      return { x1: "100%", y1: "0%", x2: "0%", y2: "100%" };
    default:
      return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
  }
};

export const getRadialGradientCoords = (position) => {
  const x = position?.x ?? 50;
  const y = position?.y ?? 50;

  return {
    cx: `${x}%`,
    cy: `${y}%`,
    r: "100%",
  };
};

export const generateGradientCss = (gradient, stops) => {
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  const stopsStr = sortedStops
    .map((stop) => `${stop.color?.slice(0, 7) || stop.color} ${stop.position}%`)
    .join(", ");

  if (gradient?.type === "radial") {
    const x = gradient?.radialPosition?.x ?? 50;
    const y = gradient?.radialPosition?.y ?? 50;
    return `radial-gradient(circle at ${x}% ${y}%, ${stopsStr})`;
  }

  const angle = gradient?.angle ?? 90;
  return `linear-gradient(${angle}deg, ${stopsStr})`;
};

export const getPresetFromGradient = (gradient) => {
  if (!gradient) return GRADIENT_PRESETS[0];

  if (gradient.type === "radial") {
    const x = gradient.radialPosition?.x ?? 50;
    const y = gradient.radialPosition?.y ?? 50;
    if (x === 0 && y === 0) {
      return GRADIENT_PRESETS[4];
    }
    return GRADIENT_PRESETS[3];
  }

  const angle = gradient.angle ?? 90;
  const preset = GRADIENT_PRESETS.find(
    (p) => p.type === "linear" && p.angle === angle
  );
  return preset || GRADIENT_PRESETS[0];
};
