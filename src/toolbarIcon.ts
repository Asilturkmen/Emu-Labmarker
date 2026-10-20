/**
 * Set the toolbar icon explicitly because automatic fading varies by browser.
 * The manifest uses grey icons by default. The content script requests the
 * colour icon when it detects a timetable page.
 */
export const TIMETABLE_ACTIVE_MESSAGE = "emu-labmarker:timetable-active";

export const ACTIVE_ICON_PATHS: Readonly<Record<number, string>> = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};
