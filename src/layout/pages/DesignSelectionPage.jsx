import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaThLarge,
  FaRegImage,
  FaTrashAlt,
  FaFolderOpen,
  FaCloudDownloadAlt,
  FaRulerCombined,
  FaSearch,
  FaTimes,
  FaSignOutAlt,
  FaArrowLeft,
} from "react-icons/fa";
import { setUserDetails, resetThemeDetails, resetProject } from "../../store/slices/projectSetup";
import { setEditorType, resetEditor } from "../../store/slices/canvas";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import { GetThemeById } from "../../library/utils/services/theme";
import {
  downloadThemeForOffline,
  isThemeDownloadSupported,
} from "../../library/utils/services/theme/downloadTheme";
import {
  listThemePacks,
  deleteThemePack,
} from "../../library/utils/helpers/themePacks";
import { isOnline } from "../../library/utils/helpers/assetsCache";
import {
  getSessionToken,
  getUrlParam,
  readStoredUser,
  resolveUserFromToken,
  clearLastOpenEditor,
  clearStoredUser,
  isAdminLike,
} from "../../library/utils/helpers/session";
import { clearEditorSnapshot } from "../../library/utils/helpers/editorSnapshot";
import { initCustomSizes } from "../../library/utils/helpers/customSizes";
import {
  listSavedDesigns,
  removeSavedDesign,
  stageDesignForRestore,
} from "../../library/utils/helpers/savedDesigns";
import { regenerateStaleThumbnails } from "../../library/utils/helpers/regenerateThumbnails";
import { EDITOR_CATEGORIES, EDITOR_TYPES, USER_TYPES } from "../../library/utils/constants";
import { LoadingState, ErrorState, Spinner } from "../../common-components/StateViews";
import DesignThumbnail from "../../common-components/DesignThumbnail";
import {
  CategoryGrid,
  ThemeBrowser,
  ThemeSizeModal,
  ThemeDownloadToast,
  CreateNewDesignModal,
  Page,
  AppBar,
  Brand,
  BrandMark,
  BrandName,
  AppBarActions,
  Hero,
  HeroTop,
  Breadcrumb,
  CrumbButton,
  CrumbCurrent,
  Heading,
  SubHeading,
  ThemeSearch,
  ThemeSearchInput,
  ThemeSearchClear,
  PrimaryButton,
  GhostButton,
  Workspace,
  Sidebar,
  SidebarHeader,
  SidebarSectionTitle,
  SidebarCount,
  SidebarMeta,
  SidebarBody,
  SidebarTabs,
  SidebarTab,
  SidebarTabText,
  Content,
  SavedList,
  SavedRow,
  SavedThumb,
  SavedInfo,
  SavedDeleteBtn,
  SavedConfirm,
  SavedEmpty,
} from "../../components/design-selection";

// Delay between the last keystroke and firing the theme search, so typing a term
// doesn't hit the API on every character.
const SEARCH_DEBOUNCE_MS = 350;

// ── helpers ─────────────────────────────────────────────────────────────────
const labelForType = (type) =>
  EDITOR_CATEGORIES.find((c) => c.type === type)?.label || "Design";

const relativeTime = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (_) {
    return "";
  }
};

const DesignSelectionPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [initializing, setInitializing] = useState(true);

  const [loadingThemeId, setLoadingThemeId] = useState(null);

  // Saved-designs (left sidebar) state.
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [openingId, setOpeningId] = useState(null); // guards the async stage step

  // Left sidebar segmented tab: "designs" (saved) | "offline" (downloaded packs).
  const [sidebarTab, setSidebarTab] = useState("designs");

  // Size modal: the theme being opened + its fetched size variants.
  const [sizeModalTheme, setSizeModalTheme] = useState(null);
  const [showCreateNewModal, setShowCreateNewModal] = useState(false);
  // "random" when the Create modal is opened from the "Blank" card (pre-enables
  // the random-layout section); null for the normal New Theme / New Design flow.
  const [createMode, setCreateMode] = useState(null);
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState("");
  const sizeFetchForRef = useRef(null); // guards against stale variant fetches

  const handleLogout = useCallback(() => {
    // Clear the active session from localStorage AND the durable keychain so the
    // next launch lands on Login. The remembered-email list is intentionally
    // preserved (clearStoredUser does not touch it) so the user can pick their
    // account and just re-enter the password.
    clearStoredUser();
    dispatch(setUserDetails(null));
    dispatch(resetProject());
    dispatch(resetEditor());
    navigate("/login");
  }, [dispatch, navigate]);

  // ── Offline theme downloads (desktop only) ──────────────────────────────────
  const downloadSupported = useMemo(() => isThemeDownloadSupported(), []);
  const [themePacks, setThemePacks] = useState([]); // downloaded packs (sidebar)
  const [downloadedIds, setDownloadedIds] = useState(() => new Set());
  // Subset of downloadedIds whose download was interrupted — offered as "Resume".
  const [partialIds, setPartialIds] = useState(() => new Set());
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadState, setDownloadState] = useState(null); // toast model | null
  const [packConfirmId, setPackConfirmId] = useState(null); // delete confirm
  const downloadAbortRef = useRef(null);
  const toastHideRef = useRef(null);
  // The theme whose download was interrupted in THIS session, so reconnecting
  // can pick it back up. Scoped to the session on purpose: auto-starting every
  // partial pack on disk would mean surprise traffic on a metered connection.
  const resumeTargetRef = useRef(null);

  const token = useMemo(() => getSessionToken(location.search), [location.search]);

  // Restore the category the user was browsing (e.g. when returning via the
  // editor's Back button, which forwards a `cat` param) so we land back on the
  // theme-browse view instead of the top-level category grid. Read once on mount.
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const catType = getUrlParam(location.search, "cat");
    return EDITOR_CATEGORIES.find((c) => c.type === catType) || null;
  });

  // ── Theme search (rendered inline with the breadcrumb) ──────────────────────
  // `searchInput` is what the user is typing; `themeSearch` is the committed
  // (debounced) term handed to ThemeBrowser, which forwards it into the getThemes
  // payload. It lives here (not in ThemeBrowser) so the box can sit on the same
  // row as the "All categories" breadcrumb.
  const [searchInput, setSearchInput] = useState("");
  const [themeSearch, setThemeSearch] = useState("");

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === themeSearch) return; // already committed (e.g. via Enter/clear)
    const t = setTimeout(() => setThemeSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, themeSearch]);

  const clearThemeSearch = useCallback(() => {
    setSearchInput("");
    setThemeSearch(""); // commit now so clearing doesn't wait out the debounce
  }, []);

  // Reset the search whenever the browsed category changes (or we return to the
  // category grid) so a term never carries across categories.
  useEffect(() => {
    setSearchInput("");
    setThemeSearch("");
  }, [selectedCategory?.type]);

  // ── Step 0: ensure user data is saved correctly before showing anything ─────
  useEffect(() => {
    let cancelled = false;

    const ensureUser = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      // Reaching Design Selection means the user has left any open editor. Forget
      // the remembered editor AND the local working-state snapshot so the NEXT
      // plain app open lands here (resume only fires while a design is genuinely
      // in progress), per the entry-routing rules.
      clearLastOpenEditor();
      clearEditorSnapshot();

      // Pre-load custom sizes from AppData on desktop so they're available
      // synchronously when the size-picker modal opens (no-op on web).
      initCustomSizes().catch(() => {});

      const stored = readStoredUser();
      // Already have a complete record for this token — reuse it.
      if (stored && stored._id && stored.token === token) {
        if (!cancelled) {
          setUser(stored);
          setInitializing(false);
          dispatch(setUserDetails(stored));
        }
        return;
      }

      // Otherwise resolve the full record from the token (gives us _id,
      // userTypeCode, brand_id …) and persist it — same contract the editor
      // bootstrap (useInitializeProject) relies on.
      try {
        const fullUser = await resolveUserFromToken(token, stored);
        if (cancelled) return;
        if (fullUser) {
          dispatch(setUserDetails(fullUser));
          setUser(fullUser);
          setInitializing(false);
        } else if (stored && stored.token === token) {
          // Token fetch failed but we still have the login record — proceed with it.
          setUser(stored);
          setInitializing(false);
        } else {
          throw new Error("Could not verify your session.");
        }
      } catch (_) {
        if (!cancelled) {
          setAuthError("We couldn't verify your session. Please sign in again.");
          setInitializing(false);
        }
      }
    };

    ensureUser();
    return () => {
      cancelled = true;
    };
  }, [token, dispatch, navigate]);

  // ── Saved designs library (left sidebar) ────────────────────────────────────
  // The library is async (IndexedDB-backed). `aliveRef` guards against setting
  // state after unmount if a read resolves late.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Keyed on the account id so the list re-fetches (now correctly scoped) the
  // moment token enrichment resolves the logged-in user — see listSavedDesigns.
  const refreshDesigns = useCallback(async () => {
    try {
      const list = await listSavedDesigns();
      if (aliveRef.current) setDesigns(list);
    } catch (_) {
      if (aliveRef.current) setDesigns([]);
    } finally {
      if (aliveRef.current) setDesignsLoading(false);
    }
  }, [user?._id]);

  // Refresh on mount AND whenever the window/tab regains focus or becomes
  // visible. Returning from the editor (Back button) remounts this page, so the
  // mount refresh covers that — but listSavedDesigns also awaits the editor's
  // in-flight save (flushSavedDesigns) so a design saved on unmount is included.
  // The focus/visibility listeners cover the case where the user switches away
  // and back, or any other app-level return.
  useEffect(() => {
    refreshDesigns();
    const onFocus = () => refreshDesigns();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshDesigns();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshDesigns]);

  const handleDeleteDesign = async (id) => {
    setConfirmId(null);
    await removeSavedDesign(id);
    refreshDesigns();
  };

  // One-time (per account) background pass to refresh thumbnails saved by an
  // older generator — e.g. calendars that used to render as a placeholder now
  // render a real grid. Runs after the initial list is shown so cards appear
  // immediately, preserves each card's name/date/order, and re-lists only if
  // something changed. Guarded so it never runs twice in a session.
  const regenStartedRef = useRef(false);
  useEffect(() => {
    if (regenStartedRef.current) return;
    if (!user?._id || designsLoading) return; // wait for the account + first load
    regenStartedRef.current = true;
    (async () => {
      const updated = await regenerateStaleThumbnails({ accountId: user._id });
      if (updated > 0 && aliveRef.current) refreshDesigns();
    })();
  }, [user?._id, designsLoading, refreshDesigns]);

  // ── Downloaded theme packs (offline library) ────────────────────────────────
  const refreshDownloaded = useCallback(async () => {
    if (!downloadSupported) return;
    try {
      const list = await listThemePacks();
      if (!aliveRef.current) return;
      setThemePacks(list);
      setDownloadedIds(new Set(list.map((p) => p.themeId)));
      // `=== false`, never `!p.complete`: packs downloaded before this flag
      // existed have `complete: undefined`, and treating those as partial would
      // put every already-installed theme behind a Resume button on upgrade.
      setPartialIds(
        new Set(list.filter((p) => p.complete === false).map((p) => p.themeId)),
      );
    } catch (_) {
      /* leave the previous list in place on a transient read error */
    }
    // Re-scope to the logged-in account once enrichment resolves it.
  }, [downloadSupported, user?._id]);

  useEffect(() => {
    refreshDownloaded();
  }, [refreshDownloaded]);

  // Clear any pending toast-hide timer / in-flight download on unmount.
  useEffect(
    () => () => {
      if (toastHideRef.current) clearTimeout(toastHideRef.current);
      if (downloadAbortRef.current) downloadAbortRef.current.abort();
    },
    [],
  );

  const scheduleToastHide = useCallback((ms = 4500) => {
    if (toastHideRef.current) clearTimeout(toastHideRef.current);
    toastHideRef.current = setTimeout(() => {
      if (aliveRef.current) setDownloadState(null);
    }, ms);
  }, []);

  const handleDownloadTheme = useCallback(
    async (theme) => {
      if (!downloadSupported || !theme?._id || downloadingId) return;
      if (toastHideRef.current) clearTimeout(toastHideRef.current);
      setDownloadingId(theme._id);
      setDownloadState({
        name: theme.name,
        total: 0,
        done: 0,
        failed: 0,
        bytes: 0,
        status: "downloading",
      });
      const controller = new AbortController();
      downloadAbortRef.current = controller;
      try {
        const result = await downloadThemeForOffline(theme, {
          signal: controller.signal,
          onProgress: (p) => {
            if (aliveRef.current) setDownloadState({ ...p, status: "downloading" });
          },
        });
        // Ownership is claimed inside the orchestrator now — it also has to
        // happen on the abort path, which runs after this page is gone.
        // Remember an unfinished pack so reconnecting can pick it back up;
        // clear it once the theme is fully in.
        resumeTargetRef.current = result.complete ? null : theme;
        if (!aliveRef.current) return;
        setDownloadState({
          name: theme.name,
          total: result.total,
          done: result.done,
          failed: result.failed,
          missing: result.missing,
          bytes: result.bytes,
          status: "done",
        });
        await refreshDownloaded();
        // Leave an incomplete result up longer — it carries an action.
        scheduleToastHide(result.complete ? 4500 : 8000);
      } catch (err) {
        // Interrupted, not lost: the orchestrator has checkpointed whatever it
        // downloaded, so this theme can resume later.
        resumeTargetRef.current = theme;
        if (!aliveRef.current) return;
        if (err?.name === "AbortError") {
          setDownloadState(null);
          refreshDownloaded(); // surface the freshly-checkpointed partial
        } else {
          setDownloadState((s) => ({
            ...(s || { name: theme.name }),
            status: "error",
            error: String(err?.message || err),
          }));
          refreshDownloaded();
          scheduleToastHide(8000);
        }
      } finally {
        downloadAbortRef.current = null;
        if (aliveRef.current) setDownloadingId(null);
      }
    },
    [downloadSupported, downloadingId, refreshDownloaded, scheduleToastHide],
  );

  // Pick the interrupted download back up when the network returns. Only the
  // pack interrupted in THIS session, and only when nothing else is downloading.
  // A spurious `online` event is harmless — nothing here deletes bytes, so the
  // worst case is a run that fails immediately and re-checkpoints the same pack.
  useEffect(() => {
    if (!downloadSupported) return undefined;
    const onOnline = () => {
      const target = resumeTargetRef.current;
      if (!target || downloadingId || !isOnline()) return;
      handleDownloadTheme(target);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [downloadSupported, downloadingId, handleDownloadTheme]);

  // Open a downloaded pack: shape it like a theme card and reuse the size modal.
  // Offline, GetThemeById serves the pack's theme.json so the variants resolve.
  const handleOpenDownloadedTheme = (pack) => {
    if (!pack?.themeId) return;
    handleLoadTheme({
      _id: pack.themeId,
      name: pack.name,
      editor_type: pack.category,
      theme_images: pack.thumbnail ? [{ url: pack.thumbnail }] : [],
    });
  };

  const handleDeleteThemePack = async (themeId) => {
    // Never delete a pack whose download is still running. The orchestrator
    // would just recreate the directory it's mid-way through writing and its
    // next checkpoint would resurrect the pack — the user's delete silently
    // undone, and the bytes re-transferred. The trash button is hidden in that
    // state; this is the backstop for a confirm dialog that was already open
    // when an auto-resume kicked off underneath it. Leave the dialog up rather
    // than closing it, so a confirmed delete never just evaporates.
    if (downloadingId === themeId) return;
    setPackConfirmId(null);
    // A deleted pack must stop being the reconnect target, or the `online`
    // listener would re-download the very theme the user just removed — from
    // zero, since its bytes are gone.
    if (resumeTargetRef.current?._id === themeId) resumeTargetRef.current = null;
    await deleteThemePack(themeId);
    refreshDownloaded();
  };

  // Stage the chosen design + reopen it in the editor via the restore pipeline.
  // stageDesignForRestore awaits the (async) IndexedDB read but writes the
  // snapshot to localStorage synchronously before resolving, so by the time we
  // navigate the synchronous startup restore read will find it.
  const handleOpenDesign = async (id) => {
    if (!id || openingId) return;
    setOpeningId(id);
    dispatch(resetThemeDetails()); // guard against a stale loaded theme racing restore
    const staged = await stageDesignForRestore(id);
    if (!staged) {
      if (aliveRef.current) setOpeningId(null);
      return;
    }
    navigate(`/?u_id=${encodeURIComponent(token || "")}&restore=1`);
  };

  const handleBackToCategories = () => setSelectedCategory(null);

  const handleNewTheme = () => {
    setCreateMode(null);
    setShowCreateNewModal(true);
  };

  // "Blank" card in the theme grid (photobook / layflat) → open the create modal
  // with the random-layout section pre-enabled.
  const handleCreateBlank = () => {
    setCreateMode("random");
    setShowCreateNewModal(true);
  };

  const isSpreadCategory =
    selectedCategory?.type === EDITOR_TYPES.PHOTOBOOK ||
    selectedCategory?.type === EDITOR_TYPES.LAYFLATALBUM;

  // ── Select a theme → open the size modal (fetch its size variants) ──────────
  // We don't open the editor immediately; the user first picks a size. We fetch
  // the theme's variants here via GetThemeById to populate the modal's predefined
  // sizes.
  const handleLoadTheme = (theme) => {
    if (!theme?._id || loadingThemeId) return;
    setSizeModalTheme(theme);
    setVariants([]);
    setVariantsError("");
    setVariantsLoading(true);
    sizeFetchForRef.current = theme._id;
    GetThemeById(theme._id, {}, null, null)
      .then((themeData) => {
        if (sizeFetchForRef.current !== theme._id) return; // superseded
        if (themeData?.theme?.length > 0) {
          setVariants(themeData.theme);
        } else {
          setVariantsError("No sizes are available for this design.");
        }
      })
      .catch(() => {
        if (sizeFetchForRef.current !== theme._id) return;
        setVariantsError("We couldn't load sizes for this design. Please try again.");
      })
      .finally(() => {
        if (sizeFetchForRef.current === theme._id) setVariantsLoading(false);
      });
  };

  const handleCloseSizeModal = () => {
    sizeFetchForRef.current = null;
    setSizeModalTheme(null);
    setVariants([]);
    setVariantsError("");
    setVariantsLoading(false);
  };

  // ── Continue with the chosen size → open the theme in the editor ────────────
  // The editor's useThemeSetup reads `t_id` from the URL, calls the getTheme API
  // (GetThemeById → store-theme-editor/getTheme) and applies the theme. The extra
  // `size_*` params tell it to resize the theme to the chosen size, and `blank_img`
  // tells it to clear existing image URLs so every image object opens as a BLANK
  // placeholder (not the theme's original sample photos). This blanked state must
  // also survive a later in-editor size change (see useThemeSetup's blank-image
  // persistence keyed on the `themeImagesBlanked` flag).
  //
  // IMPORTANT (desktop fix): this is a single-page app, so the Redux store
  // survives the /design → editor navigation. A theme loaded earlier this session
  // leaves stale `themeDetails`/`cartDetails.theme_id`, which useThemeSetup's
  // `[projectSetup]` effect would re-apply (racing the fresh `t_id` load → wrong
  // theme). Clearing theme details first makes that stale effect bail out.
  //
  // The Redux CANVAS also survives that navigation. `resetThemeDetails` only
  // clears projectSetup — the previously-edited theme's pages stay in
  // `canvas.present.pages`. For a Customer, useThemeSetup.replacePages then reads
  // that stale canvas and TRANSPLANTS the previous theme's placed photos into the
  // new theme (its image-carryover assumes an empty canvas on a fresh open), so a
  // different theme opens showing the previously-saved design instead of the fresh
  // GetTheme data. Blank the canvas here — exactly like handleNewTheme — so every
  // theme opened from Design Selection starts from a clean slate and loads purely
  // from the GetThemeById response. resetEditor seeds blank pages for the current
  // editorType (setupThemeFromURL then replaces them with the chosen theme+size);
  // clearHistory stops Ctrl+Z from resurrecting the prior design (resetEditor is
  // not in the undo-ignore list). Web is unaffected (each open is a fresh page
  // load with an already-empty canvas).
  const handleContinueWithSize = (size, projectName) => {
    const theme = sizeModalTheme;
    if (!theme?._id || !size) return;
    setLoadingThemeId(theme._id);
    dispatch(resetThemeDetails());
    // Seed the reset canvas for THIS theme's product type (= the browsed
    // category) instead of whatever editorType leaked from a previously-opened
    // design. resetEditor builds its blank page skeleton from state.editorType,
    // so without this a Layflat/Calendar/… theme would briefly reset into the
    // prior type's shape (e.g. the Photobook designer) before setupThemeFromURL
    // corrects it. Aligning it up front makes the correct designer render from
    // the first paint. Falls back to the current type when the category is
    // unknown (e.g. opening a downloaded pack).
    if (selectedCategory?.type) dispatch(setEditorType(selectedCategory.type));
    dispatch(resetEditor());
    dispatch(UndoActionCreators.clearHistory());

    const params = new URLSearchParams();
    if (token) params.set("u_id", token);
    params.set("t_id", theme._id);
    if (selectedCategory?.type) params.set("cat", selectedCategory.type); // for the editor's Back button
    // Optional project name the user typed in the size modal — becomes the design's
    // display name (setThemeName in useThemeSetup) so it shows in "Your Designs".
    if (projectName) params.set("proj_name", projectName);
    params.set("size_w", String(size.width));
    params.set("size_h", String(size.height));
    if (size.dpi) params.set("size_dpi", String(size.dpi));
    params.set("size_sm", String(size.safeMargin ?? 0));
    params.set("size_bm", String(size.bleedMargin ?? 0));
    // Carry the exact label the user saw/picked (e.g. "1200 × 1600 px" or a
    // custom "8 × 8 in") so the Saved Designs card shows the SAME size, not a
    // re-derived pixel value.
    if (size.label) params.set("size_label", size.label);
    params.set("blank_img", "1"); // open with blank image placeholders, not the theme's photos
    navigate(`/?${params.toString()}`);
  };

  // ──────────────────────────────── render ────────────────────────────────────
  if (initializing) {
    return (
      <Page>
        <LoadingState label="Preparing your workspace…" />
      </Page>
    );
  }

  if (authError) {
    return (
      <Page>
        <ErrorState
          title="Session expired"
          text={authError}
          action={
            <PrimaryButton onClick={() => navigate("/login")}>
              Go to Login
            </PrimaryButton>
          }
        />
      </Page>
    );
  }

  const savedCount = designs.length;
  // On web (no offline support) the Offline tab isn't offered, so always resolve
  // to the saved-designs list regardless of the (then-unused) tab state.
  const activeTab = downloadSupported ? sidebarTab : "designs";
  // Only admin-like accounts (superuser / admin / employee) may author brand-new
  // themes from scratch; regular users design by opening an existing theme. The
  // enriched `user` carries userTypeCode, so this reacts once the account loads.
  const canCreateTheme = true;

  // ── Left sidebar: heading + saved designs ───────────────────────────────────
  const renderSavedDesigns = () => {
    if (designsLoading) {
      return <LoadingState label="Loading your designs…" padding="40px 16px" />;
    }
    if (savedCount === 0) {
      return (
        <SavedEmpty>
          <span className="icon">
            <FaFolderOpen />
          </span>
          <div className="title">No saved designs yet</div>
          <p className="text">
            Pick a category on the right to start designing. Your work is saved
            here automatically as you go.
          </p>
        </SavedEmpty>
      );
    }
    return (
      <SavedList>
        {designs.map((d) => {
          const busy = openingId === d.id;
          return (
            <SavedRow
              key={d.id}
              $busy={busy && !confirmId}
              role="button"
              tabIndex={0}
              title={`Open ${d.name}`}
              onClick={() => confirmId !== d.id && handleOpenDesign(d.id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && confirmId !== d.id) {
                  e.preventDefault();
                  handleOpenDesign(d.id);
                }
              }}
            >
              <SavedThumb>
                <DesignThumbnail
                  thumbnail={d.thumbnail}
                  scopeId={d.id}
                  alt={d.name}
                  fallback={
                    <span className="placeholder">
                      <FaRegImage />
                    </span>
                  }
                />
              </SavedThumb>
              <SavedInfo>
                <div className="name">{d.name}</div>
                <div className="meta">
                  <span className="type">{labelForType(d.editorType)}</span>
                  <span>{relativeTime(d.updatedAt)}</span>
                </div>
                {d.size && (
                  <div className="size">
                    <FaRulerCombined size={9} />
                    {d.size}
                  </div>
                )}
                {confirmId === d.id && (
                  <SavedConfirm onClick={(e) => e.stopPropagation()}>
                    <span>Delete?</span>
                    <button className="yes" onClick={() => handleDeleteDesign(d.id)}>
                      Yes
                    </button>
                    <button className="no" onClick={() => setConfirmId(null)}>
                      No
                    </button>
                  </SavedConfirm>
                )}
              </SavedInfo>
              {busy ? (
                <SavedDeleteBtn as="div" style={{ opacity: 1, cursor: "default" }}>
                  <Spinner $size={14} $thickness={2} />
                </SavedDeleteBtn>
              ) : (
                confirmId !== d.id && (
                  <SavedDeleteBtn
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(d.id);
                    }}
                    // Without this the row's Enter/Space handler swallows the key
                    // and opens the design instead, so the delete confirm is
                    // unreachable by keyboard.
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`Delete ${d.name}`}
                    title="Delete design"
                  >
                    <FaTrashAlt size={11} />
                  </SavedDeleteBtn>
                )
              )}
            </SavedRow>
          );
        })}
      </SavedList>
    );
  };

  // ── Left sidebar: downloaded themes (offline library, "Offline" tab) ────────
  const renderDownloadedThemes = () => {
    if (themePacks.length === 0) {
      return (
        <SavedEmpty>
          <span className="icon">
            <FaCloudDownloadAlt />
          </span>
          <div className="title">No downloaded themes yet</div>
          <p className="text">
            Open a category on the right and use the <strong>Download</strong>{" "}
            button on a theme to save it here for offline use.
          </p>
        </SavedEmpty>
      );
    }
    return (
      <SavedList>
        {themePacks.map((p) => (
          <SavedRow
            key={p.themeId}
            role="button"
            tabIndex={0}
            title={`Open ${p.name}`}
            onClick={() => packConfirmId !== p.themeId && handleOpenDownloadedTheme(p)}
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === " ") &&
                packConfirmId !== p.themeId
              ) {
                e.preventDefault();
                handleOpenDownloadedTheme(p);
              }
            }}
          >
            <SavedThumb>
              {p.thumbnail ? (
                <img src={p.thumbnail} alt={p.name} loading="lazy" />
              ) : (
                <span className="placeholder">
                  <FaRegImage />
                </span>
              )}
            </SavedThumb>
            <SavedInfo>
              <div className="name">{p.name}</div>
              <div className="meta">
                <span className="type">{labelForType(p.category)}</span>
                <span>
                  {p.sizesCount} size{p.sizesCount === 1 ? "" : "s"}
                </span>
                {/* `=== false` — legacy packs predate the flag (see refreshDownloaded). */}
                {p.complete === false && <span className="type">Partial</span>}
                {p.complete !== false && p.missingCount > 0 && (
                  <span title="Some assets are no longer available from the server">
                    {p.missingCount} unavailable
                  </span>
                )}
              </div>
              {/* The row itself is a role="button" that opens the pack on
                  Enter/Space, so anything interactive inside it must stop BOTH
                  click and keydown — otherwise the row swallows the key and
                  opens the theme instead of pressing the button under focus. */}
              {p.complete === false && packConfirmId !== p.themeId && (
                <SavedConfirm
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span>Download stopped early</span>
                  <button
                    className="yes"
                    disabled={!!downloadingId}
                    onClick={() =>
                      handleDownloadTheme({
                        _id: p.themeId,
                        name: p.name,
                        editor_type: p.category,
                      })
                    }
                  >
                    {downloadingId === p.themeId ? "Resuming…" : "Resume"}
                  </button>
                </SavedConfirm>
              )}
              {packConfirmId === p.themeId && (
                <SavedConfirm
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {/* An auto-resume can start while this dialog is open, and we
                      refuse to delete a pack mid-download — say so rather than
                      leaving a Yes button that does nothing. */}
                  <span>
                    {downloadingId === p.themeId
                      ? "Downloading — can't remove yet"
                      : "Remove download?"}
                  </span>
                  <button
                    className="yes"
                    disabled={downloadingId === p.themeId}
                    onClick={() => handleDeleteThemePack(p.themeId)}
                  >
                    Yes
                  </button>
                  <button className="no" onClick={() => setPackConfirmId(null)}>
                    {downloadingId === p.themeId ? "Close" : "No"}
                  </button>
                </SavedConfirm>
              )}
            </SavedInfo>
            {/* No delete affordance while THIS pack is downloading: removing the
                directory out from under the running orchestrator would only get
                it recreated, and re-transfer everything that was already on
                disk. Other packs stay deletable. */}
            {packConfirmId !== p.themeId && downloadingId !== p.themeId && (
              <SavedDeleteBtn
                onClick={(e) => {
                  e.stopPropagation();
                  setPackConfirmId(p.themeId);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={`Remove ${p.name} download`}
                title="Remove download"
              >
                <FaTrashAlt size={11} />
              </SavedDeleteBtn>
            )}
          </SavedRow>
        ))}
      </SavedList>
    );
  };

  return (
    <Page>
      <AppBar>
        <Brand>
          <BrandMark>
            <FaThLarge size={16} />
          </BrandMark>
          <BrandName>Printpoz Design</BrandName>
        </Brand>
        <AppBarActions>
          {user && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--foreground, #0f172a)" }}>
                {user.name || user.email || user.username}
              </span>
              {user.userTypeCode && (
                <span style={{ fontSize: "10.5px", fontWeight: "700", color: "var(--muted-foreground, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {(Object.keys(USER_TYPES).find(key => USER_TYPES[key] === user.userTypeCode) || String(user.userTypeCode)).toLowerCase()}
                </span>
              )}
            </div>
          )}
          {canCreateTheme && (
            <PrimaryButton onClick={() => handleNewTheme(selectedCategory)}>
              <FaPlus size={12} /> {user?.userTypeCode === USER_TYPES.CUSTOMER ? "New Design" : "New Theme"}
            </PrimaryButton>
          )}
          <GhostButton onClick={handleLogout} title="Log Out">
            <FaSignOutAlt size={13} />
            <span>Log Out</span>
          </GhostButton>
        </AppBarActions>
      </AppBar>

      <Workspace>
        {/* Left pane — a segmented control switches between the saved-designs
            library and the offline (downloaded) themes so only one list shows
            at a time. On web (no offline support) it's a single quiet header. */}
        <Sidebar>
          <SidebarHeader>
            {downloadSupported ? (
              <SidebarTabs role="tablist" aria-label="Sidebar sections">
                <SidebarTab
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "designs"}
                  $active={activeTab === "designs"}
                  onClick={() => setSidebarTab("designs")}
                >
                  <SidebarTabText>Your Projects</SidebarTabText>
                </SidebarTab>
                <SidebarTab
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "offline"}
                  $active={activeTab === "offline"}
                  onClick={() => setSidebarTab("offline")}
                >
                  <SidebarTabText>Downloaded Themes</SidebarTabText>
                </SidebarTab>
              </SidebarTabs>
            ) : (
              <SidebarSectionTitle>
                <FaFolderOpen size={12} />
                <span>Your Projects</span>
                {!designsLoading && savedCount > 0 && (
                  <SidebarCount>{savedCount}</SidebarCount>
                )}
              </SidebarSectionTitle>
            )}
            <SidebarMeta>
              {activeTab === "offline"
                ? themePacks.length
                  ? `${themePacks.length} theme${themePacks.length === 1 ? "" : "s"} downloaded — click to open`
                  : "No themes downloaded yet"
                : designsLoading
                ? "Loading…"
                : savedCount
                ? `${savedCount} design${savedCount === 1 ? "" : "s"} saved here — click to reopen`
                : "Saved on this device"}
            </SidebarMeta>
          </SidebarHeader>
          <SidebarBody>
            {activeTab === "offline"
              ? renderDownloadedThemes()
              : renderSavedDesigns()}
          </SidebarBody>
        </Sidebar>

        {/* Right pane — categories / theme browser */}
        <Content>
          {selectedCategory ? (
            // Browsing themes inside one category.
            <>
              <Hero>
                <HeroTop>
                  {/* Back to the category grid (the Design Selection landing). */}
                  <GhostButton onClick={handleBackToCategories} title="Back to all categories">
                    <FaArrowLeft size={13} /> Back
                  </GhostButton>

                  {/* Per-category search — committed value is forwarded into the
                      getThemes API payload by ThemeBrowser. */}
                  <ThemeSearch>
                    <FaSearch className="search-ico" size={13} />
                    <ThemeSearchInput
                      type="text"
                      value={searchInput}
                      placeholder={`Search ${selectedCategory.label || "projects"}…`}
                      aria-label={`Search ${selectedCategory.label || ""} projects`.trim()}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setThemeSearch(searchInput.trim());
                        else if (e.key === "Escape" && searchInput) clearThemeSearch();
                      }}
                    />
                    {searchInput && (
                      <ThemeSearchClear
                        type="button"
                        onClick={clearThemeSearch}
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        <FaTimes size={11} />
                      </ThemeSearchClear>
                    )}
                  </ThemeSearch>
                </HeroTop>
                <Breadcrumb aria-label="Breadcrumb">
                  <CrumbButton onClick={handleBackToCategories}>
                    All categories
                  </CrumbButton>
                  <span aria-hidden="true">/</span>
                  <CrumbCurrent>{selectedCategory.label}</CrumbCurrent>
                </Breadcrumb>
                <Heading>{selectedCategory.label} projects</Heading>
                <SubHeading>
                  Pick a ready-made design to start, or use{" "}
                  <strong>New Theme</strong> to begin from a blank canvas.
                </SubHeading>
              </Hero>
              <ThemeBrowser
                key={selectedCategory.type}
                category={selectedCategory}
                user={user}
                onSelectTheme={handleLoadTheme}
                selectedThemeId={loadingThemeId}
                onBack={handleBackToCategories}
                search={themeSearch}
                onClearSearch={clearThemeSearch}
                downloadSupported={downloadSupported}
                downloadedIds={downloadedIds}
                partialIds={partialIds}
                downloadingId={downloadingId}
                onDownloadTheme={handleDownloadTheme}
                showBlankCard={isSpreadCategory && !themeSearch}
                onCreateBlank={handleCreateBlank}
              />
            </>
          ) : (
            // Top-level: welcome + the category picker.
            <>
              <Hero>
                <Heading>What would you like to design?</Heading>
                <SubHeading>
                  Choose a product below to start designing, or open one of your
                  saved projects from the <strong>Your Projects</strong> panel on the
                  left.
                </SubHeading>
              </Hero>

              <CategoryGrid onSelect={setSelectedCategory} />
            </>
          )}
        </Content>
      </Workspace>

      <ThemeSizeModal
        open={!!sizeModalTheme}
        themeName={sizeModalTheme?.name}
        variants={variants}
        loading={variantsLoading}
        error={variantsError}
        editorType={selectedCategory?.type || sizeModalTheme?.editor_type}
        onRetry={() => sizeModalTheme && handleLoadTheme(sizeModalTheme)}
        onContinue={handleContinueWithSize}
        onClose={handleCloseSizeModal}
      />

      <ThemeDownloadToast
        download={downloadState}
        onClose={() => {
          if (toastHideRef.current) clearTimeout(toastHideRef.current);
          setDownloadState(null);
        }}
      />

      <CreateNewDesignModal
        show={showCreateNewModal}
        onClose={() => setShowCreateNewModal(false)}
        user={user}
        initialCategory={selectedCategory}
        mode={createMode}
      />
    </Page>
  );
};

export default DesignSelectionPage;
