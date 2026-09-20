import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { NoteColor, NoteFont } from "@/convex/schema";
import { Button } from "@/components/ui/button";
import {
  BLOCK_FORMATS,
  currentBlockTag,
  type FormatCmd,
  type FormatState,
  formatBlock,
  formatSelection,
  INK_COMMAND_COLORS,
  RichTextEditor,
  toEditorHtml,
} from "@/components/RichTextEditor";
import {
  PEN_SIZES,
  PEN_COLORS,
  DrawingCanvas,
  parseStrokes,
} from "@/components/DrawingCanvas";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Flag,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Palette,
  Pencil,
  PencilLine,
  Plus,
  Redo2,
  StickyNote,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PageId = Id<"notePages">;

const FONTS: { value: NoteFont; label: string; className: string }[] = [
  { value: "sans", label: "Sans", className: "font-sans" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
  { value: "hand", label: "Hand", className: "font-hand" },
];

const ACCENTS: { value: NoteColor; label: string; dot: string }[] = [
  { value: "default", label: "Plain", dot: "bg-muted-foreground/60" },
  { value: "indigo", label: "Indigo", dot: "bg-primary" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber", dot: "bg-amber-500" },
  { value: "rose", label: "Rose", dot: "bg-rose-500" },
  { value: "sky", label: "Sky", dot: "bg-sky-500" },
];

const INKS: { value: string; label: string; dot: string }[] = [
  { value: "default", label: "Default ink", dot: "bg-foreground/70" },
  { value: "indigo", label: "Indigo ink", dot: "bg-indigo-500" },
  { value: "emerald", label: "Emerald ink", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber ink", dot: "bg-amber-500" },
  { value: "rose", label: "Rose ink", dot: "bg-rose-500" },
  { value: "sky", label: "Sky ink", dot: "bg-sky-500" },
];

const HIGHLIGHTS: { value: string; label: string; dot: string }[] = [
  { value: "#fde68a", label: "Yellow highlight", dot: "bg-yellow-300" },
  { value: "#bbf7d0", label: "Green highlight", dot: "bg-green-300" },
  { value: "#bfdbfe", label: "Blue highlight", dot: "bg-blue-300" },
  { value: "#fbcfe8", label: "Pink highlight", dot: "bg-pink-300" },
  { value: "#e9d5ff", label: "Purple highlight", dot: "bg-purple-300" },
];

const ALIGNMENTS: { cmd: FormatCmd; label: string; icon: typeof AlignLeft }[] = [
  { cmd: "justifyLeft", label: "Align left", icon: AlignLeft },
  { cmd: "justifyCenter", label: "Align center", icon: AlignCenter },
  { cmd: "justifyRight", label: "Align right", icon: AlignRight },
  { cmd: "justifyFull", label: "Justify", icon: AlignJustify },
];

const ACCENT_CLASS: Record<NoteColor, string> = {
  default: "note-default",
  indigo: "note-indigo",
  emerald: "note-emerald",
  amber: "note-amber",
  rose: "note-rose",
  sky: "note-sky",
};

const ACCENT_DOT_CLASS: Record<NoteColor, string> = {
  default: "bg-muted-foreground/60",
  indigo: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

function fontClass(font: NoteFont | undefined): string {
  return FONTS.find((f) => f.value === font)?.className ?? "font-sans";
}

function resolveDefaultInk(): string {
  if (typeof window === "undefined") return "#1e1e2e";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();
  return v || "#1e1e2e";
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page tabs: top-level pages + sub-pages of the open page                  */
/* ──────────────────────────────────────────────────────────────────────── */

function PageTabs({
  pages,
  activePage,
  onSelect,
  onAddTopLevel,
  onAddSubPage,
}: {
  pages: Doc<"notePages">[];
  activePage: Doc<"notePages"> | null;
  onSelect: (id: PageId) => void;
  onAddTopLevel: () => void;
  onAddSubPage: (parentId: PageId) => void;
}) {
  const topLevel = pages.filter((p) => !p.parentId);
  const subPages = activePage
    ? pages.filter((p) => p.parentId === activePage._id)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      {/* top-level page tabs */}
      <div className="flex items-stretch gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
        {topLevel.map((page) => {
          const active = activePage?._id === page._id;
          return (
            <button
              key={page._id}
              type="button"
              onClick={() => onSelect(page._id)}
              className={cn(
                "flex max-w-44 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${ACCENT_DOT_CLASS[page.color ?? "default"]}`}
                aria-hidden
              />
              <span className="truncate">{page.title}</span>
              {pages.some((p) => p.parentId === page._id) && (
                <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                  +{pages.filter((p) => p.parentId === page._id).length}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAddTopLevel}
          aria-label="New page"
          title="New page"
          className="grid w-9 shrink-0 place-items-center rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* sub-page tabs for the open page */}
      {activePage && (
        <div className="ml-4 flex items-stretch gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-1">
          <span className="flex shrink-0 items-center px-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Sub-pages
          </span>
          {subPages.map((page) => {
            const active = activePage._id === page._id;
            return (
              <button
                key={page._id}
                type="button"
                onClick={() => onSelect(page._id)}
                className={cn(
                  "flex max-w-40 shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-card text-foreground shadow-sm"
                    : "border-transparent bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${ACCENT_DOT_CLASS[page.color ?? "default"]}`}
                  aria-hidden
                />
                <span className="truncate">{page.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onAddSubPage(activePage._id)}
            className="flex shrink-0 items-center gap-1 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-3" />
            Sub-page
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page canvas: rich text + drawing + flag-to-task, autosaved               */
/* ──────────────────────────────────────────────────────────────────────── */

function PageCanvas({
  page,
  onFlagTask,
}: {
  page: Doc<"notePages">;
  onFlagTask: (text: string, pageId: PageId) => Promise<void>;
}) {
  const updatePage = useMutation(api.notebooks.updatePage);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(() => toEditorHtml(page.body));
  const [numbered, setNumbered] = useState(page.numbered ?? false);
  const [font, setFont] = useState<NoteFont>(page.font ?? "sans");
  const [accent, setAccent] = useState<NoteColor>(page.color ?? "default");
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    ul: false,
    ol: false,
  });
  const [blockTag, setBlockTag] = useState("p");
  const [savedTick, setSavedTick] = useState(0);

  // drawing state
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_SIZES[1].width);
  const [strokes, setStrokes] = useState(() => parseStrokes(page.drawing));

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
    drawing?: string;
    numbered?: boolean;
    font?: NoteFont;
    color?: NoteColor;
  }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updatePage({ id: page._id, ...patch })
        .then(() => setSavedTick((t) => t + 1))
        .catch((error: unknown) =>
          toast.error(
            error instanceof Error ? error.message : "Couldn't save changes.",
          ),
        );
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleBodyChange = (html: string) => {
    setBody(html);
    scheduleSave({ body: html });
  };

  const applyFormat = (cmd: FormatCmd, arg?: string) => {
    formatSelection(cmd, arg);
    setTimeout(() => {
      if (editorRef.current) {
        handleBodyChange(editorRef.current.innerHTML);
      }
    }, 0);
  };

  const handleInk = (inkValue: string) => {
    const color =
      inkValue === "default"
        ? resolveDefaultInk()
        : (INK_COMMAND_COLORS[inkValue] ?? resolveDefaultInk());
    applyFormat("foreColor", color);
  };

  const handleBlock = (tag: string) => {
    formatBlock(tag);
    setTimeout(() => {
      if (editorRef.current) {
        handleBodyChange(editorRef.current.innerHTML);
      }
      setBlockTag(currentBlockTag());
    }, 0);
  };

  /** Flag the selected letters: create a task + mark the text. */
  const handleFlagSelection = async () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) {
      toast.error("Select some letters first, then press Flag.");
      return;
    }
    try {
      await onFlagTask(text.slice(0, 280), page._id);
      // visual mark: wrap in <mark class="flag-mark"> when possible
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        try {
          const mark = document.createElement("mark");
          mark.className = "flag-mark";
          range.surroundContents(mark);
          sel.removeAllRanges();
        } catch {
          formatSelection("hiliteColor", "#fde68a");
        }
        if (editorRef.current) {
          handleBodyChange(editorRef.current.innerHTML);
        }
      }
      toast.success("Flagged! Added to your task list.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't flag that text.",
      );
    }
  };

  const handleDrawingChange = (next: typeof strokes) => {
    setStrokes(next);
    scheduleSave({ drawing: JSON.stringify(next) });
  };

  const toolBtn = (active: boolean) =>
    `grid size-7 place-items-center rounded-lg transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <div
      className={`${ACCENT_CLASS[accent]} note-card flex min-h-[30rem] flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm`}
    >
      {/* formatting toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2.5">
        {/* block format */}
        <select
          aria-label="Paragraph style"
          value={blockTag}
          onChange={(e) => handleBlock(e.target.value)}
          className="h-7 rounded-lg border bg-background px-1.5 text-xs font-medium text-foreground outline-none"
        >
          {BLOCK_FORMATS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

        {/* fonts */}
        <div className="flex items-center gap-1">
          <Type className="mr-0.5 size-3.5 text-muted-foreground" />
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-label={`${f.label} font`}
              aria-pressed={font === f.value}
              className={`h-7 rounded-lg px-2 text-xs font-medium transition-colors ${f.className} ${
                font === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setFont(f.value);
                scheduleSave({ font: f.value });
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* B I U S */}
        <div className="flex items-center gap-0.5">
          {(
            [
              { cmd: "bold" as FormatCmd, label: "Bold", icon: Bold, state: formatState.bold },
              { cmd: "italic" as FormatCmd, label: "Italic", icon: Italic, state: formatState.italic },
              { cmd: "underline" as FormatCmd, label: "Underline", icon: Underline, state: formatState.underline },
              { cmd: "strikeThrough" as FormatCmd, label: "Strikethrough", icon: Strikethrough, state: formatState.strikeThrough },
            ] as const
          ).map(({ cmd, label, icon: Icon, state }) => (
            <button
              key={cmd}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={state}
              className={toolBtn(state)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(cmd)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        {/* ink */}
        <div className="flex items-center gap-1">
          <Palette className="mr-0.5 size-3.5 text-muted-foreground" />
          {INKS.map((i) => (
            <button
              key={i.value}
              type="button"
              aria-label={`Apply ${i.label} to selection`}
              title={`Apply ${i.label} to selection`}
              className="size-5 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-card transition-transform hover:scale-110"
              style={{ backgroundColor: i.dot.startsWith("bg-") ? undefined : undefined }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInk(i.value)}
            >
              <span className={cn("block size-5 rounded-full", i.dot)} />
            </button>
          ))}
        </div>

        {/* highlighter + clear */}
        <div className="flex items-center gap-1">
          <Highlighter className="mr-0.5 size-3.5 text-muted-foreground" />
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.value}
              type="button"
              aria-label={`Apply ${h.label} to selection`}
              title={`Apply ${h.label} to selection`}
              className={cn("size-5 rounded-[5px] ring-2 ring-transparent ring-offset-2 ring-offset-card transition-transform hover:scale-110", h.dot)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat("hiliteColor", h.value)}
            />
          ))}
          <button
            type="button"
            aria-label="Clear formatting"
            title="Clear formatting"
            className={cn(toolBtn(false), "ml-1")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("removeFormat")}
          >
            <Eraser className="size-4" />
          </button>
        </div>

        {/* alignment */}
        <div className="flex items-center gap-0.5">
          {ALIGNMENTS.map(({ cmd, label, icon: Icon }) => (
            <button
              key={cmd}
              type="button"
              aria-label={label}
              title={label}
              className={toolBtn(false)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(cmd)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        {/* lists */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Bullet list"
            title="Bullet list"
            aria-pressed={formatState.ul}
            className={toolBtn(formatState.ul)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("insertUnorderedList")}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Numbered list"
            title="Numbered list"
            aria-pressed={formatState.ol}
            className={toolBtn(formatState.ol)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("insertOrderedList")}
          >
            <ListOrdered className="size-4" />
          </button>
        </div>

        {/* undo/redo */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={toolBtn(false)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("undo")}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className={toolBtn(false)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("redo")}
          >
            <Redo2 className="size-4" />
          </button>
        </div>

        {/* flag selection → task */}
        <button
          type="button"
          aria-label="Flag selection as task"
          title="Flag selection: creates a task from the selected letters"
          className="flex h-7 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleFlagSelection}
        >
          <Flag className="size-3.5" />
          Flag
        </button>

        {/* page-level: numbering + accent */}
        <button
          type="button"
          aria-pressed={numbered}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
            numbered
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const next = !numbered;
            setNumbered(next);
            scheduleSave({ numbered: next });
          }}
        >
          <ListOrdered className="size-3.5" />
          Numbering
        </button>

        <div className="flex items-center gap-1">
          <span className="mr-0.5 text-xs text-muted-foreground">Accent</span>
          {ACCENTS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={`${c.label} accent`}
              aria-pressed={accent === c.value}
              className={cn(
                "size-4 rounded-[4px] ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                c.dot,
                accent === c.value ? "ring-primary/60" : "ring-transparent",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAccent(c.value);
                scheduleSave({ color: c.value });
              }}
            />
          ))}
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground">
          {savedTick > 0 ? "Saved ✓" : "Autosaves as you type"}
        </span>
      </div>

      {/* draw toolbar (only in draw mode) */}
      {drawMode && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 bg-muted/30 px-4 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <PencilLine className="size-3.5" />
            Drawing
          </span>
          <div className="flex items-center gap-1">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Pen color ${color}`}
                aria-pressed={penColor === color}
                className={cn(
                  "size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                  penColor === color ? "ring-primary/60" : "ring-transparent",
                )}
                style={{ backgroundColor: color }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPenColor(color)}
              />
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {PEN_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                aria-label={`${s.label} pen`}
                aria-pressed={penWidth === s.width}
                className={cn(
                  "grid h-7 w-8 place-items-center rounded-lg text-xs font-medium transition-colors",
                  penWidth === s.width
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPenWidth(s.width)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg"
            onClick={() => handleDrawingChange(strokes.slice(0, -1))}
          >
            <Undo2 className="size-3.5" />
            Undo stroke
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-destructive hover:text-destructive"
            onClick={() => handleDrawingChange([])}
          >
            <Eraser className="size-3.5" />
            Clear
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Draw anywhere on the page with your mouse.
          </span>
        </div>
      )}

      {/* paper */}
      <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8">
        <DrawingCanvas
          strokes={strokes}
          onChange={handleDrawingChange}
          active={drawMode}
          penColor={penColor}
          penWidth={penWidth}
        />
        <div className={drawMode ? "pointer-events-none opacity-60" : ""}>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave({ title: e.target.value });
            }}
            maxLength={160}
            placeholder="Page title"
            aria-label="Page title"
            className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
          />
          <div className="mt-2 mb-4 h-px w-12 bg-primary/50" />
          <RichTextEditor
            value={body}
            onChange={handleBodyChange}
            editorRef={editorRef}
            placeholder="Start writing… select letters to format or press Flag to turn them into tasks."
            numbered={numbered}
            fontClass={fontClass(font)}
            onFormatStateChange={(state) => {
              setFormatState(state);
              setBlockTag(currentBlockTag());
            }}
          />
        </div>
      </div>

      {/* draw toggle (bottom-right corner) */}
      <button
        type="button"
        aria-pressed={drawMode}
        title="Toggle draw mode"
        className={cn(
          "absolute right-4 bottom-4 z-20 flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium shadow-md transition-colors",
          drawMode
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setDrawMode(!drawMode)}
      >
        <Pencil className="size-3.5" />
        {drawMode ? "Done drawing" : "Draw"}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* NotesPanel: tabs + canvas + empty states                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export default function NotesPanel({
  activePage,
  pages,
  pagesLoading,
  onNewPage,
  onNewSubPage,
  onSelectPage,
  onFlagTask,
}: {
  activePage: Doc<"notePages"> | null;
  pages: Doc<"notePages">[];
  pagesLoading: boolean;
  onNewPage: () => void;
  onNewSubPage: (parentId: PageId) => void;
  onSelectPage: (pageId: PageId) => void;
  onFlagTask: (text: string, pageId: PageId) => Promise<void>;
}) {
  if (pagesLoading && !activePage) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-5 py-14 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activePage && (
        <PageTabs
          pages={pages}
          activePage={activePage}
          onSelect={onSelectPage}
          onAddTopLevel={onNewPage}
          onAddSubPage={onNewSubPage}
        />
      )}

      {activePage ? (
        <PageCanvas key={activePage._id} page={activePage} onFlagTask={onFlagTask} />
      ) : (
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
          <StickyNote className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No page selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a page from the side menu, or add a new one.
          </p>
          <Button onClick={onNewPage} className="mt-5 rounded-xl">
            <Plus className="size-4" />
            New page
          </Button>
        </div>
      )}
    </div>
  );
}
