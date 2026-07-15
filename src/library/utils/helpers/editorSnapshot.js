// ── Local editor-state snapshot (crash / offline resume) ─────────────────────
// Persists the user's live editing state at regular intervals so that if the app
// is accidentally closed, crashes, or loses connectivity, the next launch drops
// the user straight back into their design — continuing exactly where they left
// off, WITHOUT needing the network.
//
// Storage strategy
// ────────────────
// WEB:     localStorage (synchronous, quota-limited, sufficient for one design).
// DESKTOP: AppData/editor/snapshot.json (the SOURCE OF TRUTH — durable, survives
//          a hard close / wiped cache / fresh profile) via the editorData IPC
//          channel. Because the boot router (RootGate) reads the snapshot
//          SYNCHRONOUSLY, app start hydrates the AppData snapshot into an
//          in-memory cache (editorDataBoot.js) BEFORE routing; the synchronous
//          accessors here read that cache. Every write updates the cache
//          immediately AND persists to AppData, so reads are always current.
//
// Page data can be large, so `pages` is gzip+base64 compressed (the same codec
// used for server pages_c) to stay well under storage limits.

import { compressData, decompressFromBase64 } from "../common-functions/index.js";
import { desktop, isDesktop } from "../../../desktop/index.js";
import {
  getCachedSnapshotJson,
  setCachedSnapshotJson,
} from "./editorDataBoot.js";

const SNAPSHOT_KEY = "editor_state_snapshot";
const SNAPSHOT_VERSION = 1;
const HISTORY_VERSION = 1;

/**
 * Rounded width/height of a canvas size, or null when unusable. Folds the size
 * into the snapshot's identity so a resume decision is size-aware: opening the
 * SAME theme at a DIFFERENT size does NOT match the previously-edited size's
 * snapshot, so it starts fresh instead of restoring the old size's design.
 *
 * Only width/height are compared (not depth/dpi/margins): the Design Selection
 * size deep-link carries `size_w`/`size_h`, and `setupThemeFromURL` sets
 * `canvasSize.width/height` from exactly those values, so width×height is the one
 * dimension pair that is guaranteed to agree on both sides of the RootGate match.
 */
const snapshotSizeWH = (canvasSize) => {
  if (!canvasSize) return null;
  const width = Math.round(Number(canvasSize.width) || 0);
  const height = Math.round(Number(canvasSize.height) || 0);
  if (!width || !height) return null;
  return { width, height };
};

// True when AppData is the snapshot store (desktop with the bridge present).
const isAppDataStore = () => isDesktop && !!desktop?.editorData;

// The editorData bridge, only when the undo-history channels are present (guards
// against a stale preload that predates them).
const historyStore = () =>
  isDesktop && typeof desktop?.editorData?.historySet === "function"
    ? desktop.editorData
    : null;

/**
 * Build the editor params query string that re-establishes the deep-link for a
 * restored design (so RootGate / useInitializeProject behave consistently and
 * the existing server auto-save targets the right project). The auth token is
 * intentionally NOT stored — it is re-attached from the live session at resume.
 */
const buildEditorParams = (snap) => {
  const params = new URLSearchParams();
  if (snap.themeId) params.set("t_id", snap.themeId);
  if (snap.cartOrderId) params.set("c_id", snap.cartOrderId);
  if (snap.cat) params.set("cat", snap.cat);
  return params.toString();
};

// ── Low-level read/write (desktop = AppData cache, web = localStorage) ────────

/** Synchronous read of the raw snapshot JSON string (or null). On desktop this
 *  reads the in-memory cache hydrated from AppData at boot. */
const readRawSnapshot = () => {
  if (isAppDataStore()) return getCachedSnapshotJson();
  try {
    return localStorage.getItem(SNAPSHOT_KEY);
  } catch (_) {
    return null;
  }
};

/** Persist a snapshot object. On desktop this writes to the in-memory cache
 *  (so the next synchronous read is current) AND to AppData (durable). On web it
 *  writes localStorage. */
const writeSnapshot = (snapshot) => {
  const json = JSON.stringify(snapshot);
  if (isAppDataStore()) {
    setCachedSnapshotJson(json);
    // AppData is the durable store; fire-and-forget (best-effort, never blocks).
    desktop.editorData.snapshotSet(json).catch(() => {});
    return;
  }
  localStorage.setItem(SNAPSHOT_KEY, json);
};

/**
 * Persist a snapshot of the current editor working state.
 *
 * `state` is the slice of state we need to fully rebuild the editor offline:
 *   { pages, canvasSize, editorType, orientation, settings, calendarSettings,
 *     minPages, maxPages, activeSide, textGroups, themeImagesBlanked,
 *     themeId, themeName, cartOrderId, cat }
 *
 * Returns true on success. Silently no-ops (returns false) if there are no
 * meaningful pages to save or storage is unavailable.
 */
