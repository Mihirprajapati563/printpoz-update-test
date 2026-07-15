// Stub transitive imports that pull ESM-only axios into the canvas slice graph.
jest.mock("../../../library/utils/common-functions", () => ({
  getDynamicStartYear: () => 2024,
}));

import reducer, {
  replaceSettings,
  setSettings,
  pasteObject,
  addObjectInPage,
  setActiveObjects,
  removeMultipleObjectsInPage,
} from "../canvas";

beforeEach(() => {
  // addObjectInPage reads userDetails from localStorage; default to non-customer
  localStorage.setItem(
    "userDetails",
    JSON.stringify({ userTypeCode: 3 }) // USER_TYPES.ADMIN === 3
  );
});

// Helper: build minimal state with 1 page, 2 layouts, canvasSize 2400x1200
function makeState(overrides = {}) {
  const base = reducer(undefined, { type: "@@INIT" });
  const layout = (id) => ({
    id,
    objects: [],
    safeAreaObjects: [],
    safeArea: [],
    background: { color: null, image: null, flip: false },
  });
  return {
    ...base,
    canvasSize: { ...base.canvasSize, width: 2400, height: 1200 },
    pages: [
      {
        ...base.pages[0],
        layout: [layout("L0"), layout("L1")],
      },
    ],
    ...overrides,
  };
}

describe("canvas slice — replaceSettings", () => {
  test("fully replaces settings; old keys dropped", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    // initialState.settings has coverEnabled, exportSpine, allowImage, etc.
    expect(state.settings.allowImage).toBe(true);
    expect(state.settings.coverEnabled).toBe(false);

    const next = reducer(state, replaceSettings({ shape: "circle" }));
    expect(next.settings).toEqual({ shape: "circle" });
    expect(next.settings.allowImage).toBeUndefined();
    expect(next.settings.coverEnabled).toBeUndefined();
    expect(next.settings.exportSpine).toBeUndefined();
  });

  test("null payload falls back to empty object (no crash)", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    const next = reducer(state, replaceSettings(null));
    expect(next.settings).toEqual({});
  });

  test("REGRESSION risk: feature flags silently dropped if new theme omits them", () => {
    // This test documents the known risk: if a new theme JSON lacks
    // allowImageDelete / maxImageUploadLimit, they vanish from state.
    const state = reducer(undefined, { type: "@@INIT" });
    const next = reducer(state, replaceSettings({ shape: "rectangle" }));
    expect(next.settings.allowImageDelete).toBeUndefined();
    expect(next.settings.maxImageUploadLimit).toBeUndefined();
  });
});

describe("canvas slice — theme-switch preservation contract (ThemesAction fix)", () => {
  // ThemesAction merges PRESERVED_SETTINGS_KEYS from currentSettings into the
  // new theme's settings before calling replaceSettings. This test locks in
  // the expected payload shape so regressions surface immediately.
  const PRESERVED = [
    "allowImageDelete",
    "maxImageUploadLimit",
    "applyMaximumImageUploadLimit",
    "allowBackgroundRemover",
  ];

  test("caller-merged payload preserves project-scope flags across switch", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    const currentSettings = {
      ...state.settings,
      allowImageDelete: false, // admin restriction
      maxImageUploadLimit: 50,
      applyMaximumImageUploadLimit: true,
      allowBackgroundRemover: true,
    };
    const newThemeSettings = { shape: "circle", coverEnabled: true };

    // Mirror ThemesAction merge logic
    const preserved = {};
    PRESERVED.forEach((k) => {
      if (currentSettings[k] !== undefined && newThemeSettings[k] === undefined) {
        preserved[k] = currentSettings[k];
      }
    });
    const next = reducer(
      { ...state, settings: currentSettings },
      replaceSettings({ ...preserved, ...newThemeSettings })
    );

    // Preserved
    expect(next.settings.allowImageDelete).toBe(false);
    expect(next.settings.maxImageUploadLimit).toBe(50);
    expect(next.settings.applyMaximumImageUploadLimit).toBe(true);
    expect(next.settings.allowBackgroundRemover).toBe(true);
    // From new theme
    expect(next.settings.shape).toBe("circle");
    expect(next.settings.coverEnabled).toBe(true);
    // Old theme-scope flags NOT preserved (correct behavior)
    expect(next.settings.isFoldable).toBeUndefined();
    expect(next.settings.exportSpine).toBeUndefined();
  });

  test("new theme's value wins when it declares a preserved key", () => {
    // If the theme explicitly sets maxImageUploadLimit, the theme's value wins.
    const current = { maxImageUploadLimit: 50, allowImageDelete: true };
    const newTheme = { maxImageUploadLimit: 100, shape: "square" };

    const preserved = {};
    PRESERVED.forEach((k) => {
      if (current[k] !== undefined && newTheme[k] === undefined) {
        preserved[k] = current[k];
      }
    });
    const state = reducer(undefined, { type: "@@INIT" });
    const next = reducer(
      { ...state, settings: current },
      replaceSettings({ ...preserved, ...newTheme })
    );

    expect(next.settings.maxImageUploadLimit).toBe(100); // theme wins
    expect(next.settings.allowImageDelete).toBe(true); // preserved
  });
});

