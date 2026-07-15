import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Spinner, Pagination } from "react-bootstrap";
import { FiSearch, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import styled from "styled-components";
import { apiPost, apiDelete } from "../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { USER_TYPES } from "../../library/utils/constants";
import ConfirmationDialog from "../../components/popups/ConfirmationDialog";
import TagFormDialog from "./TagFormDialog";
import { getUserDetails } from "../../library/utils/services/theme";

// ─── Config ──────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const TYPE_OPTIONS = [
    { value: "", label: "All" },
    { value: "background", label: "Backgrounds" },
    { value: "clipart", label: "Cliparts" },
    { value: "mask", label: "Masks" },
    { value: "theme", label: "Themes" },
];

// ─── Styled Components ──────────────────────────────────────────────────────

const DialogOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 11100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: amFadeIn 0.2s ease;
  @keyframes amFadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const DialogContainer = styled.div`
  width: 90%;
  height: 90%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: amSlideUp 0.3s ease;
  @keyframes amSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (max-width: 768px) { width: 95%; height: 95%; }
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
  h2 { font-size: 1.35rem; font-weight: 700; color: #111827; margin: 0; }
  p { font-size: 0.82rem; color: #6b7280; margin: 4px 0 0 0; }
`;

const CloseButton = styled.button`
  background: none; border: none; padding: 6px; border-radius: 8px;
  cursor: pointer; color: #6b7280; transition: all 0.2s;
  &:hover { background: #f3f4f6; color: #111827; }
`;

const ToolbarRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  padding: 14px 24px; border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0; flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative; flex: 1; min-width: 200px;
  svg {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%); color: #9ca3af; pointer-events: none;
  }
  input {
    padding-left: 36px; border-radius: 8px; border: 1px solid #e5e7eb;
    height: 38px; font-size: 0.85rem; width: 100%; transition: border-color 0.2s;
    &:focus {
      border-color: var(--primary, #4084B5);
      box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1); outline: none;
    }
  }
