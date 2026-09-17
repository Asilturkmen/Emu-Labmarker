import {
  addRoomToList,
  isValidRoomCode,
  removeRoomFromList,
  type AddRoomStatus,
} from "./data/labRooms";
import { normalizeRoom } from "./data/courseRoom";

export const LABMARK_ENABLED_KEY = "emuLabmarkEnabled";
export const TEMPORARY_ROOMS_KEY = "emuLabmarkTemporaryRooms";

export async function getLabMarkEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(LABMARK_ENABLED_KEY);
  return stored[LABMARK_ENABLED_KEY] !== false;
}

export async function setLabMarkEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [LABMARK_ENABLED_KEY]: enabled });
}

/**
 * Rooms the user marked as laboratories themselves, in the order they added
 * them. Extension storage can be edited outside the popup, so anything that is
 * not a usable room code is dropped instead of trusted.
 */
export function parseTemporaryLabRooms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const rooms: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isValidRoomCode(entry)) continue;
    const room = normalizeRoom(entry);
    if (!rooms.includes(room)) rooms.push(room);
  }
  return rooms;
}

export async function getTemporaryLabRooms(): Promise<string[]> {
  const stored = await browser.storage.local.get(TEMPORARY_ROOMS_KEY);
  return parseTemporaryLabRooms(stored[TEMPORARY_ROOMS_KEY]);
}

async function setTemporaryLabRooms(rooms: string[]): Promise<void> {
  await browser.storage.local.set({ [TEMPORARY_ROOMS_KEY]: rooms });
}

export async function addTemporaryLabRoom(
  input: string,
): Promise<{ status: AddRoomStatus; room: string; rooms: string[] }> {
  const result = addRoomToList(await getTemporaryLabRooms(), input);
  if (result.status === "added") await setTemporaryLabRooms(result.rooms);
  return result;
}

export async function removeTemporaryLabRoom(
  room: string,
): Promise<string[]> {
  const rooms = removeRoomFromList(await getTemporaryLabRooms(), room);
  await setTemporaryLabRooms(rooms);
  return rooms;
}
