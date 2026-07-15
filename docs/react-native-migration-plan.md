# React Native Migration — Implementation Plan

## Language Choice: TypeScript

Use TypeScript. The codebase's Redux store (`canvas.js` at 194KB) and complex object model (pages → layouts → objects with many subtypes) benefit enormously from typed interfaces. Type safety on `pages[].layout[].objects[]` discriminated unions (`type: "img" | "text" | "shape" | "sticker" | "calendar"`) prevents an entire class of bugs during migration. Adopt incrementally with `allowJs: true`.

---

## How Pages and Objects Are Parsed (Current Architecture)

Understanding the two distinct entry points:

### 1. Data Entry Point (Initialization)

```
URL params (c_id, t_id)
  → useInitializeProject    fetch brand/user/project from API
  → useThemeSetup           fetch theme JSON, run processProjectPages
  → processProjectPages     map theme layouts → Redux page/object model
  → Redux (canvas.js)       pages[] stored, compressed via lz-string on save
```

`processProjectPages` is pure business logic with no DOM dependency → goes into `packages/shared` unchanged.

### 2. Render Entry Point (Canvas)

```
Redux pages[]
  └── layout[]              (0 = left side, 1 = right side for spreads)
        ├── background       { color, image, gradient, isSpread, flip }
        ├── objects[]        [{ id, type, transform: {x,y,rotation}, width, height, ...type-specific }]
        └── safeAreaObjects[]

Canvas.jsx → SVG viewport (viewBox="0 0 canvasWidth canvasHeight")
  ↓ iterates currentActivePageObjects (merged from layout[0] + layout[1])
  ↓ per object type:
    type="img"               → Photo.jsx       (SVG <g> + <foreignObject><img> + clip paths + SVG filters)
    type="text"              → Text.jsx        (SVG <foreignObject><div contentEditable>)
    type="shape"             → Shape.jsx       (SVG <path>)
    type="sticker"           → Sticker.jsx     (SVG <image>)
    type="calendar"          → DynamicCalendar.jsx  (SVG <text> + <rect> grids)
```

This rendering loop must be fully rewritten with Skia for React Native.

### Redux Object Model (TypeScript interfaces)

```ts
type ObjectType = "img" | "text" | "shape" | "sticker" | "calendar" | "multiple-calendar"

interface CanvasObject {
  id: string
  type: ObjectType
  transform: { x: number; y: number; rotation: number }
  width: number
  height: number
  zIndex: number
  opacity: number
}

interface ImgObject extends CanvasObject {
  type: "img"
  url: string
  masking?: { path: string }
  effects?: { brightness: number; contrast: number; saturation: number; blur: number }
  border?: { width: number; color: string; radius: number }
  shadow?: { x: number; y: number; blur: number; color: string }
  flip?: { h: boolean; v: boolean }
}

interface TextObject extends CanvasObject {
  type: "text"
  content: string
  font: { id: string; family: string; size: number; weight: string; style: string }
  color: string
  gradient?: GradientConfig
  alignment: "left" | "center" | "right"
  subtype?: "month" | "year"   // calendar text boxes
}

interface ShapeObject extends CanvasObject {
  type: "shape"
  fill: string
  gradient?: GradientConfig
  stroke?: { width: number; color: string }
}

interface StickerObject extends CanvasObject {
  type: "sticker"
  svgData?: string
  url?: string
}

interface Layout {
  id: string
  background: {
    color?: string
    image?: string
    gradient?: GradientConfig
    isSpread?: boolean
    flip?: boolean
    bg_id?: string
  }
  objects: CanvasObject[]
  safeAreaObjects?: CanvasObject[]
}

interface Page {
  id: string
  pageNumber: number
  layout: Layout[]           // layout[0] = left/back, layout[1] = right/front
  settings?: {
    onlyAllowObjectInSafeArea?: boolean
    isHalfSheet?: boolean
  }
}
```

---

## Phase 0 — Foundation & Tooling (Week 1–2)

