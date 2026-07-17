/**
 * CreateNewDesignModal — cohesive "New Theme" / "New Design" modal shown on the dashboard.
 * Allows the user to select the Editor Type (e.g. photobook, calendar, canvas), select a size
 * from predefined recommended sizes or previously used/custom sizes, name their design, and
 * optionally define new custom sizes.
 *
 * It intercepts the creation:
 * - Admins/employees: Saves the theme to the backend API (saveAsTheme) and navigates with t_id.
 * - Customers: Creates the design locally in their Saved Designs library and navigates with restore=1.
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { FaTimes, FaCheck, FaArrowRight, FaInfoCircle, FaSearch, FaFolderOpen } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { store } from "../../store/store.jsx";
import {
  PRINT_UNITS,
  DEFAULT_DPI,
  convertToPixels,
  convertPixelsToUnit,
  getPreferredUnit,
  setPreferredUnit,
  formatInchesLabel,
} from "../../library/utils/common-functions/unitConversion";
import {
  getCustomSizes,
  addCustomSize,
  initCustomSizes,
  subscribeCustomSizes,
} from "../../library/utils/helpers/customSizes";
import {
  EDITOR_TYPES,
  EDITOR_SUB_TYPES,
  EDITOR_ASSETS,
  USER_TYPES,
  EDITOR_ASSETS_TYPES,
} from "../../library/utils/constants";
import {
  setThemeId,
  setThemeName,
  setAllThemes,
  setEditorPages,
  resetThemeDetails,
  setThemeApplied,
} from "../../store/slices/projectSetup.js";
import { setCanvasSize, setEditorType, setSettings, applyTheme, setPageNumber } from "../../store/slices/canvas.js";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import {
  generateRandomLayoutPages,
  BLANK_THEME_MAX_PAGES,
  BLANK_THEME_MIN_PAGES,
  BLANK_THEME_MAX_IMAGES,
  isBlankGeneratorSupported,
} from "../../library/utils/helpers/blankThemeGenerator";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { compressData } from "../../library/utils/common-functions";
import {
  deriveDesignId,
  saveDesignToLibrary,
  ensureActiveLocalDesignId,
  listSavedDesigns,
  stageDesignForRestore,
  getDesignById,
} from "../../library/utils/helpers/savedDesigns";
import { stageSnapshotFromEntry } from "../../library/utils/helpers/editorSnapshot";
import { blankImageUrls } from "../../library/utils/helpers/blankImages";
import { generateDesignThumbnail } from "../../library/utils/helpers/designThumbnail";
import { getUrlParam, readStoredUser } from "../../library/utils/helpers/session";
import { tokens, PrimaryButton, GhostButton } from "./styles";
import { recommendedSizes } from "../popups/SizeSettingsPopup.jsx";
import {
  COVER_TOGGLES,
  supportsCoverSettings,
  readCoverSettings,
  isCoverToggleVisible,
  reconcileCoverSettings,
} from "../../library/utils/jsons/coverSettingsConfig.js";
import { getSizeOrientation } from "../../library/utils/helpers/orientation.js";
import { scaleSourcePagesToTarget } from "../../library/utils/common-functions/scaleDesignPages.js";
import BlankImagePlaceholder from "../../assets/images/blankImagePlaceholder.png";
import DesignThumbnail from "../../common-components/DesignThumbnail";

// Contextual product sub-type selectors, mirroring the web CreateThemeDialog.
// Picking a Product Type that has sub-types (Calendar → Wall/Wooden/Mountain,
// Acrylic, Custom Product, Greeting Card, Photobook) reveals a second dropdown
// so the chosen `subtype` can be saved into the theme's settings. Keyed by the
// EDITOR_TYPES value; `subKey` indexes into EDITOR_SUB_TYPES.
const SUBTYPE_FIELDS = {
  [EDITOR_TYPES.CALENDER]: { subKey: "CALENDER", label: "Calendar Type", placeholder: "Select Calendar Type" },
  [EDITOR_TYPES.ACRYLIC]: { subKey: "ACRYLIC", label: "Acrylic Type", placeholder: "Select Acrylic Type" },
  [EDITOR_TYPES.CUSTOME_PRODUCT]: { subKey: "CUSTOME_PRODUCT", label: "Product Type", placeholder: "Select Product Type" },
  [EDITOR_TYPES.GREETING_CARD]: { subKey: "GREETING_CARD", label: "Greeting Card Type", placeholder: "Select Card Type" },
  [EDITOR_TYPES.PHOTOBOOK]: { subKey: "PHOTOBOOK", label: "Photobook Type", placeholder: "Select Photobook Type" },
};

// snake_case value → "Title Case" label (same transform the web dialog uses).
const prettifySubType = (v) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const customToSize = (s) => ({
  key: s.id,
  id: s.id,
  kind: "custom",
  width: s.width,
  height: s.height,
  dpi: s.dpi || DEFAULT_DPI,
  depth: 0,
  safeMargin: s.safeMargin || 0,
  bleedMargin: s.bleedMargin || 0,
  label: formatInchesLabel(s.width, s.height, s.dpi || DEFAULT_DPI),
  unit: s.unit || "px",
});

// ── styles ────────────────────────────────────────────────────────────────────
const fade = keyframes`from { opacity: 0 } to { opacity: 1 }`;
const pop = keyframes`from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none }`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  animation: ${fade} 0.18s ease;
`;

const Card = styled.div`
  width: 100%;
  max-width: 780px;
  max-height: min(95vh, 850px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${tokens.line};
  animation: ${pop} 0.22s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid ${tokens.line};
`;

const HeadTitle = styled.div`
  h3 {
    margin: 0 0 3px;
    font-size: 18px;
    font-weight: 700;
    color: ${tokens.ink};
    letter-spacing: -0.3px;
  }
  p {
    margin: 0;
    font-size: 13px;
    color: ${tokens.muted};
  }
`;

const IconBtn = styled.button`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: none;
  background: ${tokens.hover};
  color: ${tokens.muted};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { background: #e6e6e6; color: ${tokens.ink2}; }
`;

const Body = styled.div`
  padding: 18px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 700;
  color: ${tokens.ink2};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 9px;
  border: 1.5px solid ${tokens.line};
  font-size: 14px;
  outline: none;
  color: ${tokens.ink};
  transition: border-color 0.18s;
  &:focus {
    border-color: ${tokens.primary};
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 14px;
  border-radius: 9px;
  border: 1.5px solid ${tokens.line};
  font-size: 14px;
  outline: none;
  color: ${tokens.ink};
  background-color: #fff;
  cursor: pointer;
  transition: border-color 0.18s;
  &:focus {
    border-color: ${tokens.primary};
  }
`;

const SectionLabel = styled.div`
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${tokens.muted};
  margin: 6px 0 10px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 10px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: ${tokens.muted};
  input, select {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1.5px solid ${tokens.line};
    font-size: 12px;
    outline: none;
    background-color: #fff;
    &:focus { border-color: ${tokens.primary}; }
  }
`;

// A grouped settings card + toggle-switch rows — a professional, scannable way
// to present the cover/spine options (title + description + switch) instead of a
// flat list of bare checkboxes.
const SettingsCard = styled.div`
  border: 1px solid ${tokens.line};
  border-radius: 12px;
  background: #fafbfc;
  padding: 2px 14px;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  margin: 0;
  cursor: pointer;
  & + & { border-top: 1px solid ${tokens.line}; }
`;

const ToggleText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  .t-title { font-size: 13.5px; font-weight: 600; color: ${tokens.ink}; }
  .t-desc { font-size: 12px; color: ${tokens.muted}; line-height: 1.35; }
`;

const Switch = styled.span`
  flex-shrink: 0;
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: ${(p) => (p.$on ? tokens.primary : "#cfd4da")};
  transition: background 0.18s ease;
  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$on ? "20px" : "2px")};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.18s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
`;

const FormError = styled.span`
  font-size: 12px;
  color: ${tokens.ink};
  font-weight: 600;
`;

const FieldError = styled.span`
  font-size: 11px;
  color: ${tokens.ink};
  font-weight: 600;
  margin-top: 2px;
  display: block;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-top: 1px solid ${tokens.line};
  background: ${tokens.surfaceAlt};
`;

const FootHint = styled.span`
  font-size: 12.5px;
  color: ${tokens.muted};
  max-width: 60%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InfoBox = styled.div`
  background: ${tokens.primarySoft};
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 12.5px;
  color: ${tokens.ink2};
  line-height: 1.4;
  svg {
    color: ${tokens.primary};
    margin-top: 2px;
    flex-shrink: 0;
  }
`;

// ── Saved-project browser styles ──────────────────────────────────────────────
const ProjectsSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${tokens.surfaceAlt};
  border: 1.5px solid ${tokens.line};
  border-radius: 9px;
  padding: 8px 12px;
  transition: border-color 0.18s;
  &:focus-within { border-color: ${tokens.primary}; background: #fff; }
  svg { color: ${tokens.muted}; flex-shrink: 0; }
`;

const ProjectsSearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: ${tokens.ink};
  &::placeholder { color: ${tokens.faint}; }
`;

const ProjectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
  gap: 6px;
  max-height: 150px;
  overflow-y: auto;
  padding: 2px;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 4px; }
`;

const ProjectCard = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  border-radius: 6px;
  border: 1.5px solid ${(p) => (p.$active ? tokens.primary : tokens.line)};
  background: ${(p) => (p.$active ? tokens.primarySoft : "#fff")};
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: border-color 0.16s, background 0.16s;
  &:hover {
    border-color: ${(p) => (p.$active ? tokens.primary : "#c4c4c4")};
    background: ${(p) => (p.$active ? tokens.primarySoft : tokens.hover)};
  }
`;

const ProjectInfo = styled.div`
  padding: 4px 6px;
  border-top: 1px solid ${tokens.line};
`;

const ProjectName = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${tokens.ink};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectMeta = styled.div`
  font-size: 8.5px;
  color: ${tokens.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
`;

const ProjectSelectedTick = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${tokens.primary};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SectionDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${tokens.muted};
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 4px 0;
  &::before, &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${tokens.line};
  }
`;

const TipBox = styled.div`
  background: ${tokens.surfaceAlt};
  border: 1px solid ${tokens.line};
  border-radius: 8px;
  padding: 9px 13px;
  display: flex;
  gap: 9px;
  align-items: flex-start;
  font-size: 12px;
  color: ${tokens.ink2};
  line-height: 1.45;
  svg { color: ${tokens.ink}; margin-top: 1px; flex-shrink: 0; }
`;

const ProjectsEmptyState = styled.div`
  padding: 20px 12px;
  text-align: center;
  font-size: 12.5px;
  color: ${tokens.muted};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  svg { color: ${tokens.faint}; }
`;

const CreateNewDesignModal = ({ show, onClose, user, initialCategory, mode }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [selectedEditorType, setSelectedEditorType] = useState(
    initialCategory?.type || EDITOR_TYPES.CALENDER
  );
  // Contextual sub-type (e.g. "wall_calendar") for product types that have one.
  const [selectedEditorSubType, setSelectedEditorSubType] = useState("");
  const subTypeField = SUBTYPE_FIELDS[selectedEditorType];
  // Print & Custom Product designs carry a cut/canvas shape (rectangle | circle),
  // mirroring the web CreateThemeDialog. Other product types have no shape field.
  const isShapeProduct =
    selectedEditorType === EDITOR_TYPES.PRINT ||
    selectedEditorType === EDITOR_TYPES.CUSTOME_PRODUCT;

  // ── Random-layout generation (photobook / layflat only) ──────────────────────
  // When on, the new blank design is filled with a random layout on every page
  // instead of a single empty page. Opened via the "Blank" card (mode="random").
  const isSpreadCategory =
    selectedEditorType === EDITOR_TYPES.PHOTOBOOK ||
    selectedEditorType === EDITOR_TYPES.LAYFLATALBUM;
  // Opened via the "Blank" card → pure blank-generator flow. In this mode we hide
  // the "Your saved projects" template browser entirely; the user only wants the
  // blank-theme options.
  const isBlankMode = mode === "random";
  const [randomLayoutsOn, setRandomLayoutsOn] = useState(false);
  const [blankPageCount, setBlankPageCount] = useState(6);
  const [blankMinImages, setBlankMinImages] = useState(1);
  const [blankMaxImages, setBlankMaxImages] = useState(3);
  // Both photobook and layflat are spread-based, so always call the unit a "spread".
  const spreadNoun = "spread";

  // ── Cover & Spine settings (photobook / layflat) ─────────────────────────────
  // All admin cover flags (coverEnabled/showFullCoverSheet/hideLastCover/
  // exportSpine) staged together; combos are reconciled to match the setSettings
  // reducer. paperThickness (px/sheet) drives the auto spine width when full cover
  // is on. These are persisted into the new theme's settings.
  const [coverSettings, setCoverSettings] = useState(readCoverSettings());
  // Paper thickness is a PHYSICAL measurement entered in the SHARED size `unit`
  // (seeded from localStorage via getPreferredUnit) so cover/spine and the size
  // fields always read in the same unit. The entered value is the source of truth
  // and px is derived at the design's DPI, keeping thickness constant if DPI/size
  // change.
  const [paperThicknessStr, setPaperThicknessStr] = useState(""); // value in `unit`
  const handleCoverToggle = (key, value) => {
    setCoverSettings((prev) => reconcileCoverSettings(selectedEditorType, prev, key, value));
    if ((key === "showFullCoverSheet" || key === "coverEnabled") && !value) {
      setPaperThicknessStr("");
    }
  };

  // The modal is mounted once (only its render is gated on `show`), so sync the
  // editor type to the browsed category each time it opens — otherwise the initial
  // state goes stale across category changes.
  useEffect(() => {
    if (show && initialCategory?.type) {
      setSelectedEditorType(initialCategory.type);
      setSelectedEditorSubType(""); // sub-type is per product type — reset on switch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initialCategory]);

  // Pre-enable when opened from the "Blank" card on a spread category; reset when
  // the modal closes or the type is no longer spread-based. Also reset cover/spine
  // settings for a clean fresh design (each type gets its own defaults, all off).
  useEffect(() => {
    setCoverSettings(readCoverSettings());
    setPaperThicknessStr("");
    if (!show) {
      setRandomLayoutsOn(false);
      return;
    }
    if (mode === "random" && isSpreadCategory) setRandomLayoutsOn(true);
    else if (!isSpreadCategory) setRandomLayoutsOn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mode, selectedEditorType]);

  // Validation error states
  const [nameError, setNameError] = useState("");
  const [sizeError, setSizeError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const reduxUser = useSelector((state) => state.projectSetup.userDetails);
  const activeUser = reduxUser || user || readStoredUser();

  // Custom sizes state
  const [customs, setCustoms] = useState(() => getCustomSizes().map(customToSize));
  const [selectedKey, setSelectedKey] = useState(null);

  // Always-visible manual size fields — the source of truth for the size to
  // create. Width/Height are raw strings in `unit`; DPI is its own string. The
  // predefined dropdown and "previously used" tiles just fill these fields, so a
  // user can pick a preset OR type a size directly without any extra toggle.
  const [mWidth, setMWidth] = useState("");
  const [mHeight, setMHeight] = useState("");
  const [mDpi, setMDpi] = useState(String(DEFAULT_DPI));
  // Margins carried over from a chosen preset (px); a hand-typed size has none.
  const [presetMargins, setPresetMargins] = useState({ safe: 0, bleed: 0 });

  // Default to the saved unit preference, falling back to inches (NOT px).
  const [unit, setUnit] = useState(() => getPreferredUnit("in"));
  // Cut/canvas shape for Print & Custom Product (rectangle | circle). Only used
  // when isShapeProduct; harmless default for every other product type.
  const [shape, setShape] = useState("rectangle");
  const [isSaving, setIsSaving] = useState(false);

  // Sync / initialize custom sizes
  useEffect(() => {
    initCustomSizes().then((list) => {
      if (Array.isArray(list)) setCustoms(list.map(customToSize));
    });
    return subscribeCustomSizes((list) => {
      setCustoms(list.map(customToSize));
    });
  }, []);

  // Set default selected key if recommendedSizes has options
  const predefined = useMemo(() => {
    return recommendedSizes.map((s, i) => ({
      key: `rec_${i}_${s.width}x${s.height}`,
      kind: "predefined",
      width: s.width,
      height: s.height,
      dpi: DEFAULT_DPI,
      depth: 0,
      safeMargin: 0,
      bleedMargin: 0,
      label: s.label || `${s.width} × ${s.height} px`,
      unit: "px",
    }));
  }, []);

  // Clear size error when a size is selected
  useEffect(() => {
    if (selectedKey) {
      setSizeError("");
      setGeneralError("");
    }
  }, [selectedKey]);

  // Reset the size fields when the modal closes so each open starts fresh.
  useEffect(() => {
    if (!show) {
      setMWidth("");
      setMHeight("");
      setMDpi(String(DEFAULT_DPI));
      setSelectedKey(null);
      setPresetMargins({ safe: 0, bleed: 0 });
    }
  }, [show]);

  // ── Saved projects state ────────────────────────────────────────────────────
  const [savedProjects, setSavedProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  // Load saved designs whenever modal is opened
  useEffect(() => {
    if (!show) return;
    setProjectsLoading(true);
    setSelectedProject(null);
    listSavedDesigns()
      .then((list) => setSavedProjects(list || []))
      .catch(() => setSavedProjects([]))
      .finally(() => setProjectsLoading(false));
  }, [show]);

  // A template can only be created into a COMPATIBLE editor type — creating keeps
  // the template's OWN type (a photobook template stays a photobook), so listing a
  // calendar template while browsing photobook would silently create a calendar.
  // Compatible = same type, OR both in the spread group {photobook, layflat}
  // (interchangeable products that co-list). Legacy entries with no stored type are
  // kept (they fall back to the current category on create). Mirrors the editor-type
  // gating the ProjectsList reuse flow already applies.
  const isTemplateCompatible = (t) => {
    const type = t?.editorType;
    if (!type) return true;
    return (
      type === selectedEditorType ||
      (isBlankGeneratorSupported(type) && isBlankGeneratorSupported(selectedEditorType))
    );
  };

  const filteredProjects = useMemo(() => {
    const byType = savedProjects.filter(isTemplateCompatible);
    const q = projectSearch.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.size || "").toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjects, projectSearch, selectedEditorType]);

  // Switching the Product Type can make a selected template incompatible (e.g. a
  // calendar template selected, then switched to photobook). Drop the selection so
  // "Create from Template" can't create an off-type design from a hidden template.
  useEffect(() => {
    if (selectedProject && !isTemplateCompatible(selectedProject)) {
      setSelectedProject(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEditorType]);

  // Tracks the most recently clicked template id so a slow full-entry load for an
  // earlier click can't overwrite the pre-fill of a later one (fast re-clicks).
  const selectRequestRef = useRef(null);
  // Set to the template id once its settings/size have actually been pre-filled
  // into the dialog. handleCreateFromTemplate merges the dialog's cover toggles
  // back into the new design ONLY when this matches — so a failed pre-fill can't
  // clobber the template's own cover config with the dialog's default-off flags.
  const prefilledIdRef = useRef(null);

  const handleSelectProject = async (proj) => {
    if (selectedProject?.id === proj.id) {
      // Deselect on second click
      setSelectedProject(null);
      selectRequestRef.current = null;
      return;
    }
    setSelectedProject(proj);
    // Pre-fill name from the project
    setName(proj.name || "");
    if (proj.name?.trim()) setNameError("");

    // Auto-select the template's OWN cover/spine settings + size so the dialog
    // mirrors what the template actually has (the user can then tweak any of it).
    // The list meta doesn't carry settings/canvasSize, so load the full entry.
    selectRequestRef.current = proj.id;
    try {
      const entry = await getDesignById(proj.id);
      if (!entry || selectRequestRef.current !== proj.id) return; // superseded
      const cs = entry.canvasSize;
      const tplDpi = Math.max(1, Math.round(Number(cs?.dpi) || DEFAULT_DPI));
      if (entry.settings) {
        setCoverSettings(readCoverSettings(entry.settings));
        const px = Number(entry.settings.paperThickness) || 0;
        setPaperThicknessStr(
          px > 0 ? String(convertPixelsToUnit(px, unit, tplDpi) || "") : ""
        );
      }
      if (cs && Number(cs.width) > 0 && Number(cs.height) > 0) {
        fillSizeFields({
          width: Number(cs.width),
          height: Number(cs.height),
          dpi: Number(cs.dpi) || DEFAULT_DPI,
          safeMargin: Number(cs.safeMargin) || 0,
          bleedMargin: Number(cs.bleedMargin) || 0,
        });
      }
      prefilledIdRef.current = proj.id;
    } catch (_) {
      // Best-effort pre-fill — the user can still set everything manually.
    }
  };

  const handleCreateFromTemplate = async () => {
    setNameError("");
    setGeneralError("");

    // Require a name for the new design
    if (!name.trim()) {
      setNameError("Please enter a name for the new design");
      return;
    }

    setIsSaving(true);
    try {
      // Load the full template design (pages decoded)
      const entry = await getDesignById(selectedProject.id);
      if (!entry || !Array.isArray(entry.pages) || entry.pages.length === 0) {
        setGeneralError("Could not load the selected project. Please try again.");
        setIsSaving(false);
        return;
      }

      // Blank all image URLs so the user starts fresh with just the layout
      let finalPages = blankImageUrls(entry.pages);

      // Template's own canvas size + editor type (source of the scale).
      const sourceCanvas = entry.canvasSize || selectedProject.canvasSize || null;
      const templateEditorType =
        entry.editorType || selectedProject.editorType || selectedEditorType;
      const sourceWidth = Number(sourceCanvas?.width) || 0;
      const sourceHeight = Number(sourceCanvas?.height) || 0;

      // If the user chose a size, CONVERT the template's pages to it — scaling
      // text + images exactly like the Manage-Size "Convert" button
      // (scaleSourcePagesToTarget, halving both widths for photobook per-page
      // space). If NO size was chosen (selectedSize is null), keep the template's
      // own size untouched.
      let finalCanvasSize = sourceCanvas;
      let finalOrientation = entry.orientation || selectedProject.orientation || null;

      if (selectedSize && sourceWidth > 0 && sourceHeight > 0) {
        const targetWidth = Number(selectedSize.width);
        const targetHeight = Number(selectedSize.height);

        let adjSourceW = sourceWidth;
        let adjTargetW = targetWidth;
        if (templateEditorType === EDITOR_TYPES.PHOTOBOOK) {
          adjSourceW /= 2;
          adjTargetW /= 2;
        }

        finalPages = scaleSourcePagesToTarget(
          finalPages,
          adjSourceW,
          sourceHeight,
          adjTargetW,
          targetHeight
        );

        finalCanvasSize = {
          ...(sourceCanvas || {}),
          width: targetWidth,
          height: targetHeight,
          dpi: selectedSize.dpi || sourceCanvas?.dpi || DEFAULT_DPI,
          safeMargin: Number(selectedSize.safeMargin) || sourceCanvas?.safeMargin || 0,
          bleedMargin: Number(selectedSize.bleedMargin) || sourceCanvas?.bleedMargin || 0,
          // The size CHANGED — drop any label the template carried for its old
          // size so the sidebar card / size readout shows the NEW dimensions
          // (displaySizeLabel prefers sizeLabel, else falls back to "W×H px").
          sizeLabel: null,
        };
        finalOrientation = getSizeOrientation(
          targetWidth,
          targetHeight,
          templateEditorType
        ).charAt(0);
      }

      // Remember the size this design was created at under "Your saved sizes" —
      // the template flow used to skip this (only the blank flow saved sizes), so
      // a size typed here vanished. Uses the SAME dedup as the blank path.
      await persistCustomSize({
        width: finalCanvasSize?.width,
        height: finalCanvasSize?.height,
        dpi: finalCanvasSize?.dpi,
        safeMargin: finalCanvasSize?.safeMargin,
        bleedMargin: finalCanvasSize?.bleedMargin,
      });

      // Derive a new local design ID (must be a fresh one, not the current session's)
      const rawId = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const newId = deriveDesignId({ localId: rawId });
      if (!newId) {
        setGeneralError("Error creating new design ID. Please try again.");
        setIsSaving(false);
        return;
      }

      // Re-compress the pages the same way saveDesignToLibrary expects
      const pages_c = compressData(JSON.stringify(finalPages));

      // Apply the dialog's cover/spine toggles ON TOP of the template's own
      // settings — but ONLY when the pre-fill actually loaded THIS template
      // (prefilledIdRef), so a failed pre-fill can't clobber the template's cover
      // config with the dialog's default-off flags. The pre-fill seeds coverSettings
      // from the template, so this is a no-op unless the user changed a toggle;
      // then their change wins. Same coverPayload shape handleCreate persists.
      const templateSettings = entry.settings || {};
      const finalSettings =
        prefilledIdRef.current === selectedProject.id &&
        supportsCoverSettings(templateEditorType)
          ? {
              ...templateSettings,
              coverEnabled: coverSettings.coverEnabled,
              showFullCoverSheet: coverSettings.showFullCoverSheet,
              hideLastCover: coverSettings.hideLastCover,
              exportSpine: coverSettings.exportSpine,
              paperThickness: paperThicknessPx,
              spineWidth: spineWidthPx,
            }
          : templateSettings;

      // Save as a brand-new design entry, inheriting canvas settings from the template
      await saveDesignToLibrary(
        {
          id: newId,
          thumbnail: null, // no thumbnail yet — editor will generate one on first save
          pages: finalPages,
          pages_c,
          canvasSize: finalCanvasSize,
          editorType: templateEditorType,
          orientation: finalOrientation,
          settings: finalSettings,
          calendarSettings: entry.calendarSettings || null,
          minPages: entry.minPages || 1,
          maxPages: entry.maxPages || 100,
          activeSide: entry.activeSide || "front",
          textGroups: entry.textGroups || null,
          themeImagesBlanked: true,
          themeId: null,
          themeName: name.trim(),
          cartOrderId: null,
          cat: entry.cat || initialCategory?.type || null,
        },
        // allowEmpty: creating from a template is an explicit user action — the new
        // design must open even when the template itself has no content yet (an
        // empty layout). Without this, a blank template can't be created/opened
        // ("Design was saved but could not be opened").
        { allowEmpty: true }
      );

      // Stage the new design for restore and navigate to the editor
      const staged = await stageDesignForRestore(newId);
      if (!staged) {
        setGeneralError("Design was saved but could not be opened. Please try again.");
        setIsSaving(false);
        return;
      }

      toast.success(`Design "${name.trim()}" created from template!`, {
        position: "top-center",
        autoClose: 2000,
      });

      onClose();
      const userToken = getUrlParam(location.search, "u_id") || activeUser?.token || "";
      navigate(`/?u_id=${encodeURIComponent(userToken)}&restore=1`);
    } catch (err) {
      setGeneralError("Error creating design from template. Please try again.");
      setIsSaving(false);
    }
  };

  // Combine recommended and custom sizes for lookup
  const allByKey = useMemo(() => {
    const map = {};
    predefined.forEach((s) => {
      map[s.key] = s;
    });
    customs.forEach((s) => {
      map[s.key] = s;
    });
    return map;
  }, [predefined, customs]);

  // Effective size for creation, built from the always-visible manual fields.
  // Null until both dimensions are valid (drives the "select a size" validation).
  const mDpiNum = Math.max(1, Math.round(Number(mDpi) || DEFAULT_DPI));
  const mWidthPx = mWidth !== "" ? convertToPixels(mWidth, unit, mDpiNum) || 0 : 0;
  const mHeightPx = mHeight !== "" ? convertToPixels(mHeight, unit, mDpiNum) || 0 : 0;
  const selectedSize =
    mWidthPx > 0 && mHeightPx > 0
      ? {
          key: "manual",
          kind: "manual",
          width: mWidthPx,
          height: mHeightPx,
          dpi: mDpiNum,
          depth: 0,
          safeMargin: presetMargins.safe,
          bleedMargin: presetMargins.bleed,
          label: formatInchesLabel(mWidthPx, mHeightPx, mDpiNum),
        }
      : null;

  // Fill the manual fields from a chosen preset (predefined size or saved tile),
  // converting its px dimensions into the currently selected unit.
  const fillSizeFields = (s) => {
    if (!s) return;
    const dpiN = Math.max(1, Math.round(Number(s.dpi) || DEFAULT_DPI));
    setMDpi(String(dpiN));
    setMWidth(String(unit === "px" ? Math.round(s.width) : convertPixelsToUnit(s.width, unit, dpiN) || 0));
    setMHeight(String(unit === "px" ? Math.round(s.height) : convertPixelsToUnit(s.height, unit, dpiN) || 0));
    setPresetMargins({ safe: Number(s.safeMargin) || 0, bleed: Number(s.bleedMargin) || 0 });
    setSizeError("");
  };

  // Persist a just-created size into the durable custom-size store so it shows up
  // under "Your saved sizes" next time — unless it matches a built-in standard
  // size or one already saved (dedup by PIXEL dimensions only, ignoring DPI).
  // Awaits the store first so the check reads the real list and the write lands
  // before the dialog navigates away. Shared by BOTH create paths (blank +
  // from-template) so a size typed in either is remembered.
  const persistCustomSize = async ({ width, height, dpi, safeMargin = 0, bleedMargin = 0 }) => {
    const w = Number(width);
    const h = Number(height);
    if (!(w > 0) || !(h > 0)) return;
    const dpiN = Math.max(1, Math.round(Number(dpi) || DEFAULT_DPI));
    await initCustomSizes();
    const roundW = Math.round(w);
    const roundH = Math.round(h);
    const matchesStandard = predefined.some(
      (p) => Math.round(p.width) === roundW && Math.round(p.height) === roundH
    );
    const matchesSaved = getCustomSizes().some(
      (c) => Math.round(c.width) === roundW && Math.round(c.height) === roundH
    );
    if (matchesStandard || matchesSaved) return;
    addCustomSize({
      width: w,
      height: h,
      dpi: dpiN,
      unit,
      safeMargin: Number(safeMargin) || 0,
      bleedMargin: Number(bleedMargin) || 0,
      label: formatInchesLabel(w, h, dpiN),
    });
  };

  // Switch the size unit and convert every value entered in it — width, height,
  // and the cover paper thickness — so the whole form (size + cover/spine) reads
  // in one shared unit. Shared preference persists to localStorage.
  const handleSizeUnitChange = (next) => {
    if (mWidth !== "") {
      const px = convertToPixels(mWidth, unit, mDpiNum) || 0;
      setMWidth(String(next === "px" ? Math.round(px) : convertPixelsToUnit(px, next, mDpiNum) || 0));
    }
    if (mHeight !== "") {
      const px = convertToPixels(mHeight, unit, mDpiNum) || 0;
      setMHeight(String(next === "px" ? Math.round(px) : convertPixelsToUnit(px, next, mDpiNum) || 0));
    }
    if (paperThicknessStr !== "") {
      const px = convertToPixels(paperThicknessStr, unit, coverDpi) || 0;
      setPaperThicknessStr(String(next === "px" ? px : convertPixelsToUnit(px, next, coverDpi) || 0));
    }
    setUnit(next);
    setPreferredUnit(next);
  };

  // Manual edit of a dimension breaks the link to any chosen preset.
  const onManualSizeEdit = () => {
    setSelectedKey(null);
    setPresetMargins({ safe: 0, bleed: 0 });
    setSizeError("");
  };

  // Spread products store the full spread width, so orientation is judged per
  // single page (width / 2) — a 1200×600 photobook is two 600×600 (Square) pages,
  // not "Landscape". Mirrors the setCanvasSize reducer's stored orientation.
  const orientationOf = (w, h) => getSizeOrientation(w, h, selectedEditorType);

  // The design's DPI (the single DPI field in the size row) drives unit↔px
  // conversion for the cover measurements too.
  const coverDpi = Math.max(
    1,
    Math.round(Number(selectedSize?.dpi ?? mDpiNum) || DEFAULT_DPI)
  );
  const coverBillablePages = randomLayoutsOn
    ? Math.max(1, Math.round(Number(blankPageCount)) || 1)
    : 1;
  const paperThicknessPx =
    coverSettings.showFullCoverSheet && paperThicknessStr !== ""
      ? convertToPixels(paperThicknessStr, unit, coverDpi) || 0
      : 0;
  const spineWidthPx = coverSettings.showFullCoverSheet
    ? Math.round(Math.ceil(coverBillablePages / 2) * paperThicknessPx)
    : 0;
  const displaySpineWidth =
    unit === "px" ? spineWidthPx : convertPixelsToUnit(spineWidthPx, unit, coverDpi) || 0;

  const isCustomer = activeUser?.userTypeCode === USER_TYPES.CUSTOMER;

  const handleCreate = async () => {
    setNameError("");
    setSizeError("");
    setGeneralError("");

    let valid = true;
    if (!name.trim()) {
      setNameError("Please enter a name");
      valid = false;
    }
    if (!selectedSize) {
      setSizeError("Please select a canvas size");
      valid = false;
    }
    if (!valid) {
      return;
    }

    setIsSaving(true);

    try {
      const isSpread =
        selectedEditorType === EDITOR_TYPES.PHOTOBOOK ||
        selectedEditorType === EDITOR_TYPES.LAYFLATALBUM;

      // Cover & spine flags for the new theme. Every key is set explicitly so the
      // setSettings reducer never infers hideLastCover from showFullCoverSheet
      // (breaking standalone "hide back cover"). Persisted into the saved theme /
      // library settings; the reducer reconstructs the cover page shape on load.
      const coverPayload = supportsCoverSettings(selectedEditorType)
        ? {
            coverEnabled: coverSettings.coverEnabled,
            showFullCoverSheet: coverSettings.showFullCoverSheet,
            hideLastCover: coverSettings.hideLastCover,
            exportSpine: coverSettings.exportSpine,
            paperThickness: paperThicknessPx,
            spineWidth: spineWidthPx,
          }
        : {};

      // Desktop's Redux store is long-lived across theme creations in one session
      // (the web app starts from a fresh initialState on every page load). Because
      // setSettings MERGES, spread/cover flags left over from a PRIOR photobook/
      // layflat/foldable theme leak into a new non-spread theme — most visibly
      // settings.isFoldable, which makes shouldShowCenterWrapperLine draw a fold
      // line down the middle of a calendar/canvas (rendering it as a 2-up spread).
      // Persist explicit falsy defaults so both the live editor and the saved/
      // reloaded theme clear any stale flags. Real cover flags for photobook/
      // layflat come from coverPayload; setSettings re-forces isFoldable:true for
      // LAYFLATALBUM, so resetting it here is safe for spreads.
      const finalThemeSettings = {
        isFoldable: false,
        coverEnabled: false,
        showFullCoverSheet: false,
        hideLastCover: false,
        exportSpine: false,
        spineWidth: 0,
        paperThickness: 0,
        ...coverPayload,
      };

      let displayWidth = parseFloat(selectedSize.width);
      let displayHeight = parseFloat(selectedSize.height);
      let displayDpi = selectedSize.dpi || 200;
      const displaySafeMargin = parseFloat(selectedSize.safeMargin) || 0;
      const displayBleedMargin = parseFloat(selectedSize.bleedMargin) || 0;

      // Remember the created size under "Your saved sizes" for next time.
      await persistCustomSize({
        width: displayWidth,
        height: displayHeight,
        dpi: displayDpi,
        safeMargin: displaySafeMargin,
        bleedMargin: displayBleedMargin,
      });

      // Single empty page layout payload
      const emptyPage = {
        id: `pages_${uuidv4()}`,
        pageNumber: 1,
        title: "1",
        bgColor: "#fff",
        layout: [
          {
            width: isSpread ? displayWidth / 2 : displayWidth,
            height: displayHeight,
            objects: [],
            safeAreaObjects: [],
            // Every layout side must carry a background object (canonical model);
            // omitting it made the single-side background setters crash when a
            // background was first applied to a freshly-created theme.
            background: { color: null, image: null, flip: false },
          },
        ],
        settings: {
          onlyAllowObjectInSafeArea: false,
          isHalfSheet: false,
        },
        isPageEdited: false,
      };

      // Random-layout generation (photobook/layflat): prime the canvas store so
      // the generator's reducers scale against the target size, then build N pages
      // each filled with a random layout. Otherwise start from a single empty page.
      const wantRandom = randomLayoutsOn && isSpread;
      let themePagesData;
      if (wantRandom) {
        // The size fields (width/height/DPI) already define the design's exact
        // pixel dimensions and resolution — no separate export-DPI rescale.
        dispatch(setEditorType(selectedEditorType));
        // Force the structural flags off for a clean fresh design, but MERGE (do
        // NOT replaceSettings — that wipes settings.selectedMenuItems, which the
        // customer Sidebar reads via `.some()` → crash) so permission/menu config
        // is preserved.
        dispatch(
          setSettings({
            subtype: selectedEditorSubType,
            ...finalThemeSettings,
          })
        );
        dispatch(
          setCanvasSize({
            width: displayWidth,
            height: displayHeight,
            depth: 0,
            safeMargin: displaySafeMargin,
            bleedMargin: displayBleedMargin,
            dpi: displayDpi,
          })
        );
        const generated = await generateRandomLayoutPages(dispatch, {
          pageCount: blankPageCount,
          minImages: blankMinImages,
          maxImages: blankMaxImages,
        });
        if (!generated || generated.length === 0) {
          setGeneralError(
            "No layouts are available to generate this design. Try fewer images per page."
          );
          setIsSaving(false);
          return;
        }
        themePagesData = generated;
        // Generation floods the undo stack — clear it so Ctrl+Z can't unwind it.
        dispatch(UndoActionCreators.clearHistory());
      } else {
        themePagesData = [emptyPage];
      }
      const pagesJsonString = JSON.stringify({ pages: themePagesData });
      const compressedBase64 = compressData(pagesJsonString);

      const themePayload = {
        pages_c: compressedBase64,
        pages: pagesJsonString,
        orientation: orientationOf(displayWidth, displayHeight).charAt(0),
        width: displayWidth,
        height: displayHeight,
        size: `${displayWidth}x${displayHeight}`,
        depth: 0,
        // Print / Custom Product shape. Stored at top level AND in settings so the
        // t_id reload (useThemeSetup reads `theme.settings?.shape || theme.shape`)
        // restores it either way.
        ...(isShapeProduct ? { shape } : {}),
        safe_margin: displaySafeMargin,
        bleed_margin: displayBleedMargin,
        dpi: displayDpi,
        images_count: 0,
        number_of_pages: themePagesData.length,
        number_of_layouts: 1,
        cal_settings: null,
        settings: {
          subtype: selectedEditorSubType,
          ...finalThemeSettings,
          ...(isShapeProduct ? { shape } : {}),
        },
      };

      const data = {
        status: 1,
        theme: themePayload,
        name: name.trim(),
        display_in_web: true,
        assets_type: EDITOR_ASSETS.THEME,
        editor_type: selectedEditorType,
        platform: "web",
        brand_id: activeUser?.brand_id || null,
      };

      if (isCustomer) {
        // Customer flow: Create design locally in local store and navigate
        dispatch(resetThemeDetails());
        dispatch(setEditorType(selectedEditorType));
        dispatch(setThemeName(name.trim()));
        dispatch(setAllThemes([{ ...themePayload, isNew: true }]));
        dispatch(applyTheme(themePagesData));
        dispatch(setPageNumber(0));
        dispatch(setEditorPages(themePagesData));
        dispatch(
          setCanvasSize({
            width: displayWidth,
            height: displayHeight,
            depth: 0,
            safeMargin: displaySafeMargin,
            bleedMargin: displayBleedMargin,
            dpi: displayDpi,
            ...(isShapeProduct ? { shape } : {}),
          })
        );
        // Apply settings to the live editor after pages + size are set, so the
        // reducer reconstructs the cover structure against the final pages. Always
        // dispatch (not just for cover-capable types): non-spread products must
        // reset any stale settings.isFoldable / cover flags left in the long-lived
        // store, otherwise the new design (and its restore snapshot) renders as a
        // fold spread. finalThemeSettings ⊇ coverPayload, so spreads are unchanged.
        dispatch(setSettings({ subtype: selectedEditorSubType, ...finalThemeSettings, ...(isShapeProduct ? { shape } : {}) }));
        // A design is applied — mark it so the Footer thumbnails (and canvas)
        // leave the skeleton state immediately (before the restore effect settles).
        dispatch(setThemeApplied(true));

        const id = deriveDesignId({
          localId: ensureActiveLocalDesignId(),
          canvasSize: { width: displayWidth, height: displayHeight },
        });

        if (!id) {
          setGeneralError("Error creating local design ID. Please try again.");
          setIsSaving(false);
          return;
        }

        // One shared entry so the library upsert AND the staged restore snapshot
        // agree on the id.
        const designEntry = {
          id,
          thumbnail: null,
          pages: themePagesData,
          pages_c: compressedBase64,
          canvasSize: {
            width: displayWidth,
            height: displayHeight,
            safeMargin: displaySafeMargin,
            bleedMargin: displayBleedMargin,
            dpi: displayDpi,
            ...(isShapeProduct ? { shape } : {}),
          },
          editorType: selectedEditorType,
          orientation: orientationOf(displayWidth, displayHeight).charAt(0),
          // Persist the chosen cover/spine flags (full cover, hide back cover,
          // export spine, paper thickness) — the customer path navigates via
          // restore=1, which re-applies THIS entry's `settings` through
          // setSettings, so dropping coverPayload here silently reverted every
          // cover toggle the user picked. Mirrors the admin themePayload
          // (`{ subtype:"", ...coverPayload }`), which is why cover worked for
          // admins but not customers.
          settings: { subtype: selectedEditorSubType, ...finalThemeSettings, ...(isShapeProduct ? { shape } : {}) },
          calendarSettings: null,
          minPages: 1,
          maxPages: 100,
          activeSide: "front",
          textGroups: null,
          themeImagesBlanked: false,
          themeId: null,
          themeName: name.trim(),
          cartOrderId: null,
          cat: initialCategory?.type || null,
        };

        // No allowEmpty: a brand-new BLANK design is NOT written to "Your Projects"
        // yet (a blank layout has no content → no-op); the card appears once the
        // design has real content (auto-save on unmount / explicit Save). A random
        // "Blank" layout DOES carry content, so it persists immediately.
        saveDesignToLibrary(designEntry);

        // Stage a restore snapshot carrying libraryId=id BEFORE navigating — this is
        // the fix for the "same project appears twice" duplicate. useEditorSnapshot's
        // mount runs resetActiveLocalDesignId(); WITHOUT a staged snapshot the editor
        // has nothing to re-adopt, so its auto-save mints a FRESH `local:<id>` and
        // forks a SECOND card (bites the random "Blank" path, whose generated pages
        // have content that the create-time save above actually persists). The
        // snapshot's libraryId makes the editor ADOPT this id (adoptActiveLocalDesignId)
        // so every later save UPSERTS the same entry. It also makes restore=1 truly
        // snapshot-backed (survives a hard reload right after create) instead of
        // relying on the SPA Redux store surviving navigation. Mirrors
        // handleCreateFromTemplate / handleOpenDesign, which already stage.
        stageSnapshotFromEntry(designEntry);

        toast.success(`Design "${name.trim()}" created successfully!`, {
          position: "top-center",
          autoClose: 2000,
        });

        setIsSaving(false);
        onClose();

        // Navigate with restore=1 to rehydrate the editor from this newly created local snapshot
        const userToken = getUrlParam(location.search, "u_id") || activeUser?.token || "";
        navigate(`/?u_id=${encodeURIComponent(userToken)}&restore=1`);
      } else {
        // Admin flow: Save theme to server API
        const response = await apiPost(ENDPOINTS.saveAsTheme, data);
        if (response && response.items && response.status === 1) {
          const newThemeId = response.items._id;
          toast.success("New theme created successfully!", {
            position: "top-center",
            autoClose: 1000,
          });

          setIsSaving(false);
          onClose();

          // Navigate to editor with the new theme ID
          const userToken = getUrlParam(location.search, "u_id") || activeUser?.token || "";
          const catQuery = initialCategory?.type ? `&cat=${encodeURIComponent(initialCategory.type)}` : "";
          navigate(`/?u_id=${encodeURIComponent(userToken)}&t_id=${newThemeId}${catQuery}`);
        } else {
          setGeneralError(response?.message || "Failed to create theme");
          setIsSaving(false);
        }
      }
    } catch (err) {
      setGeneralError("Error creating design. Please try again.");
      setIsSaving(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(); } catch (_) { return ""; }
  };

  if (!show) return null;

  return (
    <Overlay onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <Card>
        <Head>
          <HeadTitle>
            <h3>
              {isBlankMode
                ? isCustomer
                  ? "Create Blank Design"
                  : "Create Blank Theme"
                : isCustomer
                ? "Create New Design"
                : "Create New Theme"}
            </h3>
            <p>
              {isBlankMode
                ? "Set up your blank design below"
                : "Start from a saved project or create a blank design below"}
            </p>
          </HeadTitle>
          <IconBtn onClick={onClose} aria-label="Close">
            <FaTimes size={15} />
          </IconBtn>
        </Head>

        <Body>
          {/* ── Saved projects section (hidden in blank-generator mode) ─ */}
          {!isBlankMode && (
          <div>
            <SectionLabel style={{ marginBottom: 10 }}>Your saved projects</SectionLabel>

            <TipBox style={{ marginBottom: 10 }}>
              <FaFolderOpen size={15} />
              <span>
                <strong>Tip:</strong> Select a saved project to use it as a <strong>layout template</strong>. The layout and structure will be copied as a new design with blank image slots — perfect for recreating the same style with different photos.
              </span>
            </TipBox>

            <ProjectsSearchRow>
              <FaSearch size={13} />
              <ProjectsSearchInput
                type="text"
                placeholder="Search projects by name or size…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
              {projectSearch && (
                <IconBtn
                  as="button"
                  onClick={() => setProjectSearch("")}
                  style={{ width: 22, height: 22, borderRadius: 6, background: "transparent" }}
                  title="Clear search"
                >
                  <FaTimes size={10} />
                </IconBtn>
              )}
            </ProjectsSearchRow>

            <div style={{ marginTop: 10 }}>
              {projectsLoading ? (
                <ProjectsEmptyState>
                  <span>Loading your projects…</span>
                </ProjectsEmptyState>
              ) : filteredProjects.length === 0 ? (
                <ProjectsEmptyState>
                  <FaFolderOpen size={26} />
                  <span>
                    {projectSearch
                      ? `No projects match "${projectSearch}"`
                      : savedProjects.length > 0
                      ? "No saved projects for this product type. Create one below!"
                      : "No saved projects yet. Create your first design below!"}
                  </span>
                </ProjectsEmptyState>
              ) : (
                <ProjectsGrid>
                  {filteredProjects.map((proj) => {
                    const isActive = selectedProject?.id === proj.id;
                    return (
                      <ProjectCard
                        key={proj.id}
                        type="button"
                        $active={isActive}
                        onClick={() => handleSelectProject(proj)}
                        title={proj.name || "Untitled design"}
                      >
                        <DesignThumbnail
                          thumbnail={proj.thumbnail}
                          scopeId={proj.id}
                          alt={proj.name || "project"}
                          fallbackSrc={BlankImagePlaceholder}
                          style={{ aspectRatio: "1 / 1", background: tokens.surfaceAlt }}
                        />
                        <ProjectInfo>
                          <ProjectName>{proj.name || "Untitled design"}</ProjectName>
                          <ProjectMeta>
                            {[proj.size, formatDate(proj.updatedAt)].filter(Boolean).join(" · ")}
                          </ProjectMeta>
                        </ProjectInfo>
                        {isActive && (
                          <ProjectSelectedTick>
                            <FaCheck size={9} />
                          </ProjectSelectedTick>
                        )}
                      </ProjectCard>
                    );
                  })}
                </ProjectsGrid>
              )}
            </div>
          </div>
          )}

          {/* ── Start blank section ──────────────────────────────────── */}
          {!isBlankMode && <SectionDivider>or start blank</SectionDivider>}

          <FormSection>
            <Label htmlFor="name-input">
              {isCustomer ? "Design Name" : "Theme Name"}
            </Label>
            <Input
              id="name-input"
              type="text"
              placeholder={isCustomer ? "Enter a name for your design..." : "Enter a name for your theme..."}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError("");
              }}
            />
            {nameError && <FieldError>{nameError}</FieldError>}
          </FormSection>

          <FormSection>
            <Label htmlFor="editor-type-select">Product Type</Label>
            <Select
              id="editor-type-select"
              value={selectedEditorType}
              onChange={(e) => {
                setSelectedEditorType(e.target.value);
                setSelectedEditorSubType(""); // reset sub-type when type changes
              }}
            >
              {Object.keys(EDITOR_TYPES).map((key) => (
                <option key={key} value={EDITOR_TYPES[key]}>
                  {EDITOR_TYPES[key]
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </FormSection>

          {/* Contextual sub-type selector (Calendar → Wall/Wooden/Mountain,
              Acrylic, Custom Product, Greeting Card, Photobook) — mirrors the web
              CreateThemeDialog so these sub-types are reachable when creating a
              new theme. */}
          {subTypeField && (
            <FormSection>
              <Label htmlFor="editor-subtype-select">{subTypeField.label}</Label>
              <Select
                id="editor-subtype-select"
                value={selectedEditorSubType}
                onChange={(e) => setSelectedEditorSubType(e.target.value)}
              >
                <option value="">{subTypeField.placeholder}</option>
                {Object.keys(EDITOR_SUB_TYPES[subTypeField.subKey]).map((key) => {
                  const value = EDITOR_SUB_TYPES[subTypeField.subKey][key];
                  return (
                    <option key={key} value={value}>
                      {prettifySubType(value)}
                    </option>
                  );
                })}
              </Select>
            </FormSection>
          )}

          {isSpreadCategory && (
            <FormSection>
              <SettingsCard>
                <ToggleRow>
                  <ToggleText>
                    <span className="t-title">
                      Fill every {spreadNoun} with a random layout
                    </span>
                    <span className="t-desc">
                      Pages are filled with random layouts and empty image boxes —
                      drop in your own photos afterwards.
                    </span>
                  </ToggleText>
                  <input
                    type="checkbox"
                    checked={randomLayoutsOn}
                    onChange={(e) => setRandomLayoutsOn(e.target.checked)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                  />
                  <Switch $on={randomLayoutsOn} />
                </ToggleRow>
              {randomLayoutsOn && (
                <div style={{ paddingBottom: 12 }}>
                  <FieldGrid>
                    <Field>
                      Number of spreads
                      <input
                        type="number"
                        min={BLANK_THEME_MIN_PAGES}
                        max={BLANK_THEME_MAX_PAGES}
                        value={blankPageCount}
                        onChange={(e) => setBlankPageCount(e.target.value)}
                      />
                    </Field>
                    <Field>
                      Min images / {spreadNoun}
                      <input
                        type="number"
                        min="1"
                        max={BLANK_THEME_MAX_IMAGES}
                        value={blankMinImages}
                        onChange={(e) => setBlankMinImages(e.target.value)}
                      />
                    </Field>
                    <Field>
                      Max images / {spreadNoun}
                      <input
                        type="number"
                        min="1"
                        max={BLANK_THEME_MAX_IMAGES}
                        value={blankMaxImages}
                        onChange={(e) => setBlankMaxImages(e.target.value)}
                      />
                    </Field>
                  </FieldGrid>
                </div>
              )}
              </SettingsCard>
            </FormSection>
          )}

          {isSpreadCategory && (
            <FormSection>
              <SectionLabel>Cover &amp; spine settings</SectionLabel>
              <SettingsCard>
                {(COVER_TOGGLES[selectedEditorType] || [])
                  .filter((toggle) => isCoverToggleVisible(toggle, coverSettings))
                  .map((toggle) => (
                    <ToggleRow key={toggle.key}>
                      <ToggleText>
                        <span className="t-title">{toggle.title}</span>
                        {toggle.instruction && (
                          <span className="t-desc">{toggle.instruction}</span>
                        )}
                      </ToggleText>
                      <input
                        type="checkbox"
                        checked={coverSettings[toggle.key]}
                        onChange={(e) => handleCoverToggle(toggle.key, e.target.checked)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                      />
                      <Switch $on={coverSettings[toggle.key]} />
                    </ToggleRow>
                  ))}
              </SettingsCard>
              {coverSettings.showFullCoverSheet && (
                <FieldGrid style={{ marginTop: "8px" }}>
                  <Field>
                    Unit
                    <select value={unit} onChange={(e) => handleSizeUnitChange(e.target.value)}>
                      {PRINT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    Paper thickness ({unit}/sheet)
                    <input
                      type="number"
                      min="0"
                      step={unit === "px" ? "0.1" : "0.001"}
                      value={paperThicknessStr}
                      onChange={(e) => setPaperThicknessStr(e.target.value)}
                      placeholder="e.g. 0.5"
                    />
                  </Field>
                  <Field>
                    Spine width ({unit}, auto)
                    <input type="number" value={displaySpineWidth} readOnly disabled />
                  </Field>
                </FieldGrid>
              )}
            </FormSection>
          )}

          <div>
            <SectionLabel>Predefined sizes</SectionLabel>
            <Select
              id="predefined-size-select"
              value={selectedKey && allByKey[selectedKey] ? selectedKey : ""}
              onChange={(e) => {
                const key = e.target.value;
                setSelectedKey(key || null);
                if (key) fillSizeFields(allByKey[key]);
              }}
            >
              <option value="">Custom size…</option>
              {customs.length > 0 && (
                <optgroup label="Your saved sizes">
                  {customs.map((s) => (
                    <option key={s.key} value={s.key}>
                      ● {s.label} · {orientationOf(s.width, s.height)} ({Math.round(s.width)}×{Math.round(s.height)} px · {s.dpi} DPI) · Custom
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Standard sizes">
                {predefined.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label.trim()} · {orientationOf(s.width, s.height)}
                  </option>
                ))}
              </optgroup>
            </Select>

            {/* Always-visible size fields — the source of truth for creation. */}
            <FieldGrid style={{ marginTop: 10 }}>
              <Field>
                Width
                <input
                  type="number"
                  min="0"
                  step={unit === "px" ? "1" : "0.01"}
                  value={mWidth}
                  onChange={(e) => { setMWidth(e.target.value); onManualSizeEdit(); }}
                  placeholder="Width"
                />
              </Field>
              <Field>
                Height
                <input
                  type="number"
                  min="0"
                  step={unit === "px" ? "1" : "0.01"}
                  value={mHeight}
                  onChange={(e) => { setMHeight(e.target.value); onManualSizeEdit(); }}
                  placeholder="Height"
                />
              </Field>
              <Field>
                Unit
                <select value={unit} onChange={(e) => handleSizeUnitChange(e.target.value)}>
                  {PRINT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                DPI
                <input
                  type="number"
                  min="1"
                  value={mDpi}
                  onChange={(e) => { setMDpi(e.target.value); onManualSizeEdit(); }}
                  placeholder="DPI"
                />
              </Field>
            </FieldGrid>
            {/* Shape — Print / Custom Product only (matches the web Step Design
                module). Rectangle vs circular cut/canvas. */}
            {isShapeProduct && (
              <FieldGrid style={{ marginTop: 10 }}>
                <Field>
                  Shape
                  <select value={shape} onChange={(e) => setShape(e.target.value)}>
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Circle</option>
                  </select>
                </Field>
              </FieldGrid>
            )}
            {selectedSize && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: tokens.muted }}>
                {Math.round(selectedSize.width)}×{Math.round(selectedSize.height)} px · {orientationOf(selectedSize.width, selectedSize.height)}
              </p>
            )}
            {sizeError && <FieldError>{sizeError}</FieldError>}
          </div>

          <InfoBox>
            <FaInfoCircle size={16} />
            <span>
              {isCustomer
                ? "Start with a blank canvas. This will create a new blank design on your device under your designs panel, and take you to the editor."
                : "Create a blank theme. This will save a new empty theme in the system that can be styled, edited, and scaled."}
            </span>
          </InfoBox>
        </Body>

        <Foot>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "60%" }}>
            <FootHint>
              {selectedProject
                ? `Project: ${selectedProject.name || "Untitled"}`
                : selectedSize
                ? `${selectedSize.label} · ${orientationOf(selectedSize.width, selectedSize.height)}`
                : "Select a project or size to continue"}
            </FootHint>
            {generalError && <FormError>{generalError}</FormError>}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <GhostButton onClick={onClose} disabled={isSaving}>
              Cancel
            </GhostButton>
            {selectedProject ? (
              <PrimaryButton onClick={handleCreateFromTemplate} disabled={isSaving}>
                {isSaving ? "Creating..." : "Create from Template"}{" "}
                <FaArrowRight size={12} style={{ marginLeft: "6px" }} />
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={handleCreate} disabled={isSaving}>
                {isSaving ? "Creating..." : isCustomer ? "Create Design" : "Create Theme"}{" "}
                <FaArrowRight size={12} style={{ marginLeft: "6px" }} />
              </PrimaryButton>
            )}
          </div>
        </Foot>
      </Card>
    </Overlay>
  );
};

export default CreateNewDesignModal;
