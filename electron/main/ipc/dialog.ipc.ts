import { BrowserWindow, dialog, ipcMain } from "electron";
import { statSync } from "fs";
import { basename } from "path";
import { CHANNELS } from "../../shared/ipc";

export function registerDialogIpc(): void {
  ipcMain.handle(CHANNELS.dialogOpenImages, async (e, multi: unknown) => {
    try {
      const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getAllWindows()[0];
      const options: Electron.OpenDialogOptions = {
        properties: multi === false ? ["openFile"] : ["openFile", "multiSelections"],
        filters: [
          { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "heic"] },
        ],
      };
      const res = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (res.canceled) return { ok: true as const, data: [] };
      const files = res.filePaths.map((p) => {
        let size = 0;
        try {
          size = statSync(p).size;
        } catch {
          /* ignore */
        }
        return { path: p, name: basename(p), size };
      });
      return { ok: true as const, data: files };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.dialogSaveAs, async (e, defaultName: unknown, filters: unknown) => {
    try {
      const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getAllWindows()[0];
      const safeFilters = Array.isArray(filters)
        ? (filters as unknown[]).filter(
            (f): f is Electron.FileFilter =>
              !!f &&
              typeof f === "object" &&
              typeof (f as Electron.FileFilter).name === "string" &&
              Array.isArray((f as Electron.FileFilter).extensions)
          )
        : undefined;
      const options: Electron.SaveDialogOptions = {
        defaultPath: typeof defaultName === "string" ? defaultName : undefined,
        filters: safeFilters,
      };
      const res = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return { ok: true as const, data: res.canceled ? null : res.filePath ?? null };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.dialogOpenFolder, async (e, title: unknown) => {
    try {
      const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getAllWindows()[0];
      const options: Electron.OpenDialogOptions = {
        title: typeof title === "string" ? title : undefined,
        properties: ["openDirectory", "createDirectory"],
      };
      const res = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return {
        ok: true as const,
        data: res.canceled ? null : res.filePaths[0] ?? null,
      };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
