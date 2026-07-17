# Production Readiness Issues — `changes_related_to_fixes` Branch

> **Audit scope:** 141 files changed, 29,524 insertions, 5,787 deletions vs `main`.
> **Audit date:** 2026-04-15
> **Total issues:** 15 CRITICAL, 25 HIGH, 12 MEDIUM

This document lists every production risk identified in the branch diff, with root cause, impact, and concrete fix.

---

## How to use this file

- **CRITICAL** — must fix before merge to prod. Blocks ship.
- **HIGH** — strongly recommend fixing; monitor closely if deferred.
- **MEDIUM** — acceptable risk if monitored; schedule follow-up.
- Each issue has: `ID`, `file:line`, root cause, impact, fix.

---

# 🚨 CRITICAL — Must fix before prod

---

## C-01 — Google OAuth `CLIENT_SECRET` hardcoded in browser code

**File:** `src/tools/photos/googlePhotosPickerUtils.js:9`
**Category:** Security

### Root cause
`CLIENT_SECRET = "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"` is a string constant in the bundled JavaScript. Any user can extract it via DevTools → Sources, or via a download of the bundle.

### Impact
- Violates OAuth 2.0 spec (Section 2.1 — confidential clients only).
- Attacker can impersonate the app, revoke tokens, spam picker sessions against Google.
- Google may rotate/revoke the credential once reported, breaking uploads in prod until redeployed.

### Fix
1. Delete the constant from frontend.
2. Move OAuth code exchange (authorization_code → access_token) to backend endpoint (e.g., `POST /auth/google/exchange`).
3. Frontend sends only `{ code, code_verifier }`. Backend holds secret and calls Google token endpoint.
4. PKCE flow (code challenge/verifier at lines 81-99) stays client-side — that's fine and designed for public clients.

```js
// Frontend (new)
const { access_token } = await apiPost("/auth/google/exchange", {
  code,
  code_verifier: codeVerifier,
});
```

---

## C-02 — Blob URL memory leak in image uploads

**File:** `src/store/slices/imageUpload.js:22, 98-101`
**Category:** Memory

### Root cause
`startUpload` reducer calls `URL.createObjectURL(file)` to create `previewUrl` for thumbnail display. `removeImage` action deletes Redux entry but never calls `URL.revokeObjectURL(previewUrl)`.

### Impact
- ~10-100 KB of DOM memory retained per image, forever.
- Batch upload of 50+ images leaks tens of MB. Tab memory grows until refresh.
- Mobile devices with tight memory budgets (iOS Safari) may crash on large batches.

### Fix
```js
// src/store/slices/imageUpload.js
removeImage: (state, action) => {
  const img = state.images.find(i => i.imageId === action.payload);
  if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
  state.images = state.images.filter(i => i.imageId !== action.payload);
},
// Also revoke in uploadSuccess after server URL replaces preview:
uploadSuccess: (state, action) => {
  const img = state.images.find(i => i.imageId === action.payload.imageId);
  if (img?.previewUrl) {
    URL.revokeObjectURL(img.previewUrl);
    img.previewUrl = null;
  }
  // ... existing logic
},
```

---

## C-03 — Redux ↔ localStorage auth mismatch causes 401 infinite loop

**Files:** `src/layout/pages/LoginPage.jsx`, `src/library/utils/common-services/apiCall.js`, `src/components/popups/SessionExpiredModal.jsx`
**Category:** Auth

### Root cause
- `LoginPage` dispatches `setAuthItems({ brand_id, store_id, accessToken })` to Redux after successful login.
- `apiCall.js` reads user details via `getUserDetails()` which reads from **localStorage**, not Redux.
- If Redux→localStorage sync fails or is skipped, API calls miss `x-user-id` header → 401 → interceptor fires `SessionExpiredModal` → `reloadWithNewToken()` → full page reload → auth state reset → login again → loop.

### Impact
User can get trapped in login → session-expired → login cycle. Looks like app is broken.

