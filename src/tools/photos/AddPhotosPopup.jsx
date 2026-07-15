import { useEffect, useState, useRef } from "react";
import {
  BodyText,
  Box,
  DisplayEnd,
  FlexBox,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  PhotoOptionItem,
} from "../../common-components/StyledComponents";
import { AddPhotoModalJSON } from "../../library/utils/jsons/commonJSON";
import { useDispatch, useSelector } from "react-redux";
import { setIsUploadAcvtive } from "../../store/slices/appAlice";
import { FaAngleLeft } from "react-icons/fa6";
import { USER_TYPES } from "../../library/utils/constants";
import { AiOutlineClose } from "react-icons/ai";
import { setImageUploaded } from "../../store/slices/imageUpload";
import { isDesktop } from "../../desktop";

// Desktop stores photos locally (no upload), so there is no "Upload Queue" — drop
// that tab entirely. The web build keeps it unchanged.
// NOTE: must be a FUNCTION (read lazily at render), not a module-scope constant —
// commonJSON ⇄ photo-component imports form a cycle, so reading AddPhotoModalJSON
// at module-init time hits a temporal-dead-zone ReferenceError.
const basePhotoOptions = () =>
  isDesktop
    ? AddPhotoModalJSON.filter((item) => item.title !== "Upload Queue")
    : AddPhotoModalJSON;

export const PhotoModal = ({ show, handleClose, defaultPhotoOption }) => {
  const [addPhotoOption, setAddPhotoOption] = useState(basePhotoOptions);
  const dispatch = useDispatch();
  const isActive = useSelector((state) => state.appSlice.isUploadAcvtive);
  const [user, setUser] = useState(null);

  const uploadImages = useSelector((state) => state.imageUpload.images);
  const imageUploaded = useSelector((state) => state.imageUpload.imageUploaded);
  const autoCloseTimeoutRef = useRef(null);

  const handlephotoOptionClick = (item) => {
    if (!item) return;
    dispatch(setIsUploadAcvtive(true));
    setAddPhotoOption(
      addPhotoOption.map((tempItem) => ({
        ...tempItem,
        isActive: tempItem.title === item.title,
      }))
    );
  };

  const openPhotoOption = (title) => {
    dispatch(setIsUploadAcvtive(true));
    setAddPhotoOption(
      addPhotoOption.map((tempItem) => ({
        ...tempItem,
        isActive: tempItem.title === title,
      }))
    );
  };

  useEffect(() => {
    // Fall back to the first tab if the requested default was filtered out
    // (e.g. "Upload Queue" on desktop).
    handlephotoOptionClick(addPhotoOption[defaultPhotoOption] || addPhotoOption[0]);
  }, [show]);

  useEffect(() => {
    const users = localStorage.getItem("userDetails");
    if (!users) {
      setUser(null);
      return;
    }
    setUser(JSON.parse(users));
  }, []);

  useEffect(() => {
    if (user && user?.userTypeCode !== USER_TYPES.CUSTOMER) {
      setAddPhotoOption(
        basePhotoOptions().filter((item) => !["My Photos"].includes(item.title))
      );
    }
  }, [user]);

  useEffect(() => {
    if (!show || uploadImages.length === 0) return;

    const allUploadsComplete = uploadImages.every(
      (img) => img.uploadProgress === 100 && img.status === "uploaded"
    );

    const hasFailedUploads = uploadImages.some(
      (img) => img.status === "failed"
    );

    if (allUploadsComplete && !hasFailedUploads && imageUploaded) {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }

      autoCloseTimeoutRef.current = setTimeout(() => {
        dispatch(setImageUploaded(false));
        handleClose();
      }, 500);
    }

    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, [show, uploadImages, imageUploaded, handleClose, dispatch]);

  return (
    <>
      <PhotoModalStyled
        show={show}
        onHide={handleClose}
        size="xl"
        backdrop="static"
        dialogClassName="mob_full_screen_modal"
      >
        <PhotoModalHeader>
          <FlexBox grow={1} justify="center">
            <BodyText
              fontsize="20px"
              fontweight="600"
              textcolor={`var(--primary)`}
              ml="20px"
            >
              Add Photos to your project
            </BodyText>
          </FlexBox>
          <FlexBox className="cursor-pointer" onClick={handleClose}>
            {/* <FaAngleLeft size={16} color="#232323" /> */}
            <BodyText
              fontsize="16px"
              fontweight="500"
              textcolor="#232323"
              ml="10px"
            >
              {/* Back To Project */}
              <AiOutlineClose size={24} color="#000" />
            </BodyText>
          </FlexBox>
        </PhotoModalHeader>
        <PhotoModalBody>
          <Box className="side-bar">
            {addPhotoOption.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <PhotoOptionItem
                  key={item.title || index}
                  className={`${item.isActive && isActive ? "active" : ""
                    } photo_box_modal`}
                  onClick={() => handlephotoOptionClick(item)}
                >
                  <IconComponent />
                  <span className="title">{item.title}</span>
                </PhotoOptionItem>
              );
            })}
          </Box>
          <Box
            className="modal-body-main-content photo-body-main-content-mob"
            style={{ maxHeight: "80vh", overflowY: "auto" }}
          >
            {isActive && (
              <Box>
                {addPhotoOption.map(
                  (item, index) =>
                    item.isActive && <div key={item.title || index} style={{ height: "100%" }}>{item.action(openPhotoOption, handleClose)}</div>
                )}
              </Box>
            )}
          </Box>
        </PhotoModalBody>
      </PhotoModalStyled>
    </>
  );
};
