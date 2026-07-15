// Session-scoped registry of Saved Designs entries the user has DELETED while the
// editor is open, so the live auto-save (useEditorSnapshot) never RESURRECTS the
// design it was saving into. When the user deletes the currently-open project,
// the auto-save mints a fresh local id and continues as a NEW design instead —
// the deleted one stays deleted, and in-progress work is not lost.
//
// This is deliberately module-level (not Redux): it is a tiny cross-component
// signal, not editor state, and must reset on reload (a new app session starts
// with a clean slate). Cleared implicitly when the module is re-evaluated.

const abandoned = new Set();

/** Mark a design id as user-deleted so the auto-save abandons (never re-saves) it. */
export const markDesignAbandoned = (id) => {
  if (id != null) abandoned.add(String(id));
};

/** True if this design id was deleted by the user this session. */
export const isDesignAbandoned = (id) => id != null && abandoned.has(String(id));