describe("canvas slice — setSettings (merge) vs replaceSettings (replace)", () => {
  test("setSettings MERGES new keys, preserves untouched keys", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    const next = reducer(state, setSettings({ shape: "circle" }));
    // Pre-existing keys preserved
    expect(next.settings.allowImage).toBe(true);
    expect(next.settings.coverEnabled).toBe(false);
    // New key added
    expect(next.settings.shape).toBe("circle");
  });

  test("replaceSettings REPLACES (wipes unmentioned keys) — behavior contrast", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    const merged = reducer(state, setSettings({ shape: "circle" }));
    const replaced = reducer(merged, replaceSettings({ shape: "square" }));
    expect(Object.keys(replaced.settings)).toEqual(["shape"]);
    expect(replaced.settings.allowImage).toBeUndefined();
  });
});

describe("canvas slice — addObjectInPage sets activeObjectprops (new behavior)", () => {
  function baseState() {
    const s = reducer(undefined, { type: "@@INIT" });
    const layout = {
      id: "L0",
      objects: [],
      safeAreaObjects: [],
      safeArea: [],
      background: { color: null, image: null, flip: false },
    };
    return {
      ...s,
      activeSide: 0,
      pages: [{ ...s.pages[0], layout: [layout] }],
    };
  }

  test("adding text sets both activeObject and activeObjectprops", () => {
    const state = baseState();
    const next = reducer(
      state,
      addObjectInPage({ type: "text", x: 10, y: 20, text: "hi" })
    );
    expect(next.activeObject).not.toBeNull();
    expect(next.activeObjectprops).not.toBeNull();
    expect(next.activeObject.id).toBe(next.activeObjectprops.id);
  });

  test("adding image sets activeObjectprops to new img object", () => {
    const state = baseState();
    const next = reducer(
      state,
      addObjectInPage({ type: "img", x: 0, y: 0, url: "x.jpg" })
    );
    expect(next.activeObjectprops).not.toBeNull();
    expect(next.activeObjectprops).toEqual(next.activeObject);
  });
});

describe("canvas slice — removeMultipleObjectsInPage", () => {
  function stateWithObjects(objs) {
    const s = reducer(undefined, { type: "@@INIT" });
    const layout = {
      id: "L0",
      objects: objs,
      safeAreaObjects: [],
      safeArea: [],
      background: { color: null, image: null, flip: false },
    };
    return {
      ...s,
      activeSide: 0,
      activeObjects: objs.map((o) => ({ id: o.id, areaType: o.areaType || "" })),
      activeObject: objs[0] || null,
      activeObjectprops: objs[0] || null,
      pages: [{ ...s.pages[0], layout: [layout] }],
    };
  }

  test("deletes all objects in activeObjects and clears selection state", () => {
    const state = stateWithObjects([
      { id: "a", type: "text" },
      { id: "b", type: "img" },
      { id: "c", type: "shape" },
    ]);
    const next = reducer(state, removeMultipleObjectsInPage());
    expect(next.pages[0].layout[0].objects).toHaveLength(0);
    expect(next.activeObjects).toEqual([]);
    expect(next.activeObject).toBeNull();
    expect(next.activeObjectprops).toBeNull();
  });

  test("no-op when activeObjects empty", () => {
    const s = reducer(undefined, { type: "@@INIT" });
    const next = reducer({ ...s, activeObjects: [] }, removeMultipleObjectsInPage());
    expect(next).toEqual({ ...s, activeObjects: [] });
  });

  test("customer mode skips objects with disabledForClient", () => {
    localStorage.setItem(
      "userDetails",
      JSON.stringify({ userTypeCode: 6 }) // USER_TYPES.CUSTOMER === 6
    );
    const state = stateWithObjects([
      { id: "a", type: "text" },
      { id: "b", type: "img", disabledForClient: true },
    ]);
    const next = reducer(state, removeMultipleObjectsInPage());
    const remaining = next.pages[0].layout[0].objects;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("b");
  });
});

