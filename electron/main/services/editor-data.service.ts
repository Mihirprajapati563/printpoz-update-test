// Editor data store — snapshot, saved-designs library, and custom sizes.
//
// All three are persisted as JSON files inside:
//   userData/editor/
//     snapshot.json          ← single active editor-state snapshot
//     designs/
//       meta.json            ← lightweight card list (id, name, thumbnail, timestamps)
//       <id>.json            ← full payload per design (pages_c + working state)
//     sizes.json             ← user-defined custom canvas sizes
//
// The renderer helpers (editorSnapshot.js, savedDesigns.js, customSizes.js) call
// the IPC channels backed by this service when running on desktop; localStorage
// and IndexedDB paths remain intact for the web build.
//
// All writes are ATOMIC: write to a temp file first, then rename so a crash
// mid-write never leaves a corrupt file.

import { app } from "electron";
import { mkdir, writeFile, readFile, rename } from "fs/promises";
import { join, normalize, sep } from "path";
import type { SavedDesignEntry, SavedDesignMeta, CustomSizeEntry, SavedIdeaEntry } from "../../shared/ipc";

// ── Path helpers ────────────────────────────────────────────────────

function editorRoot(): string {
  return join(app.getPath("userData"), "editor");
}

function snapshotPath(): string {
  return join(editorRoot(), "snapshot.json");
}

function historyPath(): string {
  return join(editorRoot(), "history.json");
}

function designsDir(): string {
  return join(editorRoot(), "designs");
}

function designsMetaPath(): string {
  return join(designsDir(), "meta.json");
}

function designPayloadPath(id: string): string {
  const safe = safeId(id);
  return join(designsDir(), `${safe}.json`);
}

function sizesPath(): string {
  return join(editorRoot(), "sizes.json");
}

function ideasPath(): string {
  return join(editorRoot(), "ideas.json");
}

// Strip characters that could escape the designs dir (traversal guard).
// Colons are valid in the logical id (e.g. "theme:abc123") but illegal in
// Windows filenames — replace them with underscore for the on-disk name.
// The logical id is always stored inside the JSON, so the renderer contract
// is unchanged.
function safeId(raw: string): string {
  const cleaned = String(raw || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown";
}

// ── Atomic JSON helpers ─────────────────────────────────────────────

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value), "utf8");
  await rename(tmp, path); // atomic replace
}

// Atomically write an ALREADY-serialized string verbatim (no parse+stringify
// roundtrip) — used for the undo-history payload whose body is a large opaque
// compressed string the renderer already produced.
async function writeRawFile(path: string, contents: string): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, path); // atomic replace
}

// Traversal guard: ensure a payload path is inside designsDir().
function isInsideDesignsDir(path: string): boolean {
  const base = normalize(designsDir());
  const resolved = normalize(path);
  return resolved === base || resolved.startsWith(base + sep);
}


// ── Snapshot ────────────────────────────────────────────────────────

/** Returns the raw JSON string of the active snapshot, or null if none. */
export async function snapshotGet(): Promise<string | null> {
  try {
    const raw = await readFile(snapshotPath(), "utf8");
    // Verify it parses (don't return corrupted data).
    JSON.parse(raw);
    return raw;
  } catch {
    return null;
  }
}

/** Persist the snapshot (raw JSON string from the renderer). */
export async function snapshotSet(json: string): Promise<void> {
  // Validate that it's parseable before writing.
  JSON.parse(json);
  await writeJson(snapshotPath(), JSON.parse(json));
}

/** Delete the active snapshot. */
export async function snapshotClear(): Promise<void> {
  try {
    const { unlink } = await import("fs/promises");
    await unlink(snapshotPath());
  } catch {
    // File didn't exist — fine.
  }
}

// ── Undo/redo history ───────────────────────────────────────────────
// A single active slot holding the full undoable canvas state (all past/future
// snapshots) as a compressed payload. Kept in its OWN file so it never bloats
// the synchronous snapshot read RootGate does at boot. The body is written/read
// verbatim (it is opaque compressed data — validating it by parsing here would
// waste CPU on a potentially large string; the renderer tolerates a null/garbage
// read and falls back to a cleared history).

/** Returns the raw JSON string of the persisted history, or null if none. */
export async function historyGet(): Promise<string | null> {
  try {
    return await readFile(historyPath(), "utf8");
  } catch {
    return null;
  }
}

/** Persist the history payload (raw JSON string from the renderer). */
export async function historySet(json: string): Promise<void> {
  await writeRawFile(historyPath(), json);
}

/** Delete the persisted history. */
export async function historyClear(): Promise<void> {
  try {
    const { unlink } = await import("fs/promises");
    await unlink(historyPath());
  } catch {
    // File didn't exist — fine.
  }
}

