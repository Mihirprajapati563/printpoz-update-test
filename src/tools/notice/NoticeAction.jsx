import React, { useEffect } from "react";

// ** redux  imports **//
import { useDispatch, useSelector } from "react-redux";
import {
  NoticeMessage,
  NoticeTitle,
} from "../../common-components/StyledComponents";
import {
  getActiveEditorType,
  getAllPages,
  getAllPagesLength,
  getAllPagesSettings,
  getCurrentPageIndex,
  getEditorErrors,
  getSettings,
} from "../../library/utils/helpers";
import { deSelectSafeArea, setPageNumber } from "../../store/slices/canvas";
import { setIsActionActive } from "../../store/slices/appAlice";
// ** redux slices and getter slices **//
import { getTotalPages } from "../../library/utils/helpers";
import { EDITOR_TYPES } from "../../library/utils/constants";
import { getPhotoBookPagelabel, getPageLabelForFoldableProduct, getPageLabelForLayflatWithCover, getPageLabelForTwoSideProduct } from "../../library/utils/common-functions";
import { EDITOR_SUB_TYPES } from "../../library/utils/constants";
// ** styled components **//
import {
  ActionTitle,
  DisplayBetween,
} from "../../common-components/StyledComponents";

// ** react-icons **//
import { LiaTimesSolid } from "react-icons/lia";
function NoticeAction() {
  const canvasErrors = useSelector(getEditorErrors);
  const dispatch = useDispatch();
  const totalPages = useSelector(getTotalPages);
  const activeEditorType = useSelector(getActiveEditorType);
  const activePageIndex = useSelector(getCurrentPageIndex);
  const AllPages = useSelector(getAllPages);
  const settings = useSelector(getSettings)
  const allPagesSettings = useSelector(getAllPagesSettings);
  const allPagesLength = useSelector(getAllPagesLength);

  return (
    <div className="sticker-container sticker-container-mob" style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '2px' }}>
      <DisplayBetween className="heading-action-mob" style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
        <ActionTitle>Errors</ActionTitle>
        <LiaTimesSolid
          onClick={() => dispatch(setIsActionActive(false))}
          className="cursor-pointer"
        />
      </DisplayBetween>

      <div className="scroll-container-mob" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingBottom: '20px' }}>
        {(canvasErrors.length > 0 && (
          <div className="">
            <div className="p-3 border-bottom">
              <p style={{ fontSize: "13px" }} className="mb-0">
                Your Attention is Needed:{" "}
                <span style={{ color: "var(--primary)" }}>
                  {" "}
                  {canvasErrors.length}{" "}
                </span>{" "}
                Remarks.
              </p>
            </div>
            {canvasErrors.map((error, index) => (
              <div className="p-2 border-bottom">
                <NoticeTitle>{error.title}</NoticeTitle>
                <NoticeMessage>{error.message}</NoticeMessage>
                <div className="d-flex justify-content-between  w-100 align-items-center mt-1">
                  <button
                    className="p-0 text-decoration-underline border-0 bg-transparent"
                    style={{ color: "#777777", fontSize: "13px" }}
                    onClick={() => {
                      setTimeout(() => {
                        dispatch(deSelectSafeArea());
                        dispatch(setPageNumber(error.pageIndex));
                      });
                    }}
                  >
                    Go to {AllPages.length > 1 ? "Page" : ""}
                  </button>
                  <p
                    className="mb-0"
                    style={{
                      fontSize: "10px",
                    }}
                  >
                    At{" "}
                    {
                      activeEditorType === EDITOR_TYPES.PHOTOBOOK
                        ? getPhotoBookPagelabel(error.pageIndex, AllPages.length)
                        : settings?.isFoldable && !settings?.coverEnabled
                          ? getPageLabelForFoldableProduct(error.pageIndex, allPagesSettings)
                          : activeEditorType === EDITOR_TYPES.LAYFLATALBUM && settings?.coverEnabled === true
                            ? getPageLabelForLayflatWithCover(error.pageIndex, allPagesLength, settings?.showFullCoverSheet)
                            : (activeEditorType === EDITOR_TYPES.VISITING_CARD ||
                              (activeEditorType === EDITOR_TYPES.GREETING_CARD &&
                                settings?.subtype === EDITOR_SUB_TYPES.GREETING_CARD.DOUBLE_SIDE))
                              ? getPageLabelForTwoSideProduct(error.pageIndex)
                              : `Page ${error.pageIndex + 1}`
                    }

                  </p>
                </div>
              </div>
            ))}
          </div>
        )) || (
            <div className="w-100 h-100 mt-5 d-flex justify-content-center align-items-center">
              <p className="text-center me-1 ">
                No errors available at the moment.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

export default NoticeAction;
