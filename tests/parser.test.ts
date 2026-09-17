import { describe, expect, it } from "vitest";

import { parseTimetable } from "../src/parser/parseTimetable";

describe("parseTimetable", () => {
  it("parses every course link in desktop timetable cells", () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th>Time</th><th>Monday</th></tr></thead>
        <tbody>
          <tr>
            <td>16:30-17:20</td>
            <td class="schedule-table-content">
              <a href="#">CMSE425/CMPE137</a>
              <a href="#">CMSE427/CMPE128</a>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    const rows = parseTimetable();

    expect(rows).toHaveLength(2);
    expect(rows.map(({ courseCode, room }) => [courseCode, room])).toEqual([
      ["CMSE425", "CMPE137"],
      ["CMSE427", "CMPE128"],
    ]);
    expect(rows[0]).toMatchObject({
      day: "monday",
      startMinutes: 16 * 60 + 30,
      endMinutes: 17 * 60 + 20,
      layout: "desktop",
    });
  });

  it("parses mobile cells from explicit day and time metadata", () => {
    document.body.innerHTML = `
      <section class="schedule-day" data-day="Salı">
        <div
          class="schedule-table-content-mobile"
          data-start-time="14:30"
          data-end-time="15:20"
        >
          <a data-course-code="cmse425" data-room="cmpe 127">Course</a>
        </div>
      </section>
    `;

    expect(parseTimetable()[0]).toMatchObject({
      courseCode: "CMSE425",
      room: "CMPE127",
      day: "tuesday",
      startMinutes: 14 * 60 + 30,
      endMinutes: 15 * 60 + 20,
      layout: "mobile",
    });
  });

  it("recognizes English day names containing i", () => {
    document.body.innerHTML = `
      <div
        class="schedule-table-content-mobile"
        data-day="Friday"
        data-start="09:30"
        data-end="10:20"
      >
        <a>CMSE425/CMPE127</a>
      </div>
    `;

    expect(parseTimetable()[0]?.day).toBe("friday");
  });

  it("supports a timetable content class directly on the course link", () => {
    document.body.innerHTML = `
      <a
        class="schedule-table-content-mobile"
        data-day="Wednesday"
        data-start="11:30"
        data-end="12:20"
      >CMSE425/CMPE127</a>
    `;

    expect(parseTimetable()).toHaveLength(1);
  });

  it("parses portal links even when timetable CSS classes are absent", () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>12:30-13:20</td>
            <td><a class="portal-course">CMSE423/CMPE230</a></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseTimetable()[0]).toMatchObject({
      courseCode: "CMSE423",
      room: "CMPE230",
      day: "monday",
      startMinutes: 12 * 60 + 30,
      endMinutes: 13 * 60 + 20,
    });
  });

  it("ignores unrelated links and incomplete timetable rows", () => {
    document.body.innerHTML = `
      <div class="schedule-table-content" data-day="Monday">
        <a>Course details</a>
        <a>CMSE425/CMPE127</a>
      </div>
    `;

    expect(parseTimetable()).toEqual([]);
  });
});
