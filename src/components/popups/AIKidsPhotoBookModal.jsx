import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import styled from 'styled-components';
import { FaChild, FaUpload, FaImage, FaCheckCircle, FaTimes, FaSpinner, FaMagic, FaHeart, FaStar } from 'react-icons/fa';
import { getAllObjects, getSettings } from '../../library/utils/helpers/canvasSliceGetters';
import { apiMultiPartPost, apiPost } from '../../library/utils/common-services/apiCall';
import { API_BASE_URL, ENDPOINTS } from '../../library/utils/constants/apiurl';
import { v4 as uuidv4 } from 'uuid';
import { io } from "socket.io-client";
import { useSearchParams } from 'react-router-dom';
import FaceSwapProgressBar from './ai-kids-photobook/FaceSwapProgressBar';
import {
    closeAiKidsPhotobookModal,
    selectFaceSwapProgress,
    selectUploadedPhotos,
    selectChildName,
    addUploadedPhototoAiKidsPhotobook,
    removeUploadedPhotoFromAiKidsPhotobook,
    addUploadedImageUrl,
    startFaceSwapProcessing,
    setSocketConnected,
    updateFaceSwapProgress,
    setChildName
} from '../../store/slices/aiKidsPhotobookSlice';
import { replaceImageWithNewImage, setObjectProcessingStatus, swapTextPlaceholders } from '../../store/slices/canvas';
import { toast } from 'react-toastify';

// Styled Components
const ContentCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    border-radius: 12px;
  }
