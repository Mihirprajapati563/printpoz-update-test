import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { LiaTimesSolid } from "react-icons/lia";
import { FaPalette, FaSave, FaUndo, FaStore } from "react-icons/fa";
import { setIsActionActive } from "../../store/slices/appAlice";
import { setEditorConfigurations, setBrandStores, selectBrandStore, setThemeColor, getEditorThemeColor, setConfiguration, getEditorConfiguration } from "../../store/slices/editorConfigurations";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { withAssetDetailCache } from "../../library/utils/helpers/assetsCache.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import {
    ActionTitle,
    DisplayBetween,
    PrimaryButton,
    LightPrimaryButton,
} from "../../common-components/StyledComponents";
import PremiumSelect from "../../common-components/PremiumSelect";
import { toast } from "react-toastify";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { IoInformation } from "react-icons/io5";
import { getUserDetails } from "../../library/utils/services/theme/index.js";

// Styled Components
const ConfigContainer = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
`;

const ConfigSection = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1rem 0.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #eaeaea;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    padding: 0.8rem;
    margin-bottom: 0.8rem;
  }
`;

const SectionTitle = styled.h5`
  font-size: 1rem;
  font-weight: 600;
  color: #333;
//   margin-bottom: 1rem;
//   padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.8rem;
  }
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
  }
`;

const ColorBox = styled.div`
  align-items: center;
  padding: 0.50rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;

  @media (max-width: 768px) {
    padding: 0.6rem;
 display: flex; 
    gap: 0.5rem;
  }
`;

const ColorLabel = styled.div`
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  text-transform: capitalize;
  flex: 1;

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const ColorInputContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const ColorInput = styled.input`
  width: 40px;
  height: 30px;
  border: 2px solid #ddd;
  border-radius: 4px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--primary, #4084b5);
  }

  @media (max-width: 768px) {
    width: 35px;
    height: 25px;
  }
`;

const ColorValue = styled.span`
  font-family: monospace;
  font-size: 0.8rem;
  color: #666;
  background-color: #f1f3f4;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  min-width: 80px;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 0.7rem;
    min-width: 70px;
  }
`;

const LoadingText = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 1rem;
`;

const SavingCard = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  text-align: center;
  min-width: 300px;
`;

const SavingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
`;

const SavingSpinner = styled.div`
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--primary, #4084b5);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const SavingTitle = styled.h3`
  margin: 0 0 0.5rem;
  color: #333;
  font-size: 1.2rem;
`;

const SavingText = styled.p`
  margin: 0;
  color: #666;
  font-size: 0.9rem;
