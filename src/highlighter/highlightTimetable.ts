import type { ResolvedMeeting, RoomClassification } from "../types/timetable";

const MARKER_ATTRIBUTE = "data-emu-labmark";
const BADGE_CLASS = "emu-labmark-badge";

const LABELS: Record<Exclude<RoomClassification, "normal">, string> = {
  verified: "LAB SINIFI",
  probable: "MUHTEMEL LAB SINIFI",
};

function clearMark(link: HTMLAnchorElement): void {
  link.removeAttribute(MARKER_ATTRIBUTE);
  link.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

export function highlightTimetable(meetings: ResolvedMeeting[]): void {
  const classificationByLink = new Map<
    HTMLAnchorElement,
    RoomClassification
  >();

  for (const { block, classification } of meetings) {
    for (const row of block.rows) {
      classificationByLink.set(row.link, classification);
    }
  }

  for (const [link, classification] of classificationByLink) {
    clearMark(link);
    if (classification === "normal") continue;

    link.setAttribute(MARKER_ATTRIBUTE, classification);
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = LABELS[classification];
    link.append(badge);
  }
}
