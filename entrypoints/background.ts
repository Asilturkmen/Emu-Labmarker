import { OPEN_POPUP_MESSAGE } from "../src/popupButton/popupButton";
import { updateAccessBadge } from "../src/portalAccess";
import { ACTIVE_ICON_PATHS, TIMETABLE_ACTIVE_MESSAGE } from "../src/toolbarIcon";

export default defineBackground(() => {
  // The button on the timetable page asks for the extension's window. Answers
  // true when it opened, false when this browser cannot open it for a page
  // (the button then points to the browser's menu).
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message !== OPEN_POPUP_MESSAGE) return;
    const action = browser.action as { openPopup?: () => Promise<void> } | undefined;
    if (typeof action?.openPopup !== "function") {
      sendResponse(false);
      return;
    }
    action.openPopup().then(
      () => sendResponse(true),
      () => sendResponse(false),
    );
    // Keep the channel open for the asynchronous answer.
    return true;
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message !== TIMETABLE_ACTIVE_MESSAGE) return;

    const tabId = sender.tab?.id;
    if (tabId === undefined) return;

    // Apply the icon to this tab. Navigation resets it to the manifest default.
    void browser.action.setIcon({ tabId, path: { ...ACTIVE_ICON_PATHS } });
  });

  // Safari: mark the button with "!" until the portal is allowed, and clear it
  // as soon as the user allows it (from the popup or from Safari's settings).
  void updateAccessBadge();
  browser.runtime.onInstalled?.addListener(() => void updateAccessBadge());
  browser.runtime.onStartup?.addListener(() => void updateAccessBadge());
  browser.permissions?.onAdded?.addListener(() => void updateAccessBadge());
  browser.permissions?.onRemoved?.addListener(() => void updateAccessBadge());
});
