import React, { useState, useRef } from "react";
import styled from "styled-components";
import { Modal } from "react-bootstrap";
import {
  ButtonComponent,
  Box,
  DisplayCenter,
} from "../../common-components/StyledComponents";
import { MdClose, MdCloudUpload } from "react-icons/md";
import { FaTrash } from "react-icons/fa";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { EDITOR_ASSETS } from "../../library/utils/constants/index";

const StyledModal = styled(Modal)`
  .modal-content {
    border-radius: 12px;
    border: none;
  }

  .modal-header {
    border-bottom: none;
    padding: 1.5rem 1.5rem 0.5rem;
  }

  .modal-body {
    padding: 1rem 1.5rem 1.5rem;
  }
`;

const DropZone = styled.div`
  border: 2px dashed #dee2e6;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  background: ${(props) => (props.isDragActive ? "#f8f9fa" : "white")};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--primary);
    background: #f8f9fa;
  }
`;

const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
`;

const PreviewItem = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .delete {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: white;
      transform: scale(1.1);
    }
  }
`;

const UploadButton = styled(ButtonComponent)`
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  transition: all 0.2s ease;
  opacity: ${(props) => (props.disabled ? 0.7 : 1)};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};

  &:hover {
    transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
    box-shadow: ${(props) =>
      props.disabled ? "none" : "0 4px 12px rgba(0, 0, 0, 0.1)"};
  }
`;

export const UploadClipArtModal = ({ show, onHide, onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef();

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.match(/^image\/(png|jpeg|jpg|svg\+xml)$/i)
    );

    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter((file) =>
      file.type.match(/^image\/(png|jpeg|jpg|svg\+xml)$/i)
    );
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    const formData = new FormData();

    files.forEach((file, index) => {
      formData.append(`file${index}`, file);
    });

    formData.append("type", EDITOR_ASSETS.CLIPART);
    formData.append("status", 1);
    formData.append("display_in_web", true);

    try {
      await apiPost(ENDPOINTS.uploadClipArts, formData);
      onSuccess();
      setFiles([]);
    } catch (error) {
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <StyledModal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header className="justify-content-between">
        <h5 className="modal-title">Upload Clip Art</h5>
        <MdClose
          size={24}
          className="cursor-pointer"
          onClick={onHide}
          style={{ color: "#6c757d" }}
        />
      </Modal.Header>
      <Modal.Body>
        <DropZone
          onDragEnter={handleDragEnter}
          onDragOver={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          isDragActive={isDragActive}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            accept=".png,.jpg,.jpeg,.svg"
            onChange={handleFileSelect}
          />
          <MdCloudUpload size={48} color="var(--primary)" />
          <Box mt="1rem">
            <h6>Drag and drop your clip art here</h6>
            <p className="text-muted">or click to browse (PNG, JPG, SVG)</p>
          </Box>
        </DropZone>

        {files.length > 0 && (
          <PreviewGrid>
            {files.map((file, index) => (
              <PreviewItem key={index}>
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                />
                <div className="delete" onClick={() => removeFile(index)}>
                  <FaTrash size={12} color="var(--primary)" />
                </div>
              </PreviewItem>
            ))}
          </PreviewGrid>
        )}

        <UploadButton
          disabled={files.length === 0 || isUploading}
          onClick={handleUpload}
        >
          <DisplayCenter>
            {isUploading ? (
              "Uploading..."
            ) : (
              <>
                <MdCloudUpload size={20} />
                <Box ml="0.5rem">Upload {files.length} files</Box>
              </>
            )}
          </DisplayCenter>
        </UploadButton>
      </Modal.Body>
    </StyledModal>
  );
};
