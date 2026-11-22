import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { portalTimetable } from "./fixtures/portalTimetable";
import {
  applyTableView,
  clearTableView,
  TABLE_DAYS_PROPERTY,
  TABLE_HIDE_ATTRIBUTE,
  TABLE_VIEW_ATTRIBUTE,
} from "../src/tableView/tableView";

const html = document.documentElement;

function heading(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".schedule-table-heading > ul > li")];
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".schedule-table-content > ul")];
}

function hidden(element: Element | undefined): boolean {
  return element?.hasAttribute(TABLE_HIDE_ATTRIBUTE) ?? false;
}

beforeEach(() => {
  document.body.innerHTML = portalTimetable();
});

afterEach(() => {
  clearTableView();
  document.body.innerHTML = "";
});

describe("table view", () => {
  it("marks the page and keeps only the days that have courses", () => {
    applyTableView(true);

    expect(html.hasAttribute(TABLE_VIEW_ATTRIBUTE)).toBe(true);
    // The fixture has courses Monday to Friday; Saturday and Sunday are empty.
    expect(html.style.getPropertyValue(TABLE_DAYS_PROPERTY)).toBe("5");
    expect(heading().map((cell) => hidden(cell))).toEqual([
      false, false, false, false, false, false, true, true,
    ]);
    for (const row of rows()) {
      const cells = [...row.children];
      expect(hidden(cells[6])).toBe(true);
      expect(hidden(cells[7])).toBe(true);
      expect(cells.slice(0, 6).some((cell) => hidden(cell))).toBe(false);
    }
  });

  it("leaves out the empty hours after the last course", () => {
    applyTableView(true);

    const labels = rows().map((row) => row.firstElementChild?.textContent);
    const shown = rows().filter((row) => !hidden(row));
    // 08:30 is the first course and 17:30 the last; 18:30 to 22:30 are empty.
    expect(shown[0]?.firstElementChild?.textContent).toBe("08:30-09:20");
    expect(shown.at(-1)?.firstElementChild?.textContent).toBe("17:30-18:20");
    expect(shown).toHaveLength(labels.indexOf("17:30-18:20") + 1);
  });

  it("keeps empty hours between courses", () => {
    // Remove every course at 10:30 and 11:30 (Wednesday and Thursday).
    for (const row of rows().slice(2, 4)) {
      for (const cell of [...row.children].slice(1)) {
        cell.className = "empty";
        cell.textContent = "";
      }
    }

    applyTableView(true);

    expect(hidden(rows()[2])).toBe(false);
    expect(hidden(rows()[3])).toBe(false);
  });

  it("lets course codes break after the slash without changing their text", () => {
    const cell = rows()[0]!.children[4] as HTMLElement;
    const text = cell.textContent;

    applyTableView(true);
    applyTableView(true);

    expect(cell.textContent).toBe(text);
    // One <wbr> after the single slash of "CMSE443/CMPE026", even after two runs.
    expect(cell.querySelectorAll("wbr")).toHaveLength(1);
    expect(cell.querySelector("wbr")?.previousSibling?.textContent).toBe("CMSE443/");
  });

  it("keeps every day when a cell spans several days", () => {
    rows()[0]!.children[1]!.className = "day-2";

    applyTableView(true);

    expect(html.style.getPropertyValue(TABLE_DAYS_PROPERTY)).toBe("7");
    expect(heading().some((cell) => hidden(cell))).toBe(false);
  });

  it("shows the whole week when there are no courses", () => {
    for (const cell of document.querySelectorAll(".schedule-table-content li:not(:first-child)")) {
      cell.className = "empty";
      cell.textContent = "";
    }

    applyTableView(true);

    expect(html.style.getPropertyValue(TABLE_DAYS_PROPERTY)).toBe("7");
    expect(document.querySelectorAll(`[${TABLE_HIDE_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("removes everything it added when turned off", () => {
    const before = document.body.innerHTML;
    applyTableView(true);
    expect(document.querySelectorAll("wbr").length).toBeGreaterThan(0);
    applyTableView(false);

    expect(document.querySelectorAll("wbr")).toHaveLength(0);
    // The split text is joined again, so the page is exactly as it was.
    expect(document.body.innerHTML).toBe(before);

    expect(html.hasAttribute(TABLE_VIEW_ATTRIBUTE)).toBe(false);
    expect(html.style.getPropertyValue(TABLE_DAYS_PROPERTY)).toBe("");
    expect(document.querySelectorAll(`[${TABLE_HIDE_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("does nothing on a page without the timetable", () => {
    document.body.innerHTML = "<main><ul><li>Başka sayfa</li></ul></main>";

    applyTableView(true);

    expect(html.hasAttribute(TABLE_VIEW_ATTRIBUTE)).toBe(false);
  });

  it("leaves the mobile list alone", () => {
    const mobile = document.querySelector(".schedule-table-content-mobile")!.innerHTML;

    applyTableView(true);

    expect(document.querySelector(".schedule-table-content-mobile")!.innerHTML).toBe(mobile);
  });
});
