# Desktop Export Pipeline — Technical Specification

> [!NOTE]
> **Documentation Directory:**
> - **Offline Assets:** [OFFLINE_ASSETS_IMPLEMENTATION_PLAN.md](file:///d:/Codnix%20Projects/printpoz-desktop-designer/OFFLINE_ASSETS_IMPLEMENTATION_PLAN.md) | [Dashboard HTML](file:///d:/Codnix%20Projects/printpoz-desktop-designer/OFFLINE_ASSETS_DASHBOARD.html)
> - **Export Pipeline (This Doc):** [EXPORT_PIPELINE.md](file:///d:/Codnix%20Projects/printpoz-desktop-designer/EXPORT_PIPELINE.md) | [Dashboard HTML](file:///d:/Codnix%20Projects/printpoz-desktop-designer/EXPORT_PIPELINE_DASHBOARD.html)

> [!IMPORTANT]
> **§3–4 below are the ORIGINAL PLAN and are now stale.** The as-built render does
> NOT use `capturePage()` / `offscreen: true`. It renders the whole page in one shot
> via the Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` +
> `Page.captureScreenshot` with `captureBeyondViewport`) in a **persistent**
> off-screen window — because `capturePage()` is hard-clamped to the monitor
> resolution and can't capture a print-size page. See the authoritative header
> comment in [exporter.ts](file:///d:/Codnix%20Projects/printpoz-desktop-designer/electron/main/services/exporter.ts)
> and the desktop wrapper [localExport.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/services/export/localExport.js).
> **For the GPU-process crash fix and crash diagnostics, jump to [§8](#8-gpu-process-crash-fix-exit_code34--2026-07-14).**

## 1. Overview

The export pipeline converts canvas pages (stored as SVG content) into downloadable
image and PDF files. On the web version, this requires sending SVG data to the server
which renders it via headless Chrome. On the desktop version, **all rendering happens
locally** using Electron's offscreen `BrowserWindow`.

### Export Formats Supported
- **Single-page JPEG** — one SVG → one high-quality JPEG
- **Multi-page PDF** — all SVGs → individual JPEGs → compiled via `jsPDF`
- **Multi-PDF ZIP** — multiple PDFs (e.g., one per product size) → zipped via `JSZip`

---

## 2. Current Web Flow (What We're Replacing)

### Entry points (all calling `ENDPOINTS.exportAsJPG`):

| File | Line | Context |
|---|---|---|
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 153 | Main export flow — `exportImageFromSVG()` |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 291 | Multi-PDF export flow |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 326 | Multi-PDF inner page export |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 443 | JPEG batch export |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 496 | JPEG batch inner page |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 569 | Individual JPEG export |
| [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js) | 619 | Individual JPEG inner page |
| [getTrimmedPreviewTexture.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/products-preview/shared/getTrimmedPreviewTexture.js) | 30 | Product preview thumbnail |
| [export/index.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/services/export/index.js) | 16 | Legacy `SvgToJPG()` utility |

### Web export data flow:
```
svgData.svgContent[pageIndex]
  → apiPost(ENDPOINTS.exportAsJPG, {
      svgDetails: svgContent,
      fonts: fontDataArray,
      w: width,
      h: height,
    }, { responseType: "blob" })
  → Server receives SVG + font URLs
  → Server renders via headless Chrome
  → Server returns JPEG blob
  → Client receives blob
  → jsPDF.addImage(blob, "JPEG", ...)
  → PDF compiled
  → saveAs(pdfBlob, filename)   // downloads to browser
```

**Why this is slow on web:**
- Each page SVG is sent as a POST request (large payload)
- Server spins up headless Chrome per render
- JPEG blob is downloaded back (large response)
- Fonts must be re-fetched server-side for each render
- Latency compounds for multi-page designs (10+ pages)

---

## 3. Desktop Export Flow (Replacement)

### Architecture:
```
svgData.svgContent[pageIndex]
  → IPC "export:renderSvg" (svgContent, width, height, fontFaceCSS)
  → Main process creates hidden BrowserWindow (offscreen: true)
  → Loads HTML shell containing:
      - @font-face rules pointing to cached WOFF2 files
      - The SVG content inline in <body>
  → Waits for document.fonts.ready
  → webContents.capturePage() → NativeImage
  → nativeImage.toJPEG(95) → Buffer
  → win.close()
  → Returns JPEG Buffer to renderer via IPC
  → jsPDF.addImage(Buffer, "JPEG", ...)
  → PDF compiled
  → desktop.dialog.saveAs() → native OS Save dialog
  → desktop.fs.writeFile(chosenPath, pdfBuffer)
```

### Why this is faster:
- Zero network latency — all data stays on disk
- Fonts already cached locally as WOFF2 files
- `capturePage()` uses the GPU-accelerated Chromium compositor
- No payload serialization/deserialization over HTTP
- Hidden window reuse possible for batch exports

---

## 4. Implementation Details

### 4.1 The `export:renderSvg` IPC Handler

```typescript
// electron/main/services/exporter.ts
import { BrowserWindow, nativeImage } from "electron";

export async function renderSvgToJpeg(
  svgContent: string,
  width: number,
  height: number,
  fontFaceCSS: string = ""
): Promise<Buffer> {
  const win = new BrowserWindow({
    width: Math.ceil(width),
    height: Math.ceil(height),
    show: false,
    webPreferences: { offscreen: true },
  });

  const html = `<!DOCTYPE html>
    <html><head><style>
      ${fontFaceCSS}
      *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
      body { overflow: hidden; }
    </style></head>
    <body>${svgContent}</body></html>`;

  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  );

  // Wait for all fonts to load before capturing
  await win.webContents.executeJavaScript("document.fonts.ready");

  // Small delay to ensure paint is committed
  await new Promise(resolve => setTimeout(resolve, 50));

  const image = await win.webContents.capturePage();
  win.close();

  return image.toJPEG(95);
}
```

### 4.2 Font Resolution for Export

When exporting, the hidden render window needs access to all fonts used in the design.
Since custom fonts are cached at `AppData/cache/fonts/<fontId>-<weight>-<style>.woff2`,
we generate `@font-face` CSS rules for each font in the design:

```typescript
// electron/main/services/fontResolver.ts
import { existsSync } from "fs";
import { join } from "path";
import { app } from "electron";

interface FontRef {
  family: string;
  fontId: string;
  weight: number;
  style: string;
}

export function buildFontFaceCSS(fonts: FontRef[]): string {
  const fontsDir = join(app.getPath("userData"), "cache", "fonts");

  return fonts.map(f => {
    const filename = `${f.fontId}-${f.weight}-${f.style}.woff2`;
    const filePath = join(fontsDir, filename);

    if (!existsSync(filePath)) return "";

    const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
    return `@font-face {
      font-family: "${f.family}";
      font-weight: ${f.weight};
      font-style: ${f.style};
      src: url("${fileUrl}") format("woff2");
    }`;
  }).filter(Boolean).join("\n");
}
```

### 4.3 React-Side Interception

Inside [useExportPages.js](file:///d:/Codnix%20Projects/printpoz-desktop-designer/src/library/utils/custom-hooks/useExportPages.js),
every `apiPost(ENDPOINTS.exportAsJPG, ...)` call is wrapped:

```javascript
// Before: web-only export
const response = await apiPost(ENDPOINTS.exportAsJPG, imageData, {
  responseType: "blob",
});

// After: desktop-aware export
let jpegBlob;
if (isDesktop) {
  // Collect font refs from current pages
  const fontRefs = collectFontRefsFromPages(pages);
  const buffer = await desktop.export.renderSvg(
    imageData.svgDetails,
    imageData.w,
    imageData.h,
    fontRefs  // main process resolves these to @font-face CSS
  );
  jpegBlob = new Blob([buffer], { type: "image/jpeg" });
} else {
  const response = await apiPost(ENDPOINTS.exportAsJPG, imageData, {
    responseType: "blob",
  });
  jpegBlob = response;
}
```

### 4.4 File Save (Replace `saveAs()`)

On the web, `file-saver`'s `saveAs()` triggers a browser download. On desktop, we use
a native OS dialog for a real save-to-folder experience:

```javascript
// Before:
saveAs(pdfBlob, `${timestamp}.pdf`);

// After:
if (isDesktop) {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const result = await desktop.dialog.saveAs({
    title: "Save PDF",
    defaultPath: `${timestamp}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.filePath) {
    await desktop.fs.writeFile(result.filePath, arrayBuffer);
  }
} else {
  saveAs(pdfBlob, `${timestamp}.pdf`);
}
```

---

## 5. Performance Comparison

| Metric | Web (API Render) | Desktop (Local Render) |
|---|---|---|
| Round-trip per page | 300–800 ms (network dependent) | 50–150 ms (GPU render) |
| Font loading | Re-fetched server-side every render | Already cached locally |
| 10-page PDF total | 5–10 seconds | 0.5–1.5 seconds |
| Bandwidth per page | 2–5 MB (SVG up + JPEG down) | Zero |
| Offline capable | No | Yes |
| File save | Browser Downloads folder | User-chosen path via native dialog |

---

## 6. Edge Cases

| Scenario | Handling |
|---|---|
| Font not cached during export | Hidden window falls back to system font. Design may look different. Mitigation: pre-cache all design fonts when the project loads (already done by `loadDesignFonts()`). |
| SVG contains `<image>` with remote URL | If the image URL is an `app-assets://` protocol URL (user photo or cached library asset), the hidden window can access it. If it's a remote URL, it loads normally (requires internet). |
| Very large canvas (e.g., 6000×4000) | `capturePage()` respects `scaleFactor`. Default is 1x. For print quality (300 DPI), set `scaleFactor: 2` in `capturePage({ rect, scaleFactor })`. Monitor memory — may need 2+ GB for very large renders. |
| Export cancelled mid-way | Clean up: close the hidden `BrowserWindow` immediately. `jsPDF` instance is garbage collected. No temp files left. |
| Concurrent exports | Use a semaphore/queue — one hidden window at a time to prevent GPU memory pressure. |

---

## 7. Files to Modify

| File | Change |
|---|---|
| `electron/main/services/exporter.ts` | **New** — offscreen render logic |
| `electron/main/services/fontResolver.ts` | **New** — build `@font-face` CSS from cached fonts |
| `electron/main/ipc/export.ipc.ts` | **New** — register `export:renderSvg` IPC handler |
| `electron/shared/ipc.ts` | Add `export:renderSvg` channel constant |
| `electron/preload/index.ts` | Expose `desktop.export.renderSvg()` bridge |
| `src/desktop/index.js` | Add `export.renderSvg()` to `DesktopApi` |
| `src/library/utils/custom-hooks/useExportPages.js` | Wrap every `exportAsJPG` call in `isDesktop` guard |
| `src/products-preview/shared/getTrimmedPreviewTexture.js` | Wrap `exportAsJPG` call |
| `src/library/utils/services/export/index.js` | Wrap `SvgToJPG()` function |

---

## 8. GPU-Process Crash Fix (`exit_code=34`) — 2026-07-14

### Symptom
Exporting (reported on **all-pages JPEG**) made the **whole app disappear and
restart**, intermittently and repeatedly (observed twice within 4 seconds). It
happened on a strong machine (16 GB RAM) and on a **small** project — just 3 pages
at 5200×2500 px, 300 DPI (~13 MP/page). Nothing was written to `main.log`.

### Root cause (confirmed, not inferred)
A **GPU-process crash**, not RAM and not the renderer:

```
[…:ERROR:gpu_process_host.cc(982)] GPU process exited unexpectedly: exit_code=34
main.log: child-process-gone {"type":"GPU","reason":"crashed","exitCode":34,"serviceName":"GPU"}
```

The offscreen render window is **GPU-composited** (`webPreferences.offscreen: false`)
and shares the **single, app-wide GPU process** with the visible editor window. Its
`Page.captureScreenshot` + `captureBeyondViewport` path crashes that GPU process on
**every page**, deterministically. Because the crash was at ~13 MP — a trivial
texture, far below any size cap — the trigger is the **GPU tile-rasterization path**,
not a memory/texture-size ceiling. When the shared GPU process dies, Chromium tears
down and rebuilds the visible window's compositor → the "app disappears and restarts"
symptom. The main process itself **survives** the crash (the diagnostics handler runs),
so this is *recoverable* → **prevention alone is sufficient**; no crash-recovery/relaunch
machinery is needed.

### The fix (one line, surgical)
[`electron/main/index.ts`](file:///d:/Codnix%20Projects/printpoz-desktop-designer/electron/main/index.ts)
— set before the GPU process launches (before app `ready`):

```ts
app.commandLine.appendSwitch("disable-gpu-rasterization");
```

Moves Skia tile-rasterization to the CPU (killing the crash path) while **keeping the
GL context**, so:
- **WebGL / 3D product previews still render** (they don't use Skia tile raster).
- The **single-shot capture is preserved** → no quality loss. (Contrast: forcing
  tiled captures by lowering `MAX_AXIS` in `exporter.ts` would route large exports
  through the canvas **stitch/re-encode** path — a print-quality regression — and the
  crash is path-driven, not size-driven, so tiling was rejected.)

App-wide in scope but benign: the editor canvas is SVG/DOM, so CPU rasterization is
imperceptible there.

> Escalation ladder if the crash ever returns (it did NOT after this fix): (1) this
> flag → (2) `--use-angle=swiftshader` (software GL everywhere — stops it for certain
> but makes 3D previews software-slow; last resort). Rejected outright:
> `--in-process-gpu` (a GPU crash would then kill the whole app) and global
> `--disable-gpu` (kills 3D).

### Crash diagnostics added (kept in place)
The crash was invisible because GPU/child-process deaths had **no handler**. Added so
any future export crash is *named in the log* instead of silent:

| File | Handler | Catches |
|---|---|---|
| [`index.ts`](file:///d:/Codnix%20Projects/printpoz-desktop-designer/electron/main/index.ts) | `app.on("child-process-gone")` | **GPU-process crashes** (`type:"GPU"`), utility crashes — the entry that confirmed this bug |
| [`index.ts`](file:///d:/Codnix%20Projects/printpoz-desktop-designer/electron/main/index.ts) | `app.on("render-process-gone")` (app-wide) | Any window's renderer death, incl. the **offscreen export window** (logs its URL) |
| [`exporter.ts`](file:///d:/Codnix%20Projects/printpoz-desktop-designer/electron/main/services/exporter.ts) | offscreen window `render-process-gone` | The export window specifically (was previously **silent** — reset without logging) |

Log location (Windows): `%APPDATA%\printpoz-desktop-designer\logs\main.log`.

### Verification
- ✅ All-pages JPEG export on the 3-page / 5200×2500 / 300 DPI project completes with
  no GPU crash (`exit_code=34` no longer appears in `main.log`).
- ✅ 3D product preview still renders (GL context intact) — the blast-radius check that
  matters for any GPU flag.
