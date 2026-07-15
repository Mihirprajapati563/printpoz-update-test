import {
  ActionInnerTitle,
  ActionTitle,
  BackgroundColorItem,
  BackgroundColorItemSmall,
  Box,
  ButtonComponent,
  TextLabel,
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
  PrimaryButton,
  LightPrimaryButton,
} from "../../common-components/StyledComponents";
import { LiaTimesSolid } from "react-icons/lia";
import { useDispatch, useSelector } from "react-redux";
import { setIsActionActive } from "../../store/slices/appAlice";
import { FaPlus } from "react-icons/fa";

import {
  Fontfamilies,
  fontSizesSmalls,
  TempBackgroudColors,
  TempThemes,
} from "../../library/utils/jsons/commonJSON";
import { useEffect, useState, useCallback, useRef } from "react";

import { v4 as uuidv4 } from "uuid";
import {
  getActiveEditorType,
  getCanvasSize,
  getActiveObjectprops,
  getCurrentActivePage,
  getCurrentActiveSize,
  getCalendarSettings,
} from "../../library/utils/helpers";
import {
  addObjectInPage,
  setCurrentObjectProperties,
  setCalendarSettings,
  updateCalendarSettingsInAllPages,
} from "../../store/slices/canvas";
import { SketchPicker } from "react-color";
import ColorPickerWithOpacity from "../../components/popups/ColorPickerWithOpacity";
import ColorPickerPortal from "../../components/popups/ColorPickerPortal";
import { Form, Row, Col } from "react-bootstrap"; // Import Bootstrap components
import { USER_TYPES } from "../../library/utils/constants";
import { useFontContext } from "../../library/utils/context/FontContext";
import CustomFontAccordion from "../text/CustomFontAccordion";

