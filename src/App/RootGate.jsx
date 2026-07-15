import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MainLayout } from "../layout";
import {
  getUrlParam,
  readStoredUser,
  getLastOpenEditor,
} from "../library/utils/helpers/session";
import {
  hasEditorSnapshot,
  getEditorSnapshotIdentity,
} from "../library/utils/helpers/editorSnapshot";

/**
 * RootGate — entry decision for the `/` route.
 *
 * The desktop app (and web) always boot at `/`. Instead of dropping every launch
 * straight into the editor, we route based on session + intent:
 *
 *   1. Explicit editor deep-link (URL already carries `t_id` or `c_id`) → if the
 *      LOCAL editor snapshot belongs to that same design, resume from it (adds
 *      `restore=1`) so a reload — including an offline one, and the F5 case where
 *      the deep-link stays in the URL — continues from the user's latest working
 *      state with no server fetch; otherwise render the editor and let the normal
 *      bootstrap load the requested design. Covers Design-Selection "Continue",
 *      legacy web deep-links, and the resume redirect below.
 *   2. Logged in + a remembered last-open editor → resume that editor by replacing
 *      the URL with its saved query (token re-attached from the live session).
 *   3. Logged in, nothing to resume → Design Selection.
 *   4. Not logged in → Login.
 *
 * The snapshot is the freshest local copy of the working state (saved every 15s +
 * on unload) and restores offline, so preferring it on a matching deep-link is
 * both crash/offline-safe and avoids discarding unsaved edits on a reload.
 */
const RootGate = () => {
  const location = useLocation();

  const decision = useMemo(() => {
    const themeId = getUrlParam(location.search, "t_id");
    const projectId = getUrlParam(location.search, "c_id");
    const isNew = getUrlParam(location.search, "new") === "1";
    const isRestore = getUrlParam(location.search, "restore") === "1";
    // An in-progress restore, or an explicit "New Theme", always opens the editor
    // as-is (the restore pipeline and the fresh-theme reset own those cases).
    if (isRestore || isNew) return { kind: "editor" };

    const user = readStoredUser();
    const token = getUrlParam(location.search, "u_id") || user?.token || null;

    // Editor deep-link (t_id / c_id). This is ALSO the URL an in-app reload
    // (F5 / Ctrl+R) comes back on — the editor lives at `/` and the deep-link
    // stays in the (hash) query. Prefer resuming the LOCAL snapshot when it
    // belongs to THIS design: it carries the user's latest working state
    // (including edits not yet saved to the server) and restores with NO network,
    // which is the only path that survives a reload with no connectivity. Without
    // it the reload re-fetches from the server, which offline blanks the canvas
    // (uncached theme) or errors out (project), and even online silently discards
    // unsaved local edits. We match on identity so a deep-link to a DIFFERENT
    // design than the snapshot still loads that design fresh.
    if (themeId || projectId) {
      const snap = getEditorSnapshotIdentity();
      // For a theme deep-link the size is part of the match: the SAME theme
      // opened at a DIFFERENT size must NOT resume the previously-edited size's
      // snapshot — it starts fresh for the chosen size (each theme-size combo is
      // an independent design). The chosen size arrives as `size_w`/`size_h`
      // (Design Selection size modal); compare rounded width×height against the
      // snapshot's stored size the same way. When the deep-link carries no size
      // (legacy web deep-link, no modal), fall back to a theme-id-only match so
      // that path is unchanged. A cart (`c_id`) resume is size-agnostic — its
      // `cart:<id>` design already pins one size (snap.size is null there).
      const urlSizeW = getUrlParam(location.search, "size_w");
      const urlSizeH = getUrlParam(location.search, "size_h");
      const hasUrlSize = urlSizeW != null && urlSizeW !== "" && urlSizeH != null && urlSizeH !== "";
      const sizeMatches =
        !hasUrlSize ||
        !snap?.size ||
        (Math.round(parseFloat(urlSizeW)) === snap.size.width &&
          Math.round(parseFloat(urlSizeH)) === snap.size.height);
      const matchesSnapshot =
        !!snap &&
        ((projectId && snap.cartOrderId && String(snap.cartOrderId) === String(projectId)) ||
          (themeId && snap.themeId && String(snap.themeId) === String(themeId) && sizeMatches));
      if (matchesSnapshot) {
        // Keep the deep-link params and add restore=1 so the existing offline
        // restore pipeline takes over (useEditorSnapshot rehydrates redux from the
        // snapshot; useThemeSetup / useInitializeProject stand down on restore=1).
        // Reuses all existing restore code and is web-safe.
        const params = new URLSearchParams();
        if (token) params.set("u_id", token);
        if (themeId) params.set("t_id", themeId);
        if (projectId) params.set("c_id", projectId);
        for (const key of ["cat", "size_w", "size_h", "size_dpi", "size_sm", "size_bm", "size_label", "proj_name"]) {
          const v = getUrlParam(location.search, key);
          if (v != null && v !== "") params.set(key, v);
        }
        params.set("restore", "1");
        return { kind: "resume", to: `/?${params.toString()}` };
      }
      // No matching snapshot → open the requested design via the normal bootstrap.
      return { kind: "editor" };
    }

    // No session at all → login.
    if (!token) return { kind: "login" };

    // Logged in, no deep-link: prefer resuming the LOCAL editor snapshot if one
    // exists. Unlike the server-based last-open resume below, this carries the
    // user's actual (possibly unsaved) working state and restores offline — so a
    // crash / hard close / lost connection still continues exactly where they
    // left off.
    if (hasEditorSnapshot()) {
      return { kind: "resume", to: `/?u_id=${encodeURIComponent(token)}&restore=1` };
    }

    // Logged in: resume the last editor the user had open, if any.
    const lastEditor = getLastOpenEditor();
    if (lastEditor) {
      // Re-attach the live token so the resumed editor authenticates. Strip any
      // stale u_id the saved query might carry, then prepend the current one.
      const params = new URLSearchParams(lastEditor);
      params.delete("u_id");
      const rest = params.toString();
      const to = `/?u_id=${encodeURIComponent(token)}${rest ? `&${rest}` : ""}`;
      return { kind: "resume", to };
    }

    // Logged in, nothing to resume → design selection.
    return { kind: "design", to: `/design?u_id=${encodeURIComponent(token)}` };
  }, [location.search]);

  if (decision.kind === "editor") {
    return (
      <div className="App">
        <MainLayout />
      </div>
    );
  }
  if (decision.kind === "login") return <Navigate to="/login" replace />;
  // resume + design both navigate to a concrete URL.
  return <Navigate to={decision.to} replace />;
};

export default RootGate;
