import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MasterDataManager from "@/components/MasterDataManager";
import {
  Download,
  Loader2,
  Package,
  Plus,
  Search as SearchIcon,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MaterialDoc = Doc<"rawMaterials">;

const cellCls =
  "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-primary/5 focus:ring-2 focus:ring-primary/30 rounded-md";

/** In-page raw-material listing sheet (Excel-style rows, master price list). */
export default function MaterialsSheet({
  materials,
  loading,
}: {
  materials: MaterialDoc[];
  loading: boolean;
}) {
  const addMaterial = useMutation(api.costing.addMaterial);
  const updateMaterial = useMutation(api.costing.updateMaterial);
  const removeMaterial = useMutation(api.costing.removeMaterial);

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

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(materials.map((m) => m.category).filter(Boolean) as string[])).sort(),
    [materials],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => {
        if (categoryFilter !== "all" && (m.category ?? "") !== categoryFilter) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          (m.code ?? "").toLowerCase().includes(q) ||
          (m.category ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, categoryFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    const priceNum = Number(price);
    if (!clean) {
      toast.error("Give the material a name.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price per unit.");
      return;
    }
    setSaving(true);
    try {
      await addMaterial({
        code: code.trim() || undefined,
        name: clean,
        category: category.trim() || undefined,
        subCategory: subCategory.trim() || undefined,
        unit: unit.trim() || "pcs",
        pricePerUnit: priceNum,
      });
      setCode("");
      setName("");
      setSubCategory("");
      setPrice("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the material.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const lines = [
      ["Code", "Name", "Category", "Sub-category", "Unit", "Price per unit"].join(","),
      ...rows.map((m) =>
        [
          `"${(m.code ?? "").replace(/"/g, '""')}"`,
          `"${m.name.replace(/"/g, '""')}"`,
          `"${(m.category ?? "").replace(/"/g, '""')}"`,
          `"${(m.subCategory ?? "").replace(/"/g, '""')}"`,
          m.unit,
          String(m.pricePerUnit),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raw-materials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* add material bar */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border bg-card p-3 shadow-sm"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Package className="size-3.5" />
            Add raw material
          </p>
          <button
            type="button"
            onClick={() => setShowManager((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
            Manage units & categories
          </button>
        </div>
        {showManager && (
          <div className="mb-3">
            <MasterDataManager
              units={units}
              categories={allCategories}
              onClose={() => setShowManager(false)}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code, e.g. RM-001"
            aria-label="Material code"
            className="h-9 w-28 rounded-lg text-sm"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Material name, e.g. Teak wood"
            className="h-9 min-w-[150px] flex-1 rounded-lg text-sm"
          />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSubCategory("");
            }}
            aria-label="Category"
            className="h-9 w-32 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
            className="h-9 w-32 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            <option value="">Sub-category…</option>
            {subsOf(category).map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Unit"
            className="h-9 w-20 rounded-lg border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Unit…</option>
            {units.map((u) => (
              <option key={u._id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Unit price"
            aria-label="Price per unit"
            className="h-9 w-24 rounded-lg text-sm"
          />
          <Button type="submit" size="sm" className="h-9 rounded-lg" disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add
          </Button>
        </div>
      </form>

      {/* listing sheet */}
      <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <p className="text-sm font-semibold">
            Raw materials
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} item{rows.length === 1 ? "" : "s"}
              {categories.length > 0 ? ` · ${categories.length} categories` : ""}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, name…"
                className="w-40 rounded-lg border bg-background py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
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
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                <th className="w-10 px-3 py-2 font-semibold">#</th>
                <th className="w-24 px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="w-28 px-3 py-2 font-semibold">Category</th>
                <th className="w-28 px-3 py-2 font-semibold">Sub-cat.</th>
                <th className="w-16 px-3 py-2 font-semibold">Unit</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Unit price</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                    Loading materials…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {search || categoryFilter !== "all"
                      ? "Nothing matches the current search/filter."
                      : "No raw materials yet — add your first one above."}
                  </td>
                </tr>
              ) : (
                rows.map((m, i) => (
                  <tr key={m._id} className="group/row transition-colors hover:bg-accent/40">
                    <td className="px-3 py-1 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-1 py-1">
                      <input
                        value={m.code ?? ""}
                        onChange={(e) =>
                          void updateMaterial({ id: m._id, code: e.target.value }).catch(() => {})
                        }
                        className={cn(cellCls, "font-mono text-xs")}
                        aria-label="Material code"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={m.name}
                        onChange={(e) =>
                          void updateMaterial({ id: m._id, name: e.target.value }).catch(
                            () => toast.error("Couldn't rename the material."),
                          )
                        }
                        className={cellCls}
                        aria-label="Material name"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={m.category ?? ""}
                        onChange={(e) =>
                          void updateMaterial({ id: m._id, category: e.target.value }).catch(() => {})
                        }
                        className={cn(cellCls, "cursor-pointer")}
                        aria-label="Category"
                      >
                        <option value="">—</option>
                        {parentCategories.map((c) => (
                          <option key={c._id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={m.subCategory ?? ""}
                        onChange={(e) =>
                          void updateMaterial({ id: m._id, subCategory: e.target.value }).catch(
                            () => {},
                          )
                        }
                        className={cn(cellCls, "cursor-pointer")}
                        aria-label="Sub-category"
                      >
                        <option value="">—</option>
                        {subsOf(m.category ?? "").map((c) => (
                          <option key={c._id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={units.some((u) => u.name === m.unit) ? m.unit : ""}
                        onChange={(e) =>
                          void updateMaterial({ id: m._id, unit: e.target.value }).catch(() => {})
                        }
                        className={cn(cellCls, "cursor-pointer")}
                        aria-label="Unit"
                      >
                        {units.some((u) => u.name === m.unit) ? null : (
                          <option value="">{m.unit}</option>
                        )}
                        {units.map((u) => (
                          <option key={u._id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={m.pricePerUnit}
                        onChange={(e) =>
                          void updateMaterial({
                            id: m._id,
                            pricePerUnit: Number(e.target.value),
                          }).catch(() => {})
                        }
                        className={cn(cellCls, "text-right tabular-nums")}
                        aria-label="Price per unit"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        aria-label={`Delete ${m.name}`}
                        className="hidden text-muted-foreground hover:text-destructive group-hover/row:inline"
                        onClick={() =>
                          void removeMaterial({ id: m._id }).catch(() =>
                            toast.error("Couldn't delete the material."),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        This list is the master price list — costing sheets pick materials from here, so prices stay
        consistent across products.
      </p>
    </div>
  );
}
