import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLiveResize } from "../../components/canvas/liveResizeStore";

function generateRoundedRectPath(width, height, radius) {
  const effectiveRadius = Math.min(radius, width / 2, height / 2);
  const path = `
    M${effectiveRadius},0
    H${width - effectiveRadius}
    A${effectiveRadius},${effectiveRadius} 0 0 1 ${width},${effectiveRadius}
    V${height - effectiveRadius}
    A${effectiveRadius},${effectiveRadius} 0 0 1 ${width - effectiveRadius},${height}
    H${effectiveRadius}
    A${effectiveRadius},${effectiveRadius} 0 0 1 0,${height - effectiveRadius}
    V${effectiveRadius}
    A${effectiveRadius},${effectiveRadius} 0 0 1 ${effectiveRadius},0
    Z
  `;
  return path.trim();
}

function QRCode({ item: rawItem }) {
  // Live-resize override: mirrors the canvas QR resize into the footer thumbnail.
  const liveResize = useLiveResize(rawItem.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const { width, height, opacity, border, qrUrl, qrLevel, qrFgColor, qrBgColor } = item;
  const size = Math.min(width || 200, height || 200);
  const r = (width * (border?.radius || 0)) / 24;
  const clipId = `prev_clip-qrcode-${item.id}`;
  const roundedPath = generateRoundedRectPath(width, height, r);

  return (
    <g
      filter={`url(#prev_shadow_qrcode_item_${item.id})`}
      className="qrcode-item-svg"
    >
      <BoxShadowItem item={item} />

      <defs>
        <clipPath id={clipId}>
          <path d={roundedPath} fill="transparent" />
        </clipPath>
      </defs>

      <g
        className="page-item--positioning-container"
        style={{ opacity: opacity ?? 1 }}
      >
        <g clipPath={`url(#${clipId})`}>
          {qrUrl ? (
            <foreignObject x={0} y={0} width={width} height={height}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  width: width,
                  height: height,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: qrBgColor || "#FFFFFF",
                }}
              >
                <QRCodeSVG
                  value={qrUrl}
                  size={size}
                  level={qrLevel || "H"}
                  fgColor={qrFgColor || "#000000"}
                  bgColor={qrBgColor || "#FFFFFF"}
                  style={{ display: "block", width: "100%", height: "100%" }}
                />
              </div>
            </foreignObject>
          ) : (
            <g>
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#f5f5f5"
                stroke="#cccccc"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(10, size * 0.08)}
                fill="#999999"
              >
                QR Code
              </text>
            </g>
          )}
        </g>
      </g>

      <path
        data-id={item.id}
        className="page_qrcode_item"
        d={roundedPath}
        fill="transparent"
        stroke={border?.color || "none"}
        strokeWidth={border?.width || 0}
      />
    </g>
  );
}

export default QRCode;

const BoxShadowItem = ({ item }) => {
  const offsetX = item?.shadow?.offset?.x || 0;
  const offsetY = item?.shadow?.offset?.y || 0;
  const blurRadius = item?.shadow?.blur || 0;
  return (
    <defs>
      <filter
        id={`prev_shadow_qrcode_item_${item.id}`}
        width="2"
        height="2"
        x="-0.5"
        y="-0.5"
      >
        <feDropShadow
          stdDeviation={blurRadius}
          dx={offsetX}
          dy={offsetY}
          floodColor={item?.shadow?.color || "#000000AD"}
        />
      </filter>
    </defs>
  );
};
