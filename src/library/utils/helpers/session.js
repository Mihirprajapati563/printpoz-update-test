// Reusable auth/session helpers shared across standalone routes (design selection,
// editor entry, etc.). These mirror the token-resolution contract used by
// useInitializeProject so any page can bootstrap a user from the URL token without
// duplicating logic.

import { apiPost } from "../common-services/apiCall";
import { ENDPOINTS } from "../constants/apiurl";
import { USER_TYPES } from "../constants";
import { desktop, isDesktop } from "../../../desktop/index.js";

// localStorage keys owned by this module.
const USER_DETAILS_KEY = "userDetails";
const EMAIL_HISTORY_KEY = "rememberedEmails";
// Saved email+password pairs for the login account picker. Stored ONLY in the
// encrypted OS keychain on desktop (never localStorage); localStorage is the
// unavoidable fallback on web (no keychain in a browser). See the credential
// helpers below.
const CREDENTIALS_KEY = "rememberedCredentials";
// How many previously-used emails to keep on the device (most-recent first).
const MAX_REMEMBERED_EMAILS = 8;

// ── Durable (OS-keychain) mirror ─────────────────────────────────────────────
// On DESKTOP the renderer's localStorage is NOT durable enough for the login
// session: an app update, a wiped browser cache, or a transient mid-flow
// removeItem can drop it, which bounced a still-logged-in user back to Login on
// the next launch. So we mirror the session (and the remembered-email list) into
// the encrypted OS keychain (Electron safeStorage → userData/secure/store.json),
// and rehydrate localStorage from it at boot (see hydrateAuthSession). On WEB
// there is no bridge, so localStorage is already the durable store and these are
// no-ops — the web build is unchanged.
const durable = {
  get: async (key) => {
    if (!isDesktop || !desktop?.secureStore) return null;
    try {
      return await desktop.secureStore.get(key);
    } catch (_) {
      return null;
    }
  },
  set: async (key, value) => {
    if (!isDesktop || !desktop?.secureStore) return;
    try {
      await desktop.secureStore.set(key, value);
    } catch (_) {
      /* keychain unavailable — localStorage still holds the working copy */
    }
  },
  delete: async (key) => {
    if (!isDesktop || !desktop?.secureStore) return;
    try {
      await desktop.secureStore.delete(key);
    } catch (_) {
      /* ignore */
    }
  },
};

/**
 * Read a query param from every place it can live: the router `location.search`,
 * the raw `window.location.search`, and (under HashRouter / desktop) the hash
 * query (`#/route?x=1`). Pass `routerSearch` (from useLocation().search) first.
 */
export const getUrlParam = (routerSearch, name) => {
  const fromRouter = new URLSearchParams(routerSearch || "").get(name);
  if (fromRouter) return fromRouter;
  const fromSearch = new URLSearchParams(window.location.search).get(name);
  if (fromSearch) return fromSearch;
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const fromHash = new URLSearchParams(hash.slice(qIndex)).get(name);
    if (fromHash) return fromHash;
  }
  return null;
};

/** Safely parse the persisted `userDetails` record from localStorage. */
export const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_DETAILS_KEY) || "null");
  } catch (_) {
    return null;
  }
};

/**
 * Persist the logged-in user record. Writes the synchronous working copy to
 * localStorage (what apiCall's header injection + RootGate read) AND mirrors it
 * to the durable OS keychain on desktop so the session survives a localStorage
 * wipe. Call this at every genuine login / token-enrichment site instead of a
 * raw `localStorage.setItem("userDetails", …)`.
 */
export const setStoredUser = (user) => {
  const json = JSON.stringify(user);
  try {
    localStorage.setItem(USER_DETAILS_KEY, json);
  } catch (_) {
    /* storage unavailable — the durable mirror below still keeps the session */
  }
  // Only mirror a record that can actually restore a session (has a token);
  // token-less transient records (e.g. embedded customer deep-links) must not
  // clobber the durable logged-in session.
  if (user && user.token) durable.set(USER_DETAILS_KEY, json);
};

/**
 * Clear the active session from BOTH localStorage and the durable keychain.
 * Use on explicit sign-out. Does NOT touch the remembered-email list — that is
 * intentionally kept so the login screen can offer it next time.
 */
