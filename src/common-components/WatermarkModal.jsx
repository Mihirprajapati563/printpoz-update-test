import React, { useEffect, useState } from "react";
import {
  BackgroundColorItem,
  BodyText,
  Box,
  FlexBox,
  PhotoModalBody,
  PhotoModalHeader,
  PhotoModalStyled,
  WatermarkColorItem,
} from "../common-components/StyledComponents.jsx";
import { Button } from "react-bootstrap";
import ColorPickerWithOpacity from "../components/popups/ColorPickerWithOpacity";
import { useDispatch, useSelector } from "react-redux";
import { setWaterMarkColor } from "../store/slices/svgData.js";
import { AiOutlineClose } from "react-icons/ai";
import styled from "styled-components";

const ResponsiveModalStyled = styled(PhotoModalStyled)`
  .modal-dialog {
    max-width: 90%;
    margin: 1.75rem auto;

    @media (min-width: 576px) {
      max-width: 500px;
    }

    @media (min-width: 768px) {
      max-width: 600px;
    }

    @media (max-width: 575px) {
      margin: 0.5rem;
      max-width: calc(100% - 1rem);
    }
  }

  .modal-content {
    @media (max-width: 575px) {
      border-radius: 0.5rem;
    }
  }
`;

const ResponsiveInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  margin-bottom: 1rem;
  font-size: 16px;
  transition: border-color 0.3s;

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }

  @media (max-width: 575px) {
    padding: 0.625rem;
    font-size: 14px;
  }
`;

const ColorSection = styled.div`
  margin-bottom: 1.5rem;

  @media (max-width: 575px) {
    margin-bottom: 1rem;
  }
`;

const ColorDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 0.5rem;

  @media (max-width: 575px) {
    gap: 10px;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (max-width: 575px) {
    gap: 0.75rem;
    margin-top: 1rem;

    button {
      flex: 1;
      padding: 0.5rem 1rem;
      font-size: 14px;
    }
  }
`;

const ModalContent = styled(Box)`
  padding: 1.5rem;
  width: 100%;

  @media (max-width: 575px) {
    padding: 1rem;
  }
`;

const HeaderTitle = styled(BodyText)`
  font-size: 20px;
  font-weight: 600;
  color: var(--primary);

  @media (max-width: 575px) {
    font-size: 18px;
  }
`;

const ColorPickerWrapper = styled.div`
  position: absolute;
  z-index: 999;

  @media (max-width: 575px) {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;

export const WatermarkModal = React.memo(
  ({
    show,
    onHide,
    onSubmit,
    onSkip,
    initialText = "",
    initialColor = "#000000FF",
  }) => {
    const dispatch = useDispatch();
    const { defaultWaterMarkText } = useSelector((state) => state.svgData);

    const [text, setText] = useState(defaultWaterMarkText);
    const [color, setColor] = useState(initialColor);
    const [displayColorPicker, setDisplayColorPicker] = useState(false);

    const handleColorChange = (newColor) => {
      setColor(newColor);
      dispatch(setWaterMarkColor(newColor));
    };

    const handleAdd = () => {
      const finalText = text.trim() === "" ? defaultWaterMarkText : text;
      onSubmit(finalText, color);
    };

    return (
      <ResponsiveModalStyled
        show={show}
        onHide={onHide}
        backdrop="static"
        keyboard={false}
        centered
      >
        <PhotoModalHeader>
          <FlexBox grow={1} justify="center">
            <HeaderTitle>Add Watermark</HeaderTitle>
          </FlexBox>
          <FlexBox className="cursor-pointer" onClick={onHide}>
            <AiOutlineClose size={24} color="#000" />
          </FlexBox>
        </PhotoModalHeader>
        <PhotoModalBody className="d-flex justify-content-center">
          <ModalContent>
            <ResponsiveInput
              type="text"
              placeholder="Enter watermark text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <ColorSection>
              <BodyText>Text Color</BodyText>
              <ColorDisplay>
                <BackgroundColorItem
                  onClick={() => setDisplayColorPicker(!displayColorPicker)}
                  bgcolor={color}
                />
                <span>{color}</span>
              </ColorDisplay>
            </ColorSection>

            {displayColorPicker && (
              <ColorPickerWrapper>
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  }}
                  onClick={() => setDisplayColorPicker(false)}
                />
                <ColorPickerWithOpacity
                  color={color}
                  onChange={handleColorChange}
                  onClose={() => setDisplayColorPicker(false)}
                />
              </ColorPickerWrapper>
            )}

            <ButtonContainer>
              <Button variant="secondary" onClick={onSkip}>
                Skip
              </Button>
              <Button variant="primary" onClick={handleAdd}>
                Add
              </Button>
            </ButtonContainer>
          </ModalContent>
        </PhotoModalBody>
      </ResponsiveModalStyled>
    );
  }
);
