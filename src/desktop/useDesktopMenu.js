import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { ActionCreators } from "redux-undo";
import { desktop } from "./index";

// Bridges native OS menu items to the existing app behavior.
// - Undo/Redo dispatch the redux-undo global actions (same as the in-app buttons).
// - Other items are re-emitted as a `desktop:menu` DOM CustomEvent so feature code
//   (Header save/export, etc.) can opt in later without coupling to Electron.
// No-op on the web (desktop is null).
export function useDesktopMenu() {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!desktop || typeof desktop.onMenu !== "function") return undefined;

    const off = desktop.onMenu((event) => {
      switch (event) {
        case "undo":
          dispatch(ActionCreators.undo());
          break;
        case "redo":
          dispatch(ActionCreators.redo());
          break;
        default:
          window.dispatchEvent(new CustomEvent("desktop:menu", { detail: event }));
      }
    });

    return off;
  }, [dispatch]);
}
