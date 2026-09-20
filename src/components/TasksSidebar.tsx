import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  CheckSquare,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type ListId = Id<"taskLists">;

/** Sidebar list of task lists, shown while the Tasks section is active. */
export default function TasksSidebar({
  lists,
  loading,
  activeListId,
  onSelectList,
  onNewList,
  onRenameList,
  onDeleteList,
}: {
  lists: Doc<"taskLists">[];
  loading: boolean;
  activeListId: ListId | null;
  onSelectList: (id: ListId | null) => void;
  onNewList: () => void;
  onRenameList: (list: Doc<"taskLists">) => void;
  onDeleteList: (list: Doc<"taskLists">) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Lists
        </span>
        <button
          type="button"
          aria-label="New list"
          title="New list"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onNewList}
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

      {/* default view */}
      <button
        type="button"
        onClick={() => onSelectList(null)}
        aria-current={activeListId === null ? "true" : undefined}
        className={cn(
          "group/all flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
          activeListId === null
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Inbox
          className={cn(
            "size-4 shrink-0",
            activeListId === null ? "text-primary" : "text-muted-foreground/70",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            activeListId === null ? "font-medium" : "text-foreground/85",
          )}
        >
          All tasks
        </span>
      </button>

      {lists.map((list) => {
        const active = activeListId === list._id;
        return (
          <div
            key={list._id}
            className={cn(
              "group/tl flex items-center gap-1 rounded-lg pr-1 transition-colors",
              active ? "bg-primary/10" : "hover:bg-accent",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectList(list._id)}
              aria-current={active ? "true" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 pr-2 text-left"
            >
              <CheckSquare
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground/70",
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  active ? "font-medium text-primary" : "text-foreground/85",
                )}
              >
                {list.name}
              </span>
            </button>
            <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within/tl:opacity-100 group-hover/tl:opacity-100">
              <button
                type="button"
                aria-label={`Rename list “${list.name}”`}
                title="Rename list"
                className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/tl:grid"
                onClick={() => onRenameList(list)}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Delete list “${list.name}”`}
                title="Delete list"
                className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/tl:grid"
                onClick={() => onDeleteList(list)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </div>
        );
      })}

      {!loading && lists.length === 0 && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No lists yet — create one to organize tasks.
        </p>
      )}
    </div>
  );
}
