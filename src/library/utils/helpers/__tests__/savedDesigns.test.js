// savedDesigns — Saved Designs library behavior for designs that have NOT been
// saved to the API yet (local-only identity), plus the re-key that happens when
// they later gain a server id. Runs on the legacy localStorage path: jsdom has
// no IndexedDB, and the desktop bridge is absent, so that fallback is what's
// exercised here (the id/guard logic under test is shared by all three paths).

// common-functions/index.js (compressData) transitively pulls generatePageSvg →
// commonJSON → PhotosAction → canvas.js, a module cycle jest's load order can't
// resolve (webpack's entry order happens to). Cut the chain — nothing here
// renders SVG.
jest.mock("../../common-functions/generatePageSvg.js", () => ({
  generatePageSvg: () => "",
}));

import {
  deriveDesignId,
  saveDesignToLibrary,
  listSavedDesigns,
  getDesignById,
  ensureActiveLocalDesignId,
  peekActiveLocalDesignId,
  adoptActiveLocalDesignId,
  resetActiveLocalDesignId,
} from "../savedDesigns.js";

// A brand-new theme's pages carry NO layout yet (resetEditor / seeded photobook
// pages) — exactly the shape the Create Theme dialog stores with allowEmpty.
const blankPages = [
  { id: "p1", pageNumber: 1, title: "1", bgColor: "#fff", layout: [] },
];

const contentPages = [
  {
    id: "p1",
    pageNumber: 1,
    title: "1",
    bgColor: "#fff",
    layout: [
      {
        width: 2400,
        height: 1600,
        objects: [{ id: "o1", type: "text", content: "hi" }],
        safeAreaObjects: [],
      },
    ],
  },
];

const designState = (id, overrides = {}) => ({
  id,
  pages: blankPages,
  canvasSize: { width: 2400, height: 1600 },
  editorType: "print",
  themeId: null,
  themeName: "My Offline Theme",
  cartOrderId: null,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  resetActiveLocalDesignId();
});

describe("deriveDesignId", () => {
  it("prefers cart, then theme+size, then local id", () => {
    const canvasSize = { width: 2400, height: 1600 };
    expect(
      deriveDesignId({ cartOrderId: "c1", themeId: "t1", localId: "l1", canvasSize })
    ).toBe("cart:c1");
    expect(deriveDesignId({ themeId: "t1", localId: "l1", canvasSize })).toBe(
      "theme:t1:2400x1600"
    );
    expect(deriveDesignId({ localId: "l1", canvasSize })).toBe("local:l1");
    expect(deriveDesignId({})).toBe(null);
  });
});

describe("active local design id lifecycle", () => {
  it("mints a stable id, adopts a restored one, and resets", () => {
    expect(peekActiveLocalDesignId()).toBe(null);
    const minted = ensureActiveLocalDesignId();
    expect(minted).toBeTruthy();
    expect(ensureActiveLocalDesignId()).toBe(minted); // stable within a session
    adoptActiveLocalDesignId("restored123");
    expect(ensureActiveLocalDesignId()).toBe("restored123");
    resetActiveLocalDesignId();
    expect(peekActiveLocalDesignId()).toBe(null);
  });
});

describe("saveDesignToLibrary — local-only designs", () => {
  it("skips a blank design on the auto-save path (no junk entries)", async () => {
    const saved = await saveDesignToLibrary(designState("local:l1"));
    expect(saved).toBe(null);
    expect(await listSavedDesigns()).toHaveLength(0);
  });

  it("skips a NEW-design shape (a layout present but no objects) on the auto-save path", async () => {
    // The New Design / New Theme dialogs seed one empty layout: `layout: [{ objects: [] }]`.
    // That must NOT count as content (else every 'New Design' makes a blank card).
    const emptyLayoutPages = [
      {
        id: "p1",
        pageNumber: 1,
        title: "1",
        bgColor: "#fff",
        layout: [{ width: 2400, height: 1600, objects: [], safeAreaObjects: [] }],
      },
    ];
    const saved = await saveDesignToLibrary(
      designState("local:l1", { pages: emptyLayoutPages })
    );
    expect(saved).toBe(null);
    expect(await listSavedDesigns()).toHaveLength(0);
  });

  it("stores a just-created blank theme with allowEmpty (explicit creation)", async () => {
    const saved = await saveDesignToLibrary(designState("local:l1"), {
      allowEmpty: true,
    });
    expect(saved).toBe("local:l1");
    const list = await listSavedDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("local:l1");
    expect(list[0].name).toBe("My Offline Theme");

    // And it is fully restorable (pages round-trip through compression).
    const entry = await getDesignById("local:l1");
    expect(entry).not.toBe(null);
    expect(entry.pages).toEqual(blankPages);
    expect(entry.themeId).toBe(null);
  });

  it("updates the SAME entry on subsequent saves (no duplicates)", async () => {
    await saveDesignToLibrary(designState("local:l1"), { allowEmpty: true });
    await saveDesignToLibrary(
      designState("local:l1", { pages: contentPages, themeName: "Renamed" })
    );
    const list = await listSavedDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Renamed");
  });
});

