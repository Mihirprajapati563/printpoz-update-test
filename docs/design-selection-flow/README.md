# Design Selection Flow

Post-login product/category selection screen — _"What would you like to design?"_ —
that lets an authenticated user pick an editor category and browse the available
theme editors for it before entering the editor.

---

## 1. Feature Overview

| Stage | What the user sees |
|-------|--------------------|
| **Login** | Email + password only (phone/OTP removed). |
| **Category selection** | A heading "What would you like to design?" and a responsive grid of editor categories (Photo Book, Calendar, Canvas Print, …). |
| **Theme selection** | After picking a category, the screen fetches and displays theme editors (designs) for that category in a grid **with scroll-based pagination (infinite scroll)** and loading / empty / error states. |
| **Size modal** | Clicking a design opens a **"Choose a size"** modal listing the theme's predefined sizes + the user's saved custom sizes, with a **Continue** button and a custom-size creator (Width / Height / DPI / Unit / Trim / Bleed → OK, persisted to localStorage). |
| **Open in editor** | **Continue** opens the editor with that theme loaded (its `_id` → `getTheme` API), **resized to the chosen size** and with all existing images replaced by **blank placeholders**. |
| **New Theme** | A **New Theme** button (always visible) opens the editor with no theme, so the editor's **"Set Up Your Design"** modal appears to create one from scratch. |
| **Back to Designs** | The editor Header shows a **Back to Designs** button (designer sessions) that returns to this page. |

The category list is **derived from the constants in
`src/library/utils/constants/index.js`** (`EDITOR_TYPES` → `EDITOR_CATEGORIES`),
so it stays in sync with the single source of truth for editor types.

---

## 2. Architecture

```
Login (email/password)
   │  apiPost(authLogin) → decrypt items → save userDetails to localStorage
   │  dispatch(setUserDetails / setAuthItems)
   ▼
/design  →  DesignSelectionPage.jsx
   │
   ├─ Step 0  ensureUser()
   │     read u_id (token) from URL/hash/localStorage
   │     if no complete user record → apiPost(fetchUserDataFromToken)
   │     persist full user (_id, userTypeCode, brand_id, token) to localStorage + redux
   │
   ├─ Step 1  render category grid from EDITOR_CATEGORIES (constants)
   │
   ├─ Step 2  select category → <ThemeBrowser key={category.type} …>
   │     useInfiniteScroll → apiPost(ENDPOINTS.getThemes, { filter:{ editor_type … }, skip, limit })
   │     paginates page-by-page on scroll (sentinel + IntersectionObserver)
   │     render theme editors  (initial-loading / empty / error / data / loading-more / end states)
   │
   ├─ Step 3  click a theme → GetThemeById(t_id) for its sizes → <ThemeSizeModal>
   │        Continue(size) → navigate("/?u_id&t_id&cat&size_w&size_h&size_dpi&size_sm&size_bm&blank_img=1")
   │        editor's useThemeSetup → GetThemeById(t_id) [getTheme API]
   │          → resizes pages to size_* + clears image URLs (blank_img) → applies theme
   │
   └─ New Theme button → dispatch(resetThemeDetails) [+ setEditorType(category)] → navigate("/?u_id=token")
            editor Header effect (no theme_id, no t_id) → opens "Set Up Your Design" modal
            modal submit → apiPost(saveAsTheme) → handleThemeCreated → navigate(?t_id=newId)

Editor → Back to Designs button (Header) → navigate("/design?u_id=token")
```

### Files

| File | Change |
|------|--------|
| `src/library/utils/constants/index.js` | **Added** `EDITOR_CATEGORIES` — display metadata (label, description, icon key) derived from `EDITOR_TYPES`. |
| `src/layout/pages/LoginPage.jsx` | **Modified** — removed phone/OTP tab + handlers; email-only; persists `userDetails`; redirects to `/design`. |
| `src/layout/pages/DesignSelectionPage.jsx` | **Thin page** — auth/init + flow orchestration; composes the reusable pieces below into a modern app shell (sticky app bar, hero, breadcrumb). |
| `src/components/design-selection/ThemeBrowser.jsx` | **Reusable** infinite-scroll theme grid for one category (owns fetch + pagination; calls back `onSelectTheme`). |
| `src/components/design-selection/ThemeSizeModal.jsx` | **Reusable** "Choose a size" modal — predefined + custom sizes, custom-size creator, Continue. |
| `src/library/utils/helpers/customSizes.js` | **Reusable** localStorage store for custom sizes (`getCustomSizes`/`addCustomSize`/`removeCustomSize`). |
| `src/library/utils/custom-hooks/useThemeSetup.js` | **Modified** `setupThemeFromURL` — gated `size_*` override (resize) + `blank_img` (clear image URLs). Legacy path unchanged when params absent. |
| `src/components/design-selection/CategoryGrid.jsx` | **Reusable** category grid (renders `EDITOR_CATEGORIES`; `onSelect`); exports `CATEGORY_ICONS`. |
| `src/components/design-selection/styles.js` | Shared styled-components + design tokens for the feature. |
| `src/components/design-selection/index.js` | Barrel — `import { ThemeBrowser, CategoryGrid, … } from "components/design-selection"`. |
| `src/common-components/StateViews.jsx` | **App-wide reusable** `Spinner` / `LoadingState` / `EmptyState` / `ErrorState`. |
| `src/library/utils/helpers/session.js` | **Reusable** auth/session helpers: `getUrlParam`, `readStoredUser`, `getSessionToken`, `isAdminLike`, `resolveUserFromToken`. |
| `src/library/utils/services/theme/index.js` | **Added** `fetchThemesByCategory({ editorType, user, skip, limit, search })` — the category-scoped theme listing. |
| `src/layout/Header.jsx` | **Back** button (left-arrow + "Back") moved to the right toolbar next to Undo/Redo, styled like the other toolbar buttons; gated to `u_id && !c_id`. |
| `src/App/app.jsx` | `/design` route. |

