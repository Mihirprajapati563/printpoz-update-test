import { ipcMain } from "electron";
import { readFile, writeFile } from "fs/promises";
import { CHANNELS } from "../../shared/ipc";

export function registerFsIpc(): void {
  ipcMain.handle(CHANNELS.fsReadFileAsBuffer, async (_e, path: unknown) => {
    if (typeof path !== "string") return { ok: false as const, error: "path must be a string" };
    try {
      const buf = await readFile(path);
      // Return a tight ArrayBuffer slice (structured-clonable across IPC).
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return { ok: true as const, data: ab };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });

  ipcMain.handle(CHANNELS.fsWriteFile, async (_e, path: unknown, data: unknown) => {
    if (typeof path !== "string") return { ok: false as const, error: "path must be a string" };
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      return { ok: false as const, error: "data must be an ArrayBuffer or ArrayBufferView" };
    }
    try {
      await writeFile(path, Buffer.from(data as ArrayBuffer));
      return { ok: true as const, data: undefined };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });
}
