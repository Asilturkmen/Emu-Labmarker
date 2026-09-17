/**
 * Add only rooms that have been manually verified as laboratory rooms.
 * Values are normalized before lookup, so spacing and letter case do not matter.
 */
export const VERIFIED_LAB_ROOMS: ReadonlySet<string> = new Set([
 "CMPE134",
 "CMPE230",

]);

export function normalizeRoom(room: string): string {
  return room.trim().replace(/\s+/g, "").toUpperCase();
}

export function isVerifiedLabRoom(
  room: string,
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): boolean {
  const normalizedVerifiedRooms = new Set(
    [...verifiedRooms].map(normalizeRoom),
  );

  return normalizedVerifiedRooms.has(normalizeRoom(room));
}
