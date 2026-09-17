import { getLabMarkEnabled, setLabMarkEnabled } from "../../src/settings";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup control could not be loaded: ${selector}`);
  return element;
}

const toggle = requireElement<HTMLInputElement>("#enabled-toggle");
const statusText = requireElement<HTMLElement>("#status-text");

function render(enabled: boolean): void {
  toggle.checked = enabled;
  statusText.textContent = enabled ? "Açık" : "Kapalı";
  document.body.dataset.enabled = String(enabled);
}

async function initialize(): Promise<void> {
  render(await getLabMarkEnabled());
  toggle.disabled = false;
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

void initialize();
