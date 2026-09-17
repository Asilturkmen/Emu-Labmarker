/**
 * Add only rooms that have been manually verified as laboratory rooms.
 * Values are normalized before lookup, so spacing and letter case do not matter.
 */
export const VERIFIED_LAB_ROOMS: ReadonlySet<string> = new Set([
 "CMPE134",
 "CMPE230",
 "CMPE137",

]);

export function normalizeRoom(room: string): string {
  return room.trim().replace(/\s+/g, "").toUpperCase();
}

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
