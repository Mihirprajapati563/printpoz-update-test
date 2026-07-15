# API Documentation

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://apis.printpoz.com/api/v1/` |
| Local | `http://localhost:3006/api/v1/` |

---

## Utility Functions

| Function | HTTP Method | Content-Type | Description |
|----------|-------------|--------------|-------------|
| `apiGet(endpoint, params)` | GET | application/json | General GET request with query params |
| `apiPost(endpoint, data, config)` | POST | application/json | General POST request with auto brand_id injection |
| `apiPatch(endpoint, data, config)` | PATCH | application/json | General PATCH request with auto brand_id injection |
| `apiDelete(endpoint, config)` | DELETE | application/json | General DELETE request |
| `apiMultiPartPost(endpoint, data, onUploadProgress)` | POST | multipart/form-data | For file uploads |
| `apiMultiPartPatch(endpoint, data, onUploadProgress)` | PATCH | multipart/form-data | For file updates |

**Default Headers:**
- `Authorization: Bearer <token>` (if available)
- `x-user-id: <userId>` (if available)
- `x-brand-id: <brandId>` (if available)
- `Content-Type: application/json` or `multipart/form-data`

**Common Pagination Pattern:**
```json
{
  "filter": { /* query filters */ },
  "skip": number,
  "limit": number,
  "sortField": "string",
  "sortOrder": "asc" | "desc"
}
```

---

## Editor Settings APIs

### Get Backgrounds
- **Endpoint:** `POST /editor-settings/getEditorTypeWiseDetails`
- **Function:** `apiPost(ENDPOINTS.getBackgrounds, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "type": "background",
      "display_in_web": true,
      "tagId": ["string"] | null,
      "search": "string"
    },
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "urls": [
          { "size": "small", "url": "string", "w": number, "h": number },
          { "size": "medium", "url": "string", "w": number, "h": number },
          { "size": "large", "url": "string", "w": number, "h": number }
        ]
      }
    ],
    "totalCount": number
  }
  ```

### Get Background Categories
- **Endpoint:** `POST /store-tags`
- **Function:** `apiPost(ENDPOINTS.getBackgroundCategory, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "sample": true,
      "type": "background"
    }
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "background"
      }
    ]
  }
  ```

### Get Layouts
- **Endpoint:** `POST /editor-settings/getLayouts`
- **Function:** `apiPost(ENDPOINTS.getLayouts, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": { "$in": [1, 3] },
      "display_in_web": true,
      "number_of_layouts": 1 | 2,
      "spread": boolean,
      "number_of_images": number | { "$gte": 8 } | null,
      "asset_type": "layout"
    },
    "skip": 0,
    "limit": 50,
    "sortField": "_id",
    "sortOrder": "desc"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "number_of_images": number,
        "number_of_layouts": number,
        "spread": boolean,
        "layout_c": "base64_encoded_compressed_layout"
      }
    ],
    "totalCount": number
  }
  ```

### Save Layout
- **Endpoint:** `POST /editor-settings/createLayout`
- **Function:** `apiPost(ENDPOINTS.saveLayouts, payload)`
- **Payload:**
  ```json
  {
    "name": "string",
    "editorType": "string",
    "items": [],
    "brand_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "layout": {
      "_id": "string",
      "name": "string",
      "editorType": "string"
    }
  }
  ```

### Get Stickers
- **Endpoint:** `POST /editor-settings/getEditorTypeWiseDetails`
- **Function:** `apiPost(ENDPOINTS.getStickers, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "type": "sticker",
      "display_in_web": true,
      "search": "string"
    },
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "urls": [
          { "size": "large", "url": "string", "w": number, "h": number },
          { "size": "thumbnail", "url": "string" }
        ]
      }
    ],
    "totalCount": number
  }
  ```

### Get Sticker Categories
- **Endpoint:** `POST /store-tags`
- **Function:** `apiPost(ENDPOINTS.getStickerCategories, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "sample": true,
      "type": "sticker"
    }
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "sticker"
      }
    ]
  }
  ```

