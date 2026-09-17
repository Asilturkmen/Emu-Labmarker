import { isVerifiedLabRoom, NO_ROOMS, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import type { MeetingBlock, ResolvedMeeting } from "../types/timetable";

export function resolveMeetings(
  blocks: MeetingBlock[],
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
  temporaryRooms: ReadonlySet<string> = NO_ROOMS,
): ResolvedMeeting[] {
  return blocks.map((block) => ({
    block,
    // A confirmed laboratory stays confirmed even if the user also added it.
    classification: isVerifiedLabRoom(block.room, verifiedRooms)
      ? "verified"
      : isVerifiedLabRoom(block.room, temporaryRooms)
        ? "temporary"
        : "normal",
  }));
}
