import { createSlice } from "@reduxjs/toolkit";
import { all } from "axios";

// Initial state for project details
const initialState = {
  project_id: null,
  brand_id: null,
  store_id: null,
  authToken: null,
  userDetails: null,
  themeDetails: {},
  cartDetails: {},
  allThemes: [],
  isInitialized: false, // To track if the project has been initialized
  isThemeApplied: false, // To track if the theme has been applied
  error: null,
  editorDetailsExist: false,
};
const projectSetup = createSlice({
  name: "projectsetup",
  initialState: initialState,
  reducers: {
    setProjectDetails: (state, action) => {
      const { editorDetails, cartDetails } = action.payload;

      /* Sample payload{
        "items": {
          "editorDetails": {
            "paltform": "Web",
            "_id": "6703699415478daca7be4c1a",
            "cart_order_id": "66ee664b13709a69415b2949",
            "theme_id": null,
            "width": "1",
            "height": "3",
            "images_count": "5",
            "editor_pages": "pagesJsonstasdaasdasdczxzcxzcsdasdring",
            "pages_c": "pagesJsonstringcompress",
            "number_of_pages": 15,
            "number_of_layouts": 14,
            "editor_type": "photobook",
            "brand_id": null,
            "createdAt": "2024-10-07T04:54:44.036Z",
            "updatedAt": "2024-10-07T04:58:32.017Z",
            "__v": 0
          },
          "cartDetails": {
            "brand_id": "5f1d002fb9fcb272f2f874fa"
          }
        },
        "totalCount": 1,
        "status": 1,
        "status_code": 200,
        "message": "success"
      }

      */
      state.brand_id = cartDetails ? cartDetails.brand_id : null;
      state.project_id = editorDetails ? editorDetails.cart_order_id : null;
      state.themeDetails = editorDetails ? editorDetails : {};
      state.cartDetails = cartDetails ? cartDetails : {};
      state.editorDetailsExist =
        editorDetails && editorDetails != null ? true : false;
      //  state.isInitialized = true;
      state.error = null;
    },
    setUserDetails: (state, action) => {
      state.userDetails = action.payload;
    },
    // Stores brand_id, store_id (and optionally accessToken) from auth API responses
    setAuthItems: (state, action) => {
      const { brand_id, store_id, accessToken } = action.payload;
      if (brand_id) state.brand_id = brand_id;
      if (store_id) state.store_id = store_id;
      if (accessToken) state.authToken = accessToken;
    },
    setAllThemes: (state, action) => {
      // used for theme creation for L, S, P
      state.allThemes = action.payload;
    },
    setProjectInitialized: (state, action) => {
      state.isInitialized = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isInitialized = false;
    },
    setEditorPages: (state, action) => {
      state.themeDetails.pages_c = action.payload;
    },
    setThemeId: (state, action) => {
      state.themeDetails.theme_id = action.payload;
      state.cartDetails.theme_id = action.payload;
    },
    setThemeName: (state, action) => {
      state.themeDetails.theme_name = action.payload;
    },
    resetProject: (state) => {
      Object.assign(state, initialState); // Reset to initial state
    },
    setThemeApplied: (state, action) => {
      state.isThemeApplied = action.payload;
    },
    resetThemeDetails: (state) => {
      state.themeDetails = {};
      state.allThemes = [];
      state.cartDetails.theme_id = null;
    },
    // Store smart_text metadata on themeDetails so setupTheme() can dispatch
    // setTextGroups AFTER applyTheme() has loaded canvas pages (correct timing).
    setThemeSmartText: (state, action) => {
      state.themeDetails.smart_text = action.payload || null;
    },
  },
});

export const {
  setProjectDetails,
  setError,
  resetProject,
  setEditorPages,
  setThemeId,
  setProjectInitialized,
  setAllThemes,
  setThemeName,
  setThemeApplied,
  resetThemeDetails,
  setUserDetails,
  setThemeSmartText,
  setAuthItems,
} = projectSetup.actions;

export default projectSetup.reducer;
