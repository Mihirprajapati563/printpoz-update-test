import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import {
  localExportEnabled,
  renderSvgToBlobLocal,
} from "../../library/utils/services/export/localExport.js";

export async function getTrimmedPreviewTexture({
  currentPageSVG,
  canvasSize,
  bleedMargin,
  zoomRatio,
}) {
  if (!currentPageSVG) {
    throw new Error("currentPageSVG is required");
  }

  const fullWidth = canvasSize?.width || currentPageSVG.width;
  const fullHeight = canvasSize?.height || currentPageSVG.height;

  const trimWidth = fullWidth - bleedMargin * 2;
  const trimHeight = fullHeight - bleedMargin * 2;

  const exportScale = zoomRatio || 1;

  const data = {
    svgDetails: currentPageSVG.svgContent,
    fonts: currentPageSVG.fonts || [],
    w: fullWidth,
    h: fullHeight,
    scale: exportScale,
  };

  // Desktop renders locally — the 3D preview texture also contains app-assets://
  // user photos the server can't see, so it must be rendered on-device too.
  const blob = localExportEnabled
    ? await renderSvgToBlobLocal({
        svgDetails: data.svgDetails,
        fonts: data.fonts,
        w: fullWidth,
        h: fullHeight,
      })
    : new Blob(
        [await apiPost(ENDPOINTS.exportAsJPG, data, { responseType: "blob" })],
        { type: "image/jpeg" }
      );
  const imageBitmap = await createImageBitmap(blob);

  const renderedWidth = imageBitmap.width;
  const renderedHeight = imageBitmap.height;

  const actualScaleX = renderedWidth / fullWidth;
  const actualScaleY = renderedHeight / fullHeight;

  const cropX = bleedMargin * actualScaleX;
  const cropY = bleedMargin * actualScaleY;
  const cropWidth = trimWidth * actualScaleX;
  const cropHeight = trimHeight * actualScaleY;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const ctx = tempCanvas.getContext("2d");

  ctx.drawImage(
    imageBitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const trimmedDataUrl = tempCanvas.toDataURL("image/jpeg", 0.95);

  return {
    dataUrl: trimmedDataUrl,
    trimWidth,
    trimHeight,
  };
}