`;

function EditorConfigurationAction() {
    const dispatch = useDispatch();

    // Redux state selectors
    const currentThemeColors = useSelector(getEditorThemeColor);
    const { brand_stores, store_id, brand_id } = useSelector((state) => state.editorConfigurations);
    const configuration = useSelector(getEditorConfiguration);

    // Local state
    const [hasChanges, setHasChanges] = useState(false);
    const [isLoadingStores, setIsLoadingStores] = useState(false);
    const [isLoadingStoreConfig, setIsLoadingStoreConfig] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Handle color change
    const handleColorChange = (colorName, colorValue) => {
        if (!isSavingConfig) {
            dispatch(setThemeColor({ colorName, colorValue }));
            setHasChanges(true);
        }
    };

    // Fetch store list on component mount
    useEffect(() => {
        fetchStoreList();
    }, []);

    /**
     * Fetches store list from API if not already loaded in Redux state
     * Filters stores by brand_id from localStorage.userDetails
     */
    const fetchStoreList = async () => {
        try {
            // Check if store list already exists in Redux state
            if (brand_stores && brand_stores.length > 0) {
                return;
            }

            // Get brand_id from localStorage.userDetails
            const userDetails = localStorage.getItem("userDetails");
            if (!userDetails) {
                return;
            }

            // const user = JSON.parse(userDetails);
            const user = getUserDetails();
            const brandId = user.brand_id;

            if (!brandId) {
                return;
            }

            setIsLoadingStores(true);

            // Prepare API payload with brand_id filter
            const payload = {
                filter: {
                    user_id: user._id,
                    brand_id: brandId
                }
            };


            // Call API to get store list. Wrapped so the dropdown still populates
            // offline from the last successful response (cached in AppData).
            const response = await withAssetDetailCache(
                "editor-config",
                { kind: "storeList", brand_id: brandId, user_id: user._id },
                () => apiPost(ENDPOINTS.getStoreList, payload),
                (r) => r?.status === 1 && Array.isArray(r?.items),
            );

            if (response && response.status === 1 && response.items) {
                // Store the response items in Redux editorConfigurations stores state
                dispatch(setBrandStores(response.items));
            } else {
                toast.error(response?.message || "Failed to fetch store list");
            }

        } catch (error) {
            toast.error(error.message || "Failed to fetch store list");
        } finally {
            setIsLoadingStores(false);
        }
    };


    /**
     * Saves editor configuration to API
     */
    const handleSaveChanges = async () => {
        const userDetails = localStorage.getItem("userDetails");
        const user = JSON.parse(userDetails);
        const brandId = user.brand_id || brand_id || null;

        if (!store_id || !brandId) {
            toast.error("Store ID and Brand ID are required to save configuration");
            return;
        }

        try {
            setIsSavingConfig(true);

            const payload = {
                store_id: store_id,
                brand_id: brandId,
                theme_colors: currentThemeColors,
                configuration: configuration,
            };

            const response = await apiPost(ENDPOINTS.saveEditorConfiguration, payload);

            if (response && response.status === 1) {
                setHasChanges(false);
                toast.success("Editor configuration saved successfully");
            } else {
                toast.error(response?.message || "Failed to save editor configuration");
            }

        } catch (error) {
            toast.error(error.message || "Failed to save editor configuration");
        } finally {
            setIsSavingConfig(false);
        }
    };


    /**
     * Resets editor configuration to default values while preserving store_id and brand_id
     */
    const handleConfigChange = (key, value) => {
        if (!isSavingConfig) {
            dispatch(setConfiguration({ [key]: value }));
            setHasChanges(true);
        }
    };

    const handleResetEditorConfiguration = () => {
        const defaultConfig = {
            store_id: store_id || "",
            brand_id: brand_id || "",
            brand_stores: brand_stores || [],
            _id: "",
            // theme_colors: {
            //     "background": "#ecf2f7",
            //     "foreground": "#1f4f73",
            //     "primary": "var(--primary)",
            //     "primary-foreground": "#ffffff",
            //     "secondary": "var(--secondary)",
            //     "secondary-foreground": "var(--primary)",
            //     "muted-foreground": "#6c8ea5",
            //     "accent-foreground": "var(--primary)",
            // },
            theme_colors: {
                "background": "#ffffff",
                "foreground": "#111111",
                "primary": "#111111",
                "primary-foreground": "#ffffff",
                "secondary": "#f0f0f0",
                "secondary-foreground": "#111111",
                "muted-foreground": "#6b6b6b",
                "accent-foreground": "#111111",
            },
            configuration: {
                is_downloadable: false,
            }
        };

        dispatch(setEditorConfigurations(defaultConfig));
        setHasChanges(true); // Enable save button after reset
    };

    /**
     * Handles store selection change
     * Calls API to get editor configuration for selected store
     */
    const handleStoreChange = async (selectedStore) => {
        const selectedStoreId = selectedStore?.value;
        if (!selectedStoreId) {
            // If no store selected, just clear the store_id
            dispatch(selectBrandStore(""));
            return;
        }

        try {
            // Show loader while fetching store configuration
            setIsLoadingStoreConfig(true);

            // Prepare API payload with store_id
            const payload = {
                store_id: selectedStoreId,
                brand_id: brand_id
            };

            // Call API to get editor configuration for the selected store.
            // Wrapped so selecting a store offline loads its last-fetched config
            // (theme colors + features) from AppData instead of failing.
            const response = await withAssetDetailCache(
                "editor-config",
                { kind: "storeConfig", store_id: selectedStoreId, brand_id },
                () => apiPost(ENDPOINTS.getEditorConfigurationForStore, payload),
                (r) => r?.status === 1,
            );

            if (response && response.status === 1) {
                // If configuration found, set the complete editor configuration
                const storeConfig = response.items[0];

                // Update the complete editor configuration including store_id
                dispatch(setEditorConfigurations({
                    ...storeConfig,
                    store_id: selectedStoreId
                }));

                // Reset hasChanges since we loaded fresh data from API
                setHasChanges(false);
            } else {
                dispatch(setEditorConfigurations({
                    store_id: selectedStoreId,
                    brand_id: brand_id,
                }));
                setHasChanges(true);
            }

        } catch (error) {
            toast.error(error.message || "Failed to fetch store configuration");
            dispatch(selectBrandStore(selectedStoreId));
            // Enable save button for stores with API errors (might not have configuration)
            setHasChanges(true);
        } finally {
            // Hide loader after API call completes
            setIsLoadingStoreConfig(false);
        }
    };

    // Transform brand_stores to PremiumSelect options format
    const storeOptions = brand_stores ? brand_stores.map((store) => ({
        value: store._id || store.id,
        label: store.name || store.store_name || `Store ${store._id || store.id}`,
    })) : [];

    // Find selected store option
    const selectedStoreOption = storeOptions.find(option => option.value === store_id) || null;

    // Color labels for better UX
    const colorLabels = {
        "background": "Background",
        "foreground": "Foreground",
        "primary": "Primary",
        "primary-foreground": "Primary Foreground",
        "secondary": "Secondary",
        "secondary-foreground": "Secondary Foreground",
        "muted-foreground": "Muted Foreground",
        "accent-foreground": "Accent Foreground",
    };

    return (
        <>
            {/* Saving Configuration Overlay */}
            {isSavingConfig && (
                <>
                    <SavingOverlay />
                    <SavingCard>
                        <SavingSpinner />
                        <SavingTitle>Saving Configuration</SavingTitle>
                        <SavingText>Please wait while we save your editor configuration...</SavingText>
                    </SavingCard>
                </>
            )}

            <div className="sticker-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '2px' }}>
                <DisplayBetween className="heading-action-mob mb-2" style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
                    <ActionTitle>Editor Configuration</ActionTitle>
                    <LiaTimesSolid
                        onClick={() => dispatch(setIsActionActive(false))}
                        className="cursor-pointer"
                        size={20}
                    />
                </DisplayBetween>
                <ConfigContainer className="scroll-container-mob" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingBottom: '20px' }}>

                    {/* Store Selection Section */}
                    <ConfigSection>
                        <SectionTitle>
                            <FaStore />
                            Store Selection
                        </SectionTitle>

                        {isLoadingStores ? (
                            <LoadingText>Loading stores...</LoadingText>
                        ) : (
                            <PremiumSelect
                                options={storeOptions}
                                value={selectedStoreOption}
                                onChange={handleStoreChange}
                                placeholder="Select a store..."
                                searchPlaceholder="Search stores by name, address, or city..."
                                searchable={true}
                                disabled={!brand_stores || brand_stores.length === 0 || isLoadingStoreConfig}
                                width="100%"
                                noResultsText="No stores found matching your search"
                            />
                        )}

                        {!isLoadingStores && (!brand_stores || brand_stores.length === 0) && (
                            <LoadingText>No stores found for this brand</LoadingText>
                        )}
                    </ConfigSection>

                    {/* Show loader while fetching store configuration */}
                    {isLoadingStoreConfig ? (
                        <ConfigSection>
                            <LoadingText>Loading store configuration...</LoadingText>
                        </ConfigSection>
                    ) : (
                        /* Theme Colors Section - Only show when not loading store config */
                        <ConfigSection>
                            <SectionTitle>
                                Editor Theme Colors
                                <OverlayTrigger
                                    placement="top"
                                    overlay={
                                        <Tooltip id="tooltip-top">
                                            More information here
                                        </Tooltip>
                                    }
                                >
                                    <span className="d-inline-block">
                                        <IoInformation />
                                    </span>
                                </OverlayTrigger>
                            </SectionTitle>


                            <ColorGrid>
                                {Object.entries(currentThemeColors).map(([colorKey, colorValue]) => (
                                    <ColorBox key={colorKey}>
                                        <ColorLabel>
                                            {colorLabels[colorKey] || colorKey}
                                        </ColorLabel>
                                        <ColorInputContainer>
                                            <ColorInput
                                                type="color"
                                                value={colorValue || "#000000"}
                                                onChange={(e) => handleColorChange(colorKey, e.target.value)}
                                                title={`Change ${colorLabels[colorKey] || colorKey}`}
                                                disabled={isSavingConfig}
                                            />
                                            <ColorValue>{colorValue}</ColorValue>
                                        </ColorInputContainer>
                                    </ColorBox>
                                ))}
                            </ColorGrid>
                        </ConfigSection>
                    )}

                    {/* Features Configuration Section */}
                    <ConfigSection>
                        <SectionTitle>
                            ⚙️ Features Configuration
                        </SectionTitle>

                        <ColorGrid>
                            <ColorBox style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <ColorLabel>Allow PDF Download</ColorLabel>
                                <div
                                    onClick={() => !isSavingConfig && handleConfigChange('is_downloadable', !configuration?.is_downloadable)}
                                    style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        backgroundColor: configuration?.is_downloadable ? 'var(--primary, #4084b5)' : '#ccc',
                                        position: 'relative',
                                        cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                                        transition: 'background-color 0.3s ease',
                                        flexShrink: 0,
                                    }}
                                >
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        position: 'absolute',
                                        top: '2px',
                                        left: configuration?.is_downloadable ? '22px' : '2px',
                                        transition: 'left 0.3s ease',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }} />
                                </div>
                            </ColorBox>
                        </ColorGrid>
                    </ConfigSection>

                    {/* Save Changes Section */}
                    <ConfigSection className="p-2 d-flex gap-2 flex-column justify-content-center align-items-center">

                        <PrimaryButton
                            onClick={handleSaveChanges}
                            disabled={!hasChanges || !store_id}
                            style={{
                                opacity: hasChanges ? 1 : 0.6,
                                cursor: hasChanges ? 'pointer' : 'not-allowed'
                            }}
                        >
                            <FaSave style={{ marginRight: '0.5rem' }} />
                            Save Changes
                        </PrimaryButton>

                        <LightPrimaryButton onClick={handleResetEditorConfiguration}>
                            <FaUndo style={{ marginRight: '0.5rem' }} />
                            Reset Configuration
                        </LightPrimaryButton>

                    </ConfigSection>
                </ConfigContainer>
            </div>
        </>
    );
}

export default EditorConfigurationAction;