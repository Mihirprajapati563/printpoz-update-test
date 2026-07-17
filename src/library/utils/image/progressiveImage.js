import { useEffect, useState } from "react";
import { isDesktop } from "../../../desktop";

/**
 * progressiveImage — fast first paint AND full-resolution sharpness, adaptively.
 *
 * Loading ladder per canvas image:
 *   1. small  → painted IMMEDIATELY (tens of KB, decodes in ms) for instant content.
 *   2. medium → swapped in once decoded off-thread (clean sharpen, no flash).
 *   3. large  → upgraded to AFTER medium, so the on-screen image reaches full
 *               resolution. This happens immediately for the SELECTED image
 *               (you're focused on it) and on idle for the rest of the page.
 *
 * Why this is safe at 500–2000 photos: the canvas only mounts the ACTIVE page,
 * so the large-upgrade naturally scopes to just the visible spread — navigate
 * away and the browser evicts those large bitmaps. The other ~1,990 photos are
 * never decoded. And the display variant has ZERO effect on print/export, which
 * always renders server-side from large/original.
 *
 * A blob cache was deliberately NOT used: the browser's HTTP cache already makes
 * repeat views instant, and a blob can't speed up a first download — it would
 * only pin memory. Live URLs stay the source of truth in item.url / item.urls,
 * so order/save/export always emit the live URL.
 */

// Live URLs we've fully loaded+decoded this session (any size). Lets a revisit /
// remount start straight at the highest variant already in memory.
const decodedFull = new Set();
const inflightPreload = new Set();

// The server stores only THREE variants (large/medium/small). The "thumbnail"
// is a local-only blob used by the upload-queue UI — it is never uploaded, so it
// never appears in item.urls. Variant orders below intentionally omit it.
export function pickVariantUrl(item, order = ["medium", "large", "small"]) {
  if (!item) return "";
  if (Array.isArray(item.urls) && item.urls.length) {
    for (const size of order) {
      const match = item.urls.find((u) => u && u.size === size && u.url);
      if (match) return match.url;
    }
    const any = item.urls.find((u) => u && u.url);
    if (any) return any.url;
  }
  return item.url || "";
}

const PLACEHOLDER_ORDER = ["small"];
const MEDIUM_ORDER = ["medium", "large", "small"];
const LARGE_ORDER = ["large", "medium"];

function isLocalUrl(url) {
  // app-assets:// (desktop local user photos) are served from disk — as instant
  // as blob:/data:, so the progressive ladder must never try to "preload" them.
  return (
    typeof url === "string" &&
    (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("app-assets:"))
  );
}

// Desktop display order: local files load instantly from disk, so there is no
// bandwidth ladder — always prefer the largest (sharpest) variant.
export const DESKTOP_DISPLAY_ORDER = ["large", "medium", "small"];

function loadAndDecode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("load failed: " + url));
    img.src = url;
    if (img.decode) img.decode().then(resolve).catch(() => {});
  });
}

/**
 * Warm the browser cache for a list of live URLs ahead of display (bounded
 * concurrency). Used for the current + adjacent pages so navigation is
 * download-free. Skips already-loaded / in-flight / local URLs.
 */
export function preloadImages(urls, concurrency = 4) {
  const queue = (urls || []).filter(
    (u) => u && !isLocalUrl(u) && !decodedFull.has(u) && !inflightPreload.has(u)
  );
  if (queue.length === 0) return;
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const url = queue[cursor++];
      inflightPreload.add(url);
      try {
        await loadAndDecode(url);
        decodedFull.add(url);
      } catch (_) {
        /* display path falls back to the live URL */
      } finally {
        inflightPreload.delete(url);
      }
    }
  };
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) worker();
}

/**
 * Apply an image object's live position/scale to ALL of its on-screen `<img>`
 * elements at once — the main editing canvas AND the footer/preview thumbnails —
 * imperatively. This is what keeps the footer "live preview" updating during a
 * zoom/pan gesture WITHOUT dispatching to redux every frame (which would
 * re-render the whole MainCanvas = the lag, or fight the imperative writes = the
 * glitter).
 *
 * The canvas image is rendered at fixed intrinsic size and zoomed via a CSS
 * `transform` (so we rewrite its transform). The footer/preview thumbnails are
 * rendered with `marginLeft/marginTop` + scaled `width/height` (so we rewrite
 * those). `canvasRootEl` (the main canvas <svg>) is used to tell them apart.
 *
 * On gesture end the real values are committed to redux once; React then renders
 * the same numbers, so there is no jump.
 */
