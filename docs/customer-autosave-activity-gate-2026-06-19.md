# Customer Auto-Save Activity Gate — Session Notes (2026-06-19)

> Scope: stop the **customer 30-second auto-save** from firing when the user hasn't actually changed anything. Opening a project (or just browsing/selecting objects) must NOT trigger a save; only a real content edit should. Implemented entirely in `src/layout/Header.jsx`; no API, store, or reducer changes.

---

## TL;DR

| Problem | Fix |
|---|---|
| The customer auto-save (30s `setInterval`, gated to `USER_TYPES.CUSTOMER`) fired **every 30s unconditionally** — even on a freshly-opened project with **zero edits**. No dirty/activity check existed. | Gate the tick on **`canvas.present.pages` reference change**. Capture a post-load baseline; skip the tick while live `pages` is the same reference; re-pin the baseline on each successful save. |
| The first idea — gate on "undo history grows" (`canvas.past`) — would have **still saved while just browsing**. | In this codebase `setActiveObject` and `setPageNumber` are **not** history-filtered and don't pass `history:false`, so **selecting an object / flipping a page grows `past`**. `present.pages` does **not** change on those, so it is the correct "real edit" signal. |
| When is "loaded" so the baseline isn't captured mid-load? | Capture when redux `projectSetup.isThemeApplied` flips true — the customer load path dispatches `setThemeApplied(true)` **after** `applyTheme` + page-qty adjustment, so `present.pages` is the settled, unedited state at that moment. |

---

## How it works — at a glance 🎯

**The signal is the raw `pages` array reference.** Immer gives a brand-new `state.canvas.present.pages` array **only** when an object/page/background is actually mutated. Selection, page navigation, zoom and dragger state mutate *other* `present` fields, leaving `pages` byte-for-byte the same reference. So "did `pages` change since the last save?" is exactly "did the user edit content?".

```
  ❌ BEFORE (every 30s tick)           ✅ AFTER (every 30s tick)
  tick → saveProject()                 tick → pages === lastSavedPages ?
     └─ POST /saveProject  (always)        ├─ yes → SKIP (no edit)
        even with no edits                 └─ no  → saveProject(); re-pin baseline
```

**Why not undo history (`canvas.past`)?** It's polluted. `store.jsx`'s `ignoredCanvasActions` has `setActiveObject` and `setPageNumber` **commented out**, and their dispatch sites don't pass `history:false` — so merely clicking an object or changing pages pushes a snapshot onto `past`. Gating on `past` would auto-save from pure browsing, which is the exact thing the user wanted to stop.

**Why not the whole `present` reference?** `present` gets a new reference on *every* canvas action (selection, zoom, dragger included) — that reintroduces the false-positive. `present.pages` is the narrowest field that means "content changed".

---

## The mechanism (3 touch-points in `Header.jsx`)

### 1. Two refs
```js
const lastSavedPagesRef = useRef(null);   // pages ref as of last save / baseline
const autoSaveBaselineSetRef = useRef(false); // capture the baseline exactly once
```

### 2. Baseline captured once, after load settles
```js
useEffect(() => {
  if (autoSaveBaselineSetRef.current) return;
  if (!projectSetup.isInitialized || !isThemeApplied) return;
  autoSaveBaselineSetRef.current = true;
  lastSavedPagesRef.current = store.getState().canvas.present.pages;
}, [projectSetup.isInitialized, isThemeApplied, store]);
```
`isThemeApplied` (redux) is the right trigger: the load path dispatches `setThemeApplied(true)` **after** `setupTheme()`/`applyTheme` and after pages are adjusted to the correct quantity, so `present.pages` is the fully-loaded, unedited array here.

