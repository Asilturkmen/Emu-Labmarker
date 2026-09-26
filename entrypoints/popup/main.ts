import { matchCourseRoom, normalizeRoom } from "../../src/data/courseRoom";
import {
  formatMinutes,
  isTimedRule,
  isWeekday,
  ruleKey,
  ruleLabel,
  WEEKDAYS,
  type AddRuleResult,
  type AddRuleStatus,
  type CustomLabRule,
  type Weekday,
} from "../../src/data/customRules";
import { isValidRoomCode } from "../../src/data/labRooms";
import {
  addCustomLabRule,
  getCustomLabRules,
  getLabMarkerEnabled,
  removeCustomLabRules,
  setLabMarkerEnabled,
} from "../../src/settings";
import {
  LIST_SESSIONS_MESSAGE,
  parseSessions,
  suggestRoom,
  type TimetableSession,
} from "../../src/timetableSessions";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup control could not be loaded: ${selector}`);
  return element;
}

const toggle = requireElement<HTMLInputElement>("#enabled-toggle");
const statusText = requireElement<HTMLElement>("#status-text");
const roomForm = requireElement<HTMLFormElement>("#room-form");
const roomInput = requireElement<HTMLInputElement>("#room-input");
const daySelect = requireElement<HTMLSelectElement>("#day-select");
const timeSelect = requireElement<HTMLSelectElement>("#time-select");
const roomStatus = requireElement<HTMLElement>("#room-status");
const roomList = requireElement<HTMLUListElement>("#room-list");
const formHint = requireElement<HTMLElement>("#form-hint");
const roomGhost = requireElement<HTMLElement>("#room-ghost");

let rules: CustomLabRule[] = [];
/**
 * The open timetable's meetings, or null when the popup was opened anywhere
 * else. A single meeting can only be picked from these, so that the day and
 * time lists never offer an hour the room is not used.
 */
let sessions: TimetableSession[] | null = null;
/** The timetable room the typed text completes to, shown greyed out. */
let suggestion: string | null = null;

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

function setRoomStatus(message: string, tone: "info" | "error" = "info"): void {
  roomStatus.textContent = message;
  roomStatus.dataset.tone = tone;
}

function renderRules(): void {
  roomList.replaceChildren();

  if (!rules.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Henüz sınıf eklemedin.";
    roomList.append(empty);
    return;
  }

  for (const rule of rules) {
    const label = ruleLabel(rule);
    const item = document.createElement("li");
    item.className = "chip";
    if (!isTimedRule(rule)) item.title = `${rule.room}: her gün, her saat`;
    else if (rule.course) item.title = `${rule.course} dersi`;

    const name = document.createElement("span");
    name.textContent = label;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chip-remove";
    remove.dataset.rule = ruleKey(rule);
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${label} kaydını kaldır`);

    item.append(name, remove);
    roomList.append(item);
  }
}

const ADD_MESSAGES: Record<AddRuleStatus, (rule: CustomLabRule) => string> = {
  added: (rule) => `${ruleLabel(rule)} eklendi.`,
  duplicate: (rule) => `${ruleLabel(rule)} listede zaten var.`,
  verified: (rule) => `${rule.room} zaten kesin lab listesinde.`,
  covered: (rule) => `${rule.room} zaten her saat özel lab olarak ekli.`,
  invalid: () => "Geçerli bir sınıf kodu yaz (örnek: CMPE025).",
  "invalid-time": () => "Dersin başladığı saati seç.",
  limit: () => "Daha fazla sınıf eklenemiyor, önce birini çıkar.",
};

function reportAdd({ status, rule, absorbed }: AddRuleResult): void {
  let message = ADD_MESSAGES[status](rule);
  if (absorbed) message += " Bu sınıfın saatli kayıtları buna dahil edildi.";
  setRoomStatus(message, status === "added" ? "info" : "error");
}

// Every change reads the stored list, edits it and writes it back. Two quick
// clicks must not both start from the same list, or the second write would
// silently drop the first, so changes run one after another.
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
    // Without this the popup would sit on "Durum yükleniyor…" with a dead
    // switch, which reads as a frozen popup rather than a storage failure.
    statusText.textContent = "Ayarlar okunamadı";
    setRoomStatus("Ayarlar okunamadı. Tarayıcıyı yeniden başlatmayı dene.", "error");
  }
}

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  const enabled = toggle.checked;
  render(enabled);
  try {
    await setLabMarkerEnabled(enabled);
  } catch {
    // The switch must not claim a state that was never written to storage.
    render(!enabled);
    setRoomStatus("Tercih kaydedilemedi.", "error");
  } finally {
    toggle.disabled = false;
  }
});

