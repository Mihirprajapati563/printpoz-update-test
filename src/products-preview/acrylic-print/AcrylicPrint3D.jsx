import React, { useEffect, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Loader } from "@react-three/drei";
import { ReactComponent as ZoomIn } from "../../assets/icons/zoom-in.svg";
import { ReactComponent as ZoomOut } from "../../assets/icons/zoom-out.svg";
import { WallAcrylic } from "./three/WallAcrylic.jsx";
import { useSelector } from "react-redux";
import { TableAcrylic } from "./three/TableAcrylic.jsx";
import { EDITOR_SUB_TYPES } from "../../library/utils/constants/index.js";
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
export const AcralicPrint3D = ({ show, handleClose, subtype }) => {
  const [image, setImage] = useState(
    "https://png.pngtree.com/png-vector/20220705/ourmid/pngtree-loading-icon-vector-transparent-png-image_5687537.png"
  );
  const [frameSize, setFrameSize] = useState({ width: 12, height: 12 });
  const [scale, setScale] = useState(2);
  const currentPageSVG = useSelector((state) => state.svgData.currentPageSVG);
  const canvasSize = useSelector(getCanvasSize);
  const bleedMargin = canvasSize?.bleedMargin || 0;
  const zoomRatio = useSelector((state) => state.canvas.zoom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentPageSVG) {
      downloadImage();
    }
  }, [currentPageSVG, bleedMargin, zoomRatio, canvasSize]);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      setScale(width < 768 ? 1.2 : width < 1024 ? 1.4 : 2);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

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
      backdrop="static"
      fullscreen
    >
      <PhotoModalHeader closeButton>
        <FlexBox grow={1} className="justify-content-center">
          <BodyText fontsize="20px" fontweight="600" textcolor="var(--primary)">
            3D Preview
          </BodyText>
        </FlexBox>
        <Box className="icon-18 bg-transparent">
          <ZoomButtonBox backgroundColor="transparent">
            <ZoomIn onClick={() => setScaleIn()} className="cursor-pointer" />
            {/* <BodyText className='ms-3 me-4 zoom-value-mob'>-</BodyText> */}
            <ZoomOut onClick={() => setScaleOut()} className="cursor-pointer" />
          </ZoomButtonBox>
        </Box>
      </PhotoModalHeader>
      {/* <PhotoModalBody className='h-100'> */}
      <Box className="h-100 w-100">
        <div className="w-100 h-100 d-flex flex-column gap-3">
          <div className="w-100 h-100">
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
                  shadows
                  dpr={[1, 2]}
                  camera={{ position: [0, 0.0, 4.5], fov: 55 }}
                  style={{ width: "100%", height: "100%" }}
                >
                  {frameSize && subtype === EDITOR_SUB_TYPES.ACRYLIC.WALL && (
                    <OrbitControls
                      minAzimuthAngle={-Math.PI / 2 + 0.1}
                      maxAzimuthAngle={Math.PI / 2 - 0.1}
                      minPolarAngle={0.9}
                      maxPolarAngle={Math.PI - 1.5}
                    />
                  )}
                  {frameSize && subtype === EDITOR_SUB_TYPES.ACRYLIC.TABLE && (
                    <OrbitControls />
                  )}

                  <directionalLight
                    position={[5, 5, 5]}
                    intensity={1}
                    shadow-mapSize={1024}
                    castShadow
                  />
                  <directionalLight
                    position={[-5, 5, 5]}
                    intensity={0.1}
                    shadow-mapSize={128}
                    castShadow
                  />
                  <directionalLight
                    position={[-5, 5, -5]}
                    intensity={0.1}
                    shadow-mapSize={128}
                    castShadow
                  />

                  <Suspense fallback={null}>
                    {frameSize && subtype === EDITOR_SUB_TYPES.ACRYLIC.WALL && (
                      <WallAcrylic
                        image={image}
                        scale={scale}
                        frameSize={frameSize}
                      />
                    )}
                    {frameSize &&
                      subtype === EDITOR_SUB_TYPES.ACRYLIC.TABLE && (
                        <TableAcrylic
                          image={image}
                          scale={scale}
                          frameSize={frameSize}
                        />
                      )}
                  </Suspense>
                </Canvas>
              </Suspense>
            )}
          </div>
        </div>
      </Box>

      {/* </PhotoModalBody> */}
    </PhotoModalStyled>
  );
};
