import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import type { SavedDesignEntry, CustomSizeEntry, SavedIdeaEntry } from "../../shared/ipc";
import {
  snapshotGet,
  snapshotSet,
  snapshotClear,
  historyGet,
  historySet,
  historyClear,
  designsList,
  designsGet,
  designsPut,
  designsDelete,
  ideasList,
  ideasPut,
  ideasDelete,
  sizesGet,
  sizesSet,
} from "../services/editor-data.service";

export function registerEditorDataIpc(): void {
  // ── Snapshot ──────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.editorDataSnapshotGet, async () => {
    try {
      const data = await snapshotGet();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataSnapshotSet, async (_e, json: unknown) => {
    if (typeof json !== "string" || json.length === 0) {
      return { ok: false as const, error: "json must be a non-empty string" };
    }
    try {
      await snapshotSet(json);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataSnapshotClear, async () => {
    try {
      await snapshotClear();
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  // ── Undo/redo history ─────────────────────────────────────────────

  ipcMain.handle(CHANNELS.editorDataHistoryGet, async () => {
    try {
      const data = await historyGet();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataHistorySet, async (_e, json: unknown) => {
    if (typeof json !== "string" || json.length === 0) {
      return { ok: false as const, error: "json must be a non-empty string" };
    }
    try {
      await historySet(json);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataHistoryClear, async () => {
    try {
      await historyClear();
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  // ── Saved-designs library ─────────────────────────────────────────

  ipcMain.handle(CHANNELS.editorDataDesignsList, async () => {
    try {
      const data = await designsList();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataDesignsGet, async (_e, id: unknown) => {
    if (typeof id !== "string") {
      return { ok: false as const, error: "id must be a string" };
    }
    try {
      const data = await designsGet(id);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataDesignsPut, async (_e, entry: unknown) => {
    if (!entry || typeof entry !== "object" || typeof (entry as Record<string, unknown>).id !== "string") {
      return { ok: false as const, error: "entry must be an object with a string id" };
    }
    try {
      await designsPut(entry as SavedDesignEntry);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataDesignsDelete, async (_e, id: unknown) => {
    if (typeof id !== "string") {
      return { ok: false as const, error: "id must be a string" };
    }
    try {
      await designsDelete(id);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  // ── Saved Ideas library ───────────────────────────────────────────

  ipcMain.handle(CHANNELS.editorDataIdeasList, async () => {
    try {
      const data = await ideasList();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataIdeasPut, async (_e, entry: unknown) => {
    if (!entry || typeof entry !== "object" || typeof (entry as Record<string, unknown>).id !== "string") {
      return { ok: false as const, error: "entry must be an object with a string id" };
    }
    try {
      await ideasPut(entry as SavedIdeaEntry);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataIdeasDelete, async (_e, id: unknown) => {
    if (typeof id !== "string") {
      return { ok: false as const, error: "id must be a string" };
    }
    try {
      await ideasDelete(id);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  // ── Custom sizes ──────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.editorDataSizesGet, async () => {
    try {
      const data = await sizesGet();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.editorDataSizesSet, async (_e, sizes: unknown) => {
    if (!Array.isArray(sizes)) {
      return { ok: false as const, error: "sizes must be an array" };
    }
    try {
      await sizesSet(sizes as CustomSizeEntry[]);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
