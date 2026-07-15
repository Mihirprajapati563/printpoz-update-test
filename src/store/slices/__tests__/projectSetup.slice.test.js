// projectSetup.js has a dead `import { all } from "axios"` that pulls ESM axios.
// Stub to avoid parse error.
jest.mock("axios", () => ({ __esModule: true, default: {}, all: () => {} }));

import reducer, {
  setAuthItems,
  setThemeApplied,
  setError,
  resetProject,
  setProjectDetails,
} from "../projectSetup";

describe("projectSetup slice — auth + theme-applied additions", () => {
  test("initial state has new auth + theme-applied fields", () => {
    const s = reducer(undefined, { type: "@@INIT" });
    expect(s).toMatchObject({
      brand_id: null,
      store_id: null,
      authToken: null,
      userDetails: null,
      isThemeApplied: false,
    });
  });

  test("setAuthItems stores brand_id, store_id, accessToken → authToken", () => {
    const s = reducer(
      undefined,
      setAuthItems({ brand_id: "B1", store_id: "S1", accessToken: "tok" })
    );
    expect(s.brand_id).toBe("B1");
    expect(s.store_id).toBe("S1");
    expect(s.authToken).toBe("tok");
  });

  test("setAuthItems ignores missing fields (partial update)", () => {
    let s = reducer(
      undefined,
      setAuthItems({ brand_id: "B1", store_id: "S1", accessToken: "tok" })
    );
    s = reducer(s, setAuthItems({ accessToken: "tok2" }));
    expect(s.brand_id).toBe("B1"); // preserved
    expect(s.store_id).toBe("S1"); // preserved
    expect(s.authToken).toBe("tok2"); // updated
  });

  test("setAuthItems falsy values do NOT overwrite (known behavior)", () => {
    // Implementation uses truthy check; null/empty string are skipped.
    let s = reducer(
      undefined,
      setAuthItems({ brand_id: "B1", store_id: "S1", accessToken: "tok" })
    );
    s = reducer(s, setAuthItems({ brand_id: null, store_id: "", accessToken: undefined }));
    expect(s.brand_id).toBe("B1");
    expect(s.store_id).toBe("S1");
    expect(s.authToken).toBe("tok");
  });

  test("setThemeApplied toggles isThemeApplied — Footer skeleton gate", () => {
    let s = reducer(undefined, setThemeApplied(true));
    expect(s.isThemeApplied).toBe(true);
    s = reducer(s, setThemeApplied(false));
    expect(s.isThemeApplied).toBe(false);
  });

  test("setError clears isInitialized and stores error message", () => {
    let s = reducer(undefined, setProjectDetails({ editorDetails: { cart_order_id: "p1" }, cartDetails: { brand_id: "B1" } }));
    s = { ...s, isInitialized: true };
    s = reducer(s, setError("Authentication failed"));
    expect(s.error).toBe("Authentication failed");
    expect(s.isInitialized).toBe(false);
  });

  test("resetProject wipes auth fields back to null", () => {
    let s = reducer(
      undefined,
      setAuthItems({ brand_id: "B1", store_id: "S1", accessToken: "tok" })
    );
    s = reducer(s, resetProject());
    expect(s.brand_id).toBeNull();
    expect(s.store_id).toBeNull();
    expect(s.authToken).toBeNull();
    expect(s.userDetails).toBeNull();
    expect(s.isThemeApplied).toBe(false);
  });

  test("setProjectDetails does NOT touch authToken or store_id (auth is separate)", () => {
    let s = reducer(
      undefined,
      setAuthItems({ brand_id: "OLD", store_id: "S1", accessToken: "tok" })
    );
    s = reducer(
      s,
      setProjectDetails({
        editorDetails: { cart_order_id: "p1" },
        cartDetails: { brand_id: "NEW" },
      })
    );
    // brand_id gets overwritten by cartDetails, but store_id + authToken preserved
    expect(s.brand_id).toBe("NEW");
    expect(s.store_id).toBe("S1");
    expect(s.authToken).toBe("tok");
  });
});
