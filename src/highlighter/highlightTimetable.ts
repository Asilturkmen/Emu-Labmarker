import type { ResolvedMeeting, RoomClassification } from "../types/timetable";
import { isVerifiedLabRoom } from "../data/labRooms";

const MARKER_ATTRIBUTE = "data-emu-labmark";
const BADGE_CLASS = "emu-labmark-badge";
const FALLBACK_ATTRIBUTE = "data-emu-labmark-text-match";
const COURSE_ROOM_TEXT_PATTERN =
  /\b[A-Z]{2,}\s*-?\s*\d{3,4}[A-Z]?\s*\/\s*([A-Z]{2,}(?:\s*-?\s*[A-Z0-9]+)+)\b/i;

const LABELS: Record<Exclude<RoomClassification, "normal">, string> = {
  verified: "LAB SINIFI",
  probable: "MUHTEMEL LAB SINIFI",
};

function clearMark(element: HTMLElement): void {
  element.removeAttribute(MARKER_ATTRIBUTE);
  element.removeAttribute(FALLBACK_ATTRIBUTE);
  element.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function isLocalCourseBox(candidate: HTMLElement, source: HTMLElement): boolean {
  if (candidate.matches("html, body, table, thead, tbody, tfoot, tr, [role='grid'], [role='row']")) return false;
  if (candidate.querySelector("table, thead, tbody, tr, td, th, [role='grid'], [role='row']")) return false;
  // A layout cell may contain the entire div-based timetable. A course box
  // must not encompass separate block containers or nested schedule cells.
  for (const child of candidate.querySelectorAll(
    "div, section, article, ul, ol, .schedule-table-content, .schedule-table-content-mobile",
  )) {
    if (!child.contains(source)) return false;
  }
  return true;
}

function getHighlightTarget(element: HTMLElement): HTMLElement | null {
  const portalCell = element.closest<HTMLElement>(
    ".schedule-table-content > ul > li.ctime, .schedule-table-content-mobile > ul > li.ctime",
  );
  if (portalCell) return portalCell;
  const cell = element.closest<HTMLElement>(
    ".schedule-table-content-mobile, .schedule-table-content, td",
  );
  if (cell && isLocalCourseBox(cell, element)) return cell;
  return isLocalCourseBox(element, element) ? element : null;
}

export function clearTimetableHighlights(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(`[${MARKER_ATTRIBUTE}]`).forEach(clearMark);
  root.querySelectorAll(".emu-labmark-legend").forEach((legend) => legend.remove());
}

function updateLegends(root: ParentNode = document): void {
  root.querySelectorAll(".emu-labmark-legend").forEach((legend) => legend.remove());
  for (const table of root.querySelectorAll(".schedule-panel, table")) {
    if (table.matches("table") && (table.closest(".schedule-panel") || table.querySelector(".schedule-panel"))) continue;
    if (!table.querySelector(`[${MARKER_ATTRIBUTE}]`)) continue;
    const legend = document.createElement("div");
    legend.className = "emu-labmark-legend";

    const addLegendItem = (
      classification: Exclude<RoomClassification, "normal">,
      label: string,
    ) => {
      if (!table.querySelector(`[${MARKER_ATTRIBUTE}="${classification}"]`)) return;
      const item = document.createElement("span");
      item.className = "emu-labmark-legend-item";
      const swatch = document.createElement("span");
      swatch.className = `emu-labmark-swatch emu-labmark-swatch--${classification}`;
      swatch.setAttribute("aria-hidden", "true");
      const badge = document.createElement("span");
      badge.className = `emu-labmark-legend-badge emu-labmark-legend-badge--${classification}`;
      badge.textContent = classification === "probable" ? "LAB?" : "LAB";
      item.append(swatch, badge, document.createTextNode(` = ${label}`));
      legend.append(item);
    };

    addLegendItem("verified", "Laboratuvar dersi");
    addLegendItem("probable", "Muhtemel laboratuvar dersi");
    table.after(legend);
  }
}

function addMark(
  element: HTMLElement,
  classification: Exclude<RoomClassification, "normal">,
): void {
  element.setAttribute(MARKER_ATTRIBUTE, classification);

  const badge = element.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`) ??
    document.createElement("small");
  badge.className = BADGE_CLASS;
  badge.textContent = classification === "probable" ? "LAB?" : "LAB";
  badge.title = LABELS[classification];
  badge.setAttribute("aria-label", LABELS[classification]);
  badge.tabIndex = 0;
  element.append(badge);
}

export function highlightTimetable(meetings: ResolvedMeeting[]): void {
  const classificationByLink = new Map<HTMLElement, RoomClassification>();

  for (const { block, classification } of meetings) {
    for (const row of block.rows) {
      const target = getHighlightTarget(row.link);
      if (!target) continue;
      const previous = classificationByLink.get(target);
      if (previous === "verified" || (previous === "probable" && classification === "normal")) continue;
      classificationByLink.set(target, classification);
    }
  }

  for (const [link, classification] of classificationByLink) {
    clearMark(link);
    if (classification === "normal") continue;

    addMark(link, classification);
  }
  updateLegends();
}

/**
 * Portal releases do not always render course entries as links. This fallback
 * finds visible COURSE/ROOM text directly, so manually verified rooms can
 * still be highlighted without relying on timetable-specific markup.
 */
export function highlightVerifiedRoomText(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLElement>(`[${FALLBACK_ATTRIBUTE}]`)
    .forEach((element) => {
      clearMark(element);
      element.removeAttribute(FALLBACK_ATTRIBUTE);
    });

  const targets = new Set<HTMLElement>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const match = node.textContent?.toUpperCase().match(COURSE_ROOM_TEXT_PATTERN);
    const room = match?.[1];
    const parent = node.parentElement;
    if (!room || !parent || !isVerifiedLabRoom(room)) continue;
    if (parent.closest("script, style, textarea, input, [contenteditable], .emu-labmark-badge, .emu-labmark-legend")) continue;

    const target =
      parent.closest<HTMLElement>("a, button, [role='button']") ?? parent;
    const localTarget = getHighlightTarget(target);
    if (localTarget) targets.add(localTarget);
  }

  for (const target of targets) {
    clearMark(target);
    target.setAttribute(FALLBACK_ATTRIBUTE, "");
    addMark(target, "verified");
  }
  updateLegends(root);
}
