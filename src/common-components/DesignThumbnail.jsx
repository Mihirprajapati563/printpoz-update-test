import React, { useMemo } from "react";

// ── Saved-design thumbnail renderer ──────────────────────────────────────────
// Our design thumbnails (designThumbnail.js → generatePageSvg) are SVGs whose
// TEXT is <foreignObject> HTML and whose PHOTOS/STICKERS are external <image>
// refs (app-assets:// offline, https:// online). Chromium renders NEITHER of
// those when the SVG is placed in `<img src="data:image/svg+xml…">` — foreign
// objects don't paint and external resources aren't fetched in the <img> image
// context — so every card that wasn't pure shapes/native-text showed BLANK.
//
// Inlining the SVG straight into the DOM fixes both: foreignObject text paints
// and <image href> loads (CSP already allows app-assets:/https:/data: img-src).
//
// SECURITY: `dangerouslySetInnerHTML` executes on*= handlers and <script> that a
// plain <img> render made inert. generatePageSvg interpolates theme-derived
// strings (colors, font-family, urls, mask paths) into ATTRIBUTES *without*
// escaping quotes — and those fields can come from server theme JSON / downloaded
// theme packs / the remote clipart catalog — so a hostile value could break out
// of an attribute into an <img onerror=…>. We therefore parse the decoded SVG
// with the SAME lenient HTML parser the injection uses and strip active content
// (event handlers, <script>, javascript:/vbscript:/data:text URLs) before
// inlining, keeping foreignObject text + external <image> intact.

const isSvgDataUrl = (s) =>
  typeof s === "string" && /^data:image\/svg\+xml/i.test(s);

// Decode a UTF-8 binary string (from atob) back to text, mirroring the encoder
// in designThumbnail.js (which base64s the raw UTF-8 bytes).
const utf8FromBinary = (bin) => {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(
      Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    );
  }
  return decodeURIComponent(
    bin
      .split("")
      .map((ch) => "%" + ("00" + ch.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
};

// data:image/svg+xml;base64,… (or url-encoded) → the raw SVG source string.
const decodeSvgDataUrl = (dataUrl) => {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return null;
    const isB64 = /;base64/i.test(dataUrl.slice(0, comma));
    const body = dataUrl.slice(comma + 1);
    const svg = isB64 ? utf8FromBinary(atob(body)) : decodeURIComponent(body);
    // A leading <?xml …?> prolog is fine as a data-URL but becomes bogus markup
    // when injected via innerHTML — strip it (the generator emits none today).
    return svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
  } catch (_) {
    return null;
  }
};

// Parse → strip active content → force the root <svg> to scale to its box.
// Returns a clean SVG string, or null if it can't be parsed (caller falls back
// to <img>). Uses the platform HTML parser (same rules as innerHTML) so this
// never depends on a third-party sanitizer and round-trips foreignObject markup.
const sanitizeAndFitSvg = (rawSvg) => {
  try {
    if (typeof DOMParser === "undefined") return null;
    const doc = new DOMParser().parseFromString(rawSvg, "text/html");
    const svg = doc.body && doc.body.querySelector("svg");
    if (!svg) return null;

    // Remove any <script> outright.
    svg.querySelectorAll("script").forEach((n) => n.remove());

    // Strip event handlers and dangerous URL schemes everywhere.
    const scrub = (el) => {
      Array.from(el.attributes || []).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        } else if (
          (name === "href" || name === "xlink:href" || name === "src") &&
          /^\s*(javascript|vbscript|data:text)/i.test(value)
        ) {
          el.removeAttribute(attr.name);
        }
      });
      Array.from(el.children || []).forEach(scrub);
    };
    scrub(svg);

    // Scale to the card: drop fixed width/height (the generator emits e.g.
    // width="2800" height="3600") but KEEP the viewBox, so preserveAspectRatio
    // xMidYMid meet contains + centres the design.
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    if (!svg.getAttribute("preserveAspectRatio")) {
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    const prevStyle = svg.getAttribute("style") || "";
    svg.setAttribute(
      "style",
      `${prevStyle}${prevStyle ? ";" : ""}width:100%;height:100%;display:block`
    );

    return svg.outerHTML;
  } catch (_) {
    return null;
  }
};

// Namespace every id (and each of its references) so multiple inline thumbnails
// on one page never cross-reference each other's <defs>. This matters because
// the SAME theme saved at two sizes keeps identical object UUIDs → identical
// gradient/clip/mask ids; without scoping, `url(#id)` resolves to whichever card
// painted first. `(\s)id="` (leading space) avoids matching data-id/…-id attrs.
// The prefix is hard-sanitized to [A-Za-z0-9_-] so scopeId can never inject.
const scopeSvgIds = (svg, scopeId) => {
  const p = `${String(scopeId || "d").replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  return svg
    .replace(/(\s)id="([^"]+)"/g, (_, sp, id) => `${sp}id="${p}${id}"`)
    .replace(/url\(\s*['"]?#([^)'"]+)['"]?\s*\)/g, (_, id) => `url(#${p}${id})`)
    .replace(
      /\b(xlink:href|href)="#([^"]+)"/g,
      (_, attr, id) => `${attr}="#${p}${id}"`
    );
};

const fill = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" };

/**
 * @param {string|null} thumbnail   a design thumbnail (SVG/JPEG/PNG data-URL or URL)
 * @param {string}      scopeId     unique id for this card (namespaces inline SVG ids)
 * @param {string}      alt
 * @param {object}      [style]     applied to the outer box (e.g. aspectRatio, background)
 * @param {string}      [className]
 * @param {React.ReactNode} [fallback]    node shown when there is no thumbnail
 * @param {string}      [fallbackSrc]     image shown when there is no thumbnail (if no `fallback`)
 */
const DesignThumbnail = ({
  thumbnail,
  scopeId,
  alt = "",
  style,
  className,
  fallback = null,
  fallbackSrc = null,
}) => {
  const svgMarkup = useMemo(() => {
    if (!isSvgDataUrl(thumbnail)) return null;
    const raw = decodeSvgDataUrl(thumbnail);
    if (!raw) return null;
    const cleaned = sanitizeAndFitSvg(raw);
    if (!cleaned) return null;
    return scopeSvgIds(cleaned, scopeId);
  }, [thumbnail, scopeId]);

  // `aspectRatio: 1/1` is a defensive default so the box has a non-zero height
  // even if a future caller mounts it in an auto-height parent without passing a
  // height/aspectRatio (every inner variant is position:absolute and contributes
  // no intrinsic height). Callers that pass a definite height or their own
  // aspectRatio override it; where the parent height is already definite (e.g.
  // the fixed 64×64 SavedThumb) this default is ignored by CSS.
  const box = {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    height: "100%",
    aspectRatio: "1 / 1",
    ...style,
  };

  let inner = null;
  if (svgMarkup) {
    // pointer-events off so clicks fall through to the clickable card behind it.
    inner = (
      <div
        style={{ ...fill, pointerEvents: "none" }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  } else if (thumbnail) {
    inner = (
      <img
        src={thumbnail}
        alt={alt}
        loading="lazy"
        style={{ ...fill, objectFit: "contain" }}
      />
    );
  } else if (fallback) {
    inner = (
      <div
        style={{
          ...fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {fallback}
      </div>
    );
  } else if (fallbackSrc) {
    inner = (
      <img
        src={fallbackSrc}
        alt={alt}
        loading="lazy"
        style={{ ...fill, objectFit: "contain" }}
      />
    );
  }

  return (
    <div className={className} style={box} role="img" aria-label={alt || undefined}>
      {inner}
    </div>
  );
};

export default DesignThumbnail;
