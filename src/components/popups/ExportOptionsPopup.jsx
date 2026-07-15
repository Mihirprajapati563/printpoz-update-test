import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Card } from "react-bootstrap";
import styled from "styled-components";
import {
  FaFileImage,
  FaFilePdf,
  FaDownload,
  FaTimes,
  FaLayerGroup,
  FaFile,
  FaCheck,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import {
  getCurrentPageIndex,
  getAllPages,
} from "../../library/utils/helpers/canvasSliceGetters";

// Styled Components
const ExportModalWrapper = styled(Modal)`
  .modal-content {
    border: none;
    border-radius: 16px;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .modal-dialog {
      margin: 1rem;
    }

    .modal-content {
      border-radius: 12px;
    }
  }
`;

const ExportHeader = styled.div`
  background: var(--primary, #4084b5);
  color: white;
  padding: 1.5rem;
  text-align: center;
  position: relative;

  h4 {
    margin: 0;
    font-weight: 600;
    font-size: 1.25rem;
  }

  p {
    margin: 0.5rem 0 0 0;
    opacity: 0.9;
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    padding: 1rem;

    h4 {
      font-size: 1.1rem;
    }

    p {
      font-size: 0.8rem;
    }
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 0.875rem;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }
`;

const ExportBody = styled.div`
  padding: 1.5rem;
  background: var(--background, #ffffff);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const SectionTitle = styled.h5`
  color: var(--text-color, #333);
  font-weight: 600;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
`;

const OptionCard = styled(Card)`
  border: 2px solid
    ${(props) =>
    props.selected
      ? "var(--primary, #4084B5)"
      : props.disabled
        ? "#d1d5db"
        : "#e2e8f0"};
  border-radius: 8px;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  transition: all 0.3s ease;
  margin-bottom: 0.75rem;
  background: ${(props) =>
    props.disabled
      ? "#f9fafb"
      : props.selected
        ? "rgba(0, 0, 0, 0.05)"
        : "white"};
  opacity: ${(props) => (props.disabled ? 0.6 : 1)};

  &:hover {
    border-color: ${(props) =>
    props.disabled ? "#d1d5db" : "var(--primary, #4084B5)"};
    transform: ${(props) => (props.disabled ? "none" : "translateY(-1px)")};
    box-shadow: ${(props) =>
    props.disabled ? "none" : "0 4px 15px rgba(0, 0, 0, 0.15)"};
  }

  .card-body {
    padding: 1rem;
    text-align: center;
  }

  @media (max-width: 768px) {
    margin-bottom: 0.5rem;

    .card-body {
      padding: 0.75rem;
    }

    &:hover {
      transform: none;
    }
  }
`;

const OptionIcon = styled.div`
  font-size: 1.5rem;
  color: ${(props) =>
    props.disabled
      ? "#9ca3af"
      : props.selected
        ? "var(--primary, #4084B5)"
        : "#64748b"};
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;

  @media (max-width: 768px) {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }
`;

const OptionTitle = styled.h6`
  color: ${(props) =>
    props.disabled
      ? "#9ca3af"
      : props.selected
        ? "var(--primary, #4084B5)"
        : "#1e293b"};
  font-weight: 600;
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
  font-size: 0.875rem;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    margin-bottom: 0.125rem;
  }
`;

const OptionDescription = styled.p`
  color: ${(props) => (props.disabled ? "#9ca3af" : "#64748b")};
  font-size: 0.75rem;
  margin: 0;
  line-height: 1.3;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const DisabledBadge = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: #111111;
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;

  @media (max-width: 768px) {
    font-size: 0.5rem;
    padding: 0.2rem 0.4rem;
  }
`;

const CheckIcon = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary, #4084b5);
  color: white;
  display: ${(props) => (props.$show ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;

  @media (max-width: 768px) {
    width: 18px;
    height: 18px;
    font-size: 0.5rem;
  }
`;

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
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
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

const CancelButton = styled(Button)`
  background: transparent;
  border: 2px solid #e2e8f0;
  color: var(--text-color, #64748b);
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  width: 100%;
  transition: all 0.3s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    padding: 0.625rem 1rem;
    font-size: 0.8rem;

    &:hover {
      transform: none;
    }
  }
`;

const InfoText = styled.div`
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 1rem;
  color: var(--text-color, #333);
  font-size: 0.8rem;
  text-align: center;
  line-height: 1.4;

  @media (max-width: 768px) {
    padding: 0.5rem;
    font-size: 0.75rem;
    margin-top: 0.75rem;
  }
`;

function ExportOptionsPopup({ show, onHide, onExport, pdfOnly = false }) {
  const [selectedFormat, setSelectedFormat] = useState(pdfOnly ? "pdf" : "jpeg");
  const [selectedPageType, setSelectedPageType] = useState("ALL");

  const currentPageIndex = useSelector(getCurrentPageIndex);
  const allPages = useSelector(getAllPages);
  const totalPages = allPages?.length || 0;

  // If pdfOnly is true, only show PDF option
  const allFormatOptions = [
    {
      value: "jpeg",
      title: "JPEG Image",
      description: "High quality image format, perfect for photos",
      icon: <FaFileImage />,
      disabled: false,
    },
    {
      value: "png",
      title: "PNG Image",
      description: "Lossless format with transparency support",
      icon: <FaFileImage />,
      disabled: false,
    },
    {
      value: "pdf",
      title: "PDF Document",
      description: "Professional document format for printing",
      icon: <FaFilePdf />,
      disabled: false,
    },
  ];

  const formatOptions = 
  // pdfOnly 
  //   ? allFormatOptions.filter(opt => opt.value === "pdf", opt.value === "jpeg", opt.value === "png")
    // : 
    allFormatOptions;

  // If pdfOnly is true, only show "All Pages" option
  const allPageOptions = [
    {
      value: "ALL",
      title: "All Pages",
      // description: `Export all ${totalPages} pages of your project`,
      icon: <FaLayerGroup />,
    },
    {
      value: "CURRENT",
      title: "Current Page Only",
      // description: `Export page ${currentPageIndex + 1} of ${totalPages}`,
      icon: <FaFile />,
    },
  ];

  const pageOptions = pdfOnly
    ? allPageOptions.filter(opt => opt.value === "ALL")
    : allPageOptions;

  async function handleExport(expotAsZip = false) {
    // Close popup first so user sees the loading state on the button
    onHide();
    
    // Small delay to ensure popup is closed and state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (onExport) {
      // Call onExport - if it's async (like handleCustomerPdfExport), it will run
      onExport({
        format: selectedFormat,
        pageType: selectedPageType,
        exportAsZip: expotAsZip,
      });
    }
  }

  return (
    <ExportModalWrapper show={show} onHide={onHide} size="lg" centered>
      <Modal.Body className="p-0">
        <ExportHeader>
          <CloseButton onClick={onHide}>
            <FaTimes />
          </CloseButton>

          <h4>{pdfOnly ? "Download as PDF" : "Export Your Design"}</h4>
          <p>{pdfOnly ? "Download your design as a PDF document" : "Choose your export format and page selection"}</p>
        </ExportHeader>

        <ExportBody>
          {/* Format Selection */}
          <SectionTitle>
            <FaDownload />
            Export Format
          </SectionTitle>

          <Row className="g-2">
            {formatOptions.map((option) => (
              <Col xs={12} sm={4} key={option.value}>
                <OptionCard
                  selected={selectedFormat === option.value}
                  disabled={option.disabled}
                  onClick={() =>
                    !option.disabled && setSelectedFormat(option.value)
                  }
                >
                  <Card.Body style={{ position: "relative" }}>
                    {option.disabled && (
                      <DisabledBadge>Coming Soon</DisabledBadge>
                    )}
                    <CheckIcon
                      $show={selectedFormat === option.value && !option.disabled}
                    >
                      <FaCheck />
                    </CheckIcon>
                    <OptionIcon
                      selected={selectedFormat === option.value}
                      disabled={option.disabled}
                    >
                      {option.icon}
                    </OptionIcon>
                    <OptionTitle
                      selected={selectedFormat === option.value}
                      disabled={option.disabled}
                    >
                      {option.title}
                    </OptionTitle>
                    <OptionDescription disabled={option.disabled}>
                      {option.description}
                    </OptionDescription>
                  </Card.Body>
                </OptionCard>
              </Col>
            ))}
          </Row>

          {/* Page Selection */}
          <SectionTitle>
            <FaLayerGroup />
            Page Selection
          </SectionTitle>

          <Row className="g-2">
            {pageOptions.map((option) => (
              <Col xs={12} sm={6} key={option.value}>
                <OptionCard
                  selected={selectedPageType === option.value}
                  onClick={() => setSelectedPageType(option.value)}
                >
                  <Card.Body style={{ position: "relative" }}>
                    <CheckIcon $show={selectedPageType === option.value}>
                      <FaCheck />
                    </CheckIcon>
                    <OptionIcon selected={selectedPageType === option.value}>
                      {option.icon}
                    </OptionIcon>
                    <OptionTitle selected={selectedPageType === option.value}>
                      {option.title}
                    </OptionTitle>
                    <OptionDescription>{option.description}</OptionDescription>
                  </Card.Body>
                </OptionCard>
              </Col>
            ))}
          </Row>

          {/* Action Buttons */}
          <Row className="mt-3 g-2">
            <Col xs={12} sm={pdfOnly ? 6 : 4}>
              <CancelButton onClick={onHide}>Cancel</CancelButton>
            </Col>
            <Col xs={12} sm={pdfOnly ? 6 : 4}>
              <ExportButton onClick={handleExport}>
                <FaDownload className="me-2" />
                Export {selectedFormat}
              </ExportButton>
            </Col>
            {!pdfOnly && (
              <Col xs={12} sm={4}>
                <ExportButton onClick={() => handleExport(true)}>
                  <FaDownload className="me-2" />
                  Export as Zip
                </ExportButton>
              </Col>
            )}
          </Row>
        </ExportBody>
      </Modal.Body>
    </ExportModalWrapper>
  );
}

export default ExportOptionsPopup;
