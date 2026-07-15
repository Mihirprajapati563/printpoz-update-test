import React, { useRef, useEffect, useState } from "react";
import $ from "jquery";
import "turn.js";
import "./photoBookPreview.css"; // Your custom styles
import scissor from "../../library/utils/three-js-functions/scissor.js"; // Assuming scissor is properly set up
import previmage from "../../assets/images/prev.png";
import nextimage from "../../assets/images/next.png";
import {
  Box,
  PhotoModalBody,
  PhotoModalCloseHeader,
  PhotoModalStyled,
  PhotoModalHeader,
  BodyText,
} from "../../common-components/StyledComponents.jsx";
import { PhotoBookPreviewPages } from "./photoBookPreivewPages.jsx";
import {
  getAllPages,
  getAllObjectsSortedByZIndexByPageIndex,
  getZoom,
  getActiveEditorType,
  getCurrentPageIndex,
  getAllSafeAreaObjectsSortedByZIndexByPageIndex,
  getSafeAreaFromPage,
} from "../../library/utils/helpers";
import { useSelector, useDispatch, useStore } from "react-redux";
import { getCanvasSize, getCanvasScale, getSettings } from "../../library/utils/helpers";
import { getEditorConfiguration } from "../../store/slices/editorConfigurations";
import {
  setCurrentObjectProperties,
  setZoom,
  setCanvasScale,
} from "../../store/slices/canvas.js";
import {
  getResolutionScaleValue,
  getResolutionScaleValueBySize,
  calculateZoomRatio,
  hasAnyClass,
} from "../../library/utils/common-functions";
import {
  EDITOR_TYPES,
  USER_TYPES,
} from "../../library/utils/constants/index.js";
import { First } from "react-bootstrap/esm/PageItem.js";
import { Button } from "react-bootstrap";
import {
  FaChevronCircleLeft,
  FaChevronCircleRight,
  FaMinusCircle,
  FaPlusCircle,
} from "react-icons/fa";
import { BiZoomOut } from "react-icons/bi";
import styled from "styled-components";
import { FaDownload } from "react-icons/fa6";
import {
  resetWaterMarkColor,
  resetWaterMarkData,
  setExportAsZip,
  setIsPreviewBook,
  setWaterMarkColor,
  setWaterMarkData,
} from "../../store/slices/svgData";
import { setExportFormat } from "../../store/slices/svgData";
import { setExportPageType } from "../../store/slices/svgData";
import {
  setInitilized,
  setSvgData,
  setAllPagesCaptured,
  setIsCapturingPages
} from "../../store/slices/svgData";
import useExportPages from "../../library/utils/custom-hooks/useExportPages";
import { usePdfExport } from "../../contexts/PdfExportContext";
import { WatermarkModal } from "../../common-components/WatermarkModal.jsx";
import { ProgressModal } from "../../common-components/ProgressModal.jsx";

const PreviewModalHeader = styled(PhotoModalHeader)`
  background: transparent !important;
  border: none !important;
  position: absolute !important;
  top: 30px !important;
  right: 25px !important;
  left: 30px !important;
  z-index: 10050 !important;
  padding: 0 !important;
  height: auto !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  pointer-events: none !important;

  .btn-close {
    pointer-events: auto !important;
  }
`;

