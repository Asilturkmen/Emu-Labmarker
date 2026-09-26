export type TimetableLayout = "desktop" | "mobile";

/**
 * "verified" rooms come from the curated list in src/data/labRooms.ts.
 * "custom" rooms are laboratories a user added themselves, which are not
 * confirmed and are shown differently. "tutorial" rooms are also the user's
 * own, marked as tutorial rather than laboratory rooms.
 */
export type RoomClassification = "verified" | "custom" | "tutorial" | "normal";

export interface ParsedMeetingRow {
  courseCode: string;
  room: string;
  day: string;
  startMinutes: number;
  endMinutes: number;
  layout: TimetableLayout;
  link: HTMLAnchorElement;
}

export interface MeetingBlock {
  courseCode: string;
  room: string;
  day: string;
  startMinutes: number;
  endMinutes: number;
  layout: TimetableLayout;
  rows: ParsedMeetingRow[];
}

export interface ResolvedMeeting {
  block: MeetingBlock;
  classification: RoomClassification;
}
