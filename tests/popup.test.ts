import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COLORS_KEY, CUSTOM_ROOMS_KEY } from "../src/settings";
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
 * Load the popup markup and script with mocked extension APIs.
 * With sessions, mock a timetable response; otherwise, reject the tab message.
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
    popupHtml.indexOf(">", popupHtml.indexOf("<body")) + 1,
    popupHtml.indexOf("</body>"),
  );
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  // The body's own attributes are not part of the markup copied above.
  document.body.dataset.view = "main";
  document.body.dataset.enabled = "true";

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

/** Opens a dropdown and picks an option, the way a click would. */
function pick(prefix: "day" | "time", value: string): void {
  document.querySelector<HTMLButtonElement>(`#${prefix}-btn`)!.click();
  document.querySelector<HTMLElement>(`#${prefix}-list li[data-value="${value}"]`)!.click();
}

function chooseDay(day: string): void {
  pick("day", day);
}

/** Option texts of the day or time list. */
function options(prefix: "day" | "time"): string[] {
  return [...document.querySelectorAll(`#${prefix}-list li`)].map(
    (option) => option.textContent ?? "",
  );
}

/** What the trigger shows and the value it holds. */
function trigger(prefix: "day" | "time"): { text: string; value: string; disabled: boolean } {
  const button = document.querySelector<HTMLButtonElement>(`#${prefix}-btn`)!;
  return {
    text: document.querySelector(`#${prefix}-value`)!.textContent ?? "",
    value: button.dataset.value ?? "",
    disabled: button.disabled,
  };
}

function submit(): void {
  document.querySelector<HTMLFormElement>("#room-form")!.dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true }),
  );
}

function addTimedRoom(room: string, day: string, time: string): void {
  typeRoom(room);
  chooseDay(day);
  if (time) pick("time", time);
  submit();
}

/** The greyed-out completion after the typed text, if any. */
function ghost(): string {
  return document.querySelector("#room-ghost .ghost-rest")?.textContent ?? "";
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true, ...init });
  document.querySelector<HTMLInputElement>("#room-input")!.dispatchEvent(event);
  return event;
}

function hint(): string | null {
  const element = document.querySelector<HTMLElement>("#form-hint")!;
  return element.hidden ? null : (element.querySelector("span")?.textContent ?? "");
}

function addRoom(value: string): void {
  const input = document.querySelector<HTMLInputElement>("#room-input")!;
  input.value = value;
  document.querySelector<HTMLFormElement>("#room-form")!.dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true }),
  );
}

/** Rooms shown in the records card, all groups, in order. */
function chips(): string[] {
  return [...document.querySelectorAll<HTMLElement>("#room-list .box")].map(
    (box) => box.dataset.room ?? "",
  );
}

function groupHeads(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("#room-list .kgroup-head")];
}

function boxTitle(room: string): string {
  return document.querySelector<HTMLElement>(`#room-list .box[data-room="${room}"]`)?.title ?? "";
}

function status(): string {
  return document.querySelector("#room-status > span")?.textContent ?? "";
}

