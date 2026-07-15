// Regression: switching to a size variant with FEWER pages than the currently
// active page index used to strand `activePageIndex` past the end of the new
// `pages` array. The next selection resolve (setActiveObject) then dereferenced
// `state.pages[activePageIndex].layout` on `undefined` and threw
// "Cannot read properties of undefined (reading 'layout')" — crashing the editor
// mid size-change. applyTheme now clamps the index, and the selection resolvers
// bail out safely on an out-of-range active page.

// Cut the generatePageSvg → commonJSON → PhotosAction → canvas module cycle jest
// can't resolve (same shim the other slice/helper tests use). Nothing here renders SVG.
jest.mock("../../../library/utils/common-functions/generatePageSvg.js", () => ({
  generatePageSvg: () => "",
}));

import { store } from "../../store.jsx";
import {
  applyTheme,
  setActiveObject,
  setActiveObjects,
  setPageNumber,
} from "../canvas.js";

const page = (id, objId) => ({
  id: `pages_${id}`,
  pageNumber: id,
  title: String(id),
  bgColor: "#fff",
  layout: [
    {
      width: 1000,
      height: 1000,
      objects: objId ? [{ id: objId, type: "text", content: "x" }] : [],
      safeAreaObjects: [],
    },
  ],
});

const getState = () => store.getState().canvas.present;

it("clamps activePageIndex when a size switch applies fewer pages", () => {
  // Start on a 3-page design, active page = index 2 (the last).
  store.dispatch(applyTheme([page(1), page(2), page(3, "obj-on-p3")]));
  store.dispatch(setPageNumber(2));
  expect(getState().activePageIndex).toBe(2);

  // Switch to a variant that only has 1 page (the crash trigger).
  store.dispatch(applyTheme([page(1, "obj-on-p1")]));

  // Index is clamped back into range instead of stranding at 2.
  expect(getState().activePageIndex).toBe(0);
});

it("setActiveObject does not throw after the pages shrink (stale selection)", () => {
  store.dispatch(applyTheme([page(1), page(2), page(3, "obj-on-p3")]));
  store.dispatch(setPageNumber(2));
  // Force a maximally out-of-range index BEFORE the guard even matters, to prove
  // the resolver itself is safe (not only the clamp).
  store.dispatch(setPageNumber(99));

  expect(() =>
    store.dispatch(setActiveObject({ id: "obj-on-p3" }))
  ).not.toThrow();
  expect(() => store.dispatch(setActiveObjects([{ id: "x" }]))).not.toThrow();
});

it("does not throw on an empty pages array", () => {
  store.dispatch(applyTheme([]));
  expect(getState().activePageIndex).toBe(0);
  expect(() => store.dispatch(setActiveObject({ id: "any" }))).not.toThrow();
});

it("still selects a real object on the active page (no regression)", () => {
  store.dispatch(applyTheme([page(1, "real-obj"), page(2)]));
  store.dispatch(setPageNumber(0));
  store.dispatch(setActiveObject({ id: "real-obj" }));
  expect(getState().activeObjectprops?.id).toBe("real-obj");
});
