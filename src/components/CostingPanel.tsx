import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SheetId = Id<"costingSheets">;
type MaterialDoc = Doc<"rawMaterials">;

const cellCls =
  "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-primary/5 focus:ring-2 focus:ring-primary/30 rounded-md";

/** Number formatting for the money columns. */
function money(value: number, currency: string) {
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The Excel-like costing grid for one sheet. */
export default function CostingPanel({
  materials,
  sheets,
  loading,
  activeSheetId,
  onSelectSheet,
  onNewSheet,
  onRenameSheet,
  onDeleteSheet,
  onAddMaterial,
}: {
  materials: MaterialDoc[];
  sheets: Doc<"costingSheets">[];
  loading: boolean;
  activeSheetId: SheetId | null;
  onSelectSheet: (id: SheetId | null) => void;
  onNewSheet: () => void;
  onRenameSheet: (sheet: Doc<"costingSheets">) => void;
  onDeleteSheet: (sheet: Doc<"costingSheets">) => void;
  onAddMaterial: () => void;
}) {
  const addItem = useMutation(api.costing.addItem);
  const updateItem = useMutation(api.costing.updateItem);
  const removeItem = useMutation(api.costing.removeItem);
  const updateSheetM = useMutation(api.costing.updateSheet);

  const [addingMaterialId, setAddingMaterialId] = useState<string>("");
  const [materialQty, setMaterialQty] = useState("1");
  const [customLabel, setCustomLabel] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customPrice, setCustomPrice] = useState("0");

  const sheet = sheets.find((s) => s._id === activeSheetId) ?? sheets[0] ?? null;
  const currency = sheet?.currency ?? "$";
  const markupPct = sheet?.markupPct ?? 0;

  const items = useQuery(
    api.costing.listItems,
    sheet ? { sheetId: sheet._id } : "skip",
  );
  const rows = items ?? [];

  const totals = useMemo(() => {
    const subtotal = rows.reduce((sum, r) => sum + r.qty * r.unitPrice, 0);
    const markup = subtotal * (markupPct / 100);
    return { subtotal, markup, grand: subtotal + markup };
  }, [rows, markupPct]);

  const addMaterialRow = async () => {
    if (!sheet || !addingMaterialId) return;
    const qty = Number(materialQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    try {
      await addItem({
        sheetId: sheet._id,
        materialId: addingMaterialId as MaterialDoc["_id"],
        qty,
      });
      setAddingMaterialId("");
      setMaterialQty("1");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the row.");
    }
  };

  const addCustomRow = async () => {
    if (!sheet) return;
    const qty = Number(customQty);
    const price = Number(customPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price can't be negative.");
      return;
    }
    try {
      const id = await addItem({
        sheetId: sheet._id,
        label: customLabel.trim() || "Custom line",
        qty,
      });
      if (price > 0) {
        await updateItem({ id, unitPrice: price });
      }
      setCustomLabel("");
      setCustomQty("1");
      setCustomPrice("0");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the row.");
    }
  };

  const exportCsv = () => {
    if (!sheet) return;
    const lines = [
      ["Description", "Qty", "Unit", "Unit price", "Amount"].join(","),
      ...rows.map((r) =>
        [
          `"${r.label.replace(/"/g, '""')}"`,
          String(r.qty),
          r.unit ?? "",
          String(r.unitPrice),
          (r.qty * r.unitPrice).toFixed(2),
        ].join(","),
      ),
      `"Markup (${markupPct}%)",,,,"${(totals.markup).toFixed(2)}"`,
      `"TOTAL",,,,"${totals.grand.toFixed(2)}"`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ── Sheet tabs (like workbook tabs in Excel) ──────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {sheets.map((s) => {
          const active = sheet?._id === s._id;
          return (
            <div
              key={s._id}
              className={cn(
                "group/tab flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <button type="button" onClick={() => onSelectSheet(s._id)}>
                <FileSpreadsheet className="mr-1.5 inline size-3.5" />
                {s.name}
              </button>
              <button
                type="button"
                aria-label={`Delete “${s.name}”`}
                className="hidden text-muted-foreground hover:text-destructive group-hover/tab:inline"
                onClick={() => onDeleteSheet(s)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onNewSheet}
          className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New sheet
        </button>
        {sheet && (
          <button
            type="button"
            onClick={() => onRenameSheet(sheet)}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Rename
          </button>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {sheet === null ? (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="px-6 py-14 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 font-medium">No costing sheet yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a sheet above, then add raw-material rows to cost a job.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* add-row bars */}
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {/* from raw materials */}
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Package className="size-3.5" />
                Add raw material
              </p>
              <div className="flex gap-1.5">
                <select
                  value={addingMaterialId}
                  onChange={(e) => setAddingMaterialId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border bg-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Choose material…</option>
                  {materials.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.pricePerUnit}/{m.unit})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={materialQty}
                  onChange={(e) => setMaterialQty(e.target.value)}
                  className="h-9 w-20 rounded-lg text-sm"
                  aria-label="Quantity"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-lg"
                  disabled={!addingMaterialId || items === undefined}
                  onClick={() => void addMaterialRow()}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {materials.length === 0 && (
                <button
                  type="button"
                  onClick={onAddMaterial}
                  className="mt-1.5 text-xs text-primary hover:underline"
                >
                  + Add your first raw material (sidebar)
                </button>
              )}
            </div>

            {/* custom line */}
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Plus className="size-3.5" />
                Add custom line
              </p>
              <div className="flex gap-1.5">
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Labor, Transport…"
                  className="h-9 min-w-0 flex-1 rounded-lg text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  className="h-9 w-16 rounded-lg text-sm"
                  aria-label="Quantity"
                />
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-9 w-20 rounded-lg text-sm"
                  aria-label="Unit price"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg"
                  disabled={items === undefined}
                  onClick={() => void addCustomRow()}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* the spreadsheet */}
          <section className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="w-24 px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="w-20 px-3 py-2 font-semibold">Unit</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">Unit price</th>
                    <th className="w-32 px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items === undefined ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                        Loading rows…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        Empty sheet — add a raw material or a custom line above.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr key={row._id} className="group/row transition-colors hover:bg-accent/40">
                        <td className="px-3 py-1 text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.label}
                            onChange={(e) =>
                              void updateItem({ id: row._id, label: e.target.value }).catch(
                                () => toast.error("Couldn't rename the line."),
                              )
                            }
                            className={cellCls}
                            aria-label="Description"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.qty}
                            onChange={(e) =>
                              void updateItem({
                                id: row._id,
                                qty: Number(e.target.value),
                              }).catch(() => {})
                            }
                            className={cn(cellCls, "text-right tabular-nums")}
                            aria-label="Quantity"
                          />
                        </td>
                        <td className="px-3 py-1 text-xs text-muted-foreground">
                          {row.unit ?? "—"}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.unitPrice}
                            onChange={(e) =>
                              void updateItem({
                                id: row._id,
                                unitPrice: Number(e.target.value),
                              }).catch(() => {})
                            }
                            className={cn(cellCls, "text-right tabular-nums")}
                            aria-label="Unit price"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {money(row.qty * row.unitPrice, currency)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            aria-label="Delete row"
                            className="hidden text-muted-foreground hover:text-destructive group-hover/row:inline"
                            onClick={() =>
                              void removeItem({ id: row._id }).catch(() =>
                                toast.error("Couldn't delete the row."),
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
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border/70 bg-muted/30">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                        Subtotal
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-right font-medium tabular-nums">
                        {money(totals.subtotal, currency)}
                      </td>
                    </tr>
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          Markup
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={markupPct}
                            onChange={(e) =>
                              void updateSheetM({
                                id: sheet._id,
                                markupPct: Number(e.target.value),
                              }).catch(() => {})
                            }
                            className="w-14 rounded border bg-card px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            aria-label="Markup percent"
                          />
                          %
                        </span>
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-right font-medium tabular-nums">
                        +{money(totals.markup, currency)}
                      </td>
                    </tr>
                    <tr className="border-t border-border/70 bg-primary/5">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <Sigma className="size-3.5 text-primary" />
                          Total
                        </span>
                      </td>
                      <td colSpan={3} className="px-3 py-2.5 text-right font-display text-base font-bold tabular-nums text-primary">
                        {money(totals.grand, currency)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {rows.length > 0 && (
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={exportCsv}>
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
