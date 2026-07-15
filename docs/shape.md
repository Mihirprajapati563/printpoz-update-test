# Shape Object: `Shape.jsx`

The `Shape` component renders various vector shapes (Rectangles, Circles, Hearts, Stars, Triangles, etc.) on the canvas. It supports gradients, borders, and shadows.

## Core Features

- **Vectors**: All shapes are rendered as high-quality standard SVG elements (`<rect>`, `<circle>`, `<path>`, `<line>`).
- **Scaling**: Efficiently scales shapes from a base unit (usually 24x24) to the actual dimensions on the canvas.
- **Fill**: Supports solid colors and complex gradients (Linear and Radial).
- **Borders**: Customizable stroke color, width, and styles (solid, dashed).
- **Shadows**: Dynamic SVG filters for drop shadows.

## Supported Shapes

- **`rect`**: Standard rectangle, with support for rounded corners.
- **`circle`**: Standard circle using `cx`, `cy`, and `r`.
- **`heart`**, **`star`**, **`triangle`**, **`arrow`**: Custom SVG `<path>` data for complex geometries.
- **`line`**: Basic `<line>` connecting two points on the canvas.

## Methods & Logic

### `generateRoundedRectPath(width, height, radius)`
Calculates a mathematical path string for a rounded rectangle. This is used when the "shape" is `rect` and a `borderRadius` is applied.

### `getFillValue()`
Determines whether the shape should be filled with a solid color or a gradient. If a gradient is present, it returns the URL to the defined SVG gradient.

### `generateScaledClipPath(baseWidth, baseHeight, targetWidth, targetHeight)`
Maps a constant-unit path (e.g., a heart defined in 24x24 units) to the actual width and height of the canvas object.

## Gradients and Shadows

- **`GradientDef`**: Dynamically generates linear and radial SVG gradients based on the stops defined in the Redux store.
- **`BoxShadowItem`**: Generates a standard SVG `<filter>` for drop shadows, supporting `blurRadius`, `offsetX`, `offsetY`, and `floodColor`.

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
- 🔷 **Shape** — _you are here_
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
