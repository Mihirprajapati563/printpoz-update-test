/**
 * saveHelpers.js — desktop-aware file saving for the export pipeline.
 * ─────────────────────────────────────────────────────────────────
 * On the WEB build these fall back to the exact previous behaviour
 * (`file-saver` saveAs / a hidden `<a download>` click), so every change here is
 * non-breaking when `window.desktop` is absent (see .claude/rules/renderer.md).
 *
 * On DESKTOP they use native OS dialogs so the user is never asked for a folder
 * more than once:
 *   - `saveSingleFile`   → one native "Save As" dialog (PDF / ZIP / single image)
 *   - `saveMultipleFiles`→ one native folder picker, then every file is written
 *                          into that folder (fixes the "asks for the folder again
 *                          and again" bug where each page triggered its own dialog)
 *
 * ⚠ ROBUSTNESS: the native path is used ONLY when every capability it needs is a
 * real function AND the call actually succeeds. If the running Electron main
 * bundle is older than this renderer (e.g. the app wasn't fully restarted after
 * an update, so `desktop.dialog.openFolder` doesn't exist yet), or any native
 * write throws, we fall back to a plain browser download instead of throwing —
 * a missing bridge must NEVER abort the whole export (that was the "images not
 * exporting perfectly / so broken" failure).
 *
 * Every function resolves to `{ saved, canceled }` so callers can drive the
 * progress UI correctly (a cancelled dialog is NOT a successful export).
 */

import { isDesktop, desktop } from "../../../../desktop";

const isFn = (v) => typeof v === "function";

/** Native single-file save available? (Save As + write) */
const canNativeSaveOne = () =>
  isDesktop && !!desktop && !!desktop.dialog && isFn(desktop.dialog.saveAs) && !!desktop.fs && isFn(desktop.fs.writeFile);

/** Native multi-file save available? (folder picker + write) */
const canNativeSaveMany = () =>
  isDesktop && !!desktop && !!desktop.dialog && isFn(desktop.dialog.openFolder) && !!desktop.fs && isFn(desktop.fs.writeFile);

/** Build a native file-type filter from a filename's extension. */
function filtersForName(filename) {
  const ext = String(filename || "").split(".").pop().toLowerCase();
  const NAMES = {
    pdf: "PDF Document",
    zip: "ZIP Archive",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    png: "PNG Image",
  };
  if (!ext || !NAMES[ext]) return undefined;
  return [{ name: NAMES[ext], extensions: [ext] }];
}

/** Join a directory and a filename with a separator Node accepts on any OS. */
function joinPath(dir, name) {
  return `${String(dir).replace(/[\\/]+$/, "")}/${name}`;
}

/** Trigger a browser download (web + desktop fallback). */
function browserDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => window.URL.revokeObjectURL(url), 4000);
}

/**
 * Save ONE blob to disk.
 * Desktop → native Save-As dialog + fs.writeFile. Web / stale bridge → download.
 * @param {{ blob: Blob, filename: string }} args
 * @returns {Promise<{ saved: boolean, canceled: boolean }>}
 */
export async function saveSingleFile({ blob, filename }) {
  if (!blob) return { saved: false, canceled: false };

  if (canNativeSaveOne()) {
    try {
      const targetPath = await desktop.dialog.saveAs(filename, filtersForName(filename));
      if (!targetPath) return { saved: false, canceled: true };
      const buffer = await blob.arrayBuffer();
      await desktop.fs.writeFile(targetPath, buffer);
      return { saved: true, canceled: false };
    } catch {
      // Native save failed (permissions, stale bridge, etc.) — never abort the
      // export; fall through to a browser download so the user still gets a file.
    }
  }

  browserDownload(blob, filename);
  return { saved: true, canceled: false };
}

/**
 * Save MANY blobs at once.
 * Desktop → ONE folder picker, then write every file into it. Web / stale bridge
 * → one browser download per file (unchanged legacy behaviour).
 * @param {{ files: Array<{ blob: Blob, name: string }>, title?: string }} args
 * @returns {Promise<{ saved: boolean, canceled: boolean, count: number }>}
 */
export async function saveMultipleFiles({ files, title }) {
  const list = (files || []).filter((f) => f && f.blob && f.name);
  if (list.length === 0) return { saved: false, canceled: false, count: 0 };

  if (canNativeSaveMany()) {
    let dir;
    try {
      dir = await desktop.dialog.openFolder(title || "Choose a folder to export into");
    } catch {
      // The folder picker itself is unavailable (stale bridge) — fall through to
      // the browser-download fallback below. NOTHING has been written yet, so no
      // duplicates.
      dir = undefined;
    }
    if (dir === null) return { saved: false, canceled: true, count: 0 };
    if (dir) {
      // Committed to native writes. If a write throws mid-loop, do NOT re-download
      // the whole list (that would duplicate the files already on disk) — throw so
      // the export surfaces a real error for what remains.
      let written = 0;
      for (const { blob, name } of list) {
        const buffer = await blob.arrayBuffer();
        await desktop.fs.writeFile(joinPath(dir, name), buffer);
        written++;
      }
      return { saved: true, canceled: false, count: written };
    }
  }

  for (const { blob, name } of list) {
    browserDownload(blob, name);
  }
  return { saved: true, canceled: false, count: list.length };
}

/** Whether saves will go through native OS dialogs (desktop) vs browser downloads. */
export const nativeSaveEnabled = canNativeSaveMany() || canNativeSaveOne();
