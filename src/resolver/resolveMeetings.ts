import { ruleKind, ruleMatches, type CustomLabRule } from "../data/customRules";
import { isVerifiedLabRoom, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import type {
  MeetingBlock,
  ResolvedMeeting,
  RoomClassification,
} from "../types/timetable";

function classify(
  block: MeetingBlock,
  verifiedRooms: ReadonlySet<string>,
  customRules: ReadonlyArray<CustomLabRule>,
): RoomClassification {
  // A confirmed laboratory stays confirmed even if the user also added it.
  if (isVerifiedLabRoom(block.room, verifiedRooms)) return "verified";
  const kinds = customRules
    .filter((rule) => ruleMatches(rule, block))
    .map(ruleKind);
  // Where both apply, the laboratory is what matters.
  if (kinds.includes("lab")) return "custom";
  if (kinds.includes("tutorial")) return "tutorial";
  return "normal";
}

export function resolveMeetings(
  blocks: MeetingBlock[],
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
  customRules: ReadonlyArray<CustomLabRule> = [],
): ResolvedMeeting[] {
  return blocks.map((block) => ({
    block,
    classification: classify(block, verifiedRooms, customRules),
  }));
}