export const saveEditorSnapshot = (state) => {
  try {
    if (!state || !Array.isArray(state.pages) || state.pages.length === 0) {
      return false;
    }
    // Only snapshot a real design: at least one page must carry a layout.
    const hasContent = state.pages.some(
      (p) => Array.isArray(p?.layout) && p.layout.length > 0
    );
    if (!hasContent) return false;

    const snapshot = {
      v: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      // Library entry id this snapshot belongs to, so a crash/close RESUME keeps
      // UPDATING the same Saved Designs entry instead of forking a duplicate on
      // every relaunch. Critical for local-only designs (no server theme/cart
      // identity to re-derive from). Mirrors stageSnapshotFromEntry.
      libraryId: state.libraryId || null,
      // identity / deep-link
      themeId: state.themeId || null,
      themeName: state.themeName || null,
      cartOrderId: state.cartOrderId || null,
      cat: state.cat || null,
      // working state. Reuse a caller-provided compressed payload when present
      // (the Saved Designs library save compresses the same pages) so a tick
      // compresses once, not twice.
      pages_c: state.pages_c || compressData(JSON.stringify(state.pages)),
      canvasSize: state.canvasSize || null,
      editorType: state.editorType || null,
      orientation: state.orientation || null,
      settings: state.settings || null,
      calendarSettings: state.calendarSettings || null,
      minPages: state.minPages,
      maxPages: state.maxPages,
      activeSide: state.activeSide,
      textGroups: state.textGroups || {},
      themeImagesBlanked: !!state.themeImagesBlanked,
    };
    writeSnapshot(snapshot);
    return true;
  } catch (_) {
    // Quota exceeded / storage unavailable — resume just won't be remembered.
    return false;
  }
};

/**
 * Like saveEditorSnapshot, but on desktop AWAITS the AppData write so the caller
 * can rely on the snapshot being durably on disk before it returns.
 *
 * The periodic snapshot (useEditorSnapshot) is fire-and-forget — fine because the
 * renderer stays alive between 15s ticks, so the async IPC lands. An EXPLICIT
 * "Update Theme / Save Theme" is different: the user may reload (Ctrl+R) or quit
 * the app moments later, before the fire-and-forget write flushes, and the reload
 * re-hydrates the restore store from AppData (a fresh renderer's in-memory cache
 * is empty). Awaiting the write guarantees the just-saved design is what a reload
 * restores — so a local save survives reload the way the old API save did.
 * Returns true on success (or web, where localStorage is already synchronous).
 */
export const saveEditorSnapshotDurable = async (state) => {
  const ok = saveEditorSnapshot(state);
  if (!ok) return false;
  if (isAppDataStore()) {
    try {
      const raw = getCachedSnapshotJson();
      if (raw) await desktop.editorData.snapshotSet(raw);
    } catch (_) {
      // Best-effort: saveEditorSnapshot already fired the write; the await is
      // only to confirm durability before an imminent reload/quit.
    }
  }
  return true;
};

/**
 * Lightweight, synchronous read of ONLY the snapshot's `cat` (design category)
 * so an explicit save can preserve it when re-writing the snapshot without
 * decompressing the page payload. Returns null when there's no usable snapshot.
 */
export const getEditorSnapshotCat = () => {
  try {
    const raw = readRawSnapshot();
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== SNAPSHOT_VERSION) return null;
    return snap.cat || null;
  } catch (_) {
    return null;
  }
};

/**
 * Stage an ALREADY-COMPRESSED snapshot into the active snapshot slot, so the
 * existing restore pipeline (RootGate → restore=1 → useEditorSnapshot) can open
 * it without any new restore code. Used by the Saved Designs browser to "Go to
 * Editor" on a chosen library design.
 *
 * `entry` must carry a compressed `pages_c` plus the same working-state fields
 * saveEditorSnapshot persists; we re-stamp the version/savedAt and drop any
 * library-only display metadata. Returns true on success.
 */
