import { Modal, ModalBody } from "react-bootstrap";
import React from "react";

const CanvasGuideline = ({ show, onHide }) => {
  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="fade">
      {/* Gradient Header */}
      <Modal.Header closeButton className="bg-white border-0"></Modal.Header>

      <ModalBody className="p-0">
        <div className="p-3 rounded bg-white shadow">
          <h1 className="h4 text-center mb-3 text-dark">
            📌 Important Guideline for Designing Canvas Prints
          </h1>

          <p className="mb-4 text-muted">
            When designing artwork for canvas prints, it's important to include
            extra space around the edges. This ensures that the design wraps
            neatly when stretched over a wooden frame.
          </p>

          {/* Calculation Section */}
          <h5 className="fw-bold text-primary">
            📐 How to Calculate the Final Design Size?
          </h5>
          <p className="text-muted">
            Each canvas has a base size (front-facing part) and a depth
            (thickness). Since the design wraps around both sides, you must add
            twice the depth to both the width and height.
          </p>

          {/* Formula Box */}
          <div className="bg-info text-white p-3 rounded">
            <h6 className="fw-bold">📝 Formula:</h6>
            <p className="mb-1">
              <b>📏 Final Design Width = Base Width + (Depth × 2)</b>
            </p>
            <p>
              <b>📏 Final Design Height = Base Height + (Depth × 2)</b>
            </p>
          </div>

          {/* Example Section */}
          <h5 className="fw-bold mt-4 text-success">📊 Example Calculation:</h5>
          <div className="border p-3 rounded bg-white shadow-sm">
            <p className="mb-1">
              <b>🖼️ Canvas Size:</b> 8" × 8" with Depth 200
            </p>
            <p className="mb-1">
              <b>📏 Base Size:</b> 1600 × 1600
            </p>
            <p className="mb-1">
              <b>📐 Depth:</b> 200
            </p>
            <p className="mb-1">
              <b>🔄 Extra space :</b> 200(depth) × 2 = 400
            </p>
            <p className="fw-bold text-success fs-5">
              ✅ Final Design Size: 2000 × 2000
            </p>
          </div>

          {/* Why It's Important */}
          <h5 className="fw-bold mt-4 text-danger">
            ❓ Why is This Important?
          </h5>
          <p className="text-muted">
            If you don’t include extra space for the depth, parts of the design
            may get cut off or stretched when printed. Following this formula
            ensures a perfect final print.
          </p>

          {/* Footer Message */}
          <p className="text-center mt-4 text-dark fw-bold">
            Need help? Let us know! 🎨😊
          </p>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default CanvasGuideline;
