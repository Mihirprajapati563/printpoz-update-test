import { app } from "electron";
import type { BrowserWindow, Rectangle } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface WindowState {
  bounds?: Rectangle;
  maximized?: boolean;
}

function file(): string {
  return join(app.getPath("userData"), "window-state.json");
}

export function loadWindowState(): WindowState {
  try {
    if (existsSync(file())) return JSON.parse(readFileSync(file(), "utf8")) as WindowState;
  } catch {
    /* ignore */
  }
  return {};
}

export function trackWindowState(win: BrowserWindow): void {
  const save = () => {
    try {
      const state: WindowState = {
        bounds: win.getNormalBounds(),
        maximized: win.isMaximized(),
      };
      writeFileSync(file(), JSON.stringify(state));
    } catch {
      /* ignore */
    }
  };
  // moved/resized fire dozens of times/sec during a drag — debounce the sync disk write.
  let timer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  win.on("close", save); // flush immediately on close
  win.on("moved", debouncedSave);
  win.on("resized", debouncedSave);
}
