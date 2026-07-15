# Dynamic SVG Calendar — Portable Implementation Guide

A self-contained guide to porting the dynamic, resizable SVG calendar grid from this project into another React project. The component renders a month grid that scales automatically with its bounding box, supports multi-column week layouts (1–4 column-groups of weeks side-by-side), per-language day/number/month names, and full theming (colors, borders, fonts, weekend styling).

---

## 1. What you're getting

A single React component, `DynamicCalendar`, that:

- Renders an SVG calendar grid for **any** `(month, year)` pair.
- Auto-sizes every cell to fit the `width` × `height` you pass it.
- Supports splitting the month's weeks into **1–4 sid         e-by-side columns** (e.g. weeks 1–3 on row 0, weeks 4–6 on row 1).
- Themes everything: header bg/text, weekend bg/text, alternating cell bg, borders, radius, font family/size/weight.
- i18n-ready: 14 languages out of the box for day names, month names, and numerals.
- Pure presentation — no Redux, no app coupling.

It is one file, one default export, plus a settings object.

---

## 2. Dependencies

Required (peer):

```json
{
  "react": ">=17"
}
```

That's it. No state library, no CSS framework, no chart library. The component renders raw `<svg>`.

---

## 3. The geometry — how cells are sized

This is the key idea: **the calendar SVG fills the box you give it.** Every cell width and height is derived from the box dimensions and the number of weeks in the month.

Given:

| Input | Meaning |
|---|---|
| `width`, `height` | Calendar's bounding box (in SVG units / px) |
| `weeksColumns` | 1, 2, 3, or 4 — how many side-by-side week-column-groups |
| `cellMargin` | Gap between adjacent cells |
| `weeks.length` | 5 or 6, computed from `(month, year)` |

The math:

```js
const totalWeeks       = weeks.length;                              // 5 or 6
const effectiveColumns = Math.min(weeksColumns, totalWeeks || 1);   // clamp to avoid empty columns
const maxRows          = Math.ceil(totalWeeks / effectiveColumns);  // rows per column-group

const cellWidth  = width  / (7 * effectiveColumns);   // 7 days × N column-groups
const cellHeight = height / (maxRows + 1);            // +1 for the header (day-name) row

// horizontal distance from one column-group to the next
const colStride  = 7 * cellWidth + 6 * cellMargin;
```

**Width axis** — the box width is split into `7 × effectiveColumns` equal slots. With `weeksColumns = 1` you get a normal 7-day-wide grid. With `weeksColumns = 2` you get 14 day-slots in a row (two month-columns of weeks side-by-side).

**Height axis** — `maxRows + 1` because one row is always reserved for the day-name header. A 6-week month at `weeksColumns = 1` divides the height into 7 rows. At `weeksColumns = 2` the same month needs only 3 data rows → height divides by 4.

**Row-major week placement** — week `N` goes to:

```js
col = N % effectiveColumns
row = Math.floor(N / effectiveColumns)
```

So weeks read left → right, then wrap to the next row. Week 0,1,2 across, then 3,4,5 on the next row.

**Cell coordinates**:

```js
x = dayIndex * (cellWidth  + cellMargin) + col * colStride
y = (row + 1) * (cellHeight + cellMargin) + fontSize/2 + borderWidth/2
//   ^ +1 because row 0 is the header
```

**Why it scales fluidly** — the `<svg>` uses `viewBox="0 0 svgWidth svgHeight"` with `preserveAspectRatio="none"` and explicit `width={item.width} height={item.height}` attributes. So when the user resizes the container, the browser stretches the entire vector grid — no JS recalculation needed.

---

## 4. Calendar settings shape

A single plain object drives all visual & behavioral options. Use it as a prop, context value, or load from your own state layer.

