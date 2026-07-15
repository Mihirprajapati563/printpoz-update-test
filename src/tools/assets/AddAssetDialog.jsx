/**
 * AddAssetDialog
 * Dialog for creating new assets (backgrounds, cliparts, or masks).
 * Supports MULTIPLE file uploads.
 *
 * Payload fields: name, tagsArr, type, brand_id, image_set_as_icon (not for mask),
 *   display_in_app, display_in_web, keywords, files (multiple image/SVG)
 * Endpoint: editor-settings/create/ (multipart)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "react-bootstrap";
import { IoClose } from "react-icons/io5";
import { FiUploadCloud, FiX, FiCheck, FiFile } from "react-icons/fi";
import styled from "styled-components";
import {
  apiPost,
  apiMultiPartPost,
} from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { getUserDetails } from "../../library/utils/services/theme";

// ─── Config ──────────────────────────────────────────────────────────────────

const LABELS = {
  background: "Background",
  clipart: "Clipart",
  mask: "Mask",
};

// ─── Styled Components ──────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 12200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: addFadeIn 0.15s ease;

  @keyframes addFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Container = styled.div`
  width: 90%;
  height: 90%;
  max-width: 80%;
  max-height: 80%;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: addSlideUp 0.25s ease;

  @keyframes addSlideUp {
    from { transform: translateY(14px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: 768px) {
    width: 95%;
    height: 95%;
    max-width: none;
    max-height: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;

  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  p {
    font-size: 0.78rem;
    color: #6b7280;
    margin: 2px 0 0;
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
  padding: 20px 24px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${(p) => p.$cols || "1fr"};
  gap: 16px;
  margin-bottom: 18px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
`;

const TextInput = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #111827;
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--primary, #4084B5);
    outline: none;
    box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1);
  }
`;

const TagSearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.82rem;
  color: #111827;
  outline: none;
  &::placeholder { color: #9ca3af; }
`;

const TagsDropdown = styled.div`
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
`;

const TagOption = styled.div`
  padding: 8px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s;
  color: ${(p) => (p.$selected ? "var(--primary, #4084B5)" : "#374151")};
  background: ${(p) => (p.$selected ? "#f0f9ff" : "transparent")};
  &:hover { background: ${(p) => (p.$selected ? "#e0f2fe" : "#f3f4f6")}; }
`;

const TagsInputWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-height: 40px;
  align-items: center;
  cursor: text;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--primary, #4084B5);
    box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1);
  }

  input {
    border: none;
    outline: none;
    flex: 1;
    min-width: 80px;
    font-size: 0.82rem;
    color: #111827;
    background: none;
  }
`;

const TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: ${(p) => (p.$highlighted ? "#bfdbfe" : "#eff6ff")};
  border: 1px solid ${(p) => (p.$highlighted ? "#60a5fa" : "#bfdbfe")};
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  color: #1d4ed8;
  transition: all 0.2s;
  animation: chipScaleIn 0.2s ease;

  @keyframes chipScaleIn {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  button {
    background: none;
    border: none;
    padding: 0;
    color: ${(p) => (p.$highlighted ? "#ef4444" : "#93c5fd")};
    cursor: pointer;
    display: flex;
    transition: all 0.2s;
    &:hover { color: #dc2626; transform: scale(1.1); }
  }
`;

const DropZone = styled.div`
  border: 2px dashed ${(p) => (p.$hasFiles ? "var(--primary, #4084B5)" : "#d1d5db")};
  border-radius: 10px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(p) => (p.$hasFiles ? "#f0f9ff" : "#fafafa")};

  &:hover {
    border-color: var(--primary, #4084B5);
    background: #f0f9ff;
  }

  .icon { color: #9ca3af; margin-bottom: 6px; }
  .label { font-size: 0.82rem; color: #6b7280; font-weight: 500; }
  .hint { font-size: 0.72rem; color: #9ca3af; margin-top: 3px; }
`;

const FilesGrid = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
`;

const FileItem = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);

  img, .svg-placeholder, .file-placeholder {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border: none;
    border-radius: 0;
  }
  .svg-placeholder, .file-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    font-size: 0.85rem;
    color: #6b7280;
    font-weight: 600;
  }

  .remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    &:hover { background: #ef4444; transform: scale(1.1); }
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;
  font-size: 0.82rem;
  color: #374151;
  font-weight: 500;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--primary, #4084B5);
    cursor: pointer;
  }
`;

const Divider = styled.div`
  border-top: 1px solid #f3f4f6;
  margin: 6px 0 12px;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
`;

const CancelBtn = styled.button`
  padding: 9px 22px;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #f3f4f6; border-color: #d1d5db; }
`;

const SaveBtn = styled.button`
  padding: 9px 26px;
  background: var(--primary, #4084B5);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  &:hover:not(:disabled) {
    background: var(--primary-dark, #000000);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 132, 181, 0.3);
  }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const ErrorMsg = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-bottom: 14px;
`;

// ─── Component ───────────────────────────────────────────────────────────────

function AddAssetDialog({ isOpen, assetType, onClose, onSuccess }) {
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, preview }
  const [displayInApp, setDisplayInApp] = useState(false);
  const [displayInWeb, setDisplayInWeb] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const user = getUserDetails();

  const fileInputRef = useRef(null);
  const typeLabel = LABELS[assetType] || "Asset";
  const isMask = assetType === "mask";


  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
    };
  }, [selectedFiles]);

  const addFiles = useCallback((files) => {
    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9) + Date.now(),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((idToRemove) => {
    setSelectedFiles((prev) => {
      const fileObj = prev.find(f => f.id === idToRemove);
      if (fileObj && fileObj.preview) {
        URL.revokeObjectURL(fileObj.preview);
      }
      return prev.filter(f => f.id !== idToRemove);
    });
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };



  const handleSave = async () => {
    setError(null);
    if (selectedFiles.length === 0) return setError("Please select at least one file.");

    setSaving(true);
    try {
      const fd = new FormData();

      const dataObj = {
        type: assetType,
        brand_id: user?.brand_id,
        display_in_app: displayInApp,
        display_in_web: displayInWeb,
      };

      fd.append("data", JSON.stringify(dataObj));

      // Append all files to SAME key 'files'
      selectedFiles.forEach((item) => {
        fd.append("files", item.file);
      });

      const res = await apiMultiPartPost(ENDPOINTS.createEditorSetting, fd);

      if (res && !res.error) {
        onSuccess?.();
      } else {
        setError(res?.error || "Failed to create assets.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderedFiles = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    return (
      <FilesGrid>
        {selectedFiles.map((item) => (
          <FileItem key={item.id}>
            {item.preview ? (
              <img src={item.preview} alt="prev" loading="lazy" decoding="async" style={{ contentVisibility: "auto" }} />
            ) : (
              <div className="file-placeholder">
                {item.file.name.split(".").pop().toUpperCase()}
              </div>
            )}
            <button className="remove-btn" onClick={() => removeFile(item.id)} title="Remove">
              <FiX size={14} />
            </button>
          </FileItem>
        ))}
      </FilesGrid>
    );
  }, [selectedFiles, removeFile]);

  if (!isOpen) return null;

  const fileAccept = isMask ? "image/*,.svg" : "image/*";
  const fileHint = isMask
    ? "SVG, PNG, JPG, WebP up to 10MB"
    : "PNG, JPG, WebP up to 10MB";

  return createPortal(
    <Overlay onClick={(e) => e.stopPropagation()}>
      <Container onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <h2>Add {typeLabel}s</h2>
            <p>Upload one or more {typeLabel.toLowerCase()} assets</p>
          </div>
          <CloseBtn onClick={onClose}><IoClose size={22} /></CloseBtn>
        </Header>

        <Body>
          {error && <ErrorMsg>{error}</ErrorMsg>}



          <Row>
            <Field>
              <label>Select Files *</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={fileAccept}
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <DropZone
                $hasFiles={selectedFiles.length > 0}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="icon"><FiUploadCloud size={26} /></div>
                <div className="label">Click to upload or drag & drop</div>
                <div className="hint">{fileHint}</div>
              </DropZone>

              {renderedFiles}
            </Field>
          </Row>


          <CheckRow>
            <input
              type="checkbox"
              checked={displayInApp}
              onChange={(e) => setDisplayInApp(e.target.checked)}
            />
            Display in App
          </CheckRow>
          <CheckRow>
            <input
              type="checkbox"
              checked={displayInWeb}
              onChange={(e) => setDisplayInWeb(e.target.checked)}
            />
            Display in Web
          </CheckRow>
        </Body>

        <Footer>
          <CancelBtn onClick={onClose} disabled={saving}>Cancel</CancelBtn>
          <SaveBtn onClick={handleSave} disabled={saving || selectedFiles.length === 0}>
            {saving ? <><Spinner animation="border" size="sm" /> Saving…</> : `Add Assets`}
          </SaveBtn>
        </Footer>
      </Container>
    </Overlay>,
    document.body
  );
}

export default AddAssetDialog;
