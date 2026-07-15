import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { FaPlus, FaTrash, FaEdit, FaTags, FaCheck } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { MdAutoFixHigh, MdLinkOff } from "react-icons/md";
import {
  linkTextToGroup,
  unlinkTextFromGroup,
  setTextGroupValue,
  setTextGroupExample,
  setTextGroupMaxChar,
  removeTextGroup,
} from "../../store/slices/canvas";
import {
  getActiveObjectprops,
  getTextGroups,
} from "../../library/utils/helpers";
import { USER_TYPES } from "../../library/utils/constants";

// ─── Animation ────────────────────────────────────────────────────────
const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Styled Components ────────────────────────────────────────────────

const Root = styled.div`
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: var(--foreground);
`;

const Anim = styled.div`
  animation: ${fadeSlide} 0.18s ease;
`;

/* ── Linked banner ── */
const LinkedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--primary-foreground);
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;

  svg { width: 14px; height: 14px; flex-shrink: 0; }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const UnlinkBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1.5px solid color-mix(in srgb, var(--primary-foreground) 50%, transparent);
  border-radius: 20px;
  background: transparent;
  color: var(--primary-foreground);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: color-mix(in srgb, var(--primary-foreground) 20%, transparent); }
  svg { width: 11px; height: 11px; }
`;

/* ── Mode tabs (restored) ── */
const TabBar = styled.div`
  display: flex;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
`;

const TabBtn = styled.button`
  flex: 1;
  padding: 8px 6px;
  border: none;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: ${p => p.$active ? "var(--primary)" : "var(--background)"};
  color: ${p => p.$active ? "var(--primary-foreground)" : "var(--foreground)"};
  transition: background 0.15s, color 0.15s;
  line-height: 1.3;

  &:first-child { border-right: 1.5px solid var(--border); }

  &:hover:not(:disabled) {
    background: ${p => p.$active
      ? "var(--primary)"
      : "color-mix(in srgb, var(--primary) 8%, var(--background))"};
  }

  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

/* ── Selected word preview box ── */
const WordBox = styled.div`
  padding: 9px 12px;
  border-radius: 8px;
  border: 1.5px dashed ${p => p.$ok
    ? "var(--primary)"
    : "color-mix(in srgb, var(--destructive, #dc3545) 50%, var(--border))"};
  background: ${p => p.$ok
    ? "color-mix(in srgb, var(--primary) 6%, var(--background))"
    : "color-mix(in srgb, var(--destructive, #dc3545) 5%, var(--background))"};
  margin-bottom: 10px;
  font-size: 11.5px;
  line-height: 1.5;
`;

const WordTag = styled.span`
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 700;
  font-size: 12px;
`;

const CountPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--primary) 12%, var(--background));
  color: var(--primary);
  font-size: 10.5px;
  font-weight: 700;
  margin-left: 6px;
`;

/* ── Section label ── */
const StepLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted-foreground);
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
  }
`;

/* ── Field chips ── */
const ChipGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, var(--background));
    color: var(--primary);
  }
  svg { width: 10px; height: 10px; }
`;

/* ── Create new field section ── */
const CreateBox = styled.div`
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 4px;
  background: color-mix(in srgb, var(--muted-foreground) 3%, var(--background));
`;

const TextInput = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid var(--border);
  border-radius: 7px;
  font-size: 12px;
  margin-bottom: 7px;
  box-sizing: border-box;
  color: var(--foreground);
  background: var(--background);

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent);
  }
  &::placeholder { color: var(--muted-foreground); }
`;

const BtnRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  border: 1.5px solid ${p => {
    if (p.$primary) return "var(--primary)";
    if (p.$danger)  return "var(--destructive, #dc3545)";
    return "var(--border)";
  }};
  background: ${p => {
    if (p.$primary) return "var(--primary)";
    if (p.$danger)  return "var(--destructive, #dc3545)";
    return "var(--background)";
  }};
  color: ${p => (p.$primary || p.$danger) ? "var(--primary-foreground)" : "var(--foreground)"};

  &:hover:not(:disabled) { opacity: 0.82; }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
  svg { width: 11px; height: 11px; }
`;

const HR = styled.div`
  height: 1px;
  background: var(--border);
  margin: 10px 0;
`;

/* ── All fields list ── */
const FieldRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 5px;
  background: var(--background);
  &:hover { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
`;

const FieldName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
  flex: 0 0 auto;
