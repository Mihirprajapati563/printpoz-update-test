# Interaction & Transformations: `ItemDragger.jsx`

The `ItemDragger` component is responsible for the interaction layer of the canvas, specifically handling object selection, movement, resizing, and rotation. It integrates the **`react-moveable`** library to provide standard UI handles for object manipulation.

## Core Responsibilities

1.  **Selection Feedback**: Displays the selection bounding box and handles for active objects.
2.  **Transformations**:
    - **Draggable**: Moving objects on the X and Y axes.
    - **Resizable**: Changing object width and height.
    - **Rotatable**: Rotating objects in degrees.
3.  **Multi-Selection**: Supports simultaneous manipulation of multiple objects (group move, group resize, group rotate).
4.  **Snap Guidelines**: Provides visual indicators (snap lines) when objects align with each other or canvas boundaries.
5.  **Undo/Redo Integration**: Commits history checkpoints when a transformation gesture ends.

## Key Logic & Events

### `onDrag`, `onResize`, `onRotate`
These handlers are triggered by `react-moveable` as the user interacts with the handles. They calculate the new target values (X, Y, Width, Height, Rotation) and update the Redux store in real-time.

### `onRenderGroup`
A specialized handler for multi-select mode. it iterates through the `events` array provided by `react-moveable` to update the transformation of each selected object individually within a single batch update.

### `updatePopoverPosition()`
Calculates the on-screen position for the floating "Object Settings" popover (e.g., Delete, Duplicate, Crop) so it stays centered above or below the active object as it moves or resizes.

### `handleKeyPress(event)`
Listens for keyboard shortcuts:
- **Arrow Keys**: Fine-tuning object position (1px or 10px with Shift).
- **Control + A**: Select all objects on the current page.
- **Delete / Backspace**: Remove the active object.
- **`[` and `]`**: Rotate the object in 1-degree increments.

## Coordinate Space

Since `react-moveable` works in **viewport coordinates (pixels)** and the canvas uses **logical coordinates**, `ItemDragger` performs constant mapping to ensure objects move the correct distance regardless of the current **zoom ratio**.

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ [Architecture](architecture.md)
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 [Data Flow Diagram](data-flow-diagram.md)
- 🖌️ [Canvas](canvas.md)
- ✋ **Interaction** — _you are here_
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
