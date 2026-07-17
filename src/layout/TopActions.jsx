import { useDispatch, useSelector } from "react-redux";
import React, { useEffect, useRef } from "react";
import { ReactComponent as Trash } from "../assets/icons/trash.svg";
import { ReactComponent as Copy } from "../assets/icons/paper.svg";
import { ReactComponent as AddImagePlaceHolder } from "../assets/icons/image_icon.svg";
import { ReactComponent as LockObjectIcon } from "../assets/icons/Lock1.svg";
import { ReactComponent as UnLockObjectIcon } from "../assets/icons/unlock121.svg";
import { ReactComponent as TextIcon } from "../assets/icons/typography_icon.svg";
import { ReactComponent as Undo } from "../assets/icons/undo.svg";
import { ReactComponent as Redo } from "../assets/icons/redo.svg";
import {
  ActionWrapperBox,
  Box,
  IconButton,
  AddPageButton,
  DisplayCenter,
} from "../common-components/StyledComponents.jsx";
import defaultPhotobookLayout from "../library/utils/jsons/sample-layouts/defaultPhotobookLayout.json";
import {
  getMinPages,
  getMaxPages,
  getTotalPages,
  getActiveEditorType,
  getCurrentPageIndex,
  getCurrentActivePage,
  getCanvasSize,
  getSettings,
  getActiveObjectprops,
} from "../library/utils/helpers";
import {
  EDITOR_SUB_TYPES,
  EDITOR_TYPES,
  USER_TYPES,
} from "../library/utils/constants/index.js";
import {
  addObjectInPage,
  addNewBlankPage,
  removePage,
  copyPage,
  setPageLayout,
  setActiveSide,
  setCurrentObjectProperties,
  addShapeToHistory,
  deSelectActiveObject,
} from "../store/slices/canvas";