### 0.1 Project Bootstrap
```bash
npx create-expo-app photo-editors-native --template expo-template-blank-typescript
```
Install core deps:
- `@shopify/react-native-skia` — primary rendering engine
- `react-native-svg` — fallback for simple SVG stickers
- `@reduxjs/toolkit`, `react-redux`, `redux-undo` — same store setup
- `react-navigation` — routing
- `react-native-gesture-handler`, `react-native-reanimated` — touch handling
- `@gorhom/bottom-sheet` — tool panels
- `expo-font`, `expo-image-picker`, `expo-clipboard`, `expo-auth-session`

### 0.2 Monorepo Setup (Turborepo)
```
photo-editors/
  packages/
    shared/              ← framework-agnostic, TypeScript
      store/slices/      ← all Redux slices (no DOM imports)
      utils/constants/   ← constants, API URLs
      utils/helpers/     ← selectors, alignment, gradient utils
      utils/common-functions/  ← calc, unitConversion, fontParser
      utils/jsons/       ← defaultObjects.js
      types/             ← NEW TypeScript interfaces (see above)
    web/                 ← existing React app (imports from shared/)
    native/              ← new Expo app (imports from shared/)
```

**Audit task**: Every file moved to `shared/` must be checked for `window`, `document`, `localStorage` — stub or replace each.

### 0.3 Coordinate System Contract
The current editor uses a fixed SVG viewBox (e.g., 2400×1200px) scaled via CSS transform. In RN, replicate with:
```ts
const scale = screenWidth / canvasSize.width
// All object positions use canvas-space coords
// Rendered via Skia transform matrix: scale(scale, scale)
```
This is the foundation all rendering components depend on — define it first.

---

## Phase 1 — Rendering Engine (Week 3–6)

### 1.1 Rendering Backend Decision

Use **`@shopify/react-native-skia`** as primary renderer.

| Option | Pros | Cons |
|---|---|---|
| **react-native-skia** ✓ | GPU-accelerated, full ColorMatrix filters, clip paths, Paragraph text, gradients | Newer API, larger binary |
| react-native-svg | Familiar SVG-like API | No filters, no foreignObject, no editable text |
| react-native-canvas | Closest to HTML canvas | Imperative, hard to integrate with React |

### 1.2 Object Renderer Map

| Web Component | RN Component | Key Translation |
|---|---|---|
| `Canvas.jsx` | `SkiaCanvas.tsx` | Skia `<Canvas>` + coordinate transform matrix |
| `Photo.jsx` | `SkiaPhoto.tsx` | `<SkImage>` + `<ColorMatrix>` filter + `<Path>` clip |
| `Text.jsx` | `SkiaText.tsx` | `<Paragraph>` (display) + `<TextInput>` overlay (edit) |
| `Shape.jsx` | `SkiaShape.tsx` | `<Path>` with fill/stroke props |
| `Sticker.jsx` | `SkiaSticker.tsx` | `<SkImage>` or SVG path via `Skia.Path.MakeFromSVGString` |
| `DynamicCalendar.jsx` | `SkiaCalendar.tsx` | `<RoundedRect>` + `<Text>` grid in Skia |

### 1.3 Image Filters (Photo.jsx → SkiaPhoto.tsx)
Current `Photo.jsx` uses `<feColorMatrix>` / `<feComponentTransfer>`. Skia equivalent:
```ts
<ColorMatrix
  matrix={buildColorMatrix({
    brightness: effects.brightness,
    contrast: effects.contrast,
    saturation: effects.saturation,
  })}
/>
```
Write `buildColorMatrix()` that converts the existing 0–200 scale to a 4×5 Skia color matrix.

### 1.4 Clip Paths / Masking
`Photo.jsx` uses SVG `<clipPath>` with path strings. Skia:
```ts
<Clip path={Skia.Path.MakeFromSVGString(object.masking.path)}>
  <SkImage image={loadedImage} ... />
</Clip>
```

### 1.5 Background Rendering
Per layout side, read `background.color / .gradient / .image`:
- Color → `<Rect color={bg.color} />`
- Gradient → `<Rect><LinearGradient .../></Rect>`
- Image (spread) → single `<SkImage>` spanning full canvas width (same continuous-spread logic as web)

---

## Phase 2 — Text Editing (Week 5–7)

The hardest single problem. `Text.jsx` uses `<foreignObject><div contentEditable>` — no RN equivalent.

### Two-Layer Strategy

