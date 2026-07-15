import { useState, useEffect, useRef, useCallback } from "react";

// Global cache for infinite scroll data across tab switches
const infiniteScrollCache = new Map();

export function useInfiniteScroll({
  fetchFn,
  itemsPerPage = 20,
  enabled = true,
  direction = "vertical",
  restoreToPage = 1,
  cacheKey = null, // Optional cache key for persistent caching
  refreshSignal = 0, // Signal to trigger refresh/reset
}) {
  // Use cache if cacheKey is provided
  const getCachedData = () => {
    if (!cacheKey) return { items: [], hasMore: true, currentPage: 1, scrollPosition: 0 };
    const cached = infiniteScrollCache.get(cacheKey);
    return cached || { items: [], hasMore: true, currentPage: 1, scrollPosition: 0 };
  };

  const initialCache = getCachedData();
  const [items, setItems] = useState(initialCache.items);
  const [loading, setLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialCache.hasMore);

  const currentPageRef = useRef(initialCache.currentPage);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isMountedRef = useRef(true);
  const restoreToPageRef = useRef(restoreToPage);
  const hasRestoredRef = useRef(false);
  const isDataLoadedRef = useRef(initialCache.items.length > 0);
  const scrollPositionRef = useRef(initialCache.scrollPosition);

  // Update cache when items/hasMore changes
  useEffect(() => {
    if (cacheKey) {
      infiniteScrollCache.set(cacheKey, {
        items,
        hasMore,
        currentPage: currentPageRef.current,
        scrollPosition: scrollPositionRef.current,
      });
    }
  }, [items, hasMore, cacheKey]);

  // Track scroll position and save to cache
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !cacheKey) return;
    
    const handleScroll = () => {
      const position = direction === "horizontal" ? el.scrollLeft : el.scrollTop;
      scrollPositionRef.current = position;
    };
    
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [direction, cacheKey]);

  // Restore scroll position after data is loaded
  useEffect(() => {
    if (!cacheKey || !scrollContainerRef.current || items.length === 0) return;
    
    const cachedPosition = initialCache.scrollPosition;
    if (cachedPosition > 0) {
      const raf = requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            if (direction === "horizontal") {
              scrollContainerRef.current.scrollLeft = cachedPosition;
            } else {
              scrollContainerRef.current.scrollTop = cachedPosition;
            }
          }
        }, 100);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [cacheKey, items.length, direction]);

  // Store fetchFn in a ref so loadPage doesn't depend on it,
  // keeping the IntersectionObserver stable across fetchFn changes.
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  // Store itemsPerPage in a ref too
  const itemsPerPageRef = useRef(itemsPerPage);
  useEffect(() => {
    itemsPerPageRef.current = itemsPerPage;
  }, [itemsPerPage]);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stable fetch function — no dependency on fetchFn or itemsPerPage
  const loadPage = useCallback(
    async (
      page,
      isReset = false,
      overrideLimit = null,
      effectivePage = null,
    ) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (page === 1 || isReset) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      try {
        const skip = overrideLimit ? 0 : (page - 1) * itemsPerPageRef.current;
        const limit = overrideLimit || itemsPerPageRef.current;
        const response = await fetchFnRef.current(page, skip, limit);
        if (!isMountedRef.current) return;

        if (response && response.items) {
          if (page === 1 || isReset) {
            setItems(response.items);
          } else {
            setItems((prev) => [...prev, ...response.items]);
          }

          const totalCount = response.totalCount || 0;
          const totalPages = Math.ceil(totalCount / itemsPerPageRef.current);
          const finalPage = effectivePage !== null ? effectivePage : page;
          setHasMore(finalPage < totalPages);
          currentPageRef.current = finalPage;
        }
      } catch (error) {
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsFetchingMore(false);
        }
        isFetchingRef.current = false;
      }
    },
    [], // No deps — uses refs for everything
  );

  // Reset to page 1 (e.g. after search/filter manual trigger)
  const resetAndFetch = useCallback(() => {
    currentPageRef.current = 1;
    setItems([]);
    setHasMore(true);
    scrollPositionRef.current = 0;
    // Clear cache on reset
    if (cacheKey) {
      infiniteScrollCache.delete(cacheKey);
    }
    isDataLoadedRef.current = false;
    loadPage(1, true);
  }, [loadPage, cacheKey]);

  useEffect(() => {
    if (!enabled) return;
    if (hasRestoredRef.current) {
      currentPageRef.current = 1;
      setItems([]);
      setHasMore(true);
      // Clear cache on reset
      if (cacheKey) {
        infiniteScrollCache.delete(cacheKey);
      }
      loadPage(1, true);
      return;
    }
    hasRestoredRef.current = true;
    
    // Skip initial fetch if we have cached data
    if (isDataLoadedRef.current && items.length > 0) {
      return;
    }
    
    const restorePage = restoreToPageRef.current;
    restoreToPageRef.current = 1;   
    currentPageRef.current = 1;
    setItems([]);
    setHasMore(true);
    if (restorePage > 1) {
      loadPage(1, true, restorePage * itemsPerPageRef.current, restorePage);
    } else {
      loadPage(1, true);
    }
  }, [enabled, fetchFn, cacheKey]); 

  // Respond to refresh signal
  useEffect(() => {
    if (refreshSignal > 0) {
      resetAndFetch();
    }
  }, [refreshSignal, resetAndFetch]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const rootMargin =
      direction === "horizontal" ? "0px 300px 0px 0px" : "0px 0px 300px 0px";

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isFetchingRef.current) {
          const nextPage = currentPageRef.current + 1;
          loadPage(nextPage);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin,
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, direction, loadPage]);

  return {
    items,
    setItems,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    scrollContainerRef,
    resetAndFetch,
    currentPageRef,
    scrollPositionRef,
  };
}
