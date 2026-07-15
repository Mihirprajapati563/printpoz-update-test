/**
 * useCachedUrl — React hook that resolves an image URL through the local
 * IndexedDB image cache for offline support.
 *
 * Online  : returns the original URL immediately; caches in background.
 * Offline : returns the cached data-URL when available; falls back to original.
 */
import { useState, useEffect } from "react";
import { resolveImageUrl, cacheImageUrl } from "../library/utils/helpers/imageCache.js";
import { isOnline } from "../library/utils/helpers/assetsCache.js";

const useCachedUrl = (url) => {
  const [resolvedUrl, setResolvedUrl] = useState(url || "");

  useEffect(() => {
    if (!url) {
      setResolvedUrl("");
      return;
    }

    // Immediately show the original URL (no flicker on first render)
    setResolvedUrl(url);

    let cancelled = false;

    resolveImageUrl(url).then((resolved) => {
      if (!cancelled && resolved !== url) {
        setResolvedUrl(resolved);
      }
    });

    // Background-cache when online
    if (isOnline()) {
      cacheImageUrl(url);
    }

    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolvedUrl;
};

export default useCachedUrl;
