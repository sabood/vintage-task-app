import {
  BLOCK_FORMATS,
  type FormatCmd,
  type FormatState,
  applyFontFamily,
  applyFontSize,
  formatSelection,
  INK_COMMAND_COLORS,
} from "@/components/RichTextEditor";
import type { NoteColor } from "@/convex/schema";
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  CaseSensitive,
  Eraser,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Palette,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  Flag,
  Image as ImageIcon,
  PencilLine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FONT_FAMILIES: { label: string; stack: string; css: string }[] = [
  { label: "Inter (body)", stack: '"Inter", sans-serif', css: "font-sans" },
  { label: "Space Grotesk", stack: '"Space Grotesk", sans-serif', css: "" },
  { label: "Lora (serif)", stack: '"Lora", serif', css: "font-serif" },
  { label: "JetBrains Mono", stack: '"JetBrains Mono", monospace', css: "font-mono" },
  { label: "Caveat (hand)", stack: '"Caveat", cursive', css: "font-hand" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36];

const INK_SWATCHES: { value: string; label: string; dot: string }[] = [
  { value: "default", label: "Default ink", dot: "bg-foreground/70" },
  { value: "indigo", label: "Indigo ink", dot: "bg-indigo-500" },
  { value: "emerald", label: "Emerald ink", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber ink", dot: "bg-amber-500" },
  { value: "rose", label: "Rose ink", dot: "bg-rose-500" },
  { value: "sky", label: "Sky ink", dot: "bg-sky-500" },
];

const HIGHLIGHT_SWATCHES: { value: string; dot: string }[] = [
  { value: "#fde68a", dot: "bg-yellow-300" },
  { value: "#bbf7d0", dot: "bg-green-300" },
  { value: "#bfdbfe", dot: "bg-blue-300" },
  { value: "#fbcfe8", dot: "bg-pink-300" },
  { value: "#e9d5ff", dot: "bg-purple-300" },
];

const ACCENT_SWATCHES: { value: NoteColor; label: string; dot: string }[] = [
  { value: "default", label: "Plain", dot: "bg-muted-foreground/60" },
  { value: "indigo", label: "Indigo", dot: "bg-indigo-500" },
  { value: "violet", label: "Violet", dot: "bg-violet-500" },
  { value: "sky", label: "Sky", dot: "bg-sky-500" },
  { value: "teal", label: "Teal", dot: "bg-teal-500" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber", dot: "bg-amber-500" },
  { value: "orange", label: "Orange", dot: "bg-orange-500" },
  { value: "rose", label: "Rose", dot: "bg-rose-500" },
  { value: "pink", label: "Pink", dot: "bg-pink-500" },
];

function RibbonButton({
  label,
  active,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/70 hover:bg-accent hover:text-foreground",
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RibbonDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

/**
 * Word-style ribbon fixed above the page (outside the paper) so it never
 * scrolls or reflows while typing. All formatting applies to the selection.
 */
export default function EditorRibbon({
  state,
  blockTag,
  onBlock,
  onFormat,
  onPersist,
  savedLabel,
  onFlag,
  numbered,
  onToggleNumbered,
  accent,
  onAccent,
  drawMode,
  onToggleDraw,
  imageMode,
  onToggleImage,
}: {
  state: FormatState;
  blockTag: string;
  onBlock: (tag: string) => void;
  onFormat: (cmd: FormatCmd, arg?: string) => void;
  onPersist: () => void;
  savedLabel: string;
  onFlag: () => void;
  numbered: boolean;
  onToggleNumbered: () => void;
  accent: NoteColor;
  onAccent: (c: NoteColor) => void;
  drawMode: boolean;
  onToggleDraw: () => void;
  imageMode: boolean;
  onToggleImage: () => void;
}) {
  const [family, setFamily] = useState(FONT_FAMILIES[0].label);
  const [size, setSize] = useState(16);
  const [inkOpen, setInkOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const inkRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  // close swatch popovers on outside click
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (inkRef.current && !inkRef.current.contains(e.target as Node)) setInkOpen(false);
      if (hlRef.current && !hlRef.current.contains(e.target as Node)) setHlOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const grow = () => {
    const next = Math.min(72, Math.round(size * 1.2) + 1);
    setSize(next);
    applyFontSize(next);
    onPersist();
  };
  const shrink = () => {
    const next = Math.max(8, Math.round(size / 1.2));
    setSize(next);
    applyFontSize(next);
    onPersist();
  };

  return (
    <div className="sticky top-16 z-30 rounded-2xl border bg-card/95 shadow-sm backdrop-blur-sm">
      {/* row 1: font family, size, grow/shrink, clear, cases, ink & highlight */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-2 py-2">
        {/* font family */}
        <select
          aria-label="Font family"
          value={family}
          onChange={(e) => {
            const f = FONT_FAMILIES.find((x) => x.label === e.target.value);
            if (!f) return;
            setFamily(f.label);
            applyFontFamily(f.stack);
            onPersist();
          }}
          className="h-7 max-w-36 shrink-0 rounded-md border bg-background px-1.5 text-xs font-medium outline-none"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>

        {/* font size */}
        <select
          aria-label="Font size"
          value={size}
          onChange={(e) => {
            const px = Number(e.target.value);
            setSize(px);
            applyFontSize(px);
            onPersist();
          }}
          className="h-7 w-14 shrink-0 rounded-md border bg-background px-1 text-xs font-medium outline-none"
        >
          {FONT_SIZES.map((px) => (
            <option key={px} value={px}>
              {px}
            </option>
          ))}
        </select>

        {/* grow / shrink */}
        <RibbonButton label="Increase font size" onClick={grow}>
          <span className="text-xs leading-none font-semibold">A⁺</span>
        </RibbonButton>
        <RibbonButton label="Decrease font size" onClick={shrink}>
          <span className="text-xs leading-none font-semibold">A⁻</span>
        </RibbonButton>

        <RibbonDivider />

        {/* clear formatting */}
        <RibbonButton label="Clear formatting" onClick={() => onFormat("removeFormat")}>
          <Eraser className="size-4" />
        </RibbonButton>

        {/* change case (best-effort: re-types the selection) */}
        <RibbonButton
          label="Change case"
          onClick={() => {
            const sel = window.getSelection();
            const text = sel?.toString() ?? "";
            if (!text) return;
            const cased =
              text === text.toUpperCase()
                ? text.toLowerCase()
                : text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            document.execCommand("insertText", false, cased);
            onPersist();
          }}
        >
          <CaseSensitive className="size-4" />
        </RibbonButton>

        <RibbonDivider />

        {/* ink color with dropdown */}
        <div ref={inkRef} className="relative flex shrink-0 items-center">
          <RibbonButton label="Ink color" onClick={() => setInkOpen((o) => !o)}>
            <Palette className="size-4" />
          </RibbonButton>
          <button
            type="button"
            aria-label="Apply current ink color"
            className="-ml-1 grid size-7 place-items-center rounded-md hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat("foreColor", INK_COMMAND_COLORS.indigo)}
          >
            <Baseline className="size-4 text-indigo-500" />
          </button>
          {inkOpen && (
            <div className="absolute top-8 left-0 z-40 flex gap-1 rounded-xl border bg-popover p-2 shadow-lg">
              {INK_SWATCHES.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  aria-label={i.label}
                  title={i.label}
                  className={cn("size-5 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-popover transition-transform hover:scale-110", i.dot)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onFormat("foreColor", i.value === "default" ? undefined : INK_COMMAND_COLORS[i.value]);
                    setInkOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* highlight with dropdown */}
        <div ref={hlRef} className="relative flex shrink-0 items-center">
          <RibbonButton label="Highlight color" onClick={() => setHlOpen((o) => !o)}>
            <Highlighter className="size-4" />
          </RibbonButton>
          <button
            type="button"
            aria-label="Apply yellow highlight"
            className="-ml-1 grid size-7 place-items-center rounded-md hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat("hiliteColor", "#fde68a")}
          >
            <span className="block size-4 rounded-[3px] bg-yellow-300" />
          </button>
          {hlOpen && (
            <div className="absolute top-8 left-0 z-40 flex gap-1 rounded-xl border bg-popover p-2 shadow-lg">
              {HIGHLIGHT_SWATCHES.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  aria-label={h.dot}
                  title="Highlight"
                  className={cn("size-5 rounded-[4px] ring-2 ring-transparent ring-offset-2 ring-offset-popover transition-transform hover:scale-110", h.dot)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onFormat("hiliteColor", h.value);
                    setHlOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* lists */}
        <RibbonDivider />
        <RibbonButton label="Bullet list" active={state.ul} onClick={() => onFormat("insertUnorderedList")}>
          <List className="size-4" />
        </RibbonButton>
        <RibbonButton label="Numbered list" active={state.ol} onClick={() => onFormat("insertOrderedList")}>
          <ListOrdered className="size-4" />
        </RibbonButton>

        <span className="ml-auto hidden pl-2 text-[11px] text-muted-foreground sm:block">
          {savedLabel}
        </span>
      </div>

      {/* row 2: block format, B I U S, sub/sup, alignment, undo/redo */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2">
        {/* block format */}
        <select
          aria-label="Paragraph style"
          value={blockTag}
          onChange={(e) => onBlock(e.target.value)}
          className="h-7 shrink-0 rounded-md border bg-background px-1.5 text-xs font-medium outline-none"
        >
          {BLOCK_FORMATS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

        <RibbonDivider />

        {/* B I U S */}
        <RibbonButton label="Bold" active={state.bold} onClick={() => onFormat("bold")}>
          <Bold className="size-4" />
        </RibbonButton>
        <RibbonButton label="Italic" active={state.italic} onClick={() => onFormat("italic")}>
          <Italic className="size-4" />
        </RibbonButton>
        <RibbonButton label="Underline" active={state.underline} onClick={() => onFormat("underline")}>
          <Underline className="size-4" />
        </RibbonButton>
        <RibbonButton label="Strikethrough" active={state.strikeThrough} onClick={() => onFormat("strikeThrough")}>
          <Strikethrough className="size-4" />
        </RibbonButton>

        <RibbonDivider />

        {/* sub / superscript */}
        <RibbonButton label="Subscript" active={state.sub} onClick={() => onFormat("subscript")}>
          <Subscript className="size-4" />
        </RibbonButton>
        <RibbonButton label="Superscript" active={state.sup} onClick={() => onFormat("superscript")}>
          <Superscript className="size-4" />
        </RibbonButton>

        <RibbonDivider />

        {/* alignment */}
        <RibbonButton label="Align left" onClick={() => onFormat("justifyLeft")}>
          <AlignLeft className="size-4" />
        </RibbonButton>
        <RibbonButton label="Align center" onClick={() => onFormat("justifyCenter")}>
          <AlignCenter className="size-4" />
        </RibbonButton>
        <RibbonButton label="Align right" onClick={() => onFormat("justifyRight")}>
          <AlignRight className="size-4" />
        </RibbonButton>
        <RibbonButton label="Justify" onClick={() => onFormat("justifyFull")}>
          <AlignJustify className="size-4" />
        </RibbonButton>

        <RibbonDivider />

        {/* undo / redo */}
        <RibbonButton label="Undo" onClick={() => onFormat("undo")}>
          <Undo2 className="size-4" />
        </RibbonButton>
        <RibbonButton label="Redo" onClick={() => onFormat("redo")}>
          <Redo2 className="size-4" />
        </RibbonButton>

        <RibbonDivider />

        {/* flag selection → task */}
        <button
          type="button"
          aria-label="Flag selection as task"
          title="Flag selection: creates a task from the selected letters"
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onFlag}
        >
          <Flag className="size-3.5" />
          Flag
        </button>

        {/* line numbering (page-level) */}
        <button
          type="button"
          aria-pressed={numbered}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            numbered
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleNumbered}
        >
          <ListOrdered className="size-3.5" />
          Numbering
        </button>

        {/* notebook accent (page-level) */}
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-muted-foreground">Accent</span>
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={`${c.label} accent`}
              title={`${c.label} accent`}
              aria-pressed={accent === c.value}
              className={cn(
                "size-4 shrink-0 rounded-[4px] ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                c.dot,
                accent === c.value ? "ring-primary/60" : "ring-transparent",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAccent(c.value)}
            />
          ))}
        </div>

        {/* draw mode toggle */}
        <button
          type="button"
          aria-pressed={drawMode}
          title="Toggle draw mode"
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            drawMode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onClick={onToggleDraw}
        >
          <PencilLine className="size-3.5" />
          Draw
        </button>

        {/* image mode toggle */}
        <button
          type="button"
          aria-pressed={imageMode}
          title="Insert and edit images"
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            imageMode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onClick={onToggleImage}
        >
          <ImageIcon className="size-3.5" />
          Picture
        </button>
      </div>
    </div>
  );
}
