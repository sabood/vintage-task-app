import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import NotesSidebar from "@/components/NotesSidebar";
import NotesPanel from "@/components/NotesPanel";
import TasksPanel from "@/components/TasksPanel";
import { format } from "date-fns";
import { Check, CheckSquare, LogOut, NotebookPen } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Section = "tasks" | "notes";
type NotebookId = Id<"notebooks">;
type PageId = Id<"notePages">;

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("tasks");

  // ── Notes tree state (rendered inside the side menu) ───────────────
  const notebooks = useQuery(api.notebooks.listNotebooks);
  const addNotebook = useMutation(api.notebooks.addNotebook);
  const renameNotebook = useMutation(api.notebooks.renameNotebook);
  const removeNotebook = useMutation(api.notebooks.removeNotebook);
  const addPage = useMutation(api.notebooks.addPage);
  const updatePageRemote = useMutation(api.notebooks.updatePage);
  const removePage = useMutation(api.notebooks.removePage);
  const addTask = useMutation(api.tasks.add);

  const nbList = notebooks ?? [];
  const [activeNotebookId, setActiveNotebookId] = useState<NotebookId | null>(null);
  const [activePageId, setActivePageId] = useState<PageId | null>(null);

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

  // ── Notes actions ───────────────────────────────────────────────────
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
      setSection("notes");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create notebook.",
      );
    }
  };

  const handleRenameNotebook = async (nb: { _id: NotebookId; title: string }) => {
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

  const handleDeleteNotebook = async (nb: { _id: NotebookId; title: string }) => {
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

  const handleNewPage = async (parentId?: PageId) => {
    if (!notebookId) {
      toast.error("Create a notebook first.");
      return;
    }
    try {
      const id = await addPage({
        notebookId,
        parentId: parentId ?? undefined,
      });
      setActivePageId(id);
      setSection("notes");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create page.",
      );
    }
  };

  const handleRenamePage = async (page: { _id: PageId; title: string }) => {
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

  const handleDeletePage = async (page: { _id: PageId; title: string }) => {
    if (!window.confirm(`Delete “${page.title}” and its sub-pages?`)) return;
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

  const handleSelectNotebook = (id: NotebookId) => {
    setActiveNotebookId(id);
    setActivePageId(null);
    setSection("notes");
  };

  const handleSelectPage = (nbId: NotebookId, pageId: PageId) => {
    setActiveNotebookId(nbId);
    setActivePageId(pageId);
    setSection("notes");
  };

  /** Flagged letters → task in the default list, linked back to the page. */
  const handleFlagTask = async (text: string, pageId: PageId) => {
    await addTask({ text, sourcePageId: pageId });
  };

  // ── Shell chrome ────────────────────────────────────────────────────
  const firstName = user?.name?.trim().split(" ")[0] ?? "";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pagesByNotebook: Record<NotebookId, typeof pageList | undefined> = {};
  if (notebookId) {
    pagesByNotebook[notebookId] = pageList;
  }

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
      description: "Your to-do lists",
    },
    {
      id: "notes",
      label: "Notes",
      icon: NotebookPen,
      description: "Notebooks & pages",
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Side menu ───────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-card/50 md:flex">
        {/* brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Slate
          </span>
        </div>

        {/* primary nav */}
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
                <Icon className="size-4 shrink-0" />
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

        {/* notebooks submenu tree */}
        <div className="mt-4 border-t border-border/60 px-3 pt-3 pb-4">
          <NotesSidebar
            notebooks={nbList}
            pagesByNotebook={pagesByNotebook}
            loading={notebooks === undefined}
            activeNotebookId={notebookId}
            activePageId={activePage?._id ?? null}
            onSelectNotebook={handleSelectNotebook}
            onSelectPage={handleSelectPage}
            onNewNotebook={handleNewNotebook}
            onNewPage={() => handleNewPage()}
            onRenameNotebook={handleRenameNotebook}
            onRenamePage={handleRenamePage}
            onDeleteNotebook={handleDeleteNotebook}
            onDeletePage={handleDeletePage}
          />
        </div>

        {/* user + sign out */}
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
        {/* top bar */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
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

          {section === "tasks" ? (
            <TasksPanel />
          ) : (
            <NotesPanel
              activePage={activePage}
              pages={pageList}
              pagesLoading={pages === undefined}
              onNewPage={() => handleNewPage()}
              onNewSubPage={(parentId) => handleNewPage(parentId)}
              onSelectPage={(pageId) => setActivePageId(pageId)}
              onFlagTask={handleFlagTask}
            />
          )}
        </main>

        <p className="pb-8 text-center text-xs text-muted-foreground">
          Slate · Your tasks &amp; notes, synced in real time.
        </p>
      </div>
    </div>
  );
}
