import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import {
  assetsCacheGet,
  assetsCachePut,
  assetsCacheClear,
} from "../services/assets-cache.service";

// Offline-first catalog cache for editor library assets. Handlers validate the
// (category, key) strings and delegate to the service. Like every IPC domain
// here they return the IpcResult envelope and never throw across the bridge.
export function registerAssetsCacheIpc(): void {
  ipcMain.handle(CHANNELS.assetsCacheGet, async (_e, category: unknown, key: unknown) => {
    if (typeof category !== "string" || typeof key !== "string") {
      return { ok: false as const, error: "category and key must be strings" };
    }
    try {
      const data = await assetsCacheGet(category, key);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(
    CHANNELS.assetsCachePut,
    async (_e, category: unknown, key: unknown, value: unknown) => {
      if (typeof category !== "string" || typeof key !== "string") {
        return { ok: false as const, error: "category and key must be strings" };
      }
      try {
        await assetsCachePut(category, key, value);
        return { ok: true as const, data: undefined };
      } catch (err) {
        return { ok: false as const, error: String(err) };
      }
    }
  );

  ipcMain.handle(CHANNELS.assetsCacheClear, async (_e, category: unknown) => {
    if (typeof category !== "string") {
      return { ok: false as const, error: "category must be a string" };
    }
    try {
      await assetsCacheClear(category);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