### Get Masks
- **Endpoint:** `POST /editor-settings/getEditorTypeWiseDetails`
- **Function:** `apiPost(ENDPOINTS.getMask, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "type": "mask",
      "tagId": "string"
    },
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:** Array of mask objects with urls

### Get Fonts (Legacy)
- **Endpoint:** `POST /editor-settings/getEditorTypeWiseDetails`
- **Function:** `apiPost(ENDPOINTS.getFonts, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "type": "font"
    }
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "font",
        "fontFamily": "string"
      }
    ]
  }
  ```

### Get Templates
- **Endpoint:** `POST /editor-settings/getEditorTypeWiseDetails`
- **Function:** `apiPost(ENDPOINTS.getTemplates, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "type": "template",
      "tagId": "string"
    },
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "template",
        "editorType": "string"
      }
    ]
  }
  ```

### Get ClipArts
- **Endpoint:** `GET /editor-settings/getClipArts`
- **Function:** `apiGet(ENDPOINTS.getClipArts, params)`
- **Payload (Query Params):** 
  ```json
  {
    "type": "clipart",
    "search": "string",
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:** 
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "urls": [
          { "size": "large", "url": "string", "w": number, "h": number }
        ]
      }
    ],
    "totalCount": number
  }
  ```

---

## Store Tags APIs

### Get Sticker Categories
- **Endpoint:** `POST /store-tags`
- **Function:** `apiPost(ENDPOINTS.getStickerCategories, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "sample": true,
      "type": "sticker"
    }
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "sticker"
      }
    ]
  }
  ```

### Get Themes Categories
- **Endpoint:** `POST /store-tags`
- **Function:** `apiPost(ENDPOINTS.getThemesCategory, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "sample": true,
      "type": "theme"
    }
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "theme"
      }
    ]
  }
  ```

### Get Tags List
- **Endpoint:** `GET /store-tags/getList`
- **Function:** `apiGet(ENDPOINTS.getTagsListByType, params)`
- **Payload (Query Params):**
  ```json
  {
    "type": "string",
    "skip": number,
    "limit": number
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "string"
      }
    ],
    "totalCount": number
  }
  ```

### Create Tag
- **Endpoint:** `POST /store-tags/create`
- **Function:** `apiPost(ENDPOINTS.createTag, payload)`
- **Payload:**
  ```json
  {
    "name": "string",
    "type": "string",
    "brand_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "type": "string",
      "brand_id": "string"
    }
  }
  ```

### View Tag
- **Endpoint:** `GET /store-tags/view/:id`
- **Function:** `apiGet(ENDPOINTS.viewTag + id)`
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "type": "string"
    }
  }
  ```

### Update Tag
- **Endpoint:** `POST /store-tags/update/:id`
- **Function:** `apiPost(ENDPOINTS.updateTag + id, payload)`
- **Payload:**
  ```json
  {
    "name": "string",
    "type": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "type": "string"
    }
  }
  ```

