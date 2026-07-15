// ── Minimal IndexedDB wrapper ────────────────────────────────────────────────
// A tiny promise-based helper over IndexedDB for the app's larger local stores
// (e.g. the Saved Designs library), where the browser localStorage quota
// (~5-10 MB) is too small. IndexedDB has a much larger, disk-backed quota and
// works identically in the web build and the Electron renderer with no IPC.
//
// Intentionally dependency-free and scoped to exactly what we need: open a DB
// with a fixed set of object stores, and run get/getAll/put/delete/clear on a
// store. Not a general ORM — keep it small.

const DB_NAME = "printpoz_local";
const DB_VERSION = 3;

// Object stores created on upgrade. Keep this list in sync with DB_VERSION:
// adding a store requires bumping DB_VERSION so `onupgradeneeded` fires.
const STORES = [
  // Saved Designs library, split so card listing never loads heavy page blobs:
  "designs_meta", // { id, name, editorType, cat, thumbnail, createdAt, updatedAt }
  "designs_payload", // { id, pages_c, canvasSize, settings, … (full restore state) }
  // Offline image blob cache: { id (url hash), dataUrl, mimeType, cachedAt }
  "image_cache",
  // Customer "Save as Idea" library — one small record per saved page/spread:
  // { id, name, editorType, spread, number_of_layouts, layout_c, timestamps }
  "ideas",
];

let dbPromise = null;

/** True when IndexedDB is usable in this environment. */
export const idbAvailable = () => {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch (_) {
    return false;
  }
};

/** Open (and lazily cache) the shared database, creating stores on first run. */
const openDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  }).catch((e) => {
    // Reset so a later call can retry rather than caching a rejected promise.
    dbPromise = null;
    throw e;
  });
  return dbPromise;
};

/** Run `fn(store)` inside a transaction and resolve with `requestResult`. */
const withStore = async (storeName, mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (e) {
      reject(e);
      return;
    }
    const store = tx.objectStore(storeName);
    let request;
    try {
      request = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
};

export const idbGet = (storeName, id) =>
  withStore(storeName, "readonly", (store) => store.get(id));

export const idbGetAll = (storeName) =>
  withStore(storeName, "readonly", (store) => store.getAll());

/**
 * Put one record into each of several stores in a SINGLE transaction, so they
 * commit together (no half-written meta-without-payload after a crash).
 * `entries` is an array of { store, value }.
 */
export const idbPutAcross = async (entries) => {
  const db = await openDB();
  const storeNames = [...new Set(entries.map((e) => e.store))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    entries.forEach(({ store, value }) => tx.objectStore(store).put(value));
    tx.oncomplete = () => resolve(true);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
};

/** Delete the same id from several stores (e.g. meta + payload) atomically. */
export const idbDeleteAcross = async (storeNames, id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    storeNames.forEach((name) => tx.objectStore(name).delete(id));
    tx.oncomplete = () => resolve(true);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
};
