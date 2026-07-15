import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  brand_logo: "",
  brandname: "",
  editor_url: "",
  redirect_url: "",
  editor_favicon_icon: "",
  _id: "",
};
const brandSlice = createSlice({
  name: " brandDetails",
  initialState,
  reducers: {
    setBrandDetails(state, action) {
      state.brand_logo = action.payload.brand_logo;
      state.brandname = action.payload.brandname;
      state.editor_url = action.payload.editor_url;
      state.redirect_url = action.payload.redirect_url;
      state.editor_favicon_icon = action.payload.editor_favicon_icon;
      state._id = action.payload._id;
    },
  },
});

export const { setBrandDetails } = brandSlice.actions;
export default brandSlice.reducer;
