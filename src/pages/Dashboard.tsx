import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, CheckSquare, LogOut, NotebookPen } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import TasksPanel from "@/components/TasksPanel";
import NotesPanel from "@/components/NotesPanel";
import { cn } from "@/lib/utils";

type Section = "tasks" | "notes";

const NAV_ITEMS: {
  id: Section;
  label: string;
  icon: typeof CheckSquare;
  description: string;
}[] = [
  {
    id: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    description: "Your to-do list",
  },
  {
    id: "notes",
    label: "Notes",
    icon: NotebookPen,
    description: "Notebooks & pages",
  },
];

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("tasks");

  const firstName = user?.name?.trim().split(" ")[0] ?? "";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Side menu ───────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/50 md:flex">
        {/* brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Slate
          </span>
        </div>

        {/* nav */}
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4.5 shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs opacity-70">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* user + sign out at the bottom */}
        <div className="mt-auto border-t border-border/60 p-4">
          {firstName && (
            <p className="mb-3 truncate px-1 text-sm font-medium">{firstName}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start rounded-lg"
            onClick={handleSignOut}
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar (mobile nav lives here too) */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
            {/* mobile brand + nav */}
            <div className="flex items-center gap-2 md:hidden">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="font-display font-semibold">Slate</span>
              <span className="mx-1 h-5 w-px bg-border" />
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                    section === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-muted-foreground md:block">
              {format(new Date(), "EEEE, MMMM d")}
            </span>
            <div className="flex items-center gap-3">
              {firstName && (
                <span className="hidden text-sm text-muted-foreground sm:block">
                  {firstName}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg md:hidden"
                onClick={handleSignOut}
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* wide content area */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-8">
          {/* greeting (tasks view keeps its header; notes fills the width) */}
          {section === "tasks" && (
            <div className="mb-6">
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {greetingForHour(new Date().getHours())}
                {firstName ? `, ${firstName}` : ""}.
              </h1>
              <p className="mt-1 text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
            </div>
          )}

          {section === "tasks" ? <TasksPanel /> : <NotesPanel />}
        </main>

        <p className="pb-8 text-center text-xs text-muted-foreground">
          Slate · Your tasks &amp; notes, synced in real time.
        </p>
      </div>
    </div>
  );
}