### Fix
1. In `LoginPage.jsx` after successful auth, always write to BOTH Redux and localStorage atomically:
```js
const user = { userTypeCode, brand_id, _id, store_id, token: accessToken };
localStorage.setItem("userDetails", JSON.stringify(user));
dispatch(setAuthItems({ brand_id, store_id, accessToken }));
dispatch(setUserDetails(user));
```
2. In `apiCall.js` session-expired interceptor, de-dupe modal triggers:
```js
let sessionExpiredFired = false;
axios.interceptors.response.use(null, (err) => {
  if (err.response?.status === 401 && !sessionExpiredFired) {
    sessionExpiredFired = true;
    onSessionExpiredCallback?.();
    setTimeout(() => { sessionExpiredFired = false; }, 2000);
  }
  return Promise.reject(err);
});
```

---

## C-04 — 14 new API endpoints may not exist on prod backend

**File:** `src/library/utils/constants/apiurl.js`
**Category:** API / Deployment

### Root cause
New endpoints added without verifying backend deployment:
- `authLogin`, `verifyOTP` (auth)
- `uploadsInit`, `uploadsComplete`, `uploadsRefreshUrls` (chunked upload)
- 10+ asset management: `createEditorSetting`, `viewEditorSetting`, `updateEditorSetting`, `deleteEditorSetting`, `hideMaterial`, `enableMaterial`, `storeTags`, etc.

### Impact
If backend not deployed in lockstep: 404s silently swallowed by error handlers → asset management/chunked upload/auth features silently broken in prod.

### Fix
1. Before merge, ping each endpoint on staging+prod backend. Document which require deploy-in-sync.
2. Add fallback: if `uploadsInit` returns 404, log warning and fall through to legacy multipart upload (`uploadManager.js:418-445` already has partial fallback — verify complete).
3. Coordinate with backend team on deploy order.

---

## C-05 — `GetThemeById` now returns `null`; callers still expect array/object

**File:** `src/library/utils/services/theme/index.js`
**Category:** Crash risk

### Root cause
Old `processThemeResponseItems` returned `[]` on missing themes. New version returns `null` (line 42-44). Callers access `themeData.pages_c` without null-check.

### Impact
`Cannot read property 'pages_c' of null` → theme load crashes → editor stuck on skeleton → white screen.

### Fix
In every caller (`useThemeSetup.js`, `ThemesAction.jsx`, `Header.jsx`, `SizeSettingsPopup.jsx`, `PreviewPage.jsx`):
```js
const themeData = await GetThemeById(...);
if (!themeData) {
  // show error toast / stay on skeleton with error message
  dispatch(setThemeApplied(true));
  setError("Theme unavailable");
  return;
}
// proceed with themeData.pages_c
```

---

## C-06 — `serializableCheck: false` globally disables mutation safety

**File:** `src/store/store.jsx:115-118`
**Category:** Data integrity

### Root cause
```js
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({ serializableCheck: false }),
```
Redux Toolkit's built-in check that catches non-serializable payloads (Date, Function, Blob, promises) is disabled globally.

### Impact
- Non-JSON-safe data silently enters state. On rehydrate or `JSON.stringify`, data lost without warning.
- Bugs hidden until payment/export flow, where state is serialized.

### Fix
Re-enable with targeted exceptions only where needed:
```js
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: [
        "imageUpload/startUpload", // File blob
        "imageUpload/setUploadError",
      ],
      ignoredPaths: ["imageUpload.images"], // has File refs
    },
  }),
```

---

## C-07 — `customUndoableCanvasReducer` forgets new `activeObjects` on undo

**File:** `src/store/store.jsx:71-102`
**Category:** Multi-select UX

### Root cause
Preserved UI state list (lines 77-87) includes `activeObject`, `activeObjectprops`, zoom, etc. — but not `activeObjects` (new multi-select array). After undo, `newState.present` is overwritten using this list → `activeObjects` reverts to whatever previous snapshot had.

### Impact
User multi-selects 3 objects → hits Ctrl+Z → selection collapses to single/none unexpectedly.

