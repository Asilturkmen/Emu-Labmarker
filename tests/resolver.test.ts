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

  it("marks rooms the user added as custom", () => {
    const resolved = resolveMeetings(
      [block("CMPE025", "tuesday"), block("CMPE127", "tuesday")],
      new Set(["CMPE134"]),
      [{ room: "CMPE025" }],
    );

    expect(resolved.map(({ classification }) => classification)).toEqual([
      "custom",
      "normal",
    ]);
  });

  it("keeps a confirmed laboratory verified even if the user also added it", () => {
    const resolved = resolveMeetings(
      [block("CMPE134", "tuesday")],
      new Set(["CMPE134"]),
      [{ room: "CMPE134" }],
    );

    expect(resolved[0]?.classification).toBe("verified");
  });

  // A room that hosts one tutorial a week must not turn every other course
  // taught in it into a laboratory.
  it("marks only the meeting a timed rule names", () => {
    const friday = block("CMPE030", "friday");
    const resolved = resolveMeetings(
      [block("CMPE030", "monday"), friday, { ...friday, startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 20 }],
      new Set(),
      [{ room: "CMPE030", day: "friday", startMinutes: 14 * 60 + 30 }],
    );

    expect(resolved.map(({ classification }) => classification)).toEqual([
      "normal",
      "custom",
      "normal",
    ]);
  });

  it("covers the whole meeting when a timed rule names its second hour", () => {
    const resolved = resolveMeetings(
      [block("CMPE030", "friday")],
      new Set(),
      [{ room: "CMPE030", day: "friday", startMinutes: 15 * 60 + 30 }],
    );

    expect(resolved[0]?.classification).toBe("custom");
  });

  it("marks a tutorial rule as tutorial, and lets a laboratory rule win over it", () => {
    const resolved = resolveMeetings(
      [block("CMPE030", "friday"), block("CMPE031", "friday")],
      new Set(),
      [
        { room: "CMPE030", kind: "tutorial" },
        { room: "CMPE031", kind: "tutorial" },
        { room: "CMPE031", day: "friday", startMinutes: 14 * 60 + 30 },
      ],
    );

    expect(resolved.map(({ classification }) => classification)).toEqual(["tutorial", "custom"]);
  });

  it("keeps a confirmed laboratory verified under a timed rule too", () => {
    const resolved = resolveMeetings(
      [block("CMPE134", "friday")],
      new Set(["CMPE134"]),
      [{ room: "CMPE134", day: "friday", startMinutes: 14 * 60 + 30 }],
    );

    expect(resolved[0]?.classification).toBe("verified");
  });
});