```ts
type CalendarSettings = {
  // Date
  startMonth: number;        // 1–12
  startYear: number;         // e.g. 2026
  language: string;          // "en" | "hi" | "gj" | "mr" | "bn" | "ta" | "te" | "kn" | "ml" | "pa" | "or" | "gu" | "as"
  dayNameFormat: "tiny" | "short" | "full";

  // Layout
  weeksColumns: 1 | 2 | 3 | 4;
  cellMargin: number;        // px

  // Typography
  fontSize: number;          // px
  fontFamily: string;        // CSS family
  fontWeight: string | number;

  // Borders
  borderWidth: number;
  borderColor: string;
  borderRadius: number;

  // Colors
  backgroundColor: string;        // even cells
  alternativeBgColor: string;     // odd cells (when alternating)
  textColor: string;
  headerBgColor: string;
  headerTextColor: string;
  weekendBgColor: string;         // Sunday column override
  weekendTextColor: string;       // Sunday text override
};

const DEFAULTS: CalendarSettings = {
  startMonth: 1,
  startYear: new Date().getFullYear(),
  language: "en",
  dayNameFormat: "short",
  weeksColumns: 1,
  cellMargin: 0,
  fontSize: 40,
  fontFamily: "Arial",
  fontWeight: "normal",
  borderWidth: 1,
  borderColor: "#000000",
  borderRadius: 0,
  backgroundColor: "#FFFFFF",
  alternativeBgColor: "#FFFFFF",
  textColor: "#000000",
  headerBgColor: "#cccccc",
  headerTextColor: "#000000",
  weekendBgColor: "",
  weekendTextColor: "",
};
```

---

## 5. The portable component

Drop this file into your project as `DynamicCalendar.jsx`. It's the project's component with the Redux selector replaced by a prop, and dead branches removed. Functionality identical.

