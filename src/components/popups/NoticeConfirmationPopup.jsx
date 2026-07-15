import React, { useState } from "react";
import {
  LightPrimaryButton,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  PrimaryButton,
} from "../../common-components/StyledComponents";
import { useSelector, useDispatch } from "react-redux";
import { setPageNumber, deSelectSafeArea } from "../../store/slices/canvas";
import {
  getActiveEditorType,
  getAllPages,
  getAllPagesLength,
  getAllPagesSettings,
  getSettings,
} from "../../library/utils/helpers";
import {
  getPhotoBookPagelabel,
  getPageLabelForFoldableProduct,
  getPageLabelForLayflatWithCover,
  getPageLabelForTwoSideProduct,
} from "../../library/utils/common-functions";
import { EDITOR_TYPES, EDITOR_SUB_TYPES } from "../../library/utils/constants";
import { FiAlertCircle } from "react-icons/fi";
import { MdOutlineEdit } from "react-icons/md";

function NoticeConfirmationPopup({ show, handleClose, onOrder, uneditedPages = [], isOrdering = false }) {
  const [isConfirm, setIsConfirm] = useState(false);
  const dispatch = useDispatch();

  const orderPrice = useSelector((state) => state.appSlice.orderPrice);
  const activeEditorType = useSelector(getActiveEditorType);
  const AllPages = useSelector(getAllPages);
  const settings = useSelector(getSettings);
  const allPagesSettings = useSelector(getAllPagesSettings);
  const allPagesLength = useSelector(getAllPagesLength);

  // Filter out invalid page indices
  const validUneditedPages = uneditedPages.filter((pageNum) => {
    const pageIndex = pageNum - 1;
    return pageIndex >= 0 && pageIndex < AllPages.length;
  });

  const hasUneditedPages = validUneditedPages.length > 0;

  const getPageLabel = (displayPageNum) => {
    const pageIndex = displayPageNum - 1;
    if (pageIndex < 0 || pageIndex >= AllPages.length) {
      return `Page ${displayPageNum}`;
    }

    if (activeEditorType === EDITOR_TYPES.PHOTOBOOK) {
      return getPhotoBookPagelabel(pageIndex, AllPages.length);
    } else if (settings?.isFoldable && !settings?.coverEnabled) {
      return getPageLabelForFoldableProduct(pageIndex, allPagesSettings);
    } else if (activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled === true) {
      return getPageLabelForLayflatWithCover(pageIndex, allPagesLength, settings?.showFullCoverSheet);
    } else if (
      activeEditorType === EDITOR_TYPES.VISITING_CARD ||
      (activeEditorType === EDITOR_TYPES.GREETING_CARD && settings?.subtype === EDITOR_SUB_TYPES.GREETING_CARD.DOUBLE_SIDE)
    ) {
      return getPageLabelForTwoSideProduct(pageIndex);
    }
    return `Page ${displayPageNum}`;
  };

  const handleNavigateToPage = (displayPageNum) => {
    const pageIndex = displayPageNum - 1;
    if (pageIndex < 0 || pageIndex >= AllPages.length) {
      return;
    }
    dispatch(deSelectSafeArea());
    dispatch(setPageNumber(pageIndex));
    handleClose();
  };
  return (
    <PhotoModalStyled show={show} onHide={handleClose} centered backdrop="static" keyboard={false}>
      <PhotoModalHeader closeButton className="border-0 pb-0">
        <div className="w-100 text-center">
          <span className="fw-bold fs-5">Review & Confirm</span>
        </div>
      </PhotoModalHeader>

      <PhotoModalBody className="pt-2">
        <div className="text-center px-3 px-sm-4 pb-3">
          {/* Icon & Title */}
          <div className="mb-3">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{
                width: "64px",
                height: "64px",
                background: hasUneditedPages
                  ? "linear-gradient(135deg, #f7f7f7 0%, #f2f2f2 100%)"
                  : "linear-gradient(135deg, #f2f2f2 0%, #e6e6e6 100%)",
              }}
            >
              <FiAlertCircle
                size={32}
                style={{ color: hasUneditedPages ? "#f39c12" : "#17a2b8" }}
              />
            </div>
            <h5 className="fw-bold mb-2">
              {hasUneditedPages ? "Unedited Pages Found" : "Ready to Order?"}
            </h5>
            <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: "1.5" }}>
              {hasUneditedPages
                ? `${validUneditedPages.length} page${validUneditedPages.length > 1 ? "s" : ""} in your project ${
                    validUneditedPages.length > 1 ? "haven't" : "hasn't"
                  } been customized.`
                : "Please review your project before placing your order."}
            </p>
          </div>

          {/* Pages Grid - No Scroll */}
          {hasUneditedPages && (
            <div className="mb-4">
              <div
                className="d-flex flex-wrap justify-content-center gap-2"
                style={{ maxWidth: "100%" }}
              >
                {validUneditedPages.map((displayPageNum) => (
                  <button
                    key={displayPageNum}
                    onClick={() => handleNavigateToPage(displayPageNum)}
                    className="btn btn-sm position-relative"
                    style={{
                      backgroundColor: "#fff8e6",
                      border: "1px solid #ffc107",
                      color: "#856404",
                      fontSize: "13px",
                      fontWeight: "500",
                      padding: "8px 12px",
                      borderRadius: "20px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffc107";
                      e.currentTarget.style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fff8e6";
                      e.currentTarget.style.color = "#856404";
                    }}
                  >
                    <span className="d-flex align-items-center gap-1">
                      <MdOutlineEdit size={14} />
                      {getPageLabel(displayPageNum)}
                    </span>
                  </button>
                ))}
              </div>
              <small className="text-muted d-block mt-2" style={{ fontSize: "12px" }}>
                Click any page above to edit it
              </small>
            </div>
          )}

          {/* Info Box */}
          <div
            className="rounded-3 p-3 mb-4"
            style={{
              backgroundColor: hasUneditedPages ? "#fff8e6" : "#e7f3ff",
              border: `1px solid ${hasUneditedPages ? "#ffe082" : "#b3d7ff"}`,
            }}
          >
            <p className="mb-0" style={{ fontSize: "13px", color: hasUneditedPages ? "#856404" : "#004085" }}>
              {hasUneditedPages
                ? "These pages will be included in your order with their current content. You can still edit them above before proceeding."
                : "Once you confirm, your order will be processed with the current design."}
            </p>
          </div>

          {/* Order Price */}
          {orderPrice != null && (
            <div className="mb-3 d-flex align-items-center justify-content-center gap-2">
              <span style={{ fontSize: "14px", color: "#555" }}>Order Amount:</span>
              <span
                style={{
                  padding: "4px 14px",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "var(--primary)",
                  backgroundColor: "var(--secondary)",
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                {orderPrice}
              </span>
            </div>
          )}

          {/* Checkbox */}
          <div className="mb-4">
            <label
              className="d-flex align-items-start justify-content-center gap-2 cursor-pointer"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={isConfirm}
                onChange={() => setIsConfirm((prev) => !prev)}
                className="mt-1"
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontSize: "14px", textAlign: "left" }}>
                {hasUneditedPages
                  ? "I understand and want to proceed with these pages as they are"
                  : "I confirm all details are correct and want to place my order"}
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div className="d-flex flex-column-reverse flex-sm-row gap-2 justify-content-center">
            <LightPrimaryButton
              className="px-4 py-2"
              onClick={handleClose}
              disabled={isOrdering}
              style={{ minWidth: "140px" }}
            >
              {hasUneditedPages ? "Edit Pages" : "Cancel"}
            </LightPrimaryButton>
            <PrimaryButton
              disabled={!isConfirm || isOrdering}
              className="px-4 py-2"
              onClick={(e) => {
                e.preventDefault();
                if (isConfirm && !isOrdering) {
                  onOrder(isConfirm);
                }
              }}
              style={{ minWidth: "160px" }}
            >
              {isOrdering ? "Processing..." : "Place Order"}
            </PrimaryButton>
          </div>
        </div>
      </PhotoModalBody>
    </PhotoModalStyled>
  );
}

export default NoticeConfirmationPopup;
