// Offline-first catalog cache for editor library assets (desktop).
//
// The renderer fetches paginated listing/catalog JSON for layouts, backgrounds,
// stickers, masks and themes (plus their category lists and theme-by-id detail)
// from the brand API. This service persists the LAST SUCCESSFUL response for each
// distinct query under userData so the panels stay fully browsable offline:
//
//   userData/cache/assets/
//     layouts/<key>.json
//     backgrounds/<key>.json
//     stickers/<key>.json
//     masks/<key>.json
//     themes/<key>.json          ← listing + per-theme detail (theme:<id>)
//     <category>/<key>.json
//
// where <key> is a renderer-computed, filesystem-safe hash of the request
// (page/skip/limit/search/tag/editor-type/…). The renderer reads from here when a
// fetch yields no items (offline / API error) and writes through on every success
// — so when the connection is restored the cache refreshes automatically.
//
// This mirrors editor-data.service.ts (atomic temp+rename writes, traversal
// guards) and font-cache.service.ts (per-category cache dir). It stores ONLY
// catalog JSON — binary asset bytes still load from their CDN URLs, which
// Chromium's HTTP cache already keeps warm.

import { app } from "electron";
import { mkdir, writeFile, readFile, rename, readdir, unlink } from "fs/promises";
import { join, normalize, sep } from "path";

// ── Path helpers ────────────────────────────────────────────────────

function assetsRoot(): string {
  return join(app.getPath("userData"), "cache", "assets");
}

function categoryDir(category: string): string {
  return join(assetsRoot(), safeSegment(category));
}

function entryPath(category: string, key: string): string {
  return join(categoryDir(category), `${safeSegment(key)}.json`);
}

// Strip anything that could escape the cache dir (traversal guard). Colons are
// valid in logical keys (e.g. "theme:abc123") but illegal in Windows filenames,
// so they collapse to underscore for the on-disk name. The logical category/key
// the renderer passes is the contract; the on-disk name is an implementation
// detail.
function safeSegment(raw: string): string {
  const cleaned = String(raw || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown";
}

// Traversal guard: ensure a resolved path stays inside the assets cache root.
function isInsideAssetsRoot(path: string): boolean {
  const base = normalize(assetsRoot());
  const resolved = normalize(path);
  return resolved === base || resolved.startsWith(base + sep);
}

// ── Atomic JSON write ───────────────────────────────────────────────

async function writeJson(path: string, value: unknown): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value), "utf8");
  await rename(tmp, path); // atomic replace
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Read the cached catalog payload for one (category, key) query, or null if it
 * has never been cached (or the file is unreadable / corrupt).
 */
export async function assetsCacheGet(
  category: string,
  key: string
): Promise<unknown | null> {
  const path = entryPath(category, key);
  if (!isInsideAssetsRoot(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write-through the latest successful catalog payload for one (category, key)
 * query. Best-effort: a failed cache write must never break the online path, so
 * callers treat rejection as non-fatal.
 */
export async function assetsCachePut(
  category: string,
  key: string,
  value: unknown
): Promise<void> {
  const path = entryPath(category, key);
  if (!isInsideAssetsRoot(path)) throw new Error("invalid asset cache key");
  await writeJson(path, value);
}

/**
 * Drop every cached entry for one category (e.g. when the server signals the
 * asset set changed). Best-effort and idempotent.
 */
export async function assetsCacheClear(category: string): Promise<void> {
  const dir = categoryDir(category);
  if (!isInsideAssetsRoot(dir)) return;
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return; // nothing cached yet
  }
  await Promise.all(
    names.map(async (name) => {
      const p = join(dir, name);
      if (!isInsideAssetsRoot(p)) return;
      try {
        await unlink(p);
      } catch {
        /* already gone */
      }
    })
  );
}
