//create bootstrap loader(spiiner) component

import React from "react";

const ImageLoader = () => {
  return (
    <div
      className="photo-item-loader"
      style={{
        backgroundColor: "rgba(0,0,0,0.1)",
      }}
    >
      <div
        className="spinner-border theme-bg-color-text"
        role="status"
        style={{ width: "2rem", height: "2rem", borderWidth: "0.2em" }}
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export const ImageLoader2 = () => {
  return (
    <div
      className="photo-item-loader"
      style={{
        backgroundColor: "rgba(0,0,0,0.1)",
      }}
    >
      <div
        className="spinner-border theme-bg-color-text"
        role="status"
        style={{ width: "2rem", height: "2rem", borderWidth: "0.2em" }}
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export const PageLoader = () => {
  return (
    <div className="page-loader-spinner">
      <div className="page-loader">
        <div
          className="spinner-border theme-bg-color-text"
          role="status"
          style={{ width: "2rem", height: "2rem", borderWidth: "0.2em" }}
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  );
};

export default ImageLoader;
