// ── Saved Designs library (persistent, multi-design) ─────────────────────────
// A local library of the user's design projects, shown on the Design Selection
// page under "Your Saved Designs". Each entry is a full, restorable snapshot of
// an editor session plus a small preview thumbnail and display metadata.
//
// Storage strategy
// ────────────────
// DESKTOP: AppData/editor/designs/ via the editorData IPC channel (durable,
//          large-quota, survives cache/localStorage clears).
// WEB:     IndexedDB (disk-backed, large-quota). Falls back to localStorage when
//          IndexedDB is unavailable.
//
// How this differs from the single crash/offline snapshot (editorSnapshot.js):
//   • editorSnapshot.js holds exactly ONE in-progress design and is CLEARED the
//     moment the user returns to Design Selection.
//   • This library holds MANY designs and is NEVER cleared on leave.
//
// Records are logically split into lightweight card metadata (id, name,
// thumbnail, type, timestamps) and a heavy payload (compressed pages + working
// state). listSavedDesigns returns only metadata (fast listing); getDesignById /
// stageDesignForRestore load the payload on demand.
//
// All exported functions are ASYNC (return Promises).

import { compressData, decompressFromBase64 } from "../common-functions/index.js";
import { stageSnapshotFromEntry } from "./editorSnapshot.js";
import {
  idbAvailable,
  idbGet,
  idbGetAll,
  idbPutAcross,
  idbDeleteAcross,
} from "./idb.js";
import { desktop, isDesktop } from "../../../desktop/index.js";
import { readStoredUser, isAdminLike } from "./session.js";

const META_STORE = "designs_meta";
const PAYLOAD_STORE = "designs_payload";
const LIBRARY_KEY = "saved_designs_library"; // legacy localStorage key (migration + fallback)
const LIBRARY_VERSION = 1;
const MIGRATED_FLAG = "saved_designs_migrated_to_idb";
// Keep the most-recent N designs; evict the oldest beyond this to respect quota.
const MAX_DESIGNS = 24;

// ── Desktop detection ─────────────────────────────────────────────────────────

const desktopApi = () => (isDesktop && desktop?.editorData ? desktop.editorData : null);

// ── Per-account isolation ─────────────────────────────────────────────────────
// Every design is scoped to the logged-in account, so a single device shared by
// an admin and a regular user (or several users) keeps SEPARATE Saved Designs
// libraries — each account only ever sees and manages its own designs. The
// account id (`userDetails._id`, the same value sent as the x-user-id API header)
// is folded into the design id as an `acct:<id>|` prefix, so:
//   • two accounts editing the SAME theme get DISTINCT entries (no id collision /
//     silent overwrite), and
//   • the list can be filtered to just the current account by id prefix — no
//     backend/IPC change needed (this works identically for web IndexedDB and
//     desktop AppData, since every read/write flows through THIS module).
// Ids created before this existed (no `acct:` prefix) are "legacy": shown to
// admin-like accounts only, so an admin's pre-existing library survives while
// regular users start clean.

const SCOPE_PREFIX = "acct:";
const SCOPE_SEP = "|";

/** The current account id (isolation key), or null when none is known. */
const currentAccountId = () => {
  try {
    return readStoredUser()?._id || null;
  } catch (_) {
    return null;
  }
};

/** `acct:<id>|` for the current account, or "" when no account is known. */
const accountScope = () => {
  const id = currentAccountId();
  return id ? `${SCOPE_PREFIX}${id}${SCOPE_SEP}` : "";
};

/** Prefix a base design id (`theme:…`/`cart:…`/`local:…`) with the account scope. */
const scopeDesignId = (baseId) => (baseId ? `${accountScope()}${baseId}` : baseId);

/** Drop a leading `acct:<id>|` scope from an id, returning the base id. */
const stripScope = (id) => {
  if (typeof id !== "string" || !id.startsWith(SCOPE_PREFIX)) return id;
  const sep = id.indexOf(SCOPE_SEP);
  return sep === -1 ? id : id.slice(sep + 1);
};

