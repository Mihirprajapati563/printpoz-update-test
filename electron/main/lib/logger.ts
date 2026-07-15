import { app } from "electron";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

let logFile: string | null = null;

function ensureFile(): string | null {
  if (logFile) return logFile;
  try {
    const dir = join(app.getPath("userData"), "logs");
    mkdirSync(dir, { recursive: true });
    logFile = join(dir, "main.log");
  } catch {
    logFile = null;
  }
  return logFile;
}

function write(level: string, args: unknown[]): void {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  const f = ensureFile();
  if (f) {
    try {
      appendFileSync(f, line);
    } catch {
      /* ignore */
    }
  }
}

export const logger = {
  info: (...a: unknown[]) => {
    write("info", a);
  },
  warn: (...a: unknown[]) => {
    write("warn", a);
  },
  error: (...a: unknown[]) => {
    write("error", a);
  },
};
