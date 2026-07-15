/**
 * FontManagementDialog
 * Main dialog for managing fonts - shows a table of all fonts with search, filters,
 * and actions. Opens as an 80% screen overlay dialog.
 * Admin-only feature.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Modal, Form, Table, Badge, Spinner, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { FiSearch, FiPlus, FiEdit2, FiUpload } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { IoClose } from "react-icons/io5";
import { MdOutlineToggleOn, MdOutlineToggleOff } from "react-icons/md";
import { FaCrown } from "react-icons/fa6";
import styled from "styled-components";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { FONT_CATEGORIES } from "../../library/utils/common-functions/fontParser";
import AddFontDialog from "./AddFontDialog";
import EditFontDialog from "./EditFontDialog";

const getSourceDisplay = (source) => {
  const normalized = (source || "upload").toLowerCase();
  if (normalized === "google") {
    return {
      label: "",
      icon: <FcGoogle size={16} title="Google Fonts" />,
    };
  }
  return {
    label: "",
    icon: <FiUpload size={14} title="Uploaded" />,
  };
};

/**
 * FontManagementDialog
 * Main dialog for managing fonts - shows a table of all fonts with search, filters,
 * and actions. Opens as an 80% screen overlay dialog.
 * Admin-only feature.
 */

// ─── Styled Components ───────────────────────────────────────────────────────

const DialogOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 11100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const SourceBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: capitalize;

  svg {
    flex-shrink: 0;
  }
`;

const DialogContainer = styled.div`
  width: 90%;
  height: 90%;
  // max-width: 1200px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: 768px) {
    width: 95%;
    height: 95%;
  }
`;

const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
`;

const DialogTitle = styled.div`
  h2 {
    font-size: 1.35rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  p {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 4px 0 0 0;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
`;

const ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  input {
    padding-left: 36px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    height: 38px;
    font-size: 0.85rem;
    width: 100%;
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--primary, #4084B5);
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
      outline: none;
    }
  }
