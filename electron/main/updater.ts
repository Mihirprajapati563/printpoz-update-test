import { app, BrowserWindow } from "electron";
import { CHANNELS } from "../shared/ipc";
import type { UpdateStatus } from "../shared/ipc";
import { logger } from "./lib/logger";

// Per-OS auto-update strategy:
//   Windows / Linux -> SILENT: electron-updater downloads in the background and
//     installs on next app quit (autoDownload + autoInstallOnAppQuit). No UI.
//   macOS -> NOTIFY-ONLY: an unsigned mac app CANNOT self-install an update
//     (Squirrel.Mac rejects an unsigned bundle), so we skip Squirrel entirely,
//     do a lightweight GitHub "latest release" version check, and push
//     "available" to the renderer, which shows a banner + Download button that
//     opens the releases page. The user installs the new DMG manually.
//     -> Once you HAVE an Apple Developer cert, delete initMacNotifyOnly and let
//        macOS fall through to initSilentAutoUpdater like the others.
//
// NOTE: not called anywhere yet — initAutoUpdater() is commented out in index.ts.
//
// Feed for all platforms is the GitHub Release for this repo (electron-builder.yml
// `publish: github`). FILL IN owner/repo below (must match electron-builder.yml).
const GH_OWNER = "Mihirprajapati563";
const GH_REPO = "printpoz-update-test";

// Re-check every 6h so a long-running app (rarely quit) still notices releases.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Delay the first mac check so the renderer's onUpdateStatus listener is mounted
// (the status is a fire-and-forget push; a missed one only reappears next interval).
const MAC_FIRST_CHECK_DELAY_MS = 15 * 1000;

function sendStatus(status: UpdateStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(CHANNELS.updateStatus, status);
  }
}

export function initAutoUpdater(): void {
  // Never run against a dev/unpackaged build — there's no update feed.
  if (!app.isPackaged) {
    logger.info("autoUpdater: skipped (not packaged)");
    return;
  }
  if (process.platform === "darwin") {
    initMacNotifyOnly();
    return;
  }
  initSilentAutoUpdater();
}

// --- Windows / Linux: fully silent ---
function initSilentAutoUpdater(): void {
  let autoUpdater: import("electron-updater").AppUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (err) {
    logger.warn("autoUpdater: electron-updater not installed", { err: String(err) });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = logger as unknown as import("electron-updater").Logger;
  autoUpdater.on("error", (e) => logger.error("autoUpdater error", { err: String(e) }));
  autoUpdater.on("update-available", (i) => logger.info("update-available", { version: i.version }));
  autoUpdater.on("update-not-available", () => logger.info("update-not-available"));
  autoUpdater.on("update-downloaded", (i) => logger.info("update-downloaded", { version: i.version }));

  const check = () =>
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error("checkForUpdates failed", { err: String(err) });
    });
  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

// --- macOS (unsigned): notify only, manual install ---
function initMacNotifyOnly(): void {
  const check = async () => {
    sendStatus("checking");
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = (await res.json()) as { tag_name?: string };
      const latest = (data.tag_name || "").replace(/^v/, "");
      if (latest && isNewer(latest, app.getVersion())) {
        logger.info("mac update available", { latest, current: app.getVersion() });
        sendStatus("available");
      } else {
        sendStatus("not-available");
      }
    } catch (err) {
      logger.error("mac update check failed", { err: String(err) });
      sendStatus("error");
    }
  };
  setTimeout(check, MAC_FIRST_CHECK_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS);
}

// ponytail: naive major.minor.patch compare; ignores pre-release/build suffixes.
// Swap for a semver lib only if you start shipping "-beta"/"-rc" tags.
function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}