const PreviewTitleBadge = styled.div`
  pointer-events: auto;
  background-color: rgba(255, 255, 255, 0.85);
  padding: 6px 14px;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const PhotobookPreview = ({ show, handleClose }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const { exportProgress, updateProgress } = usePdfExport();
  const { exportPageSVG, uploading } = useExportPages();

  // const [isCover, setIsCover] = useState(true);
  // const [bookheight, setMainBookHeight] = useState(0);
  // const [bookwidth, setMainBookWidth] = useState(0);
  const [currentActivePage, setCurrentActivePage] = useState(1);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const flipbookRef = useRef(null);
  const wrapperRef = useRef(null);

  // const zoomRatio = useSelector(getZoom);
  const AllPages = useSelector(getAllPages);
  const canvasSize = useSelector(getCanvasSize);
  const canvasScale = useSelector(getCanvasScale);
  const activeEditorType = useSelector(getActiveEditorType);
  const settings = useSelector(getSettings);
  // Ref so the jQuery turning handler always reads the latest hideLastCover value
  // (the handler runs inside a stale closure captured at flipbook init time)
  const hideLastCoverRef = useRef(settings?.hideLastCover);
  const showFullCoverRef = useRef(settings?.showFullCoverSheet);
  useEffect(() => {
    hideLastCoverRef.current = settings?.hideLastCover;
    showFullCoverRef.current = settings?.showFullCoverSheet;
  }, [settings?.hideLastCover, settings?.showFullCoverSheet]);
  // When hideLastCover is on, keep all pages so the book has the right physical count
  // but blank out the last page so no design is visible
  const displayPages = AllPages.map((page, index) =>
    settings?.hideLastCover && index === AllPages.length - 1
      ? { ...page, layout: (page.layout || []).map(l => ({ ...l, objects: [], safeAreaObjects: [], background: { color: "#ffffff", opacity: 1 } })) }
      : page
  );
  const configuration = useSelector(getEditorConfiguration);

  const userDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetails);
  const isPreviewRoute =
    typeof window !== "undefined" && window.location.pathname.includes("/preview");

  const { waterMarkData, waterMarkColor } = useSelector(
    (state) => state.svgData
  );

  let bookheight = 0;
  let bookwidth = 0;

  //updatedepth function for update the left and right depth
  function updateDepth(book, newPage) {
    const page = book.turn("page");
    const totalPages = book.turn("pages");

    // Reset depth indicators
    $(".left-depth").css({ width: 0 });
    $(".right-depth").css({ width: 0 });

    newPage = newPage || page;

    const rightDepthWidth =
      16 * Math.min(1, ((totalPages - newPage) * 2) / totalPages);
    const leftDepthWidth = 16 * Math.min(1, (page * 2) / totalPages);

    if (newPage == 1) {
      $(".right-depth").css({
        width: rightDepthWidth,
        left: bookwidth / 4,
        top: -bookheight / 1.9,
      });
    } else if (newPage === totalPages) {
      $(".left-depth").css({
        width: leftDepthWidth,
        left: -bookwidth * 0.26,
        top: -bookheight / 1.9,
      });
    } else if (newPage > 1 && newPage < totalPages) {
      $(".left-depth").css({
        width: leftDepthWidth,
        left: -bookwidth * 0.52,
        top: -bookheight / 1.9,
      });
      $(".right-depth").css({
        width: rightDepthWidth,
        left: bookwidth / 2,
        top: -bookheight / 1.9,
      });
    }
  }
  // adjust viwoport height and width
  const adjustViewport = () => {
    const viewport = $(".flipbook-viewport");
    const flipbook = $(flipbookRef.current);

    // Adjust viewport size based on flipbook size
    const width = flipbook.width();
    const height = flipbook.height();

    viewport.css({
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
    });
  };

  const ExportButton = styled(Button)`
    background: var(--primary, #4084b5);
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    width: 100%;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(64, 132, 181, 0.3);
    }

    &:disabled {
      background: #cbd5e1;
      transform: none;
      box-shadow: none;
    }

    @media (max-width: 768px) {
      padding: 0.625rem 1rem;
      font-size: 0.8rem;

      &:hover {
        transform: none;
      }
    }
  `;

  const PhotoModalPdfDownloadButton = styled.div`
    position: absolute;
    top: 15px;
    right: 70px;
    z-index: 1050; /* Ensures it stays above the modal body */
    display: flex;
    align-items: center;
    justify-content: flex-end;

    button {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `;

  // get page lable
  const getPageLabel = (page) => {
    if (settings?.showFullCoverSheet) {
      // Full cover mode — hidden placeholder is page 1, cover spread is pages 2-3
      if (page === 2 || page === 3) {
        return "Cover";
      } else if (page % 2 === 0) {
        return `Page ${page - 3}-${page - 2}`;
      } else {
        return `Page ${page - 4}-${page - 3}`;
      }
    }
    // Normal mode
    if (page === 1) {
      return "Front Cover";
    } else if (page + 1 === AllPages.length * 2 - 1) {
      return settings?.hideLastCover ? "" : "Back Cover";
    } else if (page == 2 || page == 3) {
      return "Page 1";
    } else if (page == AllPages.length * 2 - 3) {
      return `Page ${page - 3}`;
    } else if (page == AllPages.length * 2 - 4) {
      return `Page ${page - 2}`;
    } else if (page % 2 === 0) {
      return `Page ${page - 2}-${page - 1}`;
    } else {
      return `Page ${page - 3} -${page - 2} `;
    }
  };

  // turning options
  const options = {
    autoCenter: true,
    elevation: 100,
    gradients: true,
    // zoom: 0.5,
    acceleration: true,
    animating: true,
    duration: 1500,
    depth: true,
    when: {
      start: function (e, page) {
        // Prevent turning to page 1 when full cover is enabled
        if (showFullCoverRef.current) {
          if (
            (page.page === 2 && page.next === 1) ||
            (page.page === (AllPages.length - 2) * 2 + 1 &&
              page.next === (AllPages.length - 2) * 2 + 2)
          ) {
            e.preventDefault();
            return;
          }
        }
      },
      turning: function (e, page) {
        const book = $(this);
        const currentPage = book.turn("page");
        const totalPages = book.turn("pages");
        let leftspace = -(bookwidth / 2 + 11);
        setCurrentActivePage(page);
        const topspace = -(bookheight / 1.9);
        // Validate page number to prevent flipping to invalid pages
        if (page < 1 || page > totalPages) {
          e.preventDefault();
          return;
        }

        // Update the page number label
        if (page === 1) {
          // Show "Cover" for full cover mode, "Front Cover" for normal mode
          if (showFullCoverRef.current) {
            $("#page-number-label").html("Cover");
          } else {
            $("#page-number-label").html("Front Cover");
            leftspace += leftspace * 0.5;
          }

          $(".flipbook-viewport .flipbook").css({
            width: bookwidth + "px",
            height: bookheight + "px",
            left: leftspace + "px",
            top: topspace + "px",
          });
        } else if (page === totalPages) {
          // Only show "Back Cover" label if the back cover is not hidden
          $("#page-number-label").html(hideLastCoverRef.current ? "" : "Back Cover");
          leftspace -= leftspace * 0.5;

          $(".flipbook-viewport .flipbook").css({
            width: bookwidth + "px",
            height: bookheight + "px",
            left: leftspace + "px",
            top: topspace + "px",
          });
        } else {
          const fbpn = page % 2 ? `${page - 1}-${page}` : `${page}-${page + 1}`;
          $("#page-number-label").html(fbpn);
          // leftspace += leftspace * 0.5;

          $(".flipbook-viewport .flipbook").css({
            width: bookwidth + "px",
            height: bookheight + "px",
            left: leftspace + "px",
            top: topspace + "px",
          });
        }

        // Prevent flipping to non-flippable pages (e.g., front and back covers directly)
        if (currentPage > 3 && currentPage < totalPages - 3) {
          if (page === 1) {
            e.preventDefault();
            book.turn("page", 2); // Force to page 2
            return;
          } else if (page === totalPages) {
            e.preventDefault();
            book.turn("page", totalPages - 1); // Force to second last page
            return;
          }
        }

        // Add or remove 'flipbook-opened' class based on the page
        if (page === 1 || page === totalPages) {
          flipbookRef.current.classList.remove("flipbook-opened");
        } else {
          flipbookRef.current.classList.add("flipbook-opened");
        }

        updateDepth(book, page);
      },

      turned: function () {
        updateDepth($(this));
      },
      end: function () {
        updateDepth($(this));
      },
    },
  };

  // handletap function for click on image in any area it turn
  const handleTap = (e) => {
    const book = $(flipbookRef.current);
    const currentPage = book.turn("page");
    const totalPages = book.turn("pages");
    const x = e.pageX - book.offset().left;

    if (x < book.width() / 2) {
      if (currentPage > 1) {
        // Prevent navigation to page 1 when full cover is enabled
        if (settings?.showFullCoverSheet) {
          if (currentPage === 2 || currentPage === 3) {
            e.preventDefault();
            return;
          }
        }
        book.turn("previous");
      }
    } else {
      if (currentPage < totalPages) {
        // Prevent navigation past the second-to-last page when full cover is enabled
        if (settings?.showFullCoverSheet) {
          if (
            currentPage === totalPages - 2 ||
            currentPage === totalPages - 1
          ) {
            e.preventDefault();
            return;
          }
        }
        book.turn("next");
      }
    }
  };

  // initialize book
  useEffect(() => {
    if (flipbookRef.current) {
      const flipbookElement = $(flipbookRef.current);

      // Recalculate dimensions based on zoom level
      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight - 200;

      // Use TRIM dimensions (canvas size minus bleed margin) for the preview
      // This shows only the visible area that will remain after printing
      const bleedMargin = canvasSize.bleedMargin || 0;
      const trimWidth = canvasSize.width - bleedMargin * 2;
      const trimHeight = canvasSize.height - bleedMargin * 2;

      const result = getResolutionScaleValueBySize(
        trimWidth,  // Use trim width instead of canvas width
        trimHeight, // Use trim height instead of canvas height
        maxWidth,
        maxHeight
      );

      if (result) {
        const { width, height } = result;

        if (width && height) {
          bookheight = height;
          bookwidth = width;
        }

        const topspace = -(bookheight / 1.9);
        let leftspace = -(bookwidth / 2 + 11);
        leftspace += leftspace * 0.5;

        // Update CSS for all elements
        $(".flipbook-viewport .flipbook").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          left: `${leftspace}px`,
          top: `${topspace}px`,
        });

        $(".flipbook-viewport .double").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
        });
        $(".flipbook-viewport .double svg").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
        });

        $(".flipbook-viewport .page").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });
        $(".flipbook-viewport .page svg").css({
          width: `${bookwidth / 2}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });

        $(".flipbook-viewport .single-page").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });
        $(".flipbook-viewport .single-page svg").css({
          width: `${bookwidth / 2}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });

        $(".flipbook .double").scissor();
        // Start at page 2 when full cover is enabled to show the cover spread
        if (settings?.showFullCoverSheet) {
          options.page = 2;
        }
        flipbookElement.turn(options);
        updateDepth(flipbookElement, settings?.showFullCoverSheet ? 2 : 1);
        adjustViewport();
      }
    }
  }, [canvasSize]);

  const handleExport = async () => {
    dispatch(setExportPageType("ALL"));
    dispatch(setExportFormat("pdf"));
    dispatch(setExportAsZip(false));

    const totalPages = AllPages.length;

    // Show progress modal during capture phase
    updateProgress({
      showProgress: true,
      progress: 10,
      currentPage: 0,
      totalPages,
      status: "Capturing pages...",
    });

    if (window.__canvasCaptureAllPages) {
      await window.__canvasCaptureAllPages(false);
    } else {
      dispatch(setSvgData({ svgContent: null, pageIndex: null }));
      dispatch(setAllPagesCaptured(false));
      dispatch(setIsCapturingPages(true));

      const waitForCapture = new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const currentSvgData = store.getState().svgData;
          if (currentSvgData.allPagesCaptured && !currentSvgData.isCapturingPages) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 120000);
      });

      await waitForCapture;
    }

    // Capture is complete, now initialize the PDF generation process
    // which will handle its own progress updates
    dispatch(setInitilized(true));
  };

  const handleDownloadClick = () => {
    dispatch(setWaterMarkData(""));
    dispatch(setWaterMarkColor("#000000FF"));
    setShowWatermarkModal(true);
  };

  const handleWatermarkSubmit = (text, color) => {
    dispatch(setWaterMarkData(text));
    dispatch(setWaterMarkColor(color));
    setShowWatermarkModal(false);
    dispatch(setIsPreviewBook(true));
    handleExport();
  };

  const handleWatermarkSkip = () => {
    dispatch(setWaterMarkData(""));
    setShowWatermarkModal(false);
    dispatch(setIsPreviewBook(true));
    handleExport();
  };

  return (
    <PhotoModalStyled
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
      fullscreen
    >
      <PreviewModalHeader closeButton={!isPreviewRoute}>
        <PreviewTitleBadge>
          <BodyText fontsize="13px" fontweight="600" textcolor="var(--primary)" style={{ margin: 0 }}>
            Preview
          </BodyText>
        </PreviewTitleBadge>
      </PreviewModalHeader>

      {activeEditorType === EDITOR_TYPES.PHOTOBOOK &&
        user?.userTypeCode === USER_TYPES.CUSTOMER &&
        configuration?.is_downloadable && (
          <>
            <PhotoModalPdfDownloadButton>
              <Button onClick={handleDownloadClick}>
                <FaDownload className="me-2" />
                Download PDF
              </Button>
            </PhotoModalPdfDownloadButton>

            <ProgressModal progress={exportProgress} />
          </>
        )}

      {/* Watermark Modal */}
      {showWatermarkModal && (
        <WatermarkModal
          show={showWatermarkModal}
          onHide={() => setShowWatermarkModal(false)}
          onSubmit={handleWatermarkSubmit}
          onSkip={handleWatermarkSkip}
          initialText={waterMarkData}
          initialColor={waterMarkColor}
        />
      )}

      <PhotoModalBody className="overflow-hidden position-relative" style={{ backgroundColor: "#8080805c" }}>
        <Box
          className=""
          style={{
            paddingTop: "0px",
            height: "80%",
          }}
          ref={wrapperRef}
        >
          <div className="flipbook-viewport">
            <div className="container">
              <div ignore="1" className="left-depth"></div>
              <div ref={flipbookRef} className="flipbook" onClick={handleTap}>
                {/* Placeholder page 1 when full cover is enabled.
                    turn.js page 1 is always a single right-side page.
                    This pushes the cover "double" to pages 2-3 so it shows as a proper spread.
                    Must be visible (not display:none) for turn.js to count it. */}
                {settings?.showFullCoverSheet && (
                  <div className="page front-cover hard" style={{ backgroundColor: "#fff" }}></div>
                )}
                {displayPages.map((activePage, index) => {
                  const isBlankCover = settings?.hideLastCover && index === AllPages.length - 1;
                  const sortedObjects = isBlankCover ? [] : getAllObjectsSortedByZIndexByPageIndex(activePage, index);
                  const safeAreaObects = isBlankCover ? [] : getAllSafeAreaObjectsSortedByZIndexByPageIndex(activePage);
                  const safeAreas = isBlankCover ? [] : getSafeAreaFromPage(activePage);
                  return (
                    <PhotoBookPreviewPages
                      key={`${activePage.id}_${index}`}
                      data={activePage.id}
                      index={index}
                      wrapperRef={wrapperRef}
                      activePage={activePage}
                      sortedObjects={sortedObjects}
                      totalPages={AllPages.length}
                      flipbookRef={flipbookRef}
                      allSafeAreaObjects={safeAreaObects}
                      safeAreas={safeAreas}
                      isPhotobookFullCover={!!settings?.showFullCoverSheet}
                    />
                  );
                })}
              </div>
              <div ignore="1" className="right-depth"></div>
            </div>
          </div>
          <div className="spread-controls position-absolute bottom-0"></div>
          <div className="flipbook-footer"></div>
        </Box>
        <div className="position-absolute  w-100 " style={{ bottom: "25px" }}>
          <p className="text-muted text-center mb-1 fw-bold">
            Tap To Flip Pages
          </p>
          <div className="d-flex gap-4 align-items-center  justify-content-center w-100">
            <Button
              className="rounded-pill px-0 py-0"
              variant="primary"
              onClick={(e) => {
                if (settings?.showFullCoverSheet) {
                  if (currentActivePage === 2 || currentActivePage === 3) {
                    e.preventDefault();
                    return;
                  }
                }
                $(flipbookRef.current).turn("previous");
              }}
            >
              <FaChevronCircleLeft size={25} />
            </Button>
            <p className="mb-0">{getPageLabel(currentActivePage)}</p>
            {/* <span className="icon-large icon-angle-right bg-dark rounded-pill" >
              <img src={nextimage} style={{ width: "25px", height: "25px" }} alt="Next" />
            </span> */}
            <Button
              className="rounded-pill px-0 py-0"
              variant="primary"
              onClick={(e) => {
                const book = $(flipbookRef.current);
                const totalPages = book.turn("pages");
                if (settings?.showFullCoverSheet) {
                  if (
                    currentActivePage === totalPages - 2 ||
                    currentActivePage === totalPages - 1
                  ) {
                    e.preventDefault();
                    return;
                  }
                }
                book.turn("next");
              }}
            >
              <FaChevronCircleRight size={25} />
            </Button>
          </div>
        </div>
      </PhotoModalBody>
    </PhotoModalStyled>
  );
};
