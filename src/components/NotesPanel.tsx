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
  ImageLayer,
  parseImages,
} from "@/components/ImageLayer";
import {
  ChevronsLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Notebook,
  PencilLine,
  Plus,
  StickyNote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NotebookId = Id<"notebooks">;
type PageId = Id<"notePages">;

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

/* ──────────────────────────────────────────────────────────────────────── */
/* OneNote-style column strip: Notebooks ▸ Pages ▸ Sub-pages                */
/* ──────────────────────────────────────────────────────────────────────── */

function ColumnHeader({
  children,
  onAdd,
}: {
  children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-1.5">
      <span className="truncate text-[11px] font-semibold tracking-widest text-muted-foreground/80 uppercase">
        {children}
      </span>
      {onAdd && (
        <button
          type="button"
          aria-label="Add"
          className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onAdd}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function NotebookColumns({
  notebooks,
  activeNotebookId,
  pages,
  activePage,
  onSelectNotebook,
  onSelectPage,
  onNewPage,
  onNewSubPage,
  onNewNotebook,
}: {
  notebooks: Doc<"notebooks">[];
  activeNotebookId: NotebookId | null;
  pages: Doc<"notePages">[];
  activePage: Doc<"notePages"> | null;
  onSelectNotebook: (id: NotebookId) => void;
  onSelectPage: (id: PageId) => void;
  onNewPage: () => void;
  onNewSubPage: (parentId: PageId) => void;
  onNewNotebook: () => void;
}) {
  const topLevel = pages.filter((p) => !p.parentId);
  const subPages = activePage
    ? pages.filter((p) => p.parentId === activePage._id)
    : [];

  return (
    <div className="flex overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* column 1: notebooks */}
      <div className="w-40 shrink-0 border-r border-border/60">
        <ColumnHeader onAdd={onNewNotebook}>Notebooks</ColumnHeader>
        <div className="max-h-52 overflow-y-auto p-1">
          {notebooks.map((nb) => {
            const active = nb._id === activeNotebookId;
            return (
              <button
                key={nb._id}
                type="button"
                onClick={() => onSelectNotebook(nb._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-accent",
                )}
              >
                <Notebook className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/60")} />
                <span className="truncate">{nb.title}</span>
              </button>
            );
          })}
          {notebooks.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">None yet.</p>
          )}
        </div>
      </div>

      {/* column 2: pages */}
      <div className="w-44 shrink-0 border-r border-border/60">
        <ColumnHeader onAdd={onNewPage}>Pages</ColumnHeader>
        <div className="max-h-52 overflow-y-auto p-1">
          {topLevel.map((page) => {
            const active = activePage?._id === page._id;
            return (
              <button
                key={page._id}
                type="button"
                onClick={() => onSelectPage(page._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-accent",
                )}
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", ACCENT_DOT_CLASS[page.color ?? "default"])}
                  aria-hidden
                />
                <span className="truncate">{page.title}</span>
              </button>
            );
          })}
          {topLevel.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No pages.</p>
          )}
        </div>
      </div>

      {/* column 3: sub-pages */}
      <div className="min-w-0 flex-1">
        <ColumnHeader onAdd={activePage ? () => onNewSubPage(activePage._id) : undefined}>
          Sub-pages
        </ColumnHeader>
        <div className="max-h-52 overflow-y-auto p-1">
          {activePage ? (
            <>
              {subPages.map((page) => {
                const active = activePage._id === page._id;
                return (
                  <button
                    key={page._id}
                    type="button"
                    onClick={() => onSelectPage(page._id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-xs transition-colors pl-5",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <FileText className="size-3 shrink-0 opacity-60" />
                    <span className="truncate">{page.title}</span>
                  </button>
                );
              })}
              {subPages.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No sub-pages in this page.
                </p>
              )}
            </>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Select a page first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page canvas: ribbon, columns, paper, drawing + images                    */
/* ──────────────────────────────────────────────────────────────────────── */

function PageCanvas({
  page,
  pages,
  notebooks,
  activeNotebookId,
  onSelectNotebook,
  onSelectPage,
  onNewPage,
  onNewSubPage,
  onNewNotebook,
  onFlagTask,
}: {
  page: Doc<"notePages">;
  pages: Doc<"notePages">[];
  notebooks: Doc<"notebooks">[];
  activeNotebookId: NotebookId | null;
  onSelectNotebook: (id: NotebookId) => void;
  onSelectPage: (id: PageId) => void;
  onNewPage: () => void;
  onNewSubPage: (parentId: PageId) => void;
  onNewNotebook: () => void;
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

  const [imageMode, setImageMode] = useState(false);
  const [images, setImages] = useState(() => parseImages(page.images));

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
    drawing?: string;
    images?: string;
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

  const handleImagesChange = (next: typeof images) => {
    setImages(next);
    scheduleSave({ images: JSON.stringify(next) });
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Word-style ribbon — OUTSIDE and ABOVE the paper, sticky */}
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
        onToggleDraw={() => {
          setDrawMode(!drawMode);
          if (!drawMode) setImageMode(false);
        }}
        imageMode={imageMode}
        onToggleImage={() => {
          setImageMode(!imageMode);
          if (!imageMode) setDrawMode(false);
        }}
      />

      {/* OneNote-style columns: Notebooks ▸ Pages ▸ Sub-pages */}
      <NotebookColumns
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        pages={pages}
        activePage={page}
        onSelectNotebook={onSelectNotebook}
        onSelectPage={onSelectPage}
        onNewPage={onNewPage}
        onNewSubPage={onNewSubPage}
        onNewNotebook={onNewNotebook}
      />

      {/* paper */}
      <div
        className={`${ACCENT_CLASS[accent]} note-card relative min-h-[32rem] flex-1 rounded-2xl border bg-card shadow-sm`}
      >
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

        {/* image-mode hint */}
        {imageMode && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold uppercase">
              <ImageIcon className="size-3.5" />
              Images
            </span>
            <span>Drag images to move · corner handle to resize · amber handle to crop · × to remove</span>
          </div>
        )}

        <div className="relative flex min-h-0 flex-col px-4 py-4 sm:px-10">
          <ImageLayer
            images={images}
            onChange={handleImagesChange}
            active={imageMode}
            onActiveChange={setImageMode}
          />
          <DrawingCanvas
            strokes={strokes}
            onChange={handleDrawingChange}
            active={drawMode}
            penColor={penColor}
            penWidth={penWidth}
          />
          <div className={drawMode || imageMode ? "pointer-events-none opacity-60" : ""}>
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
              placeholder="Start writing… select letters to format, press Flag for tasks, or insert pictures."
              fontClass="text-[15px]"
              onFormatStateChange={(state) => {
                setFormatState(state);
                setBlockTag(currentBlockTag());
              }}
            />
          </div>
        </div>

        {/* minimal footer */}
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
  notebooks,
  activeNotebookId,
  pagesLoading,
  onSelectNotebook,
  onSelectPage,
  onNewPage,
  onNewSubPage,
  onNewNotebook,
  onFlagTask,
}: {
  activePage: Doc<"notePages"> | null;
  pages: Doc<"notePages">[];
  notebooks: Doc<"notebooks">[];
  activeNotebookId: NotebookId | null;
  pagesLoading: boolean;
  onSelectNotebook: (id: NotebookId) => void;
  onSelectPage: (id: PageId) => void;
  onNewPage: () => void;
  onNewSubPage: (parentId: PageId) => void;
  onNewNotebook: () => void;
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

  if (!activePage) {
    return (
      <div className="flex flex-col gap-3">
        {notebooks.length > 0 && (
          <NotebookColumns
            notebooks={notebooks}
            activeNotebookId={activeNotebookId}
            pages={pages}
            activePage={null}
            onSelectNotebook={onSelectNotebook}
            onSelectPage={onSelectPage}
            onNewPage={onNewPage}
            onNewSubPage={() => {}}
            onNewNotebook={onNewNotebook}
          />
        )}
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
          <StickyNote className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No page selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a page from the columns above or the side menu.
          </p>
          <Button onClick={onNewPage} className="mt-5 rounded-xl">
            <Plus className="size-4" />
            New page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageCanvas
      key={activePage._id}
      page={activePage}
      pages={pages}
      notebooks={notebooks}
      activeNotebookId={activeNotebookId}
      onSelectNotebook={onSelectNotebook}
      onSelectPage={onSelectPage}
      onNewPage={onNewPage}
      onNewSubPage={onNewSubPage}
      onNewNotebook={onNewNotebook}
      onFlagTask={onFlagTask}
    />
  );
}
