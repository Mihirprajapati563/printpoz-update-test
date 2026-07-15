/**
 * ThemeBrowser — reusable, infinite-scrolling grid of theme editors for one
 * category (editor type).
 *
 * Self-contained: it owns its own fetch + pagination (via `useInfiniteScroll` and
 * the `fetchThemesByCategory` service) and just calls back `onSelectTheme(theme)`
 * when a card is clicked. Import and drop it anywhere a category-scoped theme
 * picker is needed.
 *
 *   import { ThemeBrowser } from "../../components/design-selection";
 *   <ThemeBrowser key={cat.type} category={cat} user={user}
 *                 onSelectTheme={(t) => ...} selectedThemeId={loadingId} />
 *
 * IMPORTANT: mount with `key={category.type}`. The infinite-scroll observer binds
 * on mount and only re-binds via its deps; remounting per category gives it a
 * clean page-1 state with the sentinel already in the DOM. The sentinel is always
 * rendered (even during the initial skeleton) so the observer can bind immediately.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FaRegImages,
  FaRedo,
  FaArrowLeft,
  FaRegSun,
  FaDownload,
  FaCheck,
  FaSearch,
  FaTimes,
  FaPlus,
} from "react-icons/fa";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import useCachedUrl from "../../hooks/useCachedUrl";
import { fetchThemesByCategory } from "../../library/utils/services/theme";
import { Spinner, EmptyState, ErrorState } from "../../common-components/StateViews";
import {
  GhostButton,
  PrimaryButton,
  ThemeGridEl,
  ThemeCard,
  ThemeCardWrap,
  ThemeThumb,
  ThemeOverlay,
  ThemeOverlayCTA,
  ThemeName,
  CardLoadingOverlay,
  ThemeCardFooter,
  ThemeDownloadButton,
  ThemeInstalledButton,
  SkeletonCard,
  FooterLoader,
  EndNote,
} from "./styles";

const THEMES_PER_PAGE = 24;
const SKELETON_COUNT = 12;

// Theme preview thumbnail. `ThemeThumb` paints the image as a CSS background, so
// we resolve the remote CDN url through the offline image cache first: online it
// returns the url unchanged (and caches the bytes to AppData in the background);
// offline it returns the on-disk app-assets copy so the preview still renders.
// Kept as its own component so the useCachedUrl hook obeys the rules of hooks
// (one per card, not inside the .map()).
const CachedThemeThumb = ({ src, children }) => {
  const resolved = useCachedUrl(src);
  return <ThemeThumb $src={resolved}>{children}</ThemeThumb>;
};

const ThemeBrowser = ({
  category,
  user,
  onSelectTheme,
  selectedThemeId = null,
  onBack,
  perPage = THEMES_PER_PAGE,
  // Committed search term (owned by the page so it can sit inline with the
  // breadcrumb). Changing it re-identifies fetchThemes below, and
  // useInfiniteScroll resets to page 1 + refetches whenever its fetchFn identity
  // changes — so the grid reloads with the new term for free. `onClearSearch`
  // backs the "Clear search" action in the no-results empty state.
  search = "",
  onClearSearch,
  // Offline-download wiring (desktop only — omitted on web). When
  // `downloadSupported` is false the controls aren't rendered at all.
  downloadSupported = false,
  downloadedIds = null,
  downloadingId = null,
  onDownloadTheme,
  // "Blank" card (photobook / layflat only) — a leading grid tile that starts a
  // fresh design filled with random layouts. `onCreateBlank` opens the flow.
  showBlankCard = false,
  onCreateBlank,
}) => {
  const [error, setError] = useState("");

  // Keep latest user in a ref so fetchThemes' identity only depends on the
  // category and the committed search term (not on user resolving async).
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchThemes = useCallback(
    async (page, skip, limit) => {
      try {
        const result = await fetchThemesByCategory({
          editorType: category.type,
          user: userRef.current,
          skip: skip ?? (page - 1) * perPage,
          limit: limit ?? perPage,
          search,
        });
        setError("");
        return result;
      } catch (_) {
        setError("We couldn't load designs for this category. Please try again.");
        return { items: [], totalCount: 0 };
      }
    },
    [category.type, perPage, search],
  );

  const {
    items: themes,
    loading,
    isFetchingMore,
    hasMore,
    sentinelRef,
    resetAndFetch,
  } = useInfiniteScroll({
    fetchFn: fetchThemes,
    itemsPerPage: perPage,
    enabled: true,
    direction: "vertical",
  });

  // Treat the window before the first fetch settles as "loading" so the empty
  // state never flashes on the very first render (loading starts false).
  const [everLoading, setEverLoading] = useState(false);
  useEffect(() => {
    if (loading) setEverLoading(true);
  }, [loading]);

  const isEmpty = themes.length === 0;
  const showSkeleton = isEmpty && !error && (loading || !everLoading);
  const showError = isEmpty && !!error && !loading;
  // When a Blank card is present it carries the grid on its own, so don't also
  // show the "no designs" empty state under it.
  const showEmpty = isEmpty && !error && everLoading && !loading && !showBlankCard;

  const blankCard = showBlankCard ? (
    <ThemeCardWrap key="__blank__">
      <ThemeCard type="button" onClick={() => onCreateBlank?.()} title="Start a blank design with random layouts">
        <div
          style={{
            position: "relative",
            width: "calc(100% - 16px)",
            aspectRatio: "3 / 4",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            border: "2px dashed var(--primary, #2f6f9f)",
            borderRadius: "12px",
            margin: "8px",
            background: "rgba(47,111,159,0.06)",
            color: "var(--primary, #2f6f9f)",
          }}
        >
          <FaPlus size={30} />
          <span style={{ fontSize: "13px", fontWeight: 700 }}>Blank design</span>
        </div>
        <ThemeName>Start from scratch</ThemeName>
      </ThemeCard>
    </ThemeCardWrap>
  ) : null;

  // NOTE: the sentinel <div> is ALWAYS rendered (even during these states) so the
  // hook's IntersectionObserver binds on mount, before the first page resolves.
  return (
    <>
      {showSkeleton && (
        <ThemeGridEl>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ThemeGridEl>
      )}

      {showError && (
        <ErrorState
          title="Couldn't load designs"
          text={error}
          action={
            <PrimaryButton onClick={resetAndFetch}>
              <FaRedo size={13} /> Retry
            </PrimaryButton>
          }
        />
      )}

      {showEmpty &&
        (search ? (
          <EmptyState
            icon={<FaSearch />}
            title={`No results for “${search}”`}
            text={`No ${category.label} projects match your search. Try a different term or clear the search.`}
            action={
              onClearSearch && (
                <GhostButton onClick={onClearSearch}>
                  <FaTimes size={12} /> Clear search
                </GhostButton>
              )
            }
          />
        ) : (
          <EmptyState
            icon={<FaRegImages />}
            title={`No ${category.label} projects yet`}
            text="There aren't any ready-made projects in this category at the moment."
            action={
              onBack && (
                <GhostButton onClick={onBack}>
                  <FaArrowLeft size={13} /> Browse other categories
                </GhostButton>
              )
            }
          />
        ))}

      {(themes.length > 0 || (showBlankCard && !showSkeleton && !showError)) && (
        <ThemeGridEl>
          {blankCard}
          {themes.map((theme) => {
            const thumb =
              theme?.theme_images?.length > 0 ? theme.theme_images[0]?.url : "";
            const isLoading = selectedThemeId === theme._id;
            const isDownloaded = !!downloadedIds && downloadedIds.has(theme._id);
            const isDownloading = downloadingId === theme._id;
            return (
              <ThemeCardWrap key={theme._id}>
                <ThemeCard
                  onClick={() => onSelectTheme?.(theme)}
                  disabled={!!selectedThemeId}
                  title={theme.name}
                >
                  <CachedThemeThumb src={thumb}>
                    <ThemeOverlay>
                      <ThemeOverlayCTA>
                        <FaRegSun size={12} /> Open in editor
                      </ThemeOverlayCTA>
                    </ThemeOverlay>
                  </CachedThemeThumb>
                  <ThemeName>{theme.name || "Untitled design"}</ThemeName>
                </ThemeCard>

                {/* Offline action (desktop only). "Installed" once downloaded —
                    disabled; removing the pack from the sidebar's Offline tab
                    updates downloadedIds and flips this back to "Download". */}
                {downloadSupported && (
                  <ThemeCardFooter>
                    {isDownloaded ? (
                      <ThemeInstalledButton
                        type="button"
                        disabled
                        title="Installed — available offline"
                      >
                        <FaCheck size={11} /> Installed
                      </ThemeInstalledButton>
                    ) : (
                      <ThemeDownloadButton
                        type="button"
                        disabled={isDownloading || !!downloadingId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadTheme?.(theme);
                        }}
                        aria-label={`Download ${theme.name || "design"} for offline use`}
                        title={isDownloading ? "Downloading…" : "Download for offline use"}
                      >
                        {isDownloading ? (
                          <>
                            <Spinner $size={13} $thickness={2} /> Downloading…
                          </>
                        ) : (
                          <>
                            <FaDownload size={11} /> Download
                          </>
                        )}
                      </ThemeDownloadButton>
                    )}
                  </ThemeCardFooter>
                )}

                {isLoading && (
                  <CardLoadingOverlay>
                    <Spinner $size={26} $track="rgba(255,255,255,0.35)" $accent="#fff" />
                    Opening editor…
                  </CardLoadingOverlay>
                )}
              </ThemeCardWrap>
            );
          })}
        </ThemeGridEl>
      )}

      {/* Infinite-scroll sentinel — always mounted so the observer binds on mount */}
      <div ref={sentinelRef} style={{ height: 1, width: "100%" }} />
      {isFetchingMore && (
        <FooterLoader>
          <Spinner $size={22} /> Loading more designs…
        </FooterLoader>
      )}
      {!hasMore && themes.length > 0 && (
        <EndNote>You've reached the end of the designs.</EndNote>
      )}
    </>
  );
};

export default ThemeBrowser;
