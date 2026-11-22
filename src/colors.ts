/**
 * Marking colours. The user picks one colour per kind (confirmed laboratory,
 * own laboratory, tutorial) from a small preset list. Everything else the
 * popup and the timetable show is derived from that single colour, so both
 * places always agree.
 */

export const COLOR_KINDS = ["verified", "custom", "tutorial"] as const;
export type ColorKind = (typeof COLOR_KINDS)[number];

export type ColorSettings = Record<ColorKind, string>;

/** The only colours the popup offers, and the only ones storage accepts. */
export const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Kırmızı", hex: "#f12e4b" },
  { name: "Turuncu", hex: "#f08c14" },
  { name: "Sarı", hex: "#f5b800" },
  { name: "Yeşil", hex: "#22a55b" },
  { name: "Mavi", hex: "#1269b5" },
  { name: "Mor", hex: "#8b5cf6" },
  { name: "Pembe", hex: "#e83e8c" },
  { name: "Turkuaz", hex: "#0fa3b1" },
];

export const DEFAULT_COLORS: Readonly<ColorSettings> = {
  verified: "#f12e4b",
  custom: "#f08c14",
  tutorial: "#8b5cf6",
};

/** The preset a stored value stands for, in lower case, or null. */
export function presetColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toLowerCase();
  return COLOR_PRESETS.some((preset) => preset.hex === hex) ? hex : null;
}

/**
 * Reads the stored colours. Anything that is not one of the presets, and any
 * kind that is missing, falls back to its default.
 */
export function parseColorSettings(value: unknown): ColorSettings {
  const stored =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    verified: presetColor(stored.verified) ?? DEFAULT_COLORS.verified,
    custom: presetColor(stored.custom) ?? DEFAULT_COLORS.custom,
    tutorial: presetColor(stored.tutorial) ?? DEFAULT_COLORS.tutorial,
  };
}

// ---------------------------------------------------------------------------
// Tone derivation
// ---------------------------------------------------------------------------

const WHITE = "#FFFFFF";
/** The ink of the whole extension; it stays navy whatever colour is chosen. */
export const NAVY = "#17365D";

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  let digits = hex.trim().replace(/^#/, "");
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const channel = (start: number) => parseInt(digits.slice(start, start + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

function toHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `shareOfA` of colour a, the rest colour b. */
function mix(a: string, b: string, shareOfA: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex(ca.map((v, i) => v * shareOfA + (cb[i] ?? 0) * (1 - shareOfA)) as Rgb);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function fromHsl(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** A fill that white text can sit on: the colour, darkened a little if needed. */
function fillFor(base: string): { fill: string; on: string } {
  if (contrast(base, WHITE) >= 3) return { fill: base, on: WHITE };
  const [h, s, l] = toHsl(base);
  for (let step = 0.5; step <= 10; step += 0.5) {
    const candidate = fromHsl(h, s, l - step);
    if (contrast(candidate, WHITE) >= 3) return { fill: candidate, on: WHITE };
  }
  // Too light to darken in 10 points (yellow): keep the colour, use navy text.
  return { fill: base, on: NAVY };
}

function darkenUntil(base: string, background: string, ratio: number): string {
  const [h, s0, l] = toHsl(base);
  const s = Math.min(s0, 80);
  for (let next = l; next >= 0; next -= 1) {
    const candidate = fromHsl(h, s, next);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return NAVY;
}

export interface Tones {
  /** The chosen colour. */
  base: string;
  /** Solid surface (segmented control, badge); legible with `on` on top. */
  fill: string;
  /** White, or navy when the colour is too light for white text. */
  on: string;
  /** Tint of record boxes in the popup. */
  chipBg: string;
  chipHover: string;
  /** Group title ink: at least 4.5:1 on `chipBg`. */
  chipInk: string;
  /** Tint of a marked timetable cell. */
  cellBg: string;
}

export function tones(hex: string): Tones {
  const base = toHex(parseHex(hex));
  const { fill, on } = fillFor(base);
  const chipBg = mix(base, WHITE, 0.14);
  return {
    base,
    fill,
    on,
    chipBg,
    chipHover: mix(base, WHITE, 0.3),
    chipInk: darkenUntil(base, chipBg, 4.5),
    cellBg: mix(base, WHITE, 0.2),
  };
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export interface TimetableTones {
  /** Inner frame of a marked cell. */
  border: string;
  /** Cell background. */
  bg: string;
  /** Badge background and its text. */
  badge: string;
  badgeInk: string;
}

/**
 * The colours the timetable used before they became configurable. A kind that
 * still has its default colour keeps exactly these, so users who never pick a
 * colour see no change.
 */
const ORIGINAL_TIMETABLE_TONES: Record<ColorKind, TimetableTones> = {
  verified: { border: "#f12e4b", bg: "#ffd3d7", badge: "#f12e4b", badgeInk: "#ffffff" },
  custom: { border: "#f08c14", bg: "#fef2d6", badge: "#f08c14", badgeInk: "#ffffff" },
  tutorial: { border: "#8b5cf6", bg: "#efe7ff", badge: "#7c3aed", badgeInk: "#ffffff" },
};

export function timetableTones(kind: ColorKind, hex: string): TimetableTones {
  if (presetColor(hex) === DEFAULT_COLORS[kind]) return ORIGINAL_TIMETABLE_TONES[kind];
  const t = tones(hex);
  return { border: t.base, bg: t.cellBg, badge: t.fill, badgeInk: t.on };
}

/** CSS custom property of the timetable stylesheet, e.g. `--emu-lm-custom-bg`. */
export function timetableVariable(kind: ColorKind, part: keyof TimetableTones): string {
  const name = part === "badgeInk" ? "badge-ink" : part;
  return `--emu-lm-${kind}-${name}`;
}

/** Writes the timetable colours as custom properties of `element`. */
export function applyTimetableColors(element: HTMLElement, colors: ColorSettings): void {
  for (const kind of COLOR_KINDS) {
    const t = timetableTones(kind, colors[kind]);
    for (const part of ["border", "bg", "badge", "badgeInk"] as const) {
      element.style.setProperty(timetableVariable(kind, part), t[part]);
    }
  }
}
