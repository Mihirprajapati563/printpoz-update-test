// Persistent store for user-defined custom canvas sizes used by the theme-load
// "Choose a size" modal. Sizes are saved so every previously-added custom size
// remains available after the app is closed and reopened.
//
// Storage strategy
// ────────────────
// DESKTOP: AppData/editor/sizes.json via the editorData IPC channel (durable,
//          survives localStorage/cache clears).
// WEB:     localStorage key `design_custom_sizes`.
//
// The public API — getCustomSizes / addCustomSize / removeCustomSize — is
// SYNCHRONOUS (callers in ThemeSizeModal and the in-editor resize paths need
// immediate access). Both paths maintain an in-memory mirror of the persisted
// list; reads always come from memory. Writes update memory synchronously then
// fire an async persist (fire-and-forget, best-effort).
//
// DESKTOP async-load contract (the bit that's easy to get wrong)
// ──────────────────────────────────────────────────────────────
// The AppData read is asynchronous, but `getCustomSizes()` is synchronous and a
// consumer can read it before the read resolves (the size modal is mounted at
// page load and reads the list in its `useState` initialiser). Until the read
// resolves the in-memory mirror stays `null` and synchronous reads return an
// EMPTY list WITHOUT caching it — caching `[]` here would be indistinguishable
// from "the user has no custom sizes" and a write in that window would overwrite
// the real AppData list (the bug this module guards against: sizes vanishing on
// reload / when opening a theme). On desktop the helper NEVER falls back to
// localStorage. Consumers should either await `initCustomSizes()` (resolves with
// the loaded list) or `subscribeCustomSizes()` so a component that mounted before
// the load resolved refreshes instead of showing the stale empty snapshot.
//
// On the web, the mirror is populated lazily and synchronously from localStorage
// on first access.

import { desktop, isDesktop } from "../../../desktop/index.js";

const STORAGE_KEY = "design_custom_sizes";

// ── In-memory mirror (newest first) ──────────────────────────────────────────

// null = not yet loaded; [] = loaded and empty.
let customSizes = null;

// Desktop AppData reads are async; dedupe concurrent/repeat loads behind one
// promise so every caller (RootGate, Design Selection, the size modal) awaits
// the same round-trip instead of racing several reads.
let loadPromise = null;

// ── Change notification ───────────────────────────────────────────────────────
// Consumers subscribe to be told when the list first loads from AppData or is
// mutated, so a component that mounted before the async load resolved updates
// instead of rendering a stale (empty) snapshot forever.
const listeners = new Set();

const notify = () => {
  const snapshot = getCustomSizes();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (_) {
      /* a listener throwing is not this module's problem */
    }
  });
};

/** Subscribe to custom-size changes. Returns an unsubscribe function. */
export const subscribeCustomSizes = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ── Desktop helpers ───────────────────────────────────────────────────────────

const desktopApi = () => (isDesktop && desktop?.editorData ? desktop.editorData : null);

const persistToAppData = (sizes) => {
  const api = desktopApi();
  if (!api) return;
  api.sizesSet(sizes).catch(() => {});
};

/**
 * Populate the in-memory cache from the persistent store and resolve with the
 * CURRENT list. On desktop this awaits the AppData read (deduped behind a single
 * promise); on web it reads localStorage synchronously. Idempotent and cheap to
 * call repeatedly — should be awaited once at app start (RootGate / Design
 * Selection mount) AND by the size modal so persisted sizes survive a reload.
 *
 * IMPORTANT: it resolves with `getCustomSizes()` (the live mirror), NOT the
 * snapshot captured when the AppData read first resolved. The read is memoized
 * (`loadPromise`), so a consumer that calls `initCustomSizes().then(list => …)`
 * AFTER a size was added would otherwise receive the STALE first-load list and
 * overwrite its own correct state with it (the "saved size doesn't appear in the
 * dropdown" bug). Re-reading the mirror on every call keeps the resolved value
 * fresh while still deduping the underlying round-trip.
 */
export const initCustomSizes = () => {
  const api = desktopApi();
  if (!api) {
    // Web: synchronous localStorage load — resolve immediately with the list.
    return Promise.resolve(getCustomSizes());
  }
  if (loadPromise) return loadPromise.then(() => getCustomSizes());
  loadPromise = api
    .sizesGet()
    .then((sizes) => {
      customSizes = Array.isArray(sizes) ? sizes : [];
      notify();
      return customSizes.slice();
    })
    .catch(() => {
      // Transient IPC failure — allow a later retry and do NOT cache an empty
      // list (caching [] would let a subsequent write overwrite AppData).
      loadPromise = null;
      return customSizes ? customSizes.slice() : [];
    });
  return loadPromise.then(() => getCustomSizes());
};

// ── Web localStorage helpers ──────────────────────────────────────────────────

const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const persistToLocalStorage = (sizes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch (_) {
    /* storage unavailable — sizes stay in memory for this session at least */
  }
};

// ── Load (lazy on web, async-backed on desktop) ───────────────────────────────