describe("canvas slice — pasteObject (side-aware)", () => {
  test("single-side copy pasted across sides: x shifted by +halfWidth (L→R)", () => {
    let state = makeState({
      activeSide: 1,
      copiedObjects: [
        {
          id: "orig-1",
          type: "text",
          transform: { x: 100, y: 50 },
          _srcLayoutIndex: 0,
        },
      ],
    });

    state = reducer(state, pasteObject());

    const L0 = state.pages[0].layout[0].objects;
    const L1 = state.pages[0].layout[1].objects;
    expect(L0).toHaveLength(0);
    expect(L1).toHaveLength(1);
    // 100 + 80 offset + 1200 halfWidth = 1380
    expect(L1[0].transform.x).toBe(1380);
    expect(L1[0].transform.y).toBe(130);
    expect(L1[0].id).not.toBe("orig-1"); // fresh uuid
  });

  test("single-side copy pasted same side: only +80 offset, no halfWidth shift", () => {
    let state = makeState({
      activeSide: 0,
      copiedObjects: [
        {
          id: "orig-2",
          type: "img",
          transform: { x: 200, y: 100 },
          _srcLayoutIndex: 0,
        },
      ],
    });

    state = reducer(state, pasteObject());

    const L0 = state.pages[0].layout[0].objects;
    expect(L0).toHaveLength(1);
    expect(L0[0].transform.x).toBe(280);
    expect(L0[0].transform.y).toBe(180);
  });

  test("multi-side spread copy: each object preserves source side, NO x-shift", () => {
    let state = makeState({
      activeSide: 1, // user clicked paste while on right side — should be ignored
      copiedObjects: [
        {
          id: "a",
          type: "text",
          transform: { x: 100, y: 50 },
          _srcLayoutIndex: 0,
        },
        {
          id: "b",
          type: "img",
          transform: { x: 1500, y: 200 },
          _srcLayoutIndex: 1,
        },
      ],
    });

    state = reducer(state, pasteObject());

    const L0 = state.pages[0].layout[0].objects;
    const L1 = state.pages[0].layout[1].objects;
    expect(L0).toHaveLength(1);
    expect(L1).toHaveLength(1);
    // Only +80 offset, no halfWidth add because copy spans both sides
    expect(L0[0].transform.x).toBe(180);
    expect(L1[0].transform.x).toBe(1580);
  });

  test("cross-side R→L shifts x by -halfWidth", () => {
    let state = makeState({
      activeSide: 0,
      copiedObjects: [
        {
          id: "c",
          type: "shape",
          transform: { x: 1500, y: 100 },
          _srcLayoutIndex: 1,
        },
      ],
    });

    state = reducer(state, pasteObject());

    const L0 = state.pages[0].layout[0].objects;
    // 1500 + 80 - 1200 = 380
    expect(L0[0].transform.x).toBe(380);
  });

  test("pasted clone receives new id and bumped zIndex; source meta stripped", () => {
    let state = makeState({
      activeSide: 0,
      copiedObjects: [
        {
          id: "d",
          type: "text",
          transform: { x: 0, y: 0 },
          zIndex: 3,
          _srcLayoutIndex: 0,
          _srcAreaType: "objects",
        },
      ],
    });
    // Pre-existing object on L0 with zIndex 5
    state.pages[0].layout[0].objects.push({ id: "existing", zIndex: 5 });

    state = reducer(state, pasteObject());

    const pasted = state.pages[0].layout[0].objects.find(
      (o) => o.id !== "existing"
    );
    expect(pasted.id).not.toBe("d");
    expect(pasted.zIndex).toBe(6); // max(5) + 1
    expect(pasted._srcLayoutIndex).toBeUndefined();
    expect(pasted._srcAreaType).toBeUndefined();
  });

  test("paste into safeArea when _srcAreaType === 'safeArea'", () => {
    let state = makeState({
      activeSide: 0,
      copiedObjects: [
        {
          id: "sa-1",
          type: "text",
          transform: { x: 10, y: 10 },
          _srcLayoutIndex: 0,
          _srcAreaType: "safeArea",
        },
      ],
    });

    state = reducer(state, pasteObject());

    expect(state.pages[0].layout[0].objects).toHaveLength(0);
    expect(state.pages[0].layout[0].safeAreaObjects).toHaveLength(1);
  });

  test("guard: activeSide === -1 is no-op", () => {
    const state = makeState({
      activeSide: -1,
      copiedObjects: [
        { id: "x", type: "text", transform: { x: 0, y: 0 }, _srcLayoutIndex: 0 },
      ],
    });
    const next = reducer(state, pasteObject());
    expect(next.pages[0].layout[0].objects).toHaveLength(0);
    expect(next.pages[0].layout[1].objects).toHaveLength(0);
  });

  test("single paste sets activeObject + activeObjects[1]; multi-paste clears activeObject", () => {
    let state = makeState({
      activeSide: 0,
      copiedObjects: [
        { id: "a", type: "text", transform: { x: 0, y: 0 }, _srcLayoutIndex: 0 },
        { id: "b", type: "img", transform: { x: 0, y: 0 }, _srcLayoutIndex: 0 },
      ],
    });
    state = reducer(state, pasteObject());
    expect(state.activeObject).toBeNull();
    expect(state.activeObjects).toHaveLength(2);
  });
});