### Delete Tag
- **Endpoint:** `DELETE /store-tags/delete/:id`
- **Function:** `apiDelete(ENDPOINTS.deleteTag + id)`
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Tag deleted successfully"
  }
  ```

---

## Theme APIs

### Get Themes
- **Endpoint:** `GET /store-theme-editor`
- **Function:** `apiGet(ENDPOINTS.getThemes, params)`
- **Payload (Query Params):**
  ```json
  {
    "editorType": "string",
    "categoryId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "categoryId": "string",
        "editorType": "string",
        "sizes": ["string"],
        "thumbnail": "string"
      }
    ]
  }
  ```

### Get Theme By ID
- **Endpoint:** `GET /store-theme-editor/getTheme`
- **Function:** `apiGet(ENDPOINTS.getThemeById, params)`
- **Payload (Query Params):**
  ```json
  {
    "themeId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "theme": {
      "_id": "string",
      "name": "string",
      "categoryId": "string",
      "editorType": "string",
      "pages": [
        {
          "layoutIndex": number,
          "objects": []
        }
      ]
    }
  }
  ```

### Save As Theme
- **Endpoint:** `POST /store-theme-editor/saveTheme`
- **Function:** `apiPost(ENDPOINTS.saveAsTheme, payload)`
- **Payload:**
  ```json
  {
    "name": "string",
    "categoryId": "string",
    "editorType": "string",
    "pages": [
      {
        "layoutIndex": number,
        "objects": []
      }
    ],
    "sizes": ["string"],
    "brand_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "theme": {
      "_id": "string",
      "name": "string",
      "categoryId": "string",
      "editorType": "string"
    }
  }
  ```

### Save Page As Theme Image
- **Endpoint:** `POST /store-theme-editor/saveThemeImage`
- **Function:** `apiMultiPartPost(ENDPOINTS.savePageAsThemeImage, formData)`
- **Payload:** FormData with:
  - `image`: File (image blob)
  - `themeId`: string
  - `pageIndex`: number
- **Response:**
  ```json
  {
    "status": 1,
    "url": "string"
  }
  ```

### Remove Size From Theme
- **Endpoint:** `POST /store-theme-editor/removeSize`
- **Function:** `apiPost(ENDPOINTS.removeSizeFromTheme, payload)`
- **Payload:**
  ```json
  {
    "themeId": "string",
    "sizeId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Size removed from theme",
    "theme": {
      "_id": "string",
      "sizes": ["string"]
    }
  }
  ```

---

## Project Images APIs

### Upload Project Image (Legacy)
- **Endpoint:** `POST /project-images/uploadImage`
- **Function:** `apiMultiPartPost(ENDPOINTS.uploadImage, formData, onProgress)`
- **Payload:** FormData with:
  - `file`: File (image file)
  - `cart_order_id`: string (optional)
  - `user_id`: string (optional)
- **Response:**
  ```json
  {
    "status": 1,
    "_id": "string",
    "urls": [
      { "size": "large", "url": "string", "w": number, "h": number },
      { "size": "medium", "url": "string" },
      { "size": "small", "url": "string" },
      { "size": "thumbnail", "url": "string" }
    ],
    "is_favorite": false
  }
  ```

### Upload Project Image (New)
- **Endpoint:** `POST /project-images/uploadImage`
- **Function:** `apiMultiPartPost(ENDPOINTS.uploadProjectImages, formData, onProgress)`
- **Payload:** FormData with:
  - `file`: File (image file)
  - `cart_order_id`: string (optional)
  - `user_id`: string (optional)
- **Response:**
  ```json
  {
    "status": 1,
    "_id": "string",
    "urls": [
      { "size": "large", "url": "string", "w": number, "h": number },
      { "size": "medium", "url": "string" },
      { "size": "small", "url": "string" },
      { "size": "thumbnail", "url": "string" }
    ],
    "is_favorite": false
  }
  ```

### Multipart Upload Init
- **Endpoint:** `POST /project-images/uploads/init`
- **Function:** `apiPost(ENDPOINTS.uploadsInit, payload)`
- **Payload:**
  ```json
  {
    "fileName": "string",
    "fileType": "string",
    "fileSize": number
  }
  ```
- **Response:**
  ```json
  {
    "uploadId": "string",
    "key": "string",
    "parts": [{ "partNumber": number, "signedUrl": "string" }]
  }
  ```

### Multipart Upload Complete
- **Endpoint:** `POST /project-images/uploads/complete`
- **Function:** `apiPost(ENDPOINTS.uploadsComplete, payload)`
- **Payload:**
  ```json
  {
    "uploadId": "string",
    "key": "string",
    "parts": [{ "partNumber": number, "etag": "string" }]
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "_id": "string",
    "urls": [
      { "size": "large", "url": "string", "w": number, "h": number },
      { "size": "medium", "url": "string" },
      { "size": "small", "url": "string" },
      { "size": "thumbnail", "url": "string" }
    ]
  }
  ```

### Refresh Signed URLs
- **Endpoint:** `POST /project-images/uploads/refresh-urls`
- **Function:** `apiPost(ENDPOINTS.uploadsRefreshUrls, payload)`
- **Payload:**
  ```json
  {
    "uploadId": "string",
    "key": "string",
    "partNumbers": [number]
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "parts": [
      { "partNumber": number, "signedUrl": "string" }
    ]
  }
  ```

### Get Project Images
- **Endpoint:** `POST /project-images`
- **Function:** `apiPost(ENDPOINTS.getProjectImages, payload)`
- **Payload:**
  ```json
  {
    "filter": {
      "status": 1,
      "cart_order_id": "string",
      "theme_id": "string",
      "user_id": "string",
      "userTypeCode": "string"
    },
    "skip": 0,
    "limit": 20
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "urls": [
          { "size": "large", "url": "string", "w": number, "h": number },
          { "size": "medium", "url": "string" },
          { "size": "small", "url": "string" },
          { "size": "thumbnail", "url": "string" }
        ],
        "is_favorite": boolean
      }
    ],
    "totalCount": number
  }
  ```

### Add Project Image As Favorite
- **Endpoint:** `POST /project-images/addImageAsFavroite`
- **Function:** `apiPost(ENDPOINTS.addProjectImageAsFavroite, payload)`
- **Payload:**
  ```json
  {
    "_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Added to favorites",
    "item": {
      "_id": "string",
      "is_favorite": true
    }
  }
  ```

### Remove Project Image As Favorite
- **Endpoint:** `POST /project-images/removeImageAsFavroite`
- **Function:** `apiPost(ENDPOINTS.removeProjectImageAsFavroite, payload)`
- **Payload:**
  ```json
  {
    "_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Removed from favorites",
    "item": {
      "_id": "string",
      "is_favorite": false
    }
  }
  ```

### Delete Project Image
- **Endpoint:** `POST /project-images/deleteImage`
- **Function:** `apiPost(ENDPOINTS.deleteProjectImage, payload)`
- **Payload:**
  ```json
  {
    "_id": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Image deleted successfully"
  }
  ```

### Delete Multiple Project Images
- **Endpoint:** `POST /project-images/deleteMultipleImages`
- **Function:** `apiPost(ENDPOINTS.deleteMultipleProjectImages, payload)`
- **Payload:**
  ```json
  {
    "images_id": ["string"]
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Images deleted successfully",
    "deletedCount": number
  }
  ```

### Add To Project (Copy from Another Project)
- **Endpoint:** `POST /project-images/copyImagesFromProject`
- **Function:** `apiPost(ENDPOINTS.addToProject, payload)`
- **Payload:**
  ```json
  {
    "sourceProjectId": "string",
    "targetProjectId": "string",
    "imageIds": ["string"]
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "urls": [
          { "size": "large", "url": "string", "w": number, "h": number }
        ]
      }
    ]
  }
  ```

---

## Order & Cart APIs

### Get Order Details
- **Endpoint:** `GET /order/details`
- **Function:** `apiGet(ENDPOINTS.getOrderDetails, params)`
- **Payload (Query Params):**
  ```json
  {
    "orderId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "order": {
      "_id": "string",
      "orderNumber": "string",
      "status": "string",
      "items": [],
      "totalAmount": number
    }
  }
  ```

### Get Project Details
- **Endpoint:** `GET /cart-editor-details/view/:projectId`
- **Function:** `apiGet(ENDPOINTS.getProjectDetails + projectId)`
- **Response:**
  ```json
  {
    "status": 1,
    "project": {
      "_id": "string",
      "cart_order_id": "string",
      "pages": [],
      "settings": {}
    }
  }
  ```

### Save Project
- **Endpoint:** `POST /cart-editor-details/save`
- **Function:** `apiPost(ENDPOINTS.saveProject, payload)`
- **Payload:**
  ```json
  {
    "projectId": "string",
    "pages": [],
    "settings": {},
    "editorType": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Project saved successfully",
    "project": {
      "_id": "string",
      "updatedAt": "string"
    }
  }
  ```

### Export As JPG
- **Endpoint:** `POST /cart-editor-details/exportAsJpeg`
- **Function:** `apiPost(ENDPOINTS.exportAsJPG, payload)`
- **Payload:**
  ```json
  {
    "svgData": "string",
    "width": number,
    "height": number
  }
  ```
- **Response:**
  ```json
  {
    "imageUrl": "string"
  }
  ```

### Calculate Order Amount
- **Endpoint:** `POST /cart/calculateOrderAmountForEditor`
- **Function:** `apiPost(ENDPOINTS.calculateOrderAmount, payload)`
- **Payload:**
  ```json
  {
    "cart_order_id": "string",
    "pagesCount": number,
    "options": {}
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "totalAmount": number,
    "breakdown": {
      "basePrice": number,
      "additionalPagesPrice": number
    }
  }
  ```

---

## User APIs

### Fetch User Data From Token
- **Endpoint:** `GET /users/fetchUserDataFromToken`
- **Function:** `apiGet(ENDPOINTS.fetchUserDataFromToken)`
- **Response:**
  ```json
  {
    "status": 1,
    "user": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "userTypeCode": "string",
      "brand_id": "string",
      "token": "string"
    }
  }
  ```

---

## AI Services APIs

### Get Text Captions
- **Endpoint:** `POST /ai/generate-caption-suggestions`
- **Function:** `apiPost(ENDPOINTS.getTextCaptions, payload)`
- **Payload:**
  ```json
  {
    "imageUrl": "string",
    "count": number
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "captions": ["string"]
  }
  ```

### Remove Background
- **Endpoint:** `POST /ai/remove-background`
- **Function:** `apiPost(ENDPOINTS.removeBackground, payload)`
- **Payload:**
  ```json
  {
    "imageUrl": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "imageUrl": "string"
  }
  ```

### Swap Face By AI
- **Endpoint:** `POST /ai/swap-face-by-ai`
- **Function:** `apiPost(ENDPOINTS.swapFaceByAI, payload)`
- **Payload:**
  ```json
  {
    "sourceImage": "string",
    "targetImage": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "imageUrl": "string"
  }
  ```

---

## Brand APIs

### Get Brand Details
- **Endpoint:** `GET /brand/getEditorBrandDetails`
- **Function:** `apiGet(ENDPOINTS.getBrandDetails, params)`
- **Response:**
  ```json
  {
    "status": 1,
    "brand": {
      "brand_id": "string",
      "name": "string",
      "logo": "string",
      "settings": {},
      "theme": {}
    }
  }
  ```

### Get Store List
- **Endpoint:** `GET /brand-store`
- **Function:** `apiGet(ENDPOINTS.getStoreList, params)`
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "brand_id": "string"
      }
    ]
  }
  ```

