export const EDITOR_TYPES = {
  PHOTOBOOK: "photobook",
  CALENDER: "calendar",
  CARD: "card",
  VISITING_CARD: "visitingcard",
  WALLART: "wallart",
  GIFTCARD: "giftcard",
  PRINT: "print",
  CANVAS: "canvas",
  ACRYLIC: "acrylic",
  PHOTO_FRAME: "photoframe",
  PHOTO_MAGNET: "photomagnet",
  PHOTO_STRIP: "photostrip",
  CUSTOME_PRODUCT: "custom_product",
  GREETING_CARD: "greetingcard",
  LAYFLATALBUM: "layflatalbum",
};
export const EDITOR_SUB_TYPES = {
  CALENDER: {
    WOODEN_CALENDER: "wooden_calendar",
    MOUNTAIN_CALENDER: "mountain_calendar",
    WALL_CALENDER: "wall_calendar",
  },
  ACRYLIC: {
    WALL: "wall",
    TABLE: "table",
  },
  CUSTOME_PRODUCT: {
    WATER_BOTTLE: "water_bottle",
    T_SHIRT: "t_shirt",
    PHOTO_KEYCHAIN: "photo_keychain",
    CAP: "cap",
    WALL_CLOCK: "wall_clock",
    PENDRIVE: "pendrive",
    MOUSE_PAD: "mouse_pad",
  },
  GREETING_CARD: {
    SINGLE_SIDE: "single_side",
    DOUBLE_SIDE: "double_side",
    FOLDABLE: "foldable",
  },
  PHOTOBOOK: {
    AI_GENERATED_FOR_KIDS: "ai_generated_for_kids",
  },
  LAYFLATALBUM: {
    MAGAZINE: "magazine",
  }
};
// Display metadata for the post-login "What would you like to design?" screen.
// Derived from EDITOR_TYPES so the category list stays in sync with the single
// source of truth above. `icon` is a string key mapped to a react-icon in the
// DesignSelectionPage (constants stay React-free). Add/remove entries here when
// EDITOR_TYPES changes — order here is the display order on the selection grid.
export const EDITOR_CATEGORIES = [
  {
    type: EDITOR_TYPES.PHOTOBOOK,
    label: "Photo Book",
    description: "Tell your story across beautifully printed pages.",
    icon: "photobook",
  },
  {
    type: EDITOR_TYPES.LAYFLATALBUM,
    label: "Layflat Album",
    description: "Premium albums that open flat for seamless spreads.",
    icon: "layflatalbum",
  },
  {
    type: EDITOR_TYPES.CALENDER,
    label: "Calendar",
    description: "Personalised calendars for every month of the year.",
    icon: "calendar",
  },
  {
    type: EDITOR_TYPES.CANVAS,
    label: "Canvas Print",
    description: "Gallery-quality canvas prints for your walls.",
    icon: "canvas",
  },
  {
    type: EDITOR_TYPES.ACRYLIC,
    label: "Acrylic Print",
    description: "Vivid, modern prints with a glossy acrylic finish.",
    icon: "acrylic",
  },
  {
    type: EDITOR_TYPES.WALLART,
    label: "Wall Art",
    description: "Stunning art pieces to decorate any space.",
    icon: "wallart",
  },
  {
    type: EDITOR_TYPES.PHOTO_FRAME,
    label: "Photo Frame",
    description: "Framed photos ready to hang or display.",
    icon: "photoframe",
  },
  {
    type: EDITOR_TYPES.PRINT,
    label: "Photo Print",
    description: "Classic photo prints in all your favourite sizes.",
    icon: "print",
  },
  {
    type: EDITOR_TYPES.PHOTO_STRIP,
    label: "Photo Strip",
    description: "Retro photo-booth strips of your best moments.",
    icon: "photostrip",
  },
  {
    type: EDITOR_TYPES.PHOTO_MAGNET,
    label: "Photo Magnet",
    description: "Fun magnets to brighten up your fridge.",
    icon: "photomagnet",
  },
  {
    type: EDITOR_TYPES.CARD,
    label: "Card",
    description: "Custom cards designed for any occasion.",
    icon: "card",
  },
  {
    type: EDITOR_TYPES.GREETING_CARD,
    label: "Greeting Card",
    description: "Heartfelt greeting cards to share with loved ones.",
    icon: "greetingcard",
  },
  {
    type: EDITOR_TYPES.VISITING_CARD,
    label: "Visiting Card",
    description: "Professional business cards that stand out.",
    icon: "visitingcard",
  },
  {
    type: EDITOR_TYPES.GIFTCARD,
    label: "Gift Card",
    description: "Thoughtful gift cards for someone special.",
    icon: "giftcard",
  },
  {
    type: EDITOR_TYPES.CUSTOME_PRODUCT,
    label: "Custom Product",
    description: "Mugs, t-shirts, keychains and more.",
    icon: "custom_product",
  },
];

export const EDITOR_ASSETS = {
  BACKGROUND: "background",
  LAYOUT: "layout",
  IDEA: "idea",
  FONT: "font",
  THEME: "theme",
  TEMPLATE: "template",
  MASK: "mask",
  STICKER: "clipart",
  PROJECT: "project",
  CAPTIONS: "captions",
};

export const ERROR_MESSAGES = {
  api_error_message:
    "We’re experiencing technical difficulties. Please try again later.",
  delete_confirmation: "Are you sure you want to delete this record?",
};
export const USER_TYPES = {
  ADMIN: 3,
  CUSTOMER: 6,
  SUPERUSER: 2,
  EMPLOYEE: 5,
};
export const ORIENTATION = {
  PORTRAIT: "P",
  LANDSCAPE: "L",
  SQUARE: "S",
};

export const CRYPTO_SECRET = "printpoz#123@@";
export const LOGIN_CRYPTO_KEY = "QUICKORDERDEVELOPER";

// Editor versions 
// Version 2: Uses foreignObject for text rendering (word-wrap, justify support)
// Version 1 or undefined: Uses Old SVG text rendering
export const EDITOR_VERSION = 2;