### Fix
Add `activeObjects`, `isMultiSelectMode`, `copiedObjects` to preserved list:
```js
const preservedUIState = {
  activeObject: newState.present.activeObject,
  activeObjectprops: newState.present.activeObjectprops,
  activeObjects: newState.present.activeObjects,      // NEW
  isMultiSelectMode: newState.present.isMultiSelectMode, // NEW
  // ... existing fields
};
```

---

## C-08 — History filter blocks `setActiveObject` & `setCurrentObjectProperties(null)`

**File:** `src/store/store.jsx:14-62`
**Category:** Undo behavior

### Root cause
New filter explicitly excludes:
- `canvas/setActiveObject`
- `canvas/setCurrentObjectProperties` with `payload === null` (line 54-58)

Old code recorded these. Anything that relied on undo after deselection now silently skips.

### Impact
User selects object → deselects by clicking empty canvas → Ctrl+Z does not restore selection state. Breaks existing UX.

### Fix
Document intent clearly. If intentional, add comment explaining why. If unintentional, revert:
```js
// Allow setCurrentObjectProperties(null) to be recorded so Ctrl+Z can
// restore the deselected object. Remove the explicit filter.
```

---

## C-09 — `clearHistory()` fires on EVERY `setupTheme` run

**File:** `src/library/utils/custom-hooks/useThemeSetup.js` (end of `setupTheme`, inside replacePages flow)
**Category:** Data loss

### Root cause
```js
dispatch(UndoActionCreators.clearHistory());
dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));
```
This runs every time `setupTheme` is called. `setupTheme` fires when `projectSetup` changes — which can happen for reasons other than theme switch (e.g., `setAllThemes` dispatch, mid-session).

### Impact
User's undo stack wiped mid-session. Can't undo their edits.

### Fix
Only clear history on genuine theme SWITCH, not every reapply:
```js
if (isThemeSwitch) {
  dispatch(UndoActionCreators.clearHistory());
  dispatch(recordThemeBaseline({ timestamp: Date.now(), history: false }));
}
```

---

## C-10 — DPI default changed `0 → 200` in `setCanvasSize` reducer

**File:** `src/store/slices/canvas.js:362-365`
**Category:** Data migration

### Root cause
```js
const incomingDpi = action.payload.dpi ?? prevCanvasSize.dpi;
state.canvasSize.dpi =
  incomingDpi && !isNaN(incomingDpi) && incomingDpi > 0
    ? Number(incomingDpi)
    : 200;
```
Previously, dpi=0 was preserved. Now any truthy check (`dpi > 0`) false triggers default 200.

### Impact
Any saved project with `dpi: 0` silently becomes `dpi: 200` on next `setCanvasSize` dispatch → exports at 2× resolution → oversized files → potential print/price mismatch.

### Fix
1. Audit prod DB: are there projects with `dpi: 0`? If yes, write migration.
2. Or: preserve 0 explicitly:
```js
state.canvasSize.dpi =
  incomingDpi != null && !isNaN(incomingDpi) && incomingDpi >= 0
    ? Number(incomingDpi)
    : 200;
```

---

## C-11 — `ItemDragger.onRenderGroup` uses `cssText +=` → duplicated transforms

**File:** `src/components/canvas/ItemDragger.jsx` (onRenderGroup handler)
**Category:** Rendering correctness

### Root cause
```js
e.target.style.cssText += e.transform; // appends each call
```
`onRenderGroup` fires frequently during drag/resize. Each call concatenates a new transform string → `transform: translate(10,20) translate(20,40) translate(30,60)` → exponential transform compounding.

### Impact
During group drag/resize, objects jump to wildly wrong positions after 2+ render frames. Visual corruption.

### Fix
```js
e.target.style.cssText = e.transform; // replace, not append
```

---

## C-12 — Group resize font scaling averages width+height

**File:** `src/components/canvas/ItemDragger.jsx` (onResizeGroup handler)
**Category:** Text distortion

### Root cause
```js
const scaleFactor = (widthScale + heightScale) / 2;
newFontSize = oldFontSize * scaleFactor;
```
If user resizes group to halve height but double width, average = 1.25 → font neither shrinks to match new height nor grows to match width. Text clips or overflows.

### Impact
Multi-line text in a resized group becomes unreadable or clipped.

