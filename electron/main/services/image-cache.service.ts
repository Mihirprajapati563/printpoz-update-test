// On-disk binary cache for remote preview/thumbnail images (desktop).
//
// The renderer shows many remote thumbnails (theme previews, background /
// sticker / mask panel thumbnails). Chromium's HTTP cache keeps them warm while
// online, but it is not durable and is wiped when offline for long. This service
// persists the actual image BYTES under userData so those previews render with no
// connection — the offline-first counterpart to the JSON catalog cache
// (assets-cache.service.ts) which only stores listing JSON.
//
// Layout under app.getPath("userData"):
//   cache/images/<sha256-of-url>.<ext>   ← the image bytes (dedup by url hash)
//   cache/images/index.json              ← url → file map (+ mime, cachedAt, size)
//
// The bytes are served back to the renderer via the app-assets:// privileged
// scheme under a new `image-cache` scope:
//   app-assets://image-cache/<sha256>.<ext>
// (registered/dispatched in protocol.ts → resolveImageCachePath).
//
// Concurrency: many thumbnails cache at once when a panel opens. To avoid a
// read-modify-write race on index.json we hold the index in memory as the source
// of truth (loaded once), mutate it SYNCHRONOUSLY, and flush atomically (temp +
// rename) on a debounce — the same battle-tested shape as local-assets.service.
// A `flushSync` is wired into before-quit so a write in the last debounce window
// is never lost.
//
// Best-effort throughout: a failed read/write must never break the online path
// (the renderer falls back to the original CDN url), so callers treat rejection
// as non-fatal.

import { app } from "electron";
import { createHash, randomBytes } from "crypto";
import { existsSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { mkdir, writeFile, readFile, rename, unlink } from "fs/promises";
import { join, normalize, sep } from "path";

interface ImageCacheEntry {
  url: string; // original remote url (the logical key)
  file: string; // on-disk name "<sha256(url)>.<ext>"
  mime: string;
  cachedAt: number;
  size: number;
}

// ── Path helpers ────────────────────────────────────────────────────

function imagesDir(): string {
  // Sibling of cache/fonts and cache/assets (both proven working here). This is a
  // best-effort, re-fetchable cache, so living under userData/cache is acceptable
  // even if Chromium ever prunes it — unlike theme-packs (must persist), which
  // deliberately live under userData/theme-packs instead.
  return join(app.getPath("userData"), "cache", "images");
}

function indexPath(): string {
  return join(imagesDir(), "index.json");
}

// Never serve/write an arbitrary extension (e.g. ".html") from the app-assets
// origin — only known image types. SVG is included because sticker/mask previews
// are frequently SVG and MUST be served as image/svg+xml to render in <img> /
// background-image (raster types decode by content, but SVG-as-image needs the
// right ext so net.fetch labels it correctly).
const ALLOWED_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
  "bmp",
  "ico",
]);

function extForMime(mime: string, url: string): string {
  const m = String(mime || "").toLowerCase();
  if (m.includes("svg")) return "svg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("avif")) return "avif";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("icon") || m.includes("x-icon")) return "ico";
  // Fall back to the url's own extension, then jpg.
  const um = /\.(jpe?g|png|webp|gif|avif|svg|bmp|ico)(?:[?#]|$)/i.exec(url);
  if (um && um[1]) {
    const e = um[1].toLowerCase();
    return e === "jpeg" ? "jpg" : e;
  }
  return "jpg";
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function appUrlFor(file: string): string {
  return `app-assets://image-cache/${file}`;
}

// ── In-memory index + debounced atomic flush ────────────────────────

let index: Map<string, ImageCacheEntry> | null = null; // key = original url
let loadPromise: Promise<Map<string, ImageCacheEntry>> | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let dirty = false;

const FLUSH_DEBOUNCE_MS = 400;

async function ensureLoaded(): Promise<Map<string, ImageCacheEntry>> {
  if (index) return index;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const m = new Map<string, ImageCacheEntry>();
    try {
      const raw = await readFile(indexPath(), "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          if (e && typeof e.url === "string" && typeof e.file === "string") {
            m.set(e.url, e as ImageCacheEntry);
          }
        }
      }
    } catch {
      // No index yet (first run) — start empty.
    }
    index = m;
    loadPromise = null;
    return m;
  })();
  return loadPromise;
}