```jsx
import React from "react";

/* ---------- i18n maps (trim to the languages you need) ---------- */

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
  // ...add hi, gj, mr, bn, ta, te, kn, ml, pa, or, gu, as as needed
  // (see Section 8 for the full set — copy from the source file)
};

const monthNameMappings = {
  en: [
    { shortName: "Jan", fullName: "January" },
    { shortName: "Feb", fullName: "February" },
    { shortName: "Mar", fullName: "March" },
    { shortName: "Apr", fullName: "April" },
    { shortName: "May", fullName: "May" },
    { shortName: "Jun", fullName: "June" },
    { shortName: "Jul", fullName: "July" },
    { shortName: "Aug", fullName: "August" },
    { shortName: "Sep", fullName: "September" },
    { shortName: "Oct", fullName: "October" },
    { shortName: "Nov", fullName: "November" },
    { shortName: "Dec", fullName: "December" },
  ],
  // ...other langs
};

const numberMappings = {
  en: ["0","1","2","3","4","5","6","7","8","9"],
  hi: ["०","१","२","३","४","५","६","७","८","९"],
  // ...other langs
};

const getDayNames = (lang = "en") => dayNameMappings[lang] || dayNameMappings.en;

const convertNumberToLanguage = (n, lang) => {
  const map = numberMappings[lang];
  if (!map) return String(n);
  return String(n).split("").map((d) => map[d]).join("");
};

/* ---------- Pure date helpers ---------- */

const getMonthYear = (startMonth, startYear, pageIndex) => {
  let month = startMonth + pageIndex;
  let year = startYear;
  if (month > 12) {
    year += Math.floor((month - 1) / 12);
    month = ((month - 1) % 12) + 1;
  }
  return { month, year };
};

const generateCalendarData = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = new Date(year, month - 1, 1).getDay();
  const weeks = [];
  let currentDay = 1;
  for (let week = 0; currentDay <= daysInMonth; week++) {
    weeks[week] = [];
    for (let day = 0; day < 7; day++) {
      if (week === 0 && day < startDay) weeks[week].push(null);
      else if (currentDay <= daysInMonth) weeks[week].push(currentDay++);
      else weeks[week].push(null);
    }
  }
  return weeks;
};

/* ---------- Component ---------- */

const DEFAULTS = {
  startMonth: 1,
  startYear: new Date().getFullYear(),
  language: "en",
  dayNameFormat: "short",
  weeksColumns: 1,
  cellMargin: 0,
  fontSize: 40,
  fontFamily: "Arial",
  fontWeight: "normal",
  borderWidth: 1,
  borderColor: "#000000",
  borderRadius: 0,
  backgroundColor: "#FFFFFF",
  alternativeBgColor: "#FFFFFF",
  textColor: "#000000",
  headerBgColor: "#cccccc",
  headerTextColor: "#000000",
  weekendBgColor: "",
  weekendTextColor: "",
};

export default function DynamicCalendar({
  width = 1000,
  height = 1000,
  monthOffset = 0,       // 0 = startMonth/startYear; 1 = next month; etc.
  settings = {},
  calIndex = 1,
  className = "",
}) {
  const s = { ...DEFAULTS, ...settings };
  const startMonth = parseInt(s.startMonth, 10);
  const startYear = parseInt(s.startYear, 10);
  const { month, year } = getMonthYear(startMonth, startYear, monthOffset);

  const weeks = generateCalendarData(month, year);
  const dayNames = getDayNames(s.language);

  // Geometry
  const totalWeeks = weeks.length;
  const effectiveColumns = Math.min(s.weeksColumns, totalWeeks || 1);
  const maxRows = Math.ceil(totalWeeks / effectiveColumns);
  const cellWidth = width / (7 * effectiveColumns);
  const cellHeight = height / (maxRows + 1);
  const colStride = 7 * cellWidth + 6 * s.cellMargin;

  const svgWidth  = effectiveColumns * colStride + s.borderWidth * 2;
  const svgHeight = (maxRows + 1) * (cellHeight + s.cellMargin) + s.fontSize / 2 + s.borderWidth * 2;

  const weekendTextColor   = s.weekendTextColor || s.textColor;
  const weekendHeaderColor = s.weekendTextColor || s.headerTextColor;

  return (
    <svg
      className={`cal cal${calIndex} cal-grid ${className}`}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Header row, repeated per week-column-group */}
      {Array.from({ length: effectiveColumns }, (_, colIndex) =>
        dayNames.map((day, dayIndex) => {
          const x = dayIndex * (cellWidth + s.cellMargin) + colIndex * colStride;
          const y = s.cellMargin + s.fontSize / 2 + s.borderWidth / 2;
          const fill = dayIndex === 0 && s.weekendBgColor ? s.weekendBgColor : s.headerBgColor;
          const labelText =
            s.dayNameFormat === "tiny" ? day.tinyName :
            s.dayNameFormat === "full" ? day.fullName :
            day.shortName;

          return (
            <g
              key={`h-${colIndex}-${dayIndex}`}
              className="cal-header"
              transform={`translate(${s.borderWidth}, ${-s.cellMargin})`}
            >
              <rect
                className="cal-header"
                x={x} y={y}
                width={cellWidth} height={cellHeight}
                fill={fill}
                stroke={s.borderColor} strokeWidth={s.borderWidth}
                rx={s.borderRadius} ry={s.borderRadius}
              />
              <text
                className="cal-header__label"
                x={x + cellWidth / 2}
                y={y + cellHeight / 3 + s.fontSize / 2}
                alignmentBaseline="middle"
                textAnchor="middle"
                fontSize={s.fontSize}
                fontFamily={s.fontFamily}
                fontWeight={s.fontWeight}
                fill={dayIndex === 0 ? weekendHeaderColor : s.headerTextColor}
              >
                {labelText}
              </text>
            </g>
          );
        })
      )}

      {/* Day cells */}
      {weeks.map((week, weekIndex) => {
        const weekColIndex = weekIndex % effectiveColumns;
        const rowInCol = Math.floor(weekIndex / effectiveColumns);

        return week.map((day, dayIndex) => {
          const x = dayIndex * (cellWidth + s.cellMargin) + weekColIndex * colStride;
          const y =
            (rowInCol + 1) * (cellHeight + s.cellMargin) +
            s.fontSize / 2 +
            s.borderWidth / 2;

          let fillColor =
            (dayIndex + weekIndex) % 2 === 0
              ? s.backgroundColor
              : s.alternativeBgColor;
          if (dayIndex === 0 && s.weekendBgColor) fillColor = s.weekendBgColor;

          return (
            <g
              key={`${weekIndex}-${dayIndex}`}
              className={`cal-cell-${weekIndex}-${dayIndex}`}
              transform={`translate(${s.borderWidth}, ${s.borderWidth})`}
            >
              <rect
                className="cal-cell-bg"
                x={x} y={y}
                width={cellWidth} height={cellHeight}
                fill={fillColor}
                stroke={s.borderColor} strokeWidth={s.borderWidth}
                rx={s.borderRadius} ry={s.borderRadius}
              />
              {day && (
                <text
                  className="cal-cell-number"
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 3 + s.fontSize / 2}
                  alignmentBaseline="middle"
                  textAnchor="middle"
                  fontSize={s.fontSize}
                  fontFamily={s.fontFamily}
                  fontWeight={s.fontWeight}
                  fill={dayIndex === 0 ? weekendTextColor : s.textColor}
                >
                  {convertNumberToLanguage(day, s.language)}
                </text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}

export {
  getMonthYear,
  generateCalendarData,
  dayNameMappings,
  monthNameMappings,
  numberMappings,
  convertNumberToLanguage,
};
```