### Fix
Match single-object behavior (`scaleLayout` uses `Math.max`):
```js
const scaleFactor = Math.max(widthScale, heightScale);
// Or min, depending on whether you prefer clip-safe or fit-safe
```

---

## C-13 — Multi-target DOM resolution silently drops missing targets

**File:** `src/components/canvas/ItemDragger.jsx` (useLayoutEffect for multi-select targets)
**Category:** Multi-select reliability

### Root cause
```js
const targets = activeObjects
  .map(id => document.querySelector(`g[data-id-t="${id}"]`))
  .filter(Boolean); // silently drops nulls
```
If any object ID doesn't have a rendered DOM node (render error, hidden, etc.), it's dropped with no warning. Moveable shows handles only for the subset that resolved.

### Impact
User selects 5 objects, sees only 3 drag handles. No error, no log. Group operations apply to partial set.

### Fix
```js
const nodes = activeObjects.map(id => ({
  id, node: document.querySelector(`g[data-id-t="${id}"]`)
}));
const missing = nodes.filter(n => !n.node);
if (missing.length) {
  console.warn("Multi-select: missing DOM nodes for", missing.map(n => n.id));
  // Optionally: dispatch cleanup of orphaned ids from activeObjects
}
const targets = nodes.filter(n => n.node).map(n => n.node);
```

---

## C-14 — `CustomCaret.jsx` null `getScreenCTM` fallback assumes uniform scale

**File:** `src/components/canvas/CustomCaret.jsx`
**Category:** Text editing correctness

### Root cause
`getScreenCTM()` returns null if the SVG element is detached. Fallback:
```js
const scale = containerRect.height / item.height;
```
Assumes uniform scale. Fails if parent SVG has rotation, skew, or perspective transform.

### Impact
Custom caret jumps to wrong position or vanishes when:
- Text object is inside a rotated group
- Browser triggers layout during transition (caret positioned mid-animation)
- Safari in some edge cases returns null CTM more often than Chrome

### Fix
```js
const ctm = el.getScreenCTM();
if (!ctm) {
  // Hide caret rather than render at wrong position
  setCaretVisible(false);
  return;
}
// proceed with full matrix math
```

---

## C-15 — Arrow-key text navigation doesn't `preventDefault` on Ctrl/Meta

**File:** `src/components/canvas/Text.jsx` (handleKeyDown for ArrowUp/ArrowDown)
**Category:** Text editing correctness

### Root cause
Handler early-returns without `preventDefault` when Ctrl/Meta is held → browser also handles arrow → caret moves twice (custom + native).

### Impact
User holds Ctrl+Up to jump to start of text → caret jumps 2 lines up or to wrong position.

### Fix
```js
handleKeyDown = (e) => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault(); // ALWAYS prevent, even for modifier combos
  if (e.ctrlKey || e.metaKey) {
    // do Ctrl-specific handling here
    return;
  }
  // normal arrow handling
};
```

---

# ⚠️ HIGH — Strongly recommend fixing

---

## H-01 — `useInitializeProject` throws without useEffect `.catch()`

**File:** `src/library/utils/custom-hooks/useInitializeProject.js`
**Category:** Error handling

### Root cause
Refactor removed `dispatch(setError(...))` and replaced with `throw new Error(...)`. useEffect doesn't `.catch()` the promise rejection.

### Impact
On token validation failure / invalid response: unhandled promise rejection → no UI feedback → user sees blank MainLayout.

### Fix
```js
useEffect(() => {
  initializeProject().catch((err) => {
    console.error("Init failed:", err);
    dispatch(setError(err.message));
    setErrorState(err.message);
    setLoading(false);
  });
}, [location.search]);
```

---

## H-02 — `!Array.isArray(response.items)` rejects empty arrays

**File:** `src/library/utils/custom-hooks/useInitializeProject.js`
**Category:** API compatibility

### Root cause
```js
if (response && response.items && !Array.isArray(response.items)) {
  // proceed
} else {
  throw new Error("Failed to load user details");
}
```
Old code accepted empty arrays. New code throws. If backend ever returns `items: []` for a valid empty-list case, user sees error.

