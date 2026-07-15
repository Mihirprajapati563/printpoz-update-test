/**
 * ThemeDownloadToast — compact fixed-position progress card for an in-flight
 * offline theme download. Driven entirely by the `download` prop owned by
 * DesignSelectionPage; renders nothing when that's null.
 *
 *   download = {
 *     name, total, done, failed, bytes,
 *     status: "downloading" | "done" | "error",
 *     error?: string,
 *   }
 */
import React from "react";
import styled, { keyframes } from "styled-components";
import { FaDownload, FaCheckCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { tokens } from "./styles";

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Card = styled.div`
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 4000;
  width: min(340px, calc(100vw - 44px));
  padding: 14px 16px;
  border-radius: 14px;
  background: ${tokens.surface};
  border: 1px solid ${tokens.line};
  animation: ${slideUp} 0.26s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const IconWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 9px;
  font-size: 14px;
  color: ${tokens.ink};
  background: ${tokens.primarySoft};
`;

const Title = styled.div`
  flex: 1;
  min-width: 0;
  .label {
    font-size: 13px;
    font-weight: 800;
    color: ${tokens.ink};
  }
  .name {
    font-size: 12px;
    color: ${tokens.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const CloseBtn = styled.button`
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: ${tokens.faint};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover { background: ${tokens.hover}; color: ${tokens.ink2}; }
`;

const Bar = styled.div`
  margin-top: 11px;
  height: 7px;
  border-radius: 999px;
  background: ${tokens.surfaceAlt};
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  width: ${(p) => p.$pct}%;
  background: ${(p) =>
    p.$tone === "error" ? tokens.muted : p.$tone === "done" ? tokens.ink : tokens.primary};
  transition: width 0.25s ease;
`;

const Meta = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: ${tokens.muted};
  .err { color: ${tokens.ink}; font-weight: 700; }
`;

const fmtBytes = (n) => {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const ThemeDownloadToast = ({ download, onClose }) => {
  if (!download) return null;
  const { name, total = 0, done = 0, failed = 0, bytes = 0, status, error } = download;
  const tone = status === "error" ? "error" : status === "done" ? "done" : "downloading";
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : status === "done" ? 100 : 8;

  const label =
    status === "error"
      ? "Download failed"
      : status === "done"
      ? failed > 0
        ? "Downloaded (some assets skipped)"
        : "Successfully downloaded"
      : "Downloading theme…";

  return (
    <Card role="status" aria-live="polite">
      <Row>
        <IconWrap $tone={tone}>
          {tone === "error" ? (
            <FaExclamationTriangle />
          ) : tone === "done" ? (
            <FaCheckCircle />
          ) : (
            <FaDownload />
          )}
        </IconWrap>
        <Title>
          <div className="label">{label}</div>
          <div className="name">{name || "Theme"}</div>
        </Title>
        {(status === "done" || status === "error") && (
          <CloseBtn onClick={onClose} aria-label="Dismiss">
            <FaTimes size={12} />
          </CloseBtn>
        )}
      </Row>

      <Bar>
        <Fill $pct={pct} $tone={tone} />
      </Bar>

      <Meta>
        {status === "error" ? (
          <span className="err">{error || "Something went wrong."}</span>
        ) : (
          <>
            <span>
              {done}/{total} assets{failed > 0 ? ` · ${failed} skipped` : ""}
            </span>
            <span>{fmtBytes(bytes)}</span>
          </>
        )}
      </Meta>
    </Card>
  );
};

export default ThemeDownloadToast;
