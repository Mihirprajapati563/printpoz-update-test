import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { getCalendarSettings } from "../../library/utils/helpers";
import { getMonthYear } from "../../library/utils/common-functions";
import { useLiveResize } from "../canvas/liveResizeStore";

// dynamic day names
const dayNameMappings = {
  en: [
    { tinyName: "S", shortName: "Sun", fullName: "Sunday" },
    { tinyName: "M", shortName: "Mon", fullName: "Monday" },
    { tinyName: "T", shortName: "Tue", fullName: "Tuesday" },
    { tinyName: "W", shortName: "Wed", fullName: "Wednesday" },
    { tinyName: "T", shortName: "Thu", fullName: "Thursday" },
    { tinyName: "F", shortName: "Fri", fullName: "Friday" },
    { tinyName: "S", shortName: "Sat", fullName: "Saturday" },
  ],
  gj: [
    { tinyName: "ર", shortName: "રવિ", fullName: "રવિવાર" },
    { tinyName: "સો", shortName: "સોમ", fullName: "સોમવાર" },
    { tinyName: "મં", shortName: "મંગળ", fullName: "મંગળવાર" },
    { tinyName: "બુ", shortName: "બુધ", fullName: "બુધવાર" },
    { tinyName: "ગુ", shortName: "ગુરુ", fullName: "ગુરુવાર" },
    { tinyName: "શુ", shortName: "શુક્ર", fullName: "શુક્રવાર" },
    { tinyName: "શ", shortName: "શનિ", fullName: "શનિવાર" },
  ],
  hi: [
    { tinyName: "र", shortName: "रवि", fullName: "रविवार" },
    { tinyName: "सो", shortName: "सोम", fullName: "सोमवार" },
    { tinyName: "मं", shortName: "मंगल", fullName: "मंगलवार" },
    { tinyName: "बु", shortName: "बुध", fullName: "बुधवार" },
    { tinyName: "गु", shortName: "गुरु", fullName: "गुरुवार" },
    { tinyName: "शु", shortName: "शुक्र", fullName: "शुक्रवार" },
    { tinyName: "श", shortName: "शनि", fullName: "शनिवार" },
  ],
  mr: [
    { tinyName: "र", shortName: "रवि", fullName: "रविवार" },
    { tinyName: "सो", shortName: "सोम", fullName: "सोमवार" },
    { tinyName: "मं", shortName: "मंगळ", fullName: "मंगळवार" },
    { tinyName: "बु", shortName: "बुध", fullName: "बुधवार" },
    { tinyName: "गु", shortName: "गुरु", fullName: "गुरुवार" },
    { tinyName: "शु", shortName: "शुक्र", fullName: "शुक्रवार" },
    { tinyName: "श", shortName: "शनि", fullName: "शनिवार" },
  ],
  bn: [
    { tinyName: "র", shortName: "রবি", fullName: "রবিবার" },
    { tinyName: "সো", shortName: "সোম", fullName: "সোমবার" },
    { tinyName: "মং", shortName: "মঙ্গল", fullName: "মঙ্গলবার" },
    { tinyName: "বু", shortName: "বুধ", fullName: "বুধবার" },
    { tinyName: "ব্র", shortName: "বৃহস্পতি", fullName: "বৃহস্পতিবার" },
    { tinyName: "শু", shortName: "শুক্র", fullName: "শুক্রবার" },
    { tinyName: "শ", shortName: "শনি", fullName: "শনিবার" },
  ],
  ta: [
    { tinyName: "ஞா", shortName: "ஞாயிறு", fullName: "ஞாயிறு" },
    { tinyName: "தி", shortName: "திங்கள்", fullName: "திங்கள்" },
    { tinyName: "செ", shortName: "செவ்வாய்", fullName: "செவ்வாய்" },
    { tinyName: "பு", shortName: "புதன்", fullName: "புதன்" },
    { tinyName: "வி", shortName: "வியாழன்", fullName: "வியாழன்" },
    { tinyName: "வெ", shortName: "வெள்ளி", fullName: "வெள்ளி" },
    { tinyName: "ச", shortName: "சனி", fullName: "சனி" },
  ],
  te: [
    { tinyName: "ఆ", shortName: "ఆది", fullName: "ఆదివారం" },
    { tinyName: "సో", shortName: "సోమ", fullName: "సోమవారం" },
    { tinyName: "మం", shortName: "మంగళ", fullName: "మంగళవారం" },
    { tinyName: "బు", shortName: "బుధ", fullName: "బుధవారం" },
    { tinyName: "గు", shortName: "గురు", fullName: "గురువారం" },
    { tinyName: "శు", shortName: "శుక్ర", fullName: "శుక్రవారం" },
    { tinyName: "శ", shortName: "శని", fullName: "శనివారం" },
  ],
  kn: [
    { tinyName: "ಭಾ", shortName: "ಭಾನು", fullName: "ಭಾನುವಾರ" },
    { tinyName: "ಸೋ", shortName: "ಸೋಮ", fullName: "ಸೋಮವಾರ" },
    { tinyName: "ಮಂ", shortName: "ಮಂಗಳ", fullName: "ಮಂಗಳವಾರ" },
    { tinyName: "ಬು", shortName: "ಬುಧ", fullName: "ಬುಧವಾರ" },
    { tinyName: "ಗು", shortName: "ಗುರು", fullName: "ಗುರುವಾರ" },
    { tinyName: "ಶು", shortName: "ಶುಕ್ರ", fullName: "ಶುಕ್ರವಾರ" },
    { tinyName: "ಶ", shortName: "ಶನಿ", fullName: "ಶನಿವಾರ" },
  ],
  ml: [
    { tinyName: "ഞാ", shortName: "ഞായര്", fullName: "ഞായര്" },
    { tinyName: "തി", shortName: "തിങ്കൾ", fullName: "തിങ്കൾ" },
    { tinyName: "ചെ", shortName: "ചൊവ്വ", fullName: "ചൊവ്വ" },
    { tinyName: "ബു", shortName: "ബുധൻ", fullName: "ബുധൻ" },
    { tinyName: "വി", shortName: "വ്യാഴം", fullName: "വ്യാഴം" },
    { tinyName: "വെ", shortName: "വെള്ളി", fullName: "വെള്ളി" },
    { tinyName: "ശ", shortName: "ശനി", fullName: "ശനി" },
  ],
  pa: [
    { tinyName: "ਐ", shortName: "ਐਤ", fullName: "ਐਤਵਾਰ" },
    { tinyName: "ਸੋ", shortName: "ਸੋਮ", fullName: "ਸੋਮਵਾਰ" },
    { tinyName: "ਮੰ", shortName: "ਮੰਗਲ", fullName: "ਮੰਗਲਵਾਰ" },
    { tinyName: "ਬੁ", shortName: "ਬੁਧ", fullName: "ਬੁਧਵਾਰ" },
    { tinyName: "ਵੀ", shortName: "ਵੀਰ", fullName: "ਵੀਰਵਾਰ" },
    { tinyName: "ਸੁ", shortName: "ਸੁਖ", fullName: "ਸੁਖਰਵਾਰ" },
    { tinyName: "ਸ", shortName: "ਸ਼ਨਿ", fullName: "ਸ਼ਨਿਵਾਰ" },
  ],
  or: [
    { tinyName: "ର", shortName: "ରବି", fullName: "ରବିବାର" },
    { tinyName: "ସୋ", shortName: "ସୋମ", fullName: "ସୋମବାର" },
    { tinyName: "ମ", shortName: "ମଙ୍ଗଳ", fullName: "ମଙ୍ଗଳବାର" },
    { tinyName: "ବୁ", shortName: "ବୁଧ", fullName: "ବୁଧବାର" },
    { tinyName: "ଗୁ", shortName: "ଗୁରୁ", fullName: "ଗୁରୁବାର" },
    { tinyName: "ଶୁ", shortName: "ଶୁକ୍ର", fullName: "ଶୁକ୍ରବାର" },
    { tinyName: "ଶ", shortName: "ଶନି", fullName: "ଶନିବାର" },
  ],
  gu: [
    { tinyName: "ર", shortName: "રવિ", fullName: "રવિવાર" },
    { tinyName: "સો", shortName: "સોમ", fullName: "સોમવાર" },
    { tinyName: "મં", shortName: "મંગળ", fullName: "મંગળવાર" },
    { tinyName: "બુ", shortName: "બુધ", fullName: "બુધવાર" },
    { tinyName: "ગુ", shortName: "ગુરુ", fullName: "ગુરુવાર" },
    { tinyName: "શુ", shortName: "શુક્ર", fullName: "શુક્રવાર" },
    { tinyName: "શ", shortName: "શનિ", fullName: "શનિવાર" },
  ],
  as: [
    { tinyName: "ৰ", shortName: "ৰবি", fullName: "ৰবিবাৰ" },
    { tinyName: "স", shortName: "সোম", fullName: "সোমবাৰ" },
    { tinyName: "ম", shortName: "মঙ্গল", fullName: "মঙ্গলবাৰ" },
    { tinyName: "ব", shortName: "বুধ", fullName: "বুধবাৰ" },
    { tinyName: "বৃ", shortName: "বৃহস্পতি", fullName: "বৃহস্পতিবাৰ" },
    { tinyName: "শু", shortName: "শুক্ৰ", fullName: "শুক্ৰবাৰ" },
    { tinyName: "শ", shortName: "শনি", fullName: "শনিবাৰ" },
  ],
};

