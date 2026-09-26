import { matchCourseRoom, normalizeCourseCode, normalizeRoom } from "./courseRoom";
import {
  isValidRoomCode,
  isVerifiedLabRoom,
  MAX_CUSTOM_ROOMS,
  VERIFIED_LAB_ROOMS,
} from "./labRooms";

/** Day names as the timetable parser reports them. */
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export function isWeekday(value: unknown): value is Weekday {
  return (WEEKDAYS as ReadonlyArray<unknown>).includes(value);
}

const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  monday: "Pzt",
  tuesday: "Sal",
  wednesday: "Çar",
  thursday: "Per",
  friday: "Cum",
  saturday: "Cmt",
  sunday: "Paz",
};

export function weekdayShortLabel(day: Weekday): string {
  return WEEKDAY_SHORT_LABELS[day];
}

/**
 * A room the user marked as a laboratory themselves. Without a time it covers
 * every meeting in the room. With one it covers only the meeting held there on
 * that day at that time: a room that hosts a single tutorial a week must not
 * turn every other course taught in it into a laboratory.
 *
 * The course code is only a label for the popup. Matching deliberately ignores
 * it, so a rule keeps working when the portal spells the course differently.
 */
export type CustomLabRule =
  | { room: string; day?: undefined; startMinutes?: undefined; course?: undefined }
  | { room: string; day: Weekday; startMinutes: number; course?: string };

export type TimedCustomLabRule = Extract<CustomLabRule, { day: Weekday }>;

