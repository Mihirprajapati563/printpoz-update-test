/**
 * Cover & Spine settings — shared config for the setup dialogs.
 *
 * These are the cover-related admin settings (the cover subset of
 * `globalSettingJSON` in commonJSON.js) surfaced in CreateThemeDialog and
 * SizeSettingsPopup so a theme's cover behaviour can be configured up front,
 * not only from the admin Settings panel.
 *
 * There is intentionally NO "hide both covers" toggle — the only back-cover
 * control the reducer understands is `hideLastCover` ("Hide Back Cover").
 *
 * Both dialogs stage these flags in local state and dispatch `setSettings`
 * once (SizeSettingsPopup via its per-size Apply, CreateThemeDialog on save).
 * `setSettings` reconciles the page array live, but staged local state does
 * NOT — so `reconcileCoverSettings` mirrors the reducer's interdependencies in
 * the UI, keeping the toggles in sane combinations before we dispatch.
 */

import { EDITOR_TYPES } from "../constants/index.js";

// Cover toggle definitions per editor type. `dependsOn` gates visibility the
// same way admin's `dependentSetting` does — a toggle only shows when its
// dependency is enabled. Order controls render order.
export const COVER_TOGGLES = {
  [EDITOR_TYPES.PHOTOBOOK]: [
    {
      key: "showFullCoverSheet",
      title: "Full Cover Spread",
      instruction:
        "Display the front cover as a full-width spread. Automatically hides the back cover and enables the spine.",
    },
    {
      key: "hideLastCover",
      title: "Hide Back Cover",
      instruction: "Hide the back cover page in the preview and editor.",
    },
    {
      key: "exportSpine",
      title: "Export Spine",
      dependsOn: "showFullCoverSheet",
      instruction: "Include the spine area in the exported file.",
    },
  ],
  [EDITOR_TYPES.LAYFLATALBUM]: [
    {
      key: "coverEnabled",
      title: "Enable Cover Page",
      instruction: "Allow designing on the cover page.",
    },
    {
      key: "showFullCoverSheet",
      title: "Full Cover Spread",
      dependsOn: "coverEnabled",
      instruction:
        "Display the full cover as a single spread and enable the spine.",
    },
    {
      key: "hideLastCover",
      title: "Hide Back Cover",
      dependsOn: "coverEnabled",
      instruction: "Hide the back cover page in the preview and editor.",
    },
    {
      key: "exportSpine",
      title: "Export Spine",
      dependsOn: "showFullCoverSheet",
      instruction: "Include the spine area in the exported file.",
    },
  ],
};

export const COVER_SETTINGS_KEYS = [
  "coverEnabled",
  "showFullCoverSheet",
  "hideLastCover",
  "exportSpine",
];

export const supportsCoverSettings = (editorType) =>
  editorType === EDITOR_TYPES.PHOTOBOOK ||
  editorType === EDITOR_TYPES.LAYFLATALBUM;

// Read the cover flags out of a Redux `settings` object into a flat local
// state shape. Missing keys default to false.
export const readCoverSettings = (settings = {}) => ({
  coverEnabled: settings.coverEnabled === true,
  showFullCoverSheet: settings.showFullCoverSheet === true,
  hideLastCover: settings.hideLastCover === true,
  exportSpine: settings.exportSpine === true,
});

// Whether a toggle should be visible given the current cover state (mirrors
// admin's `dependentSetting` gating).
export const isCoverToggleVisible = (toggle, state) =>
  !toggle.dependsOn || state[toggle.dependsOn] === true;

/**
 * Apply one cover-toggle change and re-derive the dependent flags, mirroring
 * the `setSettings` reducer's interdependencies (canvas.js):
 *   - Full cover ON  ⟹ back cover hidden (+ layflat: cover page enabled).
 *   - Full cover OFF ⟹ spine export off; back cover restored.
 *   - Hide-back-cover OFF while full cover ON ⟹ exits full cover.
 *   - Cover page OFF (layflat) ⟹ full cover / hide-back / spine all off.
 *   - Spine export requires full cover.
 */
export const reconcileCoverSettings = (editorType, state, key, value) => {
  const isLayflat = editorType === EDITOR_TYPES.LAYFLATALBUM;
  const next = { ...state, [key]: value };

  if (key === "coverEnabled" && isLayflat && value === false) {
    next.showFullCoverSheet = false;
    next.hideLastCover = false;
    next.exportSpine = false;
  }

  if (key === "showFullCoverSheet") {
    if (value) {
      next.hideLastCover = true;
      if (isLayflat) next.coverEnabled = true;
    } else {
      next.hideLastCover = false;
      next.exportSpine = false;
    }
  }

  if (key === "hideLastCover" && value === false && next.showFullCoverSheet) {
    // Full cover already contains the back cover, so un-hiding it exits full
    // cover (and its spine export) — the same rule the reducer enforces.
    next.showFullCoverSheet = false;
    next.exportSpine = false;
  }

  // Spine export can never be on without a full-cover spread.
  if (!next.showFullCoverSheet) next.exportSpine = false;

  return next;
};
