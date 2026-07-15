// On-disk font cache (desktop). The renderer downloads WOFF2/TTF fonts from the
// brand's font API on first use; this caches the bytes under userData so later
// sessions load them straight from disk instead of re-hitting the network.
//
// Keyed by a hash of the source URL (stable per font file, filesystem-safe).
// Layout: userData/cache/fonts/<sha256-of-url>.<ext>

import { app } from "electron";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile, rename } from "fs/promises";
import { join } from "path";

function fontsDir(): string {
  return join(app.getPath("userData"), "cache", "fonts");
}

function extFromUrl(url: string): string {
  const m = /\.(woff2|woff|ttf|otf)(?:[?#]|$)/i.exec(url);
  return m && m[1] ? m[1].toLowerCase() : "woff2";
}

function cachePathFor(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return join(fontsDir(), `${hash}.${extFromUrl(url)}`);
}

/** Read cached font bytes for a URL, or null if not cached. */
export async function getCachedFont(url: string): Promise<ArrayBuffer | null> {
  const p = cachePathFor(url);
  if (!existsSync(p)) return null;
  try {
    const buf = await readFile(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/** Write font bytes to the cache (atomic temp+rename). No-op on failure. */
export async function putCachedFont(url: string, bytes: ArrayBuffer): Promise<void> {
  const p = cachePathFor(url);
  if (existsSync(p)) return; // already cached — fonts are immutable per URL
  try {
    await mkdir(fontsDir(), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    await writeFile(tmp, Buffer.from(bytes));
    await rename(tmp, p);
  } catch {
    /* cache write is best-effort */
  }
}