// ── Saved-designs library ───────────────────────────────────────────

/** Returns lightweight card list (sorted newest-first by updatedAt). */
export async function designsList(): Promise<SavedDesignMeta[]> {
  const metas = await readJson<SavedDesignMeta[]>(designsMetaPath(), []);
  return metas
    .filter((m) => m && typeof m.id === "string")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Returns the full entry for one design (meta merged with payload), or null. */
export async function designsGet(id: string): Promise<SavedDesignEntry | null> {
  const safe = safeId(id);
  const payloadPath = designPayloadPath(safe);
  if (!isInsideDesignsDir(payloadPath)) return null;
  const payload = await readJson<SavedDesignEntry | null>(payloadPath, null);
  if (!payload || typeof payload.id !== "string") return null;
  // Merge in the meta fields so the caller gets a complete entry.
  const metas = await readJson<SavedDesignMeta[]>(designsMetaPath(), []);
  const meta = metas.find((m) => m.id === id);
  return meta ? { ...payload, ...meta } : payload;
}

/** Upsert a design entry (writes payload file + updates meta list). */
export async function designsPut(entry: SavedDesignEntry): Promise<void> {
  if (!entry || typeof entry.id !== "string") throw new Error("entry.id must be a string");
  const safe = safeId(entry.id);
  const payloadPath = designPayloadPath(safe);
  if (!isInsideDesignsDir(payloadPath)) throw new Error("invalid design id");

  // Write the heavy payload file first.
  await writeJson(payloadPath, entry);

  // Update the meta list atomically.
  const metas = await readJson<SavedDesignMeta[]>(designsMetaPath(), []);
  const meta: SavedDesignMeta = {
    id: entry.id,
    name: (entry.name as string) || "Untitled design",
    size: (entry.size as string | null) ?? null,
    editorType: (entry.editorType as string | null) ?? null,
    cat: (entry.cat as string | null) ?? null,
    thumbnail: (entry.thumbnail as string | null) ?? null,
    createdAt: (entry.createdAt as number) || Date.now(),
    updatedAt: (entry.updatedAt as number) || Date.now(),
  };
  const rest = metas.filter((m) => m.id !== entry.id);
  await writeJson(designsMetaPath(), [meta, ...rest]);
}

/** Remove a design (payload file + meta list entry). */
export async function designsDelete(id: string): Promise<void> {
  const safe = safeId(id);
  const payloadPath = designPayloadPath(safe);
  if (!isInsideDesignsDir(payloadPath)) return;

  // Remove payload file (best-effort).
  try {
    const { unlink } = await import("fs/promises");
    await unlink(payloadPath);
  } catch {
    /* already gone */
  }

  // Remove from meta list.
  const metas = await readJson<SavedDesignMeta[]>(designsMetaPath(), []);
  await writeJson(designsMetaPath(), metas.filter((m) => m.id !== id));
}

// ── Saved Ideas library ─────────────────────────────────────────────
// A flat list of the customer's saved page/spread ideas. Each record is small
// (a single compressed layout), so the whole list lives in one JSON file — one
// read returns everything the Ideas tab needs to render. Per-account scoping and
// the retention cap are handled in the renderer (savedIdeas.js), matching how the
// saved-designs library treats its store.

/** Returns all saved ideas (newest-first by updatedAt). */
export async function ideasList(): Promise<SavedIdeaEntry[]> {
  const items = await readJson<SavedIdeaEntry[]>(ideasPath(), []);
  return items
    .filter((i) => i && typeof i.id === "string")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Upsert one saved idea (keyed by id). */
export async function ideasPut(entry: SavedIdeaEntry): Promise<void> {
  if (!entry || typeof entry.id !== "string") throw new Error("entry.id must be a string");
  const items = await readJson<SavedIdeaEntry[]>(ideasPath(), []);
  const rest = items.filter((i) => i && i.id !== entry.id);
  await writeJson(ideasPath(), [entry, ...rest]);
}

/** Remove one saved idea by id. */
export async function ideasDelete(id: string): Promise<void> {
  const items = await readJson<SavedIdeaEntry[]>(ideasPath(), []);
  await writeJson(ideasPath(), items.filter((i) => i && i.id !== id));
}

// ── Custom sizes ────────────────────────────────────────────────────

/** Returns the saved custom-size array (empty array if none). */
export async function sizesGet(): Promise<CustomSizeEntry[]> {
  return readJson<CustomSizeEntry[]>(sizesPath(), []);
}

/** Persist the full custom-size array (renderer owns the list). */
export async function sizesSet(sizes: CustomSizeEntry[]): Promise<void> {
  if (!Array.isArray(sizes)) throw new Error("sizes must be an array");
  await writeJson(sizesPath(), sizes);
}