export const stageSnapshotFromEntry = (entry) => {
  try {
    if (!entry || !entry.pages_c) return false;
    const snapshot = {
      v: SNAPSHOT_VERSION,
      savedAt: entry.savedAt || entry.updatedAt || Date.now(),
      // Carry the library entry id so the editor keeps updating THIS saved design
      // (not a fresh duplicate) on subsequent auto-saves — matters for local-only
      // designs that have no server theme/cart identity to key on.
      libraryId: entry.id || null,
      themeId: entry.themeId || null,
      themeName: entry.themeName || null,
      cartOrderId: entry.cartOrderId || null,
      cat: entry.cat || null,
      pages_c: entry.pages_c,
      canvasSize: entry.canvasSize || null,
      editorType: entry.editorType || null,
      orientation: entry.orientation || null,
      settings: entry.settings || null,
      calendarSettings: entry.calendarSettings || null,
      minPages: entry.minPages,
      maxPages: entry.maxPages,
      activeSide: entry.activeSide,
      textGroups: entry.textGroups || {},
      themeImagesBlanked: !!entry.themeImagesBlanked,
    };
    writeSnapshot(snapshot);
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Read and decode the persisted snapshot, or null if none / unusable. The
 * returned object carries the decompressed `pages` array (ready to dispatch via
 * applyTheme) plus all the working-state fields and an `editorParams` query.
 *
 * Synchronous — on desktop it reads the in-memory cache hydrated from AppData at
 * boot, so the restore decision is correct on the first paint.
 */
export const readEditorSnapshot = () => {
  try {
    const raw = readRawSnapshot();
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== SNAPSHOT_VERSION || !snap.pages_c) return null;
    const decoded = decompressFromBase64(snap.pages_c);
    const pages = Array.isArray(decoded) ? decoded : decoded?.pages;
    if (!Array.isArray(pages) || pages.length === 0) return null;
    return {
      ...snap,
      pages,
      editorParams: buildEditorParams(snap),
    };
  } catch (_) {
    return null;
  }
};

/**
 * Lightweight existence check used by RootGate to decide whether to resume into
 * the editor. Avoids decompressing the (potentially large) page payload.
 * Synchronous — reads the hydrated cache on desktop, localStorage on web.
 */
export const hasEditorSnapshot = () => {
  try {
    const raw = readRawSnapshot();
    if (!raw) return false;
    const snap = JSON.parse(raw);
    return !!(snap && snap.v === SNAPSHOT_VERSION && snap.pages_c);
  } catch (_) {
    return false;
  }
};

/**
 * Lightweight, synchronous read of ONLY the snapshot's design identity
 * (themeId / cartOrderId / sizeKey) — no page decompression. RootGate uses this
 * to decide whether an editor deep-link reload (`?t_id=…` / `?c_id=…` + the
 * `size_*` params) points at the SAME design AT THE SAME SIZE the local snapshot
 * holds. When it matches, RootGate resumes from the snapshot (offline-capable,
 * keeps unsaved edits) instead of re-fetching from the server; when it does NOT
 * match — including the SAME theme opened at a DIFFERENT size — the deep-link
 * loads that design fresh. Returns null when there is no usable snapshot.
 *
 * `size` ({ width, height }) is derived from the stored `canvasSize` (not a
 * persisted field) so it is correct for snapshots written before size was part
 * of the identity. It is null for a cart-order design (its `cart:<id>` key
 * already pins one size) so the size never gates a `c_id` resume.
 */
export const getEditorSnapshotIdentity = () => {
  try {
    const raw = readRawSnapshot();
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== SNAPSHOT_VERSION || !snap.pages_c) return null;
    return {
      themeId: snap.themeId || null,
      cartOrderId: snap.cartOrderId || null,
      size: snap.cartOrderId ? null : snapshotSizeWH(snap.canvasSize),
    };
  } catch (_) {
    return null;
  }
};

/** Forget the snapshot (explicit leave to Design Selection / logout).
 *  Clears the AppData store + cache on desktop, localStorage on web. */
export const clearEditorSnapshot = () => {
  // The persisted undo/redo history belongs to the same design as the snapshot —
  // drop it together so a later resume can't apply a stale stack.
  clearCanvasHistory();
  if (isAppDataStore()) {
    setCachedSnapshotJson(null);
    desktop.editorData.snapshotClear().catch(() => {});
    return;
  }
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch (_) {
    /* ignore */
  }
};

// ── Full undo/redo history (desktop only) ────────────────────────────────────
// The active snapshot above stores only the CURRENT design (present). To resume
// the whole 300-step undo/redo stack, we ALSO persist the entire undoable canvas
// state ({ past, present, future, … }) as one gzip'd payload in a SEPARATE
// AppData file (editor/history.json). It is desktop-only (far too large for
// localStorage) and loaded ASYNC after boot, never on the synchronous RootGate
// path. Best-effort throughout: any failure just falls back to a cleared history
// (today's behavior).

// ── Deferred-write coordination ──────────────────────────────────────────────
// The periodic snapshot (useEditorSnapshot) DEFERS its history write to idle time
// (requestIdleCallback, up to 5s). An EXPLICIT durable save
// (persistCanvasHistoryDurable, via saveCurrentEditorToLibrary) writes the same
// history.json immediately. If the queued idle write lands AFTER the durable one
// it clobbers history.json with older tick-time state — a restore right after
// would then reinstate a stale undo stack (and, via canvas/restoreHistory, stale
// pages). The two writers live in different modules, so the single pending
// deferred task is tracked here at MODULE scope: the scheduler registers it, and
// the durable writer cancels it before writing so the durable write wins.
let pendingHistoryTask = null;

