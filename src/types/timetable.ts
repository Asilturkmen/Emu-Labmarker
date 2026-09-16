export type TimetableLayout = "desktop" | "mobile";

export type RoomClassification = "verified" | "probable" | "normal";

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
