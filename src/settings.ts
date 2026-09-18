import {
  addRoomToList,
  isValidRoomCode,
  removeRoomFromList,
  type AddRoomStatus,
} from "./data/labRooms";
import { normalizeRoom } from "./data/courseRoom";

export const LABMARK_ENABLED_KEY = "emuLabmarkEnabled";
export const CUSTOM_ROOMS_KEY = "emuLabmarkCustomRooms";

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
export function parseCustomLabRooms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const rooms: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isValidRoomCode(entry)) continue;
    const room = normalizeRoom(entry);
    if (!rooms.includes(room)) rooms.push(room);
  }
  return rooms;
}

export async function getCustomLabRooms(): Promise<string[]> {
  const stored = await browser.storage.local.get(CUSTOM_ROOMS_KEY);
  return parseCustomLabRooms(stored[CUSTOM_ROOMS_KEY]);
}

async function setCustomLabRooms(rooms: string[]): Promise<void> {
  await browser.storage.local.set({ [CUSTOM_ROOMS_KEY]: rooms });
}

export async function addCustomLabRoom(
  input: string,
): Promise<{ status: AddRoomStatus; room: string; rooms: string[] }> {
  const result = addRoomToList(await getCustomLabRooms(), input);
  if (result.status === "added") await setCustomLabRooms(result.rooms);
  return result;
}

export async function removeCustomLabRoom(
  room: string,
): Promise<string[]> {
  const rooms = removeRoomFromList(await getCustomLabRooms(), room);
  await setCustomLabRooms(rooms);
  return rooms;
}
