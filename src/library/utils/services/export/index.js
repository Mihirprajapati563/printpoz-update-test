import { EDITOR_ASSETS, EDITOR_TYPES } from "../../constants/index.js";
import { ENDPOINTS } from "../../apiurls.js";

import { apiPost } from "../../api.js";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

export const SvgToJPG = async (svgContent, width, height) => {
  // apiGet is asycn function which will return  ,  i want to return the response from this function
  const data = {
    svgDetails: svgContent,
    w: width,
    h: height,
  };

  const response = await apiPost(ENDPOINTS.exportAsJPG, data, {
    responseType: "blob",
  });
  if (response) {
    return response;
    //setupTheme(themeData, theme._id);
  } else {
    return [];
  }
};
