import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { NoteColor } from "@/convex/schema";
import { Button } from "@/components/ui/button";
import EditorRibbon from "@/components/EditorRibbon";
import {
  currentBlockTag,
  type FormatCmd,
  type FormatState,
  formatBlock,
  formatSelection,
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
  Loader2,
  PencilLine,
  Plus,
  StickyNote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PageId = Id<"notePages">;

// (accent palette lives in EditorRibbon now)

const ACCENT_CLASS: Record<NoteColor, string> = {
  default: "note-default",
  indigo: "note-indigo",
  violet: "note-violet",
  sky: "note-sky",
  teal: "note-teal",
  emerald: "note-emerald",
  amber: "note-amber",
  orange: "note-orange",
  rose: "note-rose",
  pink: "note-pink",
};

const ACCENT_DOT_CLASS: Record<NoteColor, string> = {
  default: "bg-muted-foreground/60",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Right-edge index tabs (notebook spine style, like the reference image)   */
/* ──────────────────────────────────────────────────────────────────────── */

const TAB_TINTS: { chip: string; text: string }[] = [
  { chip: "bg-rose-500", text: "text-white" },
  { chip: "bg-amber-500", text: "text-white" },
  { chip: "bg-emerald-500", text: "text-white" },
  { chip: "bg-sky-500", text: "text-white" },
  { chip: "bg-indigo-500", text: "text-white" },
  { chip: "bg-fuchsia-500", text: "text-white" },
];

function NotebookIndexTabs({
  pages,
  activePageId,
  onSelect,
  onAdd,
}: {
  pages: Doc<"notePages">[];
  activePageId: PageId | null;
  onSelect: (id: PageId) => void;
  onAdd: () => void;
}) {
  const topLevel = pages.filter((p) => !p.parentId);
  return (
    <div className="pointer-events-none absolute top-0 -right-3 bottom-0 z-20 hidden items-center lg:flex">
      <div className="pointer-events-auto flex flex-col gap-1">
        {topLevel.slice(0, 8).map((page, i) => {
          const active = activePageId === page._id;
          const tint = TAB_TINTS[i % TAB_TINTS.length];
          return (
            <button
              key={page._id}
              type="button"
              onClick={() => onSelect(page._id)}
              title={page.title}
              className={cn(
                "group flex h-11 w-9 items-center justify-center rounded-l-lg border border-r-0 shadow-sm transition-all",
                tint.chip,
                tint.text,
                active
                  ? "w-11 brightness-110"
                  : "opacity-80 hover:w-11 hover:opacity-100",
              )}
            >
              <span className="rotate-180 text-[10px] font-bold tracking-widest [writing-mode:vertical-rl]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          title="New page"
          className="flex h-9 w-9 items-center justify-center rounded-l-lg border border-r-0 bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page + sub-page tabs (horizontal, above the ribbon)                      */
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
      <div className="flex items-stretch gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
        {topLevel.map((page) => {
          const active = activePage?._id === page._id;
          return (
            <button
              key={page._id}
              type="button"
              onClick={() => onSelect(page._id)}
              className={cn(
                "flex max-w-48 shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${ACCENT_DOT_CLASS[page.color ?? "default"]}`}
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

      {activePage && (
        <div className="ml-12 flex items-stretch gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/20 p-0.5">
          <span className="flex shrink-0 items-center px-2 text-[10px] font-medium tracking-widest text-muted-foreground/60 uppercase">
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
                  "flex max-w-40 shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors",
                  active
                    ? "border-primary/30 bg-card text-foreground shadow-sm"
                    : "border-transparent bg-transparent hover:bg-card/70 hover:text-foreground",
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
            className="flex shrink-0 items-center gap-0.5 rounded-md px-2 py-0.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
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
/* Page canvas: ribbon above, paper below, drawing + flag inside            */
/* ──────────────────────────────────────────────────────────────────────── */

function PageCanvas({
  page,
  pages,
  onSelectPage,
  onNewPage,
  onNewSubPage,
  onFlagTask,
}: {
  page: Doc<"notePages">;
  pages: Doc<"notePages">[];
  onSelectPage: (id: PageId) => void;
  onNewPage: () => void;
  onNewSubPage: (parentId: PageId) => void;
  onFlagTask: (text: string, pageId: PageId) => Promise<void>;
}) {
  const updatePage = useMutation(api.notebooks.updatePage);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(() => toEditorHtml(page.body));
  const [numbered, setNumbered] = useState(page.numbered ?? false);
  const [accent, setAccent] = useState<NoteColor>(page.color ?? "default");
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    ul: false,
    ol: false,
    sub: false,
    sup: false,
  });
  const [blockTag, setBlockTag] = useState("p");
  const [savedTick, setSavedTick] = useState(0);

  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_SIZES[1].width);
  const [strokes, setStrokes] = useState(() => parseStrokes(page.drawing));

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
    drawing?: string;
    numbered?: boolean;
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

  const handleBlock = (tag: string) => {
    formatBlock(tag);
    setTimeout(() => {
      if (editorRef.current) {
        handleBodyChange(editorRef.current.innerHTML);
      }
      setBlockTag(currentBlockTag());
    }, 0);
  };

  const handleFlagSelection = async () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) {
      toast.error("Select some letters first, then press Flag.");
      return;
    }
    try {
      await onFlagTask(text.slice(0, 280), page._id);
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

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Word-style ribbon — OUTSIDE and ABOVE the paper, sticky */}
      {/* (page + sub-page tabs sit right below it) */}
      <EditorRibbon
        state={formatState}
        blockTag={blockTag}
        onBlock={handleBlock}
        onFormat={applyFormat}
        onPersist={() => {
          if (editorRef.current) handleBodyChange(editorRef.current.innerHTML);
        }}
        savedLabel={savedTick > 0 ? "Saved ✓" : "Autosaves as you type"}
        onFlag={handleFlagSelection}
        numbered={numbered}
        onToggleNumbered={() => {
          const next = !numbered;
          setNumbered(next);
          scheduleSave({ numbered: next });
        }}
        accent={accent}
        onAccent={(c) => {
          setAccent(c);
          scheduleSave({ color: c });
        }}
        drawMode={drawMode}
        onToggleDraw={() => setDrawMode(!drawMode)}
      />

      {/* page + sub-page tabs BELOW the modifier ribbon */}
      <PageTabs
        pages={pages}
        activePage={page}
        onSelect={onSelectPage}
        onAddTopLevel={onNewPage}
        onAddSubPage={onNewSubPage}
      />

      {/* paper with right-edge index tabs */}
      <div
        className={`${ACCENT_CLASS[accent]} note-card relative min-h-[32rem] flex-1 rounded-2xl border bg-card shadow-sm`}
      >
        <NotebookIndexTabs
          pages={pages}
          activePageId={page._id}
          onSelect={onSelectPage}
          onAdd={onNewPage}
        />
        {/* draw toolbar */}
        {drawMode && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2">
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
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-lg"
              onClick={() => handleDrawingChange(strokes.slice(0, -1))}
            >
              Undo stroke
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-lg text-destructive hover:text-destructive"
              onClick={() => handleDrawingChange([])}
            >
              Clear
            </Button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-col px-4 py-4 sm:px-10">
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
              className="w-full bg-transparent font-display text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
            />
            <div className="mt-2 mb-4 h-px w-12 bg-primary/50" />
            <RichTextEditor
              value={body}
              onChange={handleBodyChange}
              editorRef={editorRef}
              placeholder="Start writing… select letters to format or press Flag to turn them into tasks."
              fontClass="text-[15px]"
              onFormatStateChange={(state) => {
                setFormatState(state);
                setBlockTag(currentBlockTag());
              }}
            />
          </div>
        </div>

        {/* minimal footer: autosave status only (controls live in the ribbon) */}
        <div className="flex items-center border-t border-border/60 px-4 py-2 sm:px-10">
          <span className="ml-auto text-[11px] text-muted-foreground">
            {savedTick > 0 ? "Saved ✓" : "Autosaves as you type"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* NotesPanel                                                               */
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
      {activePage ? (
        <PageCanvas
          key={activePage._id}
          page={activePage}
          pages={pages}
          onSelectPage={onSelectPage}
          onNewPage={onNewPage}
          onNewSubPage={onNewSubPage}
          onFlagTask={onFlagTask}
        />
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
