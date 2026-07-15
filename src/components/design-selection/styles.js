/**
 * Shared styled-components + design tokens for the Design Selection feature
 * (page shell, category grid, theme grid, buttons). Centralising them here keeps
 * the page and the reusable CategoryGrid / ThemeBrowser components lean and
 * visually consistent.
 *
 * DESIGN LANGUAGE: a strict black-and-white (grayscale) system — no coloured
 * accents, no drop shadows. Brand colours are still driven by the editor
 * configuration's `theme_colors` (applied by `ThemeContext` as CSS vars), which
 * are themselves black/white by default. Hover states are expressed as a
 * background/border change (never a shadow or lift). Every hex fallback below is
 * greyscale so the UI stays monochrome even if a var is unset.
 */
import styled, { keyframes, css } from "styled-components";

// ── Design tokens (black & white) ──────────────────────────────────────────────
export const tokens = {
  primary: "var(--primary, #111111)", // black — buttons, accents, active state
  primaryDark: "var(--primary-dark, #000000)", // pure black — hover/pressed
  primarySoft: "var(--secondary, #f2f2f2)", // light grey — chips / soft fills
  ink: "var(--foreground, #111111)", // strongest text / headings
  ink2: "#333333", // secondary text
  muted: "var(--muted-foreground, #6b6b6b)", // muted labels
  faint: "#9a9a9a", // faint text / icons
  line: "#e6e6e6", // borders / dividers
  surface: "#ffffff", // cards / surfaces
  surfaceAlt: "#f7f7f7", // subtle background (app shell, chips)
  hover: "#f2f2f2", // hover background
};

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -420px 0; }
  100% { background-position: 420px 0; }
`;

// ── App shell ─────────────────────────────────────────────────────────────────
export const Page = styled.div`
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${tokens.surfaceAlt};
  box-sizing: border-box;
`;

export const AppBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px clamp(16px, 5vw, 56px);
  background: ${tokens.surface};
  border-bottom: 1px solid ${tokens.line};
`;

export const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const BrandMark = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 17px;
  background: ${tokens.primary};
`;

export const BrandName = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${tokens.ink};
  letter-spacing: -0.3px;
`;

export const AppBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(22px, 4vw, 48px) clamp(16px, 5vw, 56px) 88px;
  box-sizing: border-box;
  animation: ${fadeIn} 0.4s cubic-bezier(0.16, 1, 0.3, 1);
`;

// ── VS Code-style two-pane workspace ───────────────────────────────────────────
// A fixed-width sidebar (saved designs) + a flexible content pane (categories /
// themes). Both panes scroll independently; the shell fills the viewport below
// the app bar so it reads like an IDE workspace rather than a long page.
export const Workspace = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: clamp(280px, 24vw, 360px) 1fr;
  min-height: 0; /* allow children to own their own scroll */
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

// Left pane — "Would you like to design?" + the locally saved designs list.
export const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${tokens.surface};
  border-right: 1px solid ${tokens.line};

  @media (max-width: 900px) {
    border-right: none;
    border-bottom: 1px solid ${tokens.line};
    max-height: 46vh;
  }
`;

export const SidebarHeader = styled.div`
  padding: 16px clamp(16px, 2vw, 22px) 13px;
  border-bottom: 1px solid ${tokens.line};
`;

// Quiet VS Code "Explorer"-style panel title: small, uppercase, with a count
// badge — it labels the panel rather than competing with the main hero heading.
export const SidebarSectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${tokens.ink2};

  svg { color: ${tokens.ink}; }
`;

export const SidebarCount = styled.span`
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  color: ${tokens.ink};
  background: ${tokens.primarySoft};
`;

export const SidebarMeta = styled.p`
  margin: 7px 0 0;
  font-size: 12px;
  color: ${tokens.muted};
`;

// ── Segmented tabs (sidebar: "Your Designs" / "Offline") ───────────────────────
// A single segmented control switches the sidebar between the two lists so only
// one shows at a time — keeps the narrow pane uncluttered (Canva-desktop style).
export const SidebarTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: ${tokens.surfaceAlt};
  border: 1px solid ${tokens.line};
  border-radius: 12px;
`;

export const SidebarTab = styled.button`
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  color: ${tokens.muted};
  background: transparent;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;

  &:hover {
    color: ${tokens.ink};
    background: ${tokens.hover};
  }
  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: 2px;
  }

  ${(p) =>
    p.$active &&
    css`
      color: ${tokens.ink};
      background: ${tokens.surface};
      border-color: ${tokens.line};
      &:hover { color: ${tokens.ink}; background: ${tokens.surface}; }
    `}
`;

