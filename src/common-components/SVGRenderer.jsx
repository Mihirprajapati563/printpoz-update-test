import { useState, useEffect } from "react";
import { resolveImageUrl, cacheImageUrl } from "../library/utils/helpers/imageCache.js";
import { isOnline } from "../library/utils/helpers/assetsCache.js";

/**
 * SVGRenderer - A component that handles SVG files served with incorrect Content-Type headers.
 * It fetches the SVG content and renders it inline.
 * 
 * @param {string} src - The URL of the SVG file
 * @param {string} alt - Alt text for fallback/loading states
 * @param {string} className - CSS class name(s) to apply
 * @param {object} style - Inline styles to apply
 * @param {function} onClick - Click handler
 * @param {boolean} constrainSize - Whether to constrain SVG to container size (default: true)
 * @param {string} renderAs - 'div' for HTML context, 'foreignObject' for SVG context (default: 'div')
 * @param {number} width - Width for foreignObject rendering
 * @param {number} height - Height for foreignObject rendering
 * @param {string} dataId - Data ID attribute for canvas elements
 * @param {function} onLoadStateChange - Optional callback(isLoading) fired when the
 *        inline-SVG fetch toggles loading state. Lets a parent show a loading
 *        skeleton until the SVG is ready. No-op for non-SVG sources.
 */
const SVGRenderer = ({
    src,
    alt = "SVG Image",
    className,
    style = {},
    onClick,
    constrainSize = true,
    renderAs = 'div',
    width,
    height,
    dataId,
    onLoadStateChange
}) => {
    const [svgContent, setSvgContent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Treat data: URLs that carry SVG content as SVG (endsWith('.svg') won't match them)
    const isSvg = src?.toLowerCase().endsWith('.svg') ||
        src?.startsWith('data:image/svg');

    // Notify the parent whenever the loading state flips (used to drive a loading
    // skeleton). Runs after render so it never triggers a setState-during-render.
    useEffect(() => {
        onLoadStateChange?.(isLoading);
    }, [isLoading, onLoadStateChange]);

    useEffect(() => {
        if (isSvg && src) {
            setIsLoading(true);
            setError(null);

            let cancelled = false;

            // Resolve via local image cache (serves offline; caches when online)
            resolveImageUrl(src).then((resolvedSrc) => {
                if (cancelled) return;

                // data: URL — decode inline instead of re-fetching (fetch().text() returns
                // raw base64, not decoded SVG markup, which breaks offline rendering).
                if (resolvedSrc.startsWith("data:")) {
                    const comma = resolvedSrc.indexOf(",");
                    if (comma === -1) throw new Error("Invalid data URL");
                    const meta = resolvedSrc.slice(5, comma); // e.g. "image/svg+xml;base64"
                    const payload = resolvedSrc.slice(comma + 1);
                    if (meta.includes("base64")) {
                        return atob(payload);
                    }
                    return decodeURIComponent(payload);
                }

                return fetch(resolvedSrc)
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                        return res.text();
                    });
            }).then(text => {
                if (cancelled || text === undefined) return;
                // Also trigger a background cache for the original remote src
                if (isOnline()) cacheImageUrl(src);

                let modifiedSvg = text;

                // Remove XML declaration
                modifiedSvg = modifiedSvg.replace(/<\?xml[^?]*\?>/gi, '').trim();

                // For canvas rendering (foreignObject), we need the SVG to fill its container
                // This makes SVG behave the same as PNG images
                if (renderAs === 'foreignObject') {
                    modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/i, (match, attrs) => {
                        // Extract existing viewBox if present
                        const viewBoxMatch = attrs.match(/viewBox\s*=\s*["']([^"']*)["']/i);
                        let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

                        // If no viewBox, try to create one from width/height attributes
                        if (!viewBox) {
                            const widthMatch = attrs.match(/width\s*=\s*["']?(\d+(?:\.\d+)?)/i);
                            const heightMatch = attrs.match(/height\s*=\s*["']?(\d+(?:\.\d+)?)/i);
                            if (widthMatch && heightMatch) {
                                viewBox = `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
                            }
                        }

                        // Remove existing width/height and add our own that fills the container
                        let newAttrs = attrs
                            .replace(/\s*width\s*=\s*["'][^"']*["']/gi, '')
                            .replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');

                        // Add viewBox if we have one, and set width/height to 100%
                        const viewBoxAttr = viewBox && !viewBoxMatch ? ` viewBox="${viewBox}"` : '';
                        return `<svg${newAttrs}${viewBoxAttr} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
                    });
                } else if (constrainSize) {
                    // For sidebar/HTML context, constrain to container
                    modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/i, (match, attrs) => {
                        let newAttrs = attrs
                            .replace(/\s*width\s*=\s*["'][^"']*["']/gi, '')
                            .replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');
                        return `<svg${newAttrs} style="width:100%;height:100%;max-width:100%;max-height:100%;">`;
                    });
                }

                setSvgContent(modifiedSvg);
                setIsLoading(false);
            }).catch(err => {
                if (cancelled) return;
                setError(err.message);
                setIsLoading(false);
            });

            return () => { cancelled = true; };
        } else {
            setIsLoading(false);
        }
    }, [src, isSvg, constrainSize, renderAs]);

    // For non-SVG files, return null (caller should handle this case)
    if (!isSvg) {
        return null;
    }

    // Loading state
    if (isLoading) {
        if (renderAs === 'foreignObject') {
            return (
                <text
                    x={width ? width / 2 : 50}
                    y={height ? height / 2 : 50}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#999"
                >
                    Loading...
                </text>
            );
        }
        return (
            <div
                className={className}
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                Loading...
            </div>
        );
    }

    // Error state
    if (error || !svgContent) {
        if (renderAs === 'foreignObject') {
            return (
                <text
                    x={width ? width / 2 : 50}
                    y={height ? height / 2 : 50}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#f00"
                >
                    Failed to load
                </text>
            );
        }
        return (
            <div className={className} style={style}>
                Failed to load
            </div>
        );
    }

    // Render as foreignObject for SVG canvas context
    if (renderAs === 'foreignObject') {
        return (
            <foreignObject
                width={width}
                height={height}
                data-id={dataId}
                className={className}
                style={style}
            >
                <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                />
            </foreignObject>
        );
    }

    // Render as div for HTML context
    return (
        <div
            className={className}
            style={{
                ...style,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
};

/**
 * Check if a URL is an SVG file
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export const isSvgUrl = (url) => {
    return url?.toLowerCase().endsWith('.svg');
};

export default SVGRenderer;
