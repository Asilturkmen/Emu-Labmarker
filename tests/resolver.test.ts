import { describe, expect, it } from "vitest";

import { resolveMeetings } from "../src/resolver/resolveMeetings";
import type { MeetingBlock } from "../src/types/timetable";

function block(
  room: string,
  day: string,
  courseCode = "CMSE425",
): MeetingBlock {
  return {
    courseCode,
    room,
    day,
    startMinutes: 14 * 60 + 30,
    endMinutes: 16 * 60 + 20,
    layout: "desktop",
    rows: [],
  };
}

describe("resolveMeetings", () => {
  it("marks manually verified rooms red regardless of the heuristic", () => {
    const resolved = resolveMeetings(
      [block("CMPE134", "tuesday")],
      new Set(["cmpe 134"]),
    );

    expect(resolved[0]?.classification).toBe("verified");
  });

  it("marks the sole non-dominant meeting block as probable", () => {
    const resolved = resolveMeetings(
      [
        block("CMPE127", "tuesday"),
        block("CMPE127", "thursday"),
        block("CMPE134", "tuesday"),
      ],
      new Set(),
    );

    expect(resolved.map(({ classification }) => classification)).toEqual([
      "normal",
      "normal",
      "probable",
    ]);
  });

  it.each([
    {
      name: "fewer than three blocks",
      blocks: [block("A101", "monday"), block("B101", "tuesday")],
    },
    {
      name: "no unique dominant room",
      blocks: [
        block("A101", "monday"),
        block("A101", "tuesday"),
        block("B101", "wednesday"),
        block("B101", "thursday"),
      ],
    },
    {
      name: "more than one non-dominant block",
      blocks: [
        block("A101", "monday"),
        block("A101", "tuesday"),
        block("A101", "wednesday"),
        block("B101", "thursday"),
        block("C101", "friday"),
      ],
    },
  ])("does not guess when $name", ({ blocks }) => {
    expect(resolveMeetings(blocks).every((item) => item.classification === "normal")).toBe(
      true,
    );
  });
});
