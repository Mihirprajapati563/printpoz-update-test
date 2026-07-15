import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MdMenuBook } from "react-icons/md";
import { IconButton } from "../common-components/StyledComponents";
import { setSettings } from "../store/slices/canvas";
import {
  getSettings,
  getActiveEditorType,
  getCanvasSize,
} from "../library/utils/helpers";
import {
  COVER_TOGGLES,
  supportsCoverSettings,
  isCoverToggleVisible,
  readCoverSettings,
} from "../library/utils/jsons/coverSettingsConfig";
import {
  convertToPixels,
  convertPixelsToUnit,
} from "../library/utils/common-functions/unitConversion";

/**
 * CoverSpineControl — a focused, customer-facing Cover & Spine control in the
 * TopActions toolbar (photobook / layflat only). Customers can NOT open the admin
 * Setting tab (Sidebar.jsx always hides it), so this is the ONLY in-editor place a
 * customer can turn on the full-cover spread + set the paper thickness that drives
 * the spine width.
 *
 * It reuses the SAME config + reducer as the admin path: each change dispatches
 * `setSettings({ ...settings, [key]: value })` exactly like SettingAction, so the
 * canvas.js reducer reconciles the cover/page structure identically (full cover ⟹
 * hide back cover, spine width auto-computed from paperThickness × billable pages).
 *
 * Paper thickness is stored in PIXELS (same as the create dialog), edited here in
 * millimetres and converted at the design DPI — a spine is a physical measurement.
 */
export default function CoverSpineControl() {
  const dispatch = useDispatch();
  const settings = useSelector(getSettings);
  const editorType = useSelector(getActiveEditorType);
  const canvasSize = useSelector(getCanvasSize);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const dpi = Math.max(1, Math.round(Number(canvasSize?.dpi) || 200));
  const thicknessPx = Number(settings?.paperThickness) || 0;

  // Local input string (mm) so typing decimals like "0.2" doesn't get mangled by
  // an immediate px round-trip. Re-seeded whenever the stored px value changes.
  const [thicknessStr, setThicknessStr] = useState("");
  useEffect(() => {
    setThicknessStr(
      thicknessPx > 0 ? String(convertPixelsToUnit(thicknessPx, "mm", dpi) || "") : ""
    );
  }, [thicknessPx, dpi]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!supportsCoverSettings(editorType)) return null;

  const coverState = readCoverSettings(settings);
  const toggles = (COVER_TOGGLES[editorType] || []).filter((t) =>
    isCoverToggleVisible(t, coverState)
  );

  // Mirror SettingAction.handleCheckboxChange — spread the full settings and let
  // the reducer reconcile the dependent cover flags + page structure.
  const applyChange = (key, value) =>
    dispatch(setSettings({ ...settings, [key]: value }));

  const onThicknessChange = (raw) => {
    setThicknessStr(raw);
    if (raw === "") {
      applyChange("paperThickness", 0);
      return;
    }
    const px = convertToPixels(raw, "mm", dpi);
    if (!isNaN(px)) applyChange("paperThickness", px);
  };

  const showThickness = coverState.showFullCoverSheet;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center", alignSelf: "stretch" }}>
      <IconButton
        className={coverState.showFullCoverSheet ? "active" : ""}
        onClick={() => setOpen((o) => !o)}
        title="Cover & spine"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Cover and spine settings"
        style={{ gap: 6, color: coverState.showFullCoverSheet ? "var(--primary)" : "inherit" }}
      >
        <MdMenuBook size={18} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Cover / Spine</span>
      </IconButton>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            minWidth: 230,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#374151" }}>
            Cover &amp; Spine
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {toggles.map((toggle) => (
              <label
                key={toggle.key}
                title={toggle.instruction}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={coverState[toggle.key] === true}
                  onChange={(e) => applyChange(toggle.key, e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "var(--primary)" }}
                />
                {toggle.title}
              </label>
            ))}
          </div>

          {showThickness && (
            <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Paper thickness (mm/sheet)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={thicknessStr}
                onChange={(e) => onThicknessChange(e.target.value)}
                placeholder="e.g. 0.2"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Spine width follows the number of pages × thickness.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
