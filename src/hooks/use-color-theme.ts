import { useCallback, useEffect, useState } from "react";
import {
  applyColorTheme,
  loadColorTheme,
  saveColorTheme,
  type ThemeId,
} from "@/lib/theme";

/**
 * Applies the color theme on mount (in case the inline boot script didn't
 * run, e.g. in some embeds) and exposes the current theme + setter.
 */
export function useColorTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => loadColorTheme());

  // Keep the DOM in sync if the stored value changed elsewhere.
  useEffect(() => {
    applyColorTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => {
    saveColorTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
