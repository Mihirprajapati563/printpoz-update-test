export const rgbaToHex = (r, g, b, a) => {
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  const alpha = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${alpha}`;
};

export const hexToRgba = (hex) => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  const a =
    cleanHex.length === 8 ? parseInt(cleanHex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
};

export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

export const hslToRgb = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

export const hexToHsl = (hex) => {
  const cleanHex = hex.replace("#", "").slice(0, 6);
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return rgbToHsl(r, g, b);
};

export const hslToHex = (h, s, l) => {
  const { r, g, b } = hslToRgb(h, s, l);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const generateGradientCompanion = (
  hex,
  hueShift = -45,
  saturationAdjust = 0,
  lightnessAdjust = 10
) => {
  const hsl = hexToHsl(hex);

  let newHue = (hsl.h + hueShift) % 360;
  if (newHue < 0) newHue += 360;

  const newSaturation = Math.max(0, Math.min(100, hsl.s + saturationAdjust));
  const newLightness = Math.max(0, Math.min(100, hsl.l + lightnessAdjust));

  return hslToHex(newHue, newSaturation, newLightness);
};

export const MAX_GRADIENT_COLORS = 10;
