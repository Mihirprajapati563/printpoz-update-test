// ── Editor-data boot hydration (desktop) ─────────────────────────────────────
// On desktop the crash/offline snapshot is owned by AppData (editor-data
// service), NOT localStorage — so it survives a hard close, a wiped browser
// cache, or a fresh profile. But the boot router (RootGate) decides
// SYNCHRONOUSLY whether to restore the editor, and AppData reads are async.
//
// This module bridges that gap: at app start we read the snapshot from AppData
// ONCE into an in-memory cache, and only then let the router render. The
// synchronous snapshot accessors (hasEditorSnapshot / readEditorSnapshot in
// editorSnapshot.js) read from this cache, so the restore decision is correct
// on the very first paint — no race, no missed restore.
//
// On web there is no AppData; the cache stays unused and editorSnapshot.js falls
// back to its localStorage path, so nothing here affects the web build.

import { desktop, isDesktop } from "../../../desktop/index.js";

// The hydrated snapshot JSON string (or null). `undefined` means "not hydrated
// yet" so accessors can tell the difference between "no snapshot" and "not
// loaded". Web never sets this (stays undefined) and uses localStorage instead.
let cachedSnapshotJson;

let bootPromise = null;

/** True when the AppData-backed snapshot cache has been populated. */
export const isEditorDataHydrated = () => cachedSnapshotJson !== undefined;

/** Synchronous read of the hydrated snapshot JSON (or null). Used by
 *  editorSnapshot.js on desktop after hydration. */
export const getCachedSnapshotJson = () =>
  cachedSnapshotJson === undefined ? null : cachedSnapshotJson;

/** Update the in-memory cache (called by editorSnapshot.js on every write/clear
 *  so subsequent synchronous reads see the latest value without a round-trip). */
export const setCachedSnapshotJson = (json) => {
  cachedSnapshotJson = json || null;
};

/**
 * Read the snapshot from AppData into the cache exactly once. Resolves when the
 * cache is ready (or immediately on web / when the bridge is missing). Safe to
 * call repeatedly — only the first call does the read.
 */
export const hydrateEditorData = () => {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    // Web (or desktop without the bridge): nothing to hydrate. Leave the cache
    // undefined so editorSnapshot.js uses its localStorage path.
    if (!isDesktop || !desktop?.editorData) {
      return;
    }
    try {
      const json = await desktop.editorData.snapshotGet();
      cachedSnapshotJson = typeof json === "string" && json.length > 0 ? json : null;
    } catch (_) {
      cachedSnapshotJson = null;
    }
  })();
  return bootPromise;
};
