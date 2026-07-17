// Offline theme-pack store (desktop).
//
// A "theme pack" is a full theme downloaded for offline use: every size variant
// (raw `getTheme` response, kept in theme.json) plus all the binary assets the
// theme references (background/sticker/mask images, thumbnails). Layout under
// app.getPath("userData"):
//
//   theme-packs/
//     index.json                     ← lightweight meta list for the offline grid
//     <safeThemeId>/
//       manifest.json                ← meta + url→file map + variant list
//       theme.json                   ← RAW getTheme response (offline-open source)
//       assets/<urlHash>.<ext>       ← each downloaded binary
//
// IMPORTANT: this lives under userData/theme-packs, NOT userData/cache — the
// latter collides with Chromium's own HTTP cache (see the note in
// local-assets.service.resolveAssetPath). Bytes are served back to the renderer
// through the existing `app-assets://` privileged scheme under a `theme-pack`
// scope (resolveThemePackPath below), so no new scheme / CSP entry is needed.
//
// Mirrors editor-data.service.ts / local-assets.service.ts: atomic temp+rename
// writes and traversal-guarded paths. Renderer input is untrusted — validated here.

import { app } from "electron";
import { existsSync } from "fs";
import { randomBytes } from "crypto";
import { mkdir, writeFile, readFile, rename, rm, stat } from "fs/promises";
import { join, normalize, sep } from "path";
import type {
  ThemePackAsset,
  ThemePackManifest,
  ThemePackMeta,
  SaveThemePackInput,
} from "../../shared/ipc";

// The app-assets scheme is owned by protocol.ts; referenced here as a literal to
// avoid a circular import (protocol.ts imports resolveThemePackPath from here).
const ASSETS_SCHEME = "app-assets";

// ── Path helpers (sanitized + traversal-safe) ──────────────────────

// Theme ids are Mongo hex, but treat them as untrusted: strip anything that
// could escape the packs root. We deliberately DROP '.' (unlike the catalog/
// editor caches) because safeId's result is used as a DIRECTORY name here — a
// value like ".." must never survive as a parent-dir segment (it would resolve
// one level above the packs root). With dots and separators collapsed to "_",
// the result is always a single, contained path segment.
function safeId(raw: string): string {
  const cleaned = String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown";
}

function packsRoot(): string {
  return join(app.getPath("userData"), "theme-packs");
}

function packDir(themeId: string): string {
  return join(packsRoot(), safeId(themeId));
}

function assetsDir(themeId: string): string {
  return join(packDir(themeId), "assets");
}

function manifestPath(themeId: string): string {
  return join(packDir(themeId), "manifest.json");
}

function themeJsonPath(themeId: string): string {
  return join(packDir(themeId), "theme.json");
}

function indexPath(): string {
  return join(packsRoot(), "index.json");
}

// Only image extensions are ever stored/served so a written file can't later be
// served as active content from the app-assets origin. SVG is allowed (masks /
// clipart) — it is only ever <img>-loaded, and frame-src blocks framing it.
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"]);
const FILE_RE = /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/;

function isSafeAssetFile(file: string): boolean {
  if (typeof file !== "string" || !FILE_RE.test(file)) return false;
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

function isInsidePackDir(themeId: string, path: string): boolean {
  const root = normalize(packsRoot());
  const base = normalize(packDir(themeId));
  // Defense-in-depth: the pack dir must itself sit strictly INSIDE the packs
  // root, so even a degenerate id can never widen the base up to userData and
  // make the containment check below tautological.
  if (!base.startsWith(root + sep)) return false;
  const resolved = normalize(path);
  return resolved === base || resolved.startsWith(base + sep);
}

function isInsidePacksRoot(path: string): boolean {
  const base = normalize(packsRoot());
  const resolved = normalize(path);
  return resolved === base || resolved.startsWith(base + sep);
}

function localAssetUrl(themeId: string, file: string): string {
  // safeId so the url segment matches the on-disk dir the resolver computes.
  return `${ASSETS_SCHEME}://theme-pack/${safeId(themeId)}/assets/${file}`;
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

// A unique temp suffix per write. process.pid alone collides when two writes
// to the SAME path overlap (e.g. a save + delete both flushing index.json),
// interleaving writeFile/rename on one tmp and corrupting the target — so add
// random bytes too.
const tmpSuffix = () => `${process.pid}.${randomBytes(4).toString("hex")}`;

async function writeJson(path: string, value: unknown): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${tmpSuffix()}.tmp`;
  await writeFile(tmp, JSON.stringify(value), "utf8");
  await rename(tmp, path); // atomic replace
}

async function writeText(path: string, value: string): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${tmpSuffix()}.tmp`;
  await writeFile(tmp, value, "utf8");
  await rename(tmp, path);
}

// Serialize index.json read-modify-write so an overlapping saveManifest/delete
// can't lose-update each other (both read the same stale array, last writer
// wins). A simple per-process promise chain — index updates are infrequent.
let indexChain: Promise<unknown> = Promise.resolve();
function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = indexChain.then(fn, fn);
  indexChain = run.catch(() => undefined);
  return run;
}

