// Local user-photo store (offline-first desktop). User photos are NEVER uploaded
// to S3 on desktop — they are resized in the renderer, the variant bytes are sent
// here, and we write them content-addressed to disk + record an index entry so the
// sidebar gallery survives restarts.
//
// Layout under app.getPath("userData"):
//   projects/<projectId>/assets/<sha256>.<ext>   ← deduped variant files
//   projects/<projectId>/index.json              ← gallery index (authoritative copy in RAM)
//
// Two correctness properties this module guarantees:
//   1. NO read-modify-write race under bulk import. The index is held in memory as
//      the source of truth (loaded once per project, deduped via a load promise),
//      mutated SYNCHRONOUSLY (no await between read and mutate), and flushed
//      atomically (temp + rename), debounced. Up to MAX_CONCURRENT_UPLOADS save
//      calls can land at once; none clobber each other.
//   2. Stable, monotonic, unique ids. Each saved asset gets an ObjectId-shaped
//      24-hex id whose string compare matches creation order (the gallery sorts and
//      keys by _id). Identity is separate from on-disk storage (which is hashed).

import { app } from "electron";
import { createHash, randomBytes } from "crypto";
import { existsSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { mkdir, writeFile, readFile, rename, unlink } from "fs/promises";
import { join, normalize, sep, isAbsolute, extname, parse } from "path";
import type {
  LocalAsset,
  LocalAssetUrl,
  SaveAssetInput,
  ListAssetsInput,
  ListAssetsResult,
} from "../../shared/ipc";

// ── ObjectId-shaped id minting ─────────────────────────────────────
// Mirror MongoDB's ObjectId so the gallery's "_id hex compare == added order"
// invariant holds: 4-byte seconds + 5-byte per-process-CONSTANT random + 3-byte
// counter. Within one second the seconds and the process-random are equal, so the
// trailing counter alone decides order → strictly monotonic. (A fresh random per id
// would scramble within-second order — a 30-image batch all lands in one second.)
const PROCESS_RANDOM = randomBytes(5).toString("hex"); // 10 hex, constant per process
let idCounter = randomBytes(3).readUIntBE(0, 3);

function mintObjectId(): string {
  const seconds = Math.floor(Date.now() / 1000);
  idCounter = (idCounter + 1) % 0x1000000;
  return (
    seconds.toString(16).padStart(8, "0") +
    PROCESS_RANDOM +
    idCounter.toString(16).padStart(6, "0")
  );
}

// ── Path helpers (sanitized + traversal-safe) ──────────────────────
// A projectId comes from the renderer (cart_order_id). Strip everything that
// isn't a safe id char so it can never escape the projects root.
function safeId(raw: string): string {
  const cleaned = String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.length > 0 ? cleaned : "default";
}

function projectsRoot(): string {
  return join(app.getPath("userData"), "projects");
}

function projectDir(projectId: string): string {
  return join(projectsRoot(), safeId(projectId));
}

function assetsDir(projectId: string): string {
  return join(projectDir(projectId), "assets");
}

function indexPath(projectId: string): string {
  return join(projectDir(projectId), "index.json");
}

// Only image extensions are ever stored — never let the renderer pick an
// arbitrary one (e.g. ".html"), so a written file can't later be served/framed
// as active content from the app-assets origin.
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
function extFor(ext: string): string {
  const cleaned = String(ext || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ALLOWED_EXTS.has(cleaned) ? cleaned : "jpg";
}

function assetUrl(projectId: string, fileName: string): string {
  return `app-assets://project/${safeId(projectId)}/${fileName}`;
}

// Reference-mode full-res URL. Keyed by the ASSET ID only — the renderer never
// supplies a filesystem path at serve time; the `original` protocol scope maps
// this id back to the stored `originalPath` (see resolveOriginalPath). The ext is
// the original file's real extension (drives the served content-type).
function originalUrl(projectId: string, assetId: string, ext: string): string {
  return `app-assets://original/${safeId(projectId)}/${assetId}.${extFor(ext)}`;
}

// A renderer-supplied original path is an arbitrary-file-read primitive, so it is
// only ever accepted / served when it is absolute AND names an allowed image
// extension. Existence is checked separately (at list + serve time) so a file
// that vanishes after import degrades to a "re-add" prompt rather than a throw.
function extOfPath(p: string): string {
  return extname(String(p || "")).replace(/^\./, "").toLowerCase();
}
function isAcceptableOriginalPath(p: unknown): p is string {
  if (typeof p !== "string" || p.length === 0 || p.includes("\0")) return false;
  const norm = normalize(p);
  if (!isAbsolute(norm) || !ALLOWED_EXTS.has(extOfPath(norm))) return false;
  // Windows: isAbsolute() also accepts UNC (\\host\share\…) and device
  // (\\?\, \\.\) paths. An existsSync/serve on \\attacker\share triggers an
  // OUTBOUND SMB/NTLM auth to that host — a credential-relay (Responder) vector.
  // Require a LOCAL drive-letter root (mapped network drives like Z:\ are fine;
  // raw UNC is not). Non-Windows absolute paths ("/…") are unaffected.
  if (process.platform === "win32") {
    if (/^[\\/]{2}/.test(norm)) return false; // UNC or \\?\ / \\.\ device path
    if (!/^[A-Za-z]:[\\/]$/.test(parse(norm).root)) return false;
  }
  return true;
}

// ── In-memory index cache + dedup + debounced atomic flush ──────────
const indexCache = new Map<string, LocalAsset[]>();
const loadPromises = new Map<string, Promise<LocalAsset[]>>();
const flushTimers = new Map<string, NodeJS.Timeout>();
const dirty = new Set<string>();

const FLUSH_DEBOUNCE_MS = 300;

// Load the on-disk index once per project. Concurrent first-calls share ONE
// readFile (loadPromises) so two simultaneous saves can't both create empty caches.
async function ensureLoaded(projectId: string): Promise<LocalAsset[]> {
  const key = safeId(projectId);
  const cached = indexCache.get(key);
  if (cached) return cached;
  const inflight = loadPromises.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    let list: LocalAsset[] = [];
    try {
      const raw = await readFile(indexPath(projectId), "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed as LocalAsset[];
    } catch {
      // No index yet (first run for this project) — start empty.
    }
    indexCache.set(key, list);
    loadPromises.delete(key);
    return list;
  })();
  loadPromises.set(key, p);
  return p;
}

function scheduleFlush(projectId: string): void {
  const key = safeId(projectId);
  dirty.add(key);
  const existing = flushTimers.get(key);
  if (existing) clearTimeout(existing);
  flushTimers.set(
    key,
    setTimeout(() => {
      flushTimers.delete(key);
      void flush(projectId);
    }, FLUSH_DEBOUNCE_MS)
  );
}

async function flush(projectId: string): Promise<void> {
  const key = safeId(projectId);
  if (!dirty.has(key)) return;
  const list = indexCache.get(key);
  if (!list) return;
  dirty.delete(key);
  const dir = projectDir(projectId);
  const tmp = join(dir, `index.json.${process.pid}.tmp`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmp, JSON.stringify(list), "utf8");
    await rename(tmp, indexPath(projectId)); // atomic replace
  } catch (err) {
    // Re-mark dirty so a later save retries the flush.
    dirty.add(key);
  }
}