`;

const FieldVal = styled.span`
  font-size: 11px;
  color: var(--muted-foreground);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-style: italic;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--muted-foreground);
  display: flex;
  align-items: center;
  border-radius: 5px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;

  &:hover {
    color: ${p => p.$danger ? "var(--destructive, #dc3545)" : "var(--primary)"};
    background: ${p => p.$danger
      ? "color-mix(in srgb, var(--destructive, #dc3545) 10%, var(--background))"
      : "color-mix(in srgb, var(--primary) 8%, transparent)"};
  }
  svg { width: 12px; height: 12px; }
`;

const InlineInput = styled.input`
  flex: 1;
  padding: 5px 8px;
  border: 1.5px solid ${p => p.$secondary ? "var(--border)" : "var(--primary)"};
  border-radius: 5px;
  font-size: 11.5px;
  min-width: 0;
  color: var(--foreground);
  background: var(--background);
  opacity: ${p => p.$secondary ? 0.75 : 1};
  &:focus { outline: none; border-color: var(--primary); }
`;

// ─── Helpers ──────────────────────────────────────────────────────────

function indexOfCI(haystack, needle) {
  if (!haystack || !needle) return -1;
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

const countOccurrences = (() => {
  let lT = null, lW = null, lC = 0;
  return (text, word) => {
    if (!text || !word) return 0;
    if (text === lT && word === lW) return lC;
    const h = text.toLowerCase(), n = word.toLowerCase();
    let c = 0, i = 0;
    while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; }
    lT = text; lW = word; lC = c;
    return c;
  };
})();

// ─── Main Component ───────────────────────────────────────────────────

function TextGroupPanel({ savedSelection = null }) {
  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const textGroups = useSelector(getTextGroups);

  const [mode, setMode]                     = useState("full");     // "full" | "word"
  const [selectionRange, setSelectionRange] = useState(null);
  const [isCreating, setIsCreating]         = useState(false);
  const [newLabel, setNewLabel]             = useState("");
  const [newExample, setNewExample]         = useState("");
  const [newMaxChars, setNewMaxChars]       = useState("");
  const [createError, setCreateError]       = useState(null);
  const [editingKey, setEditingKey]         = useState(null);
  const [editValue, setEditValue]           = useState("");
  const [editExample, setEditExample]       = useState("");
  const [editMaxChars, setEditMaxChars]     = useState("");
  const [editError, setEditError]           = useState(null);

  const modeRef       = useRef("full");
  const selRef        = useRef(null);
  const pendingSelRef = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { selRef.current = selectionRange; }, [selectionRange]);

  const isAdmin = (() => {
    try { return JSON.parse(localStorage.getItem("userDetails"))?.userTypeCode !== USER_TYPES.CUSTOMER; }
    catch { return false; }
  })();

  const isText     = activeObjectProps?.type === "text";
  const currentKey = activeObjectProps?.groupKey || null;
  const bodyText   = activeObjectProps?.text || "";
  const groupKeys  = useMemo(() => Object.keys(textGroups), [textGroups]);

  // Auto-detect highlighted word on open → switch to "word" mode
  useEffect(() => {
    if (!isText) return;
    if (savedSelection) {
      setSelectionRange(savedSelection); selRef.current = savedSelection;
      setMode("word");                   modeRef.current = "word";
      return;
    }
    const sel = window.getSelection();
    if (sel?.rangeCount > 0 && sel.toString().trim()) {
      const txt = sel.toString().trim();
      const idx = indexOfCI(bodyText, txt);
      if (idx !== -1 && txt.length < bodyText.length) {
        const range = { start: idx, end: idx + txt.length, text: txt };
        setSelectionRange(range); selRef.current = range;
        setMode("word");          modeRef.current = "word";
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Capture helpers ──────────────────────────────────────────────

  /** Sync capture — returns range without setting state (safe in mousedown) */
  const captureNow = useCallback(() => {
    if (savedSelection) return savedSelection;
    const sel = window.getSelection();
    if (sel?.rangeCount > 0 && sel.toString().trim()) {
      const txt = sel.toString().trim();
      const idx = indexOfCI(bodyText, txt);
      if (idx !== -1) return { start: idx, end: idx + txt.length, text: txt };
    }
    return null;
  }, [savedSelection, bodyText]);

  const applyCapture = useCallback((override) => {
    const r = override !== undefined ? override : captureNow();
    setSelectionRange(r); selRef.current = r;
  }, [captureNow]);

  // ─── Payload builder ──────────────────────────────────────────────

  const buildPayload = useCallback((groupKey, label, overrideMode, maxChars) => {
    const m = overrideMode || (modeRef.current === "word" ? "selection" : "full");
    const s = selRef.current;
    const p = { groupKey, label, linkMode: m };
    if (m === "selection" && s) {
      p.selectionStart = s.start;
      p.selectionEnd   = s.end;
      p.selectedText   = s.text;
    }
    if (maxChars !== undefined && maxChars !== "") p.maxChars = parseInt(maxChars, 10);
    return p;
  }, []);

  // ─── Action handlers ──────────────────────────────────────────────

  const doLink = useCallback((groupKey, forcedMode) => {
    if (!isText) return;
    const effMode = forcedMode || (modeRef.current === "word" ? "selection" : "full");
    const sel = selRef.current;

    if (effMode === "selection") {
      // Word mode: ensure a word is highlighted and found in the text
      if (!sel?.text) {
        alert("Please highlight a word in the canvas text first, then click a field.");
        return;
      }
      if (indexOfCI(bodyText, sel.text) === -1) {
        alert(`"${sel.text}" was not found in this text. Please re-select.`);
        return;
      }
    } else {
      // Full-text mode: block if the group already has a value that differs
      // from this object's text — prevents silent overwriting.
      const group = textGroups[groupKey];
      if (group?.value && bodyText && group.value.toLowerCase() !== bodyText.toLowerCase()) {
        alert(
          `Cannot link this text to "${group?.label || groupKey}".\n` +
          `The field expects "${group.value}" but this text says "${bodyText}".\n` +
          `Change the text to match, or create a new field instead.`
        );
        return;
      }
    }

    dispatch(linkTextToGroup(buildPayload(groupKey, textGroups[groupKey]?.label || groupKey, effMode)));
    setSelectionRange(null); selRef.current = null;
  }, [isText, bodyText, textGroups, dispatch, buildPayload]);

  const doCreateAndLink = useCallback(() => {
    if (!newLabel.trim() || !isText) return;
    const effMode = modeRef.current === "word" ? "selection" : "full";
    const sel = selRef.current;

    if (effMode === "selection") {
      if (!sel?.text) { alert("Please highlight a word first."); return; }
      if (indexOfCI(bodyText, sel.text) === -1) { alert(`"${sel.text}" wasn't found. Re-select it.`); return; }
    }

    const parsedMax = newMaxChars ? parseInt(newMaxChars, 10) : undefined;
    if (parsedMax !== undefined) {
      const defaultValue = effMode === "selection" ? (sel?.text || "") : bodyText;
      if (defaultValue.length > parsedMax) {
        setCreateError(`Max limit cannot be less than default text length (${defaultValue.length} chars).`);
        return;
      }
    }
    setCreateError(null);

    const key = newLabel.trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
      .replace(/\s/g, "");

    dispatch(linkTextToGroup(buildPayload(key, newLabel.trim(), effMode, newMaxChars)));
    if (newExample.trim()) dispatch(setTextGroupExample({ groupKey: key, example: newExample.trim() }));

    setNewLabel(""); setNewExample(""); setNewMaxChars(""); setCreateError(null); setIsCreating(false);
    setSelectionRange(null); selRef.current = null;
  }, [newLabel, newExample, newMaxChars, isText, bodyText, dispatch, buildPayload]);

  const doUnlink  = useCallback(() => dispatch(unlinkTextFromGroup()), [dispatch]);
  const doDelete  = useCallback((k) => dispatch(removeTextGroup({ groupKey: k })), [dispatch]);

  const startEdit = useCallback((k) => {
    setEditingKey(k);
    const val = textGroups[k]?.value || "";
    setEditValue(val);
    setEditExample(textGroups[k]?.example || "");
    setEditMaxChars(textGroups[k]?.maxChars || (val ? val.length.toString() : ""));
    setEditError(null);
  }, [textGroups]);

  const saveEdit = useCallback(() => {
    if (!editingKey) return;
    const parsedMax = editMaxChars ? parseInt(editMaxChars, 10) : undefined;
    
    if (parsedMax !== undefined && editValue.length > parsedMax) {
      setEditError(`Max limit cannot be less than default text length (${editValue.length} chars).`);
      return;
    }
    setEditError(null);

    dispatch(setTextGroupValue({ groupKey: editingKey, value: editValue }));
    dispatch(setTextGroupExample({ groupKey: editingKey, example: editExample }));
    dispatch(setTextGroupMaxChar({ groupKey: editingKey, maxChars: parsedMax }));
    setEditingKey(null); setEditValue(""); setEditExample(""); setEditMaxChars(""); setEditError(null);
  }, [editingKey, editValue, editExample, editMaxChars, dispatch]);

  const occurrences = useMemo(() =>
    mode === "word" && selectionRange?.text
      ? countOccurrences(bodyText, selectionRange.text)
      : 0,
    [mode, selectionRange, bodyText]);

  // Guard
  if (!isText || !isAdmin) return null;

  // ─── Shared: field picker (chips + create box) ────────────────────
  const renderFieldPicker = (linkedMode = false) => (
    <>
      {groupKeys.length > 0 ? (
        <>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 7 }}>
            {linkedMode
              ? "Assign highlighted word to a field:"
              : "Assign to existing field:"}
          </div>
          <ChipGrid>
            {groupKeys.map((k) => (
              <Chip key={k} onClick={() => doLink(k, linkedMode ? "selection" : undefined)}>
                <FaTags /> {textGroups[k]?.label || k}
              </Chip>
            ))}
          </ChipGrid>
        </>
      ) : (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, textAlign: "center" }}>
          No fields yet — create one below ↓
        </div>
      )}

      <CreateBox>
        {isCreating ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 7, color: "var(--foreground)" }}>New field name:</div>
            <TextInput
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder='e.g. "Guest Name", "Wedding Date"'
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") doCreateAndLink();
                if (e.key === "Escape") { setIsCreating(false); setNewLabel(""); setNewExample(""); }
              }}
            />
            <TextInput
              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
              placeholder='Optional hint for customers, e.g. "John & Jane"'
              onKeyDown={(e) => {
                if (e.key === "Enter") doCreateAndLink();
                if (e.key === "Escape") { setIsCreating(false); setNewLabel(""); setNewExample(""); setNewMaxChars(""); }
              }}
            />
            <TextInput
              type="number"
              min="1"
              value={newMaxChars}
              onChange={(e) => setNewMaxChars(e.target.value)}
              placeholder='Optional max character limit (e.g. 15)'
              onKeyDown={(e) => {
                if (e.key === "Enter") doCreateAndLink();
                if (e.key === "Escape") { setIsCreating(false); setNewLabel(""); setNewExample(""); setNewMaxChars(""); setCreateError(null); }
              }}
            />
            {createError && <div style={{ fontSize: 10.5, color: "var(--destructive, #dc3545)", marginBottom: 8 }}>{createError}</div>}
            <BtnRow>
              <Btn $primary onClick={doCreateAndLink} disabled={!newLabel.trim()}>
                <FaCheck /> Create & Link
              </Btn>
              <Btn onClick={() => { setIsCreating(false); setNewLabel(""); setNewExample(""); setNewMaxChars(""); setCreateError(null); }}>
                Cancel
              </Btn>
            </BtnRow>
          </>
        ) : (
          <Btn
            onClick={() => {
              setIsCreating(true);
              const effMode = modeRef.current === "word" ? "selection" : "full";
              if (effMode === "selection" && selRef.current?.text) {
                setNewMaxChars(selRef.current.text.length.toString());
              } else if (effMode === "full" && bodyText) {
                setNewMaxChars(bodyText.length.toString());
              }
            }}
            style={{ width: "100%", justifyContent: "center", borderStyle: "dashed" }}
          >
            <FaPlus /> Create New Field
          </Btn>
        )}
      </CreateBox>
    </>
  );

  // ─── State A: Already linked ──────────────────────────────────────
  if (currentKey) {
    return (
      <Root>
        <Anim>
          {/* Linked banner with inline Unlink */}
          <LinkedBanner>
            <MdAutoFixHigh />
            <span className="name">Linked: {textGroups[currentKey]?.label || currentKey}</span>
            <UnlinkBtn onClick={doUnlink}><MdLinkOff /> Unlink</UnlinkBtn>
          </LinkedBanner>

          <HR />

          {/* Link another word to a different field */}
          <StepLabel>Also link a word to another field</StepLabel>

          <WordBox $ok={!!selectionRange}>
            {selectionRange ? (
              <>
                <div style={{ marginBottom: 4 }}>
                  Highlighted: <WordTag>{selectionRange.text}</WordTag>
                  {occurrences > 1 && <CountPill>×{occurrences} matches</CountPill>}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                  All occurrences become editable. The rest stays fixed.
                </div>
              </>
            ) : (
              <div style={{ color: "var(--muted-foreground)" }}>
                💡 <strong>Highlight a word</strong> in the canvas text, then pick a field below to link it.
              </div>
            )}
          </WordBox>

          <div style={{ marginBottom: 10 }}>
            <Btn
              style={{ fontSize: 11 }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pendingSelRef.current = captureNow(); }}
              onClick={() => { applyCapture(pendingSelRef.current ?? undefined); pendingSelRef.current = null; }}
            >
              🔄 Refresh Selected Word
            </Btn>
          </div>

          {renderFieldPicker(true)}
        </Anim>

        {renderAllFields()}
      </Root>
    );
  }

  // ─── State B: Not linked ──────────────────────────────────────────
  const wordSelected = mode === "word" && !!selectionRange;
  const canLink = mode === "full" || wordSelected;

  return (
    <Root>
      <Anim>
        {/* Tabs (restored) */}
        <TabBar>
          <TabBtn
            $active={mode === "full"}
            title="Make the entire text block a Smart Text field"
            onClick={() => { setMode("full"); modeRef.current = "full"; }}
          >
            📄 Entire Text
          </TabBtn>
          <TabBtn
            $active={mode === "word"}
            title="Highlight a word on canvas, then click here"
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              pendingSelRef.current = captureNow();
            }}
            onClick={() => {
              setMode("word"); modeRef.current = "word";
              applyCapture(pendingSelRef.current ?? undefined);
              pendingSelRef.current = null;
            }}
          >
            ✏️ Word Only
          </TabBtn>
        </TabBar>

        {/* Word mode: selection preview */}
        {mode === "word" && (
          <Anim>
            <WordBox $ok={!!selectionRange}>
              {selectionRange ? (
                <>
                  <div style={{ marginBottom: 4 }}>
                    Selected: <WordTag>{selectionRange.text}</WordTag>
                    {occurrences > 1 && <CountPill>×{occurrences} matches</CountPill>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
                    {occurrences > 1
                      ? `All ${occurrences} occurrences will become editable. The rest stays fixed.`
                      : "Only this word will be editable. The rest stays fixed."}
                  </div>
                </>
              ) : (
                <span style={{ color: "color-mix(in srgb, var(--destructive, #dc3545) 75%, var(--foreground))" }}>
                  ⚠ No word selected — highlight a word in the canvas text, then click "Word Only" above.
                </span>
              )}
            </WordBox>
          </Anim>
        )}

        {/* Field picker (only shown when a valid link can be made) */}
        {canLink && renderFieldPicker(false)}
      </Anim>

      {renderAllFields()}
    </Root>
  );

  // ─── All fields list (shared) ─────────────────────────────────────
  function renderAllFields() {
    if (groupKeys.length === 0) return null;
    return (
      <>
        <HR />
        <StepLabel>All Smart Text Fields</StepLabel>
        {groupKeys.map((k) => (
          <FieldRow key={k}>
            {editingKey === k ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <FieldName style={{ flex: 1 }}>{textGroups[k]?.label || k}</FieldName>
                  <IconBtn onClick={saveEdit} title="Save"><FaCheck /></IconBtn>
                  <IconBtn onClick={() => { setEditingKey(null); setEditValue(""); setEditExample(""); setEditMaxChars(""); setEditError(null); }} title="Cancel">
                    <IoClose />
                  </IconBtn>
                </div>
                <InlineInput
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  placeholder="Default value shown on canvas…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") { setEditingKey(null); setEditValue(""); setEditExample(""); setEditMaxChars(""); }
                  }}
                />
                <InlineInput
                  $secondary
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  placeholder="Customer hint (placeholder text)…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") { setEditingKey(null); setEditValue(""); setEditExample(""); setEditMaxChars(""); }
                  }}
                />
                <InlineInput
                  type="number"
                  min="1"
                  $secondary
                  value={editMaxChars}
                  onChange={(e) => setEditMaxChars(e.target.value)}
                  placeholder="Max chars limit (optional)…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") { setEditingKey(null); setEditValue(""); setEditExample(""); setEditMaxChars(""); setEditError(null); }
                  }}
                />
                {editError && <div style={{ fontSize: 10.5, color: "var(--destructive, #dc3545)", marginTop: 2 }}>{editError}</div>}
              </div>
            ) : (
              <>
                <FieldName>{textGroups[k]?.label || k}</FieldName>
                <FieldVal title={textGroups[k]?.value}>
                  {textGroups[k]?.value || <em style={{ opacity: 0.5 }}>no default</em>}
                  {textGroups[k]?.maxChars ? ` (Max: ${textGroups[k].maxChars})` : ""}
                </FieldVal>
                <IconBtn onClick={() => startEdit(k)} title="Edit"><FaEdit /></IconBtn>
                <IconBtn $danger onClick={() => doDelete(k)} title="Delete"><FaTrash /></IconBtn>
              </>
            )}
          </FieldRow>
        ))}
      </>
    );
  }
}

export default TextGroupPanel;
