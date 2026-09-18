import { beforeEach, describe, expect, it } from "vitest";
import { portalTimetable } from "./fixtures/portalTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import { clearTimetableHighlights, highlightTimetable, highlightLabRoomText } from "../src/highlighter/highlightTimetable";

// Pinned so that editing the verified room list cannot break these tests.
const LAB_ROOMS: ReadonlySet<string> = new Set(["CMPE134", "CMPE230"]);

function scan() {
  clearTimetableHighlights();
  const rows = parseTimetable();
  const meetings = resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS);
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

  it("marks only the four verified cells in each layout", () => {
    scan();
    for (const selector of [".schedule-table-content", ".schedule-table-content-mobile"]) {
      const container = document.querySelector(selector)!;
      expect(container.querySelectorAll('li.ctime[data-emu-labmarker="verified"]')).toHaveLength(4);
      expect(container.querySelectorAll('li.ctime[data-emu-labmarker]:not([data-emu-labmarker="verified"])')).toHaveLength(0);
      expect(container.querySelectorAll('li.ctime:not([data-emu-labmarker])')).toHaveLength(21);
      expect(container.hasAttribute("data-emu-labmarker")).toBe(false);
      for (const cell of container.querySelectorAll("[data-emu-labmarker]")) {
        expect(cell.querySelectorAll(".emu-labmarker-badge")).toHaveLength(1);
        expect(cell.getAttribute("data-emu-labmarker")).toBe("verified");
      }
    }
    expect(document.querySelectorAll("a[data-emu-labmarker], ul[data-emu-labmarker], div[data-emu-labmarker]")).toHaveLength(0);
    expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
    expect(document.querySelectorAll(".emu-labmarker-legend-item")).toHaveLength(1);
    expect(document.querySelector(".schedule-panel")?.nextElementSibling?.className).toBe("emu-labmarker-legend");
  });

  it("preserves links, removes old per-link badges and remains stable on rescans", () => {
    const originalLinks = [...document.querySelectorAll("a")].map((a) => [a.textContent, a.href, a.target]);
    const oldLink = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("CMPE230"))!;
    oldLink.setAttribute("data-emu-labmarker", "verified");
    oldLink.setAttribute("data-emu-labmarker-text-match", "");
    oldLink.insertAdjacentHTML("beforeend", '<span class="emu-labmarker-badge">LAB</span>');
    for (let i = 0; i < 3; i++) {
      expect(scan().rows).toHaveLength(54);
      expect(document.querySelectorAll(".emu-labmarker-badge")).toHaveLength(8);
      expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
      expect([...document.querySelectorAll("a")].map((a) => [a.textContent, a.href, a.target])).toEqual(originalLinks);
    }
  });

  it("does not parse or highlight a matching course elsewhere on the page", () => {
    document.body.insertAdjacentHTML("afterbegin", '<aside><a data-day="Monday" data-start="08:30" data-end="09:20">CMSE423/CMPE230</a></aside>');
    expect(scan().rows).toHaveLength(54);
    expect(document.querySelector("aside [data-emu-labmarker]")).toBeNull();
  });

  // The content script runs the text fallback after the parser, so the two
  // passes must not mark the same cell twice or reach beyond the timetable.
  it("stays stable when the text fallback runs after the parser", () => {
    for (let i = 0; i < 3; i++) {
      scan();
      highlightLabRoomText(document, LAB_ROOMS);

      for (const selector of [".schedule-table-content", ".schedule-table-content-mobile"]) {
        const container = document.querySelector(selector)!;
        expect(container.querySelectorAll('li.ctime[data-emu-labmarker="verified"]')).toHaveLength(4);
        expect(container.querySelectorAll("li.ctime:not([data-emu-labmarker])")).toHaveLength(21);
      }
      expect(document.querySelectorAll(".emu-labmarker-badge")).toHaveLength(8);
      expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
      expect(document.querySelectorAll("a[data-emu-labmarker], ul[data-emu-labmarker], div[data-emu-labmarker]")).toHaveLength(0);
    }
  });

  it("marks a user added room in its own colour without touching the verified ones", () => {
    // CMPE025 fills four cells per layout: Monday 12:30 and 13:30,
    // Friday 08:30 and 09:30.
    const custom: ReadonlySet<string> = new Set(["CMPE025"]);
    clearTimetableHighlights();
    const rows = parseTimetable();
    highlightTimetable(resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS, custom));
    highlightLabRoomText(document, LAB_ROOMS, custom);

    for (const selector of [".schedule-table-content", ".schedule-table-content-mobile"]) {
      const container = document.querySelector(selector)!;
      expect(container.querySelectorAll('li.ctime[data-emu-labmarker="verified"]')).toHaveLength(4);
      expect(container.querySelectorAll('li.ctime[data-emu-labmarker="custom"]')).toHaveLength(4);
      expect(container.querySelectorAll("li.ctime:not([data-emu-labmarker])")).toHaveLength(17);
    }
    expect(document.querySelectorAll(".emu-labmarker-legend-item")).toHaveLength(2);
  });
});
