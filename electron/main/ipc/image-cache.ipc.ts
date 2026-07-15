import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import {
  imageCacheGet,
  imageCachePut,
  imageCacheUrlMap,
  imageCacheEvict,
} from "../services/image-cache.service";

// Preview thumbnails are small; cap a single cached image generously so a bad
// url (e.g. a full-res original) can't bloat the cache in one write.
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

// Offline-first binary cache for remote preview/thumbnail images. Handlers
// validate their args and delegate to the service. Like every IPC domain here
// they return the IpcResult envelope and never throw across the bridge.
export function registerImageCacheIpc(): void {
  ipcMain.handle(CHANNELS.imageCacheGet, async (_e, url: unknown) => {
    if (typeof url !== "string") {
      return { ok: false as const, error: "url must be a string" };
    }
    try {
      const data = await imageCacheGet(url);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(
    CHANNELS.imageCachePut,
    async (_e, url: unknown, bytes: unknown, mime: unknown) => {
      if (typeof url !== "string") {
        return { ok: false as const, error: "url must be a string" };
      }
      if (
        !(bytes instanceof ArrayBuffer) ||
        bytes.byteLength === 0 ||
        bytes.byteLength > MAX_IMAGE_BYTES
      ) {
        return {
          ok: false as const,
          error: "bytes must be a non-empty ArrayBuffer within size limit",
        };
      }
      try {
        const data = await imageCachePut(
          url,
          bytes,
          typeof mime === "string" ? mime : ""
        );
        return { ok: true as const, data };
      } catch (err) {
        return { ok: false as const, error: String(err) };
      }
    }
  );

  ipcMain.handle(CHANNELS.imageCacheUrlMap, async () => {
    try {
      const data = await imageCacheUrlMap();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.imageCacheEvict, async (_e, maxAgeMs: unknown) => {
    const ms = typeof maxAgeMs === "number" && maxAgeMs > 0 ? maxAgeMs : 0;
    try {
      await imageCacheEvict(ms);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