// Flush every dirty index synchronously on quit so a save in the last
// FLUSH_DEBOUNCE_MS window is never lost.
export function flushAllSync(): void {
  for (const key of Array.from(dirty)) {
    const list = indexCache.get(key);
    if (!list) continue;
    const dir = join(projectsRoot(), key);
    const tmp = join(dir, `index.json.${process.pid}.sync.tmp`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify(list), "utf8");
      renameSync(tmp, join(dir, "index.json"));
      dirty.delete(key);
    } catch (err) {}
  }
}

// ── Public API (called by assets.ipc) ──────────────────────────────

/**
 * Persist one image's resized variants to disk and append an index entry.
 * Files are written BEFORE the index entry, so a crash mid-flush leaves a
 * recoverable orphan file rather than a broken gallery.
 */
export async function saveAsset(input: SaveAssetInput): Promise<LocalAsset> {
  const { projectId, fileName, fileSize, width, height, variants } = input;
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error("no variants to save");
  }

  // REFERENCE MODE: an acceptable original path means we DON'T copy full-res —
  // only the small thumbnail bytes the renderer sent are written to disk, and a
  // full-res `large` url is synthesized against the original-scope handler.
  const referenced = isAcceptableOriginalPath(input.originalPath);
  const assetId = mintObjectId(); // minted up-front — the original url needs it

  const dir = assetsDir(projectId);
  await mkdir(dir, { recursive: true });

  // 1. Write each provided variant content-addressed (dedup: skip if hash exists).
  //    In reference mode `variants` is just the small thumb; in copy mode it is
  //    the full large/medium/small set (today's behavior, unchanged).
  const urls: LocalAssetUrl[] = [];
  const scale: Record<string, number> = { large: 1, medium: 0.5, small: 0.25 };
  for (const v of variants) {
    const buf = Buffer.from(v.bytes);
    const hash = createHash("sha256").update(buf).digest("hex");
    const ext = extFor(v.ext);
    const file = `${hash}.${ext}`;
    const dest = join(dir, file);
    if (!existsSync(dest)) {
      const tmp = join(dir, `${hash}.${process.pid}.tmp`);
      await writeFile(tmp, buf);
      await rename(tmp, dest);
    }
    const s = scale[v.size] ?? 1;
    urls.push({
      size: v.size,
      url: assetUrl(projectId, file),
      w: Math.max(1, Math.round(width * s)),
      h: Math.max(1, Math.round(height * s)),
    });
  }

  // In reference mode add a full-res `large` url served from the original file.
  // Placement + export read `large`; the gallery reads `small` (the copied thumb).
  if (referenced && !urls.some((u) => u.size === "large")) {
    urls.push({
      size: "large",
      url: originalUrl(projectId, assetId, extOfPath(input.originalPath as string)),
      w: Math.max(1, Math.round(width)),
      h: Math.max(1, Math.round(height)),
    });
  }

  // 2. Append the index entry (in-memory authoritative copy, mutated synchronously).
  const list = await ensureLoaded(projectId);
  const asset: LocalAsset = {
    _id: assetId,
    file_name: fileName || "image",
    fileSize: typeof fileSize === "number" ? fileSize : 0,
    width,
    height,
    is_favorite: false,
    created_at: new Date().toISOString(),
    urls,
    ...(referenced ? { originalPath: normalize(input.originalPath as string) } : {}),
  };
  list.push(asset); // synchronous — no await between ensureLoaded and here
  scheduleFlush(projectId);
  return asset;
}