// Query the on-screen <img> elements for an image object (main canvas + footer
// thumbnails). During an imperative gesture these don't change (no re-render), so
// callers query ONCE at gesture start and reuse the result every frame instead of
// re-scanning the (large, footer-heavy) DOM each frame — that per-frame query was
// a "little lag" on zoom/pan.
export function queryLiveImageEls(id) {
  if (!id) return null;
  try {
    return document.querySelectorAll(`img.page_photo_item[data-id="${id}"]`);
  } catch (_) {
    return null;
  }
}

// Apply position/scale to PRE-QUERIED elements (see queryLiveImageEls).
export function applyLiveImageTransformEls(els, image, canvasRootEl) {
  if (!els || !image) return;
  const scale = parseFloat((image.scale ?? 1).toFixed(4));
  const posX = image.positionX || 0;
  const posY = image.positionY || 0;
  els.forEach((el) => {
    if (canvasRootEl && canvasRootEl.contains(el)) {
      // Main editing canvas: fixed intrinsic size, zoom/pan via transform.
      el.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    } else {
      // Footer / preview thumbnail: margin position + scaled width/height.
      el.style.marginLeft = `${posX}px`;
      el.style.marginTop = `${posY}px`;
      if (image.width) el.width = image.width * scale;
      if (image.height) el.height = image.height * scale;
    }
  });
}

// Convenience: query + apply in one call (used where caching isn't worth it).
export function applyLiveImageTransform(id, image, canvasRootEl) {
  if (!id || !image) return;
  applyLiveImageTransformEls(queryLiveImageEls(id), image, canvasRootEl);
}

/**
 * Apply an OBJECT's live position/rotation to its footer/preview copies during a
 * drag/rotate gesture. The main canvas `<g>` is moved imperatively by
 * react-moveable's cssText, so we SKIP it (canvasRootEl) and update only the
 * off-canvas copies (footer thumbnails), keeping the footer live preview without
 * a per-frame redux dispatch. Redux is committed once on gesture end.
 *
 * Both canvas and footer render the object as `<g class="page-item" data-id-t>`.
 * NOTE: uses the raw transform x/y — full-cover spread spine offsets are not
 * re-applied here, so on those special pages the footer catches up on commit.
 */
