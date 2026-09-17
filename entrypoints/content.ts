import "../src/highlighter/highlight.css";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import {
  clearTimetableHighlights,
  highlightTimetable,
  highlightVerifiedRoomText,
} from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import { getLabMarkEnabled, LABMARK_ENABLED_KEY } from "../src/settings";

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

    const observer = new MutationObserver(() => scheduleRun());

    const run = () => {
      rescan = null;
      observer.disconnect();

      clearTimetableHighlights();
      if (enabled) {
        const rows = parseTimetable();
        const blocks = groupMeetingBlocks(rows);
        const meetings = resolveMeetings(blocks);
        highlightTimetable(meetings);
        // Some portal releases render course entries as plain text instead of
        // links, which the timetable parser cannot see.
        highlightVerifiedRoomText();
      }

      observer.observe(document.body, { childList: true, subtree: true });
    };

    function scheduleRun(): void {
      if (rescan !== null) return;
      rescan = setTimeout(run, RESCAN_DELAY_MS);
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
      const change = changes[LABMARK_ENABLED_KEY];
      if (areaName !== "local" || !change) return;
      enabled = change.newValue !== false;
      scheduleRun();
    });

    run();
  },
});
