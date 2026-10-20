/**
 * Shared COURSE/ROOM parsing for timetable links, plain text and user input.
 * Examples: "CMSE425/CMPE137" and "MGMT101/CL 114".
 * Keep this module dependency-free so all room handling can use it.
 */
export const COURSE_ROOM_PATTERN =
  /\b([A-Z]{2,}\s*-?\s*\d{3,4}[A-Z]?)\s*\/\s*([A-Z]{2,}(?:\s*-?\s*[A-Z0-9]+)+)\b/i;

export function normalizeRoom(room: string): string {
  return room.trim().replace(/\s+/g, "").toUpperCase();
}

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
