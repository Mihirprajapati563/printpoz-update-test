import { createSlice } from "@reduxjs/toolkit";

// Initial state for project details
const initialState = {
  svgContent: [],
  activeIndex: 0,
  startExport: false,
  initilized: false,
  allPagesCaptured: false,
  isCapturingPages: false,
  captureProgress: { currentPage: 0, totalPages: 0 },
  currentPageSVG: null,
  firstPageSVG: null,
  exportPageType: "ALL",
  exportFormat: "jpeg",
  exportAsZip: false,
  isPreviewBook: false,
  defaultWaterMarkText: "Approval Pdf",
  waterMarkData: "",
  waterMarkColor: "#000000FF",
};

const svgData = createSlice({
  name: "svgData",
  initialState: initialState,
  reducers: {
    setSvgData: (state, action) => {
      const { svgContent, pageIndex } = action.payload;
      state.activeIndex = pageIndex;
      if (
        svgContent == null ||
        svgContent == undefined ||
        svgContent == "" ||
        svgContent == {} ||
        svgContent == []
      ) {
        state.svgContent = [];
        return;
      }
      if (!state.svgContent?.find((item) => item.pageIndex === pageIndex)) {
        state.svgContent.push(svgContent);
      } else {
        // update svg content of this page index
        const index = state.svgContent.findIndex(
          (item) => item.pageIndex === pageIndex
        );
        if (index !== -1) {
          state.svgContent[index] = svgContent;
        }
      }
    },
    setActiveIndex: (state, action) => {
      state.activeIndex = action.payload;
    },
    setStartExport: (state, action) => {
      state.startExport = action.payload;
    },
    setInitilized: (state, action) => {
      state.initilized = action.payload;
    },
    setCurrentPageSVG: (state, action) => {
      state.currentPageSVG = action.payload;
    },
    setFirstPageSVG: (state, action) => {
      state.firstPageSVG = action.payload;
    },
    setExportPageType: (state, action) => {
      state.exportPageType = action.payload;
    },
    setExportFormat: (state, action) => {
      state.exportFormat = action.payload;
    },
    setExportAsZip: (state, action) => {
      state.exportAsZip = action.payload;
    },
    setIsPreviewBook: (state, action) => {
      state.isPreviewBook = action.payload;
    },
    setWaterMarkData: (state, action) => {
      state.waterMarkData = action.payload
        ? action.payload
        : state.waterMarkData;
    },
    setWaterMarkColor: (state, action) => {
      state.waterMarkColor = action.payload
        ? action.payload
        : state.waterMarkColor;
    },
    resetWaterMarkData: (state) => {
      state.waterMarkData = "";
    },
    resetWaterMarkColor: (state) => {
      state.waterMarkColor = "#000000FF";
    },
    setAllPagesCaptured: (state, action) => {
      state.allPagesCaptured = action.payload;
    },
    setIsCapturingPages: (state, action) => {
      state.isCapturingPages = action.payload;
    },
    setCaptureProgress: (state, action) => {
      state.captureProgress = action.payload;
    },
  },
});

export const {
  setSvgData,
  setStartExport,
  setActiveIndex,
  setInitilized,
  setCurrentPageSVG,
  setFirstPageSVG,
  setExportPageType,
  setExportFormat,
  setExportAsZip,
  setIsPreviewBook,
  setWaterMarkData,
  setWaterMarkColor,
  resetWaterMarkData,
  resetWaterMarkColor,
  setAllPagesCaptured,
  setIsCapturingPages,
  setCaptureProgress,
} = svgData.actions;

export default svgData.reducer;
