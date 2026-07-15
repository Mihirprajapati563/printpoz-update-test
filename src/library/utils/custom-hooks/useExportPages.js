import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setStartExport,
  setInitilized,
} from "../../../store/slices/svgData.js";
import { apiPost } from "../common-services/apiCall.js";
import { ENDPOINTS } from "../constants/apiurl.js";
import {
  getSettings,
  getCurrentPageIndex,
  getAllPages,
  getActiveEditorType,
} from "../helpers/canvasSliceGetters.js";
import { EDITOR_TYPES } from "../constants/index.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import { usePdfExport } from "../../../contexts/PdfExportContext.jsx";
import { extractFontsFromSvg } from "../common-functions/extractFontsFromSvg.js";
import { localExportEnabled, renderSvgToBlobLocal } from "../services/export/localExport.js";
import { embedImageDpi } from "../services/export/embedDpi.js";
import { saveSingleFile, saveMultipleFiles } from "../services/export/saveHelpers.js";

// Embed the design DPI into a SERVER-rendered export Blob (web/browser build).
// The server returns a JPEG/PNG with no density, so viewers report a default
// 96 DPI. We patch it on the client — no backend change required. Density is
// derived from the returned image's ACTUAL pixel size so the physical print
// size stays correct even if the server scaled the render.
async function embedDpiOnServerBlob(blob, logicalW, logicalH, dpi) {
  if (!blob || !(dpi > 0)) return blob;
  let outW = logicalW;
  let outH = logicalH;
  try {
    const bmp = await createImageBitmap(blob);
    outW = bmp.width;
    outH = bmp.height;
    bmp.close?.();
  } catch {
    /* couldn't decode — fall back to the requested (logical) dimensions */
  }
  const dpiX = logicalW > 0 ? Math.round((outW * dpi) / logicalW) : dpi;
  const dpiY = logicalH > 0 ? Math.round((outH * dpi) / logicalH) : dpi;
  return await embedImageDpi(blob, dpiX, dpiY);
}

