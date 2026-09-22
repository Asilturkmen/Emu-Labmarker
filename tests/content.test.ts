import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { portalTimetable } from "./fixtures/portalTimetable";
import { CUSTOM_ROOMS_KEY, LABMARKER_ENABLED_KEY } from "../src/settings";
import { TIMETABLE_ACTIVE_MESSAGE } from "../src/toolbarIcon";

// The script collapses a burst of mutations into one rescan after 100ms.
const RESCAN_WAIT_MS = 160;

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, RESCAN_WAIT_MS));

type StorageChange = { newValue?: unknown };
type ChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

// Captured before any stub replaces the global, so the tracking subclass below
// always extends the real implementation rather than a previous stub.
const RealMutationObserver = globalThis.MutationObserver;

let storage: Record<string, unknown>;
let changeListeners: ChangeListener[];
let observers: MutationObserver[];
let sentMessages: unknown[];

function stubEnvironment(stored: Record<string, unknown>): void {
  storage = { ...stored };
  changeListeners = [];
  observers = [];
  sentMessages = [];

  // Each test loads a fresh copy of the script, and the copy from the previous
  // test would otherwise keep watching the document and mark it with its own
  // stale settings. Tracking the observers lets a test shut its copy down.
  class TrackedMutationObserver extends RealMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      observers.push(this);
    }
  }

  vi.stubGlobal("MutationObserver", TrackedMutationObserver);
  vi.stubGlobal("defineContentScript", <T>(definition: T): T => definition);
  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((key) => key in storage)
              .map((key) => [key, storage[key]]),
          ),
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
      },
      onChanged: {
        addListener: (listener: ChangeListener) =>
          changeListeners.push(listener),
      },
    },
    runtime: {
      sendMessage: async (message: unknown) => {
        sentMessages.push(message);
      },
    },
  });
}

/** Loads and starts the content script the way the browser would. */
async function startContentScript(path: string): Promise<void> {
  window.history.replaceState({}, "", path);
  vi.resetModules();
  const definition = (await import("../entrypoints/content")).default;
  // WXT passes main() a context object that this script never reads.
  await (definition.main as unknown as () => Promise<void>)();
}

function notifyStorage(
  changes: Record<string, StorageChange>,
  areaName = "local",
): void {
  for (const listener of changeListeners) listener(changes, areaName);
}

function marks(kind?: string): HTMLElement[] {
  const selector = kind
    ? `[data-emu-labmarker="${kind}"]`
    : "[data-emu-labmarker]";
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

beforeEach(() => {
  stubEnvironment({});
  document.body.innerHTML = portalTimetable();
});

afterEach(async () => {
  for (const observer of observers) observer.disconnect();
  // A rescan queued before the disconnect still runs and reconnects its own
  // observer, so the queue is drained first and the observers stopped again.
  await settle();
  for (const observer of observers) observer.disconnect();

  document.body.innerHTML = "";
  vi.doUnmock("../src/parser/parseTimetable");
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("content script", () => {
  // The portal is served from both hosts, and a missing one leaves the script
  // silently absent from that host.
  it("runs on both portal hosts", async () => {
    const definition = (await import("../entrypoints/content")).default;

    expect(definition.matches).toEqual([
      "https://student.emu.edu.tr/*",
      "https://students.emu.edu.tr/*",
    ]);
  });

  // Match patterns compare the path case sensitively, so the script matches the
  // whole site and decides for itself whether it is on the timetable.
  it.each([
    "/Academic/Timetable",
    "/Academic/TimeTable",
    "/academic/timetable",
    "/ACADEMIC/TIMETABLE",
    "/Academic/Timetable?semester=2025",
  ])("marks the timetable served at %s", async (path) => {
    await startContentScript(path);

    expect(marks("verified").length).toBeGreaterThan(0);
    expect(changeListeners).toHaveLength(1);
    // Lights up this tab's toolbar icon.
    expect(sentMessages).toEqual([TIMETABLE_ACTIVE_MESSAGE]);
  });

  it.each([
    "/",
    "/Academic/Dashboard",
    // "timetable" appears, but not where the timetable page has it.
    "/Registration/Timetable",
  ])("does nothing on %s", async (path) => {
    await startContentScript(path);

    expect(marks()).toHaveLength(0);
    expect(changeListeners).toHaveLength(0);
    expect(observers).toHaveLength(0);
    // The toolbar icon stays faded on every other page of the portal.
    expect(sentMessages).toHaveLength(0);
  });

  it("leaves the timetable alone while the extension is switched off", async () => {
    stubEnvironment({ [LABMARKER_ENABLED_KEY]: false });
    const before = document.body.innerHTML;

    await startContentScript("/Academic/Timetable");

    expect(marks()).toHaveLength(0);
    expect(document.body.innerHTML).toBe(before);
  });

  it("reads a room the user added before the page was opened", async () => {
    stubEnvironment({ [CUSTOM_ROOMS_KEY]: ["CMPE025"] });

    await startContentScript("/Academic/Timetable");

    expect(marks("custom").length).toBeGreaterThan(0);
    for (const mark of marks("custom")) {
      expect(mark.textContent).toContain("CMPE025");
    }
  });

  it("clears the marks when the switch is turned off in the popup", async () => {
    await startContentScript("/Academic/Timetable");
    expect(marks().length).toBeGreaterThan(0);

    notifyStorage({ [LABMARKER_ENABLED_KEY]: { newValue: false } });
    await settle();

    expect(marks()).toHaveLength(0);
  });

  it("picks up a room added in the popup without a reload", async () => {
    await startContentScript("/Academic/Timetable");
    expect(marks("custom")).toHaveLength(0);

    notifyStorage({ [CUSTOM_ROOMS_KEY]: { newValue: ["CMPE025"] } });
    await settle();

    expect(marks("custom").length).toBeGreaterThan(0);
    expect(marks("verified").length).toBeGreaterThan(0);
  });

  it("ignores storage changes from another area or another key", async () => {
    await startContentScript("/Academic/Timetable");
    const before = document.body.innerHTML;

    notifyStorage({ [LABMARKER_ENABLED_KEY]: { newValue: false } }, "sync");
    notifyStorage({ someoneElsesKey: { newValue: "x" } });
    await settle();

    expect(document.body.innerHTML).toBe(before);
  });

  it("collapses a burst of portal mutations into a single rescan", async () => {
    await startContentScript("/Academic/Timetable");
    const marked = marks().length;

    document.body.innerHTML = portalTimetable();
    for (let i = 0; i < 5; i++) {
      document.body.append(document.createElement("span"));
    }
    await settle();

    expect(marks()).toHaveLength(marked);
    expect(document.querySelectorAll(".emu-labmarker-legend")).toHaveLength(1);
  });

  // Regression guard: the scan reconnects the observer in a finally block, so
  // markup this version cannot read costs one scan rather than every later one.
  it("keeps watching the page after a scan throws", async () => {
    const parser = await vi.importActual<
      typeof import("../src/parser/parseTimetable")
    >("../src/parser/parseTimetable");
    let remainingFailures = 1;
    vi.doMock("../src/parser/parseTimetable", () => ({
      parseTimetable: (root?: ParentNode) => {
        if (remainingFailures-- > 0) throw new Error("unreadable timetable");
        return parser.parseTimetable(root);
      },
    }));

    await expect(startContentScript("/Academic/Timetable")).rejects.toThrow(
      "unreadable timetable",
    );
    expect(marks()).toHaveLength(0);

    document.body.innerHTML = portalTimetable();
    await settle();

    expect(marks("verified").length).toBeGreaterThan(0);
  });
});
