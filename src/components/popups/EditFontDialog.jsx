/**
 * EditFontDialog
 * Dialog for editing existing font metadata — category, scripts, locales,
 * toggles. Read-only font info and style details are shown at the top.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Spinner } from "react-bootstrap";
import { IoClose } from "react-icons/io5";
import { FiCheck, FiSave, FiGlobe, FiUpload, FiPlus } from "react-icons/fi";
import { FaCrown } from "react-icons/fa6";
import { MdOutlineToggleOn, MdOutlineToggleOff } from "react-icons/md";
import styled from "styled-components";
import {
  FONT_CATEGORIES,
  FONT_SCRIPTS,
  LOCALE_OPTIONS,
} from "../../library/utils/common-functions/fontParser";
import { apiPost, apiMultiPartPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";

// ─── Styled Components ───────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 12200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const Container = styled.div`
  width: 85%;
  max-width: 960px;
  max-height: 88vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease;
  @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @media (max-width: 768px) { width: 96%; max-height: 96vh; }
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
  h3 { font-size: 1.2rem; font-weight: 700; color: #111827; margin: 0; }
  p { font-size: 0.8rem; color: #6b7280; margin: 4px 0 0 0; }
`;

const CloseBtn = styled.button`
  background: none; border: none; padding: 6px; border-radius: 8px;
  cursor: pointer; color: #6b7280; transition: all 0.2s;
  &:hover { background: #f3f4f6; color: #111827; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const ErrorMsg = styled.div`
  background: #f2f2f2;
  border: 1px solid #e6e6e6;
  color: #111111;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-bottom: 20px;
`;

// Read-only info panel
const InfoPanel = styled.div`
  background: #f9fafb;
  border-radius: 10px;
  padding: 18px;
  margin-bottom: 24px;
`;

const InfoTitle = styled.h4`
  font-size: 0.85rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 14px 0;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
`;

const InfoItem = styled.div`
  .info-label { font-size: 0.72rem; color: #9ca3af; }
  .info-value { font-size: 0.85rem; font-weight: 500; color: #111827; margin-top: 2px; }
  .info-mono { font-family: monospace; font-size: 0.82rem; }
`;

const InfoBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  font-size: 0.72rem;
  color: #6b7280;
  margin-right: 4px;
  margin-bottom: 4px;
`;

const SourceDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 0.85rem;
  font-weight: 500;
  color: #111827;
  text-transform: capitalize;
  svg { color: #9ca3af; }
`;

// Two-column layout
const TwoColGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
`;

const FieldLabel = styled.label`
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
`;

const ChipGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#e5e7eb")};
  background: ${(props) => (props.$active ? "rgba(0, 0, 0, 0.08)" : "#fff")};
  color: ${(props) => (props.$active ? "var(--primary, #4084B5)" : "#6b7280")};
  &:hover { border-color: var(--primary, #4084B5); color: var(--primary, #4084B5); }
`;

const CheckboxGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: ${(props) => props.$maxH || "180px"};
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

const CheckboxInput = styled.input`
  width: 16px;
  height: 16px;
  accent-color: var(--primary, #4084B5);
  cursor: pointer;
`;

const ToggleCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
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
  .label { font-size: 0.85rem; font-weight: 500; color: #374151; display: flex; align-items: center; gap: 6px; }
  .desc { font-size: 0.72rem; color: #9ca3af; margin-top: 1px; }
`;

const ToggleIcon = styled.span`
  font-size: 1.8rem;
  line-height: 1;
  color: ${(props) => (props.$on ? "var(--primary, #4084B5)" : "#d1d5db")};
  transition: color 0.2s;
`;

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

const SaveBtn = styled.button`
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

// ─── Component ───────────────────────────────────────────────────────────────

function EditFontDialog({ isOpen, font, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [scripts, setScripts] = useState(["latin"]);
  const [locales, setLocales] = useState([]);
  const [printSafe, setPrintSafe] = useState(false);
  const [premium, setPremium] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pendingStyleFiles, setPendingStyleFiles] = useState([]);
  const styleFileRef = useRef(null);

  // Initialize from font prop (use _id so it only re-runs when a different font is selected)
  const fontId = font?._id;
  useEffect(() => {
    if (font) {
      setCategories(
        Array.isArray(font.category) ? [...font.category] : font.category ? [font.category] : []
      );
      setScripts([...(font.scripts || ["latin"])]);
      setLocales([...(font.locales || [])]);
      setPrintSafe(font.printSafe || false);
      setPremium(font.premium || false);
      setEnabled(font.enabled ?? true);
      setPendingStyleFiles([]);
      setError(null);
    }
  }, [fontId]);

  // Track changes
  const hasChanges = useMemo(() => {
    if (!font) return false;
    const origCat = Array.isArray(font.category) ? font.category : font.category ? [font.category] : [];
    return (
      pendingStyleFiles.length > 0 ||
      JSON.stringify([...categories].sort()) !== JSON.stringify([...origCat].sort()) ||
      JSON.stringify([...scripts].sort()) !== JSON.stringify([...(font.scripts || ["latin"])].sort()) ||
      JSON.stringify([...locales].sort()) !== JSON.stringify([...(font.locales || [])].sort()) ||
      printSafe !== (font.printSafe || false) ||
      premium !== (font.premium || false) ||
      enabled !== (font.enabled ?? true)
    );
  }, [categories, scripts, locales, printSafe, premium, enabled, font, pendingStyleFiles]);

  const toggleCategory = (val) => {
    setCategories((prev) => prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]);
  };

  const toggleScript = (val) => {
    setScripts((prev) => prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]);
  };

  const toggleLocale = (val) => {
    setLocales((prev) => prev.includes(val) ? prev.filter((l) => l !== val) : [...prev, val]);
  };

  const handleSave = async () => {
    if (categories.length === 0) {
      setError("Please select at least one category.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build the font metadata payload
      const fontData = {
        _id: font._id,
        name: font.name,
        fontId: font.fontId,
        category: categories,
        scripts,
        locales,
        printSafe,
        premium,
        enabled,
      };

      if (pendingStyleFiles.length > 0) {
        // When there are new style files, send everything via FormData
        const formData = new FormData();

        // Append each file under "files" key
        for (let i = 0; i < pendingStyleFiles.length; i++) {
          const file = pendingStyleFiles[i];
          formData.append("files", file, file.name);
        }

        // Append font metadata as JSON string under "data" key
        formData.append("data", JSON.stringify(fontData));

        const response = await apiMultiPartPost(ENDPOINTS.updateFont, formData);
        if (response?.error) {
          throw new Error(response.error?.message || response.error || "Failed to update font");
        }
      } else {
        // No files — send metadata as JSON
        const response = await apiPost(ENDPOINTS.updateFont, fontData);
        if (response?.error) {
          throw new Error(response.error?.message || response.error || "Update failed");
        }
      }

      setPendingStyleFiles([]);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to update font. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add Style handler — queue files locally, upload on Save
  const handleAddStyleFiles = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setPendingStyleFiles((prev) => {
      const updated = [...prev, ...fileArray];
      return updated;
    });
    // Reset asynchronously so the onChange completes first
    setTimeout(() => { if (e.target) e.target.value = ""; }, 0);
  };

  const triggerFileSelect = () => {
    if (styleFileRef.current) {
      styleFileRef.current.click();
    }
  };

  const removePendingFile = (index) => {
    setPendingStyleFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen || !font) return null;

  const uniqueWeights = [...new Set((font.styles || []).map((s) => s.weight))].sort((a, b) => a - b);

  return (
    <Overlay onClick={onClose}>
      <Container onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <Header>
          <HeaderLeft>
            <h3>Edit: {font.name}</h3>
            <p>Modify font metadata and settings</p>
          </HeaderLeft>
          <CloseBtn onClick={onClose} aria-label="Close edit font dialog">
            <IoClose size={20} />
          </CloseBtn>
        </Header>

        {/* Body */}
        <Body>
          {error && <ErrorMsg role="alert">{error}</ErrorMsg>}

          {/* Read-only Font Information */}
          <InfoPanel>
            <InfoTitle>Font Information</InfoTitle>
            <InfoGrid>
              <InfoItem>
                <div className="info-label">Name</div>
                <div className="info-value">{font.name}</div>
              </InfoItem>
              <InfoItem>
                <div className="info-label">Font ID</div>
                <div className="info-value info-mono">{font.fontId}</div>
              </InfoItem>
              <InfoItem>
                <div className="info-label">Source</div>
                <SourceDisplay>
                  {font.source === "google" ? <FiGlobe size={14} /> : <FiUpload size={14} />}
                  {font.source === "google" ? "Google Fonts" : "Uploaded"}
                </SourceDisplay>
              </InfoItem>
              <InfoItem>
                <div className="info-label">Created By</div>
                <div className="info-value" style={{ textTransform: "capitalize" }}>
                  {font.createdBy || "admin"}
                </div>
              </InfoItem>
            </InfoGrid>

            <InfoGrid style={{ marginTop: "16px" }}>
              <InfoItem>
                <div className="info-label">Styles</div>
                <div className="info-value">
                  {font.styles?.length || 0} style{(font.styles?.length || 0) !== 1 ? "s" : ""}
                </div>
              </InfoItem>
              <InfoItem>
                <div className="info-label">Weights</div>
                <div style={{ marginTop: "4px" }}>
                  {uniqueWeights.map((w) => (
                    <InfoBadge key={w}>{w}</InfoBadge>
                  ))}
                </div>
              </InfoItem>
              <InfoItem style={{ gridColumn: "span 2" }}>
                <div className="info-label">Style Details</div>
                <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
                  {(font.styles || []).map((s) => (
                    <InfoBadge key={s.styleId}>{s.label}</InfoBadge>
                  ))}
                  <input
                    ref={styleFileRef}
                    type="file"
                    id="edit-font-style-upload"
                    accept=".ttf,.otf,.woff,.woff2"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleAddStyleFiles}
                  />
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 10px",
                      border: "1px dashed var(--primary)",
                      borderRadius: "5px",
                      background: "rgba(0, 0, 0, 0.05)",
                      color: "var(--primary)",
                      fontSize: "0.72rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <FiPlus size={12} />
                    Add Style
                  </button>
                </div>
                {pendingStyleFiles.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {pendingStyleFiles.map((file, idx) => (
                      <span
                        key={`${file.name}-${idx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          background: "#eff6ff",
                          border: "1px solid #e6e6e6",
                          borderRadius: "5px",
                          fontSize: "0.72rem",
                          color: "#1e40af",
                        }}
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0 2px",
                            cursor: "pointer",
                            color: "#93a3b8",
                            lineHeight: 1,
                          }}
                          aria-label={`Remove ${file.name}`}
                        >
                          <IoClose size={12} />
                        </button>
                      </span>
                    ))}
                    <span style={{ fontSize: "0.7rem", color: "#6b7280", alignSelf: "center" }}>
                      (will upload on save)
                    </span>
                  </div>
                )}
              </InfoItem>
            </InfoGrid>
          </InfoPanel>

          {/* Editable Settings */}
          <TwoColGrid>
            {/* Left column */}
            <div>
              {/* Category */}
              <FieldGroup>
                <FieldLabel>Category *</FieldLabel>
                <ChipGroup>
                  {FONT_CATEGORIES.map((cat) => (
                    <Chip
                      key={cat.value}
                      type="button"
                      $active={categories.includes(cat.value)}
                      onClick={() => toggleCategory(cat.value)}
                    >
                      {categories.includes(cat.value) && <FiCheck size={12} />}
                      {cat.label}
                    </Chip>
                  ))}
                </ChipGroup>
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
                <FieldLabel>
                  Locales <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
                </FieldLabel>
                <CheckboxGrid $maxH="130px">
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
            </div>

            {/* Right column */}
            <div>
              {/* Toggles */}
              <FieldGroup>
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
                      <div className="label">
                        Premium
                        <FaCrown size={12} style={{ color: "#111111" }} />
                      </div>
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
              </FieldGroup>
            </div>
          </TwoColGrid>
        </Body>

        {/* Footer */}
        <Footer>
          <CancelBtn onClick={onClose}>Cancel</CancelBtn>
          <SaveBtn onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <Spinner animation="border" size="sm" />
                Saving...
              </>
            ) : (
              <>
                <FiSave size={15} />
                Save Changes
              </>
            )}
          </SaveBtn>
        </Footer>
      </Container>
    </Overlay>
  );
}

export default EditFontDialog;
