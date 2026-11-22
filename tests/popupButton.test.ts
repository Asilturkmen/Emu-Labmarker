import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { portalTimetable } from "./fixtures/portalTimetable";
import {
  ensurePopupButton,
  findTitle,
  OPEN_POPUP_MESSAGE,
  POPUP_BUTTON_CLASS,
  TITLE_ROW_ATTRIBUTE,
} from "../src/popupButton/popupButton";

// The portal's page head: profile card, breadcrumb, page title, then the timetable.
function page(): string {
  return `<div class="profile"><h5>ÖĞRENCİ ADI</h5></div>
    <nav><a>Ana Sayfa</a> › <span>Zaman Çizelgesi</span></nav>
    <h2 class="page-title">Zaman Çizelgesi</h2>
    <div class="alert">Haritada sınıf konumunu görmek için kurs/sınıf koduna tıklayın.</div>
    ${portalTimetable()}`;
}

let sent: unknown[];
let answer: () => Promise<unknown>;

beforeEach(() => {
  document.body.innerHTML = page();
  sent = [];
  answer = async () => true;
  vi.stubGlobal("browser", {
    runtime: {
      sendMessage: async (message: unknown) => {
        sent.push(message);
        return answer();
      },
    },
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const button = () => document.querySelector<HTMLButtonElement>(`.${POPUP_BUTTON_CLASS}`);
const hint = () => document.querySelector(`.${POPUP_BUTTON_CLASS}-hint`);

describe("popup button", () => {
  it("finds the page title, the last heading before the timetable", () => {
    expect(findTitle()?.textContent).toBe("Zaman Çizelgesi");
  });

  it("puts one labelled button inside the title row", () => {
    ensurePopupButton();
    ensurePopupButton();

    expect(document.querySelectorAll(`.${POPUP_BUTTON_CLASS}`)).toHaveLength(1);
    expect(button()?.parentElement).toBe(findTitle());
    expect(findTitle()?.hasAttribute(TITLE_ROW_ATTRIBUTE)).toBe(true);
    expect(button()?.getAttribute("aria-label")).toBe("EMU LabMarker'ı aç");
    // The title text itself is unchanged.
    expect(findTitle()?.textContent).toBe("Zaman Çizelgesi");
  });

  it("adds nothing on a page without the timetable", () => {
    document.body.innerHTML = "<h2>Ana Sayfa</h2>";
    ensurePopupButton();
    expect(button()).toBeNull();
  });

  it("asks the extension to open its window", async () => {
    ensurePopupButton();
    button()!.click();

    await vi.waitFor(() => expect(sent).toEqual([OPEN_POPUP_MESSAGE]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hint()).toBeNull();
  });

  it("points to Safari's menu when the window cannot be opened", async () => {
    answer = async () => false;
    ensurePopupButton();
    button()!.click();

    await vi.waitFor(() => expect(hint()?.textContent).toContain("sayfa menüsünden"));
  });

  it("points to Safari's menu when the message fails", async () => {
    answer = async () => {
      throw new Error("no receiver");
    };
    ensurePopupButton();
    button()!.click();

    await vi.waitFor(() => expect(hint()).not.toBeNull());
  });
});
