import { describe, expect, it, vi } from "vitest";

import {
  addCustomLabRule,
  getLabMarkerEnabled,
  getCustomLabRules,
  LABMARKER_ENABLED_KEY,
  removeCustomLabRules,
  setLabMarkerEnabled,
  CUSTOM_ROOMS_KEY,
  COLORS_KEY,
  getColorSettings,
  setKindColor,
} from "../src/settings";

function stubStorage(stored: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...stored };

  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((key) => key in data)
              .map((key) => [key, data[key]]),
          ),
        set: async (items: Record<string, unknown>) => {
          Object.assign(data, items);
        },
      },
    },
  });

  return data;
}

describe("lab mark setting", () => {
  it("is enabled until it has been turned off", async () => {
    stubStorage();

    expect(await getLabMarkerEnabled()).toBe(true);
  });

  it("reads a stored value", async () => {
    stubStorage({ [LABMARKER_ENABLED_KEY]: false });
    expect(await getLabMarkerEnabled()).toBe(false);

    stubStorage({ [LABMARKER_ENABLED_KEY]: true });
    expect(await getLabMarkerEnabled()).toBe(true);
  });

  it("persists both states", async () => {
    const data = stubStorage();

    await setLabMarkerEnabled(false);
    expect(data[LABMARKER_ENABLED_KEY]).toBe(false);
    expect(await getLabMarkerEnabled()).toBe(false);

    await setLabMarkerEnabled(true);
    expect(data[LABMARKER_ENABLED_KEY]).toBe(true);
    expect(await getLabMarkerEnabled()).toBe(true);
  });
});

describe("custom lab rules", () => {
  it("start out empty", async () => {
    stubStorage();

    expect(await getCustomLabRules()).toEqual([]);
  });

  it("are stored normalized, in the order they were added", async () => {
    const data = stubStorage();

    expect(await addCustomLabRule({ room: "cmpe 025" })).toMatchObject({
      status: "added",
      rule: { room: "CMPE025" },
    });
    await addCustomLabRule({ room: "CMSE456/CL 116" });

    expect(await getCustomLabRules()).toEqual([{ room: "CMPE025" }, { room: "CL116" }]);
    // Plain strings, exactly as earlier versions stored rooms.
    expect(data[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025", "CL116"]);
  });

  it("store a single meeting next to the plain rooms", async () => {
    const data = stubStorage({ [CUSTOM_ROOMS_KEY]: ["CMPE025"] });

    await addCustomLabRule({ room: "CMPE030", day: "friday", start: "10:30", course: "CMPE224" });

    expect(data[CUSTOM_ROOMS_KEY]).toEqual([
      "CMPE025",
      { room: "CMPE030", day: "friday", start: "10:30", course: "CMPE224" },
    ]);
    expect(await getCustomLabRules()).toEqual([
      { room: "CMPE025" },
      { room: "CMPE030", day: "friday", startMinutes: 630, course: "CMPE224" },
    ]);
  });

  it("are not written when the rule is rejected", async () => {
    const data = stubStorage();
    await addCustomLabRule({ room: "CMPE025" });

    expect((await addCustomLabRule({ room: "CMPE025" })).status).toBe("duplicate");
    expect((await addCustomLabRule({ room: "CMPE134" })).status).toBe("verified");
    expect((await addCustomLabRule({ room: "??" })).status).toBe("invalid");
    expect((await addCustomLabRule({ room: "CMPE030", day: "friday" })).status).toBe("invalid-time");
    expect(data[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025"]);
  });

  it("can be removed by key", async () => {
    stubStorage();
    await addCustomLabRule({ room: "CMPE025" });
    await addCustomLabRule({ room: "CL116" });
    await addCustomLabRule({ room: "CMPE030", day: "friday", start: "10:30" });

    expect(await removeCustomLabRules(["CMPE025", "CMPE030|friday|10:30"])).toEqual([
      { room: "CL116" },
    ]);
    expect(await getCustomLabRules()).toEqual([{ room: "CL116" }]);
  });
});

describe("marking colours", () => {
  const DEFAULTS = { verified: "#f12e4b", custom: "#f08c14", tutorial: "#8b5cf6" };

  it("use the defaults until a colour is chosen", async () => {
    stubStorage();

    expect(COLORS_KEY).toBe("emuLabmarkerColors");
    expect(await getColorSettings()).toEqual(DEFAULTS);
  });

  it("persist one kind at a time and keep the others", async () => {
    const data = stubStorage();

    expect(await setKindColor("custom", "#22A55B")).toEqual({ ...DEFAULTS, custom: "#22a55b" });
    expect(data[COLORS_KEY]).toEqual({ ...DEFAULTS, custom: "#22a55b" });

    await setKindColor("tutorial", "#0fa3b1");
    expect(await getColorSettings()).toEqual({
      verified: "#f12e4b",
      custom: "#22a55b",
      tutorial: "#0fa3b1",
    });
  });

  it("refuse anything but the presets", async () => {
    const data = stubStorage();

    await expect(setKindColor("custom", "#123456")).rejects.toThrow();
    await expect(setKindColor("custom", "red")).rejects.toThrow();
    await expect(setKindColor("nothing" as "custom", "#22a55b")).rejects.toThrow();
    expect(data[COLORS_KEY]).toBeUndefined();
  });

  it("fall back to the defaults for corrupt storage, kind by kind", async () => {
    stubStorage({ [COLORS_KEY]: { verified: "#22a55b", custom: "#123456", tutorial: 3 } });
    expect(await getColorSettings()).toEqual({ ...DEFAULTS, verified: "#22a55b" });

    stubStorage({ [COLORS_KEY]: "nonsense" });
    expect(await getColorSettings()).toEqual(DEFAULTS);
  });
});
