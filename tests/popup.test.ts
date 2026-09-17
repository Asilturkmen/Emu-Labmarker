import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEMPORARY_ROOMS_KEY } from "../src/settings";

// Vitest runs from the project root, and the jsdom environment has no
// file-scheme import.meta.url to resolve against.
const popupHtml = readFileSync(
  resolve(process.cwd(), "entrypoints/popup/index.html"),
  "utf8",
);

let storage: Record<string, unknown>;

/** Loads the popup exactly as the browser would: real markup, real script. */
async function openPopup(
  stored: Record<string, unknown> = {},
): Promise<void> {
  storage = { ...stored };
  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (key: string) =>
          key in storage ? { [key]: storage[key] } : {},
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
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
  // main.ts renders from storage asynchronously.
  await vi.waitFor(() => expect(document.querySelector("#room-list")?.children.length).toBeGreaterThan(0));
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

describe("popup temporary room list", () => {
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
    await openPopup({ [TEMPORARY_ROOMS_KEY]: ["CMPE025", "CL116"] });

    expect(chips()).toEqual(["CMPE025", "CL116"]);
  });

  it("adds a room, normalizes it and persists it", async () => {
    await openPopup();

    addRoom("cmpe 025");
    await vi.waitFor(() => expect(chips()).toEqual(["CMPE025"]));

    expect(status()).toBe("CMPE025 eklendi.");
    expect(storage[TEMPORARY_ROOMS_KEY]).toEqual(["CMPE025"]);
    expect(document.querySelector<HTMLInputElement>("#room-input")?.value).toBe("");
  });

  it("explains why a room was rejected and keeps the list unchanged", async () => {
    await openPopup({ [TEMPORARY_ROOMS_KEY]: ["CMPE025"] });

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
    expect(storage[TEMPORARY_ROOMS_KEY]).toEqual(["CMPE025"]);
  });

  it("removes a room when its button is used", async () => {
    await openPopup({ [TEMPORARY_ROOMS_KEY]: ["CMPE025", "CL116"] });

    document
      .querySelector<HTMLButtonElement>('.chip-remove[data-room="CMPE025"]')!
      .click();
    await vi.waitFor(() => expect(chips()).toEqual(["CL116"]));

    expect(status()).toBe("CMPE025 çıkarıldı.");
    expect(storage[TEMPORARY_ROOMS_KEY]).toEqual(["CL116"]);
  });

  it("keeps the enable toggle working alongside the list", async () => {
    await openPopup();
    const toggle = document.querySelector<HTMLInputElement>("#enabled-toggle")!;

    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(storage.emuLabmarkEnabled).toBe(false));
    expect(document.querySelector("#status-text")?.textContent).toBe("Kapalı");
  });
});
