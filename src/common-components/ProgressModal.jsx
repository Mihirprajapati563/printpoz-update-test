import React from "react";
import { Modal } from "react-bootstrap";
import styled from "styled-components";

/**
 * ProgressModal — the centered "export in progress" dialog.
 * Driven entirely by the `progress` object from PdfExportContext:
 *   { showProgress, progress (0-100), currentPage, totalPages, status }
 *
 * Colors come from the theme CSS variables (index.css) so it matches the rest of
 * the editor in every theme — no hardcoded brand colors.
 */

const ProgressModalStyled = styled(Modal)`
  .modal-dialog {
    display: flex;
    align-items: center;
    min-height: calc(100vh - 3.5rem);
    margin: 1.75rem auto;
    max-width: 460px;

    @media (max-width: 575px) {
      min-height: calc(100vh - 1rem);
      margin: 0.5rem;
      max-width: calc(100% - 1rem);
    }
  }

  .modal-content {
    background: var(--background, #ffffff);
    border-radius: 18px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border, #e2e8f0);
    overflow: hidden;
    width: 100%;
  }
`;

const Body = styled.div`
  padding: 2rem 2rem 1.75rem;
  text-align: center;

  @media (max-width: 575px) {
    padding: 1.5rem 1.25rem 1.25rem;
  }
`;

const Ring = styled.div`
  width: 54px;
  height: 54px;
  margin: 0 auto 1.25rem;
  border-radius: 50%;
  border: 4px solid var(--secondary, #eef4fa);
  border-top-color: var(--primary, #4084b5);
  animation: pm-spin 0.8s linear infinite;

  @keyframes pm-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 575px) {
    width: 46px;
    height: 46px;
    margin-bottom: 1rem;
  }
`;

const Status = styled.h5`
  color: var(--foreground, #1f2937);
  margin: 0 0 0.35rem;
  font-weight: 600;
  font-size: 1.15rem;
  line-height: 1.35;

  @media (max-width: 575px) {
    font-size: 1rem;
  }
`;

const SubText = styled.p`
  color: var(--muted-foreground, #6b7280);
  font-size: 0.875rem;
  margin: 0 0 1.25rem;

  @media (max-width: 575px) {
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }
`;

const Track = styled.div`
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: var(--secondary, #eef4fa);
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: var(--primary, #4084b5);
  transition: width 0.35s ease;
  width: ${(props) => props.$pct}%;
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.22) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.22) 50%,
    rgba(255, 255, 255, 0.22) 75%,
    transparent 75%,
    transparent
  );
  background-size: 1rem 1rem;
  animation: ${(props) => (props.$done ? "none" : "pm-stripes 1s linear infinite")};

  @keyframes pm-stripes {
    from {
      background-position: 1rem 0;
    }
    to {
      background-position: 0 0;
    }
  }
`;

const PctRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.6rem;
  font-size: 0.8rem;
  color: var(--muted-foreground, #6b7280);
  font-weight: 500;
`;

const WarningBox = styled.div`
  background-color: rgba(239, 68, 68, 0.06);
  border: 1px dashed rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 1.5rem;
  font-size: 0.775rem;
  color: #dc2626;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  animation: pm-pulse 2s infinite ease-in-out;

  @keyframes pm-pulse {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 1; transform: scale(1.01); }
  }
