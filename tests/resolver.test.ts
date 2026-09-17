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
  it("marks manually verified rooms", () => {
    const resolved = resolveMeetings(
      [block("CMPE134", "tuesday")],
      new Set(["cmpe 134"]),
    );

    expect(resolved[0]?.classification).toBe("verified");
  });

  it("leaves every room outside the verified list normal", () => {
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
      "normal",
    ]);
  });
});