1. **Display layer**: Skia `<Paragraph>` renders styled text at all times (correct fonts, colors, gradients, shadows)
2. **Edit layer**: On double-tap, mount a transparent `<TextInput>` positioned absolutely at exact screen coordinates; sync to Redux on every keystroke; unmount on blur

```
Double tap on text object
  → mount TextInput overlay at (transform.x * scale, transform.y * scale)
  → TextInput.onChange → dispatch setCurrentObjectProperties({ content })
  → Skia Paragraph re-renders from Redux state
  → tap away → unmount TextInput
```

### Font System
- Replace `FontContext` web font loading with `expo-font`
- Skia loads fonts via `matchFont()` — integrate with the same font ID system in Redux
- Bundle standard fonts; fetch custom fonts from the same API endpoint

### Rich Text
The existing model stores mixed styles. Map to Skia `ParagraphBuilder`:
```ts
const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontManager)
spans.forEach(span => {
  builder.pushStyle({ color: Skia.Color(span.color), fontStyle: ... })
  builder.addText(span.text)
  builder.pop()
})
```

---

## Phase 3 — Interaction Layer (Week 6–8)

### 3.1 Touch Handling
Replace `react-moveable` and SVG mouse events:
- `react-native-gesture-handler` — tap, long-press, pan, pinch
- `react-native-reanimated` — smooth animated transforms

| Gesture | Action |
|---|---|
| Tap on object | `dispatch(setActiveObject(id))` |
| Pan on object | Update `transform.x/y` with `history: false` during drag; commit on release |
| Pinch on object | Update `width/height` |
| Double tap on text | Activate text edit layer |
| Two-finger pinch on empty canvas | Update zoom / pan offset |
| Tap empty canvas | `dispatch(setActiveObject(null))` |

### 3.2 Selection UI
Render selection handles as absolute-positioned `View` components on top of Skia canvas:
```ts
// Convert canvas-space coords to screen-space
const screenX = object.transform.x * scale
const screenY = object.transform.y * scale
const screenW = object.width * scale
const screenH = object.height * scale
```

---

## Phase 4 — UI Shell (Week 7–10)

### 4.1 Navigation
Replace `react-router-dom` with `react-navigation`:
- Stack: Editor → Preview → Export
- No sidebar tabs — use bottom sheet panels instead

### 4.2 Toolbar / Sidebar
`Header.jsx` (~70KB) is web-only. Mobile redesign:

| Web | React Native |
|---|---|
| Header toolbar | Bottom toolbar (thumb-reachable) |
| Left sidebar panels | Bottom sheet (`@gorhom/bottom-sheet`) |
| Floating toolbars | Absolute-positioned toolbar above selection |
| Color picker portals | Modal or bottom sheet |

### 4.3 Page Navigation (Footer)
Replace SVG thumbnails in `Footer.jsx` with Skia `surface.makeImageSnapshot()` renders.

### 4.4 Color Picker
Replace `ColorPickerWithOpacity.jsx` with `reanimated-color-picker` or custom Skia-drawn picker.

---

## Phase 5 — Platform API Replacements (Week 9–11)

| Web API | React Native Replacement |
|---|---|
| `localStorage` | `@react-native-async-storage/async-storage` |
| `navigator.clipboard` | `expo-clipboard` |
| `window.innerWidth` / resize | `useWindowDimensions()` |
| `document.addEventListener` (keyboard) | RN `Keyboard` API |
| `<input type="file">` | `expo-image-picker` / `expo-document-picker` |
| Google OAuth | `expo-auth-session` + Google provider |
| `socket.io-client` | Works in RN unchanged |
| `axios` | Works in RN unchanged |
| `lz-string` | Works in RN unchanged |

---

## Phase 6 — Export Pipeline (Week 10–12)

### 6.1 Page Capture
Replace `html-to-image` / `html2canvas`:
```ts
// Skia surface snapshot
const image = canvasRef.current.makeImageSnapshot()
const bytes = image.encodeToBytes(ImageFormat.JPEG, 90)
```

### 6.2 Upload to Backend
Send Skia snapshots as byte arrays to the existing backend export endpoint (same API, same `uploadManager` logic from `shared/`).

