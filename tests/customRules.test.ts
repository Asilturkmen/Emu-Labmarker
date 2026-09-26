import { describe, expect, it } from "vitest";

import {
  addRuleToList,
  parseClock,
  parseCustomLabRules,
  removeRuleFromList,
  roomWideRooms,
  ruleKey,
  ruleLabel,
  ruleMatches,
  serializeCustomLabRules,
  type CustomLabRule,
} from "../src/data/customRules";
import { MAX_CUSTOM_ROOMS } from "../src/data/labRooms";

const VERIFIED = new Set(["CMPE134", "CMPE230"]);
const FRIDAY_1030: CustomLabRule = { room: "CMPE030", day: "friday", startMinutes: 630 };

describe("addRuleToList for a room at every hour", () => {
  it("normalizes the room before storing it", () => {
    expect(addRuleToList([], { room: "cmpe 025" }, VERIFIED)).toMatchObject({
      status: "added",
      rule: { room: "CMPE025" },
      rules: [{ room: "CMPE025" }],
    });
  });

  it("accepts a whole timetable entry pasted from the portal", () => {
    expect(addRuleToList([], { room: "CMSE423/CMPE025" }, VERIFIED).rule).toEqual({ room: "CMPE025" });
    expect(addRuleToList([], { room: "MGMT101/CL 116" }, VERIFIED).rule).toEqual({ room: "CL116" });
  });

  it("keeps the existing list on every rejection", () => {
    const rules = [{ room: "CMPE025" }];

    const invalid = addRuleToList(rules, { room: "??" }, VERIFIED);
    const duplicate = addRuleToList(rules, { room: "cmpe 025" }, VERIFIED);
    const verified = addRuleToList(rules, { room: "CMPE134" }, VERIFIED);

    expect(invalid.status).toBe("invalid");
    expect(duplicate.status).toBe("duplicate");
    expect(verified.status).toBe("verified");
    for (const result of [invalid, duplicate, verified]) {
      expect(result.rules).toEqual([{ room: "CMPE025" }]);
    }
  });

  it("stops at the list limit", () => {
    const rules = Array.from({ length: MAX_CUSTOM_ROOMS }, (_unused, index) => ({
      room: `CL${index + 100}`,
    }));

    expect(addRuleToList(rules, { room: "CMPE025" }, VERIFIED)).toMatchObject({
      status: "limit",
      rules,
    });
  });

  it("does not modify the list it was given", () => {
    const rules = [{ room: "CMPE025" }];

    addRuleToList(rules, { room: "CL116" }, VERIFIED);

    expect(rules).toEqual([{ room: "CMPE025" }]);
  });

  it("absorbs the room's timed rules, which it makes redundant", () => {
    const rules: CustomLabRule[] = [FRIDAY_1030, { room: "CL116" }];

    expect(addRuleToList(rules, { room: "CMPE030" }, VERIFIED)).toMatchObject({
      status: "added",
      rules: [{ room: "CL116" }, { room: "CMPE030" }],
      absorbed: 1,
    });
  });
});

describe("addRuleToList for a single meeting", () => {
  it("stores the room, the day and the start time", () => {
    expect(
      addRuleToList([], { room: "cmpe030", day: "friday", start: "10:30" }, VERIFIED),
    ).toMatchObject({ status: "added", rule: FRIDAY_1030, rules: [FRIDAY_1030] });
  });

  it("keeps the course as a label, from the request or a pasted entry", () => {
    expect(
      addRuleToList([], { room: "CMPE030", day: "friday", start: "10:30", course: "cmpe 224" }, VERIFIED).rule,
    ).toEqual({ ...FRIDAY_1030, course: "CMPE224" });
    expect(
      addRuleToList([], { room: "CMPE224/CMPE030", day: "friday", start: "10:30" }, VERIFIED).rule,
    ).toEqual({ ...FRIDAY_1030, course: "CMPE224" });
  });

  it("lets the same room hold rules at different times", () => {
    const { rules } = addRuleToList([FRIDAY_1030], { room: "CMPE030", day: "monday", start: "10:30" }, VERIFIED);

    expect(rules.map(ruleLabel)).toEqual(["CMPE030 · Cum 10:30", "CMPE030 · Pzt 10:30"]);
  });

  it("rejects a missing or malformed time", () => {
    for (const start of [undefined, "", "25:00", "10", "10:3"]) {
      expect(
        addRuleToList([], { room: "CMPE030", day: "friday", start }, VERIFIED).status,
        String(start),
      ).toBe("invalid-time");
    }
  });

  it("rejects duplicates, verified rooms and rooms already covered at every hour", () => {
    const request = { room: "CMPE030", day: "friday", start: "10:30" } as const;

    expect(addRuleToList([FRIDAY_1030], request, VERIFIED).status).toBe("duplicate");
    expect(addRuleToList([{ room: "CMPE030" }], request, VERIFIED).status).toBe("covered");
    expect(addRuleToList([], { ...request, room: "CMPE134" }, VERIFIED).status).toBe("verified");
  });
});

