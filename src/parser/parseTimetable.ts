import { normalizeRoom } from "../data/labRooms";
import type { ParsedMeetingRow, TimetableLayout } from "../types/timetable";
import { matchCourseRoom, normalizeCourseCode } from "./courseRoom";

const TIME_RANGE_PATTERN =
  /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)(?!\d)/;

const DAYS: ReadonlyArray<readonly [string, string]> = [
  ["MONDAY", "monday"],
  ["PAZARTESI", "monday"],
  ["PAZARTESİ", "monday"],
  ["TUESDAY", "tuesday"],
  ["SALI", "tuesday"],
  ["WEDNESDAY", "wednesday"],
  ["CARSAMBA", "wednesday"],
  ["ÇARŞAMBA", "wednesday"],
  ["THURSDAY", "thursday"],
  ["PERSEMBE", "thursday"],
  ["PERŞEMBE", "thursday"],
  ["FRIDAY", "friday"],
  ["CUMA", "friday"],
  ["SATURDAY", "saturday"],
  ["CUMARTESI", "saturday"],
  ["CUMARTESİ", "saturday"],
  ["SUNDAY", "sunday"],
  ["PAZAR", "sunday"],
];

// Day labels are matched as substrings, and several Turkish labels contain a
// shorter one (CUMA in CUMARTESI, PAZAR in PAZARTESI). Matching the longest
// label first keeps the weekend from being read as a weekday.
const DAY_MATCHERS = [...DAYS].sort(
  ([left], [right]) => right.length - left.length,
);

function getLayout(cell: Element): TimetableLayout {
  return cell.closest(".schedule-table-content-mobile")
    ? "mobile"
    : "desktop";
}

function parseCourseRoom(link: HTMLAnchorElement): {
  courseCode: string;
  room: string;
} | null {
  const dataCourse = link.dataset.course ?? link.dataset.courseCode;
  const dataRoom = link.dataset.room;

  if (dataCourse && dataRoom) {
    return {
      courseCode: normalizeCourseCode(dataCourse),
      room: normalizeRoom(dataRoom),
    };
  }

  const textCopy = link.cloneNode(true) as HTMLElement;
  textCopy.querySelectorAll(".emu-labmark-badge").forEach((badge) => badge.remove());
  let href = link.getAttribute("href") ?? "";
  try { href = decodeURIComponent(href); } catch { /* Keep malformed URLs as text. */ }
  const candidates = [
    textCopy.textContent ?? "",
    link.getAttribute("title") ?? "",
    href,
  ];

  for (const candidate of candidates) {
    const courseRoom = matchCourseRoom(candidate);
    if (courseRoom) return courseRoom;
  }

  return null;
}

function parseTimeValue(value: string | undefined): number | null {
  if (!value) return null;

  const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match?.[1] || !match[2]) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function parseTimeRange(cell: Element, link: HTMLAnchorElement): {
  startMinutes: number;
  endMinutes: number;
} | null {
  const elements = [link, cell, cell.closest("tr")].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  for (const element of elements) {
    const startMinutes = parseTimeValue(
      element.dataset.start ?? element.dataset.startTime,
    );
    const endMinutes = parseTimeValue(
      element.dataset.end ?? element.dataset.endTime,
    );

    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      return { startMinutes, endMinutes };
    }
  }

  for (const element of elements) {
    const match = (element.textContent ?? "").match(TIME_RANGE_PATTERN);
    if (match?.[1] && match[2] && match[3] && match[4]) {
      const startMinutes = Number(match[1]) * 60 + Number(match[2]);
      const endMinutes = Number(match[3]) * 60 + Number(match[4]);
      if (endMinutes > startMinutes) return { startMinutes, endMinutes };
    }
  }

  return null;
}

function normalizeDay(value: string | undefined): string | null {
  if (!value) return null;

  const upperValue = value.trim().toUpperCase();
  for (const [label, normalized] of DAY_MATCHERS) {
    if (upperValue.includes(label)) return normalized;
  }

  return null;
}

