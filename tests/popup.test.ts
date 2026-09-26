import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CUSTOM_ROOMS_KEY } from "../src/settings";
import { LIST_SESSIONS_MESSAGE } from "../src/timetableSessions";

// Vitest runs from the project root, and the jsdom environment has no
// file-scheme import.meta.url to resolve against.
const popupHtml = readFileSync(
  resolve(process.cwd(), "entrypoints/popup/index.html"),
  "utf8",
);

let storage: Record<string, unknown>;

type Session = {
  courseCode: string;
  room: string;
  day: string;
  startMinutes: number;
  endMinutes: number;
};

/** CMPE030 hosts a Monday lecture and two separate Friday meetings. */
const SESSIONS: Session[] = [
  { courseCode: "CMPE224", room: "CMPE030", day: "monday", startMinutes: 510, endMinutes: 620 },
  { courseCode: "CMPE224", room: "CMPE030", day: "friday", startMinutes: 630, endMinutes: 680 },
  { courseCode: "CMPE211", room: "CMPE030", day: "friday", startMinutes: 810, endMinutes: 920 },
  { courseCode: "MGMT101", room: "CL116", day: "tuesday", startMinutes: 750, endMinutes: 800 },
  { courseCode: "CMSE423", room: "CMPE025", day: "wednesday", startMinutes: 510, endMinutes: 620 },
  { courseCode: "CMSE456", room: "CMPE134", day: "thursday", startMinutes: 750, endMinutes: 860 },
];

/**
 * Loads the popup exactly as the browser would: real markup, real script.
 * With sessions, the active tab is a timetable that answers the popup;
 * without, it is any other page and has nobody to answer.
 */
async function openPopup(
  stored: Record<string, unknown> = {},
  sessions?: Session[],
): Promise<void> {
  storage = { ...stored };
  let tabAsked = false;
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
    },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (tabId: number, message: unknown) => {
        tabAsked = true;
        if (!sessions || tabId !== 7 || message !== LIST_SESSIONS_MESSAGE) {
          throw new Error("Could not establish connection. Receiving end does not exist.");
        }
        return sessions;
      },
    },
  });

  const body = popupHtml.slice(
    popupHtml.indexOf("<body>") + "<body>".length,
    popupHtml.indexOf("</body>"),
  );
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");

  vi.resetModules();
  await import("../entrypoints/popup/main");
  // main.ts renders from storage asynchronously, then asks the tab.
  await vi.waitFor(() => {
    expect(document.querySelector("#room-list")?.children.length).toBeGreaterThan(0);
    expect(tabAsked).toBe(true);
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function typeRoom(value: string): void {
  const input = document.querySelector<HTMLInputElement>("#room-input")!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function chooseDay(day: string): void {
  const select = document.querySelector<HTMLSelectElement>("#day-select")!;
  select.value = day;
  select.dispatchEvent(new Event("change"));
}

function options(selector: string): string[] {
  return [...document.querySelectorAll<HTMLOptionElement>(`${selector} option`)].map(
    (option) => option.textContent ?? "",
  );
}

function submit(): void {
  document.querySelector<HTMLFormElement>("#room-form")!.dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true }),
  );
}

function addTimedRoom(room: string, day: string, time: string): void {
  typeRoom(room);
  chooseDay(day);
  document.querySelector<HTMLSelectElement>("#time-select")!.value = time;
  submit();
}

/** The greyed-out completion after the typed text, if any. */
function ghost(): string {
  return document.querySelector("#room-ghost .room-ghost-rest")?.textContent ?? "";
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true, ...init });
  document.querySelector<HTMLInputElement>("#room-input")!.dispatchEvent(event);
  return event;
}

function hint(): string | null {
  const element = document.querySelector<HTMLElement>("#form-hint")!;
  return element.hidden ? null : element.textContent;
}

function addRoom(value: string): void {
  const input = document.querySelector<HTMLInputElement>("#room-input")!;
  input.value = value;
  document.querySelector<HTMLFormElement>("#room-form")!.dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true }),
  );
}

function chips(): string[] {
  return [...document.querySelectorAll("#room-list .chip > span")].map(
    (chip) => chip.textContent ?? "",
  );
}

function status(): string {
  return document.querySelector("#room-status")?.textContent ?? "";
}

