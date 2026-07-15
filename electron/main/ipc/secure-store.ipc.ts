import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import { secureStore } from "../services/secure-store.service";

export function registerSecureStoreIpc(): void {
  ipcMain.handle(CHANNELS.secureStoreGet, async (_e, key: unknown) => {
    if (typeof key !== "string") return { ok: false as const, error: "key must be a string" };
    try {
      return { ok: true as const, data: secureStore.get(key) };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

  ipcMain.handle(CHANNELS.secureStoreSet, async (_e, key: unknown, value: unknown) => {
    if (typeof key !== "string" || typeof value !== "string") {
      return { ok: false as const, error: "key and value must be strings" };
    }
    try {
      secureStore.set(key, value);
      return { ok: true as const, data: undefined };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

  ipcMain.handle(CHANNELS.secureStoreDelete, async (_e, key: unknown) => {
    if (typeof key !== "string") return { ok: false as const, error: "key must be a string" };
    try {
      secureStore.delete(key);
      return { ok: true as const, data: undefined };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });
}
