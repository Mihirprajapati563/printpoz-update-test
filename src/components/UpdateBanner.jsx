import { useEffect, useState } from "react";
import { desktop } from "../desktop";

// macOS-only "Update available" banner. On unsigned mac builds the app can't
// self-install an update, so the main process (updater.ts initMacNotifyOnly)
// pushes "available" and this banner offers a Download button that opens the
// GitHub releases page — the user installs the new DMG manually.
// Windows/Linux update silently and never push "available", so this stays hidden
// there. No-op on the web (desktop is null). Inert until initAutoUpdater() is on.
//
// Must match electron-builder.yml `publish` owner/repo.
const RELEASES_URL = "https://github.com/Mihirprajapati563/printpoz-update-test/releases/latest";

export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!desktop || typeof desktop.onUpdateStatus !== "function") return undefined;
    return desktop.onUpdateStatus((status) => {
      if (status === "available") setShow(true);
    });
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 8,
        background: "#1f2937",
        color: "#fff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        fontSize: 14,
      }}
    >
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => desktop?.openExternal(RELEASES_URL)}
        style={{
          padding: "6px 14px",
          borderRadius: 6,
          border: "none",
          background: "#3b82f6",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Download
      </button>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 18 }}
      >
        ×
      </button>
    </div>
  );
}
