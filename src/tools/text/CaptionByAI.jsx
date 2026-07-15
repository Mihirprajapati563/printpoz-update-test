import {
  ActionInnerTitle,
  AICaptionItem,
  BackgroundColorItem,
  BackgroundColorItemSmall,
  Box,
  ButtonComponent,
  CollapseButton,
  DisplayBetween,
  DisplayCenter,
  DisplayStart,
  FlexBox,
  HighLightTex,
  MaskItem,
  StyledCollapse,
  TextAlignButton,
  TextSelect,
  ThemeTitle,
} from "../../common-components/StyledComponents.jsx";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice.js";
import { FaPlus } from "react-icons/fa";
import { FaMinus } from "react-icons/fa";
import { useEffect, useState } from "react";
import { EDITOR_ASSETS } from "../../library/utils/constants/index.js";
import { apiPost } from "../../library/utils/common-services/apiCall.js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl.js";
import { getActiveEditorType } from "../../library/utils/helpers/index.js";

import { setTextCaptions } from "../../store/slices/appAlice.js";
import OpenAI from "openai";
export const CaptionsAI = ({ onCaptionClick }) => {
  const [openSection, setOpenSection] = useState("ideas");

  const dispatch = useDispatch();
  const editorType = useSelector(getActiveEditorType);
  const [loading, setLoading] = useState(false);
  const projectSetup = useSelector((state) => state.projectSetup);
  const captions = useSelector((state) => state.appSlice.textCaptions);
  let themeId;

  if (
    projectSetup &&
    projectSetup.themeDetails &&
    projectSetup.themeDetails.theme_id
  ) {
    themeId = projectSetup.themeDetails.theme_id;
  }

  const handleToggle = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  // Initialize OpenAI Configuration

  const getCaptions = () => {
    setLoading(true);
    const data = {
      theme_id: themeId ? themeId : null,
      editor_type: editorType,
      isPrompt: false,
    };

    // Fetch captions from the API
    apiPost(ENDPOINTS.getTextCaptions, data)
      .then((response) => {
        if (response && response.items) {
          // Set the state with the response data for the selected category and page number to render the fetched images list for the selected category and page number and set the total pages count for the selected category based on the total count of the fetched images divided by the images per page count to render the pagination component accordingly for the selected category and page number to render the selected page of the fetched images list for the selected category and page number to render the selected page of the fetched images list for the selected category and page number to render the selected page of the fetched images list for the selected category
          if (response.status === 1) {
            if (response.items && response.items.suggestions) {
              dispatch(setTextCaptions(response.items.suggestions));
            }
          }
        }
      })
      .catch((error) => {
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!captions || captions.length === 0) {
      getCaptions();
    }
  }, []);

  return (
    <>
      <Box className="mt-3">
        <Box>
          {!loading &&
            ((captions &&
              Array.isArray(captions) &&
              captions.length > 0 &&
              captions.every((caption) => typeof caption === "string") && (
                <>
                  <Box>
                    <ActionInnerTitle fontweight="500">
                      AI-Generated Text
                    </ActionInnerTitle>
                  </Box>
                  {captions.map((caption, index) => (
                    <AICaptionItem
                      key={index}
                      onClick={() => onCaptionClick(caption)}
                    >
                      {caption}
                    </AICaptionItem>
                  ))}
                </>
              )) || <HighLightTex>No captions available</HighLightTex>)}

          {loading && <HighLightTex>Generating Caption Idea...</HighLightTex>}
        </Box>
      </Box>
    </>
  );
};
