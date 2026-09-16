import { isVerifiedLabRoom, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import type { MeetingBlock, ResolvedMeeting } from "../types/timetable";

function courseKey(block: MeetingBlock): string {
  return `${block.layout}|${block.courseCode}`;
}

function findProbableBlocks(blocks: MeetingBlock[]): Set<MeetingBlock> {
  if (blocks.length < 3) return new Set();

  const countByRoom = new Map<string, number>();
  for (const block of blocks) {
    countByRoom.set(block.room, (countByRoom.get(block.room) ?? 0) + 1);
  }

  const rankedRooms = [...countByRoom.entries()].sort(
    (left, right) => right[1] - left[1],
  );
  const dominantRoom = rankedRooms[0];
  const runnerUp = rankedRooms[1];

  if (!dominantRoom || dominantRoom[1] < 2) return new Set();
  if (runnerUp && dominantRoom[1] <= runnerUp[1]) return new Set();

  const nonDominantBlocks = blocks.filter(
    (block) => block.room !== dominantRoom[0],
  );

  return nonDominantBlocks.length === 1
    ? new Set(nonDominantBlocks)
    : new Set();
}

export function resolveMeetings(
  blocks: MeetingBlock[],
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
): ResolvedMeeting[] {
  const blocksByCourse = new Map<string, MeetingBlock[]>();

  for (const block of blocks) {
    const key = courseKey(block);
    const courseBlocks = blocksByCourse.get(key) ?? [];
    courseBlocks.push(block);
    blocksByCourse.set(key, courseBlocks);
  }

  const probableBlocks = new Set<MeetingBlock>();
  for (const courseBlocks of blocksByCourse.values()) {
    for (const block of findProbableBlocks(courseBlocks)) {
      probableBlocks.add(block);
    }
  }

  return blocks.map((block) => ({
    block,
    classification: isVerifiedLabRoom(block.room, verifiedRooms)
      ? "verified"
      : probableBlocks.has(block)
        ? "probable"
        : "normal",
  }));
}
