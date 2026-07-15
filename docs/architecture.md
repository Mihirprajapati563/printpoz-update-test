# Photo Editor Canvas Architecture

This document provides a high-level overview of the SVG-based canvas engine used in the Web Photo Editor.

## System Overview

The editor is built using **React**, **Redux**, and **SVG**. It uses a declarative approach where the Redux store represents the mathematical state of the project, and the `Canvas` component renders this state into an interactive SVG.

### Key Technologies
- **SVG**: Used for the primary rendering layer. It provides precise coordinate control and high-quality vector output.
- **Redux (RTK)**: Manages all project data, including pages, objects, and global settings.
- **redux-undo**: Enables a robust history system (Undo/Redo) across the entire canvas state.
- **react-moveable**: Power the transformation handles (Resize, Rotate, Drag) for canvas objects.

## Data Flow

1.  **Store**: The `canvas` slice contains an array of `pages`. Each page has an array of `objects`.
2.  **State → UI**: The `MainCanvas` component selects the current page objects and maps them to specific React components (`Photo`, `Text`, `Shape`, `Sticker`).
3.  **UI → Action**: User interactions (dragging, typing, clicking) trigger Redux actions that update object properties (X, Y, Width, Height, etc.).
4.  **Re-render**: React updates only the changed SVG elements, ensuring high performance.

## Coordinate System

The canvas operates on a **Local Coordinate System** defined by the project size (e.g., 800x600 pixels). 
- **Zoom**: Handled by applying a `scale` to the parent Container, while the internal SVG uses its `viewBox` more for framing.
- **Coordinate Mapping**: The `toCanvasCoords` function in `Canvas.jsx` converts global mouse/touch coordinates (viewport) into the canvas-local space by accounting for the SVG's `getBoundingClientRect` and the current `zoomRatio`.

## Z-Index Management

Z-index is managed by the order of elements in the Redux `objects` array.
- Objects at the end of the array are rendered "on top".
- Moving an object "Forward" or "Backward" simply changes its index in the array.

## Serialization & Export

The canvas can be serialized into a high-resolution SVG string for printing or PDF generation. This process involves:
1.  Cloning the current SVG DOM.
2.  Removing UI-only elements (like selection handles or dragger icons).
3.  Embedding external assets (like fonts or images).
4.  Serializing the resulting DOM into an SVG string.

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ **Architecture** — _you are here_
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 [Data Flow Diagram](data-flow-diagram.md)
- 🖌️ [Canvas](canvas.md)
- ✋ [Interaction](interaction.md)
- 📷 [Photo](photo.md)
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