// Same idea, per theme: saveManifest is now a read-modify-write (it unions the
// incoming assets into the prior manifest), so two overlapping saves for the
// SAME pack would otherwise both read the same prior state and the last writer
// would drop the other's assets. A download checkpoints periodically, so
// overlapping saves are a routine occurrence, not a corner case.
// A download checkpoints many times and re-sends the SAME theme.json each time.
// Re-validating (a synchronous multi-MB JSON.parse blocks the main process and
// janks every window) and rewriting byte-identical content is pure waste, so
// remember what we last wrote per pack and skip both when it hasn't changed.
// A cheap FNV-1a over the string — never a security boundary, just change
// detection; the content is still fully parsed the first time it is seen.
const lastThemeJsonHash = new Map<string, string>();

function cheapHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `${s.length}:${h.toString(36)}`;
}

const packChains = new Map<string, Promise<unknown>>();
function withPackLock<T>(themeId: string, fn: () => Promise<T>): Promise<T> {
  const key = safeId(themeId);
  const prev = packChains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the map from growing forever: drop the entry once this is the tail.
  const settled = run.catch(() => undefined);
  packChains.set(key, settled);
  settled.then(() => {
    if (packChains.get(key) === settled) packChains.delete(key);
  });
  return run;
}

// ── Public API (called by theme-packs.ipc) ─────────────────────────

/** Lightweight pack list for the offline grid, newest download first. */
export async function themePacksList(): Promise<ThemePackMeta[]> {
  const arr = await readJson<ThemePackMeta[]>(indexPath(), []);
  return arr
    .filter((m) => m && typeof m.themeId === "string")
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
}

/** Raw getTheme response JSON for one downloaded theme, or null. */
export async function themePacksGetThemeJson(themeId: string): Promise<string | null> {
  const p = themeJsonPath(themeId);
  if (!isInsidePackDir(themeId, p)) return null;
  try {
    const raw = await readFile(p, "utf8");
    JSON.parse(raw); // don't return corrupt data
    return raw;
  } catch {
    return null;
  }
}

/** True if a given asset file is already on disk (resume / dedupe). */
export async function themePacksHasAsset(themeId: string, file: string): Promise<boolean> {
  if (!isSafeAssetFile(file)) return false;
  const dest = join(assetsDir(themeId), file);
  return isInsidePackDir(themeId, dest) && existsSync(dest);
}

