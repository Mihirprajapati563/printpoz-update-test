import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    uploadedPhotos: [],
    uploadedImageUrls: [], // Array to store large size URLs from server response
    processingStatus: 'idle', // idle, processing, completed, error
    isAiKidsPhotobookModalOpen: false,
    childName: '', // Store child's name for AI photobook personalization
    // Face swap progress tracking
    faceSwapProgress: {
        isProcessing: false,
        totalTemplates: 0,
        processedTemplates: 0,
        socketConnected: false,
        showProgressBar: false
    }
};

const aiKidsPhotobookSlice = createSlice({
    name: 'aiKidsPhotobook',
    initialState,
    reducers: {
        setUploadedPhotos: (state, action) => {
            state.uploadedPhotos = action.payload;
        },
        setChildName: (state, action) => {
            state.childName = action.payload;
        },
        addUploadedPhototoAiKidsPhotobook: (state, action) => {
            state.uploadedPhotos.push(action.payload);
        },
        removeUploadedPhotoFromAiKidsPhotobook: (state, action) => {
            state.uploadedPhotos = state.uploadedPhotos.filter(
                photo => photo.id !== action.payload
            );
        },
        setProcessingStatus: (state, action) => {
            state.processingStatus = action.payload;
        },
        // Face swap progress actions
        startFaceSwapProcessing: (state, action) => {
            state.faceSwapProgress.isProcessing = true;
            state.faceSwapProgress.totalTemplates = action.payload.totalTemplates;
            state.faceSwapProgress.processedTemplates = 0;
            state.faceSwapProgress.showProgressBar = true;
            state.processingStatus = 'processing';
        },
        updateFaceSwapProgress: (state, action) => {
            state.faceSwapProgress.processedTemplates += 1;
            if (state.faceSwapProgress.processedTemplates >= state.faceSwapProgress.totalTemplates) {
                state.faceSwapProgress.isProcessing = false;
                state.processingStatus = 'completed';
            }
        },
        setSocketConnected: (state, action) => {
            state.faceSwapProgress.socketConnected = action.payload;
        },
        hideProgressBar: (state) => {
            state.faceSwapProgress.showProgressBar = false;
        },
        addUploadedImageUrl: (state, action) => {
            // Extract large size URL from server response and add to array
            const response = action.payload;
            if (response?.items?.urls) {
                const largeUrl = response.items.urls.find(url => url.size === 'large');
                if (largeUrl) {
                    state.uploadedImageUrls.push({
                        url: largeUrl.url,
                        width: largeUrl.w,
                        height: largeUrl.h,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }
        },
        setUploadedImageUrls: (state, action) => {
            state.uploadedImageUrls = action.payload;
        },
        openAiKidsPhotobookModal: (state) => {
            state.isAiKidsPhotobookModalOpen = true;
        },
        closeAiKidsPhotobookModal: (state) => {
            state.isAiKidsPhotobookModalOpen = false;
            // Reset wizard when modal closes
            state.uploadedPhotos = [];
            state.uploadedImageUrls = [];
            state.processingStatus = 'idle';
            state.childName = '';
        }
    }
});

export const {
    setUploadedPhotos,
    setChildName,
    addUploadedPhototoAiKidsPhotobook,
    removeUploadedPhotoFromAiKidsPhotobook,
    setProcessingStatus,
    addUploadedImageUrl,
    setUploadedImageUrls,
    openAiKidsPhotobookModal,
    closeAiKidsPhotobookModal,
    startFaceSwapProcessing,
    updateFaceSwapProgress,
    setSocketConnected,
    hideProgressBar
} = aiKidsPhotobookSlice.actions;

// Selectors
export const selectUploadedPhotos = (state) => state.aiKidsPhotobook.uploadedPhotos;
export const selectUploadedImageUrls = (state) => state.aiKidsPhotobook.uploadedImageUrls;
export const selectProcessingStatus = (state) => state.aiKidsPhotobook.processingStatus;
export const selectAiKidsPhotobookModalOpen = (state) => state.aiKidsPhotobook.isAiKidsPhotobookModalOpen;
export const selectFaceSwapProgress = (state) => state.aiKidsPhotobook.faceSwapProgress;
export const selectChildName = (state) => state.aiKidsPhotobook.childName;

export default aiKidsPhotobookSlice.reducer;
