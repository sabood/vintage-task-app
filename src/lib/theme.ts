/**
 * Color themes for Slate. A theme is an accent palette layered on top of the
 * light/dark mode (next-themes) via `data-theme` on <html>. Only accent-ish
 * tokens (primary, ring, charts, sidebar accent) are themed — backgrounds,
 * text and surfaces stay neutral so everything remains readable.
 */

export const THEME_STORAGE_KEY = "slate.theme";

export type ThemeId = "default" | "forest" | "ocean" | "sunset" | "rose";

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  /** Preview swatch colors (light and dark variant) for the picker cards. */
  swatch: { light: string; dark: string };
};

export const THEMES: ThemeDefinition[] = [
  {
    id: "default",
    label: "Slate",
    description: "The classic indigo accent.",
    swatch: {
      light: "oklch(0.511 0.262 276.966)",
      dark: "oklch(0.585 0.233 277.117)",
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "Calm green for long study sessions.",
    swatch: {
      light: "oklch(0.527 0.154 150.069)",
      dark: "oklch(0.696 0.17 162.48)",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool teal, quiet and focused.",
    swatch: {
      light: "oklch(0.6 0.118 184.704)",
      dark: "oklch(0.704 0.14 182.503)",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm amber for late-night sprints.",
    swatch: {
      light: "oklch(0.646 0.222 41.116)",
      dark: "oklch(0.705 0.213 47.604)",
    },
  },
  {
    id: "rose",
    label: "Rose",
    description: "Soft coral with a bit of pop.",
    swatch: {
      light: "oklch(0.586 0.253 17.075)",
      dark: "oklch(0.645 0.246 16.439)",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "default";

function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Read the persisted theme, falling back to the default. */
export function loadColorTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw && isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persist and apply the theme (sets data-theme on <html>). */
export function saveColorTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode etc.) — still apply for this session.
  }
  applyColorTheme(theme);
}

/** Apply a theme id to <html> without persisting (used on boot). */
export function applyColorTheme(theme: ThemeId) {
  if (theme === DEFAULT_THEME) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

