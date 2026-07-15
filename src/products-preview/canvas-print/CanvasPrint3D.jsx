import React, { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { ReactComponent as ZoomIn } from "../../assets/icons/zoom-in.svg";
import { ReactComponent as ZoomOut } from "../../assets/icons/zoom-out.svg";
import { Frame } from "./three/Frame";
import { Frame2 } from "./three/Frame2";
import { useSelector } from "react-redux";
import {
  BodyText,
  Box,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  FlexBox,
  ZoomButtonBox,
  CommonLoaderContainer,
  CommonLoader,
} from "../../common-components/StyledComponents.jsx";
import { getCanvasSize } from "../../library/utils/helpers";
import { getTrimmedPreviewTexture } from "../shared/getTrimmedPreviewTexture.js";
const CanvasPrint3DMemo = ({ show, handleClose, depth }) => {
  const [image, setImage] = useState(
    "https://png.pngtree.com/png-vector/20220705/ourmid/pngtree-loading-icon-vector-transparent-png-image_5687537.png"
  );
  const [frameSize, setFrameSize] = useState({ width: 12, height: 12 });
  const [thickness, setThickness] = useState('1.0"');
  const [scale, setScale] = useState(2);
  const currentPageSVG = useSelector((state) => state.svgData.currentPageSVG);
  const [loading, setLoading] = useState(true);
  const [loadFrame, setLoadFrame] = useState(false);
  const canvasSize = useSelector(getCanvasSize);
  const bleedMargin = canvasSize?.bleedMargin || 0;
  const zoomRatio = useSelector((state) => state.canvas.zoom);

  useEffect(() => {
    if (currentPageSVG) {
      downloadImage();
    }
  }, [currentPageSVG, bleedMargin, zoomRatio, canvasSize]);

  const setScaleIn = () => {
    // increase scale
    // check if scale is less than 2 then increase
    if (scale < 5) setScale(scale + 0.5);
  };
  const setScaleOut = () => {
    // decrease scale
    // check if scale is greater than 0.5 then decrease
    if (scale > 0.5) setScale(scale - 0.5);
  };

  const downloadImage = async () => {
    try {
      setLoading(true);
      const { dataUrl, trimWidth, trimHeight } = await getTrimmedPreviewTexture({
        currentPageSVG,
        canvasSize,
        bleedMargin,
        zoomRatio,
      });

      setFrameSize({
        width: trimWidth,
        height: trimHeight,
      });
      setImage(dataUrl);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (!currentPageSVG) {
    handleClose();
    return null;
  }
  return (
    <PhotoModalStyled
      show={show}
      onHide={handleClose}
      fullscreen
      backdrop="static"
    >
      <PhotoModalHeader closeButton>
        <FlexBox grow={1} className="justify-content-center">
          <BodyText fontsize="20px" fontweight="600" textcolor="var(--primary)">
            3D Preview
          </BodyText>
        </FlexBox>
        {/* <Box className="icon-18 bg-transparent">
          <ZoomButtonBox backgroundColor="transparent">
            <ZoomIn onClick={() => setScaleIn()} className="cursor-pointer" />
            <ZoomOut onClick={() => setScaleOut()} className="cursor-pointer" />
          </ZoomButtonBox>
        </Box> */}
      </PhotoModalHeader>
      <PhotoModalBody>
        <Box className="modal-body-main-content">
          <div className="w-100 h-100 d-flex flex-column gap-3">
            <div className="canvas-preview h-100 d-flex justify-content-center align-items-center">
              {loading ? (
                <CommonLoaderContainer text={"Preparing 3D Preview"}>
                  <CommonLoader />
                </CommonLoaderContainer>
              ) : (
                <Suspense
                  fallback={
                    <CommonLoaderContainer text={"Preparing 3D Preview"}>
                      <CommonLoader />
                    </CommonLoaderContainer>
                  }
                >
                  <Canvas
                    dpr={[1, 2]}
                    camera={{ fov: 55, position: [0, 0, 6] }}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <Environment files="/3d/gainmap.jpg" />
                    <ambientLight intensity={1.5} />
                    <OrbitControls />
                    {frameSize && (
                      <Frame2
                        image={image}
                        depth={depth}
                        frameSize={`${frameSize.height - depth * 2}
                        x${frameSize.width - depth * 2}`}
                      />
                    )}
                  </Canvas>
                </Suspense>
              )}
            </div>
          </div>
        </Box>
      </PhotoModalBody>
    </PhotoModalStyled>
  );
};

const CanvasPrint3D = React.memo(CanvasPrint3DMemo);
export { CanvasPrint3D };
