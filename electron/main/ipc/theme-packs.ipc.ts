import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import type { SaveThemePackInput } from "../../shared/ipc";
import {
  themePacksList,
  themePacksGetThemeJson,
  themePacksHasAsset,
  themePacksPutAsset,
  themePacksSaveManifest,
  themePacksDelete,
  themePacksUrlMap,
} from "../services/theme-packs.service";

// A single theme asset (re-encoded backgrounds can be large); cap defensively.
const MAX_ASSET_BYTES = 40 * 1024 * 1024;
// A theme.json holds every variant's compressed pages — generous but bounded.
const MAX_THEME_JSON_BYTES = 64 * 1024 * 1024;
// A theme references far fewer urls than this; the cap just bounds the payload.
const MAX_MISSING_URLS = 2000;

function isSaveInput(v: unknown): v is SaveThemePackInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.themeId === "string" &&
    o.themeId.length > 0 &&
    typeof o.themeJson === "string" &&
    o.themeJson.length > 0 &&
    // Measure UTF-8 bytes (what gets written to disk), not UTF-16 code units.
    Buffer.byteLength(o.themeJson, "utf8") <= MAX_THEME_JSON_BYTES &&
    Array.isArray(o.assets) &&
    Array.isArray(o.sizes) &&
    Array.isArray(o.fontUrls) &&
    // `complete` decides whether the UI offers Resume or claims the theme is
    // available offline, so it must be stated outright. Left unvalidated, a
    // caller that simply forgot it would silently publish a half-downloaded
    // pack as finished — the exact bug the resume feature exists to fix.
    typeof o.complete === "boolean" &&
    Array.isArray(o.missing) &&
    o.missing.length <= MAX_MISSING_URLS &&
    o.missing.every((u) => typeof u === "string")
  );
}

export function registerThemePacksIpc(): void {
  ipcMain.handle(CHANNELS.themePacksList, async () => {
    try {
      return { ok: true as const, data: await themePacksList() };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.themePacksGetThemeJson, async (_e, themeId: unknown) => {
    if (typeof themeId !== "string") {
      return { ok: false as const, error: "themeId must be a string" };
    }
    try {
      return { ok: true as const, data: await themePacksGetThemeJson(themeId) };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(
    CHANNELS.themePacksHasAsset,
    async (_e, themeId: unknown, file: unknown) => {
      if (typeof themeId !== "string" || typeof file !== "string") {
        return { ok: false as const, error: "themeId and file must be strings" };
      }
      try {
        return { ok: true as const, data: await themePacksHasAsset(themeId, file) };
      } catch (err) {
        return { ok: false as const, error: String(err) };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.themePacksPutAsset,
    async (_e, themeId: unknown, file: unknown, bytes: unknown) => {
      if (typeof themeId !== "string" || typeof file !== "string") {
        return { ok: false as const, error: "themeId and file must be strings" };
      }
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
        return { ok: false as const, error: "bytes must be a non-empty ArrayBuffer" };
      }
      if (bytes.byteLength > MAX_ASSET_BYTES) {
        return { ok: false as const, error: "asset exceeds size cap" };
      }
      try {
        await themePacksPutAsset(themeId, file, bytes);
        return { ok: true as const, data: undefined };
      } catch (err) {
        return { ok: false as const, error: String(err) };
      }
    }
  );

  ipcMain.handle(CHANNELS.themePacksSaveManifest, async (_e, input: unknown) => {
    if (!isSaveInput(input)) {
      return { ok: false as const, error: "invalid SaveThemePackInput" };
    }
    try {
      await themePacksSaveManifest(input);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.themePacksDelete, async (_e, themeId: unknown) => {
    if (typeof themeId !== "string") {
      return { ok: false as const, error: "themeId must be a string" };
    }
    try {
      await themePacksDelete(themeId);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.themePacksUrlMap, async () => {
    try {
      return { ok: true as const, data: await themePacksUrlMap() };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
