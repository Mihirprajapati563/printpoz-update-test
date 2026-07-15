import {
  Box,
  FlexBox,
  Title20,
  TitleMd,
  DisplayBetween,
  PrimaryButton,
  FromMobileWrapper,
  BodyText,
  theme,
} from "../../common-components/StyledComponents";
import { ReactComponent as Computer } from "../../assets/icons/monitor_icon.svg";
import { ReactComponent as Mobile } from "../../assets/icons/mobile_icon.svg";
import { ReactComponent as FromMobileIcon } from "../../assets/icons/upload_from_mobile.svg";
import { useState, useEffect, useRef } from "react";
import { FaAngleLeft } from "react-icons/fa6";
import { handleImageUploadLimit, filterOversizedImages, buildOversizedAlert } from "../../library/utils/common-functions";
import { toast } from "react-toastify";
import { apiMultiPartPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { dispatchUploadsWithConcurrency } from "../../store/background-services/imageUploadThunks";
import QRCodeDisplay from "./QRCodeDisplay";
import { useSelector, useDispatch } from "react-redux";
import { isMobile } from "react-device-detect";
import { v4 as uuidv4 } from "uuid";
import { LuArrowUpToLine } from "react-icons/lu";
import { QRCodeSVG } from "qrcode.react";
import { USER_TYPES } from "../../library/utils/constants";
import { getSettings } from "../../library/utils/helpers/canvasSliceGetters";
import { setLimitReached } from "../../store/slices/imageUpload";

function AddFistTimePhotoModal({ handleShow = () => { } }) {
  const [fromMobile, setFromMobile] = useState(false);
  const projectSetup = useSelector((state) => state.projectSetup);
  const [user, setUser] = useState(null);
  const settings = useSelector(getSettings);
  const { totalUploadedImages, limitReached } = useSelector(
    (state) => state.imageUpload
  );
  // Use ref to store reference to hidden input
  const fileInputRef = useRef(null);
  //get window home url
  const baseUrl = window.location.origin;
  const projectId = projectSetup.cartDetails._id;
  let themeId;

  if (
    projectSetup.themeDetails &&
    projectSetup.themeDetails.theme_id &&
    projectSetup.themeDetails.pages_c
  ) {
    themeId = projectSetup.themeDetails.theme_id;
  }
  const qrCodeUrl = baseUrl + "/upload/" + projectId;
  useEffect(() => {
    const users = localStorage.getItem("userDetails");
    if (!users) {
      setUser(null);
      return;
    }
    // users is json string lets make object
    const userObj = JSON.parse(users);
    setUser(userObj);
  }, []);
  const dispatch = useDispatch();

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) {
      return;
    }

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    // Skip images over the 30MB limit (upload the rest), then notify.
    const { valid: sizedFiles, oversized } = filterOversizedImages(imageFiles);
    if (oversized.length > 0) {
      toast.warning(buildOversizedAlert(oversized));
    }
    if (sizedFiles.length === 0) {
      event.target.value = "";
      return;
    }

    const { shouldStop, allowedCount } = handleImageUploadLimit({
      settings,
      totalUploadedImages,
      user,
      selectedCount: sizedFiles.length,
      userTypeCustomer: USER_TYPES.CUSTOMER,
      dispatch,
      setLimitReachedAction: setLimitReached,
      actionType: "upload",
    });

    if (shouldStop) {
      event.target.value = "";
      return;
    }

    let filesToUpload = sizedFiles.slice(0, allowedCount);

    if (filesToUpload.length === 0) {
      event.target.value = "";
      return;
    }

    // ONE batch id for the whole selection so the gallery refetch fires ONCE,
    // after EVERY image has finished (not in chunks of 10).
    const batchId = uuidv4();
    const uploadItems = [];

    for (const file of filesToUpload) {
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
      if (themeId) {
        formData.append("theme_id", themeId);
      }

      formData.append("editor_type", "");
      formData.append("device", "web");
      formData.append("batch_id", batchId);

      uploadItems.push({ file, formData });
    }

    // Dispatch with bounded concurrency to prevent signed URL expiry
    dispatchUploadsWithConcurrency(dispatch, uploadItems);

    event.target.value = "";

    if (user && user?.userTypeCode !== USER_TYPES.CUSTOMER) {
      handleShow(1);
    }
    // Customers: no modal — the selected photos appear in the sidebar
    // gallery as uploading tiles immediately (optimistic placement).
  };

  const handleDesktopUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    handleUpload({ target: { files } });
  };

  return (
    <div style={{ minHeight: "100%" }}>
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{ minHeight: "100%" }}
      >
        {(!isMobile && (
          <>
            <div
              className="w-100 mt-4  rounded-4 d-flex flex-column justify-content-center align-items-center p-4"
              style={{
                border: "0.5px dashed var(--primary)",
                background: "var(--background)",
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <LuArrowUpToLine size={45} />
              <p className="mb-0 mt-3" style={{ fontSize: "15px" }}>
                Drag and Drop
              </p>
              <p className="mb-0" style={{ fontSize: "15px" }}>
                Or
              </p>
              <PrimaryButton
                mt="15px"
                radius="50px"
                onClick={handleDesktopUploadClick}
              >
                Select Photos
              </PrimaryButton>
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleUpload}
                multiple
                accept="image/*"
              />

              <p
                className="mb-0 mt-3 text-center"
                style={{
                  fontSize: "12px",
                  color: "var(--primary)",
                  fontWeight: "500",
                }}
              >
                📌 Supported formats: JPEG, PNG, WebP
              </p>
            </div>
            <div className="mt-3 border bg-white border rounded-4 w-100 d-flex flex-column justify-content-center align-items-center p-4">
              <QRCodeSVG value={qrCodeUrl} size={120} level="H" />
              <p className="mb-0 text-center mt-3">
                To <b>upload from your phone</b>
              </p>
              <p className="mb-0">scan this QR code</p>
            </div>
          </>
        )) || (
            <div className="mt-4 w-100">
              <PrimaryButton
                mt="15px"
                width="100%"
                radius="50px"
                onClick={handleDesktopUploadClick}
              >
                Select Photos
              </PrimaryButton>
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleUpload}
                multiple
                accept="image/*"
              />

              <p
                className="mb-0 mt-3 text-center"
                style={{
                  fontSize: "12px",
                  color: "var(--primary)",
                  fontWeight: "500",
                }}
              >
                📌 Supported formats: JPEG, PNG, WebP
              </p>
            </div>
          )}

        <div className="mt-4 w-100">
          <PrimaryButton
            mt="0"
            radius="50px"
            width="100%"
            onClick={() => handleShow(1)}
          >
            My Photos
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default AddFistTimePhotoModal;
