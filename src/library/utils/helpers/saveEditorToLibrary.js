// saveEditorToLibrary — force-persist the CURRENT editor state to the durable
// Saved Designs library (desktop: AppData/editor/designs via the editorData IPC
// channel; web: IndexedDB). This is the same on-device store the periodic
// auto-save (useEditorSnapshot.writeSnapshot) and CreateThemeDialog write to, so
// a button-triggered save and an auto-save tick produce the SAME entry (same
// derived id → one "Your Designs" card, never a duplicate).
//
// Used by the editor's "Save Theme" / "Update Theme" actions so they persist the
// design locally with NO API round-trip — themes save and reopen fully offline.

import { store } from "../../../store/store.jsx";
import { compressData } from "../common-functions/index.js";
import { generateDesignThumbnail } from "./designThumbnail.js";
import {
  saveDesignToLibrary,
  deriveDesignId,
  ensureActiveLocalDesignId,
  peekActiveLocalDesignId,
} from "./savedDesigns.js";
import {
  saveEditorSnapshotDurable,
  persistCanvasHistoryDurable,
  getEditorSnapshotCat,
} from "./editorSnapshot.js";

// Build the working-state slice + library id from the live store. Mirrors the
// shape assembled by useEditorSnapshot.writeSnapshot (kept in sync with it).
const buildEntryFromStore = () => {
  const c = store.getState().canvas.present;
  const ps = store.getState().projectSetup;
  const app = store.getState().appSlice;

  const themeId = ps.themeDetails?.theme_id || ps.cartDetails?.theme_id || null;
  const themeName = ps.themeDetails?.theme_name || null;
  const cartOrderId = ps.cartDetails?._id || ps.project_id || null;

  // Only mint a local id while the design has NO server identity (deriveDesignId
  // ignores localId otherwise); afterwards just peek so a superseded local entry
  // can still be retired.
  const localId =
    !themeId && !cartOrderId
      ? ensureActiveLocalDesignId()
      : peekActiveLocalDesignId();
  // Derive (not hand-build) the local library id so it carries the SAME account
  // scope as `libraryId` below — otherwise the supersede/retire comparison in
  // savedDesigns would never match once ids are account-scoped.
  const localLibId = localId ? deriveDesignId({ localId }) : null;
  const libraryId = deriveDesignId({
    themeId,
    cartOrderId,
    localId,
    canvasSize: c.canvasSize,
  });

  let pages_c = null;
  try {
    pages_c = compressData(JSON.stringify(c.pages));
  } catch (_) {
    pages_c = null;
  }

  const working = {
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
    themeId,
    themeName,
    cartOrderId,
    // `cat` is intentionally omitted — an update preserves the entry's existing
    // category (savedDesigns.buildEntry carries it over from the stored meta).
  };
  return { working, libraryId, localLibId };
};

/**
 * Persist the current editor state to the Saved Designs library immediately.
 * Resolves the stored entry's id on success, or null on failure. Best-effort
 * thumbnail generation never blocks the save. `allowEmpty` is on so a
 * just-created theme with no content yet can still be saved.
 */
export const saveCurrentEditorToLibrary = async () => {
  const { working, libraryId, localLibId } = buildEntryFromStore();
  if (!libraryId) return null;

  let thumbnail = null;
  try {
    thumbnail = generateDesignThumbnail({
      pages: working.pages,
      canvasSize: working.canvasSize,
      editorType: working.editorType,
      settings: working.settings,
      calendarSettings: working.calendarSettings,
    });
  } catch (_) {
    thumbnail = null;
  }

  // Durably update the offline restore snapshot AND undo history too. The
  // reload/resume path (RootGate → restore=1 → useEditorSnapshot) restores from
  // the SNAPSHOT, not the Saved Designs library — so without this an explicit
  // save that the user reloads right after (before the 15s periodic snapshot
  // fires, or on a hard quit where the fire-and-forget write never flushes) would
  // come back to the pre-edit state (or fall through to a server fetch of the
  // original theme), losing every local change. Awaiting guarantees the
  // just-saved pages are what a reload restores. Best-effort: a failure here
  // never blocks the library save below. `cat` is preserved from the snapshot.
  try {
    await Promise.all([
      saveEditorSnapshotDurable({
        ...working,
        libraryId,
        cat: getEditorSnapshotCat(),
      }),
      // The resume applies the snapshot, then OVERWRITES its pages with the
      // persisted history's `present` (canvas/restoreHistory). Refreshing the
      // snapshot alone would let a STALE undo stack clobber the just-saved pages,
      // so persist the whole stack from the SAME store state at the same moment.
      persistCanvasHistoryDurable(store.getState().canvas, {
        themeId: working.themeId,
        cartOrderId: working.cartOrderId,
      }),
    ]);
  } catch (_) {
    /* snapshot/history persistence is best-effort — the library save is authoritative */
  }

  return saveDesignToLibrary(
    { ...working, id: libraryId, thumbnail },
    {
      allowEmpty: true,
      // When a local-only design has just gained a server identity, drop the old
      // local entry so the design doesn't appear twice.
      supersedesId: localLibId && localLibId !== libraryId ? localLibId : null,
    }
  );
};
