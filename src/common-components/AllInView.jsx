import React from "react";
import styled from "styled-components";
import { FiArrowLeft } from "react-icons/fi";

// ─── Styled Components ───────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  @media (max-width: 768px) {
    height: auto;
    min-height: 78px;
    overflow: visible;
    padding: 0 4px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
`;

const BackBtn = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a1a1a;
  border-radius: 4px;

  &:hover {
    background: #f0f0f0;
  }
`;

const Title = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(props) => props.$columns || 3}, 1fr);
  gap: 10px;
  padding: 12px 0;
  overflow-y: auto;

  @media (max-width: 768px) {
    overflow-y: visible;
    flex: none;
    padding: 8px 4px;
  }
`;

const GridItem = styled.div`
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: ${(props) => props.$bg || "#f8f9fa"};
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--primary, #007bff);
  }

  img,
  svg {
    width: 100%;
    height: 100%;
    object-fit: ${(props) => props.$objectFit || "cover"};
  }
`;

const AllInView = ({
  title = "Recently used",
  items = [],
  onItemClick,
  renderItem,
  onBack,
  objectFit = "cover",
  itemBg = "#f8f9fa",
  columns = 3,
}) => {
  if (!items || items.length === 0) {
    return (
      <Container>
        <Header>
          <BackBtn onClick={onBack} aria-label="Go back">
            <FiArrowLeft size={20} />
          </BackBtn>
          <Title>{title}</Title>
        </Header>
        <div style={{ padding: "24px 0", textAlign: "center", color: "#6c757d" }}>
          No items found
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackBtn onClick={onBack} aria-label="Go back">
          <FiArrowLeft size={20} />
        </BackBtn>
        <Title>{title}</Title>
      </Header>
      <Grid $columns={columns}>
        {items.map((item, index) =>
          renderItem ? (
            <React.Fragment key={item.id || index}>
              {renderItem(item, index)}
            </React.Fragment>
          ) : (
            <GridItem
              key={item.id || index}
              $objectFit={objectFit}
              $bg={itemBg}
              onClick={() => onItemClick?.(item)}
              title={item.name || "Recently used item"}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={item.name || `Item ${index + 1}`}
                loading="lazy"
              />
            </GridItem>
          )
        )}
      </Grid>
    </Container>
  );
};

export { GridItem };
export default AllInView;
