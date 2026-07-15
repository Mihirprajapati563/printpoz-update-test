// src/hooks/useInitializeProject.js
import { act, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getMasksByIds } from "../services/mask/index.js";
import { v4 as uuidv4 } from "uuid";
import {
  createPrintPages,
  setCurrentObjectProperties,
  applyTheme,
  changeObjectsInAllPages,
  setPageNumber,
  setCalendarSettings,
  setSettings,
  setEditorType,
  setCanvasSize,
  setCanvasScale,
  deSelectSafeArea,
  setTextGroups,
  recordThemeBaseline,
} from "../../../store/slices/canvas.js";
import {
  getMaskIds,
  replaceMaskIdWithPath,
} from "../common-functions/index.js";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import { GetThemeById, processProjectPages } from "../services/theme/index.js";
import {
  setEditorPages,
  setThemeId,
  setAllThemes,
  setThemeName,
  setThemeApplied,
  setThemeSmartText,
} from "../../../store/slices/projectSetup.js";
import { EDITOR_TYPES, USER_TYPES } from "../constants/index.js";
import {
  getCanvasSize,
  getActiveEditorType,
  getOrientation,
  getSettings,
} from "../helpers/index.js";
import { blankImageUrls } from "../helpers/blankImages.js";
import { setThemeImagesBlanked } from "../../../store/slices/appAlice.js";
import { useLocation } from "react-router-dom";
/**
 * Custom hook to initialize project details based on URL parameters.
 */