describe("popup custom room list", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows an empty state before anything is added", async () => {
    await openPopup();

    expect(chips()).toEqual([]);
    expect(document.querySelector("#room-list .rec-empty")?.textContent).toBe(
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
      expect(status()).toBe("CMPE134 kayıtlı lab sınıfları arasında."),
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
      .querySelector<HTMLButtonElement>('.tag-x[data-rule="CMPE025"]')!
      .click();
    await vi.waitFor(() => expect(chips()).toEqual(["CL116"]));

    expect(status()).toBe("CMPE025 çıkarıldı.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CL116"]);
  });

  it("offers only the days and times the typed room is used", async () => {
    await openPopup({}, SESSIONS);
    // Nothing typed yet: only a room at every hour can be added.
    expect(options("day")).toEqual(["Her zaman"]);
    expect(trigger("day").disabled).toBe(true);

    typeRoom("cmpe030");
    expect(options("day")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
    expect(trigger("day").disabled).toBe(false);
    expect(trigger("time").disabled).toBe(true);

    chooseDay("friday");
    expect(options("time")).toEqual([
      "Saat",
      "10:30–11:20 · CMPE224",
      "13:30–15:20 · CMPE211",
    ]);
    expect(trigger("time").value).toBe("");

    // A day with one meeting has nothing to choose between. The trigger shows
    // only the time range; the full label is its title.
    chooseDay("monday");
    expect(options("time")).toEqual(["08:30–10:20 · CMPE224"]);
    expect(trigger("time")).toMatchObject({ text: "08:30–10:20", value: "08:30" });
    expect(document.querySelector<HTMLElement>("#time-btn")!.title).toBe("08:30–10:20 · CMPE224");
    expect(hint()).toBeNull();
  });

  it("adds the chosen meeting with its course", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("cmpe030", "friday", "13:30");
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE030"]));

    expect(status()).toBe("CMPE030 · Cum 13:30 eklendi.");
    expect(boxTitle("CMPE030")).toBe("CMPE030 — Özel lab: Cum 13:30 (CMPE211)");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual([
      { room: "CMPE030", day: "friday", start: "13:30", course: "CMPE211" },
    ]);
    // The form goes back to its empty, every-hour state for the next entry.
    expect(document.querySelector<HTMLInputElement>("#room-input")!.value).toBe("");
    expect(options("day")).toEqual(["Her zaman"]);
    expect(trigger("time").disabled).toBe(true);
  });

  it("understands a whole entry pasted from the timetable", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("CMPE224/CMPE030");

    expect(options("day")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
  });

  it("asks for a time when the day has several meetings and none was picked", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("CMPE030", "friday", "");
    await vi.waitFor(() => expect(status()).toBe("Dersin başladığı saati seç."));

    expect(storage[CUSTOM_ROOMS_KEY]).toBeUndefined();
    expect(document.activeElement?.id).toBe("time-btn");
  });

  it("explains that a room outside the timetable can only be added at every hour", async () => {
    await openPopup({}, SESSIONS);

    typeRoom("CMPE099");

    expect(options("day")).toEqual(["Her zaman"]);
    expect(trigger("day").disabled).toBe(true);
    expect(hint()).toBe('CMPE099 programında yok, yalnızca "Her zaman" olarak eklenebilir.');
  });

  it("hides the not-in-timetable hint while a completion is offered", async () => {
    await openPopup({}, SESSIONS);

    // CMPE0 is a valid code that is not in the timetable, but it completes.
    typeRoom("cmpe0");
    expect(ghost()).toBe("25");
    expect(hint()).toBeNull();

    // Once nothing completes any more, the hint comes back.
    typeRoom("cmpe099");
    expect(ghost()).toBe("");
    expect(hint()).toBe('CMPE099 programında yok, yalnızca "Her zaman" olarak eklenebilir.');
  });

  it("keeps a storage failure on screen when typing starts", async () => {
    await openPopup();
    (globalThis as unknown as { browser: { storage: { local: { set: unknown } } } }).browser.storage.local.set =
      async () => {
        throw new Error("quota");
      };

    addRoom("CMPE025");
    await vi.waitFor(() => expect(status()).toBe("Kaydedilemedi. Tekrar dene."));

    typeRoom("c");
    expect(status()).toBe("Kaydedilemedi. Tekrar dene.");
  });

  it("allows only every-hour rooms when opened outside the timetable", async () => {
    await openPopup();

    typeRoom("CMPE030");

    expect(options("day")).toEqual(["Her zaman"]);
    expect(trigger("day").disabled).toBe(true);
    expect(hint()).toBe("Tek dersi eklemek için bu pencereyi ders programı sayfasında aç.");
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
    expect(options("day")).toEqual(["Her zaman", "Pazartesi", "Cuma"]);
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
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE030"]));

    expect(status()).toBe("CMPE030 · Cum 10:30 · Tutorial eklendi.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual([
      { room: "CMPE030", day: "friday", start: "10:30", course: "CMPE224", kind: "tutorial" },
    ]);
    expect(document.querySelector<HTMLElement>("#room-list .kgroup")?.dataset.kind).toBe("tutorial");
  });

  it("names the stored entry when the same meeting is added as the other kind", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: [{ room: "CMPE030", day: "friday", start: "10:30" }] }, SESSIONS);

    document.querySelector<HTMLInputElement>('input[name="kind"][value="tutorial"]')!.click();
    addTimedRoom("CMPE030", "friday", "10:30");

    await vi.waitFor(() => expect(status()).toBe("CMPE030 · Cum 10:30 listede zaten var."));
    expect(chips()).toEqual(["CMPE030"]);
    expect(document.querySelector<HTMLElement>("#room-list .kgroup")?.dataset.kind).toBe("lab");
  });

  it("removes a timed entry without touching the plain room", async () => {
    await openPopup({
      [CUSTOM_ROOMS_KEY]: ["CL116", { room: "CMPE030", day: "friday", start: "10:30" }],
    });

    document
      .querySelector<HTMLButtonElement>('.tag-x[data-rule="CMPE030|friday|10:30"]')!
      .click();
    await vi.waitFor(() => expect(chips()).toEqual(["CL116"]));

    expect(status()).toBe("CMPE030 · Cum 10:30 çıkarıldı.");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CL116"]);
  });

  it("keeps two quick entries from overwriting each other", async () => {
    await openPopup({}, SESSIONS);

    addTimedRoom("CMPE030", "friday", "10:30");
    addTimedRoom("CMPE030", "monday", "08:30");
    await vi.waitFor(() => expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2));

    // Both rules belong to one room, so the card shows one box with a rule list.
    expect(chips()).toEqual(["CMPE030"]);
    expect(document.querySelector("#room-list button.box-main")).not.toBeNull();
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
  it("has no native select and no legend or disclaimer", async () => {
    await openPopup();

    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector(".legend, .disclaimer")).toBeNull();
    const credit = document.querySelector<HTMLAnchorElement>(".view-main .credit a")!;
    expect(credit.textContent).toBe("Asil Türkmen");
    expect(credit.href).toBe("https://asilturkmen.com/");
  });
});

