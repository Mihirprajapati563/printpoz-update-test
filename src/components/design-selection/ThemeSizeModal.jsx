/**
 * ThemeSizeModal — modern "choose a size" modal shown before a theme opens in the
 * editor. Lists the theme's predefined sizes plus the user's saved custom sizes,
 * lets the user create a new custom size (Width / Height / DPI / Unit / Trim /
 * Bleed → OK, persisted to localStorage), and returns the chosen size via
 * `onContinue`. The editor then resizes the theme to that size on load.
 *
 * Reusable: give it `variants` (raw theme variants) + callbacks.
 */
import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { FaTimes, FaPlus, FaTrashAlt, FaCheck, FaArrowRight, FaRedo } from "react-icons/fa";
import {
  PRINT_UNITS,
  DEFAULT_DPI,
  convertToPixels,
  formatInchesLabel,
  getPreferredUnit,
  setPreferredUnit,
} from "../../library/utils/common-functions/unitConversion";
import {
  getCustomSizes,
  addCustomSize,
  removeCustomSize,
  initCustomSizes,
  subscribeCustomSizes,
} from "../../library/utils/helpers/customSizes";
import { LoadingState, ErrorState } from "../../common-components/StateViews";
import { getSizeOrientation, perPageWidth } from "../../library/utils/helpers/orientation.js";
import { tokens, PrimaryButton, GhostButton } from "./styles";

const round = (n) => Math.round(Number(n) || 0);

// Normalise a raw theme variant → selectable size (px-based).
const variantToSize = (v, i) => {
  const width = parseFloat(v.width);
  const height = parseFloat(v.height);
  const dpi = parseInt(v.dpi, 10) || DEFAULT_DPI;
  return {
    key: `pre_${i}_${v.size || `${width}x${height}`}`,
    kind: "predefined",
    width,
    height,
    dpi,
    depth: parseFloat(v.depth) || 0,
    safeMargin: parseFloat(v.safe_margin) || 0,
    bleedMargin: parseFloat(v.bleed_margin) || 0,
    label: formatInchesLabel(width, height, dpi),
  };
};

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
  max-width: 640px;
  max-height: min(88vh, 760px);
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
`;

const SectionLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${tokens.faint};
  margin: 4px 0 12px;
`;

const NameInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid ${tokens.line};
  border-radius: 10px;
  font-size: 14px;
  color: ${tokens.ink};
  outline: none;
  background: #fff;
  &::placeholder {
    color: ${tokens.faint};
  }
  &:focus {
    border-color: ${tokens.primary};
  }
`;

const SizeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const SizeTile = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 13px;
  text-align: left;
  background: ${(p) => (p.$selected ? tokens.primarySoft : "#fff")};
  border: 1.5px solid ${(p) => (p.$selected ? tokens.primary : tokens.line)};
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  &:hover {
    border-color: ${(p) => (p.$selected ? tokens.primary : "#c4c4c4")};
    background: ${(p) => (p.$selected ? tokens.primarySoft : tokens.hover)};
  }
`;

const Proxy = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  &::after {
    content: "";
    width: ${(p) => p.$w}px;
    height: ${(p) => p.$h}px;
    background: ${tokens.primary};
    border-radius: 3px;
  }
`;

const SizeMeta = styled.span`
  min-width: 0;
  .dim {
    display: block;
    font-size: 13.5px;
    font-weight: 700;
    color: ${tokens.ink};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 11.5px;
    color: ${tokens.muted};
  }
