# Issues, Blockers & Resolutions — Design Selection Flow

A log of problems encountered (and how they were resolved) while building the
post-login category/theme selection flow.

---

## I1 — Which API is the "getTheme" API? (ambiguity / resolved)

**Problem:** The request says _"call the existing `getTheme` API … use the selected
category data."_ Two candidates exist:
- `ENDPOINTS.getThemeById` → `store-theme-editor/getTheme` (URL literally ends in `getTheme`).
- `ENDPOINTS.getThemes` → `store-theme-editor` (listing, filtered by `editor_type`).

**Analysis:** Categories come from `EDITOR_TYPES` (constants) — they are **strings**
with no `_id`. `getThemeById` requires an `_id` and returns one theme. `getThemes`
accepts `filter.editor_type` and returns a **list** of theme editors, which matches
both "use the selected category data" and "display the returned theme editor types".

**Resolution:** Used `ENDPOINTS.getThemes`. Documented as decision **D1** in `SESSION.md`.
If the intent was actually `getThemeById`, only `fetchThemes()` in
`DesignSelectionPage.jsx` needs to change.

---

## I2 — User data not fully available after login

**Problem:** The decrypted login `items` carry `accessToken / brand_id / store_id /
userId` but not reliably `_id` / `userTypeCode`. `apiCall.js` builds auth headers
(`x-user-id`, `x-brand-id`) from `localStorage.userDetails._id` / `brand_id`, and
the theme query's `status` filter depends on `userTypeCode`. The full-user fetch
previously only happened inside `useInitializeProject`, which runs **only at `/`**,
not on the new `/design` route.

**Resolution:** `DesignSelectionPage.ensureUser()` resolves the full record from the
token via `ENDPOINTS.fetchUserDataFromToken` (same endpoint/contract as the editor
bootstrap) and persists it to `localStorage` + redux before any data call. The login
handler also persists the login record up front so the token is available immediately.
The fetch is skipped when a complete record for the current token already exists.

---

## I3 — Web vs Desktop redirect / token propagation

**Problem:** The old login redirect branched on platform: desktop used
`navigate("/?u_id=token")` (HashRouter), web did a full `window.location.href` reload
to force `useInitializeProject` to re-run with `u_id` in the real query. A naive reuse
could bounce back to `/login` or lose the token under HashRouter.

**Resolution:** Since `/design` performs its own user init, the reload is unnecessary.
A single `navigate("/design?u_id=<token>")` puts the token in `location.search` for
both routers. `getUrlParam()` in the page also falls back to the raw `window` query,
the hash query, and `localStorage.userDetails.token` — covering every case.

---

## I4 — Reading the token under HashRouter

**Problem:** Under HashRouter the query can live in the URL hash (`#/design?u_id=…`),
so `useSearchParams`/`location.search` alone may miss it after certain navigations.

**Resolution:** Reused the multi-source `getUrlParam()` pattern from
`useInitializeProject` (router search → window search → hash query), plus a
`localStorage` token fallback.

---

## I5 — Over-constraining the theme query

**Problem (caught in review, pre-empted):** An early draft added
`type: EDITOR_ASSETS.THEME` to the `getThemes` filter. The `store-theme-editor`
documents are not guaranteed to carry a `type:"theme"` field (that field is used by
the **category** endpoint `store-tags`, not the theme-editor listing), so it risked
returning zero results.

**Resolution:** Removed it. The payload now mirrors `ThemesAction.fetchThemes` exactly
(the proven in-editor shape). Unused `EDITOR_ASSETS` import was dropped.

---

## I6 — Empty / error / loading UX

**Problem:** A category may legitimately have no published designs, the network may
fail, and `apiPost` resolves errors to `{ error }` rather than throwing.

**Resolution:** `fetchThemes()` treats `response.error` as a failure and the component
renders four explicit states: spinner (loading), message + **Retry** (error), icon +
"No designs … yet" + back-to-categories (empty), and the grid (data).

---

## I7 — Theme → editor handoff is out of scope (known limitation)

