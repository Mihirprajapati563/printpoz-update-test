// Lightweight desktop bridge accessors for the renderer (plain JS so the CRA build stays
// untouched). All OS access goes through window.desktop, exposed by the Electron preload.
// On the web these are false/null, so callers degrade gracefully.

export const isDesktop =
  typeof window !== "undefined" &&
  (Boolean(window.__APP_CONFIG__ && window.__APP_CONFIG__.isDesktop) ||
    window.location.protocol === "app:");

/** The window.desktop IPC bridge (or null on web). */
export const desktop = (typeof window !== "undefined" && window.desktop) || null;

/** Injected runtime config (or null on web). */
export const appConfig = (typeof window !== "undefined" && window.__APP_CONFIG__) || null;
