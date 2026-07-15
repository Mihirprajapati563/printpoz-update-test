/**
 * Helper utilities for DOM-based SVG capture in Canvas component.
 * Extracted to keep Canvas.jsx clean and focused.
 */
import { EDITOR_TYPES } from "../constants/index.js";

/**
 * Creates a page render waiter that can be used to wait for specific pages to finish rendering.
 * Returns methods to wait for a page and notify when a page is rendered.
 */
export function createPageRenderWaiter() {
  let waiters = [];

  const waitForPageRender = (targetPageIndex) => {
    return new Promise((resolve) => {
      const finishOnNextFrame = () => requestAnimationFrame(() => resolve());

      // Register a waiter for the target page
      let timeoutId;
      const waiter = {
        pageIndex: targetPageIndex,
        resolve: () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          finishOnNextFrame();
        },
      };

      // Safety timeout in case page never renders (reduced for faster capture)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const timeout = isMobile ? 2000 : 1000;
      
      timeoutId = setTimeout(() => {
        waiters = waiters.filter((pending) => pending !== waiter);
        finishOnNextFrame();
      }, timeout);

      waiters.push(waiter);
    });
  };

  const notifyPageRendered = (pageIndex) => {
    if (!waiters.length) {
      return;
    }

    const remainingWaiters = [];
    waiters.forEach((waiter) => {
      if (waiter.pageIndex === pageIndex) {
        waiter.resolve();
      } else {
        remainingWaiters.push(waiter);
      }
    });
    waiters = remainingWaiters;
  };

  const cleanup = () => {
    waiters.forEach((waiter) => waiter.resolve());
    waiters = [];
  };

  return {
    waitForPageRender,
    notifyPageRendered,
    cleanup,
  };
}

/**
 * Determines which pages to capture based on the capture mode.
 * 
 * @param {Object} options
 * @param {Array} options.pages - All pages from Redux
 * @param {boolean} options.editedPagesOnly - Whether to capture only edited pages
 * @param {boolean} options.forceFullCapture - Whether to force a full capture
 * @param {Array} options.existingSvgContent - Existing SVG content array from Redux
 * @returns {Array<number>} Array of page indexes to capture
 */
export function preparePagesToCapture({
  pages,
  editedPagesOnly,
  forceFullCapture,
  existingSvgContent,
  settings = {},
  editorType = null,
}) {
  const totalPages = pages.length;
  let pagesToCapture = [];

  if (editedPagesOnly) {
    // Only capture pages where isPageEdited === true
    pagesToCapture = pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => page.isPageEdited === true)
      .map(({ index }) => index);

    // If no pages are edited, capture all pages as fallback
    if (pagesToCapture.length === 0) {
      pagesToCapture = Array.from({ length: totalPages }, (_, i) => i);
    }
  } else {
    // Capture all pages
    pagesToCapture = Array.from({ length: totalPages }, (_, i) => i);
  }

  // Filter out pages that already have SVG data (unless forcing full capture or edited-only mode)
  if (!forceFullCapture && !editedPagesOnly && existingSvgContent) {
    pagesToCapture = pagesToCapture.filter((pageIndex) => {
      const existingSvg = existingSvgContent.find((s) => s.pageIndex === pageIndex);
      return !existingSvg;
    });
  }

  // Skip the last page when hideLastCover is enabled. Photobook: always.
  // Layflat: only when a separate back cover exists (coverEnabled && !showFullCoverSheet).
  const hidesLastCover =
    settings?.hideLastCover &&
    totalPages > 0 &&
    (editorType === EDITOR_TYPES.PHOTOBOOK ||
      (editorType === EDITOR_TYPES.LAYFLATALBUM &&
        settings?.coverEnabled &&
        !settings?.showFullCoverSheet));
  if (hidesLastCover) {
    pagesToCapture = pagesToCapture.filter((pageIndex) => pageIndex !== totalPages - 1);
  }

  return pagesToCapture;
}
