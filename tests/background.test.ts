import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_ICON_PATHS,
  TIMETABLE_ACTIVE_MESSAGE,
} from "../src/toolbarIcon";
import { MISSING_ACCESS_BADGE } from "../src/portalAccess";
import { OPEN_POPUP_MESSAGE } from "../src/popupButton/popupButton";

type MessageSender = { tab?: { id?: number } };
type MessageListener = (message: unknown, sender: MessageSender) => void;

let listeners: MessageListener[];
let setIconCalls: unknown[];
let badgeText: string | undefined;
let permissionListeners: Array<() => void>;
let access: { granted: boolean } | undefined;

function stubEnvironment(env: { access?: { granted: boolean } } = {}): void {
  listeners = [];
  setIconCalls = [];
  badgeText = undefined;
  permissionListeners = [];
  access = env.access;

  vi.stubGlobal("defineBackground", <T>(definition: T): T => definition);
  vi.stubGlobal("browser", {
    runtime: {
      onMessage: {
        addListener: (listener: MessageListener) => listeners.push(listener),
      },
    },
    action: {
      setIcon: async (details: unknown) => {
        setIconCalls.push(details);
      },
      setBadgeText: async ({ text }: { text: string }) => {
        badgeText = text;
      },
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
    ...(access && {
      permissions: {
        contains: async () => access!.granted,
        onAdded: { addListener: (listener: () => void) => permissionListeners.push(listener) },
        onRemoved: { addListener: (listener: () => void) => permissionListeners.push(listener) },
      },
    }),
  });
}

/** Starts the service worker the way the browser would. */
async function startBackground(): Promise<void> {
  vi.resetModules();
  const definition = (await import("../entrypoints/background")).default;
  (definition as unknown as () => void)();
}

function notify(message: unknown, sender: MessageSender): void {
  for (const listener of listeners) listener(message, sender);
}

beforeEach(() => stubEnvironment());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("toolbar icon", () => {
  it("sets the active icon for the tab that reports a timetable", async () => {
    await startBackground();

    notify(TIMETABLE_ACTIVE_MESSAGE, { tab: { id: 7 } });

    expect(setIconCalls).toEqual([{ tabId: 7, path: { ...ACTIVE_ICON_PATHS } }]);
  });

  it("changes only the reporting tab", async () => {
    await startBackground();

    notify(TIMETABLE_ACTIVE_MESSAGE, { tab: { id: 7 } });
    notify(TIMETABLE_ACTIVE_MESSAGE, { tab: { id: 9 } });

    expect(setIconCalls.map((call) => (call as { tabId: number }).tabId))
      .toEqual([7, 9]);
  });

  it.each([
    ["another extension's message", "hello", { tab: { id: 7 } }],
    ["a message with no tab behind it", TIMETABLE_ACTIVE_MESSAGE, {}],
    ["a tab with no id", TIMETABLE_ACTIVE_MESSAGE, { tab: {} }],
  ])("ignores %s", async (_name, message, sender) => {
    await startBackground();

    notify(message, sender as MessageSender);

    expect(setIconCalls).toHaveLength(0);
  });

  it("references icon files included in the extension", () => {
    expect(Object.values(ACTIVE_ICON_PATHS)).toEqual([
      "icons/icon-16.png",
      "icons/icon-32.png",
      "icons/icon-48.png",
      "icons/icon-128.png",
    ]);
  });
});

describe("portal access badge (Safari)", () => {
  it("marks the button while the portal is not allowed", async () => {
    stubEnvironment({ access: { granted: false } });
    await startBackground();

    await vi.waitFor(() => expect(badgeText).toBe(MISSING_ACCESS_BADGE));
  });

  it("clears the mark as soon as the portal is allowed", async () => {
    stubEnvironment({ access: { granted: false } });
    await startBackground();
    await vi.waitFor(() => expect(badgeText).toBe(MISSING_ACCESS_BADGE));

    access!.granted = true;
    for (const listener of permissionListeners) listener();

    await vi.waitFor(() => expect(badgeText).toBe(""));
  });

  it("shows no mark where access comes with the install, as in Chrome", async () => {
    stubEnvironment({ access: { granted: true } });
    await startBackground();

    await vi.waitFor(() => expect(badgeText).toBe(""));
  });
});

describe("open popup from the page button", () => {
  async function ask(openPopup: (() => Promise<void>) | undefined): Promise<unknown> {
    const env = (globalThis as unknown as { browser: { action: Record<string, unknown> } }).browser;
    if (openPopup) env.action.openPopup = openPopup;
    else delete env.action.openPopup;
    await startBackground();
    return new Promise((resolve) => {
      for (const listener of listeners as unknown as Array<
        (message: unknown, sender: MessageSender, respond: (value: unknown) => void) => unknown
      >) {
        listener(OPEN_POPUP_MESSAGE, { tab: { id: 7 } }, resolve);
      }
    });
  }

  it("opens the popup and answers true", async () => {
    let opened = 0;
    await expect(ask(async () => { opened += 1; })).resolves.toBe(true);
    expect(opened).toBe(1);
  });

  it("answers false when the browser refuses", async () => {
    await expect(ask(async () => { throw new Error("no gesture"); })).resolves.toBe(false);
  });

  it("answers false when the browser has no openPopup", async () => {
    await expect(ask(undefined)).resolves.toBe(false);
  });
});