describe("ruleMatches", () => {
  const meeting = { room: "CMPE030", day: "friday", startMinutes: 630, endMinutes: 740 };

  it("covers every meeting in the room when there is no time", () => {
    expect(ruleMatches({ room: "CMPE030" }, meeting)).toBe(true);
    expect(ruleMatches({ room: "CMPE030" }, { ...meeting, day: "monday" })).toBe(true);
    expect(ruleMatches({ room: "CMPE031" }, meeting)).toBe(false);
  });

  it("covers only the meeting that includes the time", () => {
    expect(ruleMatches(FRIDAY_1030, meeting)).toBe(true);
    // The second hour of the same meeting.
    expect(ruleMatches({ ...FRIDAY_1030, startMinutes: 690 }, meeting)).toBe(true);
    expect(ruleMatches(FRIDAY_1030, { ...meeting, day: "monday" })).toBe(false);
    expect(ruleMatches(FRIDAY_1030, { ...meeting, startMinutes: 750, endMinutes: 800 })).toBe(false);
    // The end is exclusive: the next meeting starts where this one ends.
    expect(ruleMatches({ ...FRIDAY_1030, startMinutes: 740 }, meeting)).toBe(false);
  });
});

describe("stored rules", () => {
  it("keep every-hour rules as the plain strings earlier versions wrote", () => {
    const rules: CustomLabRule[] = [{ room: "CMPE025" }, { ...FRIDAY_1030, course: "CMPE224" }];

    const stored = serializeCustomLabRules(rules);

    expect(stored).toEqual([
      "CMPE025",
      { room: "CMPE030", day: "friday", start: "10:30", course: "CMPE224" },
    ]);
    expect(parseCustomLabRules(stored)).toEqual(rules);
  });

  it("read a list saved by an earlier version unchanged", () => {
    expect(parseCustomLabRules(["CMPE025", "cmpe 026"])).toEqual([
      { room: "CMPE025" },
      { room: "CMPE026" },
    ]);
  });

  // Extension storage can be edited outside the popup.
  it("drop anything unusable", () => {
    expect(parseCustomLabRules(undefined)).toEqual([]);
    expect(parseCustomLabRules({ room: "CMPE025" })).toEqual([]);
    expect(
      parseCustomLabRules([
        { room: "CMPE030", day: "friday", start: "10:30", course: "not a course" },
        { room: "CMPE030", day: "caturday", start: "10:30" },
        { room: "CMPE030", day: "friday", start: "late" },
        { room: "??", day: "friday", start: "10:30" },
        { room: "CMPE030", day: "friday" },
        { room: "cmpe 030", day: "friday", start: "10:30" },
        null,
      ]),
    ).toEqual([FRIDAY_1030]);
  });
});

describe("rule helpers", () => {
  it("parse clock times", () => {
    expect(parseClock("10:30")).toBe(630);
    expect(parseClock("8:30")).toBe(510);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock(630)).toBeNull();
  });

  it("remove a rule by its key and nothing else", () => {
    const rules: CustomLabRule[] = [{ room: "CMPE030" }, FRIDAY_1030];

    expect(removeRuleFromList(rules, ruleKey(FRIDAY_1030))).toEqual([{ room: "CMPE030" }]);
    expect(removeRuleFromList(rules, "CMPE030")).toEqual([FRIDAY_1030]);
    expect(removeRuleFromList(rules, "CL116")).toEqual(rules);
  });

  it("give the text fallback only the rooms covered at every hour", () => {
    expect([...roomWideRooms([{ room: "CL116" }, FRIDAY_1030])]).toEqual(["CL116"]);
  });
});
