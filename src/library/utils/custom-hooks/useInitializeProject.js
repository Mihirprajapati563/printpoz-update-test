// src/hooks/useInitializeProject.js
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setProjectDetails,
  setError,
  setProjectInitialized,
  setUserDetails,
  resetThemeDetails,
} from "../../../store/slices/projectSetup";
import {
  setCanvasSize,
  setEditorType,
  setMinPages,
  setMaxPages,
  setCalendarSettings,
  setSettings,
} from "../../../store/slices/canvas";

import { apiGet, apiPost } from "../common-services/apiCall";
import { ENDPOINTS } from "../constants/apiurl";
import { processProjectPages } from "../services/theme/index.js";
import { EDITOR_TYPES, USER_TYPES } from "../constants/index.js";

import { setBrandDetails } from "../../../store/slices/brandDetails.js";
import { getActiveEditorType } from "../helpers/canvasSliceGetters.js";
import { Encrypt } from "../common-functions";
import { setEditorConfigurations } from "../../../store/slices/editorConfigurations";
import { setLastOpenEditor, setStoredUser } from "../helpers/session.js";
import { hasEditorSnapshot } from "../helpers/editorSnapshot.js";
import { stageDesignForRestore, deriveDesignId } from "../helpers/savedDesigns.js";

/**
 * Custom hook to initialize project details based on URL parameters.
 */
