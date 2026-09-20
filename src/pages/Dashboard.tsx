import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Inbox, Loader2, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const tasks = useQuery(api.tasks.list);
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);

  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const entries = tasks ?? [];
  const doneCount = entries.filter((t) => t.isCompleted).length;
  const firstName = user?.name?.trim().split(" ")[0];

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isAdding) return;
    setIsAdding(true);
    try {
      await addTask({ text });
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
        error instanceof Error
          ? error.message
          : "Could not update that task.",
      );
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Slate
            </span>
          </div>
          <div className="flex items-center gap-3">
            {firstName && (
              <span className="hidden text-sm text-muted-foreground sm:block">
                {firstName}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:px-6">
        {/* ── Greeting ──────────────────────────────────────────────── */}
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {greetingForHour(new Date().getHours())}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-1 text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <section className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: "Tasks", value: entries.length },
            { label: "Completed", value: doneCount },
            { label: "Open", value: entries.length - doneCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-4 text-center shadow-sm"
            >
              <p className="font-display text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        {/* ── Add a task ────────────────────────────────────────────── */}
        <form onSubmit={handleAdd} className="mt-8 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Add a task, e.g. “Read Ch. 4 of Biology”"
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

        {/* ── Task list ─────────────────────────────────────────────── */}
        <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          {tasks === undefined ? (
            <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading your tasks…
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Inbox className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No tasks yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first task above to get started.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              <AnimatePresence initial={false}>
                {entries.map((task) => (
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
                      className={`flex-1 text-[15px] leading-relaxed transition-colors ${
                        task.isCompleted
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {task.text}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Slate · Your tasks, synced in real time.
        </p>
      </main>
    </div>
  );
}