**Problem:** This flow ends at *displaying* theme editors. Fully launching the editor
with the chosen design pre-applied requires project/cart creation, which the task did
not specify.

**Resolution / follow-up:** "Open editor" carries the session (`/?u_id=token`) into the
existing editor, where the design can be applied from the Themes panel. Auto-apply on
entry is listed as a follow-up in `SESSION.md §7`.

---

## I8 — Infinite-scroll observer never bound (sentinel mounting order)

**Problem:** `useInfiniteScroll` binds its `IntersectionObserver` in an effect that
runs **on the consumer's mount** and only re-runs when `[hasMore, direction, loadPage]`
change. If the sentinel `<div>` isn't in the DOM at that moment (e.g. it's hidden
behind a "loading" / "empty" state), the effect early-returns and — because `hasMore`
stays `true` across multi-page categories — **never re-binds**, so pagination silently
never fires. `ThemesAction` avoids this only because its sentinel is always mounted.

**Resolution:** Two-part fix in `DesignSelectionPage`:
1. Extracted a **`ThemeBrowser` child keyed by `category.type`** so each category
   selection **remounts** the hook consumer — the bind effect runs fresh with the
   sentinel present.
2. The sentinel `<div>` is **always rendered** in `ThemeBrowser` (alongside the
   loading/empty/error states, not instead of them), so it exists on mount.

---

## I9 — First-render "empty" flash

**Problem:** `useInfiniteScroll` starts with `loading === false` and `items === []`;
the actual fetch is kicked off by an effect that flips `loading` true **after** the
first commit. A naive `!loading && items.length === 0 → empty` check therefore renders
the empty state for one frame before the spinner.

**Resolution:** Added a local `everLoading` flag (set true the first time `loading`
becomes true). The empty state only shows once `everLoading && !loading && items===0`;
the initial spinner covers the pre-fetch window (`loading || !everLoading`).

---

## I10 — Loading a theme into the editor from a standalone route

**Problem:** `DesignSelectionPage` is its own route, not inside the editor. Replicating
the theme-application logic (canvas size, pages, settings, calendar, undo baseline …)
in the page would duplicate a large, fragile code path.

**Resolution:** Reused the editor's existing URL loader. `useThemeSetup` (in `MainLayout`)
already watches `location.search` for `t_id`, calls `GetThemeById(t_id)` — the
**`getTheme` API** (`store-theme-editor/getTheme`) — and applies the result. The page just
navigates to `/?u_id=<token>&t_id=<theme._id>`. This passes the selected `_id` to
`getTheme` and loads the theme automatically, with **no new editor code**. (Supersedes
follow-up I7 from iteration 1.)

---

## I11 — "Set Up Your Design" modal wouldn't reopen after a loaded theme

**Problem:** The Header opens the modal only when no theme is loaded
(`!themeDetails.theme_id && !cartDetails.theme_id && !t_id`). After a user loads a
theme and then comes back to start a New Theme, Redux still held the previous
`themeDetails.theme_id`, so the Header thought a theme existed and the modal stayed
closed.

**Resolution:** `handleNewTheme` dispatches **`resetThemeDetails()`** (existing
projectSetup action — clears `themeDetails`, `allThemes`, `cartDetails.theme_id`)
before navigating to `/?u_id=token`. The Header effect then sees no theme and opens
"Set Up Your Design".

---

## I12 — Don't reach for `isNewTheme=true` ("Create New Theme")

**Problem (clarification):** `CreateThemeDialog` has two modes — `isNewTheme=true`
("Create New Theme", blank single page) and `isNewTheme=false` ("Set Up Your Design").
A "New Theme" button might suggest the former.

**Resolution:** The request explicitly names the **"Set Up Your Design"** modal, which
is `isNewTheme=false`. We reach it via the Header's existing auto-open (which always
uses `isNewTheme=false`), so no `isNewTheme` flag is passed from our code. The button
is labelled "New Theme" for the user but opens the requested modal.

---

## I13 — Back button must not appear in customer cart sessions

