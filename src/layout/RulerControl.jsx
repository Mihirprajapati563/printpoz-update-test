import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { MdStraighten } from "react-icons/md";
import { IconButton } from "../common-components/StyledComponents";
import { setShowRuler } from "../store/slices/appAlice";

/**
 * RulerControl — on/off toggle for the canvas rulers, rendered inside an
 * ActionWrapperBox in the TopActions toolbar (uses the toolbar's IconButton
 * `.active` convention so it matches the other buttons). The ruler's UNIT and
 * "start from" options live in the ruler's own corner dialog (CanvasRulers).
 * Drives `appSlice.showRuler` (persisted to localStorage → carries across
 * projects).
 */
export default function RulerControl() {
  const dispatch = useDispatch();
  const showRuler = useSelector((s) => s.appSlice.showRuler);

  return (
    <IconButton
      className={showRuler ? "active" : ""}
      onClick={() => dispatch(setShowRuler(!showRuler))}
      title={showRuler ? "Hide ruler" : "Show ruler"}
      role="switch"
      aria-checked={showRuler}
      aria-label="Toggle ruler"
      style={{ gap: 6, color: showRuler ? "var(--primary)" : "inherit" }}
    >
      <MdStraighten size={18} />
      <span className="ruler-control__label" style={{ fontSize: 14, fontWeight: 500 }}>
        Ruler
      </span>
    </IconButton>
  );
}