`;

const Tick = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${tokens.primary};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const DelBtn = styled.span`
  position: absolute;
  top: 7px;
  right: 7px;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: ${tokens.hover};
  color: ${tokens.ink2};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  ${SizeTile}:hover & { opacity: 1; }
  &:hover { background: ${tokens.ink}; color: #fff; }
`;

const AddRow = styled.div`
  margin-top: 18px;
`;

const AddToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1.5px dashed ${tokens.line};
  border-radius: 10px;
  background: #fff;
  color: ${tokens.primary};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  &:hover { border-color: ${tokens.primary}; background: ${tokens.hover}; }
`;

const Form = styled.div`
  margin-top: 14px;
  padding: 16px;
  border: 1.5px solid ${tokens.line};
  border-radius: 12px;
  background: ${tokens.surfaceAlt};
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.ink2};
  input,
  select {
    padding: 8px 10px;
    border: 1.5px solid ${tokens.line};
    border-radius: 8px;
    font-size: 13.5px;
    color: ${tokens.ink};
    outline: none;
    background: #fff;
    &:focus {
      border-color: ${tokens.primary};
    }
  }
`;

const FormActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
`;

const FormError = styled.div`
  color: ${tokens.ink};
  font-size: 12.5px;
  margin-right: auto;
  align-self: center;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  border-top: 1px solid ${tokens.line};
`;

const FootHint = styled.div`
  font-size: 12.5px;
  color: ${tokens.muted};
`;

// scale a size to a tiny proxy rect (≤ 30px) for the tile
const proxyDims = (w, h) => {
  const max = 30;
  const r = Math.min(max / w, max / h, 1);
  return { w: Math.max(8, Math.round(w * r)), h: Math.max(8, Math.round(h * r)) };
};

const ThemeSizeModal = ({
  open,
  themeName,
  variants,
  loading,
  error,
  onRetry,
  onContinue,
  onClose,
  editorType,
}) => {
  // Spread products (photobook/layflat/foldable) store the full spread width, so
  // orientation is judged per single page (width / 2) — see helpers/orientation.
  const orientationOf = (w, h) => getSizeOrientation(w, h, editorType);
  const [customSizes, setCustomSizes] = useState(() => getCustomSizes());
  const [selectedKey, setSelectedKey] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState("");

  // Default the custom-size unit to the user's saved preference, falling back to
  // inches (NOT px) so sizes read in real-world units by default.
  const [unit, setUnit] = useState(() => getPreferredUnit("in"));
  const [form, setForm] = useState({ width: "", height: "", dpi: String(DEFAULT_DPI), trim: "", bleed: "" });
  const [formError, setFormError] = useState("");

  const predefined = useMemo(
    () => (Array.isArray(variants) ? variants.map(variantToSize) : []),
    [variants],
  );
  const customs = useMemo(() => customSizes.map(customToSize), [customSizes]);

  const allByKey = useMemo(() => {
    const m = {};
    [...predefined, ...customs].forEach((s) => (m[s.key] = s));
    return m;
  }, [predefined, customs]);

  // Default-select the first predefined size whenever the theme's variants change
  // (so reopening for a different theme doesn't keep a stale selection).
  useEffect(() => {
    setSelectedKey(predefined.length > 0 ? predefined[0].key : null);
  }, [predefined]);

  // Keep the custom-size list in sync with the persistent store. On desktop the
  // list lives in AppData and loads ASYNCHRONOUSLY — the `useState` initialiser
  // above runs before that read resolves, so without this it would show an empty
  // list (the "custom sizes vanish on reload / when opening a theme" bug). We
  // await initCustomSizes() to pick up the loaded list and subscribe so a late
  // read (or an add/remove elsewhere) refreshes an already-mounted modal.
  useEffect(() => {
    let alive = true;
    initCustomSizes().then((list) => {
      if (alive && Array.isArray(list)) setCustomSizes(list);
    });
    const unsubscribe = subscribeCustomSizes((list) => {
      if (alive) setCustomSizes(list);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Re-read from the now-loaded store each time the modal opens.
  useEffect(() => {
    if (open) setCustomSizes(getCustomSizes());
  }, [open]);

  // Start each open (and each theme) with an empty Project name field so a name
  // typed for one theme doesn't linger when the modal is reopened for another.
  useEffect(() => {
    setProjectName("");
  }, [open, themeName]);

  if (!open) return null;

  const handleAddCustom = () => {
    const dpiNum = parseInt(form.dpi, 10) || DEFAULT_DPI;
    const toPx = (raw) => {
      const n = parseFloat(raw);
      if (Number.isNaN(n)) return NaN;
      return unit === "px" ? n : convertToPixels(n, unit, dpiNum);
    };
    const wPx = toPx(form.width);
    const hPx = toPx(form.height);
    if (!(wPx > 0) || !(hPx > 0)) {
      setFormError("Enter a valid width and height.");
      return;
    }
    const smPx = form.trim === "" ? 0 : Math.max(0, toPx(form.trim) || 0);
    const bmPx = form.bleed === "" ? 0 : Math.max(0, toPx(form.bleed) || 0);
    const label =
      unit === "px"
        ? `${round(wPx)} × ${round(hPx)} px`
        : `${form.width} × ${form.height} ${unit}`;
    const updated = addCustomSize({
      width: round(wPx),
      height: round(hPx),
      dpi: dpiNum,
      unit,
      safeMargin: round(smPx),
      bleedMargin: round(bmPx),
      label,
    });
    setCustomSizes(updated);
    setSelectedKey(updated[0]?.id || null);
    setShowForm(false);
    setForm({ width: "", height: "", dpi: String(DEFAULT_DPI), trim: "", bleed: "" });
    setFormError("");
  };

  const handleRemoveCustom = (e, id) => {
    e.stopPropagation();
    const updated = removeCustomSize(id);
    setCustomSizes(updated);
    if (selectedKey === id) setSelectedKey(predefined[0]?.key || null);
  };

  const renderTile = (s) => {
    // Draw the thumbnail as a SINGLE page (half-width for spread products) so its
    // shape matches the orientation label — a 16.67×8.33 spread is a Square page.
    const p = proxyDims(perPageWidth(s.width, editorType), s.height);
    const selected = selectedKey === s.key;
    return (
      <SizeTile key={s.key} $selected={selected} onClick={() => setSelectedKey(s.key)}>
        <Proxy $w={p.w} $h={p.h} />
        <SizeMeta>
          <span className="dim">{s.label}</span>
          <span className="sub">
            {orientationOf(s.width, s.height)} · {s.dpi} DPI
          </span>
        </SizeMeta>
        {s.kind === "custom" && !selected && (
          <DelBtn title="Remove" onClick={(e) => handleRemoveCustom(e, s.id)}>
            <FaTrashAlt size={11} />
          </DelBtn>
        )}
        {selected && (
          <Tick>
            <FaCheck size={10} />
          </Tick>
        )}
      </SizeTile>
    );
  };

  const selected = selectedKey ? allByKey[selectedKey] : null;

  return (
    <Overlay onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <Card>
        <Head>
          <HeadTitle>
            <h3>Choose a size</h3>
            <p>{themeName ? `for "${themeName}"` : "Select a size to start designing"}</p>
          </HeadTitle>
          <IconBtn onClick={onClose} aria-label="Close">
            <FaTimes size={15} />
          </IconBtn>
        </Head>

        <Body>
          {loading ? (
            <LoadingState label="Loading available sizes…" padding="48px 20px" />
          ) : error ? (
            <ErrorState
              title="Couldn't load sizes"
              text={error}
              padding="40px 20px"
              action={
                onRetry && (
                  <PrimaryButton onClick={onRetry}>
                    <FaRedo size={12} /> Retry
                  </PrimaryButton>
                )
              }
            />
          ) : (
            <>
              <SectionLabel>Project name</SectionLabel>
              <NameInput
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={themeName ? `e.g. ${themeName}` : "Name your project"}
                maxLength={80}
              />
              <div style={{ height: 18 }} />

              {predefined.length > 0 && (
                <>
                  <SectionLabel>Theme sizes</SectionLabel>
                  <SizeGrid>{predefined.map(renderTile)}</SizeGrid>
                </>
              )}

              {customs.length > 0 && (
                <>
                  <SectionLabel style={{ marginTop: predefined.length ? 20 : 4 }}>
                    Your custom sizes
                  </SectionLabel>
                  <SizeGrid>{customs.map(renderTile)}</SizeGrid>
                </>
              )}

              <AddRow>
                {!showForm ? (
                  <AddToggle onClick={() => setShowForm(true)}>
                    <FaPlus size={11} /> Create custom size
                  </AddToggle>
                ) : (
                  <Form>
                    <FieldGrid>
                      <Field>
                        Width
                        <input
                          type="number"
                          min="0"
                          value={form.width}
                          onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))}
                          autoFocus
                        />
                      </Field>
                      <Field>
                        Height
                        <input
                          type="number"
                          min="0"
                          value={form.height}
                          onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                        />
                      </Field>
                      <Field>
                        Unit
                        <select value={unit} onChange={(e) => { setUnit(e.target.value); setPreferredUnit(e.target.value); }}>
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
                          value={form.dpi}
                          onChange={(e) => setForm((f) => ({ ...f, dpi: e.target.value }))}
                        />
                      </Field>
                      <Field>
                        Trim Margin
                        <input
                          type="number"
                          min="0"
                          value={form.trim}
                          onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                          placeholder="0"
                        />
                      </Field>
                      <Field>
                        Bleed Margin
                        <input
                          type="number"
                          min="0"
                          value={form.bleed}
                          onChange={(e) => setForm((f) => ({ ...f, bleed: e.target.value }))}
                          placeholder="0"
                        />
                      </Field>
                    </FieldGrid>
                    <FormActions>
                      {formError && <FormError>{formError}</FormError>}
                      <GhostButton
                        onClick={() => {
                          setShowForm(false);
                          setFormError("");
                        }}
                        style={{ marginLeft: formError ? 0 : "auto" }}
                      >
                        Cancel
                      </GhostButton>
                      <PrimaryButton onClick={handleAddCustom}>OK</PrimaryButton>
                    </FormActions>
                  </Form>
                )}
              </AddRow>
            </>
          )}
        </Body>

        <Foot>
          <FootHint>
            {selected
              ? `${selected.label} · ${orientationOf(selected.width, selected.height)}`
              : "Select a size to continue"}
          </FootHint>
          <PrimaryButton onClick={() => selected && onContinue?.(selected, projectName.trim())} disabled={!selected}>
            Continue <FaArrowRight size={12} />
          </PrimaryButton>
        </Foot>
      </Card>
    </Overlay>
  );
};

export default ThemeSizeModal;
