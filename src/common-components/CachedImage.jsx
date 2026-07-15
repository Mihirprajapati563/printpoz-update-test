/**
 * CachedImage — a drop-in <img> replacement that serves assets from the local
 * IndexedDB image cache when the app is offline.
 *
 * ONLINE  : renders a normal <img> immediately and caches the bytes in the
 *           background so the next offline session can use them.
 * OFFLINE : resolves the URL from the local cache first; falls back to the
 *           original src (which may show a broken-image icon if not cached yet).
 *
 * All props except `src` are forwarded to the underlying <img> element.
 */
import React, { useState, useEffect, useRef } from "react";
import { resolveImageUrl, cacheImageUrl } from "../library/utils/helpers/imageCache.js";
import { isOnline } from "../library/utils/helpers/assetsCache.js";

const CachedImage = ({ src, alt = "", onLoad, onError, ...rest }) => {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const prevSrcRef = useRef(null);

  useEffect(() => {
    if (!src || src === prevSrcRef.current) return;
    prevSrcRef.current = src;

    let cancelled = false;

    resolveImageUrl(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });

    // Also kick off a cache-write when online so future offline loads work
    if (isOnline()) {
      cacheImageUrl(src);
    }

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onLoad={onLoad}
      onError={onError}
      {...rest}
    />
  );
};

export default CachedImage;
