import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "react-bootstrap";
import { IoClose } from "react-icons/io5";
import { FiX, FiRefreshCw } from "react-icons/fi";
import styled from "styled-components";
import { apiGet, apiPost, apiPatch, apiMultiPartPatch } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { getUserDetails } from "../../library/utils/services/theme";

// ─── Styled Components ───────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 12200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vdFadeIn 0.15s ease;
  @keyframes vdFadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const Container = styled.div`
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: vdSlideUp 0.25s ease;
  @keyframes vdSlideUp {
    from { transform: translateY(14px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
  h2 { font-size: 1.1rem; font-weight: 700; color: #111827; margin: 0; }
`;

const CloseBtn = styled.button`
  background: none; border: none; padding: 6px; border-radius: 8px;
  cursor: pointer; color: #6b7280; transition: all 0.2s;
  &:hover { background: #f3f4f6; color: #111827; }
`;

const Body = styled.div`
  flex: 1; overflow-y: auto; padding: 20px 24px;
`;

const Footer = styled.div`
  display: flex; align-items: center; justify-content: flex-end;
  gap: 10px; padding: 14px 24px; border-top: 1px solid #e9ecef; flex-shrink: 0;
`;

const Btn = styled.button`
  padding: 9px 22px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
  &.cancel {
    background: none; border: 1px solid #e5e7eb; color: #ef4444;
    &:hover { background: #fef2f2; border-color: #fca5a5; }
  }
  &.primary {
    background: var(--primary, #4084B5); color: #fff; border: none;
    display: flex; align-items: center; gap: 6px;
    &:hover:not(:disabled) { background: var(--primary-dark, #000000); }
    &:disabled { opacity: 0.55; cursor: not-allowed; }
  }
`;

const Row = styled.div`
  margin-bottom: 18px;
`;

const Label = styled.label`
  display: block; font-size: 0.82rem; font-weight: 600; color: #374151; margin-bottom: 7px;
`;

const TypeGroup = styled.div`
  display: flex; gap: 16px; align-items: center;
`;

const RadioLabel = styled.label`
  display: flex; align-items: center; gap: 6px; font-size: 0.85rem;
  cursor: not-allowed; color: #6b7280;
  input { cursor: not-allowed; }
`;

const ReadInput = styled.input`
  width: 100%; padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.85rem; color: #374151; background: #f9fafb; cursor: not-allowed;
`;

const TwoCol = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 4px;
`;

const CheckboxGroup = styled.div`
  display: flex; gap: 20px;
`;

const CheckLabel = styled.label`
  display: flex; align-items: center; gap: 8px; font-size: 0.85rem;
  font-weight: 500; cursor: not-allowed;
  input { cursor: not-allowed; }
