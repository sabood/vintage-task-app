import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { NoteColor } from "@/convex/schema";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  FileText,
  Loader2,
  Notebook,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type NotebookId = Id<"notebooks">;
type PageId = Id<"notePages">;

const ACCENT_DOT_CLASS: Record<NoteColor, string> = {
  default: "bg-muted-foreground/60",
  indigo: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

/**
 * Notebook tree for the app side menu:
 * notebooks as expandable parents, their pages as sub-items.
 */
export default function NotesSidebar({
  notebooks,
  pagesByNotebook,
  loading,
  activeNotebookId,
  activePageId,
  onSelectNotebook,
  onSelectPage,
  onNewNotebook,
  onNewPage,
  onRenameNotebook,
  onRenamePage,
  onDeleteNotebook,
  onDeletePage,
}: {
  notebooks: Doc<"notebooks">[];
  pagesByNotebook: Record<NotebookId, Doc<"notePages">[] | undefined>;
  loading: boolean;
  activeNotebookId: NotebookId | null;
  activePageId: PageId | null;
  onSelectNotebook: (id: NotebookId) => void;
  onSelectPage: (notebookId: NotebookId, pageId: PageId) => void;
  onNewNotebook: () => void;
  onNewPage: (notebookId: NotebookId) => void;
  onRenameNotebook: (nb: Doc<"notebooks">) => void;
  onRenamePage: (page: Doc<"notePages">) => void;
  onDeleteNotebook: (nb: Doc<"notebooks">) => void;
  onDeletePage: (page: Doc<"notePages">) => void;
}) {
  const expandedMap: Record<string, boolean> = {};
  notebooks.forEach((nb) => {
    expandedMap[nb._id] =
      activeNotebookId === nb._id || Boolean(pagesByNotebook[nb._id]?.some((p) => p._id === activePageId));
  });
  const expanded = (nbId: NotebookId) => expandedMap[nbId] ?? false;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          <Notebook className="size-3" />
          Notebooks
        </span>
        <button
          type="button"
          aria-label="New notebook"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onNewNotebook}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      )}

      {notebooks.map((nb) => {
        const pages = pagesByNotebook[nb._id];
        const hasPages = (pages?.length ?? 0) > 0;
        const nbActive = activeNotebookId === nb._id;
        return (
          <div key={nb._id}>
            {/* notebook row */}
            <div
              className={cn(
                "group/nb flex items-center gap-1 rounded-lg pr-1 transition-colors",
                nbActive && !expanded ? "bg-primary/10" : "hover:bg-accent",
              )}
            >
              <button
                type="button"
                aria-expanded={expanded(nb._id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left"
                onClick={() => onSelectNotebook(nb._id)}
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    !expanded(nb._id) && "-rotate-90",
                  )}
                />
                <span
                  className={`size-2 shrink-0 rounded-full ${ACCENT_DOT_CLASS[nb.color ?? "default"]}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {nb.title}
                </span>
                {hasPages && (
                  <span className="text-[10px] text-muted-foreground/70">
                    {pages!.length}
                  </span>
                )}
              </button>
              {/* row actions */}
              <button
                type="button"
                aria-label={`Rename notebook “${nb.title}”`}
                title="Rename notebook"
                className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/nb:grid"
                onClick={() => onRenameNotebook(nb)}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`New page in “${nb.title}”`}
                title={`New page in “${nb.title}”`}
                className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/nb:grid"
                onClick={() => onNewPage(nb._id)}
              >
                <Plus className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete notebook “${nb.title}”`}
                title="Delete notebook"
                className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/nb:grid"
                onClick={() => onDeleteNotebook(nb)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {/* pages submenu */}
            {expanded(nb._id) && (
              <div className="ml-6 flex flex-col border-l border-border/60 pl-1">
                {(pages ?? []).map((page) => {
                  const pActive = activePageId === page._id;
                  return (
                    <div
                      key={page._id}
                      className={cn(
                        "group/pg flex items-center gap-1 rounded-lg pr-1 transition-colors",
                        pActive ? "bg-primary/10" : "hover:bg-accent",
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                        onClick={() => onSelectPage(nb._id, page._id)}
                      >
                        <FileText
                          className={cn(
                            "size-3.5 shrink-0",
                            pActive ? "text-primary" : "text-muted-foreground/70",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[13px]",
                            pActive ? "font-medium text-primary" : "text-muted-foreground",
                          )}
                        >
                          {page.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename page “${page.title}”`}
                        title="Rename page"
                        className="hidden size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/pg:grid"
                        onClick={() => onRenamePage(page)}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete page “${page.title}”`}
                        title="Delete page"
                        className="hidden size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/pg:grid"
                        onClick={() => onDeletePage(page)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })}
                {/* add page inline */}
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => onNewPage(nb._id)}
                >
                  <Plus className="size-3.5" />
                  Add page
                </button>
              </div>
            )}
          </div>
        );
      })}

      {notebooks.length === 0 && !loading && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No notebooks yet — create one to begin.
        </p>
      )}
    </div>
  );
}
