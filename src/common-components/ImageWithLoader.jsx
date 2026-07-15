import React, { useState } from "react";
import { Spinner } from "react-bootstrap";

function ImageWithLoader({ src, alt, ...props }) {
  const [isLoading, setLoading] = useState(true);
  return (
    <div className="d-flex justify-content-center align-item-center">
      {isLoading && (
        <div
          style={{ margin: "auto", top: "25%" }}
          className="position-absolute"
        >
          <div
            className="spinner-border theme-bg-color-text"
            role="status"
          ></div>
        </div>
      )}
      <img {...props} src={src} className="object-fit-contain" alt={alt} onLoad={() => setLoading(false)} />
    </div>
  );
}

export default ImageWithLoader;