export async function listAssets(input: ListAssetsInput): Promise<ListAssetsResult> {
  const { projectId, skip = 0, limit, sortField = "_id", sortOrder = "asc" } = input;
  const list = await ensureLoaded(projectId);
  const totalCount = list.length;

  const field: "created_at" | "file_name" | "_id" =
    sortField === "created_at" || sortField === "file_name" ? sortField : "_id";
  const dir = sortOrder === "desc" ? -1 : 1;
  const sorted = [...list].sort((a, b) => {
    const av = String(a[field] ?? "");
    const bv = String(b[field] ?? "");
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  const start = Math.max(0, skip);
  const page = limit != null ? sorted.slice(start, start + limit) : sorted.slice(start);
  // Stamp `originalMissing` for reference-mode assets whose original file is gone
  // (moved/deleted) so the gallery can surface the "re-add this image" toast.
  // Stamped on RETURNED COPIES only — never mutate the stored entry (this is
  // transient status, not something to persist into index.json).
  const items = page.map((a) =>
    a.originalPath
      ? {
          ...a,
          // Guard existsSync behind isAcceptableOriginalPath so a tampered/UNC
          // path in the index is reported missing WITHOUT an fs/network touch.
          originalMissing: !(isAcceptableOriginalPath(a.originalPath) && existsSync(a.originalPath)),
        }
      : a
  );
  return { items, totalCount };
}

export async function setFavorite(
  projectId: string,
  id: string,
  favorite: boolean
): Promise<void> {
  const list = await ensureLoaded(projectId);
  const entry = list.find((a) => a._id === id);
  if (entry) {
    entry.is_favorite = !!favorite;
    scheduleFlush(projectId);
  }
}

/**
 * Given asset ids, return the subset that are reference-mode assets whose
 * original file is currently missing on disk. Copy-mode assets (no originalPath)
 * are never "missing" — their bytes live in AppData — so they're excluded.
 * Used to gate order/export so a moved/deleted original never prints blank.
 */
export async function checkMissingOriginals(
  projectId: string,
  ids: string[]
): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const list = await ensureLoaded(projectId);
  const wanted = new Set(ids);
  const missing: string[] = [];
  for (const a of list) {
    if (!wanted.has(a._id) || !a.originalPath) continue;
    // Unacceptable (e.g. tampered UNC) paths count as missing without an fs touch.
    if (!isAcceptableOriginalPath(a.originalPath) || !existsSync(a.originalPath)) {
      missing.push(a._id);
    }
  }
  return missing;
}

export async function removeAssets(projectId: string, ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const list = await ensureLoaded(projectId);
  const idSet = new Set(ids);

  // Filenames referenced ONLY by removed entries can be unlinked; a hash shared
  // with a surviving entry (dedup) must stay.
  //
  // ⚠️ DELETE SAFETY (critical): we ONLY ever unlink `app-assets://project/…`
  // thumbnail copies that live inside this project's assets dir. Reference-mode
  // assets carry an `app-assets://original/…` url and an `originalPath` pointing
  // at the USER'S REAL PHOTO on their disk — a gallery delete must NEVER touch
  // that. `isProjectCopyUrl` excludes the original scope, and `originalPath` is
  // deliberately never read here.
  const removedFiles = new Set<string>();
  const kept: LocalAsset[] = [];
  for (const a of list) {
    if (idSet.has(a._id)) {
      for (const u of a.urls) if (isProjectCopyUrl(u.url)) removedFiles.add(fileNameFromUrl(u.url));
    } else {
      kept.push(a);
    }
  }
  const stillReferenced = new Set<string>();
  for (const a of kept)
    for (const u of a.urls) if (isProjectCopyUrl(u.url)) stillReferenced.add(fileNameFromUrl(u.url));

  // Mutate the in-memory list in place (preserve array identity / order).
  list.length = 0;
  list.push(...kept);
  scheduleFlush(projectId);

  const dir = assetsDir(projectId);
  await Promise.all(
    Array.from(removedFiles)
      .filter((f) => f && !stillReferenced.has(f))
      .map((f) => safeUnlink(join(dir, f)))
  );
}

function fileNameFromUrl(url: string): string {
  const i = url.lastIndexOf("/");
  return i >= 0 ? url.slice(i + 1) : url;
}

// Only project-scope thumbnail copies live inside assetsDir and are ours to
// unlink. The original scope points at the user's real file — never deletable.
function isProjectCopyUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith("app-assets://project/");
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    /* already gone — fine */
  }
}

