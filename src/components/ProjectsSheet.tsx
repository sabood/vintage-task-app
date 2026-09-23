import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Download,
  Folder,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search as SearchIcon,
  Sigma,
  Trash2,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;
type ProjectDoc = Doc<"projects">;

const STATUS_META: Record<
  string,
  { label: string; chip: string }
> = {
  planning: {
    label: "Planning",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  in_progress: {
    label: "In progress",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  on_hold: {
    label: "On hold",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    chip: "bg-muted text-muted-foreground",
  },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

function dueLabel(dueAt: number): { text: string; overdue: boolean } {
  const due = new Date(dueAt);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const overdue = dueAt < startOfToday;
  const days = Math.ceil((dueAt - startOfToday) / 86_400_000);
  let text: string;
  if (days === 0) text = "Due today";
  else if (days === 1) text = "Due tomorrow";
  else if (days > 1) text = `Due in ${days}d`;
  else text = `${-days}d overdue`;
  return {
    text: `${text} · ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    overdue,
  };
}

type ProjectRow = {
  key: string;
  name: string;
  code?: string;
  project?: ProjectDoc;
  products: number;
  cost: number;
  total: number;
  currency: string;
  fgIds: Id<"finishedGoods">[];
};

/** Projects listing sheet — one row per project with full details. */
export default function ProjectsSheet({
  finishedGoods,
  loading,
  onOpenProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
}: {
  finishedGoods: FgDoc[];
  loading: boolean;
  onOpenProject: (projectName: string) => void;
  onNewProject?: () => void;
  onEditProject?: (project: ProjectDoc) => void;
  onDeleteProject?: (project: ProjectDoc) => void;
}) {
  const [search, setSearch] = useState("");
  const projects = useQuery(api.costing.listProjects);
  const allItems = useQuery(api.costing.listAllItems);

  const costByFg = useMemo(() => {
    const map = new Map<Id<"finishedGoods">, number>();
    for (const item of allItems ?? []) {
      if (item.fgId === undefined) continue;
      map.set(item.fgId, (map.get(item.fgId) ?? 0) + item.qty * item.unitPrice);
    }
    return map;
  }, [allItems]);

  /** Merge the project entity (details) with its FG aggregation (numbers). */
  const rows = useMemo<ProjectRow[]>(() => {
    // Aggregate FGs by project name.
    const agg = new Map<string, ProjectRow>();
    for (const fg of finishedGoods) {
      const row = agg.get(fg.projectName) ?? {
        key: `n:${fg.projectName}`,
        name: fg.projectName,
        code: fg.projectCode,
        products: 0,
        cost: 0,
        total: 0,
        currency: fg.currency ?? "$",
        fgIds: [],
      };
      row.products += 1;
      const c = costByFg.get(fg._id) ?? 0;
      row.cost += c;
      row.total += c * (1 + (fg.markupPct ?? 0) / 100);
      row.fgIds.push(fg._id);
      agg.set(fg.projectName, row);
    }
    // Overlay the project entity details.
    const out = new Map<string, ProjectRow>();
    for (const project of projects ?? []) {
      const a = agg.get(project.name);
      out.set(project.name, {
        key: `p:${project._id}`,
        name: project.name,
        code: project.code ?? a?.code,
        project,
        products: a?.products ?? 0,
        cost: a?.cost ?? 0,
        total: a?.total ?? 0,
        currency: a?.currency ?? "$",
        fgIds: a?.fgIds ?? [],
      });
    }
    // Name-only projects (legacy, no entity) keep working.
    for (const [name, a] of agg) {
      if (!out.has(name)) out.set(name, a);
    }
    return Array.from(out.values()).sort((x, y) => y.total - x.total);
  }, [finishedGoods, projects, costByFg]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q) ||
        (p.project?.client ?? "").toLowerCase().includes(q) ||
        (p.project?.assignee ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      products: filtered.reduce((s, p) => s + p.products, 0),
      cost: filtered.reduce((s, p) => s + p.cost, 0),
      total: filtered.reduce((s, p) => s + p.total, 0),
    }),
    [filtered],
  );

  const exportCsv = () => {
    const lines = [
      [
        "Code",
        "Project",
        "Client",
        "Assignee",
        "Status",
        "Priority",
        "Due date",
        "Budget",
        "Products",
        "Cost",
        "Sales Price",
      ].join(","),
      ...filtered.map((p) =>
        [
          `"${(p.code ?? "").replace(/"/g, '""')}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${(p.project?.client ?? "").replace(/"/g, '""')}"`,
          `"${(p.project?.assignee ?? "").replace(/"/g, '""')}"`,
          p.project?.status ? STATUS_META[p.project.status]?.label ?? p.project.status : "",
          p.project?.priority ?? "",
          p.project?.dueAt
            ? new Date(p.project.dueAt).toLocaleDateString()
            : "",
          p.project?.budget?.toFixed(2) ?? "",
          String(p.products),
          p.cost.toFixed(2),
          p.total.toFixed(2),
        ].join(","),
      ),
      `,,,TOTAL,,,"",,${totals.products},${totals.cost.toFixed(2)},${totals.total.toFixed(2)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* new project bar */}
      {onNewProject && (
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed bg-card/60 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New project — with due date, assignee, description &amp; more
        </button>
      )}

      {/* listing sheet */}
      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <p className="text-sm font-semibold">
            Projects
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {filtered.length} project{filtered.length === 1 ? "" : "s"} ·{" "}
              {totals.products} product{totals.products === 1 ? "" : "s"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-40 rounded-lg border bg-background py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {filtered.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg text-xs"
                onClick={exportCsv}
              >
                <Download className="size-3" />
                CSV
              </Button>
            )}
          </div>
        </div>

        {loading || projects === undefined || allItems === undefined ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {search
              ? `Nothing matches “${search}”.`
              : "No projects yet — create one above."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((p) => {
              const detail = p.project;
              const status = detail?.status
                ? STATUS_META[detail.status]
                : undefined;
              const due = detail?.dueAt !== undefined ? dueLabel(detail.dueAt) : null;
              return (
                <li
                  key={p.key}
                  className="group/row px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.name)}
                      className="flex min-w-0 items-center gap-2 text-left"
                      title="Open its products"
                    >
                      <Folder className="size-4 shrink-0 text-sky-500/80" />
                      <span className="truncate text-sm font-medium hover:text-primary">
                        {p.name}
                      </span>
                    </button>
                    {p.code && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {p.code}
                      </span>
                    )}
                    {status && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          status.chip,
                        )}
                      >
                        {status.label}
                      </span>
                    )}
                    {detail?.priority && (
                      <span
                        className="size-2 shrink-0 rounded-full"
                        title={`Priority: ${detail.priority}`}
                      >
                        <span
                          className={cn(
                            "block size-2 rounded-full",
                            PRIORITY_DOT[detail.priority] ?? "bg-muted-foreground",
                          )}
                        />
                      </span>
                    )}
                    {due && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                          due.overdue
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {due.text}
                      </span>
                    )}

                    {/* actions */}
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <span className="hidden items-center gap-1 text-xs tabular-nums text-muted-foreground group-hover/row:inline-flex sm:inline-flex">
                        {detail?.budget !== undefined && (
                          <span
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                            title="Budget"
                          >
                            Budget {p.currency}
                            {detail.budget.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                        <span
                          className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                          title="Actual sales total"
                        >
                          {p.currency}
                          {p.total.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </span>
                      {onEditProject && detail && (
                        <button
                          type="button"
                          aria-label={`Edit “${p.name}”`}
                          title="Edit project details"
                          className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-primary group-hover/row:grid"
                          onClick={() => onEditProject(detail)}
                        >
                          <Pencil className="size-3" />
                        </button>
                      )}
                      {onDeleteProject && detail && (
                        <button
                          type="button"
                          aria-label={`Delete “${p.name}”`}
                          title="Delete project (products are kept)"
                          className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/row:grid"
                          onClick={() => onDeleteProject(detail)}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Open products of “${p.name}”`}
                        title="Open its products"
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-primary"
                        onClick={() => onOpenProject(p.name)}
                      >
                        <Package className="size-3.5" />
                      </button>
                      {onNewProject && (
                        <button
                          type="button"
                          aria-label={`New product under “${p.name}”`}
                          title="New product under this project"
                          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-primary"
                          onClick={() => onNewProject()}
                        >
                          <Sigma className="size-3.5" />
                        </button>
                      )}
                    </span>
                  </div>

                  {/* second line: description / client / assignee */}
                  {(detail?.description ||
                    detail?.client ||
                    detail?.assignee) && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-[11px] text-muted-foreground">
                      {detail?.client && (
                        <span className="truncate">Client: {detail.client}</span>
                      )}
                      {detail?.assignee && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <User className="size-3" />
                          {detail.assignee}
                        </span>
                      )}
                      {detail?.description && (
                        <span className="truncate opacity-80">
                          {detail.description}
                        </span>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-end gap-4 border-t border-border/70 bg-primary/5 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Products: {totals.products} · Cost {totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="font-display text-sm font-bold tabular-nums text-primary">
              Sales {totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        A project groups finished goods — its cost and total are the sum of all
        its products. Click a project name to see its products.
      </p>
    </div>
  );
}
