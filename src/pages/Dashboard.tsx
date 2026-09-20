import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut, NotebookPen } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
        error instanceof Error ? error.message : "The ink smudged — try again.",
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
          : "Could not update that entry.",
      );
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 vignette" />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            This day of {format(new Date(), "MMMM d, yyyy")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            The Student Ledger
          </h1>

          <div className="double-rule mt-5 flex items-center justify-between px-1 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              Kept by{" "}
              <span className="text-foreground">
                {user?.name?.trim() || "an anonymous scholar"}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <LogOut className="size-3.5" />
              Close the ledger
            </button>
          </div>
        </header>

        {/* ── Running tally ────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-3 rounded-sm border border-border/80 bg-card py-4 text-center shadow-sm">
          {[
            { label: "Entries", value: entries.length },
            { label: "Marked done", value: doneCount },
            { label: "Still open", value: entries.length - doneCount },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={i > 0 ? "border-l border-border/70" : ""}
            >
              <p className="font-display text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        {/* ── Write a new entry ────────────────────────────────────── */}
        <form
          onSubmit={handleAdd}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Write today's task, e.g. “Read Ch. 4 of Biology”"
            aria-label="New task"
            className="h-11 flex-1 rounded-sm border-border bg-card/80 text-base italic placeholder:not-italic placeholder:text-muted-foreground/70 focus-visible:ring-ring/30"
          />
          <Button
            type="submit"
            disabled={!draft.trim() || isAdding}
            className="h-11 rounded-sm px-6 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NotebookPen className="size-4" />
            )}
            Enter it
          </Button>
        </form>

        {/* ── The ledger ───────────────────────────────────────────── */}
        <section className="mt-8 rounded-sm border border-border/80 bg-card shadow-sm">
          <div className="double-rule px-5 py-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Entries · {format(new Date(), "MMMM")} · Folio 1
            </p>
          </div>

          {tasks === undefined ? (
            <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Consulting the archives…
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p aria-hidden className="text-2xl text-accent/60">
                ❦
              </p>
              <p className="mt-3 font-display text-xl italic text-muted-foreground">
                The ledger awaits its first entry.
              </p>
              <p className="mt-1 text-sm text-muted-foreground/80">
                Write one task above to begin.
              </p>
            </div>
          ) : (
            <ul className="ledger-lines px-5 py-1">
              <AnimatePresence initial={false}>
                {entries.map((task, i) => (
                  <motion.li
                    key={task._id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-4 border-b border-dotted border-border/70 py-[9px] last:border-b-0"
                  >
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground/80">
                      {String(entries.length - i).padStart(3, "0")}
                    </span>
                    <Checkbox
                      checked={task.isCompleted}
                      onCheckedChange={() => handleToggle(task._id)}
                      aria-label={
                        task.isCompleted
                          ? `Mark “${task.text}” as not done`
                          : `Mark “${task.text}” as done`
                      }
                      className="size-6 shrink-0 self-center rounded-full border-2 border-primary/50 bg-background/60 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground [&_svg]:size-3.5"
                    />
                    <span
                      className={`flex-1 leading-[25px] transition-colors ${
                        task.isCompleted
                          ? "text-muted-foreground/60 line-through decoration-accent/60 decoration-2"
                          : ""
                      }`}
                    >
                      {task.text}
                    </span>
                    {task.isCompleted && (
                      <span className="shrink-0 self-center -rotate-6 rounded-sm border-2 border-accent/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-accent/80">
                        Filed
                      </span>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* ── Colophon ─────────────────────────────────────────────── */}
        <footer className="mt-10 flex items-center justify-center gap-3 text-muted-foreground/70">
          <span className="h-px w-12 bg-border" />
          <span className="text-xs italic">kept with care</span>
          <span className="h-px w-12 bg-border" />
        </footer>
      </main>
    </div>
  );
}