// ── Custom-protocol path resolution (used by app-assets:// handler) ─
// Maps `app-assets://project/<projectId>/<file>` → an absolute path inside the
// project's assets dir, with a traversal guard. Returns null if out of bounds.
export function resolveAssetPath(scope: string, parts: string[]): string | null {
  if (scope === "project") {
    if (parts.length < 2) return null;
    const projectId = safeId(parts[0] ?? "");
    const rest = parts.slice(1);
    const base = normalize(assetsDir(projectId));
    const filePath = normalize(join(base, ...rest));
    return filePath === base || filePath.startsWith(base + sep) ? filePath : null;
  }
  // NOTE: a future "cache" scope (library assets) must point at a dedicated
  // app-created dir with its own guard — NOT userData/cache, which collides with
  // Chromium's own HTTP cache. Left unimplemented on purpose: unknown scopes 404.
  return null;
}

// ── Reference-mode full-res resolution (app-assets://original/…) ────
// Maps `app-assets://original/<projectId>/<assetId>.<ext>` → the absolute
// `originalPath` recorded for that asset. The renderer supplies ONLY the id, so
// it can never point us at an arbitrary path — the path comes from our own index.
// Re-validated at EVERY request (never trust the stored string blindly):
//   • the asset must exist in the index and carry an originalPath
//   • the path must be absolute + an allowed image extension
//   • the file must still exist on disk (else 404 → the gallery's re-add toast)
export async function resolveOriginalPath(parts: string[]): Promise<string | null> {
  if (parts.length < 2) return null;
  const projectId = safeId(parts[0] ?? "");
  const file = parts[1] ?? "";
  const assetId = file.replace(/\.[a-z0-9]+$/i, "");
  if (!/^[a-f0-9]{24}$/i.test(assetId)) return null;

  const list = await ensureLoaded(projectId);
  const entry = list.find((a) => a._id === assetId);
  const p = entry?.originalPath;
  if (!isAcceptableOriginalPath(p)) return null;
  const norm = normalize(p);
  return existsSync(norm) ? norm : null;
}
