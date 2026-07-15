import { registerAppIpc } from "./app.ipc";
import { registerAssetsIpc } from "./assets.ipc";
import { registerAssetsCacheIpc } from "./assets-cache.ipc";
import { registerImageCacheIpc } from "./image-cache.ipc";
import { registerDialogIpc } from "./dialog.ipc";
import { registerEditorDataIpc } from "./editor-data.ipc";
import { registerExportIpc } from "./export.ipc";
import { registerFontsIpc } from "./fonts.ipc";
import { registerFsIpc } from "./fs.ipc";
import { registerSecureStoreIpc } from "./secure-store.ipc";
import { registerThemePacksIpc } from "./theme-packs.ipc";

// Register every IPC domain. Add new domains here.
export function registerAllIpc(): void {
  registerAppIpc();
  registerSecureStoreIpc();
  registerDialogIpc();
  registerFsIpc();
  registerAssetsIpc();
  registerAssetsCacheIpc();
  registerImageCacheIpc();
  registerExportIpc();
  registerFontsIpc();
  registerEditorDataIpc();
  registerThemePacksIpc();
}