describe("popup record groups", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const STORED = ["CMPE025", "CL116", { room: "CMPE026", kind: "tutorial" }];

  it("groups by kind, collapsed, with counts and aria state", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: STORED });

    const heads = groupHeads();
    expect(heads.map((head) => head.textContent?.trim())).toEqual(["Özel lab2 sınıf", "Tutorial1 sınıf"]);
    for (const head of heads) {
      expect(head.getAttribute("aria-expanded")).toBe("false");
      const body = document.getElementById(head.getAttribute("aria-controls")!)!;
      expect(body.hasAttribute("inert")).toBe(true);
    }

    heads[0]!.click();
    expect(heads[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("body-lab")!.hasAttribute("inert")).toBe(false);
    expect(heads[1]!.getAttribute("aria-expanded")).toBe("false");
    heads[0]!.click();
    expect(heads[0]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the group of a record that was just added", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: STORED });
    expect(groupHeads().every((head) => head.getAttribute("aria-expanded") === "false")).toBe(true);

    document.querySelector<HTMLInputElement>('input[name="kind"][value="tutorial"]')!.click();
    addRoom("CMPE027");
    await vi.waitFor(() => expect(chips()).toContain("CMPE027"));

    expect(groupHeads().map((head) => head.getAttribute("aria-expanded"))).toEqual(["false", "true"]);
  });

  it("removes a group together with its last record", async () => {
    await openPopup({ [CUSTOM_ROOMS_KEY]: STORED });

    document.querySelector<HTMLButtonElement>('.tag-x[data-rule="CMPE026"]')!.click();
    await vi.waitFor(() => expect(groupHeads()).toHaveLength(1));

    expect(groupHeads()[0]!.id).toBe("group-lab");
    expect(storage[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025", "CL116"]);
  });

  it("lists the rules of a room that has several and removes one of them", async () => {
    await openPopup({
      [CUSTOM_ROOMS_KEY]: [
        { room: "CMPE030", day: "friday", start: "10:30" },
        { room: "CMPE030", day: "monday", start: "08:30" },
      ],
    });
    const pop = document.querySelector<HTMLElement>("#rule-pop")!;
    expect(pop.hidden).toBe(true);
    // No delete badge on the box itself; its rules open in a small list.
    expect(document.querySelector("#room-list .tag-x")).toBeNull();

    document.querySelector<HTMLButtonElement>("#room-list button.box-main")!.click();
    expect(pop.hidden).toBe(false);
    expect(
      [...pop.querySelectorAll("li")].map((li) => li.textContent?.trim()),
    ).toEqual(["Pzt 08:30Özel lab", "Cum 10:30Özel lab"]);

    pop.querySelector<HTMLButtonElement>('.rule-x[data-rule="CMPE030|monday|08:30"]')!.click();
    await vi.waitFor(() => expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(1));

    // One rule left: the box is a plain box with its own delete badge again.
    expect(pop.hidden).toBe(true);
    expect(
      document.querySelector('#room-list .tag-x[data-rule="CMPE030|friday|10:30"]'),
    ).not.toBeNull();
    expect(status()).toBe("CMPE030 · Pzt 08:30 çıkarıldı.");
  });
});

