import React, { useEffect, useMemo, useState } from "react";

// ** redux  imports **//
import { useDispatch, useSelector } from "react-redux";
import { getSettings, getPageSettings, getTotalSafeAreaCount, getActiveEditorType } from "../../library/utils/helpers";
import {
  setPageNumber,
  setBackgroundImage,
  removeSafeArea,
} from "../../store/slices/canvas";
import { setIsActionActive } from "../../store/slices/appAlice";
// ** redux slices and getter slices **//
import { getTotalPages } from "../../library/utils/helpers";
import { EDITOR_TYPES, USER_TYPES } from "../../library/utils/constants";
import {
  getActiveObjectprops,
  getActiveSafeArea,
} from "../../library/utils/helpers";
import {
  setCurrentObjectProperties,
  setCurrentSafeAreaProperties,
} from "../../store/slices/canvas";
// ** styled components **//
import {
  ActionTitle,
  DisplayBetween,
  LightPrimaryButton,
  PrimaryButton,
} from "../../common-components/StyledComponents";
import styled from "styled-components";

// ** react-icons **//
import { LiaTimesSolid } from "react-icons/lia";
import { FaCheck } from "react-icons/fa";
import { BiFontFamily } from "react-icons/bi";
import { Form } from "react-bootstrap";
import { MenuJSON } from "../../library/utils/jsons/commonJSON";
import {
  setSettings,
  setPageSettings,
  addSafeAreaInPage,
} from "../../store/slices/canvas";
import {
  ObjetctWiseSettingJSON,
  globalSettingJSON,
  pageWiseSettingJSON,
} from "../../library/utils/jsons/commonJSON";
import { v4 as uuidv4 } from "uuid";
import FontManagementDialog from "../../components/popups/FontManagementDialog";
// ** Styled Components for SettingAction **//
const SettingContainer = styled.div`
  padding: 0.75rem;
  background-color: var(--surface, #f8f9fa);
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  color: var(--foreground);
`;

const SettingSection = styled.div`
  background-color: var(--card, #ffffff);
  border-radius: 12px;
  padding: 0.8rem 0.5rem;
  margin-bottom: 0.9rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
  }
`;

const SectionTitle = styled.h5`
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--heading-color, #111827);
  margin-bottom: 0.4rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const SectionSubtitle = styled.p`
  font-size: 0.78rem;
  color: #6b7280;
  margin: 0 0 0.6rem 0;
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.4rem 0.35rem;
  gap: 12px;
  margin-bottom: 0.35rem;
  transition: background-color 0.2s ease;
  border-radius: 8px;
  position: relative;
  overflow: visible;

  &:hover {
    background-color: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  &:hover .tooltip-bubble {
    opacity: 1;
    transform: translateY(calc(-100% - 4px));
  }
`;

const SettingLabel = styled.div`
  font-size: 0.9rem;
  color: var(--text-muted, #374151);
  flex: 1;
`;

const SettingInstruction = styled.span`
  font-size: 0.75rem;
  color: var(--muted-foreground);
  margin-top: 2px;
`;

const TooltipBubble = styled.div`
  position: absolute;
  top: -6px;
  right: 0;
  transform: translateY(-100%);
  background: var(--foreground);
  color: var(--background);
  padding: 8px 10px;
  font-size: 0.75rem;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
  max-width: 260px;
  line-height: 1.2;

  &:after {
    content: "";
    position: absolute;
    bottom: -6px;
    right: 14px;
    border-width: 6px 6px 0 6px;
    border-style: solid;
    border-color: var(--foreground) transparent transparent transparent;
  }
`;

const CustomCheckbox = styled.div`
  position: relative;
  width: 38px;
  height: 20px;
  margin-top: 2px;
  background: ${(props) =>
    props.checked
      ? "var(--primary)"
      : "color-mix(in srgb, var(--foreground) 20%, transparent)"};
  border-radius: 9999px;
  transition: background 0.25s ease, box-shadow 0.2s ease;
  cursor: pointer;
  outline: none;

  &:after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${(props) => (props.checked ? "20px" : "2px")};
    width: 16px;
    height: 16px;
    background-color: var(--primary-foreground);
    border-radius: 50%;
    transition: left 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transform: ${(props) => (props.checked ? "scale(1.05)" : "scale(1.0)")};
  }

  &:hover {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent);
  }

  &:active:after {
    transform: scale(0.95);
  }
