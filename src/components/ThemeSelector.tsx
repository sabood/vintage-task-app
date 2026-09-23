import { Palette, Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useColorTheme } from "@/hooks/use-color-theme";
import { THEMES, type ThemeId } from "@/lib/theme";
import { Button } from "@/components/ui/button";

type ModeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: typeof Sun;
};

const MODES: ModeOption[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** One theme card: swatch, label, and a tick when active. */
function ThemeCard({
  theme,
  active,
  dark,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  active: boolean;
  dark: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  const color = dark ? theme.swatch.dark : theme.swatch.light;
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={active}
      className={cn(
        "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-accent/50",
      )}
    >
      {/* mini preview: header bar + primary button on a card, using the real tokens */}
      <span
        className="relative w-full overflow-hidden rounded-lg border"
        style={{ background: "var(--card)" }}
      >
        <span className="flex items-center gap-1.5 border-b px-2 py-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: color }}
          />
          <span
            className="h-1.5 w-8 rounded-full"
            style={{ background: "var(--muted)" }}
          />
          <span
            className="h-1.5 w-4 rounded-full"
            style={{ background: "var(--muted)" }}
          />
        </span>
        <span className="flex items-center justify-between px-2 py-1.5">
          <span className="flex flex-col gap-1">
            <span
              className="h-1.5 w-12 rounded-full"
              style={{ background: "var(--foreground)", opacity: 0.85 }}
            />
            <span
              className="h-1.5 w-8 rounded-full"
              style={{ background: "var(--muted-foreground)", opacity: 0.6 }}
            />
          </span>
          <span
            className="rounded-md px-2 py-1 text-[9px] font-semibold"
            style={{ background: color, color: "white" }}
          >
            Add
          </span>
        </span>
        {/* active tick */}
        <span
          className={cn(
            "absolute top-1 right-1 grid size-4 place-items-center rounded-full text-white transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
          style={{ background: color }}
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "truncate text-sm",
            active ? "font-semibold text-primary" : "font-medium",
          )}
        >
          {theme.label}
        </span>
      </span>
      <span className="line-clamp-1 text-[11px] text-muted-foreground">
        {theme.description}
      </span>
    </button>
  );
}

/**
 * Appearance settings: light/dark/system mode and the app-wide color theme.
 * Changes apply instantly across the whole app (Settings → Appearance).
 */
export default function ThemeSelector() {
  const { theme: mode, setTheme: setMode } = useTheme();
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme();
  const [dark, setDark] = useState(false);

  // Track the resolved dark state so swatches can preview the current mode.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-5">
      {/* mode */}
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Mode
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = (mode ?? "system") === m.value;
            return (
              <Button
                key={m.value}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={active}
                className={cn(
                  "rounded-lg",
                  active && "border-primary/50 bg-primary/10 text-primary",
                )}
                onClick={() => setMode(m.value)}
              >
                <Icon className="size-4" />
                {m.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* color theme */}
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Color theme
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={colorTheme === t.id}
              dark={dark}
              onSelect={setColorTheme}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The accent color follows your mode — light themes are tuned for day,
          dark for night.
        </p>
      </div>
    </div>
  );
}