`;

const FilterSelect = styled.select`
  height: 38px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 0 32px 0 12px;
  font-size: 0.85rem;
  color: #4b5563;
  background-color: #fff;
  cursor: pointer;
  outline: none;
  &:focus {
    border-color: var(--primary, #4084B5);
    box-shadow: 0 0 0 3px rgba(64, 132, 181, 0.1);
  }
`;

const AddButton = styled.button`
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px; background: var(--primary, #4084B5);
  color: #fff; border: none; border-radius: 8px;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  &:hover {
    background: var(--primary-dark, #000000);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 132, 181, 0.3);
  }
`;

const DialogBody = styled.div`
  flex: 1; overflow-y: auto; padding: 0;
  background: #fdfdfd;
`;

const TagsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td {
    padding: 14px 24px;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
  }
  th {
    background: #f8f9fa;
    position: sticky;
    top: 0;
    z-index: 10;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    font-size: 0.88rem;
    color: #374151;
    vertical-align: middle;
  }
  tbody tr:hover {
    background: #f9fafb;
  }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${(p) => (p.$active ? "#d1fae5" : "#fee2e2")};
  color: ${(p) => (p.$active ? "#059669" : "#dc2626")};
`;

const ActionButtons = styled.div`
  display: flex; gap: 8px;
`;

const IconButton = styled.button`
  background: none; border: none; padding: 6px; border-radius: 6px;
  cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
  color: ${(p) => (p.$danger ? "#ef4444" : "#6b7280")};
  &:hover {
    background: ${(p) => (p.$danger ? "#fee2e2" : "#f3f4f6")};
    color: ${(p) => (p.$danger ? "#b91c1c" : "#111827")};
  }
`;

const EmptyState = styled.div`
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 24px; text-align: center;
  color: #6b7280;
  h3 { font-size: 1rem; color: #111827; margin: 0 0 8px 0; }
`;

const LoadingWrapper = styled.div`
  display: flex; align-items: center; justify-content: center;
  padding: 80px; color: #6b7280;
`;

const FooterRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-top: 1px solid #e9ecef;
  flex-shrink: 0; flex-wrap: wrap; gap: 12px;
  background: #fff;
`;

const FooterInfo = styled.span`
  font-size: 0.78rem; color: #9ca3af;
`;

const PaginationWrapper = styled.div`
  .pagination {
    margin: 0;
    .page-item .page-link { font-size: 0.78rem; padding: 4px 10px; }
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function TagManagementDialog({ isOpen, onClose }) {
    const [tags, setTags] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [searchText, setSearchText] = useState("");
    const [filterType, setFilterType] = useState("");

    const [formDialog, setFormDialog] = useState({ show: false, tag: null });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, loading: false });

    const user = getUserDetails();

    const fetchTags = useCallback((page = 1, search = "", type = "") => {
        setIsLoading(true);
        const data = {
            filter: {
                ...(search.trim() && { search: search.trim() }),
                ...(type && { type }),
            },
            skip: (page - 1) * ITEMS_PER_PAGE,
            limit: ITEMS_PER_PAGE,
        };

        // Add brand logic if necessary depending on user levels
        // Most times getTags handles brand implicitly or via payload.brand_id

        apiPost(ENDPOINTS.getTags, data)
            .then((res) => {
                if (res && res.items) {
                    setTags(res.items);
                    setTotalCount(res.totalCount || 0);
                } else if (res && Array.isArray(res)) {
                    // Fallback if the endpoint returns an array directly
                    setTags(res);
                    setTotalCount(res.length);
                } else {
                    setTags([]);
                    setTotalCount(0);
                }
            })
            .catch((err) => {
                setTags([]);
                setTotalCount(0);
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchTags(currentPage, searchText, filterType);
        }
    }, [isOpen, currentPage, fetchTags]); // intentional omission of search to prevent double trigger

    const handleSearchClick = () => {
        setCurrentPage(1);
        fetchTags(1, searchText, filterType);
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSearchClick();
        }
    };

    const handleSearchChange = (e) => {
        setSearchText(e.target.value);
        if (!e.target.value.trim()) {
            setCurrentPage(1);
            fetchTags(1, "", filterType);
        }
    };

    const handleFilterChange = (e) => {
        const val = e.target.value;
        setFilterType(val);
        setCurrentPage(1);
        fetchTags(1, searchText, val);
    };

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
        }
    };

    const handleAddClick = () => setFormDialog({ show: true, tag: null });
    const handleEditClick = (tag) => setFormDialog({ show: true, tag });
    const handleDeleteClick = (tag) => setDeleteConfirm({ show: true, id: tag._id, loading: false });

    const handleFormSuccess = () => {
        setFormDialog({ show: false, tag: null });
        fetchTags(currentPage, searchText, filterType);
    };

    const confirmDelete = async () => {
        if (!deleteConfirm.id) return;
        setDeleteConfirm(p => ({ ...p, loading: true }));
        try {
            const res = await apiDelete(ENDPOINTS.deleteTag + deleteConfirm.id);
            if (res && (res.status === 1 || res.status === true || res.success)) {
                fetchTags(currentPage, searchText, filterType);
                setDeleteConfirm({ show: false, id: null, loading: false });
            } else {
                alert(res?.error || res?.message || "Failed to delete tag.");
                setDeleteConfirm(p => ({ ...p, loading: false }));
            }
        } catch (err) {
            alert("Error deleting tag.");
            setDeleteConfirm(p => ({ ...p, loading: false }));
        }
    };

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

    if (!isOpen) return null;

    return createPortal(
        <>
            <DialogOverlay>
                <DialogContainer onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>
                            <h2>Tag Management</h2>
                            <p>Create and organize tags used to categorize assets.</p>
                        </DialogTitle>
                        <CloseButton onClick={onClose} aria-label="Close">
                            <IoClose size={22} />
                        </CloseButton>
                    </DialogHeader>

                    <ToolbarRow>
                        <SearchWrapper>
                            <FiSearch size={16} />
                            <input
                                type="text"
                                placeholder="Search tags by name or slug..."
                                value={searchText}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </SearchWrapper>
                        <FilterSelect value={filterType} onChange={handleFilterChange}>
                            {TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </FilterSelect>
                        <AddButton onClick={handleAddClick}>
                            <FiPlus size={16} /> New Tag
                        </AddButton>
                    </ToolbarRow>

                    <DialogBody>
                        {isLoading ? (
                            <LoadingWrapper><Spinner animation="border" /></LoadingWrapper>
                        ) : tags.length === 0 ? (
                            <EmptyState>
                                <h3>No tags found</h3>
                                <p>Try adjusting your search or filter, or create a new tag.</p>
                            </EmptyState>
                        ) : (
                            <TagsTable>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Slug</th>
                                        <th>Types</th>
                                        <th>Status</th>
                                        <th>Date Created</th>
                                        <th style={{ width: "90px" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tags.map((tag) => {
                                        const canModify =
                                            user?.userTypeCode === USER_TYPES.SUPERUSER ||
                                            tag.brand_id !== null;

                                        return (
                                            <tr key={tag._id}>
                                                <td style={{ fontWeight: 500 }}>{tag.name}</td>
                                                <td style={{ color: "#6b7280" }}>{tag.slug}</td>
                                                <td>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                                        {tag.type?.map(t => (
                                                            <span key={t} style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "#4b5563", textTransform: "capitalize" }}>
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <StatusBadge $active={tag.status === 1}>
                                                        {tag.status === 1 ? "Active" : "Inactive"}
                                                    </StatusBadge>
                                                </td>
                                                <td style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                                                    {tag.createdAt ? new Date(tag.createdAt).toLocaleDateString() : "-"}
                                                </td>
                                                <td>
                                                    <ActionButtons>
                                                        {canModify && (
                                                            <>
                                                                <IconButton onClick={() => handleEditClick(tag)} title="Edit Tag">
                                                                    <FiEdit2 size={16} />
                                                                </IconButton>
                                                                <IconButton $danger onClick={() => handleDeleteClick(tag)} title="Delete Tag">
                                                                    <FiTrash2 size={16} />
                                                                </IconButton>
                                                            </>
                                                        )}
                                                    </ActionButtons>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </TagsTable>
                        )}
                    </DialogBody>

                    <FooterRow>
                        <FooterInfo>
                            {totalCount > 0
                                ? `Showing ${Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalCount)}–${Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of ${totalCount} tags`
                                : "0 tags"}
                        </FooterInfo>
                        {totalPages > 1 && (
                            <PaginationWrapper>
                                <Pagination>
                                    <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                                    {currentPage - 10 > 0 && (
                                        <>
                                            <Pagination.Item onClick={() => handlePageChange(currentPage - 10)}>{currentPage - 10}</Pagination.Item>
                                            <Pagination.Ellipsis />
                                        </>
                                    )}
                                    {currentPage > 1 && totalPages < 10 && (
                                        <Pagination.Item onClick={() => handlePageChange(currentPage - 1)}>{currentPage - 1}</Pagination.Item>
                                    )}
                                    <Pagination.Item active>{currentPage}</Pagination.Item>
                                    {currentPage < totalPages && totalPages < 10 && (
                                        <Pagination.Item onClick={() => handlePageChange(currentPage + 1)}>{currentPage + 1}</Pagination.Item>
                                    )}
                                    {currentPage + 10 <= totalPages && (
                                        <>
                                            <Pagination.Ellipsis />
                                            <Pagination.Item onClick={() => handlePageChange(currentPage + 10)}>{currentPage + 10}</Pagination.Item>
                                        </>
                                    )}
                                    <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                                </Pagination>
                            </PaginationWrapper>
                        )}
                    </FooterRow>
                </DialogContainer>
            </DialogOverlay>

            {/* Forms and confirm dialogs */}
            {formDialog.show && (
                <TagFormDialog
                    isOpen={formDialog.show}
                    onClose={() => setFormDialog({ show: false, tag: null })}
                    tagData={formDialog.tag}
                    onSuccess={handleFormSuccess}
                />
            )}

            {deleteConfirm.show && (
                <ConfirmationDialog
                    show={deleteConfirm.show}
                    onClose={() => setDeleteConfirm({ show: false, id: null, loading: false })}
                    onConfirm={confirmDelete}
                    title="Delete Tag"
                    message="Are you sure you want to permanently delete this tag? This action cannot be undone."
                    confirmText="Delete"
                    confirmVariant="danger"
                    loading={deleteConfirm.loading}
                />
            )}
        </>,
        document.body
    );
}