export const SidebarTabCount = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  color: ${(p) => (p.$active ? tokens.ink : tokens.muted)};
  background: ${(p) => (p.$active ? tokens.primarySoft : "#e6e6e6")};
`;

// The tab's text label — ellipsizes rather than overflowing if a (user-chosen)
// label is long for the narrow sidebar.
export const SidebarTabText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SidebarBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px clamp(12px, 1.6vw, 18px) 24px;

  &::-webkit-scrollbar { width: 9px; }
  &::-webkit-scrollbar-thumb {
    background: #d4d4d4;
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  &::-webkit-scrollbar-thumb:hover { background: #bcbcbc; background-clip: content-box; }
`;

// Right pane — categories / theme browser. Scrolls independently of the sidebar.
export const Content = styled.main`
  min-height: 0;
  overflow-y: auto;
  padding: clamp(22px, 3.4vw, 44px) clamp(20px, 3.4vw, 48px) 72px;
  animation: ${fadeIn} 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  &::-webkit-scrollbar { width: 11px; }
  &::-webkit-scrollbar-thumb {
    background: #d4d4d4;
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  &::-webkit-scrollbar-thumb:hover { background: #bcbcbc; background-clip: content-box; }
`;

// Section divider above the category grid — clarifies that the cards below are
// selectable categories (so the grid doesn't read as decorative tiles).
export const SectionLabel = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 4px 0 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${tokens.line};

  > span {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${tokens.ink2};
  }
`;

export const SectionHint = styled.span`
  font-size: 12.5px;
  color: ${tokens.faint};
`;

// ── Saved-design list rows (sidebar) ───────────────────────────────────────────
export const SavedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const SavedRow = styled.div`
  position: relative;
  display: flex;
  gap: 11px;
  padding: 9px;
  border-radius: 13px;
  border: 1.5px solid ${tokens.line};
  background: ${tokens.surface};
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;

  &:hover {
    border-color: #c4c4c4;
    background: ${tokens.surfaceAlt};
  }
  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: 2px;
  }
  ${(p) =>
    p.$busy &&
    css`
      opacity: 0.6;
      pointer-events: none;
    `}
