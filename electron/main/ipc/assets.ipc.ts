import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import type {
  AssetVariantInput,
  SaveAssetInput,
  ListAssetsInput,
} from "../../shared/ipc";
import {
  saveAsset,
  listAssets,
  removeAssets,
  setFavorite,
  checkMissingOriginals,
} from "../services/local-assets.service";

const VALID_SIZES = new Set(["large", "medium", "small"]);
const MAX_VARIANTS = 5;
const MAX_VARIANT_BYTES = 60 * 1024 * 1024; // generous cap (re-encoded large can exceed the 30MB source)

function isVariant(v: unknown): v is AssetVariantInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.size === "string" &&
    VALID_SIZES.has(o.size) &&
    typeof o.ext === "string" &&
    o.bytes instanceof ArrayBuffer &&
    o.bytes.byteLength > 0 &&
    o.bytes.byteLength <= MAX_VARIANT_BYTES
  );
}

function isSaveInput(v: unknown): v is SaveAssetInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.projectId === "string" &&
    typeof o.fileName === "string" &&
    Number.isFinite(o.width) &&
    (o.width as number) > 0 &&
    Number.isFinite(o.height) &&
    (o.height as number) > 0 &&
    Array.isArray(o.variants) &&
    o.variants.length > 0 &&
    o.variants.length <= MAX_VARIANTS &&
    o.variants.every(isVariant) &&
    // originalPath is optional; when present it must be a bounded non-empty
    // string. The service does the real absolute/extension/existence validation
    // before trusting it — it's an arbitrary-file-read surface.
    (o.originalPath === undefined ||
      (typeof o.originalPath === "string" &&
        o.originalPath.length > 0 &&
        o.originalPath.length <= 4096))
  );
}

function isNonNegInt(v: unknown): boolean {
  return v === undefined || (Number.isInteger(v) && (v as number) >= 0);
}

export function registerAssetsIpc(): void {
  ipcMain.handle(CHANNELS.assetsSave, async (_e, input: unknown) => {
    if (!isSaveInput(input)) {
      return { ok: false as const, error: "invalid SaveAssetInput" };
    }
    try {
      const data = await saveAsset(input);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.assetsList, async (_e, input: unknown) => {
    if (!input || typeof input !== "object") {
      return { ok: false as const, error: "invalid ListAssetsInput" };
    }
    const o = input as Record<string, unknown>;
    if (typeof o.projectId !== "string" || !isNonNegInt(o.skip) || !isNonNegInt(o.limit)) {
      return { ok: false as const, error: "invalid ListAssetsInput" };
    }
    try {
      const data = await listAssets(input as ListAssetsInput);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.assetsRemove, async (_e, projectId: unknown, ids: unknown) => {
    if (typeof projectId !== "string") {
      return { ok: false as const, error: "projectId must be a string" };
    }
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return { ok: false as const, error: "ids must be a string[]" };
    }
    try {
      await removeAssets(projectId, ids as string[]);
      return { ok: true as const, data: undefined };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(CHANNELS.assetsCheckOriginals, async (_e, projectId: unknown, ids: unknown) => {
    if (typeof projectId !== "string") {
      return { ok: false as const, error: "projectId must be a string" };
    }
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return { ok: false as const, error: "ids must be a string[]" };
    }
    try {
      const data = await checkMissingOriginals(projectId, ids as string[]);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });

  ipcMain.handle(
    CHANNELS.assetsSetFavorite,
    async (_e, projectId: unknown, id: unknown, favorite: unknown) => {
      if (typeof projectId !== "string" || typeof id !== "string") {
        return { ok: false as const, error: "projectId and id must be strings" };
      }
      try {
        await setFavorite(projectId, id, !!favorite);
        return { ok: true as const, data: undefined };
      } catch (err) {
        return { ok: false as const, error: String(err) };
      }
    }
  );
}
