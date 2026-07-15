// ── Blank Theme dialog (in-editor Themes tab → first "Blank" card) ────────────
// Photobook / Layflat only. Asks for a project name, page size, page/spread
// count, and an images-per-page RANGE, then regenerates the CURRENT open design
// as a fresh blank design where every page is filled with a random layout.
// Generation core lives in `blankThemeGenerator.js` (shared with the design-
// selection "Blank" card). Blank = image boxes stay empty.

import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Form } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { ActionCreators as UndoActionCreators } from "redux-undo";
import { toast } from "react-toastify";

import {
  PrimaryButton,
  PrimaryOutlineButton,
} from "../../common-components/StyledComponents.jsx";
import {
  getCanvasSize,
  getActiveEditorType,
  getSettings,
} from "../../library/utils/helpers/index.js";
import {
  setCanvasSize,
  setPageNumber,
  setCurrentObjectProperties,
  recordThemeBaseline,
} from "../../store/slices/canvas.js";
import { setThemeName } from "../../store/slices/projectSetup.js";
import { EDITOR_TYPES } from "../../library/utils/constants/index.js";
import {
  PRINT_UNITS,
  convertToPixels,
  convertPixelsToUnit,
  getPreferredUnit,
  setPreferredUnit,
  formatInchesLabel,
  DEFAULT_DPI,
} from "../../library/utils/common-functions/unitConversion.js";
import {
  getCustomSizes,
  addCustomSize,
  initCustomSizes,
  subscribeCustomSizes,
} from "../../library/utils/helpers/customSizes.js";
import {
  generateRandomLayoutPages,
  BLANK_THEME_MAX_PAGES,
  BLANK_THEME_MIN_PAGES,
  BLANK_THEME_MAX_IMAGES,
} from "../../library/utils/helpers/blankThemeGenerator.js";
import { recommendedSizes } from "../../components/popups/SizeSettingsPopup.jsx";
import { getSizeOrientation } from "../../library/utils/helpers/orientation.js";