export const clearStoredUser = () => {
  try {
    localStorage.removeItem(USER_DETAILS_KEY);
  } catch (_) {
    /* ignore */
  }
  durable.delete(USER_DETAILS_KEY);
};

// ── Remembered accounts (login account picker) ───────────────────────────────
// Two stores, kept in sync:
//   1. EMAIL_HISTORY_KEY (localStorage + keychain mirror) — the plain email list
//      the picker renders SYNCHRONOUSLY on first paint. Emails aren't sensitive.
//   2. CREDENTIALS_KEY — the email+password pairs used to autofill the password
//      when an account is picked. Passwords live ONLY in the encrypted OS
//      keychain on desktop (safeStorage); on web there is no keychain, so they
//      fall back to localStorage. Per an explicit product decision, saving the
//      password is how the account picker offers one-click re-login; the password
//      field stays masked and only the email is ever displayed.

/** Read the remembered-email list (most-recent first), or [] on any error. */
export const getRememberedEmails = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(EMAIL_HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((e) => typeof e === "string" && e) : [];
  } catch (_) {
    return [];
  }
};

const writeRememberedEmails = (list) => {
  const json = JSON.stringify(list);
  try {
    localStorage.setItem(EMAIL_HISTORY_KEY, json);
  } catch (_) {
    /* ignore */
  }
  durable.set(EMAIL_HISTORY_KEY, json);
};

/**
 * Record an email as previously-used (moves it to the front, de-dupes
 * case-insensitively, caps the list). Call on a SUCCESSFUL login only.
 */
export const addRememberedEmail = (email) => {
  const clean = (email || "").trim();
  if (!clean) return getRememberedEmails();
  const lower = clean.toLowerCase();
  const next = [clean, ...getRememberedEmails().filter((e) => e.toLowerCase() !== lower)].slice(
    0,
    MAX_REMEMBERED_EMAILS,
  );
  writeRememberedEmails(next);
  return next;
};

