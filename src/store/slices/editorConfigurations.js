import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    store_id: "",
    brand_id: "",
    brand_stores: [],
    _id: "",
    //  theme_colors: {
    //     "background": "#ecf2f7",
    //     "foreground": "#1f4f73",
    //     "primary": "#4084b5",
    //     "primary-foreground": "#ffffff",
    //     "secondary": "#eff8ff",
    //     "secondary-foreground": "#4084b5",
    //     "muted-foreground": "#6c8ea5",
    //     "accent-foreground": "#4084b5",
    // },
    theme_colors: {
        "background": "#ffffff",
        "foreground": "#111111",
        "primary": "#111111",
        "primary-foreground": "#ffffff",
        "secondary": "#f0f0f0",
        "secondary-foreground": "#111111",
        "muted-foreground": "#6b6b6b",
        "accent-foreground": "#111111",
    },
    configuration: {
        is_downloadable: false,
    },

}
const editorConfigurations = createSlice({
    name: "editorConfigurations",
    initialState,
    reducers: {
        setEditorConfigurations: (state, action) => {
            return { ...state, ...action.payload }
        },
        setBrandStores: (state, action) => {
            return { ...state, brand_stores: action.payload }
        },
        selectBrandStore: (state, action) => {
            state.store_id = action.payload.store_id;
            state.brand_id = action.payload.brand_id;
        },
        setThemeColor: (state, action) => {
            const { colorName, colorValue } = action.payload;
            state.theme_colors[colorName] = colorValue;
        },
        setConfiguration: (state, action) => {
            state.configuration = { ...state.configuration, ...action.payload };
        },
    }
})

export const { setEditorConfigurations, setBrandStores, selectBrandStore, setThemeColor, setConfiguration } = editorConfigurations.actions;
export default editorConfigurations.reducer;

export const getEditorThemeColor = (state) => state.editorConfigurations.theme_colors;
export const getEditorConfiguration = (state) => state.editorConfigurations.configuration;