### 6.3 3D Preview
`@react-three/fiber` has an RN/Expo version — port 3D previews (`photoBookPreview.jsx`, `Calendar3D.jsx`, etc.) with minimal changes.

---

## Phase 7 — Product-Specific Features (Week 11–14)

- **Photobook spreads**: Render both `layout[0]` and `layout[1]` in one Skia canvas (same coordinate model as web — no x-offset adjustment)
- **Calendar grid**: Port `DynamicCalendar` week/column logic to `SkiaCalendar.tsx` (pure math, no DOM)
- **Safe area guides**: Skia `<Rect>` with dashed stroke overlay
- **Spine/trim/bleed lines**: Skia dashed `<Path>`
- **Full cover photobook**: Same `isPhotobookFullCover` guard — set canvas viewBox width to `canvasSize.width` for page 0

---

## Final Architecture

```
packages/
  shared/                         ← TypeScript, no DOM
    store/slices/                  ← Redux slices (unchanged logic)
    utils/constants/               ← constants, API URLs
    utils/helpers/                 ← selectors, alignment, gradient utils
    utils/common-functions/        ← calc, unitConversion, fontParser
    utils/jsons/defaultObjects.js  ← object templates
    types/canvas.ts                ← NEW: full TypeScript interfaces

  web/                             ← existing React app (refactored to shared/)

  native/                          ← Expo app
    src/
      canvas/
        SkiaCanvas.tsx             ← replaces Canvas.jsx
        SkiaPhoto.tsx              ← replaces Photo.jsx
        SkiaText.tsx               ← replaces Text.jsx
        SkiaShape.tsx              ← replaces Shape.jsx
        SkiaSticker.tsx            ← replaces Sticker.jsx
        SkiaCalendar.tsx           ← replaces DynamicCalendar.jsx
        selectionHandles.tsx       ← absolute View overlay for handles
      layout/
        EditorScreen.tsx           ← replaces layout/index.jsx
        BottomToolbar.tsx          ← object-type quick actions
        ToolPanel.tsx              ← bottom sheet, replaces sidebar
        PageStrip.tsx              ← page thumbnails, replaces Footer.jsx
      tools/                       ← ported tool panels (bottom sheets)
      navigation/                  ← react-navigation stack
```

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Skia `Paragraph` text rendering gaps | HIGH | Validate all text styles (gradient, shadow, mixed weight) in a PoC before Phase 2 |
| SVG path compatibility in Skia | HIGH | Test `Skia.Path.MakeFromSVGString` against all mask/sticker paths used in the app |
| `processProjectPages` DOM deps | MEDIUM | Audit for `document`/`window` usage before moving to shared/ |
| Performance on 50+ page books | MEDIUM | Render only active ± 1 adjacent pages; use `makeImageSnapshot` for thumbnails |
| Font rendering differences vs web | MEDIUM | QA on real devices early; adjust Skia font metrics to match web |
| Rich text model gaps | MEDIUM | Map all text style combinations to Skia `TextStyle` early |

---

## Phased Timeline

| Phase | Focus | Duration |
|---|---|---|
| 0 | Foundation, monorepo, TypeScript types | 2 weeks |
| 1 | Skia rendering engine (all object types) | 4 weeks |
| 2 | Text editing (display + edit layer + fonts) | 3 weeks |
| 3 | Touch/gesture interaction | 3 weeks |
| 4 | UI shell (toolbar, bottom sheets, navigation) | 4 weeks |
| 5 | Platform API replacements | 2 weeks |
| 6 | Export pipeline | 2 weeks |
| 7 | Product-specific features | 3 weeks |
| — | QA, performance tuning, polish | 2 weeks |
| **Total** | | **~25 weeks** |

---

## Early Proof-of-Concepts (Before Full Commitment)

Before starting Phase 1 in earnest, validate these two in a throwaway RN app:

1. **Skia ColorMatrix filters**: Render a test image with brightness/contrast/saturation matching the web output
2. **Skia Paragraph + TextInput overlay**: Render styled text, double-tap to edit, sync back — must feel native

If either PoC fails to match quality expectations, revisit the rendering backend choice before any production code is written.

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
- 🔤 [Text](text.md)
- 📱 **React Native Migration Plan** — _you are here_
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
