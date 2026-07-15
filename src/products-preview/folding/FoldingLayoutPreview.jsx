import React, { useRef, useEffect, useState } from "react";
import $ from "jquery";
import "turn.js";
import {
  Box,
  PhotoModalBody,
  PhotoModalCloseHeader,
  PhotoModalStyled,
  PhotoModalHeader,
  BodyText,
} from "../../common-components/StyledComponents.jsx";
import { FoldingLayoutPreviewPages } from "./FoldingLayoutPreivewPages.jsx";
import {
  getAllPages,
  getAllObjectsSortedByZIndexByPageIndex,
  getActiveEditorType,
  getAllSafeAreaObjectsSortedByZIndexByPageIndex,
  getSafeAreaFromPage,
  getSettings,
  getBillablePages,
} from "../../library/utils/helpers";
import { useSelector, useDispatch, useStore } from "react-redux";
import { getCanvasSize, getCanvasScale } from "../../library/utils/helpers";
import { getEditorConfiguration } from "../../store/slices/editorConfigurations";
import {
  getResolutionScaleValueBySize,
  getPageLabelForFoldableProduct,
} from "../../library/utils/common-functions";
import {
  EDITOR_TYPES,
  USER_TYPES,
} from "../../library/utils/constants/index.js";
import { First } from "react-bootstrap/esm/PageItem.js";
import { Button } from "react-bootstrap";
import { FaChevronCircleLeft, FaChevronCircleRight } from "react-icons/fa";
import { WatermarkModal } from "../../common-components/WatermarkModal.jsx";
import { ProgressModal } from "../../common-components/ProgressModal.jsx";
import {
  setExportPageType,
  setExportFormat,
  setExportAsZip,
  setInitilized,
  setWaterMarkData,
  setWaterMarkColor,
  setIsPreviewBook,
  setSvgData,
  setAllPagesCaptured,
  setIsCapturingPages,
} from "../../store/slices/svgData";
import { usePdfExport } from "../../contexts/PdfExportContext";
import styled from "styled-components";
import { FaDownload } from "react-icons/fa6";
import useExportPages from "../../library/utils/custom-hooks/useExportPages.js";
import "./FoldingLayoutPreview.css";
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

