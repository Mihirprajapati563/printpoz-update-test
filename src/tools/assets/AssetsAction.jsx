/**
 * AssetsAction
 * Sidebar panel for Assets — shows a single "Asset Management" button
 * that opens the full AssetManagementDialog. Admin/Super Admin only.
 */
import React, { useState } from "react";
import styled from "styled-components";
import { LiaTimesSolid } from "react-icons/lia";
import { MdDashboard } from "react-icons/md";
import { useDispatch } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import {
    ActionTitle,
    DisplayBetween,
} from "../../common-components/StyledComponents";
import AssetManagementDialog from "./AssetManagementDialog";
import TagManagementDialog from "./TagManagementDialog";
import { FaRegFolderOpen, FaTags } from "react-icons/fa";

// ─── Styled ──────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 24px 16px;
  gap: 12px;
`;

const ManageBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: ${(p) => p.$secondary ? "#4b5563" : "var(--primary, #4084B5)"};
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px ${(p) => p.$secondary ? "rgba(0, 0, 0, 0.08)" : "rgba(64, 132, 181, 0.15)"};

  &:hover {
    background: ${(p) => p.$secondary ? "#374151" : "var(--primary-dark, #000000)"};
    transform: translateY(-2px);
    box-shadow: 0 8px 20px ${(p) => p.$secondary ? "rgba(0, 0, 0, 0.15)" : "rgba(64, 132, 181, 0.3)"};
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    flex-shrink: 0;
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export const AssetsAction = () => {
    const dispatch = useDispatch();
    const [showDialog, setShowDialog] = useState(false);
    const [showTagDialog, setShowTagDialog] = useState(false);

    return (
        <>
            <Container className="sticker-container sticker-container-mob">
                <DisplayBetween
                    className="heading-action-mob"
                    style={{ flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}
                >
                    <ActionTitle>Assets</ActionTitle>
                    <LiaTimesSolid
                        onClick={() => dispatch(setIsActionActive(false))}
                        className="cursor-pointer"
                    />
                </DisplayBetween>

                <Content>
                    <ManageBtn onClick={() => setShowDialog(true)}>
                        <FaRegFolderOpen size={20} />
                        Manage Assets
                    </ManageBtn>
                    <ManageBtn $secondary onClick={() => setShowTagDialog(true)}>
                        <FaTags size={18} />
                        Manage Tags
                    </ManageBtn>
                </Content>
            </Container>

            {showDialog && (
                <AssetManagementDialog
                    isOpen={showDialog}
                    onClose={() => setShowDialog(false)}
                />
            )}

            {showTagDialog && (
                <TagManagementDialog
                    isOpen={showTagDialog}
                    onClose={() => setShowTagDialog(false)}
                />
            )}
        </>
    );
};
