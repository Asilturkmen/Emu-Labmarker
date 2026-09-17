import { describe, expect, it, vi } from "vitest";

import {
  addCustomLabRoom,
  getLabMarkEnabled,
  getCustomLabRooms,
  LABMARK_ENABLED_KEY,
  parseCustomLabRooms,
  removeCustomLabRoom,
  setLabMarkEnabled,
  CUSTOM_ROOMS_KEY,
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

    expect(await getLabMarkEnabled()).toBe(true);
  });

  it("reads a stored value", async () => {
    stubStorage({ [LABMARK_ENABLED_KEY]: false });
    expect(await getLabMarkEnabled()).toBe(false);

    stubStorage({ [LABMARK_ENABLED_KEY]: true });
    expect(await getLabMarkEnabled()).toBe(true);
  });

  it("persists both states", async () => {
    const data = stubStorage();

    await setLabMarkEnabled(false);
    expect(data[LABMARK_ENABLED_KEY]).toBe(false);
    expect(await getLabMarkEnabled()).toBe(false);

    await setLabMarkEnabled(true);
    expect(data[LABMARK_ENABLED_KEY]).toBe(true);
    expect(await getLabMarkEnabled()).toBe(true);
  });
});

describe("custom lab rooms", () => {
  it("start out empty", async () => {
    stubStorage();

    expect(await getCustomLabRooms()).toEqual([]);
  });

  it("are stored normalized, in the order they were added", async () => {
    const data = stubStorage();

    expect(await addCustomLabRoom("cmpe 025")).toMatchObject({
      status: "added",
      room: "CMPE025",
    });
    await addCustomLabRoom("CMSE456/CL 116");

    expect(await getCustomLabRooms()).toEqual(["CMPE025", "CL116"]);
    expect(data[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025", "CL116"]);
  });

  it("are not written when the room is rejected", async () => {
    const data = stubStorage();
    await addCustomLabRoom("CMPE025");

    expect((await addCustomLabRoom("CMPE025")).status).toBe("duplicate");
    expect((await addCustomLabRoom("CMPE134")).status).toBe("verified");
    expect((await addCustomLabRoom("??")).status).toBe("invalid");
    expect(data[CUSTOM_ROOMS_KEY]).toEqual(["CMPE025"]);
  });

  it("can be removed", async () => {
    stubStorage();
    await addCustomLabRoom("CMPE025");
    await addCustomLabRoom("CL116");

    expect(await removeCustomLabRoom("cmpe 025")).toEqual(["CL116"]);
    expect(await getCustomLabRooms()).toEqual(["CL116"]);
  });

  // Extension storage can be edited outside the popup.
  it("tolerate anything unusable in storage", () => {
    expect(parseCustomLabRooms(undefined)).toEqual([]);
    expect(parseCustomLabRooms("CMPE025")).toEqual([]);
    expect(parseCustomLabRooms({ room: "CMPE025" })).toEqual([]);
    expect(
      parseCustomLabRooms(["CMPE025", 7, null, "??", "cmpe 025", "CL116"]),
    ).toEqual(["CMPE025", "CL116"]);
  });

  // Lists saved by the build that called this feature "geçici lab".
  it("still find a list saved under the previous key", async () => {
    stubStorage({ emuLabmarkTemporaryRooms: ["CMPE025"] });

    expect(await getCustomLabRooms()).toEqual(["CMPE025"]);
  });

  it("prefer the current key once it holds a list", async () => {
    stubStorage({
      emuLabmarkTemporaryRooms: ["CMPE025"],
      [CUSTOM_ROOMS_KEY]: ["CL116"],
    });

    expect(await getCustomLabRooms()).toEqual(["CL116"]);
  });
});
