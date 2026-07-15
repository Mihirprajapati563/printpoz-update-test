/**
 * ConfirmationDialog Component
 * 
 * A reusable confirmation dialog with dynamic text content and optional input field.
 * 
 * Props:
 * - show: boolean - Controls visibility of the dialog
 * - onClose: function - Called when dialog is closed/cancelled
 * - onConfirm: function - Called when user confirms (receives inputValue if showInput is true)
 * - title: string - Dialog title (default: "Confirm Action")
 * - message: string - Main message/question to display
 * - confirmText: string - Text for confirm button (default: "Yes")
 * - cancelText: string - Text for cancel button (default: "No")
 * - confirmVariant: string - Bootstrap variant for confirm button (default: "primary")
 * - cancelVariant: string - Bootstrap variant for cancel button (default: "secondary")
 * - loading: boolean - Shows loading spinner on confirm button if true
 * - showInput: boolean - Shows an input field if true
 * - inputLabel: string - Label for the input field
 * - inputPlaceholder: string - Placeholder for the input field
 * - inputValue: string - Initial value for the input field
 * - inputRequired: boolean - Whether the input is required
 * - inputs: array - Array of input objects: [{ name, label, type, placeholder, defaultValue, required, min, max, step }] for multiple inputs support
 */

import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Spinner, Form } from "react-bootstrap";
import styled from "styled-components";

// Stable default so this array reference never changes between renders.
// Using `inputs = []` inside the prop list would create a new array every render,
// which would trigger the reset useEffect on every keystroke.
const DEFAULT_INPUTS = [];

const StyledModal = styled(Modal)`
  z-index: 99999 !important;
  
  .modal-content {
    border-radius: 12px;
    border: none;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    border-bottom: 1px solid #eee;
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, #000) 100%);
    border-radius: 12px 12px 0 0;
  }

  .modal-title {
    font-weight: 600;
    color: white;
    font-size: 18px;
  }

  .modal-body {
    padding: 24px 20px;
    font-size: 15px;
    color: #333;
    line-height: 1.6;
  }

  .modal-footer {
    border-top: 1px solid #eee;
    padding: 12px 20px;
    gap: 10px;
  }

  .btn-close {
    filter: brightness(0) invert(1);
  }
`;

const ConfirmButton = styled(Button)`
  min-width: 80px;
  font-weight: 500;
  border-radius: 6px;
  padding: 8px 20px;
`;

const CancelButton = styled(Button)`
  min-width: 80px;
  font-weight: 500;
  border-radius: 6px;
  padding: 8px 20px;
`;

const StyledFormGroup = styled(Form.Group)`
  margin-top: 16px;

  .form-label {
    font-weight: 500;
    color: #495057;
    margin-bottom: 6px;
  }

  .form-control {
    border-radius: 8px;
    padding: 10px 14px;
    border: 1px solid #dee2e6;
    transition: all 0.2s;

    &:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 0.2rem rgba(0, 0, 0, 0.25);
    }
  }
`;

