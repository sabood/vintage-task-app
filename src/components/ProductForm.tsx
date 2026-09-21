import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MasterDataManager from "@/components/MasterDataManager";
import {
  Download,
  Folder,
  Loader2,
  Package,
  Plus,
  Search as SearchIcon,
  Settings2,
  Sigma,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;

const inputCls =
  "h-9 w-full rounded-lg border bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30";

/** Products page: add-product form + Excel-style listing of FG products with costs. */
export default function ProductForm({
  finishedGoods,
  onSelectFg,
  activeFgId,
  initialProject,
}: {
  finishedGoods: FgDoc[];
  onSelectFg: (id: Id<"finishedGoods">) => void;
  activeFgId: Id<"finishedGoods"> | null;
  initialProject?: string | null;
}) {
  const removeFg = useMutation(api.costing.removeFinishedGood);
  const addFg = useMutation(api.costing.addFinishedGood);
  const updateFg = useMutation(api.costing.updateFinishedGood);

  // managed master data for dropdowns
  const masterUnits = useQuery(api.costing.listUnits);
  const masterCategories = useQuery(api.costing.listCategories);
  const units = masterUnits ?? [];
  const parentCategories = (masterCategories ?? []).filter((c) => c.parentId === undefined);
  const allCategories = masterCategories ?? [];
  const subsOf = (name: string) => {
    const parent = parentCategories.find((c) => c.name === name);
    if (!parent) return [];
    return allCategories.filter((c) => c.parentId === parent._id);
  };
  const [showManager, setShowManager] = useState(false);

  const [project, setProject] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("$");
  const [markup, setMarkup] = useState("0");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  // when arriving from the Projects tab, pre-filter to that project
  useEffect(() => {
    if (initialProject) setProjectFilter(initialProject);
  }, [initialProject]);

  // product costs across all FGs (single query, grouped client-side)
  const allItems = useQuery(api.costing.listAllItems);
  const costByFg = useMemo(() => {
    const map = new Map<Id<"finishedGoods">, number>();
    for (const item of allItems ?? []) {
      if (item.fgId === undefined) continue;
      map.set(item.fgId, (map.get(item.fgId) ?? 0) + item.qty * item.unitPrice);
    }
    return map;
  }, [allItems]);

  const projects = useMemo(
    () => Array.from(new Set(finishedGoods.map((f) => f.projectName))).sort(),
    [finishedGoods],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return finishedGoods
      .filter((f) => {
        if (projectFilter !== "all" && f.projectName !== projectFilter) return false;
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          f.projectName.toLowerCase().includes(q) ||
          (f.code ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        a.projectName === b.projectName
          ? a.name.localeCompare(b.name)
          : a.projectName.localeCompare(b.projectName),
      );
  }, [finishedGoods, search, projectFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanProject = project.trim();
    const cleanName = name.trim();
    if (!cleanProject) {
      toast.error("Give the project a name.");
      return;
    }
    if (!cleanName) {
      toast.error("Give the product a name.");
      return;
    }
    const markupNum = Number(markup) || 0;
    if (markupNum < 0) {
      toast.error("Markup can't be negative.");
      return;
    }
    setSaving(true);
    try {
      const id = await addFg({
        projectName: cleanProject,
        name: cleanName,
        code: code.trim() || undefined,
        unit: unit.trim() || undefined,
        category: category.trim() || undefined,
        subCategory: subCategory.trim() || undefined,
        note: note.trim() || undefined,
        currency: currency.trim() || "$",
        markupPct: markupNum,
      });
      toast.success(`“${cleanName}” created — open it to add materials.`);
      onSelectFg(id);
      setName("");
      setCode("");
      setCategory("");
      setSubCategory("");
      setNote("");
      setMarkup("0");
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fg: FgDoc) => {
    if (!window.confirm(`Delete product “${fg.name}” and all its costing lines?`)) return;
    try {
      await removeFg({ id: fg._id });
      toast.success("Product deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the product.");
    }
  };

  const exportCsv = () => {
    const lines = [
      ["Project", "Product", "Code", "Unit", "Markup %", "Cost", "Total"].join(","),
      ...rows.map((f) => {
        const cost = costByFg.get(f._id) ?? 0;
        const total = cost * (1 + (f.markupPct ?? 0) / 100);
        return [
          `"${f.projectName.replace(/"/g, '""')}"`,
          `"${f.name.replace(/"/g, '""')}"`,
          `"${(f.code ?? "").replace(/"/g, '""')}"`,
          f.unit ?? "",
          String(f.markupPct ?? 0),
          cost.toFixed(2),
          total.toFixed(2),
        ].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* master-data manager — must stay OUTSIDE the form (nested forms are
          invalid HTML: the browser strips inner forms, so the manager's Add
          buttons would submit the outer create-product form instead) */}
      {showManager && (
        <div className="mb-3">
          <MasterDataManager
            units={units}
            categories={allCategories}
            onClose={() => setShowManager(false)}
          />
        </div>
      )}
      {/* add product bar (collapsible, like the materials add bar) */}
      {showForm ? (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Package className="size-3.5" />
              New product (FG)
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowManager((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings2 className="size-3.5" />
                Manage units & categories
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              list="known-projects"
              placeholder="Project *"
              aria-label="Project"
              className="h-9 rounded-lg text-sm"
            />
            <datalist id="known-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name * e.g. Wooden chair"
              aria-label="Product name"
              className="h-9 rounded-lg text-sm"
            />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code / SKU"
              aria-label="Product code"
              className="h-9 rounded-lg text-sm"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Sold per unit"
              className="h-9 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Sold per (unit)…</option>
              {units.map((u) => (
                <option key={u._id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubCategory("");
              }}
              aria-label="Category"
              className="h-9 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Category…</option>
              {parentCategories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              aria-label="Sub-category"
              disabled={!category || subsOf(category).length === 0}
              className="h-9 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">Sub-category…</option>
              {subsOf(category).map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="Currency"
              maxLength={4}
              aria-label="Currency"
              className="h-9 rounded-lg text-sm"
            />
            <Input
              type="number"
              min="0"
              step="any"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              placeholder="Markup %"
              aria-label="Markup percent"
              className="h-9 rounded-lg text-sm"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (finish, dimensions…)"
              aria-label="Product note"
              className="h-9 rounded-lg text-sm sm:col-span-2 lg:col-span-2"
            />
          </div>
          <Button type="submit" size="sm" className="mt-2 h-9 rounded-lg" disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create product
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed bg-card/60 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New product (FG) — project, name, code, unit, markup…
        </button>
      )}

      {/* listing sheet — matches the raw-materials sheet */}
      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <p className="text-sm font-semibold">
            Products
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} item{rows.length === 1 ? "" : "s"}
              {projects.length > 0 ? ` · ${projects.length} projects` : ""}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, code…"
                className="w-40 rounded-lg border bg-background py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter by project"
              className="rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {rows.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={exportCsv}>
                <Download className="size-3" />
                CSV
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                <th className="w-10 px-3 py-2 font-semibold">#</th>
                <th className="w-40 px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="w-24 px-3 py-2 font-semibold">Code</th>
                <th className="w-16 px-3 py-2 font-semibold">Unit</th>
                <th className="w-28 px-3 py-2 font-semibold">Category</th>
                <th className="w-16 px-3 py-2 text-right font-semibold">Markup</th>
                <th className="w-24 px-3 py-2 text-right font-semibold">Cost</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Total</th>
                <th className="w-16 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {allItems === undefined || finishedGoods === undefined ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                    Loading products…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    {search || projectFilter !== "all"
                      ? "Nothing matches the current search/filter."
                      : "No products yet — create your first FG above."}
                  </td>
                </tr>
              ) : (
                rows.map((f, i) => {
                  const cost = costByFg.get(f._id) ?? 0;
                  const total = cost * (1 + (f.markupPct ?? 0) / 100);
                  const active = activeFgId === f._id;
                  return (
                    <tr
                      key={f._id}
                      className={cn(
                        "group/row transition-colors hover:bg-accent/40",
                        active && "bg-primary/[0.06]",
                      )}
                    >
                      <td className="px-3 py-1 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Folder className="size-3 shrink-0 text-sky-500/80" />
                          <span className="truncate">{f.projectName}</span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectFg(f._id)}
                          className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-primary/5"
                          title="Open costing sheet"
                        >
                          <Package
                            className={cn(
                              "size-4 shrink-0",
                              active ? "text-primary" : "text-muted-foreground/70",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm font-medium",
                                active && "text-primary",
                              )}
                            >
                              {f.name}
                            </span>
                            {f.note && (
                              <span className="block truncate text-[10px] text-muted-foreground/80">
                                {f.note}
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {f.code || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{f.unit ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {f.category ? f.category : "—"}
                        {f.subCategory ? ` › ${f.subCategory}` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {(f.markupPct ?? 0) > 0 ? `+${f.markupPct}%` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {f.currency ?? "$"}
                        {cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {f.currency ?? "$"}
                        {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span className="hidden gap-1 group-hover/row:inline-flex">
                          <button
                            type="button"
                            aria-label={`Open “${f.name}”`}
                            title="Open costing sheet"
                            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-primary"
                            onClick={() => onSelectFg(f._id)}
                          >
                            <Sigma className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete “${f.name}”`}
                            title="Delete product"
                            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"
                            onClick={() => void handleDelete(f)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a product to open its costing sheet — add raw materials with quantities and custom
        lines, then read the total with markup. Cost updates live as you edit the sheet.
      </p>
    </div>
  );
}
