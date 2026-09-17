import type { AddRoomStatus } from "../../src/data/labRooms";
import {
  addCustomLabRoom,
  getLabMarkEnabled,
  getCustomLabRooms,
  removeCustomLabRoom,
  setLabMarkEnabled,
} from "../../src/settings";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup control could not be loaded: ${selector}`);
  return element;
}

const toggle = requireElement<HTMLInputElement>("#enabled-toggle");
const statusText = requireElement<HTMLElement>("#status-text");
const roomForm = requireElement<HTMLFormElement>("#room-form");
const roomInput = requireElement<HTMLInputElement>("#room-input");
const roomStatus = requireElement<HTMLElement>("#room-status");
const roomList = requireElement<HTMLUListElement>("#room-list");

function render(enabled: boolean): void {
  toggle.checked = enabled;
  statusText.textContent = enabled ? "Açık" : "Kapalı";
  document.body.dataset.enabled = String(enabled);
}

function setRoomStatus(message: string, tone: "info" | "error" = "info"): void {
  roomStatus.textContent = message;
  roomStatus.dataset.tone = tone;
}

function renderRooms(rooms: string[]): void {
  roomList.replaceChildren();

  if (!rooms.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Henüz sınıf eklemedin.";
    roomList.append(empty);
    return;
  }

  for (const room of rooms) {
    const item = document.createElement("li");
    item.className = "chip";

    const name = document.createElement("span");
    name.textContent = room;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chip-remove";
    remove.dataset.room = room;
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${room} sınıfını kaldır`);

    item.append(name, remove);
    roomList.append(item);
  }
}

const ADD_MESSAGES: Record<AddRoomStatus, (room: string) => string> = {
  added: (room) => `${room} eklendi.`,
  duplicate: (room) => `${room} listede zaten var.`,
  verified: (room) => `${room} zaten kesin lab listesinde.`,
  invalid: () => "Geçerli bir sınıf kodu yaz (örnek: CMPE025).",
  limit: () => "Daha fazla sınıf eklenemiyor, önce birini çıkar.",
};

async function initialize(): Promise<void> {
  render(await getLabMarkEnabled());
  toggle.disabled = false;
  renderRooms(await getCustomLabRooms());
}

toggle.addEventListener("change", async () => {
  toggle.disabled = true;
  const enabled = toggle.checked;
  render(enabled);
  try {
    await setLabMarkEnabled(enabled);
  } finally {
    toggle.disabled = false;
  }
});

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = roomInput.value.trim();
  if (!input) return;

  const { status, room, rooms } = await addCustomLabRoom(input);
  setRoomStatus(ADD_MESSAGES[status](room), status === "added" ? "info" : "error");
  if (status === "added") {
    roomInput.value = "";
    renderRooms(rooms);
  }
  roomInput.focus();
});

roomList.addEventListener("click", async (event) => {
  const remove = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".chip-remove",
  );
  const room = remove?.dataset.room;
  if (!remove || !room) return;

  remove.disabled = true;
  renderRooms(await removeCustomLabRoom(room));
  setRoomStatus(`${room} çıkarıldı.`);
});

void initialize();
