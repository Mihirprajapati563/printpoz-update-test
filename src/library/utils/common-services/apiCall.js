// api.js

import axios from "axios";
import { API_BASE_URL } from "../constants/apiurl"; // Import base URL
import { ERROR_MESSAGES } from "../constants"; // Import error messages
import { debug } from "openai/core";
import { Decrypt } from "../common-functions";

// Session expiry event - components can subscribe to this
let sessionExpiredCallback = null;

export const onSessionExpired = (callback) => {
  sessionExpiredCallback = callback;
};

export const clearSessionExpiredCallback = () => {
  sessionExpiredCallback = null;
};

// Only fire session-expired callback for 401s from our own API. Third-party
// calls (S3 signed URLs, Google, OpenAI) can also 401 and must NOT pop the
// login modal mid-edit.
const isOwnApiUrl = (url) => {
  if (!url) return false;
  // Relative URL (no protocol) → axios will prepend baseURL → treat as own API.
  if (!/^https?:\/\//i.test(url)) return true;
  return url.startsWith(API_BASE_URL);
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      isOwnApiUrl(error?.config?.url) &&
      sessionExpiredCallback
    ) {
      sessionExpiredCallback();
    }
    return Promise.reject(error);
  }
);

// General GET request function
export const apiGet = async (endpoint, params = {}) => {
  try {
    const token = getAccessToken();
    const user = getUserDetails();
    const brand = getBrandDetails();
    
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (user?._id) {
      headers["x-user-id"] = user._id;
    }
    const resolvedBrandId = brand?.brand_id || user?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }

    const response = await axios.get(`${endpoint}`, { params, headers });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// General DELETE request function
export const apiDelete = async (endpoint, config = {}) => {
  try {
    const token = getAccessToken();
    const user = getUserDetails();
    const brand = getBrandDetails();

    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (user?._id) {
      headers["x-user-id"] = user._id;
    }
    const resolvedBrandId = brand?.brand_id || user?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }

    const response = await axios.delete(`${endpoint}`, {
      ...config,
      headers,
    });
    return response.data;
  } catch (error) {
    return { error: error?.response?.data || error || "Error occurred during deletion" };
  }
};

// General POST request function
export const apiPost = async (endpoint, data = {}, config = {}) => {
  try {
    const token = getAccessToken();
    const brandDetails = getBrandDetails();
    const userDetails = getUserDetails();
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userDetails?._id) {
      headers["x-user-id"] = userDetails._id;
    }
    const resolvedBrandId = brandDetails?.brand_id || userDetails?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }
    let payload = data;
    if (!config.skipBrandId) {
      if (brandDetails) {
        if (payload?.filter) {
          payload.filter.brand_id = brandDetails?.brand_id || "";
        } else if (!payload?.brand_id) {
          payload.brand_id = brandDetails.brand_id || "";
        }
      }
      if (userDetails && userDetails.brand_id) {
        if (payload?.filter) {
          payload.filter.brand_id = userDetails?.brand_id || "";
        } else if (!payload?.brand_id) {
          payload.brand_id = userDetails.brand_id || "";
        }
      }
    }
    const response = await axios.post(`${endpoint}`, payload, {
      ...config,
      headers,
    });
    return response.data;
  } catch (error) {
    return { error: error || ERROR_MESSAGES.api_error_message };
  }
};

// General PATCH request function
export const apiPatch = async (endpoint, data = {}, config = {}) => {
  try {
    const token = getAccessToken();
    const brandDetails = getBrandDetails();
    const userDetails = getUserDetails();
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userDetails?._id) {
      headers["x-user-id"] = userDetails._id;
    }
    const resolvedBrandId = brandDetails?.brand_id || userDetails?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }
    let payload = data;
    if (brandDetails) {
      if (payload?.filter) {
        payload.filter.brand_id = brandDetails?.brand_id || "";
      } else if (!payload?.brand_id) {
        payload.brand_id = brandDetails.brand_id || "";
      }
    }
    if (userDetails && userDetails.brand_id) {
      if (payload?.filter) {
        payload.filter.brand_id = userDetails?.brand_id || "";
      } else if (!payload?.brand_id) {
        payload.brand_id = userDetails.brand_id || "";
      }
    }
    const response = await axios.patch(`${endpoint}`, payload, {
      ...config,
      headers,
    });
    return response.data;
  } catch (error) {
    return { error: error || ERROR_MESSAGES.api_error_message };
  }
};

// General MultiPart Form request function (POST)
export const apiMultiPartPost = async (
  endpoint,
  data = {},
  onUploadProgress = null
) => {
  try {
    const token = getAccessToken();
    const userDetails = getUserDetails();
    const brandDetails = getBrandDetails();
    const headers = {
      "Content-Type": "multipart/form-data",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userDetails?._id) {
      headers["x-user-id"] = userDetails._id;
    }
    const resolvedBrandId = brandDetails?.brand_id || userDetails?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }
    const response = await axios.post(endpoint, data, {
      headers,
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(progress);
        }
        : null,
    });
    return response.data;
  } catch (error) {
    return {
      error: error.message || "An error occurred while making the API request.",
    };
  }
};

// General MultiPart Form request function (PATCH)
export const apiMultiPartPatch = async (
  endpoint,
  data = {},
  onUploadProgress = null
) => {
  try {
    const token = getAccessToken();
    const userDetails = getUserDetails();
    const brandDetails = getBrandDetails();
    const headers = {
      "Content-Type": "multipart/form-data",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userDetails?._id) {
      headers["x-user-id"] = userDetails._id;
    }
    const resolvedBrandId = brandDetails?.brand_id || userDetails?.brand_id;
    if (resolvedBrandId) {
      headers["x-brand-id"] = resolvedBrandId;
    }
    const response = await axios.patch(endpoint, data, {
      headers,
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(progress);
        }
        : null,
    });
    return response.data;
  } catch (error) {
    return {
      error: error.message || "An error occurred while making the API request.",
    };
  }
};

// get access token
export const getAccessToken = () => {
  const userDetails = JSON.parse(localStorage.getItem("userDetails"));
  return userDetails?.token || null;
};

// get brand detaial
export const getBrandDetails = () => {
  const encryptedBrandDetails = localStorage.getItem("brandDetails");
  if (!encryptedBrandDetails) {
    return null;
  }
  const brandDetails = JSON.parse(Decrypt(encryptedBrandDetails));
  return brandDetails;
};

// get userDetails
export const getUserDetails = () => {
  const userDetails = localStorage.getItem("userDetails");
  return JSON.parse(userDetails);
};