// Encrypted credential store: keychain on desktop, localStorage fallback on web.
const credStore = {
  read: async () => {
    try {
      const raw =
        isDesktop && desktop?.secureStore
          ? await desktop.secureStore.get(CREDENTIALS_KEY)
          : localStorage.getItem(CREDENTIALS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  },
  write: async (list) => {
    const json = JSON.stringify(list);
    try {
      if (isDesktop && desktop?.secureStore) {
        await desktop.secureStore.set(CREDENTIALS_KEY, json);
      } else {
        localStorage.setItem(CREDENTIALS_KEY, json);
      }
    } catch (_) {
      /* storage unavailable — autofill just won't have this password */
    }
  },
};

/**
 * Remember an account's email + password for the login picker. Adds the email to
 * the synchronous display list AND upserts the encrypted credential. Call on a
 * SUCCESSFUL login only. Async (keychain write) — fire-and-forget is fine.
 */
export const rememberCredential = async (email, password) => {
  const clean = (email || "").trim();
  if (!clean || !password) return;
  addRememberedEmail(clean); // keep the sync display list in step
  const lower = clean.toLowerCase();
  const list = (await credStore.read()).filter(
    (c) => c && typeof c.email === "string" && c.email.toLowerCase() !== lower,
  );
  list.unshift({ email: clean, password });
  await credStore.write(list.slice(0, MAX_REMEMBERED_EMAILS));
};

/** The saved password for a remembered email, or "" if none. Async (keychain). */
export const getRememberedPassword = async (email) => {
  const lower = (email || "").trim().toLowerCase();
  const found = (await credStore.read()).find(
    (c) => c && typeof c.email === "string" && c.email.toLowerCase() === lower,
  );
  return found && typeof found.password === "string" ? found.password : "";
};

const removeCredential = async (email) => {
  const lower = (email || "").trim().toLowerCase();
  const list = (await credStore.read()).filter(
    (c) => c && typeof c.email === "string" && c.email.toLowerCase() !== lower,
  );
  await credStore.write(list);
};

/**
 * Forget one remembered account entirely: drop it from the display list AND wipe
 * its saved password. Returns the new (synchronous) email list for the UI.
 */
export const removeRememberedEmail = (email) => {
  const lower = (email || "").trim().toLowerCase();
  const next = getRememberedEmails().filter((e) => e.toLowerCase() !== lower);
  writeRememberedEmails(next);
  removeCredential(email); // async keychain cleanup — fire-and-forget
  return next;
};

// ── Boot hydration (desktop) ─────────────────────────────────────────────────
// RootGate decides login-vs-app SYNCHRONOUSLY from localStorage, but on desktop
// the durable session lives in the (async) keychain. This restores localStorage
// from the keychain ONCE at boot — before the router renders — whenever the
// working copy is missing/tokenless, so a reopened app keeps the user signed in.
let authHydrationPromise = null;

export const hydrateAuthSession = () => {
  if (authHydrationPromise) return authHydrationPromise;
  authHydrationPromise = (async () => {
    // Web (or desktop without the bridge): localStorage is already the durable
    // store — nothing to restore.
    if (!isDesktop || !desktop?.secureStore) return;
    // Session: only restore when the working copy can't authenticate on its own.
    try {
      if (!readStoredUser()?.token) {
        const durableJson = await durable.get(USER_DETAILS_KEY);
        if (durableJson) {
          const parsed = JSON.parse(durableJson);
          if (parsed && parsed.token) localStorage.setItem(USER_DETAILS_KEY, durableJson);
        }
      }
    } catch (_) {
      /* leave localStorage as-is → falls through to Login, which is safe */
    }
    // Remembered emails: restore if localStorage lost them.
    try {
      if (!localStorage.getItem(EMAIL_HISTORY_KEY)) {
        const durableEmails = await durable.get(EMAIL_HISTORY_KEY);
        if (durableEmails) localStorage.setItem(EMAIL_HISTORY_KEY, durableEmails);
      }
    } catch (_) {
      /* ignore */
    }
  })();
  return authHydrationPromise;
};

// ── Last-open editor (resume) ────────────────────────────────────────────────
// Remembers the editor deep-link the user last had open so reopening the app can
// drop them straight back into that design instead of the Design Selection page.
// Stores only the editor's query string (e.g. "t_id=..&size_w=..&cat=..") — never
// the auth token, which is re-attached from the live session at resume time.
const LAST_EDITOR_KEY = "last_open_editor";

/** Persist the editor deep-link query so the next app open can resume it. */
export const setLastOpenEditor = (search) => {
  try {
    const q = (search || "").replace(/^\?/, "");
    if (q) localStorage.setItem(LAST_EDITOR_KEY, q);
  } catch (_) {
    /* storage unavailable — resume just won't be remembered */
  }
};

/** Read the remembered editor deep-link query (without the leading `?`), or null. */
export const getLastOpenEditor = () => {
  try {
    return localStorage.getItem(LAST_EDITOR_KEY) || null;
  } catch (_) {
    return null;
  }
};

/** Forget the remembered editor (e.g. when the user returns to Design Selection). */
export const clearLastOpenEditor = () => {
  try {
    localStorage.removeItem(LAST_EDITOR_KEY);
  } catch (_) {
    /* ignore */
  }
};

/**
 * Resolve the active session token: the `u_id` URL param (router/window/hash)
 * falling back to the persisted user's token.
 */
export const getSessionToken = (routerSearch) =>
  getUrlParam(routerSearch, "u_id") || readStoredUser()?.token || null;

/** True for roles that may see admin-scoped data (superuser / admin / employee). */
export const isAdminLike = (user) =>
  user != null &&
  (user.userTypeCode === USER_TYPES.SUPERUSER ||
    user.userTypeCode === USER_TYPES.ADMIN ||
    user.userTypeCode === USER_TYPES.EMPLOYEE);

/**
 * Resolve a complete user record from an auth token and persist it to
 * localStorage (so apiCall's header injection works). Returns the merged user
 * or `null` if the token can't be verified. Does NOT dispatch — the caller owns
 * redux. `existing` lets callers merge over a partial login record.
 */
export const resolveUserFromToken = async (token, existing = null) => {
  if (!token) return null;
  const response = await apiPost(
    ENDPOINTS.fetchUserDataFromToken,
    { authorization: "Bearer " + token },
    { skipBrandId: true },
  );
  if (
    response &&
    response.status !== 0 &&
    response.items &&
    !Array.isArray(response.items) &&
    response.items._id
  ) {
    const fullUser = { ...(existing || {}), ...response.items, token };
    // Persist (localStorage + durable keychain mirror on desktop) so apiCall's
    // header injection works and the session survives a localStorage wipe.
    setStoredUser(fullUser);
    return fullUser;
  }
  return null;
};
