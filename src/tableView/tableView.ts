/**
 * Table view for narrow screens. Below 71.938em the portal hides its desktop
 * table and shows one list per day instead, so finding Friday means scrolling
 * through the whole week. The desktop table is still in the page, only hidden,
 * so the table view shows it again (tableView.css lays it out as a grid that
 * fits the screen). It is the portal's own markup, so the marks stay on it.
 *
 * To fit a phone, the view leaves out what carries no information: day columns
 * without any course (usually Saturday and Sunday) and the empty hours before
 * the first and after the last course of the week.
 */

/** Set on <html> while the table view is on; tableView.css applies under it. */
export const TABLE_VIEW_ATTRIBUTE = "data-emu-labmarker-table";

/** Set on the heading cells, rows and cells that the table view leaves out. */
export const TABLE_HIDE_ATTRIBUTE = "data-emu-labmarker-hide";

/** Number of day columns shown, read by the grid in tableView.css. */
export const TABLE_DAYS_PROPERTY = "--emu-lm-table-days";

// A cell with one of these spans several days (width 36%…90% in the portal CSS).
const SPANNING_CELL = /\bday-\d\b/;

function cellsOf(row: Element): HTMLElement[] {
  return Array.from(row.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "LI",
  );
}

/** Marks the line breaks this view adds, so it can take exactly those away again. */
const BREAK_ATTRIBUTE = "data-emu-labmarker-break";

/**
 * Lets course codes break after the slash ("CMSE443/" + "CMPE230"): Safari does
 * not break there on its own, so codes overflow narrow columns. The <wbr> splits
 * the text node in two, and the highlighter's plain-text pass reads one text
 * node at a time, so clearTableView removes the breaks and joins the text again
 * before every scan.
 */
function allowBreakAfterSlash(cell: HTMLElement): void {
  const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  for (let text of texts) {
    let slash = text.data.indexOf("/");
    while (slash >= 0 && slash < text.data.length - 1) {
      const rest = text.splitText(slash + 1);
      text.after(createBreak(cell.ownerDocument));
      text = rest;
      slash = text.data.indexOf("/");
    }
    if (slash === text.data.length - 1 && text.nextSibling?.nodeName !== "WBR") {
      text.after(createBreak(cell.ownerDocument));
    }
  }
}

function createBreak(doc: Document): HTMLElement {
  const wbr = doc.createElement("wbr");
  wbr.setAttribute(BREAK_ATTRIBUTE, "");
  return wbr;
}

function hasCourse(cell: HTMLElement): boolean {
  return cell.matches(".ctime, .ctime2") || (cell.textContent ?? "").trim() !== "";
}

/**
 * Removes everything the table view added, including the line breaks, and joins
 * the split text again. Call it before the highlighter scans the page.
 */
export function clearTableView(root: Document = document): void {
  const parents = new Set<Node>();
  root.querySelectorAll(`wbr[${BREAK_ATTRIBUTE}]`).forEach((wbr) => {
    if (wbr.parentNode) parents.add(wbr.parentNode);
    wbr.remove();
  });
  parents.forEach((parent) => parent.normalize());
  root.documentElement.removeAttribute(TABLE_VIEW_ATTRIBUTE);
  root.documentElement.style.removeProperty(TABLE_DAYS_PROPERTY);
  root
    .querySelectorAll(`[${TABLE_HIDE_ATTRIBUTE}]`)
    .forEach((element) => element.removeAttribute(TABLE_HIDE_ATTRIBUTE));
}

/**
 * Turns the table view on or off for the timetable in `root`. Safe to call on
 * every rescan: it starts from a clean page each time.
 */
export function applyTableView(on: boolean, root: Document = document): void {
  clearTableView(root);
  if (!on) return;

  const rows = Array.from(root.querySelectorAll(".schedule-table-content > ul"));
  const headingRow = root.querySelector(".schedule-table-heading > ul");
  if (rows.length === 0 || !headingRow) return;

  const heading = cellsOf(headingRow);
  const dayCount = heading.length - 1;
  if (dayCount < 1) return;

  const grid = rows.map(cellsOf);
  const courseRows = grid
    .map((cells, index) => (cells.slice(1).some(hasCourse) ? index : -1))
    .filter((index) => index >= 0);

  // Days that have at least one course. A cell spanning several days breaks the
  // one-cell-per-day layout, so then every day stays.
  const spanning = grid.some((cells) => cells.some((cell) => SPANNING_CELL.test(cell.className)));
  const usedDays = new Set<number>();
  for (let day = 1; day <= dayCount; day += 1) {
    if (spanning || grid.some((cells) => {
      const cell = cells[day];
      return cell !== undefined && hasCourse(cell);
    })) usedDays.add(day);
  }
  // A week without courses shows every day, like the portal.
  if (usedDays.size === 0) for (let day = 1; day <= dayCount; day += 1) usedDays.add(day);

  for (let day = 1; day <= dayCount; day += 1) {
    if (usedDays.has(day)) continue;
    heading[day]?.setAttribute(TABLE_HIDE_ATTRIBUTE, "");
    for (const cells of grid) cells[day]?.setAttribute(TABLE_HIDE_ATTRIBUTE, "");
  }

  const first = courseRows[0];
  const last = courseRows[courseRows.length - 1];
  if (first !== undefined && last !== undefined) {
    rows.forEach((row, index) => {
      if (index < first || index > last) row.setAttribute(TABLE_HIDE_ATTRIBUTE, "");
    });
  }

  for (const cells of grid) cells.slice(1).filter(hasCourse).forEach(allowBreakAfterSlash);

  root.documentElement.style.setProperty(TABLE_DAYS_PROPERTY, String(usedDays.size));
  root.documentElement.setAttribute(TABLE_VIEW_ATTRIBUTE, "");
}
