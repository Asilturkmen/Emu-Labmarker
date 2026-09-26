import { normalizeRoom } from "./courseRoom";

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
