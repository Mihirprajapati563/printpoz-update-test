// import theme from 'theme'
import { theme } from "../../../common-components/StyledComponents";
export const defaultPhotoObject = {
  id: "419b176a-ac91-41b5-8f7a-7ab80a13c4e0",
  type: "img",
  width: 500,
  height: 500,
  transform: {
    x: 18,
    y: 12,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  opacity: 1,
  border: {
    radius: 0,
    width: 0,
    color: "#000000",
    style: "solid",
  },
  shadow: {
    color: "#000000AD",
    offset: {
      x: 0,
      y: 0,
    },
    blur: 5,
  },
  effects: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  },
  alignment: {
    horizontal: "left",
    vertical: "top",
  },
  masking: {
    path: "M0 0 L24 0 L24 24 L0 24 Z",
    width: 24,
    height: 24,
  },

  orientation: 0,
  adjustment: "cover",
  flip: {
    x: false,
    y: false,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
};

export const defaultStickerObject = {
  id: "419b176a-ac91-41b5-8f7a-7ab80a13c4e0",
  type: "sticker",
  transform: {
    x: 18,
    y: 12,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  opacity: 1,
  border: {
    radius: 0,
    width: 0,
    color: "#000000",
    style: "solid",
  },
  shadow: {
    color: "#ffffffAD",
    offset: {
      x: 0,
      y: 0,
    },
    blur: 5,
  },
  effects: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  },
  alignment: {
    horizontal: "left",
    vertical: "top",
  },
  masking: {
    path: "M0 0 L24 0 L24 24 L0 24 Z",
    width: 24,
    height: 24,
  },
  orientation: 0,
  adjustment: "cover",
  flip: {
    x: false,
    y: false,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
};
export const  defaultCalendarObject = {
  id: "419b176a-ac91-41b5-8f7a-7ab80a13c4e0",
  type: "calendar",
  month:1,
  transform: {
    x: 18,
    y: 12,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  opacity: 1,
  border: {
    radius: 0,
    width: 0,
    color: "#000000",
    style: "solid",
  },
  shadow: {
    color: "#ffffffAD",
    offset: {
      x: 0,
      y: 0,
    },
    blur: 5,
  },
  effects: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  },
  alignment: {
    horizontal: "left",
    vertical: "top",
  },
  masking: {
    path: "M0 0 L24 0 L24 24 L0 24 Z",
    width: 24,
    height: 24,
  },
  orientation: 0,
  adjustment: "cover",
  flip: {
    x: false,
    y: false,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
  // Calendar-specific properties
  calendar: {
    month: 1, // Default month (January)
    year: 2024, // Default year
    cellStyle: {
      borderColor: "#000000",
      borderWidth: 1,
      headerColor: "#cccccc",
      textColor: "#000000",
      alternateColor: "#f0f0f0",
      backgroundColor: "#ffffff",
    },
    header: {
      show: true, // Show or hide the header
      fontSize: 40, // Font size for the header
      textColor: "#000000",
    },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], // Day names
    fontSize: 40, // Font size for day numbers
  },
  calendarSettings :{
    addCover: false,
    backgroundColor: "",
    alternativeBgColor: "",
    textColor: "",
    headerBgColor: "",
    headerTextColor: "",
    weekendTextColor: "",
    weekendBgColor: "",
    monthBgColor: "",
    monthTextColor: "",
    borderColor: "",
  },
};


export const defaultShapeObject = {
  id: "419b176a-ac91-41b5-8f7a-7ab80a13c4e0",
  type: "shape",
  transform: {
    x: 18,
    y: 12,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  fill: theme.colors.primaryColor ? theme.colors.primaryColor : "#FFFFFF",
  opacity: 1,
  border: {
    radius: 0,
    width: 0,
    color: "#000000",
    style: "solid",
  },
  shadow: {
    color: "#000000AD",
    offset: {
      x: 0,
      y: 0,
    },
    blur: 5,
  },
  orientation: 0,
  flip: {
    x: false,
    y: false,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
};
export const defaultQRCodeObject = {
  id: "419b176a-ac91-41b5-8f7a-qrcode-default",
  type: "qrcode",
  width: 200,
  height: 200,
  qrUrl: "",
  qrLevel: "H",
  qrFgColor: "#000000",
  qrBgColor: "#FFFFFF",
  qrSvgPaths: "",   
  metadata: null,   
  transform: {
    x: 18,
    y: 12,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  opacity: 1,
  border: {
    radius: 0,
    width: 0,
    color: "#000000",
    style: "solid",
  },
  shadow: {
    color: "#000000AD",
    offset: {
      x: 0,
      y: 0,
    },
    blur: 5,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
};

export const defaultTextObject = {
  id: "text_object_1",
  type: "text",
  text: "Sample Text", // The actual text content
  width: 200,
  height: 100, // may be not required
  font: {
    family: "Arial",
    label: "regular",
    size: 16,
    weight: "300", // Options: "normal", "bold"
    style: "normal", // Options: "normal", "italic"
    decoration: "none", // Options: "none", "underline", "line-through", "overline"
  },
  spacing: {
    letterSpacing: 0, // Value in percentage of em (0 = normal, 100 = 1em)
    lineHeight: 1.2,  // Unitless multiplier (1.2 = 120% of font size)
  },
  color: "#000000", // Text color
  textTransform: "none", // Options: "none", "uppercase", "lowercase", "capitalize"
  transform: {
    x: 0,
    y: 100,
    scale: {
      x: 1,
      y: 1,
    },
    rotation: 0,
    skew: {
      x: 0,
      y: 0,
    },
  },
  style: {
    opacity: 1,
    border: {
      radius: 0,
      width: 0,
      color: "#000000",
      style: "solid",
    },
    shadow: {
      color: "rgba(0,0,0,0.5)",
      offset: {
        x: 0,
        y: 0,
      },
      blur: 5,
    },
    effects: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
    },
  },
  alignment: {
    horizontal: "center",
    vertical: "middle",
  },
  masking: {
    clipPath: "",
    mask: "",
  },
  orientation: 0,
  adjustment: "cover",
  flip: {
    x: false,
    y: false,
  },
  zIndex: 1,
  draggable: true,
  resizable: true,
};
