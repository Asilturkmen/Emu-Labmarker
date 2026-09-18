/**
 * The toolbar icon says whether the extension applies to the page in front of
 * you. Browsers disagree about fading an icon by themselves — some never do —
 * so the state is set explicitly instead of left to the browser.
 *
 * The manifest ships the faded set as the default, and the content script only
 * runs on a timetable page, so a tab earns the active icon by reporting in.
 */
export const TIMETABLE_ACTIVE_MESSAGE = "emu-labmarker:timetable-active";

export const ACTIVE_ICON_PATHS: Readonly<Record<number, string>> = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};
