import { describe, expect, it, vi } from "vitest";

import {
  addTemporaryLabRoom,
  getLabMarkEnabled,
  getTemporaryLabRooms,
  LABMARK_ENABLED_KEY,
  parseTemporaryLabRooms,
  removeTemporaryLabRoom,
  setLabMarkEnabled,
  TEMPORARY_ROOMS_KEY,
} from "../src/settings";

function stubStorage(stored: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...stored };

  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (key: string) =>
          key in data ? { [key]: data[key] } : {},
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

describe("temporary lab rooms", () => {
  it("start out empty", async () => {
    stubStorage();

    expect(await getTemporaryLabRooms()).toEqual([]);
  });

  it("are stored normalized, in the order they were added", async () => {
    const data = stubStorage();

    expect(await addTemporaryLabRoom("cmpe 025")).toMatchObject({
      status: "added",
      room: "CMPE025",
    });
    await addTemporaryLabRoom("CMSE456/CL 116");

    expect(await getTemporaryLabRooms()).toEqual(["CMPE025", "CL116"]);
    expect(data[TEMPORARY_ROOMS_KEY]).toEqual(["CMPE025", "CL116"]);
  });

  it("are not written when the room is rejected", async () => {
    const data = stubStorage();
    await addTemporaryLabRoom("CMPE025");

    expect((await addTemporaryLabRoom("CMPE025")).status).toBe("duplicate");
    expect((await addTemporaryLabRoom("CMPE134")).status).toBe("verified");
    expect((await addTemporaryLabRoom("??")).status).toBe("invalid");
    expect(data[TEMPORARY_ROOMS_KEY]).toEqual(["CMPE025"]);
  });

  it("can be removed", async () => {
    stubStorage();
    await addTemporaryLabRoom("CMPE025");
    await addTemporaryLabRoom("CL116");

    expect(await removeTemporaryLabRoom("cmpe 025")).toEqual(["CL116"]);
    expect(await getTemporaryLabRooms()).toEqual(["CL116"]);
  });

  // Extension storage can be edited outside the popup.
  it("tolerate anything unusable in storage", () => {
    expect(parseTemporaryLabRooms(undefined)).toEqual([]);
    expect(parseTemporaryLabRooms("CMPE025")).toEqual([]);
    expect(parseTemporaryLabRooms({ room: "CMPE025" })).toEqual([]);
    expect(
      parseTemporaryLabRooms(["CMPE025", 7, null, "??", "cmpe 025", "CL116"]),
    ).toEqual(["CMPE025", "CL116"]);
  });
});