`;

export const SavedThumb = styled.div`
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  border-radius: 9px;
  overflow: hidden;
  background: ${tokens.surfaceAlt};
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${tokens.line};

  img { width: 100%; height: 100%; object-fit: contain; }
  .placeholder { color: #c4c4c4; font-size: 24px; }
`;

export const SavedInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;

  .name {
    font-size: 13.5px;
    font-weight: 700;
    color: ${tokens.ink};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: ${tokens.muted};
  }
  .type {
    padding: 2px 7px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 10.5px;
    color: ${tokens.ink};
    background: ${tokens.primarySoft};
  }
  /* Size on its own line below the category, so it's easy to read. */
  .size {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    margin-top: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    color: ${tokens.ink2};
    background: ${tokens.surfaceAlt};

    svg { color: ${tokens.faint}; }
  }
`;

export const SavedDeleteBtn = styled.button`
  position: absolute;
  top: 7px;
  right: 7px;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid ${tokens.line};
  background: ${tokens.surface};
  color: ${tokens.muted};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.16s ease, background 0.15s, color 0.15s, border-color 0.15s;

  ${SavedRow}:hover & { opacity: 1; }
  &:hover { background: ${tokens.ink}; color: #fff; border-color: ${tokens.ink}; }
  &:focus-visible { opacity: 1; outline: 2px solid ${tokens.primary}; outline-offset: 2px; }
`;

export const SavedConfirm = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  font-size: 12px;
  color: ${tokens.ink2};

  button {
    border: none;
    border-radius: 7px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .yes { background: ${tokens.ink}; color: #fff; }
  .yes:hover { background: #000; }
  .no { background: ${tokens.hover}; color: ${tokens.ink2}; }
  .no:hover { background: #e6e6e6; }
`;

// Empty state for the saved-designs sidebar (compact, left-aligned to fit the
// narrow pane rather than the big centered StateViews block).
export const SavedEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 32px 14px;
  border: 1.5px dashed ${tokens.line};
  border-radius: 14px;
  background: ${tokens.surfaceAlt};

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: ${tokens.primarySoft};
    color: ${tokens.ink};
    font-size: 20px;
  }
  .title {
    font-size: 13.5px;
    font-weight: 700;
    color: ${tokens.ink2};
  }
  .text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: ${tokens.muted};
  }
`;

// ── Hero / breadcrumb ─────────────────────────────────────────────────────────
export const Hero = styled.div`
  margin-bottom: clamp(20px, 2.6vw, 30px);
`;

// Top row of the theme-browse hero: breadcrumb on the left, per-category search on
// the right, on a single line. Wraps to two rows on narrow screens.
export const HeroTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  flex-wrap: wrap;
  margin-bottom: 14px;

  /* Breadcrumb carries its own bottom margin for the stacked layout; HeroTop now
     owns the spacing below this row, so zero it here to keep the search centred. */
  > nav {
    margin-bottom: 0;
  }
`;

export const Breadcrumb = styled.nav`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  color: ${tokens.muted};
  flex-wrap: wrap;
`;

export const CrumbButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.ink};
  cursor: pointer;

  &:hover { text-decoration: underline; }
`;

export const CrumbCurrent = styled.span`
  color: ${tokens.ink2};
  font-weight: 600;
`;

export const Heading = styled.h1`
  margin: 0 0 7px;
  font-size: clamp(22px, 2.8vw, 30px);
  font-weight: 800;
  color: ${tokens.ink};
  letter-spacing: -0.6px;
`;

export const SubHeading = styled.p`
  margin: 0;
  font-size: clamp(13px, 1.4vw, 15px);
  color: ${tokens.muted};
  max-width: 620px;
  line-height: 1.55;

  strong { color: ${tokens.ink2}; font-weight: 700; }
`;

// ── Buttons ───────────────────────────────────────────────────────────────────
const buttonBase = css`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
`;

export const PrimaryButton = styled.button`
  ${buttonBase};
  padding: 9px 18px;
  color: #fff;
  border: 1px solid ${tokens.primary};
  background: ${tokens.primary};

  &:hover:not(:disabled) {
    background: ${tokens.primaryDark};
    border-color: ${tokens.primaryDark};
  }
`;

export const GhostButton = styled.button`
  ${buttonBase};
  padding: 8px 16px;
  color: ${tokens.ink2};
  background: ${tokens.surface};
  border: 1.5px solid ${tokens.line};

  &:hover:not(:disabled) {
    border-color: ${tokens.ink};
    color: ${tokens.ink};
    background: ${tokens.hover};
  }
`;

// ── Category grid ─────────────────────────────────────────────────────────────
export const CategoryGridEl = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(190px, 21vw, 240px), 1fr));
  gap: clamp(12px, 1.4vw, 16px);
`;

// A row-style card (icon left, text right) — denser and easier to scan than the
// old tall column card, which left big empty gaps under short descriptions.
export const CategoryCard = styled.button`
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 14px;
  text-align: left;
  padding: 16px 16px 16px 16px;
  background: ${tokens.surface};
  border: 1.5px solid ${tokens.line};
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.16s ease, border-color 0.16s ease;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${tokens.primary};
    opacity: 0;
    transition: opacity 0.18s ease;
  }

  &:hover {
    border-color: #c4c4c4;
    background: ${tokens.surfaceAlt};
  }
  &:hover::before { opacity: 1; }

  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: 2px;
  }
`;

export const CategoryIcon = styled.span`
  grid-row: span 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: ${tokens.primarySoft};
  color: ${tokens.ink};
  font-size: 20px;
  transition: transform 0.18s ease;

  ${CategoryCard}:hover & {
    transform: scale(1.05) rotate(-3deg);
  }
`;

export const CategoryTitle = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: ${tokens.ink};
  line-height: 1.2;
`;

export const CategoryDesc = styled.span`
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.45;
  color: ${tokens.muted};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

// Inline chevron that sits at the end of the title row; nudges on hover.
export const CategoryArrow = styled.span`
  flex: 0 0 auto;
  color: ${tokens.faint};
  transition: color 0.18s ease, transform 0.18s ease;

  ${CategoryCard}:hover & {
    color: ${tokens.ink};
    transform: translateX(3px);
  }
`;

// ── Per-category theme search ──────────────────────────────────────────────────
// Rendered inline with the breadcrumb (see HeroTop). Its value is forwarded into
// the getThemes API payload (see fetchThemesByCategory) so the backend filters the
// category's designs by the term.
export const ThemeSearch = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: clamp(200px, 32vw, 320px);
  max-width: 100%;

  .search-ico {
    position: absolute;
    left: 13px;
    color: ${tokens.faint};
    pointer-events: none;
  }
`;

export const ThemeSearchInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 0 38px 0 35px;
  border-radius: 999px;
  border: 1.5px solid ${tokens.line};
  background: ${tokens.surface};
  color: ${tokens.ink};
  font-size: 13.5px;
  transition: border-color 0.16s ease;

  &::placeholder { color: ${tokens.faint}; }
  &:focus {
    outline: none;
    border-color: ${tokens.ink};
  }
`;

export const ThemeSearchClear = styled.button`
  position: absolute;
  right: 7px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${tokens.muted};
  background: ${tokens.hover};
  transition: background 0.15s ease, color 0.15s ease;

  &:hover { background: #e6e6e6; color: ${tokens.ink}; }
  &:focus-visible { outline: 2px solid ${tokens.primary}; outline-offset: 2px; }
`;

// ── Theme grid ────────────────────────────────────────────────────────────────
export const ThemeGridEl = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 20vw, 210px), 1fr));
  gap: clamp(12px, 2vw, 20px);
`;

// The grid cell AND the visual card: border, radius and hover state live here
// (not on the inner button) so the clickable thumb/name region and the
// Download/Installed footer read as one unified card.
export const ThemeCardWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  background: ${tokens.surface};
  border: 1.5px solid ${tokens.line};
  border-radius: 16px;
  overflow: hidden;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: #c4c4c4;
  }
`;

// The clickable region (thumb + name). Borderless/transparent — the wrap carries
// the visual chrome. Opens the theme in the editor on click.
export const ThemeCard = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:disabled { cursor: default; }
  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: -2px;
  }
`;

export const ThemeThumb = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: ${tokens.surfaceAlt}
    ${(p) => (p.$src ? `url(${p.$src})` : "")} center / cover no-repeat;
`;

export const ThemeOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.55) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;

  ${ThemeCardWrap}:hover & { opacity: 1; }
`;

export const ThemeOverlayCTA = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #ffffff;
  color: ${tokens.ink};
  font-size: 12.5px;
  font-weight: 700;
  transform: translateY(8px);
  transition: transform 0.2s ease;

  ${ThemeCardWrap}:hover & { transform: translateY(0); }
`;

export const ThemeName = styled.span`
  padding: 11px 13px 10px;
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.ink2};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ── Card footer: the offline Download / Installed action ───────────────────────
// A full-width action pinned to the bottom of every card (margin-top:auto keeps
// it flush at the bottom even if a name wraps). It is a SIBLING of the card
// <button> (a button can't nest a button) inside the relative wrap.
export const ThemeCardFooter = styled.div`
  margin-top: auto;
  padding: 9px 10px 11px;
  border-top: 1px solid ${tokens.line};
`;