### Fix
```js
if (response?.items && typeof response.items === "object" && !Array.isArray(response.items)) {
  // valid object response
} else if (Array.isArray(response?.items)) {
  // empty or list response — handle gracefully, don't throw
  return;
}
```

---

## H-03 — Upload concurrency dedup bug

**File:** `src/store/background-services/imageUploadThunks.js:26-50`
**Category:** Upload reliability

### Root cause
`startUpload` dedups by `imageId`. If user clicks "Upload" twice rapidly, same file produces same UUID at close timestamps → collision.

### Fix
Namespace imageId with batchId:
```js
const imageId = `${batchId}_${uuidv4()}`;
```

---

## H-04 — Signed URL expiry not proactively checked

**File:** `src/library/utils/upload/uploadManager.js:244-330`
**Category:** Upload reliability

### Root cause
`uploadsInit` returns S3 signed URLs valid ~1 hour. If init took 30s + queue stalls 40min, URLs may expire before variant upload → 403.

### Fix
1. Backend returns `expires_at`.
2. Before each variant upload, check:
```js
if (Date.now() > variantData.expires_at - 5 * 60 * 1000) {
  await refreshUrls(variantData.upload_id);
}
```

---

## H-05 — EXIF orientation heuristic fails for some cameras

**File:** `src/library/utils/upload/imageResizer.js:115-122`
**Category:** Image correctness

### Root cause
```js
const effectiveOrientation =
  orientation >= 5 && orientation <= 8 && rawW <= rawH ? 1 : orientation;
```
Assumes: if raw pixels are portrait but EXIF says "rotate", rotation was baked in. Fails for cameras that store unrotated landscape JPEG with portrait EXIF tag.

### Fix
Test with sample images from: iPhone (all orientations), Samsung Galaxy, DSLR raw exports, screenshots. If heuristic fails, unconditionally re-encode using EXIF orientation.

---

## H-06 — `OffscreenCanvas` fallback blocks main thread

**File:** `src/library/utils/upload/imageResizer.js:145-154`
**Category:** Performance

### Root cause
If `OffscreenCanvas` unavailable (Safari < 16.4), falls back to `document.createElement("canvas")` → runs on main thread → 2-5s UI block for 10+ MB images.

### Fix
1. Feature-detect and show progress indicator during resize.
2. Reject files > 8 MP client-side with clear message.
3. Or use `createImageBitmap` + transfer to Web Worker (even without OffscreenCanvas).

---

## H-07 — `Photo.isPointerDraggingRef` not cleared on deselect

**File:** `src/components/canvas/Photo.jsx`
**Category:** Drag state leak

### Root cause
Ref set true on pointer down, not cleared when `isActive` flips false. Next click on another photo inherits `true`.

### Fix
```js
useEffect(() => {
  if (!isActive) {
    isPointerDraggingRef.current = false;
  }
}, [isActive]);
```

---

## H-08 — Firefox text height fix accumulates unbounded

**File:** `src/components/canvas/Text.jsx`
**Category:** Firefox text growth

### Root cause
`scrollHeight` includes padding. Each edit: new measured height = visible + padding. Dispatches new height. Next edit: measures that + padding again. Height grows slowly each edit.

### Fix
Subtract padding:
```js
const measured = textContentRef.current.scrollHeight - paddingTop - paddingBottom;
```
Or cap growth:
```js
if (Math.abs(measured - item.height) < 2) return; // threshold
if (measured > item.height * 2) return; // sanity cap
```

---

## H-09 — Text `autoFocus` flag loops on undo

**File:** `src/components/canvas/Text.jsx`
**Category:** Text UX

### Root cause
Clearing `autoFocus: false` via Redux dispatch (even with `history: false`) doesn't reliably prevent undo from restoring `autoFocus: true`.

### Fix
Track auto-activation in a ref/local state, not Redux:
```js
const autoFocusedRef = useRef(new Set());
useEffect(() => {
  if (item.autoFocus && !autoFocusedRef.current.has(item.id)) {
    autoFocusedRef.current.add(item.id);
    enterEditMode();
  }
}, [item.autoFocus, item.id]);
```