describe("popup custom room list", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows an empty state before anything is added", async () => {
    await openPopup();

    expect(chips()).toEqual([]);
    expect(document.querySelector("#room-list .empty")?.textContent).toBe(
      "Henüz sınıf eklemedin.",
    );
  });

  it("lists rooms that were already stored", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: ["CMPE025", "CL116"] });

    expect(chips()).toEqual(["CMPE025", "CL116"]);
  });

  it("adds a room, normalizes it and persists it", async () => {
    await openPopup();

    addRoom("cmpe 025");
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE025"]));

    expect(status()).toBe("CMPE025 eklendi.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025"]);
    expect(document.querySelector<HTMLInputElement>("#room-input")?.value).toBe("");
  });

  it("explains why a room was rejected and keeps the list unchanged", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: ["CMPE025"] });

    addRoom("CMPE134");
    await vi.waitFor(() =>
      expect(status()).toBe("CMPE134 zaten kesin lab listesinde."),
    );
    expect(document.querySelector("#room-status")?.getAttribute("data-tone")).toBe("error");

    addRoom("cmpe 025");
    await vi.waitFor(() => expect(status()).toBe("CMPE025 listede zaten var."));

    addRoom("??");
    await vi.waitFor(() =>
      expect(status()).toBe("Geçerli bir sınıf kodu yaz (örnek: CMPE025)."),
    );

    expect(chips()).toEqual(["CMPE025"]);
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025"]);
  });

  it("removes a room when its button is used", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: ["CMPE025", "CL116"] });

    document
      .querySelector<HTMLButtonElement>('.chip-remove[data-rule="CMPE025"]')!
      .click();
    await vi.waitFor(() => expect(chips()).toEqual(["CL116"]));

    expect(status()).toBe("CMPE025 çıkarıldı.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CL116"]);
  });

  it("offers only the days and times the typed room is used", async () => {
    await openPopup({}, SESSIONS);
    const day = document.querySelector<HTMLSelectElement>("#day-select")!;
    const time = document.querySelector<HTMLSelectElement>("#time-select")!;
    // Nothing typed yet: only a room at every hour can be added.
    expect(options("#day-select")).toEqual(["Her zaman"]);
    expect(day.disabled).toBe(true);

    typeRoom("cmpe030");
    expect(options("#day-select")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
    expect(day.disabled).toBe(false);
    expect(time.disabled).toBe(true);

    chooseDay("friday");
    expect(options("#time-select")).toEqual([
      "Saat",
      "10:30–11:20 · CMPE224",
      "13:30–15:20 · CMPE211",
    ]);
    expect(time.value).toBe("");

    // A day with one meeting has nothing to choose between.
    chooseDay("monday");
    expect(options("#time-select")).toEqual(["08:30–10:20 · CMPE224"]);
    expect(time.value).toBe("08:30");
    expect(hint()).toBeNull();
  });

  it("adds the chosen meeting with its course", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("cmpe030", "friday", "13:30");
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE030 · Cum 13:30"]));

    expect(status()).toBe("CMPE030 · Cum 13:30 eklendi.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual([
      { room: "CMPE030", day: "friday", start: "13:30", course: "CMPE211" },
    ]);
    // The form goes back to its empty, every-hour state for the next entry.
    expect(document.querySelector<HTMLInputElement>("#room-input")!.value).toBe("");
    expect(options("#day-select")).toEqual(["Her zaman"]);
    expect(document.querySelector<HTMLSelectElement>("#time-select")!.disabled).toBe(true);
  });

  it("understands a whole entry pasted from the timetable", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("CMPE224/CMPE030");

    expect(options("#day-select")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
  });

  it("asks for a time when the day has several meetings and none was picked", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("CMPE030", "friday", "");
    await vi.waitFor(() => expect(status()).toBe("Dersin başladığı saati seç."));

    expect(storage[CUSTOM_ROOMS_KEY]).toBeUndefined();
    expect(document.activeElement?.id).toBe("time-select");
  });

  it("explains that a room outside the timetable can only be added at every hour", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("CMPE099");

    expect(options("#day-select")).toEqual(["Her zaman"]);
    expect(document.querySelector<HTMLSelectElement>("#day-select")!.disabled).toBe(true);
    expect(hint()).toBe('CMPE099 programında yok, yalnızca "Her zaman" olarak eklenebilir.');
  });

  it("allows only every-hour rooms when opened outside the timetable", async () => {
    await openPopup();

    typeRoom("CMPE030");

    expect(options("#day-select")).toEqual(["Her zaman"]);
    expect(document.querySelector<HTMLSelectElement>("#day-select")!.disabled).toBe(true);
    expect(hint()).toBe("Tek bir dersi eklemek için bu pencereyi ders programı sayfasında aç.");
  });

  it("completes a room from the timetable with Tab", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("cmpe0");
    expect(ghost()).toBe("25");
    typeRoom("cmpe03");
    expect(ghost()).toBe("0");

    const tab = press("Tab");
    expect(tab.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#room-input")!.value).toBe("CMPE030");
    expect(ghost()).toBe("");
    // The completed room fills the day list like a typed one.
    expect(options("#day-select")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
  });

  it("completes with the right arrow only when the caret is at the end", async () => {
    await openPopup({}, SESSIONS);
    const input = document.querySelector<HTMLInputElement>("#room-input")!;

    typeRoom("cmpe03");
    input.setSelectionRange(2, 2);
    expect(press("ArrowRight").defaultPrevented).toBe(false);
    expect(input.value).toBe("cmpe03");

    input.setSelectionRange(6, 6);
    expect(press("ArrowRight").defaultPrevented).toBe(true);
    expect(input.value).toBe("CMPE030");
  });

  it("leaves Tab alone when there is nothing to complete", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("CMPE030");
    expect(press("Tab").defaultPrevented).toBe(false);
    typeRoom("CMPE13");
    // CMPE134 is a confirmed laboratory, so it is never offered.
    expect(ghost()).toBe("");
    expect(press("Tab").defaultPrevented).toBe(false);
    typeRoom("cmpe0");
    expect(press("Tab", { shiftKey: true }).defaultPrevented).toBe(false);
  });

  it("offers no completion outside the timetable", async () => {
    await openPopup();

    typeRoom("cmpe0");

    expect(ghost()).toBe("");
    expect(press("Tab").defaultPrevented).toBe(false);
  });

  it("adds a tutorial when that kind is chosen, shown in its own colour", async () => {
    await openPopup({}, SESSIONS);
    // A laboratory unless said otherwise.
    expect(document.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value).toBe("lab");

    document.querySelector<HTMLInputElement>('input[name="kind"][value="tutorial"]')!.click();
    addTimedRoom("CMPE030", "friday", "10:30");
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE030 · Cum 10:30 · Tutorial"]));

    expect(status()).toBe("CMPE030 · Cum 10:30 · Tutorial eklendi.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual([
      { room: "CMPE030", day: "friday", start: "10:30", course: "CMPE224", kind: "tutorial" },
    ]);
    expect(document.querySelector<HTMLElement>("#room-list .chip")?.dataset.kind).toBe("tutorial");
  });

  it("names the stored entry when the same meeting is added as the other kind", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: [{ room: "CMPE030", day: "friday", start: "10:30" }] }, SESSIONS);

    document.querySelector<HTMLInputElement>('input[name="kind"][value="tutorial"]')!.click();
    addTimedRoom("CMPE030", "friday", "10:30");

    await vi.waitFor(() => expect(status()).toBe("CMPE030 · Cum 10:30 listede zaten var."));
    expect(chips()).toEqual(["CMPE030 · Cum 10:30"]);
  });

  it("removes a timed entry without touching the plain room", async () => {
    await openPopup({
      [CUSTOM_ROOMS_KEY]: ["CL116", { room: "CMPE030", day: "friday", start: "10:30" }],
    });

    document
      .querySelector<HTMLButtonElement>('.chip-remove[data-rule="CMPE030|friday|10:30"]')!
      .click();
    await vi.waitFor(() => expect(chips()).toEqual(["CL116"]));

    expect(status()).toBe("CMPE030 · Cum 10:30 çıkarıldı.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CL116"]);
  });

  it("keeps two quick entries from overwriting each other", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("CMPE030", "friday", "10:30");
    addTimedRoom("CMPE030", "monday", "08:30");
    await vi.waitFor(() => expect(chips()).toHaveLength(2));

    expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2);
  });

  it("keeps the enable toggle working alongside the list", async () => {
    await openPopup();
    const toggle = document.querySelector<HTMLInputElement>("#enabled-toggle")!;

    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(storage.emuLabmarkerEnabled).toBe(false));
    expect(document.querySelector("#status-text")?.textContent).toBe("Kapalı");
  });
});
