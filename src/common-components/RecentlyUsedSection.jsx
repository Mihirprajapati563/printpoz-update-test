import React, { useRef, useState, useCallback } from "react";
import styled from "styled-components";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import CachedImage from "./CachedImage.jsx";

// ─── Styled Components ───────────────────────────────────────────────

const SectionContainer = styled.div`
  margin-bottom: 16px;
  position: relative;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
`;

const SectionTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
`;

const SeeAllButton = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: #1a1a1a;
    text-decoration: underline;
  }
`;

const RowWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ScrollArrow = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  padding: 0;
  color: #333;
  transition: all 0.15s ease;

  &:hover {
    background: #f5f5f5;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  }

  &.left {
    left: -6px;
  }

  &.right {
    right: -6px;
  }
`;

const ItemsRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  width: 100%;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const RecentImageItem = styled.div`
  flex: 0 0 auto;
  width: ${(props) => props.$size || 60}px;
  height: ${(props) => props.$size || 60}px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: ${(props) => props.$bg || "transparent"};
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--primary, #007bff);
    transform: scale(1.05);
  }

  img,
  svg {
    width: 100%;
    height: 100%;
    object-fit: ${(props) => props.$objectFit || "cover"};
  }
`;

const RecentlyUsedSection = ({
  title = "Recently used",
  items = [],
  onItemClick,
  renderItem,
  maxItems = 10,
  itemSize = 60,
  objectFit = "cover",
  itemBg = "transparent",
  showSeeAll = true,
  onSeeAll,
}) => {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scrollBy = useCallback(
    (direction) => {
      const el = scrollRef.current;
      if (!el) return;
      const scrollAmount = itemSize * 3;
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    },
    [itemSize],
  );

  // Track items whose image source failed to load — used to hide them at runtime.
  const [failedKeys, setFailedKeys] = useState(() => new Set());
  const handleImageError = useCallback((key) => {
    setFailedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Check arrows on mount and item changes
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const timer = setTimeout(() => handleScroll(), 100);
    return () => clearTimeout(timer);
  }, [items, handleScroll]);

  // Pre-filter items that have no usable source so we don't render broken tiles.
  const usableItems = React.useMemo(
    () => (Array.isArray(items) ? items.filter((it) => it && (it.thumbnailUrl || it.url)) : []),
    [items]
  );

  if (usableItems.length === 0) return null;

  const visibleItems = usableItems
    .filter((item, index) => !failedKeys.has(item.id ?? index))
    .slice(0, maxItems);
  if (visibleItems.length === 0) return null;
  const hasMore = usableItems.length > maxItems;

  return (
    <SectionContainer>
      <SectionHeader>
        <SectionTitle>{title}</SectionTitle>
        {showSeeAll && (hasMore || items.length > 3) && onSeeAll && (
          <SeeAllButton onClick={onSeeAll}>See all</SeeAllButton>
        )}
      </SectionHeader>
      <RowWrapper>
        {showLeftArrow && (
          <ScrollArrow
            className="left"
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
          >
            <IoChevronBack size={14} />
          </ScrollArrow>
        )}
        <ItemsRow ref={scrollRef} onScroll={handleScroll}>
          {visibleItems.map((item, index) =>
            renderItem ? (
              <React.Fragment key={item.id || index}>
                {renderItem(item, index)}
              </React.Fragment>
            ) : (
              <RecentImageItem
                key={item.id || index}
                $size={itemSize}
                $objectFit={objectFit}
                $bg={itemBg}
                onClick={() => onItemClick?.(item)}
                title={item.name || "Recently used item"}
              >
                <CachedImage
                  src={item.thumbnailUrl || item.url}
                  alt={item.name || `Recent item ${index + 1}`}
                  loading="lazy"
                  onError={() => handleImageError(item.id ?? index)}
                />
              </RecentImageItem>
            ),
          )}
        </ItemsRow>
        {showRightArrow && (
          <ScrollArrow
            className="right"
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
          >
            <IoChevronForward size={14} />
          </ScrollArrow>
        )}
      </RowWrapper>
    </SectionContainer>
  );
};

export { RecentImageItem };
export default RecentlyUsedSection;