---

## 6. Usage

### Simplest case — one calendar at a fixed size

```jsx
import DynamicCalendar from "./DynamicCalendar";

<DynamicCalendar
  width={800}
  height={600}
  settings={{ startMonth: 5, startYear: 2026 }}
/>
```

### Themed

```jsx
<DynamicCalendar
  width={1200}
  height={900}
  settings={{
    startMonth: 1,
    startYear: 2026,
    language: "hi",
    dayNameFormat: "short",
    fontFamily: "Inter",
    fontWeight: 600,
    headerBgColor: "#1e293b",
    headerTextColor: "#ffffff",
    backgroundColor: "#f8fafc",
    alternativeBgColor: "#e2e8f0",
    weekendBgColor: "#fee2e2",
    weekendTextColor: "#b91c1c",
    borderColor: "#cbd5e1",
    borderRadius: 6,
    cellMargin: 4,
  }}
/>
```

### Multi-column weeks (compact landscape layout)

```jsx
<DynamicCalendar
  width={2000}
  height={400}
  settings={{
    startMonth: 6,
    startYear: 2026,
    weeksColumns: 3,    // weeks 1-2-3 on row 0, weeks 4-5-6 on row 1
    cellMargin: 2,
  }}
/>
```

### Sequential months across pages (calendar book)

`monthOffset` is the page index. Pass `0` for the cover month, `1` for the next, etc.

```jsx
{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((offset) => (
  <DynamicCalendar
    key={offset}
    width={800}
    height={600}
    monthOffset={offset}
    settings={{ startMonth: 1, startYear: 2026 }}
  />
))}
```

### Multiple calendars per page

When a single page hosts multiple calendars and you want the months to **continue across pages** (not restart per page), compute the offset yourself:

```jsx
// page 1 has 2 calendars, page 2 has 3 — months should be Jan, Feb, Mar, Apr, May
const calendarsPerPage = [2, 3];
let runningOffset = 0;

calendarsPerPage.map((count, pageIdx) => (
  <Page key={pageIdx}>
    {Array.from({ length: count }).map((_, i) => {
      const offset = runningOffset + i;
      return (
        <DynamicCalendar
          key={i}
          monthOffset={offset}
          width={400} height={300}
          settings={{ startMonth: 1, startYear: 2026 }}
        />
      );
    })}
    {(runningOffset += count, null)}
  </Page>
));
```

(In the source project this is wired up via a `calendarMonthOffset` prop computed in `Canvas.jsx` — same idea, just override per-instance.)

---

## 7. Adding month/year text labels

