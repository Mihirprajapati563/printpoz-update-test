import React, { useState, useEffect } from "react";
import { Modal, Form, Spinner } from "react-bootstrap";
import styled from "styled-components";
import { apiPost, apiPatch } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { getUserDetails } from "../../library/utils/services/theme";

// ─── Styled Components ──────────────────────────────────────────────────────

const StyledModal = styled(Modal)`
  z-index: 11200;
  .modal-content {
    border-radius: 12px;
    border: none;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  }
  .modal-header {
    border-bottom: 1px solid #f3f4f6;
    padding: 20px 24px;
    h5 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }
    .btn-close {
      &:focus { box-shadow: none; }
    }
  }
  .modal-body {
    padding: 24px;
  }
  .modal-footer {
    border-top: 1px solid #f3f4f6;
    padding: 16px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
`;

const FormGroup = styled(Form.Group)`
  margin-bottom: 20px;
  label {
    font-size: 0.88rem;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 8px;
  }
  input, select {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.9rem;
    transition: all 0.2s;
    &:focus {
      border-color: var(--primary, #4084B5);
      box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1);
    }
  }
`;

const MultiSelectWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: #4b5563;
  cursor: pointer;
  margin: 0 !important;
  font-weight: 500 !important;
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--primary, #4084B5);
  }
`;

const ActionBtn = styled.button`
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;

  &.btn-cancel {
    background: #fff;
    border: 1px solid #d1d5db;
    color: #4b5563;
    &:hover { background: #f9fafb; border-color: #9ca3af; }
  }

  &.btn-save {
    background: var(--primary, #4084B5);
    border: none;
    color: #fff;
    &:hover:not(:disabled) {
      background: var(--primary-dark, #000000);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(64, 132, 181, 0.3);
    }
    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
`;

const TYPE_OPTIONS = [
    { value: "background", label: "Background" },
    { value: "clipart", label: "Clipart" },
    { value: "mask", label: "Mask" },
    { value: "theme", label: "Theme" },
];

export default function TagFormDialog({ isOpen, onClose, tagData, onSuccess }) {
    const isEditing = !!tagData;
    const user = getUserDetails();

    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        type: [], // array of strings
        status: 1, // 1 for active, 0 for inactive
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (tagData) {
            setFormData({
                name: tagData.name || "",
                slug: tagData.slug || "",
                type: tagData.type || [],
                status: tagData.status !== undefined ? tagData.status : 1,
            });
        } else {
            setFormData({
                name: "",
                slug: "",
                type: [],
                status: 1,
            });
        }
        setError("");
    }, [tagData, isOpen]);

    const generateSlug = (name) => {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    const handleNameChange = (e) => {
        const val = e.target.value;
        setFormData((prev) => ({
            ...prev,
            name: val,
            slug: !isEditing ? generateSlug(val) : prev.slug,
        }));
    };

    const handleTypeChange = (e) => {
        const { value, checked } = e.target;
        setFormData((prev) => {
            let newType = [...prev.type];
            if (checked && !newType.includes(value)) {
                newType.push(value);
            } else if (!checked && newType.includes(value)) {
                newType = newType.filter((t) => t !== value);
            }
            return { ...prev, type: newType };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!formData.name.trim()) {
            setError("Name is required.");
            return;
        }
        if (!formData.slug.trim()) {
            setError("Slug is required.");
            return;
        }
        if (formData.type.length === 0) {
            setError("At least one type must be selected.");
            return;
        }

        setLoading(true);

        const payload = {
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            type: formData.type,
            status: Number(formData.status),
            ...(user?.brand_id && { brand_id: user.brand_id }),
        };

        if (isEditing) {
            payload._id = tagData._id; // Required by your update API format based on history logs
        }

        const endpoint = isEditing
            ? ENDPOINTS.updateTag + tagData._id
            : ENDPOINTS.createTag;

        try {
            // The update payload in the instructions was for a PATCH/PUT, but your backend might be POST for everything, we use apiPost or apiPatch
            // Assuming apiPost handles everything if not specified otherwise, or use axios but apiPost is safer for headers

            const response = isEditing
                ? await apiPatch(endpoint, payload)
                : await apiPost(endpoint, payload);

            // Some endpoints return standard success structure
            if (response && (response.status === 1 || response.status === true || response.success)) {
                onSuccess();
            } else if (response && response.error) {
                setError(typeof response.error === "string" ? response.error : response.message || "Failed to save tag.");
            } else if (response && response._id) {
                // Some "create" endpoints just return the object
                onSuccess();
            } else {
                setError(response?.message || "Failed to save tag.");
            }
        } catch (err) {
            setError("An error occurred while saving.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <StyledModal show={isOpen} onHide={onClose} centered backdrop="static">
            <StyledModal.Header closeButton>
                <StyledModal.Title>{isEditing ? "Edit Tag" : "Create New Tag"}</StyledModal.Title>
            </StyledModal.Header>

            <Form onSubmit={handleSubmit}>
                <StyledModal.Body>
                    {error && <div className="alert alert-danger" style={{ fontSize: "0.85rem", padding: "10px" }}>{error}</div>}

                    <FormGroup controlId="tagName">
                        <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g. Vintage"
                            value={formData.name}
                            onChange={handleNameChange}
                            required
                        />
                    </FormGroup>

                    <FormGroup controlId="tagSlug">
                        <Form.Label>Slug <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g. vintage"
                            value={formData.slug}
                            onChange={(e) => setFormData(p => ({ ...p, slug: e.target.value }))}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <Form.Label>Types <span className="text-danger">*</span></Form.Label>
                        <MultiSelectWrapper>
                            {TYPE_OPTIONS.map((opt) => (
                                <CheckboxLabel key={opt.value}>
                                    <input
                                        type="checkbox"
                                        value={opt.value}
                                        checked={formData.type.includes(opt.value)}
                                        onChange={handleTypeChange}
                                    />
                                    {opt.label}
                                </CheckboxLabel>
                            ))}
                        </MultiSelectWrapper>
                    </FormGroup>

                    <FormGroup controlId="tagStatus">
                        <Form.Label>Status</Form.Label>
                        <Form.Select
                            value={formData.status}
                            onChange={(e) => setFormData(p => ({ ...p, status: Number(e.target.value) }))}
                        >
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                        </Form.Select>
                    </FormGroup>

                </StyledModal.Body>
                <StyledModal.Footer>
                    <ActionBtn type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                        Cancel
                    </ActionBtn>
                    <ActionBtn type="submit" className="btn-save" disabled={loading}>
                        {loading ? <Spinner size="sm" animation="border" /> : isEditing ? "Save Changes" : "Create"}
                    </ActionBtn>
                </StyledModal.Footer>
            </Form>
        </StyledModal>
    );
}
