import { ruleMatches, type CustomLabRule } from "../data/customRules";
import { isVerifiedLabRoom, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import type { MeetingBlock, ResolvedMeeting } from "../types/timetable";

export function resolveMeetings(
  blocks: MeetingBlock[],
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
  customRules: ReadonlyArray<CustomLabRule> = [],
): ResolvedMeeting[] {
  return blocks.map((block) => ({
    block,
    // A confirmed laboratory stays confirmed even if the user also added it.
    classification: isVerifiedLabRoom(block.room, verifiedRooms)
      ? "verified"
      : customRules.some((rule) => ruleMatches(rule, block))
        ? "custom"
        : "normal",
  }));
}
