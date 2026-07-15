import React, { createContext, useContext, useState } from "react";

const PdfExportContext = createContext();

export const PdfExportProvider = ({ children }) => {
  const [exportProgress, setExportProgress] = useState({
    showProgress: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    status: "",
  });

  const updateProgress = (data) => {
    setExportProgress((prev) => ({ ...prev, ...data }));
  };

  const resetProgress = () => {
    setExportProgress({
      showProgress: false,
      progress: 0,
      currentPage: 0,
      totalPages: 0,
      status: "",
    });
  };

  return (
    <PdfExportContext.Provider
      value={{ exportProgress, updateProgress, resetProgress }}
    >
      {children}
    </PdfExportContext.Provider>
  );
};

export const usePdfExport = () => useContext(PdfExportContext);
