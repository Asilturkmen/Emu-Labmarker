import { isVerifiedLabRoom, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import type { MeetingBlock, ResolvedMeeting } from "../types/timetable";

export function resolveMeetings(
  blocks: MeetingBlock[],
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): ResolvedMeeting[] {
  return blocks.map((block) => ({
    block,
    classification: isVerifiedLabRoom(block.room, verifiedRooms)
      ? "verified"
      : "normal",
  }));
}