const useSetupTheme = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState(null);
  const [isThemeApplied, setIsThemeApplied] = useState(false);
  const projectSetup = useSelector((state) => state.projectSetup);
  const canvasSize = useSelector(getCanvasSize);
  const activeEditorType = useSelector(getActiveEditorType);
  const activeOrientation = useSelector(getOrientation);
  const editorDetailsExist = useSelector(
    (state) => state.projectSetup.editorDetailsExist
  );
  const settings = useSelector(getSettings);
  const currentCanvasPages = useSelector((state) => state.canvas.present.pages);
  // Tracks the last theme ID that was successfully applied.
  // Used to detect genuine theme switches vs re-renders/re-fires of the same theme.
  const appliedThemeIdRef = useRef(null);
  // Tracks the last pages_c reference that was applied. When projectSetup changes for
  // reasons OTHER than themeDetails (e.g. setAllThemes), pages_c stays the same object
  // reference — we skip re-applying to avoid wiping canvas edits (e.g. spine shifts).
  const appliedPagesCRef = useRef(null);
  // On a snapshot restore we fetch the theme's size variants ONCE (for the size
  // switcher). This tracks the theme_id already fetched so the effect — which
  // re-fires on its OWN setAllThemes dispatch — doesn't call GetThemeById in a
  // loop. (Gating on allThemes.length <= 1 was NOT enough: a single-size design
  // stays at length 1, so the guard stayed true and the API was hit forever.)
  const restoredThemesFetchedRef = useRef(null);

  const setupTheme = async () => {
    // Capture initial-load status BEFORE replacePages runs (replacePages sets
    // appliedThemeIdRef). True initial load = no theme has been applied yet
    // this session. Used below to decide whether to restore saved-project shape.
    const isInitialLoad = appliedThemeIdRef.current === null;

    // Detect theme switch OR check if it was previously disabled for this project (persists across refresh)
    const projectId = projectSetup.project_id;
    const isSwitchedKey = projectId ? `smart_text_disabled_${projectId}` : null;

    // It's a switch if the ID changed OR if we remember a switch from a previous session (refresh)
    const isThemeSwitch = (appliedThemeIdRef.current &&
                          appliedThemeIdRef.current !== projectSetup.themeDetails?.theme_id) ||
                          (isSwitchedKey && localStorage.getItem(isSwitchedKey) === "true");

    // If it's a new switch, mark it as disabled in localStorage to survive refreshes
    if (isThemeSwitch && isSwitchedKey && appliedThemeIdRef.current) {
      localStorage.setItem(isSwitchedKey, "true");
    }

    let maskIds = [];
    if (projectSetup.themeDetails?.pages_c?.length > 0) {
      maskIds = getMaskIds(projectSetup.themeDetails.pages_c);
    }

    // Resolve mask paths then apply pages
    if (maskIds.length > 0) {
      const maskDetails = await getMasksByIds(maskIds);
      if (maskDetails?.length > 0) {
        replacePages(replaceMaskIdWithPath(projectSetup.themeDetails.pages_c, maskDetails));
      } else {
        replacePages(projectSetup.themeDetails.pages_c);
      }
    } else if (projectSetup.themeDetails?.pages_c?.length > 0) {
      replacePages(projectSetup.themeDetails.pages_c);
    }

    // ── Hydrate Smart Text groups from saved project/theme data ─────────────
    const savedSmartText = projectSetup.themeDetails?.smart_text;

    if (savedSmartText && Object.keys(savedSmartText).length > 0 && !isThemeSwitch) {
      dispatch(setTextGroups(savedSmartText));
    } else if (isThemeSwitch) {
      // Explicitly clear for theme switches to hide the Personalize button
      dispatch(setTextGroups({}));
    }

    // Restore circle/shape setting from the saved project on INITIAL load only.
    // projectSetup.themeDetails.settings is populated by setProjectDetails at init
    // and never refreshed on theme switch. Re-applying it on a theme switch would
    // override the NEW theme's size/shape (already dispatched by ThemesAction)
    // with the previous project's values — user-facing as "size not changing".
    if (isInitialLoad) {
      const savedSettings = projectSetup.themeDetails?.settings;
      if (savedSettings?.shape) {
        dispatch(setSettings({ shape: savedSettings.shape }));
        dispatch(setCanvasSize({
          ...canvasSize,
          shape: savedSettings.shape,
        }));
      }
    }

    // Immediately wipe Undo history and stamp a non-recorded baseline
    dispatch(UndoActionCreators.clearHistory());
    dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));
  };
  const getUserType = () => {
    const users = localStorage.getItem("userDetails");
    if (!users) {
      return null;
    }
    const userObj = JSON.parse(users);
    return userObj?.userTypeCode;
  };
  const replacePages = (pages) => {
    const userType = getUserType();

    // when editorDetailsExist means user already saved project, so we dont need to change image
    if (userType === USER_TYPES.CUSTOMER && !editorDetailsExist) {
      // Collect images the customer has already placed in this session (non-empty boxes).
      // On initial theme load the canvas is empty → list is empty → no images carried over (correct).
      // When switching themes the canvas has the customer's placed images → they get carried over.
      const existingImages = [];
      if (currentCanvasPages && currentCanvasPages.length > 0) {
        currentCanvasPages.forEach((page) => {
          page.layout.forEach((layout) => {
            if (!layout) return;
            layout.objects.forEach((obj) => {
              if (obj.type === "img" && obj.url && obj.url.trim() !== "") {
                const largeUrl = obj.urls?.find((u) => u.size === "large");
                if (!largeUrl?.url) return;
                const w = largeUrl?.w || obj.image?.originalWidth || obj.image?.width || 0;
                const h = largeUrl?.h || obj.image?.originalHeight || obj.image?.height || 0;
                const patchedUrls = obj.urls.map((u) =>
                  u.size === "large" ? { ...u, w: w || u.w, h: h || u.h } : u
                );
                existingImages.push({
                  urls: patchedUrls,
                  image_id: obj.image_id,
                  originalWidth: w,
                  originalHeight: h,
                });
              }
            });
          });
        });
      }

      // Clear theme-creator sample images from the new theme pages
      const clearPages = (sourcePages) => sourcePages.map((page) => ({
        ...page,
        layout: page.layout.map((layout) => {
          if (!layout) return layout;
          return {
            ...layout,
            objects: layout.objects.map((obj) =>
              obj.type === "img" && !obj.displaySameImage ? { ...obj, url: "", urls: [] } : obj
            ),
            safeAreaObjects: layout?.safeAreaObjects?.map((obj) =>
              obj.type === "img" && !obj.displaySameImage ? { ...obj, url: "", urls: [] } : obj
            ),
          };
        }),
      }));

      const newPages = clearPages(pages);

      dispatch(setCurrentObjectProperties(null));
      dispatch(applyTheme(newPages));
      if (activeEditorType === EDITOR_TYPES.PRINT) {
        dispatch(
          createPrintPages({
            pageDetails: newPages[0],
            pageCount:
              projectSetup &&
                projectSetup.cartDetails &&
                projectSetup.cartDetails.quantity &&
                projectSetup.cartDetails.quantity !== undefined &&
                projectSetup.cartDetails.quantity !== null &&
                projectSetup.cartDetails.quantity >= 0
                ? parseInt(projectSetup.cartDetails.quantity) - 1
                : 1,
          })
        );
      }
      if (
        (activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM) &&
        projectSetup &&
        projectSetup?.cartDetails &&
        projectSetup?.cartDetails?.multiplepaperarray &&
        projectSetup?.cartDetails?.multiplepaperarray.length > 0
      ) {
        let qty = projectSetup?.cartDetails?.multiplepaperarray.reduce(
          (acc, item) => acc + item.quantity,
          0
        );
        // pages will be less than qty / 2 filter pages
        if (
          activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
          qty / 2 < newPages.length - 3
        ) {
          let pages = [];
          // add front cover and pages == qty/2 and back cover
          pages.push(newPages[0]);

          // add first and last half page so condider it as one spread
          pages.push(newPages[1]);

          // add pages in between
          pages.push(...newPages.slice(2, qty / 2 + 1));
          pages.push(newPages[newPages.length - 2]);
          pages.push(newPages[newPages.length - 1]);
          dispatch(applyTheme(pages));
        }
        if (
          activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
          qty / 2 > newPages.length - 3
        ) {
          // extra required spred before back cover and last half page
          let pages = [];
          pages.push(...newPages.slice(0, newPages.length - 2));
          // new blank spread
          for (let i = 0; i < qty / 2 - newPages.length + 3; i++) {
            let randomIndex = Math.floor(Math.random() * (newPages.length - 4));
            let randomPage = newPages.slice(2, newPages.length - 2)[
              randomIndex
            ];
            pages.push(randomPage);
          }
          pages.push(newPages[newPages.length - 2]);
          pages.push(newPages[newPages.length - 1]);
          dispatch(applyTheme(pages));
        }

        if (
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
          !settings?.coverEnabled
        ) {
          if (qty / 2 < newPages.length) {
            let pages = newPages.slice(0, qty / 2);
            dispatch(applyTheme(pages));
          }
          if (qty / 2 > newPages.length) {
            let pages = [...newPages];
            // add extra pages
            for (let i = 0; i < qty / 2 - newPages.length; i++) {
              let randomIndex = Math.floor(
                Math.random() * (newPages.length - 2)
              );
              let randomPage = newPages[randomIndex];
              pages.push(randomPage);
            }
            dispatch(applyTheme(pages));
          }
        } else if (
          activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
          settings?.coverEnabled &&
          settings?.coverEnabled === true
        ) {
          if (!settings?.showFullCoverSheet) {
            if (qty / 2 < newPages.length - 2) {
              let pages = [];
              // add first cover
              pages.push(newPages[0]);

              // add remaining sheets
              pages.push(...newPages.slice(1, qty / 2 + 1));

              // add last cover
              pages.push(newPages[newPages.length - 1]);
              dispatch(applyTheme(pages));
            }
            if (qty / 2 > newPages.length - 2) {
              let pages = [];
              // add first cover and all sheets
              pages.push(...newPages.slice(0, newPages.length - 2));
              // add extra pages
              for (let i = 0; i < qty / 2 - newPages.length + 3; i++) {
                let randomIndex = Math.floor(
                  Math.random() * (newPages.length - 2)
                );
                // filter pages for random page except first and last cover
                let randomPage = newPages.filter(
                  (page) =>
                    page !== newPages[0] &&
                    page !== newPages[newPages.length - 1]
                )[randomIndex];
                pages.push(randomPage);
              }
              // add last cover
              pages.push(newPages[newPages.length - 1]);
              dispatch(applyTheme(pages));
            }
          }
          if (
            settings?.showFullCoverSheet &&
            settings?.showFullCoverSheet === true
          ) {
            if (qty / 2 < newPages.length - 1) {
              let pages = [];
              // add first cover
              pages.push(newPages[0]);

              // add remaining sheets
              pages.push(...newPages.slice(1, qty / 2 + 1));

              dispatch(applyTheme(pages));
            }

            if (qty / 2 > newPages.length - 1) {
              let pages = [];
              // add first cover and all sheets
              pages.push(...newPages.slice(0, newPages.length - 1));
              // add extra pages
              for (let i = 0; i < qty / 2 - newPages.length + 1; i++) {
                let randomIndex = Math.floor(
                  Math.random() * (newPages.length - 1)
                );
                let randomPage = newPages[randomIndex];
                pages.push(randomPage);
              }
              // add last cover
              pages.push(newPages[newPages.length - 1]);
              dispatch(applyTheme(pages));
            }
          }
        }
      }
      dispatch(deSelectSafeArea());
      dispatch(setPageNumber(0));
      // Refill empty boxes with the customer's previously placed images — same path as PhotosAction
      if (existingImages.length > 0) {
        dispatch(changeObjectsInAllPages({ images: [...existingImages], option: "option1" }));
      }
      appliedThemeIdRef.current = projectSetup.themeDetails?.theme_id;
    } else {
      // Saved project (editorDetailsExist) or admin/employee.
      // For customers: detect a genuine theme switch via the ref — carry images over.
      // For admin/employee or initial load (same theme ID): apply pages as-is.
      const newThemeId = projectSetup.themeDetails?.theme_id;
      const isThemeSwitch =
        userType === USER_TYPES.CUSTOMER &&
        appliedThemeIdRef.current !== null &&
        appliedThemeIdRef.current !== newThemeId;

      if (isThemeSwitch) {
        // Customer switched themes on a saved project — collect their images and carry over
        const existingImages = [];
        if (currentCanvasPages && currentCanvasPages.length > 0) {
          currentCanvasPages.forEach((page) => {
            page.layout.forEach((layout) => {
              if (!layout) return;
              layout.objects.forEach((obj) => {
                if (obj.type === "img" && obj.url && obj.url.trim() !== "") {
                  const largeUrl = obj.urls?.find((u) => u.size === "large");
                  if (!largeUrl?.url) return;
                  const w = largeUrl?.w || obj.image?.originalWidth || obj.image?.width || 0;
                  const h = largeUrl?.h || obj.image?.originalHeight || obj.image?.height || 0;
                  const patchedUrls = obj.urls.map((u) =>
                    u.size === "large" ? { ...u, w: w || u.w, h: h || u.h } : u
                  );
                  existingImages.push({
                    urls: patchedUrls,
                    image_id: obj.image_id,
                    originalWidth: w,
                    originalHeight: h,
                  });
                }
              });
            });
          });
        }
        const clearPages = (sourcePages) => sourcePages.map((page) => ({
          ...page,
          layout: page.layout.map((layout) => {
            if (!layout) return layout;
            return {
              ...layout,
              objects: layout.objects.map((obj) =>
                obj.type === "img" && !obj.displaySameImage ? { ...obj, url: "", urls: [] } : obj
              ),
              safeAreaObjects: layout?.safeAreaObjects?.map((obj) =>
                obj.type === "img" && !obj.displaySameImage ? { ...obj, url: "", urls: [] } : obj
              ),
            };
          }),
        }));
        dispatch(setCurrentObjectProperties(null));
        dispatch(applyTheme(clearPages(pages)));
        dispatch(deSelectSafeArea());
        dispatch(setPageNumber(0));
        if (existingImages.length > 0) {
          dispatch(changeObjectsInAllPages({ images: [...existingImages], option: "option1" }));
        }
      } else {
        // Initial load or admin/employee — apply pages exactly as saved.
        dispatch(setCurrentObjectProperties(null));
        dispatch(applyTheme(pages));
        dispatch(deSelectSafeArea());
        dispatch(setPageNumber(0));
      }
      appliedThemeIdRef.current = newThemeId;
    }
  };
  // Local snapshot restore: useEditorSnapshot hydrates canvas pages directly
  // from localStorage (offline). When restore=1 is present we must NOT run the
  // server-fetch theme bootstrap below — it would issue a network call (failing
  // offline) and could clobber the restored pages.
  const isSnapshotRestore = () =>
    new URLSearchParams(location.search).get("restore") === "1";

  useEffect(() => {
    if (isSnapshotRestore()) {
      const fetchRestoredTheme = async () => {
        const urlParams = new URLSearchParams(location.search);
        const theme_id = projectSetup?.cartDetails?.theme_id || projectSetup?.themeDetails?.theme_id || urlParams.get("t_id");
        // Fetch the size variants at most ONCE per theme. Latch on the ref (set
        // BEFORE the await) so the setAllThemes dispatch below — which re-runs this
        // [projectSetup] effect — can't re-enter and call GetThemeById in a loop.
        // Still skip entirely when the sizes are already present (length > 1).
        if (
          theme_id &&
          restoredThemesFetchedRef.current !== theme_id &&
          (!projectSetup.allThemes || projectSetup.allThemes.length <= 1)
        ) {
          restoredThemesFetchedRef.current = theme_id;
          try {
            const themeData = await GetThemeById(
              theme_id,
              canvasSize,
              activeEditorType,
              activeOrientation
            );
            if (themeData?.theme) {
              const normalizedThemes = themeData.theme.map((theme) => ({
                ...theme,
                safeMargin: Number(theme.safeMargin ?? theme.safe_margin) || 0,
                bleedMargin: Number(theme.bleedMargin ?? theme.bleed_margin) || 0,
              }));
              dispatch(setAllThemes(normalizedThemes));
            }
          } catch (err) {
          }
        }
      };
      fetchRestoredTheme();
      return;
    }
    const initializeTheme = async () => {
      try {
        if (!projectSetup.themeDetails) {
          return;
        }
        // make sure cart details is not empty object
        if (
          !projectSetup.cartDetails ||
          Object.keys(projectSetup.cartDetails).length === 0
        ) {
          return;
        }
        if (
          projectSetup.themeDetails &&
          projectSetup.themeDetails.theme_id &&
          projectSetup.themeDetails.pages_c
        ) {
          // Skip re-applying if pages_c reference is unchanged — projectSetup changed
          // for an unrelated reason (e.g. setAllThemes), not because theme pages changed.
          // This prevents wiping canvas edits (like spine object shifts) on every allThemes update.
          if (appliedPagesCRef.current === projectSetup.themeDetails.pages_c) {
            return;
          }
          appliedPagesCRef.current = projectSetup.themeDetails.pages_c;
          await setupTheme();
          setLoading(false);
          setIsThemeApplied(true);
          dispatch(setThemeApplied(true));
        } else {
          // when project run first time, there is no theme data available, so we need to get theme data by theme id
          const theme_id = projectSetup.cartDetails.theme_id;
          if (!theme_id) {
            // No theme — still mark as applied so footer/canvas don't stay in skeleton
            dispatch(setThemeApplied(true));
            return;
            //throw new Error('Missing required parameters: theme_id ');
          }
          const themeData = await GetThemeById(
            theme_id,
            canvasSize,
            activeEditorType,
            activeOrientation
          );
          // const themeData = await GetSampleTheme(theme_id);
          if (themeData) {
            dispatch(setThemeId(theme_id));

            if (activeEditorType === EDITOR_TYPES.PRINT) {
              let firstPage = themeData.pages_c[0];
              //  dispatch(createPrintPages({pageDetails:firstPage,pageCount:2}));
            }

            if (themeData.theme[0].cal_settings) {
              let calSettings = { ...themeData.theme[0].cal_settings };
              if (themeData.theme[0].cal_settings.startMonth) {
                calSettings.startMonth = null;
              }
              if (themeData.theme[0].cal_settings.startYear) {
                calSettings.startYear = null;
              }
              if (calSettings.weeksColumns == null) {
                const pages = Array.isArray(themeData.pages_c) ? themeData.pages_c : [];
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
            }
            dispatch(setSettings(themeData.theme[0].settings));
            //  setupTheme();

            // set new size of canvas  only if user is customer
            const user = JSON.parse(localStorage.getItem("userDetails"));
            if (
              themeData?.theme[0]?.width &&
              themeData?.theme[0]?.height &&
              (activeEditorType === EDITOR_TYPES.CANVAS ||
                activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT) &&
              user &&
              user?.userTypeCode === USER_TYPES.CUSTOMER
            ) {
              dispatch(
                setCanvasSize({
                  width:
                    parseFloat(themeData?.theme[0]?.width) || canvasSize?.width,
                  height:
                    parseFloat(themeData?.theme[0]?.height) ||
                    canvasSize?.height,
                  depth:
                    parseFloat(themeData?.theme[0]?.depth) || canvasSize?.depth,
                  safeMargin:
                    parseFloat(themeData?.theme[0]?.safe_margin) || canvasSize?.safeMargin,
                  bleedMargin:
                    parseFloat(themeData?.theme[0]?.bleed_margin) || canvasSize?.bleedMargin,
                  dpi: parseInt(themeData?.theme[0]?.dpi, 10) || canvasSize?.dpi,
                  shape: themeData?.theme[0]?.settings?.shape || themeData?.theme[0]?.shape || "rectangle",
                })
              );
            }
            // Scale pages and set canvas size from theme dimensions
            const firstTheme = themeData.theme[0];
            const themeWidth = parseFloat(firstTheme.width) || canvasSize?.width;
            const themeHeight = parseFloat(firstTheme.height) || canvasSize?.height;
            const themeDepth = parseFloat(firstTheme.depth) || canvasSize?.depth;

            // For non-CANVAS/CUSTOME_PRODUCT editor types (e.g. PHOTOBOOK, LAYFLATALBUM),
            // always set canvas size from theme dimensions regardless of user type
            if (
              activeEditorType !== EDITOR_TYPES.CANVAS &&
              activeEditorType !== EDITOR_TYPES.CUSTOME_PRODUCT &&
              firstTheme.width &&
              firstTheme.height
            ) {
              // Only update margins if not already handled by the CANVAS/CUSTOME_PRODUCT block above
              if (
                activeEditorType !== EDITOR_TYPES.CANVAS &&
                activeEditorType !== EDITOR_TYPES.CUSTOME_PRODUCT
              ) {
                dispatch(
                  setCanvasSize({
                    ...canvasSize,  // Keep existing width, height, depth
                    safeMargin: parseFloat(themeData?.theme[0]?.safe_margin) || 0,
                    bleedMargin: parseFloat(themeData?.theme[0]?.bleed_margin) || 0,
                    dpi: parseInt(themeData?.theme[0]?.dpi, 10) || canvasSize?.dpi,
                  })
                );
              }
              dispatch(
                setCanvasSize({
                  width: themeWidth,
                  height: themeHeight,
                  depth: themeDepth,
                  safeMargin: parseFloat(firstTheme.safe_margin) || canvasSize?.safeMargin,
                  bleedMargin: parseFloat(firstTheme.bleed_margin) || canvasSize?.bleedMargin,
                  dpi: parseInt(themeData?.theme[0]?.dpi, 10) || canvasSize?.dpi,
                  shape: firstTheme.settings?.shape || firstTheme.shape || canvasSize?.shape || "rectangle",
                })
              );
            }

            // Scale pages from raw compressed data — same approach as admin/size dialog
            let layoutWidth = themeWidth;
            if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
              layoutWidth /= 2;
            }
            const scaledPages = processProjectPages(firstTheme.pages_c, layoutWidth, themeHeight);
            dispatch(setEditorPages(scaledPages));

            // Store smart_text on themeDetails so setupTheme() can dispatch
            // setTextGroups AFTER applyTheme() has loaded canvas pages.
            // (Dispatching setTextGroups here would be too early — canvas.pages
            //  is still empty, so the objectId-based re-linking would find nothing.)
            if (firstTheme.smart_text && Object.keys(firstTheme.smart_text).length > 0) {
              dispatch(setThemeSmartText(firstTheme.smart_text));
            }

            // Store all theme sizes for size management
            const normalizedThemes = themeData.theme.map((theme) => ({
              ...theme,
              safeMargin: Number(theme.safeMargin ?? theme.safe_margin) || 0,
              bleedMargin: Number(theme.bleedMargin ?? theme.bleed_margin) || 0,
            }));
            dispatch(setAllThemes(normalizedThemes));

            setLoading(false);
            setIsThemeApplied(true);
            dispatch(setThemeApplied(true));
          } else {
            //throw new Error('Error fetching theme details');
          }
        }
      } catch (err) {
        setErrorState(err.message); // Set local error state
        setLoading(false); // Mark loading as false even if there's an error
        setIsThemeApplied(false);
      }
    };

    // Only initialize if the URL parameters are available
    initializeTheme();
  }, [projectSetup]);

  useEffect(() => {
    if (isSnapshotRestore()) return;
    const initTheme = async () => {
      try {
        // Get cart order id
        const urlParams = new URLSearchParams(location.search);

        const token = urlParams.get("u_id"); // get token  as this used for admin to create
        const theme_id = urlParams.get("t_id"); // get token  as this used for admin to create

        // if project_id or token is missing then return
        if (!theme_id && !token) {
          return;
        }

        // Optional size override + blank-images flag (from the Design Selection
        // size modal). When `size_w`/`size_h` are present, resize the theme to the
        // chosen size; when `blank_img=1`, clear existing image URLs so they load
        // as blank placeholders. Absent → unchanged legacy behavior (web deep-link).
        const sizeW = urlParams.get("size_w");
        const sizeH = urlParams.get("size_h");
        const sizeOverride =
          sizeW && sizeH
            ? {
                width: parseFloat(sizeW),
                height: parseFloat(sizeH),
                dpi: urlParams.get("size_dpi") ? parseInt(urlParams.get("size_dpi"), 10) : null,
                safeMargin: urlParams.get("size_sm") != null ? parseFloat(urlParams.get("size_sm")) : null,
                bleedMargin: urlParams.get("size_bm") != null ? parseFloat(urlParams.get("size_bm")) : null,
                label: urlParams.get("size_label") || null,
                blankImages: urlParams.get("blank_img") === "1",
              }
            : urlParams.get("blank_img") === "1"
              ? { blankImages: true }
              : null;

        // Optional project name from the Design Selection "Choose a size" modal.
        // It becomes the design's display name (setThemeName below), which the
        // Saved Designs library persists and shows in "Your Designs".
        const projName = urlParams.get("proj_name");

        // When a theme is opened from Design Selection the user has ALREADY picked
        // a specific size (size_w/size_h), and setupThemeFromURL selects that size
        // from the theme's variants. GetThemeById, for a CUSTOMER, otherwise narrows
        // the request to the CURRENT canvas size — which at this point is still the
        // leftover editor default (e.g. 2400×1200), NOT this theme's size. That size
        // matches none of the theme's variants, so the API returns an empty variant
        // list, GetThemeById resolves to null, and the theme is never applied (the
        // editor is left on the blank reset pages — the reported "opens but doesn't
        // load the theme" across every category). Fetch the FULL variant set with no
        // size filter — exactly like the size modal's own GetThemeById({}) call — so
        // every size (including the chosen one) is present and setupThemeFromURL can
        // apply it. Legacy deep-links (no chosen size) keep the size-scoped fetch.
        const hasChosenSize = !!(sizeW && sizeH);
        const themeData = await GetThemeById(
          theme_id,
          hasChosenSize ? {} : canvasSize,
          activeEditorType,
          activeOrientation
        );

        if (themeData) {
          //when load theme using theme id in url.
          setupThemeFromURL(themeData, theme_id, sizeOverride, projName);
          setLoading(false);
          setIsThemeApplied(true);
          dispatch(setThemeApplied(true));
        } else {
          // No theme data (e.g. admin with u_id but no t_id) — still clear skeleton
          dispatch(setThemeApplied(true));
        }
      } catch (err) {
        // On error still clear skeleton so editor isn't stuck
        dispatch(setThemeApplied(true));
      }
    };

    initTheme();
  }, [location.search]);

  const setupThemeFromURL = (themeData, themeid, sizeOverride = null, projName = null) => {
    if (!themeData && !themeData.pages_c) {
      return;
    }
    dispatch(setCalendarSettings(null));

    const sizeToCheck = `${canvasSize.width}x${canvasSize.height}`;
    const sizeExist = themeData.theme.find((item) => item.size === sizeToCheck);
    if (sizeExist) {
      dispatch(
        setCanvasSize({
          width: parseFloat(sizeExist.width),
          height: parseFloat(sizeExist.height),
          depth: parseFloat(sizeExist.depth),
          safeMargin: parseFloat(sizeExist.safe_margin),
          bleedMargin: parseFloat(sizeExist.bleed_margin),
          dpi: parseInt(sizeExist.dpi, 10) || canvasSize?.dpi,
          shape: sizeExist.settings?.shape || sizeExist.shape || "rectangle",
        })
      );
    }

    const normalizedThemes = themeData.theme.map((theme) => ({
      ...theme,
      safeMargin: Number(theme.safeMargin ?? theme.safe_margin) || 0,
      bleedMargin: Number(theme.bleedMargin ?? theme.bleed_margin) || 0,
    }));

    dispatch(setAllThemes(normalizedThemes));

    dispatch(setEditorType(themeData.editor_type));

    if (themeData.theme[0].cal_settings) {
      // lets remove month and year from calendar settings
      // create clone of cal_settings
      let calSettings = { ...themeData.theme[0].cal_settings };
      if (themeData.theme[0].cal_settings.startMonth) {
        calSettings.startMonth = null;
      }
      if (themeData.theme[0].cal_settings.startYear) {
        calSettings.startYear = null;
      }
      if (calSettings.weeksColumns == null) {
        const pages = Array.isArray(themeData.pages_c) ? themeData.pages_c : [];
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
    }
    dispatch(setSettings(themeData.theme[0].settings));
    dispatch(setThemeId(themeid));
    // A user-supplied project name (from the size modal) wins over the theme's own
    // name, so "Your Designs" shows what the user typed. Falls back to the theme
    // name for legacy deep-links / admins who leave the field blank.
    dispatch(setThemeName(projName || themeData.name));

    // Pick the variant to source pages from and the TARGET dimensions. When a
    // size override is supplied (Design Selection size modal), prefer the variant
    // whose stored size matches the chosen size as the pages source (best fidelity),
    // else fall back to theme[0], and use the chosen dimensions/margins/dpi as the
    // target — processProjectPages then scales the theme to that size. Without an
    // override this is the legacy behavior (theme[0] at its native size).
    const hasSizeOverride = !!(sizeOverride && sizeOverride.width && sizeOverride.height);
    let theme = themeData.theme[0];
    let targetWidth;
    let targetHeight;
    let targetDepth;
    let targetSafe;
    let targetBleed;
    let targetDpi;
    let targetShape;

    if (hasSizeOverride) {
      const sizeKey = `${sizeOverride.width}x${sizeOverride.height}`;
      theme = themeData.theme.find((v) => v.size === sizeKey) || themeData.theme[0];
      targetWidth = sizeOverride.width;
      targetHeight = sizeOverride.height;
      targetDepth = parseFloat(theme.depth) || 0;
      targetSafe = sizeOverride.safeMargin != null ? sizeOverride.safeMargin : parseFloat(theme.safe_margin) || 0;
      targetBleed = sizeOverride.bleedMargin != null ? sizeOverride.bleedMargin : parseFloat(theme.bleed_margin) || 0;
      targetDpi = sizeOverride.dpi || parseInt(theme.dpi, 10) || canvasSize?.dpi;
      targetShape = theme.settings?.shape || theme.shape || "rectangle";
    } else {
      targetWidth = parseFloat(theme.width);
      targetHeight = parseFloat(theme.height);
      targetDepth = parseFloat(theme.depth);
      targetSafe = parseFloat(theme.safe_margin);
      targetBleed = parseFloat(theme.bleed_margin);
      targetDpi = parseInt(theme.dpi, 10) || canvasSize?.dpi;
      targetShape = theme.settings?.shape || theme.shape || "rectangle";
    }

    // Photobook layouts are stored per-page (half the spread); LAYFLATALBUM saves
    // at full canvasSize.width, so no halving needed there.
    let layoutWidth = targetWidth;
    if (themeData.editor_type === EDITOR_TYPES.PHOTOBOOK) {
      layoutWidth = targetWidth / 2;
    }

    // No setTimeout needed here: this is the URL/admin initial-load path where
    // isThemeApplied flips false→true right after this function returns.
    // Canvas.jsx:1597 fires updateCanvasSize IMMEDIATELY on that flip (no debounce),
    // so the viewport adjusts to the new canvasSize before pages render.
    // (The 500ms debounced effect at Canvas.jsx:1603 still runs as a second pass.)
    dispatch(
      setCanvasSize({
        width: targetWidth,
        height: targetHeight,
        depth: targetDepth,
        safeMargin: targetSafe,
        bleedMargin: targetBleed,
        dpi: parseInt(targetDpi, 10) || canvasSize?.dpi,
        shape: targetShape,
        // The exact size label the user picked (Design Selection size modal), so
        // the Saved Designs card shows the same size. Only set on the override
        // path; a legacy deep-link has no chosen label → card derives from dims.
        ...(hasSizeOverride && sizeOverride.label
          ? { sizeLabel: sizeOverride.label }
          : {}),
      })
    );

    let pages = processProjectPages(theme.pages_c, layoutWidth, targetHeight);
    // Replace populated image objects with blank placeholders when requested, and
    // record that this theme is in "blanked" mode so a later in-editor size change
    // (SizeSettingsPopup) keeps the images blank instead of restoring the originals.
    if (sizeOverride?.blankImages) {
      pages = blankImageUrls(pages);
      dispatch(setThemeImagesBlanked(true));
    } else {
      dispatch(setThemeImagesBlanked(false));
    }
    dispatch(setEditorPages(pages));

    // Store smart_text on themeDetails so setupTheme() can dispatch
    // setTextGroups AFTER applyTheme() loads canvas pages (correct timing).
    if (theme.smart_text && Object.keys(theme.smart_text).length > 0) {
      dispatch(setThemeSmartText(theme.smart_text));
    }

    // Wipe the Undo history so that the user cannot accidentally "Undo" the entire theme initialization!
    dispatch(UndoActionCreators.clearHistory());
    dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));
  };

  // Return loading state, error, and current project state
  return { loading, error, isThemeApplied };
};

export default useSetupTheme;