// function to get day names
const getDayNames = (lang = "en") => {
  return dayNameMappings[lang] || dayNameMappings["en"];
};
// function to get number in language
const numberMappings = {
  gj: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"], // Gujarati
  hi: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"], // Hindi
  mr: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"], // Marathi
  en: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], // English
  bn: ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"], // Bengali
  ta: ["௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯"], // Tamil
  te: ["౦", "౧", "౨", "౩", "౪", "౫", "౬", "౭", "౮", "౯"], // Telugu
  kn: ["೦", "೧", "೨", "೩", "೪", "೫", "೬", "೭", "೮", "೯"], // Kannada
  ml: ["൦", "൧", "൨", "൩", "൪", "൫", "൬", "൭", "൮", "൯"], // Malayalam
  pa: ["੦", "੧", "੨", "੩", "੪", "੫", "੬", "੭", "੮", "੯"], // Punjabi
  or: ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"], // Oriya
  gu: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"], // Gujarati
  as: ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"], // Assamese
  // Add more languages here if needed
};
const convertNumberToLanguage = (number, lang) => {
  if (!numberMappings[lang]) {
    return number.toString(); // Default to English if language is not supported
  }

  return number
    .toString()
    .split("")
    .map((digit) => numberMappings[lang][digit])
    .join("");
};