/**
 * True if a stored design id should appear in the CURRENT account's library:
 *   • no account context yet (tests / pre-login) → don't filter (show all),
 *   • id carries THIS account's scope → mine,
 *   • id has NO scope (legacy) → visible to admin-like accounts only,
 *   • id carries ANOTHER account's scope → hidden.
 */
const idBelongsToCurrentAccount = (id) => {
  if (!id) return false;
  const uid = currentAccountId();
  if (!uid) return true;
  if (id.startsWith(`${SCOPE_PREFIX}${uid}${SCOPE_SEP}`)) return true;
  if (!id.startsWith(SCOPE_PREFIX)) return isAdminLike(readStoredUser());
  return false;
};

/**
 * Extract the raw local id from a (possibly account-scoped) library id, or null
 * if it isn't a local-design id. The resume path uses this to re-adopt a local
 * design's session id regardless of scope.
 */
export const localIdFromLibraryId = (libraryId) => {
  const base = stripScope(libraryId);
  return typeof base === "string" && base.startsWith("local:")
    ? base.slice("local:".length)
    : null;
};

// ── Active local design id ────────────────────────────────────────────────────
// A design with NO server identity yet (a brand-new theme that hasn't been saved
// to the API) is tracked in the library under a session-stable `local:<id>` key.
// The id lives here (module scope) — not inside useEditorSnapshot — so BOTH the
// snapshot auto-save AND the Create Theme dialog's local-creation fallback write
// to the SAME library entry instead of forking duplicates. Lifecycle:
//   • reset on every editor mount (a fresh session is a fresh design),
//   • adopted from the staged snapshot's libraryId when resuming a local design,
//   • cleared once the design gains a server id and its local entry is retired.
// App runtime, so Date.now/Math.random are fine here (not a workflow sandbox).

let activeLocalDesignId = null;

/** Lazily mint (or return) the session's local design id. */
export const ensureActiveLocalDesignId = () => {
  if (!activeLocalDesignId) {
    activeLocalDesignId = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }
  return activeLocalDesignId;
};

/** The current local design id WITHOUT minting one (null when none). */
export const peekActiveLocalDesignId = () => activeLocalDesignId;

/** Adopt the id of a restored local design so auto-saves keep updating it. */
export const adoptActiveLocalDesignId = (id) => {
  activeLocalDesignId = id || null;
};

/** Forget the local id (new editor session / design became server-backed). */
export const resetActiveLocalDesignId = () => {
  activeLocalDesignId = null;
};

// ── entry shaping ─────────────────────────────────────────────────────────────

const toMeta = (entry) => ({
  id: entry.id,
  name: entry.name || "Untitled design",
  size: entry.size || null,
  editorType: entry.editorType || null,
  cat: entry.cat || null,
  thumbnail: entry.thumbnail || null,
  createdAt: entry.createdAt || entry.savedAt || 0,
  updatedAt: entry.updatedAt || entry.savedAt || 0,
});

const toPayload = (entry) => ({
  id: entry.id,
  themeId: entry.themeId || null,
  themeName: entry.themeName || null,
  cartOrderId: entry.cartOrderId || null,
  pages_c: entry.pages_c,
  canvasSize: entry.canvasSize || null,
  orientation: entry.orientation || null,
  settings: entry.settings || null,
  calendarSettings: entry.calendarSettings || null,
  minPages: entry.minPages,
  maxPages: entry.maxPages,
  activeSide: entry.activeSide,
  textGroups: entry.textGroups || {},
  themeImagesBlanked: !!entry.themeImagesBlanked,
  savedAt: entry.savedAt || entry.updatedAt || 0,
});

const joinEntry = (meta, payload) => ({ ...payload, ...meta });

// ── legacy localStorage (migration + fallback) ───────────────────────────────

