/**
 * Custom dropdowns for the day and time fields. The popup uses no native
 * <select>, so the list looks the same everywhere and can be placed freely.
 * The list is a listbox of options inside the main view, positioned
 * absolutely: the popup height never changes when it opens.
 */

/** Gap kept between a floating list and the edge of the view. */
const EDGE = 8;

/**
 * Places a floating list under `anchor`, above it when there is no room below,
 * and on the roomier side with its own scrolling when neither side fits.
 */
export function placeFloating(list: HTMLElement, anchor: DOMRect, host: HTMLElement): void {
  const hostRect = host.getBoundingClientRect();
  list.style.maxHeight = "";
  list.style.width = "max-content";
  const width = Math.min(
    hostRect.width - 32,
    Math.max(Math.ceil(anchor.width), Math.ceil(list.offsetWidth)),
  );
  list.style.width = `${width}px`;

  const height = list.offsetHeight;
  const below = hostRect.bottom - EDGE - (anchor.bottom + 4);
  const above = anchor.top - 4 - (hostRect.top + EDGE);
  let top: number;
  if (height <= below) {
    top = anchor.bottom + 4;
  } else if (height <= above) {
    top = anchor.top - 4 - height;
  } else if (below >= above) {
    list.style.maxHeight = `${Math.floor(below)}px`;
    top = anchor.bottom + 4;
  } else {
    list.style.maxHeight = `${Math.floor(above)}px`;
    top = anchor.top - 4 - Math.floor(above);
  }
  const left = Math.max(
    hostRect.left + 16,
    Math.min(anchor.left, hostRect.right - 16 - width),
  );
  list.style.top = `${Math.round(top - hostRect.top)}px`;
  list.style.left = `${Math.round(left - hostRect.left)}px`;
}

export interface DropdownOption {
  value: string;
  /** Full text, shown in the list and as the trigger's title. */
  text: string;
  /** Shorter text for the trigger itself, when the full text is long. */
  short?: string;
}

export interface Dropdown {
  readonly button: HTMLButtonElement;
  readonly list: HTMLElement;
  readonly value: string;
  set(options: DropdownOption[], value: string): void;
  setDisabled(disabled: boolean): void;
  isOpen(): boolean;
  open(): void;
  close(focusButton?: boolean): void;
}

const CHECK =
  '<svg class="check" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function requireIn<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup control could not be loaded: ${selector}`);
  return element;
}

const dropdowns: Dropdown[] = [];

export function closeAllDropdowns(): void {
  for (const dropdown of dropdowns) dropdown.close(false);
}

/**
 * Binds `#<prefix>-btn`, `#<prefix>-value` and `#<prefix>-list`.
 * `onOpen` runs before the list opens, so the caller can close other popovers.
 */
export function createDropdown(
  prefix: string,
  host: HTMLElement,
  onChange: (value: string) => void,
  onOpen: () => void,
): Dropdown {
  const button = requireIn<HTMLButtonElement>(`#${prefix}-btn`);
  const valueElement = requireIn<HTMLElement>(`#${prefix}-value`);
  const list = requireIn<HTMLElement>(`#${prefix}-list`);

  let options: DropdownOption[] = [];
  let value = "";
  let active = -1;

  function paint(): void {
    list.replaceChildren(
      ...options.map((option, index) => {
        const item = document.createElement("li");
        item.id = `${prefix}-opt-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.value === value));
        item.dataset.index = String(index);
        item.dataset.value = option.value;
        item.innerHTML = CHECK;
        const text = document.createElement("span");
        text.textContent = option.text;
        item.append(text);
        return item;
      }),
    );
  }

  function setActive(index: number): void {
    active = Math.max(0, Math.min(options.length - 1, index));
    [...list.children].forEach((item, i) => item.classList.toggle("active", i === active));
    const item = list.children[active] as HTMLElement | undefined;
    if (!item) return;
    list.setAttribute("aria-activedescendant", item.id);
    if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop - 4;
    } else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight + 4;
    }
  }

  const dropdown: Dropdown = {
    button,
    list,
    get value() {
      return value;
    },
    set(next, selected) {
      options = next;
      value = next.some((o) => o.value === selected) ? selected : (next[0]?.value ?? "");
      const chosen = next.find((o) => o.value === value);
      // The trigger shows the short text (a time range); the list and the
      // title carry the full text.
      valueElement.textContent = chosen ? (chosen.short ?? chosen.text) : "";
      button.dataset.value = value;
      if (chosen?.short) button.title = chosen.text;
      else button.removeAttribute("title");
      paint();
    },
    setDisabled(disabled) {
      button.disabled = disabled;
      if (disabled) dropdown.close(false);
    },
    isOpen: () => !list.hidden,
    open() {
      if (button.disabled || dropdown.isOpen()) return;
      onOpen();
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      placeFloating(list, button.getBoundingClientRect(), host);
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      list.focus({ preventScroll: true });
    },
    close(focusButton = false) {
      if (!dropdown.isOpen()) return;
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      list.removeAttribute("aria-activedescendant");
      if (focusButton) button.focus();
    },
  };
  dropdowns.push(dropdown);

  function choose(index: number): void {
    const option = options[index];
    if (!option) return;
    const changed = option.value !== value;
    dropdown.set(options, option.value);
    dropdown.close(true);
    if (changed) onChange(option.value);
  }

  button.addEventListener("click", () =>
    dropdown.isOpen() ? dropdown.close(true) : dropdown.open(),
  );
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      dropdown.open();
    }
  });

  list.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(active + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive(active - 1);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        // Close only the list, not the whole Colours view or popup.
        event.preventDefault();
        event.stopPropagation();
        dropdown.close(true);
        break;
      case "Tab":
        event.preventDefault();
        dropdown.close(true);
        break;
    }
  });
  list.addEventListener("pointermove", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("li");
    if (item && Number(item.dataset.index) !== active) setActive(Number(item.dataset.index));
  });
  list.addEventListener("click", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("li");
    if (item) choose(Number(item.dataset.index));
  });

  // A press outside the trigger and the list closes it.
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (dropdown.isOpen() && !list.contains(target) && !button.contains(target)) {
      dropdown.close(false);
    }
  });

  return dropdown;
}
