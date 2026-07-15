import React from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export const QRCodeDisplay = ({ value = "" }) => {
  return (
    <div className="container mt-5">
      <div className="row">
        <div className="col-12 col-md-8 col-lg-6">
          <QRCodeSVG value={value} size={200} level="H" />
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;
