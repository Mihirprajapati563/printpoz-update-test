/**
 * embedDpi.js — write physical resolution (DPI) metadata into an exported image.
 * ─────────────────────────────────────────────────────────────────
 * `canvas.toBlob()` produces JPEG/PNG bytes with NO meaningful DPI: image
 * viewers then fall back to their default (Windows shows 96 DPI). A print-ready
 * export must carry the design's own DPI so the file's Properties → "Horizontal
 * / Vertical resolution" (and any print pipeline) report the value the user set
 * when creating the theme — e.g. 200 DPI, not 96.
 *
 * We patch the raw bytes rather than re-encoding (no quality loss, no extra
 * decode):
 *   • JPEG — set the JFIF APP0 density unit to "dots per inch" and write the
 *            X/Y density. If the encoder emitted no JFIF APP0, splice one in
 *            right after the SOI marker.
 *   • PNG  — insert (or overwrite) a `pHYs` chunk after IHDR with pixels-per-
 *            metre = round(dpi / 0.0254) and unit = 1 (metre).
 *
 * Everything runs in the renderer (browser) on an ArrayBuffer — no Node APIs.
 */

// ── CRC-32 (PNG polynomial 0xEDB88320) ─────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes, start, end) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const clampDensity = (dpi) => {
  const v = Math.round(Number(dpi) || 0);
  // JFIF density is a 16-bit field; keep everything in a sane, valid range.
  return Math.min(65535, Math.max(1, v));
};

// ── JPEG ────────────────────────────────────────────────────────────────────

/**
 * Return a new Uint8Array whose JFIF density reflects dpiX/dpiY.
 * @param {Uint8Array} bytes  raw JPEG
 */
function embedDpiInJpeg(bytes, dpiX, dpiY) {
  // Must start with SOI (FFD8).
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const x = clampDensity(dpiX);
  const y = clampDensity(dpiY);

  // Existing JFIF APP0 immediately after SOI? Layout: FFE0, 2-byte length, then
  // "JFIF\0" — so the identifier starts at offset 6, NOT 4 (the length field sits
  // between the marker and the identifier). Density then lives at 13/14–15/16–17.
  const hasJfif =
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    bytes[6] === 0x4a && // J
    bytes[7] === 0x46 && // F
    bytes[8] === 0x49 && // I
    bytes[9] === 0x46 && // F
    bytes[10] === 0x00;

  if (hasJfif) {
    // Patch density unit + X/Y density in place (offsets relative to SOI).
    const out = bytes.slice();
    out[13] = 0x01; // units: 1 = dots per inch
    out[14] = (x >> 8) & 0xff;
    out[15] = x & 0xff;
    out[16] = (y >> 8) & 0xff;
    out[17] = y & 0xff;
    return out;
  }

  // No JFIF APP0 — splice a fresh 18-byte segment in right after the SOI.
  const app0 = new Uint8Array([
    0xff, 0xe0, // APP0 marker
    0x00, 0x10, // length (16)
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, // version 1.1
    0x01, // units: dots per inch
    (x >> 8) & 0xff, x & 0xff, // X density
    (y >> 8) & 0xff, y & 0xff, // Y density
    0x00, 0x00, // no embedded thumbnail
  ]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0); // SOI
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

// ── PNG ───────────────────────────────────────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes) {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return false;
  return true;
}

function makePhysChunk(dpiX, dpiY) {
  // pixels per metre = dpi / 0.0254
  const ppmX = Math.max(1, Math.round(clampDensity(dpiX) / 0.0254));
  const ppmY = Math.max(1, Math.round(clampDensity(dpiY) / 0.0254));

  const chunk = new Uint8Array(21); // 4 len + 4 type + 9 data + 4 crc
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); // data length
  chunk[4] = 0x70; // p
  chunk[5] = 0x48; // H
  chunk[6] = 0x59; // Y
  chunk[7] = 0x73; // s
  dv.setUint32(8, ppmX >>> 0);
  dv.setUint32(12, ppmY >>> 0);
  chunk[16] = 0x01; // unit specifier: 1 = metre
  dv.setUint32(17, crc32(chunk, 4, 17)); // CRC over type + data
  return chunk;
}

/**
 * Return a new Uint8Array with a pHYs chunk carrying dpiX/dpiY. Overwrites an
 * existing pHYs if present, otherwise inserts one right after IHDR.
 */
function embedDpiInPng(bytes, dpiX, dpiY) {
  if (!isPng(bytes)) return bytes;

  // Walk chunks to find IHDR end and any existing pHYs.
  let offset = 8;
  let ihdrEnd = -1;
  let physOffset = -1;
  while (offset + 8 <= bytes.length) {
    const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const chunkTotal = 12 + len; // len(4) + type(4) + data + crc(4)
    if (type === "IHDR") ihdrEnd = offset + chunkTotal;
    if (type === "pHYs") physOffset = offset;
    if (type === "IEND") break;
    offset += chunkTotal;
    if (chunkTotal <= 0) break; // corrupt — bail out safely
  }
  if (ihdrEnd < 0) return bytes;

  const phys = makePhysChunk(dpiX, dpiY);

  if (physOffset >= 0) {
    // Overwrite the existing pHYs in place (same size, 21 bytes).
    const out = bytes.slice();
    out.set(phys, physOffset);
    return out;
  }

  const out = new Uint8Array(bytes.length + phys.length);
  out.set(bytes.subarray(0, ihdrEnd), 0);
  out.set(phys, ihdrEnd);
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + phys.length);
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Embed DPI metadata into a JPEG/PNG Blob. Returns a NEW Blob (same MIME type)
 * on success, or the original Blob untouched if the format isn't recognised or
 * anything goes wrong (embedding must never break an export).
 *
 * @param {Blob} blob     the encoded image
 * @param {number} dpiX   horizontal dots-per-inch to write
 * @param {number} [dpiY] vertical dots-per-inch (defaults to dpiX)
 * @returns {Promise<Blob>}
 */
export async function embedImageDpi(blob, dpiX, dpiY = dpiX) {
  try {
    if (!blob || !(dpiX > 0)) return blob;
    const type = (blob.type || "").toLowerCase();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);

    let out;
    if (type.includes("png")) {
      out = embedDpiInPng(bytes, dpiX, dpiY);
    } else if (type.includes("jpeg") || type.includes("jpg")) {
      out = embedDpiInJpeg(bytes, dpiX, dpiY);
    } else {
      return blob; // unknown format — leave as-is
    }

    if (out === bytes) return blob; // nothing changed
    return new Blob([out], { type: blob.type });
  } catch {
    return blob; // metadata is best-effort; never fail the export over it
  }
}

