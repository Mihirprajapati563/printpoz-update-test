// useEditorSnapshot — local crash/offline resume for the editor.
//
// Responsibilities (see editorSnapshot.js for the storage contract):
//   1. SAVE the live editor working state to localStorage at a regular interval
//      and on tab/app close (`beforeunload`) and editor unmount, for EVERY
//      editor session. This is what lets a reopen continue from where the user
//      left off even if the app crashed, was closed, or was offline.
//   2. RESTORE that snapshot directly into Redux — offline, with no server
//      fetch — when the editor is entered with `restore=1` (RootGate sets this
//      when it detects a usable snapshot and nothing more explicit to open).
//
// The restore runs synchronously on mount and reports `restoring`/`restored` so
// the project/theme bootstrap hooks can stand down instead of racing a server
// fetch against the locally-applied pages.

import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { store } from "../../../store/store.jsx";
import {
  applyTheme,
  setCanvasSize,
  setEditorType,
  setSettings,
  setCalendarSettings,
  setMinPages,
  setMaxPages,
  setActiveSide,
  setTextGroups,
  setCurrentObjectProperties,
  deSelectSafeArea,
  setPageNumber,
  recordThemeBaseline,
} from "../../../store/slices/canvas.js";
import {
  setProjectDetails,
  setThemeId,
  setThemeName,
  setProjectInitialized,
  setThemeApplied,
} from "../../../store/slices/projectSetup.js";
import { setThemeImagesBlanked } from "../../../store/slices/appAlice.js";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import {
  saveEditorSnapshot,
  readEditorSnapshot,
  persistCanvasHistory,
  readCanvasHistory,
  registerPendingHistoryTask,
  cancelPendingHistoryTask,
} from "../helpers/editorSnapshot.js";
import {
  saveDesignToLibrary,
  deriveDesignId,
  localIdFromLibraryId,
  ensureActiveLocalDesignId,
  peekActiveLocalDesignId,
  adoptActiveLocalDesignId,
  resetActiveLocalDesignId,
} from "../helpers/savedDesigns.js";
import { isDesignAbandoned } from "../helpers/designSession.js";
import { generateDesignThumbnail } from "../helpers/designThumbnail.js";
import { compressData } from "../common-functions/index.js";
import { getUrlParam } from "../helpers/session.js";
import { isDesktop } from "../../../desktop/index.js";

const SNAPSHOT_INTERVAL_MS = 15000;

