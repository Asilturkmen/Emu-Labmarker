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
  element.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function addMark(
  element: HTMLElement,
  classification: Exclude<RoomClassification, "normal">,
): void {
  element.setAttribute(MARKER_ATTRIBUTE, classification);

  if (element.querySelector(`.${BADGE_CLASS}`)) return;

  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.textContent = LABELS[classification];
  element.append(badge);
}

export function highlightTimetable(meetings: ResolvedMeeting[]): void {
  const classificationByLink = new Map<HTMLElement, RoomClassification>();

  for (const { block, classification } of meetings) {
    for (const row of block.rows) {
      classificationByLink.set(row.link, classification);
    }
  }

  for (const [link, classification] of classificationByLink) {
    clearMark(link);
    if (classification === "normal") continue;

    addMark(link, classification);
  }
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

    const target =
      parent.closest<HTMLElement>("a, button, [role='button']") ?? parent;
    targets.add(target);
  }

  for (const target of targets) {
    clearMark(target);
    target.setAttribute(FALLBACK_ATTRIBUTE, "");
    addMark(target, "verified");
  }
}
