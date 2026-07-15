import React, { useState } from "react";
import useExportPages from "../../library/utils/custom-hooks/useExportPages";

const ExportPage = ({ pageIndex, svgContent, metadata }) => {
  const { uploading, error, response, exportPageSVG } = useExportPages();
  const [svgData, setSvgData] = useState(svgContent); // The initial SVG content for the page

  const handleExport = () => {
    // Call the function to export page content with optional metadata
    exportPageSVG(svgData, pageIndex, metadata);
  };

  return (
    <div>
      <h2>Export Page {pageIndex + 1}</h2>
      <svg dangerouslySetInnerHTML={{ __html: svgData }} />
      <button onClick={handleExport} disabled={uploading}>
        {uploading ? "Exporting..." : "Export Page"}
      </button>
      {error && <p>Error: {error}</p>}
      {response && <p>Export successful: {JSON.stringify(response)}</p>}
    </div>
  );
};

export default ExportPage;
