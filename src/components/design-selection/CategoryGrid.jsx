/**
 * CategoryGrid — reusable grid of editor/object categories.
 *
 * Renders cards from `EDITOR_CATEGORIES` (constants) and calls `onSelect(category)`
 * when one is picked. Self-contained and importable anywhere a category picker is
 * needed (e.g. the Design Selection page, a "new design" wizard, etc.).
 *
 *   import { CategoryGrid } from "../../components/design-selection";
 *   <CategoryGrid onSelect={(cat) => ...} />
 */
import React from "react";
import {
  FaBook,
  FaBookOpen,
  FaRegCalendarAlt,
  FaPalette,
  FaLayerGroup,
  FaImages,
  FaRegImage,
  FaRegImages,
  FaFilm,
  FaMagnet,
  FaRegAddressCard,
  FaRegEnvelope,
  FaIdCard,
  FaGift,
  FaTshirt,
  FaChevronRight,
} from "react-icons/fa";
import { EDITOR_CATEGORIES } from "../../library/utils/constants";
import {
  CategoryGridEl,
  CategoryCard,
  CategoryIcon,
  CategoryTitle,
  CategoryDesc,
  CategoryArrow,
} from "./styles";

// Map the React-free `icon` keys from constants → actual icon components.
export const CATEGORY_ICONS = {
  photobook: FaBook,
  layflatalbum: FaBookOpen,
  calendar: FaRegCalendarAlt,
  canvas: FaPalette,
  acrylic: FaLayerGroup,
  wallart: FaImages,
  photoframe: FaRegImage,
  print: FaRegImages,
  photostrip: FaFilm,
  photomagnet: FaMagnet,
  card: FaRegAddressCard,
  greetingcard: FaRegEnvelope,
  visitingcard: FaIdCard,
  giftcard: FaGift,
  custom_product: FaTshirt,
};

const CategoryGrid = ({ categories = EDITOR_CATEGORIES, onSelect }) => (
  <CategoryGridEl>
    {categories.map((category) => {
      const Icon = CATEGORY_ICONS[category.icon] || FaRegImage;
      return (
        <CategoryCard
          key={category.type}
          onClick={() => onSelect?.(category)}
          aria-label={`Design a ${category.label}`}
        >
          <CategoryIcon>
            <Icon />
          </CategoryIcon>
          <CategoryTitle>
            <span>{category.label}</span>
            <CategoryArrow>
              <FaChevronRight size={12} />
            </CategoryArrow>
          </CategoryTitle>
          <CategoryDesc>{category.description}</CategoryDesc>
        </CategoryCard>
      );
    })}
  </CategoryGridEl>
);

export default CategoryGrid;