import { ActionCreators as UndoActionCreators } from "redux-undo";
import { setIsMultiSelectMode } from "../store/slices/appAlice";
import { MdOutlineRectangle } from "react-icons/md";
import { MdOutlineCircle } from "react-icons/md";
import { MdSelectAll } from "react-icons/md";
import { isMobile } from "react-device-detect";
import RulerControl from "./RulerControl";
import CoverSpineControl from "./CoverSpineControl";
import { supportsCoverSettings } from "../library/utils/jsons/coverSettingsConfig";
export const TopActions = () => {
  const dispatch = useDispatch();
  const minPages = useSelector(getMinPages);
  const maxPages = useSelector(getMaxPages);
  const totalPages = useSelector(getTotalPages);
  const editorType = useSelector(getActiveEditorType);
  const currentPageIndex = useSelector(getCurrentPageIndex);
  const activePage = useSelector(getCurrentActivePage);
  const canvasSize = useSelector(getCanvasSize);
  const [allowAddPage, setAllowAddPage] = React.useState(false);
  const [allowCopyPage, setAllowCopyPage] = React.useState(false);
  const [allowDeletePage, setAllowDeletePage] = React.useState(false);
  const canUndo = useSelector((state) => state.canvas.past.length > 0);
  // Size/editor-details readout is shown to ALL users (admins AND customers) — the
  // customer editor should also surface the current canvas size. Defaults on so it
  // renders immediately regardless of userType (the admin effect below is now a
  // redundant no-op kept for clarity).
  const [displayEditorDetails, setDisplayEditorDetails] = React.useState(true);
  const settings = useSelector(getSettings);
  const canRedo = useSelector((state) => state.canvas.future.length > 0);

  const canUndoRef = useRef(canUndo);
  const canRedoRef = useRef(canRedo);
  const themeDetails = useSelector((state) => state.projectSetup.themeDetails);
  const currentActiveObject = useSelector(getActiveObjectprops);
  const isMultiSelectMode = useSelector(
    (state) => state.appSlice.isMultiSelectMode
  );
  const users = localStorage.getItem("userDetails");
  const userType = JSON.parse(users)?.userTypeCode || -1;

  useEffect(() => {
    canUndoRef.current = canUndo;
    canRedoRef.current = canRedo;
  }, [canUndo, canRedo]);
  useEffect(() => {
    if (
      editorType === EDITOR_TYPES.PHOTOBOOK ||
      editorType === EDITOR_TYPES.LAYFLATALBUM ||
      editorType === EDITOR_TYPES.PRINT ||
      userType === USER_TYPES.SUPERUSER ||
      userType === USER_TYPES.ADMIN ||
      userType === USER_TYPES.EMPLOYEE
    ) {
      if (editorType !== EDITOR_TYPES.PRINT) {
        setAllowAddPage(true);
      }
      setAllowCopyPage(true);
      setAllowDeletePage(true);
    } else {
      setAllowAddPage(false);
      setAllowCopyPage(false);
      setAllowDeletePage(false);
    }

    // Calendars are inherently multi-page (one page per month, plus cover pages),
    // so customers must be able to manage pages too — the generic branch above
    // only grants Add/Copy/Delete to photobook/layflat/print or to staff users,
    // which hid all three for a customer opening a Calendar theme. Calendars have
    // no photobook/layflat cover-page guards (deletePage/copySelectedPage gate
    // those by editor type, and hidePageActions is false for calendars), so
    // enabling all three is safe here.
    if (editorType === EDITOR_TYPES.CALENDER) {
      setAllowAddPage(true);
      setAllowCopyPage(true);
      setAllowDeletePage(true);
    }

    if (
      userType === USER_TYPES.SUPERUSER ||
      userType === USER_TYPES.ADMIN ||
      userType === USER_TYPES.EMPLOYEE
    ) {
      setDisplayEditorDetails(true);
    }
  }, [editorType]);
  const handleUndo = () => {
    if (canUndoRef.current) {
      dispatch(UndoActionCreators.undo());
    }
  };
  const addShape = (shape) => {
    const obj = {};
    obj.type = "shape";
    obj.shape = shape;
    obj.x = 30;
    obj.y = 30;
    dispatch(addObjectInPage(obj));
    dispatch(addShapeToHistory(shape));
  };

  const handleRedo = () => {
    if (canRedoRef.current) {
      dispatch(UndoActionCreators.redo());
    }
  };

  useEffect(() => {
    let isCtrlZPressed = false;
    let isCtrlYPressed = false;

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      if (e.ctrlKey && key === "z" && !isCtrlZPressed) {
        isCtrlZPressed = true;
        handleUndo();
      }
      if (e.ctrlKey && key === "y" && !isCtrlYPressed) {
        isCtrlYPressed = true;
        handleRedo();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === "z") {
        isCtrlZPressed = false;
      }
      if (key === "y") {
        isCtrlYPressed = false;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Cleanup event listeners on component unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  const addEmptyPlaceholder = () => {
    const obj = {};
    obj.type = "img";
    obj.x = 10;
    obj.y = 10;
    obj.url = "";

    dispatch(addObjectInPage(obj));
  };
  const addnewPage = () => {
    // Maximum-pages limit disabled — customers can add unlimited pages.
    /* allow super user and admin to add any number of pages and don't allow customer to add page more than maximum allowed pages
    if (
      (editorType === EDITOR_TYPES.PHOTOBOOK
        ? totalPages * 2 - 6
        : editorType === EDITOR_TYPES.LAYFLATALBUM
        ? settings?.coverEnabled === true
          ? !settings?.showFullCoverSheet
            ? totalPages * 2 - 4
            : totalPages * 2 - 2
          : totalPages * 2
        : totalPages) >= maxPages &&
      !(
        userType === USER_TYPES.SUPERUSER ||
        userType === USER_TYPES.ADMIN ||
        userType === USER_TYPES.EMPLOYEE
      )
    ) {
      // display message to customer for maximum pages allowed
      alert("you reached the maximum pages allowed " + maxPages);
      return;
    }
    */
    // take confirmation from customer to add new page
    // if customer confirms then add new page

    if (!window.confirm("Are you sure you want to add a new page?")) {
      return;
    }

    dispatch(setCurrentObjectProperties(null));
    dispatch(addNewBlankPage());
    dispatch(setPageLayout(defaultPhotobookLayout.layouts[0]));
    if (defaultPhotobookLayout.layouts.length > 1) {
      dispatch(setActiveSide(1));
      dispatch(setPageLayout(defaultPhotobookLayout.layouts[1]));
    }

    dispatch(setActiveSide(0));
  };
  const copySelectedPage = () => {
    // Maximum-pages limit disabled — customers can copy pages without an upper limit.
    /* allow super user and admin to copy any number of pages and don't allow customer to copy page more than maximum allowed pages
    if (
      (editorType === EDITOR_TYPES.PHOTOBOOK
        ? totalPages * 2 - 6
        : editorType === EDITOR_TYPES.LAYFLATALBUM
        ? settings?.coverEnabled === true
          ? !settings?.showFullCoverSheet
            ? totalPages * 2 - 4
            : totalPages * 2 - 2
          : totalPages * 2
        : totalPages) >= maxPages &&
      !(
        userType === USER_TYPES.SUPERUSER ||
        userType === USER_TYPES.ADMIN ||
        userType === USER_TYPES.EMPLOYEE
      )
    ) {
      alert("Sorry you reached the maximum pages allowed " + maxPages);
      return;
    }
    */

    // take confirmation from customer to copy new page
    if (!window.confirm("Are you sure you want to copy this page?")) {
      return;
    }

    // copy the current page
    // if editor type is photobok and current page is 0 or 1 or last page then dont allow to copy the page
    if (
      editorType === EDITOR_TYPES.PHOTOBOOK &&
      (currentPageIndex === 0 ||
        currentPageIndex === 1 ||
        currentPageIndex === totalPages - 1 ||
        currentPageIndex === totalPages - 2)
    ) {
      return;
    }

    dispatch(setCurrentObjectProperties(null));
    dispatch(copyPage());
    dispatch(setActiveSide(0));
  };

  const deletePage = () => {
    // Minimum-pages limit disabled — customers can delete pages without a lower limit.
    /* allow super user and admin to remove any number of pages and don't allow customer to remove page less than minimum allowed pages
    if (
      (editorType === EDITOR_TYPES.PHOTOBOOK
        ? totalPages * 2 - 6
        : editorType === EDITOR_TYPES.LAYFLATALBUM
        ? settings?.coverEnabled === true
          ? !settings?.showFullCoverSheet
            ? totalPages * 2 - 4
            : totalPages * 2 - 2
          : totalPages * 2
        : totalPages) <= minPages &&
      !(
        userType === USER_TYPES.SUPERUSER ||
        userType === USER_TYPES.ADMIN ||
        userType === USER_TYPES.EMPLOYEE
      )
    ) {
      alert(
        "Sorry you can not delete the page, minimum pages allowed are " +
          minPages
      );
      return;
    }
    */
    // if editorType= "photobook" then dont allow to delete first page, second page and last page

    if (
      (editorType === EDITOR_TYPES.PHOTOBOOK &&
        (currentPageIndex === 0 ||
          currentPageIndex === 1 ||
          currentPageIndex === totalPages - 1)) ||
      (editorType === EDITOR_TYPES.LAYFLATALBUM &&
        settings.coverEnabled === true &&
        !settings.showFullCoverSheet &&
        (currentPageIndex === 0 || currentPageIndex === totalPages - 1))
    ) {
      return;
    }
    // delete the current page
    // if there is only minimum page allowed pages then dont delete it
    // if there are more than one page then delete the current page and set the current page to the previous page
    // if the current page is the first page then delete the current page and set the current page to the next page
    // if the current page is the last page then delete the current page and set the current page to the previous page

    // take confirmation from customer to delete the page
    if (!window.confirm("Are you sure you want to delete the page?")) {
      return;
    }

    dispatch(setCurrentObjectProperties(null));
    dispatch(removePage());
    dispatch(setActiveSide(0));
  };
  const addTextinCanvas = () => {
    const obj = {};
    obj.type = "text";
    obj.x = 10;
    obj.y = 50;

    obj.width = 300;
    obj.height = 60;
    dispatch(setCurrentObjectProperties(null));
    dispatch(addObjectInPage(obj));
  };

  const handleMultiSelectToggle = () => {
    const nextMode = !isMultiSelectMode;
    dispatch(setIsMultiSelectMode(nextMode));
    if (!nextMode) {
      dispatch(deSelectActiveObject());
    }
  };

  // Hide the Copy Page & Delete Page buttons on cover / special pages.
  //  • Photo Book: front cover (0), the first special page (1), the back cover
  //    (totalPages - 1) and the page before the back cover (totalPages - 2).
  //  • Layflat Album: only the cover pages, keyed off the page's `isCoverPage`
  //    flag so it works for BOTH the two half-sheet covers (front @ 0, back @
  //    last) AND the single full-spread cover (@ 0) without hiding interior
  //    spreads. Fixed-index checks wrongly hid every interior spread once a
  //    full cover spread reshapes the pages array (small albums lost all pages).
  // Interior spreads keep the buttons; other editor types are unaffected.
  // Computed inline (not in the [editorType] effect) so it reacts to page nav.
  const isPhotobookCoverOrSpecialPage =
    editorType === EDITOR_TYPES.PHOTOBOOK &&
    (currentPageIndex === 0 ||
      currentPageIndex === 1 ||
      currentPageIndex === totalPages - 1 ||
      currentPageIndex === totalPages - 2);
  const isLayflatCoverPage =
    editorType === EDITOR_TYPES.LAYFLATALBUM &&
    activePage?.isCoverPage === true;
  const hidePageActions = isPhotobookCoverOrSpecialPage || isLayflatCoverPage;

  return (
    <>
      <DisplayCenter mb="10px" className="top-action-mob" id="top-action-mob">
        {!isMobile &&
          ((settings.allowSticker && userType === USER_TYPES.CUSTOMER) ||
            userType !== USER_TYPES.CUSTOMER) && (
            <Box className="icon-18 me-2">
              <ActionWrapperBox>
                <IconButton>
                  <MdOutlineRectangle
                    onClick={() => addShape("rect")}
                    title="Add Rectangle"
                    className="cursor-pointer me-3"
                  />
                  <MdOutlineCircle
                    onClick={() => addShape("circle")}
                    title="Add Circle"
                    className="cursor-pointer "
                  />
                </IconButton>
              </ActionWrapperBox>
            </Box>
          )}

        {/* <Box className="icon-18 me-2">
          <ActionWrapperBox>
            <IconButton>
              <Undo
                onClick={handleUndo}
                title="Undo"
                className="cursor-pointer me-3"
              />
              <Redo
                onClick={handleRedo}
                title="Redo"
                className="cursor-pointer "
              />
            </IconButton>
          </ActionWrapperBox>
        </Box> */}
        {((settings.allowText && userType === USER_TYPES.CUSTOMER) ||
          userType !== USER_TYPES.CUSTOMER ||
          (settings.allowImage && userType === USER_TYPES.CUSTOMER) ||
          userType !== USER_TYPES.CUSTOMER) && (
          <Box className="icon-18 me-2">
            <ActionWrapperBox>
              <IconButton className="gap-3">
                {((settings.allowText && userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                  <TextIcon
                    onClick={addTextinCanvas}
                    title="Add text"
                    className="cursor-pointer"
                  />
                )}
                {((settings.allowImage && userType === USER_TYPES.CUSTOMER) ||
                  userType !== USER_TYPES.CUSTOMER) && (
                  <AddImagePlaceHolder
                    onClick={addEmptyPlaceholder}
                    title="Add an empty photo slot"
                    className="cursor-pointer"
                  />
                )}
              </IconButton>
            </ActionWrapperBox>
          </Box>
        )}

        {isMobile && (
          <Box className="icon-18 me-2">
            <ActionWrapperBox>
              <IconButton className="gap-2">
                <MdSelectAll
                  onClick={handleMultiSelectToggle}
                  title={isMultiSelectMode ? "Done selecting" : "Select multiple objects"}
                  className="cursor-pointer"
                  style={{ color: isMultiSelectMode ? "var(--primary)" : undefined }}
                />
                <span
                  onClick={handleMultiSelectToggle}
                  className="cursor-pointer"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: isMultiSelectMode ? "var(--primary)" : "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isMultiSelectMode ? "Done" : "Select"}
                </span>
              </IconButton>
            </ActionWrapperBox>
          </Box>
        )}

        {allowAddPage && (
          <Box className="icon-18 me-2">
            <ActionWrapperBox>
              <IconButton>
                <AddPageButton onClick={() => addnewPage()}>
                  <span className="me-2">+</span>Add Page
                </AddPageButton>
              </IconButton>
            </ActionWrapperBox>
          </Box>
        )}

        {(allowCopyPage || allowDeletePage) && !hidePageActions && (
          <Box className="icon-18 me-2">
            <ActionWrapperBox>
              <IconButton>
                {allowCopyPage && (
                  <Copy
                    onClick={() => copySelectedPage()}
                    className="me-2 cursor-pointer"
                    title="Copy Page"
                  />
                )}
                {allowDeletePage && (
                  <Trash
                    onClick={() => deletePage()}
                    className="cursor-pointer"
                    title="Delete Page"
                  />
                )}
              </IconButton>
            </ActionWrapperBox>
          </Box>
        )}

        {/* Ruler toggle + unit changer (view-only preference) */}
        <Box className="icon-18 me-2">
          <ActionWrapperBox>
            <RulerControl />
          </ActionWrapperBox>
        </Box>

        {/* Cover & spine — customer-facing (admins use the Setting tab, which is
            hidden from customers). Only photobook / layflat have cover settings;
            gate the WRAPPER too (not just CoverSpineControl, which self-returns
            null) so other categories don't render an empty toolbar box. */}
        {userType === USER_TYPES.CUSTOMER && supportsCoverSettings(editorType) && (
          <Box className="icon-18 me-2">
            <ActionWrapperBox>
              <CoverSpineControl />
            </ActionWrapperBox>
          </Box>
        )}

        {/* lock unlock action */}
        {currentActiveObject !== null &&
          currentActiveObject !== undefined &&
          !currentActiveObject?.isProcessing &&
          userType === USER_TYPES.CUSTOMER &&
          !(
            currentActiveObject?.disabledForClient
          ) && (
            <Box className="icon-18 me-2">
              <ActionWrapperBox>
                {!currentActiveObject?.locked && (
                  <UnLockObjectIcon
                    onClick={() =>
                      dispatch(setCurrentObjectProperties({ locked: true }))
                    }
                    title="Lock Movement"
                    className="cursor-pointer m-1"
                  />
                )}
                {currentActiveObject && currentActiveObject.locked && (
                  <LockObjectIcon
                    onClick={() =>
                      dispatch(setCurrentObjectProperties({ locked: false }))
                    }
                    title="UnLock Movement"
                    className="cursor-pointer m-1"
                  />
                )}
              </ActionWrapperBox>
            </Box>
          )}

        {displayEditorDetails && (
          <Box
            className="icon-18 me-2"
            style={{
              position: "fixed",
              right: "0px",
              maxWidth: "170px",
              top: "80px",
              zIndex: "999",
              fontSize: "10px",
            }}
          >
            <ActionWrapperBox>
              <IconButton>
                <div>
                  {editorType} - {canvasSize.width}x{canvasSize.height}
                  <br />
                  Size: {canvasSize.width - canvasSize.depth * 2}x{canvasSize.height - canvasSize.depth * 2}
                  <br />
                  Depth: {canvasSize.depth}
                  <br />
                  {themeDetails && themeDetails.theme_name && (
                    <span>Theme: {themeDetails.theme_name}</span>
                  )}
                  {settings && settings.subtype && (
                    <span>
                      {" "}
                      <br />
                      Subtype: {settings.subtype}
                    </span>
                  )}
                </div>
              </IconButton>
            </ActionWrapperBox>
          </Box>
        )}
      </DisplayCenter>
    </>
  );
};
