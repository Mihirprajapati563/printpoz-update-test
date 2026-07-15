import {
  EDITOR_ASSETS,
  EDITOR_TYPES,
  USER_TYPES,
} from "../../constants/index.js";
import { ENDPOINTS } from "../../constants/apiurl.js";
import {
  decompressFromBase64,
  scalePages,
} from "../../common-functions/index.js";
import { apiPost, apiGet } from "../../common-services/apiCall.js";
import { isAdminLike } from "../../helpers/session.js";
import {
  withAssetCache,
  withAssetDetailCache,
} from "../../helpers/assetsCache.js";
import { getThemePackThemeJson } from "../../helpers/themePacks.js";
import { store } from "../../../../store/store";

/**
 * Fetch a paginated page of theme editors for one category (editor type).
 * Reusable by the design-selection ThemeBrowser and anywhere a category-scoped
 * theme list is needed. Mirrors the proven `ThemesAction.fetchThemes` filter.
 * Returns `{ items, totalCount }`; throws on API error so callers can show a
 * retry state.
 */
export const fetchThemesByCategory = async ({
  editorType,
  user,
  skip = 0,
  limit = 24,
  search = "",
}) => {
  const payload = {
    filter: {
      status: isAdminLike(user) ? { $in: [1, 3] } : 1,
      tagId: null,
      editor_type: editorType,
      display_in_web: true,
      search,
      brand_id: user?.brand_id ? user.brand_id : null,
      userTypeCode: user?.userTypeCode ? user.userTypeCode : null,
    },
    skip,
    limit,
    sort: { createdAt: -1 },
  };

  // Offline-first: replay the cached category listing when offline; refresh on
  // every successful online fetch. Heavy page payloads are stripped before
  // caching so the cached catalog stays lightweight.
  const cached = await withAssetCache("themes", payload, async () => {
    const response = await apiPost(ENDPOINTS.getThemes, payload);
    if (response && Array.isArray(response.items)) {
      response.items.forEach((item) => {
        delete item.pages_c;
        delete item.theme;
      });
    }
    return response;
  });
  // Preserve the original throw-on-total-failure contract: only error out when
  // neither the network NOR the cache could supply anything.
  if (!Array.isArray(cached?.items)) {
    throw new Error("Failed to fetch themes");
  }
  return { items: cached.items, totalCount: cached.totalCount || 0 };
};

export const getUserDetails = () => {
  const stateUser = store.getState()?.projectSetup?.userDetails;
  if (stateUser) {
    return stateUser;
  }

  try {
    if (typeof window !== "undefined") {
      const cachedUser = window.localStorage.getItem("userDetails");
      return cachedUser ? JSON.parse(cachedUser) : null;
    }
  } catch (error) {
  }

  return null;
}

export const processThemeResponseItems = (
  response,
  width,
  height,
  orientation,
  editorType
) => {
  // lets get the items theme having orientation match with the current orientation, else default to first theme
  const themeList = response.items?.theme;
  if (!themeList || themeList.length === 0) {
    // Return null instead of throwing to allow graceful handling in the UI
    return null;
  }
  const theme =
    themeList.find((item) => item.orientation === orientation) ||
    themeList[0];

  const decompressedTheme = decompressFromBase64(theme.pages_c);

  // loop through each page and scale the layout to fit the canvas
  const pages = scalePages(
    decompressedTheme.pages,
    width / (editorType === EDITOR_TYPES.PHOTOBOOK ? 2 : 1),
    height
  );

  return {
    ...response.items,
    pages_c: pages,
  };
};
export const processProjectPages = (encoded_pages, width, height) => {
  if (width == undefined || width == null) {
    return [];
  }
  const decompressedThemePages = decompressFromBase64(encoded_pages);

  // loop through each page and scale the layout to fit the canvas
  const pages = scalePages(decompressedThemePages.pages, width, height);

  // Preserve isPageEdited flag from API data if present
  pages.forEach((page, index) => {
    if (decompressedThemePages.pages[index]?.isPageEdited !== undefined) {
      page.isPageEdited = decompressedThemePages.pages[index].isPageEdited;
    } else {
      page.isPageEdited = false;
    }
  });

  return pages;
};

