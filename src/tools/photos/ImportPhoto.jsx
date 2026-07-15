import { Col } from "react-bootstrap";
import {
  FlexBox,
  Title20,
  TitleMd,
} from "../../common-components/StyledComponents";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { handleImageUploadLimit, buildOversizedAlert, MAX_IMAGE_UPLOAD_BYTES } from "../../library/utils/common-functions";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";
import { getSettings } from "../../library/utils/helpers/canvasSliceGetters";
import { setLimitReached, refreshProjectImages } from "../../store/slices/imageUpload";
import { dispatchUploadsWithConcurrency } from "../../store/background-services/imageUploadThunks";
import { isDesktop } from "../../desktop";
import { USER_TYPES } from "../../library/utils/constants";
import { apiMultiPartPost, getUserDetails } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { v4 as uuidv4 } from "uuid";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCodeForToken,
  createPickerSession,
  getSessionStatus,
  fetchSelectedMediaItems,
  parsePollingInterval,
  downloadImageAsFile,
  storeAccessToken,
  getStoredAccessToken,
  clearStoredToken,
} from "./googlePhotosPickerUtils";
import "./ImportPhoto.css";

// Normalize Google media item structure for uploads
function getMediaFileDetails(mediaItem, fallbackIndex) {
  const mediaFile = mediaItem?.mediaFile;
  const mediaItemData = mediaItem?.mediaItem;

  const baseUrl =
    mediaFile?.baseUrl ||
    mediaItemData?.baseUrl ||
    mediaItem?.baseUrl ||
    null;

  const filename =
    mediaFile?.filename ||
    mediaItemData?.filename ||
    mediaItem?.filename ||
    `google-photo-${fallbackIndex}`;

  const mimeType =
    mediaFile?.mimeType ||
    mediaItemData?.mimeType ||
    mediaItem?.mimeType ||
    "image/jpeg";

  return { baseUrl, filename, mimeType };
}

// Google icon SVG component
const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="30"
    height="30"
    viewBox="0 0 48 48"
  >
    <path
      fill="#fbc02d"
      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    />
    <path
      fill="#e53935"
      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    />
    <path
      fill="#4caf50"
      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
    />
    <path
      fill="#1565c0"
      d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    />
  </svg>
);