const readLegacyLibrary = () => {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return { v: LIBRARY_VERSION, designs: [] };
    const lib = JSON.parse(raw);
    if (!lib || lib.v !== LIBRARY_VERSION || !Array.isArray(lib.designs)) {
      return { v: LIBRARY_VERSION, designs: [] };
    }
    return lib;
  } catch (_) {
    return { v: LIBRARY_VERSION, designs: [] };
  }
};

const writeLegacyLibrary = (lib) => {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
    return true;
  } catch (_) {
    return false;
  }
};

// ── IndexedDB migration (web only) ───────────────────────────────────────────

let migrationPromise = null;
const ensureMigrated = async () => {
  if (!idbAvailable()) return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    try {
      if (localStorage.getItem(MIGRATED_FLAG)) return;
      const legacy = readLegacyLibrary();
      if (legacy.designs.length > 0) {
        await idbPutAcross(
          legacy.designs.flatMap((d) => [
            { store: META_STORE, value: toMeta(d) },
            { store: PAYLOAD_STORE, value: toPayload(d) },
          ])
        );
      }
      localStorage.setItem(MIGRATED_FLAG, "1");
      try { localStorage.removeItem(LIBRARY_KEY); } catch (_) { /* ignore */ }
    } catch (_) {
      // Migration failed — leave the legacy blob; reads fall back to it.
    }
  })();
  return migrationPromise;
};

// Id-safe size key from the canvas size. Two designs from the SAME theme but a
// DIFFERENT chosen size must be distinct library entries, so the size is part of
// the id. Raw canvas dims (photobook stores a doubled/spread width) are fine
// here — the key only needs to be stable + unique per size.
const sizeKeyOf = (canvasSize) => {
  if (!canvasSize) return null;
  const w = Math.round(Number(canvasSize.width) || 0);
  const h = Math.round(Number(canvasSize.height) || 0);
  if (!w || !h) return null;
  const d = Math.round(Number(canvasSize.depth) || 0);
  return d > 0 ? `${w}x${h}x${d}` : `${w}x${h}`;
};

// Human-friendly size label shown on the design card. Prefer the EXACT label the
// user picked in the size modal (carried on `canvasSize.sizeLabel` — this matches
// a predefined "W × H px" AND a custom unit label like "8 × 8 in" verbatim). Fall
// back to the raw pixel dimensions in the SAME format the modal uses for
// predefined sizes, so it always agrees with what the user chose. Do NOT halve
// for photobook/layflat — the modal shows the stored variant width as-is, so the
// card must too, or the numbers won't match.
const displaySizeLabel = (canvasSize) => {
  if (!canvasSize) return "";
  if (canvasSize.sizeLabel) return String(canvasSize.sizeLabel);
  const w = Math.round(Number(canvasSize.width) || 0);
  const h = Math.round(Number(canvasSize.height) || 0);
  if (!w || !h) return "";
  return `${w} × ${h} px`;
};

/**
 * Stable id for a design so repeated auto-saves UPDATE the same library entry
 * rather than appending duplicates. For a THEME-based design the chosen size is
 * part of the id, so the SAME theme opened at DIFFERENT sizes yields SEPARATE
 * library entries. (A cart order is already unique per project; a local design
 * carries its own unique id.)
 */
export const deriveDesignId = ({ themeId, cartOrderId, localId, canvasSize } = {}) => {
  let base = null;
  if (cartOrderId) {
    base = `cart:${cartOrderId}`;
  } else if (themeId) {
    const sizeKey = sizeKeyOf(canvasSize);
    base = sizeKey ? `theme:${themeId}:${sizeKey}` : `theme:${themeId}`;
  } else if (localId) {
    base = `local:${localId}`;
  }
  // Scope to the logged-in account so libraries never collide/leak across users.
  return scopeDesignId(base);
};

