import {
  COLOR_KINDS,
  COLOR_PRESETS,
  DEFAULT_COLORS,
  timetableTones,
  tones,
  type ColorKind,
  type ColorSettings,
} from "../../src/colors";
import { matchCourseRoom, normalizeRoom } from "../../src/data/courseRoom";
import {
  formatMinutes,
  isTimedRule,
  isWeekday,
  ruleKey,
  ruleKind,
  ruleLabel,
  weekdayShortLabel,
  WEEKDAYS,
  type AddRuleResult,
  type AddRuleStatus,
  type CustomLabRule,
  type RuleKind,
  type Weekday,
} from "../../src/data/customRules";
import { isValidRoomCode } from "../../src/data/labRooms";
import {
  addCustomLabRule,
  getColorSettings,
  getCustomLabRules,
  getLabMarkerEnabled,
  removeCustomLabRules,
  setKindColor,
  setLabMarkerEnabled,
} from "../../src/settings";
import {
  LIST_SESSIONS_MESSAGE,
  parseSessions,
  suggestRoom,
  type TimetableSession,
} from "../../src/timetableSessions";
import {
  closeAllDropdowns,
  createDropdown,
  placeFloating,
  type DropdownOption,
} from "./dropdown";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup control could not be loaded: ${selector}`);
  return element;
}

const views = requireElement<HTMLElement>("#views");
const viewMain = requireElement<HTMLElement>("#view-main");
const viewColors = requireElement<HTMLElement>("#view-colors");

// The logo opens the Chrome Web Store page; Safari users have no use for it.
if (import.meta.env.BROWSER === "safari") {
  const brandLink = requireElement<HTMLAnchorElement>(".brand-link");
  brandLink.href = "https://asilturkmen.com";
  brandLink.title = "asilturkmen.com";
  brandLink.querySelector("img")!.alt = "asilturkmen.com'u aç";
}
const toggle = requireElement<HTMLInputElement>("#enabled-toggle");
const statusText = requireElement<HTMLElement>("#status-text");
const roomForm = requireElement<HTMLFormElement>("#room-form");
const kindSwitch = requireElement<HTMLElement>("#kind-switch");
const roomInput = requireElement<HTMLInputElement>("#room-input");
const roomStatus = requireElement<HTMLElement>("#room-status");
const roomStatusText = requireElement<HTMLElement>("#room-status > span");
const roomList = requireElement<HTMLElement>("#room-list");
const formHint = requireElement<HTMLElement>("#form-hint");
const formHintText = requireElement<HTMLElement>("#form-hint > span");
const roomGhost = requireElement<HTMLElement>("#room-ghost");
const colorsCard = requireElement<HTMLElement>("#colors");
const openColors = requireElement<HTMLButtonElement>("#open-colors");
const closeColors = requireElement<HTMLButtonElement>("#close-colors");
const preview = requireElement<HTMLElement>(".preview");
const colorStatus = requireElement<HTMLElement>("#color-status");
const pop = requireElement<HTMLElement>("#rule-pop");
const popRows = requireElement<HTMLElement>("#rule-pop > ul");

let rules: CustomLabRule[] = [];
/**
 * Meetings from the active timetable, or null when unavailable.
 * These populate the day and time options for the entered room.
 */
let sessions: TimetableSession[] | null = null;
/** The timetable room the typed text completes to, shown greyed out. */
let suggestion: string | null = null;
let colors: ColorSettings = { ...DEFAULT_COLORS };
/** Groups start collapsed; adding a record opens its group. */
const openGroups: Record<RuleKind, boolean> = { lab: false, tutorial: false };
let currentView: "main" | "colors" = "main";

const WEEKDAY_NAMES: Record<Weekday, string> = {
  monday: "Pazartesi",
  tuesday: "Salı",
  wednesday: "Çarşamba",
  thursday: "Perşembe",
  friday: "Cuma",
  saturday: "Cumartesi",
  sunday: "Pazar",
};

function render(enabled: boolean): void {
  toggle.checked = enabled;
  statusText.textContent = enabled ? "Açık" : "Kapalı";
  document.body.dataset.enabled = String(enabled);
}

/** A storage failure stays until the next result; typing does not clear it. */
let stickyStatus = false;

function setRoomStatus(
  message: string,
  tone: "info" | "error" | "" = "info",
  icon: "ok" | "" = "",
  sticky = false,
): void {
  stickyStatus = sticky;
  roomStatusText.textContent = message;
  roomStatus.dataset.tone = tone;
  roomStatus.dataset.icon = icon || (tone === "error" ? "error" : "");
  fitRecords();
}

function setFormHint(message: string | null): void {
  formHintText.textContent = message ?? "";
  formHint.hidden = message === null;
  fitRecords();
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Writes the popup tones of every kind, and the timetable preview, from `colors`. */
function applyTones(): void {
  const root = document.documentElement.style;
  for (const kind of COLOR_KINDS) {
    const t = tones(colors[kind]);
    root.setProperty(`--${kind}`, t.base);
    root.setProperty(`--${kind}-fill`, t.fill);
    root.setProperty(`--${kind}-on`, t.on);
    root.setProperty(`--${kind}-bg`, t.chipBg);
    root.setProperty(`--${kind}-hover`, t.chipHover);
    root.setProperty(`--${kind}-ink`, t.chipInk);

    const cell = requireElement<HTMLElement>(`.pcell[data-kind="${kind}"]`);
    const cellTones = timetableTones(kind, colors[kind]);
    cell.style.setProperty("--c", cellTones.border);
    cell.style.setProperty("--cb", cellTones.bg);
    cell.style.setProperty("--f", cellTones.badge);
    cell.style.setProperty("--o", cellTones.badgeInk);
  }
}

const COLOR_NAMES: Record<ColorKind, string> = {
  verified: "Kayıtlı lab",
  custom: "Özel",
  tutorial: "Tutorial",
};

const colorRows = {} as Record<ColorKind, { reset: HTMLButtonElement; swatches: HTMLElement }>;

function buildColorRows(): void {
  const template = requireElement<HTMLTemplateElement>("#color-row");
  for (const kind of COLOR_KINDS) {
    const name = COLOR_NAMES[kind];
    const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset.kind = kind;
    row.querySelector<HTMLElement>(".color-name")!.textContent = name;
    const reset = row.querySelector<HTMLButtonElement>(".reset")!;
    reset.setAttribute("aria-label", `${name}: varsayılana dön`);
    const swatches = row.querySelector<HTMLElement>(".swatches")!;
    swatches.querySelector("legend")!.textContent = `${name} rengi`;
    for (const preset of COLOR_PRESETS) {
      const swatch = document.createElement("label");
      swatch.className = "swatch";
      swatch.title = preset.name;
      swatch.style.setProperty("--c", preset.hex);
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `color-${kind}`;
      input.value = preset.hex;
      input.setAttribute("aria-label", preset.name);
      swatch.append(input, document.createElement("span"));
      swatches.append(swatch);
    }
    colorsCard.append(row);
    colorRows[kind] = { reset, swatches };

    reset.addEventListener("click", () => {
      chooseColor(kind, DEFAULT_COLORS[kind]);
      swatches.querySelector<HTMLInputElement>("input:checked")?.focus();
    });
    swatches.addEventListener("change", (event) => {
      chooseColor(kind, (event.target as HTMLInputElement).value);
    });
  }
}

function renderColors(): void {
  for (const kind of COLOR_KINDS) {
    const row = colorRows[kind];
    row.reset.hidden = colors[kind] === DEFAULT_COLORS[kind];
    for (const input of row.swatches.querySelectorAll<HTMLInputElement>("input")) {
      input.checked = input.value === colors[kind];
    }
  }
}

/** The Colours view has its own message line; the main view's is out of sight there. */
function setColorStatus(message: string): void {
  colorStatus.textContent = message;
  if (message) colorStatus.dataset.tone = "error";
  else delete colorStatus.dataset.tone;
}

function chooseColor(kind: ColorKind, hex: string): void {
  // Show the choice at once; storage confirms or the previous colours return.
  setColorStatus("");
  colors = { ...colors, [kind]: hex };
  applyTones();
  renderColors();
  void serialize(async () => {
    try {
      colors = await setKindColor(kind, hex);
    } catch {
      setColorStatus("Kaydedilemedi. Tekrar dene.");
      colors = await getColorSettings().catch(() => colors);
    }
    applyTones();
    renderColors();
  });
}

// ---------------------------------------------------------------------------
// Serialized storage access
// ---------------------------------------------------------------------------

// Serialize read-modify-write operations to prevent concurrent changes from
// overwriting each other.
let pending: Promise<void> = Promise.resolve();

function serialize(task: () => Promise<void>): Promise<void> {
  const run = pending.then(task);
  pending = run.catch(() => {});
  return run;
}

async function initialize(): Promise<void> {
  try {
    render(await getLabMarkerEnabled());
    toggle.disabled = false;
    rules = await getCustomLabRules();
    renderRules();
  } catch {
    // Replace the loading status with an error when storage cannot be read.
    // The header has room for a word only; the sentence goes to the message line.
    statusText.textContent = "Hata";
    setRoomStatus("Ayarlar okunamadı. Tarayıcıyı yeniden başlatmayı dene.", "error", "", true);
  }
  try {
    colors = await getColorSettings();
  } catch {
    // The defaults stay in place.
  }
  applyTones();
  renderColors();
  await refreshAccess();
}

// ---------------------------------------------------------------------------
// Site access. Safari asks the user for each site, even for hosts listed in
// the manifest; Chrome grants them at install, so the card never shows there.
// ---------------------------------------------------------------------------

const PORTAL_ORIGINS = ["https://student.emu.edu.tr/*", "https://students.emu.edu.tr/*"];
const accessCard = requireElement<HTMLElement>("#access");
const accessButton = requireElement<HTMLButtonElement>("#access-btn");

async function refreshAccess(): Promise<void> {
  let granted = true;
  try {
    granted = await browser.permissions.contains({ origins: PORTAL_ORIGINS });
  } catch {
    // A browser without the permissions API has nothing to ask for.
  }
  accessCard.hidden = granted;
  fitRecords();
}

accessButton.addEventListener("click", () => {
  // Called straight from the tap: Safari only shows its prompt for a user gesture.
  void browser.permissions
    .request({ origins: PORTAL_ORIGINS })
    .then(async (granted) => {
      await refreshAccess();
      if (!granted) return;
      // The open portal page has no script yet; reload it so the marks appear.
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined && /^https:\/\/students?\.emu\.edu\.tr\//.test(tab.url ?? "")) {
        await browser.tabs.reload(tab.id);
      }
    })
    .catch(() => {});
});

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  const enabled = toggle.checked;
  render(enabled);
  try {
    await setLabMarkerEnabled(enabled);
  } catch {
    // Restore the previous toggle state if saving fails.
    render(!enabled);
    setRoomStatus("Tercih kaydedilemedi.", "error", "", true);
  } finally {
    toggle.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Kind switch, day and time
// ---------------------------------------------------------------------------

roomForm.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name === "kind") kindSwitch.dataset.value = target.value;
});

const dayMenu = createDropdown("day", viewMain, renderTimeOptions, beforeFloatingOpens);
const timeMenu = createDropdown("time", viewMain, () => {}, beforeFloatingOpens);

/** Only one floating list is open at a time. */
function beforeFloatingOpens(): void {
  closeAllDropdowns();
  closePop(false);
}

/** The room as it will be stored, also when a whole entry was pasted. */
function typedRoom(): string {
  return matchCourseRoom(roomInput.value)?.room ?? normalizeRoom(roomInput.value);
}

function typedRoomSessions(): TimetableSession[] {
  const room = typedRoom();
  return sessions?.filter((session) => session.room === room) ?? [];
}

/** Meetings of the typed room on the chosen day, one per start time. */
function chosenDaySessions(): Map<string, TimetableSession> {
  const day = dayMenu.value;
  const byStart = new Map<string, TimetableSession>();
  if (!isWeekday(day)) return byStart;
  for (const session of typedRoomSessions()) {
    const start = formatMinutes(session.startMinutes);
    if (session.day === day && !byStart.has(start)) byStart.set(start, session);
  }
  return byStart;
}

function renderTimeOptions(): void {
  const previous = timeMenu.value;
  const byStart = chosenDaySessions();
  const options: DropdownOption[] = [...byStart].map(([start, session]) => {
    const range = `${start}–${formatMinutes(session.endMinutes)}`;
    return { value: start, short: range, text: `${range} · ${session.courseCode}` };
  });

  // Select the time automatically when there is only one meeting.
  timeMenu.set(
    options.length === 1 ? options : [{ value: "", text: "Saat" }, ...options],
    byStart.has(previous) ? previous : options.length === 1 ? options[0]!.value : "",
  );
  timeMenu.setDisabled(options.length === 0);
}

function renderSuggestion(): void {
  suggestion = sessions ? suggestRoom(roomInput.value, sessions) : null;
  roomGhost.replaceChildren();
  if (!suggestion) return;

  const typed = document.createElement("span");
  typed.className = "ghost-typed";
  typed.textContent = roomInput.value;
  const rest = document.createElement("span");
  rest.className = "ghost-rest";
  rest.textContent = suggestion.slice(normalizeRoom(roomInput.value).length);
  roomGhost.append(typed, rest);
}

/** Offers only the days the typed room is used, then their times. */
function renderDayOptions(): void {
  const previous = dayMenu.value;
  const roomSessions = typedRoomSessions();
  const days = WEEKDAYS.filter((day) => roomSessions.some((session) => session.day === day));

  dayMenu.set(
    [
      { value: "", text: "Her zaman" },
      ...days.map((day) => ({ value: day, text: WEEKDAY_NAMES[day] })),
    ],
    (days as string[]).includes(previous) ? previous : "",
  );
  dayMenu.setDisabled(days.length === 0);
  renderTimeOptions();
  renderSuggestion();

  const room = typedRoom();
  if (sessions === null && timetableNeedsReload) {
    setFormHint("Ders programı sayfasını yenile, sonra bu pencereyi yeniden aç.");
  } else if (sessions === null) {
    setFormHint("Tek dersi eklemek için bu pencereyi ders programı sayfasında aç.");
  } else if (!days.length && isValidRoomCode(room) && !suggestion) {
    // While a suggestion shows, "not in your timetable" would contradict it.
    setFormHint(`${room} programında yok, yalnızca "Her zaman" olarak eklenebilir.`);
  } else {
    setFormHint(null);
  }
}

roomInput.addEventListener("input", () => {
  // An old result message goes away when typing starts; its space stays.
  if (roomStatus.dataset.tone && !stickyStatus) setRoomStatus("", "");
  renderDayOptions();
});

// Accept a suggestion with Tab, or ArrowRight at the end of the input.
// Otherwise, preserve normal keyboard navigation.
roomInput.addEventListener("keydown", (event) => {
  if (!suggestion || event.altKey || event.ctrlKey || event.metaKey) return;
  const end = roomInput.value.length;
  const atEnd = roomInput.selectionStart === end && roomInput.selectionEnd === end;
  const accept =
    (event.key === "Tab" && !event.shiftKey) || (event.key === "ArrowRight" && atEnd);
  if (!accept) return;

  event.preventDefault();
  roomInput.value = suggestion;
  renderDayOptions();
});

const TIMETABLE_URL = /^https:\/\/students?\.emu\.edu\.tr\/academic\/timetable/i;

/**
 * True when the active tab is the timetable but its script did not answer.
 * That happens when the page was open while the extension was installed or
 * updated: the old script is cut off until the page is reloaded.
 */
let timetableNeedsReload = false;

async function loadSessions(): Promise<TimetableSession[] | null> {
  timetableNeedsReload = false;
  let onTimetable = false;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return null;
    onTimetable = TIMETABLE_URL.test(tab.url ?? "");
    return parseSessions(
      await browser.tabs.sendMessage(tab.id, LIST_SESSIONS_MESSAGE),
    );
  } catch {
    // Any other tab has no timetable script to answer.
    // While the access card shows, the script is missing for want of permission.
    timetableNeedsReload = onTimetable && accessCard.hidden === true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Adding
// ---------------------------------------------------------------------------

const ADD_MESSAGES: Record<AddRuleStatus, (rule: CustomLabRule) => string> = {
  added: (rule) => `${ruleLabel(rule)} eklendi.`,
  duplicate: (rule) => `${ruleLabel(rule)} listede zaten var.`,
  verified: (rule) => `${rule.room} kayıtlı lab sınıfları arasında.`,
  covered: (rule) => `${rule.room} için tüm ders saatlerini kapsayan bir kayıt var.`,
  invalid: () => "Geçerli bir sınıf kodu yaz (örnek: CMPE025).",
  "invalid-time": () => "Dersin başladığı saati seç.",
  limit: () => "Daha fazla sınıf eklenemiyor, önce birini çıkar.",
};

function reportAdd({ status, rule, rules: current, absorbed }: AddRuleResult): void {
  // A duplicate may be the same meeting stored as the other kind, and the
  // message should name the entry that is actually in the list.
  const shown =
    status === "duplicate"
      ? current.find((existing) => ruleKey(existing) === ruleKey(rule)) ?? rule
      : rule;
  let message = ADD_MESSAGES[status](shown);
  if (absorbed) message += " Bu kaydın kapsadığı gün ve saat kayıtları birleştirildi.";
  setRoomStatus(message, status === "added" ? "info" : "error", status === "added" ? "ok" : "");
}

roomForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = roomInput.value.trim();
  if (!input) return;
  // Read now: by the time a queued change runs, the form may already hold
  // the next entry.
  const day = dayMenu.value;
  const start = timeMenu.value;
  const course = chosenDaySessions().get(start)?.courseCode;
  const kind: RuleKind =
    roomForm.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value === "tutorial"
      ? "tutorial"
      : "lab";

  void serialize(async () => {
    let focusTarget: HTMLElement = roomInput;
    try {
      const before = rules;
      const result = await addCustomLabRule({
        room: input,
        kind,
        ...(isWeekday(day) ? { day, start, course } : {}),
      });
      rules = result.rules;
      let fx: { key: string; bump: boolean } | null = null;
      if (result.status === "added") {
        roomInput.value = "";
        renderDayOptions();
        const addedKind = ruleKind(result.rule);
        openGroups[addedKind] = true;
        // A new room appears with an opening animation; a room that gained
        // another rule gets a short highlight.
        fx = {
          key: boxKey(addedKind, result.rule.room),
          bump: before.some(
            (existing) => existing.room === result.rule.room && ruleKind(existing) === addedKind,
          ),
        };
      } else if (result.status === "invalid-time") {
        focusTarget = timeMenu.button;
      }
      renderRules(fx);
      reportAdd(result);
      if (result.status === "added") revealNewBox();
    } catch {
      setRoomStatus("Kaydedilemedi. Tekrar dene.", "error", "", true);
    }
    focusTarget.focus();
  });
});

/** Scrolls the records card so that the box just added is visible. */
function revealNewBox(): void {
  const added = roomList.querySelector<HTMLElement>(".is-new, .is-bump");
  if (added) {
    const list = roomList.getBoundingClientRect();
    const box = added.getBoundingClientRect();
    if (box.bottom > list.bottom || box.top < list.top) {
      roomList.scrollTop += box.bottom - list.bottom + 8;
    }
  }
  updateScrollCue();
}

// ---------------------------------------------------------------------------
// Records: one card, grouped by kind
// ---------------------------------------------------------------------------

const X_ICON =
  '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="m1 1 6 6M7 1 1 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const CHEVRON =
  '<svg class="kchev" viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const KIND_NAMES: Record<RuleKind, string> = { lab: "Özel", tutorial: "Tutorial" };
const KIND_ORDER: RuleKind[] = ["lab", "tutorial"];

const whenShort = (rule: CustomLabRule): string =>
  isTimedRule(rule)
    ? `${weekdayShortLabel(rule.day)} ${formatMinutes(rule.startMinutes)}`
    : "Her gün";
const whenLong = (rule: CustomLabRule): string =>
  isTimedRule(rule) ? whenShort(rule) : "her gün, her saat";
const boxKey = (kind: RuleKind, room: string): string => `${kind}|${room}`;

function sortRules(list: CustomLabRule[]): CustomLabRule[] {
  const at = (rule: CustomLabRule): number =>
    isTimedRule(rule) ? WEEKDAYS.indexOf(rule.day) * 1440 + rule.startMinutes : -1;
  return [...list].sort((a, b) => at(a) - at(b));
}

function keyRules(key: string): CustomLabRule[] {
  const [kind, room] = key.split("|");
  return sortRules(rules.filter((rule) => rule.room === room && ruleKind(rule) === kind));
}

function boxTitle(room: string, kind: RuleKind, list: CustomLabRule[]): string {
  return (
    `${room} — ` +
    list
      .map((rule) => `${KIND_NAMES[kind]}: ${whenLong(rule)}${rule.course ? ` (${rule.course})` : ""}`)
      .join(" · ")
  );
}

function kindDot(kind: RuleKind): HTMLElement {
  const dot = document.createElement("i");
  dot.className = "kdot";
  dot.dataset.kind = kind;
  return dot;
}

function renderRules(fx: { key: string; bump: boolean } | null = null): void {
  closePop(false);
  // The card keeps its scroll position across a re-render.
  const keepScroll = roomList.scrollTop;
  roomList.style.maxHeight = "none";

  if (!rules.length) {
    const empty = document.createElement("p");
    empty.className = "rec-empty";
    empty.textContent = "Henüz sınıf eklemedin.";
    roomList.replaceChildren(empty);
    fitRecords(0);
    return;
  }

  const groups: HTMLElement[] = [];
  for (const kind of KIND_ORDER) {
    // One box per room, in the order the rooms were first added.
    const byRoom = new Map<string, CustomLabRule[]>();
    for (const rule of rules) {
      if (ruleKind(rule) !== kind) continue;
      const list = byRoom.get(rule.room) ?? [];
      list.push(rule);
      byRoom.set(rule.room, list);
    }
    if (!byRoom.size) continue;

    const open = openGroups[kind];
    const section = document.createElement("section");
    section.className = "kgroup";
    section.dataset.kind = kind;
    section.classList.toggle("open", open);

    const heading = document.createElement("h3");
    heading.className = "kgroup-h";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "kgroup-head";
    head.id = `group-${kind}`;
    head.dataset.kind = kind;
    head.setAttribute("aria-expanded", String(open));
    head.setAttribute("aria-controls", `body-${kind}`);
    const bar = document.createElement("i");
    bar.className = "kbar";
    bar.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = KIND_NAMES[kind];
    const count = document.createElement("span");
    count.className = "kcount";
    count.textContent = String(byRoom.size);
    const countUnit = document.createElement("span");
    countUnit.className = "vh";
    countUnit.textContent = " sınıf";
    count.append(countUnit);
    head.append(bar, name, count);
    head.insertAdjacentHTML("beforeend", CHEVRON);
    heading.append(head);

    const body = document.createElement("div");
    body.className = "kbody";
    body.id = `body-${kind}`;
    body.toggleAttribute("inert", !open);
    const inner = document.createElement("div");
    inner.className = "kinner";
    const grid = document.createElement("ul");
    grid.className = "kgrid";
    grid.setAttribute("aria-labelledby", head.id);

    for (const [room, list] of byRoom) {
      const sorted = sortRules(list);
      const key = boxKey(kind, room);
      const item = document.createElement("li");
      item.className = "box";
      item.dataset.key = key;
      item.dataset.room = room;
      item.title = boxTitle(room, kind, sorted);
      if (fx && fx.key === key) item.classList.add(fx.bump ? "is-bump" : "is-new");

      const multi = sorted.length > 1;
      const main = document.createElement(multi ? "button" : "span");
      main.className = "box-main";
      main.textContent = room;
      item.append(main);

      if (main instanceof HTMLButtonElement) {
        main.type = "button";
        main.setAttribute("aria-haspopup", "dialog");
        main.setAttribute("aria-expanded", "false");
        main.setAttribute("aria-controls", "rule-pop");
        main.setAttribute("aria-label", `${room}, ${KIND_NAMES[kind]}, ${sorted.length} kayıt`);
      } else {
        const rule = sorted[0]!;
        const extra = document.createElement("span");
        extra.className = "vh";
        extra.textContent = `, ${whenLong(rule)}`;
        main.append(extra);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tag-x";
        remove.dataset.rule = ruleKey(rule);
        remove.title = "Kaldır";
        remove.setAttribute("aria-label", `${ruleLabel(rule)} kaydını kaldır`);
        remove.innerHTML = X_ICON;
        item.append(remove);
      }
      grid.append(item);
    }

    inner.append(grid);
    body.append(inner);
    section.append(heading, body);
    groups.push(section);
  }

  roomList.replaceChildren(...groups);
  applySpans();
  fitRecords(keepScroll);
}

/** A code that does not fit one column is never cut: its box spans 2, then 3 columns. */
function applySpans(): void {
  for (const main of roomList.querySelectorAll<HTMLElement>(".box-main")) {
    const box = main.parentElement!;
    // Measure from one column again: on iPhone the sheet is first laid out
    // narrower than it ends up, and a span chosen then must not stay.
    box.classList.remove("span2", "span3");
    if (main.scrollWidth > main.clientWidth) box.classList.add("span2");
    if (main.scrollWidth > main.clientWidth) box.classList.replace("span2", "span3");
  }
}

// The iPhone sheet settles at its final width after the first layout.
window.addEventListener("resize", () => {
  applySpans();
  fitRecords();
});

const boxOf = (key: string): HTMLElement | null =>
  [...roomList.querySelectorAll<HTMLElement>(".box")].find((box) => box.dataset.key === key) ??
  null;

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Runs `done` once when `property` of `element` has finished transitioning.
 * A transition that never runs (reduced motion) or a lost event must not leave
 * the caller waiting, so a timer ends the wait too.
 */
function afterTransition(
  element: HTMLElement,
  property: string,
  done: () => void,
  fallbackMs = 400,
): () => void {
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    element.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
    done();
  };
  const onEnd = (event: TransitionEvent): void => {
    if (event.target === element && event.propertyName === property) finish();
  };
  element.addEventListener("transitionend", onEnd);
  const timer = setTimeout(finish, prefersReducedMotion() ? 0 : fallbackMs);
  return finish;
}

function boxFocusTarget(box: HTMLElement | null): HTMLElement | null {
  return box?.querySelector<HTMLElement>("button.box-main") ?? box?.querySelector<HTMLElement>(".tag-x") ?? null;
}

/** Rules whose removal is queued; a second click on the same one is ignored. */
const removing = new Set<string>();

/** Removes one rule through the storage queue and reports it. */
function removeRule(key: string, after: () => void): void {
  if (removing.has(key)) return;
  removing.add(key);
  const rule = rules.find((candidate) => ruleKey(candidate) === key);
  void serialize(async () => {
    try {
      rules = await removeCustomLabRules([key]);
      setRoomStatus(`${rule ? ruleLabel(rule) : key} çıkarıldı.`);
    } catch {
      setRoomStatus("Kaydedilemedi. Tekrar dene.", "error", "", true);
    } finally {
      removing.delete(key);
    }
    renderRules();
    after();
  });
}

// ---------------------------------------------------------------------------
// The per-rule list of a room with several rules
// ---------------------------------------------------------------------------

let popKey: string | null = null;

function paintPop(): void {
  if (popKey === null) return;
  const [kind, room] = popKey.split("|") as [RuleKind, string];
  pop.setAttribute("aria-label", `${room} ${KIND_NAMES[kind]} kayıtları`);
  popRows.replaceChildren(
    ...keyRules(popKey).map((rule) => {
      const item = document.createElement("li");
      const when = document.createElement("span");
      when.className = "rule-when";
      when.textContent = whenShort(rule);
      const kindText = document.createElement("span");
      kindText.className = "rule-kind";
      kindText.textContent = KIND_NAMES[ruleKind(rule)];
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "rule-x";
      remove.dataset.rule = ruleKey(rule);
      remove.title = "Kaldır";
      remove.setAttribute("aria-label", `${ruleLabel(rule)} kaydını kaldır`);
      remove.innerHTML = X_ICON;
      if (rule.course) item.title = `${rule.course} dersi`;
      item.append(kindDot(ruleKind(rule)), when, kindText, remove);
      return item;
    }),
  );
}

function markBox(open: boolean): void {
  const box = popKey === null ? null : boxOf(popKey);
  if (!box) return;
  box.classList.toggle("open", open);
  box.querySelector("button.box-main")?.setAttribute("aria-expanded", String(open));
}

function openPop(key: string, viaKeyboard: boolean): void {
  closeAllDropdowns();
  if (popKey && popKey !== key) closePop(false);
  popKey = key;
  paintPop();
  pop.hidden = false;
  markBox(true);
  const box = boxOf(key);
  if (box) placeFloating(pop, box.getBoundingClientRect(), viewMain);
  // Opened by keyboard, the first × takes focus (its ring is visible). Opened
  // by pointer, focus stays on the list itself (no ring); arrows reach the ×.
  if (viaKeyboard) pop.querySelector<HTMLElement>(".rule-x")?.focus({ preventScroll: true });
  else pop.focus({ preventScroll: true });
}

function closePop(focusBox: boolean): void {
  if (popKey === null) return;
  const key = popKey;
  markBox(false);
  pop.hidden = true;
  popKey = null;
  if (focusBox) boxFocusTarget(boxOf(key))?.focus({ preventScroll: true });
}

pop.addEventListener("click", (event) => {
  const remove = (event.target as HTMLElement).closest<HTMLButtonElement>(".rule-x");
  if (!remove || popKey === null) return;
  // The second click of a double-click would hit the next rule that slides
  // into this spot.
  if (event.detail > 1 || remove.disabled) return;
  remove.disabled = true;
  const key = popKey;
  const index = [...pop.querySelectorAll(".rule-x")].indexOf(remove);
  removeRule(remove.dataset.rule!, () => {
    if (keyRules(key).length > 1) {
      // The list stays open and updates.
      popKey = key;
      paintPop();
      pop.hidden = false;
      markBox(true);
      const box = boxOf(key);
      if (box) placeFloating(pop, box.getBoundingClientRect(), viewMain);
      const buttons = pop.querySelectorAll<HTMLElement>(".rule-x");
      buttons[Math.min(index, buttons.length - 1)]?.focus({ preventScroll: true });
    } else {
      // One rule is left: the box behaves like a single-rule box again.
      (boxFocusTarget(boxOf(key)) ?? roomInput).focus({ preventScroll: true });
    }
  });
});

pop.addEventListener("keydown", (event) => {
  const buttons = [...pop.querySelectorAll<HTMLElement>(".rule-x")];
  const index = buttons.indexOf(document.activeElement as HTMLElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, index + 1)]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    buttons[Math.max(0, index - 1)]?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closePop(true);
  } else if (event.key === "Tab") {
    event.preventDefault();
    closePop(true);
  }
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target as Node;
  if (popKey === null || pop.contains(target)) return;
  const box = boxOf(popKey);
  if (box?.contains(target)) return; // a press on the box toggles it itself
  const key = popKey;
  closePop(false);
  // Unless something focusable was pressed, focus goes back to the box.
  setTimeout(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active === pop || pop.contains(active)) {
      boxFocusTarget(boxOf(key))?.focus({ preventScroll: true });
    }
  }, 0);
});

roomList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const head = target.closest<HTMLElement>(".kgroup-head");
  if (head) {
    const kind = head.dataset.kind as RuleKind;
    const section = head.closest<HTMLElement>(".kgroup")!;
    const body = section.querySelector<HTMLElement>(".kbody")!;
    const open = !openGroups[kind];
    openGroups[kind] = open;
    closePop(false);
    section.classList.toggle("open", open);
    head.setAttribute("aria-expanded", String(open));
    body.toggleAttribute("inert", !open);
    // The scroll limit is recomputed once the height transition has ended.
    afterTransition(body, "grid-template-rows", fitRecords);
    fitRecords();
    return;
  }

  const main = target.closest<HTMLButtonElement>("button.box-main");
  if (main) {
    const key = main.closest<HTMLElement>(".box")!.dataset.key!;
    // detail 0: the click came from Enter or Space.
    if (popKey === key) closePop(true);
    else openPop(key, event.detail === 0);
    return;
  }

  const remove = target.closest<HTMLButtonElement>(".tag-x");
  if (!remove || event.detail > 1) return;
  const boxes = [...roomList.querySelectorAll(".box")];
  const index = boxes.indexOf(remove.closest(".box")!);
  remove.disabled = true;
  removeRule(remove.dataset.rule!, () => {
    // Focus moves to the neighbouring box, or to the room field when none is left.
    const next = [...roomList.querySelectorAll<HTMLElement>(".box")];
    (boxFocusTarget(next[Math.min(index, next.length - 1)] ?? null) ?? roomInput).focus();
  });
});

/**
 * When the popup body would pass 600px, the records card scrolls inside.
 * The limit is chosen so that the last visible row of boxes is cut in half,
 * which shows that the card scrolls.
 */
const BODY_LIMIT = 600;

/**
 * On touch screens (Safari on iPhone and iPad) the popup is a sheet that scrolls
 * as a whole, so the 600px limit would only squeeze the records card.
 * Same query as the touch layout in style.css.
 */
const isTouchLayout = (): boolean =>
  window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;

function fitRecords(scrollTo?: number): void {
  // Lifting the height limit clamps the scroll position; put it back after.
  const keep = scrollTo ?? roomList.scrollTop;
  roomList.style.maxHeight = "none";
  roomList.classList.remove("scrolls");
  const over = isTouchLayout() ? 0 : viewMain.offsetHeight - BODY_LIMIT;
  if (over > 0) {
    const available = roomList.offsetHeight - over;
    const base = roomList.getBoundingClientRect().top;
    const cuts = [
      ...new Set(
        [...roomList.querySelectorAll<HTMLElement>(".kgroup.open .box")].map(
          (box) => Math.round(box.getBoundingClientRect().top - base) + 14,
        ),
      ),
    ].filter((cut) => cut <= available);
    roomList.style.maxHeight = `${cuts.length ? Math.max(...cuts) : available}px`;
    roomList.classList.add("scrolls");
    // The scrollbar narrows the columns; boxes that no longer fit widen again.
    applySpans();
  }
  roomList.scrollTop = keep;
  // The scroll event this causes is not the user's; remember where we are.
  lastScrollTop = roomList.scrollTop;
  updateScrollCue();
}

/** Scroll position the code last set or the user last reached. */
let lastScrollTop = 0;

function updateScrollCue(): void {
  roomList.classList.toggle("at-start", roomList.scrollTop <= 1);
  roomList.classList.toggle(
    "at-end",
    roomList.scrollTop + roomList.clientHeight >= roomList.scrollHeight - 2,
  );
}

roomList.addEventListener("keydown", (event) => {
  const main = (event.target as HTMLElement).closest<HTMLElement>("button.box-main");
  if (!main || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
  event.preventDefault();
  openPop(main.closest<HTMLElement>(".box")!.dataset.key!, true);
});
roomList.addEventListener(
  "scroll",
  () => {
    updateScrollCue();
    // Only a scroll the user made closes the rule list; a re-fit does not.
    if (Math.abs(roomList.scrollTop - lastScrollTop) <= 1) return;
    lastScrollTop = roomList.scrollTop;
    closePop(false);
  },
  { passive: true },
);

// ---------------------------------------------------------------------------
// Main and Colours views
// ---------------------------------------------------------------------------

/**
 * Colours opens at the height of the main view, so nothing jumps; the footer
 * stays at the bottom. The preview shows whenever it fits.
 */
let viewChange = 0;

function showView(name: "main" | "colors", instant = false): void {
  if (currentView === name) return;
  setColorStatus("");
  closeAllDropdowns();
  closePop(false);
  const from = views.offsetHeight;
  if (name === "colors") {
    // Spare height goes first to the preview cells (up to about 36px), the
    // rest above the footer. When the preview does not fit (for example, with
    // no records at all) it is hidden so the body does not grow. A large
    // difference (15 records) shrinks the view smoothly; no big gap remains.
    const target = viewMain.offsetHeight;
    viewColors.style.minHeight = "0px";
    preview.hidden = false;
    let natural = viewColors.offsetHeight;
    if (natural > target) {
      preview.hidden = true;
      natural = viewColors.offsetHeight;
    }
    const room = preview.hidden ? 24 : 36 + 24;
    viewColors.style.minHeight = `${Math.min(target, natural + room)}px`;
  }
  currentView = name;
  document.body.dataset.view = name;
  viewMain.toggleAttribute("inert", name !== "main");
  viewColors.toggleAttribute("inert", name !== "colors");

  const to = (name === "main" ? viewMain : viewColors).offsetHeight;
  const token = ++viewChange;
  views.style.height = "";
  if (!instant && from !== to && !prefersReducedMotion()) {
    views.style.height = `${from}px`;
    void views.offsetHeight;
    views.style.height = `${to}px`;
    // Release the fixed height at the end of the transition, unless another
    // change of view has started meanwhile.
    afterTransition(views, "height", () => {
      if (token === viewChange) views.style.height = "";
    });
  }
  if (!instant) (name === "main" ? openColors : closeColors).focus({ preventScroll: true });
}

openColors.addEventListener("click", () => showView("colors"));
closeColors.addEventListener("click", () => showView("main"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentView === "colors") {
    event.preventDefault();
    showView("main");
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

dayMenu.set([{ value: "", text: "Her zaman" }], "");
timeMenu.set([{ value: "", text: "Saat" }], "");
buildColorRows();
applyTones();
renderColors();

void (async () => {
  // Load stored rules before processing any submitted changes.
  await serialize(initialize);
  // Transitions stay off until the first paint, so nothing animates on open.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.documentElement.classList.remove("preload")),
  );
  // Fetch timetable sessions separately from the storage update queue.
  sessions = await loadSessions();
  renderDayOptions();
})();