export function isTimedRule(rule: CustomLabRule): rule is TimedCustomLabRule {
  return rule.day !== undefined;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseClock(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match?.[1] || !match[2]) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isValidCourseCode(course: string): boolean {
  return /^[A-Z]{2,}-?\d{3,4}[A-Z]?$/.test(course);
}

/** Identifies a rule, so the same one cannot be added twice. */
export function ruleKey(rule: CustomLabRule): string {
  return isTimedRule(rule)
    ? `${rule.room}|${rule.day}|${formatMinutes(rule.startMinutes)}`
    : rule.room;
}

export function ruleLabel(rule: CustomLabRule): string {
  return isTimedRule(rule)
    ? `${rule.room} · ${weekdayShortLabel(rule.day)} ${formatMinutes(rule.startMinutes)}`
    : rule.room;
}

/**
 * A timed rule covers the whole meeting that includes its time, so choosing
 * either hour of a two hour tutorial marks both.
 */
export function ruleMatches(
  rule: CustomLabRule,
  meeting: { room: string; day: string; startMinutes: number; endMinutes: number },
): boolean {
  if (normalizeRoom(meeting.room) !== rule.room) return false;
  if (!isTimedRule(rule)) return true;
  return (
    meeting.day === rule.day &&
    meeting.startMinutes <= rule.startMinutes &&
    rule.startMinutes < meeting.endMinutes
  );
}

/**
 * Rooms covered at every hour. The text fallback cannot tell which day or
 * hour a piece of text belongs to, so this is all it may be given.
 */
export function roomWideRooms(rules: ReadonlyArray<CustomLabRule>): ReadonlySet<string> {
  return new Set(rules.filter((rule) => !isTimedRule(rule)).map((rule) => rule.room));
}

function parseRule(entry: unknown): CustomLabRule | null {
  if (typeof entry === "string") {
    return isValidRoomCode(entry) ? { room: normalizeRoom(entry) } : null;
  }
  if (typeof entry !== "object" || entry === null) return null;

  const { room, day, start, course } = entry as Record<string, unknown>;
  if (typeof room !== "string" || !isValidRoomCode(room) || !isWeekday(day)) {
    return null;
  }
  const startMinutes = parseClock(start);
  if (startMinutes === null) return null;

  const rule: TimedCustomLabRule = { room: normalizeRoom(room), day, startMinutes };
  if (typeof course === "string") {
    const normalizedCourse = normalizeCourseCode(course);
    if (isValidCourseCode(normalizedCourse)) rule.course = normalizedCourse;
  }
  return rule;
}

/**
 * Extension storage can be edited outside the popup, so anything that is not
 * a usable rule is dropped instead of trusted. Earlier versions stored plain
 * room codes, and those still read as rules covering every hour.
 */
export function parseCustomLabRules(value: unknown): CustomLabRule[] {
  if (!Array.isArray(value)) return [];

  const rules: CustomLabRule[] = [];
  const keys = new Set<string>();
  for (const entry of value) {
    const rule = parseRule(entry);
    if (!rule || keys.has(ruleKey(rule))) continue;
    keys.add(ruleKey(rule));
    rules.push(rule);
  }
  return rules;
}

/**
 * Rules covering every hour stay plain strings, exactly as earlier versions
 * wrote them, so their stored lists read the same in either direction.
 */
export function serializeCustomLabRules(rules: ReadonlyArray<CustomLabRule>): unknown[] {
  return rules.map((rule) => {
    if (!isTimedRule(rule)) return rule.room;
    return {
      room: rule.room,
      day: rule.day,
      start: formatMinutes(rule.startMinutes),
      ...(rule.course ? { course: rule.course } : {}),
    };
  });
}

export type AddRuleStatus =
  | "added"
  | "invalid"
  | "invalid-time"
  | "duplicate"
  | "verified"
  | "covered"
  | "limit";

export interface AddRuleRequest {
  /** A room code, or a whole "COURSE/ROOM" entry copied from the timetable. */
  room: string;
  day?: Weekday;
  /** "HH:MM"; required together with day. */
  start?: string;
  course?: string;
}

export interface AddRuleResult {
  status: AddRuleStatus;
  rule: CustomLabRule;
  rules: CustomLabRule[];
  /** Timed rules for the same room that a new every-hour rule made redundant. */
  absorbed: number;
}

/**
 * Adds a rule to a hand-maintained list. Pure, so the popup and the storage
 * layer can share the same rules.
 */
export function addRuleToList(
  rules: ReadonlyArray<CustomLabRule>,
  request: AddRuleRequest,
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): AddRuleResult {
  // Accept a whole timetable entry, so that copying "CMSE423/CMPE025" from the
  // page works as well as typing the room on its own.
  const pasted = matchCourseRoom(request.room);
  const room = pasted?.room ?? normalizeRoom(request.room);
  const unchanged = { rules: [...rules], absorbed: 0 };
  const roomRule: CustomLabRule = { room };

  if (!isValidRoomCode(room)) return { status: "invalid", rule: roomRule, ...unchanged };
  if (isVerifiedLabRoom(room, verifiedRooms)) {
    return { status: "verified", rule: roomRule, ...unchanged };
  }

  let rule: CustomLabRule = roomRule;
  if (request.day !== undefined) {
    const startMinutes = parseClock(request.start);
    if (startMinutes === null) {
      return { status: "invalid-time", rule: roomRule, ...unchanged };
    }
    const course = normalizeCourseCode(request.course ?? pasted?.courseCode ?? "");
    rule = {
      room,
      day: request.day,
      startMinutes,
      ...(isValidCourseCode(course) ? { course } : {}),
    };
  }

  const key = ruleKey(rule);
  if (rules.some((existing) => ruleKey(existing) === key)) {
    return { status: "duplicate", rule, ...unchanged };
  }
  if (isTimedRule(rule) && rules.some((existing) => existing.room === room && !isTimedRule(existing))) {
    return { status: "covered", rule, ...unchanged };
  }

  // An every-hour rule already covers the room's timed rules, and keeping them
  // would only leave chips behind that change nothing.
  const kept = isTimedRule(rule)
    ? [...rules]
    : rules.filter((existing) => existing.room !== room);
  if (kept.length >= MAX_CUSTOM_ROOMS) {
    return { status: "limit", rule, ...unchanged };
  }

  return {
    status: "added",
    rule,
    rules: [...kept, rule],
    absorbed: rules.length - kept.length,
  };
}

export function removeRuleFromList(
  rules: ReadonlyArray<CustomLabRule>,
  key: string,
): CustomLabRule[] {
  return rules.filter((rule) => ruleKey(rule) !== key);
}