/** Register the currently-queued deferred history write (replacing any prior). */
export const registerPendingHistoryTask = (task) => {
  cancelPendingHistoryTask();
  pendingHistoryTask = task || null;
};

/** Cancel + forget any queued deferred history write. Safe to call repeatedly. */
export const cancelPendingHistoryTask = () => {
  const task = pendingHistoryTask;
  pendingHistoryTask = null;
  if (task) {
    try {
      task.cancel();
    } catch (_) {
      /* ignore */
    }
  }
};

// Build the history payload (compressing the whole undoable canvas state), or
// null when the state is unusable. Shared by the fire-and-forget persister and
// the durable variant below.
const buildHistoryPayload = (canvasState, identity) => {
  if (
    !canvasState ||
    typeof canvasState !== "object" ||
    !canvasState.present ||
    !Array.isArray(canvasState.past)
  ) {
    return null;
  }
  const canvas_c = compressData(JSON.stringify(canvasState));
  return {
    v: HISTORY_VERSION,
    savedAt: Date.now(),
    themeId: identity?.themeId || null,
    cartOrderId: identity?.cartOrderId || null,
    canvas_c,
  };
};

/**
 * Persist the full undoable canvas state so a reopen can restore the entire
 * undo/redo stack. `canvasState` is `store.getState().canvas` (the redux-undo
 * wrapper state). `identity` ({ themeId, cartOrderId }) tags the payload so
 * restore only applies history that belongs to the resumed design. Fire-and-
 * forget; returns false when unavailable (web / stale preload / no history).
 */
export const persistCanvasHistory = (canvasState, identity) => {
  const api = historyStore();
  if (!api) return false;
  try {
    const payload = buildHistoryPayload(canvasState, identity);
    if (!payload) return false;
    api.historySet(JSON.stringify(payload)).catch(() => {});
    return true;
  } catch (_) {
    // Compression/serialization failure — resume just won't have the deep stack.
    return false;
  }
};

/**
 * Durable variant of persistCanvasHistory: AWAITS the AppData write so the full
 * undo/redo stack is on disk before the returned promise resolves.
 *
 * This MUST be paired with saveEditorSnapshotDurable on an explicit save. The
 * resume applies the snapshot first, then OVERWRITES its pages with this
 * persisted history's `present` (canvas/restoreHistory). If the snapshot were
 * refreshed on save but the history left stale, the resume would clobber the
 * just-saved pages with the older stack — so both must be written from the SAME
 * store state at save time. Returns false on failure / when unavailable
 * (web / stale preload).
 */
export const persistCanvasHistoryDurable = async (canvasState, identity) => {
  const api = historyStore();
  if (!api) return false;
  // Cancel any deferred idle history write queued by the periodic snapshot so it
  // cannot land AFTER this durable write and clobber history.json with older state.
  cancelPendingHistoryTask();
  try {
    const payload = buildHistoryPayload(canvasState, identity);
    if (!payload) return false;
    await api.historySet(JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Read + decode the persisted undoable canvas state. Async (AppData IPC).
 * Returns `{ themeId, cartOrderId, size, canvasState }` or null when there is
 * nothing usable. `canvasState` is ready to install via the
 * `canvas/restoreHistory` action.
 *
 * `size` ({ width, height }) is derived from the decoded state's own
 * `present.canvasSize` (not a persisted tag), so the resume can reject a history
 * file left over from the SAME theme at a DIFFERENT size — installing it would
 * clobber the restored pages with the wrong size's undo stack. Null for a
 * cart-order design (its identity already pins one size).
 */
export const readCanvasHistory = async () => {
  const api = historyStore();
  if (!api) return null;
  try {
    const raw = await api.historyGet();
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || payload.v !== HISTORY_VERSION || !payload.canvas_c) return null;
    const canvasState = decompressFromBase64(payload.canvas_c);
    if (
      !canvasState ||
      typeof canvasState !== "object" ||
      !canvasState.present ||
      !Array.isArray(canvasState.past)
    ) {
      return null;
    }
    return {
      themeId: payload.themeId || null,
      cartOrderId: payload.cartOrderId || null,
      size: payload.cartOrderId ? null : snapshotSizeWH(canvasState.present.canvasSize),
      savedAt: payload.savedAt || 0,
      canvasState,
    };
  } catch (_) {
    return null;
  }
};

/** Forget the persisted history (desktop only). Best-effort. */
export const clearCanvasHistory = () => {
  const api = historyStore();
  if (!api) return;
  try {
    api.historyClear().catch(() => {});
  } catch (_) {
    /* ignore */
  }
};
