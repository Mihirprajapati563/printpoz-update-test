import { ipcMain } from "electron";
import { CHANNELS } from "../../shared/ipc";
import type { RenderSvgInput } from "../../shared/ipc";
import { renderSvgToImage } from "../services/exporter";

// Guard against absurd dimensions (a render at 100k×100k would exhaust memory).
const MAX_DIM = 20000;

function isRenderInput(v: unknown): v is RenderSvgInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.svg === "string" &&
    o.svg.length > 0 &&
    Number.isFinite(o.width) &&
    (o.width as number) > 0 &&
    (o.width as number) <= MAX_DIM &&
    Number.isFinite(o.height) &&
    (o.height as number) > 0 &&
    (o.height as number) <= MAX_DIM &&
    (o.fontFaceCss === undefined || typeof o.fontFaceCss === "string") &&
    (o.format === undefined || o.format === "jpeg" || o.format === "png") &&
    (o.quality === undefined || typeof o.quality === "number")
  );
}

export function registerExportIpc(): void {
  ipcMain.handle(CHANNELS.exportRenderSvg, async (_e, input: unknown) => {
    if (!isRenderInput(input)) {
      return { ok: false as const, error: "invalid RenderSvgInput" };
    }
    try {
      const result = await renderSvgToImage(input);
      return { ok: true as const, data: result };
    } catch (err) {
      return { ok: false as const, error: String(err) };
    }
  });
}
