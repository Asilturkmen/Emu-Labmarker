import type { ResolvedMeeting, RoomClassification } from "../types/timetable";
import { isVerifiedLabRoom, NO_ROOMS, VERIFIED_LAB_ROOMS } from "../data/labRooms";
import { matchCourseRoom } from "../data/courseRoom";

const MARKER_ATTRIBUTE = "data-emu-labmark";
const BADGE_CLASS = "emu-labmark-badge";
const FALLBACK_ATTRIBUTE = "data-emu-labmark-text-match";
const INK_ATTRIBUTE = "data-emu-labmark-ink";

type LabClassification = Exclude<RoomClassification, "normal">;

/** Confirmed laboratories outrank rooms a user added for themselves. */
const CLASSIFICATION_RANK: Record<RoomClassification, number> = {
  normal: 0,
  custom: 1,
  verified: 2,
};

const LAB_CLASSIFICATIONS = ["verified", "custom"] as const;

const BADGES: Record<LabClassification, { text: string; label: string }> = {
  verified: { text: "LAB SINIFI", label: "LAB SINIFI" },
  custom: {
    text: "ÖZEL LAB",
    label: "ÖZEL LAB (senin eklediğin sınıf)",
  },
};

/**
 * The portal paints its course text white, and its own selectors outrank this
 * extension's stylesheet even with !important. On the pale cell background that
 * leaves white on pink, so the readable colour is written onto the elements
 * themselves: an inline !important declaration is the one thing an author
 * stylesheet cannot beat.
 */
const TEXT_COLORS: Record<LabClassification, string> = {
  verified: "#17365d",
  custom: "#17365d",
};

// The badge already names the kind, so the legend only adds what it means.
const LEGEND_TEXTS: Record<LabClassification, string> = {
  verified: " = Laboratuvar dersi",
  custom: " = Senin eklediğin sınıf",
};

function inkTargets(element: HTMLElement, selector: string): HTMLElement[] {
  return [element, ...element.querySelectorAll<HTMLElement>(selector)];
}

function paintInk(element: HTMLElement, classification: LabClassification): void {
  for (const node of inkTargets(element, "*")) {
    if (node.classList.contains(BADGE_CLASS)) continue;
    // Whatever inline colour the portal had is remembered, so that clearing a
    // mark gives the cell back exactly as it was found.
    if (!node.hasAttribute(INK_ATTRIBUTE)) {
      node.setAttribute(INK_ATTRIBUTE, node.style.getPropertyValue("color"));
    }
    node.style.setProperty("color", TEXT_COLORS[classification], "important");
  }
}

function stripInk(element: HTMLElement): void {
  for (const node of inkTargets(element, `[${INK_ATTRIBUTE}]`)) {
    const original = node.getAttribute(INK_ATTRIBUTE);
    if (original === null) continue;
    node.removeAttribute(INK_ATTRIBUTE);
    if (original) node.style.setProperty("color", original);
    else node.style.removeProperty("color");
  }
}