const themeActionBase = css`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;

  svg { flex: 0 0 auto; }
  &:focus-visible {
    outline: 2px solid ${tokens.primary};
    outline-offset: 2px;
  }
`;

// Default state — "Download" for offline use.
export const ThemeDownloadButton = styled.button`
  ${themeActionBase};
  color: ${tokens.ink};
  background: ${tokens.primarySoft};
  border: 1.5px solid ${tokens.line};

  &:hover:not(:disabled) {
    background: ${tokens.primary};
    color: #fff;
    border-color: ${tokens.primary};
  }
  &:disabled { opacity: 0.7; cursor: default; }
`;

// Downloaded state — "Installed", non-interactive (removal happens from the
// sidebar's Offline tab; when removed, downloadedIds updates and the card flips
// back to the Download button automatically).
export const ThemeInstalledButton = styled.button`
  ${themeActionBase};
  color: ${tokens.ink2};
  background: ${tokens.surfaceAlt};
  border: 1.5px solid ${tokens.line};
  cursor: default;

  &:disabled { cursor: default; }
`;

export const CardLoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  z-index: 4;
`;

// ── Skeleton (initial theme load) ─────────────────────────────────────────────
export const SkeletonCard = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 1.5px solid ${tokens.line};
  background: ${tokens.surface};

  &::before {
    content: "";
    display: block;
    aspect-ratio: 3 / 4;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 37%, #f2f2f2 63%);
    background-size: 840px 100%;
    animation: ${shimmer} 1.3s ease-in-out infinite;
  }
  &::after {
    content: "";
    display: block;
    height: 13px;
    margin: 12px 13px;
    border-radius: 6px;
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 37%, #f2f2f2 63%);
    background-size: 840px 100%;
    animation: ${shimmer} 1.3s ease-in-out infinite;
  }
`;

export const FooterLoader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 26px 0 8px;
  color: ${tokens.muted};
  font-size: 13px;
`;

export const EndNote = styled.div`
  text-align: center;
  padding: 24px 0 6px;
  color: ${tokens.faint};
  font-size: 12.5px;
`;
