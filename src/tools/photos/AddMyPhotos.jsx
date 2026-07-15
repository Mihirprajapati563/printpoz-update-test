import {
  ScrollButton,
  DateCheckbox,
  AddMyPhotoItem,
  Box,
  FlexBox,
  SelectedPhotoBox,
  AddMyPhotoBox,
  DisplayBetween,
  BodyText,
  PrimaryButton,
  DeleteButton,
} from "../../common-components/StyledComponents";
import { Form, Pagination, Spinner } from "react-bootstrap";
import { useEffect, useRef, useState } from "react";
import { groupPhotosByDate, handleImageUploadLimit } from "../../library/utils/common-functions";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import ImageWithLoader from "../../common-components/ImageWithLoader";
import { refreshProjectImages, setLimitReached, setTotalUploadedImages } from "../../store/slices/imageUpload";
import { v4 as uuidv4 } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { getSettings } from "../../library/utils/helpers/canvasSliceGetters";
import { USER_TYPES } from "../../library/utils/constants";
import { FaTrashAlt } from "react-icons/fa";
export const AddMyPhoto = ({ socialImages, handleClose }) => {
  const [searchParams] = useSearchParams();
  const [groupedPhotos, setGroupedPhotos] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const users = JSON.parse(localStorage.getItem("userDetails"));
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const imagesPerPage = 20;
  const [dataLoading, setDataLoading] = useState(true);
  const dispatch = useDispatch();
  const settings = useSelector(getSettings);
  const totalUploadedImages = useSelector(
    (state) => state.imageUpload.totalUploadedImages
  );
  const [isDeleting, setIsDeleting] = useState(false);

  //handle page change
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        setIsScrollable(
          scrollRef.current.scrollWidth > scrollRef.current.clientWidth
        );
      }
    };

    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize); // Check on resize

    return () => window.removeEventListener("resize", handleResize);
  }, [photos]);

  // Group photos by date
  useEffect(() => {
    if (photos.length > 0) {
      setGroupedPhotos(groupPhotosByDate(photos));
    }
  }, [photos]);

  // select & unselect photo
  const handlePhotoClick = (photo) => {
    const newPhotos = photos.map((item) =>
      item.id === photo.id ? { ...item, isSelected: !item.isSelected } : item
    );
    setPhotos(newPhotos);
    // photos[indexOf(photos.find(photo))] = { ...photo, isSelected: !photo.isSelected }

    setSelectedPhotos(
      (prevSelectedPhotos) =>
        prevSelectedPhotos.some((item) => item.id === photo.id)
          ? prevSelectedPhotos.filter((item) => item.id !== photo.id) // Remove if already selected
          : [...prevSelectedPhotos, { ...photo, isSelected: !photo.isSelected }] // Add new photo with updated selection state
    );
  };

  // Handle date checkbox change
  const handleDateCheckboxChange = (date) => {
    const photosForDate = photos.filter((photo) => photo.date === date);
    const allSelected = photosForDate.every((photo) => photo.isSelected);

    const newPhotos = photos.map((photo) => {
      if (photo.date === date) {
        return { ...photo, isSelected: !allSelected };
      }
      return photo;
    });

    setPhotos(newPhotos);

    setSelectedPhotos((prevSelectedPhotos) => {
      if (allSelected) {
        // If all were selected, remove all photos of the date from selectedPhotos
        return prevSelectedPhotos.filter(
          (photo) =>
            photo.date !== date ||
            (photo.date === date &&
              !photos.some((currentPhoto) => currentPhoto.id === photo.id))
        );
      } else {
        // Add all photos of the date to selectedPhotos
        const photosToAdd = photosForDate
          .filter(
            (photo) =>
              !prevSelectedPhotos.some(
                (selectedPhoto) => selectedPhoto.id === photo.id
              )
          )
          .map((photo) => ({ ...photo, isSelected: !photo.isSelected }));

        return [...prevSelectedPhotos, ...photosToAdd];
      }
    });
  };

  // Check if any photo is selected
  const isAnyPhotoSelected = photos.some((photo) => photo.isSelected);

  // Get the count of selected photos
  const selectedPhotoCount = photos.filter((photo) => photo.isSelected).length;

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -70, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 70, behavior: "smooth" });
    }
  };

  useEffect(() => {
    getMyPhotos(currentPage);
  }, [currentPage]);

  // get my photos
  const getMyPhotos = async (pageNumber = 1, searchQuery = "") => {
    try {
      const data = {
        filter: {
          user_id: users._id,
          status: 1,
          userTypeCode: users?.userTypeCode,
        },

        skip: (pageNumber - 1) * imagesPerPage,
        limit: imagesPerPage,
      };

      // Fetch photos
      setDataLoading(true);
      await apiPost(ENDPOINTS.getMyPhotos, data)
        .then((response) => {
          if (response && response.items) {
            setPhotos(transformResponseArray(response.items));
            setTotalPages(Math.ceil(response.totalCount / imagesPerPage));
          }
        })
        .catch((error) => {
        })
        .finally(() => { });
    } catch (error) {
    } finally {
      setDataLoading(false);
    }
  };

  function transformResponseArray(responseArray) {
    return responseArray.map((response) => {
      const createdDate = new Date(response.createdAt);
      const formattedDate = createdDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return {
        id: response._id,
        date: formattedDate,
        src: response.urls[2]?.url || "",
        isSelected: selectedPhotos.some((photo) => photo.id === response._id), // Check global selection
      };
    });
  }

  // delete single photo
  const deletePhoto = (id) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    apiPost(ENDPOINTS.deleteProjectImage, { _id: id })
      .then((response) => {
        if (response?.status === 1) {
          setPhotos((prev) => prev.filter((p) => p.id !== id));
          setSelectedPhotos((prev) => prev.filter((p) => p.id !== id));
          dispatch(setTotalUploadedImages(Math.max(0, totalUploadedImages - 1)));
        }
      })
      .catch(() => {});
  };

  // delete all selected photos
  const deleteSelectedPhotos = async () => {
    if (!window.confirm("Are you sure you want to delete selected photos?")) return;
    const ids = selectedPhotos.map((p) => p.id);
    setIsDeleting(true);
    try {
      const response = await apiPost(ENDPOINTS.deleteMultipleProjectImages, { images_id: ids });
      if (response?.status === 1) {
        setPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
        setSelectedPhotos([]);
        dispatch(setTotalUploadedImages(Math.max(0, totalUploadedImages - ids.length)));
        await getMyPhotos(currentPage);
      }
    } catch (err) {
    } finally {
      setIsDeleting(false);
    }
  };

  // delete all photos for a date group
  const deletePhotosByDate = (date) => {
    const idsForDate = photos.filter((p) => p.date === date).map((p) => p.id);
    if (idsForDate.length === 0) return;
    if (!window.confirm(`Delete all ${idsForDate.length} photo(s) from ${date}?`)) return;
    apiPost(ENDPOINTS.deleteMultipleProjectImages, { images_id: idsForDate })
      .then((response) => {
        if (response?.status === 1) {
          setPhotos((prev) => prev.filter((p) => p.date !== date));
          setSelectedPhotos((prev) => prev.filter((p) => p.date !== date));
          dispatch(setTotalUploadedImages(Math.max(0, totalUploadedImages - idsForDate.length)));
        }
      })
      .catch(() => {});
  };

  // add photos to project
  const addPhotosToProject = async () => {
    try {
      const { shouldStop, allowedCount } = handleImageUploadLimit({
        settings,
        totalUploadedImages,
        user: users,
        selectedCount: selectedPhotos.length,
        userTypeCustomer: USER_TYPES.CUSTOMER,
        dispatch,
        setLimitReachedAction: setLimitReached,
        actionType: "add",
      });

      if (shouldStop) return;

      if (allowedCount < selectedPhotos.length) {
        setSelectedPhotos((prev) => prev.slice(0, allowedCount));
      }

      const photosToAdd = selectedPhotos.slice(0, allowedCount);

      if (photosToAdd.length === 0) {
        return;
      }

      const data = {
        cart_order_id: searchParams.get("c_id"),
        images_id: [...photosToAdd.map((selected) => selected.id)],
      };
      await apiPost(ENDPOINTS.addToProject, data)
        .then((response) => {
          if (response && response.status == 1) {
            let batchId = uuidv4();
            dispatch(refreshProjectImages(batchId));
            setSelectedPhotos([]);
            // chane all photo to unselected
            setPhotos((prev) =>
              prev.map((photo) => ({
                ...photo,
                isSelected: false,
              }))
            );

            if (handleClose) {
              handleClose();
            }
          }
        })
        .catch((error) => {
        })
        .finally(() => { });
    } catch (error) {
    }
  };

  return (
    <>
      {dataLoading && (
        <div className="d-flex justify-content-center">
          <div
            className="spinner-border theme-bg-color-text"
            role="status"
          ></div>{" "}
        </div>
      )}

      {!dataLoading && (
        <>
          {photos.length > 0 ? (
            <AddMyPhotoBox
              className={`side-bar-scroll add-photo-box ${isAnyPhotoSelected ? "seleted-visible" : ""
                }`}
            >
              {Object.keys(groupedPhotos).map((date) => {
                const photosForDate = groupedPhotos[date];
                const allSelected = photosForDate.every(
                  (photo) => photo.isSelected
                );

                return (
                  <Box mb="15px" key={date}>
                    <DateCheckbox>
                      <Form.Group controlId={`date-checkbox-${date}`}>
                        <Form.Check
                          type="checkbox"
                          label={date}
                          checked={allSelected}
                          onChange={() => handleDateCheckboxChange(date)}
                        />
                      </Form.Group>
                    </DateCheckbox>
                    <FlexBox
                      gap="15px"
                      className="justify-content-center justify-content-lg-start"
                    >
                      {photosForDate.map((photo, index) => (
                        <AddMyPhotoItem
                          key={index}
                          className={photo.isSelected ? "active" : ""}
                          onClick={() => handlePhotoClick(photo)}
                        >
                          <div className="image-box">
                            <ImageWithLoader
                              src={photo.src}
                              alt="add-my-photo"
                            />
                            <div className="overlay"></div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                              title="Delete photo"
                              className="photo-delete-btn"
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "20px",
                                height: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                // background: "transparent",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                color: "#e53935",
                                zIndex: 3,
                              }}
                            >
                              <FaTrashAlt size={11} />
                            </button>
                          </div>
                        </AddMyPhotoItem>
                      ))}
                    </FlexBox>
                  </Box>
                );
              })}
            </AddMyPhotoBox>
          ) : (
            <div className="w-100 h-100 d-flex  justify-content-center align-items-center">
              <p>Photos Not Found</p>
            </div>
          )}
        </>
      )}

      {/* Pagination (Always visible if conditions match) */}
      {totalPages >= 1 && photos.length > 0 && (
        <div
          className="bg-pagination"
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "20px",
          }}
        >
          <Pagination>
            <Pagination.Prev
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            />
            {currentPage - 10 > 0 && (
              <>
                <Pagination.Item
                  onClick={() => handlePageChange(currentPage - 10)}
                >
                  {currentPage - 10}
                </Pagination.Item>
                <Pagination.Ellipsis />
              </>
            )}
            {currentPage > 1 && totalPages < 10 && (
              <Pagination.Item
                onClick={() => handlePageChange(currentPage - 1)}
              >
                {currentPage - 1}
              </Pagination.Item>
            )}
            <Pagination.Item active>{currentPage}</Pagination.Item>
            {currentPage < totalPages && totalPages < 10 && (
              <Pagination.Item
                onClick={() => handlePageChange(currentPage + 1)}
              >
                {currentPage + 1}
              </Pagination.Item>
            )}
            {currentPage + 10 <= totalPages && (
              <>
                <Pagination.Ellipsis />
                <Pagination.Item
                  onClick={() => handlePageChange(currentPage + 10)}
                >
                  {currentPage + 10}
                </Pagination.Item>
              </>
            )}
            <Pagination.Next
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            />
          </Pagination>
        </div>
      )}

      {/* Selected Photos (Always visible if any are selected) */}
      {selectedPhotos.length > 0 && (
        <SelectedPhotoBox>
          <DisplayBetween>
            <BodyText fontweight="500" textcolor="#232323">
              {selectedPhotos.length} Selected Photos
            </BodyText>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={deleteSelectedPhotos}
                disabled={isDeleting}
                style={{
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "#fff",
                  border: "1px solid #e53935",
                  borderRadius: "5px",
                  color: "#e53935",
                  fontSize: "13px",
                  cursor: "pointer",
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                <FaTrashAlt size={12} />
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
              <PrimaryButton
                radius="5px"
                onClick={() => {
                  addPhotosToProject();
                }}
              >
                Add To Projects
              </PrimaryButton>
            </div>
          </DisplayBetween>
          <Box mt="15px">
            <div ref={scrollRef} className={`d-flex gap-2 w-100 overflow-auto`}>
              <ScrollButton
                side="left"
                onClick={scrollLeft}
                show={isScrollable}
              >
                ❮
              </ScrollButton>
              {selectedPhotos.map((photo, index) =>
                photo.isSelected ? (
                  <img
                    src={photo.src}
                    key={`selected-photo-${index + 1}`}
                    alt={`selected-photo-${index + 1}`}
                  />
                ) : null
              )}
              <ScrollButton
                side="right"
                onClick={scrollRight}
                show={isScrollable}
              >
                ❯
              </ScrollButton>
            </div>
          </Box>
        </SelectedPhotoBox>
      )}
    </>
  );
};
