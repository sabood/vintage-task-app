import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
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
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Palette,
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

function fontClass(font: NoteFont | undefined): string {
  return FONTS.find((f) => f.value === font)?.className ?? "font-sans";
}

/** Resolve the theme's default text color for "default" ink selection. */
function resolveDefaultInk(): string {
  if (typeof window === "undefined") return "#1e1e2e";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();
  return v || "#1e1e2e";
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page canvas: direct rich-text editing, autosaved                         */
/* ──────────────────────────────────────────────────────────────────────── */

function PageCanvas({ page }: { page: Doc<"notePages"> }) {
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

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
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

  const handleHighlight = (hex: string) => {
    applyFormat("hiliteColor", hex);
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

  return (
    <div
      className={`${ACCENT_CLASS[accent]} note-card flex min-h-[30rem] flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm`}
    >
      {/* formatting toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2.5">
        {/* block format picker */}
        <select
          aria-label="Paragraph style"
          value={blockTag}
          onChange={(e) => handleBlock(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-7 rounded-lg border bg-background px-1.5 text-xs font-medium text-foreground outline-none"
        >
          {BLOCK_FORMATS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

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

        {/* inline styles: B I U S */}
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
              className={`grid size-7 place-items-center rounded-lg transition-colors ${
                state
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormat(cmd)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        {/* ink colors (selected letters) */}
        <div className="flex items-center gap-1">
          <Palette className="mr-0.5 size-3.5 text-muted-foreground" />
          {INKS.map((i) => (
            <button
              key={i.value}
              type="button"
              aria-label={`Apply ${i.label} to selection`}
              title={`Apply ${i.label} to selection`}
              className={`size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${i.dot} ring-transparent`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInk(i.value)}
            />
          ))}
        </div>

        {/* highlighter (selected letters) */}
        <div className="flex items-center gap-1">
          <Highlighter className="mr-0.5 size-3.5 text-muted-foreground" />
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.value}
              type="button"
              aria-label={`Apply ${h.label} to selection`}
              title={`Apply ${h.label} to selection`}
              className={`size-5 rounded-[5px] ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${h.dot} ring-transparent`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleHighlight(h.value)}
            />
          ))}
          <button
            type="button"
            aria-label="Clear formatting"
            title="Clear formatting"
            className="ml-1 grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            className={`grid size-7 place-items-center rounded-lg transition-colors ${
              formatState.ul
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
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
            className={`grid size-7 place-items-center rounded-lg transition-colors ${
              formatState.ol
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("insertOrderedList")}
          >
            <ListOrdered className="size-4" />
          </button>
        </div>

        {/* history */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("undo")}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat("redo")}
          >
            <Redo2 className="size-4" />
          </button>
        </div>

        {/* page-level options */}
        <button
          type="button"
          aria-pressed={numbered}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            numbered
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
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
              className={`size-4 rounded-[4px] ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${c.dot} ${
                accent === c.value ? "ring-primary/60" : "ring-transparent"
              }`}
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

      {/* paper */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8">
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
          placeholder="Start writing… select letters to format. Ctrl+B/I/U work too."
          numbered={numbered}
          fontClass={fontClass(font)}
          onFormatStateChange={(state) => {
            setFormatState(state);
            setBlockTag(currentBlockTag());
          }}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* NotesPanel: canvas + empty states (tree lives in the side menu)          */
/* ──────────────────────────────────────────────────────────────────────── */

export default function NotesPanel({
  activePage,
  pagesLoading,
  onNewPage,
}: {
  activePage: Doc<"notePages"> | null;
  pagesLoading: boolean;
  onNewPage: () => void;
}) {
  if (pagesLoading && !activePage) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-5 py-14 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!activePage) {
    return (
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
    );
  }

  return <PageCanvas key={activePage._id} page={activePage} />;
}