---

## H-10 — `onDrag` / `onResizeEnd` not memoized, stale closures

**File:** `src/components/canvas/ItemDragger.jsx`
**Category:** Drag correctness

### Root cause
Handlers redefined every render. If fires during re-render, may capture stale `getActiveCanvasObjProps`. If object was deleted, crash.

### Fix
Wrap in `useCallback`:
```js
const onDrag = useCallback((e) => {
  if (!getActiveCanvasObjProps) return;
  // ...
}, [getActiveCanvasObjProps, isDragger]);
```

---

## H-11 — Backward-compat: new fields undefined in old persisted state

**Files:** `src/store/slices/canvas.js`, `projectSetup.js`, `appAlice.js`, `imageUpload.js`
**Category:** Migration

### Root cause
New fields: `activeObjects`, `copiedObjects`, `weeksColumns`, `hideLastCover`, `exportSpine`, `store_id`, `authToken`, `isMultiSelectMode`, `statusText`, `uploadUrls`, etc.

Redux initialState has defaults, but existing saved-project JSON does not.

### Fix
Add migration in the slice reducers that load saved state:
```js
setProjectDetails: (state, action) => {
  const defaults = {
    weeksColumns: 1,
    hideLastCover: false,
    exportSpine: false,
    // ... etc
  };
  state.settings = { ...defaults, ...(editorDetails?.settings ?? {}) };
},
```

---

## H-12 — `ensureFullCoverLayout1` auto-creates `layout[1]` on rehydrate

**File:** `src/store/slices/canvas.js`
**Category:** Data integrity

### Root cause
Hydration of photobook cover page that was saved with only `layout[0]` (single-sided) silently gets a blank `layout[1]` injected.

### Fix
Only auto-create when the editor type explicitly requires two-sided cover (LAYFLATALBUM with coverEnabled etc.). Guard against silently modifying saved state.

---

## H-13 — `recomputeSpineAndShiftCoverObjects` order-sensitive

**File:** `src/store/slices/canvas.js:273-323`
**Category:** Reducer correctness

### Root cause
Mutates `state.settings.spineWidth` at line 300, then reads `state.canvasSize.width` at line 304. If another concurrent mutation changes canvasSize, inconsistent state.

### Fix
Capture `canvasSize.width` to local var BEFORE mutating spineWidth:
```js
const canvasW = state.canvasSize.width;
state.settings.spineWidth = nextSpineWidth;
// use canvasW everywhere below
```

---

## H-14 — No 403 handling in session expiry flow

**File:** `src/library/utils/common-services/apiCall.js`
**Category:** Auth

### Root cause
Only `status === 401` triggers SessionExpiredModal. 403 (permission denied) is silently swallowed.

### Fix
```js
if (err.response?.status === 401) {
  onSessionExpiredCallback?.();
} else if (err.response?.status === 403) {
  toast.error("You don't have permission for this action.");
}
```

---

## H-15 — Multi-select mode auto-exit spams dispatches

**File:** `src/components/canvas/Canvas.jsx`
**Category:** Performance

### Root cause
useEffect with deps `[activeObjects.length, isMultiSelectMode]` dispatches `setIsMultiSelectMode(false)` when length=0. Fires every time activeObjects array reference changes — even if length stays 0.

### Fix
Guard:
```js
useEffect(() => {
  if (activeObjects.length === 0 && isMultiSelectMode) {
    dispatch(setIsMultiSelectMode(false));
  }
}, [activeObjects.length, isMultiSelectMode]);
```

---

## H-16 — Marquee AABB collision ignores rotation

**File:** `src/components/canvas/Canvas.jsx`
**Category:** Selection UX

### Root cause
Collision uses axis-aligned bounding box. Rotated objects' visual extent differs from their stored x/y/width/height.

### Fix
Either:
1. Accept limitation and document it.
2. Compute OBB (oriented bounding box) using rotation matrix:
```js
const hit = obbIntersects(selectionRect, obj.transform);
```

---

## H-17 — Touch long-press closure captures stale `setCurrentTarget`

