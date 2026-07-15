import React, { useState, useEffect } from "react";
import {
  ActionTitle,
  Box,
  DisplayBetween,
  FlexBox,
  SearchBox,
  SearchInput,
  ButtonComponent,
  DisplayCenter,
  LightPrimaryButton,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";
import { FaPlus } from "react-icons/fa";
import { Pagination } from "react-bootstrap";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { withAssetCache } from "../../library/utils/helpers/assetsCache";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { EDITOR_ASSETS } from "../../library/utils/constants/index";
import { addObjectInPage } from "../../store/slices/canvas";
import { PageLoader } from "../../common-components/Loaders";
import CachedImage from "../../common-components/CachedImage";
import styled from "styled-components";
import { ClipArtActionModal } from "./ClipArtActionModal";
import { UploadClipArtModal } from "./UploadClipArtModal";

const ClipArtGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem 0;
`;

const ClipArtItem = styled.div`
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 1;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    .overlay {
      opacity: 1;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #f8f9fa;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
`;

export const ClipArtAction = () => {
  const dispatch = useDispatch();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [clipArts, setClipArts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClipArt, setSelectedClipArt] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const imagesPerPage = 20;

  useEffect(() => {
    fetchClipArts(currentPage, searchText);
  }, [currentPage]);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const fetchClipArts = (pageNumber = 1, searchQuery = "") => {
    // setLoading(true);
    // const data = {
    //   filter: {
    //     status: 1,
    //     type: EDITOR_ASSETS.CLIPART,
    //     display_in_web: true,
    //     search: searchQuery,
    //   },
    //   skip: (pageNumber - 1) * imagesPerPage,
    //   limit: imagesPerPage,
    // };

    // // Offline-first: serve the last cached clip-art listing when the network/API
    // // is unavailable, and write-through the freshest listing whenever online.
    // withAssetCache("cliparts", data, () => apiPost(ENDPOINTS.getClipArts, data))
    //   .then((response) => {
    //     if (response && response.items) {
    //       setClipArts(response.items);
    //       let totalCount = response.totalCount || 0;
    //       setTotalPages(Math.ceil(totalCount / imagesPerPage));
    //     }
    //   })
    //   .catch((error) => {
    //   })
    //   .finally(() => {
    //     setLoading(false);
    //   });
  };

  const handleSearch = (value) => {
    setSearchText(value);
    if (!value.trim()) {
      fetchClipArts(1);
      setCurrentPage(1);
    }
  };

  const handleClipArtClick = (clipArt) => {
    setSelectedClipArt(clipArt);
  };

  const handleClipArtAction = (actionType) => {
    if (!selectedClipArt) return;

    const obj = {
      ...selectedClipArt,
      type: actionType === "background" ? "background" : "clipart",
      x: 10,
      y: 10,
      width: selectedClipArt.urls.find((item) => item.size === "large").w,
      height: selectedClipArt.urls.find((item) => item.size === "large").h,
    };

    dispatch(addObjectInPage(obj));
    setSelectedClipArt(null);
  };

  return (
    <>
      <div className="container mt-3 sticker-container sticker-container-mob">
        <DisplayBetween className="heading-action-mob">
          <ActionTitle>Clip Art</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>

        <div className="">
          <div className="w-100">
            <FlexBox justify="space-between" align="center" className="d-flex">
              <SearchBox className="w-100 my-1">
                <Box
                  className="search-icon"
                  onClick={() => {
                    fetchClipArts(1, searchText);
                    setCurrentPage(1);
                  }}
                >
                  <SearchIcon />
                </Box>
                <SearchInput
                  type="text"
                  placeholder="Search Clip Art"
                  value={searchText}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      fetchClipArts(1, searchText);
                      setCurrentPage(1);
                    }
                  }}
                />
                <Box className="filter-icon">
                  <FilterIcon />
                </Box>
              </SearchBox>
              <div className="w-100 py-3 justify-content-center">
                <LightPrimaryButton onClick={() => setShowUploadModal(true)}>
                  <DisplayCenter>
                    <FaPlus />
                    <Box ml="10px">Upload Clip Art</Box>
                  </DisplayCenter>
                </LightPrimaryButton>
              </div>
            </FlexBox>

            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
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
                  {currentPage > 1 && (
                    <Pagination.Item
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      {currentPage - 1}
                    </Pagination.Item>
                  )}
                  <Pagination.Item active>{currentPage}</Pagination.Item>
                  {currentPage < totalPages && (
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
            {loading && <PageLoader />}

            {!loading && (
              <ClipArtGrid>
                {clipArts.map((clipart) => (
                  <ClipArtItem
                    key={clipart._id}
                    onClick={() => handleClipArtClick(clipart)}
                  >
                    <CachedImage
                      src={
                        (clipart.urls?.find((item) => item.size === "large") ||
                          clipart.urls?.[0])?.url
                      }
                      alt={clipart.name || "Clip Art"}
                      loading="lazy"
                    />
                    <div className="overlay" />
                  </ClipArtItem>
                ))}
              </ClipArtGrid>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClipArtActionModal
        show={selectedClipArt !== null}
        clipArt={selectedClipArt}
        onHide={() => setSelectedClipArt(null)}
        onAction={handleClipArtAction}
      />

      <UploadClipArtModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
          fetchClipArts(currentPage);
        }}
      />
    </>
  );
};
