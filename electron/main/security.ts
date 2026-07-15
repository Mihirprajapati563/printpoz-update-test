import { session, shell } from "electron";
import type { BrowserWindow } from "electron";

// NOTE: This CSP is intentionally PERMISSIVE for the first working build so it does
// not silently break the editor (styled-components inline styles, Three.js, workers,
// the many backend/S3/Google/socket hosts, and Google Fonts all need to load).
// HARDENING TODO (electron-security-auditor): tighten connect-src to the explicit
// host list and remove 'unsafe-eval' once verified by running the app.
const CSP = [
  "default-src 'self' app: app-assets: 'unsafe-inline' 'unsafe-eval' data: blob:",
  "script-src 'self' app: 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' app: 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' app: data: https://fonts.gstatic.com https:",
  "img-src 'self' app: app-assets: data: blob: https:",
  "media-src 'self' app: app-assets: data: blob: https:",
  "worker-src 'self' app: blob:",
  "connect-src 'self' app: app-assets: https: wss: ws: http://localhost:* http://127.0.0.1:*",
  // Never let a stored app-assets file be framed as a document (defence-in-depth
  // alongside the image-only extension allowlist in local-assets.service).
  "frame-src 'self' app:",
].join("; ");

export function applySecurity(devUrl: string | null): void {
  // Apply CSP in production (app://). In dev, CRA's dev server needs a looser policy,
  // so we leave the dev server's own headers in place.
  if (!devUrl) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [CSP],
        },
      });
    });
  }
}

export function hardenWindow(win: BrowserWindow, allowedOrigin: string): void {
  const isHttp = (u: string) => /^https?:\/\//i.test(u);

  // Open new windows / target=_blank externally — but ONLY http(s). Block file:, custom
  // protocol handlers (ms-msdt:, etc.) so a compromised renderer can't invoke OS handlers.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Pin in-app navigation to our origin (exact origin match, not startsWith); bounce http(s) out.
  win.webContents.on("will-navigate", (e, url) => {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url).origin === new URL(allowedOrigin).origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      e.preventDefault();
      if (isHttp(url)) void shell.openExternal(url);
    }
  });
}
