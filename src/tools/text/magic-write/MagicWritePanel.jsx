import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  FaCopy,
  FaCheck,
  FaArrowLeft,
  FaChevronLeft,
  FaChevronRight,
  FaStop,
} from "react-icons/fa";
import { IoSparkles, IoPencil, IoClose } from "react-icons/io5";
import { RiAiGenerate } from "react-icons/ri";
import styled, { keyframes, css } from "styled-components";
import { apiPost } from "../../../library/utils/common-services/apiCall";
import { ENDPOINTS } from "../../../library/utils/constants/apiurl";
import { getActiveEditorType } from "../../../library/utils/helpers";
import { MagicWriteActionsJSON } from "../../../library/utils/jsons/commonJSON";
import { MdDelete } from "react-icons/md";

// Remember last drag position across component mounts
let magicWriteSavedPos = null;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const gradientFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const PanelOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
`;

const PanelContainer = styled.div`
  position: fixed;
  z-index: 1051;
  width: 300px;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease-out;
  touch-action: none;

  @media (max-width: 576px) {
    width: calc(100vw - 20px);
    max-height: 60vh;
    border-radius: 10px;
  }
`;

const DragGrip = styled.div`
  display: flex;
  justify-content: center;
  padding: 6px 0 2px;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  .grip-dots {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: #ccc;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #0d1216;
    pointer-events: none;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f0f0f0;
    color: #000;
  }
`;

const PanelBody = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  min-height: 0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
  }
`;

const ContentBox = styled.div`
  position: relative;
  background: ${(p) =>
    p.$output ?
      "linear-gradient(135deg, rgba(0,196,204,0.03), rgba(125,42,232,0.03))"
      : "#fafafa"};
  border-radius: 8px;
  padding: 12px;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 8px;
    padding: 1.5px;
    background: linear-gradient(to bottom right, var(--primary), #3a3a3a);
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  border: none;
  outline: none;
  resize: none;
  font-size: 13px;
  line-height: 1.5;
  background: transparent;
  overflow-y: auto;

  /* Hide scrollbar but keep scrollable */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::placeholder {
    color: #aaa;
  }
  &:disabled {
    color: #1a1a1a;
  }
`;

const CharCount = styled.div`
  text-align: right;
  font-size: 11px;
  color: #999;
  margin-top: 8px;
`;

const OutputHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 6px;
    margin-bottom: 10px;
    padding-bottom: 10px;
  }

  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    flex-direction: row;
    justify-content: flex-start;
  }
`;

const OutputContent = styled.div`
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #333;
  overflow-y: auto;
  max-height: 200px;

  /* Hide scrollbar but keep scrollable */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const NavButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    border-color: #000;
    color: #000;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  svg {
    width: 12px;
    height: 12px;
  }
`;

const PageInfo = styled.span`
  font-size: 13px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
`;

const ActionLabel = styled.span`
  font-size: 12px;
  color: #666;
  font-weight: 500;
  margin-left: 6px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
`;

const Cursor = styled.span`
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: var(--primary);
  margin-left: 2px;
  animation: ${blink} 1s infinite;
`;

const SkeletonLine = styled.div`
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s infinite;
  width: ${(p) => p.$w || "100%"};
  margin-bottom: 8px;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
`;

const Button = styled.button`
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  background: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    border-color: #000;
    color: #000;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PrimaryBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #000;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  ${(p) =>
    p.$loading &&
    css`
      animation: ${gradientFlow} 1.5s infinite;
      background-size: 200% 200%;
    `}
`;

const SmallBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  background: white;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f5;
    color: #000;
    border-color: #000;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity 0.2s;
  pointer-events: none;
`;

const Select = styled.select`
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  font-size: 12px;
  font-weight: 500;
  min-width: 90px;
  cursor: pointer;
  background: white;
  white-space: nowrap;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
`;

const DialogOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 10000;
`;

const Dialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  z-index: 10001;
  width: 90%;
  max-width: 400px;
`;

const StopGenerationButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
  white-space: nowrap;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover:not(:disabled) {
    background: #000;
  }
