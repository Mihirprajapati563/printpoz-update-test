# magZ Direct Multipart Upload System – Technical Specification

## 1. Goal Description

The objective is to implement a highly optimized, resilient multipart image upload system for magZ. Image processing (resizing) will be handled **exclusively on the client-side** before the upload begins. The images will be uploaded directly to an S3-compatible object storage via pre-signed URLs. The client will generate three specific sizes: **Small** (25%), **Medium** (50%), and **Large** (Original, 100%).

The system is designed for strictly minimal memory consumption during the upload process by chunking files and ensuring robust failure handling (network breaks, browser refreshes, etc.).

## 2. Proposed System Architecture

### 2.1 Storage & Image Sizes Strategy

- **Client-Side Resizing**: Before uploading, the frontend reads the selected image and generates resized versions using an offscreen canvas or similar web native API.
  - **Large** (Original uploaded file)
  - **Medium** (50% of the original dimensions)
  - **Small** (25% of the original dimensions)
- **Direct Upload**: The frontend requests signed URLs for all three variants and uploads them directly to the object storage.

### 2.2 Frontend Responsibilities (Upload Manager)

To ensure the client does not consume excessive memory or crash during large uploads, the frontend will adhere to the following:

1. **Dimension Extraction & Resizing**: Read original image dimensions, calculate 50% / 25% widths and heights (swapping width/height based on EXIF orientation if rotated 90/270 degrees), and generate Blobs for Medium and Small.
2. **Memory-Optimized Slicing**: Use the native `Blob.slice()` / `File.slice()` API to read 5MB chunks sequentially for the Large variant (and Medium/Small if they exceed S3 minimums). **Never load the entire file into memory during uploading.**
3. **Initialization API**: Call `POST /uploads/init` with file metadata for all 3 generated variants to receive `uploadId`s and pre-signed URLs.
4. **Direct-to-Storage Upload**: `PUT` each 5MB chunk directly to the provided pre-signed URLs.
5. **Concurrency Control**: Upload a maximum of 3 to 4 chunks concurrently across all variants to avoid network saturation.
6. **Finalization API**: Upon successful upload of all chunks for all variants of an asset, call `POST /uploads/complete` tying them all to the single database entry.

### 2.3 Backend Responsibilities (Upload Gateway)

- **Authentication & Validation**: Validate the user token, project quota, file format, and base metadata.
- **Signed URL Generation**: Integrate with S3 SDK to generate `upload_id`s and pre-signed `parts[]` URLs for part uploads for the given file variants.
- **Support Multiple Keys per Asset**: The `/initUpload` endpoint returns a single `items._id` (asset DB ID) plus signed URLs for all three variants in one response.
- **Zero-Payload Gateway**: The backend strictly serves as a coordinator and **must not stream or handle raw file bytes**.

### `/initUpload` Response Shape

````json
{
  "items": {
    "_id": "<asset_db_id>",
    "variants": {
      "large":  { "upload_id": "...", "parts": ["<presigned-url-part-1>", ...] },
      "medium": { "upload_id": "...", "parts": ["<presigned-url-part-1>"] },
      "small":  { "upload_id": "...", "parts": ["<presigned-url-part-1>"] }
    }
  },
  "status": 1,
  "status_code": 200
}

---

## 3. Resilience & Failure Handling (Retry Options)

### 3.1 Network Break / Internet Drop

- **Detection**: Listen to `navigator.onLine` and network/fetch timeout events.
- **Action**: Pause the upload queue tracking. An exponential backoff (1s, 2s, 4s...) is applied to retry the specific failed chunk.
- **Resume**: Once connection restores, the manager automatically seamlessly resumes strictly from the exact uncompleted chunk without restarting the entire file/variant upload.

### 3.2 Browser Refresh & Session Restoration

- **State Persistence**: The Frontend saves the active upload state (`file name`, `sizes`, `uploadIds`, `uploadedParts`) in `localStorage` or `IndexedDB`.
- **Restoration**: On page load, the system mounts and detects pending uploads. If files cannot be automatically recovered from `IndexedDB` due to browser restrictions, the user is prompted to re-select the original image to seamlessly resume uploading remaining parts.

### 3.3 Storage / S3 Errors

- If a pre-signed URL expires or S3 returns a `5xx` error, the Frontend safely intercepts it, calls `POST /uploads/refresh-urls` to fetch new URLs for the remaining parts, and retries the chunk.

### 3.4 Hard API Failure Fallback

- **Threshold**: If the gateway API fails or an S3 chunk retry fails **3 consecutive times**.
- **Action**: Abandon the multipart direct upload flow entirely.
- **Fallback**: Fall back to the legacy/current upload architecture by sending the entire image directly to the standard backend server as `multipart/form-data` instead. This ensures users are not hard-blocked if object storage is unreachable.

---

## 4. Database Asset Schema

```json
{
  "assetId": "uuid",
  "companyId": "uuid",
  "projectId": "uuid",
  "originalName": "string",
  "mimeType": "string",
  "status": "pending | uploading | ready | failed",
  "urlOriginal": "string",
  "urlSmall": "string",
  "urlMedium": "string",
  "urlLarge": "string",
  "fileSizeOriginal": "number",
  "metadata": {
    "width": "number",
    "height": "number"
  },
  "uploadIds": {
    "large": "string",
    "medium": "string",
    "small": "string"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
````

## 5. Scalability & Memory Footprint Specs

- **Client RAM**: Image resizing will require loading the image into an offscreen canvas. Once `Blob`s are generated, they are released. During upload, only ~5MB per active upload chunk is ever held in memory locally by streaming bytes via `Blob.slice()`.
- **Node.js Gateway RAM**: Zero memory consumed per file payload as all structural bytes go directly to S3.
- **Backend Processing**: Eliminated entirely, shifting compute cost to the user's device and allowing infinite horizontal scale.
