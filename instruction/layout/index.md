# MainLayout Component Workflow Documentation

## Overview
The MainLayout component is our main component to serve as the main layout for the photo editor application. It wraps all the layout components like header,footer,sidebar,canvas etc  and initialize a project.

## Workflow
1. The MainLayout component is first of all initialized a project by calling the useInitializeProject hook.
2. once project is  initialized it settingup the theme by calling the useSetupTheme hook.
3. after settingup the theme it set value of isActivePreview   based on pages length and editor type to determine whethet preivew will be shown in footer or not.
4. After all the setup Main Photo Editor is ready to use.


## location 
Location: "@/src/layout/index.jsx"

## wrapped components 
- Header
- Top Actions
- Bottom Actions
- Footer
- Main Layout
- Sidebar
- Content Wrapper
- Main Content Wrapper
 
## Component Hierarchy
```
MainLayout
├── Header
├── MainContentWrapper
│   ├── SideBar
│   └── ContentWrapper
│       ├── CanvasWrapper
│       │   ├── TopActions
│       │   └── MainCanvas
│       └── Box
│           ├── BottomActions
│           └── Footer (conditional)
```