export const ImportPhoto = ({ openPhotoOption, handleClose }) => {
  const [selectedPhotos, setSelectedPhotos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const dispatch = useDispatch();
  const settings = useSelector(getSettings);
  const totalUploadedImages = useSelector(
    (state) => state.imageUpload.totalUploadedImages
  );
  const projectSetup = useSelector((state) => state.projectSetup);
  const projectId = projectSetup?.cartDetails?._id;

  const user = useSelector(getUserDetails);

  // Refs for session management
  const sessionRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const popupRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  /**
   * Upload selected photos to the server using existing upload API
   * @param {Array} mediaItems - Array of media items from Google Photos
   * @param {string} accessToken - The OAuth access token for downloading images
   */
  const uploadPhotosToServer = useCallback(async (mediaItems, accessToken) => {
    try {
      const { shouldStop, allowedCount } = handleImageUploadLimit({
        settings,
        totalUploadedImages,
        user,
        selectedCount: mediaItems.length,
        userTypeCustomer: USER_TYPES.CUSTOMER,
        dispatch,
        setLimitReachedAction: setLimitReached,
        actionType: "import",
      });

      if (shouldStop) {
        setLoading(false);
        return;
      }

      const photosToUpload = mediaItems.slice(0, allowedCount);
      setUploadProgress({ current: 0, total: photosToUpload.length });
      setUploadingStatus(`Fetching photos from Google (0/${photosToUpload.length})...`);

      let successCount = 0;
      // ONE batch id for the whole selection so the gallery refetch fires ONCE,
      // after EVERY image has finished (not in chunks of 10).
      const batchId = uuidv4();
      const uploadItems = [];
      const oversized = [];

      for (let i = 0; i < photosToUpload.length; i++) {
        const mediaItem = photosToUpload[i];
        setUploadProgress({ current: i + 1, total: photosToUpload.length });
        setUploadingStatus(`Fetching photos from Google (${i + 1}/${photosToUpload.length})...`);

        try {
          const { baseUrl, filename, mimeType } = getMediaFileDetails(mediaItem, i + 1);
          if (!baseUrl) {
            continue;
          }

          // Download image and create file (need access token for authorization)
          const file = await downloadImageAsFile(baseUrl, filename, mimeType, accessToken);

          // Skip images over the 30MB limit (the rest still upload).
          if (file && typeof file.size === "number" && file.size > MAX_IMAGE_UPLOAD_BYTES) {
            oversized.push(file);
            continue;
          }

          // Build upload item for the concurrency queue
          const formData = new FormData();
          formData.append("file", file);
          formData.append("brand_id", user?.brand_id || "");
          formData.append("userTypeCode", user?.userTypeCode);
          if (user?._id) {
            formData.append("user_id", user._id);
          }
          if (projectId) {
            formData.append("cart_order_id", projectId);
          }
          formData.append("editor_type", "");
          formData.append("device", "web");
          formData.append("batch_id", batchId);

          uploadItems.push({ file, formData });
          successCount++;
        } catch (uploadError) {
        }
      }

      if (oversized.length > 0) {
        toast.warning(buildOversizedAlert(oversized));
      }

      // Dispatch with bounded concurrency to prevent signed URL expiry
      if (uploadItems.length > 0) {
        dispatchUploadsWithConcurrency(dispatch, uploadItems);
      }

      if (successCount > 0) {
        // Optimistic placement: close the dialog — imported photos appear in
        // the sidebar gallery as uploading tiles and are placeable right away
        if (handleClose) {
          handleClose();
        } else if (openPhotoOption && !isDesktop) {
          // Desktop: no upload queue — photos are saved locally and shown in the gallery.
          openPhotoOption("Upload Queue");
        }
      } else {
        setUploadingStatus("Failed to import photos. Please try again.");
      }

      setLoading(false);

      // Clear status after delay
      setTimeout(() => {
        setUploadingStatus("");
        setUploadProgress({ current: 0, total: 0 });
      }, 3000);

    } catch (error) {
      setLoading(false);
      setUploadingStatus("Error importing photos");
    }
  }, [settings, totalUploadedImages, user, projectId, dispatch, openPhotoOption]);

  /**
   * Start polling the session to check when user finishes selection
   */
  const startPollingSession = useCallback((accessToken, sessionId, pollingConfig) => {
    const pollInterval = parsePollingInterval(pollingConfig);
    setUploadingStatus("Waiting for photo selection...");

    // Track when popup closes to handle race condition
    let popupClosedTime = null;
    const MAX_WAIT_AFTER_CLOSE = 15000; // Wait up to 15 seconds after popup closes

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Check session status
        const sessionData = await getSessionStatus(accessToken, sessionId);

        // Check if user has finished selecting
        if (sessionData.mediaItemsSet === true) {
          clearInterval(pollingIntervalRef.current);
          setUploadingStatus("Photos selected! Fetching...");

          // Close the picker popup if still open
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }

          const mediaItems = await fetchSelectedMediaItems(accessToken, sessionId);

          if (mediaItems.length === 0) {
            setLoading(false);
            setUploadingStatus("No photos were selected");
            setSelectedPhotos([]);
            return;
          }

          await uploadPhotosToServer(mediaItems, accessToken);
          return;
        }

        // Check if popup was closed
        if (popupRef.current && popupRef.current.closed) {
          // First time detecting popup closed - start countdown
          if (!popupClosedTime) {
            popupClosedTime = Date.now();
            setUploadingStatus("Processing your selection...");
          }

          // If we've waited too long after popup closed, assume cancelled
          if (Date.now() - popupClosedTime > MAX_WAIT_AFTER_CLOSE) {
            clearInterval(pollingIntervalRef.current);
            setLoading(false);
            setUploadingStatus("Selection timed out. Please try again.");
            setTimeout(() => setUploadingStatus(""), 3000);
            return;
          }

          // Otherwise, keep polling - the API might just be slow to update
        }

      } catch (error) {
        // Don't stop polling on error - might be temporary
      }
    }, pollInterval);
  }, [uploadPhotosToServer]);

  /**
   * Open picker directly with a valid access token (skip OAuth)
   */
  const openPickerWithToken = async (accessToken) => {
    try {
      setUploadingStatus("Opening Google Photos picker...");

      const sessionData = await createPickerSession(accessToken);

      sessionRef.current = {
        id: sessionData.id,
        accessToken: accessToken,
      };

      // Open popup with picker URL directly
      const pickerUri = sessionData.pickerUri + "/autoclose";
      popupRef.current = window.open(pickerUri, "google-photos-flow", "width=900,height=700");

      if (!popupRef.current) {
        setLoading(false);
        setUploadingStatus("Please allow popups and try again");
        return;
      }

      setUploadingStatus("Select your photos in the popup...");

      // Start polling for selection
      startPollingSession(accessToken, sessionData.id, sessionData.pollingConfig);

    } catch (error) {
      // Token might be invalid, clear it and fall back to OAuth
      clearStoredToken();
      await openPickerWithOAuth();
    }
  };

  /**
   * Open OAuth flow and then picker
   */
  const openPickerWithOAuth = async () => {
    setUploadingStatus("Opening Google login...");

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const authUrl = buildAuthUrl(codeChallenge);

    // Open OAuth popup
    popupRef.current = window.open(authUrl, "google-photos-flow", "width=600,height=700");

    if (!popupRef.current) {
      setLoading(false);
      setUploadingStatus("Please allow popups and try again");
      return;
    }

    const redirectUri = window.location.origin;

    // Poll for OAuth completion
    const pollTimer = setInterval(() => {
      try {
        if (popupRef.current.closed) {
          clearInterval(pollTimer);
          setLoading(false);
          setUploadingStatus("");
          return;
        }

        if (popupRef.current.location.href.includes(redirectUri)) {
          clearInterval(pollTimer);
          const params = new URLSearchParams(popupRef.current.location.search);
          const code = params.get("code");

          setUploadingStatus("Authenticating...");

          // Exchange code for token
          exchangeCodeForToken(code, codeVerifier).then(async (result) => {
            if (result.success) {
              try {
                // Store the token for future use
                storeAccessToken(result.accessToken, result.expiresIn);

                setUploadingStatus("Creating picker session...");
                const sessionData = await createPickerSession(result.accessToken);

                sessionRef.current = {
                  id: sessionData.id,
                  accessToken: result.accessToken,
                };

                // Navigate the SAME popup to the picker URL
                const pickerUri = sessionData.pickerUri + "/autoclose";
                setUploadingStatus("Select your photos in the popup...");

                popupRef.current.location.href = pickerUri;

                // Start polling for selection
                startPollingSession(result.accessToken, sessionData.id, sessionData.pollingConfig);

              } catch (error) {
                setLoading(false);
                setUploadingStatus("Error connecting to Google Photos");
                if (popupRef.current && !popupRef.current.closed) {
                  popupRef.current.close();
                }
              }
            } else {
              setLoading(false);
              setUploadingStatus("Authentication failed");
              if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
              }
            }
          });
        }
      } catch (error) {
        // Ignore cross-origin errors (expected when popup is on Google's domain)
      }
    }, 500);
  };

  /**
   * Main entry point - Open the Google Photos picker
   */
  const openPickerPopup = async () => {
    const { shouldStop } = handleImageUploadLimit({
      settings,
      totalUploadedImages,
      user,
      selectedCount: 1,
      userTypeCustomer: USER_TYPES.CUSTOMER,
      dispatch,
      setLimitReachedAction: setLimitReached,
      actionType: "import",
    });

    if (shouldStop) return;

    setLoading(true);
    setSelectedPhotos(null);
    setUploadingStatus("");

    // Check if we have a valid stored token
    const storedToken = getStoredAccessToken();

    if (storedToken) {
      // Use stored token - skip OAuth
      await openPickerWithToken(storedToken);
    } else {
      // No valid token - go through OAuth
      await openPickerWithOAuth();
    }
  };

  return (
    <>
      <Col md="5" className="mx-auto">
        <FlexBox
          direction="column"
          alignitems="center"
          justify="center"
          gap="20px"
          pt="10px"
          pb="100px"
        >
          <FlexBox gap="10px" direction="column" pl="45px" pr="45px">
            <TitleMd align="center" fontsize="24px">
              Import Your Photos
            </TitleMd>
            <Title20
              align="center"
              color="#696969"
              fontsize="17px"
              fontweight="400"
            >
              Connect your Google Photos to import and use your photos
            </Title20>
          </FlexBox>

          <div className="google-photo-container">
            <button
              className="google-login-btn"
              onClick={openPickerPopup}
              disabled={loading}
            >
              {!loading && <GoogleIcon />}
              {loading ? (
                <div className="spinner"></div>
              ) : (
                "Select Photos from Google"
              )}
            </button>

            {uploadingStatus && (
              <div className="upload-status">
                <p className="status-text">{uploadingStatus}</p>
                {uploadProgress.total > 0 && (
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {selectedPhotos?.length === 0 && !loading && !uploadingStatus && (
              <p className="error-no-img">*No photos were selected!</p>
            )}
          </div>
        </FlexBox>
      </Col>
    </>
  );
};
