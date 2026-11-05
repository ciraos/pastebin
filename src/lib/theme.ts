export type ThemeMode = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pb-theme";

/** Auto mode: light during the day, dark at night (device local time). */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 19;

export const THEME_MODES: ThemeMode[] = ["auto", "light", "dark"];

export function isDaytime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

export function resolveTheme(mode: ThemeMode, date: Date = new Date()): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return isDaytime(date) ? "light" : "dark";
}

export function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

export function storeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private mode; the theme still applies for this page.
  }
}

/** Applies the resolved theme to <html> and returns what was applied. */
export function applyTheme(mode: ThemeMode, date: Date = new Date()): ResolvedTheme {
  const theme = resolveTheme(mode, date);
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  return theme;
}

/**
 * Runs before the rest of the body paints (inlined at the start of <body>, see
 * `layout.tsx`) so the correct palette is applied without a flash. Keep it
 * dependency-free and in sync with the helpers above.
 */
export function themeBootstrapScript(): string {
  return `
try {
  var key = '${THEME_STORAGE_KEY}';
  var stored = window.localStorage.getItem(key);
  var mode = stored === 'light' || stored === 'dark' ? stored : 'auto';
  var hour = new Date().getHours();
  var light = mode === 'light' || (mode === 'auto' && hour >= ${DAY_START_HOUR} && hour < ${DAY_END_HOUR});
  var root = document.documentElement;
  if (light) root.classList.add('light');
  root.style.colorScheme = light ? 'light' : 'dark';
} catch (error) {}
`.trim();
}
