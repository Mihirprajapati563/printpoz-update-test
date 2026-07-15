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
import { isDesktop } from "../../desktop";
import { toast } from "react-toastify";
import { apiMultiPartPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { dispatchUploadsWithConcurrency } from "../../store/background-services/imageUploadThunks";
import QRCodeDisplay from "./QRCodeDisplay";
import { useSelector, useDispatch } from "react-redux";
import { isMobile } from "react-device-detect";
import { v4 as uuidv4 } from "uuid";
import { setLimitReached } from "../../store/slices/imageUpload";
import { getSettings } from "../../library/utils/helpers/canvasSliceGetters";
import { USER_TYPES } from "../../library/utils/constants";

export const PhotoFromDevice = ({ openPhotoOption, handleClose }) => {
  const [fromMobile, setFromMobile] = useState(false);
  const projectSetup = useSelector((state) => state.projectSetup);
  const [user, setUser] = useState(null);
  const settings = useSelector(getSettings);
  const dispatch = useDispatch();
  const totalUploadedImages = useSelector(
    (state) => state.imageUpload.totalUploadedImages
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
    // after EVERY image has finished — NOT in chunks of 10 (the % 10 split made
    // the refetch fire as soon as the first 10 uploaded).
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

    // Optimistic placement: close the dialog immediately — the selected
    // photos appear in the sidebar gallery as uploading tiles and can be
    // placed right away. (Queue tab stays reachable via Add Photos.)
    // Desktop: there is no upload, so NEVER route to the Upload Queue tab —
    // just close; the photos are already in the local gallery.
    if (handleClose) {
      handleClose();
    } else if (!isDesktop) {
      openPhotoOption("Upload Queue");
    }
  };

  // Trigger file input click
  const handleDesktopUploadClick = () => {
    fileInputRef.current.click(); // Trigger file input click
  };

  return (
    <>
      {fromMobile === false ? (
        <FlexBox
          justify="center"
          pt="100px"
          pb="100px"
          className="add-photo-proj-mob"
        >
          <FlexBox gap="18px" direction="column">
            <TitleMd align="center" fontsize="24px">
              Let’s Get Started By Adding Photos!
            </TitleMd>
            {/* <Title20 color="#696969" fontsize="17px">You can drag and drop photos or entire folder here</Title20> */}
            <FlexBox
              gap="60px"
              mt="30px"
              justify="center"
              alignitems="flex-end"
              className="center-photo-upload-box-mob"
            >
              {/* Upload from device */}
              <FlexBox direction="column" gap="20px" alignitems="center">
                <div style={{ height: "70px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isMobile ? <Mobile /> : <Computer />}
                </div>
                <PrimaryButton radius="5px" onClick={handleDesktopUploadClick}>
                  Select Photos
                </PrimaryButton>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleUpload}
                  multiple
                  accept="image/*"
                />
              </FlexBox>

              {/* Upload from phone */}
              {projectId && !isMobile && (
                <FlexBox direction="column" gap="20px" alignitems="center">
                  <div style={{ height: "70px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mobile />
                  </div>
                  <PrimaryButton onClick={() => setFromMobile(true)} radius="5px">
                    Add from Phone
                  </PrimaryButton>
                </FlexBox>
              )}

              {/* Google Photos */}
              {/* <FlexBox direction="column" gap="20px" alignitems="center">
                <div style={{ height: "70px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 48 48">
                    <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                </div>
                <PrimaryButton radius="5px" onClick={() => openPhotoOption("Import Photos")}>
                  Google Photos
                </PrimaryButton>
              </FlexBox> */}
            </FlexBox>
          </FlexBox>
        </FlexBox>
      ) : (
        <FlexBox
          className="col-md-12 mx-auto photo-mob-flexbox"
          pt="60px"
          pb="60px"
        >
          <FromMobileWrapper>
            <FlexBox
              className="cursor-pointer mb-1"
              onClick={() => setFromMobile(false)}
            >
              <FaAngleLeft size={16} color="#232323" />
              <BodyText
                fontsize="16px"
                fontweight="500"
                textcolor="#232323"
                ml="10px"
              >
                Back
              </BodyText>
            </FlexBox>
            <Box className="mb-4">
              <Title20 color="#232323" fontsize="17px" align="center">
                Upload photos from your phone
              </Title20>
            </Box>
            <Box width="90%" className="mx-auto text-center">
              <FromMobileIcon className="img-fluid" />
            </Box>
            <FlexBox direction="column" gap="5px" className="mt-3">
              <Box>
                {/* <img width=</Box>"125px" src="/images/qr_sample.webp" alt="qr" /> */}
                <QRCodeDisplay value={qrCodeUrl} />
              </Box>
            </FlexBox>
          </FromMobileWrapper>
        </FlexBox>
      )}
    </>
  );
};
