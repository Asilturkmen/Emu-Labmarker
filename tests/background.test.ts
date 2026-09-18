import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_ICON_PATHS,
  TIMETABLE_ACTIVE_MESSAGE,
} from "../src/toolbarIcon";

type MessageSender = { tab?: { id?: number } };
type MessageListener = (message: unknown, sender: MessageSender) => void;

let listeners: MessageListener[];
let setIconCalls: unknown[];

function stubEnvironment(): void {
  listeners = [];
  setIconCalls = [];

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
    },
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

beforeEach(stubEnvironment);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("toolbar icon", () => {
  it("lights up the tab that reports a timetable", async () => {
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

  it("points at icon files the extension actually ships", () => {
    expect(Object.values(ACTIVE_ICON_PATHS)).toEqual([
      "icons/icon-16.png",
      "icons/icon-32.png",
      "icons/icon-48.png",
      "icons/icon-128.png",
    ]);
  });
});