**File:** `src/components/canvas/Canvas.jsx`
**Category:** Mobile interaction

### Root cause
`handleObjectTouchEnd` useCallback has `[]` deps → captures initial `setCurrentTarget` which is redefined every render.

### Fix
```js
const handleObjectTouchEnd = useCallback((e) => {
  // ...
}, [setCurrentTarget, dispatch]);
```

---

## H-18 — Spine offset calc unguarded `billablePages`

**File:** `src/components/canvas/Canvas.jsx`
**Category:** Rendering crash

### Root cause
```js
const sw = Math.ceil(billablePages / 2) * settings?.paperThickness;
```
If `billablePages` is `undefined` → NaN → transform string breaks.

### Fix
```js
const sw = Math.ceil((billablePages ?? 0) / 2) * (Number(settings?.paperThickness) || 0);
```

---

## H-19 — Undo baseline for new multi-select actions unclear

**File:** `src/store/slices/canvas.js`
**Category:** Undo behavior

### Root cause
New actions `updateMultipleObjects`, `selectAllObjects`, `removeMultipleObjectsInPage` require explicit `history: true/false` opt-in. Inconsistent with existing actions.

### Fix
Document expected `history` flag for each. Add tests.

---

## H-20 — Asset management endpoints visibility

**File:** `src/library/utils/constants/apiurl.js` + `src/tools/assets/*.jsx`
**Category:** Feature completeness

### Root cause
10+ asset mgmt endpoints added. Multiple new UI files. Unclear if feature is fully wired vs. partial.

### Fix
Verify end-to-end: create asset → list → view → edit → delete → tag flows work on staging.

---

## H-21 — `CreateThemeDialog` large changes

**File:** `src/components/popups/CreateThemeDialog.jsx` (192 line diff)
**Category:** Admin flow

### Root cause
Theme creation dialog heavily refactored. Admin feature — failure impacts theme authoring.

### Fix
Regression test: create theme from scratch → save → reload → verify pages + settings persist.

---

## H-22 — Footer (`src/layout/Footer.jsx`) layout fetch deps

**File:** `src/layout/Footer.jsx:169`
**Category:** Performance

### Root cause
Effect with `[canvasSize]` fetches layouts. Now fires faster due to removed setTimeouts.

### Fix
Ensure fetch is deduped / aborted on rapid canvasSize changes. Add AbortController.

---

## H-23 — `imageUploadThunks` concurrency=4 vs 7

**File:** `src/store/background-services/imageUploadThunks.js`
**Category:** Upload tuning

### Root cause
Commit history shows "thunk limit increased from 4 to 7". Verify current value — check if `MAX_CONCURRENT_UPLOADS` matches backend rate limit.

### Fix
Align with backend throttling spec.

---

## H-24 — Photobook cover page data mutation on reload

**File:** `src/store/slices/canvas.js` (applyTheme + cover sync logic)
**Category:** Data integrity

### Root cause
`applyTheme` auto-sets `state.settings.coverEnabled = true` if pages contain cover pages — but never sets `false`. Stale `coverEnabled: true` persists across theme switches with non-cover themes.

### Fix
Set explicitly in both directions:
```js
state.settings.coverEnabled = hasCoverPages;
state.settings.showFullCoverSheet = isFullCoverSheet;
```

---

## H-25 — Blob slice memory on chunked uploads

**File:** `src/library/utils/upload/uploadManager.js:156`
**Category:** Mobile memory

### Root cause
3 × 5MB = 15MB live chunks on mobile. OK on desktop, tight on low-end Android.

### Fix
Detect low-end device; reduce `MAX_CONCURRENT_CHUNKS` dynamically.

---

# 📋 MEDIUM — Monitor / test before ship

---

## M-01 — Multi-select toolbar position updates not debounced

**File:** `src/components/canvas/ItemDragger.jsx`
**Fix:** Wrap `updateMultiSelectToolbarPosition` in RAF debounce.

---

## M-02 — Fallback upload response shape mismatch

**File:** `src/library/utils/upload/uploadManager.js:418-445`
**Fix:** Normalize legacy response to new shape before resolving.

---

