import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { dispatchUploadsWithConcurrency } from "../../store/background-services/imageUploadThunks";
import { filterOversizedImages, buildOversizedAlert } from "../../library/utils/common-functions";
import { ToastContainer, toast } from "react-toastify";
// This route renders standalone (outside the editor layout that normally
// provides the ToastContainer + CSS), so import them here too.
import "react-toastify/dist/ReactToastify.css";
import { UploadQueue } from "../../tools/photos/UploadedQueue";

export const MobileUpload = () => {
  const dispatch = useDispatch();
  // lets get project id from url
  const { projectId } = useParams();

  const handleUpload = async (event) => {
    // Get the list of files from the event
    const files = event.target.files;
    // Check if files are selected
    if (!files.length) {
      alert("There is no file to upload");
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

    const uploadItems = [];
    for (const file of sizedFiles) {
      // Create a new FormData object to hold the file and additional data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cart_order_id", projectId);
      formData.append("device", "mobile");
      formData.append("userTypeCode", 6);

      uploadItems.push({ file, formData });
    }

    // Dispatch with bounded concurrency to prevent signed URL expiry
    if (uploadItems.length > 0) {
      dispatchUploadsWithConcurrency(dispatch, uploadItems);
    }

    // from here lets close the modal
    //
  };

  // return if project id is not available

  if (!projectId) {
    //let return simple message with link to open home page of website
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card p-4">
              <div className="text-center">
                <a href="/" className="btn btn-primary">
                  Go to Home
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card p-4">
            <h3 className="card-title text-center">Upload Images</h3>
            <form>
              <div className="form-group">
                <label htmlFor="fileInput">Choose Photo</label>

                <input
                  className="form-control"
                  type="file"
                  onChange={handleUpload}
                  multiple
                  accept="image/*"
                />
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="row mt-3 justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <UploadQueue device={"mobile"} />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};
