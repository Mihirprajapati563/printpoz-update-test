/**
 * The canvas must SETTLE on the full-res `large` variant (product decision
 * 2026-07-16). small/medium are first-paint rungs only — if the ladder ever
 * rests on one again, the canvas looks blurry and these tests fail.
 */
import { renderHook, waitFor } from "@testing-library/react";
import {
  useProgressiveImage,
  pickVariantUrl,
  resetImageLoadState,
} from "../progressiveImage";

// Babel compiles the `isDesktop` import to a live property access, so a getter
// lets each test flip the platform without re-requiring the module (re-requiring
// under isolateModules loads a SECOND React copy → "null.useState").
let mockIsDesktop = false;
jest.mock("../../../../desktop", () => ({
  get isDesktop() {
    return mockIsDesktop;
  },
}));

const LARGE = "https://cdn.test/photo-large.jpg";
const MEDIUM = "https://cdn.test/photo-medium.jpg";
const SMALL = "https://cdn.test/photo-small.jpg";

const item = {
  url: LARGE,
  urls: [
    { size: "small", url: SMALL },
    { size: "medium", url: MEDIUM },
    { size: "large", url: LARGE },
  ],
};

// jsdom never fires load events for real URLs — resolve every decode immediately.
class MockImage {
  set src(v) {
    this._src = v;
    setTimeout(() => this.onload && this.onload(), 0);
  }
  get src() {
    return this._src;
  }
}

describe("useProgressiveImage — always settles at `large`", () => {
  beforeEach(() => {
    global.Image = MockImage;
    mockIsDesktop = false;
    resetImageLoadState();
  });

  test("web: climbs the ladder and ends on large", async () => {
    const { result } = renderHook(() => useProgressiveImage(item));

    // Never blanks — something is painted from the very first frame.
    expect(result.current).toBeTruthy();

    await waitFor(() => expect(result.current).toBe(LARGE), { timeout: 3000 });
  });

  test("web: a cover-fit (un-zoomed) image still reaches large", async () => {
    // Regression guard: `large` used to load ONLY when zoomed past cover-fit, so a
    // normally-placed photo rested on `medium` forever. There is no zoom input now.
    const { result } = renderHook(() => useProgressiveImage(item));
    await waitFor(() => expect(result.current).toBe(LARGE), { timeout: 3000 });
    expect(result.current).not.toBe(MEDIUM);
    expect(result.current).not.toBe(SMALL);
  });

  test("desktop: picks large synchronously (local files, no ladder)", () => {
    mockIsDesktop = true;
    const { result } = renderHook(() => useProgressiveImage(item));
    expect(result.current).toBe(LARGE);
  });

  test("desktop reference-mode (small + large only, no medium) uses large, not small", () => {
    // Reference-mode assets carry ONLY small + large. This is the case that
    // displayed a low-res thumbnail when the lookup fell through to `medium`.
    mockIsDesktop = true;
    const refItem = {
      url: LARGE,
      urls: [
        { size: "small", url: SMALL },
        { size: "large", url: LARGE },
      ],
    };
    const { result } = renderHook(() => useProgressiveImage(refItem));
    expect(result.current).toBe(LARGE);
  });
});

describe("pickVariantUrl", () => {
  test("falls back through the requested order and never returns empty", () => {
    expect(pickVariantUrl(item, ["large", "medium"])).toBe(LARGE);
    expect(pickVariantUrl(item, ["small"])).toBe(SMALL);
    // Requested size missing → falls through to any available url.
    expect(pickVariantUrl({ urls: [{ size: "small", url: SMALL }] }, ["large"])).toBe(SMALL);
    // No urls array → the object's own live url.
    expect(pickVariantUrl({ url: LARGE }, ["large"])).toBe(LARGE);
  });
});