function clearMark(element: HTMLElement): void {
  stripInk(element);
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

function createLegendItem(classification: LabClassification): HTMLElement {
  const item = document.createElement("span");
  item.className = "emu-labmark-legend-item";

  const swatch = document.createElement("span");
  swatch.className = "emu-labmark-swatch";
  swatch.dataset.kind = classification;
  swatch.setAttribute("aria-hidden", "true");

  const badge = document.createElement("span");
  badge.className = "emu-labmark-legend-badge";
  badge.dataset.kind = classification;
  badge.textContent = BADGES[classification].text;

  item.append(
    swatch,
    badge,
    document.createTextNode(LEGEND_TEXTS[classification]),
  );
  return item;
}

function updateLegends(root: ParentNode = document): void {
  root.querySelectorAll(".emu-labmark-legend").forEach((legend) => legend.remove());
  for (const table of root.querySelectorAll(".schedule-panel, table")) {
    if (table.matches("table") && (table.closest(".schedule-panel") || table.querySelector(".schedule-panel"))) continue;
    // Only the kinds actually present are explained, so a timetable without a
    // user added room does not advertise one.
    const kinds = LAB_CLASSIFICATIONS.filter((classification) =>
      table.querySelector(`[${MARKER_ATTRIBUTE}="${classification}"]`),
    );
    if (!kinds.length) continue;

    const legend = document.createElement("div");
    legend.className = "emu-labmark-legend";
    legend.append(...kinds.map(createLegendItem));
    table.after(legend);
  }
}

function addMark(
  element: HTMLElement,
  classification: LabClassification,
): void {
  element.setAttribute(MARKER_ATTRIBUTE, classification);

  const badge = element.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`) ??
    document.createElement("small");
  badge.className = BADGE_CLASS;
  badge.textContent = BADGES[classification].text;
  badge.title = BADGES[classification].label;
  // A decorative span is not focusable, so role="img" is what lets assistive
  // technology read the full label rather than the badge text alone.
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", BADGES[classification].label);
  element.append(badge);
  paintInk(element, classification);
}

/** Keeps the strongest classification when one cell holds several courses. */
function keepStrongest(
  classifications: Map<HTMLElement, RoomClassification>,
  target: HTMLElement,
  classification: RoomClassification,
): void {
  const previous = classifications.get(target) ?? "normal";
  if (CLASSIFICATION_RANK[classification] > CLASSIFICATION_RANK[previous]) {
    classifications.set(target, classification);
  }
}

export function highlightTimetable(meetings: ResolvedMeeting[]): void {
  const classificationByTarget = new Map<HTMLElement, RoomClassification>();

  for (const { block, classification } of meetings) {
    for (const row of block.rows) {
      const target = getHighlightTarget(row.link);
      if (!target) continue;
      // Every target is recorded, so that a cell which no longer holds a
      // laboratory still has its stale mark cleared below.
      if (!classificationByTarget.has(target)) {
        classificationByTarget.set(target, "normal");
      }
      keepStrongest(classificationByTarget, target, classification);
    }
  }

  for (const [target, classification] of classificationByTarget) {
    clearMark(target);
    if (classification === "normal") continue;

    addMark(target, classification);
  }
  updateLegends();
}

function classifyRoom(
  room: string,
  verifiedRooms: ReadonlySet<string>,
  customRooms: ReadonlySet<string>,
): RoomClassification {
  if (isVerifiedLabRoom(room, verifiedRooms)) return "verified";
  if (isVerifiedLabRoom(room, customRooms)) return "custom";
  return "normal";
}

/**
 * Portal releases do not always render course entries as links. This fallback
 * finds visible COURSE/ROOM text directly, so laboratory rooms can still be
 * highlighted without relying on timetable-specific markup.
 */
export function highlightLabRoomText(
  root: ParentNode = document,
  verifiedRooms: ReadonlySet<string> = VERIFIED_LAB_ROOMS,
  customRooms: ReadonlySet<string> = NO_ROOMS,
): void {
  root
    .querySelectorAll<HTMLElement>(`[${FALLBACK_ATTRIBUTE}]`)
    .forEach((element) => {
      clearMark(element);
      element.removeAttribute(FALLBACK_ATTRIBUTE);
    });

  const classificationByTarget = new Map<HTMLElement, RoomClassification>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const room = matchCourseRoom(node.textContent ?? "")?.room;
    const parent = node.parentElement;
    if (!room || !parent) continue;
    const classification = classifyRoom(room, verifiedRooms, customRooms);
    if (classification === "normal") continue;
    if (parent.closest("script, style, textarea, input, [contenteditable], .emu-labmark-badge, .emu-labmark-legend")) continue;

    const target =
      parent.closest<HTMLElement>("a, button, [role='button']") ?? parent;
    const localTarget = getHighlightTarget(target);
    if (localTarget) {
      keepStrongest(classificationByTarget, localTarget, classification);
    }
  }

  for (const [target, classification] of classificationByTarget) {
    if (classification === "normal") continue;
    clearMark(target);
    target.setAttribute(FALLBACK_ATTRIBUTE, "");
    addMark(target, classification);
  }
  updateLegends(root);
}
