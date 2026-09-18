import { matchCourseRoom, normalizeRoom } from "./courseRoom";

/**
 * Add only rooms that have been manually verified as laboratory rooms.
 * Values are normalized before lookup, so spacing and letter case do not matter.
 */
export const VERIFIED_LAB_ROOMS: ReadonlySet<string> = new Set([

  //1. kat
  "CMPE134",
  "CMPE135",
  "CMPE136",
  "CMPE137",
  //2. kat
  "CMPE227",
  "CMPE228",
  "CMPE230",
  "CMPE231",
  "CMPE235",
  "CMPE236",
  "CMPE238",
  "CMPE239",
]);

// The text fallback checks every text node on the page, so normalizing the
// room list on each lookup would be wasteful. Each set is normalized once.
const normalizedRoomCache = new WeakMap<ReadonlySet<string>, ReadonlySet<string>>();

function getNormalizedRooms(rooms: ReadonlySet<string>): ReadonlySet<string> {
  const cached = normalizedRoomCache.get(rooms);
  if (cached) return cached;

  const normalized = new Set([...rooms].map(normalizeRoom));
  normalizedRoomCache.set(rooms, normalized);
  return normalized;
}

export function isVerifiedLabRoom(
  room: string,
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): boolean {
  return getNormalizedRooms(verifiedRooms).has(normalizeRoom(room));
}

export const NO_ROOMS: ReadonlySet<string> = new Set<string>();

/** Keeps a hand-maintained list from growing without bound. */
export const MAX_CUSTOM_ROOMS = 50;

/**
 * Rooms are always compared as whole normalized codes, so an unusually short
 * code cannot match unrelated courses. The shape can therefore stay permissive:
 * it only has to look like a room rather than free text.
 */
export function isValidRoomCode(room: string): boolean {
  const normalized = normalizeRoom(room);
  return (
    normalized.length >= 3 &&
    normalized.length <= 16 &&
    /^[A-Z]{2,}[A-Z0-9]*$/.test(normalized)
  );
}

export type AddRoomStatus =
  | "added"
  | "invalid"
  | "duplicate"
  | "verified"
  | "limit";

/**
 * Adds a user supplied room to a hand-maintained list. Pure, so the popup and
 * the storage layer can share the same rules.
 */
export function addRoomToList(
  rooms: ReadonlyArray<string>,
  input: string,
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): { status: AddRoomStatus; room: string; rooms: string[] } {
  // Accept a whole timetable entry, so that copying "CMSE423/CMPE025" from the
  // page works as well as typing the room on its own.
  const room = matchCourseRoom(input)?.room ?? normalizeRoom(input);
  const unchanged = { room, rooms: [...rooms] };

  if (!isValidRoomCode(room)) return { status: "invalid", ...unchanged };
  if (isVerifiedLabRoom(room, verifiedRooms)) {
    return { status: "verified", ...unchanged };
  }
  if (rooms.some((existing) => normalizeRoom(existing) === room)) {
    return { status: "duplicate", ...unchanged };
  }
  if (rooms.length >= MAX_CUSTOM_ROOMS) {
    return { status: "limit", ...unchanged };
  }

  return { status: "added", room, rooms: [...rooms, room] };
}

export function removeRoomFromList(
  rooms: ReadonlyArray<string>,
  input: string,
): string[] {
  const room = normalizeRoom(input);
  return rooms.filter((existing) => normalizeRoom(existing) !== room);
}