export const CalendarAction = () => {
  const [openSection, setOpenSection] = useState(null);
  const dispatch = useDispatch();
  const currentPage = useSelector(getCurrentActiveSize);
  const canvasSize = useSelector(getCanvasSize);
  const activeObjectProps = useSelector(getActiveObjectprops);
  // getCalendarSettings returns null when editorType !== "calendar". This panel can
  // stay mounted for a frame while the editor type transitions during theme design,
  // so fall back to {} to keep every direct calendarSetings.X read below null-safe.
  const calendarSetings = useSelector(getCalendarSettings) || {};
  const [fontFamily, setFontFamily] = useState(
    calendarSetings && calendarSetings.fontFamily
      ? calendarSetings.fontFamily
      : "Arial"
  );

  const [fwList, setFwList] = useState([]);
  const baseReferenceWidth = 500;
  const isCustomFontRef = useRef(false);
  const isFontEffectMountRef = useRef(true);

  // Custom fonts from backend
  const { isFontLoaded, loadFont } = useFontContext();
  // List of months
  const monthsList = [
    { name: "January", smallName: "Jan", value: "1" },
    { name: "February", smallName: "Feb", value: "2" },
    { name: "March", smallName: "March", value: "3" },
    { name: "April", smallName: "April", value: "4" },
    { name: "May", smallName: "May", value: "5" },
    { name: "June", smallName: "June", value: "6" },
    { name: "July", smallName: "July", value: "7" },
    { name: "August", smallName: "Aug", value: "8" },
    { name: "September", smallName: "Sept", value: "9" },
    { name: "October", smallName: "Oct", value: "10" },
    { name: "November", smallName: "Nov", value: "11" },
    { name: "December", smallName: "Dec", value: "12" },
  ];
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 11 }, (_, i) =>
    (currentYear + i).toString()
  );

  const [pickerAnchorRect, setPickerAnchorRect] = useState(null);
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [displayBGColorPicker, setDisplayBGColorPicker] = useState(false);
  const [displayAlternativeBGColorPicker, setDisplayAlternativeBGColorPicker] =
    useState(false);
  const [displayHeaderBGColorPicker, setDisplayHeaderBGColorPicker] =
    useState(false);
  const [displayHeaderTextColorPicker, setDisplayHeaderTextColorPicker] =
    useState(false);
  const [displayWeekendTextColorPicker, setDisplayWeekendTextColorPicker] =
    useState(false);
  const [
    displayWeekendBackgroundColorPicker,
    setDisplayWeekendBackgroundColorPicker,
  ] = useState(false);

  const [displayBorderColorPicker, setDisplayBorderColorPicker] =
    useState(false);
  const [
    displayMonthBackGroundColorPicker,
    setDisplayMonthBackGroundColorPicker,
  ] = useState(false);
  const [displayMonthTextColorPicker, setDisplayMonthTextColorPicker] =
    useState(false);
    const userDetail = localStorage.getItem("userDetails");
    const user = JSON.parse(userDetail);
  useEffect(() => {
    if (
      activeObjectProps &&
      activeObjectProps !== null &&
      activeObjectProps !== undefined &&
      activeObjectProps.type === "calendar" &&
      activeObjectProps.font
    ) {
      // if(textId === activeObjectProps.id) {
      //     return;
      // }
      //  setTextId(activeObjectProps.id);
      setFontFamily(calendarSetings.fontFamily);
      //  setFontSize(activeObjectProps.font.size);
      // setFontStyle(activeObjectProps.font.weight);
    }
  }, [activeObjectProps]);

  const noOfMonthsPerPage = calendarSetings.noOfMonthsPerPage || 1;
  const handleStartMonthChange = (e) => {
    const newStartMonth = e.target.value;
    dispatch(setCalendarSettings({ startMonth: newStartMonth })); // Dispatch action with updated month and year
  };

  const handleStartYearChange = (e) => {
    const newStartYear = e.target.value;
    dispatch(setCalendarSettings({ startYear: newStartYear })); // Dispatch action with updated month and year
  };
  const handleDayNameChange = (e) => {
    const newDayNameFormat = e.target.value;
    dispatch(updateCalendarSettingsInAllPages({ dayNameFormat: newDayNameFormat }));
  };
  const handleBorderWidthChange = (e, history) => {
    dispatch(updateCalendarSettingsInAllPages({ borderWidth: e.target.value, history }));
  };

  const handleBorderRadiusChange = (e, history) => {
    dispatch(updateCalendarSettingsInAllPages({ borderRadius: e.target.value, history }));
  };
  const handleCellMarginChange = (e, history) => {
    dispatch(updateCalendarSettingsInAllPages({ cellMargin: parseInt(e.target.value), history }));
  };

  useEffect(() => {
    // Skip static Fontfamilies lookup for custom fonts — fwList is already set by handleCustomVariantSelect
    if (isCustomFontRef.current) {
      isCustomFontRef.current = false;
      return;
    }

    let newREc = Fontfamilies.find((x) => x.value === fontFamily);
    if (newREc && newREc.fw) {
      setFwList(newREc.fw);
    }

    // On initial mount, just populate fwList — don't dispatch to all pages
    // since nothing has actually changed (we're reading the existing font setting).
    if (isFontEffectMountRef.current) {
      isFontEffectMountRef.current = false;
      return;
    }

    if (newREc && newREc.code) {
      dispatch(updateCalendarSettingsInAllPages({ language: newREc.code }));
    } else {
      dispatch(updateCalendarSettingsInAllPages({ language: "en" }));
    }
  }, [fontFamily]);

  const calculateFontSize = (baseSize, referenceWidth = baseReferenceWidth) => {
    const scalingFactor = canvasSize.width / referenceWidth;
    return Math.round(baseSize * scalingFactor);
  };

  const settextFontSize = (e) => {
    let baseSize = e.target.value;
    const scaledSize = calculateFontSize(baseSize);

    dispatch(updateCalendarSettingsInAllPages({ fontSize: scaledSize }));
  };

  const setColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ textColor: value }));
  };

  const handleColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayColorPicker(!displayColorPicker);
  };

  const handleColorPickerClose = () => {
    setDisplayColorPicker(false);
  };
  // bacground color picker
  const setBGColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ backgroundColor: value }));
  };
  const setAlternativeBGColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ alternativeBgColor: value }));
  };
  const handleBGColorChange = (color) => {
    setBGColor(color.hex);
  };

  const handleBGColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayBGColorPicker(!displayBGColorPicker);
  };

  const handleBGColorPickerClose = () => {
    setDisplayBGColorPicker(false);
  };

  const handleAlternativeBGColorChange = (color) => {
    setAlternativeBGColor(color.hex);
  };

  const handleAlternativeBGColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayAlternativeBGColorPicker(!displayAlternativeBGColorPicker);
  };

  const handleAlternativeBGColorPickerClose = () => {
    setDisplayAlternativeBGColorPicker(false);
  };

  const setHeaderBGColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ headerBgColor: value }));
  };
  const handleHeaderBGColorChange = (color) => {
    setHeaderBGColor(color.hex);
  };

  const handleHeaderBGColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayHeaderBGColorPicker(!displayHeaderBGColorPicker);
  };

  const handleHeaderBGColorPickerClose = () => {
    setDisplayHeaderBGColorPicker(false);
  };

  const setHeaderTextColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ headerTextColor: value }));
  };

  const handleHeaderTextColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayHeaderTextColorPicker(!displayHeaderTextColorPicker);
  };

  const handleHeaderTextColorPickerClose = () => {
    setDisplayHeaderTextColorPicker(false);
  };

  const setWeekendTextColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ weekendTextColor: value }));
  };
  const handleWeekEndTextColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayWeekendTextColorPicker(!displayWeekendTextColorPicker);
  };
  const handleWeekendTextColorPickerClose = () => {
    setDisplayWeekendTextColorPicker(false);
  };

  const setWeekendBackgroundColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ weekendBgColor: value }));
  };
  const handleWeekEndBackgroundColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayWeekendBackgroundColorPicker(!displayWeekendBackgroundColorPicker);
  };
  const handleWeekendBackgroundColorPickerClose = () => {
    setDisplayWeekendBackgroundColorPicker(false);
  };

  const setMonthBackGroundColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ monthBgColor: value }));
  };
  const handleMonthBackGroundColorChange = (color) => {
    setMonthBackGroundColor(color.hex);
  };
  const handleMonthBackGroundColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayMonthBackGroundColorPicker(!displayMonthBackGroundColorPicker);
  };
  const handleMonthBackGroundColorPickerClose = () => {
    setDisplayMonthBackGroundColorPicker(false);
  };
  const setMonthTextColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ monthTextColor: value }));
  };
  const handleMonthTextColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayMonthTextColorPicker(!displayMonthTextColorPicker);
  };
  const handleMonthTextColorPickerClose = () => {
    setDisplayMonthTextColorPicker(false);
  };
  const setBorderColor = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ borderColor: value }));
  };
  const handleBorderColorPickerClick = (e) => {
    setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
    setDisplayBorderColorPicker(!displayBorderColorPicker);
  };

  const handleBorderColorPickerClose = () => {
    setDisplayBorderColorPicker(false);
  };

  const setFFamily = (value) => {
    isCustomFontRef.current = false; // Switching to static font
    setFontFamily(value);
    dispatch(updateCalendarSettingsInAllPages({ fontFamily: value }));
  };

  // Callback for CustomFontAccordion when a variant is selected
  const handleCustomVariantSelect = useCallback((font, styleEntry) => {
    const weight = styleEntry.weight;
    const style = styleEntry.style || "normal";

    isCustomFontRef.current = true;
    setFontFamily(font.name);

    // Build weight list from backend styles
    const newFwList = font.styles.map((s) => ({
      name: s.label,
      value: s.weight,
    }));
    setFwList(newFwList);

    dispatch(updateCalendarSettingsInAllPages({ fontFamily: font.name, fontWeight: String(weight) }));
  }, [dispatch]);
  const setFontWeight = (value) => {
    dispatch(updateCalendarSettingsInAllPages({ fontWeight: value }));
  };
  useEffect(() => {
    // set default font weight to first item in the list
    if (fwList && fwList.length > 0 && !calendarSetings.fontWeight) {
      dispatch(setCalendarSettings({ fontWeight: fwList[0].value }));
    } else {
      if (
        fwList &&
        fwList.length > 0 &&
        !fwList.find((x) => x.value === parseInt(calendarSetings.fontWeight))
      ) {
        dispatch(setCalendarSettings({ fontWeight: fwList[0].value }));
      }
    }
  }, [fwList]);
  const addCalendarInCanvas = () => {
    const obj = {};
    obj.type = "calendar";
    obj.x = 10;
    obj.y = 10;
    dispatch(addObjectInPage(obj));
  };

  // add muliple month calendar
  const addMultipleCalendarInCanvas = () => {
    let x = 10;
    let y = 50;
    for (let i = 0; i < noOfMonthsPerPage; i++) {
      // 1. Dispatch Calendar Grid
      const calObj = {
        type: "multiple-calendar",
        month: i,
        x: x,
        y: y,
        noOfMonthsPerPage: noOfMonthsPerPage,
      };
      calObj.id = `cal_${Date.now()}_${i}`; // Temporary ID for easy grouping if needed
      dispatch(addObjectInPage(calObj));
      
      // 2. Dispatch Month Text Label accurately tied to this grid
      // Derive dimensions from the same font-size formula used by addObjectInPage
      const dynamicFontSize = Math.round(16 * (canvasSize.width / 500));
      const monthObj = {
        type: "text",
        subtype: "month",
        text: "month",
        month: i,
        noOfMonthsPerPage: noOfMonthsPerPage,
        x: x,
        y: Math.max(10, y - 40),
        width: Math.round(dynamicFontSize * 4.5),  // fits longest month name ("September") + padding
        height: Math.round(dynamicFontSize * 1.2), // 1 line of text with padding
      };
      
      // Inherit visual settings if present
      if (calendarSetings?.monthTextColor) {
         monthObj.color = calendarSetings.monthTextColor;
      }
      if (calendarSetings?.fontFamily) {
         monthObj.font = { family: calendarSetings.fontFamily };
      }
      if (calendarSetings?.fontWeight) {
         monthObj.font = { ...monthObj.font, weight: calendarSetings.fontWeight };
      }
      
      dispatch(addObjectInPage(monthObj));

      x += 40;
      y += 40;
    }
  };

  const addMonthBoxInCanvas = () => {
    const obj = {};
    obj.type = "text";
    obj.subtype = "month";
    obj.text = "month";
    
    let targetMonth = 0;
    let targetNoOfMonths = calendarSetings?.noOfMonthsPerPage || 1;
    if(activeObjectProps?.month !== null && activeObjectProps?.month !== undefined)
    {
      targetMonth = activeObjectProps?.month;
    }
    if(activeObjectProps?.noOfMonthsPerPage){
      targetNoOfMonths = activeObjectProps?.noOfMonthsPerPage;
    }
    const dynamicFontSize = Math.round(16 * (canvasSize.width / 500));
    obj.month = targetMonth;
    obj.noOfMonthsPerPage = targetNoOfMonths;
    obj.x = 10;
    obj.y = 10;
    obj.width = Math.round(dynamicFontSize * 4.5);  // fits longest month name ("September") + padding
    obj.height = Math.round(dynamicFontSize * 1.2); // 1 line of text with padding
    dispatch(addObjectInPage(obj));
  };
  const addYearBoxInCanvas = () => {
    const obj = {};
    obj.type = "text";
    obj.subtype = "year";
    obj.text = "year";

    let targetMonth = 0;
    let targetNoOfMonths = calendarSetings?.noOfMonthsPerPage || 1;
    if(activeObjectProps?.month !== null && activeObjectProps?.month !== undefined)
    {
      targetMonth = activeObjectProps?.month;
    }
    if(activeObjectProps?.noOfMonthsPerPage){
      targetNoOfMonths = activeObjectProps?.noOfMonthsPerPage;
    }
    const dynamicFontSize = Math.round(16 * (canvasSize.width / 500));
    obj.month = targetMonth;
    obj.noOfMonthsPerPage = targetNoOfMonths;
    obj.x = 10;
    obj.y = 10;
    obj.width = Math.round(dynamicFontSize * 2.5);  // fits 4-digit year + padding
    obj.height = Math.round(dynamicFontSize * 1.2); // 1 line of text with padding
    dispatch(addObjectInPage(obj));
  };
  const handleLanguageChange = (e) => {
    dispatch(updateCalendarSettingsInAllPages({ language: e.target.value }));

    let ff = Fontfamilies.find((x) => x.code === e.target.value);
    if (ff && ff.value) {
      setFFamily(ff.value);
    }
  };

  return (
    <>
      <div className="container mt-3 sticker-container sticker-container-mob">
        <DisplayBetween className="heading-action-mob">
          <ActionTitle>Calendar Settings</ActionTitle>
          <LiaTimesSolid
            onClick={() => dispatch(setIsActionActive(false))}
            className="cursor-pointer"
          />
        </DisplayBetween>
        <div className="scroll-container-mob">
          <Box mt="10px">
            <ButtonComponent
              onClick={() => addCalendarInCanvas()}
              color="#232323"
              rounded="7px"
            >
              <DisplayCenter>
                <FaPlus width="17px" height="17px" />
                <Box ml="10px">Add Calendar</Box>
              </DisplayCenter>
            </ButtonComponent>
            <ButtonComponent
              mt="10px"
              onClick={() => addMonthBoxInCanvas()}
              color="#232323"
              rounded="7px"
            >
              <DisplayCenter>
                <FaPlus width="17px" height="17px" />
                <Box ml="10px">Add Month Box</Box>
              </DisplayCenter>
            </ButtonComponent>
            <ButtonComponent
              mt="10px"
              onClick={() => addYearBoxInCanvas()}
              color="#232323"
              rounded="7px"
            >
              <DisplayCenter>
                <FaPlus width="17px" height="17px" />
                <Box ml="10px">Add Year Box</Box>
              </DisplayCenter>
            </ButtonComponent>
          </Box>
          
          {
            user?.userTypeCode !== USER_TYPES.CUSTOMER && (
          <Box mt="10px" bgColor="#f2f2f2" p="10px" br="10px">
            <TextLabel>Multiple Calendar</TextLabel>
            <FlexBox justify="space-between" mt="10px">
              <TextSelect
                mt="12px"
                width="50%"
                value={noOfMonthsPerPage}
                onChange={(e) =>
                  dispatch(
                    setCalendarSettings({ noOfMonthsPerPage: e.target.value })
                  )
                }
              >
                {Array.from({ length: 12 }, (_, i) => i).map((month, index) => (
                  <option key={index} value={month + 1}>
                    {month + 1}
                  </option>
                ))}
              </TextSelect>
              <LightPrimaryButton onClick={() => addMultipleCalendarInCanvas()}>
                Add
              </LightPrimaryButton>
            </FlexBox>
          </Box>
        )}
          {/* <Box mt="15px">
                        <TextLabel>Choose language:</TextLabel>
                        <TextSelect width="120px" value={calendarSetings.language} onChange={handleLanguageChange}>
                        <option value="en">English</option>
                        <option value="gu">Gujarati</option>
                            <option value="hi">Hindi</option>
                            <option value="mr">Marathi</option>
                            <option value="ta">Tamil</option>
                            <option value="te">Telugu</option>
                            <option value="kn">Kannada</option>
                            <option value="ml">Malayalam</option>
                            <option value="bn">Bengali</option>
                            <option value="or">Oriya</option>
                            <option value="pa">Punjabi</option>
                            <option value="as">Assamese</option>
                           
                        </TextSelect>
                    </Box> */}

          <Box mt="10px">
            <DisplayBetween mt="10px">
              <Box>
                <TextLabel>Start Month</TextLabel>
                <TextSelect
                  width="90px"
                  value={calendarSetings.startMonth}
                  onChange={handleStartMonthChange}
                >
                  {monthsList.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.name}
                    </option>
                  ))}
                </TextSelect>
              </Box>
              <Box>
                <TextLabel>Start Year</TextLabel>
                <TextSelect
                  width="80px"
                  value={calendarSetings.startYear}
                  onChange={handleStartYearChange}
                >
                  {yearsList.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </TextSelect>
              </Box>
            </DisplayBetween>
          </Box>
          <Box mt="15px">
            <TextLabel>Font Size</TextLabel>
            <TextSelect
              mt="5px"
              value={
                Math.round(
                  (calendarSetings.fontSize
                    ? calendarSetings.fontSize
                    : 36) /
                    (canvasSize.width / baseReferenceWidth)
                ) || "36"
              }
              width="100%"
              onChange={(e) => settextFontSize(e)}
            >
              {fontSizesSmalls.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </TextSelect>
          </Box>

            <Box mt="15px">
            <TextLabel>Week Columns:</TextLabel>
            <TextSelect
              width="80px"
              value={calendarSetings.weeksColumns || 1}
              onChange={(e) =>
                dispatch(updateCalendarSettingsInAllPages({ weeksColumns: parseInt(e.target.value) }))
              }
            >
              <option value={1}>1 (Default)</option>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </TextSelect>
          </Box>


          {/* Custom Fonts from Backend */}
          <CustomFontAccordion
            fontFamily={fontFamily}
            activeFont={calendarSetings ? { family: calendarSetings.fontFamily, weight: calendarSetings.fontWeight } : null}
            onVariantSelect={handleCustomVariantSelect}
            isTextSelected={true}
          />

          <Box mt="15px">
            <TextLabel>Choose day name format:</TextLabel>
            <TextSelect
              width="80px"
              value={calendarSetings.dayNameFormat}
              onChange={handleDayNameChange}
            >
              <option key="shortName" value="short">
                Short
              </option>
              <option key="tinyName" value="tiny">
                Tiny
              </option>
              <option key="fullName" value="full">
                Full
              </option>
            </TextSelect>
          </Box>

          {/* General Settings */}
          <Box mt="15px">
            {/* <ActionInnerTitle fontweight="500">---------------</ActionInnerTitle> */}

            {/* Background Color */}
            <Box mt="10px">
              <TextLabel>Background Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleBGColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />
                {displayBGColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleBGColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.backgroundColor
                        ? activeObjectProps?.calendarSettings?.backgroundColor
                        : calendarSetings.backgroundColor
                        ? calendarSetings.backgroundColor
                        : "#FFFFFF"
                    }
                    onChange={(hexColor) => setBGColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setBGColor(item.bgcolor)}
                    key={`bgcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* alternative Color */}
            <Box mt="10px">
              <TextLabel>Alternative Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleAlternativeBGColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayAlternativeBGColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleAlternativeBGColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.alternativeBgColor
                        ? activeObjectProps?.calendarSettings?.alternativeBgColor
                        : calendarSetings.alternativeBgColor
                        ? calendarSetings.alternativeBgColor
                        : "#FFFFFF"
                    }
                    onChange={(hexColor) => setAlternativeBGColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setAlternativeBGColor(item.bgcolor)}
                    key={`bgcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Text Color */}
            <Box mt="10px">
              <TextLabel fontweight="500">Text Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.textColor
                        ? activeObjectProps?.calendarSettings?.textColor
                        : calendarSetings.textColor
                        ? calendarSetings.textColor
                        : "#000000FF"
                    }
                    onChange={(hexColor) => setColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setColor(item.bgcolor)}
                    key={`textcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Header Background Color */}
            <Box mt="10px">
              <TextLabel>Header Background Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleHeaderBGColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayHeaderBGColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleHeaderBGColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.headerBgColor
                        ? activeObjectProps?.calendarSettings?.headerBgColor
                        : calendarSetings.headerBgColor
                        ? calendarSetings.headerBgColor
                        : "#000000FF"
                    }
                    onChange={(hexColor) => setHeaderBGColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setHeaderBGColor(item.bgcolor)}
                    key={`bgcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Header Text Color */}
            <Box mt="10px">
              <TextLabel>Header Text Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleHeaderTextColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayHeaderTextColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleHeaderTextColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.headerTextColor
                        ? activeObjectProps?.calendarSettings?.headerTextColor
                        : calendarSetings.headerTextColor
                        ? calendarSetings.headerTextColor
                        : "#000000FF"
                    }
                    onChange={(hexColor) => setHeaderTextColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setHeaderTextColor(item.bgcolor)}
                    key={`headertextcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Weekend Text Color */}
            <Box mt="10px">
              <TextLabel>Weekend Text Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleWeekEndTextColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayWeekendTextColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleWeekendTextColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.weekendTextColor
                        ? activeObjectProps?.calendarSettings?.weekendTextColor
                        : calendarSetings.weekendTextColor
                        ? calendarSetings.weekendTextColor
                        : "#000000FF"
                    }
                    onChange={(hexColor) => setWeekendTextColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setWeekendTextColor(item.bgcolor)}
                    key={`weekendtextcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Weekend Background Color */}
            <Box mt="10px">
              <TextLabel>Weekend Background Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleWeekEndBackgroundColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayWeekendBackgroundColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleWeekendBackgroundColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.weekendBgColor
                        ? activeObjectProps?.calendarSettings?.weekendBgColor
                        : calendarSetings.weekendBgColor
                        ? calendarSetings.weekendBgColor
                        : "#FFFFFFFF"
                    }
                    onChange={(hexColor) => setWeekendBackgroundColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setWeekendBackgroundColor(item.bgcolor)}
                    key={`weekendtextcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>

            {/* Month Text Color */}
            {/* <Box mt="10px">
              <TextLabel>Month Text Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleMonthTextColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayMonthTextColorPicker ? (
                  <div style={{ position: "absolute", zIndex: "2", right: 0 }}>
                    <div
                      style={{
                        position: "fixed",
                        top: "0px",
                        right: "0px",
                        bottom: "0px",
                        left: "0px",
                      }}
                      onClick={handleMonthTextColorPickerClose}
                    />
                    <ColorPickerWithOpacity
                      color={
                        activeObjectProps?.calendarSettings?.monthTextColor
                          ? activeObjectProps?.calendarSettings?.monthTextColor
                          : calendarSetings.monthTextColor
                          ? calendarSetings.monthTextColor
                          : "#FFFFFFFF"
                      } // Default to black with full opacity
                      onChange={(hexColor) => {
                        setMonthTextColor(hexColor);
                      }}
                      onClose={handleMonthTextColorPickerClose}
                    />
                  </div>
                ) : null}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setMonthTextColor(item.bgcolor)}
                    key={`monthtextcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box> */}
            {/* Month Background Color */}
            {/* <Box mt="10px">
              <TextLabel>Month Background Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleMonthBackGroundColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayMonthBackGroundColorPicker ? (
                  <div style={{ position: "absolute", zIndex: "2", right: 0 }}>
                    <div
                      style={{
                        position: "fixed",
                        top: "0px",
                        right: "0px",
                        bottom: "0px",
                        left: "0px",
                      }}
                      onClick={handleMonthBackGroundColorPickerClose}
                    />
                    <ColorPickerWithOpacity
                      color={
                        activeObjectProps?.calendarSettings?.monthBgColor
                          ? activeObjectProps?.calendarSettings?.monthBgColor
                          : calendarSetings.monthBgColor
                          ? calendarSetings.monthBgColor
                          : "#FFFFFFFF"
                      } // Default to black with full opacity
                      onChange={(hexColor) => {
                        setMonthBackGroundColor(hexColor);
                      }}
                      onClose={handleMonthBackGroundColorPickerClose}
                    />
                  </div>
                ) : null}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setMonthBackGroundColor(item.bgcolor)}
                    key={`monthtextcolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box> */}

            {/* Border Color */}
            <Box mt="10px">
              <TextLabel fontweight="500">Border Color</TextLabel>
              <FlexBox
                mt="5px"
                gap="6px"
                wrap="nowrap"
                className="relative-color-picker"
              >
                <BackgroundColorItemSmall
                  onClick={handleBorderColorPickerClick}
                  bgimage="/images/background/bg_first_item_plus.webp"
                />

                {displayBorderColorPicker && (
                  <ColorPickerPortal
                    anchorRect={pickerAnchorRect}
                    onClose={handleBorderColorPickerClose}
                    color={
                      activeObjectProps?.calendarSettings?.borderColor
                        ? activeObjectProps?.calendarSettings?.borderColor
                        : calendarSetings?.borderColor
                        ? calendarSetings?.borderColor
                        : "#000000FF"
                    }
                    onChange={(hexColor) => setBorderColor(hexColor)}
                  />
                )}

                {TempBackgroudColors.map((item, index) => (
                  <BackgroundColorItemSmall
                    onClick={() => setBorderColor(item.bgcolor)}
                    key={`bordercolor-${index}`}
                    bgcolor={item.bgcolor}
                  />
                ))}
              </FlexBox>
            </Box>
          </Box>

          {/* add option to set border horizontal and vertical. check box horizontal border and vertical border, and then we have border width as slider */}
          <Box mt="10px">
            <div className="d-flex mt-2 align-items-center justify-content-between">
              <TextLabel className="m-0">
                {" "}
                <TextLabel>Border Width</TextLabel>
              </TextLabel>
              <TextLabel className="m-0">
                {calendarSetings.borderWidth ? calendarSetings.borderWidth : 0}
              </TextLabel>
            </div>

            <Form.Range
              min={0}
              max={20}
              step={1}
              value={
                calendarSetings.borderWidth ? calendarSetings.borderWidth : 1
              }
              onChange={(e) => handleBorderWidthChange(e, false)}
              onMouseUp={(e) => handleBorderWidthChange(e, true)}
              onTouchEnd={(e) => handleBorderWidthChange(e, true)}
            />
          </Box>

          <Box mt="10px">
            <div className="d-flex mt-2 align-items-center justify-content-between">
              <TextLabel className="m-0">
                {" "}
                <TextLabel>Border Radius</TextLabel>
              </TextLabel>
              <TextLabel className="m-0">
                {calendarSetings.borderRadius
                  ? calendarSetings.borderRadius
                  : 0}
              </TextLabel>
            </div>

            <Form.Range
              min={0}
              max={calendarSetings.width ? calendarSetings.width : 100}
              step={1}
              value={
                calendarSetings.borderRadius ? calendarSetings.borderRadius : 0
              }
              onChange={(e) => handleBorderRadiusChange(e, false)}
              onMouseUp={(e) => handleBorderRadiusChange(e, true)}
              onTouchEnd={(e) => handleBorderRadiusChange(e, true)}
            />
          </Box>
          <Box mt="10px">
            <div className="d-flex mt-2 align-items-center justify-content-between">
              <TextLabel className="m-0">Cell Space</TextLabel>
              <TextLabel className="m-0">
                {calendarSetings.cellMargin ? calendarSetings.cellMargin : 0}
              </TextLabel>
            </div>
            <Form.Range
              min={0}
              max={100}
              step={1}
              value={
                calendarSetings.cellMargin ? calendarSetings.cellMargin : 0
              }
              onChange={(e) => handleCellMarginChange(e, false)}
              onMouseUp={(e) => handleCellMarginChange(e, true)}
              onTouchEnd={(e) => handleCellMarginChange(e, true)}
            />
          </Box>
        </div>
      </div>
    </>
  );
};
