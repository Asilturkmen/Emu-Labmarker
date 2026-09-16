import { describe, expect, it } from "vitest";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import type { ParsedMeetingRow } from "../src/types/timetable";

function row(overrides: Partial<ParsedMeetingRow>): ParsedMeetingRow {
  return {
    courseCode: "CMSE425",
    room: "CMPE137",
    day: "tuesday",
    startMinutes: 16 * 60 + 30,
    endMinutes: 17 * 60 + 20,
    layout: "desktop",
    link: document.createElement("a"),
    ...overrides,
  };
}

describe("groupMeetingBlocks", () => {
  it("merges hourly rows separated by the normal ten-minute break", () => {
    const first = row({});
    const second = row({
      startMinutes: 17 * 60 + 30,
      endMinutes: 18 * 60 + 20,
    });

    const blocks = groupMeetingBlocks([second, first]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      startMinutes: 16 * 60 + 30,
      endMinutes: 18 * 60 + 20,
    });
    expect(blocks[0]?.rows).toHaveLength(2);
  });

  it("keeps non-contiguous rows and different rooms as separate blocks", () => {
    const blocks = groupMeetingBlocks([
      row({}),
      row({ startMinutes: 18 * 60 + 30, endMinutes: 19 * 60 + 20 }),
      row({ room: "CMPE134", startMinutes: 17 * 60 + 30, endMinutes: 18 * 60 + 20 }),
    ]);

    expect(blocks).toHaveLength(3);
  });

  it("does not merge matching entries across desktop and mobile layouts", () => {
    expect(groupMeetingBlocks([row({}), row({ layout: "mobile" })])).toHaveLength(2);
  });
});
