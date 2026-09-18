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
  CUSTOM_ROOMS_KEY,
  getCustomLabRooms,
  getLabMarkEnabled,
  LABMARK_ENABLED_KEY,
  parseCustomLabRooms,
} from "../src/settings";

// The portal re-renders the timetable in several steps. Waiting briefly
// collapses a burst of mutations into a single rescan.
const RESCAN_DELAY_MS = 100;

// A match pattern compares the path case sensitively, so every spelling the
// portal uses would need its own entry. Matching the site and checking the
// path here covers them all, including spellings a future release invents.
const TIMETABLE_PATH = /^\/academic\/timetable/i;

export default defineContentScript({
  matches: ["https://student.emu.edu.tr/*"],
  runAt: "document_idle",
  async main() {
    if (!TIMETABLE_PATH.test(location.pathname)) return;

    let rescan: ReturnType<typeof setTimeout> | null = null;
    let enabled = await getLabMarkEnabled();
    let customRooms: ReadonlySet<string> = new Set(await getCustomLabRooms());

    const observer = new MutationObserver(() => scheduleRun());

    const run = () => {
      rescan = null;
      observer.disconnect();

      clearTimetableHighlights();
      if (enabled) {
        const rows = parseTimetable();
        const blocks = groupMeetingBlocks(rows);
        const meetings = resolveMeetings(blocks, undefined, customRooms);
        highlightTimetable(meetings);
        // Some portal releases render course entries as plain text instead of
        // links, which the timetable parser cannot see.
        highlightLabRoomText(document, undefined, customRooms);
      }

      observer.observe(document.body, { childList: true, subtree: true });
    };

    function scheduleRun(): void {
      if (rescan !== null) return;
      rescan = setTimeout(run, RESCAN_DELAY_MS);
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      const enabledChange = changes[LABMARK_ENABLED_KEY];
      const roomsChange = changes[CUSTOM_ROOMS_KEY];
      if (!enabledChange && !roomsChange) return;

      if (enabledChange) enabled = enabledChange.newValue !== false;
      if (roomsChange) {
        customRooms = new Set(parseCustomLabRooms(roomsChange.newValue));
      }
      scheduleRun();
    });

    run();
  },
});
