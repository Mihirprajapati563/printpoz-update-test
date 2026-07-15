// Per-object live-resize override store.
//
// WHY: resizing an object used to dispatch to redux on every frame. Each dispatch
// re-renders the whole ~3900-line MainCanvas synchronously (flushSync) — that
// reconciliation is the resize lag (confirmed: type- and count-independent, no
// repaint, only the resized object commits, drag is smooth only because it
// dispatches 0 times mid-gesture).
//
// HOW: during a resize gesture ItemDragger pushes the live geometry for the ONE
// resized object here instead of dispatching. Only that object's renderer
// (subscribed via useLiveResize) re-renders — React still lays out the new
// geometry correctly (true reflow, every type), but MainCanvas never subscribes
// to this store, so it does NOT re-render. On gesture end the final value is
// committed to redux ONCE (history checkpoint) and the override is cleared.
import { useSyncExternalStore } from "react";

const overrides = new Map(); // id -> partial override ({ width, height, image, font, transform })
const listeners = new Map(); // id -> Set<() => void>

function emit(id) {
  const subs = listeners.get(id);
  if (subs) subs.forEach((fn) => fn());
}

// Push (or clear, when override == null) the live geometry for one object id.
export function setLiveResize(id, override) {
  if (!id) return;
  if (override == null) overrides.delete(id);
  else overrides.set(id, override);
  emit(id);
}

export function clearLiveResize(id) {
  if (!id) return;
  if (overrides.delete(id)) emit(id);
}

export function getLiveResize(id) {
  return overrides.get(id) || null;
}

function subscribe(id, fn) {
  let subs = listeners.get(id);
  if (!subs) {
    subs = new Set();
    listeners.set(id, subs);
  }
  subs.add(fn);
  return () => {
    subs.delete(fn);
    if (subs.size === 0) listeners.delete(id);
  };
}

// Hook: returns the current override for `id` (or null). Re-renders the calling
// component ONLY when THIS id's override changes — other objects are unaffected,
// and MainCanvas (which never calls this) never re-renders from a resize.
export function useLiveResize(id) {
  return useSyncExternalStore(
    (cb) => subscribe(id, cb),
    () => getLiveResize(id),
    () => null
  );
}