`;

const FilterSelect = styled(Form.Select)`
  width: 160px;
  height: 38px;
  font-size: 0.85rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  cursor: pointer;

  &:focus {
    border-color: var(--primary, #4084B5);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--primary, #4084B5);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: var(--primary-dark, #000000);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
`;

const DialogBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const FontTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  thead {
    position: sticky;
    top: 0;
    background: #f9fafb;
    z-index: 1;
  }

  th {
    padding: 12px 16px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
    white-space: nowrap;
  }

  td {
    padding: 14px 16px;
    font-size: 0.875rem;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  tbody tr {
    transition: background 0.15s;

    &:hover {
      background: #f9fafb;
    }
  }
`;

const FontFamilyCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  .font-name {
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .font-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #9ca3af;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .print-safe {
    font-size: 0.7rem;
    color: var(--primary, #4084B5);
    font-family: inherit;
  }
`;

const CategoryBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
`;

const ScriptBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  font-size: 0.72rem;
  color: #6b7280;
  text-transform: capitalize;
  margin-right: 4px;
  margin-bottom: 2px;
`;

const ToggleSwitch = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 1.8rem;
  line-height: 1;
  color: ${(props) => (props.$enabled ? "var(--primary, #4084B5)" : "#d1d5db")};
  transition: color 0.2s;

  &:hover {
    color: ${(props) => (props.$enabled ? "#000000" : "#9ca3af")};
  }
`;

const EditButton = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary, #4084B5);
    color: var(--primary, #4084B5);
    background: rgba(0, 0, 0, 0.05);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;

  .icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: #9ca3af;
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 4px 0;
  }

  p {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 0 0 16px 0;
  }
`;

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  gap: 12px;
  color: #6b7280;
  font-size: 0.85rem;
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
  font-size: 0.78rem;
  color: #9ca3af;
`;

// ─── Component ───────────────────────────────────────────────────────────────

function FontManagementDialog({ isOpen, onClose }) {
  const [fonts, setFonts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingFont, setEditingFont] = useState(null);

  // Fetch fonts from backend
  const fetchFonts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiPost(ENDPOINTS.getFontsList, {
        filter: {},
        skip: 0,
        limit: 500,
      });
      if (response && response.status === 1 && response.items) {
        setFonts(response.items);
      } else if (response && Array.isArray(response)) {
        setFonts(response);
      } else {
        setFonts([]);
      }
    } catch (err) {
      setError("Failed to load fonts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFonts();
    }
  }, [isOpen, fetchFonts]);

  // Filter fonts based on search, category, and status
  const filteredFonts = useMemo(() => {
    return fonts.filter((font) => {
      const matchesSearch =
        !search ||
        font.name?.toLowerCase().includes(search.toLowerCase()) ||
        font.fontId?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" ||
        (font.category && (Array.isArray(font.category)
          ? font.category.includes(categoryFilter)
          : font.category === categoryFilter));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && font.enabled) ||
        (statusFilter === "disabled" && !font.enabled);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [fonts, search, categoryFilter, statusFilter]);

  // Toggle font enabled/disabled
  const handleToggleEnabled = async (fontId) => {
    try {
      const fontToUpdate = fonts.find((f) => f._id === fontId);
      if (!fontToUpdate) return;

      await apiPost(ENDPOINTS.toggleFont, {
        _id:fontId,
        enabled: !fontToUpdate.enabled,
      });

      // Optimistic update
      setFonts((prev) =>
        prev.map((f) =>
          f._id === fontId ? { ...f, enabled: !f.enabled } : f
        )
      );
    } catch (err) {}
  };

  // Handle font added successfully
  const handleFontAdded = () => {
    setShowAddDialog(false);
    fetchFonts();
  };

  // Handle font edited successfully
  const handleFontEdited = () => {
    setEditingFont(null);
    fetchFonts();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <DialogOverlay onClick={onClose}>
        <DialogContainer onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <DialogHeader>
            <DialogTitle>
              <h2>Font Management</h2>
              <p>Manage font families for the PrintPoz editor</p>
            </DialogTitle>
            <CloseButton onClick={onClose} aria-label="Close font management">
              <IoClose size={22} />
            </CloseButton>
          </DialogHeader>

          {/* Toolbar: Search + Filters + Add Button */}
          <ToolbarRow>
            <SearchWrapper>
              <FiSearch size={16} />
              <input
                type="text"
                placeholder="Search by name or fontId..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search fonts"
              />
            </SearchWrapper>

            <FilterSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {FONT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </FilterSelect>

            <AddButton onClick={() => setShowAddDialog(true)}>
              <FiPlus size={16} />
              Add Font
            </AddButton>
          </ToolbarRow>

          {/* Body: Font Table */}
          <DialogBody>
            {error && (
              <div
                className="m-3 p-3 rounded"
                style={{
                  background: "#f2f2f2",
                  border: "1px solid #e6e6e6",
                  color: "#111111",
                  fontSize: "0.85rem",
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {isLoading ? (
              <LoadingWrapper>
                <Spinner animation="border" size="sm" />
              </LoadingWrapper>
            ) : filteredFonts.length === 0 ? (
              <EmptyState>
                <div className="icon-wrapper">
                  <FiUpload size={22} />
                </div>
                <h3>No fonts found</h3>
                <p>
                  {fonts.length === 0
                    ? "Add your first font to get started"
                    : "No fonts match your current filters"}
                </p>
                {fonts.length === 0 && (
                  <AddButton onClick={() => setShowAddDialog(true)}>
                    <FiPlus size={16} />
                    Add Font
                  </AddButton>
                )}
              </EmptyState>
            ) : (
              <FontTable>
                <thead>
                  <tr>
                    <th style={{ width: "260px" }}>Font Family</th>
                    <th>Category</th>
                    <th>Styles</th>
                    <th>Source</th>
                    <th>Processing</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFonts.map((font) => (
                    <tr key={font.fontId || font._id}>
                      {/* Font Family */}
                      <td>
                        <FontFamilyCell>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "120px", height: "32px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                              {font.previews?.medium ? (
                                <img
                                  src={font.previews.medium}
                                  alt={font.name}
                                  loading="lazy"
                                  draggable={false}
                                  style={{
                                    height: "28px",
                                    maxWidth: "120px",
                                    width: "auto",
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                    userSelect: "none",
                                  }}
                                />
                              ) : null}
                            </div>
                            <div>
                              <div className="font-name">
                                {font.name}
                                {font.premium && (
                                  <FaCrown
                                    size={12}
                                    style={{ color: "#111111" }}
                                  />
                                )}
                                {font.printSafe && (
                                  <span className="print-safe">Print Safe</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </FontFamilyCell>
                      </td>

                      {/* Category */}
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {Array.isArray(font.category) ? (
                            font.category.map((cat) => (
                              <CategoryBadge key={cat}>{cat}</CategoryBadge>
                            ))
                          ) : (
                            <CategoryBadge>{font.category}</CategoryBadge>
                          )}
                        </div>
                      </td>

                      {/* Styles count */}
                      <td>
                        <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                          {font.styles?.length || 0} style
                          {(font.styles?.length || 0) !== 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Source */}
                      <td>
                        <SourceBadge>
                          {getSourceDisplay(font.source).icon}
                          <span>{getSourceDisplay(font.source).label}</span>
                        </SourceBadge>
                      </td>

                      {/* Processing Status */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            background: font.processingStatus === "ready" ? "#f2f2f2" : font.processingStatus === "processing" ? "#f7f7f7" : "#f2f2f2",
                            color: font.processingStatus === "ready" ? "#333333" : font.processingStatus === "processing" ? "#333333" : "#111111",
                          }}
                        >
                          {font.processingStatus || "unknown"}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td>
                        <ToggleSwitch
                          $enabled={font.enabled}
                          onClick={() =>
                            handleToggleEnabled(font._id)
                          }
                          aria-label={`${
                            font.enabled ? "Disable" : "Enable"
                          } ${font.name}`}
                        >
                          {font.enabled ? (
                            <MdOutlineToggleOn />
                          ) : (
                            <MdOutlineToggleOff />
                          )}
                        </ToggleSwitch>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <EditButton onClick={() => setEditingFont(font)}>
                          <FiEdit2 size={13} />
                          Edit
                        </EditButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </FontTable>
            )}
          </DialogBody>

          {/* Footer */}
          <FooterRow>
            <span>
              {filteredFonts.length} of {fonts.length} fonts shown
            </span>
          </FooterRow>
        </DialogContainer>
      </DialogOverlay>

      {/* Add Font Sub-Dialog */}
      {showAddDialog && (
        <AddFontDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleFontAdded}
        />
      )}

      {/* Edit Font Sub-Dialog */}
      {editingFont && (
        <EditFontDialog
          isOpen={!!editingFont}
          font={editingFont}
          onClose={() => setEditingFont(null)}
          onSuccess={handleFontEdited}
        />
      )}
    </>,
    document.body
  );
}

export default FontManagementDialog;