function createOption(value: string, text: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
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
  const day = daySelect.value;
  const byStart = new Map<string, TimetableSession>();
  if (!isWeekday(day)) return byStart;
  for (const session of typedRoomSessions()) {
    const start = formatMinutes(session.startMinutes);
    if (session.day === day && !byStart.has(start)) byStart.set(start, session);
  }
  return byStart;
}

function renderTimeOptions(): void {
  const previous = timeSelect.value;
  const byStart = chosenDaySessions();
  const options = [...byStart].map(([start, session]) =>
    createOption(start, `${start}–${formatMinutes(session.endMinutes)} · ${session.courseCode}`),
  );

  // A single meeting is simply chosen; there is nothing to pick between.
  timeSelect.replaceChildren(
    ...(options.length === 1 ? options : [createOption("", "Saat"), ...options]),
  );
  timeSelect.value = byStart.has(previous)
    ? previous
    : options.length === 1
      ? options[0]!.value
      : "";
  timeSelect.disabled = options.length === 0;
}

function renderSuggestion(): void {
  suggestion = sessions ? suggestRoom(roomInput.value, sessions) : null;
  roomGhost.replaceChildren();
  if (!suggestion) return;

  const typed = document.createElement("span");
  typed.className = "room-ghost-typed";
  typed.textContent = roomInput.value;
  const rest = document.createElement("span");
  rest.className = "room-ghost-rest";
  rest.textContent = suggestion.slice(normalizeRoom(roomInput.value).length);
  roomGhost.append(typed, rest);
}

function setFormHint(message: string | null): void {
  formHint.textContent = message ?? "";
  formHint.hidden = message === null;
}

/** Offers only the days the typed room is used, then their times. */
function renderDayOptions(): void {
  const previous = daySelect.value;
  const roomSessions = typedRoomSessions();
  const days = WEEKDAYS.filter((day) => roomSessions.some((session) => session.day === day));

  daySelect.replaceChildren(
    createOption("", "Her zaman"),
    ...days.map((day) => createOption(day, WEEKDAY_NAMES[day])),
  );
  daySelect.value = (days as string[]).includes(previous) ? previous : "";
  daySelect.disabled = days.length === 0;
  renderTimeOptions();
  renderSuggestion();

  const room = typedRoom();
  if (sessions === null) {
    setFormHint("Tek bir dersi eklemek için bu pencereyi ders programı sayfasında aç.");
  } else if (!days.length && isValidRoomCode(room)) {
    setFormHint(`${room} programında yok, yalnızca "Her zaman" olarak eklenebilir.`);
  } else {
    setFormHint(null);
  }
}

roomInput.addEventListener("input", renderDayOptions);

// Tab takes the suggestion, as does the right arrow once the caret is at the
// end. Without a suggestion both keep their usual meaning, so Tab still moves
// on to the next field.
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
daySelect.addEventListener("change", renderTimeOptions);

async function loadSessions(): Promise<TimetableSession[] | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return null;
    return parseSessions(
      await browser.tabs.sendMessage(tab.id, LIST_SESSIONS_MESSAGE),
    );
  } catch {
    // Any other tab has no timetable script to answer.
    return null;
  }
}

roomForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = roomInput.value.trim();
  if (!input) return;
  // Read now: by the time a queued change runs, the form may already hold
  // the next entry.
  const day = daySelect.value;
  const start = timeSelect.value;
  const course = chosenDaySessions().get(start)?.courseCode;

  void serialize(async () => {
    let focusTarget: HTMLElement = roomInput;
    try {
      const result = await addCustomLabRule({
        room: input,
        ...(isWeekday(day) ? { day, start, course } : {}),
      });
      rules = result.rules;
      reportAdd(result);
      if (result.status === "added") {
        roomInput.value = "";
        renderDayOptions();
      } else if (result.status === "invalid-time") {
        focusTarget = timeSelect;
      }
      renderRules();
    } catch {
      setRoomStatus("Kaydedilemedi. Tekrar dene.", "error");
    }
    focusTarget.focus();
  });
});

roomList.addEventListener("click", (event) => {
  const remove = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".chip-remove",
  );
  const key = remove?.dataset.rule;
  if (!remove || !key) return;

  const rule = rules.find((candidate) => ruleKey(candidate) === key);
  remove.disabled = true;
  void serialize(async () => {
    try {
      rules = await removeCustomLabRules([key]);
      setRoomStatus(`${rule ? ruleLabel(rule) : key} çıkarıldı.`);
    } catch {
      setRoomStatus("Kaydedilemedi. Tekrar dene.", "error");
    }
    renderRules();
  });
});

void (async () => {
  // Queued, so an entry submitted before the list has loaded cannot write
  // over rules it never saw.
  await serialize(initialize);
  // Outside the queue: nothing the user does has to wait for the tab.
  sessions = await loadSessions();
  renderDayOptions();
})();
