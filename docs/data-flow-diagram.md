# Photo Editor Data Flow Diagram

This document illustrates the end-to-end data flow within the Photo Editor, from initialization to project export.

## Initialization & Theme Application

The following diagram tracks how a user visits the editor and how product data is hydrated into the Redux state.

```mermaid
graph TD
    %% Entry Point
    URL[URL Parameters: c_id, u_id, t_id] --> IP[useInitializeProject.js]
    
    %% Initialization Hook Logic
    IP -->|Fetch User| BE_USER[Backend: getUserDetails]
    IP -->|Fetch Brand| BE_BRAND[Backend: getBrandDetails]
    IP -->|Fetch Project/Cart| BE_PROJECT[Backend: getProjectDetails]
    
    BE_USER & BE_BRAND & BE_PROJECT -->|Dispatch| REDUX_PS[Redux: projectSetup.js]
    
    %% Theme Setup Hook Logic
    REDUX_PS -->|Observe| TS[useThemeSetup.js]
    TS -->|Fetch Theme JSON| BE_THEME[Backend: getThemeById]
    BE_THEME -->|Process Pages| PPP[service: theme/index.js]
    
    %% Canvas State Update
    PPP -->|Dispatch applyTheme| REDUX_CANVAS[Redux: canvas.js]
    REDUX_CANVAS -->|Notify| CANVAS_UI[Canvas.jsx Rendering]
    
    %% History Persistence
    REDUX_CANVAS -->|Wrapped| UNDO[redux-undo History]
```

---

## Editor Interaction & State Synchronization

How user actions on the canvas reach the Redux store and other components.

```mermaid
graph LR
    %% User Actions
    USER[User Action] -->|Drag/Resize/Text| CANVAS[Canvas.jsx]
    CANVAS -->|Dispatch Action| REDUX_CANVAS[Redux: canvas.js]
    
    %% Side Effects
    REDUX_CANVAS -->|Select Object| REDUX_APP[Redux: appAlice.js]
    REDUX_CANVAS -->|propagateTextGroupValue| MULTI_PAGE[All Pages sync Text]
    REDUX_CANVAS -->|markPageEdited| REDUX_SAVE[Redux: projectSetup.js]
    
    %% History
    REDUX_CANVAS -->|Record| UNDO_FUTURE[Redux: canvas.future]
    REDUX_CANVAS -->|Record| UNDO_PAST[Redux: canvas.past]
```

---

## Final Project Save & Export Pipeline

The complex process of serializing data for persistence and print generation.

```mermaid
graph TD
    %% Trigger
    HEADER[Header.jsx: Save/Order] -->|Trigger| GPP[getAllPagesToSave Helper]
    
    %% Serialization
    GPP -->|JSON Stringify| PAGES_JSON[Pages JSON String]
    PAGES_JSON -->|lz-string compress| PAGES_C[Compressed pages_c]
    
    %% SVG Capture Loop (Export)
    HEADER -->|setInitilized| SVG_SLICE[Redux: svgData.js]
    SVG_SLICE -->|Watcher| CANVAS_CAPTURE[Canvas.jsx: captureAllPagesSvg]
    
    CANVAS_CAPTURE -->|Loop| RENDER_PAGE[Render Page N]
    RENDER_PAGE -->|Serialize DOM| SVG_STR[SVG String]
    SVG_STR -->|Dispatch| SVG_CONTENT[Redux: svgData.svgContent]
    
    %% Submission
    PAGES_C & SVG_CONTENT -->|API Post| SAVE_PROJECT[Backend: saveProject Endpoint]
    SAVE_PROJECT -->|Success| UI_NOTIFY[Toast: Saved Successfully]
```

## Architectural Visual Map

![Software Architecture Diagram](file:///C:/Users/CODNIX/.gemini/antigravity/brain/6b42be89-0b34-4e68-b5c2-7b8ce27858a4/architecture_diagram_1775195799640.png)

---

## Object Hierarchy (JSON Structure)

A high-level view of how a single `page` is structured in the Redux store.

```mermaid
classDiagram
    class Project {
        +String editorType
        +Object canvasSize
        +Page[] pages
        +Object settings
        +Object calendarSettings
    }
    class Page {
        +String id
        +Number pageNumber
        +String title
        +Layout[] layout
        +Boolean isPageEdited
    }
    class Layout {
        +String id
        +Number width
        +Number height
        +Object background
        +Object[] objects
        +Object[] safeAreaObjects
    }
    class CanvasObject {
        +String id
        +String type (img, text, shape, sticker)
        +Object transform (x, y, scale, rotation)
        +Object props (src, font, color, opacity)
        +String groupKey (for Smart Text)
    }

    Project "1" *-- "many" Page
    Page "1" *-- "1..2" Layout
    Layout "1" *-- "many" CanvasObject
```

<!-- DOCS-INDEX:START -->
---

## 📚 All Documentation

> Every doc in `docs/` links to all the others. Session/performance docs (dated) also ship a styled `.html` twin.

- 🏛️ [Architecture](architecture.md)
- 🔍 [Codebase Analysis](codebase-analysis.md)
- 🔀 **Data Flow Diagram** — _you are here_
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
