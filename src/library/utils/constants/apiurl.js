//export const API_BASE_URL = 'https://test7api.quickorders.in/api/v3/';
// export const API_BASE_URL = "http://192.168.1.17:3006/api/v1/";
// export const ORDER_API_BASE_URL = "http://192.168.1.17:3006/api/v1/";  // printpoz
// Desktop (Electron) injects runtime config via preload (window.__APP_CONFIG__) so the API
// base URL can switch per environment without a rebuild. Falls back to the web default.
const __RUNTIME__ = (typeof window !== "undefined" && window.__APP_CONFIG__) || {};
export const API_BASE_URL = __RUNTIME__.apiBaseUrl || "https://apis.printpoz.com/api/v1/";
export const ORDER_API_BASE_URL = __RUNTIME__.orderApiBaseUrl || "https://apis.printpoz.com/api/v1/";  // printpoz
// export const API_BASE_URL = __RUNTIME__.apiBaseUrl || "http://192.168.29.203:3006/api/v1/";
// export const ORDER_API_BASE_URL = __RUNTIME__.orderApiBaseUrl || "http://192.168.29.203:3006/api/v1/";  // printpoz
// export const ORDER_API_BASE_URL = "https://apis.quickorders.in/api/v3/";  // quick order
// export const API_BASE_URL_Local = "http://localhost:3006/api/v1/"; //local
// export const API_BASE_URL = 'http://localhost:3005/api/v3/';  // live
// export const ORDER_API_BASE_URL = 'http://localhost:3005/api/v3/';
//https://test7api.quickorders.in/api/v3/store-tags/

