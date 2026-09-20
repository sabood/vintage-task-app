import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { NoteColor, NoteFont, NoteInk } from "@/convex/schema";
import { Button } from "@/components/ui/button";
import {
  ListOrdered,
  Loader2,
  Notebook,
  Palette,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type NotebookId = Id<"notebooks">;
type PageId = Id<"notePages">;

const FONTS: { value: NoteFont; label: string; className: string }[] = [
  { value: "sans", label: "Sans", className: "font-sans" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
  { value: "hand", label: "Hand", className: "font-hand" },
];

const INKS: { value: NoteInk; label: string; dot: string }[] = [
  { value: "default", label: "Ink", dot: "bg-foreground/70" },
  { value: "indigo", label: "Indigo", dot: "bg-primary" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-600" },
  { value: "amber", label: "Amber", dot: "bg-amber-600" },
  { value: "rose", label: "Rose", dot: "bg-rose-600" },
  { value: "sky", label: "Sky", dot: "bg-sky-600" },
];

const ACCENTS: { value: NoteColor; label: string; dot: string }[] = [
  { value: "default", label: "Plain", dot: "bg-muted-foreground/60" },
  { value: "indigo", label: "Indigo", dot: "bg-primary" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { value: "amber", label: "Amber", dot: "bg-amber-500" },
  { value: "rose", label: "Rose", dot: "bg-rose-500" },
  { value: "sky", label: "Sky", dot: "bg-sky-500" },
];

// Static maps so Tailwind can statically extract the custom utilities
const ACCENT_CLASS: Record<NoteColor, string> = {
  default: "note-default",
  indigo: "note-indigo",
  emerald: "note-emerald",
  amber: "note-amber",
  rose: "note-rose",
  sky: "note-sky",
};

const INK_TEXT_CLASS: Record<NoteInk, string> = {
  default: "",
  indigo: "text-primary",
  emerald: "text-emerald-700 dark:text-emerald-400",
  amber: "text-amber-700 dark:text-amber-400",
  rose: "text-rose-700 dark:text-rose-400",
  sky: "text-sky-700 dark:text-sky-400",
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

/* ──────────────────────────────────────────────────────────────────────── */
/* Notebook picker                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function NotebookSidebar({
  notebooks,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  notebooks: Doc<"notebooks">[];
  activeId: NotebookId | null;
  onSelect: (id: NotebookId) => void;
  onNew: () => void;
  onRename: (nb: Doc<"notebooks">) => void;
  onDelete: (nb: Doc<"notebooks">) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Notebook className="size-3.5" />
          Notebooks
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="New notebook" onClick={onNew}>
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto p-2">
        {notebooks.length === 0 && (
          <p className="px-1 py-3 text-xs text-muted-foreground">No notebooks yet.</p>
        )}
        {notebooks.map((nb) => (
          <button
            key={nb._id}
            type="button"
            onClick={() => onSelect(nb._id)}
            className={`group/nb flex min-w-36 flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
              activeId === nb._id
                ? "border-primary/40 bg-primary/5"
                : "border-transparent hover:bg-accent"
            }`}
          >
            <span className="line-clamp-2 w-full text-sm font-medium leading-snug break-words">
              {nb.title}
            </span>
            <span className="flex gap-0.5 opacity-0 transition-opacity group-hover/nb:opacity-100">
              <span
                role="button"
                tabIndex={0}
                aria-label={`Rename “${nb.title}”`}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(nb);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onRename(nb);
                  }
                }}
              >
                <Pencil className="size-3" />
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Delete “${nb.title}”`}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(nb);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onDelete(nb);
                  }
                }}
              >
                <Trash2 className="size-3" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page index strip on top of the open notebook                             */
/* ──────────────────────────────────────────────────────────────────────── */

function PageIndex({
  pages,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: {
  pages: Doc<"notePages">[];
  activeId: PageId | null;
  onSelect: (id: PageId) => void;
  onAdd: () => void;
  onRename: (page: Doc<"notePages">) => void;
  onDelete: (page: Doc<"notePages">) => void;
}) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto rounded-2xl border bg-muted/40 p-1.5">
      {pages.map((page, i) => (
        <div key={page._id} className="group/pg relative shrink-0">
          <button
            type="button"
            onClick={() => onSelect(page._id)}
            className={`flex w-32 flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
              activeId === page._id
                ? "border-primary/40 bg-card shadow-sm"
                : "border-border/70 bg-card/60 hover:bg-card"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
              <span
                className={`size-1.5 rounded-full ${ACCENT_DOT_CLASS[page.color ?? "default"]}`}
                aria-hidden
              />
              Page {i + 1}
            </span>
            <span className="line-clamp-1 text-xs font-medium">{page.title}</span>
          </button>
          <span className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 transition-opacity group-focus-within/pg:opacity-100 group-hover/pg:opacity-100">
            <button
              type="button"
              aria-label={`Rename “${page.title}”`}
              className="grid size-5 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground"
              onClick={() => onRename(page)}
            >
              <Pencil className="size-2.5" />
            </button>
            <button
              type="button"
              aria-label={`Delete “${page.title}”`}
              className="grid size-5 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-destructive"
              onClick={() => onDelete(page)}
            >
              <Trash2 className="size-2.5" />
            </button>
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="size-4" />
        New page
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Page canvas: direct inline editing, autosaved — no popup                 */
/* ──────────────────────────────────────────────────────────────────────── */

function PageCanvas({ page }: { page: Doc<"notePages"> }) {
  const updatePage = useMutation(api.notebooks.updatePage);

  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [numbered, setNumbered] = useState(page.numbered ?? false);
  const [font, setFont] = useState<NoteFont>(page.font ?? "sans");
  const [ink, setInk] = useState<NoteInk>(page.inkColor ?? "default");
  const [accent, setAccent] = useState<NoteColor>(page.color ?? "default");
  const [savedTick, setSavedTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
    numbered?: boolean;
    font?: NoteFont;
    inkColor?: NoteInk;
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

  const bodyLines = body.split("\n");
  const inkText = INK_TEXT_CLASS[ink];

  return (
    <div
      className={`${ACCENT_CLASS[accent]} note-card flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm`}
    >
      {/* formatting toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-2.5">
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
              onClick={() => {
                setFont(f.value);
                scheduleSave({ font: f.value });
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Palette className="mr-0.5 size-3.5 text-muted-foreground" />
          {INKS.map((i) => (
            <button
              key={i.value}
              type="button"
              aria-label={`${i.label} ink color`}
              aria-pressed={ink === i.value}
              className={`size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${i.dot} ${
                ink === i.value ? "ring-primary/60" : "ring-transparent"
              }`}
              onClick={() => {
                setInk(i.value);
                scheduleSave({ inkColor: i.value });
              }}
            />
          ))}
        </div>

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
              onClick={() => {
                setAccent(c.value);
                scheduleSave({ color: c.value });
              }}
            />
          ))}
        </div>

        <button
          type="button"
          aria-pressed={numbered}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            numbered
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={() => {
            const next = !numbered;
            setNumbered(next);
            scheduleSave({ numbered: next });
          }}
        >
          <ListOrdered className="size-3.5" />
          Numbering
        </button>

        <span className="ml-auto text-[11px] text-muted-foreground">
          {savedTick > 0 ? "Saved ✓" : "Autosaves as you type"}
        </span>
      </div>

      {/* paper */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave({ title: e.target.value });
          }}
          maxLength={160}
          placeholder="Page title"
          aria-label="Page title"
          className={`w-full bg-transparent font-display text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40 ${inkText}`}
        />
        <div className="mt-2 mb-4 h-px w-12 bg-primary/50" />
        <div className="flex min-h-0 flex-1">
          {numbered && (
            <div
              aria-hidden
              className={`mr-1 w-6 shrink-0 border-r border-border/60 pt-0.5 text-right ${fontClass(font)} ${inkText}`}
            >
              {bodyLines.map((_, i) => (
                <div
                  key={i}
                  className="note-line-num pr-1.5 text-[11px] leading-6 opacity-60"
                >
                  {i + 1}.
                </div>
              ))}
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleSave({ body: e.target.value });
            }}
            maxLength={20000}
            aria-label="Page body"
            placeholder="Start writing…"
            className={`min-h-56 w-full flex-1 resize-none bg-transparent leading-6 outline-none placeholder:text-muted-foreground/40 ${fontClass(font)} ${inkText}`}
          />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* NotesPanel                                                               */
/* ──────────────────────────────────────────────────────────────────────── */

export default function NotesPanel() {
  const notebooks = useQuery(api.notebooks.listNotebooks);
  const addNotebook = useMutation(api.notebooks.addNotebook);
  const renameNotebook = useMutation(api.notebooks.renameNotebook);
  const removeNotebook = useMutation(api.notebooks.removeNotebook);
  const addPage = useMutation(api.notebooks.addPage);
  const updatePageRemote = useMutation(api.notebooks.updatePage);
  const removePage = useMutation(api.notebooks.removePage);

  const [activeNotebookId, setActiveNotebookId] = useState<NotebookId | null>(null);
  const [activePageId, setActivePageId] = useState<PageId | null>(null);

  const nbList = notebooks ?? [];
  const activeNotebook =
    nbList.find((nb) => nb._id === activeNotebookId) ?? nbList[0] ?? null;
  const notebookId = activeNotebook?._id ?? null;

  const pages = useQuery(
    api.notebooks.listPages,
    notebookId ? { notebookId } : "skip",
  );
  const pageList = pages ?? [];
  const activePage =
    pageList.find((p) => p._id === activePageId) ?? pageList[0] ?? null;

  const handleNewNotebook = async () => {
    const title = window.prompt("Notebook name", "My notebook");
    if (title === null) return;
    const clean = title.trim();
    if (!clean) {
      toast.error("Give the notebook a name.");
      return;
    }
    try {
      const id = await addNotebook({ title: clean });
      setActiveNotebookId(id);
      setActivePageId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create notebook.",
      );
    }
  };

  const handleRenameNotebook = async (nb: Doc<"notebooks">) => {
    const title = window.prompt("Rename notebook", nb.title);
    if (title === null) return;
    const clean = title.trim();
    if (!clean) return;
    try {
      await renameNotebook({ id: nb._id, title: clean });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't rename notebook.",
      );
    }
  };

  const handleDeleteNotebook = async (nb: Doc<"notebooks">) => {
    if (!window.confirm(`Delete “${nb.title}” and all of its pages?`)) return;
    try {
      await removeNotebook({ id: nb._id });
      if (activeNotebookId === nb._id) setActiveNotebookId(null);
      setActivePageId(null);
      toast.success("Notebook deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't delete notebook.",
      );
    }
  };

  const handleAddPage = async () => {
    if (!notebookId) return;
    try {
      const id = await addPage({ notebookId });
      setActivePageId(id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create page.",
      );
    }
  };

  const handleRenamePage = async (page: Doc<"notePages">) => {
    const title = window.prompt("Rename page", page.title);
    if (title === null) return;
    const clean = title.trim();
    if (!clean) return;
    try {
      await updatePageRemote({ id: page._id, title: clean });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't rename page.",
      );
    }
  };

  const handleDeletePage = async (page: Doc<"notePages">) => {
    if (!window.confirm(`Delete “${page.title}”?`)) return;
    try {
      await removePage({ id: page._id });
      if (activePageId === page._id) setActivePageId(null);
      toast.success("Page deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't delete page.",
      );
    }
  };

  if (notebooks === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-5 py-14 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading your notebooks…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <NotebookSidebar
        notebooks={nbList}
        activeId={notebookId}
        onSelect={(id) => {
          setActiveNotebookId(id);
          setActivePageId(null);
        }}
        onNew={handleNewNotebook}
        onRename={handleRenameNotebook}
        onDelete={handleDeleteNotebook}
      />

      {nbList.length === 0 ? (
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
          <StickyNote className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No notebooks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a notebook to start writing pages.
          </p>
          <Button onClick={handleNewNotebook} className="mt-5 rounded-xl">
            <Plus className="size-4" />
            New notebook
          </Button>
        </div>
      ) : (
        <>
          <PageIndex
            pages={pageList}
            activeId={activePage?._id ?? null}
            onSelect={(id) => setActivePageId(id)}
            onAdd={handleAddPage}
            onRename={handleRenamePage}
            onDelete={handleDeletePage}
          />

          {activePage ? (
            <PageCanvas key={activePage._id} page={activePage} />
          ) : (
            <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
              <StickyNote className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No pages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first page to this notebook.
              </p>
              <Button onClick={handleAddPage} className="mt-5 rounded-xl">
                <Plus className="size-4" />
                New page
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