**Problem:** The editor is entered from several flows. A blanket "Back to Designs"
button would also show during a customer's storefront cart-order session (`c_id`),
where there is no design-selection page to go back to.

**Resolution:** Gated the button on `u_id && !c_id` — present only for designer/template
sessions (which is exactly what `/design` produces). The existing brand `redirect_url`
link is left untouched (it serves the storefront-return purpose).

---

## I14 — Preserve the infinite-scroll invariant when extracting ThemeBrowser

**Problem:** Moving `ThemeBrowser` into its own file risked losing the two subtle
correctness rules behind its pagination (see I8/I9): it must be mounted with
`key={category.type}` so the hook re-initialises per category, and its sentinel must be
**always rendered** so the `IntersectionObserver` binds on mount.

**Resolution:** Documented both rules in the component's file header, kept the
always-mounted sentinel (now under skeleton/empty/error states too), and kept the
`key={category.type}` at the single call site in `DesignSelectionPage`. The `everLoading`
guard moved with the component.

---

## I15 — `import/no-anonymous-default-export` on StateViews

**Problem:** `export default { Spinner, LoadingState, … }` tripped the CRA ESLint rule
`import/no-anonymous-default-export` (a warning).

**Resolution:** Assigned the object to a named `const StateViews` first, then
`export default StateViews`. The named exports were already the primary API.

---

## I16 — Avoiding a circular import for the shared theme fetch

**Problem:** `fetchThemesByCategory` lives in `services/theme/index.js` and needs
`isAdminLike`. Putting `isAdminLike` in a module that (directly or transitively) imports
the theme service would create a cycle.

**Resolution:** `isAdminLike` lives in `helpers/session.js`, which imports only
`apiCall` + `constants` (no theme service), so `services/theme` → `helpers/session` is a
clean one-way edge. Verified by a successful production build.

---

## I17 — Clicking a theme opened the WRONG theme on desktop (stale Redux across SPA nav)

**Symptom:** Clicking a theme on the design page opened a *different* (previously
viewed) theme in the desktop editor. Opening the exact same theme on web via
`/?u_id=…&t_id=<id>` rendered perfectly.

**Why it only happened on desktop:** `useThemeSetup` and `GetThemeById` are
byte-identical between web and desktop, so the loader wasn't at fault. The difference
is the navigation model:
- **Web:** opening `?t_id=…` is a **full page load** → a **clean Redux store** → only
  the `t_id` loader runs → correct theme.
- **Desktop:** `/design → /editor` is **SPA navigation** → the **Redux store survives**.
  A theme loaded earlier in the session leaves stale `projectSetup.themeDetails.theme_id`
  + `pages_c` (and `cartDetails.theme_id`) in the store.

`useThemeSetup` mounts **two** effects that both run on entry:
1. `[location.search]` → loads the new theme by `t_id` (async `GetThemeById`).
2. `[projectSetup]` → sees the **stale** `themeDetails.theme_id && pages_c` and
   re-applies the **previous** theme.

These race; the stale effect frequently won → "wrong theme".