describe("popup rule list removal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("removes only one rule when the cross is double-clicked", async () => {
    await openPopup({
      [CUSTOM_ROOMS_KEY]: [
        { room: "CMPE030", day: "friday", start: "10:30" },
        { room: "CMPE030", day: "monday", start: "08:30" },
        { room: "CMPE030", day: "tuesday", start: "08:30" },
      ],
    });
    document.querySelector<HTMLButtonElement>("#room-list button.box-main")!.click();
    const cross = document.querySelector<HTMLButtonElement>("#rule-pop .rule-x")!;

    for (const detail of [1, 2]) {
      cross.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
    }
    await vi.waitFor(() => expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2));
    // A late second click on the list that was repainted is ignored as well.
    document
      .querySelector("#rule-pop .rule-x")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2);
    expect(document.querySelectorAll("#rule-pop .rule-x")).toHaveLength(2);
  });

  it("ignores a second click while the same removal is still queued", async () => {
    await openPopup({
      [CUSTOM_ROOMS_KEY]: [
        { room: "CMPE030", day: "friday", start: "10:30" },
        { room: "CMPE030", day: "monday", start: "08:30" },
        { room: "CMPE030", day: "tuesday", start: "08:30" },
      ],
    });
    document.querySelector<HTMLButtonElement>("#room-list button.box-main")!.click();
    const cross = document.querySelector<HTMLButtonElement>("#rule-pop .rule-x")!;

    cross.click();
    cross.click();
    await vi.waitFor(() => expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(storage[CUSTOM_ROOMS_KEY]).toHaveLength(2);
  });
});

describe("popup dropdowns", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const key = (target: Element, name: string): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { key: name, cancelable: true, bubbles: true });
    target.dispatchEvent(event);
    return event;
  };

  it("exposes listbox and option roles and opens with the arrow keys", async () => {
    await openPopup({}, SESSIONS);
    typeRoom("CMPE030");
    const button = document.querySelector<HTMLButtonElement>("#day-btn")!;
    const list = document.querySelector<HTMLElement>("#day-list")!;

    expect(button.getAttribute("aria-haspopup")).toBe("listbox");
    expect(list.getAttribute("role")).toBe("listbox");
    expect(list.hidden).toBe(true);
    expect(
      [...list.querySelectorAll("li")].every((li) => li.getAttribute("role") === "option"),
    ).toBe(true);

    expect(key(button, "ArrowDown").defaultPrevented).toBe(true);
    expect(list.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(list);
    // The chosen option is marked, and it is the active one.
    expect(list.querySelector('li[aria-selected="true"]')?.textContent).toBe("Her zaman");
    expect(list.getAttribute("aria-activedescendant")).toBe("day-opt-0");

    key(list, "ArrowDown");
    expect(list.getAttribute("aria-activedescendant")).toBe("day-opt-1");
    key(list, "End");
    expect(list.getAttribute("aria-activedescendant")).toBe("day-opt-2");
    key(list, "Enter");

    expect(list.hidden).toBe(true);
    expect(trigger("day")).toMatchObject({ text: "Cuma", value: "friday" });
    expect(document.activeElement).toBe(button);
    // The time list follows the chosen day.
    expect(options("time")).toEqual(["Saat", "10:30–11:20 · CMPE224", "13:30–15:20 · CMPE211"]);
  });

  it("closes with Escape and returns focus, and closes on a press outside", async () => {
    await openPopup({}, SESSIONS);
    typeRoom("CMPE030");
    const button = document.querySelector<HTMLButtonElement>("#day-btn")!;
    const list = document.querySelector<HTMLElement>("#day-list")!;

    button.click();
    expect(list.hidden).toBe(false);
    key(list, "Escape");
    expect(list.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    // Nothing was chosen.
    expect(trigger("day").value).toBe("");

    button.click();
    expect(list.hidden).toBe(false);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(list.hidden).toBe(true);
  });

  it("opens one list at a time", async () => {
    await openPopup({}, SESSIONS);
    typeRoom("CMPE030");
    chooseDay("friday");

    document.querySelector<HTMLButtonElement>("#day-btn")!.click();
    document.querySelector<HTMLButtonElement>("#time-btn")!.click();

    expect(document.querySelector<HTMLElement>("#day-list")!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>("#time-list")!.hidden).toBe(false);
  });

  it("does not open while disabled", async () => {
    await openPopup({}, SESSIONS);

    document.querySelector<HTMLButtonElement>("#day-btn")!.click();

    expect(document.querySelector<HTMLElement>("#day-list")!.hidden).toBe(true);
  });
});