`;

const DetailText = styled.div`
  font-size: 0.85rem;
  color: var(--foreground, #1f2937);
  font-weight: 500;
  margin-bottom: 0.5rem;
  min-height: 1.25rem;
`;

const RotatingTipText = styled.div`
  font-size: 0.775rem;
  color: var(--muted-foreground, #6b7280);
  background-color: var(--secondary, #eef4fa);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  min-height: 2.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.02);
  transition: opacity 0.3s ease;
`;

const ROTATING_TIPS = [
  "💡 High-resolution image layers are compiled dynamically for optimal print quality.",
  "💡 Vector structures and text paths are processed at 300 DPI for crisp printing.",
  "💡 Bleed margins are aligned automatically so your designs print perfectly edge-to-edge.",
  "💡 Font faces are rendered directly as vectors to prevent any resolution loss.",
  "💡 Complex layer masks and transparency elements are merged into high-fidelity tiles.",
  "💡 Pre-flight validations check object boundaries to prevent cut-offs.",
  "💡 Color palettes are converted precisely to match the final print profiles."
];

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Self-contained elapsed timer — counts from its own mount, so dropping it inside
// a conditionally-rendered overlay times exactly that phase (mount→unmount).
export const ElapsedTime = ({ prefix = "⏱", style }) => {
  const [s, setS] = React.useState(0);
  const start = React.useRef(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setS((Date.now() - start.current) / 1000), 250);
    return () => clearInterval(id);
  }, []);
  return <span style={style}>{prefix} {fmtTime(s)}</span>;
};

export const ProgressModal = ({ progress }) => {
  const [tipIndex, setTipIndex] = React.useState(0);
  const [fade, setFade] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(null);

  const pct = progress ? Math.max(0, Math.min(100, Math.round(progress.progress || 0))) : 0;
  const done = pct >= 100;
  const hasPages = progress ? progress.totalPages > 0 : false;

  // Elapsed timer: starts when the dialog appears, ticks while working, FREEZES on
  // completion (so the final "Completed in m:ss" stays), resets when hidden.
  React.useEffect(() => {
    const showing = progress && progress.showProgress;
    if (showing && !done) {
      if (startRef.current == null) startRef.current = Date.now();
      setElapsed((Date.now() - startRef.current) / 1000);
      const id = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 250);
      return () => clearInterval(id);
    }
    if (!showing) {
      startRef.current = null;
      setElapsed(0);
    }
  }, [progress && progress.showProgress, done]);

  // Cycle tips every 3.5 seconds with a soft fade transition
  React.useEffect(() => {
    if (!progress || !progress.showProgress || done) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % ROTATING_TIPS.length);
        setFade(true);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [progress, done]);

  if (!progress) return null;

  // Engaging status message based on percentage
  let engagingMessage = "Initializing rendering pipeline...";
  if (pct > 0 && pct <= 20) {
    engagingMessage = "Preparing canvas layout and assets...";
  } else if (pct > 20 && pct <= 40) {
    engagingMessage = "Rendering high-resolution layers...";
  } else if (pct > 40 && pct <= 60) {
    engagingMessage = "Applying vector details and text formatting...";
  } else if (pct > 60 && pct <= 80) {
    engagingMessage = "Stitching print tiles and processing SVGs...";
  } else if (pct > 80 && pct <= 95) {
    engagingMessage = "Compressing outputs and building final PDF...";
  } else if (pct > 95 && pct < 100) {
    engagingMessage = "Wrapping up the export package...";
  } else if (done) {
    engagingMessage = "Export complete!";
  }

  return (
    <ProgressModalStyled
      show={progress.showProgress}
      centered
      backdrop="static"
      keyboard={false}
      animation={false}
    >
      <Body>
        {!done && <Ring />}
        <Status>{progress.status || "Exporting…"}</Status>
        <SubText>
          {hasPages
            ? `Page ${Math.min(progress.currentPage || 0, progress.totalPages)} of ${progress.totalPages}`
            : done
              ? "All set"
              : "Please keep this window open…"}
        </SubText>

        <DetailText>
          {engagingMessage}
        </DetailText>

        {!done && (
          <RotatingTipText style={{ opacity: fade ? 1 : 0 }}>
            {ROTATING_TIPS[tipIndex]}
          </RotatingTipText>
        )}

        <Track>
          <Fill $pct={pct} $done={done} />
        </Track>
        <PctRow>
          <span>
            {done ? `✓ Completed in ${fmtTime(elapsed)}` : `⏱ ${fmtTime(elapsed)} elapsed`}
          </span>
          <span>{pct}%</span>
        </PctRow>

        {!done && (
          <WarningBox>
            <span>⚠️</span>
            <span>Do not close this window or exit the application.</span>
          </WarningBox>
        )}
      </Body>
    </ProgressModalStyled>
  );
};
