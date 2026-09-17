export type TimetableLayout = "desktop" | "mobile";

/**
 * "verified" rooms come from the curated list in src/data/labRooms.ts.
 * "temporary" rooms are the ones a user added themselves, which are not
 * confirmed laboratories and are shown differently.
 */
export type RoomClassification = "verified" | "temporary" | "normal";

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