/** Write one downloaded binary. Idempotent: a no-op if the file already exists. */
export async function themePacksPutAsset(
  themeId: string,
  file: string,
  bytes: ArrayBuffer
): Promise<void> {
  if (!isSafeAssetFile(file)) throw new Error("invalid asset file name");
  const dir = assetsDir(themeId);
  const dest = join(dir, file);
  if (!isInsidePackDir(themeId, dest)) throw new Error("asset path escapes pack dir");
  if (existsSync(dest)) return;
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${file}.${process.pid}.tmp`);
  await writeFile(tmp, Buffer.from(bytes));
  await rename(tmp, dest);
}

/**
 * Persist theme.json + manifest.json and upsert the index entry — ADDITIVELY.
 *
 * This is a CHECKPOINT, not a "download finished" call. The renderer saves after
 * every batch of assets and on abort, so `input.assets` is only what THAT run
 * saw. A plain overwrite would therefore truncate an interrupted download's
 * record on every resume — the pack's earlier bytes would still be on disk but
 * would vanish from the url map, i.e. be unreachable and effectively lost.
 *
 * So we union with the prior manifest, under a per-pack lock (checkpoints
 * overlap by design). The union also protects a pack shared by two accounts:
 * getThemeById is size-filtered per user type, so a CUSTOMER's run legitimately
 * enumerates fewer assets than an admin's and must not erase the difference.
 *
 * `totalBytes` is computed from the files actually on disk rather than trusted
 * from the renderer: a resumed run only transfers the delta, so a renderer total
 * would make the pack appear to shrink on every resume.
 */
export async function themePacksSaveManifest(input: SaveThemePackInput): Promise<void> {
  if (!input || typeof input.themeId !== "string") throw new Error("themeId required");

  const { themeId } = input;
  const themeJsonHash = cheapHash(input.themeJson);
  // Unchanged since our last write for this pack → already validated, already on
  // disk. Skip the parse and the rewrite (see lastThemeJsonHash).
  const themeJsonChanged = lastThemeJsonHash.get(safeId(themeId)) !== themeJsonHash;
  if (themeJsonChanged) JSON.parse(input.themeJson); // validate before writing

  const incoming: ThemePackAsset[] = Array.isArray(input.assets)
    ? input.assets.filter((a) => a && typeof a.url === "string" && isSafeAssetFile(a.file))
    : [];

  // The lock is joined SYNCHRONOUSLY (nothing is awaited above it), so lock
  // order matches IPC arrival order. Awaiting anything first — theme.json used
  // to be written here — would let two saves for the same pack take the lock in
  // the order their filesystem writes happened to finish, and a checkpoint that
  // landed after the final save would stamp `complete: false` back over a pack
  // that had actually finished, stranding it behind Resume forever.
  // Writing theme.json inside also keeps a pack's two files consistent.
  await withPackLock(themeId, async () => {
    // Re-check inside the lock: a delete may have removed the file since, in
    // which case the memo is stale and it must be written again.
    if (themeJsonChanged || !existsSync(themeJsonPath(themeId))) {
      await writeText(themeJsonPath(themeId), input.themeJson);
      lastThemeJsonHash.set(safeId(themeId), themeJsonHash);
    }
    const prior = await readJson<ThemePackManifest | null>(manifestPath(themeId), null);

    // Union prior + incoming by url; incoming wins on collision. Prior entries
    // are re-validated rather than trusted — never echo back a name that
    // wouldn't pass today's rules just because an older build wrote it.
    const byUrl = new Map<string, ThemePackAsset>();
    for (const a of prior?.assets ?? []) {
      if (a && typeof a.url === "string" && isSafeAssetFile(a.file)) byUrl.set(a.url, a);
    }
    for (const a of incoming) byUrl.set(a.url, a);

    // Drop any entry whose bytes are gone (stale wipe, manual delete, failed
    // write) and total up what genuinely survives — one stat pass, both jobs.
    // A phantom entry would put a dead app-assets:// url into the url map.
    const assets: ThemePackAsset[] = [];
    let totalBytes = 0;
    for (const a of byUrl.values()) {
      try {
        const s = await stat(join(assetsDir(themeId), a.file));
        totalBytes += s.size;
        assets.push(a);
      } catch {
        /* file no longer on disk — reap the manifest entry */
      }
    }

    const present = new Set(assets.map((a) => a.url));
    // An url that has since downloaded successfully is no longer missing.
    const missing = [
      ...new Set([
        ...(Array.isArray(prior?.missing) ? prior!.missing : []),
        ...(Array.isArray(input.missing) ? input.missing.filter((u) => typeof u === "string") : []),
      ]),
    ].filter((u) => !present.has(u));

    // Resolve the thumbnail's local url (its original url lives in assets[]).
    const thumbAsset = input.thumbnailUrl
      ? assets.find((a) => a.url === input.thumbnailUrl)
      : undefined;
    const thumbnail = thumbAsset ? localAssetUrl(themeId, thumbAsset.file) : null;

    const manifest: ThemePackManifest = {
      themeId,
      name: input.name || "Untitled theme",
      category: input.category ?? null,
      version: input.version ?? null,
      fingerprint: input.fingerprint ?? null,
      thumbnail,
      sizesCount: Array.isArray(input.sizes) ? input.sizes.length : 0,
      downloadedAt: input.downloadedAt || Date.now(),
      totalBytes,
      complete: input.complete === true,
      missingCount: missing.length,
      sizes: Array.isArray(input.sizes) ? input.sizes : [],
      assets,
      fontUrls: Array.isArray(input.fontUrls) ? input.fontUrls : [],
      thumbnailUrl: input.thumbnailUrl ?? null,
      missing,
    };
    await writeJson(manifestPath(themeId), manifest);

    const meta: ThemePackMeta = {
      themeId: manifest.themeId,
      name: manifest.name,
      category: manifest.category,
      version: manifest.version,
      fingerprint: manifest.fingerprint,
      thumbnail: manifest.thumbnail,
      sizesCount: manifest.sizesCount,
      downloadedAt: manifest.downloadedAt,
      totalBytes: manifest.totalBytes,
      complete: manifest.complete,
      missingCount: manifest.missingCount,
    };
    await withIndexLock(async () => {
      const arr = await readJson<ThemePackMeta[]>(indexPath(), []);
      const rest = arr.filter((m) => m && m.themeId !== themeId);
      await writeJson(indexPath(), [meta, ...rest]);
    });
  });
}

/**
 * Remove a pack (directory + index entry).
 *
 * Takes the SAME per-pack lock as saveManifest: a delete that interleaved with a
 * download's checkpoint would rm -rf the directory and then have the checkpoint
 * write manifest.json + an index entry straight back, resurrecting the pack the
 * user just removed. (The renderer additionally refuses to delete a pack whose
 * download is still running — this lock is the main-side backstop.)
 */
export async function themePacksDelete(themeId: string): Promise<void> {
  await withPackLock(themeId, async () => {
    lastThemeJsonHash.delete(safeId(themeId)); // the file is about to go — forget it
    const dir = packDir(themeId);
    if (isInsidePacksRoot(dir) && dir !== normalize(packsRoot())) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
    await withIndexLock(async () => {
      const arr = await readJson<ThemePackMeta[]>(indexPath(), []);
      await writeJson(indexPath(), arr.filter((m) => m && m.themeId !== themeId));
    });
  });
}

/** originalUrl → app-assets:// url for every asset of every pack, partial included. */
export async function themePacksUrlMap(): Promise<Record<string, string>> {
  const metas = await themePacksList();
  const map: Record<string, string> = {};
  for (const meta of metas) {
    // Include partial packs too: manifest.assets only lists files actually
    // written to disk, so every mapped url is guaranteed to resolve. Skipping
    // partial packs would needlessly break their already-downloaded assets.
    const manifest = await readJson<ThemePackManifest | null>(
      manifestPath(meta.themeId),
      null
    );
    if (!manifest || !Array.isArray(manifest.assets)) continue;
    for (const a of manifest.assets) {
      if (a && typeof a.url === "string" && isSafeAssetFile(a.file)) {
        map[a.url] = localAssetUrl(meta.themeId, a.file);
      }
    }
  }
  return map;
}

// ── Custom-protocol path resolution (app-assets://theme-pack/...) ───
// Maps `app-assets://theme-pack/<themeId>/assets/<file>` → an absolute path
// inside the pack dir, with a traversal guard. Returns null if out of bounds.
export function resolveThemePackPath(parts: string[]): string | null {
  if (parts.length < 2) return null;
  const themeId = safeId(parts[0] ?? "");
  const rest = parts.slice(1);
  const root = normalize(packsRoot());
  const base = normalize(packDir(themeId));
  if (!base.startsWith(root + sep)) return null; // pack dir must be inside root
  const filePath = normalize(join(base, ...rest));
  return filePath === base || filePath.startsWith(base + sep) ? filePath : null;
}
