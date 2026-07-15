import React from "react";
import styled from "styled-components";
import { Modal } from "react-bootstrap";
import {
  Box,
  ButtonComponent,
  DisplayCenter,
} from "../../common-components/StyledComponents";
import { MdClose } from "react-icons/md";

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
    text-align: center;
  }
`;

const PreviewImage = styled.div`
  width: 100%;
  max-width: 300px;
  aspect-ratio: 1;
  margin: 0 auto 1.5rem;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const ActionButton = styled(ButtonComponent)`
  margin: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: ${(props) =>
    props.variant === "outline" ? "white" : "var(--primary)"};
  color: ${(props) =>
    props.variant === "outline" ? "var(--primary)" : "white"};
  border: 2px solid var(--primary);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

export const ClipArtActionModal = ({ show, clipArt, onHide, onAction }) => {
  return (
    <StyledModal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      size="sm"
    >
      <Modal.Header>
        <h5 className="modal-title">Use Clip Art</h5>
        <MdClose
          size={24}
          className="cursor-pointer"
          onClick={onHide}
          style={{ color: "#6c757d" }}
        />
      </Modal.Header>
      <Modal.Body>
        {clipArt && (
          <>
            <PreviewImage>
              <img
                src={clipArt.urls?.find((item) => item.size === "large").url}
                alt={clipArt.name || "Clip Art"}
              />
            </PreviewImage>
            <Box>
              <h6 style={{ marginBottom: "1rem" }}>
                How would you like to use this clip art?
              </h6>
              <DisplayCenter>
                <ActionButton
                  variant="outline"
                  onClick={() => onAction("background")}
                >
                  Set as Background
                </ActionButton>
                <ActionButton onClick={() => onAction("sticker")}>
                  Add as Sticker
                </ActionButton>
              </DisplayCenter>
            </Box>
          </>
        )}
      </Modal.Body>
    </StyledModal>
  );
};
