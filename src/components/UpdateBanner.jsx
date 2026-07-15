import { useEffect, useState } from "react";
import { desktop } from "../desktop";

// Auto-update status badge (bottom-left). Shows ONLY when there's something to
// act on or watch — downloading, update ready, or a failure. Stays hidden when
// idle / up to date (no persistent pill). On failure it offers Retry (re-runs the
// check) and Update manually (opens the releases page). No-op on the web.
//
// Must match electron-builder.yml `publish` owner/repo (manual-download link).
const RELEASES_URL = "https://github.com/Mihirprajapati563/printpoz-update-test/releases/latest";

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

  const retry = () => {
    setStatus("checking");
    desktop?.checkForUpdate?.().catch(() => setStatus("error"));
  };

  // Hidden unless there's something actionable/worth showing.
  const visible =
    status === "available" || status === "downloading" || status === "downloaded" || status === "error";
  if (!visible) return null;

  const isMac = platform === "darwin";
  let label = "";
  if (status === "available") label = isMac ? "Update available" : "Update available…";
  else if (status === "downloading") label = `Downloading update${progress != null ? ` ${progress}%` : "…"}`;
  else if (status === "downloaded") label = "Update ready — restart to apply";
  else if (status === "error") label = "Update failed";

  const btn = {
    padding: "3px 10px",
    borderRadius: 12,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  };

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
        background: status === "error" ? "rgba(153,27,27,0.95)" : "rgba(31,41,55,0.92)",
        color: "#fff",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      {version && <span style={{ fontWeight: 600 }}>v{version}</span>}
      <span style={{ opacity: 0.9 }}>{label}</span>

      {/* Mac can't self-install — the only action is manual download. */}
      {status === "available" && isMac && (
        <button type="button" onClick={() => desktop?.openExternal(RELEASES_URL)} style={{ ...btn, background: "#3b82f6" }}>
          Download
        </button>
      )}

      {/* Failure: let the user retry or grab the installer manually. */}
      {status === "error" && (
        <>
          <button type="button" onClick={retry} style={{ ...btn, background: "#2563eb" }}>
            Retry
          </button>
          <button type="button" onClick={() => desktop?.openExternal(RELEASES_URL)} style={{ ...btn, background: "rgba(255,255,255,0.2)" }}>
            Update manually
          </button>
        </>
      )}
    </div>
  );
}
