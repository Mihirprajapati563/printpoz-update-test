// Shared helper to blank theme image URLs.
//
// When a theme is opened from the Design Selection size modal with `blank_img=1`,
// every image object that carries an original sample URL must render as an EMPTY
// placeholder. This same blanking must also be re-applied whenever the canvas size
// is later changed in the editor (Manage Size popup), because those size-change
// paths re-source pages from the theme's `pages_c` (which still holds the original
// image URLs). Both `useThemeSetup` (initial load) and `SizeSettingsPopup`
// (in-editor resize) call this so the behavior stays identical.

// Replace every image object that already holds a URL with an empty box. Pure:
// returns a new pages array; objects without a URL (and non-image objects) pass
// through untouched. Masking and the box's `image` fit-metadata are preserved
// (Photo.jsx reads `item.image.*` directly, and the placement reducer overrides the
// fit when a new photo is dropped in) — only the image SOURCE is cleared.
const blankImg = (obj) =>
  obj && obj.type === "img" && (obj.url ?? "") !== ""
    ? { ...obj, url: "", urls: [], image_id: null }
    : obj;

export const blankImageUrls = (pages) =>
  (pages || []).map((page) => ({
    ...page,
    layout: (page.layout || []).map((layout) => {
      if (!layout) return layout;
      return {
        ...layout,
        objects: (layout.objects || []).map(blankImg),
        safeAreaObjects: (layout.safeAreaObjects || []).map(blankImg),
      };
    }),
  }));

// Collect the images the user has already placed on the current canvas, in the
// shape `changeObjectsInAllPages({ images, option:"option1" })` expects, so they can
// be re-filled into a freshly-loaded (and blanked) theme after a size/orientation
// change. Without this, the resize paths re-source pages from the theme's `pages_c`
// and dispatch them wholesale, DISCARDING the user's placed photos — which read as
// "the image disappears when I change size." Mirrors useThemeSetup.replacePages'
// existing-image collection (large-variant URL + original dimensions).
export const collectPlacedImages = (pages) => {
  const placed = [];
  (pages || []).forEach((page) => {
    (page.layout || []).forEach((layout) => {
      if (!layout) return;
      (layout.objects || []).forEach((obj) => {
        if (obj.type !== "img" || !obj.url || obj.url.trim() === "") return;
        const largeUrl = obj.urls?.find((u) => u.size === "large");
        if (!largeUrl?.url) return;
        const w = largeUrl?.w || obj.image?.originalWidth || obj.image?.width || 0;
        const h = largeUrl?.h || obj.image?.originalHeight || obj.image?.height || 0;
        const patchedUrls = obj.urls.map((u) =>
          u.size === "large" ? { ...u, w: w || u.w, h: h || u.h } : u
        );
        placed.push({
          urls: patchedUrls,
          image_id: obj.image_id,
          originalWidth: w,
          originalHeight: h,
        });
      });
    });
  });
  return placed;
};
