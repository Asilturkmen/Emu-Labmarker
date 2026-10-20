import { ACTIVE_ICON_PATHS, TIMETABLE_ACTIVE_MESSAGE } from "../src/toolbarIcon";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message !== TIMETABLE_ACTIVE_MESSAGE) return;

    const tabId = sender.tab?.id;
    if (tabId === undefined) return;

    // Apply the icon to this tab. Navigation resets it to the manifest default.
    void browser.action.setIcon({ tabId, path: { ...ACTIVE_ICON_PATHS } });
  });
});