const useInitializeProject = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const domain = window.location.hostname;
  // const domain = "editor.printpoz.com";
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState(null);
  const { brandname } = useSelector((state) => state.brandDetails);
  const projectState = useSelector((state) => state.projectSetup);
  let editorType = "";
  // create function to get project details
  const getProjectDetails = async (project_id, token) => {
    const response = await apiGet(ENDPOINTS.getProjectDetails + project_id);

    if (response && response.items) {
      const { editorDetails, cartDetails } = response.items;

      // Dispatch project details to Redux store
      let brand_id = "";
      if (
        editorDetails &&
        editorDetails !== null &&
        editorDetails !== undefined
      ) {
        brand_id = editorDetails.brand_id;
        editorType = editorDetails.editor_type;
        // setActiveEditorType(editorType);
        dispatch(setEditorType(editorType));
        dispatch(
          setCanvasSize({
            width: editorDetails.width,
            height: editorDetails.height,
            depth: editorDetails.depth,
            safeMargin: editorDetails?.safe_margin || 0,
            bleedMargin: editorDetails?.bleed_margin || 0,
          })
        );
      } else if (
        cartDetails &&
        cartDetails !== null &&
        cartDetails !== undefined
      ) {
        const editorType = cartDetails.editor_type;
        brand_id = cartDetails.brand_id;
        // setActiveEditorType(editorType);
        dispatch(setEditorType(editorType));
        if (editorType === EDITOR_TYPES.PHOTOBOOK || editorType === EDITOR_TYPES.LAYFLATALBUM) {
          dispatch(
            setCanvasSize({
              width: cartDetails.size_id.width * 2,
              height: cartDetails.size_id.height,
              depth: 0,
              safeMargin: cartDetails.size_id?.safe_margin || 0,
              bleedMargin: cartDetails.size_id?.bleed_margin || 0,
            })
          ); // width is doubled for photobook
        } else {
          if (cartDetails.size_id) {
            dispatch(
              setCanvasSize({
                width: cartDetails.size_id.width,
                height: cartDetails.size_id.height,
                depth: cartDetails.size_id?.depth || 0,
                safeMargin: cartDetails.size_id?.safe_margin || 0,
                bleedMargin: cartDetails.size_id?.bleed_margin || 0,
              })
            );
          }
        }
      }
      if (editorType === EDITOR_TYPES.CALENDER) {
        if (editorDetails.cal_settings) {
          let calSettings = { ...editorDetails.cal_settings };
          if (editorDetails.startMonth) {
            calSettings.startMonth = null;
          }
          if (editorDetails.startYear) {
            calSettings.startYear = null;
          }
          // If weeksColumns missing from saved cal_settings, read from first calendar object
          if (calSettings.weeksColumns == null) {
            const pages = Array.isArray(editorDetails.pages_c) ? editorDetails.pages_c : [];
            outer: for (const page of pages) {
              for (const layout of (page.layout || [])) {
                for (const obj of (layout?.objects || [])) {
                  if ((obj.type === 'calendar' || obj.type === 'multiple-calendar') && obj.calendarSettings?.weeksColumns != null) {
                    calSettings.weeksColumns = obj.calendarSettings.weeksColumns;
                    break outer;
                  }
                }
              }
            }
          }
          dispatch(setCalendarSettings(calSettings));

          const settings =
            editorDetails &&
              editorDetails !== null &&
              editorDetails !== undefined &&
              editorDetails.settings &&
              editorDetails.calSettings !== null &&
              editorDetails.calSettings !== undefined
              ? editorDetails.settings
              : { subtype: "wall_calendar" };
          dispatch(setSettings(settings));
        } else {
          // lets get current month and year
          const date = new Date();
          const currentYear = date.getFullYear();
          const currentMonth = date.getMonth() + 1;
          dispatch(
            setCalendarSettings({
              startMonth: currentMonth,
              startYear: currentYear,
              addCover: false,
            })
          );
        }
      }

      if (
        cartDetails &&
        cartDetails != null &&
        cartDetails != undefined &&
        cartDetails.min_pages &&
        cartDetails.max_pages
      ) {
        dispatch(setMinPages(cartDetails.min_pages));
        dispatch(setMaxPages(cartDetails.max_pages));
      }

      if (
        editorDetails &&
        editorDetails != null &&
        editorDetails != undefined &&
        editorDetails.pages_c
      ) {
        let width = editorDetails.width;
        if (editorDetails.editor_type === EDITOR_TYPES.PHOTOBOOK) {
          width = editorDetails.width / 2;
        }
        const pages = processProjectPages(
          editorDetails.pages_c,
          width,
          editorDetails.height
        );
        editorDetails.pages_c = pages;
      }
      // lets clear user
      if (!token) {
        localStorage.removeItem("userDetails");
        // lets set user details in localhost for future use
        const user = {
          userTypeCode: USER_TYPES.CUSTOMER,
          brand_id: brand_id,
          _id: cartDetails.userId || cartDetails?.user_id,
        };
        localStorage.setItem("userDetails", JSON.stringify(user));
        dispatch(setUserDetails(user));
      }
      if (editorDetails && editorDetails.settings) {
        dispatch(setSettings(editorDetails.settings));
      } else if (cartDetails && cartDetails.settings) {
        dispatch(setSettings(cartDetails.settings));
      }

      dispatch(setProjectDetails({ editorDetails, cartDetails }));

      // NOTE: Smart Text hydration for the saved-project path is handled in
      // useThemeSetup.setupTheme(), which runs after setProjectDetails and reads
      // themeDetails.smart_text (= editorDetails.smart_text). No need to dispatch
      // setTextGroups here — setupTheme will do it with objectIds intact so the
      // reducer can properly re-link objects before propagating group values.
    } else {
      dispatch(setError("Failed to load project")); // Dispatch error to Redux
      setErrorState("Failed"); // Set local error state
    }

    setLoading(false);
  };
  const getUserDetails = async (token) => {
    let data = {
      authorization: "Bearer " + token,
    };

    const response = await apiPost(ENDPOINTS.fetchUserDataFromToken, data);

    // Couldn't REACH the server at all (offline / network down): apiPost wraps
    // the axios error and there is no HTTP `response`. This is distinct from a
    // genuine auth rejection (status 0 / HTTP 401), both of which DO carry a
    // response. The caller uses this flag to open a downloaded theme with the
    // cached session instead of bouncing to "Session Expired". This does NOT
    // rely on navigator.onLine (unreliable in Electron — it can report online
    // with no real connectivity).
    const networkFailure = !!response?.error && !response.error.response;

    if (response && response.status === 0) {
      throw new Error(response.message || "Invalid Token");
    }

    if (response && response.items && !Array.isArray(response.items)) {
      let user = response.items;
      if (user && user._id) {
        user.token = token;
        // Persist + durably mirror (desktop) so a reopened app stays signed in.
        setStoredUser(user);
        dispatch(setUserDetails(user));
      } else {
        localStorage.removeItem("userDetails");
        throw new Error("Failed to load user details");
      }
    } else {
      const err = new Error(response?.message || "Failed to load user");
      err.networkFailure = networkFailure;
      throw err;
    }
  };

  const getBrandDetails = async ({ project_id = null }) => {
    try {
      let dataObj = {
        editor_domain: `https://${domain}`,
        // editor_domain: `https://editor.printpoz.com`,

      }
      if (project_id) {
        dataObj["project_id"] = project_id
      }
      const response = await apiPost(ENDPOINTS.getBrandDetails, dataObj);
      if (response.status === 1) {
        dispatch(
          setBrandDetails({
            brandname: response.items.brandname,
            brand_logo: response.items.brand_logo,
            editor_url: response.items.editor_url,
            redirect_url: response.items.redirect_url,
            editor_favicon_icon: response.items.editor_favicon_icon,
            _id: response.items.brand_id,
          })
        );
        // Always persist top-level store_id and brand_id (API may return editorConfigurations: null)
        const topLevelConfig = {};
        if (response?.items?.store_id) topLevelConfig.store_id = response.items.store_id;
        if (response?.items?.brand_id) topLevelConfig.brand_id = response.items.brand_id;
        if (Object.keys(topLevelConfig).length > 0) {
          dispatch(setEditorConfigurations(topLevelConfig));
        }
        if (response?.items?.editorConfigurations) {
          dispatch(setEditorConfigurations(response.items.editorConfigurations))
        }

        // store encrypted brand details in local storage
        localStorage.setItem(
          "brandDetails",
          Encrypt({
            brandname: response.items.brandname,
            brand_id: response.items.brand_id,
          })
        );

        const title =
          response.items && response.items.brandname
            ? response.items.brandname
            : `${editorType}-Designer`;

        document.title = title;

        // Dynamically set the document faviconicon
        // Check if a favicon already exists
        let faviconIcon = document.querySelector("link[rel='icon']");
        if (
          faviconIcon &&
          response.items &&
          response.items.editor_favicon_icon
        ) {
          // If it exists, update it; if not, create a new one
          faviconIcon.href = response.items.editor_favicon_icon;
        } else if (response.items && response.items.editor_favicon_icon) {
          faviconIcon = document.createElement("link");
          faviconIcon.rel = "icon";
          faviconIcon.href = response.items.editor_favicon_icon;
          document.head.appendChild(faviconIcon);
        }
      } else {
        const title = `${editorType}-Designer`;

        document.title = title;
      }
    } catch (error) { }
  };

  useEffect(() => {
    const initializeProject = async () => {
      try {
        // Read params from the router location AND the raw URL. Under HashRouter (desktop)
        // the auth query can live in the hash ("#/?u_id=...") or — after a full-reload
        // redirect — in the real ?search, so check every source before giving up.
        const getUrlParam = (name) => {
          const fromRouter = new URLSearchParams(location.search).get(name);
          if (fromRouter) return fromRouter;
          const fromSearch = new URLSearchParams(window.location.search).get(name);
          if (fromSearch) return fromSearch;
          const hash = window.location.hash || "";
          const qIndex = hash.indexOf("?");
          if (qIndex !== -1) {
            const fromHash = new URLSearchParams(hash.slice(qIndex)).get(name);
            if (fromHash) return fromHash;
          }
          return null;
        };
        const project_id = getUrlParam("c_id"); // cart order id
        let token = getUrlParam("u_id"); // token used for admin/customer login
        // Local snapshot restore (RootGate set restore=1) — only honor it when a
        // snapshot actually exists; otherwise fall through to normal bootstrap so
        // a stale restore flag can't strand the editor on the loader.
        const isRestore = getUrlParam("restore") === "1" && hasEditorSnapshot();

        // The editor state is hydrated entirely from localStorage by
        // useEditorSnapshot — offline, with NO server fetch. Skip the network
        // bootstrap here so it works without connectivity; the persisted
        // userDetails (from the prior session) remain valid. useEditorSnapshot
        // dispatches setProjectInitialized(true) once the snapshot is applied.
        if (isRestore) {
          // Hydrate the redux user from the persisted record (no network).
          try {
            const stored = JSON.parse(localStorage.getItem("userDetails") || "null");
            if (stored && stored._id) dispatch(setUserDetails(stored));
          } catch {
            /* ignore malformed userDetails */
          }
          setLoading(false);
          return;
        }

        // Fall back to a previously persisted session so a re-run with cleared URL params
        // (or a returning user) doesn't bounce a logged-in user back to the login page.
        if (!token) {
          try {
            const stored = JSON.parse(localStorage.getItem("userDetails") || "null");
            if (stored && stored.token) token = stored.token;
          } catch {
            /* ignore malformed userDetails */
          }
        }

        // Only redirect to login when there is genuinely no project and no session.
        if (!project_id && !token) {
          navigate("/login");
          return;
        }

        // setUp brand details
        if (project_id && !token) {
          await getBrandDetails({ project_id });
        }

        if (token) {
          try {
            await getUserDetails(token);
          } catch (userErr) {
            // Couldn't reach the server to re-validate the token (offline /
            // network down). Opening a DOWNLOADED theme must work with no
            // connectivity, so fall back to the session persisted from the last
            // online run instead of bouncing to "Session Expired" (same trust
            // model as the restore=1 path above — we can't re-verify a token
            // offline, and the user was validly logged in to download the
            // theme). Only do this for a NETWORK failure: a genuine auth
            // rejection (status 0 / 401) still propagates, and the axios
            // interceptor independently surfaces the modal for online 401s.
            let stored = null;
            try {
              stored = JSON.parse(localStorage.getItem("userDetails") || "null");
            } catch {
              /* ignore malformed userDetails */
            }
            const haveSession =
              stored &&
              stored._id &&
              (!stored.token || !token || stored.token === token);
            if (userErr?.networkFailure && haveSession) {
              dispatch(setUserDetails(stored));
            } else {
              throw userErr;
            }
          }
        }
        if (project_id) {
          // Prefer a LOCALLY-saved copy of this cart project over the server.
          // Customer saves are on-device only (Saved Designs library key
          // `cart:<id>`), and the single resume-snapshot slot only holds the
          // LAST-opened design — so a `c_id` reopen after the user opened a
          // DIFFERENT design would otherwise fall through to a STALE server copy
          // and silently drop the local edits. If a local copy exists, stage it
          // and re-enter through the offline restore pipeline (RootGate honours
          // `restore=1` → useEditorSnapshot rehydrates redux from the staged
          // snapshot and THIS hook stands down). First open (no local copy yet)
          // falls through to the normal server fetch below.
          // stageDesignForRestore writes the snapshot synchronously before it
          // resolves, so hasEditorSnapshot() is already true when the re-entry runs.
          let stagedLocal = false;
          try {
            // Look the customer's on-device copy up by the SAME account-scoped id
            // it was saved under (deriveDesignId prefixes `acct:<id>|`).
            stagedLocal = await stageDesignForRestore(
              deriveDesignId({ cartOrderId: project_id })
            );
          } catch (_) {
            stagedLocal = false;
          }
          if (stagedLocal) {
            // Guard against a stale loaded theme racing the restore (mirrors the
            // Design Selection "Go to Editor" flow).
            dispatch(resetThemeDetails());
            const params = new URLSearchParams();
            if (token) params.set("u_id", token);
            params.set("c_id", project_id);
            for (const key of ["cat", "size_w", "size_h", "size_dpi", "size_sm", "size_bm"]) {
              const v = getUrlParam(key);
              if (v != null && v !== "") params.set(key, v);
            }
            params.set("restore", "1");
            navigate(`/?${params.toString()}`, { replace: true });
            return;
          }
          await getProjectDetails(project_id, token);
        }

        dispatch(setProjectInitialized(true));

        // Remember this editor deep-link so reopening the app can resume straight
        // back into this design (RootGate). Only meaningful when an actual project
        // or theme is open — guard on t_id/c_id so we never "resume" an empty editor.
        // We store the editor params WITHOUT the auth token (re-attached at resume).
        const themeId = getUrlParam("t_id");
        if (themeId || project_id) {
          const params = new URLSearchParams();
          if (themeId) params.set("t_id", themeId);
          if (project_id) params.set("c_id", project_id);
          for (const key of ["size_w", "size_h", "size_dpi", "size_sm", "size_bm", "cat"]) {
            const v = getUrlParam(key);
            if (v != null && v !== "") params.set(key, v);
          }
          setLastOpenEditor(params.toString());
        }

        setLoading(false); // Mark loading as false after successful fetch
      } catch (err) {
        dispatch(setError(err.message)); // Dispatch error to Redux
        setErrorState(err.message); // Set local error state
        setLoading(false); // Mark loading as false even if there's an error
      }
    };

    // Only initialize if the URL parameters are available
    initializeProject();
  }, [location.search]);

  // Return loading state, error, and current project state
  return { loading, error, ...projectState };
};

export default useInitializeProject;
