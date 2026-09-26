import { isWeekday, WEEKDAYS, type Weekday } from "./data/customRules";
import type { MeetingBlock } from "./types/timetable";

/**
 * The popup asks the timetable tab for its meetings, so that once a room is
 * typed it offers only the days and times that room is actually used. The
 * content script answers with plain data: DOM nodes cannot cross the message
 * channel.
 */
export const LIST_SESSIONS_MESSAGE = "emu-labmarker:list-sessions";

export interface TimetableSession {
  courseCode: string;
  room: string;
  day: Weekday;
  startMinutes: number;
  endMinutes: number;
}

function sessionKey(session: TimetableSession): string {
  return [session.courseCode, session.room, session.day, session.startMinutes, session.endMinutes].join("|");
}

/**
 * The portal renders the timetable twice, once per layout, so every meeting
 * arrives as two blocks. Each is listed once, in the order of the week.
 */
export function collectSessions(blocks: ReadonlyArray<MeetingBlock>): TimetableSession[] {
  const sessions = new Map<string, TimetableSession>();
  for (const block of blocks) {
    if (!isWeekday(block.day)) continue;
    const session: TimetableSession = {
      courseCode: block.courseCode,
      room: block.room,
      day: block.day,
      startMinutes: block.startMinutes,
      endMinutes: block.endMinutes,
    };
    sessions.set(sessionKey(session), session);
  }

  return [...sessions.values()].sort(
    (left, right) =>
      WEEKDAYS.indexOf(left.day) - WEEKDAYS.indexOf(right.day) ||
      left.startMinutes - right.startMinutes ||
      left.room.localeCompare(right.room),
  );
}

function isSession(value: unknown): value is TimetableSession {
  if (typeof value !== "object" || value === null) return false;
  const { courseCode, room, day, startMinutes, endMinutes } = value as Record<string, unknown>;
  return (
    typeof courseCode === "string" &&
    typeof room === "string" &&
    isWeekday(day) &&
    Number.isInteger(startMinutes) &&
    Number.isInteger(endMinutes) &&
    (endMinutes as number) > (startMinutes as number)
  );
}

/** Whatever answers the message is checked before the popup relies on it. */
export function parseSessions(value: unknown): TimetableSession[] | null {
  return Array.isArray(value) ? value.filter(isSession) : null;
}