// function to generate calendar data
const generateCalendarData = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = new Date(year, month - 1, 1).getDay();
  const weeks = [];

  let currentDay = 1;
  for (let week = 0; currentDay <= daysInMonth; week++) {
    weeks[week] = [];
    for (let day = 0; day < 7; day++) {
      if (week === 0 && day < startDay) {
        weeks[week].push(null); // Empty cell
      } else if (currentDay <= daysInMonth) {
        weeks[week].push(currentDay++);
      } else {
        weeks[week].push(null); // Empty cell
      }
    }
  }
  return weeks;
};

const MultipleDynamicCalendar = ({
  item: rawItem,
  currentMonth,
  calIndex = 1,
  width: widthProp,
  height: heightProp,
  borderColor = "#000000",
  alternateColor = "#f0f0f0",
  headerColor = "#cccccc",
  headerTextColor = "#000000",
  textColor = "#000000",
  fontSize = 40,
}) => {
  // Live-resize override (shared by canvas + footer). Merged over the redux item
  // so the multi-month grid reflows at the live size during an imperative resize.
  const liveResize = useLiveResize(rawItem?.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const width = liveResize?.width ?? (widthProp != null ? widthProp : (item.width || 1000));
  const height = liveResize?.height ?? (heightProp != null ? heightProp : (item.height || 1000));
  const globalCalSettings = useSelector(getCalendarSettings);
  // Merge: object-specific persisted settings override global/ephemeral settings
  const calendarSetings = {
    ...globalCalSettings,
    ...Object.fromEntries(
      Object.entries(item?.calendarSettings || {}).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ),
  };
  const weeksColumns = calendarSetings?.weeksColumns || 1;
  const cellMargin = calendarSetings?.cellMargin
    ? calendarSetings?.cellMargin
    : 0;
  const startMonth = parseInt(calendarSetings?.startMonth);
  const startYear = parseInt(calendarSetings?.startYear);
  const { month, year } = getMonthYear(startMonth, startYear, currentMonth);
  let monthstr = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });
  const weeks = generateCalendarData(
    month,
    year,
    calendarSetings?.language ? calendarSetings?.language : "en"
  );
  const dayNames = getDayNames(
    calendarSetings?.language ? calendarSetings?.language : "en"
  );
  const alternativeColor = true;
  alternateColor = calendarSetings?.alternativeBgColor
    ? calendarSetings?.alternativeBgColor
    : "#FFFFFF";
  textColor = calendarSetings?.textColor
    ? calendarSetings?.textColor
    : "#000000";
  headerColor = calendarSetings?.headerBgColor
    ? calendarSetings?.headerBgColor
    : "#cccccc";
  headerTextColor = calendarSetings?.headerTextColor
    ? calendarSetings?.headerTextColor
    : "#000000";
  const weekendDayNameTextColor = calendarSetings?.weekendTextColor
    ? calendarSetings?.weekendTextColor
    : headerTextColor;
  const weekendTextColor = calendarSetings?.weekendTextColor
    ? calendarSetings?.weekendTextColor
    : textColor;
  fontSize = calendarSetings?.fontSize
    ? calendarSetings?.fontSize
    : 40;
  const fontFamily = calendarSetings?.fontFamily
    ? calendarSetings?.fontFamily
    : "Arial";
  const fontWeight = calendarSetings?.fontWeight
    ? calendarSetings?.fontWeight
    : "normal";
  const borderWidth = calendarSetings?.borderWidth
    ? calendarSetings?.borderWidth
    : 1;
  borderColor = calendarSetings?.borderColor
    ? calendarSetings?.borderColor
    : "#000000";
  const borderRadius = calendarSetings?.borderRadius
    ? calendarSetings?.borderRadius
    : 0;
  // Multi-column geometry — row-major order: weeks flow left→right, then wrap to next row
  const totalWeeks = weeks.length;
  const effectiveColumns = Math.min(weeksColumns, totalWeeks || 1);
  const maxRows = Math.ceil(totalWeeks / effectiveColumns);

  // Row-major: col = weekIndex % effectiveColumns, row = floor(weekIndex / effectiveColumns)
  const getWeekPosition = (weekIndex) => ({
    weekColIndex: weekIndex % effectiveColumns,
    rowInCol: Math.floor(weekIndex / effectiveColumns),
  });

  const cellWidth = width / (7 * effectiveColumns);
  const cellHeight = height / (maxRows + 1); // maxRows data rows + 1 header row
  // x-stride between columns: 7 cells + 6 inter-cell gaps
  const colStride = 7 * cellWidth + 6 * cellMargin;

  const svgWidth = effectiveColumns * colStride + borderWidth * 2;
  const svgHeight = (maxRows + 1) * (cellHeight + cellMargin) + fontSize / 2 + borderWidth * 2;

  return (
    <svg
      className={`cal cal${calIndex} cal-grid`}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={item.width}
      height={item.height}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Day-name header row — repeated for each column */}
      {Array.from({ length: effectiveColumns }, (_, colIndex) =>
        dayNames.map((day, dayIndex) => {
          const index = dayIndex;
          const x = dayIndex * (cellWidth + cellMargin) + colIndex * colStride;
          const y = cellMargin + fontSize / 2 + borderWidth / 2;

          return (
            <g
              key={`header-${colIndex}-${dayIndex}`}
              className="cal-header"
              transform={`translate(${borderWidth}, ${-cellMargin})`}
            >
              <rect
                className="cal-header"
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={
                  index === 0 && calendarSetings?.weekendBgColor
                    ? calendarSetings?.weekendBgColor
                    : headerColor
                }
                stroke={borderColor}
                strokeWidth={borderWidth}
                rx={borderRadius}
                ry={borderRadius}
              />

              <text
                className="cal-header__label"
                x={x + cellWidth / 2}
                y={y + cellHeight / 2 + fontSize / 5}
                alignmentBaseline="middle"
                width={cellWidth}
                textAnchor="middle"
                fontSize={fontSize}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                fill={index === 0 ? weekendDayNameTextColor : headerTextColor}
              >
                {calendarSetings?.dayNameFormat === "tiny" && day.tinyName}
                {calendarSetings?.dayNameFormat === "short" && day.shortName}
                {calendarSetings?.dayNameFormat === "full" && day.fullName}
                {(calendarSetings?.dayNameFormat === undefined ||
                  calendarSetings?.dayNameFormat === "") &&
                  day.shortName}
              </text>
            </g>
          );
        })
      )}

      {/* Draw the calendar grid */}
      {weeks.map((week, weekIndex) => {
        const { weekColIndex, rowInCol } = getWeekPosition(weekIndex);
        return week.map((day, dayIndex) => {
          const x = dayIndex * (cellWidth + cellMargin) + weekColIndex * colStride;
          const y =
            (rowInCol + 1) * (cellHeight + cellMargin) +
            fontSize / 2 +
            borderWidth / 2;
          let fillColor =
            (dayIndex + weekIndex) % 2 === 0
              ? calendarSetings?.backgroundColor
                ? calendarSetings?.backgroundColor
                : "#FFFFFF"
              : alternateColor;
          if (!alternativeColor) {
            fillColor = calendarSetings?.backgroundColor
              ? calendarSetings?.backgroundColor
              : "#FFFFFF";
          }
          if (dayIndex === 0 && calendarSetings?.weekendBgColor) {
            fillColor = calendarSetings?.weekendBgColor;
          }

          const cellClass = `cal-cell-${weekIndex}-${dayIndex}`;

          return (
            <g
              key={`${weekIndex}-${dayIndex}`}
              className={cellClass}
              transform={`translate(${borderWidth}, ${borderWidth})`}
            >
              <rect
                className="cal-cell-bg"
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={fillColor}
                stroke={borderColor}
                strokeWidth={borderWidth}
                rx={borderRadius}
                ry={borderRadius}
              />

              {day && (
                <text
                  className="cal-cell-number"
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 2 + fontSize / 5}
                  alignmentBaseline="middle"
                  textAnchor="middle"
                  fill={dayIndex === 0 ? weekendTextColor : textColor}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fontWeight={fontWeight}
                >
                  {convertNumberToLanguage(
                    day,
                    calendarSetings?.language ? calendarSetings?.language : "en"
                  )}
                </text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
};

export default MultipleDynamicCalendar;
