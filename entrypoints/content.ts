import "../src/highlighter/highlight.css";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import {
  clearTimetableHighlights,
  highlightTimetable,
} from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";
import { getLabMarkEnabled, LABMARK_ENABLED_KEY } from "../src/settings";

export default defineContentScript({
  matches: ["https://student.emu.edu.tr/Academic/TimeTable*"],
  runAt: "document_idle",
  async main() {
    let scheduled = false;
    let enabled = await getLabMarkEnabled();

    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    });

    const run = () => {
      scheduled = false;
      observer.disconnect();

      clearTimetableHighlights();
      if (enabled) {
        const rows = parseTimetable();
        const blocks = groupMeetingBlocks(rows);
        const meetings = resolveMeetings(blocks);
        highlightTimetable(meetings);
      }

      observer.observe(document.body, { childList: true, subtree: true });
    };

    browser.storage.onChanged.addListener((changes, areaName) => {
      const change = changes[LABMARK_ENABLED_KEY];
      if (areaName !== "local" || !change) return;
      enabled = change.newValue !== false;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    });

    run();
  },
});