---

## Editor Configuration APIs

### Get Editor Configuration For Store
- **Endpoint:** `GET /editor-configurations/get-editor-configuration-for-store`
- **Function:** `apiGet(ENDPOINTS.getEditorConfigurationForStore, params)`
- **Payload (Query Params):**
  ```json
  {
    "storeId": "string",
    "editorType": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "configuration": {
      "settings": {},
      "features": {},
      "permissions": {}
    }
  }
  ```

### Save Editor Configuration
- **Endpoint:** `POST /editor-configurations/save-editor-configuration`
- **Function:** `apiPost(ENDPOINTS.saveEditorConfiguration, payload)`
- **Payload:**
  ```json
  {
    "storeId": "string",
    "editorType": "string",
    "settings": {},
    "features": {},
    "permissions": {}
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "configuration": {
      "storeId": "string",
      "editorType": "string",
      "settings": {}
    }
  }
  ```

---

## Font Management APIs

### Get Fonts List
- **Endpoint:** `GET /font`
- **Function:** `apiGet(ENDPOINTS.getFontsList, params)`
- **Payload (Query Params):**
  ```json
  {
    "skip": number,
    "limit": number,
    "search": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "fontId": "string",
        "name": "string",
        "previews": {
          "small": "string",
          "medium": "string"
        },
        "styles": [
          {
            "styleId": "string",
            "weight": number,
            "style": "string",
            "label": "string",
            "fileUrl": "string"
          }
        ],
        "category": ["string"],
        "printSafe": boolean,
        "premium": boolean,
        "enabled": boolean
      }
    ],
    "totalCount": number
  }
  ```

