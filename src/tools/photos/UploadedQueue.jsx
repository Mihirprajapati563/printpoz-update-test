import { memo } from "react";
import { ProgressBar } from "react-bootstrap";
import { FaRegImage } from "react-icons/fa6";
import { DynamicTable } from "../../common-components/DynamicTable";
import {
  ProgressBarWrapper,
  UploadQueueBox,
} from "../../common-components/StyledComponents";
import { useSelector, useDispatch } from "react-redux";
import { retryUpload, clearCompleted } from "../../store/slices/imageUpload";
import { uploadImage, removeImageSafe } from "../../store/background-services/imageUploadThunks";

const headers = [
  { text: "Image", style: { textAlign: "center" } },
  { text: "Status", style: { textAlign: "center" } },
  { text: "Progress", style: { textAlign: "center" } },
  { text: "Action", style: { textAlign: "center" } },
];

// Function to handle retry
const handleRetry = (image, dispatch) => {
  dispatch(retryUpload({ imageId: image.imageId })); // Reset state
  dispatch(uploadImage(image)); // Trigger the upload again
};

// One <tr> per image, memoized so progress updates re-render only the
// affected row instead of the entire table (matters with 30+ rows).
// Immer keeps untouched image objects referentially stable, so the
// shallow prop compare is enough.
const QueueRow = memo(function QueueRow({ image }) {
  const dispatch = useDispatch();

  const statusLabel =
    image.status === "uploaded" ? "✓ Done" :
    image.status === "failed"   ? "✗ Failed" :
    image.status === "queued"   ? "Queued" :
    image.statusText            ? image.statusText :
    "Uploading…";

  const statusColor =
    image.status === "uploaded" ? "#28a745" :
    image.status === "failed"   ? "#e53935" :
    image.status === "queued"   ? "#999" :
    "#555";

  // Use a full-width bar for queued so it is visible (striped gray)
  const displayValue = image.status === "queued" ? 100 : image.uploadProgress;

  // File name/size come from cached primitives — `file` is released on success.
  const fileName = image.fileName || image.file?.name || "";
  const fileSize = image.fileSize || image.file?.size || 0;
  // Prefer the local preview; once it's released on success fall back to the
  // server thumbnail so completed rows still show an image.
  const serverThumb =
    (image.uploadUrls || []).find((u) => u?.size === "small") ||
    (image.uploadUrls || [])[0];
  const thumbSrc = image.previewUrl || serverThumb?.url || "";

  return (
    <tr>
      <td className="text-center d-flex flex-column align-items-center justify-content-center">
        {thumbSrc ? (
          <img
            style={{
              height: "4.5rem",
              width: "4.5rem",
              aspectRatio: 1 / 1,
              objectFit: "contain",
            }}
            src={thumbSrc}
            alt={fileName || "uploaded"}
          />
        ) : (
          // Thumbnail not generated yet (queued / preparing)
          <div
            style={{
              height: "4.5rem",
              width: "4.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f1f3f5",
              borderRadius: "6px",
            }}
          >
            <FaRegImage size={24} color="#c3c9cf" />
          </div>
        )}
        <div className="d-flex flex-column mt-1">
          <p
            className="mb-0 tex-muted text-truncate"
            style={{ width: "6rem", fontSize: "10px" }}
          >
            {fileName}
          </p>
          <p className="mb-0 tex-muted " style={{ fontSize: "10px" }}>
            {fileSize
              ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
              : ""}
          </p>
        </div>
      </td>
      <td
        className="status"
        style={{ textAlign: "center", fontSize: "12px", color: statusColor }}
      >
        {statusLabel}
      </td>
      <td>
        <ProgressBarWrapper>
          <ProgressBar
            now={displayValue}
            animated={image.status === "uploading"}
            striped={image.status === "queued" || image.status === "uploading"}
            variant={
              image.status === "uploaded" ? "success" :
              image.status === "failed"   ? "danger" :
              image.status === "queued"   ? "secondary" :
              undefined
            }
          />
          <span className="progress-label" style={{ textAlign: "center" }}>
            {image.status === "queued" ? "Queued" : `${image.uploadProgress}%`}
          </span>
        </ProgressBarWrapper>
      </td>
      <td style={{ textAlign: "center" }}>
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
          {image.error && (
            <button
              onClick={() => handleRetry(image, dispatch)}
              style={{ fontSize: "12px", padding: "3px 8px", cursor: "pointer" }}
            >
              Retry
            </button>
          )}
          <button
            onClick={() => dispatch(removeImageSafe(image.imageId))}
            title="Remove from queue"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#e53935",
              fontSize: "16px",
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
});

export const UploadQueue = ({ device }) => {
  const dispatch = useDispatch();
  const images = useSelector((state) => state.imageUpload.images);
  const hasCompleted = images.some((img) => img.status === "uploaded");
  // Show in UPLOAD ORDER (first-selected = first-uploaded = first on the
  // server) — NOT reversed. The slice stores images in selection order and
  // never reorders them, so the queue display order stays stable and matches
  // how the backend orders the images. Do not reverse/sort this.

  return (
    <>
      <UploadQueueBox className="side-bar-scroll upload-queue-box h-100">
        {images.length > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px" }}>
              <button
                onClick={() => dispatch(clearCompleted())}
                disabled={!hasCompleted}
                title="Remove finished uploads from the list (active uploads are kept)"
                style={{
                  fontSize: "12px",
                  padding: "4px 12px",
                  background: "#fff",
                  border: "1px solid #e53935",
                  color: "#e53935",
                  borderRadius: "4px",
                  cursor: hasCompleted ? "pointer" : "default",
                  opacity: hasCompleted ? 1 : 0.5,
                }}
              >
                Clear Completed
              </button>
            </div>
            <DynamicTable
              headers={headers}
              rows={images}
              renderRow={(image) => (
                <QueueRow key={image.imageId} image={image} />
              )}
            />
          </>
        ) : (
          <div className="d-flex justify-content-center align-items-center h-100">
            <h6 className="text-muted">No Images to Upload</h6>
          </div>
        )}
      </UploadQueueBox>
    </>
  );
};
// Define default props
UploadQueue.defaultProps = {
  device: "web",
};
