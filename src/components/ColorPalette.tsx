import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

/** A single swatch in the palette. */
export type Swatch = { value: string; label: string };

/** Full text-ink palette (Word-style grid). */
export const TEXT_COLORS: Swatch[] = [
  { value: "#1e1e2e", label: "Ink" },
  { value: "#64748b", label: "Gray" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#84cc16", label: "Lime" },
  { value: "#22c55e", label: "Green" },
  { value: "#10b981", label: "Emerald" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#a855f7", label: "Purple" },
  { value: "#d946ef", label: "Fuchsia" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#78350f", label: "Brown" },
  { value: "#ffffff", label: "White" },
];

/** Full highlight palette (soft tones that stay readable under text). */
export const HIGHLIGHT_COLORS: Swatch[] = [
  { value: "#fef08a", label: "Yellow" },
  { value: "#fde68a", label: "Amber" },
  { value: "#fdba74", label: "Orange" },
  { value: "#fca5a5", label: "Red" },
  { value: "#f9a8d4", label: "Pink" },
  { value: "#e9d5ff", label: "Purple" },
  { value: "#c4b5fd", label: "Violet" },
  { value: "#a5b4fc", label: "Indigo" },
  { value: "#93c5fd", label: "Blue" },
  { value: "#7dd3fc", label: "Sky" },
  { value: "#99f6e4", label: "Teal" },
  { value: "#a7f3d0", label: "Emerald" },
  { value: "#bbf7d0", label: "Green" },
  { value: "#bef264", label: "Lime" },
  { value: "#d4d4d8", label: "Gray" },
];

/** Standard 32-tone palette used for pen and arrow colors. */
export const PEN_PALETTE: Swatch[] = [
  { value: "#1e1e2e", label: "Ink" },
  { value: "#ffffff", label: "White" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#84cc16", label: "Lime" },
  { value: "#22c55e", label: "Green" },
  { value: "#10b981", label: "Emerald" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#a855f7", label: "Purple" },
  { value: "#d946ef", label: "Fuchsia" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#78350f", label: "Brown" },
  { value: "#64748b", label: "Gray" },
];

/**
 * Popover color palette: a grid of swatches plus a custom color input.
 * Controlled open state so the parent decides when it shows.
 */
export default function ColorPalette({
  open,
  onOpenChange,
  colors,
  value,
  onPick,
  allowCustom = true,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colors: Swatch[];
  value?: string;
  onPick: (hex: string) => void;
  allowCustom?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState("#6366f1");

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full left-0 z-50 mt-1 w-60 rounded-xl border bg-popover p-2.5 shadow-lg",
        className,
      )}
    >
      <div className="grid grid-cols-8 gap-1">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            title={c.label}
            className={cn(
              "size-5 rounded-[4px] border border-black/10 transition-transform hover:scale-110",
              value?.toLowerCase() === c.value.toLowerCase() &&
                "ring-2 ring-primary ring-offset-1 ring-offset-popover",
            )}
            style={{ backgroundColor: c.value }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(c.value);
              onOpenChange(false);
            }}
          />
        ))}
      </div>
      {allowCustom && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2">
          <input
            type="color"
            aria-label="Custom color"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="size-6 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
          />
          <span className="text-[11px] text-muted-foreground">Custom</span>
          <button
            type="button"
            className="ml-auto rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(custom);
              onOpenChange(false);
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
