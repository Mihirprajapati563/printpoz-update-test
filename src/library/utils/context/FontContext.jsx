/**
 * FontContext.jsx
 * React Context for managing the font registry from the backend.
 * Provides font list (with SVG previews), pagination, and on-demand font loading.
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { apiPost } from "../common-services/apiCall";
import { ENDPOINTS } from "../constants/apiurl";
import { loadFontFile, loadFontFiles, isFontLoaded, findNearestWeight } from "../common-functions/fontLoader";

const FontContext = createContext(null);

const PAGE_SIZE = 30;

export function FontProvider({ children }) {
  // Font registry: array of font objects from backend
  const [fonts, setFonts] = useState([]);
  // Lookup maps built from fonts array
  const fontByIdRef = useRef(new Map());    // fontId → font object
  const fontByNameRef = useRef(new Map());  // name (family) → font object
  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const skipRef = useRef(0);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  // Track if initial fetch has been done
  const initializedRef = useRef(false);
  // Design fonts loading state (blocks canvas render until done)
  const [isDesignFontsLoading, setIsDesignFontsLoading] = useState(false);
  const [isDesignFontsReady, setIsDesignFontsReady] = useState(false);
  const designFontsLoadedRef = useRef(false);
  // Track which pages fingerprint was last loaded (to detect theme changes)
  const lastPagesFingerprintRef = useRef(null);
  // Recently used fonts — fonts loaded from the design (for recently used panel)
  const [recentlyUsedFonts, setRecentlyUsedFonts] = useState([]);
  const recentlyUsedFontsRef = useRef([]);

  /**
   * Fetch a page of fonts from the backend and append to registry
   */
  const fetchFonts = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const skip = reset ? 0 : skipRef.current;
      const response = await apiPost(ENDPOINTS.getFontsListInSidebar, {
        filter: {},
        skip,
        limit: PAGE_SIZE,
      });

      if (response?.status === 1 && response?.items) {
        const newFonts = response.items;
        const total = response.totalCount || 0;

        const more = skip + newFonts.length < total;
        setTotalCount(total);
        setHasMore(more);
        hasMoreRef.current = more;
        skipRef.current = skip + newFonts.length;

        // Build lookup maps for new fonts
        newFonts.forEach((font) => {
          fontByIdRef.current.set(font.fontId, font);
          fontByNameRef.current.set(font.name, font);
        });

        if (reset) {
          setFonts(newFonts);
        } else {
          setFonts((prev) => [...prev, ...newFonts]);
        }
      } else {
        setError(response?.message || "Failed to fetch fonts");
      }
    } catch (err) {
      setError(err.message || "Failed to fetch fonts");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize the font registry (call once on mount)
   */
  const initFonts = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    await fetchFonts(true);
  }, [fetchFonts]); // fetchFonts is now stable (empty deps)

  /**
   * Load more fonts (pagination — call on scroll)
   */
  const loadMoreFonts = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingRef.current) return;
    await fetchFonts(false);
  }, [fetchFonts]);

  // Search state
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef(null);

  /**
   * Search fonts by name. Returns results and stores them in searchResults state.
   * Pass empty string to clear search and revert to paginated list.
   * @param {string} query - Search query string
   */
  const searchFonts = useCallback(async (query) => {
    // Cancel any in-flight search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort = true;
    }

    // Clear search — revert to paginated list
    if (!query || query.trim().length === 0) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const thisRequest = { abort: false };
    searchAbortRef.current = thisRequest;
    setIsSearching(true);

    try {
      const response = await apiPost(ENDPOINTS.getFontsListInSidebar, {
        filter: { search: query.trim() },
        skip: 0,
        limit: 50,
      });

      // If this request was superseded by a newer one, discard
      if (thisRequest.abort) return;

      if (response?.status === 1 && response?.items) {
        // Also register found fonts in lookup maps
        response.items.forEach((font) => {
          fontByIdRef.current.set(font.fontId, font);
          fontByNameRef.current.set(font.name, font);
        });
        setSearchResults(response.items);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      if (!thisRequest.abort) {
        setSearchResults([]);
      }
    } finally {
      if (!thisRequest.abort) {
        setIsSearching(false);
      }
    }
  }, []);

  /**
   * Resolve a font object from fontId or family name
   * Priority: fontId → family name → null
   * @param {string} fontId - Font ID slug (optional)
   * @param {string} familyName - Font family display name (optional)
   * @returns {object|null} Font object from registry
   */
  const resolveFont = useCallback((fontId, familyName) => {
    if (fontId && fontByIdRef.current.has(fontId)) {
      return fontByIdRef.current.get(fontId);
    }
    if (familyName && fontByNameRef.current.has(familyName)) {
      return fontByNameRef.current.get(familyName);
    }
    return null;
  }, []);

  /**
   * Load a font variant from the registry and register it via FontFace API
   * @param {string} fontId - Font ID slug
   * @param {number|string} weight - Desired weight
   * @param {string} style - "normal" or "italic"
   * @returns {Promise<boolean>} true if loaded successfully
   */
  const loadFont = useCallback(async (fontId, weight = 400, style = "normal") => {
    const font = fontByIdRef.current.get(fontId);
    if (!font) {
      return false;
    }

    // Already loaded?
    if (isFontLoaded(font.name, weight, style)) {
      return true;
    }

    // Find the matching style entry
    const targetWeight = parseInt(weight, 10) || 400;
    let styleEntry = font.styles.find(
      (s) => s.weight === targetWeight && s.style === (style || "normal")
    );

    // If exact match not found, find nearest weight with same style
    if (!styleEntry) {
      const sameStyleWeights = font.styles
        .filter((s) => s.style === (style || "normal"))
        .map((s) => s.weight);
      const nearest = findNearestWeight(sameStyleWeights, targetWeight);
      styleEntry = font.styles.find(
        (s) => s.weight === nearest && s.style === (style || "normal")
      );
    }

    // If still not found, use any available style
    if (!styleEntry && font.styles.length > 0) {
      styleEntry = font.styles[0];
    }

    if (!styleEntry || !styleEntry.fileUrl) {
      return false;
    }

    return loadFontFile(font.name, styleEntry.fileUrl, styleEntry.weight, styleEntry.style);
  }, []);

  /**
   * Get available styles (weights) for a font
   * @param {string} fontId - Font ID slug
   * @returns {Array<{weight: number, style: string, label: string, styleId: string}>}
   */
  const getFontStyles = useCallback((fontId) => {
    const font = fontByIdRef.current.get(fontId);
    if (!font) return [];
    return font.styles.map((s) => ({
      weight: s.weight,
      style: s.style,
      label: s.label,
      styleId: s.styleId,
    }));
  }, []);

  /**
   * Look up a font object by its family name from the internal registry.
   * Returns the font object (with fontId, styles[], etc.) or null.
   * @param {string} name - Font family name (e.g. "Quicksand")
   * @returns {object|null}
   */
  const getFontByName = useCallback((name) => {
    return fontByNameRef.current.get(name) || null;
  }, []);

  /**
   * Patch fontId / styleId into text objects on a pages array (mutates in place).
   * Uses the internal fontByNameRef registry built by loadDesignFonts.
   * Call this at save time to ensure font metadata is always present.
   * @param {Array} pages - Array of page objects
   * @returns {boolean} true if any object was patched
   */
  const patchFontIdsOnPages = useCallback((pages) => {
    if (!pages || pages.length === 0) return false;
    let changed = false;
    pages.forEach((page) => {
      if (!page.layout) return;
      page.layout.forEach((layout) => {
        if (!layout) return; // skip null layout entries
        const arrays = [layout.objects, layout.safeAreaObjects].filter(Boolean);
        arrays.forEach((arr) => {
          arr.forEach((obj, idx) => {
            if (obj.type !== "text" || !obj.font?.family) return;
            if (obj.font.id && obj.font.fontId && obj.font.styleId) return;

            const font = fontByNameRef.current.get(obj.font.family);
            if (!font) return;

            // Build patched font as a new object (Redux/Immer objects are frozen)
            const patched = { ...obj.font };
            let objChanged = false;
            if (!patched.id) { patched.id = font.fontId; objChanged = true; }
            if (!patched.fontId) { patched.fontId = font.fontId; objChanged = true; }

            if (!patched.styleId) {
              const weight = parseInt(patched.weight, 10) || 400;
              const style = patched.style || "normal";
              const matchedStyle = font.styles?.find(
                (s) => s.weight === weight && s.style === style
              ) || font.styles?.find(
                (s) => s.weight === weight
              ) || (font.styles?.length > 0 ? font.styles[0] : null);

              if (matchedStyle?.styleId) {
                patched.styleId = matchedStyle.styleId;
                objChanged = true;
              }
            }

            if (objChanged) {
              arr[idx] = { ...obj, font: patched };
              changed = true;
            }
          });
        });
      });
    });
    return changed;
  }, []);

  /**
   * Fetch fonts from the backend by sending design font references.
   * Sends two arrays to getFontById endpoint:
   *   - fontsById: [{id, styleId}] for new fonts that have IDs
   *   - fontsByName: [{name, style, weight}] for legacy/old fonts without IDs
   *
   * Returns the same response shape as getFontsList.
   *
   * @param {Array<{id: string, styleId: string}>} fontsById
   * @param {Array<{name: string, style: string, weight: number}>} fontsByName
   * @returns {Promise<Array>} Array of font objects from backend
   */
  const fetchFontsByIds = useCallback(async (fontsById = [], fontsByName = []) => {
    if (fontsById.length === 0 && fontsByName.length === 0) return [];

    try {
      const response = await apiPost(ENDPOINTS.getFontById, {
        font_ids: fontsById,
        font_names: fontsByName,
      });

      // API response: { items: { byFontId: [...], byNameStyle: [...] }, status: 1 }
      if (response?.status === 1 && response?.items) {
        const byFontId = response.items.byFontId || [];
        const byNameStyle = response.items.byNameStyle || [];
        // Dedup by fontId in case the same font appears in both arrays
        const dedupIds = new Set();
        const fetchedFonts = [...byFontId, ...byNameStyle].filter((f) => {
          if (!f.fontId || dedupIds.has(f.fontId)) return false;
          dedupIds.add(f.fontId);
          return true;
        });

        if (fetchedFonts.length === 0) return [];

        // Register in lookup maps
        fetchedFonts.forEach((font) => {
          if (font.fontId) fontByIdRef.current.set(font.fontId, font);
          if (font.name) fontByNameRef.current.set(font.name, font);
        });

        // Merge into fonts state (avoid duplicates)
        setFonts((prev) => {
          const existingIds = new Set(prev.map((f) => f.fontId));
          const unique = fetchedFonts.filter((f) => !existingIds.has(f.fontId));
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });

        return fetchedFonts;
      }

      return [];
    } catch (err) {
      return [];
    }
  }, []);

  /**
   * Scan design pages for text objects, collect unique font+weight+style combos,
   * call getFontById API with all fonts, load WOFF2 files before canvas renders.
   *
   * For each text object:
   *   - If font has `id` (new design) → send {id, styleId} to API
   *   - If font has no `id` (legacy) → send {name, style, weight} to API
   *
   * The API returns font objects with WOFF2 fileUrls. We load all of them
   * via FontFace API before allowing the canvas to render.
   *
   * On API failure → gracefully fallback (don't block canvas).
   * Saves returned font data as recently used fonts for future use.
   *
   * @param {Array} pages - Array of page objects from Redux (state.canvas.pages)
   * @param {Array} [extraPages=[]] - Additional pages from other theme sizes (decompressed)
   *   These are only scanned for font combos — not used for fingerprinting or ID patching.
   * @returns {Promise<Array>} fetched font objects (empty if none fetched)
   */
  /**
   * Reset design fonts state so loadDesignFonts can be triggered again.
   * Call this when theme changes to force re-loading fonts.
   */
  const resetDesignFonts = useCallback(() => {
    designFontsLoadedRef.current = false;
    lastPagesFingerprintRef.current = null;
    setIsDesignFontsReady(false);
    setIsDesignFontsLoading(false);
  }, []);

  const loadDesignFonts = useCallback(async (pages, extraPages = []) => {
    if (!pages || pages.length === 0) return [];

    // Generate a fingerprint from page IDs to detect theme changes
    const fingerprint = pages.map((p) => p.id).join(",");
    if (designFontsLoadedRef.current && lastPagesFingerprintRef.current === fingerprint) {
      return []; // Same pages, already loaded
    }
    // If pages changed (theme switch), reset the loaded flag
    if (lastPagesFingerprintRef.current !== null && lastPagesFingerprintRef.current !== fingerprint) {
      designFontsLoadedRef.current = false;
    }
    if (designFontsLoadedRef.current) return [];

    setIsDesignFontsLoading(true);
    setIsDesignFontsReady(false);
    lastPagesFingerprintRef.current = pages.map((p) => p.id).join(",");

    try {
      // Step 1: Scan all pages (active + extra from other theme sizes) for text objects
      const fontCombos = new Map(); // key → combo object
      const allPagesToScan = [...pages, ...extraPages];

      for (const page of allPagesToScan) {
        if (!page.layout) continue;
        for (const layout of page.layout) {
          const allObjects = [
            ...(layout.objects || []),
            ...(layout.safeAreaObjects || []),
          ];
          for (const obj of allObjects) {
            if (obj.type === "text" && obj.font?.family) {
              const family = obj.font.family;
              const weight = parseInt(obj.font.weight, 10) || 400;
              const style = obj.font.style || "normal";
              const fontId = obj.font.id || null;
              const styleId = fontId ? `${weight}-${style}` : null;
              const key = fontId ? `${fontId}__${styleId}` : `${family}__${weight}__${style}`;

              if (!fontCombos.has(key)) {
                fontCombos.set(key, {
                  familyName: family,
                  fontId,
                  styleId,
                  weight,
                  style,
                  // Track original object fields to detect missing IDs
                  hasFontId: !!obj.font.fontId,
                  hasStyleId: !!obj.font.styleId,
                });
              }
            }
          }
        }
      }

      if (fontCombos.size === 0) {
        designFontsLoadedRef.current = true;
        setIsDesignFontsReady(true);
        setIsDesignFontsLoading(false);
        return [];
      }

      // Step 2: Build fontsById and fontsByName arrays for the API call
      // We need to fetch metadata for ALL fonts (even already-loaded ones) to patch IDs
      const fontsByIdSet = new Set();   // dedup by fontId
      const fontsByNameSet = new Set(); // dedup by name
      const familyNamesCoveredById = new Set(); // family names already covered by fontId
      const fontsById = [];   // [{id}] — new fonts with IDs
      const fontsByName = [];  // [{name}] — legacy fonts without IDs
      const combosNeedingWoff2 = []; // combos that need WOFF2 loading
      let needsIdPatching = false; // track if any font needs ID patching

      // First pass: collect all fonts that have fontId
      for (const combo of fontCombos.values()) {
        if (combo.fontId) {
          familyNamesCoveredById.add(combo.familyName);
          if (!fontsByIdSet.has(combo.fontId)) {
            fontsByIdSet.add(combo.fontId);
            fontsById.push({ id: combo.fontId });
          }
          // Also flag for patching if fontId or styleId is missing on the original object
          if (!combo.hasFontId || !combo.hasStyleId) {
            needsIdPatching = true;
          }
        }
      }

      // Second pass: collect fonts needing WOFF2 + legacy fonts needing name lookup
      for (const combo of fontCombos.values()) {
        const alreadyLoaded = isFontLoaded(combo.familyName, combo.weight, combo.style);

        // Track combos that need WOFF2 loading
        if (!alreadyLoaded) {
          combosNeedingWoff2.push(combo);
        }

        // Only send font_names for fonts that do NOT have a fontId anywhere
        if (!combo.fontId && !familyNamesCoveredById.has(combo.familyName)) {
          needsIdPatching = true;
          if (!fontsByNameSet.has(combo.familyName)) {
            fontsByNameSet.add(combo.familyName);
            fontsByName.push({ name: combo.familyName });
          }
        }
      }

      // If all fonts are loaded AND no ID patching needed, we're done
      if (combosNeedingWoff2.length === 0 && !needsIdPatching) {
        designFontsLoadedRef.current = true;
        setIsDesignFontsReady(true);
        setIsDesignFontsLoading(false);
        return [];
      }

      // Step 3: Call getFontById API with both arrays
      let fetchedFonts = [];
      try {
        fetchedFonts = await fetchFontsByIds(fontsById, fontsByName);
      } catch (apiErr) {
        // On API failure, allow canvas to render with system fallback fonts
        designFontsLoadedRef.current = true;
        setIsDesignFontsReady(true);
        setIsDesignFontsLoading(false);
        return [];
      }

      // If API returned no fonts, fallback gracefully
      if (!fetchedFonts || fetchedFonts.length === 0) {
        designFontsLoadedRef.current = true;
        setIsDesignFontsReady(true);
        setIsDesignFontsLoading(false);
        return [];
      }

      // Step 4: Save recently used fonts references (dedup by fontId)
      const seen = new Set();
      const merged = [...recentlyUsedFontsRef.current, ...fetchedFonts];
      const newRecent = merged.filter((f) => {
        if (!f.fontId || seen.has(f.fontId)) return false;
        seen.add(f.fontId);
        return true;
      });
      recentlyUsedFontsRef.current = newRecent;
      setRecentlyUsedFonts(newRecent);

      // Step 5: Resolve each combo to a WOFF2 fileUrl and bulk-load
      const fontsToLoad = [];

      for (const combo of combosNeedingWoff2) {
        if (isFontLoaded(combo.familyName, combo.weight, combo.style)) continue;

        // Resolve from registry (now populated by fetchFontsByIds)
        const font = combo.fontId
          ? fontByIdRef.current.get(combo.fontId) || fontByNameRef.current.get(combo.familyName)
          : fontByNameRef.current.get(combo.familyName);

        if (!font) continue;

        // Find matching style entry (exact → nearest → first)
        let styleEntry = font.styles.find(
          (s) => s.weight === combo.weight && s.style === combo.style
        );

        if (!styleEntry) {
          const sameStyleWeights = font.styles
            .filter((s) => s.style === combo.style)
            .map((s) => s.weight);
          const nearest = findNearestWeight(sameStyleWeights, combo.weight);
          styleEntry = font.styles.find(
            (s) => s.weight === nearest && s.style === combo.style
          );
        }
        if (!styleEntry && font.styles.length > 0) {
          styleEntry = font.styles[0];
        }
        if (!styleEntry?.fileUrl) continue;

        fontsToLoad.push({
          familyName: font.name,
          fileUrl: styleEntry.fileUrl,
          weight: styleEntry.weight,
          style: styleEntry.style,
        });
      }

      // Step 6: Bulk load all WOFF2 font files in parallel
      if (fontsToLoad.length > 0) {
        await loadFontFiles(fontsToLoad);
      }

      designFontsLoadedRef.current = true;
      setIsDesignFontsReady(true);
      return fetchedFonts;
    } catch (err) {
      // On any unexpected error, don't block canvas — allow fallback rendering
      designFontsLoadedRef.current = true;
      setIsDesignFontsReady(true);
      return [];
    } finally {
      setIsDesignFontsLoading(false);
    }
  }, [fetchFontsByIds]);

  const value = {
    // State
    fonts,
    totalCount,
    hasMore,
    isLoading,
    isDesignFontsLoading,
    isDesignFontsReady,
    error,
    // Actions
    initFonts,
    loadMoreFonts,
    resolveFont,
    loadFont,
    getFontStyles,
    loadDesignFonts,
    resetDesignFonts,
    fetchFontsByIds,
    // Recently used fonts from design load
    recentlyUsedFonts,
    setRecentlyUsedFonts,
    // Search
    searchFonts,
    searchResults,
    isSearching,
    // Utilities
    isFontLoaded,
    getFontByName,
    patchFontIdsOnPages,
  };

  return (
    <FontContext.Provider value={value}>
      {children}
    </FontContext.Provider>
  );
}

/**
 * Hook to access the FontContext
 * @returns {object} FontContext value
 */
export function useFontContext() {
  const ctx = useContext(FontContext);
  if (!ctx) {
    throw new Error("useFontContext must be used within a FontProvider");
  }
  return ctx;
}

export default FontContext;