function scheduleFlush(): void {
  dirty = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!dirty || !index) return;
  dirty = false;
  const list = Array.from(index.values());
  try {
    await mkdir(imagesDir(), { recursive: true });
    const tmp = join(
      imagesDir(),
      `index.json.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
    );
    await writeFile(tmp, JSON.stringify(list), "utf8");
    await rename(tmp, indexPath()); // atomic replace
  } catch (err) {
    dirty = true; // retry on the next scheduleFlush
  }
}

/** Flush the index synchronously on quit (called from before-quit). */
export function imageCacheFlushSync(): void {
  if (!dirty || !index) return;
  const list = Array.from(index.values());
  try {
    mkdirSync(imagesDir(), { recursive: true });
    const tmp = join(imagesDir(), `index.json.${process.pid}.sync.tmp`);
    writeFileSync(tmp, JSON.stringify(list), "utf8");
    renameSync(tmp, indexPath());
    dirty = false;
  } catch (err) {}
}

// ── Public API (called by image-cache.ipc) ──────────────────────────

/**
 * Return the local app-assets:// url for a cached remote url, or null if it has
 * never been cached (or its file has since vanished — self-heals the index).
 */
export async function imageCacheGet(url: string): Promise<string | null> {
  if (!url) return null;
  const m = await ensureLoaded();
  const e = m.get(url);
  if (!e) return null;
  if (!existsSync(join(imagesDir(), e.file))) {
    m.delete(url);
    scheduleFlush();
    return null;
  }
  return appUrlFor(e.file);
}

/**
 * Persist the bytes of a remote image and return its local app-assets:// url.
 * Idempotent — if already cached (and the file is present) it just returns the
 * existing url without rewriting.
 */
export async function imageCachePut(
  url: string,
  bytes: ArrayBuffer,
  mime: string
): Promise<string> {
  if (!url || !bytes) throw new Error("url and bytes are required");
  const m = await ensureLoaded();

  const existing = m.get(url);
  if (existing && existsSync(join(imagesDir(), existing.file))) {
    return appUrlFor(existing.file);
  }

  const ext = extForMime(mime, url);
  const file = `${hashUrl(url)}.${ext}`;
  const dir = imagesDir();
  const dest = join(dir, file);
  const buf = Buffer.from(bytes);

  await mkdir(dir, { recursive: true });
  if (!existsSync(dest)) {
    // Unique tmp suffix (pid alone collides when two concurrent puts of the SAME
    // url race — both compute the same tmp path → ENOENT on the second rename +
    // an orphan .tmp; see theme-packs.service.ts for the same fix).
    const tmp = join(
      dir,
      `${hashUrl(url)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
    );
    await writeFile(tmp, buf);
    await rename(tmp, dest); // atomic
  }

  const entry: ImageCacheEntry = {
    url,
    file,
    mime: String(mime || ""),
    cachedAt: Date.now(),
    size: buf.byteLength,
  };
  m.set(url, entry); // synchronous mutate — no await since ensureLoaded
  scheduleFlush();
  return appUrlFor(file);
}

/**
 * Every cached original-url → app-assets-url pair. The renderer loads this once
 * at boot into an in-memory lookup (like the theme-pack url map) so an offline
 * resolve is a synchronous hit with no IPC round-trip per image.
 */
export async function imageCacheUrlMap(): Promise<Record<string, string>> {
  const m = await ensureLoaded();
  const out: Record<string, string> = {};
  for (const e of m.values()) out[e.url] = appUrlFor(e.file);
  return out;
}

/** Evict entries older than maxAgeMs (bytes + index) so the cache stays bounded. */
export async function imageCacheEvict(maxAgeMs: number): Promise<void> {
  const m = await ensureLoaded();
  const cutoff = Date.now() - (maxAgeMs > 0 ? maxAgeMs : 0);
  const stale = Array.from(m.values()).filter((e) => (e.cachedAt || 0) < cutoff);
  if (stale.length === 0) return;
  for (const e of stale) {
    m.delete(e.url);
    try {
      await unlink(join(imagesDir(), e.file));
    } catch {
      /* already gone */
    }
  }
  scheduleFlush();
}

// ── Custom-protocol path resolution (used by the app-assets:// handler) ─
// Maps `app-assets://image-cache/<sha256>.<ext>` → an absolute path inside the
// images cache dir, with an extension allowlist + traversal guard. Returns null
// (→ 403) for anything that doesn't match the strict "<hex>.<ext>" shape.
export function resolveImageCachePath(parts: string[]): string | null {
  if (parts.length !== 1) return null;
  const file = parts[0] ?? "";
  const mm = /^([a-f0-9]{16,64})\.([a-z0-9]{1,5})$/i.exec(file);
  if (!mm) return null;
  const ext = (mm[2] ?? "").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) return null;
  const base = normalize(imagesDir());
  const filePath = normalize(join(base, file));
  return filePath === base || filePath.startsWith(base + sep) ? filePath : null;
}
