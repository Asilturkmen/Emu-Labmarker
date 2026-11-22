import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyTimetableColors,
  contrast,
  COLOR_PRESETS,
  DEFAULT_COLORS,
  NAVY,
  parseColorSettings,
  presetColor,
  timetableTones,
  timetableVariable,
  tones,
} from "../src/colors";

describe("colour presets", () => {
  it("are the eight colours the popup offers", () => {
    expect(COLOR_PRESETS.map((preset) => preset.hex)).toEqual([
      "#f12e4b",
      "#f08c14",
      "#f5b800",
      "#22a55b",
      "#1269b5",
      "#8b5cf6",
      "#e83e8c",
      "#0fa3b1",
    ]);
    expect(DEFAULT_COLORS).toEqual({
      verified: "#f12e4b",
      custom: "#f08c14",
      tutorial: "#8b5cf6",
    });
  });

  it("accepts a preset in any case and nothing else", () => {
    expect(presetColor("#F12E4B")).toBe("#f12e4b");
    expect(presetColor(" #22a55b ")).toBe("#22a55b");
    expect(presetColor("#123456")).toBeNull();
    expect(presetColor("red")).toBeNull();
    expect(presetColor("#f12e4b; background: url(x)")).toBeNull();
    expect(presetColor(undefined)).toBeNull();
    expect(presetColor(5)).toBeNull();
  });
});

describe("parseColorSettings", () => {
  it("uses the defaults for missing or invalid storage", () => {
    for (const stored of [undefined, null, "x", 7, [], {}, { custom: 3 }]) {
      expect(parseColorSettings(stored)).toEqual(DEFAULT_COLORS);
    }
  });

  it("keeps valid kinds and replaces invalid ones one by one", () => {
    expect(
      parseColorSettings({ verified: "#0FA3B1", custom: "#abcdef", tutorial: "#e83e8c", extra: 1 }),
    ).toEqual({ verified: "#0fa3b1", custom: "#f08c14", tutorial: "#e83e8c" });
  });
});

describe("tone derivation", () => {
  it("keeps the chosen colour as the base", () => {
    expect(tones("#f12e4b").base).toBe("#F12E4B");
  });

  it("gives white text at least 3:1 on every preset, or switches to navy", () => {
    for (const { hex } of COLOR_PRESETS) {
      const t = tones(hex);
      expect(contrast(t.fill, t.on)).toBeGreaterThanOrEqual(3);
      expect(["#FFFFFF", NAVY]).toContain(t.on);
    }
  });

  it("darkens orange a little for white text and uses navy on yellow", () => {
    const orange = tones("#f08c14");
    expect(orange.on).toBe("#FFFFFF");
    expect(orange.fill).not.toBe(orange.base);

    const yellow = tones("#f5b800");
    expect(yellow.on).toBe(NAVY);
    expect(yellow.fill).toBe(yellow.base);

    // A colour that is dark enough stays as it is.
    expect(tones("#1269b5")).toMatchObject({ fill: "#1269B5", on: "#FFFFFF" });
  });

  it("makes group titles legible on their tint", () => {
    for (const { hex } of COLOR_PRESETS) {
      const t = tones(hex);
      expect(contrast(t.chipInk, t.chipBg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("mixes the tints from the chosen colour and white", () => {
    // 20% (cell) and 14% (record box) of #f12e4b, the rest white.
    expect(tones("#f12e4b").cellBg).toBe("#FCD5DB");
    expect(tones("#f12e4b").chipBg).toBe("#FDE2E6");
  });
});

describe("timetable tones", () => {
  it("keep the original colours while a kind has its default colour", () => {
    expect(timetableTones("verified", "#f12e4b")).toEqual({
      border: "#f12e4b",
      bg: "#ffd3d7",
      badge: "#f12e4b",
      badgeInk: "#ffffff",
    });
    expect(timetableTones("custom", "#F08C14")).toMatchObject({ bg: "#fef2d6", badge: "#f08c14" });
    expect(timetableTones("tutorial", "#8b5cf6")).toMatchObject({ bg: "#efe7ff", badge: "#7c3aed" });
  });

  it("derive from the chosen colour otherwise", () => {
    const t = timetableTones("custom", "#22a55b");
    const derived = tones("#22a55b");
    expect(t).toEqual({
      border: derived.base,
      bg: derived.cellBg,
      badge: derived.fill,
      badgeInk: derived.on,
    });
    // The same colour is not the default of another kind.
    expect(timetableTones("verified", "#f08c14").bg).not.toBe("#fef2d6");
  });

  it("are written as custom properties of the element", () => {
    const element = document.createElement("div");

    applyTimetableColors(element, { ...DEFAULT_COLORS, custom: "#22a55b" });

    expect(element.style.getPropertyValue("--emu-lm-verified-bg")).toBe("#ffd3d7");
    expect(element.style.getPropertyValue("--emu-lm-custom-border")).toBe("#22A55B");
    expect(element.style.getPropertyValue(timetableVariable("custom", "badgeInk"))).toBe("#FFFFFF");
    expect(element.style.getPropertyValue("--emu-lm-tutorial-badge")).toBe("#7c3aed");
  });
});

describe("timetable stylesheet", () => {
  it("uses only variables that applyTimetableColors writes", () => {
    const css = readFileSync(resolve(process.cwd(), "src/highlighter/highlight.css"), "utf8");
    const used = new Set(css.match(/--emu-lm-[a-z-]+/g));
    const element = document.createElement("div");
    applyTimetableColors(element, DEFAULT_COLORS);
    const written = new Set(
      [...Array(element.style.length).keys()].map((i) => element.style.item(i)),
    );

    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((name) => !written.has(name))).toEqual([]);
    // Every written variable is used too, so nothing is set for nothing.
    expect([...written].filter((name) => !used.has(name))).toEqual([]);
  });
});