const ConfirmationDialog = ({
    show = false,
    onClose = () => { },
    onConfirm = () => { },
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Yes",
    cancelText = "No",
    confirmVariant = "primary",
    cancelVariant = "outline-secondary",
    loading = false,
    showInput = false,
    inputLabel = "Name",
    inputPlaceholder = "Enter name...",
    inputValue = "",
    inputRequired = false,
    inputs = DEFAULT_INPUTS, // [{ name, label, type, placeholder, defaultValue, required, min, max, step }]
    showCancelButton = true,
    showConfirmButton = true,
}) => {
    const [localInputValue, setLocalInputValue] = useState(inputValue);
    const [inputError, setInputError] = useState("");

    // State for multiple inputs
    const [multiInputValues, setMultiInputValues] = useState({});
    const [multiInputErrors, setMultiInputErrors] = useState({});

    // Track the previous `show` value so we only reset state when the dialog
    // *opens* (false → true transition), not on every re-render.
    const prevShowRef = useRef(false);

    useEffect(() => {
        const justOpened = show && !prevShowRef.current;
        prevShowRef.current = show;

        if (justOpened) {
            if (inputs && inputs.length > 0) {
                const initialVals = {};
                inputs.forEach(inp => {
                    initialVals[inp.name] = inp.defaultValue !== undefined ? inp.defaultValue : "";
                });
                setMultiInputValues(initialVals);
                setMultiInputErrors({});
            } else {
                setLocalInputValue(inputValue);
                setInputError("");
            }
        }
    }, [show, inputValue, inputs]);

    const handleConfirm = () => {
        if (inputs && inputs.length > 0) {
            // Validation for multiple inputs
            let hasError = false;
            const newErrors = {};
            inputs.forEach(inp => {
                if (inp.required && (!multiInputValues[inp.name] || String(multiInputValues[inp.name]).trim() === "")) {
                    newErrors[inp.name] = `${inp.label || inp.name} is required`;
                    hasError = true;
                }
            });
            
            if (hasError) {
                setMultiInputErrors(newErrors);
                return;
            }
            onConfirm(multiInputValues);
        } else {
            // Backwards compatibility for single input
            if (showInput && inputRequired && !localInputValue.trim()) {
                setInputError(`${inputLabel} is required`);
                return;
            }
            onConfirm(showInput ? localInputValue : undefined);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setInputError("");
            setMultiInputErrors({});
            onClose();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !loading) {
            handleConfirm();
        }
    };

    return (
        <>
            <style>
                {`
                    .confirmation-dialog-backdrop {
                        z-index: 11105 !important;
                    }
                    .confirmation-dialog-modal {
                        z-index: 11110 !important;
                    }
                `}
            </style>
            <StyledModal
                show={show}
                onHide={handleClose}
                centered
                backdrop={loading ? "static" : true}
                keyboard={!loading}
                backdropClassName="confirmation-dialog-backdrop"
                className="confirmation-dialog-modal"
            >
                <Modal.Header closeButton={!loading}>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {message}
                    
                    {/* Multiple Inputs Support */}
                    {inputs && inputs.length > 0 && inputs.map((inp, idx) => (
                        <StyledFormGroup key={inp.name || idx}>
                            <Form.Label>{inp.label}</Form.Label>
                            {inp.type === "select" ? (
                                <Form.Select
                                    value={multiInputValues[inp.name] || ""}
                                    onChange={(e) => {
                                        setMultiInputValues(prev => ({ ...prev, [inp.name]: e.target.value }));
                                        if (multiInputErrors[inp.name]) {
                                            setMultiInputErrors(prev => ({ ...prev, [inp.name]: "" }));
                                        }
                                    }}
                                    disabled={loading}
                                >
                                    {inp.options?.map((opt, optIdx) => (
                                        <option key={opt.value || optIdx} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            ) : (
                                <Form.Control
                                    type={inp.type || "text"}
                                    placeholder={inp.placeholder}
                                    value={multiInputValues[inp.name] || ""}
                                    min={inp.min}
                                    max={inp.max}
                                    step={inp.step}
                                    onChange={(e) => {
                                        setMultiInputValues(prev => ({ ...prev, [inp.name]: e.target.value }));
                                        if (multiInputErrors[inp.name]) {
                                            setMultiInputErrors(prev => ({ ...prev, [inp.name]: "" }));
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    isInvalid={!!multiInputErrors[inp.name]}
                                    disabled={loading}
                                    autoFocus={idx === 0}
                                />
                            )}
                            {multiInputErrors[inp.name] && (
                                <Form.Control.Feedback type="invalid">
                                    {multiInputErrors[inp.name]}
                                </Form.Control.Feedback>
                            )}
                        </StyledFormGroup>
                    ))}

                    {/* Fallback Single Input */}
                    {showInput && (!inputs || inputs.length === 0) && (
                        <StyledFormGroup>
                            <Form.Label>{inputLabel}</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={inputPlaceholder}
                                value={localInputValue}
                                onChange={(e) => {
                                    setLocalInputValue(e.target.value);
                                    if (inputError) setInputError("");
                                }}
                                onKeyDown={handleKeyDown}
                                isInvalid={!!inputError}
                                disabled={loading}
                                autoFocus
                            />
                            {inputError && (
                                <Form.Control.Feedback type="invalid">
                                    {inputError}
                                </Form.Control.Feedback>
                            )}
                        </StyledFormGroup>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {showCancelButton && (
                        <CancelButton
                            variant={cancelVariant}
                            onClick={handleClose}
                            disabled={loading}
                        >
                            {cancelText}
                        </CancelButton>
                    )}
                    {showConfirmButton && (
                        <ConfirmButton
                            variant={confirmVariant}
                            onClick={handleConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Spinner
                                        as="span"
                                        animation="border"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                        className="me-2"
                                    />
                                    Processing...
                                </>
                            ) : (
                                confirmText
                            )}
                        </ConfirmButton>
                    )}
                </Modal.Footer>
            </StyledModal>
        </>
    );
};

export default ConfirmationDialog;