/** The live portal uses UL rows and LI cells, with a separate mobile list. */
function parsePortalList(link: HTMLAnchorElement): ParsedMeetingRow | null {
  const cell = link.closest<HTMLLIElement>("li.ctime");
  const list = cell?.parentElement;
  const container = list?.parentElement;
  if (!cell || list?.tagName !== "UL" || !container) return null;
  const mobile = container.matches(".schedule-table-content-mobile");
  if (!mobile && !container.matches(".schedule-table-content")) return null;

  const courseRoom = parseCourseRoom(link);
  const timeText = mobile
    ? cell.querySelector("b")?.textContent
    : list.firstElementChild?.textContent;
  const match = timeText?.match(TIME_RANGE_PATTERN);
  if (!courseRoom || !match) return null;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);
  if (endMinutes <= startMinutes) return null;

  const index = Array.from(list.children).indexOf(cell);
  const headings = container.parentElement?.querySelector(".schedule-table-heading > ul");
  const day = normalizeDay((mobile
    ? list.firstElementChild?.textContent
    : headings?.children[index]?.textContent) ?? undefined);
  if (!day) return null;
  return { ...courseRoom, startMinutes, endMinutes, day, layout: mobile ? "mobile" : "desktop", link };
}

/**
 * cellIndex counts elements rather than grid columns, so a heading row with a
 * merged cell would shift every day by one. Row spans are still not tracked;
 * the portal timetable does not use them.
 */
function getColumnIndex(cell: HTMLTableCellElement): number {
  let columnIndex = 0;
  for (const sibling of Array.from(cell.parentElement?.children ?? [])) {
    if (sibling === cell) break;
    if (sibling instanceof HTMLTableCellElement) columnIndex += sibling.colSpan;
  }
  return columnIndex;
}

function findCellAtColumn(
  row: HTMLTableRowElement,
  columnIndex: number,
): HTMLTableCellElement | null {
  let currentColumn = 0;
  for (const candidate of Array.from(row.cells)) {
    if (columnIndex < currentColumn + candidate.colSpan) return candidate;
    currentColumn += candidate.colSpan;
  }
  return null;
}

function findDayInTable(cell: Element): string | null {
  const tableCell = cell.closest("td, th") as HTMLTableCellElement | null;
  const table = cell.closest("table");
  if (!tableCell || !table) return null;

  const columnIndex = getColumnIndex(tableCell);
  for (const row of Array.from(table.rows)) {
    const candidate = findCellAtColumn(row, columnIndex);
    const day = normalizeDay(candidate?.textContent ?? undefined);
    if (day) return day;
  }

  // The desktop timetable always has the time column first, followed by
  // Monday through Sunday. Some portal versions render the day headings
  // outside the table, so use the column position as a fallback.
  const daysByColumn = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;

  return daysByColumn[columnIndex - 1] ?? null;
}

function findDay(cell: Element, link: HTMLAnchorElement): string | null {
  const directElements = [link, cell, cell.closest("tr")].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  for (const element of directElements) {
    const day = normalizeDay(element.dataset.day ?? element.dataset.weekday);
    if (day) return day;
  }

  const dayContainer = cell.closest(
    "[data-day], [data-weekday], .schedule-day, .day",
  ) as HTMLElement | null;
  const containerDay = normalizeDay(
    dayContainer?.dataset.day ??
      dayContainer?.dataset.weekday ??
      dayContainer?.textContent ??
      undefined,
  );
  if (containerDay) return containerDay;

  return findDayInTable(cell);
}

export function parseTimetable(root: ParentNode = document): ParsedMeetingRow[] {
  // Portal markup has changed between releases. Scanning links and then
  // filtering by the strict COURSE/ROOM pattern is more resilient than
  // depending on a particular timetable CSS class.
  const portal = root.querySelector("#schedule_content");
  const links = Array.from((portal ?? root).querySelectorAll<HTMLAnchorElement>("a"));
  const parsedRows: ParsedMeetingRow[] = [];

  for (const link of links) {
    if (link.closest(".schedule-table-content > ul > li, .schedule-table-content-mobile > ul > li")) {
      const row = parsePortalList(link);
      if (row) parsedRows.push(row);
      continue;
    }
    const cell =
      link.closest(".schedule-table-content, .schedule-table-content-mobile") ??
      link;
    const courseRoom = parseCourseRoom(link);
    const timeRange = parseTimeRange(cell, link);
    const day = findDay(cell, link);
    if (!courseRoom || !timeRange || !day) continue;

    parsedRows.push({
      ...courseRoom,
      ...timeRange,
      day,
      layout: getLayout(cell),
      link,
    });
  }

  return parsedRows;
}