export const GetThemeById = async (id, canvasSize, editorType, orientation) => {
  // const user = JSON.parse(localStorage.getItem("userDetails"));
  const user = getUserDetails();
  // apiGet is asycn function which will return  ,  i want to return the response from this function
  let data = {
    _id: id,
  };

  if (
    canvasSize &&
    canvasSize.width &&
    canvasSize.width !== null &&
    canvasSize.width !== undefined &&
    canvasSize.height &&
    canvasSize.height !== null &&
    canvasSize.height !== undefined &&
    user &&
    user?.userTypeCode === USER_TYPES.CUSTOMER
    && editorType !== EDITOR_TYPES.CUSTOME_PRODUCT
  ) {
    data.size = `${canvasSize.width}x${canvasSize.height}`;
  }
  data.user_type_code = user ? user?.userTypeCode : null;

  // Prefer a downloaded theme pack whenever one exists — ONLINE OR OFFLINE. The
  // pack's theme.json holds the FULL response with EVERY size variant (it was
  // fetched with no size filter, exactly like the size-picker's request), so a
  // downloaded theme opens and is size-picked from local disk with NO API call.
  // getThemePackThemeJson returns null for a non-downloaded theme (and always on
  // web), so the network path below is untouched for everything else. The pack's
  // image assets also resolve from disk via the imageCache url map, keeping the
  // whole open local. (Updating a downloaded theme is done by re-downloading,
  // which wipes a stale pack — see downloadTheme.js.)
  const packJson = await getThemePackThemeJson(id);
  if (packJson) {
    try {
      const packRaw = JSON.parse(packJson);
      if (packRaw && packRaw.items) {
        let baseWidth = canvasSize?.width;
        let baseHeight = canvasSize?.height;
        const baseDepth = canvasSize?.depth || 0;
        if (packRaw.items?.theme?.length > 0) {
          baseWidth = parseFloat(packRaw.items.theme[0]?.width) || baseWidth;
          baseHeight = parseFloat(packRaw.items.theme[0]?.height) || baseHeight;
        }
        return await processThemeResponseItems(
          packRaw,
          baseWidth - baseDepth,
          baseHeight - baseDepth,
          orientation,
          editorType,
        );
      }
    } catch (_) {
      /* corrupt pack — fall through to the network/cache path */
    }
  }

  // Offline-first: cache the RAW theme detail response keyed by theme id (and the
  // size/user-type variant in `data`), then process it below. Caching the raw
  // (compressed) payload — not the scaled pages — lets the same cached theme be
  // re-applied at any canvas size offline.
  const response = await withAssetDetailCache(
    "themes",
    { detail: data },
    () => apiPost(ENDPOINTS.getThemeById, data),
    (res) => !!res && res.status !== 0 && !!res.items,
  );
  if (response && response.status !== 0) {
    // Use the first theme's dimensions for scaling — ensures correct sizing
    // regardless of what the current canvasSize is (may still be default 1200x2400)
    let baseWidth = canvasSize.width;
    let baseHeight = canvasSize.height;
    const baseDepth = canvasSize.depth || 0;
    if (response?.items?.theme?.length > 0) {
      baseWidth = parseFloat(response.items?.theme[0]?.width) || baseWidth;
      baseHeight = parseFloat(response.items?.theme[0]?.height) || baseHeight;
    }

    let width = baseWidth - baseDepth;
    let height = baseHeight - baseDepth;
    const themeData = await processThemeResponseItems(
      response,
      width,
      height,
      orientation,
      editorType
    );
    return themeData;
  } else {
    return null;
  }
};
