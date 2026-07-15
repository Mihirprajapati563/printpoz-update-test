# Multi-Object Selection Architecture & Plan

## Overview
The goal is to introduce multi-object selection to the SVG/React-based canvas editor. Currently, the editor uses a single `activeObject` pattern. The change will allow users to shift-click or use a drag-to-select lasso tool to highlight multiple items. These items can then be moved, scaled, rotated, or deleted together.

## The Strategy
To minimize breakage of the existing single-selection components (like formatting toolbars, image crops, and text style pickers), we will use a **parallel state strategy** alongside leveraging native capabilities in the `react-moveable` library.

### 1. Parallel State Management (`activeObjects`)
Instead of completely rewriting the Redux state to abandon the single `activeObject`, we will introduce a new array: `activeObjects`. 
- **Single Selection:** If `activeObjects.length <= 1`, the editor behaves exactly as it does today, utilizing the `activeObject` variable. All existing property toolbars remain active and functional.
- **Multiple Selection:** If `activeObjects.length > 1`, the editor enters "Multi-Select Mode." The generic single `activeObject` evaluates to `null` to hide specific toolbars (Text settings, Masking, Cropping). A custom multi-selection toolbar will appear instead for bulk operations (Alignment, Layering, Deleting).

### 2. Group Math via `react-moveable`
Currently, `ItemDragger.jsx` handles bounding boxes and resize transformations for single elements via `react-moveable`.
Fortunately, `react-moveable` supports multi-target group manipulations out of the box. 
Instead of writing complex math for scaling bounding boxes and using trigonometry to compute rotation for inner elements relative to a group center, we will:
- Pass an array of DOM targets (`activeObjects.map(obj => DOM_NODE)`) to the `<Moveable />` component.
- Implement the library's `onDragGroup`, `onResizeGroup`, and `onRotateGroup` handlers.
- Loop through the `events` array provided inside those handlers to dispatch batched payload updates to Redux (`updateMultipleObjects` action).

### 3. Selection Iteractions
- **Shift+Click:** Pass the `e.shiftKey` flag from the `onMouseDown` handler of `Canvas.jsx` > `Photo.jsx` / `Text.jsx` elements to Redux. If `shiftKey` is true, the `setActiveObject` reducer appends the newly clicked item to `activeObjects` instead of replacing the array.
- **Lasso Tool (Optional but Recommended):** Use a drag-select overlay on the canvas. When dragging on the SVG background (not an object), draw a `rect`. On `mouseUp`, iterate over all items on the `activePage` and calculate geometric intersections against the drawn `rect` to populate `activeObjects`.

## Action Plan (Checklist)

1. **Redux Refactor (`src/store/slices/canvas.js`)**
   - Define `activeObjects: []` in the initial state.
   - Refactor `setActiveObject(payload)` to listen for a `isShiftPressed` flag to add/remove IDs from `activeObjects`.
   - Create a reducer `updateMultipleObjects` to bulk apply x, y, rotation, scale, width, and height adjustments to the items array. 
   - Ensure these bulk operations map cleanly for `redux-undo`.

2. **Component Updates**
   - `src/components/canvas/Canvas.jsx`: Hook mouse events for drawing the selection `rect` on the background.
   - `src/components/canvas/Photo.jsx`, `Text.jsx`, etc.: Add `isShiftPressed` logic to `handleMouseDown`.

3. **Dragger Updates (`src/components/canvas/ItemDragger.jsx`)**
   - Feed `activeObjects` into the `target` parameter of `<Moveable />`.
   - Implement group transform event handlers (`onDragGroup`, `onResizeGroup`, `onRotateGroup`) by parsing the array of emitted transformations and pushing them to Redux.

4. **Multi-Selection Toolbar**
   - Create or update the object-settings sidebar (`ObjectSettingAction.jsx`) to handle the case where `activeObjects.length > 1`, revealing alignment tools or bulk delete actions in place of singular item styles.
