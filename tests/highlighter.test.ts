import { describe, expect, it } from "vitest";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import { highlightTimetable } from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import type {
  MeetingBlock,
  ResolvedMeeting,
  RoomClassification,
} from "../src/types/timetable";

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
  it.each([
    ["verified", "LAB SINIFI"],
    ["probable", "MUHTEMEL LAB SINIFI"],
  ] as const)("renders the %s label", (classification, label) => {
    const meeting = resolved(classification);

    highlightTimetable([meeting]);

    const link = meeting.block.rows[0]?.link;
    expect(link?.dataset.emuLabmark).toBe(classification);
    expect(link?.querySelector(".emu-labmark-badge")?.textContent).toBe(label);
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
    const meeting = resolved("probable");

    highlightTimetable([meeting]);
    highlightTimetable([meeting]);

    expect(meeting.block.rows[0]?.link.querySelectorAll(".emu-labmark-badge")).toHaveLength(
      1,
    );
  });

  it("highlights only the exceptional block in the full CMSE425 example", () => {
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
    highlightTimetable(resolveMeetings(blocks));

    expect(blocks).toHaveLength(3);
    expect(document.querySelectorAll('[data-emu-labmark="probable"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-emu-labmark="verified"]')).toHaveLength(0);
    expect(
      [...document.querySelectorAll('[data-emu-labmark="probable"]')].every((link) =>
        link.textContent?.includes("CMPE134"),
      ),
    ).toBe(true);
  });
});