### Get Fonts List For Sidebar
- **Endpoint:** `GET /font/list`
- **Function:** `apiGet(ENDPOINTS.getFontsListInSidebar, params)`
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "fontId": "string",
        "name": "string",
        "previews": {
          "small": "string",
          "medium": "string"
        },
        "defaultStyleId": "string",
        "enabled": true
      }
    ]
  }
  ```

### Get Font By ID
- **Endpoint:** `GET /font/getFontsDetailsFromIdsOrNames`
- **Function:** `apiGet(ENDPOINTS.getFontById, params)`
- **Payload (Query Params):**
  ```json
  {
    "ids": ["string"],
    "names": ["string"]
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "fontId": "string",
        "name": "string",
        "styles": [
          {
            "styleId": "string",
            "weight": number,
            "style": "string",
            "label": "string",
            "fileUrl": "string"
          }
        ],
        "category": ["string"],
        "printSafe": boolean,
        "premium": boolean
      }
    ]
  }
  ```

### Add Font
- **Endpoint:** `POST /font/create`
- **Function:** `apiMultiPartPost(ENDPOINTS.addFont, formData, onProgress)`
- **Payload:** FormData with:
  - `name`: Font name (string)
  - `fontFamily`: Font family (string)
  - `files`: Font files (File[] - WOFF2)
  - `category`: Font categories (string[])
  - `scripts`: Supported scripts (string[])
  - `printSafe`: Boolean
  - `premium`: Boolean
- **Response:**
  ```json
  {
    "status": 1,
    "font": {
      "_id": "string",
      "fontId": "string",
      "name": "string",
      "enabled": true
    }
  }
  ```

### Update Font
- **Endpoint:** `POST /font/update`
- **Function:** `apiMultiPartPost(ENDPOINTS.updateFont, formData)`
- **Payload:** FormData with:
  - `fontId`: string
  - `name`: Font name (string)
  - `files`: Font files (File[] - optional)
  - `category`: Font categories (string[])
  - `printSafe`: Boolean
  - `premium`: Boolean
- **Response:**
  ```json
  {
    "status": 1,
    "font": {
      "_id": "string",
      "name": "string",
      "updatedAt": "string"
    }
  }
  ```

### Toggle Font Enabled Status
- **Endpoint:** `POST /font/toggleEnabled`
- **Function:** `apiPost(ENDPOINTS.toggleFont, payload)`
- **Payload:**
  ```json
  {
    "fontId": "string",
    "enabled": boolean
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "font": {
      "_id": "string",
      "enabled": boolean
    }
  }
  ```

---

## Asset Management APIs

### Get Editor Type Wise List
- **Endpoint:** `GET /editor-settings/getEditorTypeWiseList`
- **Function:** `apiGet(ENDPOINTS.getEditorTypeWiseList, params)`
- **Payload (Query Params):**
  ```json
  {
    "type": "string",
    "editorType": "string",
    "skip": number,
    "limit": number,
    "search": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "name": "string",
        "type": "string",
        "urls": [
          { "size": "large", "url": "string" }
        ]
      }
    ],
    "totalCount": number
  }
  ```

### Create Editor Setting
- **Endpoint:** `POST /editor-settings/create/`
- **Function:** `apiMultiPartPost(ENDPOINTS.createEditorSetting, formData, onProgress)`
- **Payload:** FormData with:
  - `file`: Asset file (File)
  - `type`: Asset type (string)
  - `tags`: Tags (string[])
  - `editorType`: Editor type (string)
  - `display_in_web`: Boolean
  - `status`: Number (1 = active)
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "type": "string",
      "urls": [
        { "size": "large", "url": "string" }
      ]
    }
  }
  ```