**Fix:** `handleLoadTheme` now `dispatch(resetThemeDetails())` **before** navigating
(mirroring `handleNewTheme`). With theme details cleared, effect #2 hits its early-return
(`!theme_id`) and bails, leaving only the fresh `t_id` load (#1) to apply the theme.
`resetThemeDetails` clears `themeDetails`/`allThemes` and nulls `cartDetails.theme_id`;
`setupThemeFromURL` then re-populates everything for the selected theme. Verified the
first-ever load is unaffected (theme details were already empty).

---

## I18 — Editor "Back" dropped the user at the category grid, not the theme list

**Symptom:** After opening a theme, clicking **Back** in the editor returned to the
Design Selection page's **top-level category grid** — losing the category the user
had been browsing. They had to re-pick the category to get back to the theme list.

**Cause:** `handleBackToDesign` navigated to `/design?u_id=…` with no category
context, and `DesignSelectionPage` always initialised `selectedCategory = null`.

**Fix:** Thread the category through the round-trip via a `cat` URL param:
- `DesignSelectionPage.handleLoadTheme` / `handleNewTheme` append `&cat=<category.type>`
  to the editor URL.
- `Header.handleBackToDesign` reads `searchParams.get("cat")` and forwards it:
  `/design?u_id=…&cat=<type>` (built with `URLSearchParams`).
- `DesignSelectionPage` initialises `selectedCategory` **lazily from the `cat` param**
  (`getUrlParam(location.search, "cat")` → matched against `EDITOR_CATEGORIES`), so it
  mounts straight into the `ThemeBrowser` for that category — no flash of the grid.

Works under HashRouter (desktop) and BrowserRouter (web) since `getUrlParam` checks the
router search, the raw query, and the hash query. Landing fresh from login (no `cat`)
still shows the category grid as before.
## I19 — Resizing + blanking a theme without duplicating the editor's load path

**Problem:** The size-modal flow needs the editor to (a) resize the theme to an
arbitrary chosen size (possibly a custom one matching no variant) and (b) clear all
image URLs. Re-implementing the theme application (canvas size, page scaling, settings,
masks, undo baseline, Canvas-size debounce timing) on the design page would duplicate a
large, timing-sensitive code path (see I10).

**Resolution:** Kept the single `t_id` load path and passed the chosen size + a blank
flag as **gated URL params** (`size_w/h/dpi/sm/bm`, `blank_img`). `setupThemeFromURL`
honors them: it scales `variant.pages_c` to the chosen dims via `processProjectPages`,
sets `canvasSize` to the chosen size, and runs `clearImageUrls` when `blank_img=1`. When
the params are absent (web deep-link) the legacy behavior is byte-for-byte unchanged.

---

## I20 — Latent photobook crash in `setupThemeFromURL`

**Problem (found while refactoring):** the original code did
`const width = theme.width; … if (PHOTOBOOK) width /= 2;` — reassigning a `const`, which
throws "Assignment to constant variable" for **photobook** URL loads.

**Resolution:** The size refactor replaced it with `let layoutWidth = targetWidth; if
(PHOTOBOOK) layoutWidth = targetWidth / 2;`, fixing the latent crash as a side effect.

---

## I21 — Stale size selection when reopening the modal for another theme

**Problem:** `ThemeSizeModal` default-selected the first predefined size only when
`selectedKey` was null. After picking a size for theme A and reopening for theme B, the
old `selectedKey` (a `pre_…` key from A) was no longer in B's set → nothing selected →
Continue disabled.

**Resolution:** The default-select effect now keys on the `predefined` memo (which changes
only when `variants` change, i.e. a new theme) and resets `selectedKey` to the first
predefined each time — custom-size additions don't change `predefined`, so a manual
selection is preserved within a session. A `sizeFetchForRef` guard also prevents a slow
variant fetch from populating the modal for a theme the user already navigated away from.

---

## I22 — Blank-image clear must survive the `[projectSetup]` re-apply

**Problem:** `setupThemeFromURL` only sets `themeDetails.pages_c`; the actual canvas apply
happens in `useThemeSetup`'s `[projectSetup]` effect (`setupTheme → replacePages →
applyTheme`). If that re-derived images, the blanking would be undone.

**Resolution:** `clearImageUrls` runs **before** `setEditorPages`, so the cleared pages ARE
`themeDetails.pages_c`. `replacePages` then applies them as-is (admin) or re-clears
(customer) — either way images stay blank. `masking` is preserved, so blank boxes keep
their frame/mask shape.

---

## Build / lint status

`npm run build` succeeds. The only ESLint warnings are **pre-existing** in unrelated
files (`MagicWritePanel.jsx`, `ThemesAction.jsx`, and the `theme` / `Rx*` unused imports
already in `Header.jsx`). No warnings or errors originate from `LoginPage.jsx`,
`DesignSelectionPage.jsx`, `app.jsx`, `constants/index.js`, or the `Header.jsx` additions
(the added `FaArrowLeft` is used).
