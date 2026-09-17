import { describe, expect, it, vi } from "vitest";

import {
  getLabMarkEnabled,
  LABMARK_ENABLED_KEY,
  setLabMarkEnabled,
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
