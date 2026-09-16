import "../src/highlighter/highlight.css";

import { groupMeetingBlocks } from "../src/grouping/groupMeetingBlocks";
import { highlightTimetable } from "../src/highlighter/highlightTimetable";
import { parseTimetable } from "../src/parser/parseTimetable";
import { resolveMeetings } from "../src/resolver/resolveMeetings";

export default defineContentScript({
  matches: ["https://student.emu.edu.tr/Academic/TimeTable*"],
  runAt: "document_idle",
  main() {
    let scheduled = false;

    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    });

    const run = () => {
      scheduled = false;
      observer.disconnect();

      const rows = parseTimetable();
      const blocks = groupMeetingBlocks(rows);
      const meetings = resolveMeetings(blocks);
      highlightTimetable(meetings);

      observer.observe(document.body, { childList: true, subtree: true });
    };

    run();
  },
});