Reused (unchanged): `src/hooks/useInfiniteScroll.js` (pagination); the editor's
`src/library/utils/custom-hooks/useThemeSetup.js` (`t_id` URL → `getTheme` → apply);
and `src/components/popups/CreateThemeDialog.jsx` (the "Set Up Your Design" modal,
auto-opened by the Header when no theme is present — it calls the `saveAsTheme` API).

### Reusable building blocks (import from anywhere)
```js
import { ThemeBrowser, CategoryGrid, CATEGORY_ICONS } from "../../components/design-selection";
import { Spinner, LoadingState, EmptyState, ErrorState } from "../../common-components/StateViews";
import { getSessionToken, resolveUserFromToken, isAdminLike } from "../../library/utils/helpers/session";
import { fetchThemesByCategory } from "../../library/utils/services/theme";
```

---

## 3. Implementation Details

### 3.1 Login (email-only)
- The phone-number tab, `handleSendOTP`, `handleVerifyOTP`, and the `verifyOTP`
  endpoint usage were removed. The email/password validation and the
  `authLogin → decrypt → setAuthItems` flow are unchanged.
- On success the decrypted user is persisted to `localStorage.userDetails`
  (with `token: user.accessToken`) so `apiCall.js` — which reads the token and
  ids from `localStorage` — works immediately on the next page.
- Redirect is a single `navigate("/design?u_id=<token>")`. This works for both
  the web **BrowserRouter** and the desktop **HashRouter** (the query lands in
  `location.search` in both), so the platform-branching reload used by the old
  editor redirect is no longer required here.

### 3.2 User data persistence (`ensureUser`)
The login `items` object carries `accessToken / brand_id / store_id / userId`,
but not necessarily `_id` / `userTypeCode`. `DesignSelectionPage` therefore
resolves the **full** user record from the token via
`ENDPOINTS.fetchUserDataFromToken` (the same endpoint the editor bootstrap
`useInitializeProject` uses) and persists it before issuing any data calls.
If the record for the current token is already complete in `localStorage`, the
fetch is skipped. If no token is present at all, the page redirects to `/login`.

### 3.3 Category grid
- Source: `EDITOR_CATEGORIES` (constants). Each entry = `{ type, label, description, icon }`.
- `icon` is a **string key** (constants stay React-free); `DesignSelectionPage`
  maps it to a `react-icons/fa` component via the local `CATEGORY_ICONS` map.
- Layout: CSS Grid with `repeat(auto-fill, minmax(clamp(...), 1fr))` — fully
  responsive, no media-query breakpoints needed.

### 3.4 Theme listing + infinite scroll (`getThemes`)
- Endpoint: `ENDPOINTS.getThemes` (`store-theme-editor`) — the theme-editor
  listing API. The selected category drives the request via
  `filter.editor_type = category.type`.
- The payload mirrors the proven `ThemesAction.fetchThemes` filter shape
  (status differs for admin-like roles via `$in:[1,3]`), plus `skip` / `limit`
  for pagination — so behaviour matches the in-editor Themes panel.
- **Pagination** uses the shared `useInfiniteScroll` hook (`src/hooks/useInfiniteScroll.js`):
  a sentinel `<div>` near the grid bottom is watched by an `IntersectionObserver`;
  when it enters the viewport (within 300px) and `hasMore`, the next page loads
  (`THEMES_PER_PAGE = 24`). `hasMore` is derived from the API `totalCount`.
- **`ThemeBrowser` is keyed by `category.type`** so picking a new category remounts
  it — re-initialising the hook from a clean page-1 state and rebinding the
  observer. The sentinel is **always mounted** (even during the initial spinner)
  so the observer binds on mount, before the first page resolves.
- Response items are de-weighted (`pages_c` / `theme` stripped) — the grid only
  needs `name` + `theme_images[0].url`.
