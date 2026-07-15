// Client-side export renderer (desktop). Replaces the server's headless-Chrome
// `exportAsJpeg` with a LOCAL offscreen render — itself headless Chromium, so it
// renders SVG `<foreignObject>` HTML text, CSS filters, and (critically)
// `app-assets://` local user photos exactly. The server cannot see local photos,
// so this is REQUIRED for the offline-first image store to export at all.
//
// ── Why CDP Page.captureScreenshot (not capturePage tiling) ──
// `webContents.capturePage()` / the OSR 'paint' event are HARD-CLAMPED to the
// monitor resolution, so a print-size page (e.g. 6000×9000) can't be captured in
// one shot — the old fix panned a tiny window's viewBox tile-by-tile and stitched,
// which was timing-fragile (stale-frame tiles → scrambled output) AND slow. We now
// render the WHOLE page in ONE deterministic shot via the Chrome DevTools Protocol:
//   Emulation.setDeviceMetricsOverride forces the layout viewport to exactly W×H
//   (decoupled from the monitor-clamped physical window), so the whole SVG lays out
//   full-size; Page.captureScreenshot with clip{scale:1}+captureBeyondViewport then
//   captures it all at once. No tiling, no stitching, no capture-timing race.
//   Validated end-to-end: a 6000×9000 page captures correctly in ~1.5–2s (vs ~90s).
//
// ── Window model (validated) ──
// captureScreenshot(fromSurface) HANGS on a show:false window that never allocated
// a compositor surface, and creating a NEW window per page makes page 2+ fail to
// load (ERR_FAILED). So we keep ONE PERSISTENT off-screen window (shown inactive at
// -32000,-32000 so it composites but never appears / steals focus), load a blank
// shell ONCE, and swap each page's SVG + @font-face CSS in via the DOM — no
// per-page navigation, no window churn. The window is reused across the whole
// export and destroyed after an idle gap. Renders are serialized (FIFO queue) since
// one window can only render one page at a time.
//
// Chromium's hard limit is 16384px per axis (compositor max texture); above a safe
// 16000px cap we fall back to a few large bands and stitch in the renderer.

import { BrowserWindow, screen, nativeImage } from "electron";
import type { RenderSvgInput, RenderSvgResult, RenderTile } from "../../shared/ipc";

// ── Single-slot FIFO queue (one render at a time on the shared window) ──
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Safe working cap under Chromium's hard 16384px-per-axis texture limit; above
// this a single captureScreenshot silently truncates, so we band-tile + stitch.
const MAX_AXIS = 16000;
// Keep the offscreen render window alive this long after the last page so a
// multi-page export reuses it (fast), then free it.
const IDLE_DESTROY_MS = 60_000;
// Small settle after the layout/relayout so the compositor has the new frame.
const SETTLE_MS = 160;

function bufToAb(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// Blank shell — loaded ONCE per window. Per-page @font-face rules go into
// #pp-fontfaces and the page SVG into #host (no navigation between pages).
const SHELL_HTML =
  "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
  "<style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}" +
  "html,body{background:#ffffff;}#host{position:absolute;top:0;left:0;}" +
  "#host>svg{display:block;}foreignObject{overflow:hidden;}</style>" +
  "<style id='pp-fontfaces'></style></head><body><div id='host'></div></body></html>";

// Readiness gate — the #1 defense against blank/partial captures. Wait for web
// fonts to load and every <img> / SVG <image> to DECODE, then two rAFs so the
// layout+paint has composited, before we screenshot.
// ⚠ EVERY wait here is TIME-BOUNDED (Promise.race with a timeout). A real page's
// custom font or a large app-assets:// photo that never settles loading would
// otherwise hang this executeJavaScript FOREVER — the "export spins for minutes"
// bug. Fonts/images are best-effort: on timeout we capture what's rendered (text
// falls back to a system font, a slow photo may be mid-decode) rather than hang.
// We DECODE THE EXISTING <img> elements (not a fresh Image()) so a big photo is
// decoded once, and run this pass ONCE per page — both keep the export light.
const READY_JS = `(async () => {
  const cap = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(() => r(true), ms))]);
  try { if (document.fonts && document.fonts.ready) await cap(document.fonts.ready, 5000); } catch (e) {}
  const waits = [];
  for (const el of document.querySelectorAll('img')) {
    waits.push(cap(el.decode ? el.decode() : Promise.resolve(), 12000));
  }
  for (const el of document.querySelectorAll('image')) {
    const u = el.getAttribute('href') || el.getAttribute('xlink:href');
    if (!u) continue;
    waits.push(cap(new Promise((res) => { const im = new Image(); const k = () => res(true); im.onload = k; im.onerror = k; im.src = u; }), 12000));
  }
  await Promise.all(waits);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
  return true;
})()`;

// Reject a main-side await if it exceeds `ms` so a wedged renderer/CDP step fails
// FAST (surfaced as an export error) instead of spinning the UI forever.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`export step timed out: ${label} (${ms}ms)`)), ms)),
  ]);
}

