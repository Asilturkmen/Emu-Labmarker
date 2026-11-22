import { afterEach, describe, expect, it, vi } from "vitest";

import { hasPortalAccess, portalOriginOf } from "../src/portalAccess";

const STUDENT = "https://student.emu.edu.tr/*";
const STUDENTS = "https://students.emu.edu.tr/*";

/** Safari after the user allowed only some of the portal hosts. */
function allow(granted: string[]): void {
  vi.stubGlobal("browser", {
    permissions: {
      contains: async ({ origins }: { origins: string[] }) => origins.every((o) => granted.includes(o)),
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("portal origin of a page", () => {
  it.each([
    ["https://student.emu.edu.tr/Academic/Timetable", STUDENT],
    ["https://STUDENTS.emu.edu.tr/", STUDENTS],
    ["https://example.com/", null],
    ["http://student.emu.edu.tr/", null],
    [undefined, null],
  ])("%s → %s", (url, origin) => {
    expect(portalOriginOf(url)).toBe(origin);
  });
});

describe("portal access", () => {
  it("is enough when one portal host is allowed, as students use one of the two", async () => {
    allow([STUDENT]);
    expect(await hasPortalAccess()).toBe(true);
  });

  it("checks only the host of the page when one is given", async () => {
    allow([STUDENT]);
    expect(await hasPortalAccess(STUDENT)).toBe(true);
    expect(await hasPortalAccess(STUDENTS)).toBe(false);
  });

  it("is missing when no portal host is allowed", async () => {
    allow([]);
    expect(await hasPortalAccess()).toBe(false);
  });

  it("needs nothing where the browser has no permissions API", async () => {
    vi.stubGlobal("browser", {});
    expect(await hasPortalAccess()).toBe(true);
  });
});
