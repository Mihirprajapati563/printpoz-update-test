import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import styled, { keyframes, css } from "styled-components";

// Small, beautiful, non-intrusive toast fixed at top-right
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ToastWrapper = styled.div`
  position: fixed;
  z-index: 2500; /* Above modals/backdrops (Bootstrap modal is 1050) */
  width: auto;
  min-width: 190px;
  max-width: min(92vw, 320px);
  pointer-events: auto; /* wrapper area is small; allow interactions */
`;

const ToastCard = styled.div`
  pointer-events: auto; /* allow hover/focus inside */
  background: rgba(17, 24, 39, 0.82); /* Glassmorphic dark theme slate-900 */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.2);
  padding: 10px 14px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: ${fadeIn} 180ms ease-out;
  transition: opacity 280ms ease, transform 280ms ease, border-color 200ms ease, box-shadow 200ms ease;
  
  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 12px 35px -5px rgba(0, 0, 0, 0.4), 0 6px 16px -2px rgba(0, 0, 0, 0.25);
  }
  
  ${(p) =>
        p.$closing &&
        css`
      opacity: 0;
      transform: translateY(-6px);
    `}
  cursor: ${(p) => (p.$dragging ? 'grabbing' : 'grab')};
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const RingContainer = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
`;

const RingSVG = styled.svg`
  width: 44px;
  height: 44px;
  transform: rotate(-90deg);
`;

const RingTrack = styled.circle`
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 3.5px;
`;

const RingIndicator = styled.circle`
  fill: none;
  stroke-width: 3.5px;
  stroke-linecap: round;
  stroke-dasharray: 113; /* 2 * PI * 18 */
  stroke-dashoffset: ${(p) => 113 - (113 * Math.max(0, Math.min(100, p.$percent))) / 100};
  transition: stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`;

const RingLabel = styled.span`
  position: absolute;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
`;

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const CountText = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #f3f4f6;
  white-space: nowrap;
`;

const SizeText = styled.span`
  font-size: 0.76rem;
  color: #9ca3af;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