// ── Persistent off-screen render window ──────────────────────────────
let sharedWin: BrowserWindow | null = null;
let sharedDbg: Electron.Debugger | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// Tear down the shared window and clear the refs so the NEXT render builds a
// fresh one. Used on renderer/GPU crash and on a failed render — reusing a window
// whose renderer died makes every subsequent page fail at the first sendCommand.
function resetSharedWindow(): void {
  const w = sharedWin;
  sharedWin = null;
  sharedDbg = null;
  try {
    if (w && !w.isDestroyed()) w.destroy();
  } catch {
    /* ignore */
  }
}

async function ensureWindow(): Promise<{ win: BrowserWindow; dbg: Electron.Debugger }> {
  // Reuse only a LIVE window whose renderer hasn't crashed. A GPU/renderer crash
  // fires 'render-process-gone' (handled below) but does NOT destroy the window,
  // so also guard on isCrashed().
  if (sharedWin && !sharedWin.isDestroyed() && sharedDbg && !sharedWin.webContents.isCrashed()) {
    return { win: sharedWin, dbg: sharedDbg };
  }
  // Stale/crashed window lingering? Clear it before making a new one.
  if (sharedWin) resetSharedWindow();
  const win = new BrowserWindow({
    width: 200,
    height: 200,
    show: false,
    frame: false,
    // Renderer paints even while hidden; keep it painting so captureScreenshot
    // has a live compositor surface (a show:false window that never got a surface
    // makes fromSurface capture HANG).
    paintWhenInitiallyHidden: true,
    webPreferences: {
      offscreen: false, // OSR reintroduces the screen clamp; a normal window renders full-size off-screen
      backgroundThrottling: false,
      // MUST be false: a sandboxed renderer cannot load a data: URL (the shell),
      // which fails with ERR_FAILED. The window loads only our own markup, has no
      // preload, and denies navigation/popups below.
      sandbox: false,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setZoomFactor(1);
  // Give it a real (off-screen) compositor surface so captureScreenshot works,
  // but keep it FULLY INVISIBLE to the user: skip the taskbar, park it off-screen,
  // and set opacity 0. captureScreenshot(fromSurface) captures the window's own
  // render surface, which is unaffected by window opacity — verified the capture
  // stays pixel-correct at opacity 0. This stops the "a second app window opens
  // during export" report.
  win.setSkipTaskbar(true);
  win.setPosition(-32000, -32000);
  win.showInactive();
  try {
    win.setOpacity(0);
  } catch {
    /* opacity unsupported on some Linux WMs — off-screen + skipTaskbar still hide it */
  }
  win.on("closed", () => {
    if (sharedWin === win) {
      sharedWin = null;
      sharedDbg = null;
    }
  });
  // A renderer/GPU crash (OOM on a huge page — the export saw exit_code=34) fires
  // this, NOT 'closed', and leaves the BrowserWindow "alive" with a dead renderer.
  // Reset so ensureWindow rebuilds instead of reusing a corpse.
  win.webContents.on("render-process-gone", (_e, details) => {
    // Prime suspect for the "app disappears + restarts, nothing logged" export
    // crash — log which reason/exitCode killed the OFFSCREEN render window before
    // resetting it. (A GPU-process crash surfaces separately via app
    // 'child-process-gone'; this catches the render process specifically.)
    try {
      require("../lib/logger").logger.error("export-window render-process-gone", details);
    } catch {
      /* logger unavailable — never let logging break teardown */
    }
    if (sharedWin === win) resetSharedWindow();
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(SHELL_HTML));

  const dbg = win.webContents.debugger;
  try {
    dbg.attach("1.3");
  } catch {
    /* already attached (e.g. DevTools open) */
  }
  await dbg.sendCommand("Page.enable").catch(() => {});

  sharedWin = win;
  sharedDbg = dbg;
  return { win, dbg };
}

function scheduleIdleDestroy(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    try {
      if (sharedWin && !sharedWin.isDestroyed()) sharedWin.destroy();
    } catch {
      /* ignore */
    }
    sharedWin = null;
    sharedDbg = null;
  }, IDLE_DESTROY_MS);
}

async function renderViaCdp(input: RenderSvgInput): Promise<RenderSvgResult> {
  const W = Math.max(1, Math.ceil(input.width));
  const H = Math.max(1, Math.ceil(input.height));
  const fontFaceCss = typeof input.fontFaceCss === "string" ? input.fontFaceCss : "";
  const format: "jpeg" | "png" = input.format === "png" ? "png" : "jpeg";
  const quality =
    typeof input.quality === "number" && input.quality > 0 && input.quality <= 100
      ? Math.round(input.quality)
      : 92;
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  const { win, dbg } = await ensureWindow();

  try {
    // Swap this page's fonts + SVG into the persistent document — NO navigation.
    // Each step is wrapped in withTimeout so a wedged renderer/CDP call fails fast
    // (surfaced as an export error) instead of spinning the UI forever.
    await withTimeout(
      win.webContents.executeJavaScript(
        `(function(){` +
          `var f=document.getElementById('pp-fontfaces'); if(f) f.textContent=${JSON.stringify(fontFaceCss)};` +
          `var host=document.getElementById('host'); if(host) host.innerHTML=${JSON.stringify(input.svg)};` +
          `var s=host&&host.querySelector('svg'); if(s){s.setAttribute('viewBox','0 0 ${W} ${H}');` +
          `s.setAttribute('width','${W}');s.setAttribute('height','${H}');}` +
          `return true;})()`
      ),
      20_000,
      "inject-svg"
    );

    // Force the render viewport to exactly W×H at 1× DSF (the clamp escape + the
    // no-HiDPI-doubling guarantee), and an opaque white background so transparent
    // regions don't come out black in JPEG. setDeviceMetricsOverride also relayouts.
    await withTimeout(
      dbg.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: W,
        height: H,
        deviceScaleFactor: 1,
        mobile: false,
      }),
      15_000,
      "device-metrics"
    );
    await dbg
      .sendCommand("Emulation.setDefaultBackgroundColorOverride", {
        color: { r: 255, g: 255, b: 255, a: 255 },
      })
      .catch(() => {});
    // Single readiness pass (after the metrics relayout): wait for fonts + photo
    // decode (time-bounded inside READY_JS) before capturing.
    await withTimeout(win.webContents.executeJavaScript(READY_JS, true), 30_000, "readiness").catch(() => {});
    await delay(SETTLE_MS);

    // Capture one region at 1:1, verifying the output size (guarding the version-
    // dependent HiDPI-doubling regression).
    const captureRegion = async (x: number, y: number, w: number, h: number): Promise<ArrayBuffer> => {
      const shoot = async (clipScale: number): Promise<Buffer> => {
        const params: Record<string, unknown> = {
          format,
          clip: { x, y, width: w, height: h, scale: clipScale },
          captureBeyondViewport: true,
          fromSurface: true,
          optimizeForSpeed: true,
        };
        if (format === "jpeg") params.quality = quality;
        const res = (await withTimeout(
          dbg.sendCommand("Page.captureScreenshot", params),
          60_000,
          `captureScreenshot ${w}x${h}`
        )) as { data: string };
        return Buffer.from(res.data, "base64");
      };

      let buf = await shoot(1);
      let img = nativeImage.createFromBuffer(buf);
      let sz = img.getSize();

      if ((sz.width !== w || sz.height !== h) && scaleFactor !== 1) {
        buf = await shoot(1 / scaleFactor);
        img = nativeImage.createFromBuffer(buf);
        sz = img.getSize();
      }
      if (sz.width !== w || sz.height !== h) {
        const resized = img.resize({ width: w, height: h, quality: "best" });
        buf = format === "png" ? resized.toPNG() : resized.toJPEG(quality);
      }
      return bufToAb(buf);
    };

    if (W <= MAX_AXIS && H <= MAX_AXIS) {
      const bytes = await captureRegion(0, 0, W, H);
      return { width: W, height: H, format, bytes };
    }

    const tiles: RenderTile[] = [];
    for (let y = 0; y < H; y += MAX_AXIS) {
      for (let x = 0; x < W; x += MAX_AXIS) {
        const w = Math.min(MAX_AXIS, W - x);
        const h = Math.min(MAX_AXIS, H - y);
        tiles.push({ x, y, w, h, bytes: await captureRegion(x, y, w, h) });
      }
    }
    return { width: W, height: H, format, tiles };
  } catch (err) {
    // A failed/wedged render likely left the shared window in a bad state (dead
    // renderer, override stuck on). Destroy it so the NEXT page gets a fresh
    // window+debugger instead of reusing a corpse, then surface the error.
    resetSharedWindow();
    throw err;
  } finally {
    // On success, restore normal rendering for the reused window. Bound each
    // cleanup with a timeout: an unresponsive renderer here would otherwise never
    // resolve and — because the FIFO queue chains on this function completing —
    // would deadlock EVERY future export (the exact hang the timeouts prevent).
    if (sharedWin && !sharedWin.isDestroyed() && sharedDbg) {
      await withTimeout(
        sharedDbg.sendCommand("Emulation.clearDeviceMetricsOverride"),
        3_000,
        "cleanup-metrics"
      ).catch(() => {});
      await withTimeout(
        sharedDbg.sendCommand("Emulation.setDefaultBackgroundColorOverride"),
        3_000,
        "cleanup-bg"
      ).catch(() => {});
    }
    scheduleIdleDestroy();
  }
}

/** Render one page SVG to a single full-size image (queued, one at a time). */
export function renderSvgToImage(input: RenderSvgInput): Promise<RenderSvgResult> {
  return enqueue(() => renderViaCdp(input));
}
