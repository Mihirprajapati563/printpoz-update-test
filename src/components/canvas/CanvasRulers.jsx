import React, { useRef, useState, useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  getZoom,
  getCanvasScale,
  getCanvasSize,
  getCurrentPageIndex,
} from "../../library/utils/helpers";
import { convertUnitToPx, formatDecimal } from "../../library/utils/common-functions/unitConversion";
import { setRulerUnit, setRulerOrigin, setShowRuler } from "../../store/slices/appAlice";

/**
 * CanvasRulers — measurement rulers PINNED to the top and left edges of the
 * canvas viewport (the `.CanvasWrapper` work area), Figma/Photoshop style.
 *
 * The bands are FIXED at the viewport edges and span its full width/height, so
 * they are ALWAYS fully visible — regardless of canvas size (a 9600×4800 album
 * that overflows at 100%) or screen size (small screens). Only the tick numbers
 * slide, because positions are computed from the canvas's live on-screen rect
 * (`getBoundingClientRect` on `#canvasWrapper` + its `viewBox` for canvas-units).
 *
 * The top-left corner box opens an OPTIONS DIALOG (unit + where 0 starts + hide).
 *
 * Cost is paid ONLY while the ruler is on: when off it renders null and wires up
 * no observers. Measurement is rAF-throttled; tick geometry is memoized.
 */

const THICK = 20;          // band thickness (px)
const GAP = 1;             // gap between band and canvas edge (px)
const FONT = 9;            // label font (px)
const MIN_MAJOR = 56;      // min px between labelled ticks
const MIN_MINOR = 6;       // hide minors below this spacing

// Clamp a band's thickness-axis position so the THICK-wide band stays fully
// inside [0, max] (the viewport). Keeps the ruler glued to the canvas edge
// normally, but "sticks" it at the viewport edge instead of letting it scroll
// off-screen when the canvas is bigger than the viewport.
const clampPos = (v, max) => Math.max(0, Math.min(Math.max(0, max), v));

const PX_LADDER = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 25000];
const UNIT_LADDER = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 250, 500];

const RULE_BG = "#eef1f5";
const RULE_EDGE = "#b6bdc8";
const TICK_MAJOR = "#69727e";
const TICK_MID = "#97a0ad";
const TICK_MINOR = "#bcc2cd";
const LABEL_COLOR = "#69727e";

const UNITS = ["px", "in", "cm", "mm"];
const ORIGINS = [
  { value: "center", label: "Center" },
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
];

function pickStep(unit, pxPerUnit, screenPerCanvasPx) {
  if (unit === "px") {
    for (const s of PX_LADDER) {
      if (s * screenPerCanvasPx >= MIN_MAJOR) return { step: s, screenPerStep: s * screenPerCanvasPx };
    }
    const s = PX_LADDER[PX_LADDER.length - 1];
    return { step: s, screenPerStep: s * screenPerCanvasPx };
  }
  const screenPerUnit = screenPerCanvasPx * pxPerUnit;
  for (const u of UNIT_LADDER) {
    if (u * screenPerUnit >= MIN_MAJOR) return { step: u, screenPerStep: u * screenPerUnit };
  }
  const u = UNIT_LADDER[UNIT_LADDER.length - 1];
  return { step: u, screenPerStep: u * screenPerUnit };
}

function fmtLabel(value, unit) {
  return unit === "px" ? String(Math.round(value)) : String(formatDecimal(value, 2));
}

/**
 * Build ticks for one axis across [0, bandLen], measuring outward from `originPos`
 * (the canvas's 0 position on screen, relative to the band — may be off-band).
 */
function buildAxis(originPos, bandLen, step, screenPerStep, unit) {
  const ticks = [];
  if (!(screenPerStep > 0) || !(bandLen > 0)) return ticks;

  let minorDiv = 0;
  for (const d of [10, 5, 4, 2]) {
    if (screenPerStep / d >= MIN_MINOR) { minorDiv = d; break; }
  }

  // k range needed to cover the whole band from this (possibly off-band) origin.
  const kStart = Math.floor((0 - originPos) / screenPerStep) - 1;
  const kEnd = Math.ceil((bandLen - originPos) / screenPerStep) + 1;
  const cap = 6000;
  let count = 0;
  for (let k = kStart; k <= kEnd; k++) {
    const pos = originPos + k * screenPerStep;
    if (count++ > cap) break;
    if (pos >= -1 && pos <= bandLen + 1) {
      ticks.push({ pos, label: fmtLabel(Math.abs(k * step), unit), level: "major" });
    }
    if (minorDiv) {
      const sub = screenPerStep / minorDiv;
      for (let m = 1; m < minorDiv; m++) {
        const mpos = pos + m * sub;
        if (mpos < -1 || mpos > bandLen + 1) continue;
        const isMid = m * 2 === minorDiv;
        ticks.push({ pos: mpos, label: null, level: isMid ? "mid" : "minor" });
      }
    }
  }
  return ticks;
}

