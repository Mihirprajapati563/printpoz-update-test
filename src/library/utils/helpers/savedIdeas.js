// ── Saved Ideas library (customer "Save as Idea") ────────────────────────────
// A local, API-free library of page/spread "ideas" the customer saved from the
// editor. Each entry is a single compressed layout (the same `{ layout: [...] }`
// shape the Ideas API returns), so the existing Ideas tab render + apply pipeline
// consumes it unchanged. Because everything is stored on-device and read locally,
// saved ideas are available in BOTH offline and online modes.
//
// Storage strategy (mirrors savedDesigns.js):
//   DESKTOP: AppData/editor/ideas.json via the editorData IPC channel (durable,
//            survives cache/localStorage clears; works with no network).
//   WEB:     IndexedDB ("ideas" store). Falls back to localStorage when
//            IndexedDB is unavailable.
//
// Every entry is scoped to the logged-in account (an `acct:<id>|` id prefix), so a
// shared device keeps each account's ideas separate — matching the saved-designs
// library's per-account isolation.
//
// All exported functions are ASYNC (return Promises) and never throw.

import { idbAvailable, idbGetAll, idbPutAcross, idbDeleteAcross } from "./idb.js";
import { desktop, isDesktop } from "../../../desktop/index.js";
import { readStoredUser, isAdminLike } from "./session.js";

const IDEAS_STORE = "ideas"; // web IndexedDB store name
const LS_KEY = "saved_ideas_library"; // web localStorage fallback key
// Keep the most-recent N ideas per account; evict the oldest beyond this.
const MAX_IDEAS = 60;

const desktopApi = () => (isDesktop && desktop?.editorData ? desktop.editorData : null);

// ── Per-account isolation ─────────────────────────────────────────────────────

const SCOPE_PREFIX = "acct:";
const SCOPE_SEP = "|";

const currentAccountId = () => {
  try {
    return readStoredUser()?._id || null;
  } catch (_) {
    return null;
  }
};

const accountScope = () => {
  const id = currentAccountId();
  return id ? `${SCOPE_PREFIX}${id}${SCOPE_SEP}` : "";
};

/**
 * True if a stored idea id should appear in the CURRENT account's library:
 *   • no account context yet → don't filter (show all),
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

// App runtime, so Date.now()/Math.random() are fine here.
const mintIdeaId = () =>
  `${accountScope()}idea:${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// ── localStorage fallback (web, no IndexedDB) ────────────────────────────────

const readLegacy = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
};

const writeLegacy = (arr) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    return true;
  } catch (_) {
    return false;
  }
};

// ── shaping ───────────────────────────────────────────────────────────────────

const byUpdatedDesc = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

// Trim the current account's ideas to MAX_IDEAS, keeping the newest. `all` is the
// complete cross-account list; returns { kept, evictedIds } where kept preserves
// other accounts' entries untouched.
const capForAccount = (all) => {
  const mine = all.filter((i) => idBelongsToCurrentAccount(i.id)).sort(byUpdatedDesc);
  const others = all.filter((i) => !idBelongsToCurrentAccount(i.id));
  if (mine.length <= MAX_IDEAS) return { kept: all, evictedIds: [] };
  const keep = mine.slice(0, MAX_IDEAS);
  const evictedIds = mine.slice(MAX_IDEAS).map((i) => i.id);
  return { kept: [...keep, ...others], evictedIds };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist a captured idea to the local library. `input` carries the content the
 * caller built from the active page/spread:
 *   { editorType, spread, number_of_layouts, number_of_images, width, height,
 *     layout_c, name? }
 * A fresh account-scoped id + timestamps are assigned here. Resolves the stored
 * id on success, or null on failure / empty input.
 */
export const saveIdeaToLibrary = async (input) => {
  try {
    if (!input || !input.layout_c) return null;
    const now = Date.now();
    const entry = {
      id: mintIdeaId(),
      name: input.name || (input.spread ? "Spread idea" : "Page idea"),
      editorType: input.editorType || null,
      spread: !!input.spread,
      number_of_layouts: Number(input.number_of_layouts) || 1,
      number_of_images: Number(input.number_of_images) || 0,
      width: Number(input.width) || 0,
      height: Number(input.height) || 0,
      layout_c: input.layout_c,
      createdAt: now,
      updatedAt: now,
    };

    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api?.ideasPut) {
      await api.ideasPut(entry);
      // Enforce the per-account cap (evict oldest beyond MAX_IDEAS).
      const all = await api.ideasList().catch(() => []);
      const { evictedIds } = capForAccount(all || []);
      await Promise.all(evictedIds.map((id) => api.ideasDelete(id).catch(() => {})));
      return entry.id;
    }

    // ── Web: IndexedDB ────────────────────────────────────────────
    if (idbAvailable()) {
      await idbPutAcross([{ store: IDEAS_STORE, value: entry }]);
      const all = (await idbGetAll(IDEAS_STORE).catch(() => [])) || [];
      const { evictedIds } = capForAccount(all);
      await Promise.all(
        evictedIds.map((id) => idbDeleteAcross([IDEAS_STORE], id).catch(() => {}))
      );
      return entry.id;
    }

    // ── Web: localStorage fallback ────────────────────────────────
    const next = [entry, ...readLegacy().filter((i) => i.id !== entry.id)];
    const { kept } = capForAccount(next);
    return writeLegacy(kept) ? entry.id : null;
  } catch (_) {
    return null;
  }
};

/** List the current account's saved ideas, newest-first (full records). */
export const listSavedIdeas = async () => {
  try {
    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api?.ideasList) {
      const items = await api.ideasList().catch(() => []);
      return (items || [])
        .filter((i) => idBelongsToCurrentAccount(i.id))
        .sort(byUpdatedDesc);
    }

    // ── Web: IndexedDB ────────────────────────────────────────────
    if (idbAvailable()) {
      const items = (await idbGetAll(IDEAS_STORE).catch(() => [])) || [];
      return items
        .filter((i) => idBelongsToCurrentAccount(i.id))
        .sort(byUpdatedDesc);
    }

    // ── Web: localStorage fallback ────────────────────────────────
    return readLegacy()
      .filter((i) => idBelongsToCurrentAccount(i.id))
      .sort(byUpdatedDesc);
  } catch (_) {
    return [];
  }
};

/** Remove one saved idea by id. Resolves true on success. */
export const removeSavedIdea = async (id) => {
  if (!id) return false;
  try {
    // ── Desktop path ──────────────────────────────────────────────
    const api = desktopApi();
    if (api?.ideasDelete) {
      await api.ideasDelete(id);
      return true;
    }

    // ── Web: IndexedDB ────────────────────────────────────────────
    if (idbAvailable()) {
      await idbDeleteAcross([IDEAS_STORE], id);
      return true;
    }

    // ── Web: localStorage fallback ────────────────────────────────
    return writeLegacy(readLegacy().filter((i) => i.id !== id));
  } catch (_) {
    return false;
  }
};