### 3. The tick gate + re-pin on save
```js
// inside the existing 30s setInterval, after the < 30s recency guard:
if (
  lastSavedPagesRef.current !== null &&
  store.getState().canvas.present.pages === lastSavedPagesRef.current
) {
  return; // no activity since last save / load → skip
}
```
```js
// inside saveProject(): snapshot at build time, re-pin on success only
const pagesAtSave = store.getState().canvas.present.pages;
// …build payload, POST…
.then(() => { lastSavedPagesRef.current = pagesAtSave; })  // success only
```
- **Snapshot at build time, not at resolve time:** edits made *while a save is in flight* produce a new `pages` ref, so they stay "dirty" and are picked up by the next tick (they aren't falsely marked saved).
- **Re-pin on success only:** a failed save leaves the ref unchanged → the next tick retries.
- **Manual Save** routes through the same `saveProject()`, so it also re-pins the baseline — a manual save followed by no edits leaves auto-save idle.

---

## Why this satisfies the literal requirement

| User action after load | `pages` ref changes? | Auto-save fires? |
|---|---|---|
| Nothing (just viewing) | no | **no** ✅ |
| Click / select an object | no (only `activeObject*`) | **no** ✅ |
| Navigate pages (next/prev) | no (only `activePageIndex`/`activeSide`) | **no** ✅ |
| Zoom / pan | no (only `zoomRatio`/dragger) | **no** ✅ |
| Move / add / delete an object, edit text, change background | **yes** | **yes** ✅ |

---

## Robustness notes

- **300-step undo cap is irrelevant** — we compare `present.pages`, not `past.length`. Even at the cap, every real edit still produces a new `pages` reference.
- **`getAllPages` selector copy is NOT used for the signal** — that selector returns a fresh `[...canvas.pages]` array and recomputes whenever the `present` slice changes (including on selection), so it would false-positive. The gate reads the **raw** `store.getState().canvas.present.pages` directly.
- **Null baseline falls through** — if a tick somehow fires before the baseline is set (load not settled), `lastSavedPagesRef.current !== null` is false, so the gate doesn't block and behaviour matches the old unconditional save. In practice the baseline is set well within the first 30s.
- **Other user types unaffected** — the auto-save effect still early-returns for non-customers.

---

## Known caveat (disclosed, by design)

The save payload also includes fields that live **outside** `present.pages`: `cal_settings` (calendar settings), `settings` (document settings, e.g. full-cover toggle), and `smart_text` (text-group links). A change to **only** one of those — with no object edit — will **not** trigger an auto-save on its own.

- **Nothing is lost:** they are persisted on the **next object edit** or any **manual Save** (both read current state at save time).
- **Why not broaden the gate to those refs:** their load-time setup actions (`setCanvasSize`, `setSettings`, `setCalendarSettings`) can fire in a **different order** than `setThemeApplied`, which would risk a **false post-load save** — exactly the bug we set out to remove. The narrow `pages` signal is the safe, faithful choice for the stated requirement.

---

## Files changed

| File | Change |
|---|---|
| `src/layout/Header.jsx` | Added `lastSavedPagesRef` + `autoSaveBaselineSetRef`; baseline `useEffect` (on `isInitialized` + `isThemeApplied`); activity gate inside the 30s auto-save tick; snapshot `pagesAtSave` in `saveProject` and re-pin the baseline in its success `.then`. |

No store/reducer/API changes. Debug `console.log`s used during testing were removed before commit.

---

## Verification checklist

- Open a project as a **customer**, do nothing → over several minutes, **no** `POST /saveProject` is sent.
- Click/select objects and flip pages (no real edit) → still **no** save (the key regression the undo-history approach would have failed).
- Make any content edit (move/add/delete object, edit text, change background) → next tick sends one save.
- After a save, idle again → ticks stop saving until the next edit.
- A manual **Save** followed by no edits → auto-save stays idle.
- Edit *during* an in-flight save → the edit is still saved on a later tick (not falsely marked clean).
- Non-customer user types → unchanged (effect early-returns).

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ [Architecture](architecture.md)
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 [Data Flow Diagram](data-flow-diagram.md)
- 🖌️ [Canvas](canvas.md)
- ✋ [Interaction](interaction.md)
- 📷 [Photo](photo.md)
- 🔷 [Shape](shape.md)
- ⭐ [Sticker](sticker.md)
- 🔤 [Text](text.md)
- 📱 [React Native Migration Plan](react-native-migration-plan.md)
- ⬆️ [Upload Pipeline](upload-pipeline.md)
- 📝 [Session: Upload Pipeline Rework (2026-06-12)](session-2026-06-12-upload-pipeline-rework.md)
- 🖼️ [Image Loading Optimization (2026-06-16)](image-loading-optimization-2026-06-16.md)
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 **Customer Auto-Save Activity Gate (2026-06-19)** — _you are here_
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
