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
  getLabMarkEnabled,
  getTemporaryLabRooms,
  LABMARK_ENABLED_KEY,
  parseTemporaryLabRooms,
  TEMPORARY_ROOMS_KEY,
} from "../src/settings";

// The portal re-renders the timetable in several steps. Waiting briefly
// collapses a burst of mutations into a single rescan.
const RESCAN_DELAY_MS = 100;

export default defineContentScript({
  matches: [
    "https://student.emu.edu.tr/Academic/TimeTable*",
    "https://student.emu.edu.tr/academic/timetable*",
  ],
  runAt: "document_idle",
  async main() {
    let rescan: ReturnType<typeof setTimeout> | null = null;
    let enabled = await getLabMarkEnabled();
    let temporaryRooms: ReadonlySet<string> = new Set(
      await getTemporaryLabRooms(),
    );

    const observer = new MutationObserver(() => scheduleRun());

    const run = () => {
      rescan = null;
      observer.disconnect();

      clearTimetableHighlights();
      if (enabled) {
        const rows = parseTimetable();
        const blocks = groupMeetingBlocks(rows);
        const meetings = resolveMeetings(blocks, undefined, temporaryRooms);
        highlightTimetable(meetings);
        // Some portal releases render course entries as plain text instead of
        // links, which the timetable parser cannot see.
        highlightLabRoomText(document, undefined, temporaryRooms);
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
      const roomsChange = changes[TEMPORARY_ROOMS_KEY];
      if (!enabledChange && !roomsChange) return;

      if (enabledChange) enabled = enabledChange.newValue !== false;
      if (roomsChange) {
        temporaryRooms = new Set(parseTemporaryLabRooms(roomsChange.newValue));
      }
      scheduleRun();
    });

    run();
  },
});
