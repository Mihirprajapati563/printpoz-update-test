import { useEffect, useState } from "react";
import { desktop } from "../desktop";

// Always-visible version + live auto-update status badge (bottom-left).
// TEMPORARY debug aid — shows the installed version and every updater stage
// (checking / available / downloading % / restart-to-apply) so you can watch a
// silent update happen. Remove once auto-update is verified in production.
// No-op on the web (desktop is null). Version comes from app.getVersion() via
// getInfo(); status is pushed from electron/main/updater.ts over update:status.
//
// Must match electron-builder.yml `publish` owner/repo (mac manual-download link).
const RELEASES_URL = "https://github.com/Mihirprajapati563/printpoz-update-test/releases/latest";

const STATUS_TEXT = {
  checking: "Checking for updates…",
  available: "Update available…",
  downloading: "Downloading update",
  downloaded: "Update ready — restart to apply",
  "not-available": "Up to date",
  error: "Update check failed",
};

export default function UpdateBanner() {
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!desktop || typeof desktop.getInfo !== "function") return;
    desktop
      .getInfo()
      .then((info) => {
        setVersion(info?.version || "");
        setPlatform(info?.platform || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!desktop || typeof desktop.onUpdateStatus !== "function") return undefined;
    return desktop.onUpdateStatus((s, p) => {
      setStatus(s);
      if (s === "downloading" && typeof p === "number") setProgress(p);
    });
  }, []);

  // Only render inside the desktop app (version present).
  if (!version) return null;

  const isMacAvailable = status === "available" && platform === "darwin";
  let statusLabel = status ? STATUS_TEXT[status] : "";
  if (status === "downloading" && progress != null) statusLabel = `Downloading update ${progress}%`;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 12px",
        borderRadius: 20,
        background: "rgba(31,41,55,0.92)",
        color: "#fff",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontWeight: 600 }}>v{version}</span>
      {statusLabel && (
        <>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ opacity: 0.9 }}>{statusLabel}</span>
        </>
      )}
      {isMacAvailable && (
        <button
          type="button"
          onClick={() => desktop?.openExternal(RELEASES_URL)}
          style={{
            padding: "3px 10px",
            borderRadius: 12,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Download
        </button>
      )}
    </div>
  );
}