The source project renders the month and year as separate, draggable text boxes (not as part of the SVG). If you want them embedded, add this above the header row inside the `<svg>`:

```jsx
{/* Month/Year title (optional) */}
<text
  x={svgWidth / 2}
  y={s.fontSize}
  textAnchor="middle"
  fontSize={s.fontSize * 1.4}
  fontFamily={s.fontFamily}
  fontWeight="bold"
  fill={s.textColor}
>
  {monthNameMappings[s.language]?.[month - 1].fullName} {year}
</text>
```

Then bump `svgHeight` by `s.fontSize * 2` and shift the header `y` down by the same.

For dynamic sizing of standalone month/year boxes (so they fit the box without overflow), the source project uses:

```js
const dynamicFontSize = Math.round(16 * (canvasSize.width / 500));
const monthBoxWidth   = dynamicFontSize * 4.5;
const yearBoxWidth    = dynamicFontSize * 3;
const boxHeight       = dynamicFontSize * 1.2;
```

---

## 8. Full i18n data (14 languages)

The complete `dayNameMappings`, `monthNameMappings`, and `numberMappings` (covering `en`, `hi`, `gj`/`gu`, `mr`, `bn`, `ta`, `te`, `kn`, `ml`, `pa`, `or`, `as`) live in the source file:

> `src/components/calendar/DynamicCalendar.jsx`, lines 7–352

Copy those three objects verbatim into your portable file. They're plain data, no dependencies.

---

## 9. CSS hooks

The component emits a stable class structure so you can style without props:

```
<svg class="cal cal{n} cal-grid">
  <g class="cal-header">
    <rect class="cal-header" />
    <text class="cal-header__label" />
  </g>
  <g class="cal-cell-{row}-{col}">
    <rect class="cal-cell-bg" />
    <text class="cal-cell-number" />
  </g>
</svg>
```

- `cal{n}` — 1-based position when you have multiple calendars on a page; pass `calIndex` prop.
- `cal-cell-{row}-{col}` — 0-indexed week row and weekday column. Useful for highlighting specific dates: `.cal-cell-2-3 .cal-cell-bg { fill: gold; }`.

---

## 10. Caveats & gotchas

- **`preserveAspectRatio="none"`** stretches text non-uniformly when the box aspect ratio is extreme. For square-ish boxes it looks fine; for very wide/thin boxes consider switching to `"xMidYMid meet"` and recomputing `svgWidth`/`svgHeight` to match the aspect.
- **Week numbering** is calendar-week-of-month, not ISO week. The `startDay` (Sunday=0) is fixed; if you need Monday-first, change `startDay` in `generateCalendarData` to `(new Date(year, month - 1, 1).getDay() + 6) % 7` and rotate `dayNameMappings` arrays so Monday is first.
- **Leap years and months that span 6 weeks** are handled automatically — `weeks.length` is whatever it needs to be (5 or 6), and `cellHeight` rebalances.
- **Numbers in non-English languages** — `convertNumberToLanguage` is digit-by-digit substitution. It does not localize separators (none are needed here, but worth noting if you extend it).
- **`weeksColumns > totalWeeks`** is clamped via `Math.min`. If you ask for `weeksColumns: 4` in a 5-week month, you get 4 columns × 2 rows = 8 slots with 3 empty. To avoid this, clamp `weeksColumns` to `[1, totalWeeks]` in your UI.

---

## 11. Quick checklist for porting

- [ ] Copy `DynamicCalendar.jsx` (Section 5) into your project.
- [ ] Copy the three i18n maps (Section 8) from the source file if you need non-English languages.
- [ ] Pass `width` and `height` from your layout — they're the box dimensions, not viewport.
- [ ] Pass `settings` from wherever your UI state lives (`useState`, Zustand, Redux, context — whatever you use).
- [ ] For multi-page calendar books, use `monthOffset` to walk through months.
- [ ] Style further via the documented CSS classes if needed.

That's the whole thing. No build step, no peer deps beyond React.
