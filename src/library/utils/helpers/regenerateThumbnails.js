// ── One-time thumbnail regeneration ─────────────────────────────────────────
// Saved-design thumbnails are produced by generateDesignThumbnail (→
// generatePageSvg) at save time and stored on the card. When that generator is
// improved — e.g. calendars used to render as a "Calendar" placeholder and now
// render a real month grid — designs saved BEFORE the change keep their stale
// thumbnail until the design is reopened + closed.
//
// This runs ONCE per account (guarded by a localStorage flag) from the Design
// Selection screen: it re-renders each card's thumbnail from its stored pages
// and writes it back via updateSavedDesignThumbnail, which preserves the card's
// name/date/order (thumbnail-only update). It is best-effort — any failure just
// leaves the old thumbnail (which still refreshes on the next reopen).

import {
  listSavedDesigns,
  getDesignById,
  updateSavedDesignThumbnail,
} from "./savedDesigns.js";
import { generateDesignThumbnail } from "./designThumbnail.js";

// Bump the version suffix if the generator changes again and existing cards need
// another one-time refresh. v2: calendar grid. v3: custom-product/print shape
// outline (empty shapes were invisible on the card).
const REGEN_FLAG_PREFIX = "saved_designs_thumb_regen_v3:";

const flagKeyFor = (accountId) => `${REGEN_FLAG_PREFIX}${accountId || "anon"}`;

const alreadyRegenerated = (accountId) => {
  try {
    return (
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem(flagKeyFor(accountId))
    );
  } catch (_) {
    return false;
  }
};

const markRegenerated = (accountId) => {
  try {
    if (typeof localStorage !== "undefined") {
      // App runtime (not a workflow sandbox) → Date.now is fine.
      localStorage.setItem(flagKeyFor(accountId), String(Date.now()));
    }
  } catch (_) {
    /* ignore */
  }
};

/**
 * Regenerate stale thumbnails for the CURRENT account's saved designs, once.
 * Resolves the number of thumbnails actually updated (0 if already done, none
 * stale, or on failure). Only writes when the freshly-rendered thumbnail differs
 * from the stored one, so unchanged designs cost a render but no disk write.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.accountId]  the current account id (scopes the run flag)
 * @param {boolean} [opts.force]      ignore the run flag (re-run even if done)
 */
export const regenerateStaleThumbnails = async ({ accountId, force = false } = {}) => {
  try {
    if (!force && alreadyRegenerated(accountId)) return 0;

    const metas = await listSavedDesigns();
    let updated = 0;

    // Sequential: a background one-off; avoids hammering IPC / IndexedDB.
    for (const meta of metas) {
      try {
        const entry = await getDesignById(meta.id);
        if (!entry || !Array.isArray(entry.pages) || entry.pages.length === 0) {
          continue;
        }
        const thumbnail = generateDesignThumbnail({
          pages: entry.pages,
          canvasSize: entry.canvasSize,
          editorType: entry.editorType,
          settings: entry.settings,
          calendarSettings: entry.calendarSettings,
        });
        if (thumbnail && thumbnail !== meta.thumbnail) {
          const ok = await updateSavedDesignThumbnail(meta.id, thumbnail);
          if (ok) updated += 1;
        }
      } catch (_) {
        /* skip this design; it will refresh on reopen */
      }
    }

    // Mark done only after a full pass (a mid-way throw leaves the flag unset so
    // the next visit retries the remainder).
    markRegenerated(accountId);
    return updated;
  } catch (_) {
    return 0;
  }
};

export default regenerateStaleThumbnails;
