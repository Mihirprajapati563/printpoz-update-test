import { ipcMain, shell } from "electron";
import { CHANNELS } from "../../shared/ipc";
import { resolveConfig } from "../config";
import { triggerUpdateCheck } from "../updater";

export function registerAppIpc(): void {
  // Synchronous config read — preload calls this once at startup so the renderer can
  // read window.__APP_CONFIG__ at module-import time (e.g. apiurl.js).
  // Idempotent: ipcMain.on (unlike handle) doesn't dedupe listeners, so clear before re-registering.
  ipcMain.removeAllListeners(CHANNELS.appGetConfigSync);
  ipcMain.on(CHANNELS.appGetConfigSync, (e) => {
    e.returnValue = resolveConfig();
  });

  ipcMain.handle(CHANNELS.appGetInfo, async () => {
    const c = resolveConfig();
    return {
      ok: true as const,
      data: { version: c.version, platform: c.platform, isDesktop: true as const, channel: c.channel },
    };
  });

  ipcMain.handle(CHANNELS.authOpenExternal, async (_e, url: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return { ok: false as const, error: "invalid url" };
    }
    await shell.openExternal(url);
    return { ok: true as const, data: undefined };
  });

  ipcMain.handle(CHANNELS.updateCheck, async () => {
    triggerUpdateCheck();
    return { ok: true as const, data: undefined };
  });
}
