import { net, protocol } from "electron";
import { join, normalize, sep } from "path";
import { pathToFileURL } from "url";
import { resolveAssetPath, resolveOriginalPath } from "./services/local-assets.service";
import { resolveThemePackPath } from "./services/theme-packs.service";
import { resolveImageCachePath } from "./services/image-cache.service";

// Custom secure scheme used to serve the built renderer in production.
// Gives a stable, secure origin (app://bundle) for CSP, storage, and — critically —
// reliable Web Worker / fetch behavior (file:// is unreliable for workers).
export const APP_SCHEME = "app";
export const APP_ORIGIN = "app://bundle";

// Privileged scheme that serves locally-stored binaries (user photos now; cached
// library assets later) to the renderer. Chromium blocks file:// from the renderer,
// so we register a secure custom scheme instead. URLs look like:
//   app-assets://project/<projectId>/<file>      ← project-scoped user photos
//   app-assets://original/<projectId>/<id>.<ext> ← reference-mode full-res (served
//                                                   from the user's ORIGINAL file)
//   app-assets://theme-pack/<themeId>/assets/<f> ← offline theme-pack binaries
//   app-assets://image-cache/<sha256>.<ext>      ← cached preview/thumbnail bytes
export const ASSETS_SCHEME = "app-assets";

export function registerAppProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: ASSETS_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function registerAssetsProtocol(): void {
  protocol.handle(ASSETS_SCHEME, async (request) => {
    const url = new URL(request.url);
    // For app-assets://project/<id>/<file>, hostname = "project", pathname = "/<id>/<file>".
    const scope = url.hostname;
    // The URL parser only PARTIALLY decodes the pathname (it leaves %2E/%5C etc.);
    // do NOT assume it's fully decoded — the resolver containment guards are required.
    const parts = url.pathname.split("/").filter(Boolean);
    const filePath =
      scope === "theme-pack"
        ? resolveThemePackPath(parts)
        : scope === "image-cache"
          ? resolveImageCachePath(parts)
          : scope === "original"
            ? await resolveOriginalPath(parts)
            : resolveAssetPath(scope, parts);
    if (!filePath) return new Response("Forbidden", { status: 403 });
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

export function registerAppProtocol(rendererDist: string): void {
  const root = normalize(rendererDist);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    // url.pathname is already percent-decoded by the URL parser; don't decode twice.
    let pathname = url.pathname;
    if (!pathname || pathname === "/") pathname = "/index.html";

    const filePath = normalize(join(root, pathname));
    // Path-traversal guard: never serve outside the renderer dist.
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(filePath).toString());
      if (pathname.endsWith(".html")) {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        headers.set("Pragma", "no-cache");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      return response;
    } catch {
      // SPA fallback (HashRouter rarely needs it, but harmless).
      const response = await net.fetch(pathToFileURL(join(root, "index.html")).toString());
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      headers.set("Pragma", "no-cache");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  });
}
