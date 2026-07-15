import { app, BrowserWindow, Menu, shell } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { CHANNELS } from "../shared/ipc";
import type { MenuEvent } from "../shared/ipc";

function send(event: MenuEvent): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  win?.webContents.send(CHANNELS.menuEvent, event);
}

export function buildMenu(): void {
  const isMac = process.platform === "darwin";

  // On Windows/Linux the application menu renders as a bar INSIDE the window,
  // directly under the title bar. The app should present only its own in-app
  // editor header at the top, so remove the native menu on those platforms.
  // Nothing in the renderer consumes the menu events (the preload `onMenuEvent`
  // wrapper is unused), and Chromium still handles the standard edit shortcuts
  // (copy/paste/cut/undo/redo) in inputs, so no functionality is lost. macOS
  // keeps its menu — there it lives in the system menu bar (top of the screen),
  // not the window, so it does not affect the app's top region.
  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "New Project", accelerator: "CmdOrCtrl+N", click: () => send("new") },
        { label: "Open…", accelerator: "CmdOrCtrl+O", click: () => send("open") },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => send("save") },
        { label: "Export…", accelerator: "CmdOrCtrl+E", click: () => send("export") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => send("undo") },
        {
          label: "Redo",
          accelerator: isMac ? "Shift+CmdOrCtrl+Z" : "CmdOrCtrl+Y",
          click: () => send("redo"),
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: () => send("zoom-in") },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => send("zoom-out") },
        { label: "Actual Size", accelerator: "CmdOrCtrl+0", click: () => send("zoom-reset") },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(!app.isPackaged
          ? [{ role: "reload" as const }, { role: "toggleDevTools" as const }]
          : []),
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Documentation", click: () => void shell.openExternal("https://apis.printpoz.com") },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
