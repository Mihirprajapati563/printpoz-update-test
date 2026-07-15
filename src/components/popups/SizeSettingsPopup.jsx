/**
 * SizeSettingsPopup Component
 *
 * This component provides a user interface for setting up custom canvas sizes for a single theme.
 * It is particularly useful for configuring multiple sizes within a photobook theme.
 *
 * Features:
 * - Displays the current canvas size settings, allowing users to easily view and modify them.
 * - Allows users to input custom width, height, and depth values for the canvas.
 * - Updates the display size dynamically as users input new values.
 * - Saves the custom size settings for the theme, enabling consistent canvas dimensions across the project.
 *
 * Props:
 * - handleClose: A function to handle the closing of the popup.
 *
 * State:
 * - displaySize: An object containing the width, height, and depth of the canvas.
 *
 * Redux:
 * - Uses selectors to retrieve the current canvas size, all pages, active editor type, and all themes from the Redux store.
 * - Dispatches actions to update the project setup with the new size settings.
 *
 * Usage:
 * This component is typically used within the project setup workflow to configure canvas sizes for themes.
 * It ensures that users can easily manage and apply consistent size settings across different parts of the project.
 */

import { useEffect, useRef, useState } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  BodyText,
  Box,
  FlexBox,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  FlipBookContainer,
  FlipBookPages,
  PhotoModalBodyStyled,
  PrimaryButton,
  PrimaryOutlineButton,
} from "../../common-components/StyledComponents.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  getActiveEditorType,
  getCanvasSize,
  getAllPages,
  getSettings,
  getBillablePages,
} from "../../library/utils/helpers/index.js";
import {
  EDITOR_TYPES,
  EDITOR_SUB_TYPES,
} from "../../library/utils/constants/index.js";
import { Container, Row, Col, Form, Button, Dropdown } from "react-bootstrap"; // Import Bootstrap components
import {
  setCanvasSize,
  setEditorType,
  resetEditor,
  setCurrentObjectProperties,
  setSettings,
  applyTheme,
  changeObjectsInAllPages,
} from "../../store/slices/canvas.js";
import { AiFillInfoCircle, AiOutlineClose } from "react-icons/ai";
import {
  setEditorPages,
  setThemeId,
  setAllThemes,
  setThemeName,
} from "../../store/slices/projectSetup.js";
import { processProjectPages, GetThemeById } from "../../library/utils/services/theme/index.js";
import { blankImageUrls, collectPlacedImages } from "../../library/utils/helpers/blankImages.js";
import {
  getCustomSizes,
  addCustomSize,
  removeCustomSize,
  removeCustomSizesByDimensions,
  initCustomSizes,
  subscribeCustomSizes,
} from "../../library/utils/helpers/customSizes.js";
import { PRINT_UNITS, convertToPixels, convertPixelsToUnit, getPreferredUnit, setPreferredUnit } from "../../library/utils/common-functions/unitConversion.js";
import { getSizeOrientation } from "../../library/utils/helpers/orientation.js";
import { compressData, decompressFromBase64 } from "../../library/utils/common-functions/index.js";
import { scaleSourcePagesToTarget } from "../../library/utils/common-functions/scaleDesignPages.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { LuTrash2 } from "react-icons/lu";
import { FaTrash, FaEdit, FaSync, FaSearch, FaPlayCircle, FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";

import CanvasGuideline from "./CanvasGuideline.jsx";
import ConfirmationDialog from "./ConfirmationDialog.jsx";
import { button } from "leva";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

// Styled components for unit converter
const ConverterWrapper = styled.div`
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
`;

const ConverterContainer = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 14px 10px;
  height: 100%;
`;

const ConverterTitle = styled.h6`
  font-weight: 600;
  color: var(--primary, #4084b5);
  margin-bottom: 10px;
  font-size: 13px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 6px;
`;

const ConverterTitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 10px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 6px;

  @media (max-width: 768px) {
    gap: 4px;
  }
`;

const ConverterTitleText = styled.h6`
  font-weight: 600;
  color: var(--primary, #4084b5);
  margin-bottom: 0;
  font-size: 13px;
  white-space: nowrap;
`;

const ConverterTitleDescription = styled.span`
  font-size: 10px;
  color: #6c757d;
  font-weight: 400;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  @media (max-width: 768px) {
    font-size: 9px;
  }
`;

const ConverterRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 100%;

  @media (max-width: 576px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ConverterLabel = styled.label`
  font-size: 9px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const ConverterInput = styled.input`
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--primary, #4084b5);
    box-shadow: 0 0 0 0.2rem rgba(0, 0, 0, 0.25);
  }

  &:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
    color: #495057;
    font-weight: 600;
  }
`;

const ConverterSelect = styled.select`
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--primary, #4084b5);
    box-shadow: 0 0 0 0.2rem rgba(0, 0, 0, 0.25);
  }
`;

const EqualSign = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: var(--primary, #4084b5);
  padding: 4px 2px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 576px) {
    padding: 4px 0;
  }
`;

const PixelInputGroup = styled.div`
  flex: 1;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  @media (max-width: 576px) {
    width: 100%;
  }
`;

const UnitSelectRow = styled.div`
  width: 100%;
  position: relative;
  top: 3px;

  @media (max-width: 576px) {
    max-width: 100%;
  }

  &:hover {
    background-color: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  &:hover .tooltip-bubble {
    opacity: 1;
    transform: translateY(calc(-100% - 4px));
  }
`;

const TooltipWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (max-width: 576px) {
    width: 100%;
  }

  &:hover {
    background-color: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  &:hover .tooltip-bubble {
    opacity: 1;
    transform: translateY(calc(-100% - 4px));
  }
`;

const TooltipBubble = styled.div`
  position: absolute;
  top: -6px;
  right: 0;
  transform: translateY(-110%);
  background: var(--foreground, #212529);
  color: var(--background, #ffffff);
  padding: 8px 10px;
  font-size: 0.75rem;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
  max-width: 260px;
  line-height: 1.3;
  white-space: nowrap;

  &:after {
    content: "";
    position: absolute;
    bottom: -6px;
    right: 14px;
    border-width: 6px 6px 0 6px;
    border-style: solid;
    border-color: var(--foreground, #212529) transparent transparent transparent;
  }
`;

const SizeSettingsBodyWrapper = styled.div`
  max-height: calc(100vh - 130px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0 12px;

  @media (max-width: 768px) {
    max-height: calc(100vh - 110px);
    padding: 4px 0 10px;
  }

  @media (max-width: 576px) {
    max-height: calc(100vh - 96px);
  }
`;

const ConverterDescriptionIcon = styled.span`
  color: var(--primary, #4084b5);
  font-size: 16px;
  flex-shrink: 0;

  @media (max-width: 576px) {
    font-size: 14px;
  }
`;

// New styled components for improved layout
const SectionCard = styled.div`
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
`;

const SectionTitle = styled.h5`
  font-weight: 600;
  color: var(--foreground, #374151);
  margin: 0;
  font-size: 15px;
`;

const SectionBadge = styled.span`
  background: color-mix(in srgb, var(--primary, #4084b5) 15%, transparent);
  color: var(--primary, #4084b5);
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.3px;
`;

// Table-based styled components
const SizesTableWrapper = styled.div`
  max-height: 330px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #e9ecef);
  border-radius: 8px;
  background: var(--background, #fff);
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--background, #f1f1f1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--primary, #4084b5);
    border-radius: 3px;
  }
`;

const SizesTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const TableHeader = styled.th`
  background: #ffffff;
  color: var(--foreground, #374151);
  font-weight: 600;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 2px solid var(--primary, #4084b5);
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CheckboxHeader = styled.th`
  width: 40px;
  text-align: center;
  padding: 10px 0 10px 12px;
  background: #ffffff;
  border-bottom: 2px solid var(--primary, #4084b5);
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableRow = styled.tr`
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.active
    ? 'rgba(0, 0, 0, 0.05)'
    : '#ffffff'};
  position: relative;
  
  ${props => props.active && `
    &::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: var(--primary, #4084b5);
    }
  `}
  
  &:hover {
    background: ${props => props.active
    ? 'rgba(0, 0, 0, 0.1)'
    : '#f8f9fa'};
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color, #e9ecef);
  }
`;

const TableCell = styled.td`
  padding: 12px 12px;
  color: var(--foreground, #374151);
  vertical-align: middle;
  
  &.size-label {
    font-weight: 600;
    color: var(--primary, #4084b5);
  }
  
  &.dimensions {
    font-family: inherit;
    font-size: 13px;
    color: #6b7280;
  }
  
  &.actions {
    text-align: right;
    white-space: nowrap;
  }
`;

const CheckboxCell = styled.td`
  width: 40px;
  text-align: center;
  padding: 12px 0 12px 12px;
  vertical-align: middle;
`;

const ActionButtonsGroup = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
`;

const ActionButton = styled.button`
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;

  svg {
    font-size: 14px;
  }

  &.edit {
    background: white;
    border-color: #e5e7eb;
    color: #374151;
    
    &:hover {
      border-color: var(--primary, #4084b5);
      color: var(--primary, #4084b5);
      background: rgba(0, 0, 0, 0.05);
    }
  }

  &.convert {
    background: var(--primary, #4084b5);
    color: white;
    
    &:hover {
      background: color-mix(in srgb, var(--primary, #4084b5) 90%, #000);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  }

  &.delete {
    width: 32px;
    padding: 0;
    background: white;
    border-color: #f2f2f2;
    color: #111111;
    
    &:hover {
      background: #111111;
      border-color: #111111;
      color: white;
    }
  }
`;

// Convert Modal styled components
const ConvertModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(17, 24, 39, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1060;
`;

const ConvertModalContent = styled.div`
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  width: 92%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid #f3f4f6;
`;

const ConvertModalTitle = styled.h5`
  color: #1f2937;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  
  svg {
    color: var(--primary, #4084b5);
  }
`;

const ConvertModalInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  margin-bottom: 8px;
  transition: all 0.2s ease-in-out;
  color: #1f2937;

  &:hover {
    border-color: color-mix(in srgb, var(--primary, #4084b5) 60%, #e5e7eb);
  }

  &:focus {
    outline: none;
    border-color: var(--primary, #4084b5);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary, #4084b5) 12%, transparent);
  }
`;

const ConvertModalLabel = styled.label`
  display: block;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 6px;
  font-size: 12.5px;
`;

const ConvertModalButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
`;

const ConvertModalButton = styled.button`
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  
  &.primary {
    background: linear-gradient(135deg, var(--primary, #4084b5) 0%, color-mix(in srgb, var(--primary, #4084b5) 90%, #000) 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    
    &:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-1px);
    }
  }
  
  &.secondary {
    background: #ffffff;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    
    &:hover {
      background: #f9fafb;
      border-color: #d1d5db;
    }
  }
`;

const ProductSizesContainer = styled.div`
  max-height: 168px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #f9fafb;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--primary, #4084b5);
    border-radius: 3px;
  }
`;

// Alert banner for duplicate size
const AlertBanner = styled.div`
  background: ${props => props.type === 'error'
    ? 'color-mix(in srgb, #111111 10%, var(--background, #fff))'
    : props.type === 'success'
      ? 'color-mix(in srgb, #333333 10%, var(--background, #fff))'
      : 'color-mix(in srgb, #111111 10%, var(--background, #fff))'};
  border: 1px solid ${props => props.type === 'error' ? '#111111' : props.type === 'success' ? '#333333' : '#111111'};
  color: ${props => props.type === 'error' ? '#111111' : props.type === 'success' ? '#333333' : '#333333'};
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  animation: slideIn 0.3s ease;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const DpiNote = styled.span`
  font-size: 11px;
  color: var(--foreground, #6b7280);
  font-weight: 400;
  margin-left: 4px;
`;

// How-to tutorial videos shown at the top of the Manage Size popup.
// Add an entry per video — paste the (unlisted/private) YouTube link as `url`.
// Entries without a `url` are ignored; the section hides when none have a url.
const HOW_TO_VIDEOS = [
  { title: "How to convert one size into multiple sizes", url: "https://youtu.be/Iv3c9hKOg1g", duration: "" },
  // { title: "How full cover & spread works", url: "", duration: "" },
  // { title: "Setting up custom print sizes", url: "", duration: "" },
];

// Tutorials pill button styling
const TutorialsPillButton = styled.button`
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: #ffffff !important;
  border: 1px solid color-mix(in srgb, var(--primary, #4084b5) 25%, #e5e7eb) !important;
  color: var(--primary, #4084b5) !important;
  border-radius: 20px !important;
  padding: 6px 14px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s ease-in-out !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04) !important;
  outline: none !important;

  &:hover {
    border-color: var(--primary, #4084b5) !important;
    background-color: color-mix(in srgb, var(--primary, #4084b5) 6%, #ffffff) !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15) !important;
    transform: translateY(-1px) !important;
    color: color-mix(in srgb, var(--primary, #4084b5) 85%, #000) !important;
  }

  &:focus, &:active {
    outline: none !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #4084b5) 25%, transparent) !important;
  }

  /* When dropdown is open (React Bootstrap sets aria-expanded="true" or adds .show class) */
  &[aria-expanded="true"], &.show {
    background: linear-gradient(135deg, var(--primary, #4084b5) 0%, color-mix(in srgb, var(--primary, #4084b5) 90%, #000) 100%) !important;
    border-color: var(--primary, #4084b5) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;

    svg {
      color: #ffffff !important;
    }

    .ts-chevron {
      transform: rotate(180deg) !important;
    }
  }

  .ts-chevron {
    margin-left: 2px;
    transition: transform 0.2s ease;
    display: flex;
  }

  svg {
    flex-shrink: 0;
  }

  &::after {
    display: none !important;
  }
`;

// Dropdown menu styling for tutorials
const StyledDropdownMenu = styled(Dropdown.Menu)`
  max-height: 320px;
  overflow-y: auto;
  width: 320px;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  z-index: 1100;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--primary, #4084b5);
    border-radius: 3px;
  }
`;

// Dropdown item styling for tutorials
const StyledDropdownItem = styled(Dropdown.Item)`
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 14px !important;
  border-radius: 6px !important;
  font-size: 13px !important;
  color: #374151 !important;
  transition: all 0.15s ease !important;
  white-space: normal !important;
  background: transparent !important;

  &:hover, &:focus, &:active, &.active {
    background-color: color-mix(in srgb, var(--primary, #4084b5) 8%, #ffffff) !important;
    color: var(--primary, #4084b5) !important;
    outline: none !important;

    .tv-icon {
      color: var(--primary, #4084b5) !important;
    }

    .tv-subtext {
      color: color-mix(in srgb, var(--primary, #4084b5) 70%, #9ca3af) !important;
    }
  }

  .tv-icon {
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .tv-subtext {
    font-size: 10.5px;
    color: #9ca3af;
    margin-top: 2px;
    transition: color 0.15s ease;
  }
`;

// Recommended sizes dropdown styled component
const RecommendedSizeDropdown = styled.select`
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 13.5px;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: color-mix(in srgb, var(--primary, #4084b5) 60%, #e5e7eb);
  }

  &:focus {
    border-color: var(--primary, #4084b5);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary, #4084b5) 12%, transparent);
    outline: none;
  }
`;

// Custom premium form elements for Page/Canvas size section
const CustomFormGroup = styled(Form.Group)`
  margin-bottom: 12px;
`;

const CustomFormLabel = styled(Form.Label)`
  font-weight: 600 !important;
  font-size: 12.5px !important;
  color: #4b5563 !important;
  margin-bottom: 8px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
`;

const CustomFormControl = styled(Form.Control)`
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
  padding: 10px 14px !important;
  font-size: 13.5px !important;
  font-weight: 500 !important;
  transition: all 0.2s ease-in-out !important;
  background-color: #ffffff !important;
  color: #1f2937 !important;
  box-shadow: none !important;

  &:hover {
    border-color: color-mix(in srgb, var(--primary, #4084b5) 60%, #e5e7eb) !important;
  }

  &:focus {
    border-color: var(--primary, #4084b5) !important;
    background-color: #ffffff !important;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary, #4084b5) 12%, transparent) !important;
    outline: none !important;
  }
`;

const CustomFormSelect = styled(Form.Select)`
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
  padding: 10px 14px !important;
  font-size: 13.5px !important;
  font-weight: 500 !important;
  transition: all 0.2s ease-in-out !important;
  background-color: #ffffff !important;
  color: #1f2937 !important;
  cursor: pointer !important;
  box-shadow: none !important;

  &:hover {
    border-color: color-mix(in srgb, var(--primary, #4084b5) 60%, #e5e7eb) !important;
  }

  &:focus {
    border-color: var(--primary, #4084b5) !important;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary, #4084b5) 12%, transparent) !important;
    outline: none !important;
  }
`;

// Additional professional styling components
const CustomModalHeader = styled(PhotoModalHeader)`
  background: #ffffff !important;
  border-bottom: 1px solid #f3f4f6 !important;
  padding: 16px 24px !important;
  height: auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  
  .mob_heading_flex {
    justify-content: start !important;
  }
`;

const ModalTitle = styled.h4`
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    background-color: #f3f4f6;
    color: #4b5563;
  }
`;

const AddSizeButton = styled(PrimaryButton)`
  background: linear-gradient(135deg, var(--primary, #4084b5) 0%, color-mix(in srgb, var(--primary, #4084b5) 90%, #000) 100%) !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 12px 24px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease-in-out !important;

  &:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3) !important;
    transform: translateY(-1px) !important;
  }
`;


export const recommendedSizes = [
  { label: "4x6(P) ", width: 800, height: 1200 },
  { label: "5x7(P) ", width: 1000, height: 1400 },
  { label: "6x8(P)", width: 1200, height: 1600 },
  { label: "8x8(S)", width: 1600, height: 1600 },
  { label: "8x10(P)", width: 1600, height: 2000 },
  { label: "8x12(P)", width: 1600, height: 2400 },
  { label: "10x12(P)", width: 2000, height: 2400 },
  { label: "10x14(P)", width: 2000, height: 2800 },
  { label: "12x12(S)", width: 2400, height: 2400 },
  { label: "12x15(P)", width: 2400, height: 3000 },
  { label: "12x16(P)", width: 2400, height: 3200 },
  { label: "12x18(P)", width: 2400, height: 3600 },
  { label: "16x20(P)", width: 3200, height: 4000 },
  { label: "20x24(P)", width: 4000, height: 4800 },
  { label: "20x30(P)", width: 4000, height: 6000 },
  { label: "8x6(L)", width: 1600, height: 1200 },
  { label: "10x8(L)", width: 2000, height: 1600 },
  { label: "12x8(L)", width: 2400, height: 1600 },
  { label: "12x10(L)", width: 2400, height: 2000 },
  { label: "14x10(L)", width: 2800, height: 2000 },
  { label: "15x12(L)", width: 3000, height: 2400 },
  { label: "16x12(L)", width: 3200, height: 2400 },
  { label: "18x12(L)", width: 3600, height: 2400 },
  { label: "20x16(L)", width: 4000, height: 3200 },
  { label: "24x20(L)", width: 4800, height: 4000 },
  { label: "30x20(L)", width: 6000, height: 4000 },
];

// scaleSourcePagesToTarget lives in common-functions/scaleDesignPages.js so the
// Manage-Size convert flow and the "apply saved design as layout" flow scale
// text/images identically.

// --- Photobook full-cover merge/split (mirrors the canvas.js setSettings reducer) ---
// These run over a DECODED pages array (front cover = pages[0], back = pages[last],
// both single half-sheet layouts) so every saved size can carry the same joined
// front+back spread the active size already gets from the reducer.
const _shiftLayoutObjects = (layout, dx) => {
  if (!layout) return;
  [layout.objects, layout.safeAreaObjects].forEach((objects) => {
    if (!Array.isArray(objects)) return;
    objects.forEach((obj) => {
      if (obj?.transform) obj.transform.x += dx;
    });
  });
};
const _emptyLayout = () => ({
  id: `layout_${uuidv4()}`,
  background: { color: null, image: null, flip: false },
  objects: [],
  safeAreaObjects: [],
});

// ON: merge front (pages[0]) + back (pages[last]) into a single spread on the
// front page — layout[0] = back (left), layout[1] = front (right, shifted +half).
// Idempotent: skips when already merged (cover already has 2 layouts).
const mergePhotobookCover = (pages, fullWidth) => {
  if (!Array.isArray(pages) || pages.length < 2) return pages;
  if ((pages[0]?.layout?.length || 0) >= 2) return pages; // already merged
  const halfWidth = fullWidth / 2;
  const front = pages[0];
  const back = pages[pages.length - 1];
  const backLayout = back.layout?.[0]
    ? JSON.parse(JSON.stringify(back.layout[0]))
    : _emptyLayout();
  const frontLayout = front.layout?.[0]
    ? JSON.parse(JSON.stringify(front.layout[0]))
    : _emptyLayout();
  _shiftLayoutObjects(frontLayout, halfWidth);
  front.layout = [backLayout, frontLayout];
  back.layout = [_emptyLayout()];
  return pages;
};

// OFF: split the merged spread back into separate front + back half-sheets.
// Idempotent: skips when not merged.
const splitPhotobookCover = (pages, fullWidth) => {
  if (!Array.isArray(pages) || pages.length < 2) return pages;
  if ((pages[0]?.layout?.length || 0) < 2) return pages; // not merged
  const halfWidth = fullWidth / 2;
  const cover = pages[0];
  const back = pages[pages.length - 1];
  const mergedBack = cover.layout[0]
    ? JSON.parse(JSON.stringify(cover.layout[0]))
    : _emptyLayout();
  const mergedFront = cover.layout[1]
    ? JSON.parse(JSON.stringify(cover.layout[1]))
    : _emptyLayout();
  _shiftLayoutObjects(mergedFront, -halfWidth);
  cover.layout = [mergedFront];
  back.layout = [mergedBack];
  return pages;
};

// --- Layflat full-cover merge/split (mirrors the canvas.js setSettings reducer) ---
// Layflat cover reconstruction differs from photobook: it uses a SEPARATE cover
// PAGE (`isCoverPage`). Cover-off keeps TWO half-sheet cover pages — "Front
// Cover" at index 0 and "Back Cover" at the end (`settings.isHalfSheet: true`).
// Cover-on (full) replaces them with ONE full-spread cover page (no
// `isHalfSheet`): layout[0] = back content (left half), layout[1] = front
// content (right half, shifted +halfWidth). These helpers replicate
// canvas.js:732-848 over a decoded pages array so every saved size carries the
// same cover shape as the active one. Idempotent + skip gracefully (never
// fabricate a cover for a size that lacked one).
const mergeLayflatCover = (pages, fullWidth) => {
  if (!Array.isArray(pages) || pages.length < 1) return pages;
  const front = pages.find(
    (p) => p.isCoverPage === true && p.settings?.isHalfSheet === true && p.title !== "Back Cover"
  );
  const back = pages.find(
    (p) => p.isCoverPage === true && p.settings?.isHalfSheet === true && p.title === "Back Cover"
  );
  const full = pages.find(
    (p) => p.isCoverPage === true && !p.settings?.isHalfSheet
  );
  if (full && !front && !back) return pages; // already merged
  if (!front && !back && !full) return pages; // no cover pages — skip gracefully
  const halfWidth = fullWidth / 2;
  let mergedLayout0 = null;
  let mergedLayout1 = null;
  if (full) {
    mergedLayout0 = full.layout?.[0] || null;
    mergedLayout1 = full.layout?.[1] || null;
  } else {
    if (back?.layout?.[0]) {
      mergedLayout0 = JSON.parse(JSON.stringify(back.layout[0]));
    }
    if (front?.layout?.[0]) {
      const frontCopy = JSON.parse(JSON.stringify(front.layout[0]));
      _shiftLayoutObjects(frontCopy, halfWidth);
      mergedLayout1 = frontCopy;
    }
  }
  const rest = pages.filter((p) => p.isCoverPage !== true);
  rest.unshift({
    id: `pages_${uuidv4()}`,
    pageNumber: 1,
    title: "Front Cover",
    bgColor: "#fff",
    isCoverPage: true,
    layout: [mergedLayout0 || _emptyLayout(), mergedLayout1 || _emptyLayout()],
  });
  return rest;
};

const splitLayflatCover = (pages, fullWidth) => {
  if (!Array.isArray(pages) || pages.length < 1) return pages;
  const full = pages.find(
    (p) => p.isCoverPage === true && !p.settings?.isHalfSheet
  );
  if (!full) return pages; // already half-sheets (or no cover) — skip gracefully
  const halfWidth = fullWidth / 2;
  let frontLayout = null;
  let backLayout = null;
  if (full.layout?.[1]) {
    frontLayout = JSON.parse(JSON.stringify(full.layout[1]));
    _shiftLayoutObjects(frontLayout, -halfWidth);
  }
  if (full.layout?.[0]) {
    backLayout = JSON.parse(JSON.stringify(full.layout[0]));
  }
  const rest = pages.filter((p) => p.isCoverPage !== true);
  rest.unshift({
    id: `pages_${uuidv4()}`,
    pageNumber: 1,
    title: "Front Cover",
    bgColor: "#fff",
    isCoverPage: true,
    layout: frontLayout ? [frontLayout] : [],
    settings: { isHalfSheet: true },
  });
  rest.push({
    id: `pages_${uuidv4()}`,
    pageNumber: rest.length,
    title: "Back Cover",
    bgColor: "#fff",
    isCoverPage: true,
    layout: backLayout ? [backLayout] : [],
    settings: { isHalfSheet: true },
  });
  return rest;
};

// Unique row key for a saved size — size string alone collides when two sizes
// share pixel dimensions but differ in DPI, so include DPI.
const themeKey = (theme) => `${theme?.size}@${parseInt(theme?.dpi || 200, 10)}`;

export const SizeSettingsPopup = ({ handleClose, saveTheme }) => {
  const dispatch = useDispatch();
  // Unit converter state
  const [converterValue, setConverterValue] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState("millimetre");
  const [convertedPx, setConvertedPx] = useState(0);
  const [isGuidelineVisible, setIsGuidelineVisible] = useState(false);
  const [displaySize, setDisplaySize] = useState({
    width: 0,
    height: 0,
    depth: 0,
    safeMargin: 0,
    bleedMargin: 0,
    dpi: 200,
  }); // depth used in canvas size

  // Convert modal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertSourceTheme, setConvertSourceTheme] = useState(null);
  const [convertTargetWidth, setConvertTargetWidth] = useState("");
  const [convertTargetHeight, setConvertTargetHeight] = useState("");
  const [selectedRecommendedSize, setSelectedRecommendedSize] = useState("");

  // Unit selector state for Page/Canvas Size section (seeded from the shared preference)
  const [sizeUnit, setSizeUnit] = useState(getPreferredUnit());
  // Raw string state for non-px inputs — lets user type decimals freely; committed to displaySize on blur
  const [localUnitValues, setLocalUnitValues] = useState({
    width: '',
    height: '',
    safeMargin: '',
    bleedMargin: '',
    paperThickness: '',
  });

  // Unit selector state for Convert Size modal (seeded from the shared preference)
  const [convertUnit, setConvertUnit] = useState(getPreferredUnit());
  const [convertTargetShape, setConvertTargetShape] = useState('rectangle');
  const [convertDpi, setConvertDpi] = useState(200);
  const [convertBleedMargin, setConvertBleedMargin] = useState("");
  const [convertSafeMargin, setConvertSafeMargin] = useState("");
  // Multi-size convert: list of manual target rows (raw strings in the selected unit)
  const [multiTargets, setMultiTargets] = useState([{ width: "", height: "" }]);
  // Product sizes fetched from the API for the convert picker
  const [productSizes, setProductSizes] = useState([]);
  const [loadingProductSizes, setLoadingProductSizes] = useState(false);
  const [selectedProductSizeIds, setSelectedProductSizeIds] = useState([]);
  const [productSizeSearch, setProductSizeSearch] = useState("");

  // Alert state
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState("warning");

  // Recommended size filter state
  const [sizeFilter, setSizeFilter] = useState("all"); // "all", "portrait", "landscape", "square"

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sizeToDelete, setSizeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk actions state
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [showMultiDeleteDialog, setShowMultiDeleteDialog] = useState(false);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [showMultiConvertDialog, setShowMultiConvertDialog] = useState(false);

  // Full Cover & Spine state (Photobook and Layflat)
  const [fullCoverEnabled, setFullCoverEnabled] = useState(false);
  const [paperThickness, setPaperThickness] = useState(0);

  // Durable, cross-session custom sizes stored in AppData (the same store the
  // theme-setup "Choose a size" modal writes to). `allThemes` is ephemeral Redux
  // state reset from the server on reload, so any size the user adds here is also
  // mirrored into AppData and surfaced under Saved Sizes to survive reopen.
  const [appDataCustomSizes, setAppDataCustomSizes] = useState(() => getCustomSizes());

  const canvasSize = useSelector(getCanvasSize);
  const pages = useSelector(getAllPages);
  const activeEditorType = useSelector(getActiveEditorType);
  const settings = useSelector(getSettings);
  // When the theme was opened with blank images (Design Selection size modal),
  // every size change must KEEP images blank rather than re-loading the originals
  // from the theme's pages_c. `maybeBlank` applies the blanking only in that mode.
  const themeImagesBlanked = useSelector((state) => state.appSlice.themeImagesBlanked);
  const billablePages = useSelector(getBillablePages);
  const allThemes = useSelector((state) => state.projectSetup.allThemes);
  const themeId = useSelector(
    (state) => state.projectSetup.cartDetails.theme_id
  );
  const brandId = useSelector(
    (state) => state.projectSetup.brand_id
  );

  const portraitThemes = allThemes.filter(
    (theme) => parseFloat(theme.width) < parseFloat(theme.height)
  );
  const squareThemes = allThemes.filter(
    (theme) => parseFloat(theme.width) === parseFloat(theme.height)
  );
  const landscapeThemes = allThemes.filter(
    (theme) => parseFloat(theme.width) > parseFloat(theme.height)
  );

  // Keep the AppData custom-size list in sync. On desktop it loads asynchronously,
  // so the useState initialiser above may run before the read resolves — await
  // initCustomSizes() and subscribe so a late load (or an add/remove from the
  // theme-setup modal) refreshes this already-mounted popup. Mirrors the pattern
  // used by ThemeSizeModal.
  useEffect(() => {
    let alive = true;
    initCustomSizes().then((list) => {
      if (alive && Array.isArray(list)) setAppDataCustomSizes(list);
    });
    const unsubscribe = subscribeCustomSizes((list) => {
      if (alive && Array.isArray(list)) setAppDataCustomSizes(list);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Custom sizes not already represented by a theme variant (deduped by
  // size@dpi), rendered as extra rows under Saved Sizes so the section stays in
  // sync with the durable AppData store.
  const themeKeys = new Set(allThemes.map(themeKey));
  const extraCustomSizes = appDataCustomSizes.filter((cs) => {
    const key = `${Math.round(Number(cs.width))}x${Math.round(Number(cs.height))}@${parseInt(cs.dpi || 200, 10)}`;
    return !themeKeys.has(key);
  });

  const conversionFactors = {
    millimetre: displaySize.dpi / 25.4,
    centimetre: displaySize.dpi / 2.54,
    metre: displaySize.dpi * 39.3701,
    kilometre: displaySize.dpi * 39370.1,

    micrometre: displaySize.dpi / 25400,
    nanometre: displaySize.dpi / 25400000,

    inch: displaySize.dpi,
    foot: displaySize.dpi * 12,
    yard: displaySize.dpi * 36,
    mile: displaySize.dpi * 63360,

    "nautical mile": displaySize.dpi * 72913.3858,
  };

  const unitOptions = [
    { value: "millimetre", label: "Millimetre" },
    { value: "kilometre", label: "Kilometre" },
    { value: "metre", label: "Metre" },
    { value: "centimetre", label: "Centimetre" },
    { value: "micrometre", label: "Micrometre" },
    { value: "nanometre", label: "Nanometre" },
    { value: "mile", label: "Mile" },
    { value: "yard", label: "Yard" },
    { value: "foot", label: "Foot" },
    { value: "inch", label: "Inch" },
    { value: "nautical mile", label: "Nautical Mile" },
  ];

  useEffect(() => {
    if (
      !converterValue ||
      isNaN(converterValue) ||
      !displaySize.dpi ||
      isNaN(displaySize.dpi)
    ) {
      setConvertedPx(0);
      return;
    }

    const factor = conversionFactors[selectedUnit];
    setConvertedPx(Number(converterValue) * factor);
  }, [converterValue, selectedUnit, displaySize.dpi]);

  useEffect(() => {
    setDisplaySize({
      width: canvasSize.width,
      height: canvasSize.height,
      depth: canvasSize.depth,
      safeMargin: canvasSize.safeMargin || 0,
      bleedMargin: canvasSize.bleedMargin || 0,
      dpi: canvasSize.dpi || 200,
      shape: canvasSize.shape || settings?.shape || "rectangle",
    });
    // Initialize spine settings from current settings
    setFullCoverEnabled(settings?.showFullCoverSheet || false);
    setPaperThickness(settings?.paperThickness || 0);
    // Sync local unit values when canvas size is loaded externally
    const dpi = canvasSize.dpi || 200;
    setLocalUnitValues({
      width: String(sizeUnit === 'px' ? canvasSize.width : (convertPixelsToUnit(canvasSize.width, sizeUnit, dpi) || 0)),
      height: String(sizeUnit === 'px' ? canvasSize.height : (convertPixelsToUnit(canvasSize.height, sizeUnit, dpi) || 0)),
      safeMargin: String(sizeUnit === 'px' ? (canvasSize.safeMargin || 0) : (convertPixelsToUnit(canvasSize.safeMargin || 0, sizeUnit, dpi) || 0)),
      bleedMargin: String(sizeUnit === 'px' ? (canvasSize.bleedMargin || 0) : (convertPixelsToUnit(canvasSize.bleedMargin || 0, sizeUnit, dpi) || 0)),
      paperThickness: String(sizeUnit === 'px' ? (settings?.paperThickness || 0) : (convertPixelsToUnit(settings?.paperThickness || 0, sizeUnit, dpi) || 0)),
    });
  }, [canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync spine UI state whenever Redux settings change (e.g. after applySpineSettings dispatch)
  useEffect(() => {
    setFullCoverEnabled(settings?.showFullCoverSheet || false);
    const thickness = settings?.paperThickness || 0;
    setPaperThickness(thickness);
    const dpi = displaySize.dpi || 200;
    setLocalUnitValues((prev) => ({
      ...prev,
      paperThickness: String(sizeUnit === 'px' ? thickness : (convertPixelsToUnit(thickness, sizeUnit, dpi) || 0)),
    }));
  }, [settings?.showFullCoverSheet, settings?.paperThickness]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local unit values when unit selector changes (skip on initial mount — canvasSize/settings effects handle that)
  const sizeUnitInitRef = useRef(false);
  useEffect(() => {
    if (!sizeUnitInitRef.current) { sizeUnitInitRef.current = true; return; }
    const dpi = displaySize.dpi || 200;
    setLocalUnitValues({
      width: String(sizeUnit === 'px' ? displaySize.width : (convertPixelsToUnit(displaySize.width, sizeUnit, dpi) || 0)),
      height: String(sizeUnit === 'px' ? displaySize.height : (convertPixelsToUnit(displaySize.height, sizeUnit, dpi) || 0)),
      safeMargin: String(sizeUnit === 'px' ? (displaySize.safeMargin || 0) : (convertPixelsToUnit(displaySize.safeMargin || 0, sizeUnit, dpi) || 0)),
      bleedMargin: String(sizeUnit === 'px' ? (displaySize.bleedMargin || 0) : (convertPixelsToUnit(displaySize.bleedMargin || 0, sizeUnit, dpi) || 0)),
      paperThickness: String(sizeUnit === 'px' ? (paperThickness || 0) : (convertPixelsToUnit(paperThickness || 0, sizeUnit, dpi) || 0)),
    });
  }, [sizeUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sizeUnit === 'px') return;
    const dpi = displaySize.dpi || 200;
    setLocalUnitValues((prev) => ({
      ...prev,
      paperThickness: String(convertPixelsToUnit(paperThickness || 0, sizeUnit, dpi) || 0),
    }));
  }, [paperThickness, sizeUnit, displaySize.dpi]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setDisplaySize({
      ...displaySize,
      [id]: value,
    });
    // Don't reset recommended size if just changing shape
    if (id !== "shape") {
      setSelectedRecommendedSize("");
    }
  };

  // Derived size display values in the selected unit
  const sizeActiveDpi = displaySize.dpi || 200;
  const displayWidthInUnit = sizeUnit === 'px' ? displaySize.width : convertPixelsToUnit(displaySize.width, sizeUnit, sizeActiveDpi);
  const displayHeightInUnit = sizeUnit === 'px' ? displaySize.height : convertPixelsToUnit(displaySize.height, sizeUnit, sizeActiveDpi);
  const displaySafeMarginInUnit = sizeUnit === 'px' ? displaySize.safeMargin : convertPixelsToUnit(displaySize.safeMargin, sizeUnit, sizeActiveDpi);
  const displayBleedMarginInUnit = sizeUnit === 'px' ? displaySize.bleedMargin : convertPixelsToUnit(displaySize.bleedMargin, sizeUnit, sizeActiveDpi);
  const calculatedSpineWidthPx = Math.round(Math.ceil((billablePages || 0) / 2) * paperThickness);
  const displaySpineWidthInUnit = sizeUnit === 'px' ? calculatedSpineWidthPx : convertPixelsToUnit(calculatedSpineWidthPx, sizeUnit, sizeActiveDpi);
  const sizeUnitShort = PRINT_UNITS.find((unit) => unit.value === sizeUnit)?.short || sizeUnit;

  const handleUnitSizeChange = (field, rawValue) => {
    // Only update the local raw string; px conversion happens on blur
    setLocalUnitValues((prev) => ({ ...prev, [field]: rawValue }));
    setSelectedRecommendedSize("");
  };

  const handleUnitSizeBlur = (field) => {
    const rawValue = localUnitValues[field];
    const pxValue = convertToPixels(rawValue, sizeUnit, sizeActiveDpi);
    const isMargin = field === 'safeMargin' || field === 'bleedMargin';
    const isThickness = field === 'paperThickness';
    if (!isNaN(pxValue) && ((isMargin || isThickness) ? pxValue >= 0 : pxValue > 0)) {
      if (isThickness) {
        setPaperThickness(pxValue);
      } else {
        setDisplaySize((prev) => ({ ...prev, [field]: pxValue }));
      }
      // Normalize display to the rounded converted value with 2 decimal precision
      const unitValue = convertPixelsToUnit(pxValue, sizeUnit, sizeActiveDpi);
      setLocalUnitValues((prev) => ({
        ...prev,
        [field]: sizeUnit === 'px' ? String(Math.round(unitValue)) : Number(unitValue).toFixed(2)
      }));
    } else {
      // Revert to last valid stored value
      const current = isThickness ? (paperThickness || 0) : (displaySize[field] || 0);
      const unitValue = convertPixelsToUnit(current, sizeUnit, sizeActiveDpi);
      setLocalUnitValues((prev) => ({
        ...prev,
        [field]: sizeUnit === 'px' ? String(Math.round(unitValue)) : Number(unitValue).toFixed(2)
      }));
    }
  };

  // Tracks last-entered physical (non-px) width/height/margins in convert modal so DPI changes can re-derive px
  const convertPhysical = useRef({ width: null, height: null, bleedMargin: null, safeMargin: null });

  // Derived pixel values for Convert Size modal
  const convertActiveDpi = parseInt(convertDpi, 10) || 200;
  const convertTargetWidthPx = convertUnit === 'px'
    ? parseInt(convertTargetWidth, 10) || 0
    : convertToPixels(convertTargetWidth, convertUnit, convertActiveDpi);
  const convertTargetHeightPx = convertUnit === 'px'
    ? parseInt(convertTargetHeight, 10) || 0
    : convertToPixels(convertTargetHeight, convertUnit, convertActiveDpi);
  // Margins are unit-aware — convert from selected unit to px
  const convertBleedMarginPx = convertUnit === 'px'
    ? parseInt(convertBleedMargin, 10) || 0
    : convertToPixels(convertBleedMargin, convertUnit, convertActiveDpi);
  const convertSafeMarginPx = convertUnit === 'px'
    ? parseInt(convertSafeMargin, 10) || 0
    : convertToPixels(convertSafeMargin, convertUnit, convertActiveDpi);

  // Re-derive width/height/margins from stored physical values when DPI changes (non-px unit only)
  useEffect(() => {
    if (convertUnit === 'px') return;
    const pw = convertPhysical.current.width;
    const ph = convertPhysical.current.height;
    const pbm = convertPhysical.current.bleedMargin;
    const psm = convertPhysical.current.safeMargin;
    if (pw !== null) {
      const newPx = convertToPixels(pw, convertUnit, convertActiveDpi);
      setConvertTargetWidth(convertPixelsToUnit(newPx, convertUnit, convertActiveDpi).toString());
    }
    if (ph !== null) {
      const newPx = convertToPixels(ph, convertUnit, convertActiveDpi);
      setConvertTargetHeight(convertPixelsToUnit(newPx, convertUnit, convertActiveDpi).toString());
    }
    if (pbm !== null) {
      const newPx = convertToPixels(pbm, convertUnit, convertActiveDpi);
      setConvertBleedMargin(convertPixelsToUnit(newPx, convertUnit, convertActiveDpi).toString());
    }
    if (psm !== null) {
      const newPx = convertToPixels(psm, convertUnit, convertActiveDpi);
      setConvertSafeMargin(convertPixelsToUnit(newPx, convertUnit, convertActiveDpi).toString());
    }
  }, [convertActiveDpi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Change unit while preserving the current pixel values — convert to new unit
  const handleConvertUnitChange = (newUnit) => {
    if (newUnit === convertUnit) return;
    setPreferredUnit(newUnit); // share the choice with every other dialog
    const currentWidthPx = convertTargetWidthPx;
    const currentHeightPx = convertTargetHeightPx;
    const currentBleedPx = convertBleedMarginPx;
    const currentSafePx = convertSafeMarginPx;
    setConvertUnit(newUnit);
    if (newUnit === 'px') {
      setConvertTargetWidth(currentWidthPx > 0 ? String(currentWidthPx) : '');
      setConvertTargetHeight(currentHeightPx > 0 ? String(currentHeightPx) : '');
      setConvertBleedMargin(currentBleedPx > 0 ? String(currentBleedPx) : '');
      setConvertSafeMargin(currentSafePx > 0 ? String(currentSafePx) : '');
      convertPhysical.current = { width: null, height: null, bleedMargin: null, safeMargin: null };
    } else {
      const wInUnit = currentWidthPx > 0 ? convertPixelsToUnit(currentWidthPx, newUnit, convertActiveDpi) : '';
      const hInUnit = currentHeightPx > 0 ? convertPixelsToUnit(currentHeightPx, newUnit, convertActiveDpi) : '';
      const bmInUnit = currentBleedPx > 0 ? convertPixelsToUnit(currentBleedPx, newUnit, convertActiveDpi) : '';
      const smInUnit = currentSafePx > 0 ? convertPixelsToUnit(currentSafePx, newUnit, convertActiveDpi) : '';
      setConvertTargetWidth(wInUnit !== '' ? String(wInUnit) : '');
      setConvertTargetHeight(hInUnit !== '' ? String(hInUnit) : '');
      setConvertBleedMargin(bmInUnit !== '' ? String(bmInUnit) : '');
      setConvertSafeMargin(smInUnit !== '' ? String(smInUnit) : '');
      convertPhysical.current = {
        width: wInUnit !== '' ? wInUnit : null,
        height: hInUnit !== '' ? hInUnit : null,
        bleedMargin: bmInUnit !== '' ? bmInUnit : null,
        safeMargin: smInUnit !== '' ? smInUnit : null,
      };
    }
    // Re-express the manual target rows in the new unit (convertUnit here is still the OLD unit)
    setMultiTargets((prev) => prev.map((row) => {
      const wPx = convertUnit === 'px' ? (parseInt(row.width, 10) || 0) : convertToPixels(row.width, convertUnit, convertActiveDpi);
      const hPx = convertUnit === 'px' ? (parseInt(row.height, 10) || 0) : convertToPixels(row.height, convertUnit, convertActiveDpi);
      if (newUnit === 'px') {
        return { width: wPx > 0 ? String(wPx) : '', height: hPx > 0 ? String(hPx) : '' };
      }
      return {
        width: wPx > 0 ? String(convertPixelsToUnit(wPx, newUnit, convertActiveDpi)) : '',
        height: hPx > 0 ? String(convertPixelsToUnit(hPx, newUnit, convertActiveDpi)) : '',
      };
    }));
  };

  // Manual target-row handlers for multi-size convert
  const updateTargetRow = (idx, field, val) =>
    setMultiTargets((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  const addTargetRow = () =>
    setMultiTargets((prev) => [...prev, { width: "", height: "" }]);
  const removeTargetRow = (idx) =>
    setMultiTargets((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  // Width/Height/Margin change handlers that also store physical values for DPI re-derive
  const handleConvertBleedMarginChange = (val) => {
    setConvertBleedMargin(val);
    if (convertUnit !== 'px') convertPhysical.current.bleedMargin = val;
  };
  const handleConvertSafeMarginChange = (val) => {
    setConvertSafeMargin(val);
    if (convertUnit !== 'px') convertPhysical.current.safeMargin = val;
  };

  const updateAndSaveTheme = () => {
    addSize();

    setTimeout(() => {
      saveTheme();
    }, 1200);
  };

  // Helper to show alert messages
  const showAlert = (message, type = "warning") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Book products render as a double-width spread, so a single-page product
  // size must be doubled in width to become the target spread size.
  const isBookEditor =
    activeEditorType === EDITOR_TYPES.PHOTOBOOK ||
    activeEditorType === EDITOR_TYPES.LAYFLATALBUM;

  // Fetch brand product sizes for the convert picker
  const fetchProductSizes = async () => {
    setLoadingProductSizes(true);
    try {
      const payload = {
        brand_id: brandId,
      };
      const response = await apiPost(ENDPOINTS.getProductSizes, payload);
      if (response?.status === 1 && Array.isArray(response.items)) {
        // Only sizes with usable numeric dimensions are convertible
        const usable = response.items.filter(
          (s) => parseFloat(s.width) > 0 && parseFloat(s.height) > 0
        );
        setProductSizes(usable);
      } else {
        setProductSizes([]);
      }
    } catch (err) {
      setProductSizes([]);
    } finally {
      setLoadingProductSizes(false);
    }
  };

  // Load product sizes the first time the convert modal opens
  useEffect(() => {
    if (showConvertModal && productSizes.length === 0 && !loadingProductSizes) {
      fetchProductSizes();
    }
  }, [showConvertModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProductSize = (id) => {
    setSelectedProductSizeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Resolve a product-size record to its target spread dimensions in px
  const productSizeToTargetPx = (size) => ({
    widthPx: Math.round(parseFloat(size.width) * (isBookEditor ? 2 : 1)),
    heightPx: Math.round(parseFloat(size.height)),
  });

  // Format a px value in the unit currently chosen in the Convert modal
  const convertUnitShort = convertUnit === 'px' ? 'px' : convertUnit;
  const fmtInConvertUnit = (px) =>
    convertUnit === 'px' ? Math.round(px) : convertPixelsToUnit(px, convertUnit, convertActiveDpi);

  // Product sizes filtered by the search box (name / dimensions / orientation).
  // Normalize away spaces and unify ×/x so "12x8" matches "12 x 8", "12×8", etc.
  const normalizeSearch = (str) =>
    String(str || "").toLowerCase().replace(/×/g, "x").replace(/\s+/g, "");
  const filteredProductSizes = (() => {
    const q = normalizeSearch(productSizeSearch);
    if (!q) return productSizes;
    return productSizes.filter((s) => {
      const w = parseFloat(s.width);
      const h = parseFloat(s.height);
      const haystack = normalizeSearch(`${s.name || ""} ${w}x${h} ${s.orientation || ""}`);
      return haystack.includes(q);
    });
  })();

  const allVisibleSelected =
    filteredProductSizes.length > 0 &&
    filteredProductSizes.every((s) => selectedProductSizeIds.includes(s._id));

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredProductSizes.map((s) => s._id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedProductSizeIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedProductSizeIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Apply full-cover + paper thickness settings independently — never modifies canvas size.
  // spineWidth is NOT stored in settings; it is derived at render time from paperThickness × billablePages.
  const applySpineSettings = () => {
    // Commit any uncommitted input value (user may not have blurred the field before clicking Apply)
    const rawThickness = localUnitValues.paperThickness;
    const committedThickness = (() => {
      if (!fullCoverEnabled) return 0;
      // Try unit-aware conversion first, then plain parseFloat as fallback
      const pxVal = convertToPixels(rawThickness, sizeUnit, sizeActiveDpi);
      if (!isNaN(pxVal) && pxVal > 0) return pxVal;
      // Direct parse fallback — covers the case where pxVal comes back 0 unexpectedly
      const direct = parseFloat(rawThickness);
      if (!isNaN(direct) && direct > 0) return sizeUnit === 'px' ? Math.round(direct) : convertToPixels(String(direct), sizeUnit, sizeActiveDpi);
      return paperThickness; // fall back to last committed value
    })();

    const payload = {
      showFullCoverSheet: fullCoverEnabled,
      paperThickness: committedThickness,
    };
    // For layflat: include coverEnabled in the payload so the reducer can
    // reconstruct the cover page structure (full-spread vs two half-sheets).
    if (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled) {
      payload.coverEnabled = true;
    }
    dispatch(setSettings(payload));

    // Eager propagation: the reducer only merges/splits the ACTIVE size's live
    // pages. Apply the same cover merge/split to every OTHER saved size in
    // allThemes so they all render the joined spread, not just the active one.
    // Photobook and layflat use different cover reconstructions (in-place
    // front/back layout merge vs a separate full-spread cover page), so each
    // editor type has its own branch below.
    if (
      activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
      Array.isArray(allThemes) &&
      allThemes.length > 0
    ) {
      const enable = fullCoverEnabled;
      const updatedThemes = allThemes.map((theme) => {
        const fullWidth = parseFloat(theme.width);
        const height = parseFloat(theme.height);
        const nextSettings = {
          ...(theme.settings || {}),
          showFullCoverSheet: enable,
          hideLastCover: enable,
          paperThickness: committedThickness,
        };

        // Decode this size's pages the same way the saved-size load path does.
        let decoded = [];
        if (theme.isNew && theme.pages_c) {
          decoded = decompressFromBase64(theme.pages_c)?.pages || [];
        } else if (theme.pages_c && fullWidth && height) {
          decoded = processProjectPages(theme.pages_c, fullWidth / 2, height) || [];
        }

        if (!decoded.length || !fullWidth) {
          // No decodable pages — still keep the cover flags in sync.
          return { ...theme, settings: nextSettings };
        }

        const transformed = enable
          ? mergePhotobookCover(decoded, fullWidth)
          : splitPhotobookCover(decoded, fullWidth);

        return {
          ...theme,
          settings: nextSettings,
          pages_c: compressData(JSON.stringify({ pages: transformed })),
          isNew: true,
        };
      });
      dispatch(setAllThemes(updatedThemes));
    } else if (
      activeEditorType === EDITOR_TYPES.LAYFLATALBUM &&
      Array.isArray(allThemes) &&
      allThemes.length > 0
    ) {
      // Mirror the photobook propagation for layflat. Layflat reconstructs the
      // cover as a SEPARATE full-spread cover page; decode at FULL width (no /2);
      // keep coverEnabled true when the project uses a cover; hideLastCover
      // follows full cover (photobook behaviour — consumers ignore it for
      // layflat while full cover is on, so it never hides an interior page).
      const enable = fullCoverEnabled;
      const projectHasCover = settings?.coverEnabled === true;
      const updatedThemes = allThemes.map((theme) => {
        const fullWidth = parseFloat(theme.width);
        const height = parseFloat(theme.height);
        const nextSettings = {
          ...(theme.settings || {}),
          showFullCoverSheet: enable,
          hideLastCover: enable,
          paperThickness: committedThickness,
        };
        if (projectHasCover) nextSettings.coverEnabled = true;

        // Harden each size independently: if one size's pages fail to decode or
        // transform, fall back to syncing JUST its settings and leave its pages_c
        // untouched — so a single odd/legacy size can never abort the whole Apply
        // or leave stored data half-processed.
        try {
          let decoded = [];
          if (theme.isNew && theme.pages_c) {
            decoded = decompressFromBase64(theme.pages_c)?.pages || [];
          } else if (theme.pages_c && fullWidth && height) {
            decoded = processProjectPages(theme.pages_c, fullWidth, height) || [];
          }

          if (!decoded.length || !fullWidth) {
            return { ...theme, settings: nextSettings };
          }

          const transformed = enable
            ? mergeLayflatCover(decoded, fullWidth)
            : splitLayflatCover(decoded, fullWidth);

          return {
            ...theme,
            settings: nextSettings,
            pages_c: compressData(JSON.stringify({ pages: transformed })),
            isNew: true,
          };
        } catch (err) {
          // Settings still sync; pages stay as they were (no corruption).
          return { ...theme, settings: nextSettings };
        }
      });
      dispatch(setAllThemes(updatedThemes));
    }

    toast.success("Cover settings applied!", { position: "top-center", autoClose: 1500 });
    handleClose();
  };

  // Check if size already exists
  const checkSizeExists = (width, height, depth = 0, dpi = 200) => {
    let sizeToCheck = `${width}x${height}`;
    if (activeEditorType === EDITOR_TYPES.CANVAS) {
      sizeToCheck = `${width - depth * 2}x${height - depth * 2}`;
    }
    return allThemes.some((theme) => {
      const sizeMatches = theme.size === sizeToCheck;
      if (dpi !== null) {
        const themeDpi = theme.dpi ? parseInt(theme.dpi, 10) : 0;
        return sizeMatches && themeDpi === dpi;
      }
      return sizeMatches;
    });
  };

  // Capture the CURRENTLY ACTIVE size's live design back into its allThemes entry
  // before switching to another size. Each size is a theme variant whose design is
  // stored in `pages_c`; switching re-sources pages from that stored copy. Live
  // edits, however, only live in canvas.present.pages — they were never written
  // back into allThemes[activeSize], so switching away and back within the same
  // session reloaded the stale pre-edit pages_c (the edits only reappeared after an
  // app reload, when the offline snapshot re-applied the live pages). This writes
  // them back in-memory so the round-trip is lossless.
  //
  // In blanked-theme mode the image boxes are intentionally empty placeholders and
  // the user's placed photos ride along via collectPlacedImages/changeObjectsInAllPages,
  // so we store the design with images blanked — that captures every NON-image edit
  // (text, object moves, stickers, backgrounds, layout…) without baking the user's
  // photos into the template. In normal mode we store the pages verbatim so images
  // are restored directly. Stored as `isNew` so the switch-back loader decompresses
  // the (already-scaled) pages directly instead of re-scaling them. Pure: returns a
  // new array, or the same ref when there's nothing to sync.
  const syncCurrentSizeIntoThemes = (themes) => {
    if (!Array.isArray(themes) || themes.length === 0) return themes;
    if (!Array.isArray(pages) || pages.length === 0) return themes;
    // Match the active size by numeric width/height/dpi — canvasSize.width is set
    // directly from theme.width on load, so this is exact and avoids any size-string
    // formatting mismatch (which would silently make the sync a no-op).
    const curW = parseFloat(canvasSize.width);
    const curH = parseFloat(canvasSize.height);
    const curDpi = parseInt(canvasSize.dpi || 200, 10);
    const idx = themes.findIndex(
      (t) =>
        parseFloat(t.width) === curW &&
        parseFloat(t.height) === curH &&
        parseInt(t.dpi || 200, 10) === curDpi
    );
    if (idx < 0) return themes; // active size not tracked in allThemes — nothing to sync
    const pagesToStore = themeImagesBlanked ? blankImageUrls(pages) : pages;
    const updated = {
      ...themes[idx],
      pages_c: compressData(JSON.stringify({ pages: pagesToStore })),
      settings: settings ?? themes[idx].settings,
      isNew: true,
    };
    return themes.map((t, i) => (i === idx ? updated : t));
  };

  const addSize = () => {
    // Capture the images the user has already placed on the CURRENT canvas before
    // we re-source pages for the new size (the local `pages` below shadows the
    // canvas selector). Used to re-fill the new blank theme in blanked mode.
    const placedImagesBefore = themeImagesBlanked ? collectPlacedImages(pages) : [];
    // Snapshot the CURRENT live design so the new size inherits the user's actual
    // work (scaled), not the theme's pristine base copy. For a freshly-created
    // theme that base copy is EMPTY, so new sizes used to come up blank and edits
    // never crossed sizes (the reported "changes not carried over" bug). `pages`
    // is the canvas selector, shadowed by a local `pages` inside the branches.
    const liveSourcePages = Array.isArray(pages) ? pages : [];
    // Validate width and height
    if (
      displaySize.width === null ||
      displaySize.height === null ||
      displaySize.width <= 0 ||
      displaySize.height <= 0
    ) {
      showAlert("Width and Height should be greater than 0", "error");
      return;
    }

    // Check if size already exists
    if (checkSizeExists(displaySize.width, displaySize.height, displaySize.depth, displaySize.dpi)) {
      showAlert("This size already exists! Please choose a different size.", "error");
      return;
    }

    dispatch(
      setCanvasSize({
        width: parseFloat(displaySize.width),
        height: parseFloat(displaySize.height),
        safeMargin: parseFloat(displaySize.safeMargin),
        bleedMargin: parseFloat(displaySize.bleedMargin),
        depth:
          activeEditorType === EDITOR_TYPES.CANVAS
            ? parseFloat(displaySize.depth) || 0
            : 0,
        dpi: parseInt(displaySize.dpi, 10) || 200,
        shape: (activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) ? displaySize.shape : undefined,
      })
    );

    if (activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) {
      dispatch(setSettings({ ...settings, shape: displaySize.shape }));
    }

    // check if theme exist in seleced orientation if yes than load it
    if (allThemes) {
      // alltheme is array of all themes, lets filter out theme with selected orientation
      let sizeToCheck = `${displaySize.width}x${displaySize.height}`;

      if (activeEditorType === EDITOR_TYPES.CANVAS) {
        // lets deduct depth from width and height
        sizeToCheck = `${displaySize.width - displaySize.depth * 2}x${displaySize.height - displaySize.depth * 2
          }`;
        // sizeToCheck = '';
      }

      const theme = allThemes.find((theme) => theme.size === sizeToCheck);
      let width = parseFloat(displaySize.width);
      const height = parseFloat(displaySize.height);
      if (theme) {
        //  let width = parseInt(theme.width);
        // let height = parseInt(theme.height);
        if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
          width /= 2;
        }

        // If theme was created via bulk DPI conversion, pages are already scaled - just decompress
        let pages;
        if (theme.isNew && theme.pages_c) {
          const decompressedData = decompressFromBase64(theme.pages_c);
          pages = decompressedData?.pages || [];
        } else {
          // Normal theme - use processProjectPages which scales to canvas
          pages = processProjectPages(theme.pages_c, width, height);
        }

        // Update or add the size in allThemes — replace if same size already exists to prevent duplicates
        const newThemeSize = {
          ...theme,
          width: displaySize.width,
          height: displaySize.height,
          depth: activeEditorType === EDITOR_TYPES.CANVAS ? displaySize.depth : 0,
          safeMargin: displaySize.safeMargin,
          bleedMargin: displaySize.bleedMargin,
          dpi: displaySize.dpi,
          size: sizeToCheck,
          isNew: true
        };
        const existingIdx = allThemes.findIndex((t) => themeKey(t) === `${sizeToCheck}@${parseInt(displaySize.dpi || 200, 10)}`);
        const updatedThemes = existingIdx >= 0
          ? allThemes.map((t, i) => i === existingIdx ? newThemeSize : t)
          : [...allThemes, newThemeSize];
        // Sync the outgoing (current) size's live design into the list before it is
        // committed, so switching back to it later restores the latest edits.
        dispatch(setAllThemes(syncCurrentSizeIntoThemes(updatedThemes)));

        dispatch(setCurrentObjectProperties(null));
        if (themeImagesBlanked) {
          // Keep images blank (don't restore the theme's originals on resize) but
          // carry the user's already-placed photos into the new size's empty boxes.
          dispatch(applyTheme(blankImageUrls(pages)));
          dispatch(setSettings(theme.settings));
          if (placedImagesBefore.length > 0) {
            dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
          }
        } else {
          dispatch(applyTheme(pages));
          dispatch(setSettings(theme.settings));
        }

        // need to scale calender settings as well
      } else {
        // use first theme and convert it to selected orientation
        if (allThemes && allThemes.length > 0) {
          const defaultTheme = allThemes[0];

          if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
            width /= 2;
          }

          // Scale the CURRENT live design to the new size — NOT defaultTheme's
          // stored base copy. allThemes[0].pages_c is the pristine (and, for a
          // just-created theme, EMPTY) server design; sourcing from it discarded
          // every live edit, so a new size came up blank. Round-trip the live
          // pages through the same scaler so the design carries across sizes.
          // `scalePages` derives the source dims from each layout's own
          // width/height, and processProjectPages decompresses a fresh copy, so
          // the live Redux pages are never mutated.
          const pages = processProjectPages(
            compressData(JSON.stringify({ pages: liveSourcePages })),
            width,
            height
          );

          // Update or add the size in allThemes — replace if same size already exists to prevent duplicates.
          // Store the freshly-scaled live design as this size's own pages_c (isNew
          // → the switch-back loader decompresses it directly, no re-scale) so the
          // new size is consistent in allThemes immediately, not only once the user
          // switches away from it. Blank the images in blanked mode to mirror what
          // the canvas gets below (placed photos ride along separately).
          const newThemeSize = {
            ...defaultTheme,
            pages_c: compressData(JSON.stringify({ pages: themeImagesBlanked ? blankImageUrls(pages) : pages })),
            width: displaySize.width,
            height: displaySize.height,
            depth: activeEditorType === EDITOR_TYPES.CANVAS ? displaySize.depth : 0,
            safeMargin: displaySize.safeMargin,
            bleedMargin: displaySize.bleedMargin,
            dpi: displaySize.dpi,
            size: sizeToCheck,
            isNew: true
          };
          const existingIdx = allThemes.findIndex((t) => themeKey(t) === `${sizeToCheck}@${parseInt(displaySize.dpi || 200, 10)}`);
          const updatedThemes = existingIdx >= 0
            ? allThemes.map((t, i) => i === existingIdx ? newThemeSize : t)
            : [...allThemes, newThemeSize];
          // Sync the outgoing (current) size's live design into the list before it is
          // committed, so switching back to it later restores the latest edits.
          dispatch(setAllThemes(syncCurrentSizeIntoThemes(updatedThemes)));

          dispatch(setCurrentObjectProperties(null));
          if (themeImagesBlanked) {
            // Keep images blank (don't restore originals) but carry the user's
            // already-placed photos into the new size's empty boxes.
            dispatch(applyTheme(blankImageUrls(pages)));
            dispatch(setSettings(defaultTheme.settings));
            if (placedImagesBefore.length > 0) {
              dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
            }
          } else {
            dispatch(applyTheme(pages));
            dispatch(setSettings(defaultTheme.settings));
          }
        }
      }
    }

    // Persist this size to the durable AppData custom-size store so it survives a
    // reload / theme reopen (allThemes is ephemeral Redux state, reset from the
    // server on load). Mirrors the sizes the theme-setup "Choose a size" modal
    // saves. Skip if the same size@dpi is already stored to avoid duplicates.
    const addedW = Math.round(parseFloat(displaySize.width));
    const addedH = Math.round(parseFloat(displaySize.height));
    const addedDpi = parseInt(displaySize.dpi, 10) || 200;
    const alreadyStored = getCustomSizes().some(
      (cs) =>
        Math.round(Number(cs.width)) === addedW &&
        Math.round(Number(cs.height)) === addedH &&
        (parseInt(cs.dpi || 200, 10)) === addedDpi
    );
    if (!alreadyStored) {
      addCustomSize({
        width: addedW,
        height: addedH,
        dpi: addedDpi,
        safeMargin: parseFloat(displaySize.safeMargin) || 0,
        bleedMargin: parseFloat(displaySize.bleedMargin) || 0,
      });
    }

    // close popup — cover settings are managed independently via applySpineSettings
    handleClose();
  };

  const handleToggleSelectSize = (e, sizeLabel) => {
    e.stopPropagation();
    setSelectedSizes(prev =>
      prev.includes(sizeLabel) ? prev.filter(s => s !== sizeLabel) : [...prev, sizeLabel]
    );
  };

  const handleSelectAllSizes = (e) => {
    if (e.target.checked) {
      setSelectedSizes(allThemes.map(themeKey));
    } else {
      setSelectedSizes([]);
    }
  };

  const confirmMultiDelete = async () => {
    if (selectedSizes.length === 0) return;

    // Check if trying to delete all
    if (selectedSizes.length >= allThemes.length) {
      toast.warning("Cannot delete all sizes. At least one size is required for the theme.", {
        position: "top-center"
      });
      setShowMultiDeleteDialog(false);
      return;
    }

    setIsDeletingMultiple(true);
    let successCount = 0;
    let newThemes = [...allThemes];

    try {
      // Map selected keys back to their themes so we delete exactly the chosen
      // rows (DPI-aware), not every row that happens to share the size string.
      const selectedThemes = allThemes.filter((t) => selectedSizes.includes(themeKey(t)));
      let remainingCustom = null;
      for (const theme of selectedThemes) {
        const data = { theme_id: themeId, size: theme.size, dpi: theme.dpi };
        const response = await apiPost(ENDPOINTS.removeSizeFromTheme, data);
        if (response.status === 1) {
          successCount++;
          newThemes = newThemes.filter((t) => themeKey(t) !== themeKey(theme));
          // Drop any durable AppData mirror too so the deleted size can't
          // resurface as an "extra custom size" row after a reload. Match DPI
          // (fall back to the displayed default) so we don't wipe same-pixel
          // custom sizes at other DPIs.
          remainingCustom = removeCustomSizesByDimensions({
            width: theme.width,
            height: theme.height,
            dpi: parseInt(theme.dpi, 10) || 200,
          });
        }
      }

      dispatch(setAllThemes(newThemes));
      if (Array.isArray(remainingCustom)) setAppDataCustomSizes(remainingCustom);
      setSelectedSizes([]);

      if (successCount === selectedSizes.length) {
        toast.success(`Successfully deleted ${successCount} sizes`, { position: "top-center", autoClose: 1000 });
      } else {
        toast.warning(`Deleted ${successCount} out of ${selectedSizes.length} sizes`, { position: "top-center" });
      }
    } catch (error) {
      toast.error("Error deleting sizes. Please try again.", { position: "top-center" });
    } finally {
      setIsDeletingMultiple(false);
      setShowMultiDeleteDialog(false);
    }
  };

  const confirmMultiConvertDpi = async (inputValues) => {
    // If inputValues is passed as old string format, gracefully handle it, otherwise destructure
    const dpiStr = typeof inputValues === "object" ? inputValues.dpi : inputValues;
    const safeMarginStr = typeof inputValues === "object" ? inputValues.safeMargin : "";
    const bleedMarginStr = typeof inputValues === "object" ? inputValues.bleedMargin : "";
    const unit = typeof inputValues === "object" ? (inputValues.unit || "px") : "px";

    const newDpi = parseInt(dpiStr, 10);
    if (!newDpi || isNaN(newDpi) || newDpi <= 0) {
      toast.error("Invalid DPI value entered", { position: "top-center" });
      setShowMultiConvertDialog(false);
      return;
    }

    const newSafeMargin = convertToPixels(safeMarginStr, unit, newDpi);
    const newBleedMargin = convertToPixels(bleedMarginStr, unit, newDpi);

    const selectedThemes = allThemes.filter(t => selectedSizes.includes(themeKey(t)));
    let updatedThemes = [...allThemes];
    let createdCount = 0;

    // Process each theme sequentially to fetch full data
    for (const sourceTheme of selectedThemes) {
      const sourceWidth = parseFloat(sourceTheme.width);
      const sourceHeight = parseFloat(sourceTheme.height);
      const sourceDepth = sourceTheme.depth ? parseFloat(sourceTheme.depth) : 0;
      const sourceDpi = sourceTheme.dpi ? parseInt(sourceTheme.dpi, 10) : 200;

      // Calculate physical dimensions based on OLD DPI
      const physicalWidthInches = sourceWidth / sourceDpi;
      const physicalHeightInches = sourceHeight / sourceDpi;

      // Calculate NEW pixel dimensions based on NEW DPI
      const targetWidth = Math.round(physicalWidthInches * newDpi);
      const targetHeight = Math.round(physicalHeightInches * newDpi);

      const existingSizeLabel = activeEditorType === EDITOR_TYPES.CANVAS
        ? `${targetWidth - sourceDepth * 2}x${targetHeight - sourceDepth * 2}`
        : `${targetWidth}x${targetHeight}`;

      // Check if size already exists
      const existingIndex = updatedThemes.findIndex(t =>
        t.size === existingSizeLabel && parseInt(t.dpi || 200, 10) === newDpi
      );

      // Only generate if dimensions actually change, or it doesn't exist
      if (existingIndex === -1 && (targetWidth !== sourceWidth || targetHeight !== sourceHeight || sourceDpi !== newDpi)) {

        // Use currently loaded pages from Redux - all sizes of the same theme have the same content
        // We'll scale from the current canvas size to each target size
        let pagesToScale = pages || [];

        if (!pagesToScale || pagesToScale.length === 0) {
          continue;
        }


        // Scale from CURRENT canvas size to target size
        const currentCanvasWidth = canvasSize.width;
        const currentCanvasHeight = canvasSize.height;

        let adjustedTargetWidth = targetWidth;
        let adjustedCurrentWidth = currentCanvasWidth;
        if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
          adjustedTargetWidth /= 2;
          adjustedCurrentWidth /= 2;
        }

        const scaleX = adjustedTargetWidth / adjustedCurrentWidth;
        const scaleY = targetHeight / currentCanvasHeight;

        const scaledPages = pagesToScale.map(page => {
          const scaledLayout = (page.layout || []).map(layoutItem => {
            const scaledObjects = (layoutItem.objects || []).map(obj => ({
              ...obj,
              width: (obj.width || 100) * scaleX,
              height: (obj.height || 100) * scaleY,
              transform: obj.transform ? {
                ...obj.transform,
                x: (obj.transform.x || 0) * scaleX,
                y: (obj.transform.y || 0) * scaleY,
              } : obj.transform,
              ...(obj.type === 'text' && obj.font ? {
                font: {
                  ...obj.font,
                  size: Math.round((obj.font.size || 16) * Math.min(scaleX, scaleY))
                }
              } : {}),
              ...(obj.image ? {
                image: {
                  ...obj.image,
                  width: (obj.image.width || 100) * scaleX,
                  height: (obj.image.height || 100) * scaleY,
                  positionX: (obj.image.positionX || 0) * scaleX,
                  positionY: (obj.image.positionY || 0) * scaleY,
                }
              } : {})
            }));

            return {
              ...layoutItem,
              objects: scaledObjects,
              width: layoutItem.width ? layoutItem.width * scaleX : adjustedTargetWidth,
              height: layoutItem.height ? layoutItem.height * scaleY : targetHeight
            };
          });

          return {
            ...page,
            layout: scaledLayout,
          };
        });

        const compressedPages = compressData(JSON.stringify({ pages: scaledPages }));

        updatedThemes.push({
          ...sourceTheme,
          width: targetWidth,
          height: targetHeight,
          safeMargin: newSafeMargin > 0 ? newSafeMargin : sourceTheme.safeMargin,
          bleedMargin: newBleedMargin > 0 ? newBleedMargin : sourceTheme.bleedMargin,
          dpi: newDpi,
          size: existingSizeLabel,
          pages_c: compressedPages,
          isNew: true
        });
        createdCount++;
      }
    }

    if (createdCount > 0) {
      dispatch(setAllThemes(updatedThemes));
      toast.success(`Successfully created ${createdCount} new scaled sizes!`, { position: "top-center" });
      setSelectedSizes([]);
    } else {
      toast.info("No new sizes were created. They might already exist.", { position: "top-center" });
    }
    setShowMultiConvertDialog(false);
  };

  // Open delete confirmation dialog — receives the exact theme row to delete
  const openDeleteDialog = (theme) => {
    // Check if theme has only one size
    if (allThemes.length === 1) {
      toast.warning("At least one size is required for the theme", {
        position: "top-center",
        autoClose: 1000,
      });
      return;
    }
    setSizeToDelete(theme);
    setShowDeleteDialog(true);
  };

  // Confirm delete size
  const confirmDeleteSize = async () => {
    if (!sizeToDelete) return;

    setIsDeleting(true);
    try {
      const data = {
        theme_id: themeId,
        size: sizeToDelete.size,
        dpi: sizeToDelete.dpi,
      };

      const response = await apiPost(ENDPOINTS.removeSizeFromTheme, data);

      if (response.status === 1) {
        // Remove ONLY the exact row (size + DPI), not every same-size variant
        const newThemes = allThemes.filter((theme) => themeKey(theme) !== themeKey(sizeToDelete));
        dispatch(setAllThemes(newThemes));

        // Also drop any durable AppData mirror of this size. A size added
        // in-editor lives in BOTH allThemes and the custom-size store; removing it
        // only from allThemes left the mirror behind, so it resurfaced as an
        // "extra custom size" row after a reload (the reappearing-size bug).
        // Match DPI too, NOT just pixels — otherwise deleting one size wipes every
        // same-pixel custom size at a different DPI (e.g. deleting 5000×2500@300
        // also removed 5000×2500@200). Legacy rows may carry no DPI; fall back to
        // the displayed default so we never pass `undefined` (= "remove all").
        const remainingCustom = removeCustomSizesByDimensions({
          width: sizeToDelete.width,
          height: sizeToDelete.height,
          dpi: parseInt(sizeToDelete.dpi, 10) || 200,
        });
        if (Array.isArray(remainingCustom)) setAppDataCustomSizes(remainingCustom);

        toast.success("Size removed successfully", {
          position: "top-center",
          autoClose: 100,
        });
      } else {
        toast.error(response.message || "Failed to remove size", {
          position: "top-center",
        });
      }
    } catch (error) {
      toast.error("Error removing size. Please try again.", {
        position: "top-center",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSizeToDelete(null);
    }
  };

  // Cancel delete
  const cancelDeleteSize = () => {
    setShowDeleteDialog(false);
    setSizeToDelete(null);
  };

  // Use saved size and close dialog
  const selectAndCloseSavedSize = (theme) => {
    // Persist the current size's live edits into allThemes BEFORE re-sourcing the
    // target size, so returning here later in the session restores the latest
    // design instead of the stale stored pages (previously the edits survived only
    // an app reload). The synced list is also used for the lookup below so that
    // re-selecting the active size round-trips its own just-captured pages.
    const themesWithCurrent = syncCurrentSizeIntoThemes(allThemes);
    if (themesWithCurrent !== allThemes) {
      dispatch(setAllThemes(themesWithCurrent));
    }
    // Capture currently-placed images before re-sourcing pages for the new size
    // (the local `pages` below shadows the canvas selector).
    const placedImagesBefore = themeImagesBlanked ? collectPlacedImages(pages) : [];
    const width = parseFloat(theme.width);
    const height = parseFloat(theme.height);
    const depth = theme.depth ? parseFloat(theme.depth) : 0;
    const safeMargin = theme.safeMargin ? parseFloat(theme.safeMargin) : 0;
    const bleedMargin = theme.bleedMargin ? parseFloat(theme.bleedMargin) : 0;
    const themeDpi = theme.dpi ? parseInt(theme.dpi, 10) : 0;

    dispatch(
      setCanvasSize({
        width: width,
        height: height,
        depth: activeEditorType === EDITOR_TYPES.CANVAS ? depth : 0,
        safeMargin: safeMargin,
        bleedMargin: bleedMargin,
        dpi: themeDpi,
      })
    );

    // Load theme pages if available
    if (allThemes) {
      const sizeToCheck = activeEditorType === EDITOR_TYPES.CANVAS
        ? `${width - depth * 2}x${height - depth * 2}`
        : `${width}x${height}`;

      // Match the exact clicked row (size + DPI), not just any row of this size —
      // otherwise a same-pixel/different-DPI variant could load the wrong design.
      // Look it up in the synced list so re-selecting the active size reloads the
      // pages we just captured, not the stale copy.
      const matchedTheme = themesWithCurrent.find((t) => themeKey(t) === themeKey(theme)) || theme;
      let layoutWidth = width;

      if (matchedTheme) {
        if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
          layoutWidth /= 2;
        }

        // If theme was created via bulk DPI conversion, pages are already scaled - just decompress
        let pages;
        if (matchedTheme.isNew && matchedTheme.pages_c) {
          const decompressedData = decompressFromBase64(matchedTheme.pages_c);
          pages = decompressedData?.pages || [];
        } else {
          // Normal theme - use processProjectPages which scales to canvas
          pages = processProjectPages(matchedTheme.pages_c, layoutWidth, height);
        }

        dispatch(setCurrentObjectProperties(null));
        if (themeImagesBlanked) {
          // Blanked-mode theme: load the new size with blank placeholders (don't
          // restore the theme's originals), but carry the user's already-placed
          // photos into the new size's empty boxes so they don't vanish on resize.
          // Write the canvas directly via applyTheme (same path addSize uses —
          // synchronous, and it does NOT go through the projectSetup→useThemeSetup
          // effect that would re-apply blank pages and clobber the re-fill).
          dispatch(applyTheme(blankImageUrls(pages)));
          dispatch(setSettings(matchedTheme.settings));
          if (placedImagesBefore.length > 0) {
            dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
          }
        } else {
          dispatch(setEditorPages(pages));
          dispatch(setSettings(matchedTheme.settings));
        }
      }
    }

    handleClose();
  };

  // Apply a durable AppData custom size (no server-side pages_c of its own): scale
  // the base theme's pages to the target size, mirroring addSize's "size not found
  // → scale the default theme" branch. Closes the popup like selectAndCloseSavedSize.
  const applyCustomSizeRow = (size) => {
    // Preserve the outgoing size's live edits into allThemes before scaling to the
    // custom size, so switching back to a server size later restores its latest
    // design (custom sizes have no allThemes entry of their own, so the sync is a
    // no-op when leaving a custom size — as intended).
    const themesWithCurrent = syncCurrentSizeIntoThemes(allThemes);
    if (themesWithCurrent !== allThemes) {
      dispatch(setAllThemes(themesWithCurrent));
    }
    const placedImagesBefore = themeImagesBlanked ? collectPlacedImages(pages) : [];
    const width = parseFloat(size.width);
    const height = parseFloat(size.height);
    const safeMargin = size.safeMargin ? parseFloat(size.safeMargin) : 0;
    const bleedMargin = size.bleedMargin ? parseFloat(size.bleedMargin) : 0;
    const sizeDpi = size.dpi ? parseInt(size.dpi, 10) : 200;

    dispatch(
      setCanvasSize({
        width,
        height,
        depth: 0,
        safeMargin,
        bleedMargin,
        dpi: sizeDpi,
      })
    );

    const baseTheme = allThemes && allThemes.length > 0 ? allThemes[0] : null;
    if (baseTheme) {
      let layoutWidth = width;
      if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) layoutWidth /= 2;
      // Scale the CURRENT live design (not baseTheme's stored base copy — empty on
      // a freshly-created theme) so switching to a custom size carries the user's
      // work across, matching the web editor. baseTheme is still used for settings.
      const liveSource = Array.isArray(pages) && pages.length > 0 ? pages : null;
      const scaledPages = liveSource
        ? processProjectPages(compressData(JSON.stringify({ pages: liveSource })), layoutWidth, height)
        : processProjectPages(baseTheme.pages_c, layoutWidth, height);
      dispatch(setCurrentObjectProperties(null));
      if (themeImagesBlanked) {
        dispatch(applyTheme(blankImageUrls(scaledPages)));
        dispatch(setSettings(baseTheme.settings));
        if (placedImagesBefore.length > 0) {
          dispatch(changeObjectsInAllPages({ images: placedImagesBefore, option: "option1" }));
        }
      } else {
        dispatch(applyTheme(scaledPages));
        dispatch(setSettings(baseTheme.settings));
      }
    }

    handleClose();
  };

  // Remove a durable AppData custom size row. These aren't server themes, so this
  // never calls the removeSizeFromTheme API — only the local store. The subscribe
  // effect refreshes appDataCustomSizes.
  const deleteCustomSizeRow = (e, size) => {
    if (e) e.stopPropagation();
    const updated = removeCustomSize(size.id);
    if (Array.isArray(updated)) setAppDataCustomSizes(updated);
    toast.success("Size removed successfully", { position: "top-center", autoClose: 100 });
  };

  // Open the convert modal for a durable AppData custom size. Custom sizes have no
  // pages_c of their own, so synthesize a source theme by scaling the base theme's
  // pages to the custom dimensions — then the normal convert flow (which decodes
  // convertSourceTheme.pages_c and scales from its width/height) works unchanged.
  const openConvertModalForCustomSize = (size) => {
    const baseTheme = allThemes && allThemes.length > 0 ? allThemes[0] : null;
    if (!baseTheme) {
      toast.warning("A base theme design is required to convert a custom size.", {
        position: "top-center",
      });
      return;
    }
    const width = parseFloat(size.width);
    const height = parseFloat(size.height);
    let layoutWidth = width;
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) layoutWidth /= 2;
    const scaledPages = processProjectPages(baseTheme.pages_c, layoutWidth, height);
    const syntheticSource = {
      ...baseTheme,
      width,
      height,
      depth: 0,
      safeMargin: size.safeMargin ? parseFloat(size.safeMargin) : 0,
      bleedMargin: size.bleedMargin ? parseFloat(size.bleedMargin) : 0,
      dpi: size.dpi ? parseInt(size.dpi, 10) : 200,
      size: `${Math.round(width)}x${Math.round(height)}`,
      pages_c: compressData(JSON.stringify({ pages: scaledPages })),
      isNew: true,
    };
    openConvertModal(syntheticSource);
  };

  // Open convert modal for a theme
  const openConvertModal = (theme) => {
    setConvertSourceTheme(theme);
    setConvertTargetWidth("");
    setConvertTargetHeight("");
    setMultiTargets([{ width: "", height: "" }]);
    setSelectedProductSizeIds([]);
    setProductSizeSearch("");
    setConvertUnit(getPreferredUnit());
    setConvertDpi(theme?.dpi || displaySize.dpi || 200);
    setConvertBleedMargin("");
    setConvertSafeMargin("");
    setConvertTargetShape(theme?.shape || theme?.settings?.shape || "rectangle");
    convertPhysical.current = { width: null, height: null, bleedMargin: null, safeMargin: null };
    setShowConvertModal(true);
  };

  // Close convert modal
  const closeConvertModal = () => {
    setShowConvertModal(false);
    setConvertSourceTheme(null);
    setConvertTargetWidth("");
    setConvertTargetHeight("");
    setMultiTargets([{ width: "", height: "" }]);
    setSelectedProductSizeIds([]);
    setProductSizeSearch("");
    setConvertUnit(getPreferredUnit());
    setConvertBleedMargin("");
    setConvertSafeMargin("");
    setConvertTargetShape("rectangle");
    convertPhysical.current = { width: null, height: null, bleedMargin: null, safeMargin: null };
  };

  // Resolve a raw target row to pixels using the selected unit + DPI
  const resolveTargetRowPx = (row) => ({
    widthPx: convertUnit === 'px'
      ? (parseInt(row.width, 10) || 0)
      : convertToPixels(row.width, convertUnit, convertActiveDpi),
    heightPx: convertUnit === 'px'
      ? (parseInt(row.height, 10) || 0)
      : convertToPixels(row.height, convertUnit, convertActiveDpi),
  });

  // Generate one or more new sizes from a single source theme by scaling its
  // pages to each manual target row. New sizes are added to allThemes (the
  // active canvas is left unchanged); duplicates are skipped.
  const handleConvertMultipleSizes = () => {
    if (!convertSourceTheme) return;

    // Targets come from selected product sizes (width doubled for book products)
    // plus any manual rows the user added.
    const productTargets = productSizes
      .filter((s) => selectedProductSizeIds.includes(s._id))
      .map(productSizeToTargetPx)
      .filter((t) => t.widthPx > 0 && t.heightPx > 0);
    const manualTargets = multiTargets
      .map(resolveTargetRowPx)
      .filter((t) => t.widthPx > 0 && t.heightPx > 0);
    const targets = [...productTargets, ...manualTargets];

    if (targets.length === 0) {
      showAlert("Select at least one product size or enter a custom size", "error");
      return;
    }

    // Source dimensions + margins (user-entered margins override source values)
    const sourceWidth = parseFloat(convertSourceTheme.width);
    const sourceHeight = parseFloat(convertSourceTheme.height);
    const sourceDepth = convertSourceTheme.depth ? parseFloat(convertSourceTheme.depth) : 0;
    const sourceSafeMargin = convertSafeMarginPx || (convertSourceTheme.safeMargin ? parseFloat(convertSourceTheme.safeMargin) : 0);
    const sourceBleedMargin = convertBleedMarginPx || (convertSourceTheme.bleedMargin ? parseFloat(convertSourceTheme.bleedMargin) : 0);
    const sourceDpi = convertActiveDpi || (convertSourceTheme.dpi ? parseFloat(convertSourceTheme.dpi) : 200);

    // Decode the source pages once (same strategy as the saved-size load path)
    let pagesToScale = [];
    if (convertSourceTheme.pages_c) {
      const decompressedData = decompressFromBase64(convertSourceTheme.pages_c);
      pagesToScale = decompressedData?.pages || [];
    }
    // Fallback: source has no decodable pages but it's the active size → use Redux pages
    if ((!pagesToScale || pagesToScale.length === 0) &&
      sourceWidth === canvasSize.width &&
      sourceHeight === canvasSize.height &&
      sourceDpi === (canvasSize.dpi || 200)) {
      pagesToScale = pages || [];
    }

    if (!pagesToScale || pagesToScale.length === 0) {
      showAlert("Source theme has no pages to convert", "error");
      return;
    }

    let adjustedSourceWidth = sourceWidth;
    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      adjustedSourceWidth /= 2;
    }

    const updatedThemes = [...allThemes];
    let created = 0;
    let skipped = 0;

    targets.forEach(({ widthPx, heightPx }) => {
      const sizeLabel = activeEditorType === EDITOR_TYPES.CANVAS
        ? `${widthPx - sourceDepth * 2}x${heightPx - sourceDepth * 2}`
        : `${widthPx}x${heightPx}`;

      // Skip if a size with the same label + DPI already exists (incl. ones just added this run)
      const alreadyExists = updatedThemes.some(
        (t) => t.size === sizeLabel && parseInt(t.dpi || 200, 10) === sourceDpi
      );
      if (alreadyExists) {
        skipped++;
        return;
      }

      let adjustedTargetWidth = widthPx;
      if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
        adjustedTargetWidth /= 2;
      }

      const scaledPages = scaleSourcePagesToTarget(
        pagesToScale,
        adjustedSourceWidth,
        sourceHeight,
        adjustedTargetWidth,
        heightPx
      );

      updatedThemes.push({
        ...convertSourceTheme,
        width: widthPx,
        height: heightPx,
        depth: activeEditorType === EDITOR_TYPES.CANVAS ? sourceDepth : 0,
        safeMargin: sourceSafeMargin,
        bleedMargin: sourceBleedMargin,
        dpi: sourceDpi,
        size: sizeLabel,
        pages_c: compressData(JSON.stringify({ pages: scaledPages })),
        settings: (activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && convertSourceTheme.settings
          ? { ...convertSourceTheme.settings, shape: convertTargetShape }
          : convertSourceTheme.settings,
        isNew: true,
      });
      created++;
    });

    if (created > 0) {
      dispatch(setAllThemes(updatedThemes));
      toast.success(
        `Created ${created} new size${created > 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} skipped — already exist)` : ""}`,
        { position: "top-center", autoClose: 1500 }
      );
    } else {
      toast.info("No new sizes created — they already exist.", { position: "top-center" });
    }

    closeConvertModal();
  };

  const shouldShowRecomandedSize =
    activeEditorType !== EDITOR_TYPES.LAYFLATALBUM &&
    activeEditorType !== EDITOR_TYPES.PHOTOBOOK;

  // Only show tutorial entries that actually have a link
  const availableHowToVideos = HOW_TO_VIDEOS.filter((v) => v.url);

  return (
    <>
      <PhotoModalStyled
        dialogClassName="mob_full_screen_modal"
        show={true}
        onHide={handleClose}
        enforceFocus={false}
        size="xl"
        backdrop="static"
      >
        <CustomModalHeader>
          <ModalTitle>Manage Size</ModalTitle>
          <CloseButton onClick={handleClose} aria-label="Close dialog">
            <AiOutlineClose size={20} />
          </CloseButton>
        </CustomModalHeader>

        <PhotoModalBodyStyled>
          {/* lets create for take canvas size in pixel and when save , lets apply to canvas size.  create form with input */}
          <SizeSettingsBodyWrapper>
            <Container fluid className="px-2 px-md-3">
              {/* Alert Banner */}
              {alertMessage && (
                <AlertBanner type={alertType}>
                  <AiFillInfoCircle size={16} />
                  {alertMessage}
                </AlertBanner>
              )}

              {activeEditorType === EDITOR_TYPES.CANVAS && (
                <PrimaryButton
                  onClick={() => setIsGuidelineVisible(true)}
                  className="d-flex justify-content-between align-items-center mb-3 btn btn-primary w-100"
                >
                  <p className="mb-0">Guideline for canvas size</p>
                  <AiFillInfoCircle size={25} />
                </PrimaryButton>
              )}

              <ConverterWrapper>
                <Row>
                  <Col xs={12}>
                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                      <h5 className="font-weight-bold text-dark mb-0">
                        Page/Canvas Size
                      </h5>
                      {availableHowToVideos.length > 0 && (
                        <Dropdown align="end">
                          <Dropdown.Toggle
                            as={TutorialsPillButton}
                            id="dropdown-tutorials"
                          >
                            <FaPlayCircle size={14} />
                            <span>Quick Tutorials ({availableHowToVideos.length})</span>
                            <span className="ts-chevron">
                              <FaChevronDown size={10} />
                            </span>
                          </Dropdown.Toggle>

                          <StyledDropdownMenu>
                            <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid #f3f4f6', marginBottom: '6px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Available Tutorials
                            </div>
                            {availableHowToVideos.map((video, i) => (
                              <StyledDropdownItem
                                key={i}
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span className="tv-icon"><FaPlayCircle size={15} /></span>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 550, lineHeight: 1.25 }}>{video.title}</span>
                                  <span className="tv-subtext">Opens in a new tab</span>
                                </div>
                              </StyledDropdownItem>
                            ))}
                          </StyledDropdownMenu>
                        </Dropdown>
                      )}
                    </div>

                    {/* Size Configuration Form */}
                    <Row className="g-3">
                      {/* Row 1: DPI and Unit Selection (First as requested) */}
                      <Col xs={12} md={6}>
                        <CustomFormGroup controlId="dpi">
                          <CustomFormLabel>
                            DPI (Dots Per Inch)
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip id="dpi-tooltip">
                                  <strong>Resolution (DPI):</strong> Controls how pixels map to physical print size. Common values: 72 (web), 96 (screen), 150 (standard print), 300 (high-quality print).
                                </Tooltip>
                              }
                            >
                              <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                <AiFillInfoCircle size={14} />
                              </span>
                            </OverlayTrigger>
                          </CustomFormLabel>
                          <CustomFormControl
                            type="number"
                            value={displaySize?.dpi}
                            onChange={handleInputChange}
                            min={1}
                            placeholder="200"
                          />
                        </CustomFormGroup>
                      </Col>

                      <Col xs={12} md={6}>
                        <CustomFormGroup>
                          <CustomFormLabel>Unit</CustomFormLabel>
                          <CustomFormSelect
                            value={sizeUnit}
                            onChange={(e) => { setSizeUnit(e.target.value); setPreferredUnit(e.target.value); }}
                            aria-label="Canvas size unit"
                          >
                            {PRINT_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </CustomFormSelect>
                        </CustomFormGroup>
                      </Col>

                      {/* Row 2: Width and Height */}
                      <Col xs={12} md={6}>
                        <CustomFormGroup controlId="width">
                          <CustomFormLabel>
                            {shouldShowRecomandedSize ? 'Width' : 'Spread Width'}
                          </CustomFormLabel>
                          <CustomFormControl
                            type="number"
                            value={sizeUnit === 'px' ? displaySize.width : localUnitValues.width}
                            onChange={(e) => sizeUnit === 'px'
                              ? handleInputChange(e)
                              : handleUnitSizeChange('width', e.target.value)
                            }
                            onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('width')}
                            min={sizeUnit === 'px' ? 1 : 0.001}
                            step={sizeUnit === 'px' ? 1 : 0.001}
                          />
                        </CustomFormGroup>
                      </Col>

                      <Col xs={12} md={6}>
                        <CustomFormGroup controlId="height">
                          <CustomFormLabel>
                            Height
                          </CustomFormLabel>
                          <CustomFormControl
                            type="number"
                            value={sizeUnit === 'px' ? displaySize.height : localUnitValues.height}
                            onChange={(e) => sizeUnit === 'px'
                              ? handleInputChange(e)
                              : handleUnitSizeChange('height', e.target.value)
                            }
                            onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('height')}
                            min={sizeUnit === 'px' ? 1 : 0.001}
                            step={sizeUnit === 'px' ? 1 : 0.001}
                          />
                        </CustomFormGroup>
                      </Col>

                      {/* Row 3: Depth (Canvas only) */}
                      {activeEditorType === EDITOR_TYPES.CANVAS && (
                        <Col xs={12}>
                          <CustomFormGroup controlId="depth">
                            <CustomFormLabel>
                              Depth (px)
                            </CustomFormLabel>
                            <CustomFormControl
                              type="number"
                              value={displaySize.depth}
                              onChange={handleInputChange}
                            />
                          </CustomFormGroup>
                        </Col>
                      )}

                      {/* Row 4: Margins (unit-aware like width/height) */}
                      <Col xs={12} md={6}>
                        <CustomFormGroup controlId="safeMargin">
                          <CustomFormLabel>
                            Trim Margin
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip id="trim-margin-tooltip">
                                  <strong>Safe Zone:</strong> Inside this margin is safe.
                                </Tooltip>
                              }
                            >
                              <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                <AiFillInfoCircle size={14} />
                              </span>
                            </OverlayTrigger>
                          </CustomFormLabel>
                          <CustomFormControl
                            type="number"
                            value={sizeUnit === 'px' ? (displaySize.safeMargin || 0) : localUnitValues.safeMargin}
                            onChange={(e) => sizeUnit === 'px'
                              ? handleInputChange(e)
                              : handleUnitSizeChange('safeMargin', e.target.value)
                            }
                            onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('safeMargin')}
                            min={0}
                            step={sizeUnit === 'px' ? 1 : 0.001}
                          />
                        </CustomFormGroup>
                      </Col>

                      <Col xs={12} md={6}>
                        <CustomFormGroup controlId="bleedMargin">
                          <CustomFormLabel>
                            Bleed Margin
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip id="bleed-margin-tooltip">
                                  <strong>Bleed Area:</strong> Extend backgrounds here.
                                </Tooltip>
                              }
                            >
                              <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                <AiFillInfoCircle size={14} />
                              </span>
                            </OverlayTrigger>
                          </CustomFormLabel>
                          <CustomFormControl
                            type="number"
                            value={sizeUnit === 'px' ? (displaySize.bleedMargin || 0) : localUnitValues.bleedMargin}
                            onChange={(e) => sizeUnit === 'px'
                              ? handleInputChange(e)
                              : handleUnitSizeChange('bleedMargin', e.target.value)
                            }
                            onBlur={() => sizeUnit !== 'px' && handleUnitSizeBlur('bleedMargin')}
                            min={0}
                            step={sizeUnit === 'px' ? 1 : 0.001}
                          />
                        </CustomFormGroup>
                      </Col>

                      {/* Shape dropdown (Custom Product / Print only) */}
                      {(activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && (
                        <Col xs={12}>
                          <CustomFormGroup controlId="shape">
                            <CustomFormLabel>Shape</CustomFormLabel>
                            <CustomFormSelect
                              value={displaySize.shape || "rectangle"}
                              onChange={handleInputChange}
                            >
                              <option value="rectangle">Rectangle</option>
                              <option value="circle">Circle</option>
                            </CustomFormSelect>
                          </CustomFormGroup>
                        </Col>
                      )}

                      {/* Button Row */}
                      <Col xs={12} className="mt-4">
                        <AddSizeButton onClick={addSize} className="w-100">
                          Add Size
                        </AddSizeButton>
                      </Col>

                      {/* Recommended Sizes Dropdown */}
                      {shouldShowRecomandedSize && (
                        <Col xs={12}>
                          <div className="border-top pt-3 mt-2">
                            <CustomFormGroup>
                              <CustomFormLabel style={{ fontSize: '12px', marginBottom: '8px' }}>
                                Or select a standard size:
                              </CustomFormLabel>
                              <RecommendedSizeDropdown
                                value={selectedRecommendedSize}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSelectedRecommendedSize(value);
                                  if (value) {
                                    const [w, h] = value.split("x").map(Number);
                                    const d = parseFloat(displaySize.depth) || 0;
                                    setDisplaySize((prev) => ({
                                      ...prev,
                                      width: activeEditorType === EDITOR_TYPES.CANVAS ? w + d * 2 : w,
                                      height: activeEditorType === EDITOR_TYPES.CANVAS ? h + d * 2 : h,
                                      depth: activeEditorType === EDITOR_TYPES.CANVAS ? d : 0,
                                    }));
                                  }
                                }}
                              >
                                <option value="">-- Quick Select Standard Size --</option>
                                <optgroup label="Portrait">
                                  {recommendedSizes
                                    .filter(s => s.label.includes('(P)'))
                                    .map((size, idx) => (
                                      <option key={`p-${idx}`} value={`${size.width}x${size.height}`}>
                                        {size.label.replace(/\([PLS]\)\s?/g, '')} — {size.width}×{size.height}px
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Landscape">
                                  {recommendedSizes
                                    .filter(s => s.label.includes('(L)'))
                                    .map((size, idx) => (
                                      <option key={`l-${idx}`} value={`${size.width}x${size.height}`}>
                                        {size.label.replace(/\([PLS]\)\s?/g, '')} — {size.width}×{size.height}px
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Square">
                                  {recommendedSizes
                                    .filter(s => s.label.includes('(S)'))
                                    .map((size, idx) => (
                                      <option key={`s-${idx}`} value={`${size.width}x${size.height}`}>
                                        {size.label.replace(/\([PLS]\)\s?/g, '')} — {size.width}×{size.height}px
                                      </option>
                                    ))}
                                </optgroup>
                              </RecommendedSizeDropdown>
                            </CustomFormGroup>
                          </div>
                        </Col>
                      )}

                    </Row>
                  </Col>
                </Row>
              </ConverterWrapper>

              {/* Full Cover & Spine Settings — Photobook and Layflat, independent of size */}
              {(activeEditorType === EDITOR_TYPES.PHOTOBOOK || (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled)) && (
                <SectionCard style={{ marginTop: '0', marginBottom: '16px', padding: '16px', borderColor: fullCoverEnabled ? 'var(--primary, #4084b5)' : undefined }}>
                  <SectionHeader style={{ marginBottom: '16px', paddingBottom: '10px' }}>
                    <SectionTitle style={{ fontSize: '15px' }}>Cover & Spine Settings</SectionTitle>
                    <SectionBadge style={{ fontSize: '10px', background: fullCoverEnabled ? 'var(--primary, #4084b5)' : undefined, color: fullCoverEnabled ? '#fff' : undefined }}>
                      {fullCoverEnabled ? 'Full Cover ON' : 'Standard'}
                    </SectionBadge>
                  </SectionHeader>

                  <div className="d-flex flex-wrap align-items-center gap-x-5 gap-y-3">
                    {/* Toggle */}
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check
                        type="switch"
                        id="fullCoverSwitchIndependent"
                        label={activeEditorType === EDITOR_TYPES.LAYFLATALBUM ? "Show Spine" : "Full Cover"}
                        checked={fullCoverEnabled}
                        onChange={(e) => {
                          setFullCoverEnabled(e.target.checked);
                          if (!e.target.checked) setPaperThickness(0);
                        }}
                        className="m-0 font-weight-bold"
                        style={{ fontSize: '14px' }}
                      />
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id="full-cover-tooltip-independent">
                            {activeEditorType === EDITOR_TYPES.LAYFLATALBUM
                              ? <><strong>Show Spine:</strong> Enables spine rendering on the full cover spread. Enter paper thickness to calculate spine width automatically.</>
                              : <><strong>Full Cover:</strong> Cover spans front &amp; back as a single spread. Enables spine rendering.</>
                            }
                          </Tooltip>
                        }
                      >
                        <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                          <AiFillInfoCircle size={16} />
                        </span>
                      </OverlayTrigger>
                    </div>

                    {fullCoverEnabled && (
                      <div className="d-flex flex-column gap-1 ms-md-5">
                        <div className="d-flex align-items-center gap-3">
                          <Form.Label className="m-0 font-weight-bold text-dark d-flex align-items-center gap-1" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                            Per Page Width ({sizeUnitShort})
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip id="paper-thickness-tooltip-independent">
                                  <strong>Per Page Width:</strong> The thickness of one printed page.
                                </Tooltip>
                              }
                            >
                              <span style={{ cursor: 'help', color: 'var(--primary)' }}>
                                <AiFillInfoCircle size={14} />
                              </span>
                            </OverlayTrigger>
                          </Form.Label>
                          <div style={{ width: '100px' }}>
                            <Form.Control
                              type="number"
                              value={localUnitValues.paperThickness}
                              onChange={(e) => handleUnitSizeChange('paperThickness', e.target.value)}
                              onBlur={() => handleUnitSizeBlur('paperThickness')}
                              min={0}
                              step={sizeUnit === 'px' ? 0.1 : 0.001}
                              placeholder="e.g. 0.5"
                              style={{ height: '36px', fontSize: '14px' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={fullCoverEnabled ? "ms-auto" : "ms-md-4"}>
                      <PrimaryButton
                        onClick={applySpineSettings}
                        className="py-2 px-4 shadow-sm"
                        style={{ fontSize: '14px', borderRadius: '8px' }}
                      >
                        {fullCoverEnabled ? 'Apply Cover Settings' : 'Disable Full Cover'}
                      </PrimaryButton>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Saved Sizes - Table Layout */}
              {(allThemes.length > 0 || extraCustomSizes.length > 0) && (
                <SectionCard style={{ marginTop: '16px' }}>
                  <SectionHeader style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SectionTitle>Saved Sizes</SectionTitle>
                      <SectionBadge>{allThemes.length + extraCustomSizes.length} sizes</SectionBadge>
                    </div>
                    {selectedSizes.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="outline-primary" size="sm" onClick={() => setShowMultiConvertDialog(true)}>
                          <FaSync className="me-1" /> Scale to New DPI ({selectedSizes.length})
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => setShowMultiDeleteDialog(true)}>
                          <FaTrash className="me-1" /> Delete Selected ({selectedSizes.length})
                        </Button>
                      </div>
                    )}
                  </SectionHeader>

                  <SizesTableWrapper>
                    <SizesTable>
                      <thead>
                        <tr>
                          <CheckboxHeader>
                            <Form.Check
                              type="checkbox"
                              checked={selectedSizes.length === allThemes.length && allThemes.length > 0}
                              onChange={handleSelectAllSizes}
                            />
                          </CheckboxHeader>
                          <TableHeader>Size (inches)</TableHeader>
                          <TableHeader>Dimensions (px)</TableHeader>
                          <TableHeader>DPI</TableHeader>
                          <TableHeader>Type</TableHeader>
                          <TableHeader style={{ textAlign: 'right' }}>Actions</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {allThemes.map((theme, index) => {
                          const width = parseFloat(theme.width);
                          const height = parseFloat(theme.height);
                          const depth = theme.depth ? parseFloat(theme.depth) : 0;
                          const themeDpi = theme.dpi ? parseInt(theme.dpi, 10) : 0;
                          const effectiveDpi = themeDpi > 0 ? themeDpi : 200;
                          const pxToInches = (value) => (value && effectiveDpi ? value / effectiveDpi : 0);
                          const inchWidth = pxToInches(width - depth * 2);
                          const inchHeight = pxToInches(height - depth * 2);
                          const type = getSizeOrientation(width, height, activeEditorType, settings);
                          const normalizedDisplayDpi = parseInt(displaySize.dpi, 10) || 200;
                          const normalizedThemeDpi = themeDpi > 0 ? themeDpi : effectiveDpi;
                          const isActive =
                            Number(displaySize.width) === width &&
                            Number(displaySize.height) === height &&
                            normalizedDisplayDpi === normalizedThemeDpi;

                          return (
                            <TableRow
                              key={index}
                              active={isActive}
                              onClick={() => {
                                setDisplaySize({
                                  width: width,
                                  height: height,
                                  depth: depth,
                                  safeMargin: theme.safe_margin ? parseFloat(theme.safe_margin) : 0,
                                  bleedMargin: theme.bleed_margin ? parseFloat(theme.bleed_margin) : 0,
                                  dpi: themeDpi || effectiveDpi,
                                });
                              }}
                            >
                              <CheckboxCell onClick={(e) => e.stopPropagation()}>
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedSizes.includes(themeKey(theme))}
                                  onChange={(e) => handleToggleSelectSize(e, themeKey(theme))}
                                />
                              </CheckboxCell>
                              <TableCell className="size-label">
                                {Number(inchWidth.toFixed(1))} × {Number(inchHeight.toFixed(1))}
                              </TableCell>
                              <TableCell className="dimensions">
                                {theme.size}
                              </TableCell>
                              <TableCell>
                                {themeDpi || effectiveDpi}
                              </TableCell>
                              <TableCell>
                                {type}
                              </TableCell>
                              <TableCell className="actions">
                                <ActionButtonsGroup>
                                  <ActionButton
                                    className="edit"
                                    active={isActive}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectAndCloseSavedSize(theme);
                                    }}
                                    title="Use this size"
                                  >
                                    <FaEdit />
                                    <span className="d-none d-md-inline ms-1">Edit</span>
                                  </ActionButton>
                                  <ActionButton
                                    className="convert"
                                    active={isActive}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openConvertModal(theme);
                                    }}
                                    title="Convert to new size"
                                  >
                                    <FaSync />
                                    <span className="d-none d-md-inline ms-1">Convert Size to New Size</span>
                                  </ActionButton>
                                  <ActionButton
                                    className="delete"
                                    active={isActive}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(theme);
                                    }}
                                    title="Delete this size"
                                  >
                                    <FaTrash />
                                  </ActionButton>
                                </ActionButtonsGroup>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Durable AppData custom sizes (persist across reload/reopen),
                            shown alongside the theme's own sizes. Deduped against the
                            theme variants above by size@dpi so an identical size never
                            appears twice. Not tied to a server theme → no bulk-select. */}
                        {extraCustomSizes.map((size) => {
                          const width = Number(size.width);
                          const height = Number(size.height);
                          const effectiveDpi = parseInt(size.dpi || 200, 10) || 200;
                          const pxToInches = (value) => (value && effectiveDpi ? value / effectiveDpi : 0);
                          const inchWidth = pxToInches(width);
                          const inchHeight = pxToInches(height);
                          const type = getSizeOrientation(width, height, activeEditorType, settings);
                          const normalizedDisplayDpi = parseInt(displaySize.dpi, 10) || 200;
                          const isActive =
                            Number(displaySize.width) === width &&
                            Number(displaySize.height) === height &&
                            normalizedDisplayDpi === effectiveDpi;

                          return (
                            <TableRow
                              key={size.id}
                              active={isActive}
                              onClick={() => {
                                setDisplaySize({
                                  width: width,
                                  height: height,
                                  depth: 0,
                                  safeMargin: size.safeMargin ? parseFloat(size.safeMargin) : 0,
                                  bleedMargin: size.bleedMargin ? parseFloat(size.bleedMargin) : 0,
                                  dpi: effectiveDpi,
                                });
                              }}
                            >
                              <CheckboxCell onClick={(e) => e.stopPropagation()} />
                              <TableCell className="size-label">
                                {Number(inchWidth.toFixed(1))} × {Number(inchHeight.toFixed(1))}
                              </TableCell>
                              <TableCell className="dimensions">
                                {`${Math.round(width)}x${Math.round(height)}`}
                              </TableCell>
                              <TableCell>
                                {effectiveDpi}
                              </TableCell>
                              <TableCell>
                                {type} <SectionBadge style={{ marginLeft: 4 }}>Custom</SectionBadge>
                              </TableCell>
                              <TableCell className="actions">
                                <ActionButtonsGroup>
                                  <ActionButton
                                    className="edit"
                                    active={isActive}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applyCustomSizeRow(size);
                                    }}
                                    title="Use this size"
                                  >
                                    <FaEdit />
                                    <span className="d-none d-md-inline ms-1">Edit</span>
                                  </ActionButton>
                                  <ActionButton
                                    className="convert"
                                    active={isActive}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openConvertModalForCustomSize(size);
                                    }}
                                    title="Convert to new size"
                                  >
                                    <FaSync />
                                    <span className="d-none d-md-inline ms-1">Convert Size to New Size</span>
                                  </ActionButton>
                                  <ActionButton
                                    className="delete"
                                    active={isActive}
                                    onClick={(e) => deleteCustomSizeRow(e, size)}
                                    title="Delete this size"
                                  >
                                    <FaTrash />
                                  </ActionButton>
                                </ActionButtonsGroup>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </tbody>
                    </SizesTable>
                  </SizesTableWrapper>
                </SectionCard>
              )}
            </Container>
          </SizeSettingsBodyWrapper>
        </PhotoModalBodyStyled>
      </PhotoModalStyled>

      {/* Convert Size Modal */}
      {showConvertModal && convertSourceTheme && (
        <ConvertModalOverlay>
          <ConvertModalContent onClick={(e) => e.stopPropagation()}>
            <ConvertModalTitle>
              <FaSync size={18} />
              Convert to New Sizes
            </ConvertModalTitle>

            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--background, #f3f4f6)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--foreground, #6b7280)' }}>Converting from:</span>
              <div style={{ fontWeight: '600', color: 'var(--primary, #4084b5)' }}>
                {convertSourceTheme.size}
                {/* ({(convertSourceTheme.width - (convertSourceTheme.depth || 0) * 2) / 200} × {(convertSourceTheme.height - (convertSourceTheme.depth || 0) * 2) / 200} inches) */}
              </div>
            </div>

            {/* Row 1: Unit + DPI side-by-side */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <ConvertModalLabel>Unit</ConvertModalLabel>
                <select
                  value={convertUnit}
                  onChange={(e) => handleConvertUnitChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#fff' }}
                >
                  {PRINT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <ConvertModalLabel>
                  DPI
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id="resolution-tooltip">
                        <strong>Resolution:</strong> Controls how pixels map to physical size.
                        Common values: 72 (screen/web), 96 (Windows screen),
                        150 (standard print), 300 (high-quality print).
                      </Tooltip>
                    }
                  >
                    <span
                      style={{
                        cursor: "help",
                        marginLeft: "4px",
                        color: "var(--primary)",
                      }}
                    >
                      <AiFillInfoCircle size={13} />
                    </span>
                  </OverlayTrigger>
                </ConvertModalLabel>
                <ConvertModalInput
                  type="number"
                  value={convertDpi}
                  onChange={(e) => setConvertDpi(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="200"
                  min={1}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Row 2: Product size picker (fetched from API) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <ConvertModalLabel style={{ margin: 0 }}>
                  Product sizes{selectedProductSizeIds.length > 0 ? ` · ${selectedProductSizeIds.length} selected` : ''}
                </ConvertModalLabel>
                {isBookEditor && (
                  <span style={{ fontSize: '11px', color: 'var(--primary, #4084b5)', background: 'color-mix(in srgb, var(--primary, #4084b5) 10%, #fff)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    width × 2 spread
                  </span>
                )}
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <FaSearch size={12} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={productSizeSearch}
                  onChange={(e) => setProductSizeSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Search by name or dimensions…"
                  style={{ width: '100%', padding: '7px 30px 7px 32px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#fff' }}
                />
                {productSizeSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSizeSearch('')}
                    title="Clear search"
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: '2px' }}
                  >
                    ×
                  </button>
                )}
              </div>

              {loadingProductSizes ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--foreground, #6b7280)' }}>
                  Loading sizes…
                </div>
              ) : productSizes.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', fontSize: '13px', color: 'var(--foreground, #6b7280)', border: '1px dashed #e5e7eb', borderRadius: '10px' }}>
                  No product sizes available
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--foreground, #9ca3af)' }}>
                      {filteredProductSizes.length} size{filteredProductSizes.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      disabled={filteredProductSizes.length === 0}
                      style={{ border: 'none', background: 'transparent', color: 'var(--primary, #4084b5)', fontSize: '12px', fontWeight: 600, cursor: filteredProductSizes.length === 0 ? 'not-allowed' : 'pointer', padding: 0 }}
                    >
                      {allVisibleSelected ? 'Clear selection' : 'Select all'}
                    </button>
                  </div>
                  <ProductSizesContainer>
                    {filteredProductSizes.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--foreground, #9ca3af)' }}>
                        No sizes match “{productSizeSearch}”
                      </div>
                    ) : filteredProductSizes.map((s) => {
                      const { widthPx, heightPx } = productSizeToTargetPx(s);
                      const selected = selectedProductSizeIds.includes(s._id);
                      return (
                        <label
                          key={s._id}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '9px',
                            padding: '6px 10px', cursor: 'pointer', margin: 0,
                            borderBottom: '1px solid #f1f3f5',
                            background: selected ? 'color-mix(in srgb, var(--primary, #4084b5) 8%, #fff)' : '#fff',
                            transition: 'background 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleProductSize(s._id)}
                            style={{ width: '15px', height: '15px', flexShrink: 0, accentColor: 'var(--primary, #4084b5)' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--foreground, #374151)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                              {s.name || `${parseFloat(s.width)}×${parseFloat(s.height)}`}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--foreground, #6b7280)', lineHeight: 1.3 }}>
                              {fmtInConvertUnit(parseFloat(s.width))}×{fmtInConvertUnit(parseFloat(s.height))} {convertUnitShort}
                              {isBookEditor && (
                                <span style={{ color: 'var(--primary, #4084b5)', fontWeight: 600 }}>
                                  {' '}→ {fmtInConvertUnit(widthPx)}×{fmtInConvertUnit(heightPx)} {convertUnitShort}
                                </span>
                              )}
                            </div>
                          </div>
                          {s.orientation ? (
                            <span style={{ fontSize: '9.5px', textTransform: 'capitalize', color: '#9ca3af', border: '1px solid #eef0f2', borderRadius: '6px', padding: '1px 6px', flexShrink: 0 }}>
                              {s.orientation}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </ProductSizesContainer>
                </>
              )}
            </div>

            {/* Row 2b: Optional custom sizes — one or more manual Width × Height rows */}
            <div style={{ marginBottom: '4px' }}>
              <ConvertModalLabel>Or add custom sizes ({convertUnit})</ConvertModalLabel>
              {multiTargets.map((row, idx) => {
                const { widthPx, heightPx } = resolveTargetRowPx(row);
                return (
                  <div key={idx} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <ConvertModalInput
                        type="number"
                        value={row.width}
                        onChange={(e) => updateTargetRow(idx, 'width', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder={convertUnit === 'px' ? 'Width e.g. 2400' : 'Width'}
                        min={0}
                        step={convertUnit === 'px' ? 1 : 0.001}
                        autoComplete="off"
                        style={{ marginBottom: 0, flex: 1 }}
                      />
                      <span style={{ color: '#9ca3af', fontWeight: 600 }}>×</span>
                      <ConvertModalInput
                        type="number"
                        value={row.height}
                        onChange={(e) => updateTargetRow(idx, 'height', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder={convertUnit === 'px' ? 'Height e.g. 3600' : 'Height'}
                        min={0}
                        step={convertUnit === 'px' ? 1 : 0.001}
                        autoComplete="off"
                        style={{ marginBottom: 0, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeTargetRow(idx)}
                        disabled={multiTargets.length === 1}
                        title="Remove this size"
                        style={{
                          width: '32px', height: '34px', flexShrink: 0,
                          borderRadius: '8px', border: '1px solid #f2f2f2',
                          background: '#fff', color: '#111111',
                          cursor: multiTargets.length === 1 ? 'not-allowed' : 'pointer',
                          opacity: multiTargets.length === 1 ? 0.4 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                    {convertUnit !== 'px' && widthPx > 0 && heightPx > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--foreground, #6b7280)' }}>
                        ≈ {widthPx}×{heightPx}px
                      </span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addTargetRow}
                style={{
                  width: '100%', padding: '9px', marginTop: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  borderRadius: '8px', border: '1px dashed var(--primary, #4084b5)',
                  background: 'color-mix(in srgb, var(--primary, #4084b5) 5%, transparent)',
                  color: 'var(--primary, #4084b5)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Add another size
              </button>
            </div>

            {/* Row 3: Bleed + Safe Margin — unit-aware like width/height */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <ConvertModalLabel>
                  Bleed Margin
                  <OverlayTrigger placement="top" overlay={<Tooltip id="convert-bleed-tip"><strong>Bleed Area:</strong> Extend backgrounds into this area — it will be trimmed.</Tooltip>}>
                    <span style={{ cursor: 'help', marginLeft: '4px', color: 'var(--primary)' }}><AiFillInfoCircle size={13} /></span>
                  </OverlayTrigger>
                </ConvertModalLabel>
                <ConvertModalInput
                  type="number"
                  value={convertBleedMargin}
                  onChange={(e) => handleConvertBleedMarginChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="0"
                  min={0}
                  step={convertUnit === 'px' ? 1 : 0.001}
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <ConvertModalLabel>
                  Trim Margin
                  <OverlayTrigger placement="top" overlay={<Tooltip id="convert-safe-tip"><strong>Trim Margin:</strong> Keep important content inside this margin.</Tooltip>}>
                    <span style={{ cursor: 'help', marginLeft: '4px', color: 'var(--primary)' }}><AiFillInfoCircle size={13} /></span>
                  </OverlayTrigger>
                </ConvertModalLabel>
                <ConvertModalInput
                  type="number"
                  value={convertSafeMargin}
                  onChange={(e) => handleConvertSafeMarginChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="0"
                  min={0}
                  step={convertUnit === 'px' ? 1 : 0.001}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Row 4: Shape (Custom Product / Print only) */}
            {(activeEditorType === EDITOR_TYPES.CUSTOME_PRODUCT || activeEditorType === EDITOR_TYPES.PRINT) && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <ConvertModalLabel>Shape</ConvertModalLabel>
                  <select
                    value={convertTargetShape}
                    onChange={(e) => setConvertTargetShape(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
              </div>
            )}

            <p style={{ fontSize: '11px', lineHeight: 1.35, color: 'var(--foreground, #6b7280)', margin: '10px 0 0' }}>
              Each target size is created as a new size — images and objects are scaled
              proportionally. The current canvas stays unchanged. Existing sizes are skipped.
            </p>

            <ConvertModalButtons>
              <ConvertModalButton className="secondary" onClick={closeConvertModal}>
                Cancel
              </ConvertModalButton>
              <ConvertModalButton className="primary" onClick={handleConvertMultipleSizes}>
                Generate Sizes
              </ConvertModalButton>
            </ConvertModalButtons>
          </ConvertModalContent>
        </ConvertModalOverlay>
      )}

      {activeEditorType === EDITOR_TYPES.CANVAS && (
        <CanvasGuideline
          show={isGuidelineVisible}
          onHide={() => {
            setIsGuidelineVisible(false);
          }}
        />
      )}

      {/* Delete Size Confirmation Dialog */}
      <ConfirmationDialog
        show={showDeleteDialog}
        onClose={cancelDeleteSize}
        onConfirm={confirmDeleteSize}
        title="Delete Size"
        message={`Are you sure you want to delete the size "${sizeToDelete?.size}"${sizeToDelete?.dpi ? ` (${sizeToDelete.dpi} DPI)` : ""}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={isDeleting}
      />

      <ConfirmationDialog
        show={showMultiDeleteDialog}
        onClose={() => setShowMultiDeleteDialog(false)}
        onConfirm={confirmMultiDelete}
        title={`Delete ${selectedSizes.length} Sizes`}
        message={`Are you sure you want to delete ${selectedSizes.length} selected sizes? This action cannot be undone.`}
        confirmText="Delete Selected"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={isDeletingMultiple}
      />

      <ConfirmationDialog
        show={showMultiConvertDialog}
        onClose={() => setShowMultiConvertDialog(false)}
        onConfirm={confirmMultiConvertDpi}
        title={`Scale ${selectedSizes.length === 0 ? allThemes.length : selectedSizes.length} Sizes to New Configurations`}
        message={`Current sizes will be kept. New sizes will be generated by preserving the physical inches size and multiplying by the target DPI. Enter optional safe/bleed margins to apply them across all selected sizes.`}
        showInput={false}
        inputs={[
          {
            name: "unit",
            label: "Unit for Margins",
            type: "select",
            defaultValue: "px",
            options: PRINT_UNITS.map(u => ({ value: u.value, label: u.label })),
            required: true
          },
          {
            name: "dpi",
            label: "Target DPI (Required)",
            type: "number",
            placeholder: "e.g., 300",
            defaultValue: "300",
            required: true,
            min: 1
          },
          {
            name: "safeMargin",
            label: "Safe Margin / Trim (Optional)",
            type: "number",
            placeholder: "Leave empty to keep original",
            defaultValue: "",
            required: false,
            min: 0,
            step: 0.001
          },
          {
            name: "bleedMargin",
            label: "Bleed Margin (Optional)",
            type: "number",
            placeholder: "Leave empty to keep original",
            defaultValue: "",
            required: false,
            min: 0,
            step: 0.001
          }
        ]}
        confirmText="Generate New Sizes"
        cancelText="Cancel"
        confirmVariant="primary"
      />
    </>
  );
};
