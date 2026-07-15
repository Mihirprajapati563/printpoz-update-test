import {
  ActionInnerTitle,
  ActionTitle,
  Box,
  DisplayBetween,
  FlexBox,
  FrameItem,
  SearchBox,
  SearchInput,
  StyledTabs,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import { ReactComponent as SearchIcon } from "../../assets/icons/search.svg";
import { ReactComponent as FilterIcon } from "../../assets/icons/bars-filter.svg";
import { Tab } from "react-bootstrap";
import { useState } from "react";
import {
  TempFramesEveryDay,
  TempFramesUsed,
} from "../../library/utils/jsons/commonJSON";
export const FramesAction = () => {
  const [activeTab, setActiveTab] = useState("all");
  const dispatch = useDispatch();
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };
  return (
    <>
      <DisplayBetween>
        <ActionTitle>Frames</ActionTitle>
        <LiaTimesSolid
          onClick={() => dispatch(setIsActionActive(false))}
          className="cursor-pointer"
        />
      </DisplayBetween>
      <Box mt="15px">
        <SearchBox>
          <Box className="search-icon">
            <SearchIcon />
          </Box>
          <SearchInput type="text" placeholder="Search Frames" />
          <Box className="filter-icon">
            <FilterIcon />
          </Box>
        </SearchBox>
      </Box>
      <StyledTabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        id="controlled-tab-example"
      >
        <Tab eventKey="all">
          <Box className="frame-box side-bar-scroll">
            <Box mt="15px">
              <DisplayBetween mb="15px" mr="5px">
                <ActionInnerTitle
                  fontsize="12px"
                  fontweight="500"
                  lineheight="14.06px"
                >
                  Used in this project
                </ActionInnerTitle>
                <ActionInnerTitle
                  onClick={() => handleTabSwitch("used")}
                  fontsize="12px"
                  fontweight="500"
                  lineheight="14.06px"
                  className="cursor-pointer"
                >
                  See all
                </ActionInnerTitle>
              </DisplayBetween>
              <Box>
                <FlexBox gap="7px">
                  {TempFramesUsed.map((item, index) => (
                    <FrameItem
                      src={item.src}
                      alt={`used-frame-${index + 1}`}
                      key={`frame-item-used-${index + 1}`}
                    />
                  ))}
                </FlexBox>
              </Box>
            </Box>
            <Box mt="15px">
              <DisplayBetween mb="15px" mr="5px">
                <ActionInnerTitle
                  fontsize="12px"
                  fontweight="500"
                  lineheight="14.06px"
                >
                  Every Day
                </ActionInnerTitle>
                <ActionInnerTitle
                  onClick={() => handleTabSwitch("every-day")}
                  fontsize="12px"
                  fontweight="500"
                  lineheight="14.06px"
                  className="cursor-pointer"
                >
                  See all
                </ActionInnerTitle>
              </DisplayBetween>
            </Box>
            <Box>
              <FlexBox gap="7px">
                {TempFramesEveryDay.map((item, index) => (
                  <FrameItem
                    src={item.src}
                    alt={`every-day-frame-${index + 1}`}
                    key={`frame-item-every-day-${index + 1}`}
                  />
                ))}
              </FlexBox>
            </Box>
          </Box>
        </Tab>
        <Tab eventKey="used">
          <Box mt="15px" className="frame-box-inner side-bar-scroll">
            <DisplayBetween mb="15px" mr="5px">
              <ActionInnerTitle
                fontsize="12px"
                fontweight="500"
                lineheight="14.06px"
              >
                Used in this project
              </ActionInnerTitle>
              <ActionInnerTitle
                onClick={() => handleTabSwitch("all")}
                fontsize="12px"
                fontweight="500"
                lineheight="14.06px"
                className="cursor-pointer"
              >
                Go Back
              </ActionInnerTitle>
            </DisplayBetween>
            <FlexBox gap="7px">
              {TempFramesUsed.map((item, index) => (
                <FrameItem
                  src={item.src}
                  alt={`used-frame-${index + 1}`}
                  key={`frame-item-used-${index + 1}`}
                />
              ))}
            </FlexBox>
          </Box>
        </Tab>
        <Tab eventKey="every-day">
          <Box mt="15px" className="frame-box-inner side-bar-scroll">
            <DisplayBetween mb="15px" mr="5px">
              <ActionInnerTitle
                fontsize="12px"
                fontweight="500"
                lineheight="14.06px"
              >
                Every Day
              </ActionInnerTitle>
              <ActionInnerTitle
                onClick={() => handleTabSwitch("all")}
                fontsize="12px"
                fontweight="500"
                lineheight="14.06px"
                className="cursor-pointer"
              >
                Go Back
              </ActionInnerTitle>
            </DisplayBetween>
            <FlexBox gap="7px">
              {TempFramesEveryDay.map((item, index) => (
                <FrameItem
                  src={item.src}
                  alt={`every-day-frame-${index + 1}`}
                  key={`frame-item-every-day-${index + 1}`}
                />
              ))}
            </FlexBox>
          </Box>
        </Tab>
      </StyledTabs>
    </>
  );
};
