import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Encrypted key/value store backed by the OS keychain (DPAPI on Windows, Keychain on
// macOS) via Electron safeStorage. Falls back to base64 (NOT secure) only when OS
// encryption is unavailable, so the app still functions.
function storePath(): string {
  const dir = join(app.getPath("userData"), "secure");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "store.json");
}

// In-memory cache so frequent get() calls (e.g. token reads per API request) don't hit disk
// on every call. Invalidated on write (single-process owner).
let cache: Record<string, string> | null = null;

function readAll(): Record<string, string> {
  if (cache) return cache;
  try {
    const p = storePath();
    cache = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeAll(data: Record<string, string>): void {
  cache = data;
  writeFileSync(storePath(), JSON.stringify(data), "utf8");
}

export const secureStore = {
  get(key: string): string | null {
    const enc = readAll()[key];
    if (enc == null) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(enc, "base64").toString("utf8");
    }
    try {
      return safeStorage.decryptString(Buffer.from(enc, "base64"));
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    const all = readAll();
    if (safeStorage.isEncryptionAvailable()) {
      all[key] = safeStorage.encryptString(value).toString("base64");
    } else {
      all[key] = Buffer.from(value, "utf8").toString("base64");
    }
    writeAll(all);
  },
  delete(key: string): void {
    const all = readAll();
    delete all[key];
    writeAll(all);
  },
};
