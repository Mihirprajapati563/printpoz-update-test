import { EDITOR_ASSETS, EDITOR_TYPES } from "../../constants/index.js";
import { ENDPOINTS } from "../../constants/apiurl.js";

import { apiPost, apiGet } from "../../common-services/apiCall.js";
export const getMasksByIds = async (ids) => {
  const data = {
    filter: {
      status: 1,
      type: EDITOR_ASSETS.MASK,
      display_in_web: true,
      _ids: { $in: ids },
    },
  };

  const response = await apiPost(ENDPOINTS.getMask, data);
  if (response && response.items) {
    return response.items;
  } else {
    return [];
  }
};
