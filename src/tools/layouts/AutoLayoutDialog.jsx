// ── Auto Layout dialog (Layout tab → "Generate Layout") ──────────────────────
// Re-rolls the layouts of the CURRENTLY OPEN photobook/layflat design. Two modes:
//   • Keep my photos — re-arrange existing photos into new random layouts (each
//     page keeps its photo count; nothing is dropped). Covers untouched.
//   • Empty boxes    — clear every interior page to fresh empty photo boxes with a
//     random layout sized to a photos-per-page range. Covers untouched.
// The engine lives in blankThemeGenerator.js (`regenerateOpenDesignLayouts`); this
// is only the options UI + a destructive confirm for the photo-clearing case.

import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Form } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";

import {
  PrimaryButton,
  PrimaryOutlineButton,
} from "../../common-components/StyledComponents.jsx";
import {
  regenerateOpenDesignLayoutsAsSingleUndo,
  getOpenDesignInteriorInfo,
  BLANK_THEME_MAX_IMAGES,
} from "../../library/utils/helpers/blankThemeGenerator.js";

const AutoLayoutDialog = ({ show, onClose, onGenerated }) => {
  const dispatch = useDispatch();

  const [mode, setMode] = useState("keep"); // "keep" | "empty"
  const [minImages, setMinImages] = useState(1);
  const [maxImages, setMaxImages] = useState(4);
  const [creating, setCreating] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [info, setInfo] = useState({ total: 0, interior: 0, withPhotos: 0 });

  // Re-read the open design each time the dialog opens (page count / photo counts
  // can change between opens).
  useEffect(() => {
    if (!show) return;
    setMode("keep");
    setMinImages(1);
    setMaxImages(4);
    setConfirmDestructive(false);
    setCreating(false);
    try {
      setInfo(getOpenDesignInteriorInfo());
    } catch (_) {
      setInfo({ total: 0, interior: 0, withPhotos: 0 });
    }
  }, [show]);

  const nothingToGenerate = info.interior === 0;
  // Clearing photos is destructive — gate it behind an in-modal confirm step.
  const isDestructive = mode === "empty" && info.withPhotos > 0;

  const clampCounts = () => {
    let mn = Math.max(1, Math.min(BLANK_THEME_MAX_IMAGES, Math.round(Number(minImages) || 1)));
    let mx = Math.max(mn, Math.min(BLANK_THEME_MAX_IMAGES, Math.round(Number(maxImages) || mn)));
    setMinImages(mn);
    setMaxImages(mx);
    return { mn, mx };
  };

  const runGeneration = async () => {
    const { mn, mx } = clampCounts();
    setCreating(true);
    try {
      // Single-undo wrapper: the whole generation reverts with one Ctrl+Z / undo
      // click (prior history preserved) instead of clearing the undo stack.
      const pages = await regenerateOpenDesignLayoutsAsSingleUndo(dispatch, {
        mode,
        minImages: mn,
        maxImages: mx,
        // Keep mode preserves each page's photo count 1:1 (no photo is ever
        // dropped); empty mode uses the min/max range.
        preserveImageCount: mode === "keep",
      });
      if (!pages) {
        toast.error("No layouts are available to generate this design.");
        setCreating(false);
        return;
      }
      toast.success(
        mode === "keep"
          ? "Layouts shuffled across your pages! Press Ctrl+Z to undo."
          : "New empty layouts generated! Press Ctrl+Z to undo."
      );
      onGenerated?.({ mode, minImages: mn, maxImages: mx });
      onClose();
    } catch (e) {
      toast.error(
        e?.message ? `Could not generate layouts: ${e.message}` : "Could not generate layouts."
      );
    } finally {
      setCreating(false);
    }
  };

  const handlePrimary = () => {
    if (nothingToGenerate) return;
    if (isDestructive && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }
    runGeneration();
  };

  const handleSecondary = () => {
    // In the destructive-confirm step, "Back" returns to the form (does not close).
    if (isDestructive && confirmDestructive) {
      setConfirmDestructive(false);
      return;
    }
    onClose();
  };

  const labelStyle = { fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "#374151" };
  const inputStyle = { fontSize: "13px", height: "36px" };

  const ModeCard = ({ value, title, desc }) => {
    const active = mode === value;
    return (
      <div
        role="radio"
        aria-checked={active}
        tabIndex={0}
        onClick={() => setMode(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMode(value);
          }
        }}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: "10px",
          border: "2px solid",
          borderColor: active ? "var(--primary, #4084b5)" : "#e5e7eb",
          background: active ? "rgba(64,132,181,0.06)" : "#fff",
          cursor: "pointer",
          transition: "border-color .15s, background .15s",
        }}
      >
        <div style={{ fontSize: "13.5px", fontWeight: 700, color: active ? "var(--primary, #4084b5)" : "#1f2937" }}>
          {title}
        </div>
        <div style={{ fontSize: "11.5px", color: "#6b7280", marginTop: "3px", lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>
    );
  };

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton className="border-0 pb-1">
        <Modal.Title style={{ fontSize: "18px", fontWeight: 700 }}>Generate Layout</Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-1">
        {nothingToGenerate ? (
          <p className="text-muted mb-2" style={{ fontSize: "13px" }}>
            There are no interior pages to generate layouts for yet. Add some pages first.
          </p>
        ) : confirmDestructive ? (
          <p className="mb-2" style={{ fontSize: "13.5px", color: "#b91c1c", fontWeight: 600 }}>
            This will remove the photos from {info.withPhotos} page
            {info.withPhotos === 1 ? "" : "s"} and replace them with empty boxes. Cover pages
            stay untouched. This can't be undone.
          </p>
        ) : (
          <>
            <p className="text-muted mb-3" style={{ fontSize: "12.5px" }}>
              Re-roll the layout of every interior page. Cover pages are never changed, and
              your undo history is reset.
            </p>

            <div style={labelStyle}>What to do with your photos</div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }} role="radiogroup">
              <ModeCard
                value="keep"
                title="Keep my photos"
                desc="Re-arrange existing photos into new layouts. Each page keeps its photo count."
              />
              <ModeCard
                value="empty"
                title="Empty boxes"
                desc="Clear photos and fill with fresh, empty photo boxes to fill yourself."
              />
            </div>

            {mode === "empty" && (
              <div className="row g-3 mb-1">
                <div className="col-6">
                  <div style={labelStyle}>Min photos / page</div>
                  <Form.Control
                    type="number"
                    min="1"
                    max={BLANK_THEME_MAX_IMAGES}
                    value={minImages}
                    onChange={(e) => setMinImages(e.target.value)}
                    onBlur={clampCounts}
                    style={inputStyle}
                  />
                </div>
                <div className="col-6">
                  <div style={labelStyle}>Max photos / page</div>
                  <Form.Control
                    type="number"
                    min="1"
                    max={BLANK_THEME_MAX_IMAGES}
                    value={maxImages}
                    onChange={(e) => setMaxImages(e.target.value)}
                    onBlur={clampCounts}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            <p className="text-muted mb-0 mt-2" style={{ fontSize: "11.5px" }}>
              {mode === "keep"
                ? `Re-arranges photos on ${info.withPhotos} of ${info.interior} interior page${
                    info.interior === 1 ? "" : "s"
                  } into new layouts.`
                : `Fills ${info.interior} interior page${
                    info.interior === 1 ? "" : "s"
                  } with ${minImages}–${maxImages} empty boxes each.`}
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="border-0 pt-1">
        <PrimaryOutlineButton onClick={handleSecondary} disabled={creating}>
          {isDestructive && confirmDestructive ? "Back" : "Cancel"}
        </PrimaryOutlineButton>
        <PrimaryButton
          onClick={handlePrimary}
          disabled={creating || nothingToGenerate}
          style={
            isDestructive && confirmDestructive
              ? { background: "#dc2626", borderColor: "#dc2626" }
              : undefined
          }
        >
          {creating
            ? "Generating…"
            : isDestructive && confirmDestructive
            ? "Replace & Generate"
            : "Generate"}
        </PrimaryButton>
      </Modal.Footer>
    </Modal>
  );
};

export default AutoLayoutDialog;