const load = () => {
  if (customSizes !== null) return customSizes;
  if (desktopApi()) {
    // Desktop (editorData bridge present): source of truth is AppData (async).
    // Kick off the deduped load and return an empty list transiently WITHOUT
    // caching it — never fall back to localStorage here. initCustomSizes()
    // populates the cache and notifies subscribers when the read resolves; see
    // the module header for why caching [] in this window would corrupt the
    // stored list. Gating on desktopApi() (not isDesktop) also prevents an
    // init→load→init recursion if the bridge is somehow absent.
    initCustomSizes();
    return [];
  }
  // Web (or desktop without the editorData bridge): synchronous localStorage.
  customSizes = loadFromLocalStorage();
  return customSizes;
};

const persist = () => {
  // Gate on the actual bridge (matches load()/initCustomSizes). On a real desktop
  // build the bridge is present → AppData; on web (or a desktop missing the
  // bridge) fall back to localStorage so a write is never silently dropped.
  if (desktopApi()) {
    persistToAppData(customSizes);
  } else {
    persistToLocalStorage(customSizes);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the saved custom sizes (array). Newest first. */
export const getCustomSizes = () => load().slice();

// Unique id for a custom size. Deliberately NOT derived from list length or the
// list contents: an add/remove interleave that recreated the same length + same
// dimensions used to mint a DUPLICATE id, and because removeCustomSize filters
// by id, deleting one would silently delete its twin (data loss). A monotonic
// per-session counter + ms timestamp + random suffix is collision-free in
// practice and stays unique across reloads (the timestamp differs per session).
let addCounter = 0;
const newSizeId = () =>
  `cs_${Date.now().toString(36)}_${(addCounter++).toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const buildEntry = (size) => ({
  id: newSizeId(),
  kind: "custom",
  label: size.label || `${size.width} × ${size.height} px`,
  width: Number(size.width),
  height: Number(size.height),
  // Always persist a numeric DPI (default 200). Storing `undefined` when a caller
  // omitted it made the size read back at the generic 200 fallback, losing the
  // real resolution — a size at 300 DPI came back looking like 200.
  dpi: Math.max(1, Math.round(Number(size.dpi) || 200)),
  unit: size.unit || "px",
  safeMargin: Number(size.safeMargin) || 0,
  bleedMargin: Number(size.bleedMargin) || 0,
});

// Apply a mutation to the canonical list, persist, and notify. On desktop the
// AppData list loads asynchronously; if a write lands BEFORE that read resolves,
// `load()` would hand back the transient empty list and we'd persist the
// mutation on top of [] — atomically overwriting sizes.json and destroying every
// previously-saved size. So when the cache isn't loaded yet we DEFER: await the
// read, then apply the mutation on top of the REAL loaded list. If the read
// genuinely failed (cache still null) we skip the write rather than risk
// clobbering whatever is on disk. The synchronous return is the best-known list
// (transiently empty in the deferred case); subscribers get the authoritative
// list via notify() once the read lands.
const applyMutation = (mutator) => {
  if (desktopApi() && customSizes === null) {
    initCustomSizes().then(() => {
      if (!Array.isArray(customSizes)) return; // load failed — don't clobber disk
      customSizes = mutator(customSizes);
      persist();
      notify();
    });
    return;
  }
  customSizes = mutator(load());
  persist();
  notify();
};

/**
 * Add a custom size and persist it. `size` must carry px `width`/`height` and
 * may carry `dpi`, `unit`, `safeMargin`, `bleedMargin`, and `label`.
 * Returns the updated list (newest first).
 */
export const addCustomSize = (size) => {
  const entry = buildEntry(size);
  applyMutation((list) => [entry, ...list]);
  return getCustomSizes();
};

/** Remove a custom size by id and persist. Returns the updated list. */
export const removeCustomSize = (id) => {
  applyMutation((list) => list.filter((s) => s.id !== id));
  return getCustomSizes();
};

/**
 * Remove every durable custom size matching the given pixel dimensions (and DPI
 * when supplied) and persist. Returns the updated list.
 *
 * A size added in-editor is stored in BOTH the ephemeral theme list (`allThemes`)
 * AND this durable store. Deleting it through the theme surface alone left the
 * mirror behind, so after a reload the durable copy resurfaced as an "extra
 * custom size" row (the reappearing-size bug). Deletion surfaces call this so the
 * mirror is cleared no matter which row the user removed. Matching is by rounded
 * width/height (the same normalization the size rows render with); when `dpi` is
 * omitted, every same-dimension entry is removed regardless of DPI.
 */
export const removeCustomSizesByDimensions = ({ width, height, dpi } = {}) => {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return getCustomSizes();
  const targetDpi = dpi != null && dpi !== "" ? parseInt(dpi, 10) : null;
  applyMutation((list) =>
    list.filter((s) => {
      const sameDims =
        Math.round(Number(s.width)) === w && Math.round(Number(s.height)) === h;
      if (!sameDims) return true; // keep — different size
      if (targetDpi == null) return false; // no DPI filter → drop all same-size
      return parseInt(s.dpi || 200, 10) !== targetDpi; // drop only the matching DPI
    })
  );
  return getCustomSizes();
};
