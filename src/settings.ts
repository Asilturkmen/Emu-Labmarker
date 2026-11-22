import {
  COLOR_KINDS,
  parseColorSettings,
  presetColor,
  type ColorKind,
  type ColorSettings,
} from "./colors";
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
export const COLORS_KEY = "emuLabmarkerColors";
export const TABLE_VIEW_KEY = "emuLabmarkerTableView";

export async function getLabMarkerEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(LABMARKER_ENABLED_KEY);
  return stored[LABMARKER_ENABLED_KEY] !== false;
}

export async function setLabMarkerEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [LABMARKER_ENABLED_KEY]: enabled });
}

/** Whether narrow screens show the week as the portal's desktop table. Off by default. */
export async function getTableView(): Promise<boolean> {
  const stored = await browser.storage.local.get(TABLE_VIEW_KEY);
  return stored[TABLE_VIEW_KEY] === true;
}

export async function setTableView(on: boolean): Promise<void> {
  await browser.storage.local.set({ [TABLE_VIEW_KEY]: on });
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

/** The chosen marking colours; invalid or missing values use the defaults. */
export async function getColorSettings(): Promise<ColorSettings> {
  const stored = await browser.storage.local.get(COLORS_KEY);
  return parseColorSettings(stored[COLORS_KEY]);
}

/** Saves the colour of one kind and returns all colours as stored. */
export async function setKindColor(kind: ColorKind, hex: string): Promise<ColorSettings> {
  const chosen = presetColor(hex);
  if (!(COLOR_KINDS as ReadonlyArray<string>).includes(kind) || chosen === null) {
    throw new Error(`Invalid colour choice: ${kind} ${hex}`);
  }
  const colors = { ...(await getColorSettings()), [kind]: chosen };
  await browser.storage.local.set({ [COLORS_KEY]: colors });
  return colors;
}
