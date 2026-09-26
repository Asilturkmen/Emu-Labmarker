import { describe, expect, it } from "vitest";

import { suggestRoom, type TimetableSession } from "../src/timetableSessions";

const VERIFIED = new Set(["CMPE134"]);

function session(room: string): TimetableSession {
  return { courseCode: "CMSE423", room, day: "monday", startMinutes: 510, endMinutes: 620 };
}

const SESSIONS = ["CMPE030", "CMPE025", "CMPE026", "CL116", "CMPE134"].map(session);

describe("suggestRoom", () => {
  it("completes to the first timetable room that starts with the text", () => {
    expect(suggestRoom("cmpe0", SESSIONS, VERIFIED)).toBe("CMPE025");
    expect(suggestRoom("CMPE03", SESSIONS, VERIFIED)).toBe("CMPE030");
    expect(suggestRoom(" cmpe 0", SESSIONS, VERIFIED)).toBe("CMPE025");
    expect(suggestRoom("c", SESSIONS, VERIFIED)).toBe("CL116");
  });

  it("offers nothing once a whole room is typed, or when nothing matches", () => {
    expect(suggestRoom("CMPE030", SESSIONS, VERIFIED)).toBeNull();
    expect(suggestRoom("CMPE09", SESSIONS, VERIFIED)).toBeNull();
    expect(suggestRoom("", SESSIONS, VERIFIED)).toBeNull();
    // A pasted entry is left for the parser, not completed.
    expect(suggestRoom("CMSE423/CMPE0", SESSIONS, VERIFIED)).toBeNull();
  });

  it("leaves out confirmed laboratories, which cannot be added", () => {
    expect(suggestRoom("CMPE1", SESSIONS, VERIFIED)).toBeNull();
  });
});
