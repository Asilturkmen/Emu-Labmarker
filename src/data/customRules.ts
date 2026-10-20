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
 * The user-selected room type. Omit the default "lab" value from storage
 * to remain compatible with records saved before tutorial support.
 */
export type RuleKind = "lab" | "tutorial";

/**
 * A user-defined lab or tutorial rule. Room-wide rules cover all meetings;
 * timed rules cover the meeting containing the specified day and time.
 * The course code is a display label, not a matching condition, so differences
 * in the portal's course-code format do not affect matching.
 */
export type CustomLabRule =
  | { room: string; day?: undefined; startMinutes?: undefined; course?: undefined; kind?: "tutorial" }
  | { room: string; day: Weekday; startMinutes: number; course?: string; kind?: "tutorial" };

export type TimedCustomLabRule = Extract<CustomLabRule, { day: Weekday }>;

export function isTimedRule(rule: CustomLabRule): rule is TimedCustomLabRule {
  return rule.day !== undefined;
}

export function ruleKind(rule: CustomLabRule): RuleKind {
  return rule.kind ?? "lab";
}

/**
 * Lab rules take priority over tutorial rules when both match a meeting.
 */
const KIND_RANK: Record<RuleKind, number> = { tutorial: 1, lab: 2 };

export function kindRank(kind: RuleKind): number {
  return KIND_RANK[kind];
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

/**
 * Deduplicate rules by room, day and time. Exclude kind so the same entry
 * cannot be added again under a different type.
 */
export function ruleKey(rule: CustomLabRule): string {
  return isTimedRule(rule)
    ? `${rule.room}|${rule.day}|${formatMinutes(rule.startMinutes)}`
    : rule.room;
}

export function ruleLabel(rule: CustomLabRule): string {
  const place = isTimedRule(rule)
    ? `${rule.room} · ${weekdayShortLabel(rule.day)} ${formatMinutes(rule.startMinutes)}`
    : rule.room;
  return ruleKind(rule) === "tutorial" ? `${place} · Tutorial` : place;
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
 * Return room-wide rules of the requested kind.
 * The text fallback cannot apply timed rules because it has no day/time context.
 */
export function roomWideRooms(
  rules: ReadonlyArray<CustomLabRule>,
  kind: RuleKind = "lab",
): ReadonlySet<string> {
  return new Set(
    rules
      .filter((rule) => !isTimedRule(rule) && ruleKind(rule) === kind)
      .map((rule) => rule.room),
  );
}

function parseRule(entry: unknown): CustomLabRule | null {
  if (typeof entry === "string") {
    return isValidRoomCode(entry) ? { room: normalizeRoom(entry) } : null;
  }
  if (typeof entry !== "object" || entry === null) return null;

  const { room, day, start, course, kind } = entry as Record<string, unknown>;
  if (typeof room !== "string" || !isValidRoomCode(room)) return null;
  const tutorial = kind === "tutorial" ? { kind: "tutorial" as const } : {};

  // A tutorial room at every hour has no plain string form of its own.
  if (day === undefined && start === undefined) {
    return { room: normalizeRoom(room), ...tutorial };
  }

  const startMinutes = parseClock(start);
  if (!isWeekday(day) || startMinutes === null) return null;

  const rule: TimedCustomLabRule = { room: normalizeRoom(room), day, startMinutes, ...tutorial };
  if (typeof course === "string") {
    const normalizedCourse = normalizeCourseCode(course);
    if (isValidCourseCode(normalizedCourse)) rule.course = normalizedCourse;
  }
  return rule;
}

/**
 * Validate stored rules and discard invalid entries.
 * Read legacy room-code strings as room-wide lab rules.
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
 * Store room-wide lab rules as strings for compatibility with earlier versions.
 */
export function serializeCustomLabRules(rules: ReadonlyArray<CustomLabRule>): unknown[] {
  return rules.map((rule) => {
    const tutorial = ruleKind(rule) === "tutorial" ? { kind: "tutorial" } : {};
    if (!isTimedRule(rule)) {
      return ruleKind(rule) === "lab" ? rule.room : { room: rule.room, ...tutorial };
    }
    return {
      room: rule.room,
      day: rule.day,
      start: formatMinutes(rule.startMinutes),
      ...(rule.course ? { course: rule.course } : {}),
      ...tutorial,
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
  /** A laboratory unless said otherwise. */
  kind?: RuleKind;
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
  const kind = request.kind ?? "lab";
  const tutorial = kind === "tutorial" ? { kind: "tutorial" as const } : {};
  const roomRule: CustomLabRule = { room, ...tutorial };

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
      ...tutorial,
    };
  }

  const key = ruleKey(rule);
  if (rules.some((existing) => ruleKey(existing) === key)) {
    return { status: "duplicate", rule, ...unchanged };
  }
  // Reject a timed rule already covered by a room-wide rule of equal or higher priority.
  const outranks = (existing: CustomLabRule, other: CustomLabRule) =>
    kindRank(ruleKind(existing)) >= kindRank(ruleKind(other));
  if (
    isTimedRule(rule) &&
    rules.some((existing) => existing.room === room && !isTimedRule(existing) && outranks(existing, rule))
  ) {
    return { status: "covered", rule, ...unchanged };
  }

  // A room-wide rule replaces timed rules of equal or lower priority.
  // Keep higher-priority timed rules, such as a lab within a tutorial room.
  const kept = isTimedRule(rule)
    ? [...rules]
    : rules.filter((existing) => existing.room !== room || !outranks(rule, existing));
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
