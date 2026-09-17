import type { MeetingBlock, ParsedMeetingRow } from "../types/timetable";

const MAX_CONTIGUOUS_GAP_MINUTES = 15;

function groupKey(row: ParsedMeetingRow): string {
  return [row.layout, row.courseCode, row.day, row.room].join("|");
}

export function groupMeetingBlocks(rows: ParsedMeetingRow[]): MeetingBlock[] {
  const rowsByCourseDayRoom = new Map<string, ParsedMeetingRow[]>();

  for (const row of rows) {
    const key = groupKey(row);
    const matchingRows = rowsByCourseDayRoom.get(key) ?? [];
    matchingRows.push(row);
    rowsByCourseDayRoom.set(key, matchingRows);
  }

  const blocks: MeetingBlock[] = [];

  for (const matchingRows of rowsByCourseDayRoom.values()) {
    const sortedRows = [...matchingRows].sort(
      (left, right) => left.startMinutes - right.startMinutes,
    );
    let currentBlock: MeetingBlock | null = null;

    for (const row of sortedRows) {
      if (!currentBlock) {
        currentBlock = {
          courseCode: row.courseCode,
          room: row.room,
          day: row.day,
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          layout: row.layout,
          rows: [row],
        };
        continue;
      }

      // Rows are sorted by start time, so a negative gap means this row
      // overlaps the block and belongs to it.
      const gap = row.startMinutes - currentBlock.endMinutes;
      if (gap <= MAX_CONTIGUOUS_GAP_MINUTES) {
        currentBlock.endMinutes = Math.max(
          currentBlock.endMinutes,
          row.endMinutes,
        );
        currentBlock.rows.push(row);
        continue;
      }

      blocks.push(currentBlock);
      currentBlock = {
        courseCode: row.courseCode,
        room: row.room,
        day: row.day,
        startMinutes: row.startMinutes,
        endMinutes: row.endMinutes,
        layout: row.layout,
        rows: [row],
      };
    }

    if (currentBlock) blocks.push(currentBlock);
  }

  return blocks.sort(
    (left, right) =>
      left.courseCode.localeCompare(right.courseCode) ||
      left.day.localeCompare(right.day) ||
      left.startMinutes - right.startMinutes,
  );
}
