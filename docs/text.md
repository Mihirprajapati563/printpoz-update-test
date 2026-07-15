# Text Object: `Text.jsx`

The `Text` component handles rich text rendering, inline editing, and typography in the editor. It supports multi-line text, custom fonts, and dynamic content like calendar months and years.

## Core Features

- **Rendering**: Uses SVG `<foreignObject>` to host a `contentEditable` div, providing native-like text layout and wrapping.
- **Inline Editing**: Allows users to double-click on a text object and edit the content directly on the canvas.
- **Rich Text Support**: Supports bold, italic, underline, and color through HTML/CSS within the `contentEditable` div.
- **Typography Logic**: Manages font families, font sizes, weights, styles, and alignment (Horizontal and Vertical).
- **Auto-Resize**: Automatically adjusts the object's height and width based on the content and font size.
- **Calendar Subtypes**: Dynamically updates its content for `month` and `year` subtypes based on calendar settings.

## Methods & Logic

### `getTextGradientStyle()`
Calculates the CSS style for text gradients. It supports both linear and radial gradients, using `WebkitBackgroundClip: "text"` to apply the gradient to the text content.

### `handleInput(e)`
Updates the Redux store in real-time as the user types, capturing both plain text and rich text (HTML).

### `handleBlur(e)`
Finalizes the editing process and saves the final content to the store.

### `handleKeyDown(e)`
Handles custom keyboard navigation, specifically fixing the issue where Arrow keys don't correctly move the caret across lines in a `foreignObject` based `contentEditable`.

### `getMonthYear(startMonth, startYear, pageIndex)`
Calculates the specific month and year for a text object based on the calendar's starting point and the page index.

## Rendering Versions

- **Legacy Renderer (Version 1)**: Simple SVG `<text>` based rendering with limited multi-line support.
- **New Renderer (Version 2+)**: `foreignObject` based rendering for full CSS support, word wrapping, and rich formatting.

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
- 🔤 **Text** — _you are here_
- 📱 [React Native Migration Plan](react-native-migration-plan.md)
- ⬆️ [Upload Pipeline](upload-pipeline.md)
- 📝 [Session: Upload Pipeline Rework (2026-06-12)](session-2026-06-12-upload-pipeline-rework.md)
- 🖼️ [Image Loading Optimization (2026-06-16)](image-loading-optimization-2026-06-16.md)
- 🎯 [Canvas Interaction Performance (2026-06-16)](canvas-interaction-performance-2026-06-16.md)
- 📐 [Resize Imperative Performance (2026-06-16)](resize-imperative-performance-2026-06-16.md)
- 🅿️ [Photobook Full Cover Sync (2026-06-19)](photobook-full-cover-sync-2026-06-19.md)
- 🗂️ [Photos Gallery Order & Preview (2026-06-19)](photos-gallery-order-and-preview-2026-06-19.md)
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