`;

const HeroHeader = styled.div`
  background: var(--primary, #4084B5);
  color: white;
  padding: 1rem;
  text-align: center;
  position: relative;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;

  
  @media (max-width: 768px) {
    flex-direction: column;
    overflow-y: auto;
  }
`;

const GuidelinesPanel = styled.div`
  flex: 0 0 45%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 2rem;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
  
  @media (max-width: 768px) {
    flex: none;
    padding: 1.5rem;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
    overflow-y: visible;
  }
`;

const FormPanel = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    flex: 1;
    overflow-y: visible;
  }
`;

const GuidelineCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  border-left: 4px solid var(--primary, #4084B5);
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FormSection = styled.div`
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const NameInput = styled(Form.Control)`
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
  }
`;

const UploadZone = styled.div`
  border: 2px dashed ${props => props.isDragOver ? 'var(--primary, #4084B5)' : '#e2e8f0'};
  border-radius: 12px;
  padding: 2rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: ${props => props.isDragOver ? 'rgba(0, 0, 0, 0.05)' : 'white'};
  
  &:hover {
    border-color: var(--primary, #4084B5);
    background: rgba(0, 0, 0, 0.05);
  }
  
  ${props => props.disabled && `
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  `}
`;

const UploadIcon = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
`;

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
`;

const PhotoPreview = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const DeleteButton = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(239, 68, 68, 0.9);
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  font-size: 0.75rem;
  
  &:hover {
    background: rgba(239, 68, 68, 1);
    transform: scale(1.1);
  }
`;

const ActionButton = styled(Button)`
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  border: none;
  
  &.btn-primary {
    background: var(--primary);
    color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }
    
    &:disabled {
      background: #cbd5e1;
      box-shadow: none;
      transform: none;
      cursor: not-allowed;
    }
  }
  
  &.btn-outline-secondary {
    background: transparent;
    border: 2px solid #e2e8f0;
    color: #64748b;
    
    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }
`;

const RequirementsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
  
  @media (min-width: 992px) {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
  }
  
  li {
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
    color: #64748b;
    font-size: 0.875rem;
    width: 100%;
    
    @media (min-width: 992px) {
      width: 48%;
    }
    
    &::before {
      content: '✓';
      color: #333333;
      font-weight: bold;
      margin-right: 0.75rem;
      font-size: 1rem;
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }
  }
`;

const SectionTitle = styled.h5`
  color: var(--primary, #4084B5);
  font-weight: 700;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FooterActions = styled.div`
  background: #f8fafc;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
`;

function AIKidsPhotoBookModal({ show, onHide }) {
    const dispatch = useDispatch();
    const faceSwapProgress = useSelector(selectFaceSwapProgress);
    const uploadedFiles = useSelector(selectUploadedPhotos);
    const childName = useSelector(selectChildName);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [user, setUser] = useState(null);
    const [searchParams] = useSearchParams();
    const fileInputRef = useRef(null);
    const projectSetup = useSelector((state) => state.projectSetup);
    const allObjects = useSelector(getAllObjects);
    const settings = useSelector(getSettings)
    useEffect(() => {
        const users = localStorage.getItem("userDetails");
        if (!users) {
            setUser(null);
            return;
        }
        const userObj = JSON.parse(users);
        setUser(userObj);
    }, []);

    function handleClose() {
        onHide();
    }

    // File handling functions
    function handleDragOver(e) {
        e.preventDefault();
        if (isProcessing) return;
        setIsDragOver(true);
    }

    function handleDragLeave(e) {
        e.preventDefault();
        setIsDragOver(false);
    }

    function handleDrop(e) {
        e.preventDefault();
        setIsDragOver(false);
        if (isProcessing) return;

        const files = Array.from(e.dataTransfer.files);
        handleFileSelection(files);
    }

    function handleFileInputChange(e) {
        const files = Array.from(e.target.files);
        handleFileSelection(files);
    }

    function handleFileSelection(files) {
        const validFiles = files.filter(file => {
            const isValidType = ['image/jpeg', 'image/jpg'].includes(file.type);
            const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
            return isValidType && isValidSize;
        });

        if (validFiles.length !== files.length) {
            alert('Some files were rejected. Please ensure all files are JPEG format and under 5MB.');
        }

        // Restrict to only one image - take the first valid file
        const selectedFile = validFiles[0];
        if (!selectedFile) return;

        // Clear existing uploaded files first
        uploadedFiles.forEach(file => {
            URL.revokeObjectURL(file.preview);
            dispatch(removeUploadedPhotoFromAiKidsPhotobook(file.id));
        });

        const newFile = {
            id: Date.now() + Math.random(),
            file: selectedFile,
            preview: URL.createObjectURL(selectedFile),
            name: selectedFile.name
        };

        dispatch(addUploadedPhototoAiKidsPhotobook(newFile));
    }

    function handleRemovePhoto(photoId) {
        if (isProcessing) return;
        const fileToRemove = uploadedFiles.find(f => f.id === photoId);
        if (fileToRemove) {
            URL.revokeObjectURL(fileToRemove.preview);
        }
        dispatch(removeUploadedPhotoFromAiKidsPhotobook(photoId));
    }

    async function handleStartProcessing() {
        if (uploadedFiles.length === 0 || (!childName.trim() && !settings?.templateSwapped)) return;

        setIsProcessing(true);

        try {
            // Upload images first
            const uploadedImageUrls = [];

            for (const photo of uploadedFiles) {
                const formData = new FormData();
                formData.append('file', photo.file);
                formData.append('brand_id', user?.brand_id || '');
                formData.append('userTypeCode', user?.userTypeCode || -1);
                formData.append('editor_type', 'ai_kids_photobook');
                formData.append('device', 'web');
                formData.append('batch_id', uuidv4());

                if (user?._id) {
                    formData.append('user_id', user._id);
                }
                if (projectSetup?.cartDetails?._id) {
                    formData.append('cart_order_id', projectSetup.cartDetails._id);
                }
                if (projectSetup?.themeDetails?.theme_id) {
                    formData.append('theme_id', projectSetup.themeDetails.theme_id);
                }

                const uploadResponse = await apiMultiPartPost(ENDPOINTS.uploadProjectImages, formData);

                if (uploadResponse && uploadResponse.status === 1) {
                    const imageUrl = uploadResponse.items?.urls?.find(url => url.size === 'large')?.url;
                    if (imageUrl) {
                        uploadedImageUrls.push({ url: imageUrl });
                        dispatch(addUploadedImageUrl(uploadResponse));
                    }
                } else {
                    toast.error(uploadResponse.message || 'Something went wrong');
                    setIsProcessing(false);
                }
            }

            if (uploadedImageUrls.length > 0) {
                await callFaceSwapAPI(uploadedImageUrls);
            }

        } catch (error) {
            toast.error(error.message || 'Something went wrong');
            setIsProcessing(false);
        }
    }

    async function callFaceSwapAPI(uploadedImageUrls) {
        try {
            const templateImageObjects = allObjects.filter(obj =>
                obj.type === 'img' && obj.isTemplateSwapable === true && obj.url && obj.url !== ''
            ).map(obj => ({
                id: obj.id,
                url: obj.url,
                isTemplateSwapable: obj.isTemplateSwapable
            }));

            if (templateImageObjects.length === 0) {
                toast.error('No template images found');
                setIsProcessing(false);
                return;
            }

            const requestBody = {
                urls: uploadedImageUrls.map(img => img.url),
                templateUrls: templateImageObjects.map(template => ({
                    url: template.url,
                    id: template.id
                })),
                userTypeCode: user?.userTypeCode || -1,
                cart_order_id: projectSetup?.cartDetails?._id || '',
                theme_id: projectSetup?.themeDetails?.theme_id || '',
                brand_id: user?.brand_id || '',
                user_id: user?._id || '',
            };

            const response = await apiPost(ENDPOINTS.swapFaceByAI, requestBody);


            if (response && response?.status === 1) {
                // Setup socket connection
                const socket = io("https://apis.printpoz.com", {
                    query: { projectId: searchParams.get("c_id") },
                });

                socket.on("connect", () => {
                    dispatch(setSocketConnected(true));
                });

                socket.on("swapedFaceImage", (data) => {
                    dispatch(replaceImageWithNewImage(data));
                    dispatch(setObjectProcessingStatus({ id: data.id, isProcessing: false }));
                    dispatch(updateFaceSwapProgress())
                });

                socket.on("disconnect", () => {
                    dispatch(setSocketConnected(false));
                });
                // swap text placeholders
                if (childName.trim() && !settings?.templateSwapped) {
                    dispatch(swapTextPlaceholders({ text: childName, replace: '#name#' }));
                }

                // Mark template objects as processing
                templateImageObjects.forEach(template => {
                    dispatch(setObjectProcessingStatus({ id: template.id, isProcessing: true }));
                });

                dispatch(startFaceSwapProcessing({ totalTemplates: templateImageObjects.length }));
                dispatch(closeAiKidsPhotobookModal());
            } else {
                toast.error(response.message || 'Something went wrong');
                // dispatch(closeAiKidsPhotobookModal());
                templateImageObjects.forEach(template => {
                    dispatch(setObjectProcessingStatus({ id: template.id, isProcessing: false }));
                });
                setIsProcessing(false);
            }
        } catch (error) {
            toast.error(error.message || 'Something went wrong');
            setIsProcessing(false);
        }
    }

    return (
        <Modal
            show={show}
            onHide={handleClose}
            size="fullscreen"
            centered
            className='p-0 bg-transparent'
        >
            <Modal.Body className="w-100 h-100 p-0 bg-transparent overflow-auto">

                <ContentCard className='p-0'>
                    <HeroHeader>
                        <CloseButton onClick={handleClose}>
                            <FaTimes />
                        </CloseButton>

                        <h1 className="fw-bold mb-2" style={{ fontSize: '1.75rem' }}>
                            Create Your Child's Magical PhotoBook
                        </h1>

                        <p className="mb-0" style={{ fontSize: '1rem', opacity: 0.9 }}>
                            Transform your photobook with Your Child's face
                        </p>
                    </HeroHeader>

                    <MainContent>
                        {/* Guidelines Panel */}
                        <GuidelinesPanel>
                            <GuidelineCard>
                                <div className="d-flex align-items-center mb-3">
                                    <FaChild size={24} className="text-primary me-2" />
                                    <SectionTitle className="mb-0">How It Works</SectionTitle>
                                </div>
                                <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                                    Upload one clear photo of your child and enter their name. Our AI will seamlessly
                                    replace template faces and personalize text content.
                                </p>
                            </GuidelineCard>

                            <GuidelineCard>
                                <SectionTitle>
                                    <FaCheckCircle className="text-success" />
                                    Perfect Photos
                                </SectionTitle>
                                <RequirementsList>
                                    <li>Clear, front-facing photos</li>
                                    <li>Good lighting and visibility</li>
                                    <li>Solo photos (child only)</li>
                                    <li>Natural expressions</li>
                                </RequirementsList>
                            </GuidelineCard>

                            <GuidelineCard>
                                <SectionTitle>
                                    <FaTimes className="text-danger" />
                                    Avoid These
                                </SectionTitle>
                                <RequirementsList>
                                    <li style={{ color: '#111111' }}>Sunglasses or hats</li>
                                    <li style={{ color: '#111111' }}>Blurry or dark photos</li>
                                    <li style={{ color: '#111111' }}>Multiple people</li>
                                    <li style={{ color: '#111111' }}>Side or back views</li>
                                </RequirementsList>
                            </GuidelineCard>
                        </GuidelinesPanel>

                        {/* Form Panel */}
                        <FormPanel>
                            <FormSection>

                                <SectionTitle>
                                    {
                                        uploadedFiles.length === 0 ? (<>
                                            <FaChild size={24} className="text-primary me-2" />
                                            Upload Photo
                                        </>) : (<>

                                            Uploaded Photos
                                        </>)
                                    }

                                </SectionTitle>

                                {
                                    uploadedFiles.length === 0 && (


                                        <UploadZone
                                            isDragOver={isDragOver}
                                            disabled={isProcessing || uploadedFiles.length > 0}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => !isProcessing && uploadedFiles.length === 0 && fileInputRef.current?.click()}
                                        >
                                            <UploadIcon>
                                                <FaImage />
                                            </UploadIcon>
                                            <p className="text-muted mb-2" style={{ fontSize: '0.9rem' }}>
                                                {uploadedFiles.length > 0
                                                    ? 'Remove current photo to upload different one'
                                                    : 'Click or drag to upload photo'
                                                }
                                            </p>

                                            <div className="d-inline-block px-3 py-1 bg-light rounded-pill">
                                                <small className="text-muted">
                                                    <strong>JPEG only</strong> • Max 5MB
                                                </small>
                                            </div>

                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".jpg,.jpeg"
                                                style={{ display: 'none' }}
                                                onChange={handleFileInputChange}
                                                disabled={isProcessing || uploadedFiles.length > 0}
                                            />
                                        </UploadZone>
                                    )}

                                {uploadedFiles.length > 0 && (
                                    <PhotoGrid>
                                        {uploadedFiles.map(file => (
                                            <PhotoPreview key={file.id}>
                                                <img src={file.preview} alt={file.name} />
                                                <DeleteButton onClick={() => handleRemovePhoto(file.id)}>
                                                    <FaTimes />
                                                </DeleteButton>
                                            </PhotoPreview>
                                        ))}
                                    </PhotoGrid>
                                )}
                            </FormSection>

                            {!settings?.templateSwapped && (
                                <FormSection>
                                    <SectionTitle>
                                        <FaChild />
                                        Child's Name
                                    </SectionTitle>

                                    <NameInput
                                        type="text"
                                        placeholder="Enter your child's name"
                                        value={childName}
                                        onChange={(e) => dispatch(setChildName(e.target.value))}
                                        disabled={isProcessing}
                                    />
                                </FormSection>
                            )}

                            <div className="mt-auto">
                                <small className="text-muted d-block mb-3">
                                    <FaSpinner className="me-1" />
                                    Processing typically takes a few minutes
                                </small>
                            </div>
                        </FormPanel>
                    </MainContent>

                    <FooterActions>
                        <div>
                            <small className="text-muted">
                                Ready to create magic? ✨
                            </small>
                        </div>

                        <div className="d-flex gap-2 justify-content-between ">
                            <ActionButton
                                variant="outline-secondary"
                                onClick={handleClose}
                                disabled={isProcessing}
                            >
                                Cancel
                            </ActionButton>

                            <ActionButton
                                variant="primary"
                                disabled={uploadedFiles.length === 0 || isProcessing || (!childName.trim() && !settings?.templateSwapped)}
                                onClick={handleStartProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <FaSpinner className="fa-spin me-2" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FaMagic className="me-2" />
                                        See the Magic
                                    </>
                                )}
                            </ActionButton>
                        </div>
                    </FooterActions>
                </ContentCard>
                {faceSwapProgress.showProgressBar && <FaceSwapProgressBar />}
            </Modal.Body>
        </Modal >
    );
}

export default AIKidsPhotoBookModal;
