import React from "react";
import ReactDOMServer from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

const qrSvgCache = new Map();
const metadataCache = new Map();

export function validateUrl(input) {
  if (!input || !input.trim()) {
    return { isValid: false, error: "", normalizedUrl: "" };
  }

  let trimmed = input.trim();

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = "https://" + trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: "Please enter a valid URL.", normalizedUrl: "" };
  }

  const hostname = parsed.hostname.replace(/\.$/, "");
  const lastDot = hostname.lastIndexOf(".");
  const tld = lastDot !== -1 ? hostname.slice(lastDot + 1) : "";
  if (lastDot === -1 || tld.length < 2) {
    return { isValid: false, error: "Please enter a valid URL.", normalizedUrl: "" };
  }

  if (trimmed.length > 2953) {
    return { isValid: false, error: "URL is too long for a QR code.", normalizedUrl: trimmed };
  }

  return { isValid: true, error: "", normalizedUrl: trimmed };
}

export function generateQRSvgString(url, size = 200, fgColor = "#000000", bgColor = "#FFFFFF", level = "H") {
  const cacheKey = `${url}:${size}:${fgColor}:${bgColor}:${level}`;
  if (qrSvgCache.has(cacheKey)) {
    return qrSvgCache.get(cacheKey);
  }

  const svgString = ReactDOMServer.renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: url,
      size,
      level,
      fgColor,
      bgColor,
      style: { display: "block" },
    })
  );

  qrSvgCache.set(cacheKey, svgString);
  return svgString;
}

export function extractQRSvgPaths(url, size = 200, fgColor = "#000000", bgColor = "#FFFFFF", level = "H") {
  const full = generateQRSvgString(url, size, fgColor, bgColor, level);
  const innerMatch = full.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return innerMatch ? innerMatch[1] : full;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

async function fetchMetadataFromHtml(url, existingImage) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("allorigins error");
  const json = await res.json();
  const html = json.contents || "";

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

  let image = existingImage || "";
  if (!image) {
    const ogImg =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    image = ogImg ? ogImg[1] : "";
  }

  return { title, image };
}

export async function fetchUrlMetadata(url) {
  if (metadataCache.has(url)) {
    return metadataCache.get(url);
  }

  let metadata = null;

  try {
    const mlUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const res = await fetch(mlUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const d = json.data;
        metadata = {
          title: d.title || "",
          description: d.description || "",
          favicon: d.logo?.url || "",
          image: d.image?.url || "",
        };
      }
    }
  } catch {
  }

  if (!metadata?.title) {
    try {
      const { title, image } = await fetchMetadataFromHtml(url, metadata?.image);
      metadata = {
        title,
        description: metadata?.description || "",
        favicon: metadata?.favicon || "",
        image,
      };
    } catch {
    }
  }

  metadataCache.set(url, metadata?.title ? metadata : null);
  return metadata?.title ? metadata : null;
}

export function clearQrCache() {
  qrSvgCache.clear();
}
