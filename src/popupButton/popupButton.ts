/**
 * A button next to the timetable's page title that opens the extension's own
 * window. On a phone the extension sits deep in Safari's page menu, and many
 * students never find it. The button shows on narrow screens only
 * (popupButton.css); wide screens have the browser's own toolbar button.
 */

/** Asked by the button; background.ts answers by opening the popup. */
export const OPEN_POPUP_MESSAGE = "emu-labmarker:open-popup";

export const POPUP_BUTTON_CLASS = "emu-labmarker-open";

/** Set on the title so popupButton.css can line the button up beside the text. */
export const TITLE_ROW_ATTRIBUTE = "data-emu-labmarker-title";

const LABEL = "EMU LabMarker'ı aç";
const FALLBACK_HINT = "Safari'nin sayfa menüsünden EMU LabMarker'ı aç.";
const HINT_MS = 4000;

// The extension icon (assets/icon.svg), inline so the page needs no extension file.
const ICON = `<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false"><rect x="12" y="20" width="92" height="92" rx="17" fill="#fff" stroke="#1269e8" stroke-width="9"/><path d="M16 48h84" fill="none" stroke="#1269e8" stroke-width="9"/><path d="M35 12v20M81 12v20" fill="none" stroke="#1269e8" stroke-width="11" stroke-linecap="round"/><g fill="#dbe3ee"><rect x="28" y="61" width="18" height="18" rx="4"/><rect x="54" y="61" width="18" height="18" rx="4"/><rect x="28" y="86" width="18" height="18" rx="4"/><rect x="54" y="86" width="18" height="18" rx="4"/></g><rect x="80" y="61" width="18" height="18" rx="4" fill="#f12e4b"/><path d="M68 88l28-14 28 14-28 14z" fill="#1269e8" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M79 96v12c7 8 27 8 34 0V96" fill="#1269e8" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M121 90v19" fill="none" stroke="#1269e8" stroke-width="4" stroke-linecap="round"/><circle cx="121" cy="113" r="4" fill="#1269e8"/></svg>`;

/**
 * The page title is the last heading before the timetable ("Zaman Çizelgesi",
 * or "Timetable" in English). Headings inside the timetable do not count.
 */
export function findTitle(root: Document = document): HTMLElement | null {
  const timetable = root.querySelector(".schedule-content");
  if (!timetable) return null;
  let title: HTMLElement | null = null;
  for (const heading of root.querySelectorAll<HTMLElement>("h1, h2, h3, h4")) {
    if (timetable.contains(heading)) continue;
    // DOCUMENT_POSITION_FOLLOWING: the timetable comes after this heading.
    if (!(heading.compareDocumentPosition(timetable) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if ((heading.textContent ?? "").trim() === "") continue;
    title = heading;
  }
  return title;
}

function showHint(button: HTMLButtonElement): void {
  const hint = button.ownerDocument.createElement("span");
  hint.className = `${POPUP_BUTTON_CLASS}-hint`;
  hint.setAttribute("role", "status");
  hint.textContent = FALLBACK_HINT;
  button.after(hint);
  setTimeout(() => hint.remove(), HINT_MS);
}

function createButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = POPUP_BUTTON_CLASS;
  button.title = LABEL;
  button.setAttribute("aria-label", LABEL);
  button.innerHTML = ICON;
  button.addEventListener("click", () => {
    // Older browsers cannot open the popup for the page; point to the menu instead.
    void browser.runtime
      .sendMessage(OPEN_POPUP_MESSAGE)
      .then((opened: unknown) => {
        if (opened !== true) showHint(button);
      })
      .catch(() => showHint(button));
  });
  return button;
}

/**
 * Puts the button next to the page title. Safe to call on every rescan: an
 * existing button stays, and a page without a title gets none.
 */
export function ensurePopupButton(root: Document = document): void {
  const title = findTitle(root);
  if (!title) return;
  if (title.querySelector(`.${POPUP_BUTTON_CLASS}`)) return;
  root.querySelectorAll(`.${POPUP_BUTTON_CLASS}`).forEach((stale) => stale.remove());
  title.setAttribute(TITLE_ROW_ATTRIBUTE, "");
  title.append(createButton(root));
}
