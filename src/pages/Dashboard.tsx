import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Check, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import TasksPanel from "@/components/TasksPanel";
import NotesPanel from "@/components/NotesPanel";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
            {user?.name?.trim().split(" ")[0] && (
              <span className="hidden text-sm text-muted-foreground sm:block">
                {user.name.trim().split(" ")[0]}
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
          {user?.name?.trim().split(" ")[0]
            ? `, ${user.name.trim().split(" ")[0]}`
            : ""}
          .
        </h1>
        <p className="mt-1 text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>

        {/* ── Workspace tabs ───────────────────────────────────────── */}
        <Tabs defaultValue="tasks" className="mt-8">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="tasks" className="flex-1 rounded-lg px-4">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 rounded-lg px-4">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-6">
            <TasksPanel />
          </TabsContent>
          <TabsContent value="notes" className="mt-6">
            <NotesPanel />
          </TabsContent>
        </Tabs>
      </main>

      <p className="pb-10 text-center text-xs text-muted-foreground">
        Slate · Your tasks &amp; notes, synced in real time.
      </p>
    </div>
  );
}
