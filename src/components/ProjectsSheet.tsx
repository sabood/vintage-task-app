import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Download,
  Folder,
  Loader2,
  Package,
  Plus,
  Search as SearchIcon,
  Sigma,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;

type ProjectRow = {
  name: string;
  code?: string; // PR#### auto code
  products: number;
  cost: number;
  total: number;
  currency: string;
  fgIds: Id<"finishedGoods">[];
};

/** Projects listing sheet — one row per project, aggregated from its FG products. */
export default function ProjectsSheet({
  finishedGoods,
  loading,
  onOpenProject,
  onNewProject,
}: {
  finishedGoods: FgDoc[];
  loading: boolean;
  onOpenProject: (projectName: string) => void;
  onNewProject?: () => void;
}) {
  const [search, setSearch] = useState("");

  const allItems = useQuery(api.costing.listAllItems);
  const costByFg = useMemo(() => {
    const map = new Map<Id<"finishedGoods">, number>();
    for (const item of allItems ?? []) {
      if (item.fgId === undefined) continue;
      map.set(item.fgId, (map.get(item.fgId) ?? 0) + item.qty * item.unitPrice);
    }
    return map;
  }, [allItems]);

  const projects = useMemo<ProjectRow[]>(() => {
    const map = new Map<string, ProjectRow>();
    for (const fg of finishedGoods) {
      const row = map.get(fg.projectName) ?? {
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
      map.set(fg.projectName, row);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [finishedGoods, costByFg]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const totals = useMemo(
    () => ({
      products: rows.reduce((s, p) => s + p.products, 0),
      cost: rows.reduce((s, p) => s + p.cost, 0),
      total: rows.reduce((s, p) => s + p.total, 0),
    }),
    [rows],
  );

  const exportCsv = () => {
    const lines = [
      ["Code", "Project", "Products", "Cost", "Sales Price (with margin)"].join(","),
      ...rows.map((p) =>
        [
          `"${(p.code ?? "").replace(/"/g, '""')}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          String(p.products),
          p.cost.toFixed(2),
          p.total.toFixed(2),
        ].join(","),
      ),
      `"",TOTAL,${totals.products},${totals.cost.toFixed(2)},${totals.total.toFixed(2)}`,
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
          New project — creates its first product (FG) under it
        </button>
      )}

      {/* listing sheet — same style as materials/products */}
      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <p className="text-sm font-semibold">
            Projects
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} project{rows.length === 1 ? "" : "s"} · {totals.products} product
              {totals.products === 1 ? "" : "s"}
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
            {rows.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={exportCsv}>
                <Download className="size-3" />
                CSV
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                <th className="w-10 px-3 py-2 font-semibold">#</th>
                <th className="w-20 px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Project</th>
                <th className="w-24 px-3 py-2 text-right font-semibold">Products</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Cost</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">Sales price</th>
                <th className="w-16 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading || allItems === undefined ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                    Loading projects…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {search
                      ? `Nothing matches “${search}”.`
                      : "No projects yet — create one above, or add a product under a new project."}
                  </td>
                </tr>
              ) : (
                rows.map((p, i) => (
                  <tr key={p.name} className="group/row transition-colors hover:bg-accent/40">
                    <td className="px-3 py-1 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.code ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenProject(p.name)}
                        className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-primary/5"
                        title="Open its products"
                      >
                        <Folder className="size-4 shrink-0 text-sky-500/80" />
                        <span className="truncate text-sm font-medium">{p.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                      {p.products}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                      {p.currency}
                      {p.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                      {p.currency}
                      {p.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className="hidden gap-1 group-hover/row:inline-flex">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border/70 bg-primary/5">
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold">
                    All projects
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium tabular-nums text-muted-foreground">
                    {totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-display text-sm font-bold tabular-nums text-primary">
                    {totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        A project groups finished goods — its cost and total are the sum of all its products. Click a
        project to see its products.
      </p>
    </div>
  );
}