function formatMB(bytes) {
    if (!bytes || bytes <= 0) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useActiveUploadStats() {
    const images = useSelector((state) => state.imageUpload.images);
    // Images belonging to the CURRENT upload session. Once an image joins
    // the session it stays counted until the whole session ends — failed
    // images and images of already-completed batches included. The previous
    // implementation dropped both from the totals mid-run, which made the
    // "X / Y completed" and "MB / MB" figures shrink and jump around
    // (e.g. 0/29 · 598 MB suddenly becoming 0/19 · 392 MB).
    const sessionIdsRef = useRef(new Set());

    return useMemo(() => {
        const sessionIds = sessionIdsRef.current;
        const list = Array.isArray(images) ? images : [];

        const hasActive = list.some(
            (img) => img?.status === "queued" || img?.status === "uploading"
        );

        if (hasActive) {
            // If everything tracked so far is finished (or was removed) and
            // new work appeared, the previous session is over — count fresh.
            const byId = new Map(list.map((img) => [img.imageId, img]));
            let previousSessionDone = sessionIds.size > 0;
            for (const id of sessionIds) {
                const img = byId.get(id);
                if (img && img.status !== "uploaded" && img.status !== "failed") {
                    previousSessionDone = false;
                    break;
                }
            }
            if (previousSessionDone) sessionIds.clear();

            for (const img of list) {
                if (img?.status === "queued" || img?.status === "uploading") {
                    sessionIds.add(img.imageId);
                }
            }
        }
        // When nothing is active we keep the final session numbers so the
        // toast shows them during its fade-out instead of flashing 0/0.

        const sessionImages = list.filter((img) => sessionIds.has(img?.imageId));
        const total = sessionImages.length;
        if (total === 0) {
            return { total: 0, uploaded: 0, failed: 0, percent: 0, inProgress: 0, bytesTransferred: 0, bytesTotal: 0, hasActive };
        }

        const uploaded = sessionImages.filter((img) => img.status === "uploaded").length;
        const failed = sessionImages.filter((img) => img.status === "failed").length;
        const inProgress = sessionImages.filter((img) => img.status === "uploading").length;

        // Compute weighted progress by bytes (more accurate for multi-file
        // uploads). Failed images keep their bytes in the denominator — the
        // total stays stable — but contribute 0 transferred, so the percent
        // honestly reflects that their bytes didn't make it.
        const bytesTotal = sessionImages.reduce((sum, img) => {
            // Use the cached primitive: `file` is released on success, so
            // `file.size` would drop to 0 and shrink the session total.
            const size = img?.fileSize || img?.file?.size;
            return sum + (typeof size === "number" ? size : 0);
        }, 0);

        let percent = 0;
        let bytesTransferred = 0;
        if (bytesTotal > 0) {
            bytesTransferred = sessionImages.reduce((sum, img) => {
                const size = img?.fileSize || img?.file?.size;
                const weight = typeof size === "number" ? size : 0;
                const prog = Number(img?.uploadProgress) || 0;
                return sum + weight * (prog / 100);
            }, 0);
            percent = Math.round((bytesTransferred / bytesTotal) * 100);
        } else {
            // Fallback to simple average if sizes are unavailable
            percent = Math.round(
                sessionImages.reduce((acc, img) => acc + (Number(img.uploadProgress) || 0), 0) / total
            );
        }

        return { total, uploaded, failed, percent, inProgress, bytesTransferred, bytesTotal, hasActive };
    }, [images]);
}

export function UploadProgressToast() {
    const { total, uploaded, failed, percent, inProgress, bytesTransferred, bytesTotal, hasActive } = useActiveUploadStats();
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [position, setPosition] = useState(() => {
        try {
            const storedPosition = localStorage.getItem('uploadToastPosition');
            return storedPosition ? JSON.parse(storedPosition) : null;
        } catch {
            return null;
        }
    });
    const cardRef = useRef(null);
    const closeTimerRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ dx: 0, dy: 0 });

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    function getClientXY(e) {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function handleDragMove(e) {
        if (!isDraggingRef.current || !cardRef.current) return;
        const { x: clientX, y: clientY } = getClientXY(e);
        const rect = cardRef.current.getBoundingClientRect();
        const newX = clientX - dragOffsetRef.current.dx;
        const newY = clientY - dragOffsetRef.current.dy;
        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - rect.height - 8;
        setPosition({ x: clamp(newX, 8, maxX), y: clamp(newY, 8, maxY) });
        if (e.cancelable) e.preventDefault();
    }

    function handleDragStart(e) {
        if (!cardRef.current) return;
        const { x: clientX, y: clientY } = getClientXY(e);
        // Use current position if set; otherwise derive from current rect
        const rect = cardRef.current.getBoundingClientRect();
        const baseX = (position && typeof position.x === 'number') ? position.x : rect.left;
        const baseY = (position && typeof position.y === 'number') ? position.y : rect.top;
        dragOffsetRef.current = { dx: clientX - baseX, dy: clientY - baseY };
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            setPosition({ x: baseX, y: baseY });
        }
        isDraggingRef.current = true;
        setDragging(true);
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        e.preventDefault();
    }

    const handleDragEnd = () => {
        isDraggingRef.current = false;
        setDragging(false);
        try { localStorage.setItem('uploadToastPosition', JSON.stringify(position)); } catch { }
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
    };

    // Safety: remove listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, []);

    useEffect(() => {
        if (!position) return;
        const handleResize = () => {
            if (!cardRef.current) return;
            const rect = cardRef.current.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - 8;
            const maxY = window.innerHeight - rect.height - 8;
            setPosition((pos) => {
                if (!pos) return pos;
                return { x: Math.min(Math.max(pos.x, 8), maxX), y: Math.min(Math.max(pos.y, 8), maxY) };
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [position]);

    // Set a default bottom-left position if none is saved once visible and measurable
    useEffect(() => {
        if (!visible) return;
        if (position && typeof position.x === 'number' && typeof position.y === 'number') return;
        const id = requestAnimationFrame(() => {
            const rect = cardRef.current?.getBoundingClientRect();
            const height = rect?.height ?? 72;
            const y = Math.max(16, window.innerHeight - height - 16);
            setPosition({ x: 16, y });
        });
        return () => cancelAnimationFrame(id);
    }, [visible, position]);

    useEffect(() => {
        // When uploads are active (queued or uploading), show. Visibility is
        // driven by activity — NOT by the session totals, which intentionally
        // stay populated after the run so the fade-out shows final numbers.
        if (hasActive) {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
            setClosing(false);
            setVisible(true);
            return;
        }

        // If no active uploads remain, fade out (if currently visible)
        if (visible) {
            setClosing(true);
            closeTimerRef.current = setTimeout(() => {
                setVisible(false);
                setClosing(false);
                closeTimerRef.current = null;
            }, 700);
        }
    }, [hasActive]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <ToastWrapper aria-live="polite" aria-atomic="true" style={{ left: (position?.x ?? 16), top: (position?.y ?? 16) }}>
            <ToastCard role="status" aria-label={`Uploading photos: ${percent}%`} $closing={closing} ref={cardRef} $dragging={dragging} aria-grabbed={dragging} onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                <Row>
                    <RingContainer aria-hidden="true">
                        <RingSVG>
                            <defs>
                                <linearGradient id="uploadProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#38bdf8" />
                                    <stop offset="100%" stopColor="var(--primary, #4084B5)" />
                                </linearGradient>
                            </defs>
                            <RingTrack cx="22" cy="22" r="18" />
                            <RingIndicator
                                cx="22"
                                cy="22"
                                r="18"
                                $percent={percent}
                                stroke="url(#uploadProgressGrad)"
                            />
                        </RingSVG>
                        <RingLabel>{percent}%</RingLabel>
                    </RingContainer>
                    <TextContainer>
                        <CountText>{uploaded} / {total} completed</CountText>
                        {bytesTotal > 0 && (
                            <SizeText>
                                {formatMB(bytesTransferred)} / {formatMB(bytesTotal)}
                            </SizeText>
                        )}
                        {failed > 0 && (
                            <SizeText style={{ color: "#6b6b6b" }}>
                                {failed} failed
                            </SizeText>
                        )}
                    </TextContainer>
                </Row>
            </ToastCard>
        </ToastWrapper>
    );
}

export default UploadProgressToast;