const buildEntry = (state, existingMeta) => {
  const now = Date.now();
  return {
    id: state.id,
    name: state.themeName || existingMeta?.name || "Untitled design",
    size: displaySizeLabel(state.canvasSize) || existingMeta?.size || null,
    editorType: state.editorType || existingMeta?.editorType || null,
    cat: state.cat || existingMeta?.cat || null,
    thumbnail: state.thumbnail || existingMeta?.thumbnail || null,
    createdAt: existingMeta?.createdAt || now,
    updatedAt: now,
    themeId: state.themeId || null,
    themeName: state.themeName || null,
    cartOrderId: state.cartOrderId || null,
    pages_c: state.pages_c || compressData(JSON.stringify(state.pages)),
    canvasSize: state.canvasSize || null,
    orientation: state.orientation || null,
    settings: state.settings || null,
    calendarSettings: state.calendarSettings || null,
    minPages: state.minPages,
    maxPages: state.maxPages,
    activeSide: state.activeSide,
    textGroups: state.textGroups || {},
    themeImagesBlanked: !!state.themeImagesBlanked,
    savedAt: now,
  };
};

// ── Desktop implementation ────────────────────────────────────────────────────

const saveDesignDesktop = async (api, state) => {
  // Load the existing meta (for createdAt / display name carry-over).
  const existingFull = await api.designsGet(state.id).catch(() => null);
  const entry = buildEntry(state, existingFull);
  await api.designsPut(entry);

  // Enforce cap: evict oldest beyond MAX_DESIGNS — but only among THIS account's
  // designs, so a busy account can never evict another account's entries.
  const metas = (await api.designsList().catch(() => [])).filter((m) =>
    idBelongsToCurrentAccount(m.id)
  );
  if (metas.length > MAX_DESIGNS) {
    const sorted = metas
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const evict = sorted.slice(MAX_DESIGNS);
    await Promise.all(evict.map((m) => api.designsDelete(m.id).catch(() => {})));
  }
  return entry.id;
};

// ── Public API ────────────────────────────────────────────────────────────────

// Tracks the most recent in-flight library write so callers (e.g. the Design
// Selection page, mounting right after the editor unmounts) can AWAIT a pending
// save before listing — otherwise the fire-and-forget save from the editor's
// unmount may not have landed yet and the new design would be missing until a
// manual refresh. See flushSavedDesigns().
let pendingSavePromise = Promise.resolve();

/**
 * Resolve once any in-flight saveDesignToLibrary write has settled. Used to
 * guarantee a freshly-edited design is on disk before the library is listed.
 * Always resolves (never rejects).
 */
export const flushSavedDesigns = () => pendingSavePromise.catch(() => {});

/**
 * Upsert a design into the library. `state` is the same working-state shape
 * saveEditorSnapshot consumes, plus an `id` (from deriveDesignId) and optional
 * `thumbnail` / `pages_c`. Resolves the stored entry's id on success, null on
 * failure or if there is no meaningful content.
 *
 * `opts`:
 *   • allowEmpty    — store the design even when it has no real content yet.
 *     Reserved for an EXPLICIT user "Save" (saveCurrentEditorToLibrary): if the
 *     user deliberately clicks Save, persist what they have. Auto-creation flows
 *     (New Design / New Theme dialogs) and the periodic auto-save do NOT pass it,
 *     so a design only appears in "Your Designs" once it has real content — no
 *     blank, thumbnail-less placeholder cards.
 *   • supersedesId  — a previous library id this save replaces. Used when a
 *     local-only design gains its server identity (theme/cart id): the entry
 *     re-keys from `local:<id>` to `theme:<id>:…`, and the stale local entry is
 *     removed so the design doesn't show twice.
 */