- States handled: **initial loading** (spinner; a first-render flash is avoided via
  an `everLoading` guard), **error** (retry → `resetAndFetch`), **empty** (no
  designs yet → back to categories), **data** (grid), **loading more** (footer
  spinner), **end of list** (end note).

### 3.4a Size modal + resize + blank images (theme load)
Clicking a theme no longer opens the editor directly. Instead:
1. **Fetch sizes** — `DesignSelectionPage.handleLoadTheme` calls `GetThemeById(theme._id)`
   and passes the returned `theme[]` variants to **`ThemeSizeModal`** (a stale-fetch ref
   guards rapid re-opens).
2. **`ThemeSizeModal`** lists **predefined sizes** (the variants) + **saved custom sizes**
   (`customSizes.js` ⇄ localStorage). A custom-size creator takes **Width, Height, DPI,
   Unit, Trim Margin, Bleed Margin**; **OK** converts to px (`convertToPixels`), persists
   via `addCustomSize`, and selects it. Custom sizes persist across sessions and appear for
   **every** theme load (global, not per-theme).
3. **Continue(size)** → `handleContinueWithSize` navigates to
   `/?u_id&t_id&cat&size_w&size_h&size_dpi&size_sm&size_bm&blank_img=1`.
4. **Editor resize + blank** — `useThemeSetup.setupThemeFromURL` reads the gated
   `size_*` params: it picks the variant matching the chosen size (or `theme[0]`) as the
   pages source, sets `canvasSize` to the chosen dimensions/margins/DPI, and
   `processProjectPages` **scales the theme to that size**. With `blank_img=1`,
   `clearImageUrls` replaces every populated `type:"img"` object's `url`/`urls`/`image_id`
   with empties → **blank placeholders** (mask shapes preserved). Both behaviors are
   **gated on the params**, so the legacy web `t_id` deep-link is unchanged.
   (Side note: this also fixed a latent `const width; width /= 2` crash on photobook URL loads.)

### 3.4b New Theme (create from scratch)
The **New Theme** button in the page header is available for all categories.
`handleNewTheme(category)`:
1. `dispatch(resetThemeDetails())` — clears any previously loaded theme so the
   editor reliably treats this as a fresh session (otherwise a stale
   `themeDetails.theme_id` from an earlier load would suppress the modal).
2. If a category is in context, `dispatch(setEditorType(category.type))` so the
   modal defaults to that product type.
3. `navigate("/?u_id=<token>")` — **no `t_id`**.

In the editor, `Header.jsx`'s existing effect sees `isInitialized && no theme_id &&
no t_id && no cart_order_id` and opens **`CreateThemeDialog`** with the
**"Set Up Your Design"** title (`isNewTheme={false}`). Submitting it calls the
**`saveAsTheme`** API (`ENDPOINTS.saveAsTheme`) — the existing, reused theme-creation
path — then `handleThemeCreated` sets `?t_id=<newId>` to load the freshly created theme.
No new API code was written; all required calls are reused.

### 3.4c Back button (editor → this page)
`Header.jsx` renders a **Back** button (left-arrow icon + "Back") in the **right-side
toolbar, immediately left of the Undo/Redo group**, as a `ButtonGroup` of
`LightPrimaryButton` so it's visually consistent with the other toolbar buttons. It's
shown only for designer/template sessions (`u_id` present and no `c_id`, so it never
appears in a customer cart-order session). `handleBackToDesign` reads the session token
from the `u_id` query (falling back to `localStorage.userDetails.token`) and
`navigate("/design?u_id=<token>")`.

### 3.5 Load a theme into the editor (`getTheme` by `_id`)
Clicking a theme card calls `handleLoadTheme(theme)`, which navigates to
`/?u_id=<token>&t_id=<theme._id>` (the card shows an "Opening editor…" overlay).
The editor's existing **`useThemeSetup`** hook reads the `t_id` URL param, passes
that `_id` to the **`getTheme` API** via `GetThemeById` (→ `store-theme-editor/getTheme`),
and applies the returned theme data to the canvas automatically — the same path
admins use to open a theme by URL. No new editor code was required.

---

## 4. Design / UX

- Matches the existing `LoginPage` visual language (same `#4084B5` accent, card
  radii, soft shadows).
- Fluid typography & spacing with `clamp()` throughout (per the project's
  responsive-design conventions in `CLAUDE.md`).
- Accessible: `aria-label`s on cards, visible `:focus-visible` outlines, semantic
  `<button>` elements.
- Reusable styled primitives (`CategoryCard`, `ThemeCard`, `StateBox`, …) keep
  the component maintainable and consistent.

---

## 5. Web / Desktop compatibility
- No imports from `electron/` or Node APIs — renderer rules preserved.
- API base URL comes from `apiurl.js` (runtime-config aware); nothing hardcoded.
- Token stays in `localStorage` (works in Electron), consistent with the rest of
  the app.
