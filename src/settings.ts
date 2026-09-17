export const LABMARK_ENABLED_KEY = "emuLabmarkEnabled";

export async function getLabMarkEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(LABMARK_ENABLED_KEY);
  return stored[LABMARK_ENABLED_KEY] !== false;
}

export async function setLabMarkEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [LABMARK_ENABLED_KEY]: enabled });
}
