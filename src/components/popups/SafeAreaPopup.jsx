import React, { useState, useRef, useEffect } from "react";
import styled, { keyframes, css } from "styled-components";
import {
  PhotoModalStyled,
  PhotoModalHeader,
  PhotoModalBodyStyled,
  FlexBox,
  BodyText,
  PrimaryButton,
} from "../../common-components/StyledComponents";
import { AiOutlineClose } from "react-icons/ai";
import { RiSafeLine, RiRulerLine } from "react-icons/ri";
import { BiBookOpen, BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { FaRegLightbulb } from "react-icons/fa";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ScrollContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 120px);
  width: 100%;
  // padding: 0.5rem;
`;

const SafeAreaContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  text-align: center;
  animation: ${fadeIn} 0.5s ease-out;
  .message-container {
    background: linear-gradient(to bottom, #ffffff, #f7f7f7);
    border-radius: 12px;
    padding: 0.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    width: calc(100% - 0.5rem);
    max-width: 600px;
  }
  .guidelines {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.5rem;
    width: calc(100% - 0.5rem);
    max-width: 600px;
    margin-top: 0.5rem;
  }
  .guideline-card {
    background: white;
    border-radius: 8px;
    padding: 0.5rem;
    text-align: left;
    transition: all 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    animation: ${fadeIn} 0.5s ease-out;
    cursor: pointer;
    min-height: clamp(100px, 22vh, 140px);
    display: flex;
    flex-direction: column;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    .icon {
      color: var(--primary);
      font-size: clamp(18px, 4vw, 22px);
      margin-bottom: 0.5rem;
      transition: transform 0.3s ease;
    }

    &:hover .icon {
      transform: scale(1.05);
    }
  }
  .button-wrapper {
    margin: 0.5rem 0 0;
    width: calc(100% - 0.5rem);
    max-width: 600px;

    button {
      width: 100%;
      padding: 0.5rem;
      font-size: clamp(12px, 3.5vw, 14px);
      border-radius: 6px;
      transition: all 0.3s ease;
      height: clamp(32px, 9vw, 38px);

      &:active {
        transform: translateY(1px);
      }
    }
  }
  /* Tablet and up */
  @media (min-width: 724px) {
    max-width: 680px;

    .message-container {
      padding: 1rem;
      margin: 0;
      width: 100%;
    }

    .guidelines {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
      padding: 0;
    }

    .guideline-card {
      padding: 1.5rem;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }

    .button-wrapper {
      margin: 2rem 0;

      button {
        width: auto;
        padding: 0.8rem 2rem;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
      }
    }
  }
`;

const ExampleImage = styled.div`
  width: clamp(200px, 80vw, 280px);
  height: clamp(120px, 45vw, 160px);
  margin: 0.5rem auto;
  border: 2px dashed var(--primary);
  border-radius: 8px;
  position: relative;
  background: #f7f7f7;

  &::before {
    content: "";
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    bottom: 12px;
    border: 2px solid var(--primary);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.1);
  }

  &::after {
    content: "Safe Area";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--primary);
    font-weight: 600;
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    font-size: clamp(12px, 3.5vw, 14px);
  }
`;

const SafeAreaPopup = ({ show, onHide }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef(null);
  const [highlightedCard, setHighlightedCard] = useState(null);

  const examples = [
    { variant: "safe", label: "Safe Area Example" },
    { variant: "bleed", label: "Full Bleed Example" },
    { variant: "spacing", label: "Spacing Guide" },
  ];

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollProgress(progress);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % examples.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % examples.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + examples.length) % examples.length);
  };

  return (
    <PhotoModalStyled
      dialogClassName="mob_full_screen_modal"
      show={show}
      onHide={onHide}
      size="lg"
      backdrop="static"
      centered
    >
      <PhotoModalHeader>
        <FlexBox
          className="cursor-pointer mob_heading_flex"
          grow={1}
          justify="center"
        >
          <BodyText
            fontsize="22px"
            fontweight="600"
            className="mob_text_flex"
            textcolor="var(--primary)"
            ml="80px"
          >
            Design Safe Area Guide
          </BodyText>
        </FlexBox>
        <FlexBox
          className="cursor-pointer"
          justify="flex-end"
          onClick={onHide}
          style={{ marginRight: "20px" }}
        >
          <AiOutlineClose size={24} color="#000" />
        </FlexBox>
      </PhotoModalHeader>
      <PhotoModalBodyStyled>
        <ScrollContainer ref={scrollRef} onScroll={handleScroll}>
          <SafeAreaContainer>
            <div className="message-container">
              <BodyText
                fontsize="clamp(18px, 5vw, 22px)"
                fontweight="700"
                mb="0.5rem"
                textcolor="#1a365d"
              >
                Keep Your Design Inside the Safe Area
              </BodyText>
              <BodyText
                fontsize="clamp(13px, 3.5vw, 15px)"
                textcolor="#4a5568"
                mb="0.5rem"
                style={{ lineHeight: "1.4" }}
              >
                For the best results, place all important elements like text and
                images inside the dashed box (safe area). This ensures your
                design will look perfect when printed or framed.
              </BodyText>
              <ExampleImage />
            </div>

            <div className="guidelines">
              <div
                className={`guideline-card ${
                  highlightedCard === 0 ? "highlight" : ""
                }`}
                onClick={() => setHighlightedCard(0)}
              >
                {" "}
                <BiBookOpen className="icon" />
                <BodyText
                  fontsize="clamp(14px, 4vw, 16px)"
                  fontweight="600"
                  mb="0.5rem"
                  textcolor="#2d3748"
                >
                  Stay Within the Lines
                </BodyText>
                <BodyText
                  fontsize="clamp(12px, 3.5vw, 14px)"
                  textcolor="#4a5568"
                >
                  Place your important design elements inside the dashed box to
                  ensure they won't be cut off during production. This is your
                  design's safe zone!
                </BodyText>
              </div>

              <div
                className={`guideline-card ${
                  highlightedCard === 1 ? "highlight" : ""
                }`}
                onClick={() => setHighlightedCard(1)}
              >
                {" "}
                <RiRulerLine className="icon" />
                <BodyText
                  fontsize="clamp(14px, 4vw, 16px)"
                  fontweight="600"
                  mb="0.5rem"
                  textcolor="#2d3748"
                >
                  Perfect Spacing
                </BodyText>
                <BodyText
                  fontsize="clamp(12px, 3.5vw, 14px)"
                  textcolor="#4a5568"
                >
                  Keep your design elements comfortably away from the dashed
                  lines. This creates a professional look and ensures nothing
                  gets too close to the edges.
                </BodyText>
              </div>
            </div>
          </SafeAreaContainer>
        </ScrollContainer>
      </PhotoModalBodyStyled>
    </PhotoModalStyled>
  );
};

export default SafeAreaPopup;
