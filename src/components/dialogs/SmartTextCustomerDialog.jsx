import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import { getTextGroups } from "../../library/utils/helpers";
import { setTextGroupValue } from "../../store/slices/canvas";
import { FaTags, FaCheck } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { MdAutoFixHigh } from "react-icons/md";
import { getUserDetails } from "../../library/utils/services/theme";
import { USER_TYPES } from "../../library/utils/constants";

// ─── Animations ──────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

// ─── Styled Components ───────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.2s ease;
`;

const DialogCard = styled.div`
  background: var(--background);
  border-radius: 16px;
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px color-mix(in srgb, var(--foreground) 12%, transparent),
              0 4px 16px color-mix(in srgb, var(--foreground) 6%, transparent);
  animation: ${slideUp} 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;

  @media (max-width: 480px) {
    width: 100%;
    max-height: 90vh;
    border-radius: 12px;
  }
`;

const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(
    135deg,
    var(--primary) 0%,
    color-mix(in srgb, var(--primary) 75%, #000) 100%
  );
  color: var(--primary-foreground);
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  .icon-box {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;

    svg { width: 18px; height: 18px; }
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .subtitle {
    font-size: 12px;
    opacity: 0.85;
    margin-top: 2px;
  }
`;

const CloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary-foreground) 15%, transparent);
  color: var(--primary-foreground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;

  &:hover { background: color-mix(in srgb, var(--primary-foreground) 28%, transparent); }

  svg { width: 18px; height: 18px; }
`;

const DialogBody = styled.div`
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
`;

const InfoBar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--primary) 6%, var(--background));
  border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border));
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 12px;
  color: var(--foreground);
  line-height: 1.5;

  svg {
    width: 16px;
    height: 16px;
    color: var(--primary);
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const FieldGroup = styled.div`
  margin-bottom: 16px;

  &:last-child { margin-bottom: 0; }
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 6px;

  svg { width: 14px; height: 14px; color: var(--primary); }
`;

const FieldHint = styled.div`
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 6px;
  font-style: italic;
`;

const FieldInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--foreground);
  background: var(--secondary, var(--background));
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--background);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
  }

  &::placeholder {
    color: var(--muted-foreground);
    font-style: italic;
  }
`;

const DialogFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--secondary, var(--background));
`;

const FooterBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { transform: translateY(-1px); }
  &:active { transform: translateY(0); }
`;

const PrimaryBtn = styled(FooterBtn)`
  border: none;
  background: linear-gradient(
    135deg,
    var(--primary) 0%,
    color-mix(in srgb, var(--primary) 75%, #000) 100%
  );
  color: var(--primary-foreground);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent);

  &:hover { box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 40%, transparent); }
`;

const SecondaryBtn = styled(FooterBtn)`
  border: 1.5px solid var(--border);
  background: var(--background);
  color: var(--foreground);

  &:hover { background: var(--secondary, var(--background)); filter: brightness(0.96); }
`;

// ─── Fallback example hints for well-known group keys ───────────────

const FALLBACK_EXAMPLES = {
  coupleName: { placeholder: "Enter names...", hint: "e.g. John & Jane Smith" },
  weddingDate: { placeholder: "Enter date...", hint: "e.g. March 15, 2026" },
  eventVenue: { placeholder: "Enter venue...", hint: "e.g. The Grand Ballroom, Hotel Royal" },
  heading: { placeholder: "Enter heading...", hint: "e.g. Save the Date" },
  tagline: { placeholder: "Enter tagline...", hint: "e.g. Together Forever" },
};

// ─── Main Component ──────────────────────────────────────────────────

