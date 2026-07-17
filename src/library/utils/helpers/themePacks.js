// Offline theme packs — renderer helper.
// ───────────────────────────────────────
// Thin, web-safe wrapper over the desktop `window.desktop.themePacks` IPC bridge
// (see electron/main/services/theme-packs.service.ts). A "theme pack" is a full
// theme downloaded for offline use: every size variant (raw getTheme response in
// theme.json) plus its referenced assets, written under AppData/theme-packs/.
//
// On the web build (`window.desktop` absent) every call degrades to a no-op /
// empty result, so importing this anywhere is safe — the Download feature simply
// isn't offered there.
//
// This module also owns the boot-time "original CDN url → app-assets:// url" map
// and pushes it into imageCache (setThemePackUrlMap) so the canvas renderer
// resolves a downloaded theme's images from disk with no page rewriting.

import { desktop, isDesktop } from "../../../desktop/index.js";
import { setThemePackUrlMap } from "./imageCache.js";
import { readStoredUser, isAdminLike } from "./session.js";

const api = () => (isDesktop && desktop?.themePacks ? desktop.themePacks : null);

// ── Per-account ownership ─────────────────────────────────────────────────────
// The theme-pack BYTES on disk are keyed by themeId and shared, but each account
// gets its OWN "Downloaded Themes" list so a device shared by an admin and a
// regular user doesn't show one account's downloads to the other. Ownership is a
// tiny localStorage map { themeId: [accountId, …] }, maintained here whenever a
// pack is downloaded / removed, and used to filter every listing. Packs with no
// recorded owner are "legacy" (downloaded before this existed) and shown to
// admin-like accounts only — matching the Saved Designs isolation rule. This is
// renderer-only (no IPC/main change) and a no-op on web, where `api()` is null.
const OWNERS_KEY = "theme_pack_owners";

const currentAccountId = () => {
  try {
    return readStoredUser()?._id || null;
  } catch (_) {
    return null;
  }
};

const readOwners = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OWNERS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeOwners = (map) => {
  try {
    localStorage.setItem(OWNERS_KEY, JSON.stringify(map));
  } catch (_) {
    /* storage unavailable — ownership just isn't remembered */
  }
};

/** Record that the current account has this theme pack in its offline library. */
export const addThemePackOwner = (themeId) => {
  const uid = currentAccountId();
  if (!themeId || !uid) return;
  const map = readOwners();
  const owners = Array.isArray(map[themeId]) ? map[themeId] : [];
  if (!owners.includes(uid)) {
    map[themeId] = [...owners, uid];
    writeOwners(map);
  }
};

/**
 * Drop the current account's ownership of a pack. Returns true when NO account
 * owns it anymore (safe to delete the shared bytes) — also true for a legacy
 * pack with no recorded owners (an admin deleting it removes it for real).
 */
const removeThemePackOwner = (themeId) => {
  const uid = currentAccountId();
  const map = readOwners();
  const owners = Array.isArray(map[themeId]) ? map[themeId] : [];
  const next = owners.filter((id) => id !== uid);
  if (next.length) map[themeId] = next;
  else delete map[themeId];
  writeOwners(map);
  return next.length === 0;
};

/** True if the current account should see a given downloaded pack. */
const ownsThemePack = (themeId) => {
  const map = readOwners();
  const owners = map[themeId];
  if (Array.isArray(owners) && owners.length) {
    return owners.includes(currentAccountId());
  }
  // No recorded owner (legacy download) → admin-like accounts only.
  return isAdminLike(readStoredUser());
};

/** True when offline theme download/storage is available (desktop only). */
export const isThemePacksSupported = () => !!api();

/** Lightweight pack metadata list for the offline grid (newest first, this account). */
export const listThemePacks = async () => {
  const a = api();
  if (!a) return [];
  try {
    const all = (await a.list()) || [];
    return all.filter((p) => p && ownsThemePack(p.themeId));
  } catch (_) {
    return [];
  }
};

/** Raw getTheme response JSON string for a downloaded theme, or null. */
export const getThemePackThemeJson = async (themeId) => {
  const a = api();
  if (!a || !themeId) return null;
  try {
    return await a.getThemeJson(themeId);
  } catch (_) {
    return null;
  }
};

/** Set of theme ids that are downloaded (for the ✓ Downloaded badge). */
export const getDownloadedThemeIds = async () => {
  const list = await listThemePacks();
  return new Set(list.map((p) => p && p.themeId).filter(Boolean));
};

/**
 * Remove the pack from the CURRENT account's offline library. The shared bytes
 * are only deleted from disk once no account owns the pack anymore (so removing
 * it for one user doesn't wipe it for another who also downloaded it).
 */
export const deleteThemePack = async (themeId) => {
  const a = api();
  if (a && themeId) {
    const noOwnersLeft = removeThemePackOwner(themeId);
    if (noOwnersLeft) {
      try {
        await a.delete(themeId);
      } catch (_) {
        /* best-effort */
      }
    }
  }
  await refreshThemePackUrlMap();
};

/**
 * Rebuild the original-url → app-assets-url map from every pack — PARTIAL packs
 * included — and push it into imageCache. Call at boot and after any download/
 * delete so the canvas resolves a downloaded theme's assets from disk
 * immediately. Partial packs belong in the map: the manifest only lists files
 * actually written, so every mapped url resolves, and an interrupted download's
 * assets must keep rendering offline while it waits to resume.
 */
export const refreshThemePackUrlMap = async () => {
  const a = api();
  if (!a) {
    setThemePackUrlMap({});
    return {};
  }
  try {
    const map = (await a.urlMap()) || {};
    setThemePackUrlMap(map);
    return map;
  } catch (_) {
    setThemePackUrlMap({});
    return {};
  }
};

/** Boot alias — build the offline url map once on startup. */
export const initThemePackUrlMap = refreshThemePackUrlMap;
