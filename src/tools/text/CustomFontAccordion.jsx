import { useState, useRef, useCallback, useEffect, memo } from "react";
import styled, { keyframes, css } from "styled-components";
import { useFontContext } from "../../library/utils/context/FontContext";
import { IoChevronForward, IoCheckmark, IoTimeOutline, IoSearchOutline, IoCloseCircle, IoRemove, IoAdd } from "react-icons/io5";
import { fontSizes } from "../../library/utils/jsons/commonJSON";

// ─── Animations ──────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

const slideDown = keyframes`
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    max-height: 600px;
    transform: translateY(0);
  }
`;

const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const pulseApply = keyframes`
  0% { background: rgba(64, 132, 181, 0.06); }
  50% { background: rgba(64, 132, 181, 0.14); }
  100% { background: rgba(64, 132, 181, 0.06); }
`;

// ─── Styled Components ───────────────────────────────────────────────────────

const Section = styled.div`
  margin-top: 12px;
  padding-top: 8px;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary, #4084B5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--secondary, #EFF8FF);
  border-left: 3px solid var(--primary, #4084B5);
  border-radius: 0 4px 4px 0;
`;

const FontSizeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;

  label {
    font-size: 11px;
    font-weight: 600;
    color: #495057;
    white-space: nowrap;
    min-width: 32px;
  }

  select {
    flex: 1;
    padding: 4px 6px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 12px;
    color: #374151;
    background: #fff;
    outline: none;
    cursor: pointer;
    min-width: 0;

    &:focus {
      border-color: var(--primary, #4084B5);
      box-shadow: 0 0 0 2px rgba(64, 132, 181, 0.15);
    }
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: #fff;
    color: #495057;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;

    &:hover {
      background: var(--secondary, #EFF8FF);
      border-color: var(--primary, #4084B5);
      color: var(--primary, #4084B5);
    }

    &:active {
      transform: scale(0.95);
    }
  }
`;

const FontsList = styled.div`
  max-height: 340px;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 2px;
  }
`;

const FontHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid #f0f0f0;
  min-height: 32px;
  background: ${(props) => (props.$expanded ? "var(--secondary, #EFF8FF)" : "transparent")};

  &:hover {
    background: ${(props) => (props.$expanded ? "var(--secondary, #EFF8FF)" : "#f8f9fa")};
  }

  ${(props) =>
    props.$justApplied &&
    css`
      animation: ${pulseApply} 0.5s ease;
    `}
`;

const ArrowIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  font-size: 10px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${(props) => (props.$expanded ? "rotate(90deg)" : "rotate(0deg)")};
`;

const FontPreview = styled.img`
  height: 16px;
  max-width: 130px;
  width: auto;
  object-fit: contain;
  object-position: left center;
  flex: 1;
  min-width: 0;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
`;

const FontName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #374151;
  font-weight: ${(props) => (props.$active ? "600" : "400")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VariantsContainer = styled.div`
  padding-left: 22px;
  background: #f9fafb;
  border-bottom: 1px solid #f0f0f0;
  overflow: hidden;
  animation: ${slideDown} 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
`;

const VariantRow = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 8px;
  min-height: 28px;
  cursor: pointer;
  transition: background 0.15s ease;
  animation: ${fadeInScale} 0.15s ease both;
  animation-delay: ${(props) => props.$delay || "0s"};
  border-radius: 4px;
  margin: 1px 4px;

  &:hover {
    background: #e5e7eb;
  }

  ${(props) =>
    props.$active &&
    css`
      background: var(--secondary, rgba(64, 132, 181, 0.08));
    `}
`;

const VariantPreview = styled.img`
  height: 13px;
  max-width: 110px;
  width: auto;
  object-fit: contain;
  object-position: left center;
  flex: 1;
  min-width: 0;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
`;

const VariantName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CheckIcon = styled.span`
  color: var(--primary, #4084B5);
  font-size: 13px;
  margin-left: 6px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
`;

const Spinner = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--primary, #4084B5);
  border-top-color: transparent;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
  margin-left: 6px;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadMoreText = styled.div`
  text-align: center;
  padding: 8px;
  font-size: 10px;
  color: #9ca3af;
`;

// ─── Skeleton Components ─────────────────────────────────────────────────────

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  min-height: 32px;
  border-bottom: 1px solid #f0f0f0;
`;

const SkeletonBlock = styled.div`
  height: ${(props) => props.$h || "14px"};
  width: ${(props) => props.$w || "60%"};
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const SkeletonCircle = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

function FontSkeleton({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <SkeletonRow key={i}>
      <SkeletonCircle />
      <SkeletonBlock $w={`${50 + Math.random() * 30}%`} $h="16px" />
    </SkeletonRow>
  ));
}

// ─── SVG Preview with skeleton fallback ──────────────────────────────────────

const SvgPreviewWrapper = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  position: relative;
  min-height: ${(props) => props.$h || "16px"};
  overflow: hidden;
`;

const PreviewSkeleton = styled.div`
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  height: ${(props) => props.$h || "16px"};
  width: 70%;
  border-radius: 3px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

function SvgWithSkeleton({ url, label, height, maxWidth, Component }) {
  const [loaded, setLoaded] = useState(false);
  const loadedUrlRef = useRef(null);

  const handleLoad = useCallback(() => {
    loadedUrlRef.current = url;
    setLoaded(true);
  }, [url]);

  // Track if current url is loaded (handles url changes)
  const isCurrentLoaded = loaded && loadedUrlRef.current === url;

  return (
    <SvgPreviewWrapper $h={height}>
      {!isCurrentLoaded && <PreviewSkeleton $h={`${parseInt(height, 10) - 8}px`} />}
      <Component
        src={url}
        alt={label}
        onLoad={handleLoad}
        loading="lazy"
        draggable={false}
        style={{
          opacity: isCurrentLoaded ? 1 : 0,
          transition: "opacity 0.25s ease",
          height,
          maxWidth,
        }}
      />
    </SvgPreviewWrapper>
  );
}

// ─── Recently Used Fonts Styled Components ──────────────────────────────────

const RecentSection = styled.div`
  margin-bottom: 0;
  padding-bottom: 4px;
`;

const RecentSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: #f9fafb;
  border-left: 3px solid #9ca3af;
  border-radius: 0 4px 4px 0;
`;

const Divider = styled.div`
  height: 1px;
  background: #d1d5db;
  margin: 14px 0 12px 0;
`;

const SearchWrapper = styled.div`
  position: relative;
  margin: 0 0 6px 0;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 13px;
  display: flex;
  align-items: center;
  pointer-events: none;
`;

const ClearButton = styled.span`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 14px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: #6b7280;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  height: 30px;
  padding: 0 28px 0 28px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 11px;
  color: #374151;
  background: #f9fafb;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: var(--primary, #4084B5);
    box-shadow: 0 0 0 2px rgba(64, 132, 181, 0.1);
    background: #fff;
  }
`;

const NoResults = styled.div`
  text-align: center;
  padding: 16px 8px;
  font-size: 11px;
  color: #9ca3af;
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find the active variant in a font's styles array by matching against the
 * current text object's font properties. Priority:
 *   1. Exact styleId match
 *   2. Exact weight + style match
 *   3. Closest weight (same style preferred)
 * Returns the matched style entry or null.
 */
function findActiveVariant(font, activeFont) {
  if (!activeFont || !font?.styles?.length) return null;

  const activeFontId = activeFont.id || activeFont.fontId;
  // Only match variants if this font is the active one
  if (activeFontId !== font.fontId && activeFont.family !== font.name) return null;

  const styles = font.styles;

  // 1. Exact styleId
  if (activeFont.styleId) {
    const exact = styles.find((s) => s.styleId === activeFont.styleId);
    if (exact) return exact;
  }

  const targetWeight = parseInt(activeFont.weight, 10) || 400;
  const targetStyle = activeFont.style || "normal";

  // 2. Exact weight + style
  const exactMatch = styles.find(
    (s) => s.weight === targetWeight && (s.style || "normal") === targetStyle
  );
  if (exactMatch) return exactMatch;

  // 3. Closest weight (prefer same style)
  let closest = null;
  let closestDiff = Infinity;
  for (const s of styles) {
    const diff = Math.abs(s.weight - targetWeight);
    const sameStyle = (s.style || "normal") === targetStyle;
    // Prefer same style; if diff is equal, same style wins
    if (
      diff < closestDiff ||
      (diff === closestDiff && sameStyle && !(closest && (closest.style || "normal") === targetStyle))
    ) {
      closest = s;
      closestDiff = diff;
    }
  }
  return closest;
}

/**
 * Find the closest matching variant in a font for switching fonts.
 * Unlike findActiveVariant, this does NOT require fontId to match — it just
 * picks the best weight/style from the new font based on the current text's
 * weight and style. Falls back to defaultStyleId, then Regular, then first.
 */
function findClosestVariant(font, activeFont) {
  if (!font?.styles?.length) return font?.styles?.[0] || null;
  if (!activeFont) {
    // No active font info — use default
    return (
      font.styles.find((s) => s.styleId === font.defaultStyleId) ||
      font.styles.find((s) => s.weight === 400 && (s.style || "normal") === "normal") ||
      font.styles[0]
    );
  }

  const targetWeight = parseInt(activeFont.weight, 10) || 400;

  // When switching fonts, always prefer "normal" style first to avoid
  // carrying over italic from the previous font unexpectedly.
  // 1. Try default style of the new font
  if (font.defaultStyleId) {
    const defaultStyle = font.styles.find((s) => s.styleId === font.defaultStyleId);
    if (defaultStyle) return defaultStyle;
  }

  // 2. Exact weight + normal style
  const exactNormal = font.styles.find(
    (s) => s.weight === targetWeight && (s.style || "normal") === "normal"
  );
  if (exactNormal) return exactNormal;

  // 3. Closest weight with normal style
  let closestNormal = null;
  let closestNormalDiff = Infinity;
  for (const s of font.styles) {
    if ((s.style || "normal") !== "normal") continue;
    const diff = Math.abs(s.weight - targetWeight);
    if (diff < closestNormalDiff) {
      closestNormal = s;
      closestNormalDiff = diff;
    }
  }
  if (closestNormal) return closestNormal;

  // 4. Regular 400 normal fallback
  const regular = font.styles.find(
    (s) => s.weight === 400 && (s.style || "normal") === "normal"
  );
  if (regular) return regular;

  // 5. Absolute closest weight (any style) as last resort
  let closest = null;
  let closestDiff = Infinity;
  for (const s of font.styles) {
    const diff = Math.abs(s.weight - targetWeight);
    if (diff < closestDiff) {
      closest = s;
      closestDiff = diff;
    }
  }
  return closest || font.styles[0];
}

// ─── Main Component ──────────────────────────────────────────────────────────

function CustomFontAccordion({
  fontFamily,
  activeFont,
  onVariantSelect,
  isTextSelected,
  fontSize,
  onFontSizeChange,
  canvasSize,
}) {
  const {
    fonts: customFonts,
    hasMore,
    isLoading,
    initFonts,
    loadMoreFonts,
    loadFont,
    isFontLoaded,
    recentlyUsedFonts,
    setRecentlyUsedFonts,
    searchFonts,
    searchResults,
    isSearching,
  } = useFontContext();

  const listRef = useRef(null);
  const [expandedFontId, setExpandedFontId] = useState(null);
  const expandedFontIdRef = useRef(null);
  const [loadingFontId, setLoadingFontId] = useState(null);
  const [loadingStyleId, setLoadingStyleId] = useState(null);
  const [justAppliedFontId, setJustAppliedFontId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef(null);
  // Track expanded font in recently used section separately
  const [recentExpandedFontId, setRecentExpandedFontId] = useState(null);
  const recentExpandedRef = useRef(null);

  // Init fonts on mount
  useEffect(() => {
    initFonts();
  }, [initFonts]);

  // Track which section (recent vs main) the user last interacted with
  const lastInteractionRef = useRef(null); // 'recent' | 'main' | null

  // Auto-expand the currently active font's accordion on mount / when fonts load
  // Only expand ONE section — whichever the user last interacted with, or main by default
  useEffect(() => {
    if (!activeFont) return;
    const activeFontId = activeFont.id || activeFont.fontId;
    const activeFontName = activeFont.family;
    const source = lastInteractionRef.current;

    // If user clicked in the recent section, only expand there
    if (source === 'recent') {
      if (recentlyUsedFonts?.length) {
        const recentMatch = recentlyUsedFonts.find(
          (f) => f.fontId === activeFontId || f.name === activeFontName
        );
        if (recentMatch) {
          recentExpandedRef.current = recentMatch.fontId;
          setRecentExpandedFontId(recentMatch.fontId);
        }
      }
      return;
    }

    // If user clicked in the main section, only expand there
    if (source === 'main') {
      if (customFonts?.length) {
        const customMatch = customFonts.find(
          (f) => f.fontId === activeFontId || f.name === activeFontName
        );
        if (customMatch) {
          expandedFontIdRef.current = customMatch.fontId;
          setExpandedFontId(customMatch.fontId);
        }
      }
      return;
    }

    // Initial mount (no interaction yet) — expand in main list only
    if (customFonts?.length) {
      const customMatch = customFonts.find(
        (f) => f.fontId === activeFontId || f.name === activeFontName
      );
      if (customMatch && expandedFontIdRef.current !== customMatch.fontId) {
        expandedFontIdRef.current = customMatch.fontId;
        setExpandedFontId(customMatch.fontId);
      }
    }
  }, [activeFont, recentlyUsedFonts, customFonts]);

  // Scroll-based pagination
  const handleScroll = useCallback(
    (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !isLoading) {
        loadMoreFonts();
      }
    },
    [hasMore, isLoading, loadMoreFonts]
  );

  // Apply a specific variant — load WOFF2 then notify parent
  const applyVariant = useCallback(
    async (font, styleEntry) => {
      if (!isTextSelected) return;

      const weight = styleEntry.weight;
      const style = styleEntry.style || "normal";
      const alreadyLoaded = isFontLoaded(font.name, weight, style);

      if (!alreadyLoaded) {
        setLoadingFontId(font.fontId);
        setLoadingStyleId(styleEntry.styleId);
      }

      const success = alreadyLoaded || (await loadFont(font.fontId, weight, style));

      if (success) {
        // Pulse animation on the font header
        setJustAppliedFontId(font.fontId);
        setTimeout(() => setJustAppliedFontId(null), 600);

        // Notify parent to update Redux state
        onVariantSelect(font, styleEntry);
      }

      setLoadingFontId(null);
      setLoadingStyleId(null);
    },
    [isTextSelected, isFontLoaded, loadFont, onVariantSelect]
  );

  // Helper: add font to "Used In This Project" list when selected
  const addToRecentlyUsed = useCallback(
    (font) => {
      if (!font?.fontId) return;
      const alreadyExists = recentlyUsedFonts?.some((f) => f.fontId === font.fontId);
      if (!alreadyExists) {
        setRecentlyUsedFonts((prev) => [font, ...prev]);
      }
    },
    [recentlyUsedFonts, setRecentlyUsedFonts]
  );

  // Click font header → expand + auto-apply closest matching variant
  const handleFontHeaderClick = useCallback(
    async (font) => {
      lastInteractionRef.current = 'main';
      const isCurrentlyExpanded = expandedFontIdRef.current === font.fontId;
      const newExpanded = isCurrentlyExpanded ? null : font.fontId;

      expandedFontIdRef.current = newExpanded;
      setExpandedFontId(newExpanded);
      // Collapse recent section when main is clicked
      recentExpandedRef.current = null;
      setRecentExpandedFontId(null);

      // If expanding, auto-apply the closest matching weight/style
      if (!isCurrentlyExpanded && isTextSelected) {
        const bestMatch = findClosestVariant(font, activeFont);
        if (bestMatch) {
          await applyVariant(font, bestMatch);
          addToRecentlyUsed(font);
        }
      }
    },
    [isTextSelected, applyVariant, activeFont, addToRecentlyUsed]
  );

  // Handle recently used font header click — expand/collapse + auto-apply closest match
  const handleRecentFontHeaderClick = useCallback(
    async (font) => {
      lastInteractionRef.current = 'recent';
      const isCurrentlyExpanded = recentExpandedRef.current === font.fontId;
      const newExpanded = isCurrentlyExpanded ? null : font.fontId;

      recentExpandedRef.current = newExpanded;
      setRecentExpandedFontId(newExpanded);
      // Collapse main section when recent is clicked
      expandedFontIdRef.current = null;
      setExpandedFontId(null);

      if (!isCurrentlyExpanded && isTextSelected) {
        const bestMatch = findClosestVariant(font, activeFont);
        if (bestMatch) {
          await applyVariant(font, bestMatch);
        }
      }
    },
    [isTextSelected, applyVariant, activeFont]
  );

  // Debounced search handler
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        searchFonts(value);
      }, 350);
    },
    [searchFonts]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchFonts("");
  }, [searchFonts]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Font size helpers (must be before early return to satisfy rules-of-hooks)
  const baseReferenceWidth = 500;
  const currentDisplaySize = canvasSize?.width
    ? Math.round((activeFont?.size || 36) / (canvasSize.width / baseReferenceWidth))
    : fontSize || 36;

  const handleFontSizeSelect = useCallback(
    (e) => {
      if (onFontSizeChange) onFontSizeChange(Number(e.target.value));
    },
    [onFontSizeChange]
  );

  const incrementFontSize = useCallback(() => {
    const idx = fontSizes.indexOf(currentDisplaySize);
    const next = idx >= 0 && idx < fontSizes.length - 1 ? fontSizes[idx + 1] : currentDisplaySize + 1;
    if (onFontSizeChange) onFontSizeChange(next);
  }, [currentDisplaySize, onFontSizeChange]);

  const decrementFontSize = useCallback(() => {
    const idx = fontSizes.indexOf(currentDisplaySize);
    const prev = idx > 0 ? fontSizes[idx - 1] : Math.max(1, currentDisplaySize - 1);
    if (onFontSizeChange) onFontSizeChange(prev);
  }, [currentDisplaySize, onFontSizeChange]);

  const hasRecentFonts = recentlyUsedFonts && recentlyUsedFonts.length > 0;
  const isSearchActive = searchQuery.trim().length > 0;
  const displayFonts = isSearchActive ? (searchResults || []) : customFonts;

  if (!customFonts.length && !isLoading && !hasRecentFonts) return null;

  return (
    <Section>
      {/* Font Size Selector */}
      {/* {isTextSelected && onFontSizeChange && (
        <FontSizeRow>
          <label>Size</label>
          <button onClick={decrementFontSize} aria-label="Decrease font size" type="button">
            <IoRemove size={14} />
          </button>
          <select value={currentDisplaySize} onChange={handleFontSizeSelect}>
            {fontSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={incrementFontSize} aria-label="Increase font size" type="button">
            <IoAdd size={14} />
          </button>
        </FontSizeRow>
      )} */}

      {/* Recently Used Fonts — expandable with variants */}
      {hasRecentFonts && !isSearchActive && (
        <RecentSection>
          <RecentSectionHeader>
            <IoTimeOutline size={12} />
            Used In This Project
          </RecentSectionHeader>
          {recentlyUsedFonts.map((font) => {
            const isExpanded = recentExpandedFontId === font.fontId;
            const activeVariant = findActiveVariant(font, activeFont);
            const isFontActive = !!activeVariant;

            return (
              <div key={font.fontId}>
                <FontHeader
                  $expanded={isExpanded}
                  $justApplied={justAppliedFontId === font.fontId}
                  onClick={() => handleRecentFontHeaderClick(font)}
                >
                  <ArrowIcon $expanded={isExpanded}>
                    <IoChevronForward />
                  </ArrowIcon>
                  {font.previews?.medium ? (
                    <SvgWithSkeleton
                      url={font.previews.medium}
                      label={font.name}
                      height="16px"
                      maxWidth="130px"
                      Component={FontPreview}
                    />
                  ) : (
                    <FontName $active={isFontActive}>{font.name}</FontName>
                  )}
                  {isFontActive && !loadingFontId && (
                    <CheckIcon>
                      <IoCheckmark />
                    </CheckIcon>
                  )}
                  {loadingFontId === font.fontId && <Spinner />}
                </FontHeader>

                {/* Expanded variants */}
                {isExpanded && (
                  <VariantsContainer>
                    {font.styles.map((styleEntry, idx) => {
                      const isVariantActive =
                        activeVariant?.styleId === styleEntry.styleId;
                      const variantSvg = styleEntry.urls?.find(
                        (u) => u.name === "medium"
                      )?.url;

                      return (
                        <VariantRow
                          key={styleEntry.styleId}
                          $active={isVariantActive}
                          $delay={`${idx * 0.03}s`}
                          onClick={() => applyVariant(font, styleEntry)}
                        >
                          {variantSvg ? (
                            <SvgWithSkeleton
                              url={variantSvg}
                              label={styleEntry.label}
                              height="13px"
                              maxWidth="110px"
                              Component={VariantPreview}
                            />
                          ) : (
                            <VariantName>{styleEntry.label}</VariantName>
                          )}
                          {loadingFontId === font.fontId && loadingStyleId === styleEntry.styleId && <Spinner />}
                          {isVariantActive && !loadingStyleId && (
                            <CheckIcon>
                              <IoCheckmark />
                            </CheckIcon>
                          )}
                        </VariantRow>
                      );
                    })}
                  </VariantsContainer>
                )}
              </div>
            );
          })}
          <Divider />
        </RecentSection>
      )}

      <SectionTitle>Fonts</SectionTitle>

      {/* Search Input */}
      <SearchWrapper>
        <SearchIcon>
          <IoSearchOutline />
        </SearchIcon>
        <SearchInput
          type="text"
          placeholder="Search fonts..."
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search fonts"
        />
        {searchQuery && (
          <ClearButton onClick={clearSearch} aria-label="Clear search">
            <IoCloseCircle />
          </ClearButton>
        )}
      </SearchWrapper>

      <FontsList ref={listRef} onScroll={isSearchActive ? undefined : handleScroll}>
        {/* Skeleton while initial load or searching */}
        {(isLoading || isSearching) && displayFonts.length === 0 && <FontSkeleton count={6} />}

        {/* No results message */}
        {isSearchActive && !isSearching && displayFonts.length === 0 && (
          <NoResults>No fonts found for "{searchQuery}"</NoResults>
        )}

        {displayFonts.map((font) => {
          const isExpanded = expandedFontId === font.fontId;
          const activeVariantForFont = findActiveVariant(font, activeFont);
          const isFontActive = !!activeVariantForFont;

          return (
            <div key={font.fontId}>
              {/* Font header */}
              <FontHeader
                $expanded={isExpanded}
                $justApplied={justAppliedFontId === font.fontId}
                onClick={() => handleFontHeaderClick(font)}
              >
                <ArrowIcon $expanded={isExpanded}>
                  <IoChevronForward />
                </ArrowIcon>
                {font.previews?.medium ? (
                  <SvgWithSkeleton
                    url={font.previews.medium}
                    label={font.name}
                    height="16px"
                    maxWidth="130px"
                    Component={FontPreview}
                  />
                ) : (
                  <FontName $active={isFontActive}>{font.name}</FontName>
                )}
                {loadingFontId === font.fontId && <Spinner />}
              </FontHeader>

              {/* Expanded variants */}
              {isExpanded && (
                <VariantsContainer>
                  {font.styles.map((styleEntry, idx) => {
                    const isVariantActive =
                      activeVariantForFont?.styleId === styleEntry.styleId;
                    const variantSvg = styleEntry.urls?.find(
                      (u) => u.name === "medium"
                    )?.url;

                    return (
                      <VariantRow
                        key={styleEntry.styleId}
                        $active={isVariantActive}
                        $delay={`${idx * 0.03}s`}
                        onClick={() => { applyVariant(font, styleEntry); addToRecentlyUsed(font); }}
                      >
                        {variantSvg ? (
                          <SvgWithSkeleton
                            url={variantSvg}
                            label={styleEntry.label}
                            height="13px"
                            maxWidth="110px"
                            Component={VariantPreview}
                          />
                        ) : (
                          <VariantName>{styleEntry.label}</VariantName>
                        )}
                        {loadingFontId === font.fontId && loadingStyleId === styleEntry.styleId && <Spinner />}
                        {isVariantActive && !loadingStyleId && (
                          <CheckIcon>
                            <IoCheckmark />
                          </CheckIcon>
                        )}
                      </VariantRow>
                    );
                  })}
                </VariantsContainer>
              )}
            </div>
          );
        })}

        {/* Loading more indicator — only for paginated (non-search) mode */}
        {!isSearchActive && isLoading && displayFonts.length > 0 && (
          <LoadMoreText>Loading more fonts...</LoadMoreText>
        )}
        {!isSearchActive && !hasMore && displayFonts.length > 0 && (
          <LoadMoreText>All fonts loaded</LoadMoreText>
        )}
      </FontsList>
    </Section>
  );
}

export default memo(CustomFontAccordion);