function SmartTextCustomerDialog() {
  const dispatch = useDispatch();
  const textGroups = useSelector(getTextGroups);
  const projectSetup = useSelector((state) => state.projectSetup);

  const [isOpen, setIsOpen] = useState(false);
  const [localValues, setLocalValues] = useState({});
  const [hasShownOnce, setHasShownOnce] = useState(false);

  const projectId = useMemo(() => {
    if (!projectSetup) return null;
    return (
      projectSetup.project_id ||
      projectSetup?.cartDetails?._id ||
      projectSetup?.cartDetails?.cart_order_id ||
      projectSetup?.themeDetails?.cart_order_id ||
      null
    );
  }, [projectSetup]);

  useEffect(() => {
    if (!projectId) return;
    try {
      const storedValue = localStorage.getItem(`smartTextShown:${projectId}`);
      setHasShownOnce(storedValue === "true");
    } catch (error) {}
  }, [projectId]);
  
  const themeId = projectSetup?.themeDetails?._id || projectSetup?.themeDetails?.theme_id;

  // Final fail-safe: Close the dialog if the theme changes to keep the UI clean
  useEffect(() => {
    setIsOpen(false);
  }, [themeId]);

  const groupKeys = useMemo(() => Object.keys(textGroups), [textGroups]);

  // Auto-open dialog once when user loads a project with text groups
  useEffect(() => {
    if (groupKeys.length > 0 && !hasShownOnce) {
      // Small delay so the editor finishes rendering first
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasShownOnce(true);
        if (projectId) {
          try {
            localStorage.setItem(`smartTextShown:${projectId}`, "true");
          } catch (error) {}
        }
        // Initialize local values from current group values
        const initial = {};
        groupKeys.forEach((key) => {
          initial[key] = textGroups[key]?.value || "";
        });
        setLocalValues(initial);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [groupKeys.length, hasShownOnce, textGroups, groupKeys, projectId]);

  // Re-sync local values when dialog opens manually
  const handleOpen = useCallback(() => {
    const initial = {};
    groupKeys.forEach((key) => {
      initial[key] = textGroups[key]?.value || "";
    });
    setLocalValues(initial);
    setIsOpen(true);
  }, [groupKeys, textGroups]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleFieldChange = useCallback((key, value, maxChars) => {
    if (maxChars && value.length > maxChars) {
      setLocalValues((prev) => ({ ...prev, [key]: value.slice(0, maxChars) }));
    } else {
      setLocalValues((prev) => ({ ...prev, [key]: value }));
    }
  }, []);

  const handleApply = useCallback(() => {
    // Dispatch only changed values
    Object.entries(localValues).forEach(([key, value]) => {
      if (value !== (textGroups[key]?.value || "")) {
        dispatch(setTextGroupValue({ groupKey: key, value }));
      }
    });
    setIsOpen(false);
  }, [localValues, textGroups, dispatch]);

  // Don't render if no groups exist
  if (groupKeys.length === 0) return null;

  const user = getUserDetails()

  if (user?.userTypeCode !== USER_TYPES.CUSTOMER) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <SmartTextTrigger onClick={handleOpen} title="Personalize your design">
          <MdAutoFixHigh />
          <span>Personalize</span>
        </SmartTextTrigger>
      )}

      {/* Dialog */}
      {isOpen && createPortal(
        <Overlay
        // onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} 
        >
          <DialogCard onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <HeaderLeft>
                <div className="icon-box"><FaTags /></div>
                <div>
                  <div className="title">Personalize Your Design</div>
                  <div className="subtitle">Make this design truly yours</div>
                </div>
              </HeaderLeft>
              {/* <CloseBtn onClick={handleClose}>
                <IoClose />
              </CloseBtn> */}
            </DialogHeader>

            <DialogBody>
              <InfoBar>
                <MdAutoFixHigh />
                <div>
                  Fill in the fields below to customize the text in your design.
                  All matching text will update automatically across every page.
                </div>
              </InfoBar>

              {groupKeys.map((key) => {
                const group = textGroups[key];
                // Prefer admin-set example from group state, fall back to hardcoded hints
                const fallback = FALLBACK_EXAMPLES[key];
                const exampleHint = group?.example
                  ? `e.g. ${group.example}`
                  : fallback?.hint || null;
                const placeholder = fallback?.placeholder || `Enter ${group?.label || key}...`;
                return (
                  <FieldGroup key={key}>
                    <FieldLabel>
                      <FaTags />
                      {group?.label || key}
                    </FieldLabel>
                    {exampleHint && <FieldHint>{exampleHint}</FieldHint>}
                    <FieldInput
                      type="text"
                      value={localValues[key] || ""}
                      onChange={(e) => handleFieldChange(key, e.target.value, group?.maxChars)}
                      placeholder={placeholder}
                      maxLength={group?.maxChars || undefined}
                    />
                    {group?.maxChars && (
                      <div style={{ fontSize: '11px', marginTop: '6px', textAlign: 'right', fontWeight: '500', color: (localValues[key] || "").length >= group.maxChars ? "var(--destructive, #dc3545)" : "var(--muted-foreground)" }}>
                        {(localValues[key] || "").length} / {group.maxChars} characters {((localValues[key] || "").length >= group.maxChars) && "(Limit reached)"}
                      </div>
                    )}
                  </FieldGroup>
                );
              })}
            </DialogBody>

            <DialogFooter>
              {/* <SecondaryBtn onClick={handleClose}>
                Skip for now
              </SecondaryBtn> */}
              <PrimaryBtn onClick={handleApply}>
                <FaCheck />
                Apply Changes
              </PrimaryBtn>
            </DialogFooter>
          </DialogCard>
        </Overlay>,
        document.body
      )}
    </>
  );
}

export default SmartTextCustomerDialog;

// ─── Trigger Button ──────────────────────────────────────────────────

const SmartTextTrigger = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 50px;
  background: linear-gradient(
    135deg,
    var(--primary) 0%,
    color-mix(in srgb, var(--primary) 75%, #000) 100%
  );
  color: var(--primary-foreground);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent);
  transition: all 0.2s ease;
  animation: ${fadeIn} 0.5s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px color-mix(in srgb, var(--primary) 45%, transparent);
  }

  svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 576px) {
    bottom: 80px;
    right: 16px;
    padding: 10px 16px;
    font-size: 12px;
  }
`;