describe("saveDesignToLibrary — gaining a server identity", () => {
  it("re-keys the entry and removes the superseded local one", async () => {
    await saveDesignToLibrary(designState("local:l1"), { allowEmpty: true });

    // The design is saved to the API → next auto-save runs under the theme id
    // and supersedes the local entry.
    const saved = await saveDesignToLibrary(
      designState("theme:t9:2400x1600", { pages: contentPages, themeId: "t9" }),
      { supersedesId: "local:l1" }
    );
    expect(saved).toBe("theme:t9:2400x1600");

    const list = await listSavedDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("theme:t9:2400x1600");
  });

  it("retires the session's local id when its entry is superseded", async () => {
    adoptActiveLocalDesignId("l1");
    await saveDesignToLibrary(designState("local:l1"), { allowEmpty: true });
    await saveDesignToLibrary(
      designState("theme:t9:2400x1600", { pages: contentPages, themeId: "t9" }),
      { supersedesId: "local:l1" }
    );
    expect(peekActiveLocalDesignId()).toBe(null);
  });

  it("does NOT remove anything when the save itself is skipped", async () => {
    await saveDesignToLibrary(designState("local:l1"), { allowEmpty: true });
    // Blank pages + no allowEmpty → save skipped → supersede must not run.
    const saved = await saveDesignToLibrary(
      designState("theme:t9:2400x1600", { themeId: "t9" }),
      { supersedesId: "local:l1" }
    );
    expect(saved).toBe(null);
    const list = await listSavedDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("local:l1");
  });
});

describe("per-account isolation", () => {
  // USER_TYPES: CUSTOMER = 6 (regular user), ADMIN = 3 (admin-like).
  const login = (id, userTypeCode) =>
    localStorage.setItem("userDetails", JSON.stringify({ _id: id, userTypeCode }));

  const themeState = (id) =>
    designState(id, { pages: contentPages, themeId: "t1" });

  it("scopes the derived id to the logged-in account", () => {
    login("userA", 6);
    expect(
      deriveDesignId({ themeId: "t1", canvasSize: { width: 100, height: 100 } })
    ).toBe("acct:userA|theme:t1:100x100");
    expect(deriveDesignId({ localId: "l1" })).toBe("acct:userA|local:l1");
  });

  it("shows each account only its OWN designs (no cross-account leak)", async () => {
    const size = { width: 2400, height: 1600 };

    // User A saves a design off theme t1.
    login("userA", 6);
    const idA = deriveDesignId({ themeId: "t1", canvasSize: size });
    await saveDesignToLibrary(themeState(idA));
    expect(await listSavedDesigns()).toHaveLength(1);

    // User B on the SAME device sees NONE of A's designs, and editing the SAME
    // theme creates a SEPARATE entry (distinct id → no overwrite of A's work).
    login("userB", 6);
    expect(await listSavedDesigns()).toHaveLength(0);
    const idB = deriveDesignId({ themeId: "t1", canvasSize: size });
    expect(idB).not.toBe(idA);
    await saveDesignToLibrary(themeState(idB));
    const listB = await listSavedDesigns();
    expect(listB).toHaveLength(1);
    expect(listB[0].id).toBe(idB);

    // A still sees exactly their own entry, unaffected by B.
    login("userA", 6);
    const listA = await listSavedDesigns();
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(idA);
  });

  it("hides legacy (unscoped) designs from regular users, keeps them for admins", async () => {
    // An entry saved before isolation existed (no account context → no scope).
    await saveDesignToLibrary(themeState("theme:legacy:2400x1600"));

    login("userA", 6); // regular user
    expect(await listSavedDesigns()).toHaveLength(0);

    login("admin1", 3); // admin-like
    const list = await listSavedDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("theme:legacy:2400x1600");
  });
});