export default function CanvasRulers() {
  const dispatch = useDispatch();
  const showRuler = useSelector((s) => s.appSlice.showRuler);
  const unit = useSelector((s) => s.appSlice.rulerUnit);
  const origin = useSelector((s) => s.appSlice.rulerOrigin);
  const zoomRatio = useSelector(getZoom);
  const canvasScale = useSelector(getCanvasScale);
  const canvasSize = useSelector(getCanvasSize);
  const pageIndex = useSelector(getCurrentPageIndex);

  const rootRef = useRef(null);
  const rafRef = useRef(0);
  const [geom, setGeom] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const svg = document.getElementById("canvasWrapper");
    if (!root) return;
    const cRect = root.getBoundingClientRect();
    if (!svg) {
      setGeom({ rootW: cRect.width, rootH: cRect.height, hasCanvas: false });
      return;
    }
    const sRect = svg.getBoundingClientRect();
    setGeom({
      rootW: cRect.width,
      rootH: cRect.height,
      left: sRect.left - cRect.left,
      top: sRect.top - cRect.top,
      width: sRect.width,
      height: sRect.height,
      vbW: svg.viewBox?.baseVal?.width || canvasSize.width || 1,
      vbH: svg.viewBox?.baseVal?.height || canvasSize.height || 1,
      hasCanvas: true,
    });
  }, [canvasSize.width, canvasSize.height]);

  const schedule = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useLayoutEffect(() => {
    if (!showRuler) return undefined;
    measure();
    const root = rootRef.current;
    const svg = document.getElementById("canvasWrapper");
    const scrollEl = document.querySelector(".pages-outer");

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      if (svg) ro.observe(svg);
      if (root) ro.observe(root);
      // Observe .pages-outer too: when the ruler toggles on, the canvas is
      // shifted by an ANIMATED padding change (the `.pages-outer { transition }`)
      // — a position change with NO svg size change, which the svg/root observers
      // miss. Its content-box shrinks as the padding animates, so this fires
      // through the whole transition and the bands follow the canvas to rest.
      if (scrollEl) ro.observe(scrollEl);
    }
    window.addEventListener("resize", schedule);
    if (scrollEl) scrollEl.addEventListener("scroll", schedule, { passive: true });

    // Belt-and-suspenders: re-measure after the padding/zoom transitions settle,
    // in case the observers don't catch a pure position change in some browser.
    const t1 = setTimeout(schedule, 120);
    const t2 = setTimeout(schedule, 420);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
      if (scrollEl) scrollEl.removeEventListener("scroll", schedule);
      clearTimeout(t1);
      clearTimeout(t2);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [showRuler, measure, schedule, pageIndex, zoomRatio, canvasScale, canvasSize.width, canvasSize.height]);

  // Close the options menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.(".canvas-ruler-menu") && !e.target.closest?.(".canvas-ruler-corner")) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const { hTicks, vTicks } = useMemo(() => {
    if (!geom || !geom.hasCanvas) return { hTicks: [], vTicks: [] };
    const dpi = canvasSize.dpi || 200;
    const pxPerUnit = convertUnitToPx(1, unit, dpi) || 1;
    const screenPerCanvasX = geom.width / (geom.vbW || 1);
    const screenPerCanvasY = geom.height / (geom.vbH || 1);

    // 0-position within the band, which spans the canvas extent.
    // Top ruler honours center/start/end. The LEFT ruler IGNORES "center"
    // (no vertical spine) — center behaves like start (0 at top); only "end"
    // flips it to the bottom.
    const origin0X = origin === "start" ? 0 : origin === "end" ? geom.width : geom.width / 2;
    const origin0Y = origin === "end" ? geom.height : 0;

    const hStep = pickStep(unit, pxPerUnit, screenPerCanvasX);
    const vStep = pickStep(unit, pxPerUnit, screenPerCanvasY);
    return {
      hTicks: buildAxis(origin0X, geom.width, hStep.step, hStep.screenPerStep, unit),
      vTicks: buildAxis(origin0Y, geom.height, vStep.step, vStep.screenPerStep, unit),
    };
  }, [geom, unit, origin, canvasSize.dpi]);

  // IMPORTANT: only guard on showRuler — NOT on geom. The root <div> must always
  // mount so rootRef is set and measure() can populate geom (else: never visible).
  if (!showRuler) return null;

  const lenFor = (level) => (level === "major" ? THICK * 0.55 : level === "mid" ? THICK * 0.36 : THICK * 0.22);
  const colorFor = (level) => (level === "major" ? TICK_MAJOR : level === "mid" ? TICK_MID : TICK_MINOR);

  // Bands hug the canvas edges (top band above, left band left of the canvas),
  // spanning the canvas extent. Only the thickness-axis position is clamped so
  // the band never scrolls off-screen when the canvas is larger than the viewport.
  const tbTop = geom ? clampPos(geom.top - THICK - GAP, geom.rootH - THICK) : 0;
  const lbLeft = geom ? clampPos(geom.left - THICK - GAP, geom.rootW - THICK) : 0;

  return (
    <div
      ref={rootRef}
      className="not-exportable canvas-rulers"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 6 }}
    >
      {geom && (<>
      {/* Top band — hugs the canvas top edge (spans canvas width) */}
      <svg
        width={geom.width}
        height={THICK}
        style={{ position: "absolute", top: tbTop, left: geom.left, display: "block" }}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={geom.width} height={THICK} fill={RULE_BG} />
        <line x1={0} y1={THICK - 0.5} x2={geom.width} y2={THICK - 0.5} stroke={RULE_EDGE} strokeWidth={1} />
        {hTicks.map((t, i) => (
          <line key={i} x1={t.pos} y1={THICK - lenFor(t.level)} x2={t.pos} y2={THICK} stroke={colorFor(t.level)} strokeWidth={1} />
        ))}
        {hTicks.map((t, i) =>
          t.label != null ? (
            <text key={`l${i}`} x={t.pos + 3} y={THICK * 0.3} fontSize={FONT} fill={LABEL_COLOR} fontFamily="Inter, Arial, sans-serif" fontWeight="500" dominantBaseline="middle">
              {t.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Left band — hugs the canvas left edge (spans canvas height) */}
      <svg
        width={THICK}
        height={geom.height}
        style={{ position: "absolute", top: geom.top, left: lbLeft, display: "block" }}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={THICK} height={geom.height} fill={RULE_BG} />
        <line x1={THICK - 0.5} y1={0} x2={THICK - 0.5} y2={geom.height} stroke={RULE_EDGE} strokeWidth={1} />
        {vTicks.map((t, i) => (
          <line key={i} x1={THICK - lenFor(t.level)} y1={t.pos} x2={THICK} y2={t.pos} stroke={colorFor(t.level)} strokeWidth={1} />
        ))}
        {vTicks.map((t, i) =>
          t.label != null ? (
            <text key={`l${i}`} x={THICK * 0.3} y={t.pos - 3} fontSize={FONT} fill={LABEL_COLOR} fontFamily="Inter, Arial, sans-serif" fontWeight="500" dominantBaseline="middle" transform={`rotate(-90 ${THICK * 0.3} ${t.pos - 3})`}>
              {t.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Corner box — at the intersection of the two bands; opens the options dialog */}
      <button
        type="button"
        className="canvas-ruler-corner"
        onClick={() => setMenuOpen((o) => !o)}
        title="Ruler options"
        style={{
          position: "absolute",
          top: tbTop,
          left: lbLeft,
          width: THICK,
          height: THICK,
          padding: 0,
          background: menuOpen ? "#e3e8ef" : RULE_BG,
          border: "none",
          borderRight: `1px solid ${RULE_EDGE}`,
          borderBottom: `1px solid ${RULE_EDGE}`,
          boxSizing: "border-box",
          pointerEvents: "auto",
          cursor: "pointer",
          fontSize: 8,
          fontWeight: 700,
          color: "#69727e",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {unit}
      </button>

      {/* Options dialog — opens from the corner box */}
      {menuOpen && (
        <div
          className="canvas-ruler-menu"
          style={{
            position: "absolute",
            top: tbTop + THICK + 4,
            left: lbLeft,
            minWidth: 184,
            background: "#ffffff",
            border: "1px solid #e3e7ec",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(20,28,40,0.16)",
            padding: 10,
            pointerEvents: "auto",
            zIndex: 7,
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          <MenuSection title="Unit">
            <Segmented options={UNITS.map((u) => ({ value: u, label: u }))} value={unit} onChange={(v) => dispatch(setRulerUnit(v))} />
          </MenuSection>

          <MenuSection title="Start from">
            <Segmented options={ORIGINS} value={origin} onChange={(v) => dispatch(setRulerOrigin(v))} />
          </MenuSection>

          <button
            type="button"
            onClick={() => { setMenuOpen(false); dispatch(setShowRuler(false)); }}
            style={{
              width: "100%",
              marginTop: 4,
              height: 30,
              borderRadius: 8,
              border: "1px solid #e3e7ec",
              background: "#fff",
              color: "#444b57",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Hide ruler
          </button>
        </div>
      )}
      </>)}
    </div>
  );
}

function MenuSection({ title, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#8b93a1", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#f1f3f6", borderRadius: 8, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              height: 26,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              background: active ? "var(--primary)" : "transparent",
              color: active ? "#fff" : "#69727e",
              transition: "all 0.12s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
