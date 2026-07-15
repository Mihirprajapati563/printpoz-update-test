import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { QRCodeSVG } from "qrcode.react";
import styled from "styled-components";
import { IoAdd, IoPencil, IoQrCodeOutline, IoCheckmark, IoCloseOutline } from "react-icons/io5";
import {
  addObjectInPage,
  updateObjectById,
  deSelectActiveObject,
} from "../../store/slices/canvas.js";
import {
  getActiveObjectprops,
  getCanvasSize,
} from "../../library/utils/helpers/canvasSliceGetters.js";
import { validateUrl, extractQRSvgPaths, fetchUrlMetadata } from "./QRCodeUtils.js";
import {
  setActiveActionIndex,
  setIsActionActive,
} from "../../store/slices/appAlice.js";
import {
  ActionTitle,
  DisplayBetween,
} from "../../common-components/StyledComponents.jsx";
import { LiaTimesSolid } from "react-icons/lia";

const Section = styled.div`
  margin-top: 12px;
  padding-top: 8px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary, #4084B5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--secondary, #EFF8FF);
  border-left: 3px solid var(--primary, #4084B5);
  border-radius: 0 4px 4px 0;
  overflow: hidden;
  box-sizing: border-box;
  white-space: nowrap;
`;

const QRWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 8px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 11px;
  font-weight: 600;
  color: #495057;
`;

const UrlInput = styled.input`
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 1px solid ${({ $hasError }) => ($hasError ? "#111111" : "#e5e7eb")};
  border-radius: 6px;
  font-size: 11px;
  color: #374151;
  background: #f9fafb;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;

  &:focus {
    border-color: ${({ $hasError }) => ($hasError ? "#111111" : "var(--primary, #4084B5)")};
    box-shadow: ${({ $hasError }) =>
      $hasError ? "0 0 0 2px rgba(231, 76, 60, 0.1)" : "0 0 0 2px rgba(64, 132, 181, 0.1)"};
    background: #fff;
  }
`;

const ErrorText = styled.p`
  color: #111111;
  font-size: 10px;
  margin: 0;
  line-height: 1.4;
`;

const AddButton = styled.button`
  width: 100%;
  height: 30px;
  background: var(--primary, #4084B5);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover:not(:disabled) {
    background: #000000;
  }
  &:active:not(:disabled) {
    transform: scale(0.98);
  }
  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
`;

const UpdateButton = styled(AddButton)`
  flex: 1;
`;

const CancelButton = styled.button`
  height: 30px;
  padding: 0 12px;
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #e9ecef;
    color: #212529;
  }
  &:active {
    transform: scale(0.98);
  }
`;

const PreviewCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
`;

const PreviewQR = styled.div`
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid #dee2e6;
  border-radius: 5px;
  overflow: hidden;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PreviewSiteImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const PreviewFavicon = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
`;

const PreviewMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PreviewTitle = styled.p`
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PreviewUrl = styled.a`
  font-size: 10px;
  color: #6b7280;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
  cursor: pointer;
  display: block;
  max-width: 100%;

  &:hover {
    text-decoration: underline;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
  margin: 6px 0;
`;

const QrListTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  padding: 6px 0;
`;

const QrList = styled.div`
  max-height: 240px;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 2px;
  }
`;

const QrListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 4px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid #f0f0f0;
  min-height: 32px;
  min-width: 0;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  background: ${(props) => (props.$isActive ? "var(--secondary, #EFF8FF)" : "transparent")};

  &:hover {
    background: ${(props) => (props.$isActive ? "var(--secondary, #EFF8FF)" : "#f8f9fa")};
  }
`;

const QrListThumb = styled.div`
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 6px;
`;

const QrListMeta = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const QrListUrl = styled.span`
  font-size: 10px;
  color: ${(props) => (props.$isActive ? "var(--primary, #4084B5)" : "#374151")};
  font-weight: ${(props) => (props.$isActive ? "600" : "400")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 100%;
`;

const EditIconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: #e5e7eb;
    color: #4b5563;
  }
`;

const CheckIcon = styled.span`
  color: var(--primary, #4084B5);
  font-size: 13px;
  margin-left: 6px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
`;

let debounceTimer = null;

export function QRCodeAction() {
  const dispatch = useDispatch();
  const canvasSize = useSelector(getCanvasSize);
  const activeObjectProps = useSelector(getActiveObjectprops);
  const allPages = useSelector((state) => state.canvas.present.pages);
  const activePageIndex = useSelector((state) => state.canvas.present.activePageIndex);

  // ── URL state ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [editingQrId, setEditingQrId] = useState(null);
  const [urlMetadata, setUrlMetadata] = useState(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [normalizedUrl, setNormalizedUrl] = useState("");

  const allProjectQrObjects = useMemo(() => {
    const objs = [];
    allPages.forEach((page) => {
      (page.layout || []).forEach((layout) => {
        [...(layout?.objects || []), ...(layout?.safeAreaObjects || [])].forEach((obj) => {
          if (obj.type === "qrcode") objs.push(obj);
        });
      });
    });
    return objs;
  }, [allPages]);

  const allProjectQrUrls = useMemo(() => {
    const urlMap = new Map();
    allPages.forEach((page, pageIndex) => {
      (page.layout || []).forEach((layout) => {
        [...(layout?.objects || []), ...(layout?.safeAreaObjects || [])].forEach((obj) => {
          if (obj.type !== "qrcode" || !obj.qrUrl) return;
          if (!urlMap.has(obj.qrUrl)) {
            urlMap.set(obj.qrUrl, {
              url: obj.qrUrl,
              pageIndices: new Set(),
              pageCount: 0,
              currentPageObj: null,
              representativeObj: obj,
            });
          }
          const entry = urlMap.get(obj.qrUrl);
          entry.pageIndices.add(pageIndex);
          entry.pageCount = entry.pageIndices.size;
          if (pageIndex === activePageIndex && !entry.currentPageObj) {
            entry.currentPageObj = obj;
          }
        });
      });
    });
    return Array.from(urlMap.values());
  }, [allPages, activePageIndex]);

  const currentPageHasQr = allProjectQrUrls.some((e) => e.currentPageObj !== null);

  const editingQrIdRef = useRef(editingQrId);
  useEffect(() => { editingQrIdRef.current = editingQrId; }, [editingQrId]);

  useEffect(() => {
    if (!editingQrId) return;
    const stillExists = allProjectQrObjects.some((obj) => obj.id === editingQrId);
    if (!stillExists) {
      handleCancelEdit();
    }
  }, [allProjectQrObjects, editingQrId]);

  useEffect(() => {
    if (activeObjectProps?.type === "qrcode" && activeObjectProps.id) {
      if (editingQrIdRef.current !== activeObjectProps.id) {
        handleEditExisting(activeObjectProps);
      }
    } else {
      handleCancelEdit();
    }
  }, [activeObjectProps?.id, activeObjectProps?.type]);

  const handleUrlChange = useCallback((e) => {
    const value = e.target.value;
    setUrl(value);
    setUrlMetadata(null);
    setNormalizedUrl("");
    clearTimeout(debounceTimer);

    if (!value.trim()) {
      setValidationError("");
      setIsValid(false);
      setPreviewGenerated(false);
      return;
    }

    const { isValid: valid, error, normalizedUrl: norm } = validateUrl(value);
    setValidationError(error);
    setIsValid(valid);

    if (valid) {
      setNormalizedUrl(norm);
      setPreviewGenerated(true);
      debounceTimer = setTimeout(() => {
        setIsFetchingMeta(true);
        fetchUrlMetadata(norm).then((meta) => {
          setUrlMetadata(meta);
          setIsFetchingMeta(false);
        });
      }, 300);
    } else {
      setPreviewGenerated(false);
    }
  }, []);

  const handleAddQRCode = useCallback(() => {
    const { isValid: valid, error, normalizedUrl: norm } = validateUrl(url);
    if (!valid) {
      setValidationError(error || "Please enter a valid URL.");
      return;
    }

    const qrSize = Math.min(canvasSize?.width || 400, canvasSize?.height || 400) / 4;
    const svgPaths = extractQRSvgPaths(norm, Math.round(qrSize), "#000000", "#FFFFFF", "H");

    dispatch(
      addObjectInPage({
        type: "qrcode",
        url: norm,
        qrSvgPaths: svgPaths,
        qrLevel: "H",
        x: 30,
        y: 30,
      })
    );

    setUrl("");
    setIsValid(false);
    setValidationError("");
    setPreviewGenerated(false);
    setEditingQrId(null);
  }, [url, dispatch, canvasSize]);

  const handleUpdateQRCode = useCallback((qrId) => {
    const { isValid: valid, error, normalizedUrl: norm } = validateUrl(url);
    if (!valid) {
      setValidationError(error || "Please enter a valid URL.");
      return;
    }

    const qrSize = Math.min(canvasSize?.width || 400, canvasSize?.height || 400) / 4;
    const svgPaths = extractQRSvgPaths(norm, Math.round(qrSize), "#000000", "#FFFFFF", "H");

    dispatch(
      updateObjectById({
        id: qrId,
        qrUrl: norm,
        qrSvgPaths: svgPaths,
      })
    );

    setUrl("");
    setIsValid(false);
    setValidationError("");
    setPreviewGenerated(false);
    setEditingQrId(null);
  }, [url, dispatch, canvasSize]);

  const handleEditExisting = useCallback((qrObj) => {
    setUrl(qrObj.qrUrl || "");
    setEditingQrId(qrObj.id);
    const { isValid: valid, error, normalizedUrl: norm } = validateUrl(qrObj.qrUrl || "");
    setIsValid(valid);
    setNormalizedUrl(norm || "");
    setValidationError(valid ? "" : error);
    setPreviewGenerated(valid);
    setUrlMetadata(qrObj.metadata || null);
    if (valid && !qrObj.metadata) {
      setIsFetchingMeta(true);
      fetchUrlMetadata(qrObj.qrUrl.trim()).then((meta) => {
        setUrlMetadata(meta);
        setIsFetchingMeta(false);
      });
    }
  }, []);

  const handleProjectQrClick = useCallback((entry) => {
    if (entry.currentPageObj) {
      handleEditExisting(entry.currentPageObj);
    } else {
      setUrl(entry.url);
      setEditingQrId(null);
      setUrlMetadata(null);
      const { isValid: valid, error, normalizedUrl: norm } = validateUrl(entry.url);
      setIsValid(valid);
      setNormalizedUrl(norm || "");
      setValidationError(valid ? "" : error);
      setPreviewGenerated(valid);
      if (valid) {
        setIsFetchingMeta(true);
        fetchUrlMetadata(entry.url).then((meta) => {
          setUrlMetadata(meta);
          setIsFetchingMeta(false);
        });
      }
    }
  }, [handleEditExisting]);

  const handleCancelEdit = useCallback((deselect = false) => {
    setUrl("");
    setIsValid(false);
    setValidationError("");
    setPreviewGenerated(false);
    setEditingQrId(null);
    setUrlMetadata(null);
    setIsFetchingMeta(false);
    setNormalizedUrl("");
    if (deselect) {
      dispatch(deSelectActiveObject());
    }
  }, [dispatch]);

  return (
    <Section>
      <DisplayBetween
        className="heading-action-mob"
        style={{
          flexShrink: 0,
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '8px',
          marginBottom: '12px'
        }}
      >
        <ActionTitle>QR Code</ActionTitle>
        <LiaTimesSolid
          onClick={() => {
            dispatch(setIsActionActive(false));
            dispatch(setActiveActionIndex(null));
          }}
          className="cursor-pointer"
          size={20}
        />
      </DisplayBetween>

      <QRWrapper>
        <InputGroup>
          <Label htmlFor="qr-url-input">
            {editingQrId ? "Edit" : "Enter a valid URL and click the ‘add’ button."}
          </Label>
          <UrlInput
            id="qr-url-input"
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={handleUrlChange}
            $hasError={!!validationError}
            autoComplete="off"
          />
          {validationError && <ErrorText>{validationError}</ErrorText>}
        </InputGroup>

        {previewGenerated && isValid && url && (
          <PreviewCard>
            <PreviewQR>
              {isFetchingMeta ? (
                <IoQrCodeOutline size={24} color="#ccc" />
              ) : urlMetadata?.image ? (
                <PreviewSiteImage
                  src={urlMetadata.image}
                  alt="site preview"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : urlMetadata?.favicon ? (
                <PreviewFavicon
                  src={urlMetadata.favicon}
                  alt="favicon"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <IoQrCodeOutline size={24} color="#aaa" />
              )}
            </PreviewQR>
            <PreviewMeta>
              <PreviewTitle title={urlMetadata?.title || normalizedUrl || url}>
                {isFetchingMeta ? "Loading..." : urlMetadata?.title || normalizedUrl || url}
              </PreviewTitle>
              <PreviewUrl href={normalizedUrl || url} target="_blank" rel="noopener noreferrer" title={normalizedUrl || url}>
                {normalizedUrl || url}
              </PreviewUrl>
            </PreviewMeta>
          </PreviewCard>
        )}

        {editingQrId ? (
          <ButtonRow>
            <UpdateButton
              onClick={() => handleUpdateQRCode(editingQrId)}
              disabled={!isValid}
            >
              Update
            </UpdateButton>
            <CancelButton onClick={() => handleCancelEdit(true)}>
              <IoCloseOutline size={16} />
            </CancelButton>
          </ButtonRow>
        ) : (
          <AddButton onClick={handleAddQRCode} disabled={!isValid}>
            <IoAdd size={14} />
            {currentPageHasQr ? "Add Another QR Code" : "Add QR Code"}
          </AddButton>
        )}

        {allProjectQrUrls.length > 0 && (
          <>
            <Divider />
            <QrListTitle>
              <IoQrCodeOutline size={11} />
              Used in Project
            </QrListTitle>
            <QrList>
              {allProjectQrUrls.map((entry) => {
                const isActive =
                  (editingQrId && editingQrId === entry.currentPageObj?.id) ||
                  (activeObjectProps?.id && activeObjectProps.id === entry.currentPageObj?.id) ||
                  (!editingQrId && url === entry.url);

                return (
                  <QrListItem
                    key={entry.url}
                    $isActive={isActive}
                    onClick={() => handleProjectQrClick(entry)}
                    title={entry.currentPageObj ? "Click to edit on this page" : "Click to pre-fill URL"}
                  >
                    <QrListThumb>
                      <QRCodeSVG
                        value={entry.url}
                        size={18}
                        level="H"
                        fgColor="#000000"
                        bgColor="#FFFFFF"
                      />
                    </QrListThumb>
                    <QrListMeta>
                      <QrListUrl title={entry.url} $isActive={isActive}>
                        {entry.url}
                      </QrListUrl>
                    </QrListMeta>
                    {isActive ? (
                      <CheckIcon><IoCheckmark /></CheckIcon>
                    ) : (
                      <EditIconBtn
                        onClick={(e) => { e.stopPropagation(); handleProjectQrClick(entry); }}
                        title={entry.currentPageObj ? "Edit" : "Use this URL"}
                      >
                        <IoPencil size={12} />
                      </EditIconBtn>
                    )}
                  </QrListItem>
                );
              })}
            </QrList>
          </>
        )}
      </QRWrapper>
    </Section>
  );
}

export default QRCodeAction;
