# Photo Object: `Photo.jsx`

The `Photo` component is used to render image layers and placeholders in the canvas. It provides advanced features like non-destructive cropping, SVG masking, and digital filters.

## Core Features

- **Rendering**: Uses SVG `<image>` within a `<foreignObject>` or standard SVG layout.
- **Cropping (Pan/Zoom)**: Allows users to "pan" images within their frames using a custom `ItemDragger` or dedicated crop handles.
- **SVG Masking**: Supports complex shapes (Circles, Stars, Custom paths) using SVG `<clipPath>`.
- **Placeholder Mode**: Renders a dedicated UI when no image is assigned to the frame.
- **Border & Shadow**: Includes dynamic paths for rendering rounded borders and SVG drop filters.

## Methods & Logic

### `generateRoundedRectPath(width, height, radius)`
A utility function that mathematically generates a `<path>` string for a rounded rectangle. This is used for both clipping and border drawing.

### `generateScaledClipPath(baseWidth, baseHeight, targetWidth, targetHeight)`
Calculates the scaling factor between a mask's original units (usually 24x24) and the actual canvas size of the object.

### `handleMouseDown(e)`
Manages the internal "panning" (moving the image inside its frame) by updating the `image.positionX` and `image.positionY` properties in the store.

## Digital Filters (GLSL-style)

Digital filters are applied using SVG `<filter>` and `<feColorMatrix>`. Current supported filters include:
- **`grayscale`**: Saturate at 0.
- **`sepia`**: Custom 5x4 matrix.
- **`bw`**: High-contrast black and white matrix.
- **`blur`**: `feGaussianBlur`.
- **`invert`**, **`hue-rotate`**: Calculated matrix transforms.

### Dynamic Adjustments
The `getFilter2` function supports real-time **Brightness**, **Contrast**, and **Saturation** adjustments using `feComponentTransfer` and `feColorMatrix`.

## Print Quality Check

The `checkImagePrintQuality` utility handles the logic to calculate the **DPI (Dots Per Inch)** for the image based on its source resolution, the canvas size, and the current zoom level. It provides feedback (Good, Low, Poor) to the user via UI warnings.

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ [Architecture](architecture.md)
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 [Data Flow Diagram](data-flow-diagram.md)
- 🖌️ [Canvas](canvas.md)
- ✋ [Interaction](interaction.md)
- 📷 **Photo** — _you are here_
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
- 💾 [Customer Auto-Save Activity Gate (2026-06-19)](customer-autosave-activity-gate-2026-06-19.md)
- 📏 [Canvas Rulers (2026-06-24)](canvas-rulers-2026-06-24.md)
<!-- DOCS-INDEX:END -->
