import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;

const inputCls =
  "h-9 w-full rounded-lg border bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30";

/** Detailed product creation form + list of existing FG products with costs. */
export default function ProductForm({
  finishedGoods,
  onSelectFg,
  activeFgId,
}: {
  finishedGoods: FgDoc[];
  onSelectFg: (id: Id<"finishedGoods">) => void;
  activeFgId: Id<"finishedGoods"> | null;
}) {
  const addFinishedGood = useMutation(api.costing.addFinishedGood);

  const [project, setProject] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("$");
  const [markup, setMarkup] = useState("0");
  const [saving, setSaving] = useState(false);

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

  const knownProjects = useMemo(
    () => Array.from(new Set(finishedGoods.map((f) => f.projectName))).sort(),
    [finishedGoods],
  );

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
      const id = await addFinishedGood({
        projectName: cleanProject,
        name: cleanName,
        code: code.trim() || undefined,
        unit: unit.trim() || undefined,
        note: note.trim() || undefined,
        currency: currency.trim() || "$",
        markupPct: markupNum,
      });
      toast.success(`“${cleanName}” created — add its materials next.`);
      onSelectFg(id);
      setName("");
      setCode("");
      setNote("");
      setMarkup("0");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── creation form ─────────────────────────────────────────── */}
      <form onSubmit={handleCreate} className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="font-display text-lg font-semibold">Create product</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A finished good (FG) is the product you cost — it lives under a project.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Project *
            </span>
            <Input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              list="known-projects"
              placeholder="e.g. Furniture line A"
              className="h-9 rounded-lg text-sm"
            />
            <datalist id="known-projects">
              {knownProjects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Product name (FG) *
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wooden chair"
              className="h-9 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Product code / SKU
            </span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WC-001"
              className="h-9 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Sold per (unit)
            </span>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs"
              className="h-9 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Currency</span>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="$"
              maxLength={4}
              className="h-9 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Profit markup %
            </span>
            <Input
              type="number"
              min="0"
              step="any"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Product note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Short description, finish, dimensions…"
              className="w-full resize-y rounded-lg border bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <Button type="submit" className="mt-4 w-full rounded-xl" disabled={saving}>
          {saving ? "Creating…" : "Create product"}
        </Button>
      </form>

      {/* ── products list ─────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b border-border/60 px-5 py-3">
          <p className="text-sm font-semibold">
            Products
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {finishedGoods.length} total
            </span>
          </p>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {finishedGoods.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              No products yet — create your first FG on the left.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {finishedGoods.map((fg) => {
                const cost = costByFg.get(fg._id) ?? 0;
                const total = cost * (1 + (fg.markupPct ?? 0) / 100);
                const active = activeFgId === fg._id;
                return (
                  <li key={fg._id}>
                    <button
                      type="button"
                      onClick={() => onSelectFg(fg._id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/50",
                        active && "bg-primary/[0.06]",
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Package className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {fg.name}
                          {fg.code && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {fg.code}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {fg.projectName}
                          {fg.unit ? ` · per ${fg.unit}` : ""}
                          {(fg.markupPct ?? 0) > 0 ? ` · +${fg.markupPct}%` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">
                          {fg.currency ?? "$"}
                          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          cost {fg.currency ?? "$"}
                          {cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
