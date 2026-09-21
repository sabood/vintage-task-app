import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import NotesSidebar from "@/components/NotesSidebar";
import TasksSidebar from "@/components/TasksSidebar";
import type { ActiveTaskView } from "@/components/TasksSidebar";
import NotesPanel from "@/components/NotesPanel";
import TasksPanel from "@/components/TasksPanel";
import CostingSidebar from "@/components/CostingSidebar";
import type { CostingView } from "@/components/CostingSidebar";
import CostingPanel from "@/components/CostingPanel";
import { format } from "date-fns";
import { Calculator, Check, CheckSquare, LogOut, NotebookPen } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Section = "tasks" | "notes" | "costing";
type NotebookId = Id<"notebooks">;
type PageId = Id<"notePages">;
type ListId = Id<"taskLists">;
type FolderId = Id<"taskFolders">;
type FgId = Id<"finishedGoods">;

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
  const ensureDefaultWorkbook = useMutation(api.notebooks.ensureDefaultWorkbook);
  const updatePageRemote = useMutation(api.notebooks.updatePage);
  const removePage = useMutation(api.notebooks.removePage);
  const addTask = useMutation(api.tasks.add);

  // ── Task lists (rendered inside the side menu on Tasks) ────────────
  const taskLists = useQuery(api.tasks.listLists);
  const taskFolders = useQuery(api.tasks.listFolders);
  const allTasks = useQuery(api.tasks.list);
  const addList = useMutation(api.tasks.addList);
  const renameList = useMutation(api.tasks.renameList);
  const removeList = useMutation(api.tasks.removeList);
  const addFolderM = useMutation(api.tasks.addFolder);
  const removeFolderM = useMutation(api.tasks.removeFolder);
  const setListFolderM = useMutation(api.tasks.setListFolder);
  const [activeTaskView, setActiveTaskView] = useState<ActiveTaskView>(null);

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
  const allPages = useQuery(api.notebooks.listAllPages);

  // ── First-run seeding: "My Workbook" + an untitled page ────────────
  const seededOnce = useRef(false);
  useEffect(() => {
    if (notebooks === undefined) return; // still loading
    if (seededOnce.current) return; // only try once per session
    seededOnce.current = true;
    if (notebooks.length === 0) {
      ensureDefaultWorkbook().catch(() => {
        // If it failed (e.g. racing another tab), the query will refresh;
        // only retry if the list is still empty on next mount.
        seededOnce.current = false;
      });
    }
  }, [notebooks, ensureDefaultWorkbook]);

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

  const handleNewPage = async (targetNotebookId?: NotebookId, parentId?: PageId) => {
    const nbId = targetNotebookId ?? notebookId;
    if (!nbId) {
      toast.error("Create a notebook first.");
      return;
    }
    try {
      const id = await addPage({
        notebookId: nbId,
        parentId: parentId ?? undefined,
      });
      setActiveNotebookId(nbId);
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

  // ── Task list actions ───────────────────────────────────────────────
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
      setActiveTaskView(id);
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
      if (activeTaskView === list._id) setActiveTaskView(null);
      toast.success("List deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete list.");
    }
  };

  const handleNewFolder = async () => {
    const name = window.prompt("Folder name", "School");
    if (name === null) return;
    const clean = name.trim();
    if (!clean) {
      toast.error("Give the folder a name.");
      return;
    }
    try {
      await addFolderM({ name: clean });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create folder.");
    }
  };

  const handleDeleteFolder = async (folder: { _id: FolderId; name: string }) => {
    if (!window.confirm(`Delete folder “${folder.name}”? Its lists are kept.`)) return;
    try {
      await removeFolderM({ id: folder._id });
      toast.success("Folder deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete folder.");
    }
  };

  const handleMoveListToFolder = async (list: {
    _id: ListId;
    name: string;
    folderId?: FolderId;
  }) => {
    const folders = taskFolders ?? [];
    if (folders.length === 0) {
      toast.error('Create a folder first — use “New folder” in the sidebar.');
      return;
    }
    const options = [
      ...folders.map((f, i) => `${i + 1}. ${f.name}`),
      "0. Remove from folder",
    ];
    const pick = window.prompt(
      `Move “${list.name}” to which folder?\n\n${options.join("\n")}`,
      "1",
    );
    if (pick === null) return;
    const n = Number(pick.trim());
    const folder = folders[n - 1];
    if (!folder || Number.isNaN(n)) {
      toast.error("Pick a number from the list.");
      return;
    }
    try {
      await setListFolderM({ id: list._id, folderId: folder._id });
      toast.success(`“${list.name}” moved to “${folder.name}”.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't move the list.");
    }
  };

  // ── Costing (raw materials + sheets) ─────────────────────────────
  const materials = useQuery(api.costing.listMaterials);
  const finishedGoods = useQuery(api.costing.listFinishedGoods);
  const addFgM = useMutation(api.costing.addFinishedGood);
  const updateFgM = useMutation(api.costing.updateFinishedGood);
  const removeFgM = useMutation(api.costing.removeFinishedGood);
  const [costingView, setCostingView] = useState<CostingView>(null);

  const handleNewFg = async (projectName: string) => {
    const cleanProject =
      projectName.trim() || window.prompt("Project name", "New project")?.trim() || "";
    if (!cleanProject) return;
    const name = window.prompt(`New product under “${cleanProject}”`, "Product");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Give the product a name.");
      return;
    }
    try {
      const id = await addFgM({ projectName: cleanProject, name: cleanName });
      setCostingView({ kind: "fg", fgId: id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the product.");
    }
  };

  const handleRenameFg = async (fg: { _id: FgId; name: string; projectName: string }) => {
    const name = window.prompt("Product name", fg.name);
    if (name === null) return;
    const clean = name.trim();
    if (!clean) return;
    try {
      await updateFgM({ id: fg._id, name: clean });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename the product.");
    }
  };

  const handleEditFg = async (fg: {
    _id: FgId;
    projectName: string;
    name: string;
    code?: string;
    unit?: string;
    note?: string;
    markupPct?: number;
  }) => {
    const project = window.prompt("Project", fg.projectName);
    if (project === null) return;
    const code = window.prompt("Product code / SKU", fg.code ?? "");
    if (code === null) return;
    const unit = window.prompt("Sold per (unit)", fg.unit ?? "pcs");
    if (unit === null) return;
    const note = window.prompt("Product note", fg.note ?? "");
    if (note === null) return;
    const markupRaw = window.prompt("Profit markup %", String(fg.markupPct ?? 0));
    if (markupRaw === null) return;
    const markup = Number(markupRaw);
    if (!Number.isFinite(markup) || markup < 0) {
      toast.error("Enter a valid markup.");
      return;
    }
    try {
      await updateFgM({
        id: fg._id,
        projectName: project.trim() || fg.projectName,
        code,
        unit,
        note,
        markupPct: markup,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the product.");
    }
  };

  const handleDeleteFg = async (fg: { _id: FgId; name: string }) => {
    if (!window.confirm(`Delete product “${fg.name}” and all its costing lines?`)) return;
    try {
      await removeFgM({ id: fg._id });
      if (costingView?.kind === "fg" && costingView.fgId === fg._id) setCostingView(null);
      toast.success("Product deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the product.");
    }
  };

  // ── Shell chrome ────────────────────────────────────────────────────
  const firstName = user?.name?.trim().split(" ")[0] ?? "";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
    {
      id: "costing",
      label: "Costing sheet",
      icon: Calculator,
      description: "Job cost calculator",
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

        {/* section-aware explorer tree */}
        <div className="mt-4 border-t border-border/60 px-3 pt-3 pb-4">
          {section === "costing" ? (
            <CostingSidebar
              finishedGoods={finishedGoods ?? []}
              materials={materials ?? []}
              loading={finishedGoods === undefined}
              view={costingView}
              onSelectView={setCostingView}
              onNewFg={(p) => void handleNewFg(p)}
              onRenameFg={(fg) => void handleRenameFg(fg)}
              onDeleteFg={(fg) => void handleDeleteFg(fg)}
              onMaterialsClick={() => setCostingView({ kind: "materials" })}
            />
          ) : section === "tasks" ? (
            <TasksSidebar
              lists={taskLists ?? []}
              folders={taskFolders ?? []}
              tasks={allTasks ?? []}
              loading={taskLists === undefined}
              activeView={activeTaskView}
              onSelectView={setActiveTaskView}
              onNewList={handleNewList}
              onRenameList={handleRenameList}
              onDeleteList={handleDeleteList}
              onMoveListToFolder={handleMoveListToFolder}
              onNewFolder={handleNewFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          ) : (
            <NotesSidebar
            notebooks={nbList}
            allPages={allPages}
            loading={notebooks === undefined || allPages === undefined}
            activeNotebookId={notebookId}
            activePageId={activePage?._id ?? null}
            onSelectNotebook={handleSelectNotebook}
            onSelectPage={handleSelectPage}
            onNewNotebook={handleNewNotebook}
            onNewPage={(nbId) => void handleNewPage(nbId)}
            onNewSubPage={(nbId, parentId) => void handleNewPage(nbId, parentId)}
            onRenameNotebook={handleRenameNotebook}
            onRenamePage={handleRenamePage}
            onDeleteNotebook={handleDeleteNotebook}
            onDeletePage={handleDeletePage}
          />
          )}
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
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-label={item.label}
                    className={cn(
                      "grid size-7 place-items-center rounded-lg transition-colors",
                      section === item.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
            <div className="hidden items-center gap-1.5 md:flex">
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
                      "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
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

          {section === "costing" ? (
            <CostingPanel
              materials={materials ?? []}
              finishedGoods={finishedGoods ?? []}
              loading={finishedGoods === undefined}
              view={costingView}
              onSelectView={setCostingView}
              onNewFg={(p) => void handleNewFg(p)}
              onRenameFg={(fg) => void handleRenameFg(fg)}
              onDeleteFg={(fg) => void handleDeleteFg(fg)}
              onEditFg={(fg) => void handleEditFg(fg)}
            />
          ) : section === "tasks" ? (
            <TasksPanel
              activeView={activeTaskView}
              lists={taskLists ?? []}
              onSelectView={setActiveTaskView}
            />
          ) : (
            <NotesPanel
              activePage={activePage}
              pagesLoading={pages === undefined}
              onNewPage={() => handleNewPage()}
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