const useEditorSnapshot = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const isRestoreEntry = getUrlParam(location.search, "restore") === "1";

  // `restoring` is true from mount until the snapshot has been applied (or we've
  // determined there is nothing to restore). The bootstrap hooks read it to skip
  // the server fetch on a restore entry.
  const [restoring, setRestoring] = useState(isRestoreEntry);
  const [restored, setRestored] = useState(false);

  // Stable per-session local id for designs with no server identity yet. This
  // MUST be the MODULE-level active id (savedDesigns.js) — the SAME one the
  // restore path adopts (adoptActiveLocalDesignId) and the create dialogs mint
  // (ensureActiveLocalDesignId). A separate local ref (the old behaviour) forked
  // a FRESH id on every reopen — so restoring a saved design and closing it wrote
  // a NEW `local:<ts>` entry each time → duplicate "Your Designs" cards. Delegate
  // to the module so the id round-trips through open→edit→close→reopen.
  const getLocalDesignId = () => ensureActiveLocalDesignId();
  // Once the user deletes the currently-open project, we abandon its id and save
  // continued work as a fresh LOCAL design. This flag makes every later save stay
  // local-only, so a theme/cart-backed id can't re-derive back to the deleted
  // entry (deriveDesignId prioritises theme/cart over the local id).
  const forceNewLocalRef = useRef(false);

  // Identity of the snapshot we restored, so the async history-restore below only
  // applies a persisted undo/redo stack that belongs to THIS design.
  const restoredSnapRef = useRef(null);
  // The pending idle history-persist task is tracked at MODULE scope
  // (editorSnapshot.js) instead of a hook-local ref, so an explicit durable save
  // (persistCanvasHistoryDurable) can cancel it too and win the race for
  // history.json — see registerPendingHistoryTask / cancelPendingHistoryTask.

  // ── Restore (runs once, synchronously, before the first paint settles) ──────
  useEffect(() => {
    // Every editor mount starts a fresh local-design identity; a restore of a
    // local-only design re-adopts its id just below.
    resetActiveLocalDesignId();
    if (!isRestoreEntry) return;
    const snap = readEditorSnapshot();
    if (!snap) {
      // Nothing usable to restore — let the normal bootstrap take over.
      setRestoring(false);
      return;
    }
    try {
      // 0. If this restore is of a local-only design (created/edited before ever
      //    being saved to the API), recover its library id so subsequent
      //    auto-saves UPDATE that same entry rather than forking a duplicate.
      //    localIdFromLibraryId tolerates the account-scope prefix on the id.
      const restoredLocalId = localIdFromLibraryId(snap.libraryId);
      if (restoredLocalId) {
        adoptActiveLocalDesignId(restoredLocalId);
      }

      // 1. Editor identity/config first so size-dependent rendering is correct.
      if (snap.editorType) dispatch(setEditorType(snap.editorType));
      if (snap.canvasSize) dispatch(setCanvasSize(snap.canvasSize));
      if (snap.settings) dispatch(setSettings(snap.settings));
      // calendarSettings is null for non-calendar editors — dispatch as-is.
      dispatch(setCalendarSettings(snap.calendarSettings || null));
      if (typeof snap.minPages === "number") dispatch(setMinPages(snap.minPages));
      if (typeof snap.maxPages === "number") dispatch(setMaxPages(snap.maxPages));
      if (typeof snap.activeSide === "number") dispatch(setActiveSide(snap.activeSide));
      dispatch(setThemeImagesBlanked(!!snap.themeImagesBlanked));

      // 2. Establish project identity so the existing customer auto-save targets
      //    the right cart order and theme once back online. We mirror the shape
      //    setProjectDetails expects (editorDetails / cartDetails).
      const cartOrderId = snap.cartOrderId || null;
      dispatch(
        setProjectDetails({
          editorDetails: cartOrderId
            ? { cart_order_id: cartOrderId, theme_id: snap.themeId || null }
            : null,
          cartDetails: cartOrderId
            ? { _id: cartOrderId, theme_id: snap.themeId || null }
            : {},
        })
      );
      if (snap.themeId) dispatch(setThemeId(snap.themeId));
      if (snap.themeName) dispatch(setThemeName(snap.themeName));

      // 3. The pages themselves — applyTheme writes canvas.present.pages
      //    synchronously (same as the theme-load path).
      dispatch(setCurrentObjectProperties(null));
      dispatch(applyTheme(snap.pages));
      dispatch(deSelectSafeArea());
      dispatch(setPageNumber(0));
      if (snap.textGroups && Object.keys(snap.textGroups).length > 0) {
        dispatch(setTextGroups(snap.textGroups));
      }

      // 4. The restored pages are the baseline — the user shouldn't be able to
      //    Undo past them, and the snapshot itself becomes our save baseline.
      dispatch(UndoActionCreators.clearHistory());
      dispatch(recordThemeBaseline({ timestamp: snap.savedAt || 0, history: false }));

      // 5. Mark the project ready so MainLayout renders the editor (these are
      //    what useInitializeProject / useThemeSetup would otherwise set).
      dispatch(setProjectInitialized(true));
      dispatch(setThemeApplied(true));

      // Remember which design this snapshot is, so the async history-restore
      // below only applies a persisted stack tagged with the same identity. The
      // size is part of the identity (for theme designs) so a leftover history
      // file from the SAME theme at a DIFFERENT size is rejected instead of
      // clobbering these restored pages. Derived from the restored canvasSize the
      // same way readCanvasHistory derives its size; null for a cart design.
      const restoredCS = snap.canvasSize;
      const restoredW = Math.round(Number(restoredCS?.width) || 0);
      const restoredH = Math.round(Number(restoredCS?.height) || 0);
      restoredSnapRef.current = {
        themeId: snap.themeId || null,
        cartOrderId: snap.cartOrderId || null,
        size:
          snap.cartOrderId || !restoredW || !restoredH
            ? null
            : { width: restoredW, height: restoredH },
        savedAt: snap.savedAt || 0,
      };

      // Treat the just-applied pages as already saved so the periodic snapshot
      // below doesn't immediately re-write an identical copy.
      lastSnapshotPagesRef.current = store.getState().canvas.present.pages;
      setRestored(true);
    } catch (e) {
      // Restore failed — fall back to normal bootstrap rather than a broken editor.
    } finally {
      setRestoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoreEntry]);

  // ── Restore the FULL undo/redo history (desktop, async) ─────────────────────
  // The sync restore above applied the design and cleared history (the safe,
  // offline-first default). Once that has settled, load the persisted 300-step
  // stack from AppData and, if it belongs to this same design and the user hasn't
  // edited yet, install it — so Ctrl+Z reaches back into the previous session.
  useEffect(() => {
    if (!isRestoreEntry || !restored || !isDesktop) return;
    let cancelled = false;
    (async () => {
      try {
        const hist = await readCanvasHistory();
        if (cancelled || !hist) return;

        // Identity gate: never apply a stale stack from a different design — or
        // from the SAME theme at a DIFFERENT size (each theme-size combo is its
        // own design; installing the wrong size's stack would clobber the
        // restored pages with mismatched-size content). Size is compared only
        // when both sides know it (theme designs); a cart design has size null on
        // both sides, so the check is a no-op there.
        const want = restoredSnapRef.current || {};
        const sizeMatch =
          !hist.size ||
          !want.size ||
          (hist.size.width === want.size.width && hist.size.height === want.size.height);
        const idMatch =
          (hist.themeId || null) === (want.themeId || null) &&
          (hist.cartOrderId || null) === (want.cartOrderId || null) &&
          sizeMatch;
        if (!idMatch) return;

        // Freshness gate: never install a persisted history OLDER than the
        // snapshot we just restored. Legitimate writes always stamp the history
        // at or after the snapshot (the durable save writes the snapshot first,
        // then history; the periodic tick defers history to a later idle tick or
        // a forced synchronous write). So an older history.json means a stale /
        // orphaned write (e.g. a queued idle write that landed after a durable
        // save) — installing it would clobber the fresher snapshot pages via
        // canvas/restoreHistory. Drop it and keep the snapshot (safe fallback).
        if ((hist.savedAt || 0) < (want.savedAt || 0)) return;

        // Don't clobber any edit the user made in the brief window since the
        // sync restore (lastSnapshotPagesRef tracks the applied pages).
        if (store.getState().canvas.present.pages !== lastSnapshotPagesRef.current) {
          return;
        }

        // Install the whole { past, present, future } in one shot.
        dispatch({ type: "canvas/restoreHistory", payload: hist.canvasState });
        // Re-anchor the "saved" baseline the same way the sync path did, so the
        // resume isn't immediately flagged as having unsaved changes.
        dispatch(
          recordThemeBaseline({ timestamp: want.savedAt || 0, history: false }),
        );
        // Keep the no-op guard aligned with the newly-installed present.
        lastSnapshotPagesRef.current = store.getState().canvas.present.pages;
      } catch (_) {
        /* best-effort — a failed history restore just leaves it cleared */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoreEntry, restored]);

  // ── Save ────────────────────────────────────────────────────────────────────
  // Reference of the pages we last persisted; the interval skips no-op ticks.
  const lastSnapshotPagesRef = useRef(null);

  // Derive the stable Saved Designs id for the CURRENT design (module-level
  // local id so it round-trips across open→close→reopen; deterministic for
  // theme/cart designs). Also applies the delete-abandon rule.
  const computeLibraryId = () => {
    const c = store.getState().canvas.present;
    const ps = store.getState().projectSetup;
    const themeId = ps.themeDetails?.theme_id || ps.cartDetails?.theme_id || null;
    const cartOrderId = ps.cartDetails?._id || ps.project_id || null;
    let libraryId = forceNewLocalRef.current
      ? deriveDesignId({ localId: getLocalDesignId() })
      : deriveDesignId({
          themeId,
          cartOrderId,
          localId: getLocalDesignId(),
          canvasSize: c.canvasSize,
        });
    if (libraryId && isDesignAbandoned(libraryId)) {
      resetActiveLocalDesignId(); // drop the deleted id; a fresh one is minted below
      forceNewLocalRef.current = true;
      libraryId = deriveDesignId({ localId: getLocalDesignId() });
    }
    return libraryId;
  };

  // Build the working-state slice both the snapshot AND the library entry use.
  const buildWorking = (libraryId) => {
    const c = store.getState().canvas.present;
    const ps = store.getState().projectSetup;
    const app = store.getState().appSlice;
    let pages_c = null;
    try {
      pages_c = compressData(JSON.stringify(c.pages));
    } catch (_) {
      pages_c = null;
    }
    return {
      pages: c.pages,
      pages_c,
      canvasSize: c.canvasSize,
      editorType: c.editorType,
      orientation: c.orientation,
      settings: c.settings,
      calendarSettings: c.calendarSettings,
      minPages: c.minPages,
      maxPages: c.maxPages,
      activeSide: c.activeSide,
      textGroups: c.textGroups,
      themeImagesBlanked: app.themeImagesBlanked,
      themeId: ps.themeDetails?.theme_id || ps.cartDetails?.theme_id || null,
      themeName: ps.themeDetails?.theme_name || null,
      cartOrderId: ps.cartDetails?._id || ps.project_id || null,
      cat: getUrlParam(location.search, "cat"),
      libraryId, // persisted into the snapshot so a resume re-adopts this entry
    };
  };

  // Pull the current editor state out of the store and persist it. Uses
  // store.getState() (not selectors) so the beforeunload handler reads fresh
  // state without a stale closure.
  const writeSnapshot = (force = false) => {
    // Grab the whole undoable canvas state so we can persist the full undo/redo
    // stack alongside the present-only snapshot (redux state is immutable, so
    // holding this reference across a deferred idle write is safe).
    const canvasState = store.getState().canvas;
    const c = canvasState.present;
    if (!force && c.pages === lastSnapshotPagesRef.current) return;

    const libraryId = computeLibraryId();
    const working = buildWorking(libraryId);
    const themeId = working.themeId;
    const cartOrderId = working.cartOrderId;

    const ok = saveEditorSnapshot(working);
    if (ok) lastSnapshotPagesRef.current = c.pages;

    // Desktop only: also persist the FULL undo/redo stack (all 300 steps) so a
    // reopen restores the entire history, not just the present. Gate on `ok`
    // (something changed) to skip re-serializing the large stack on no-op ticks.
    // Compressing 300 snapshots can be heavy, so defer periodic writes to idle
    // time; a forced write (tab close / editor unmount) runs immediately since
    // an idle callback would never fire before teardown.
    if (ok && isDesktop) {
      const identity = { themeId, cartOrderId };
      const persist = () => {
        cancelPendingHistoryTask();
        persistCanvasHistory(canvasState, identity);
      };
      // Cancel any previously-queued idle write, then register this one at MODULE
      // scope so an explicit durable save can cancel it before it lands stale.
      cancelPendingHistoryTask();
      if (force) {
        persist();
      } else if (
        typeof window !== "undefined" &&
        typeof window.requestIdleCallback === "function"
      ) {
        const id = window.requestIdleCallback(persist, { timeout: 5000 });
        registerPendingHistoryTask({ cancel: () => window.cancelIdleCallback(id) });
      } else {
        const id = setTimeout(persist, 500);
        registerPendingHistoryTask({ cancel: () => clearTimeout(id) });
      }
    }

    // Mirror into the persistent Saved Designs library ("Your Projects") on close /
    // editor unmount (force) — NOT on every background tick — so an in-progress
    // design the user created or edited appears there even if they never pressed
    // Save or Order (their work is never lost). Unlike the crash/offline snapshot
    // above, the library is NOT cleared when returning to Design Selection.
    //
    // NO DUPLICATES: `libraryId` comes from deriveDesignId — the SAME derivation
    // the explicit Save/Order path (saveCurrentEditorToLibrary) uses — so a later
    // Save/Order UPDATES this one entry instead of forking a second card. And if
    // the design started local-only and has since gained a server (theme/cart)
    // identity, `supersedesId` retires the stale `local:<id>` entry so it can't
    // linger as a duplicate. Blank designs (no content) are skipped by
    // saveDesignToLibrary's content gate — a card appears only once there's
    // something on the canvas. The write registers synchronously (Promise.resolve)
    // so Design Selection's flushSavedDesigns() awaits it → card present on land.
    try {
      if (force && libraryId) {
        let thumbnail = null;
        try {
          thumbnail = generateDesignThumbnail({
            pages: c.pages,
            canvasSize: c.canvasSize,
            editorType: c.editorType,
            settings: c.settings,
            calendarSettings: c.calendarSettings,
          });
        } catch (_) {
          thumbnail = null;
        }
        const activeLocalId = peekActiveLocalDesignId();
        const localLibId = activeLocalId
          ? deriveDesignId({ localId: activeLocalId })
          : null;
        const supersedesId =
          localLibId && localLibId !== libraryId ? localLibId : null;
        Promise.resolve(
          saveDesignToLibrary(
            { ...working, id: libraryId, thumbnail },
            { supersedesId }
          )
        ).catch(() => {});
      }
    } catch (_) {
      /* library save is best-effort — never block the snapshot/teardown */
    }
  };

  useEffect(() => {
    // Don't start snapshotting until any in-progress restore has settled, so we
    // never overwrite a good snapshot with a half-applied one.
    if (restoring) return;

    const interval = setInterval(() => {
      writeSnapshot(false);
    }, SNAPSHOT_INTERVAL_MS);

    // Accidental close / crash-adjacent unload: persist the crash-resume snapshot
    // immediately. `force` because the page may close before the next interval
    // tick. (This writes only the snapshot/history — never the library.)
    const onBeforeUnload = () => writeSnapshot(true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Editor unmount (navigating within the SPA) — persist the crash-resume
      // snapshot so a reopen can continue; the library is untouched.
      writeSnapshot(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring]);

  return { restoring, restored, isRestoreEntry };
};

export default useEditorSnapshot;