const BlankThemeDialog = ({ show, onHide }) => {
  const dispatch = useDispatch();
  const canvasSize = useSelector(getCanvasSize);
  const editorType = useSelector(getActiveEditorType);
  const settings = useSelector(getSettings);
  const currentPages = useSelector((state) => state.canvas.present.pages);

  const [dpiStr, setDpiStr] = useState(String(DEFAULT_DPI));
  const dpi = Math.max(1, Math.round(Number(dpiStr) || DEFAULT_DPI));
  // Photobook (and foldable) render two half-width layout sides per spread, so the
  // size the user edits is a single page (the spread is twice as wide). Layflat
  // (non-foldable) renders one full-width layout per page. Must match
  // blankThemeGenerator's split (photobook/foldable → /2).
  const usesHalfWidthLayout =
    editorType === EDITOR_TYPES.PHOTOBOOK || settings?.isFoldable === true;
  const perPagePxWidth = usesHalfWidthLayout
    ? Math.round(canvasSize.width / 2)
    : Math.round(canvasSize.width);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("px");
  const [widthStr, setWidthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [pageCount, setPageCount] = useState(4);
  const [minImages, setMinImages] = useState(1);
  const [maxImages, setMaxImages] = useState(3);
  const [recommendedKey, setRecommendedKey] = useState("");
  const [creating, setCreating] = useState(false);

  // The user's saved custom sizes (the same durable AppData store the theme-open
  // "Choose a size" modal and the New Theme dialog read), so they appear in this
  // dropdown too. width/height are stored in px with their own dpi.
  const [customSizes, setCustomSizes] = useState(() => getCustomSizes());
  useEffect(() => {
    let alive = true;
    initCustomSizes().then((list) => {
      if (alive && Array.isArray(list)) setCustomSizes(list);
    });
    const unsubscribe = subscribeCustomSizes((list) => {
      if (alive && Array.isArray(list)) setCustomSizes(list);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Fill the width/height/DPI inputs from a picked size. The stored px dimensions
  // are the full spread, so photobook/foldable (half-width layouts) take half the
  // width per page; values then show in the currently selected unit. A saved
  // custom size ("custom:<id>") carries its own DPI, so we adopt it.
  const handleRecommendedChange = (val) => {
    setRecommendedKey(val);
    if (!val) return;
    let wPx;
    let hPx;
    let sizeDpi = dpi;
    if (val.startsWith("custom:")) {
      const cs = customSizes.find((c) => String(c.id) === val.slice(7));
      if (!cs) return;
      wPx = Number(cs.width);
      hPx = Number(cs.height);
      sizeDpi = Math.max(1, Math.round(Number(cs.dpi) || DEFAULT_DPI));
      setDpiStr(String(sizeDpi));
    } else {
      [wPx, hPx] = val.split("x").map(Number);
    }
    if (!wPx || !hPx) return;
    const perPagePx = usesHalfWidthLayout ? wPx / 2 : wPx;
    setWidthStr(String(unit === "px" ? Math.round(perPagePx) : convertPixelsToUnit(perPagePx, unit, sizeDpi)));
    setHeightStr(String(unit === "px" ? Math.round(hPx) : convertPixelsToUnit(hPx, unit, sizeDpi)));
  };

  useEffect(() => {
    if (!show) return;
    const u = getPreferredUnit("in");
    const seedDpi = Math.max(1, Math.round(Number(canvasSize?.dpi) || DEFAULT_DPI));
    setDpiStr(String(seedDpi));
    setUnit(u);
    setWidthStr(String(convertPixelsToUnit(perPagePxWidth, u, seedDpi)));
    setHeightStr(String(convertPixelsToUnit(canvasSize.height, u, seedDpi)));
    setName("");
    setRecommendedKey("");
    setPageCount(
      Math.min(BLANK_THEME_MAX_PAGES, Math.max(BLANK_THEME_MIN_PAGES, currentPages?.length || 4))
    );
    setMinImages(1);
    setMaxImages(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleUnitChange = (nextUnit) => {
    const wPx = convertToPixels(widthStr, unit, dpi);
    const hPx = convertToPixels(heightStr, unit, dpi);
    setUnit(nextUnit);
    setPreferredUnit(nextUnit);
    setWidthStr(String(convertPixelsToUnit(wPx, nextUnit, dpi)));
    setHeightStr(String(convertPixelsToUnit(hPx, nextUnit, dpi)));
  };

  // Both photobook and layflat are spread-based, so always call the unit a "spread".
  const productNoun = "spread";

  const validate = (total, mn, mx, wPx, hPx) => {
    if (!wPx || !hPx || wPx < 1 || hPx < 1) return "Please enter a valid page size.";
    if (!Number.isFinite(total) || total < BLANK_THEME_MIN_PAGES) return `You need at least ${BLANK_THEME_MIN_PAGES} pages.`;
    if (total > BLANK_THEME_MAX_PAGES) return `Maximum ${BLANK_THEME_MAX_PAGES} pages.`;
    if (!Number.isFinite(mn) || !Number.isFinite(mx) || mn < 1 || mx < 1) return "Image counts must be at least 1.";
    if (mn > mx) return "Minimum images can't exceed the maximum.";
    if (mx > BLANK_THEME_MAX_IMAGES) return `Maximum ${BLANK_THEME_MAX_IMAGES} images per ${productNoun}.`;
    return null;
  };

  const handleCreate = async () => {
    const total = Math.round(Number(pageCount));
    const mn = Math.round(Number(minImages));
    const mx = Math.round(Number(maxImages));
    const perPageWPx = convertToPixels(widthStr, unit, dpi);
    const perPageHPx = convertToPixels(heightStr, unit, dpi);

    const err = validate(total, mn, mx, perPageWPx, perPageHPx);
    if (err) {
      toast.warning(err);
      return;
    }

    setCreating(true);
    const fullWidth = usesHalfWidthLayout ? perPageWPx * 2 : perPageWPx;
    const height = perPageHPx;

    // Remember this size in the durable custom-size store (so it appears under
    // "Your saved sizes" next time) — unless it matches a standard size or one
    // already saved. Dedup by PIXEL dimensions only (NOT DPI): the same 5000×2500
    // must never appear twice just because the DPI differs. Stored as the FULL
    // spread width to match the other dialogs. Await the store first so the dedup
    // reads the real list and the write applies synchronously (not deferred).
    await initCustomSizes();
    const roundW = Math.round(fullWidth);
    const roundH = Math.round(height);
    const matchesStandard = recommendedSizes.some(
      (s) => Math.round(s.width) === roundW && Math.round(s.height) === roundH
    );
    const matchesSaved = getCustomSizes().some(
      (c) => Math.round(c.width) === roundW && Math.round(c.height) === roundH
    );
    if (!matchesStandard && !matchesSaved) {
      addCustomSize({
        width: fullWidth,
        height,
        dpi,
        unit,
        label: formatInchesLabel(fullWidth, height, dpi),
      });
    }

    // Commit the new size first, then defer generation 600ms — the same
    // sequencing setupTheme uses: Canvas.jsx's 500ms canvasSize effect recomputes
    // zoom for the new size before the pages land, so they render at the right fit.
    dispatch(setCurrentObjectProperties(null));
    dispatch(setCanvasSize({ ...canvasSize, width: fullWidth, height, dpi }));

    setTimeout(async () => {
      try {
        const pages = await generateRandomLayoutPages(dispatch, {
          pageCount: total,
          minImages: mn,
          maxImages: mx,
        });
        if (!pages) {
          toast.error("No layouts are available for this product. Please try again.");
          setCreating(false);
          return;
        }

        const finalName = (name || "").trim() || "Untitled design";
        dispatch(setThemeName(finalName));
        dispatch(setPageNumber(0));
        dispatch(setCurrentObjectProperties(null));
        dispatch(UndoActionCreators.clearHistory());
        dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));

        toast.success(`Created "${finalName}".`);
        onHide();
      } catch (e) {
        toast.error(
          e?.message
            ? `Could not create the design: ${e.message}`
            : "Could not create the design."
        );
      } finally {
        setCreating(false);
      }
    }, 600);
  };

  const labelStyle = { fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "#374151" };
  const inputStyle = { fontSize: "13px", height: "36px" };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Modal.Header closeButton className="border-0 pb-1">
        <Modal.Title style={{ fontSize: "18px", fontWeight: 700 }}>
          Create a blank {editorType === EDITOR_TYPES.PHOTOBOOK ? "photobook" : "album"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-1">
        <p className="text-muted mb-3" style={{ fontSize: "12.5px" }}>
          We'll build a fresh design and fill every {productNoun} with a random layout.
          Image boxes stay empty so you can drop in your own photos.
        </p>

        <div className="mb-3">
          <div style={labelStyle}>Project name</div>
          <Form.Control
            type="text"
            placeholder="Untitled design"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div className="mb-3">
          <div style={labelStyle}>Predefined sizes</div>
          <Form.Select
            value={recommendedKey}
            onChange={(e) => handleRecommendedChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">Custom size…</option>
            {customSizes.length > 0 && (
              <optgroup label="Your saved sizes">
                {customSizes.map((cs) => (
                  <option key={`custom:${cs.id}`} value={`custom:${cs.id}`}>
                    ● {formatInchesLabel(cs.width, cs.height, cs.dpi || DEFAULT_DPI)} · {getSizeOrientation(cs.width, cs.height, editorType, settings)} ({Math.round(cs.width)}×{Math.round(cs.height)} px · {cs.dpi || DEFAULT_DPI} DPI) · Custom
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Standard sizes">
              {recommendedSizes.map((s) => (
                <option key={`${s.width}x${s.height}`} value={`${s.width}x${s.height}`}>
                  {s.label.trim()} · {getSizeOrientation(s.width, s.height, editorType, settings)} ({s.width}×{s.height} px)
                </option>
              ))}
            </optgroup>
          </Form.Select>
        </div>

        <div className="row g-3 mb-1">
          <div className="col-3">
            <div style={labelStyle}>Page width</div>
            <Form.Control
              type="number"
              min="0"
              value={widthStr}
              onChange={(e) => { setWidthStr(e.target.value); setRecommendedKey(""); }}
              style={inputStyle}
            />
          </div>
          <div className="col-3">
            <div style={labelStyle}>Page height</div>
            <Form.Control
              type="number"
              min="0"
              value={heightStr}
              onChange={(e) => { setHeightStr(e.target.value); setRecommendedKey(""); }}
              style={inputStyle}
            />
          </div>
          <div className="col-3">
            <div style={labelStyle}>Unit</div>
            <Form.Select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value)}
              style={inputStyle}
            >
              {PRINT_UNITS.map((pu) => (
                <option key={pu.value} value={pu.value}>
                  {pu.short}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-3">
            <div style={labelStyle}>DPI</div>
            <Form.Control
              type="number"
              min="1"
              value={dpiStr}
              onChange={(e) => setDpiStr(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-muted mb-3" style={{ fontSize: "11px" }}>
          {usesHalfWidthLayout
            ? "Size is per single page (the spread is twice as wide)."
            : "Size is the full page width."}
        </p>

        <div className="row g-3">
          <div className="col-12 col-sm-4">
            <div style={labelStyle}>Number of spreads</div>
            <Form.Control
              type="number"
              min={BLANK_THEME_MIN_PAGES}
              max={BLANK_THEME_MAX_PAGES}
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="col-6 col-sm-4">
            <div style={labelStyle}>Min images / {productNoun}</div>
            <Form.Control
              type="number"
              min="1"
              max={BLANK_THEME_MAX_IMAGES}
              value={minImages}
              onChange={(e) => setMinImages(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="col-6 col-sm-4">
            <div style={labelStyle}>Max images / {productNoun}</div>
            <Form.Control
              type="number"
              min="1"
              max={BLANK_THEME_MAX_IMAGES}
              value={maxImages}
              onChange={(e) => setMaxImages(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-1">
        <PrimaryOutlineButton onClick={onHide} disabled={creating}>
          Cancel
        </PrimaryOutlineButton>
        <PrimaryButton onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "Create"}
        </PrimaryButton>
      </Modal.Footer>
    </Modal>
  );
};

export default BlankThemeDialog;