export function applyLiveObjectTransform(id, x, y, rotation, canvasRootEl) {
  if (!id) return;
  let els;
  try {
    els = document.querySelectorAll(`g.page-item[data-id-t="${id}"]`);
  } catch (_) {
    return;
  }
  els.forEach((el) => {
    if (canvasRootEl && canvasRootEl.contains(el)) return; // moveable owns the canvas copy
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation || 0}deg)`;
  });
}

/** Reset session load-tracking (e.g. on project close). No resources to free. */
export function resetImageLoadState() {
  decodedFull.clear();
  inflightPreload.clear();
}

function bestCachedSrc(largeUrl, mediumUrl, placeholderUrl) {
  // Highest variant already usable right now (local or decoded), else placeholder.
  if (largeUrl && (isLocalUrl(largeUrl) || decodedFull.has(largeUrl))) return largeUrl;
  if (mediumUrl && (isLocalUrl(mediumUrl) || decodedFull.has(mediumUrl))) return mediumUrl;
  return placeholderUrl || mediumUrl || largeUrl || "";
}

/**
 * Defer a progressive variant swap (setSrc) to an IDLE moment so it never blocks
 * an in-progress edit/gesture.
 *
 * Why: during the cold-load window (incognito / first open of a saved theme) the
 * page's high-res images all finish decoding around the same time. Swapping each
 * one in immediately fires a React re-render + repaint; when that lands mid-drag/
 * resize it competes with the gesture on the main thread — that's the "edit lags
 * while images are still loading, smooth once fully loaded" report. The actual
 * decode is already off-thread (img.decode); it's the swap's render/paint that
 * collides. requestIdleCallback runs the swap when the main thread is free, so
 * loading yields to interaction. The `timeout` guarantees the upgrade still
 * happens (within ~1s) even under continuous editing — images always reach full
 * resolution, they just don't fight the user's gesture. No variant/quality change.
 *
 * Returns a cancel fn (used on unmount to drop a pending swap).
 */
function scheduleIdleSwap(fn) {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    const id = window.requestIdleCallback(fn, { timeout: 1000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 120); // Safari < 16.4 fallback
  return () => clearTimeout(id);
}

/**
 * useProgressiveImage(item, isActive, isInteracting)
 *
 * Loading ladder: small → medium (always) → large (the SELECTED image only,
 * and only once the user has STOPPED manipulating it).
 *
 * NO variant swapping during interaction. Zoom is applied on the canvas as a GPU
 * `transform: scale()` (see Photo.jsx) — the bitmap is decoded ONCE and the GPU
 * samples the existing texture, so zoom never re-rasterizes and `large` is smooth
 * at any zoom. Because we no longer need to drop to `medium` mid-zoom, we also no
 * longer swap the `<img src>` mid-gesture — which was the zoom "blink". The ladder
 * simply climbs small → medium → large once and stays there.
 *
 * `large` is downloaded only for the SELECTED image (bounded memory/network); once
 * decoded it is shown for any image, even after deselect (no pointless downgrade).
 * Non-selected, never-selected images stay at `medium`. Print/export always uses
 * large/original server-side regardless.
 *
 * Returns the <img src> to use. Never blanks, never swaps mid-gesture.
 */
export function useProgressiveImage(item, wantLarge = false) {
  const placeholderUrl = pickVariantUrl(item, PLACEHOLDER_ORDER);
  const mediumUrl = pickVariantUrl(item, MEDIUM_ORDER);
  const largeUrl = pickVariantUrl(item, LARGE_ORDER);

  // ── Desktop: local files load instantly from disk, so no decode/preload/idle
  // ladder is needed — pick the variant SYNCHRONOUSLY. But still gate on zoom:
  // showing the full-res `large` for EVERY placed image at once decodes ~96 MB
  // per 6000×4000 photo (≈2 GB for a 20-image spread) → the interaction lag.
  // At cover-fit `medium` (50%, still 3000×2000) is sharper than the screen can
  // show; `large` upgrades only when the user zooms INTO an image (wantLarge).
  // Reference-mode assets (desktop device imports) carry ONLY small + large,
  // where `large` is the FULL ORIGINAL file. `mediumUrl` would then fall through
  // to that original, decoding full-res for EVERY placed photo in a spread (the
  // ~2 GB hazard above). So for the non-zoom case pick medium→small explicitly
  // (never the original); the full original loads only when the user zooms into
  // an image (`wantLarge`). Copy-mode assets still have a real medium, unchanged.
  const desktopNonZoomUrl = pickVariantUrl(item, ["medium", "small"]);
  const desktopUrl = isDesktop
    ? (wantLarge ? largeUrl || mediumUrl : desktopNonZoomUrl || largeUrl) || placeholderUrl
    : "";

  const [src, setSrc] = useState(() =>
    isDesktop ? desktopUrl : bestCachedSrc(largeUrl, mediumUrl, placeholderUrl)
  );

  useEffect(() => {
    if (isDesktop) {
      setSrc(desktopUrl);
      return;
    }
    let alive = true;
    const pendingCancels = [];
    // Immediate swap — used for the FIRST paint (cached/placeholder): we want
    // content on screen right away.
    const show = (u) => {
      if (alive && u) setSrc(u);
    };
    // Deferred swap — used for progressive UPGRADES after a fresh decode. Runs on
    // idle so it yields to an in-progress edit/gesture (see scheduleIdleSwap).
    const showIdle = (u) => {
      if (!u) return;
      const cancel = scheduleIdleSwap(() => {
        if (alive) setSrc(u);
      });
      pendingCancels.push(cancel);
    };

    const run = async () => {
      // ── Stage 1: medium baseline (fast first paint) ───────────────────────
      if (!mediumUrl) {
        show(placeholderUrl);
      } else if (isLocalUrl(mediumUrl) || decodedFull.has(mediumUrl)) {
        show(mediumUrl); // already decoded/local → cheap, show immediately
      } else {
        show(bestCachedSrc(largeUrl, mediumUrl, placeholderUrl));
        try {
          await loadAndDecode(mediumUrl);
          decodedFull.add(mediumUrl);
        } catch (_) {
          /* point at mediumUrl anyway */
        }
        showIdle(mediumUrl); // fresh decode → upgrade on idle (don't block edits)
      }

      // ── Stage 2: large (full resolution) — ONLY when the image is zoomed in
      // past cover-fit (wantLarge). At normal/cover-fit view `medium` is already
      // sharper than the screen can show, so selecting an image must NOT pull a 4K
      // variant — that download+decode was the bulk of the image lag (the DevTools
      // "282 MB wasteful" + the select→move hitch). `large` loads only when the
      // user actually zooms INTO an image; print/export use large/original
      // server-side regardless, so this never affects output quality.
      if (!wantLarge) return;
      if (!largeUrl || largeUrl === mediumUrl || isLocalUrl(largeUrl)) return;
      if (decodedFull.has(largeUrl)) {
        show(largeUrl); // already decoded → cheap src swap, show immediately
        return;
      }
      try {
        await loadAndDecode(largeUrl);
        decodedFull.add(largeUrl);
        showIdle(largeUrl); // fresh decode → upgrade on idle (don't block edits)
      } catch (_) {
        /* keep medium on failure */
      }
    };

    run();
    return () => {
      alive = false;
      pendingCancels.forEach((c) => c && c());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediumUrl, largeUrl, placeholderUrl, wantLarge]);

  return src;
}
