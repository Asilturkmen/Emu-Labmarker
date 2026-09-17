import { beforeEach, describe, expect, it } from "vitest";
import { portalTimetable } from "./fixtures/portalTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import { clearTimetableHighlights, highlightTimetable } from "../src/highlighter/highlightTimetable";

function scan() {
  clearTimetableHighlights();
  const rows = parseTimetable();
  const meetings = resolveMeetings(groupMeetingBlocks(rows), new Set(["CMPE134", "CMPE230"]));
  highlightTimetable(meetings);
  return { rows, meetings };
}

describe("supplied UL/LI portal timetable", () => {
  beforeEach(() => { document.body.innerHTML = portalTimetable(); });

  it("reads all 27 course entries per layout with their own day and time", () => {
    const { rows } = scan();
    for (const layout of ["desktop", "mobile"]) {
      const entries = rows.filter((row) => row.layout === layout);
      expect(entries).toHaveLength(27);
      expect(entries.find((row) => row.room === "CMPE134")).toMatchObject({
        courseCode: "CMSE456", day: "wednesday", startMinutes: 750, endMinutes: 800,
      });
      expect(entries.filter((row) => row.room === "CMPE137").map((row) => [row.day, row.startMinutes]))
        .toEqual([["tuesday", 990], ["tuesday", 1050]]);
      expect(entries.find((row) => row.room === "CL114")?.day).toBe("wednesday");
    }
  });

  it("marks precisely four verified and two probable cells in each layout", () => {
    scan();
    for (const selector of [".schedule-table-content", ".schedule-table-content-mobile"]) {
      const container = document.querySelector(selector)!;
      expect(container.querySelectorAll('li.ctime[data-emu-labmark="verified"]')).toHaveLength(4);
      expect(container.querySelectorAll('li.ctime[data-emu-labmark="probable"]')).toHaveLength(2);
      expect(container.querySelectorAll('li.ctime:not([data-emu-labmark])')).toHaveLength(19);
      expect(container.hasAttribute("data-emu-labmark")).toBe(false);
      for (const cell of container.querySelectorAll("[data-emu-labmark]")) {
        expect(cell.querySelectorAll(".emu-labmark-badge")).toHaveLength(1);
        if (cell.getAttribute("data-emu-labmark") === "probable") expect(cell.textContent).toContain("CMPE137");
      }
    }
    expect(document.querySelectorAll("a[data-emu-labmark], ul[data-emu-labmark], div[data-emu-labmark]")).toHaveLength(0);
    expect(document.querySelectorAll(".emu-labmark-legend")).toHaveLength(1);
    expect(document.querySelector(".schedule-panel")?.nextElementSibling?.className).toBe("emu-labmark-legend");
  });

  it("preserves links, removes old per-link badges and remains stable on rescans", () => {
    const originalLinks = [...document.querySelectorAll("a")].map((a) => [a.textContent, a.href, a.target]);
    const oldLink = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("CMPE230"))!;
    oldLink.setAttribute("data-emu-labmark", "verified");
    oldLink.setAttribute("data-emu-labmark-text-match", "");
    oldLink.insertAdjacentHTML("beforeend", '<span class="emu-labmark-badge">LAB</span>');
    for (let i = 0; i < 3; i++) {
      expect(scan().rows).toHaveLength(54);
      expect(document.querySelectorAll(".emu-labmark-badge")).toHaveLength(12);
      expect(document.querySelectorAll(".emu-labmark-legend")).toHaveLength(1);
      expect([...document.querySelectorAll("a")].map((a) => [a.textContent, a.href, a.target])).toEqual(originalLinks);
    }
  });

  it("does not parse or highlight a matching course elsewhere on the page", () => {
    document.body.insertAdjacentHTML("afterbegin", '<aside><a data-day="Monday" data-start="08:30" data-end="09:20">CMSE423/CMPE230</a></aside>');
    expect(scan().rows).toHaveLength(54);
    expect(document.querySelector("aside [data-emu-labmark]")).toBeNull();
  });
});
