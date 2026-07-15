# Sticker Object: `Sticker.jsx`

The `Sticker` component renders cliparts and decorative elements on the canvas. It supports both SVG and raster (PNG/JPG) formats, providing high-quality rendering and basic effects.

## Core Features

- **Multi-Format Support**:
    - **SVG**: Uses a custom `SVGRenderer` component to render vector clipart directly in the SVG DOM. This maintains quality at any zoom level.
    - **Raster (PNG/JPG)**: Uses the standard SVG `<image>` element for bitmap-based stickers.
- **Transformations**: Supports flipping (Horizontal and Vertical) using SVG `transform` attributes.
- **Effects**: Supports basic SVG filters:
    - `bw` (Black & White)
    - `blur`
    - `grayscale`
    - `sepia`
    - `invert`
    - `hue-rotate`
- **Shadows**: Dynamic SVG `<feDropShadow>` filters for adding depth to stickers.
- **Masking**: Supports clipping stickers into specific shapes (though usually stickers are rendered as-is).

## Methods & Logic

### `SVGRenderer` Integration
For SVG-based stickers, the component uses `SVGRenderer` with `renderAs="foreignObject"`. This allows the sticker's internal SVG structure to be parsed and rendered as part of the canvas, which is essential for high-quality PDF exports.

### `getFilter(effect, id)`
A utility that returns the appropriate SVG `<filter>` definition based on the selected effect. This is similar to the Photo component but optimized for stickers.

### `BoxShadowItem`
Generates an SVG `<filter>` specifically for the sticker object, allowing for customizable `blurRadius`, `offsetX`, `offsetY`, and `floodColor`.

## Export Behavior

When exporting to SVG/PDF:
- Raster stickers are embedded as base64 or linked URLs.
- Vector stickers (SVGs) are serialized as part of the page's SVG tree, ensuring they remain vector-sharp in the final print file.

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
- ⭐ **Sticker** — _you are here_
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
