import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { MobileUpload } from "../layout/pages/MobileUpload.jsx";
import { PreviewPage } from "../layout/pages/PreviewPage.jsx";
import LoginPage from "../layout/pages/LoginPage.jsx";
import DesignSelectionPage from "../layout/pages/DesignSelectionPage.jsx";
import RootGate from "./RootGate.jsx";
import { ThemeProvider } from "styled-components";
import { GlobalStyles, theme } from "../common-components/StyledComponents.jsx";
import { LoadingState } from "../common-components/StateViews.jsx";
import { hydrateEditorData } from "../library/utils/helpers/editorDataBoot.js";
import { hydrateAuthSession } from "../library/utils/helpers/session.js";
import { installAssetCachePrewarm } from "../library/utils/helpers/prewarmAssetCache.js";
import { clearOldImageCache, initImageCacheUrlMap } from "../library/utils/helpers/imageCache.js";
import { initThemePackUrlMap } from "../library/utils/helpers/themePacks.js";
import { isDesktop } from "../desktop/index.js";
import "../library/utils/custom-hooks/useInitializeShader.js";
import { useDesktopMenu } from "../desktop/useDesktopMenu.js";

function App() {
  useDesktopMenu(); // wires native menu (undo/redo) on desktop; no-op on web

  // On desktop the crash/offline snapshot lives in AppData (the source of truth)
  // and must be read into the in-memory cache BEFORE RootGate makes its
  // synchronous restore decision — otherwise a reopened app would miss the
  // last-edited session. Gate the router behind that one-time hydration. On web
  // there is no AppData, so start hydrated (no splash, behavior unchanged).
  const [hydrated, setHydrated] = useState(!isDesktop);
  useEffect(() => {
    if (!isDesktop) return; // web: nothing to hydrate
    let alive = true;
    // Restore BOTH the editor snapshot AND the login session (+ remembered
    // emails) from AppData/keychain before the router renders — RootGate reads
    // localStorage synchronously, so the durable session must be back in place
    // first or a logged-in user would be bounced to Login on a fresh launch.
    Promise.all([hydrateEditorData(), hydrateAuthSession()]).finally(() => {
      if (alive) setHydrated(true);
    });
    // Pre-warm the offline asset catalog cache (backgrounds/stickers/masks/
    // layouts) in the background while online, so those tabs work offline even
    // if never manually opened. Best-effort, deferred, re-runs on reconnect.
    installAssetCachePrewarm();
    // Build the offline theme-pack url map (original CDN url → on-disk app-assets
    // url) so downloaded themes render from disk. Rebuild on reconnect in case a
    // pack was added in another window. Best-effort; never blocks startup.
    initThemePackUrlMap();
    // Build the offline preview-image cache map (original CDN url → on-disk
    // app-assets url) so cached theme/background/sticker previews render from disk
    // when offline. Rebuilt on reconnect as newly-viewed previews get cached.
    initImageCacheUrlMap();
    const onOnline = () => {
      initThemePackUrlMap();
      initImageCacheUrlMap();
    };
    window.addEventListener("online", onOnline);
    // Evict image cache entries older than 7 days to keep the store bounded.
    // Best-effort: runs in background, never blocks startup.
    setTimeout(() => clearOldImageCache(), 3000);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {!hydrated ? (
        <LoadingState label="Restoring your workspace…" padding="40vh 20px" />
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/design" element={<DesignSelectionPage />} />
          {/* `/` is gated: logged-in users resume their last editor or land on
              Design Selection; logged-out users go to Login. The editor renders
              only on an explicit deep-link (t_id / c_id). See RootGate. */}
          <Route path="/" element={<RootGate />} />
          <Route path="/upload/:projectId" element={<MobileUpload />} />
          <Route path="/test" element={<MobileUpload />} />
          <Route path="/preview" element={<PreviewPage />} />
        </Routes>
      )}
    </ThemeProvider>
  );
}
export default App;
