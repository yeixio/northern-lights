// Site theme (chosen by an admin) and member preferences (each member's own
// choice for the private area). Mirrors server/appearance.ts.

export type Mode = "light" | "dark" | "system";
export type PresetId = "aurora" | "fjord" | "ember" | "forest" | "orchid" | "graphite";
export type Font = "sans" | "serif" | "rounded";
export type Radius = "sharp" | "default" | "round";

export interface SiteTheme {
  preset: PresetId;
  primary?: string | null;
  accent?: string | null;
  mode: Mode;
  font: Font;
  radius: Radius;
}

export interface Preferences {
  preset: PresetId | null; // null: use the site's palette
  primary?: string | null;
  mode: Mode | null; // null: use the site's mode
}

interface Preset {
  name: string;
  primary: string;
  accent: string;
  /** A lighter primary for dark mode, where the regular one would be too dim. */
  primaryDark?: string;
}

export const PRESETS: Record<PresetId, Preset> = {
  aurora: { name: "Aurora", primary: "#059669", accent: "#7c3aed", primaryDark: "#10b981" },
  fjord: { name: "Fjord", primary: "#0369a1", accent: "#4f46e5", primaryDark: "#0ea5e9" },
  ember: { name: "Ember", primary: "#c2410c", accent: "#db2777", primaryDark: "#f97316" },
  forest: { name: "Forest", primary: "#3f6212", accent: "#b45309", primaryDark: "#65a30d" },
  orchid: { name: "Orchid", primary: "#7e22ce", accent: "#db2777", primaryDark: "#a855f7" },
  graphite: { name: "Graphite", primary: "#1f2937", accent: "#0891b2", primaryDark: "#e5e7eb" },
};

export const DEFAULT_THEME: SiteTheme = { preset: "aurora", primary: null, accent: null, mode: "system", font: "sans", radius: "default" };

export const FONTS: Record<Font, string> = { sans: "Modern", serif: "Classic", rounded: "Friendly" };
export const RADII: Record<Radius, string> = { sharp: "Sharp", default: "Soft", round: "Round" };
export const MODES: Record<Mode, string> = { light: "Light", dark: "Dark", system: "Auto" };

const RADIUS_SCALE: Record<Radius, number> = { sharp: 0.35, default: 1, round: 1.6 };

export function normalizeTheme(t: Partial<SiteTheme> | null | undefined): SiteTheme {
  const theme = { ...DEFAULT_THEME, ...t };
  if (!PRESETS[theme.preset]) theme.preset = DEFAULT_THEME.preset;
  return theme;
}

export function isDark(mode: Mode, systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark);
}

/** Text color that reads well on top of a background color. */
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0b0f17" : "#ffffff";
}

export interface Resolved {
  dark: boolean;
  primary: string;
  accent: string;
  font: Font;
  radius: Radius;
}

/** Combine the site theme with a member's preferences (if any) for the current system mode. */
export function resolveTheme(site: SiteTheme, prefs: Preferences | null | undefined, systemDark: boolean): Resolved {
  const mode = prefs?.mode ?? site.mode;
  const dark = isDark(mode, systemDark);
  const presetId = prefs?.preset ?? site.preset;
  const preset = PRESETS[presetId] ?? PRESETS.aurora;
  const custom = prefs?.preset ? prefs.primary : prefs?.primary ?? site.primary;
  const primary = custom || (dark && preset.primaryDark) || preset.primary;
  const accent = (prefs?.preset ? null : site.accent) || preset.accent;
  return { dark, primary, accent, font: site.font, radius: site.radius };
}

export function applyTheme(r: Resolved, el: HTMLElement = document.documentElement) {
  el.dataset.mode = r.dark ? "dark" : "light";
  el.dataset.font = r.font;
  el.style.setProperty("--p", r.primary);
  el.style.setProperty("--a", r.accent);
  el.style.setProperty("--on-p", readableOn(r.primary));
  el.style.setProperty("--r", String(RADIUS_SCALE[r.radius]));
}
