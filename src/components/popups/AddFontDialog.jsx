/**
 * AddFontDialog
 * Dialog for uploading custom font files. Uses a zero-dependency binary parser
 * to extract font metadata. Single-family approach: all uploaded files belong
 * to one family with editable style rows, live preview, and settings.
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Form, Spinner } from "react-bootstrap";
import { IoClose } from "react-icons/io5";
import {
  FiUploadCloud,
  FiTrash2,
  FiFile,
  FiCheck,
  FiAlertCircle,
  FiGlobe,
  FiDownload,
} from "react-icons/fi";
import { MdOutlineToggleOn, MdOutlineToggleOff } from "react-icons/md";
import styled from "styled-components";
import {
  parseFontFile,
  generateFontId,
  makeStyleId,
  makeStyleLabel,
  deduplicateFontStyles,
  FONT_CATEGORIES,
  FONT_SCRIPTS,
  LOCALE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  ACCEPTED_FONT_MIME,
  ACCEPTED_FONT_EXTENSIONS,
} from "../../library/utils/common-functions/fontParser";
import { apiMultiPartPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import {
  fetchGoogleFontFiles,
  extractFamilyFromUrl,
} from "../../library/utils/common-functions/googleFontFetcher";

// ─── Styled Components ───────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 12200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Container = styled.div`
  width: 90%;
  // max-width: 1100px;
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease;
  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (max-width: 768px) {
    width: 96%;
    max-height: 96vh;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  p {
    font-size: 0.8rem;
    color: #6b7280;
    margin: 4px 0 0 0;
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  &:hover { background: #f3f4f6; color: #111827; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const ErrorMsg = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f2f2f2;
  border: 1px solid #e6e6e6;
  color: #111111;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-bottom: 20px;
  svg { flex-shrink: 0; margin-top: 1px; }
`;

const NameIdGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
`;

const FieldHint = styled.p`
  font-size: 0.72rem;
  color: #9ca3af;
  margin: 0;
`;

const InlineError = styled.p`
  font-size: 0.72rem;
  color: #111111;
  margin: 2px 0 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ReadOnlyField = styled.span`
  display: inline-block;
  height: 30px;
  line-height: 30px;
  font-size: 0.78rem;
  padding: 0 8px;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
`;

const TextInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #111827;
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--primary, #4084B5);
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
  }
  &.mono { font-family: monospace; }
`;

const DropZone = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: 2px dashed ${(props) => (props.$isDragOver ? "var(--primary, #4084B5)" : "#d1d5db")};
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(props) => (props.$isDragOver ? "rgba(0, 0, 0, 0.04)" : "#fafafa")};
  margin-bottom: 24px;
  &:hover { border-color: var(--primary, #4084B5); background: rgba(0, 0, 0, 0.04); }
  .icon { color: ${(props) => (props.$isDragOver ? "var(--primary, #4084B5)" : "#9ca3af")}; }
  .title { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 0; }
  .hint { font-size: 0.78rem; color: #9ca3af; margin: 2px 0 0 0; }
`;

// ─── Styles Table ────────────────────────────────────────────────────────────

const StylesSection = styled.div`
  margin-bottom: 24px;
`;

const StylesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  h4 { font-size: 0.88rem; font-weight: 600; color: #111827; margin: 0; }
`;

const CountBadge = styled.span`
  font-family: monospace;
  font-size: 0.75rem;
  padding: 3px 10px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 6px;
`;

const StylesTable = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
`;

const StylesTableHead = styled.div`
  display: grid;
  grid-template-columns: 28px 1fr 140px 100px 70px 36px;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
`;

const StylesTableRow = styled.div`
  display: grid;
  grid-template-columns: 28px 1fr 140px 100px 70px 36px;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid #f3f4f6;
  font-size: 0.85rem;
  transition: background 0.15s;
  background: ${(props) => (props.$active ? "rgba(0, 0, 0, 0.03)" : "transparent")};
  &:first-child { border-top: none; }
`;

const CheckboxInput = styled.input`
  width: 16px;
  height: 16px;
  accent-color: var(--primary, #4084B5);
  cursor: pointer;
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  .file-details { overflow: hidden; }
  .file-name { font-size: 0.82rem; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .detected { font-size: 0.72rem; color: #9ca3af; }
  svg { flex-shrink: 0; color: #9ca3af; }
`;

const SmallSelect = styled.select`
  height: 30px;
  font-size: 0.78rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0 6px;
  color: #374151;
  cursor: pointer;
  &:focus { border-color: var(--primary, #4084B5); outline: none; }
`;

const PreviewBtn = styled.button`
  padding: 3px 10px;
  font-size: 0.72rem;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#e5e7eb")};
  background: ${(props) => (props.$active ? "rgba(0, 0, 0, 0.08)" : "transparent")};
  color: ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#6b7280")};
  transition: all 0.2s;
  &:hover { border-color: var(--primary, #4084B5); color: var(--primary, #4084B5); }
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: #d1d5db;
  transition: all 0.2s;
  &:hover { color: #111111; background: #f2f2f2; }
`;

// ─── Settings + Preview Grid ─────────────────────────────────────────────────

const SettingsPreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const CheckboxGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #374151;
  cursor: pointer;
`;

const ToggleCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  cursor: pointer;
  &:not(:last-child) { border-bottom: 1px solid #f3f4f6; }
`;

const ToggleInfo = styled.div`
  .label { font-size: 0.85rem; font-weight: 500; color: #374151; }
  .desc { font-size: 0.72rem; color: #9ca3af; margin-top: 1px; }
`;

const ToggleIcon = styled.span`
  font-size: 1.8rem;
  line-height: 1;
  color: ${(props) => (props.$on ? "var(--primary, #4084B5)" : "#d1d5db")};
  transition: color 0.2s;
`;

// ─── Preview Panel ───────────────────────────────────────────────────────────

const PreviewPanel = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  background: #fafafa;
`;

const PreviewBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.72rem;
  color: #6b7280;
  margin-right: 8px;
`;

const PreviewTextArea = styled.div`
  background: #f3f4f6;
  border-radius: 8px;
  padding: 20px;
  margin-top: 12px;
`;

const SampleInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-top: 10px;
  &:focus { border-color: var(--primary, #4084B5); outline: none; }
`;

const EmptyPreview = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9ca3af;
  text-align: center;
  svg { margin-bottom: 8px; }
  span { font-size: 0.82rem; }
`;

// ─── Footer ──────────────────────────────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
`;

const CancelBtn = styled.button`
  padding: 8px 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #f9fafb; border-color: #d1d5db; }
`;

const SubmitBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: var(--primary, #4084B5);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &:hover:not(:disabled) { background: var(--primary-dark, #000000); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// ─── Source Tabs ─────────────────────────────────────────────────────────

const SourceTabs = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
`;

const SourceTab = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6b7280")};
  font-size: 0.85rem;
  font-weight: ${(props) => (props.$active ? 600 : 500)};
  cursor: pointer;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background: ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#f9fafb")};
  }
  &:not(:last-child) {
    border-right: 1px solid #e5e7eb;
  }
`;

const GoogleUrlInput = styled.div`
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const GoogleUrlRow = styled.div`
  display: flex;
  gap: 10px;
  @media (max-width: 600px) { flex-direction: column; }
`;

const FetchBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--primary, #4084B5);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover:not(:disabled) { background: var(--primary-dark, #000000); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: var(--primary, #4084B5);
  border-radius: 3px;
  transition: width 0.3s ease;
  width: ${(props) => props.$percent || 0}%;
`;

// ─── Component ───────────────────────────────────────────────────────────────

function AddFontDialog({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const googleInputRef = useRef(null);

  // Family info (single family)
  const [familyName, setFamilyName] = useState("");
  const [fontId, setFontId] = useState("");
  const [fontIdManual, setFontIdManual] = useState(false);
  const [familyNameAutoFilled, setFamilyNameAutoFilled] = useState(false);

  // Style rows
  const [styles, setStyles] = useState([]);
  // Each: { uid, meta, weight, style, include }

  // Settings
  const [category, setCategory] = useState(["heading", "body", "display"]);
  const [scripts, setScripts] = useState(["latin"]);
  const [locales, setLocales] = useState([]);
  const [printSafe, setPrintSafe] = useState(false);
  const [premium, setPremium] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Preview
  const [previewRow, setPreviewRow] = useState(null);
  const [previewFontFamily, setPreviewFontFamily] = useState("");
  const [previewText, setPreviewText] = useState("The quick brown fox jumps over the lazy dog");

  // Source tab: "upload" or "google"
  const [sourceTab, setSourceTab] = useState("google");

  // Google Fonts state
  const [googleInput, setGoogleInput] = useState("");
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false);
  const [googleProgress, setGoogleProgress] = useState({ current: 0, total: 0 });

  // UI states
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Auto-generate fontId from familyName
  useEffect(() => {
    if (!fontIdManual && familyName) {
      setFontId(generateFontId(familyName));
    }
  }, [familyName, fontIdManual]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      styles.forEach((s) => {
        if (s.meta?.previewUrl) URL.revokeObjectURL(s.meta.previewUrl);
      });
    };
  }, []);

  // Auto-focus Google Fonts input whenever dialog opens on that tab
  useEffect(() => {
    if (isOpen && sourceTab === "google" && googleInputRef.current) {
      googleInputRef.current.focus();
      googleInputRef.current.select();
    }
  }, [isOpen, sourceTab]);

  // Handle file upload
  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList).filter((f) => {
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        return ACCEPTED_FONT_EXTENSIONS.includes(ext);
      });

      if (files.length === 0) {
        setError("No valid font files selected. Accepted: TTF, OTF, WOFF, WOFF2");
        return;
      }

      setError(null);
      setIsParsing(true);

      try {
        let uid = Date.now();
        const newRows = [];
        let detectedFamily = "";

        for (const file of files) {
          const meta = await parseFontFile(file);
          if (!detectedFamily) detectedFamily = meta.familyName;
          newRows.push({
            uid: String(uid++),
            meta,
            weight: meta.weight,
            style: meta.style,
            include: true,
          });
        }

        newRows.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));

        setStyles((prev) => {
          const merged = [...prev, ...newRows];
          const deduplicated = deduplicateFontStyles(merged);
          const removedCount = merged.length - deduplicated.length;
          if (removedCount > 0) {
            setError(`${removedCount} duplicate style${removedCount > 1 ? "s" : ""} (same weight + style) removed.`);
            setTimeout(() => setError(null), 4000);
          }
          deduplicated.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
          return deduplicated;
        });

        // Auto-fill family name from first file
        if (!familyName && detectedFamily && !familyNameAutoFilled) {
          setFamilyName(detectedFamily);
          setFamilyNameAutoFilled(true);
        }

        // Set preview to first new row if none selected
        if (newRows.length > 0 && !previewRow) {
          selectPreview(newRows[0]);
        }
      } catch (err) {
        setError("Failed to parse one or more font files. Make sure the files are valid.");
      } finally {
        setIsParsing(false);
      }
    },
    [familyName, familyNameAutoFilled, previewRow]
  );

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e) => e.preventDefault();

  // Style row helpers
  const updateStyleRow = (uid, patch) => {
    setStyles((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  };

  const removeStyleRow = (uid) => {
    setStyles((prev) => {
      const row = prev.find((s) => s.uid === uid);
      if (row?.meta?.previewUrl) URL.revokeObjectURL(row.meta.previewUrl);
      return prev.filter((s) => s.uid !== uid);
    });
    if (previewRow?.uid === uid) setPreviewRow(null);
  };

  const selectPreview = (row) => {
    setPreviewRow(row);
    setPreviewFontFamily(`preview-${row.uid}`);
  };

  const toggleScript = (script) => {
    setScripts((prev) =>
      prev.includes(script) ? prev.filter((s) => s !== script) : [...prev, script]
    );
  };

  const toggleLocale = (locale) => {
    setLocales((prev) =>
      prev.includes(locale) ? prev.filter((l) => l !== locale) : [...prev, locale]
    );
  };

  const toggleCategory = (val) => {
    setCategory((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]
    );
  };

  // Google Fonts: fetch and parse font files
  const handleGoogleFetch = async () => {
    if (!googleInput.trim()) {
      setError("Please enter a Google Fonts URL or font family name.");
      return;
    }

    setError(null);
    setFieldErrors({});
    setIsFetchingGoogle(true);
    setGoogleProgress({ current: 0, total: 0 });

    try {
      // Step 1: Fetch font files from Google CDN
      const { familyName: detectedName, files } = await fetchGoogleFontFiles(
        googleInput.trim(),
        (current, total) => setGoogleProgress({ current, total })
      );

      if (files.length === 0) {
        throw new Error("No font files could be downloaded.");
      }

      // Step 2: Parse each downloaded file with the existing font parser
      setIsParsing(true);
      let uid = Date.now();
      const newRows = [];

      for (const file of files) {
        try {
          const meta = await parseFontFile(file);
          newRows.push({
            uid: String(uid++),
            meta,
            weight: meta.weight,
            style: meta.style,
            include: true,
          });
        } catch (parseErr) {}
      }

      if (newRows.length === 0) {
        throw new Error("Downloaded files could not be parsed. The font may not be available in a compatible format.");
      }

      newRows.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));

      setStyles((prev) => {
        const merged = [...prev, ...newRows];
        const deduplicated = deduplicateFontStyles(merged);
        const removedCount = merged.length - deduplicated.length;
        if (removedCount > 0) {
          setError(`${removedCount} duplicate style${removedCount > 1 ? "s" : ""} (same weight + style) removed.`);
          setTimeout(() => setError(null), 4000);
        }
        deduplicated.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
        return deduplicated;
      });

      // Auto-fill family name
      if (!familyName || !familyNameAutoFilled) {
        setFamilyName(detectedName);
        setFamilyNameAutoFilled(true);
      }

      // Set preview to first row if none selected
      if (newRows.length > 0 && !previewRow) {
        selectPreview(newRows[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch Google Font. Please check the name or URL and try again.");
    } finally {
      setIsFetchingGoogle(false);
      setIsParsing(false);
      setGoogleProgress({ current: 0, total: 0 });
    }
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);
    const newFieldErrors = {};
    const includedStyles = styles.filter((s) => s.include);

    if (includedStyles.length === 0) {
      newFieldErrors.styles = "Upload and include at least one font style";
    }
    if (!familyName.trim()) {
      newFieldErrors.familyName = "Font family name is required";
    }
    if (!fontId.trim()) {
      newFieldErrors.fontId = "Font ID is required";
    }
    if (category.length === 0) {
      newFieldErrors.category = "Please select at least one category";
    }

    // Check for duplicate weight+style
    const seen = new Set();
    for (const s of includedStyles) {
      const key = makeStyleId(s.weight, s.style);
      if (seen.has(key)) {
        newFieldErrors.styles = `Duplicate style: ${makeStyleLabel(s.weight, s.style)} appears more than once.`;
        break;
      }
      seen.add(key);
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Append font files as "files"
      includedStyles.forEach((s) => {
        formData.append("files", s.meta.file, s.meta.file.name);
      });

      // Build payload matching backend schema
      const fontPayload = {
        name: familyName.trim(),
        fontId: fontId.trim(),
        category,
        source: sourceTab === "google" ? "google" : "upload",
        printSafe,
        premium,
        scripts,
        locales,
        createdBy: "admin",
      };

      formData.append("data", JSON.stringify(fontPayload));

      const response = await apiMultiPartPost(ENDPOINTS.addFont, formData);

      if (response?.error) {
        throw new Error(response.error?.message || response.error || "Upload failed");
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to upload fonts. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const includedCount = styles.filter((s) => s.include).length;

  return (
    <Overlay onClick={onClose}>
      <Container onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <Header>
          <HeaderLeft>
            <h3>Add Font</h3>
            <p>{sourceTab === "google" ? "Import a font from Google Fonts" : "Upload font files to add a new font family"}</p>
          </HeaderLeft>
          <CloseBtn onClick={onClose} aria-label="Close add font dialog">
            <IoClose size={20} />
          </CloseBtn>
        </Header>

        {/* Body */}
        <Body>
          {/* Source Tabs */}
          <SourceTabs>
            <SourceTab
              type="button"
              $active={sourceTab === "upload"}
              onClick={() => { setSourceTab("upload"); setError(null); }}
            >
              <FiUploadCloud size={16} />
              Upload Files
            </SourceTab>
            <SourceTab
              type="button"
              $active={sourceTab === "google"}
              onClick={() => { setSourceTab("google"); setError(null); }}
            >
              <FiGlobe size={16} />
              Google Fonts
            </SourceTab>
          </SourceTabs>

          {error && (
            <ErrorMsg role="alert">
              <FiAlertCircle size={15} />
              <span>{error}</span>
            </ErrorMsg>
          )}

          {/* Google Fonts URL Input */}
          {sourceTab === "google" && (
            <GoogleUrlInput>
              <FieldLabel>Google Fonts URL or Font Family Name</FieldLabel>
              <GoogleUrlRow>
                <TextInput
                  ref={googleInputRef}
                  value={googleInput}
                  onChange={(e) => {
                    setGoogleInput(e.target.value);
                    // Auto-detect family name from URL for preview
                    const detected = extractFamilyFromUrl(e.target.value);
                    if (detected && !familyNameAutoFilled) {
                      setFamilyName(detected);
                    }
                  }}
                  placeholder="e.g. Poppins or https://fonts.googleapis.com/css2?family=Poppins"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGoogleFetch(); } }}
                />
                <FetchBtn
                  type="button"
                  onClick={handleGoogleFetch}
                  disabled={isFetchingGoogle || !googleInput.trim()}
                >
                  {isFetchingGoogle ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <FiDownload size={15} />
                      Fetch Font
                    </>
                  )}
                </FetchBtn>
              </GoogleUrlRow>
              <FieldHint>
                Enter the Google Fonts CSS URL or just the font family name (e.g. "Poppins", "Open Sans").
                We'll download the actual font files and import them.
              </FieldHint>
              {isFetchingGoogle && googleProgress.total > 0 && (
                <div>
                  <ProgressBar>
                    <ProgressFill $percent={Math.round((googleProgress.current / googleProgress.total) * 100)} />
                  </ProgressBar>
                  <FieldHint style={{ marginTop: "4px" }}>
                    Downloading {googleProgress.current} of {googleProgress.total} font files...
                  </FieldHint>
                </div>
              )}
            </GoogleUrlInput>
          )}

          {/* Family Name + ID */}
          <NameIdGrid>
            <FieldGroup>
              <FieldLabel htmlFor="add-family-name">Font Family Name *</FieldLabel>
              <TextInput
                id="add-family-name"
                value={familyName}
                onChange={(e) => {
                  setFamilyName(e.target.value);
                  setFamilyNameAutoFilled(false);
                  if (fieldErrors.familyName) setFieldErrors((prev) => ({ ...prev, familyName: "" }));
                }}
                placeholder="e.g. Roboto, Lato, Noto Sans Hindi"
                style={fieldErrors.familyName ? { borderColor: "#111111" } : {}}
              />
              {fieldErrors.familyName ? (
                <InlineError><FiAlertCircle size={11} />{fieldErrors.familyName}</InlineError>
              ) : (
                <FieldHint>Auto-filled from the first uploaded file. You can change it.</FieldHint>
              )}
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="add-font-id">Font ID (slug) *</FieldLabel>
              <TextInput
                id="add-font-id"
                className="mono"
                value={fontId}
                onChange={(e) => {
                  setFontId(e.target.value);
                  setFontIdManual(true);
                  if (fieldErrors.fontId) setFieldErrors((prev) => ({ ...prev, fontId: "" }));
                }}
                placeholder="e.g. roboto, noto-sans-hindi"
                style={fieldErrors.fontId ? { borderColor: "#111111" } : {}}
              />
              {fieldErrors.fontId ? (
                <InlineError><FiAlertCircle size={11} />{fieldErrors.fontId}</InlineError>
              ) : (
                <FieldHint>Unique identifier used internally. Auto-generated from name.</FieldHint>
              )}
            </FieldGroup>
          </NameIdGrid>

          {/* Drop Zone (upload tab only) */}
          {sourceTab === "upload" && (
            <DropZone
              htmlFor="add-font-upload"
              $isDragOver={false}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FONT_MIME}
                multiple
                onChange={handleFileInput}
                style={{ display: "none" }}
                id="add-font-upload"
                aria-label="Upload font files"
              />
              {isParsing ? (
                <>
                  <Spinner animation="border" size="sm" />
                  <p className="title">Parsing font metadata...</p>
                </>
              ) : (
                <>
                  <div className="icon"><FiUploadCloud size={32} /></div>
                  <p className="title">Drop font files here or click to browse</p>
                  <p className="hint">TTF, OTF, WOFF, or WOFF2 — drop all styles (Regular, Bold, Italic, etc.) for this family</p>
                </>
              )}
            </DropZone>
          )}

          {/* Styles error */}
          {fieldErrors.styles && styles.length === 0 && (
            <InlineError style={{ marginBottom: "16px" }}><FiAlertCircle size={11} />{fieldErrors.styles}</InlineError>
          )}

          {/* Styles Table */}
          {styles.length > 0 && (
            <StylesSection>
              <StylesHeader>
                <h4>Font Styles</h4>
                <CountBadge>{includedCount} of {styles.length} selected</CountBadge>
              </StylesHeader>

              <StylesTable>
                <StylesTableHead>
                  <span />
                  <span>File / Detected Style</span>
                  <span>Weight</span>
                  <span>Style</span>
                  <span style={{ textAlign: "center" }}>Preview</span>
                  <span />
                </StylesTableHead>

                {styles.map((row) => (
                  <StylesTableRow key={row.uid} $active={previewRow?.uid === row.uid}>
                    <CheckboxInput
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateStyleRow(row.uid, { include: e.target.checked })}
                      aria-label={`Include ${row.meta.subfamilyName}`}
                    />
                    <FileInfo>
                      <FiFile size={14} />
                      <div className="file-details">
                        <span className="file-name">{row.meta.file.name}</span>
                        <span className="detected">
                          Detected: {row.meta.familyName} - {row.meta.subfamilyName}
                        </span>
                      </div>
                    </FileInfo>
                    <ReadOnlyField>
                      {FONT_WEIGHT_OPTIONS.find((w) => w.value === row.weight)?.label || `${row.weight}`}
                    </ReadOnlyField>
                    <ReadOnlyField style={{ textTransform: "capitalize" }}>
                      {row.style}
                    </ReadOnlyField>
                    <div style={{ textAlign: "center" }}>
                      <PreviewBtn
                        type="button"
                        $active={previewRow?.uid === row.uid}
                        onClick={() => selectPreview(row)}
                      >
                        {previewRow?.uid === row.uid ? "Active" : "View"}
                      </PreviewBtn>
                    </div>
                    <RemoveBtn
                      onClick={() => removeStyleRow(row.uid)}
                      aria-label={`Remove ${row.meta.file.name}`}
                    >
                      <FiTrash2 size={14} />
                    </RemoveBtn>
                  </StylesTableRow>
                ))}
              </StylesTable>
              {fieldErrors.styles && styles.length > 0 ? (
                <InlineError style={{ marginTop: "8px" }}><FiAlertCircle size={11} />{fieldErrors.styles}</InlineError>
              ) : (
                <FieldHint style={{ marginTop: "8px" }}>
                  Weight and style are auto-detected from the font's internal metadata.
                </FieldHint>
              )}
            </StylesSection>
          )}

          {/* Settings + Preview */}
          {styles.length > 0 && (
            <SettingsPreviewGrid>
              {/* Left: Classification */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Category (multi-select) */}
                <FieldGroup>
                  <FieldLabel>Category *</FieldLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {FONT_CATEGORIES.map((cat) => (
                      <PreviewBtn
                        key={cat.value}
                        type="button"
                        $active={category.includes(cat.value)}
                        onClick={() => {
                          toggleCategory(cat.value);
                          if (fieldErrors.category) setFieldErrors((prev) => ({ ...prev, category: "" }));
                        }}
                        style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "0.8rem" }}
                      >
                        {category.includes(cat.value) && <FiCheck size={12} style={{ marginRight: "4px" }} />}
                        {cat.label}
                      </PreviewBtn>
                    ))}
                  </div>
                  {fieldErrors.category && (
                    <InlineError><FiAlertCircle size={11} />{fieldErrors.category}</InlineError>
                  )}
                </FieldGroup>

                {/* Script Support */}
                <FieldGroup>
                  <FieldLabel>Script Support</FieldLabel>
                  <CheckboxGrid>
                    {FONT_SCRIPTS.map((script) => (
                      <CheckboxLabel key={script.value}>
                        <CheckboxInput
                          type="checkbox"
                          checked={scripts.includes(script.value)}
                          onChange={() => toggleScript(script.value)}
                        />
                        {script.label}
                      </CheckboxLabel>
                    ))}
                  </CheckboxGrid>
                </FieldGroup>

                {/* Locales */}
                <FieldGroup>
                  <FieldLabel>Locales <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span></FieldLabel>
                  <CheckboxGrid style={{ maxHeight: "130px" }}>
                    {LOCALE_OPTIONS.map((loc) => (
                      <CheckboxLabel key={loc.value}>
                        <CheckboxInput
                          type="checkbox"
                          checked={locales.includes(loc.value)}
                          onChange={() => toggleLocale(loc.value)}
                        />
                        {loc.label}
                      </CheckboxLabel>
                    ))}
                  </CheckboxGrid>
                </FieldGroup>

                {/* Toggles */}
                <ToggleCard>
                  <ToggleRow onClick={() => setPrintSafe(!printSafe)}>
                    <ToggleInfo>
                      <div className="label">Print Safe</div>
                      <div className="desc">Approved for print output</div>
                    </ToggleInfo>
                    <ToggleIcon $on={printSafe}>
                      {printSafe ? <MdOutlineToggleOn /> : <MdOutlineToggleOff />}
                    </ToggleIcon>
                  </ToggleRow>
                  <ToggleRow onClick={() => setPremium(!premium)}>
                    <ToggleInfo>
                      <div className="label">Premium</div>
                      <div className="desc">Mark as premium font</div>
                    </ToggleInfo>
                    <ToggleIcon $on={premium}>
                      {premium ? <MdOutlineToggleOn /> : <MdOutlineToggleOff />}
                    </ToggleIcon>
                  </ToggleRow>
                  <ToggleRow onClick={() => setEnabled(!enabled)}>
                    <ToggleInfo>
                      <div className="label">Enabled</div>
                      <div className="desc">Visible in the editor</div>
                    </ToggleInfo>
                    <ToggleIcon $on={enabled}>
                      {enabled ? <MdOutlineToggleOn /> : <MdOutlineToggleOff />}
                    </ToggleIcon>
                  </ToggleRow>
                </ToggleCard>
              </div>

              {/* Right: Live Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <FieldLabel>Live Preview</FieldLabel>
                <PreviewPanel>
                  {previewRow ? (
                    <>
                      {/* Inject @font-face dynamically */}
                      <style
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            const url = previewRow.meta.previewUrl;
                            const name = (previewRow.meta.file?.name || "").toLowerCase();
                            let fmt = "truetype";
                            if (name.endsWith(".woff2")) fmt = "woff2";
                            else if (name.endsWith(".woff")) fmt = "woff";
                            else if (name.endsWith(".otf")) fmt = "opentype";
                            return `@font-face { font-family: "${previewFontFamily}"; src: url("${url}") format("${fmt}"); }`;
                          })(),
                        }}
                      />
                      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <PreviewBadge>{makeStyleLabel(previewRow.weight, previewRow.style)}</PreviewBadge>
                        <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{previewRow.meta.file.name}</span>
                      </div>
                      <PreviewTextArea>
                        <p style={{ fontSize: "1.5rem", lineHeight: 1.5, color: "#374151", fontFamily: `"${previewFontFamily}", sans-serif`, margin: 0 }}>
                          Aa Bb Cc Dd Ee Ff Gg
                        </p>
                        <p style={{ fontSize: "1.1rem", color: "#374151", fontFamily: `"${previewFontFamily}", sans-serif`, margin: "8px 0 0 0" }}>
                          0123456789 !@#$%
                        </p>
                      </PreviewTextArea>
                      <FieldLabel style={{ marginTop: "16px", fontSize: "0.72rem", color: "#9ca3af" }}>Sample Text</FieldLabel>
                      <SampleInput
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        placeholder="Type sample text..."
                      />
                      <PreviewTextArea style={{ marginTop: "8px" }}>
                        <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "#374151", fontFamily: `"${previewFontFamily}", sans-serif`, margin: 0 }}>
                          {previewText}
                        </p>
                      </PreviewTextArea>
                    </>
                  ) : (
                    <EmptyPreview>
                      <FiFile size={28} />
                      <span>{sourceTab === "google" ? "Fetch a Google Font to see a live preview" : "Upload font files to see a live preview"}</span>
                    </EmptyPreview>
                  )}
                </PreviewPanel>
              </div>
            </SettingsPreviewGrid>
          )}
        </Body>

        {/* Footer */}
        <Footer>
          <CancelBtn onClick={onClose}>Cancel</CancelBtn>
          <SubmitBtn onClick={handleSubmit} disabled={isSubmitting || styles.length === 0}>
            {isSubmitting ? (
              <>
                <Spinner animation="border" size="sm" />
                {sourceTab === "google" ? "Importing..." : "Adding..."}
              </>
            ) : (
              sourceTab === "google" ? "Import Font" : "Add Font"
            )}
          </SubmitBtn>
        </Footer>
      </Container>
    </Overlay>
  );
}

export default AddFontDialog;
