import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, Inbox, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ListId = Id<"taskLists">;

export default function TasksPanel({
  activeListId,
  onSelectList,
}: {
  activeListId: ListId | null;
  onSelectList: (id: ListId | null) => void;
}) {
  const allTasks = useQuery(api.tasks.list);
  const lists = useQuery(api.tasks.listLists);
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const addList = useMutation(api.tasks.addList);
  const renameList = useMutation(api.tasks.renameList);
  const removeList = useMutation(api.tasks.removeList);

  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const tasks = (allTasks ?? []).filter((t) =>
    activeListId ? t.listId === activeListId : !t.listId,
  );
  const doneCount = tasks.filter((t) => t.isCompleted).length;
  const activeList = (lists ?? []).find((l) => l._id === activeListId) ?? null;

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isAdding) return;
    setIsAdding(true);
    try {
      await addTask({ text, listId: activeListId ?? undefined });
      setDraft("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add that task.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id: Id<"tasks">) => {
    try {
      await toggleTask({ id });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update that task.",
      );
    }
  };

  const handleNewList = async () => {
    const name = window.prompt("List name", "My list");
    if (name === null) return;
    const clean = name.trim();
    if (!clean) {
      toast.error("Give the list a name.");
      return;
    }
    try {
      const id = await addList({ name: clean });
      onSelectList(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create list.");
    }
  };

  const handleRenameList = async (list: { _id: ListId; name: string }) => {
    const name = window.prompt("Rename list", list.name);
    if (name === null) return;
    const clean = name.trim();
    if (!clean) return;
    try {
      await renameList({ id: list._id, name: clean });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename list.");
    }
  };

  const handleDeleteList = async (list: { _id: ListId; name: string }) => {
    if (!window.confirm(`Delete “${list.name}”? Its tasks move to the default list.`))
      return;
    try {
      await removeList({ id: list._id });
      if (activeListId === list._id) onSelectList(null);
      toast.success("List deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete list.");
    }
  };

  return (
    <div>
      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: activeList ? activeList.name : "Tasks", value: tasks.length },
          { label: "Completed", value: doneCount },
          { label: "Open", value: tasks.length - doneCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-4 text-center shadow-sm"
          >
            <p className="font-display text-2xl font-semibold tabular-nums">
              {stat.value}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* ── Add a task ──────────────────────────────────────────────── */}
      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder={
            activeList
              ? `Add to “${activeList.name}”…`
              : "Add a task, e.g. “Read Ch. 4 of Biology”"
          }
          aria-label="New task"
          className="h-11 flex-1 rounded-xl bg-card shadow-sm placeholder:text-muted-foreground/70"
        />
        <Button
          type="submit"
          disabled={!draft.trim() || isAdding}
          className="h-11 rounded-xl px-5 shadow-sm"
        >
          {isAdding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add task
        </Button>
      </form>

      {/* ── Task list ───────────────────────────────────────────────── */}
      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        {allTasks === undefined ? (
          <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading your tasks…
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 font-medium">Nothing here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeList
                ? `Add your first task to “${activeList.name}”.`
                : "Add your first task above, or flag text from a note."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            <AnimatePresence initial={false}>
              {tasks.map((task) => (
                <motion.li
                  key={task._id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                >
                  <Checkbox
                    checked={task.isCompleted}
                    onCheckedChange={() => handleToggle(task._id)}
                    aria-label={
                      task.isCompleted
                        ? `Mark “${task.text}” as not done`
                        : `Mark “${task.text}” as done`
                    }
                    className="size-5 shrink-0 rounded-full border-2 border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground [&_svg]:size-3"
                  />
                  <span
                    className={cn(
                      "flex-1 text-[15px] leading-relaxed transition-colors",
                      task.isCompleted && "text-muted-foreground line-through",
                    )}
                  >
                    {task.text}
                  </span>
                  {task.sourcePageId && (
                    <Badge
                      variant="secondary"
                      className="hidden gap-1 rounded-full bg-amber-500/10 px-2 text-amber-700 sm:inline-flex dark:bg-amber-500/15 dark:text-amber-400"
                    >
                      <Flag className="size-3" />
                      From note
                    </Badge>
                  )}
                  {task.isCompleted && (
                    <Badge
                      variant="secondary"
                      className="gap-1 rounded-full bg-emerald-500/10 px-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        className="size-3"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Completed
                    </Badge>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