export const saveDesignToLibrary = (state, opts = {}) => {
  // Run the actual write and record it as the pending save so flushSavedDesigns()
  // can await it. We keep the previous pending save in the chain so a flush waits
  // for ALL outstanding writes, not just the latest.
  const run = (async () => {
    const savedId = await _saveDesignToLibrary(state, opts);
    if (savedId && opts.supersedesId && opts.supersedesId !== savedId) {
      await removeSavedDesign(opts.supersedesId).catch(() => {});
      // The design is server-backed now — the session's local id is retired.
      // Compare via deriveDesignId so the scoped forms line up (the supersedesId
      // is the account-scoped `acct:<id>|local:<localId>`).
      if (opts.supersedesId === deriveDesignId({ localId: peekActiveLocalDesignId() })) {
        resetActiveLocalDesignId();
      }
    }
    return savedId;
  })();
  pendingSavePromise = Promise.allSettled([pendingSavePromise, run]);
  return run;
};

const _saveDesignToLibrary = async (state, opts = {}) => {
  try {
    if (!state || !state.id) return null;
    if (!Array.isArray(state.pages) || state.pages.length === 0) return null;
    // "Content" means the user actually put something on a page — at least one
    // object (or a chosen background). A brand-new blank design has a LAYOUT but
    // no objects (`layout: [{ objects: [] }]`); the old `layout.length > 0` check
    // wrongly treated that as content, so every "New Design" created a blank,
    // thumbnail-less card before the user did anything. Require real content so
    // the card appears only once there's something to show (and a real
    // thumbnail). Crash-resume (editorSnapshot) is unaffected — it has its own
    // guard and still snapshots blank in-progress designs.
    const layoutHasContent = (l) =>
      !!l &&
      ((Array.isArray(l.objects) && l.objects.length > 0) ||
        (Array.isArray(l.safeAreaObjects) && l.safeAreaObjects.length > 0) ||
        !!(l.background && (l.background.image || l.background.color || l.background.gradient)));
    const hasContent = state.pages.some(
      (p) => Array.isArray(p?.layout) && p.layout.some(layoutHasContent)
    );
    if (!hasContent && !opts.allowEmpty) return null;

    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api) return await saveDesignDesktop(api, state);

    // ── localStorage fallback (no IndexedDB) ──────────────────────
    if (!idbAvailable()) {
      const lib = readLegacyLibrary();
      const existing = lib.designs.find((d) => d.id === state.id);
      const entry = buildEntry(state, existing);
      const next = lib.designs.filter((d) => d.id !== state.id);
      next.unshift(entry);
      // Cap per-account so trimming one account's overflow never drops another's.
      const mine = next
        .filter((d) => idBelongsToCurrentAccount(d.id))
        .slice(0, MAX_DESIGNS);
      const others = next.filter((d) => !idBelongsToCurrentAccount(d.id));
      let ok = writeLegacyLibrary({ ...lib, designs: [...mine, ...others] });
      if (!ok && mine.length > 1) {
        ok = writeLegacyLibrary({
          ...lib,
          designs: [...mine.slice(0, Math.ceil(mine.length / 2)), ...others],
        });
      }
      return ok ? entry.id : null;
    }

    // ── IndexedDB path (web) ──────────────────────────────────────
    await ensureMigrated();
    const existingMeta = await idbGet(META_STORE, state.id).catch(() => null);
    const entry = buildEntry(state, existingMeta);
    await idbPutAcross([
      { store: META_STORE, value: toMeta(entry) },
      { store: PAYLOAD_STORE, value: toPayload(entry) },
    ]);
    // Cap per-account so a busy account never evicts another account's designs.
    const metas = ((await idbGetAll(META_STORE).catch(() => [])) || []).filter(
      (m) => idBelongsToCurrentAccount(m.id)
    );
    if (metas.length > MAX_DESIGNS) {
      const evict = metas
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(MAX_DESIGNS);
      await Promise.all(
        evict.map((m) =>
          idbDeleteAcross([META_STORE, PAYLOAD_STORE], m.id).catch(() => {})
        )
      );
    }
    return entry.id;
  } catch (_) {
    return null;
  }
};