`;

/* ──── Tags ──── */
const TagsBox = styled.div`
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff;
`;

const TagSearchInput = styled.input`
  width: 100%; padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 6px;
  font-size: 0.82rem; margin-bottom: 6px; outline: none;
  &:focus { border-color: var(--primary, #4084B5); }
`;

const TagsList = styled.div`
  max-height: 120px; overflow-y: auto; display: flex; flex-direction: column;
`;

const TagOption = styled.div`
  padding: 6px 10px; font-size: 0.82rem; border-radius: 4px; cursor: pointer;
  background: ${p => p.$selected ? "rgba(64,132,181,0.12)" : "transparent"};
  color: ${p => p.$selected ? "var(--primary, #4084B5)" : "#374151"};
  font-weight: ${p => p.$selected ? 600 : 400};
  &:hover { background: ${p => p.$selected ? "rgba(64,132,181,0.18)" : "#f3f4f6"}; }
`;

const ChipsRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
`;

const TagChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
  background: var(--primary, #4084B5); border-radius: 6px;
  font-size: 0.73rem; font-weight: 600; color: #fff;
  button {
    background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer;
    padding: 0; display: flex; align-items: center;
    &:hover { color: #fff; }
  }
`;

/* ──── Keywords ──── */
const KwInput = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px;
  min-height: 42px; background: #fff; cursor: text;
  input {
    border: none; outline: none; font-size: 0.82rem; flex: 1; min-width: 120px;
    background: transparent; padding: 2px 0;
  }
`;

const KwChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
  background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 16px;
  font-size: 0.73rem; color: #374151;
  button {
    background: none; border: none; color: #9ca3af; cursor: pointer; padding: 0;
    display: flex; align-items: center;
    &:hover { color: #ef4444; }
  }
`;

/* ──── Image ──── */
const ImageThumb = styled.div`
  width: 100px; height: 100px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #f9fafb; overflow: hidden; display: flex;
  align-items: center; justify-content: center; margin-top: 8px;
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
`;

const ColorSwatch = styled.div`
  width: 24px; height: 24px; border-radius: 50%; border: 1px solid #e5e7eb;
  background-color: ${p => p.$color};
`;

const TimestampRow = styled.div`
  margin-top: 24px; padding-top: 16px; border-top: 1px dashed #e9ecef;
  display: flex; gap: 24px; font-size: 0.72rem; color: #9ca3af;
  b { color: #6b7280; font-weight: 600; }
`;

const TextArea = styled.textarea`
  width: 100%; padding: 9px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 0.85rem; color: #374151; background: #fff; outline: none; min-height: 80px;
  &:focus { border-color: var(--primary, #4084B5); }
`;

const ErrorBox = styled.div`
  padding: 12px 16px; color: #ef4444; background: #fef2f2;
  border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px;
`;

// ─── Component ───────────────────────────────────────────────────────────────

function ViewAssetDialog({ isOpen, assetId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // editable state
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [displayInApp, setDisplayInApp] = useState(false);
  const [displayInWeb, setDisplayInWeb] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState("");
  const [colors, setColors] = useState([]);
  const [colorInput, setColorInput] = useState("");
  const [description, setDescription] = useState("");
  const [objects, setObjects] = useState([]);
  const [objInput, setObjInput] = useState("");
  const [textInImage, setTextInImage] = useState("");

  // image state
  const [newFile, setNewFile] = useState(null);
  const [newFilePreview, setNewFilePreview] = useState(null);
  const fileInputRef = React.useRef(null);

  // tags dropdown state
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  // save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const user = getUserDetails();

  // ── Fetch asset details ──────────────────────────────────────────────────
  const fetchDetails = useCallback(() => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    apiGet(ENDPOINTS.viewEditorSetting + assetId)
      .then((res) => {
        if (res?.status === 1 && res.items) {
          const item = res.items;
          setData(item);
          setSelectedType(item.type || "");
          setName(item.name || "");
          setDisplayInApp(!!item.display_in_app);
          setDisplayInWeb(!!item.display_in_web);
          setSelectedTagIds((item.tagsArr || []).map(t => t._id));
          setKeywords((item.keywords || []).filter(Boolean));
          setColors((item.colors || []).filter(Boolean));
          setDescription(item.description || "");
          setObjects((item.objects || []).filter(Boolean));
          setTextInImage(item.textInImage || "");
        } else {
          setError(res?.message || "Failed to load asset details");
        }
      })
      .catch(() => setError("Network error occurred"))
      .finally(() => setLoading(false));
  }, [assetId]);

  // Clean up preview on unmount or file change
  useEffect(() => {
    return () => {
      if (newFilePreview) URL.revokeObjectURL(newFilePreview);
    };
  }, [newFilePreview]);

  useEffect(() => {
    if (!isOpen || !assetId) return;
    setNewFile(null);
    setNewFilePreview(null);
    fetchDetails();
  }, [isOpen, assetId, fetchDetails]);

  // ── Fetch tags for this type ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !selectedType) return;
    setLoadingTags(true);
    // Only clear tag selection if user changed the type (not on initial load)
    if (data?.type && selectedType !== data.type) {
      setSelectedTagIds([]);
    }
    apiPost(ENDPOINTS.getTagsListByType, {
      filter: {
        type: selectedType,
        brand_id: user?.brand_id,
        status: 1,
      },
    })
      .then((res) => setAvailableTags(res?.status === 1 && res.items ? res.items : []))
      .catch(() => setAvailableTags([]))
      .finally(() => setLoadingTags(false));
  }, [isOpen, selectedType]);

  // ── Tag helpers ─────────────────────────────────────────────────────────
  const toggleTag = (id) =>
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  // ── Keyword helpers ─────────────────────────────────────────────────────
  const addKw = (raw) => {
    const kw = raw.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) setKeywords(p => [...p, kw]);
    setKwInput("");
  };
  const removeKw = (kw) => setKeywords(p => p.filter(k => k !== kw));
  const handleKwKey = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKw(kwInput); }
    else if (e.key === "Backspace" && !kwInput && keywords.length > 0) {
      setKeywords(p => p.slice(0, -1));
    }
  };

  // ── Color helpers ──────────────────────────────────────────────────────
  const addColor = (raw) => {
    const c = raw.trim();
    if (c && !colors.includes(c)) setColors(p => [...p, c]);
    setColorInput("");
  };
  const removeColor = (c) => setColors(p => p.filter(x => x !== c));

  // ── Object helpers ─────────────────────────────────────────────────────
  const addObj = (raw) => {
    const o = raw.trim().toLowerCase();
    if (o && !objects.includes(o)) setObjects(p => [...p, o]);
    setObjInput("");
  };
  const removeObj = (o) => setObjects(p => p.filter(x => x !== o));

  // ── Save / PATCH ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const dataObj = {
        _id: assetId,
        type: selectedType,
        name,
        display_in_app: displayInApp,
        display_in_web: displayInWeb,
        tagsArr: selectedTagIds,
        keywords,
        colors,
        description,
        objects,
        textInImage,
      };

      let res;
      if (newFile) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(dataObj));
        fd.append("files", newFile);
        res = await apiMultiPartPatch(ENDPOINTS.updateEditorSetting + assetId, fd);
      } else {
        res = await apiPatch(ENDPOINTS.updateEditorSetting + assetId, dataObj);
      }

      if (res?.status === 1) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setSaveError(res?.message || res?.error || "Update failed");
      }
    } catch {
      setSaveError("Network error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewFile(file);
      const prev = URL.createObjectURL(file);
      setNewFilePreview(prev);
    }
  };

  if (!isOpen) return null;

  const thumbnail = data?.urls?.length > 0
    ? (data.urls.find(u => u.size === "small")?.url || data.urls[0].url)
    : null;

  const filteredTags = availableTags.filter(t =>
    !tagSearch.trim() || t.name?.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return createPortal(
    <Overlay onClick={onClose}>
      <Container onClick={e => e.stopPropagation()}>

        {/* Header */}
        <Header>
          <h2>Update {selectedType ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1) : ""} Material</h2>
          <CloseBtn onClick={onClose}><IoClose size={22} /></CloseBtn>
        </Header>

        {/* Body */}
        <Body>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              <Spinner animation="border" size="sm" />&nbsp; Loading details…
            </div>
          ) : error ? (
            <ErrorBox>{error}</ErrorBox>
          ) : data && (
            <>
              {saveError && <ErrorBox>{saveError}</ErrorBox>}

              {/* Material type — editable */}
              <Row>
                <Label>Material Type <span style={{ color: "#ef4444" }}>*</span></Label>
                <TypeGroup>
                  {["background", "clipart", "mask"].map(type => (
                    <RadioLabel key={type} style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="vd-materialType"
                        checked={selectedType === type}
                        onChange={() => setSelectedType(type)}
                        style={{ cursor: "pointer" }}
                        readOnly
                        disabled
                      />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </RadioLabel>
                  ))}
                </TypeGroup>
              </Row>

              <TwoCol>
                <Row>
                  <Label>Name <span style={{ color: "#ef4444" }}>*</span></Label>
                  <ReadInput 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    style={{ cursor: "text", background: "#fff" }} 
                  />
                </Row>
                <Row>
                  <Label>Display In</Label>
                  <CheckboxGroup style={{ marginTop: '10px' }}>
                    <CheckLabel style={{ cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={displayInApp} 
                        onChange={e => setDisplayInApp(e.target.checked)} 
                        style={{ cursor: "pointer" }}
                      />
                      App
                    </CheckLabel>
                    <CheckLabel style={{ cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={displayInWeb} 
                        onChange={e => setDisplayInWeb(e.target.checked)} 
                        style={{ cursor: "pointer" }}
                      />
                      Web
                    </CheckLabel>
                  </CheckboxGroup>
                </Row>
              </TwoCol>

              <TwoCol style={{ alignItems: 'start' }}>
                {/* Tags — editable */}
                <Row>
                  <Label>Tags</Label>
                  {selectedTagIds.length > 0 && (
                    <ChipsRow>
                      {selectedTagIds.map(id => {
                        const tag = availableTags.find(t => t._id === id);
                        if (!tag) return null;
                        return (
                          <TagChip key={id}>
                            <button onClick={() => toggleTag(id)}><FiX size={10} /></button>
                            {tag.name}
                          </TagChip>
                        );
                      })}
                    </ChipsRow>
                  )}
                  <TagsBox>
                    <TagSearchInput
                      placeholder="Search tags…"
                      value={tagSearch}
                      onChange={e => setTagSearch(e.target.value)}
                    />
                    {loadingTags ? (
                      <div style={{ textAlign: "center", padding: "8px", color: "#9ca3af", fontSize: "0.8rem" }}>
                        <Spinner animation="border" size="sm" /> Loading…
                      </div>
                    ) : (
                      <TagsList>
                        {filteredTags.length === 0
                          ? <div style={{ padding: "6px 10px", color: "#9ca3af", fontSize: "0.8rem" }}>No tags found</div>
                          : filteredTags.map(tag => (
                            <TagOption
                              key={tag._id}
                              $selected={selectedTagIds.includes(tag._id)}
                              onClick={() => toggleTag(tag._id)}
                            >
                              {tag.name}
                            </TagOption>
                          ))
                        }
                      </TagsList>
                    )}
                  </TagsBox>
                </Row>

                {/* Colors — editable */}
                <Row>
                  <Label>Colors</Label>
                  <ChipsRow>
                    {colors.map(c => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', padding: '3px 8px', borderRadius: '16px' }}>
                        <ColorSwatch $color={c} />
                        <span style={{ fontSize: '0.73rem', color: '#374151' }}>{c}</span>
                        <button onClick={() => removeColor(c)} style={{ background: 'none', border: 'none', color: '#9ca3af', padding: 0, display: 'flex', alignItems: 'center' }}>
                          <FiX size={10} />
                        </button>
                      </div>
                    ))}
                    <input
                      placeholder="Add hex/name…"
                      value={colorInput}
                      onChange={e => setColorInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor(colorInput); } }}
                      style={{ border: 'none', outline: 'none', fontSize: '0.82rem', width: '100px' }}
                    />
                  </ChipsRow>
                </Row>
              </TwoCol>

              <TwoCol style={{ alignItems: 'start' }}>
                {/* Objects — editable */}
                <Row>
                  <Label>Objects</Label>
                  <KwInput onClick={e => e.currentTarget.querySelector("input")?.focus()}>
                    {objects.map(obj => (
                      <KwChip key={obj}>
                        {obj}
                        <button onClick={() => removeObj(obj)}><FiX size={10} /></button>
                      </KwChip>
                    ))}
                    <input
                      placeholder={objects.length === 0 ? "e.g. heart, star…" : ""}
                      value={objInput}
                      onChange={e => setObjInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObj(objInput); } }}
                    />
                  </KwInput>
                </Row>

                {/* Text in Image — editable */}
                <Row>
                  <Label>Text in Image</Label>
                  <ReadInput
                    type="text"
                    value={textInImage}
                    onChange={e => setTextInImage(e.target.value)}
                    style={{ cursor: "text", background: "#fff" }}
                    placeholder="Any text visible in the image…"
                  />
                </Row>
              </TwoCol>

              <Row>
                <Label>Description</Label>
                <TextArea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed description of the asset…"
                />
              </Row>

              {/* Image preview — updatable */}
              <Row>
                <Label>Image <span style={{ color: "#ef4444" }}>*</span></Label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
                  {(newFilePreview || thumbnail) && (
                    <ImageThumb>
                      <img src={newFilePreview || thumbnail} alt="asset preview" />
                    </ImageThumb>
                  )}
                  <div style={{ marginBottom: '8px' }}>
                    <Btn 
                      className="cancel" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--primary, #4084B5)', color: 'var(--primary, #4084B5)' }}
                    >
                      Change Image
                    </Btn>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*" 
                      onChange={handleFileChange}
                    />
                    {newFile && (
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px' }}>
                        Selected: {newFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </Row>
            </>
          )}
        </Body>

        {/* Footer */}
        <Footer>
          <Btn className="cancel" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn className="primary" onClick={handleSave} disabled={saving || loading || !!error}>
            {saving ? <><Spinner animation="border" size="sm" /> Saving…</> : "Update"}
          </Btn>
        </Footer>

      </Container>
    </Overlay>,
    document.body
  );
}

export default ViewAssetDialog;
