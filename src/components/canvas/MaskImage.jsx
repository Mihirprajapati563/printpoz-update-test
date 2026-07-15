import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

const dynamicShapes = {
    heart: (width, height) => `
    M${width / 2},${height * 0.7}
    L${width * 0.2},${height * 0.4}
    C${width * 0.1},${height * 0.2},${width * 0.4},${height * 0.1},${width / 2},${height * 0.3}
    C${width * 0.6},${height * 0.1},${width * 0.9},${height * 0.2},${width * 0.8},${height * 0.4}
    Z`,
    star: (width, height) => `
    M${width / 2},${height * 0.2}
    L${width * 0.6},${height * 0.4}
    L${width * 0.8},${height * 0.4}
    L${width * 0.65},${height * 0.6}
    L${width * 0.75},${height * 0.8}
    L${width / 2},${height * 0.65}
    L${width * 0.25},${height * 0.8}
    L${width * 0.35},${height * 0.6}
    L${width * 0.2},${height * 0.4}
    L${width * 0.4},${height * 0.4}
    Z`,
    diamond: (width, height) => `
    M${width / 2},${height * 0.1}
    L${width * 0.8},${height / 2}
    L${width / 2},${height * 0.9}
    L${width * 0.2},${height / 2}
    Z`,
    // Add more shapes here
};

const MaskedImage = () => {
    const [selectedShape, setSelectedShape] = useState('heart');
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 200, height: 200 });

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setContainerSize({ width, height });
            }
        };
        window.addEventListener('resize', updateSize);
        updateSize(); // Initial call
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const handleShapeChange = (shape) => {
        setSelectedShape(shape);
    };

    const exportAsImage = () => {
        const svgElement = containerRef.current.querySelector('svg');
        toPng(containerRef.current)
            .then((dataUrl) => {
                saveAs(dataUrl, 'exported-image.png');
            })
            .catch((err) => {
            });
    };

    const currentPath = dynamicShapes[selectedShape](containerSize.width, containerSize.height);

    return (
        <div>
            <div ref={containerRef} style={{ width: '100%', height: '400px', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}>
                    <defs>
                        <clipPath id="dynamicClip">
                            <path d={currentPath} />
                        </clipPath>
                    </defs>
                    <image
                        href="/images/photos/photo_1.webp"
                        width="100%"
                        height="100%"
                        clipPath="url(#dynamicClip)"
                        preserveAspectRatio="none"
                    />
                </svg>
            </div>
            <div style={{ marginTop: '20px' }}>
                <button onClick={() => handleShapeChange('heart')}>Heart</button>
                <button onClick={() => handleShapeChange('star')}>Star</button>
                <button onClick={() => handleShapeChange('diamond')}>Diamond</button>
                <button onClick={exportAsImage}>Export as PNG</button>
                {/* Add more buttons for other shapes */}
            </div>
        </div>
    );
};

export default MaskedImage;
