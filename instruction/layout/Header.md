# Header Component

## Overview
The **Header Component** is a responsive navigation bar designed for a designing SPA in React. It provides navigation, branding, and user-specific actions, including exporting, saving, and ordering projects.

## Location
- **Path**: `@/src/layout/Header/index.jsx`

## Imports and Dependencies
The component relies on the following libraries and utilities:
- **UI Libraries**:
  - Styled Components
  - React Bootstrap Components
  - React Icons
- **State Management**:
  - React Redux
- **Utilities & Helpers**:
  - Constant Files
  - Canvas Slice Getters (`@src/library/utils/helpers`)
  - Slice Setters (`@src/store/slices` and subfolders)
  - Common Functions
- **Preview Components**:
  - 2D and 3D preview components for different products (e.g., Canvas, Photo Book, Acrylic)
- **Services**:
  - `@src/library/utils/services`

## State Management
The Header component uses:
- **Local States** for component-specific UI behavior
- **Redux States** for managing global state across the application

## Functions
### UI Management
- `handleClose`: Closes the modal.
- `handleSettingClose`: Closes the setting modal and size setting modal.
- `openPreviewModal`: Opens the preview modal.
- `openEditorSetting`: Opens the editor settings modal.
- `openSizeSettings`: Opens the size settings modal.

### Project and Layout Management
- `exportLayout`: Exports the current layout.
- `saveLayout`: Saves the current layout.
- `saveProject`: Saves the current project with all its pages.
- `exportProject`: Exports the current project with all its pages.
- `orderProject`: Saves the project and redirects the user to the cart page.
- `removeMaskContent`: Returns all pages without the mask.
- `getAllPagesToSave`: Returns all pages with their content and metadata for saving in storage.
- `savePageAsThemeImage`: Saves the current page as an image and adds it to the theme image collection.
- `getTheme`: Fetches a theme based on its ID and applies it to the current project.
- `exportAsJpg`: Exports the current page as an image.
- `changeOrientation`: Changes the orientation of the entire project.

## Workflow
1. Retrieve `userDetails` from `localStorage`.
2. If the user is not found, return without rendering the UI.
3. If the user is found, set the user details in the local state (User details are only available after project initialization).
4. Once user details are set, render the UI accordingly.

## Role-Based Actions and Features
### 1. Admins or Super Users
#### **Change Orientation**
Admins can select from three orientation options: **Square**, **Landscape**, or **Portrait** to modify the theme layout.

#### **Create a New Theme**
1. Click the **Settings** button to open the Editor Settings modal.
2. Set the required parameters:
   - Editor type
   - Height, Width, Depth
   - Sub-editor type
3. Click **Save and Reset** to apply the settings.
4. Design a new theme.
5. Save the theme after designing.

#### **Save Theme**
- Admins can save a theme by clicking **'Save New Theme'** and providing a name.
- This feature supports both saving a new theme and updating an existing one.

#### **Add Multiple Custom Sizes to a Theme**
1. Click the **Custom Sizes** button to open the custom sizes modal.
2. Set Width, Height, and Depth (if applicable) or select a predefined size.
3. Click **Update Size** to set the canvas.
4. Design the page for the selected custom size.
5. Click **Save Theme** to store the custom size.

#### **Remove Custom Size from a Theme**
Admins can remove a custom size by clicking the remove icon in the **Custom Sizes Modal**.

#### **Create a New Theme from an Existing Theme**
- Click **'Save As New Theme'**, provide a new name, and save a duplicate of the theme with a different name.

#### **Save Page as Theme Image**
- Save the current page as a **theme image** by clicking **'Save Page As Theme Image'**.

#### **Export Layout**
- Click **'Export Layout'** to download the current page layout.

#### **Export as Idea**
- Click **'Export as Idea'** to export the page layout as an idea.

#### **Preview the Theme**
- Click **'Preview Theme'** to view the current theme.

#### **Change Editor Settings**
- Click **'Change Editor Settings'** to modify editor configurations.

### 2. Customer Features
#### **Preview the Project**
- Click **'Preview'** to view the current project before finalizing.

#### **Save the Project**
- Click **'Save'** to store the current project.

#### **Order the Project**
- Click **'Order'** to finalize and place an order for the project.

---
This document provides a detailed breakdown of the **Header Component**, including its dependencies, workflow, functions, and role-based features. For further modifications, refer to `@/src/layout/Header/index.jsx`.
