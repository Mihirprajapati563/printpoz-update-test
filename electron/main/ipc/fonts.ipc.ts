import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import { getCachedFont, putCachedFont, hasCachedFont } from "../services/font-cache.service";

const MAX_FONT_BYTES = 20 * 1024 * 1024; // generous per-font cap

export function registerFontsIpc(): void {
  ipcMain.handle(CHANNELS.fontsCacheGet, async (_e, url: unknown) => {
    if (typeof url !== "string" || !url) {
      return { ok: false as const, error: "url must be a string" };
    }
    try {
      const data = await getCachedFont(url);
      return { ok: true as const, data };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

  ipcMain.handle(CHANNELS.fontsCacheHas, async (_e, url: unknown) => {
    if (typeof url !== "string" || !url) {
      return { ok: false as const, error: "url must be a string" };
    }
    try {
      return { ok: true as const, data: await hasCachedFont(url) };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

  ipcMain.handle(CHANNELS.fontsCachePut, async (_e, url: unknown, bytes: unknown) => {
    if (typeof url !== "string" || !url) {
      return { ok: false as const, error: "url must be a string" };
    }
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0 || bytes.byteLength > MAX_FONT_BYTES) {
      return { ok: false as const, error: "bytes must be a non-empty ArrayBuffer within size limit" };
    }
    try {
      await putCachedFont(url, bytes);
      return { ok: true as const, data: undefined };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });
}