`;

const MenuGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 8px;
  margin-top: 0.5rem;
`;

const MenuItemContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 5px;
  border-radius: 6px;
  background-color: ${(props) => (props.active ? "var(--secondary)" : "var(--background)")};
  border: 1px solid
    ${(props) => (props.active ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 12%, transparent)")};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }
`;

const MenuTitle = styled.span`
  font-size: 0.7rem;
  margin-top: 5px;
  color: var(--foreground);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const CheckIcon = styled.div`
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
`;
function SettingAction() {
  const dispatch = useDispatch();
  const [allMenuItems, setAllMenuItems] = useState(
    MenuJSON.filter((item) => !["Setting", "ClipArt", "Edit"].includes(item.title))
  );
  const [selectedMenuItems, setSelectedMenuItems] = useState([]);
  const activeObjectProps = useSelector(getActiveObjectprops);
  const userDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(userDetails);
  const settings = useSelector(getSettings);
  const pageSettings = useSelector(getPageSettings);
  const activeEditorType = useSelector(getActiveEditorType);

  const [isKeyboardFocus, setIsKeyboardFocus] = useState(false);
  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false);
  const isAdmin = user?.userTypeCode == USER_TYPES.SUPERUSER;
  const [safeAreaSettings, setSafeAreaSettings] = useState({
    height: 0,
    width: 0,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  const activeSafeArea = useSelector(getActiveSafeArea);
  const safeAreaCount = useSelector(getTotalSafeAreaCount)

  useEffect(() => {
    setSelectedMenuItems(settings.selectedMenuItems);
  }, [settings]);

  const handleMenuItemClick = (item) => {
    let updatedMenuitems = [];

    // Check if the item is already selected
    const isSelected = selectedMenuItems?.some((menuItem) => menuItem === item);

    if (isSelected) {
      // Remove item if already selected
      updatedMenuitems = selectedMenuItems.filter(
        (menuItem) => menuItem !== item
      );
    } else {
      // Add item if not already selected
      updatedMenuitems = [...(selectedMenuItems || []), item];
    }

    setSelectedMenuItems(updatedMenuitems);
    dispatch(setSettings({ ...settings, selectedMenuItems: updatedMenuitems }));
  };

  const handleCheckboxChange = (setting, value) => {
    dispatch(setSettings({ ...settings, [setting]: value }));
  };

  const handleObjectPropertyChange = (property, value) => {
    if (activeObjectProps) {
      dispatch(setCurrentObjectProperties({ [property]: value }));
    }
  };
  const handlePageWiseSettingChange = (setting, value) => {
    dispatch(setPageSettings({ [setting]: value }));
  };

  const handleSafeAreaAdd = (e) => {
    dispatch(
      addSafeAreaInPage({
        id: uuidv4(),
      })
    );
    // all form inputs will be reset
    setSafeAreaSettings({
      height: 0,
      width: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  };

  const handleSafeAreaRemove = () => {
    dispatch(removeSafeArea());
  };

  // remove layout section from menu settings when any  safe area is added
  useEffect(() => {
    let filteredItems = MenuJSON.filter((item) => !["Setting", "ClipArt", "Edit", "Editor Configuration"].includes(item.title));
    
    // Filter based on visibilityConfig (notAllowedEditorType)
    filteredItems = filteredItems.filter((item) => {
      if (item.visibilityConfig?.notAllowedEditorType) {
        return !item.visibilityConfig.notAllowedEditorType.includes(activeEditorType);
      }
      return true;
    });

    if (safeAreaCount > 0) {
      setAllMenuItems(filteredItems.filter((item) => item.title !== "Layout"));
    } else {
      setAllMenuItems(filteredItems);
    }
  }, [safeAreaCount, activeEditorType]);

  return (
    <>
    <div className="sticker-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '2px' }}>
      <DisplayBetween className="heading-action-mob mb-2" style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
        <div className="d-flex flex-column">
          <ActionTitle>Settings</ActionTitle>
        </div>
        <LiaTimesSolid
          onClick={() => dispatch(setIsActionActive(false))}
          className="cursor-pointer"
          size={20}
        />
      </DisplayBetween>
      <SettingContainer className="scroll-container-mob" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingBottom: '20px' }}>

      {/* Object Wise Settings */}
      {
        activeObjectProps && (
          <SettingSection className="mt-2">
            <SectionHeader>
              <SectionTitle>Object Wise Settings</SectionTitle>
            </SectionHeader>
            <SectionSubtitle>
              Set how this object behaves for customers.
            </SectionSubtitle>

            {ObjetctWiseSettingJSON.map((setting, index) => {
              // Skip rendering if setting is for specific object type and doesn't match current object
              if (
                (setting.objectType[0] !== "any"
                  && (activeObjectProps === null ||
                    activeObjectProps === undefined ||
                    !setting.objectType.includes(activeObjectProps.type)))
                || (
                  !setting.allowedEditorType[0] === "any" &&
                  !setting.allowedEditorType.includes(activeEditorType)
                ) ||
                (setting.allowedSubEditorType[0] !== "any" &&
                  !setting.allowedSubEditorType.includes(settings?.subtype))

              ) {
                return null;
              }

              // Map property names from JSON to match actual property names in activeObjectProps if needed
              let propertyName = setting.settingProperty;
              return (
                <SettingRow key={index}>
                  <SettingLabel>
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ fontWeight: 600 }}>{setting.title}</span>
                    </div>
                  </SettingLabel>
                  <CustomCheckbox
                    checked={
                      activeObjectProps &&
                      activeObjectProps?.[propertyName] === true
                    }
                    onClick={() =>
                      handleObjectPropertyChange(
                        propertyName,
                        activeObjectProps
                          ? !activeObjectProps?.[propertyName]
                          : false
                      )
                    }
                    // title={setting.instruction}
                    role="switch"
                    aria-checked={activeObjectProps && activeObjectProps?.[propertyName] === true}
                    aria-label={setting.title}
                    tabIndex={0}
                    focused={isKeyboardFocus}
                    onFocus={() => setIsKeyboardFocus(true)}
                    onBlur={() => setIsKeyboardFocus(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleObjectPropertyChange(
                          propertyName,
                          activeObjectProps
                            ? !activeObjectProps?.[propertyName]
                            : false
                        );
                      }
                    }}
                  />
                  {setting.instruction && (
                    <TooltipBubble className="tooltip-bubble">{setting.instruction}</TooltipBubble>
                  )}
                </SettingRow>
              );
            })}
          </SettingSection>
        )
      }

      {/* Global Settings */}
      <SettingSection>
        <SectionHeader>
          <SectionTitle>Global Settings</SectionTitle>
        </SectionHeader>
        <SectionSubtitle>
          Apply settings to the entire editor experience.
        </SectionSubtitle>
        {/* <SettingRow>
          <SettingLabel>Custom Shapes</SettingLabel>
          <CustomCheckbox
            checked={settings.subtype && settings.subtype === "custom_shape"}
            onClick={() =>
              handleCheckboxChange(
                "subtype",
                settings.subtype === "custom_shape" ? "" : "custom_shape"
              )
            }
            title="When enabled, custom shape tools will be available"
          />
        </SettingRow> */}

        {/* Global Settings */}
        {globalSettingJSON.map((setting, index) => {
          if ((setting?.allowedEditorType && setting?.allowedEditorType.length > 0 ? setting?.allowedEditorType.includes(activeEditorType) : !setting?.notAllowedEditorType?.includes(activeEditorType)) && (setting?.dependentSetting?.trim() ? settings[setting?.dependentSetting] : true)) {
            return (
              <SettingRow key={index}>
                <SettingLabel>
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ fontWeight: 600 }}>{setting.title}</span>
                  </div>
                </SettingLabel>
                {setting.inputType === "number" ? (
                  <Form.Group controlId={setting.settingProperty} className="mb-0">
                    <Form.Label className="font-weight-bold text-dark d-none">
                      {setting.title}
                    </Form.Label>
                    <Form.Control
                      type="number"
                      value={settings[setting.settingProperty] ?? ""}
                      min={setting?.min}
                      onChange={(e) => {
                        const value = e.target.value;

                        if (value === "") {
                          handleCheckboxChange(setting.settingProperty, "");
                          return;
                        }

                        const num = Number(value);
                        if (!isNaN(num)) {
                          handleCheckboxChange(setting.settingProperty, num);
                        }
                      }}
                      onBlur={(e) => {
                        let value = Number(e.target.value);

                        if (!value || value < 1) {
                          value = value;
                        }

                        handleCheckboxChange(setting.settingProperty, value);
                      }}
                      style={{
                        width: "50px",
                        padding: "4px 2px",
                        textAlign: "center",
                        fontSize: "0.85rem",
                      }}
                    />
                  </Form.Group>
                ) : (
                  <CustomCheckbox
                    checked={settings[setting.settingProperty] === true}
                    onClick={() =>
                      handleCheckboxChange(
                        setting.settingProperty,
                        !settings[setting.settingProperty]
                      )
                    }
                  // title={setting.instruction}
                    role="switch"
                    aria-checked={settings[setting.settingProperty] === true}
                    aria-label={setting.title}
                    tabIndex={0}
                    focused={isKeyboardFocus}
                    onFocus={() => setIsKeyboardFocus(true)}
                    onBlur={() => setIsKeyboardFocus(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCheckboxChange(
                          setting.settingProperty,
                          !settings[setting.settingProperty]
                        );
                      }
                    }}
                  />
                )}
                {setting.instruction && (
                  <TooltipBubble className="tooltip-bubble">{setting.instruction}</TooltipBubble>
                )}
              </SettingRow>
            );
          }
        })}
      </SettingSection>

      {/* Page Wise Settings */}
      <SettingSection>
        <SectionHeader>
          <SectionTitle>Page Wise Settings</SectionTitle>
        </SectionHeader>
        <SectionSubtitle>
          Configure options that apply to the current page.
        </SectionSubtitle>
        {pageWiseSettingJSON.map((setting, index) => {
          // Allow setting if isFoldable is true and setting has allowWhenFoldable flag
          const isFoldableOverride = setting.allowWhenFoldable === true && settings?.isFoldable === true;
          if (isFoldableOverride || !setting?.notAllowedEditorType?.includes(activeEditorType)) {
            return (
              <SettingRow key={index}>
                <SettingLabel>
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ fontWeight: 600 }}>{setting.title}</span>
                  </div>
                </SettingLabel>

                <CustomCheckbox
                  checked={pageSettings?.[setting?.settingProperty] === true}
                  onClick={() =>
                    handlePageWiseSettingChange(
                      setting.settingProperty,
                      !pageSettings?.[setting.settingProperty]
                    )
                  }
                  // title={setting.instruction}
                  role="switch"
                  aria-checked={pageSettings?.[setting?.settingProperty] === true}
                  aria-label={setting.title}
                  tabIndex={0}
                  focused={isKeyboardFocus}
                  onFocus={() => setIsKeyboardFocus(true)}
                  onBlur={() => setIsKeyboardFocus(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handlePageWiseSettingChange(
                        setting.settingProperty,
                        !pageSettings?.[setting.settingProperty]
                      );
                    }
                  }}
                />
                {setting.instruction && (
                  <TooltipBubble className="tooltip-bubble">{setting.instruction}</TooltipBubble>
                )}
              </SettingRow>
            );
          }
        })}

        {activeSafeArea && (
          <SettingRow>
            <SettingLabel>
              <div className="d-flex align-items-center gap-1">
                <span style={{ fontWeight: 600 }}>Lock Safe Area</span>
              </div>
            </SettingLabel>

            <CustomCheckbox
              checked={activeSafeArea?.isLocked === true}
              onClick={() =>
                dispatch(
                  setCurrentSafeAreaProperties({
                    ...activeSafeArea,
                    isLocked: !activeSafeArea?.isLocked,
                  })
                )
              }
              role="switch"
              aria-checked={activeSafeArea?.isLocked === true}
              aria-label="Lock Safe Area"
              tabIndex={0}
              focused={isKeyboardFocus}
              onFocus={() => setIsKeyboardFocus(true)}
              onBlur={() => setIsKeyboardFocus(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  dispatch(
                    setCurrentSafeAreaProperties({
                      ...activeSafeArea,
                      isLocked: !activeSafeArea?.isLocked,
                    })
                  );
                }
              }}
            />
            <TooltipBubble className="tooltip-bubble">When enabled, the active safe area cannot be moved or resized.</TooltipBubble>
          </SettingRow>
        )}
        <div className="d-flex justify-content-center align-items-center gap-2 mt-2">
          {!activeSafeArea ? (
            <div className="text-center">
              <PrimaryButton onClick={(e) => handleSafeAreaAdd(e)}>
                Add Safe Area
              </PrimaryButton>
              <div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <PrimaryButton onClick={() => handleSafeAreaRemove()}>
                Remove Safe Area
              </PrimaryButton>
              <div>
              </div>
            </div>
          )}
        </div>
      </SettingSection>

      {/* Font Management - Admin Only */}
      {isAdmin && (
        <SettingSection>
          <SectionHeader>
            <SectionTitle>Font Management</SectionTitle>
          </SectionHeader>
          <SectionSubtitle>
            Manage custom fonts for the editor.
          </SectionSubtitle>
          <div className="text-center">
            <PrimaryButton
              onClick={() => setIsFontDialogOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <BiFontFamily size={18} />
              Font Management
            </PrimaryButton>
          </div>
        </SettingSection>
      )}

      {/* Menu Items Settings */}
      {/* <SettingSection>
        <SectionHeader>
          <SectionTitle>Menu Visibility</SectionTitle>
        </SectionHeader>

        <small
          className="d-block mb-2 text-muted"
          style={{ fontSize: "0.75rem" }}
        >
          Bellow selected menu items will be visible to customer's interface
        </small>
        <MenuGrid>
          {allMenuItems?.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = selectedMenuItems?.includes(item.title);

            return (
              <MenuItemContainer
                key={index}
                active={isActive}
                onClick={() => handleMenuItemClick(item.title)}
              // title={`${isActive
              //   ? "This tool will be visible to customers"
              //   : "Click to show this tool to customers"
              //   }`}
              >
                <IconComponent
                  style={{
                    height: "20px",
                    width: "20px",
                    // fill: isActive ? "var(--primary, #4084B5)" : "#555",
                    // stroke: isActive ? "var(--primary, #4084B5)" : "#555",
                  }}
                />
                <MenuTitle>{item.title}</MenuTitle>
                {isActive && (
                  <CheckIcon>
                    <FaCheck size={8} />
                  </CheckIcon>
                )}
              </MenuItemContainer>
            );
          })}
        </MenuGrid>
      </SettingSection> */}
      </SettingContainer>
    </div>

    {/* Font Management Dialog */}
    {isFontDialogOpen && (
      <FontManagementDialog
        isOpen={isFontDialogOpen}
        onClose={() => setIsFontDialogOpen(false)}
      />
    )}
  </>
  );
}

export default SettingAction;
