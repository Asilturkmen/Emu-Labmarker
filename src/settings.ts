import {
  addRuleToList,
  parseCustomLabRules,
  removeRuleFromList,
  serializeCustomLabRules,
  type AddRuleRequest,
  type AddRuleResult,
  type CustomLabRule,
} from "./data/customRules";

export const LABMARKER_ENABLED_KEY = "emuLabmarkerEnabled";
export const CUSTOM_ROOMS_KEY = "emuLabmarkerCustomRooms";

export async function getLabMarkerEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(LABMARKER_ENABLED_KEY);
  return stored[LABMARKER_ENABLED_KEY] !== false;
}

export async function setLabMarkerEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [LABMARKER_ENABLED_KEY]: enabled });
}

/** The user's own laboratory rules, in the order they were added. */
export async function getCustomLabRules(): Promise<CustomLabRule[]> {
  const stored = await browser.storage.local.get(CUSTOM_ROOMS_KEY);
  return parseCustomLabRules(stored[CUSTOM_ROOMS_KEY]);
}

async function setCustomLabRules(rules: ReadonlyArray<CustomLabRule>): Promise<void> {
  await browser.storage.local.set({
    [CUSTOM_ROOMS_KEY]: serializeCustomLabRules(rules),
  });
}

export async function addCustomLabRule(request: AddRuleRequest): Promise<AddRuleResult> {
  const result = addRuleToList(await getCustomLabRules(), request);
  if (result.status === "added") await setCustomLabRules(result.rules);
  return result;
}

/** Removes every rule whose key is listed; unknown keys are ignored. */
export async function removeCustomLabRules(
  keys: ReadonlyArray<string>,
): Promise<CustomLabRule[]> {
  let rules = await getCustomLabRules();
  for (const key of keys) rules = removeRuleFromList(rules, key);
  await setCustomLabRules(rules);
  return rules;
}