const useExportPages = (options = {}) => {
  const dispatch = useDispatch();
  const { updateProgress, resetProgress } = usePdfExport();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const { runForPreview = null } = options; // true: only preview, false: only non-preview, null: any

  const svgData = useSelector((state) => state.svgData);
  const cartDetails = useSelector((state) => state.projectSetup.cartDetails);
  const globalsSettings = useSelector(getSettings);
  const activePageIndex = useSelector(getCurrentPageIndex);
  const allPages = useSelector(getAllPages);
  const activeEditorType = useSelector(getActiveEditorType);

  // Desktop export renders each page at its AUTHORED resolution. canvasSize.width
  // already equals physical-inches × design-DPI, so scale 1 yields exactly
  // (inches × DPI) pixels — the print-correct size — and lets the exported file
  // report the exact DPI the user set (200, 300, or any value), with the physical
  // print size preserved. (Previously scale = DPI/200 over-rendered designs above
  // 200 DPI, which made the embedded DPI read higher than the value the user set.)
  const canvasDpi = useSelector((state) => state.canvas?.present?.canvasSize?.dpi) || 200;
  const exportScale = 1;

  // Render ONE page SVG to an image Blob — locally on desktop (offscreen Electron
  // window; required because user photos are local app-assets:// files the server
  // can't see), via the server otherwise. Same return type (Blob) for both paths.
  const exportPageBlob = async (data) => {
    if (localExportEnabled) {
      return await renderSvgToBlobLocal({
        svgDetails: data.svgDetails,
        fonts: data.fonts,
        w: data.w,
        h: data.h,
        scale: exportScale,
        // Design DPI is embedded in the exported JPG/PNG metadata so image
        // properties report the resolution the user set (not the default 96).
        dpi: canvasDpi,
        format: data.exportType,
      });
    }
    // Web/browser build: pages render on the SERVER. Embed the design DPI into
    // the returned image on the client so web exports also carry it (no backend
    // change needed).
    const serverBlob = await apiPost(ENDPOINTS.exportAsJPG, data, { responseType: "blob" });
    return await embedDpiOnServerBlob(serverBlob, data.w, data.h, canvasDpi);
  };

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  async function compressAndResizeDataUrl(
    dataUrl,
    maxWidth = 1200,
    quality = 0.6
  ) {
    return new Promise((resolve) => {
      const img = new Image();
      // Without onerror, a Blob that fails to decode never resolves → the preview
      // PDF export hangs forever with the modal stuck. Fall back to the original
      // data URL so the page still exports.
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        let { width, height } = img;

        // Resize proportionally if too big
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });
  }

  // Pages that should be excluded from export. hideLastCover applies to
  // photobook (always) and to layflat with a separate back cover
  // (coverEnabled && !showFullCoverSheet).
  const getExportablePages = (pages) => {
    const totalPages = allPages.length;
    const hidesLastCover =
      globalsSettings?.hideLastCover &&
      (activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
        (activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
          globalsSettings?.coverEnabled &&
          !globalsSettings?.showFullCoverSheet));
    return pages.filter((page) => {
      if (hidesLastCover && totalPages > 0 && page.pageIndex === totalPages - 1) {
        return false;
      }
      return true;
    });
  };

  const exportPageSVG = async () => {
    if (!svgData?.svgContent || svgData.svgContent.length === 0) {
      // Nothing was captured — this return is BEFORE the try/finally, so clear the
      // export flags here or `startExport`/`initilized` stay true, `exportRunningRef`
      // stays set, and no future export can ever start (silent wedge).
      dispatch(setInitilized(false));
      dispatch(setStartExport(false));
      return;
    }

    setUploading(true);
    setError(null);

    const brandId = cartDetails.brand_id;
    const projectId = cartDetails._id;
    const zip = new JSZip();

    try {
      if (svgData.isPreviewBook) {
        const docPages = [];
        setUploading(true);

        const totalPages = svgData.svgContent.length;

        updateProgress({
          showProgress: true,
          progress: 0,
          currentPage: 0,
          totalPages,
          status: "Processing pages...",
        });

        await new Promise((resolve) => setTimeout(resolve, 150));

        let processed = 0;

        try {
          // Sort pages by pageIndex to ensure correct order, then filter excluded pages
          const sortedPages = getExportablePages([...svgData.svgContent].sort((a, b) => a.pageIndex - b.pageIndex));  
          
          for (const page of sortedPages) {
            if (!page || Object.keys(page).length === 0) continue;

            processed++;
            updateProgress({
              status: `Processing page ${processed} of ${totalPages}...`,
              progress: (processed / totalPages) * 70,
              currentPage: processed,
            });

            // Extract fonts from SVG content if page.fonts is empty
            const pageFonts = (page.fonts && page.fonts.length > 0) 
              ? page.fonts 
              : extractFontsFromSvg(page.svgContent);

            const imageData = {
              svgDetails: page.svgContent,
              fonts: pageFonts,
              w: page.width,
              h: page.height,
              brand_id: cartDetails.brand_id,
              project_id: cartDetails._id,
              exportType: "jpeg",
            };

            const response = await exportPageBlob(imageData);

            const imgDataUrl = await blobToDataURL(response);
            const compressedDataUrl = await compressAndResizeDataUrl(
              imgDataUrl,
              1200,
              0.6
            );

            docPages.push({
              imgDataUrl: compressedDataUrl,
              w: page.width,
              h: page.height,
              filename: `Page-${page.pageIndex + 1}.jpg`,
            });
          }

          if (docPages.length === 0) {
            setUploading(false);
            dispatch(setInitilized(false));
            dispatch(setStartExport(false));
            updateProgress({
              showProgress: false,
              status: "No pages found to export.",
            });
            return;
          }

          updateProgress({
            status: "Generating PDF...",
            progress: 75,
          });

          const first = docPages[0];
          const orientation = first.w > first.h ? "landscape" : "portrait";
          const pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [first.w, first.h],
            compress: true,
          });

          for (let i = 0; i < docPages.length; i++) {
            const p = docPages[i];

            if (i === 0) {
              pdf.deletePage(1);
              pdf.addPage([p.w, p.h], p.w > p.h ? "landscape" : "portrait");
              pdf.setPage(1);
            } else {
              pdf.addPage([p.w, p.h], p.w > p.h ? "landscape" : "portrait");
              pdf.setPage(i + 1);
            }

            const imgType = p.filename.toLowerCase().endsWith(".png")
              ? "PNG"
              : "JPEG";
            pdf.addImage(p.imgDataUrl, imgType, 0, 0, p.w, p.h);

            updateProgress({
              status: `Generating PDF page ${i + 1} of ${docPages.length}`,
              progress: 75 + ((i + 1) / docPages.length) * 20,
              currentPage: i + 1,
            });
          }

          updateProgress({
            status: "Finalizing PDF...",
            progress: 98,
          });

          const pdfBlob = pdf.output("blob");
          const timestamp = Date.now();
          saveAs(pdfBlob, `${timestamp}.pdf`);

          updateProgress({
            status: "Download completed successfully!",
            progress: 100,
          });

          setTimeout(() => {
            updateProgress({ showProgress: false });
            resetProgress();
          }, 2000);

          setUploading(false);
        } catch (err) {
          updateProgress({
            status: "Error creating PDF",
            showProgress: false,
          });
          setError(err?.message || "Error while generating photobook PDF");
          setUploading(false);
        } finally {
          dispatch(setInitilized(false));
          dispatch(setStartExport(false));
        }

        return;
      }

      if (svgData.exportPageType === "ALL") {
        if (svgData?.exportFormat === "pdf") {
          try {
            const docPages = [];
            setUploading(true);

            // Sort pages by pageIndex to ensure correct order
            const sortedPages = [...svgData.svgContent].sort((a, b) => a.pageIndex - b.pageIndex);

            for (const page of sortedPages) {
              if (
                !page ||
                page === "" ||
                (typeof page === "object" && Object.keys(page).length === 0)
              ) {
                continue;
              }

              if (globalsSettings?.exportFullPage) {
                // Extract fonts from SVG content if page.fonts is empty
                const pageFonts = (page.fonts && page.fonts.length > 0) 
                  ? page.fonts 
                  : extractFontsFromSvg(page.svgContent);

                const fullImageData = {
                  svgDetails: page.svgContent,
                  fonts: pageFonts,
                  w: page.width,
                  h: page.height,
                  brand_id: brandId,
                  project_id: projectId,
                  exportType: "jpeg",
                };

                const fullResponse = await exportPageBlob(fullImageData);

                const imgDataUrl = await blobToDataURL(fullResponse);
                docPages.push({
                  imgDataUrl,
                  w: page.width,
                  h: page.height,
                  filename: `Page-${page.pageIndex + 1}.jpg`,
                });
              }

              if (
                globalsSettings?.exportSafeArea &&
                page.safeAreaImages?.length > 0
              ) {
                for (const [index, safeArea] of page.safeAreaImages.entries()) {
                  // Extract fonts from safe area SVG content if page.fonts is empty
                  const safeAreaFonts = (page.fonts && page.fonts.length > 0) 
                    ? page.fonts 
                    : extractFontsFromSvg(safeArea.svgContent);

                  const safeData = {
                    svgDetails: safeArea.svgContent,
                    fonts: safeAreaFonts,
                    w: safeArea.width,
                    h: safeArea.height,
                    brand_id: brandId,
                    project_id: projectId,
                    exportType: "jpeg",
                  };

                  const safeResponse = await exportPageBlob(safeData);

                  const imgDataUrl = await blobToDataURL(safeResponse);
                  docPages.push({
                    imgDataUrl,
                    w: safeArea.width,
                    h: safeArea.height,
                    filename: `Page-${page.pageIndex + 1}-safeArea-${
                      index + 1
                    }.jpg`,
                  });
                }
              }
            }

            if (docPages.length === 0) {
              setUploading(false);
              dispatch(setInitilized(false));
              dispatch(setStartExport(false));
              return;
            }

            const firstPage = docPages[0];
            const orientation = firstPage.w > firstPage.h ? "landscape" : "portrait";
            const doc = new jsPDF({
              orientation,
              unit: "px",
              format: [firstPage.w, firstPage.h],
              compress: true,
            });

            doc.addImage(
              firstPage.imgDataUrl,
              "JPEG",
              0,
              0,
              firstPage.w,
              firstPage.h
            );

            for (let i = 1; i < docPages.length; i++) {
              const currentPage = docPages[i];

              doc.addPage(
                [currentPage.w, currentPage.h],
                currentPage.w > currentPage.h ? "landscape" : "portrait"
              );

              doc.addImage(
                currentPage.imgDataUrl,
                "JPEG",
                0,
                0,
                currentPage.w,
                currentPage.h
              );
            }

            // Save or zip the PDF
            const timestamp = Date.now();
            if (svgData?.exportAsZip === true) {
              const pdfBlob = doc.output("blob");
              zip.file(`${timestamp}.pdf`, pdfBlob);
              const zipBlob = await zip.generateAsync({ type: "blob" });
              saveAs(zipBlob, "pdfs.zip");
            } else {
              doc.save(`${timestamp}.pdf`);
            }

            setUploading(false);
          } catch (err) {
            setError(err?.message || "Error while generating combined PDF");
            setUploading(false);
          } finally {
            dispatch(setInitilized(false));
            dispatch(setStartExport(false));
          }
          return;
        }

        // Sort pages by pageIndex to ensure correct order
        const sortedPages = [...svgData.svgContent].sort((a, b) => a.pageIndex - b.pageIndex);

        // For non-zip image export we COLLECT every rendered page here and save
        // them all at the end — on desktop that's ONE folder pick (not one save
        // dialog per page, which was the "asks for the folder again and again"
        // bug); on web it's the same per-file download as before.
        const imageFiles = [];
        const totalToRender = sortedPages.filter(
          (p) => p && !(typeof p === "object" && Object.keys(p).length === 0)
        ).length;
        let renderedCount = 0;
        updateProgress({
          showProgress: true,
          progress: 0,
          currentPage: 0,
          totalPages: totalToRender,
          status: "Preparing export…",
        });

        for (const page of sortedPages) {
          if (
            !page ||
            page === "" ||
            (typeof page === "object" && Object.keys(page).length === 0)
          ) {
            continue;
          }

          setUploading(true);
          renderedCount++;
          updateProgress({
            status: `Rendering page ${renderedCount} of ${totalToRender}…`,
            progress: totalToRender > 0 ? (renderedCount / totalToRender) * 85 : 0,
            currentPage: renderedCount,
            totalPages: totalToRender,
          });

          if (
            globalsSettings?.exportFullPage &&
            globalsSettings?.exportFullPage === true
          ) {
            // Extract fonts from SVG content if page.fonts is empty
            const pageFonts = (page.fonts && page.fonts.length > 0) 
              ? page.fonts 
              : extractFontsFromSvg(page.svgContent);

            const fullImageData = {
              svgDetails: page.svgContent,
              fonts: pageFonts,
              w: page.width,
              h: page.height,
              brand_id: brandId,
              project_id: projectId,
              exportType: svgData?.exportFormat || "jpeg",
            };

            const fullResponse = await exportPageBlob(fullImageData);

            if (svgData?.exportAsZip === true) {
              zip.file(
                `Page-${page.pageIndex + 1}.${svgData?.exportFormat || "jpg"}`,
                fullResponse
              );
            } else {
              imageFiles.push({
                blob: new Blob([fullResponse], {
                  type: `image/${svgData?.exportFormat || "jpeg"}`,
                }),
                name: `Page-${page.pageIndex + 1}.${svgData?.exportFormat || "jpg"}`,
              });
            }
          }

          if (
            globalsSettings?.exportSafeArea &&
            globalsSettings?.exportSafeArea === true
          ) {
            if (page.safeAreaImages && page.safeAreaImages.length > 0) {
              for (const [index, safeArea] of page.safeAreaImages.entries()) {
                // Extract fonts from safe area SVG content if page.fonts is empty
                const safeAreaFonts = (page.fonts && page.fonts.length > 0) 
                  ? page.fonts 
                  : extractFontsFromSvg(safeArea.svgContent);

                const safeData = {
                  svgDetails: safeArea.svgContent,
                  fonts: safeAreaFonts,
                  w: safeArea.width,
                  h: safeArea.height,
                  brand_id: brandId,
                  project_id: projectId,
                  exportType: svgData?.exportFormat || "jpeg",
                };

                const safeResponse = await exportPageBlob(safeData);

                if (svgData?.exportAsZip === true) {
                  zip.file(
                    `Page-${page.pageIndex + 1}-safeArea-${index + 1}.${
                      svgData?.exportFormat || "jpg"
                    }`,
                    safeResponse
                  );
                } else {
                  imageFiles.push({
                    blob: new Blob([safeResponse], {
                      type: `image/${svgData?.exportFormat || "jpeg"}`,
                    }),
                    name: `Page-${page.pageIndex + 1}-safeArea-${index + 1}.${
                      svgData?.exportFormat || "jpg"
                    }`,
                  });
                }
              }
            }
          }
          setUploading(false);
        }

        // Save everything at once: ZIP → one Save-As; loose images → ONE folder
        // pick on desktop (or per-file download on web / if the native bridge is
        // unavailable). saveHelpers never throws, so a bad save can't blank the export.
        let saveResult = { saved: true, canceled: false };
        if (svgData?.exportAsZip === true) {
          updateProgress({ status: "Packaging ZIP…", progress: 92 });
          const zipBlob = await zip.generateAsync({ type: "blob" });
          updateProgress({ status: "Saving ZIP…", progress: 96 });
          saveResult = await saveSingleFile({
            blob: zipBlob,
            filename: `${svgData?.exportFormat === "pdf" ? "pdfs" : "images"}.zip`,
          });
        } else if (imageFiles.length > 0) {
          updateProgress({
            status: `Saving ${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""}…`,
            progress: 92,
          });
          saveResult = await saveMultipleFiles({
            files: imageFiles,
            title: "Choose a folder to export images into",
          });
        }

        // A dismissed native Save/Folder dialog means NOTHING was written — don't
        // claim success.
        updateProgress(
          saveResult?.canceled
            ? { status: "Export cancelled", progress: 0 }
            : { status: "Export complete!", progress: 100 }
        );
        setTimeout(() => {
          updateProgress({ showProgress: false });
          resetProgress();
        }, 1500);
      } else {
        const page = svgData.svgContent.find(
          (item) => item.pageIndex === activePageIndex
        );
        if (
          !page ||
          page === "" ||
          (typeof page === "object" && Object.keys(page).length === 0)
        ) {
          return;
        }

        // Collect the rendered image(s) for this page so a multi-output current
        // page (full + safe areas) still saves in ONE folder pick on desktop.
        const imageFiles = [];
        updateProgress({
          showProgress: true,
          progress: 30,
          currentPage: 1,
          totalPages: 1,
          status: "Rendering page…",
        });

        if (
          globalsSettings?.exportFullPage &&
          globalsSettings?.exportFullPage === true
        ) {
          const fullImageData = {
            svgDetails: page.svgContent,
            fonts: page.fonts || [],
            w: page.width,
            h: page.height,
            brand_id: brandId,
            project_id: projectId,
            exportType: svgData?.exportFormat || "jpeg",
          };

          const fullResponse = await exportPageBlob(fullImageData);

          if (svgData?.exportAsZip === true) {
            zip.file(
              `Page-${page.pageIndex + 1}.${svgData?.exportFormat || "jpg"}`,
              fullResponse
            );
          } else {
            imageFiles.push({
              blob: new Blob([fullResponse], {
                type: `image/${svgData?.exportFormat || "jpeg"}`,
              }),
              name: `Page-${page.pageIndex + 1}.${svgData?.exportFormat || "jpg"}`,
            });
          }
        }

        if (
          globalsSettings?.exportSafeArea &&
          globalsSettings?.exportSafeArea === true
        ) {
          if (page.safeAreaImages && page.safeAreaImages.length > 0) {
            for (const [index, safeArea] of page.safeAreaImages.entries()) {
              const safeData = {
                svgDetails: safeArea.svgContent,
                fonts: page.fonts || [],
                w: safeArea.width,
                h: safeArea.height,
                brand_id: brandId,
                project_id: projectId,
                exportType: svgData?.exportFormat || "jpeg",
              };

              const safeResponse = await exportPageBlob(safeData);

              if (svgData?.exportAsZip === true) {
                zip.file(
                  `Page-${page.pageIndex + 1}-safeArea-${index + 1}.${
                    svgData?.exportFormat || "jpg"
                  }`,
                  safeResponse
                );
              } else {
                imageFiles.push({
                  blob: new Blob([safeResponse], {
                    type: `image/${svgData?.exportFormat || "jpeg"}`,
                  }),
                  name: `Page-${page.pageIndex + 1}-safeArea-${index + 1}.${
                    svgData?.exportFormat || "jpg"
                  }`,
                });
              }
            }
          }
        }

        let saveResult = { saved: true, canceled: false };
        if (svgData?.exportAsZip === true) {
          updateProgress({ status: "Saving ZIP…", progress: 92 });
          const zipBlob = await zip.generateAsync({ type: "blob" });
          saveResult = await saveSingleFile({
            blob: zipBlob,
            filename: `${svgData?.exportFormat === "pdf" ? "pdfs" : "images"}.zip`,
          });
        } else if (imageFiles.length === 1) {
          updateProgress({ status: "Saving image…", progress: 92 });
          saveResult = await saveSingleFile({
            blob: imageFiles[0].blob,
            filename: imageFiles[0].name,
          });
        } else if (imageFiles.length > 1) {
          updateProgress({ status: `Saving ${imageFiles.length} images…`, progress: 92 });
          saveResult = await saveMultipleFiles({
            files: imageFiles,
            title: "Choose a folder to export images into",
          });
        }

        updateProgress(
          saveResult?.canceled
            ? { status: "Export cancelled", progress: 0 }
            : { status: "Export complete!", progress: 100 }
        );
        setTimeout(() => {
          updateProgress({ showProgress: false });
          resetProgress();
        }, 1500);

        setUploading(false);
      }

      setUploading(false);
    } catch (err) {
      setError(err?.message || "Error while exporting pages");
      setUploading(false);
      updateProgress({ showProgress: false });
      resetProgress();
    } finally {
      dispatch(setInitilized(false));
      dispatch(setStartExport(false));
    }
  };

  // Ref to prevent multiple export runs
  const exportRunningRef = useRef(false);

  useEffect(() => {
    // Reset ref when export flags are cleared
    if (!svgData.startExport || !svgData.initilized) {
      exportRunningRef.current = false;
      return;
    }

    // Prevent re-triggering if already running
    if (exportRunningRef.current) {
      return;
    }

    // Gate by preview mode to ensure only the intended owner runs the export
    if (runForPreview === true && !svgData.isPreviewBook) return;
    if (runForPreview === false && svgData.isPreviewBook) return;

    exportRunningRef.current = true;
    exportPageSVG();
  }, [
    svgData.startExport,
    svgData.initilized,
    runForPreview,
    svgData.isPreviewBook,
  ]);

  return { uploading, error, response, exportPageSVG };
};

export default useExportPages;
