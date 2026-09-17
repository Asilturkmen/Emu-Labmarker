import { normalizeRoom } from "../data/labRooms";

/**
 * A timetable entry renders the course and its room as "COURSE/ROOM", for
 * example "CMSE425/CMPE137" or "MGMT101/CL 114". The parser and the text
 * fallback must agree on this shape, so it lives in one place.
 */
export const COURSE_ROOM_PATTERN =
  /\b([A-Z]{2,}\s*-?\s*\d{3,4}[A-Z]?)\s*\/\s*([A-Z]{2,}(?:\s*-?\s*[A-Z0-9]+)+)\b/i;

export function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/\s+/g, "").toUpperCase();
}

export function matchCourseRoom(
  text: string,
): { courseCode: string; room: string } | null {
  const match = text.toUpperCase().match(COURSE_ROOM_PATTERN);
  if (!match?.[1] || !match[2]) return null;

  return {
    courseCode: normalizeCourseCode(match[1]),
    room: normalizeRoom(match[2]),
  };
}
