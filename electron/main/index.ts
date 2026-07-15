import { app, BrowserWindow } from "electron";
import { join } from "path";
import { registerAllIpc } from "./ipc";
import { logger } from "./lib/logger";
import { buildMenu } from "./menu";
import { registerAppProtocol, registerAppProtocolSchemes, registerAssetsProtocol } from "./protocol";
import { applySecurity } from "./security";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { initAutoUpdater } from "./updater";
import { flushAllSync } from "./services/local-assets.service";
import { imageCacheFlushSync } from "./services/image-cache.service";
import { createMainWindow } from "./window";

// GPU crash fix (exit_code=34): the offscreen export window's captureBeyondViewport
// path crashes the SHARED GPU process on every page — deterministically, even at
// ~13 MP — which tears down the visible window's compositor ("app disappears and
// restarts"). The trigger is GPU tile-rasterization, not texture size. Moving Skia
// raster to the CPU kills the crash path while KEEPING the GL context, so WebGL/3D
// product previews still render and the single-shot (no re-encode) capture is
// preserved. Must be set before the GPU process launches (i.e. before app ready).
app.commandLine.appendSwitch("disable-gpu-rasterization");

// In dev, CRA serves the renderer; in prod we serve the built files via app://.
const DEV_URL = process.env.ELECTRON_START_URL || null;
const RENDERER_DIST = join(app.getAppPath(), "build");

// Must run before app is ready.
registerAppProtocolSchemes();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // Crash diagnostics. The visible window "disappears and restarts" during
  // export with NOTHING in the log because a GPU-process crash (the offscreen
  // export window shares the ONE GPU process with the main window) surfaces via
  // 'child-process-gone' (type 'GPU'), which had no handler. 'render-process-gone'
  // here is app-wide, so it also catches the offscreen export window's renderer
  // (exporter.ts only reset it silently). reason/exitCode name the real cause
  // (e.g. 'oom', 'crashed', 'killed') — one repro is now decisive.
  app.on("child-process-gone", (_e, details) => {
    logger.error("child-process-gone", details);
  });
  app.on("render-process-gone", (_e, wc, details) => {
    logger.error("render-process-gone (app)", { url: wc.getURL(), ...details });
  });

  app.whenReady().then(() => {
    if (!DEV_URL) registerAppProtocol(RENDERER_DIST);
    registerAssetsProtocol();
    applySecurity(DEV_URL);
    registerAllIpc();
    buildMenu();
    createMainWindow(DEV_URL);
    logger.info("App ready", { dev: Boolean(DEV_URL), dist: RENDERER_DIST });

    // Auto-update: silent on Win/Linux, notify-only banner on macOS.
    // Feed = GitHub Releases (Mihirprajapati563/printpoz-update-test). No-op in dev
    // (guarded by app.isPackaged). See electron/main/updater.ts.
    initAutoUpdater();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(DEV_URL);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // Flush any pending local-asset + image-cache index writes synchronously so a
  // write in the last debounce window survives quit.
  app.on("before-quit", () => {
    flushAllSync();
    imageCacheFlushSync();
  });
}
