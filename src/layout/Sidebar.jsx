import { useDispatch, useSelector } from "react-redux";
import {
  ActionsBg,
  ActionsWrapper,
  MenuBadge,
  MenuIcon,
  MenuItem,
  MenuText,
  MenuWrapper,
  ParentWrapper,
  SidebarWrapper,
} from "../common-components/StyledComponents";
import { MenuJSON } from "../library/utils/jsons/commonJSON";
import { useEffect, useState, useRef } from "react";
import {
  setActiveActionIndex,
  setIsActionActive,
  setTextToolbarDialog,
} from "../store/slices/appAlice";
import {
  getActiveObjectprops,
  getActiveEditorType,
  getSettings,
  getEditorErrors,
} from "../library/utils/helpers";
import { USER_TYPES } from "../library/utils/constants";
import { setEditorMenuItems } from "../store/slices/canvas";
export const SideBar = ({ }) => {
  const [allMenuItems, setAllMenuItems] = useState(MenuJSON);
  const [menuItems, setMenuItems] = useState(MenuJSON);
  const canvasErrors = useSelector(getEditorErrors);
  const { activeActionIndex } = useSelector((state) => state.appSlice);
  const isManualTabChangeRef = useRef(false);
  const manualTabLockObjectIdRef = useRef(null);

  const dispatch = useDispatch();
  const activeObjectProps = useSelector(getActiveObjectprops);
  const activeEditorType = useSelector(getActiveEditorType);
  const isActive = useSelector((state) => state.appSlice.isActionActive);
  const usersDetails = localStorage.getItem("userDetails");
  const user = JSON.parse(usersDetails);
  const settings = useSelector(getSettings);

  const textToolbarDialog = useSelector((state) => state.appSlice.textToolbarDialog);

  // Animation states for sliding open/close
  const [shouldRender, setShouldRender] = useState(isActive);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else {
      setIsAnimatingOut(true);
      setShouldRender(false);

      // const timer = setTimeout(() => {
      //   setIsAnimatingOut(false);
      // }, 400); // Matches the 0.4s animation duration
      // return () => clearTimeout(timer);
    }
  }, [isActive]);

  // The active sidebar tab (activeActionIndex) lives in the Redux store, which
  // persists across route changes. So after closing a theme and opening another,
  // the sidebar would otherwise stay on whatever tab was last active (e.g. Ideas).
  // Reset it to the default Photos tab (index 0) whenever the editor mounts and
  // whenever the active theme changes, so a theme always opens with Photos.
  const activeThemeId = useSelector(
    (state) => state.projectSetup?.cartDetails?.theme_id
  );
  useEffect(() => {
    dispatch(setActiveActionIndex(0));
  }, [activeThemeId, dispatch]);

  const handleMenuItemClick = (index) => {
    isManualTabChangeRef.current = true;
    manualTabLockObjectIdRef.current = activeObjectProps?.id ?? null;
    // Clear text toolbar dialog when user manually clicks a menu tab
    if (textToolbarDialog) dispatch(setTextToolbarDialog(null));
    dispatch(setActiveActionIndex(index));
    dispatch(setIsActionActive(true));
  };


  useEffect(() => {
    dispatch(setIsActionActive(true));
  }, []);

  // Combined menu filtering logic in a single useEffect
  useEffect(() => {
    // Start with the full menu list
    let filteredMenu = [...allMenuItems];

    // Step 1: Filter based on editor type and visibilityConfig
    if (activeEditorType !== "calendar") {
      filteredMenu = filteredMenu.filter((item) => item.title !== "Calendar");
    }

    // Filter based on visibilityConfig (notAllowedEditorType)
    filteredMenu = filteredMenu.filter((item) => {
      if (item.visibilityConfig?.notAllowedEditorType) {
        return !item.visibilityConfig.notAllowedEditorType.includes(activeEditorType);
      }
      return true;
    });

    // Step 2: Apply customer-specific filtering (moved from Step 3)
    if (user?.userTypeCode === USER_TYPES.CUSTOMER) {
      // Only show menu items that are in the selectedMenuItems list. Guard against
      // a design whose settings lack selectedMenuItems (e.g. settings replaced/
      // stripped): fall back to the full menu instead of throwing on `.some`.
      const allowedMenuItems = Array.isArray(settings?.selectedMenuItems)
        ? settings.selectedMenuItems
        : [];
      if (allowedMenuItems.length > 0) {
        filteredMenu = filteredMenu.filter((item) =>
          allowedMenuItems.some((selectedItem) => selectedItem === item.title)
        );
      }

      // Always remove Setting and Editor Config from customer view
      filteredMenu = filteredMenu.filter(
        (item) => !["Setting", "ClipArt", "Editor Configuration"].includes(item.title)
      );

    }

    // Filter out admin-only items for non-admin/non-superadmin users
    if (user?.userTypeCode !== USER_TYPES.ADMIN && user?.userTypeCode !== USER_TYPES.SUPERUSER) {
      filteredMenu = filteredMenu.filter((item) => !item.adminOnly);
    }

    // if activeObject is null then remove objectsettng menu
    if (!activeObjectProps || !["img", "shape", "sticker"].includes(activeObjectProps?.type)) {
      filteredMenu = filteredMenu.filter(
        (item) => item.title !== "Edit"
      );
    } else if (["img", "shape", "sticker"].includes(activeObjectProps?.type)) {
      // alway add edit mennu at last second position
      if (!filteredMenu.some(item => item.title === "Edit")) {
        filteredMenu.splice(filteredMenu.length - 1, 0, allMenuItems.find(item => item.title === "Edit"))
      }
    }

    // Step 4: Auto-select tab based on selected object type
    // This runs AFTER Edit menu is added so it can be found
    // RUN ONLY if change is NOT manual
    // DISABLED on mobile (screen width <= 768px)
    const isMobile = window.innerWidth <= 768;

    if (
      isManualTabChangeRef.current &&
      (!activeObjectProps || manualTabLockObjectIdRef.current !== activeObjectProps?.id)
    ) {
      isManualTabChangeRef.current = false;
      manualTabLockObjectIdRef.current = null;
    }

    const isManualLockActive =
      isManualTabChangeRef.current &&
      manualTabLockObjectIdRef.current &&
      manualTabLockObjectIdRef.current === activeObjectProps?.id;

    const activeMenuTitle = filteredMenu[activeActionIndex]?.title;

    if (activeObjectProps && !isManualLockActive && !isMobile) {
      let targetMenuTitle = "";
      const hasImageUrl =
        typeof activeObjectProps.url === "string" && activeObjectProps.url.trim() !== "";
      const hasImageUrlsArray =
        Array.isArray(activeObjectProps.urls) && activeObjectProps.urls.length > 0;

      if (
        activeObjectProps.type === "text" &&
        ["Text", "Edit"].includes(activeMenuTitle)
        // || (activeObjectProps.type === "img" && (hasImageUrl || hasImageUrlsArray))
      ) {
        // Text and non-empty Image objects use floating toolbar — close sidebar panel
        dispatch(setIsActionActive(false));
      } else if (activeObjectProps.type === "calendar") {
        targetMenuTitle = "Calendar";
      } else if (
        activeObjectProps.type === "img" &&
        !hasImageUrl &&
        !hasImageUrlsArray
      ) {
        targetMenuTitle = "Photos";
      }
      // else if (["shape"].includes(activeObjectProps.type)) {
      //   targetMenuTitle = "Edit";
      // }

      if (targetMenuTitle) {
        const targetIndex = filteredMenu.findIndex(
          (item) => item.title === targetMenuTitle
        );

        if (targetIndex !== -1) {
          dispatch(setActiveActionIndex(targetIndex));
          dispatch(setIsActionActive(true)); // Also open the sidebar panel on mobile
          filteredMenu = filteredMenu.map((item) => ({
            ...item,
            isActive: item.title === targetMenuTitle,
          }));
        }
      }
    }

    if (!isManualLockActive) {
      isManualTabChangeRef.current = false;
      manualTabLockObjectIdRef.current = null;
    }

    setMenuItems(filteredMenu);
    let menuItems = filteredMenu.map(item => {
      return {
        title: item.title,
        isActive: item.isActive,
      }
    });
    if (activeActionIndex > menuItems.length - 1) {
      dispatch(setActiveActionIndex(0))
    }
    dispatch(setEditorMenuItems(menuItems));
  }, [activeObjectProps, settings, activeEditorType]);



  return (
    <>
      <SidebarWrapper className="sidebar-wrapper">
        <MenuWrapper>
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const errorCount =
              item.title === "Errors" ? canvasErrors?.length ?? 0 : 0;
            return (
              <MenuItem
                key={`${index}`}
                className={`${index === activeActionIndex && isActive ? "active" : ""
                  }`}
                onClick={(e) => {
                  handleMenuItemClick(index);
                }}
              >
                <MenuIcon>
                  <IconComponent />
                  {errorCount > 0 && (
                    <MenuBadge>{errorCount > 99 ? "99+" : errorCount}</MenuBadge>
                  )}
                </MenuIcon>
                <MenuText>{item.title}</MenuText>
              </MenuItem>
            );
          })}
        </MenuWrapper>
        {shouldRender && (
          <>
            <ActionsWrapper className={`actions-wrapper ${isAnimatingOut ? "slide-out" : "slide-in"}`}>
              {menuItems[activeActionIndex]?.action}
            </ActionsWrapper>
            <ActionsBg onClick={() => {
              dispatch(setIsActionActive(false));
              if (textToolbarDialog) dispatch(setTextToolbarDialog(null));
            }} />
          </>
        )}
      </SidebarWrapper>
    </>
  );
};