### View Editor Setting
- **Endpoint:** `GET /editor-settings/view/:id`
- **Function:** `apiGet(ENDPOINTS.viewEditorSetting + id)`
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "type": "string",
      "urls": [
        { "size": "large", "url": "string" }
      ],
      "tags": ["string"],
      "editorType": "string"
    }
  }
  ```

### Update Editor Setting
- **Endpoint:** `PATCH /editor-settings/update/:id`
- **Function:** `apiMultiPartPatch(ENDPOINTS.updateEditorSetting + id, formData, onProgress)`
- **Payload:** FormData with:
  - `file`: Asset file (File, optional)
  - `type`: Asset type (string)
  - `tags`: Tags (string[])
  - `status`: Number
- **Response:**
  ```json
  {
    "status": 1,
    "item": {
      "_id": "string",
      "name": "string",
      "updatedAt": "string"
    }
  }
  ```

### Delete Editor Setting
- **Endpoint:** `DELETE /editor-settings/delete/:id`
- **Function:** `apiDelete(ENDPOINTS.deleteEditorSetting + id)`
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Asset deleted successfully"
  }
  ```

### Hide Material From Brand
- **Endpoint:** `POST /editor-settings/hideMaterialFromBrand`
- **Function:** `apiPost(ENDPOINTS.hideMaterialFromBrand, payload)`
- **Payload:**
  ```json
  {
    "materialId": "string",
    "brandId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Material hidden from brand",
    "material": {
      "_id": "string",
      "hiddenFromBrands": ["string"]
    }
  }
  ```

### Enable Material For Brand
- **Endpoint:** `POST /editor-settings/enableMaterialFromBrand`
- **Function:** `apiPost(ENDPOINTS.enableMaterialFromBrand, payload)`
- **Payload:**
  ```json
  {
    "materialId": "string",
    "brandId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 1,
    "message": "Material enabled for brand",
    "material": {
      "_id": "string",
      "hiddenFromBrands": ["string"]
    }
  }
  ```

---

## Gallery APIs

### Get Image Gallery
- **Endpoint:** `GET /cart-editor-details/getImageGallery`
- **Function:** `apiGet(ENDPOINTS.getImageGallery, params)`
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "url": "string",
        "thumbnail": "string",
        "category": "string"
      }
    ]
  }
  ```

### Get My Photos
- **Endpoint:** `GET /project-images`
- **Function:** `apiGet(ENDPOINTS.getMyPhotos, params)`
- **Response:**
  ```json
  {
    "status": 1,
    "items": [
      {
        "_id": "string",
        "urls": [
          { "size": "large", "url": "string", "w": number, "h": number },
          { "size": "medium", "url": "string" },
          { "size": "small", "url": "string" },
          { "size": "thumbnail", "url": "string" }
        ],
        "is_favorite": boolean
      }
    ],
    "totalCount": number
  }
  ```

---

## Response Error Format

All error responses follow this structure:

```json
{
  "error": "Error message string",
  "status": number,
  "details": {}
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
