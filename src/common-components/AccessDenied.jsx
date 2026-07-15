import React from "react";
import styled, { keyframes } from "styled-components";
import { FaLock } from "react-icons/fa";

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-backdrop, rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(4px);
  padding: 20px;
  animation: ${fadeIn} 0.3s ease-out;
`;

const Container = styled.div`
  width: 100%;
  max-width: 480px;
  background: var(--surface, #ffffff);
  border-radius: var(--radius-xl, 16px);
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-subtle, #f0f0f0);
  animation: ${slideUp} 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff1f0;
  color: #ff4d4f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 24px;
  box-shadow: 0 0 0 8px #fff1f055;
`;

const Title = styled.h2`
  margin: 0;
  margin-bottom: 12px;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  letter-spacing: -0.01em;
`;

const Message = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
  word-break: break-word;
`;

const Divider = styled.div`
  height: 1px;
  width: 40px;
  background: var(--border-subtle, #e5e7eb);
  margin: 24px 0;
`;

const AccessDenied = ({ error }) => {
  return (
    <Overlay className="access-denied-overlay">
      <Container className="access-denied-container">
        <IconWrapper>
          <FaLock />
        </IconWrapper>
        <Title>Access Denied!</Title>
        <Message>
          {error || "You do not have permission to access this resource."}
        </Message>
        <Divider />
        <Message style={{ fontSize: "13px" }}>
          Please try closing this tab and opening from the console again.
        </Message>
      </Container>
    </Overlay>
  );
};

export default AccessDenied;
