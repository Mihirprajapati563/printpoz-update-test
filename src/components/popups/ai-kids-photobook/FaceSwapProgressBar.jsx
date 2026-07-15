import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { FaRobot, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import {
  selectFaceSwapProgress,
  hideProgressBar
} from '../../../store/slices/aiKidsPhotobookSlice';

// Styled Components
const ProgressContainer = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 2px solid var(--primary, #4084B5);
  min-width: 280px;
`;

const ProgressIcon = styled.div`
  font-size: 1.25rem;
  color: var(--primary, #4084B5);
  animation: ${props => props.isProcessing ? 'spin 2s linear infinite' : 'none'};
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const ProgressText = styled.div`
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
  flex: 1;
`;

const ProgressCount = styled.div`
  background: var(--primary, #4084B5);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 45px;
  text-align: center;
`;

function FaceSwapProgressBar() {
  const dispatch = useDispatch();
  const progress = useSelector(selectFaceSwapProgress);

  const progressPercentage = progress.totalTemplates > 0
    ? Math.round((progress.processedTemplates / progress.totalTemplates) * 100)
    : 0;

  // Auto-hide progress bar after completion
  useEffect(() => {
    if (!progress.isProcessing && progress.processedTemplates >= progress.totalTemplates && progress.totalTemplates > 0) {
      const timer = setTimeout(() => {
        dispatch(hideProgressBar());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [progress.isProcessing, progress.processedTemplates, progress.totalTemplates, dispatch]);

  if (!progress.showProgressBar) {
    return null;
  }

  return (
    <ProgressContainer>
      <ProgressIcon isProcessing={progress.isProcessing}>
        {progress.isProcessing ? <FaSpinner /> : <FaCheckCircle />}
      </ProgressIcon>

      <ProgressText>
        {progress.isProcessing ? 'Preparing Your PhotoBook...' : 'Complete!'}
      </ProgressText>

      <ProgressCount>
        {progress.processedTemplates}/{progress.totalTemplates}
      </ProgressCount>
    </ProgressContainer>
  );
}

export default FaceSwapProgressBar;