/**
 * List designs for the browser UI — lightweight cards only, newest-first.
 * Resolves an array (empty on failure).
 *
 * Awaits any in-flight save first so a design just edited (and saved on the
 * editor's unmount, right before navigating here) is guaranteed to appear
 * without needing a manual refresh.
 */
export const listSavedDesigns = async () => {
  try {
    await flushSavedDesigns();
    // Every branch keeps ONLY the current account's designs (see
    // idBelongsToCurrentAccount) so a shared device never leaks one user's
    // designs into another's — or an admin's into a regular user's.
    const byUpdatedDesc = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api) {
      const metas = await api.designsList().catch(() => []);
      return metas
        .filter((m) => idBelongsToCurrentAccount(m.id))
        .sort(byUpdatedDesc);
    }

    // ── Web: IndexedDB / localStorage ────────────────────────────
    if (!idbAvailable()) {
      return readLegacyLibrary()
        .designs.map(toMeta)
        .filter((m) => idBelongsToCurrentAccount(m.id))
        .sort(byUpdatedDesc);
    }
    await ensureMigrated();
    const metas = (await idbGetAll(META_STORE)) || [];
    return metas
      .map(toMeta)
      .filter((m) => idBelongsToCurrentAccount(m.id))
      .sort(byUpdatedDesc);
  } catch (_) {
    return [];
  }
};

// Internal: load the full entry for one id (meta + payload joined).
const getFullEntry = async (id) => {
  // ── Desktop path ──────────────────────────────────────────────
  const api = desktopApi();
  if (api) {
    return api.designsGet(id).catch(() => null);
  }

  // ── Web: IndexedDB / localStorage ────────────────────────────
  if (!idbAvailable()) {
    return readLegacyLibrary().designs.find((d) => d.id === id) || null;
  }
  await ensureMigrated();
  const [meta, payload] = await Promise.all([
    idbGet(META_STORE, id).catch(() => null),
    idbGet(PAYLOAD_STORE, id).catch(() => null),
  ]);
  if (!payload) return null;
  return joinEntry(meta || { id }, payload);
};

/**
 * Fully hydrate one design (decompress pages) into the shape the editor restore
 * pipeline consumes. Resolves null if missing or unusable.
 */
export const getDesignById = async (id) => {
  if (!id) return null;
  try {
    const entry = await getFullEntry(id);
    if (!entry || !entry.pages_c) return null;
    const decoded = decompressFromBase64(entry.pages_c);
    const pages = Array.isArray(decoded) ? decoded : decoded?.pages;
    if (!Array.isArray(pages) || pages.length === 0) return null;
    return { ...entry, pages };
  } catch (_) {
    return null;
  }
};

/**
 * Stage a chosen library design into the active snapshot slot so the existing
 * RootGate `restore=1` pipeline opens it in the editor. Resolves true if the
 * design exists and was staged.
 */
export const stageDesignForRestore = async (id) => {
  if (!id) return false;
  try {
    const entry = await getFullEntry(id);
    if (!entry || !entry.pages_c) return false;
    return stageSnapshotFromEntry(entry);
  } catch (_) {
    return false;
  }
};

/** Remove a single design. Resolves true on success. */
export const removeSavedDesign = async (id) => {
  if (!id) return false;
  try {
    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api) {
      await api.designsDelete(id);
      return true;
    }

    // ── Web: IndexedDB / localStorage ────────────────────────────
    if (!idbAvailable()) {
      const lib = readLegacyLibrary();
      const next = lib.designs.filter((d) => d.id !== id);
      if (next.length === lib.designs.length) return false;
      return writeLegacyLibrary({ ...lib, designs: next });
    }
    await ensureMigrated();
    await idbDeleteAcross([META_STORE, PAYLOAD_STORE], id);
    return true;
  } catch (_) {
    return false;
  }
};

/** True if the library has at least one saved design. */
export const hasSavedDesigns = async () => {
  try {
    const list = await listSavedDesigns();
    return list.length > 0;
  } catch (_) {
    return false;
  }
};