describe("popup colours view", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("style");
  });

  const swatch = (kind: string, hex: string): HTMLInputElement =>
    document.querySelector<HTMLInputElement>(`input[name="color-${kind}"][value="${hex}"]`)!;

  it("offers the eight presets for each kind, with the stored choice checked", async () => {
    await openPopup({ [COLORS_KEY]: { custom: "#22A55B", tutorial: "#123456" } });

    expect(document.querySelectorAll('input[name="color-verified"]')).toHaveLength(8);
    expect(swatch("verified", "#f12e4b").checked).toBe(true);
    // A stored preset is accepted in any case; anything else falls back.
    expect(swatch("custom", "#22a55b").checked).toBe(true);
    expect(swatch("tutorial", "#8b5cf6").checked).toBe(true);
    expect(document.querySelectorAll(".reset:not([hidden])")).toHaveLength(1);
  });

  it("opens from the palette button and goes back", async () => {
    await openPopup();
    expect(document.body.dataset.view).toBe("main");

    document.querySelector<HTMLButtonElement>("#open-colors")!.click();
    expect(document.body.dataset.view).toBe("colors");
    expect(document.querySelector("#view-main")?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector("#view-colors")?.hasAttribute("inert")).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.body.dataset.view).toBe("main");
    expect(document.querySelector("#view-colors")?.hasAttribute("inert")).toBe(true);
  });

  it("saves a chosen colour, recolours the popup and can reset it", async () => {
    await openPopup();
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--custom").toLowerCase()).toBe("#f08c14");

    swatch("custom", "#1269b5").click();
    await vi.waitFor(() =>
      expect(storage[COLORS_KEY]).toEqual({
        verified: "#f12e4b",
        custom: "#1269b5",
        tutorial: "#8b5cf6",
      }),
    );
    expect(root.getPropertyValue("--custom").toLowerCase()).toBe("#1269b5");
    const reset = document.querySelector<HTMLButtonElement>('.color-row[data-kind="custom"] .reset')!;
    expect(reset.hidden).toBe(false);

    reset.click();
    await vi.waitFor(() =>
      expect((storage[COLORS_KEY] as { custom: string }).custom).toBe("#f08c14"),
    );
    expect(root.getPropertyValue("--custom").toLowerCase()).toBe("#f08c14");
    expect(reset.hidden).toBe(true);
  });

  it("reports a colour that could not be saved in the Colours view and restores the old one", async () => {
    await openPopup();
    const local = (globalThis as unknown as { browser: { storage: { local: { set: unknown } } } })
      .browser.storage.local;
    local.set = async () => {
      throw new Error("quota");
    };
    document.querySelector<HTMLButtonElement>("#open-colors")!.click();

    swatch("custom", "#1269b5").click();

    const message = document.querySelector<HTMLElement>("#color-status")!;
    await vi.waitFor(() => expect(message.textContent).toBe("Kaydedilemedi. Tekrar dene."));
    expect(message.dataset.tone).toBe("error");
    expect(message.closest("#view-colors")).not.toBeNull();
    // Nothing is left on the main view's own message line.
    expect(status()).toBe("");
    expect(swatch("custom", "#f08c14").checked).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--custom").toLowerCase()).toBe("#f08c14");

    // The message goes with the next choice.
    local.set = async (items: Record<string, unknown>) => {
      Object.assign(storage, items);
    };
    swatch("custom", "#22a55b").click();
    await vi.waitFor(() => expect(storage[COLORS_KEY]).toBeDefined());
    expect(message.textContent).toBe("");
  });

  it("shows the timetable preview in the chosen colours", async () => {
    await openPopup();

    swatch("tutorial", "#22a55b").click();
    await vi.waitFor(() => expect(storage[COLORS_KEY]).toBeDefined());

    const cell = document.querySelector<HTMLElement>('.pcell[data-kind="tutorial"]')!;
    expect(cell.style.getPropertyValue("--c").toLowerCase()).toBe("#22a55b");
    expect(cell.style.getPropertyValue("--cb")).not.toBe("");
  });
});
