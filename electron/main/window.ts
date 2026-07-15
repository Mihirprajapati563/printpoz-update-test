import { BrowserWindow } from "electron";
import { join } from "path";
import { APP_ORIGIN } from "./protocol";
import { hardenWindow } from "./security";
import { loadWindowState, trackWindowState } from "./services/window-state.service";

export function createMainWindow(devUrl: string | null): BrowserWindow {
  const state = loadWindowState();

  const win = new BrowserWindow({
    width: state.bounds?.width ?? 1400,
    height: state.bounds?.height ?? 900,
    x: state.bounds?.x,
    y: state.bounds?.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: join(__dirname, "preload.js"), // emitted next to main.js in dist-electron
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  if (state.maximized) win.maximize();
  trackWindowState(win);
  hardenWindow(win, devUrl ?? APP_ORIGIN);

  win.once("ready-to-show", () => win.show());

  // TEMP DEBUG (remove before shipping): surface renderer errors for the white-screen investigation.
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    require("./lib/logger").logger.info("renderer-console", { level, message, line, sourceId });
  });
  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    require("./lib/logger").logger.error("did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    require("./lib/logger").logger.error("render-process-gone", details);
  });

  if (process.env.PE_DEVTOOLS === "true") {
    win.webContents.openDevTools();
    win.webContents.on("before-input-event", (event, input) => {
      const isCmdOrCtrl = process.platform === "darwin" ? input.meta : input.control;
      if (isCmdOrCtrl && input.shift && input.key.toLowerCase() === "i") {
        win.webContents.toggleDevTools();
        event.preventDefault();
      }
      if (input.key === "F12") {
        win.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadURL(`${APP_ORIGIN}/index.html`);
  }

  return win;
}
