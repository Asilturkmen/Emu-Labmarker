import { beforeEach, describe, expect, it } from "vitest";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import {
  clearTimetableHighlights,
  highlightTimetable,
  highlightVerifiedRoomText,
} from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import type {
  MeetingBlock,
  ResolvedMeeting,
  RoomClassification,
} from "../src/types/timetable";

// Pinned so that editing the verified room list cannot change these results.
const LAB_ROOMS: ReadonlySet<string> = new Set(["CMPE134", "CMPE230"]);

function resolved(classification: RoomClassification): ResolvedMeeting {
  const link = document.createElement("a");
  document.body.append(link);

  const block: MeetingBlock = {
    courseCode: "CMSE425",
    room: "CMPE134",
    day: "tuesday",
    startMinutes: 16 * 60 + 30,
    endMinutes: 18 * 60 + 20,
    layout: "desktop",
    rows: [
      {
        courseCode: "CMSE425",
        room: "CMPE134",
        day: "tuesday",
        startMinutes: 16 * 60 + 30,
        endMinutes: 17 * 60 + 20,
        layout: "desktop",
        link,
      },
    ],
  };

  return { block, classification };
}

describe("highlightTimetable", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  it("renders the verified label", () => {
    const meeting = resolved("verified");

    highlightTimetable([meeting]);

    const link = meeting.block.rows[0]?.link;
    expect(link?.dataset.emuLabmark).toBe("verified");
    expect(link?.querySelector(".emu-labmark-badge")?.textContent).toBe("LAB");
    expect(link?.querySelector(".emu-labmark-badge")?.getAttribute("aria-label")).toBe("LAB SINIFI");
  });

  it("leaves normal links unmarked and removes stale marks", () => {
    const meeting = resolved("verified");
    highlightTimetable([meeting]);

    meeting.classification = "normal";
    highlightTimetable([meeting]);

    const link = meeting.block.rows[0]?.link;
    expect(link?.hasAttribute("data-emu-labmark")).toBe(false);
    expect(link?.querySelector(".emu-labmark-badge")).toBeNull();
  });

  it("is idempotent", () => {
    const meeting = resolved("verified");

    highlightTimetable([meeting]);
    highlightTimetable([meeting]);

    expect(meeting.block.rows[0]?.link.querySelectorAll(".emu-labmark-badge")).toHaveLength(
      1,
    );
  });

  it("highlights verified room text even when it is not a link", () => {
    document.body.innerHTML = `
      <div class="portal-course">CMSE423/CMPE230</div>
    `;

    highlightVerifiedRoomText(document, LAB_ROOMS);

    const course = document.querySelector<HTMLElement>(".portal-course");
    expect(course?.dataset.emuLabmark).toBe("verified");
    expect(course?.textContent).toContain("LAB");
  });

  it("marks the whole shared cell once and stays stable across full rescans", () => {
    document.body.innerHTML = `
      <table><thead><tr><th>Time</th><th>Wednesday</th></tr></thead><tbody>
        <tr><td>12:30-13:20</td><td id="shared">
          <a>CMSE423/CMPE230</a><br><a>CMSE456/CMPE134</a>
        </td></tr>
      </tbody></table>
    `;
    for (let scan = 0; scan < 3; scan++) {
      clearTimetableHighlights();
      const rows = parseTimetable();
      expect(rows.map((row) => row.room)).toEqual(["CMPE230", "CMPE134"]);
      highlightTimetable(resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS));
      highlightVerifiedRoomText(document, LAB_ROOMS);
      expect(document.querySelectorAll("[data-emu-labmark]")).toHaveLength(1);
      expect(document.querySelector("#shared")?.getAttribute("data-emu-labmark")).toBe("verified");
      expect(document.querySelectorAll(".emu-labmark-badge")).toHaveLength(1);
      expect(document.querySelectorAll(".emu-labmark-legend")).toHaveLength(1);
    }
    document.querySelectorAll("#shared a").forEach((link) => { link.textContent = "CMSE423/CMPE025"; });
    clearTimetableHighlights();
    highlightTimetable(resolveMeetings(groupMeetingBlocks(parseTimetable()), LAB_ROOMS));
    highlightVerifiedRoomText(document, LAB_ROOMS);
    expect(document.querySelectorAll("[data-emu-labmark], .emu-labmark-legend")).toHaveLength(0);
  });

  it("does not guess that an exceptional room is a laboratory", () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th>Time</th><th>Tuesday</th><th>Thursday</th></tr></thead>
        <tbody>
          <tr><td>14:30-15:20</td><td class="schedule-table-content"><a>CMSE425/CMPE127</a></td><td class="schedule-table-content"><a>CMSE425/CMPE127</a></td></tr>
          <tr><td>15:30-16:20</td><td class="schedule-table-content"><a>CMSE425/CMPE127</a></td><td class="schedule-table-content"><a>CMSE425/CMPE127</a></td></tr>
          <tr><td>16:30-17:20</td><td class="schedule-table-content"><a>CMSE425/CMPE134</a></td><td></td></tr>
          <tr><td>17:30-18:20</td><td class="schedule-table-content"><a>CMSE425/CMPE134</a></td><td></td></tr>
        </tbody>
      </table>
    `;

    const rows = parseTimetable();
    const blocks = groupMeetingBlocks(rows);
    highlightTimetable(resolveMeetings(blocks, new Set()));

    expect(blocks).toHaveLength(3);
    expect(document.querySelectorAll("[data-emu-labmark]")).toHaveLength(0);
  });

  it("does not promote a course to an outer layout cell containing the timetable", () => {
    document.body.innerHTML = `
      <table><tr><td id="layout">
        <div class="schedule-table-content" id="schedule">
          <div class="schedule-table-content-mobile" id="lab"><a>CMSE423/CMPE230</a></div>
          <div class="schedule-table-content-mobile" id="normal"><a>CMSE423/CMPE025</a></div>
        </div>
      </td></tr></table>
    `;
    highlightVerifiedRoomText(document, LAB_ROOMS);
    expect(document.querySelector("#lab")?.getAttribute("data-emu-labmark")).toBe("verified");
    expect(document.querySelectorAll("#layout[data-emu-labmark], #schedule[data-emu-labmark], #normal[data-emu-labmark]")).toHaveLength(0);
  });

  it("keeps plain course links local when their nearest td wraps several blocks", () => {
    document.body.innerHTML = `
      <table><tr><td id="layout">
        <div><a id="lab">CMSE423/CMPE230</a></div>
        <div><a id="normal">CMSE423/CMPE025</a></div>
      </td></tr></table>
    `;
    const meeting = resolved("verified");
    meeting.block.rows[0]!.link = document.querySelector<HTMLAnchorElement>("#lab")!;
    highlightTimetable([meeting]);
    highlightVerifiedRoomText(document, LAB_ROOMS);
    expect(document.querySelector("#lab")?.getAttribute("data-emu-labmark")).toBe("verified");
    expect(document.querySelector("#layout")?.hasAttribute("data-emu-labmark")).toBe(false);
    expect(document.querySelector("#normal")?.hasAttribute("data-emu-labmark")).toBe(false);
  });
});
