import { beforeEach, describe, expect, it } from "vitest";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import {
  clearTimetableHighlights,
  highlightTimetable,
  highlightLabRoomText,
} from "../src/highlighter/highlightTimetable";
import type { CustomLabRule } from "../src/data/customRules";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import type {
  MeetingBlock,
  ResolvedMeeting,
  RoomClassification,
} from "../src/types/timetable";

// Pinned so that editing the verified room list cannot change these results.
const LAB_ROOMS: ReadonlySet<string> = new Set(["CMPE134", "CMPE230"]);
const CUSTOM_ROOMS: ReadonlySet<string> = new Set(["CMPE025"]);
const CUSTOM_RULES: ReadonlyArray<CustomLabRule> = [{ room: "CMPE025" }];

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
    expect(link?.dataset.emuLabmarker).toBe("verified");
    expect(link?.querySelector(".emu-labmarker-badge")?.textContent).toBe("LAB SINIFI");
    expect(link?.querySelector(".emu-labmarker-badge")?.getAttribute("aria-label")).toBe("LAB SINIFI");
  });

  it("leaves normal links unmarked and removes stale marks", () => {
    const meeting = resolved("verified");
    highlightTimetable([meeting]);

    meeting.classification = "normal";
    highlightTimetable([meeting]);

    const link = meeting.block.rows[0]?.link;
    expect(link?.hasAttribute("data-emu-labmarker")).toBe(false);
    expect(link?.querySelector(".emu-labmarker-badge")).toBeNull();
  });

  it("is idempotent", () => {
    const meeting = resolved("verified");

    highlightTimetable([meeting]);
    highlightTimetable([meeting]);

    expect(meeting.block.rows[0]?.link.querySelectorAll(".emu-labmarker-badge")).toHaveLength(
      1,
    );
  });

  it("highlights verified room text even when it is not a link", () => {
    document.body.innerHTML = `
      <div class="portal-course">CMSE423/CMPE230</div>
    `;

    highlightLabRoomText(document, LAB_ROOMS);

    const course = document.querySelector<HTMLElement>(".portal-course");
    expect(course?.dataset.emuLabmarker).toBe("verified");
    expect(course?.textContent).toContain("LAB SINIFI");
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
      highlightLabRoomText(document, LAB_ROOMS);
      expect(document.querySelectorAll("[data-emu-labmarker]")).toHaveLength(1);
      expect(document.querySelector("#shared")?.getAttribute("data-emu-labmarker")).toBe("verified");
      expect(document.querySelectorAll(".emu-labmarker-badge")).toHaveLength(1);
      expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
    }
    document.querySelectorAll("#shared a").forEach((link) => { link.textContent = "CMSE423/CMPE025"; });
    clearTimetableHighlights();
    highlightTimetable(resolveMeetings(groupMeetingBlocks(parseTimetable()), LAB_ROOMS));
    highlightLabRoomText(document, LAB_ROOMS);
    expect(document.querySelectorAll("[data-emu-labmarker], .emu-labmarker-legend")).toHaveLength(0);
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
    expect(document.querySelectorAll("[data-emu-labmarker]")).toHaveLength(0);
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
    highlightLabRoomText(document, LAB_ROOMS);
    expect(document.querySelector("#lab")?.getAttribute("data-emu-labmarker")).toBe("verified");
    expect(document.querySelectorAll("#layout[data-emu-labmarker], #schedule[data-emu-labmarker], #normal[data-emu-labmarker]")).toHaveLength(0);
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
    highlightLabRoomText(document, LAB_ROOMS);
    expect(document.querySelector("#lab")?.getAttribute("data-emu-labmarker")).toBe("verified");
    expect(document.querySelector("#layout")?.hasAttribute("data-emu-labmarker")).toBe(false);
    expect(document.querySelector("#normal")?.hasAttribute("data-emu-labmarker")).toBe(false);
  });

  it("renders the custom label for a room the user added", () => {
    const meeting = resolved("custom");

    highlightTimetable([meeting]);

    const link = meeting.block.rows[0]?.link;
    const badge = link?.querySelector(".emu-labmarker-badge");
    expect(link?.dataset.emuLabmarker).toBe("custom");
    expect(badge?.textContent).toBe("ÖZEL LAB");
    expect(badge?.getAttribute("aria-label")).toBe(
      "ÖZEL LAB (senin eklediğin sınıf)",
    );
  });

  it("highlights a custom room found as plain text", () => {
    document.body.innerHTML = `
      <div class="portal-course">CMSE423/CMPE025</div>
    `;

    highlightLabRoomText(document, LAB_ROOMS, CUSTOM_ROOMS);

    const course = document.querySelector<HTMLElement>(".portal-course");
    expect(course?.dataset.emuLabmarker).toBe("custom");
    expect(course?.textContent).toContain("ÖZEL LAB");
  });

  it("lets a confirmed laboratory win over a custom room in the same cell", () => {
    document.body.innerHTML = `
      <table><thead><tr><th>Time</th><th>Wednesday</th></tr></thead><tbody>
        <tr><td>12:30-13:20</td><td id="shared">
          <a>CMSE423/CMPE025</a><br><a>CMSE456/CMPE230</a>
        </td></tr>
      </tbody></table>
    `;
    const rows = parseTimetable();

    highlightTimetable(
      resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS, CUSTOM_RULES),
    );
    highlightLabRoomText(document, LAB_ROOMS, CUSTOM_ROOMS);

    expect(document.querySelectorAll("[data-emu-labmarker]")).toHaveLength(1);
    expect(document.querySelector("#shared")?.getAttribute("data-emu-labmarker")).toBe("verified");
  });

  it("explains only the kinds that the timetable actually contains", () => {
    document.body.innerHTML = `
      <table><thead><tr><th>Time</th><th>Monday</th><th>Tuesday</th></tr></thead><tbody>
        <tr><td>12:30-13:20</td>
          <td class="schedule-table-content"><a>CMSE423/CMPE230</a></td>
          <td class="schedule-table-content"><a>CMSE423/CMPE025</a></td>
        </tr>
      </tbody></table>
    `;
    const rows = parseTimetable();

    highlightTimetable(resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS, CUSTOM_RULES));

    const items = document.querySelectorAll(".emu-labmarker-legend-item");
    expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
    expect([...items].map((item) => item.querySelector(".emu-labmarker-legend-badge")?.textContent))
      .toEqual(["LAB SINIFI", "ÖZEL LAB"]);

    // With no custom room left, its legend row goes away too.
    clearTimetableHighlights();
    highlightTimetable(resolveMeetings(groupMeetingBlocks(rows), LAB_ROOMS, []));
    expect(document.querySelectorAll(".emu-labmarker-legend-item")).toHaveLength(1);
    expect(document.querySelector(".emu-labmarker-legend-badge")?.textContent).toBe("LAB SINIFI");
  });
  it("writes the readable text colour onto the cell and restores it on clear", () => {
    document.body.innerHTML = `
      <div class="schedule-table-content"><ul><li class="ctime">
        <span><strong><a style="color: rgb(255, 255, 255)">CMSE423/CMPE230</a></strong></span>
      </li></ul></div>
    `;

    highlightLabRoomText(document, LAB_ROOMS);

    const cell = document.querySelector<HTMLElement>("li.ctime")!;
    const link = document.querySelector<HTMLElement>("a")!;
    expect(cell.dataset.emuLabmarker).toBe("verified");
    // Inline !important is what beats the portal's own white-text rule.
    for (const node of [cell, document.querySelector<HTMLElement>("strong")!, link]) {
      expect(node.style.getPropertyValue("color")).toBe("rgb(23, 54, 93)");
      expect(node.style.getPropertyPriority("color")).toBe("important");
    }
    const badge = cell.querySelector<HTMLElement>(".emu-labmarker-badge")!;
    expect(badge.style.getPropertyValue("color")).toBe("");

    clearTimetableHighlights();

    // The portal's own inline colour comes back, ours leaves no trace.
    expect(link.style.getPropertyValue("color")).toBe("rgb(255, 255, 255)");
    expect(link.style.getPropertyPriority("color")).toBe("");
    expect(cell.style.getPropertyValue("color")).toBe("");
    expect(document.querySelectorAll("[data-emu-labmarker-ink]")).toHaveLength(0);
  });

  it("forces the readable text colour for a room the user added too", () => {
    document.body.innerHTML = `<div class="portal-course">CMSE423/CMPE025</div>`;

    highlightLabRoomText(document, LAB_ROOMS, CUSTOM_ROOMS);

    const course = document.querySelector<HTMLElement>(".portal-course")!;
    expect(course.style.getPropertyValue("color")).toBe("rgb(23, 54, 93)");
    expect(course.style.getPropertyPriority("color")).toBe("important");
  });
});
