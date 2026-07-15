/**
 * StateViews — small, reusable presentational primitives for the common
 * async UI states (loading / empty / error) plus a lightweight inline Spinner.
 *
 * Generic and app-wide: no feature-specific copy is baked in — pass text via
 * props. Built with styled-components to match the rest of the editor UI.
 *
 *   import { Spinner, LoadingState, EmptyState, ErrorState } from "../common-components/StateViews";
 */

import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.div`
  width: ${(p) => p.$size || 38}px;
  height: ${(p) => p.$size || 38}px;
  border: ${(p) => p.$thickness || 3}px solid ${(p) => p.$track || "#e6e6e6"};
  border-top-color: ${(p) => p.$accent || "#111111"};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  flex-shrink: 0;
`;

const StateWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: ${(p) => p.$padding || "clamp(40px, 8vw, 80px) 20px"};
  text-align: center;
  color: #6b6b6b;
`;

const StateTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #333333;
`;

const StateText = styled.div`
  font-size: 13.5px;
  color: #6b6b6b;
  max-width: 420px;
  line-height: 1.5;
`;

const IconCircle = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #f2f2f2;
  color: #9a9a9a;
  font-size: 26px;
`;

/** Centered spinner with an optional label. */
export const LoadingState = ({ label, padding }) => (
  <StateWrap $padding={padding}>
    <Spinner />
    {label && <StateText>{label}</StateText>}
  </StateWrap>
);

/** Empty state: icon + title + optional text + optional action node. */
export const EmptyState = ({ icon, title, text, action, padding }) => (
  <StateWrap $padding={padding}>
    {icon && <IconCircle>{icon}</IconCircle>}
    {title && <StateTitle>{title}</StateTitle>}
    {text && <StateText>{text}</StateText>}
    {action}
  </StateWrap>
);

/** Error state: title + message + optional action node (e.g. a retry button). */
export const ErrorState = ({ title = "Something went wrong", text, action, padding }) => (
  <StateWrap $padding={padding}>
    <IconCircle style={{ background: "#f2f2f2", color: "#111111" }}>!</IconCircle>
    {title && <StateTitle>{title}</StateTitle>}
    {text && <StateText>{text}</StateText>}
    {action}
  </StateWrap>
);

const StateViews = { Spinner, LoadingState, EmptyState, ErrorState };
export default StateViews;
