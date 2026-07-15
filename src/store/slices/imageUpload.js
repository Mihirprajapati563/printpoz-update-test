import { createSlice } from "@reduxjs/toolkit";

// Signal "this batch is done" (→ one gallery refetch) once EVERY image in the
// batch has reached a terminal state (uploaded OR failed). Runs on both success
// and failure so a single failed image can't block the refetch forever (with
// one batch id per selection, that's now a real risk). Guarded against
// double-push; only fires when at least one image actually uploaded.
const maybeCompleteBatch = (state, batchId) => {
  if (!batchId || state.batch.includes(batchId)) return;
  const batchImages = state.images.filter((img) => img.batchId === batchId);
  if (batchImages.length === 0) return;
  const stillRunning = batchImages.some(
    (img) => img.status === "queued" || img.status === "uploading"
  );
  if (stillRunning) return;
  if (batchImages.some((img) => img.status === "uploaded")) {
    state.batch.push(batchId);
    state.imageUploaded = true;
  }
};

const imageUploadSlice = createSlice({
  name: "imageUpload",
  initialState: {
    batch: [], // used to keep track of newly uploaded images group wise.
    images: [],
    imageUploaded: false,

    totalUploadedImages: 0,
    limitReached: false,
  },
  reducers: {
    startUpload: (state, action) => {
      const { imageId, file, batchId, status } = action.payload;
      const existingImage = state.images.find((img) => img.imageId === imageId);
      if (!existingImage) {
        state.images.push({
          imageId,
          file,
          // Primitive copies of the file metadata so the UI (queue list, upload
          // toast) can still show name/size after `file` is released on success
          // to free its (potentially large, in-memory for Google-Photos blobs)
          // backing data.
          fileName: file?.name || "",
          fileSize: typeof file?.size === "number" ? file.size : 0,
          batchId: batchId,
          // No preview yet — a lightweight thumbnail arrives via
          // setPreviewUrl once the resize worker produces it. Using
          // URL.createObjectURL(file) here made the browser decode every
          // full-resolution original just to paint 72px thumbnails.
          previewUrl: null,
          uploadProgress: 0,
          status: status || "uploading",
        });
      }
    },
    setPreviewUrl: (state, action) => {
      const { imageId, url, width, height } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (!image) {
        // Image was removed while its thumbnail was being generated —
        // release the orphaned object URL.
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      image.previewUrl = url;
      // Natural (EXIF-corrected) dimensions from the resize worker —
      // optimistic placement needs them for fit math before upload completes
      if (width && height) {
        image.width = width;
        image.height = height;
      }
    },
    // Free the preview blob once it has no consumer left. Called after the
    // optimistic-placement swap puts the permanent server URL on the canvas AND
    // a serverId exists (so the gallery's bridge tile renders from uploadUrls,
    // not previewUrl). Without this the ≤512px preview blobs accumulated for
    // the whole session and were only freed on Clear Completed / remove.
    releasePreviewUrl: (state, action) => {
      const { imageId } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image?.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
        image.previewUrl = null;
      }
    },
    updateUploadProgress: (state, action) => {
      const { imageId, progress } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image) {
        image.uploadProgress = progress;
        // First progress event = upload actually started. Flip out of the
        // "queued" placeholder so the bar shows live progress instead of
        // staying at the full-gray-striped 100% display.
        if (image.status === "queued") image.status = "uploading";
      }
    },
    uploadSuccess: (state, action) => {
      const { imageId, imageUrl, urls, serverId } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      // Image may have been removed from the queue while uploading
      if (!image) return;

      image.uploadUrl = imageUrl;  // primary (large) URL
      image.uploadUrls = urls || []; // all size variants
      image.serverId = serverId || null; // DB _id — used to dedupe against the server gallery
      image.uploadProgress = 100;
      image.status = "uploaded";
      // Release the original File now that the upload succeeded — nothing reads
      // it after this (retry is the only consumer and only runs on failure).
      // For large in-memory blobs (e.g. downloaded Google Photos) this is the
      // bulk of the per-image memory; name/size were copied to primitives.
      image.file = null;

      // Refetch the gallery only once the WHOLE batch (selection) has settled.
      maybeCompleteBatch(state, image.batchId);
    },
    uploadFailure: (state, action) => {
      const { imageId, error } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image) {
        image.error = error;
        image.status = "failed";
        image.uploadProgress = 0; // Reset progress in case of retry
        // A failure is also terminal — let the batch complete so a single failed
        // image doesn't block the gallery refetch.
        maybeCompleteBatch(state, image.batchId);
      }
    },
    retryUpload: (state, action) => {
      const { imageId } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image) {
        image.uploadProgress = 0;
        image.status = "uploading";
        image.statusText = "";
        delete image.error; // Clear previous error before retry
      }
    },
    updateUploadStatus: (state, action) => {
      const { imageId, statusText } = action.payload;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image) {
        image.statusText = statusText;
      }
    },
    refreshProjectImages: (state, action) => {
      state.batch.push(action.payload);
    },
    setImageUploaded: (state, action) => {
      state.imageUploaded = action.payload;
    },
    setTotalUploadedImages: (state, action) => {
      state.totalUploadedImages = action.payload;
    },
    setLimitReached: (state, action) => {
      state.limitReached = action.payload;
    },
    // Payload: imageId string, or { imageId, keepPreviewUrl } —
    // keepPreviewUrl is set by removeImageSafe when the image is placed on
    // canvas: revoking would kill the blob the canvas object still renders.
    removeImage: (state, action) => {
      const payload = action.payload;
      const imageId = typeof payload === "string" ? payload : payload?.imageId;
      const keepPreviewUrl =
        typeof payload === "object" && !!payload?.keepPreviewUrl;
      const image = state.images.find((img) => img.imageId === imageId);
      if (image?.previewUrl && !keepPreviewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
      state.images = state.images.filter((img) => img.imageId !== imageId);
    },
    clearQueue: (state) => {
      state.images.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      state.images = [];
    },
    // Remove only finished (uploaded) images. Queued/uploading images must
    // survive — the upload workers keep running regardless of Redux state,
    // so wiping them out only orphans live uploads. Failed images also stay
    // so the user can still Retry them (per-row ✕ removes them manually).
    clearCompleted: (state) => {
      state.images.forEach((img) => {
        if (img.status === "uploaded" && img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      state.images = state.images.filter((img) => img.status !== "uploaded");
    },
  },
});

export const {
  startUpload,
  setPreviewUrl,
  releasePreviewUrl,
  updateUploadProgress,
  uploadSuccess,
  uploadFailure,
  retryUpload,
  updateUploadStatus,
  refreshProjectImages,
  setImageUploaded,
  setTotalUploadedImages,
  setLimitReached,
  removeImage,
  clearQueue,
  clearCompleted,
} = imageUploadSlice.actions;

export default imageUploadSlice.reducer;