## M-03 — Popup blocker silent failure

**File:** `src/tools/photos/ImportPhoto.jsx:308-311`
**Fix:** On `!popupRef.current`, show toast "Enable popups for photo import".

---

## M-04 — OTP timeout not enforced client-side

**File:** `src/layout/pages/LoginPage.jsx`
**Fix:** Local timer 10 min, expire OTP UI state.

---

## M-05 — Calendar `weeksColumns` fallback duplicated 3x

**Files:** `useInitializeProject.js`, `useThemeSetup.js` (2 spots)
**Fix:** Extract `deriveWeeksColumns(pages, fallback)` helper.

---

## M-06 — Progress state shape change (`statusText`, `uploadUrls`)

**File:** `src/store/slices/imageUpload.js`
**Fix:** Audit all consumers; add CHANGELOG note; optional-chain access.

---

## M-07 — Action rename `setSpreadPageLayout → setEntireSpreadLayout`

**File:** `src/store/slices/canvas.js`
**Fix:** Verify no external callers use old name. Add alias if risky.

---

## M-08 — Theme `orientation` fallback silent

**File:** `src/library/utils/services/theme/index.js`
**Fix:** Log warn when fallback-to-theme[0] triggers.

---

## M-09 — `localStorage` key collisions across tabs

**File:** `src/layout/pages/LoginPage.jsx` + `useThemeSetup.js`
**Fix:** Namespace with brand_id or session id.

---

## M-10 — Rich text `innerHTML` set without sanitization

**File:** `src/components/canvas/Text.jsx`
**Fix:** Add DOMPurify if richText ever comes from network.

---

## M-11 — Wheel zoom session tracking on trackpad pinch

**File:** `src/components/canvas/Canvas.jsx`
**Fix:** Detect pinch vs wheel-zoom via `e.ctrlKey`; separate session refs.

---

## M-12 — Double-tap timing hardcoded 350ms

**File:** `src/components/canvas/Text.jsx`
**Fix:** Use OS-preferred interval or leave as-is (acceptable).

---

# Pre-Ship Fix Order (Priority)

Execute **C-01 → C-15** before merge. Then triage HIGH list. MEDIUM can be follow-up tickets.

1. **C-01** Move Google CLIENT_SECRET to backend
2. **C-02** Add `URL.revokeObjectURL` in imageUpload
3. **C-03** Sync Redux setAuthItems → localStorage
4. **C-04** Verify 14 new endpoints on prod backend
5. **C-05** Null-check `GetThemeById` returns in all callers
6. **C-06** Re-enable `serializableCheck` with targeted ignores
7. **C-07** Preserve `activeObjects` in undoable reducer
8. **C-08** Reconsider history filter exclusions
9. **C-09** Guard `clearHistory` — only on theme switch
10. **C-10** Audit/migrate prod projects with `dpi: 0`
11. **C-11** Fix `cssText +=` → `cssText =`
12. **C-12** Change group font scaling to `Math.max`
13. **C-13** Warn on missing multi-select DOM nodes
14. **C-14** Hide CustomCaret when CTM null
15. **C-15** Always `preventDefault` on arrow keys

Then **H-01 → H-25** per team capacity.

---

# Test Plan (post-fix)

- [ ] Login → logout → login flow no loops
- [ ] Batch upload 50+ images → tab memory stable
- [ ] Google Photos picker with popup blocker — clean error
- [ ] Switch theme → dims + margins + shape + spine all update
- [ ] Customer with saved project — shape persists across reload
- [ ] Admin URL-load theme (`?t_id=`) — no 401 loop
- [ ] Multi-select 3 objects → Ctrl+Z → selection preserved
- [ ] Group resize with text → no distortion
- [ ] Marquee drag with rotated object → document behavior
- [ ] Firefox text editing → height stable across edits
- [ ] Safari text editing → caret visible at line boundaries
- [ ] Export existing project with `dpi: 0` — verify correct scale
- [ ] Photobook cover page with `layout[0]` only — no auto-created `layout[1]`
- [ ] Undo theme switch — check undo stack not cleared for edits made after

---

_End of ISSUES.md_
