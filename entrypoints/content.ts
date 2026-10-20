import "../src/highlighter/highlight.css";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import {
  clearTimetableHighlights,
  highlightLabRoomText,
  highlightTimetable,
} from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import {
  parseCustomLabRules,
  roomWideRooms,
  type CustomLabRule,
} from "../src/data/customRules";
import {
  CUSTOM_ROOMS_KEY,
  getCustomLabRules,
  getLabMarkerEnabled,
  LABMARKER_ENABLED_KEY,
} from "../src/settings";
import { collectSessions, LIST_SESSIONS_MESSAGE } from "../src/timetableSessions";
import { TIMETABLE_ACTIVE_MESSAGE } from "../src/toolbarIcon";

// The portal re-renders the timetable in several steps. Waiting briefly
// collapses a burst of mutations into a single rescan.
const RESCAN_DELAY_MS = 100;

// Match both portal hosts, then check the timetable path without case sensitivity.
const TIMETABLE_PATH = /^\/academic\/timetable/i;

// The portal answers on both hosts, and students reach it through either one.
export default defineContentScript({
  matches: ["https://student.emu.edu.tr/*", "https://students.emu.edu.tr/*"],
  runAt: "document_idle",
  async main() {
    if (!TIMETABLE_PATH.test(location.pathname)) return;

    // Request the active icon without delaying highlighting if the worker is unavailable.
    void browser.runtime.sendMessage(TIMETABLE_ACTIVE_MESSAGE).catch(() => {});

    // Read the current timetable for each popup request, even when highlighting is off.
    // Use sendResponse for compatibility with browsers that do not support
    // Promise-returning message listeners.
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message !== LIST_SESSIONS_MESSAGE) return;
      try {
        sendResponse(collectSessions(groupMeetingBlocks(parseTimetable())));
      } catch {
        sendResponse([]);
      }
    });

    let rescan: ReturnType<typeof setTimeout> | null = null;
    let enabled = await getLabMarkerEnabled();
    let customRules: ReadonlyArray<CustomLabRule> = await getCustomLabRules();

    const observer = new MutationObserver(() => scheduleRun());

    const run = () => {
      rescan = null;
      observer.disconnect();

      // Reconnect the observer even if parsing fails, so later updates are still detected.
      try {
        clearTimetableHighlights();
        if (enabled) {
          const rows = parseTimetable();
          const blocks = groupMeetingBlocks(rows);
          const meetings = resolveMeetings(blocks, undefined, customRules);
          highlightTimetable(meetings);
          // Handle plain-text entries that the link parser misses.
          // This pass has no day/time context, so it accepts only room-wide rules.
          highlightLabRoomText(
            document,
            undefined,
            roomWideRooms(customRules, "lab"),
            roomWideRooms(customRules, "tutorial"),
          );
        }
      } finally {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    function scheduleRun(): void {
      if (rescan !== null) return;
      rescan = setTimeout(run, RESCAN_DELAY_MS);
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      const enabledChange = changes[LABMARKER_ENABLED_KEY];
      const roomsChange = changes[CUSTOM_ROOMS_KEY];
      if (!enabledChange && !roomsChange) return;

      if (enabledChange) enabled = enabledChange.newValue !== false;
      if (roomsChange) {
        customRules = parseCustomLabRules(roomsChange.newValue);
      }
      scheduleRun();
    });

    run();
  },
});