`;

const EscLabel = styled.span`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 4px;
`;

const DialogTitle = styled.h4`
  margin: 0 0 12px;
  font-size: 16px;
`;

const DialogInput = styled.input`
  width: 100%;
  padding: 12px;
  font-size: 14px;
  margin-bottom: 16px;
  border: 2px solid transparent;
  border-radius: 8px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(to bottom right, var(--primary), #3a3a3a) border-box;
  border-image: none;

  &:focus {
    outline: none;
    border-color:
      linear-gradient(#fff, #fff) padding-box,
      linear-gradient(to bottom right, var(--primary), #3a3a3a) border-box;
  }
`;

const DialogButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const dash = keyframes`
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 91, 150; stroke-dashoffset: -124; }
`;

const StyledSpinner = styled.svg`
  animation: ${rotate} 2s linear infinite;
  width: 24px;
  height: 24px;
  display: block;

  & .path {
    stroke: url(#spinner-gradient);
    stroke-linecap: round;
    animation: ${dash} 1.5s ease-in-out infinite;
  }
`;

const PremiumSpinner = () => (
  <StyledSpinner viewBox="0 0 50 50">
    <defs>
      <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--primary)" />
        <stop offset="100%" stopColor="#3a3a3a" />
      </linearGradient>
    </defs>
    <circle
      className="path"
      cx="25"
      cy="25"
      r="20"
      fill="none"
      strokeWidth="5"
    />
  </StyledSpinner>
);

const MAX_CAPTION_WORDS = 500;

function truncateCaptionText(text) {
  if (typeof text !== "string") return text;

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const words = normalized.split(" ");
  if (words.length <= MAX_CAPTION_WORDS) {
    return normalized;
  }

  const trimmed = words.slice(0, MAX_CAPTION_WORDS).join(" ");
  return `${trimmed}...`;
}

const callMagicWriteAPI = async ({
  action,
  prompt,
  modifier = null,
  editorType = null,
  themeId = null,
  isPrompt = false,
}) => {
  const data = {
    action,
    prompt,
    editor_type: editorType,
    theme_id: themeId || null,
    isPrompt: isPrompt,
  };

  if (modifier && action === "modify") {
    data.modifier = modifier;
  }

  const response = await apiPost(ENDPOINTS.getTextCaptions, data);

  if (response?.error) {
    throw new Error(response.error.message || "API request failed");
  }

  if (response?.items?.suggestions) {
    return response.items?.suggestions;
  }

  throw new Error("No response received from API");
};

export const MagicWritePanel = ({
  mode = "create",
  selectedText = "",
  onReplace,
  onInsert,
  onClose,
}) => {
  const [history, setHistory] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [inputText, setInputText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [action, setAction] = useState("rewrite");
  const [showDialog, setShowDialog] = useState(false);
  const [modifier, setModifier] = useState("");
  const [userScrolled, setUserScrolled] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isClearHovered, setIsClearHovered] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const timerRef = useRef(null);
  const contentRef = useRef(null);
  const panelRef = useRef(null);
  const MAX_LENGTH = 500;

  // ─── Drag state with position memory (unified touch + mouse) ─────────
  const DEFAULT_POS = { x: 100, y: 70 };
  const [panelPos, setPanelPos] = useState(() => magicWriteSavedPos || DEFAULT_POS);
  const panelPosRef = useRef(magicWriteSavedPos || DEFAULT_POS);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0, inputType: null });

  useEffect(() => {
    panelPosRef.current = panelPos;
  }, [panelPos]);

  const clampPos = useCallback((pos) => {
    const pw = panelRef.current?.offsetWidth || 300;
    const ph = panelRef.current?.offsetHeight || 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(pos.x, vw - pw)),
      y: Math.max(0, Math.min(pos.y, vh - ph)),
    };
  }, []);

  // Remember position across mounts
  useEffect(() => {
    magicWriteSavedPos = { ...panelPos };
  }, [panelPos]);

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => setPanelPos((prev) => clampPos(prev));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPos]);

  const startDragging = useCallback((clientX, clientY, inputType) => {
    dragRef.current = {
      dragging: true,
      offsetX: clientX - panelPosRef.current.x,
      offsetY: clientY - panelPosRef.current.y,
      inputType,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragRef.current.dragging) return;
      const isTouch = dragRef.current.inputType === "touch";
      const point = isTouch ? event.touches?.[0] : event;
      if (!point) return;
      event.preventDefault();
      const rawX = point.clientX - dragRef.current.offsetX;
      const rawY = point.clientY - dragRef.current.offsetY;
      setPanelPos(clampPos({ x: rawX, y: rawY }));
    },
    [clampPos]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current.dragging) return;
    const isTouch = dragRef.current.inputType === "touch";
    dragRef.current.dragging = false;
    if (isTouch) {
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    } else {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
    }
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event) => {
      const target = event.target;
      if (target?.closest("[data-no-drag='true']")) return;

      if (event.type === "touchstart") {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        startDragging(touch.clientX, touch.clientY, "touch");
        document.addEventListener("touchmove", handlePointerMove, { passive: false });
        document.addEventListener("touchend", handlePointerUp);
        document.addEventListener("touchcancel", handlePointerUp);
        return;
      }

      if (event.button !== 0) return;
      event.preventDefault();
      startDragging(event.clientX, event.clientY, "mouse");
      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("mouseup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, startDragging]
  );

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const editorType = useSelector(getActiveEditorType);
  const projectSetup = useSelector((state) => state.projectSetup);
  const themeId = projectSetup?.themeDetails?.theme_id;

  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isViewing = currentIdx >= 0 && history.length > 0;
  const currentItem = isViewing ? history[currentIdx] : null;

  const truncateText = useCallback(
    (text) => (isCreate ? truncateCaptionText(text) : text),
    [isCreate],
  );

  useEffect(() => {
    setInputText(isEdit && selectedText ? selectedText : "");
  }, [mode, selectedText, isEdit]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      updated[lastIdx] = { ...updated[lastIdx], text: displayText };
      return updated;
    });
    setIsTyping(false);
    setLoading(false);
  }, [displayText]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isTyping) {
        handleStopGeneration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTyping, handleStopGeneration]);

  useEffect(() => {
    if (loading && contentRef.current && !userScrolled) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayText, loading, userScrolled]);

  const handleContentScroll = () => {
    if (!contentRef.current || !loading) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserScrolled(!isNearBottom);
  };

  const typewrite = useCallback((text) => {
    setDisplayText("");
    setUserScrolled(false);
    setIsTyping(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timerRef.current);
        setIsTyping(false);
        setLoading(false);
      }
    }, 15);
  }, []);

  const addResult = (actionType, label, text) => {
    setHistory((prev) => [
      ...prev,
      { id: Date.now(), action: actionType, label, text },
    ]);
    setCurrentIdx(history.length);
  };

  const executeGeneration = useCallback(
    async (actionType, modifierInput = null) => {
      if (!inputText.trim()) return;

      setLoading(true);
      setApiError(null);

      const label =
        isEdit ?
          MagicWriteActionsJSON.find((a) => a.value === actionType)?.label ||
          actionType
          : inputText;

      try {
        const response = await callMagicWriteAPI({
          action: actionType,
          prompt: inputText,
          modifier: modifierInput,
          editorType,
          themeId,
          isPrompt: true,
        });

        const safeResponse = truncateText(response);
        addResult(actionType, modifierInput || label, safeResponse);
        typewrite(safeResponse);
      } catch (error) {
        setApiError(
          error.message || "Failed to generate text. Please try again.",
        );
        setLoading(false);
      }
    },
    [inputText, isEdit, editorType, themeId, addResult, typewrite],
  );

  const performGeneration = useCallback(
    (actionType) => {
      executeGeneration(actionType);
    },
    [executeGeneration],
  );

  const handleGenerate = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || loading) return;
    performGeneration(isEdit ? action : "generate");
  };

  const handleActionChange = (e) => {
    const newAction = e.target.value;
    setAction(newAction);
    if (!loading && inputText.trim()) {
      performGeneration(newAction);
    }
  };

  const handleRegenerate = useCallback(async () => {
    if (loading || !currentItem) return;

    setLoading(true);
    setApiError(null);

    try {
      const response = await callMagicWriteAPI({
        action: "regenerate",
        prompt: inputText,
        editorType,
        themeId,
        isPrompt: true,
      });

      const safeResponse = truncateText(response);
      addResult("regenerate", "Regenerate", safeResponse);
      typewrite(safeResponse);
    } catch (error) {
      setApiError(error.message || "Failed to regenerate. Please try again.");
      setLoading(false);
    }
  }, [
    loading,
    currentItem,
    inputText,
    editorType,
    themeId,
    addResult,
    typewrite,
  ]);

  const handleModify = useCallback(async () => {
    if (!modifier.trim() || loading) return;

    setShowDialog(false);
    setLoading(true);
    setApiError(null);

    try {
      const response = await callMagicWriteAPI({
        action: "modify",
        prompt: inputText,
        modifier: modifier,
        editorType,
        themeId,
        isPrompt: true,
      });

      const safeResponse = truncateText(response);
      addResult("modify", modifier, safeResponse);
      setModifier("");
      typewrite(safeResponse);
    } catch (error) {
      setApiError(error.message || "Failed to modify text. Please try again.");
      setLoading(false);
    }
  }, [modifier, loading, inputText, editorType, themeId, addResult, typewrite]);

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setDisplayText(history[currentIdx - 1].text);
    }
  };

  const goNext = () => {
    if (currentIdx < history.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setDisplayText(history[currentIdx + 1].text);
    }
  };

  const goBack = () => {
    if (currentIdx > 0) goPrev();
    else {
      setCurrentIdx(-1);
      setDisplayText("");
    }
  };

  const handleCopy = () => {
    const textToCopy = isViewing ? displayText : inputText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReplace = () => {
    if (!isViewing || !displayText) return;
    isEdit ? onReplace?.(displayText) : onInsert?.(displayText);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      isViewing ? !loading && handleReplace() : handleGenerate();
    }
  };

  const handleClear = () => {
    setInputText("");
  };

  useEffect(() => {
    if (apiError) {
      setApiError(null);
    }
  }, [inputText, action]);

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <>
      <PanelOverlay onClick={onClose} />
      <PanelContainer
        ref={panelRef}
        style={{ top: panelPos.y, left: panelPos.x }}
        onPointerDown={stopPropagation}
        onTouchStart={stopPropagation}
        onMouseDown={stopPropagation}
        onWheel={stopPropagation}
      >
        <DragGrip
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <div className="grip-dots" />
        </DragGrip>
        <PanelHeader
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <h3>Smart Caption</h3>
          <CloseButton onClick={onClose} title="Close" data-no-drag="true">
            <IoClose size={18} />
          </CloseButton>
        </PanelHeader>

        <PanelBody>
          {isViewing ?
            <ContentBox $output>
              {loading && !displayText ?
                <div>
                  <SkeletonLine $w="95%" />
                  <SkeletonLine $w="80%" />
                  <SkeletonLine $w="90%" />
                  <SkeletonLine $w="60%" />
                </div>
                : <>
                  <OutputHeader>
                    {loading ?
                      <PremiumSpinner />
                      : history.length > 1 ?
                        <ButtonGroup>
                          <NavButton
                            onClick={goPrev}
                            disabled={currentIdx === 0}
                          >
                            <FaChevronLeft />
                          </NavButton>
                          <PageInfo>
                            {currentIdx + 1}/{history.length}
                          </PageInfo>
                          <NavButton
                            onClick={goNext}
                            disabled={currentIdx === history.length - 1}
                          >
                            <FaChevronRight />
                          </NavButton>
                        </ButtonGroup>
                        : <NavButton onClick={goBack} title="Go back">
                          <FaArrowLeft />
                        </NavButton>
                    }
                    <ActionLabel>{currentItem?.label}</ActionLabel>
                  </OutputHeader>

                  <OutputContent
                    ref={contentRef}
                    onScroll={handleContentScroll}
                  >
                    {displayText}
                    {loading && <Cursor />}
                  </OutputContent>
                </>
              }
            </ContentBox>
            : <form onSubmit={handleGenerate}>
              <ContentBox>
                <Textarea
                  value={inputText}
                  onChange={(e) =>
                    setInputText(e.target.value.slice(0, MAX_LENGTH))
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isCreate ?
                      "Describe your idea..."
                      : "Enter or paste your text..."
                  }
                  autoFocus
                  className="hide-scrollbar"
                  rows={4}
                  disabled={loading}
                />
                {isCreate && (
                  <CharCount>
                    {inputText.length}/{MAX_LENGTH}
                  </CharCount>
                )}
              </ContentBox>
            </form>
          }
        </PanelBody>

        <Footer>
          {isViewing ?
            isTyping ?
              <StopGenerationButton onClick={handleStopGeneration}>
                <FaStop /> Stop <EscLabel>Esc</EscLabel>
              </StopGenerationButton>
              : <>
                <ButtonGroup>
                  <PrimaryBtn onClick={handleRegenerate} disabled={loading}>
                    <RiAiGenerate /> Redo
                  </PrimaryBtn>
                  <PrimaryBtn
                    onClick={() => setShowDialog(true)}
                    disabled={loading}
                  >
                    <IoPencil /> Modify
                  </PrimaryBtn>
                </ButtonGroup>
                <ButtonGroup>
                  <SmallBtn onClick={handleCopy} title="Copy">
                    <Tooltip $show={copied}>
                      <FaCheck /> Copied!
                    </Tooltip>
                    <FaCopy />
                  </SmallBtn>
                  {isEdit && (
                    <Select
                      value={action}
                      onChange={handleActionChange}
                      disabled={loading}
                    >
                      {MagicWriteActionsJSON.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  )}
                  <PrimaryBtn onClick={handleReplace} disabled={loading}>
                    {isEdit ? "Replace" : "Insert"}
                  </PrimaryBtn>
                </ButtonGroup>
              </>

            : isTyping ?
              <StopGenerationButton onClick={handleStopGeneration}>
                <FaStop /> Stop <EscLabel>Esc</EscLabel>
              </StopGenerationButton>
              : <ButtonGroup style={{ marginLeft: "auto" }}>
                {isEdit && (
                  <Select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    disabled={loading}
                  >
                    {MagicWriteActionsJSON.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                )}
                {isCreate && !loading && (
                  <SmallBtn
                    onClick={handleClear}
                    onMouseEnter={() => setIsClearHovered(true)}
                    onMouseLeave={() => setIsClearHovered(false)}
                  >
                    <Tooltip $show={isClearHovered}>Clear</Tooltip>
                    <MdDelete />
                  </SmallBtn>
                )}
                <PrimaryBtn
                  onClick={handleGenerate}
                  disabled={!inputText.trim() || loading}
                  $loading={loading}
                >
                  <IoSparkles />
                  {loading ? "Generating..." : "Generate"}
                </PrimaryBtn>
              </ButtonGroup>
          }
        </Footer>
      </PanelContainer>

      {showDialog && (
        <>
          <DialogOverlay onClick={() => setShowDialog(false)} />
          <Dialog>
            <DialogTitle>Modify the text...</DialogTitle>
            <DialogInput
              value={modifier}
              onChange={(e) => setModifier(e.target.value)}
              placeholder="e.g., make it shorter, more formal..."
              autoFocus
              maxLength={MAX_LENGTH}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleModify();
                if (e.key === "Escape") setShowDialog(false);
              }}
            />
            <DialogButtons>
              <Button onClick={() => setShowDialog(false)}>Cancel</Button>
              <PrimaryBtn onClick={handleModify} disabled={!modifier.trim()}>
                Generate
              </PrimaryBtn>
            </DialogButtons>
          </Dialog>
        </>
      )}
    </>
  );
};

export default MagicWritePanel;
