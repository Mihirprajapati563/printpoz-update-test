// saveEditorToLibrary — the editor's "Save Theme" / "Update Theme" buttons
// persist the LIVE design to the on-device Saved Designs library with no API
// round-trip. This verifies the current editor state lands in listSavedDesigns()
// under a stable id and that repeat saves update the same entry (no duplicate).
//
// Runs on the legacy localStorage path (jsdom has no IndexedDB and the desktop
// bridge is absent) — the same fallback savedDesigns.test.js exercises.

// Cut the generatePageSvg → commonJSON → PhotosAction → canvas module cycle jest
// can't resolve (see savedDesigns.test.js). Nothing here renders SVG.
jest.mock("../../common-functions/generatePageSvg.js", () => ({
  generatePageSvg: () => "",
}));

import { store } from "../../../../store/store.jsx";
import { applyTheme, setCanvasSize } from "../../../../store/slices/canvas.js";
import { setThemeName } from "../../../../store/slices/projectSetup.js";
import { saveCurrentEditorToLibrary } from "../saveEditorToLibrary.js";
import {
  listSavedDesigns,
  getDesignById,
  resetActiveLocalDesignId,
} from "../savedDesigns.js";

const seedEditor = (name, size) => {
  store.dispatch(setCanvasSize({ width: size, height: size, dpi: 200 }));
  store.dispatch(setThemeName(name));
  store.dispatch(
    applyTheme([
      {
        id: "pages_1",
        pageNumber: 1,
        title: "1",
        bgColor: "#fff",
        layout: [
          {
            width: size,
            height: size,
            objects: [{ id: "o1", type: "text", content: "hi" }],
            safeAreaObjects: [],
          },
        ],
      },
    ])
  );
};

beforeEach(() => {
  localStorage.clear();
  resetActiveLocalDesignId();
});

it("persists the live editor state to the local library under a local id", async () => {
  seedEditor("My Offline Theme", 1200);

  const savedId = await saveCurrentEditorToLibrary();
  expect(savedId).toMatch(/^local:/);

  const list = await listSavedDesigns();
  const meta = list.find((d) => d.id === savedId);
  expect(meta).toBeTruthy();
  expect(meta.name).toBe("My Offline Theme");

  // The pages round-trip through the library payload.
  const full = await getDesignById(savedId);
  expect(full.pages).toHaveLength(1);
});

it("updates the SAME entry on a repeat save (no duplicate card)", async () => {
  seedEditor("Repeat Save", 800);

  const id1 = await saveCurrentEditorToLibrary();
  const id2 = await saveCurrentEditorToLibrary();
  expect(id1).toBe(id2);

  const list = await listSavedDesigns();
  expect(list.filter((d) => d.id === id1)).toHaveLength(1);
});