export const ENDPOINTS = {
  getBackgroundCategory: `${API_BASE_URL}store-tags`, // Endpoint for getting background categories
  getBackgrounds: `${API_BASE_URL}editor-settings/getEditorTypeWiseDetails`, // Endpoint for getting backgrounds
  getLayouts: `${API_BASE_URL}editor-settings/getLayouts`, // Endpoint for getting layouts
  saveLayouts: `${API_BASE_URL}editor-settings/createLayout`, // Endpoint for saving layout for futher use
  getStickers: `${API_BASE_URL}editor-settings/getEditorTypeWiseDetails`, // Endpoint for getting stickers
  getStickerCategories: `${API_BASE_URL}store-tags`, // Endpoint for getting sticker categories
  getMask: `${API_BASE_URL}editor-settings/getEditorTypeWiseDetails`, // Endpoint for getting mask
  getFonts: `${API_BASE_URL}editor-settings/getEditorTypeWiseDetails`, // Endpoint for getting fonts
  getThemesCategory: `${API_BASE_URL}store-tags`, // Endpoint for getting themes
  getThemes: `${API_BASE_URL}store-theme-editor`, // Endpoint for getting themes
  getThemeById: `${API_BASE_URL}store-theme-editor/getTheme`, // Endpoint for getting theme by id
  saveAsTheme: `${API_BASE_URL}store-theme-editor/saveTheme`, // Endpoint for creating  themes
  savePageAsThemeImage: `${API_BASE_URL}store-theme-editor/saveThemeImage`, // Endpoint for creating  themes
  getTemplates: `${API_BASE_URL}editor-settings/getEditorTypeWiseDetails`, // Endpoint for getting templates
  getOrderDetails: `${ORDER_API_BASE_URL}order/details`, // Endpoint for getting order details
  uploadProjectImages: `${API_BASE_URL}project-images/uploadImage`, // Endpoint for upload project images
  uploadImage: `${API_BASE_URL}project-images/uploadImage`, // Endpoint for upload project images (legacy)
  uploadsInit: `${API_BASE_URL}project-images/uploads/init`, // Endpoint for multipart upload init (signed URLs)
  uploadsComplete: `${API_BASE_URL}project-images/uploads/complete`, // Endpoint for multipart upload finalize
  uploadsRefreshUrls: `${API_BASE_URL}project-images/uploads/refresh-urls`, // Endpoint for refreshing expired signed URLs
  getProjectImages: `${API_BASE_URL}project-images`, // Endpoint for getting project images
  addProjectImageAsFavroite: `${API_BASE_URL}project-images/addImageAsFavroite`, // Endpoint for add favorite as project images
  removeProjectImageAsFavroite: `${API_BASE_URL}project-images/removeImageAsFavroite`, // Endpoint for remove favorite in project images
  deleteProjectImage: `${API_BASE_URL}project-images/deleteImage`, // Endpoint for remove favorite in project images,
  getProjectDetails: `${ORDER_API_BASE_URL}cart-editor-details/view/`, // Endpoint for getting project details
  saveProject: `${ORDER_API_BASE_URL}cart-editor-details/save`, // Endpoint for saving project
  exportAsJPG: `${API_BASE_URL}cart-editor-details/exportAsJpeg`, // Endpoint for exporting svg as JPG
  fetchUserDataFromToken: `${ORDER_API_BASE_URL}users/fetchUserDataFromToken`, // Endpoint for fetching user data from token
  getImageGallery: `${API_BASE_URL}cart-editor-details/getImageGallery`, // Endpoint for getting image gallery
  getMyPhotos: `${API_BASE_URL}project-images`, // Endpoint for getting my photos
  getTextCaptions: `${API_BASE_URL}ai/generate-caption-suggestions`, // Endpoint for getting text captions
  addToProject: `${API_BASE_URL}project-images/copyImagesFromProject`,
  deleteMultipleProjectImages: `${API_BASE_URL}project-images/deleteMultipleImages`,
  getBrandDetails: `${API_BASE_URL}brand/getEditorBrandDetails`,
  removeSizeFromTheme: `${API_BASE_URL}store-theme-editor/removeSize`,
  getProductSizes: `${API_BASE_URL}productSize/getSizeForEditor`, // Endpoint for listing brand product sizes

  removeBackground: `${API_BASE_URL}ai/remove-background`,
  getClipArts: `${API_BASE_URL}editor-settings/getClipArts`,
  swapFaceByAI: `${API_BASE_URL}ai/swap-face-by-ai`, // Endpoint for AI face swapping
  getStoreList: `${API_BASE_URL}brand-store`,
  getEditorConfigurationForStore: `${API_BASE_URL}editor-configurations/get-editor-configuration-for-store`,
  saveEditorConfiguration: `${API_BASE_URL}editor-configurations/save-editor-configuration`,
  // Font Management endpoints
  getFontsList: `${API_BASE_URL}font`, // Endpoint for listing all custom fonts
  getFontsListInSidebar: `${API_BASE_URL}font/list`, // Endpoint for listing all custom fonts
  addFont: `${API_BASE_URL}font/create`, // Endpoint for adding a new font (multipart)
  updateFont: `${API_BASE_URL}font/update`, // Endpoint for updating font metadata
  // deleteFont: `${API_BASE_URL}font/delete`, // Endpoint for deleting a font
  toggleFont: `${API_BASE_URL}font/toggleEnabled`, // Endpoint for toggling font enabled/disabled
  getFontById: `${API_BASE_URL}font/getFontsDetailsFromIdsOrNames`, // Endpoint for toggling font enabled/disabled
  // Asset Management endpoints
  getTagsByType: `${API_BASE_URL}store-tags`, // Legacy?
  getTagsListByType: `${API_BASE_URL}store-tags/getList`, // New endpoint (structure differs)
  getEditorTypeWiseList: `${API_BASE_URL}editor-settings/getEditorTypeWiseList`, // Endpoint for getting assets by type with pagination
  createEditorSetting: `${API_BASE_URL}editor-settings/create/`, // Endpoint for creating new editor setting asset (multipart)
  viewEditorSetting: `${API_BASE_URL}editor-settings/view/`, // Endpoint for viewing an editor setting asset
  updateEditorSetting: `${API_BASE_URL}editor-settings/update/`, // Endpoint for updating an editor setting asset (PATCH)
  deleteEditorSetting: `${API_BASE_URL}editor-settings/delete/`, // Endpoint for deleting an editor setting asset
  hideMaterialFromBrand: `${API_BASE_URL}editor-settings/hideMaterialFromBrand`, // Hide materials from a brand
  enableMaterialFromBrand: `${API_BASE_URL}editor-settings/enableMaterialFromBrand`, // Enable materials for a brand
  // Tag Management
  getTags: `${API_BASE_URL}store-tags`,
  createTag: `${API_BASE_URL}store-tags/create`,
  viewTag: `${API_BASE_URL}store-tags/view/`,
  updateTag: `${API_BASE_URL}store-tags/update/`,
  deleteTag: `${API_BASE_URL}store-tags/delete/`,
  calculateOrderAmount: `${ORDER_API_BASE_URL}cart/calculateOrderAmountForEditor`,
  // Auth endpoints
  authLogin: `${API_BASE_URL}auth/store/loginWithEditor`,
  verifyOTP: `${API_BASE_URL}auth/store/verifyOTPForEditorLogin`,
};
