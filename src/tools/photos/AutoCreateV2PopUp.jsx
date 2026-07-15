import React from "react";
import Modal from "react-bootstrap/Modal";
import "./popup.css";

import { useState } from "react";
import { FaTimes } from "react-icons/fa";

function AutoCreateV2PopUp(props) {
  // Pull our custom props OUT so they are not spread onto <Modal> (which forwards
  // unknown props to its root DOM node → "React does not recognize the X prop"
  // warnings). Only `modalProps` (real react-bootstrap Modal props like show/onHide)
  // gets spread below.
  const {
    handleClick,
    onUpload,
    // eslint-disable-next-line no-unused-vars
    selectedPhotosCount,
    // eslint-disable-next-line no-unused-vars
    totalFillableBoxesCount,
    emptyBoxesCount: emptyBoxesCountProp,
    availableImagesCount: availableImagesCountProp,
    unusedImagesCount: unusedImagesCountProp,
    ...modalProps
  } = props;

  const [selectedOption, setSelectedOption] = useState("option1");

  const handleApplyClick = () => {
    handleClick(selectedOption);
    modalProps.onHide();
  };

  const emptyBoxesCount = emptyBoxesCountProp ?? 0;
  const availableImagesCount = availableImagesCountProp ?? 0;
  const unusedImagesCount = unusedImagesCountProp ?? availableImagesCount;
  // Option 1 fills empty slots with unused photos only; option 2 wipes and re-fills
  // from the entire library, so "available" means different things per option.
  const displayedAvailableCount =
    selectedOption === "option1" ? unusedImagesCount : availableImagesCount;
  const showImageWarning =
    selectedOption === "option1" &&
    emptyBoxesCount > 0 &&
    unusedImagesCount < emptyBoxesCount;

  return (
    <div>
      <Modal
        {...modalProps}
        size="xl"
        aria-labelledby="contained-modal-title-vcenter"
        centered
        className="auto-create-modal"
      >
        <Modal.Header className="popup-header border-0 pt-2 pe-2 bg-transparent text-white d-flex justify-content-between gap-2 align-items-start">
          {/* Close Button */}
          <button
            className="order-2 p-0 bg-transparent text-white border border-0 flex-shrink-0"
            onClick={modalProps.onHide}
            aria-label="Close"
          >
            <FaTimes size={18} />
          </button>

          {/* Title */}
          <div className="flex-grow-1 text-center mt-1">
            <p className="mb-0 fw-bold lh-sm" style={{ fontSize: "clamp(18px, 2.5vw, 26px)" }}>
              Choose Your Auto-Design Method
            </p>
            <p className="mb-0 mt-1" style={{ fontSize: "clamp(11px, 2.5vw, 13px)", opacity: 0.85, fontWeight: 400 }}>
              {displayedAvailableCount} {selectedOption === "option1" ? "unused " : ""}photo{displayedAvailableCount !== 1 ? "s" : ""} available
              {emptyBoxesCount > 0 && (
                <> &nbsp;·&nbsp; {emptyBoxesCount} empty frame{emptyBoxesCount !== 1 ? "s" : ""}</>
              )}
            </p>
          </div>
        </Modal.Header>

        <Modal.Body className="modal-body px-3 pt-2 pb-2 border-0">
          <div className="row g-3 mx-0">
            {/* Option 1 — Automated addition */}
            <div
              className="col-12 col-sm-6"
              onClick={() => setSelectedOption("option1")}
              style={{ cursor: "pointer" }}
            >
              <div
                className="photo-selection-option h-100 bg-white d-flex flex-column"
                style={{
                  border: selectedOption === "option1" ? "2px solid var(--primary)" : "2px solid #e9ecef",
                  borderRadius: "10px",
                  transition: "border-color 0.2s ease",
                  padding: "clamp(12px, 3vw, 28px)",
                }}
              >
                {/* Radio + Title */}
                <div className="d-flex align-items-center gap-2 mb-2">
                  <input
                    type="radio"
                    id="option1"
                    name="photoOption"
                    onChange={() => setSelectedOption("option1")}
                    checked={selectedOption === "option1"}
                    style={{ accentColor: "var(--primary)", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <label
                    htmlFor="option1"
                    className="photo-selection-label mb-0 fw-bold"
                    style={{ cursor: "pointer", fontSize: "clamp(14px, 1.8vw, 17px)" }}
                  >
                    Automated addition
                  </label>
                </div>

                {/* Image */}
                <div className="text-center mb-2">
                  <img
                    src="images/photos/auto-create-fill.png"
                    alt="Automated addition"
                    style={{ width: "100%", maxWidth: 340, height: "auto", borderRadius: 6 }}
                  />
                </div>

                {/* Description */}
                <p className="mb-0 text-center" style={{ fontSize: "clamp(12px, 1.8vw, 15px)", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Automatically add photos into any empty spots left in your project.
                </p>
              </div>
            </div>

            {/* Option 2 — Re-create with all photos */}
            <div
              className="col-12 col-sm-6"
              onClick={() => setSelectedOption("option2")}
              style={{ cursor: "pointer" }}
            >
              <div
                className="photo-selection-option h-100 bg-white d-flex flex-column"
                style={{
                  border: selectedOption === "option2" ? "2px solid var(--primary)" : "2px solid #e9ecef",
                  borderRadius: "10px",
                  transition: "border-color 0.2s ease",
                  padding: "clamp(12px, 3vw, 28px)",
                }}
              >
                {/* Radio + Title */}
                <div className="d-flex align-items-center gap-2 mb-2">
                  <input
                    type="radio"
                    id="option2"
                    name="photoOption"
                    onChange={() => setSelectedOption("option2")}
                    checked={selectedOption === "option2"}
                    style={{ accentColor: "var(--primary)", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <label
                    htmlFor="option2"
                    className="photo-selection-label mb-0 fw-bold"
                    style={{ cursor: "pointer", fontSize: "clamp(14px, 1.8vw, 17px)" }}
                  >
                    Re-create with all photos
                  </label>
                </div>

                {/* Image */}
                <div className="text-center mb-2">
                  <img
                    src="images/photos/auto-create-refresh.png"
                    alt="Re-create with all photos"
                    style={{ width: "100%", maxWidth: 340, height: "auto", borderRadius: 6 }}
                  />
                </div>

                {/* Description */}
                <p className="mb-0 text-center" style={{ fontSize: "clamp(12px, 1.8vw, 15px)", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Automatically replace all your photos with new photos from your project.
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="border-0 d-flex flex-column align-items-stretch pt-1 pb-3 px-3 gap-2">
          {showImageWarning && (
            <div className="w-100">
              <p className="mb-2 text-danger fw-semibold text-center" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                You need <strong>{emptyBoxesCount - unusedImagesCount}</strong> more unused photo{emptyBoxesCount - unusedImagesCount !== 1 ? "s" : ""} to fill all frames. Upload more or continue with what you have.
              </p>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button
                  onClick={onUpload}
                  className="footer-button border border-0 py-2 text-white fw-bold rounded flex-fill"
                  style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}
                >
                  Upload More Photos
                </button>
                <button
                  onClick={handleApplyClick}
                  className="footer-button-outline border py-2 fw-bold rounded bg-transparent flex-fill"
                  style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}
          {!showImageWarning && (
            <button
              onClick={handleApplyClick}
              className="footer-button border border-0 py-2 text-white fw-bold rounded w-100"
              style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}
            >
              {selectedOption === "option1" ? "Automated addition" : "Re-create with all photos"}
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default AutoCreateV2PopUp;