export const FoldingLayoutPreview = ({ show, handleClose }) => {
  const dispatch = useDispatch();
  const store = useStore();
  const flipbookRef = useRef(null);
  const editorType = useSelector(getActiveEditorType);
  const AllPages = useSelector((state) =>
    getAllPages(state, editorType === EDITOR_TYPES.LAYFLATALBUM)
  );
  const [pages, setPages] = useState(AllPages);

  useEffect(() => {
    setPages(AllPages);
  }, [AllPages]);
  const { waterMarkData, waterMarkColor, isPreviewBook } = useSelector(
    (state) => state.svgData
  );
  const canvasSize = useSelector(getCanvasSize);
  const settings = useSelector(getSettings);
  const billablePages = useSelector(getBillablePages);
  const configuration = useSelector(getEditorConfiguration);
  const [currentActivePage, setCurrentActivePage] = useState(1);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const wrapperRef = useRef(null);

  const userDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetails);
  const isPreviewRoute =
    typeof window !== "undefined" && window.location.pathname.includes("/preview");

  const { exportProgress, updateProgress } = usePdfExport();
  const { exportPageSVG, uploading } = useExportPages({ runForPreview: true });

  let bookheight = 0;
  let bookwidth = 0;

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

  // get page lable
  const getPageLabel = (page) => {
    if (!editorType === EDITOR_TYPES.LAYFLATALBUM) {
      if (page === 1) {
        // Front page
        return "Page 1";
      } else if (page + 1 === AllPages.length * 2 - 1) {
        // Back page
        return `Page ${AllPages.length * 2 - 2}`;
      } else if (page % 2 === 0) {
        // Left and right pages (e.g., 2-3, 4-5)
        return `Page ${page}-${page + 1}`;
      } else {
        // Handle when moving backward (e.g., 7-6)
        return `Page ${page - 1} -${page} `;
      }
    } else {
      if (!settings?.showFullCoverSheet) {
        if (page === 1) {
          // Front page
          return "Front Cover";
        } else if (page + 1 === AllPages.length * 2 - 1) {
          // Back page
          return "Back Cover";
        } else if (page % 2 === 0) {
          // Left and right pages (e.g., 2-3, 4-5)
          return `Page ${page - 1}-${page}`;
        } else {
          // Handle when moving backward (e.g., 7-6)
          return `Page ${page - 2} -${page - 1} `;
        }
      } else {
        if (page === 2 || page === 3) {
          return "Cover";
        } else if (page % 2 === 0) {
          return `Page ${page - 3}-${page - 2}`;
        } else {
          return `Page ${page - 4}-${page - 3}`;
        }
      }
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
    // display: "double",
    when: {
      start: function (e, page) {
        if (
          editorType === EDITOR_TYPES.LAYFLATALBUM &&
          (settings?.showFullCoverSheet || !settings?.coverEnabled)
        ) {
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
          $("#page-number-label").html("Front Cover");
          leftspace += leftspace * 0.5;

          $(".flipbook-viewport .flipbook").css({
            width: bookwidth + "px",
            height: bookheight + "px",
            left: leftspace + "px",
            top: topspace + "px",
          });
        } else if (page === totalPages) {
          $("#page-number-label").html("Back Cover");
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
        if (
          editorType === EDITOR_TYPES.LAYFLATALBUM &&
          (!settings?.coverEnabled ||
            (settings?.coverEnabled && settings?.showFullCoverSheet))
        ) {
          if (currentPage === 2 || currentPage === 3) {
            e.preventDefault();
            return;
          }
        }
        book.turn("previous");
      }
    } else {
      if (currentPage < totalPages) {
        if (
          editorType === EDITOR_TYPES.LAYFLATALBUM &&
          (!settings?.coverEnabled ||
            (settings?.coverEnabled && settings?.showFullCoverSheet))
        ) {
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
      const trimW = canvasSize.width - bleedMargin * 2;
      const trimH = canvasSize.height - bleedMargin * 2;

      const result = getResolutionScaleValueBySize(
        trimW,
        trimH,
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

        // Override front-cover page + SVG dimensions to include spine when layflat full cover + spine is active
        if (
          editorType === EDITOR_TYPES.LAYFLATALBUM &&
          settings?.coverEnabled &&
          settings?.showFullCoverSheet
        ) {
          const liveSpineWidth = Math.round(Math.ceil((billablePages || 0) / 2) * Number(settings?.paperThickness || 0));
          if (liveSpineWidth > 0) {
            const trimW = canvasSize.width - (canvasSize.bleedMargin || 0) * 2;
            const spineRatio = liveSpineWidth / trimW;
            const coverSvgWidth = bookwidth / 2 * (1 + spineRatio);
            // Expand the front-cover page div as well so the SVG is not clipped
            $(".flipbook-viewport .front-cover").css({ width: `${coverSvgWidth}px`, overflow: "visible" });
            $(".flipbook-viewport .front-cover svg").css({ width: `${coverSvgWidth}px`, height: `${bookheight}px` });
          }
        }

        $(".flipbook-viewport .single-page").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });
        $(".flipbook-viewport .single-page svg").css({
          width: `${bookwidth}px`,
          height: `${bookheight}px`,
          "background-size": "100% 100%",
          "background-color": "#fff",
          "background-repeat": "no-repeat",
        });

        $(".flipbook .double").scissor();
        if (
          editorType === EDITOR_TYPES.LAYFLATALBUM &&
          (!settings?.coverEnabled ||
            (settings?.coverEnabled && settings?.showFullCoverSheet))
        ) {
          options.page = 2;
        }
        flipbookElement.turn(options);
        updateDepth(flipbookElement, 1);
        adjustViewport();
      }
    }
  }, [canvasSize]);

  const handleExport = async () => {
    dispatch(setExportPageType("ALL"));
    dispatch(setExportFormat("pdf"));
    dispatch(setExportAsZip(false));

    const totalPages = AllPages.length;

    // Show a single progress modal during entire export process
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

      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const currentSvgData = store.getState().svgData;
          if (currentSvgData.allPagesCaptured && !currentSvgData.isCapturingPages) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
        setTimeout(() => { clearInterval(checkInterval); resolve(); }, 120000);
      });
    }

    // Capture complete — useExportPages will take over the ProgressModal
    // with its own "Processing pages..." updates
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

      {editorType === EDITOR_TYPES.LAYFLATALBUM &&
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

      <PhotoModalBody
        className="overflow-hidden position-relative"
        style={{ backgroundColor: "#8080805c" }}
      >
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
              {/* <div ignore="1" className="left-depth"></div> */}
              <div ref={flipbookRef} className="flipbook" onClick={handleTap}>
                {pages.map((activePage, index) => {
                  const sortedObjects = getAllObjectsSortedByZIndexByPageIndex(
                    activePage,
                    index
                  );
                  const safeAreaObects =
                    getAllSafeAreaObjectsSortedByZIndexByPageIndex(activePage);
                  const safeAreas = getSafeAreaFromPage(activePage);
                  return (
                    <FoldingLayoutPreviewPages
                      key={`${activePage.id}_${index}`}
                      data={activePage.id}
                      index={index}
                      wrapperRef={wrapperRef}
                      activePage={activePage}
                      sortedObjects={sortedObjects}
                      totalPages={pages.length}
                      flipbookRef={flipbookRef}
                      allSafeAreaObjects={safeAreaObects}
                      safeAreas={safeAreas}
                    />
                  );
                })}
              </div>
              {/* <div ignore="1" className="right-depth"></div> */}
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
                if (
                  editorType === EDITOR_TYPES.LAYFLATALBUM &&
                  (!settings?.coverEnabled ||
                    (settings?.coverEnabled && settings?.showFullCoverSheet))
                ) {
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
                if (
                  editorType === EDITOR_TYPES.LAYFLATALBUM &&
                  (!settings?.coverEnabled ||
                    (settings?.coverEnabled && settings?.showFullCoverSheet))
                ) {
                  if (
                    currentActivePage === AllPages.length * 2 - 4 ||
                    currentActivePage === AllPages.length * 2 - 3
                  ) {
                    e.preventDefault();
                    return;
                  }
                }
                $(flipbookRef.current).turn("next");
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
