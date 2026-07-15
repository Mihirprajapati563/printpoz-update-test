import { Canvas } from "@react-three/fiber";
import React, { useEffect, useState, Suspense } from "react";
import { Environment, Loader, OrbitControls } from "@react-three/drei";
import { MountainCalendar } from "./MountainCalendar.jsx";
import { WoodenCalender } from "./WoodenCalender.jsx";
import { ReactComponent as ZoomIn } from "../../assets/icons/zoom-in.svg";
import { ReactComponent as ZoomOut } from "../../assets/icons/zoom-out.svg";
import { useSelector } from "react-redux";
import { EDITOR_SUB_TYPES } from "../../library/utils/constants/index.js";
import { getCanvasSize } from "../../library/utils/helpers";
import { getTrimmedPreviewTexture } from "../shared/getTrimmedPreviewTexture.js";
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
import BlankWhitePage from "../../assets/images/blankWhitePage.png";
export const Calendar3D = ({ show, handleClose, cal_settings, zoomRatio }) => {
  const [image, setImage] = useState("../../assets/images/blankWhitePage.png");
  const [frameSize, setFrameSize] = useState({ width: 12, height: 12 });
  const [scale, setScale] = useState(1);
  const currentPageSVG = useSelector((state) => state.svgData.currentPageSVG);
  const canvasSize = useSelector(getCanvasSize);
  const bleedMargin = canvasSize?.bleedMargin || 0;
  const [loading, setLoading] = useState(true); // Loading state

  const calendarSubType = cal_settings.subtype;

  useEffect(() => {
    if (currentPageSVG) {
      downloadImage();
    }
  }, [currentPageSVG, bleedMargin, zoomRatio, canvasSize]);

  useEffect(() => {
    const updateScale = () => {
      setScale(window.innerWidth < 600 ? 0.4 : 0.7);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const setScaleIn = () => {
    if (scale < 5) setScale(scale + 0.1);
  };
  const setScaleOut = () => {
    if (scale > 0.5) setScale(scale - 0.1);
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
          <BodyText
            fontsize="20px"
            fontweight="600"
            textcolor="var(--primary)"
            className=" ms-lg-0"
          >
            3D Preview
          </BodyText>
        </FlexBox>
        <Box className="icon-18 bg-transparent">
          <ZoomButtonBox backgroundColor="transparent">
            <ZoomIn onClick={() => setScaleIn()} className="cursor-pointer" />
            <ZoomOut onClick={() => setScaleOut()} className="cursor-pointer" />
          </ZoomButtonBox>
        </Box>
      </PhotoModalHeader>

      <PhotoModalBody>
        <Box className="h-100 w-100">
          <div className="w-100 d-flex flex-column gap-3 h-100">
            <div className="canvas-preview h-100">
              <div className="w-full h-100">
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
                      camera={{ position: [0, 0.5, 1.5], fov: 55 }}
                      style={{ width: "100%", height: "calc(100vh - 100px)" }}
                    >
                      <ambientLight intensity={0.9} />
                      <OrbitControls
                        minPolarAngle={Math.PI / 4}
                        maxPolarAngle={(2 * Math.PI) / 4}
                      />

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

                      {frameSize &&
                        calendarSubType ===
                          EDITOR_SUB_TYPES.CALENDER.MOUNTAIN_CALENDER && (
                          <MountainCalendar
                            image={image || BlankWhitePage}
                            scale={scale}
                            frameSize={frameSize}
                          />
                        )}

                      {frameSize &&
                        calendarSubType ===
                          EDITOR_SUB_TYPES.CALENDER.WOODEN_CALENDER && (
                          <WoodenCalender
                            image={image || BlankWhitePage}
                            frameSize={frameSize}
                            scale={scale}
                          />
                        )}
                    </Canvas>
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        </Box>
      </PhotoModalBody>

      <Loader />
    </PhotoModalStyled>
  );
};
