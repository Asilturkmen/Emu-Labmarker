import { ACTIVE_ICON_PATHS, TIMETABLE_ACTIVE_MESSAGE } from "../src/toolbarIcon";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message !== TIMETABLE_ACTIVE_MESSAGE) return;

    const tabId = sender.tab?.id;
    if (tabId === undefined) return;

    // Only this tab is changed. A tab specific icon is dropped by the browser
    // as soon as the tab navigates, so leaving the portal restores the faded
    // default without anything here having to watch for it.
    void browser.action.setIcon({ tabId, path: { ...ACTIVE_ICON_PATHS } });
  });
});
