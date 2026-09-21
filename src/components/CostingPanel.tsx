import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MaterialsSheet from "@/components/MaterialsSheet";
import ProductForm from "@/components/ProductForm";
import ProjectsSheet from "@/components/ProjectsSheet";
import type { CostingView } from "@/components/CostingSidebar";
import {
  Download,
  FileSpreadsheet,
  Folder,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Sigma,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useAppDialogs } from "@/components/AppDialogs";
import { cn } from "@/lib/utils";

type FgId = Id<"finishedGoods">;
type FgDoc = Doc<"finishedGoods">;
type MaterialDoc = Doc<"rawMaterials">;

const cellCls =
  "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-primary/5 focus:ring-2 focus:ring-primary/30 rounded-md";

function money(value: number, currency: string) {
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Main costing area: raw-materials sheet, product form/list, or FG costing grid. */
export default function CostingPanel({
  materials,
  finishedGoods,
  loading,
  view,
  onSelectView,
  onNewFg,
  onRenameFg,
  onDeleteFg,
  onEditFg,
}: {
  materials: MaterialDoc[];
  finishedGoods: FgDoc[];
  loading: boolean;
  view: CostingView;
  onSelectView: (view: CostingView) => void;
  onNewFg: (projectName: string) => void;
  onRenameFg: (fg: FgDoc) => void;
  onDeleteFg: (fg: FgDoc) => void;
  onEditFg: (fg: FgDoc) => void;
}) {
  const [projectFocus, setProjectFocus] = useState<string | null>(null);
  const addFgItem = useMutation(api.costing.addFgItem);
  const updateItem = useMutation(api.costing.updateItem);
  const removeItem = useMutation(api.costing.removeItem);
  const updateFg = useMutation(api.costing.updateFinishedGood);
  const setFgImage = useMutation(api.costing.setFgImage);
  const clearFgImageM = useMutation(api.costing.clearFgImage);
  const { confirm, promptMulti } = useAppDialogs();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handlePickImage = () => imageInputRef.current?.click();

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeFg) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (photo, PNG, JPG…).");
      return;
    }
    if (file.size > 900_000) {
      toast.error("Images up to ~900 KB can be attached.");
      return;
    }
    setUploadingImage(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await setFgImage({ id: activeFg._id, data, name: file.name, size: file.size });
      toast.success("Product image updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't attach the image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!activeFg?.imageUrl) return;
    const ok = await confirm({
      title: "Remove the product image?",
      message: "The photo is detached from this product. It can be added again anytime.",
      confirmLabel: "Remove image",
      danger: true,
    });
    if (!ok) return;
    try {
      await clearFgImageM({ id: activeFg._id });
      toast.success("Image removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove the image.");
    }
  };

  // ── FG costing grid state ──────────────────────────────────────────
  const [addingMaterialId, setAddingMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [customLabel, setCustomLabel] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customPrice, setCustomPrice] = useState("0");

  // Draft state — edits stay local until "Save" is pressed.
  const [drafts, setDrafts] = useState<
    { id: Id<"costingItems">; label: string; qty: number; unitPrice: number }[]
  >([]);
  const [savingSheet, setSavingSheet] = useState(false);

  const activeFg =
    view?.kind === "fg"
      ? (finishedGoods.find((f) => f._id === view.fgId) ?? null)
      : null;
  const currency = activeFg?.currency ?? "$";
  const markupPct = activeFg?.markupPct ?? 0;

  const items = useQuery(
    api.costing.listFgItems,
    view?.kind === "fg" ? { fgId: view.fgId } : "skip",
  );
  const rows = items ?? [];

  const totals = useMemo(() => {
    const subtotal = rows.reduce((sum, r) => sum + r.qty * r.unitPrice, 0);
    const markup = subtotal * (markupPct / 100);
    return { subtotal, markup, grand: subtotal + markup };
  }, [rows, markupPct]);

  // ── Draft (save-button) logic ─────────────────────────────────────
  // Keep a local draft of every visible row; reset it when the sheet's
  // server data changes shape (rows added/removed or another FG opened).
  useEffect(() => {
    setDrafts(
      rows.map((r) => ({ id: r._id, label: r.label, qty: r.qty, unitPrice: r.unitPrice })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeFg?._id]);

  const isDirty = useMemo(() => {
    if (drafts.length !== rows.length) return rows.length > 0;
    return rows.some((r) => {
      const d = drafts.find((x) => x.id === r._id);
      return d ? d.label !== r.label || d.qty !== r.qty || d.unitPrice !== r.unitPrice : false;
    });
  }, [drafts, rows]);

  const updateDraft = (id: Id<"costingItems">, patch: Partial<{ label: string; qty: number; unitPrice: number }>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const saveSheet = async () => {
    if (!activeFg) return;
    setSavingSheet(true);
    try {
      for (const r of rows) {
        const d = drafts.find((x) => x.id === r._id);
        if (!d) continue;
        const changed =
          d.label !== r.label || d.qty !== r.qty || d.unitPrice !== r.unitPrice;
        if (changed) {
          await updateItem({
            id: r._id,
            label: d.label,
            qty: d.qty,
            unitPrice: d.unitPrice,
          });
        }
      }
      toast.success("Sheet saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the sheet.");
    } finally {
      setSavingSheet(false);
    }
  };

  // Ctrl/Cmd+S saves the sheet.
  useEffect(() => {
    if (!isDirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, drafts]);

  /** Per-row edit dialog (pencil icon). */
  const handleEditRow = async (row: { _id: Id<"costingItems">; label: string; qty: number; unitPrice: number }) => {
    if (!activeFg) return;
    const result = await promptMulti({
      title: `Edit line — ${row.label}`,
      message: "Change the description, quantity, or unit price.",
      columns: 2,
      confirmLabel: "Apply",
      fields: [
        { key: "label", label: "Description", initial: row.label, required: true },
        { key: "qty", label: "Quantity", initial: String(row.qty), type: "number", required: true },
        {
          key: "price",
          label: "Unit price",
          initial: String(row.unitPrice),
          type: "number",
          required: true,
        },
      ],
    });
    if (result === null) return;
    const qty = Number(result.qty);
    const price = Number(result.price);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price can't be negative.");
      return;
    }
    try {
      await updateItem({ id: row._id, label: result.label, qty, unitPrice: price });
      toast.success("Line updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the line.");
    }
  };

  const addMaterialRow = async () => {
    if (!activeFg || !addingMaterialId) return;
    const qty = Number(materialQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    try {
      await addFgItem({
        fgId: activeFg._id,
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
    if (!activeFg) return;
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
      await addFgItem({
        fgId: activeFg._id,
        label: customLabel.trim() || "Custom line",
        qty,
        unitPrice: price,
      });
      setCustomLabel("");
      setCustomQty("1");
      setCustomPrice("0");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the row.");
    }
  };

  const exportCsv = () => {
    if (!activeFg) return;
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
      `"Markup (${markupPct}%)",,,,"${totals.markup.toFixed(2)}"`,
      `"TOTAL",,,,"${totals.grand.toFixed(2)}"`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFg.name.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectView({ kind: "materials" })}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            view?.kind === "materials"
              ? "border-primary/40 bg-primary/10 font-medium text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Layers className="size-3.5" />
          Raw materials
        </button>
        <button
          type="button"
          onClick={() => onSelectView({ kind: "products" })}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            view?.kind === "products" || view === null
              ? "border-primary/40 bg-primary/10 font-medium text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Package className="size-3.5" />
          Products
        </button>
        <button
          type="button"
          onClick={() => onSelectView({ kind: "projects" })}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            view?.kind === "projects"
              ? "border-primary/40 bg-primary/10 font-medium text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Folder className="size-3.5" />
          Projects
        </button>
        {activeFg && (
          <span className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <FileSpreadsheet className="size-3.5" />
            {activeFg.name}
            <span className="text-xs font-normal text-primary/70">{activeFg.projectName}</span>
            <button
              type="button"
              aria-label="Close product sheet"
              className="text-primary/60 hover:text-primary"
              onClick={() => onSelectView(null)}
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {/* ── Views ────────────────────────────────────────────────────── */}
      {view?.kind === "materials" ? (
        <div className="mt-4">
          <MaterialsSheet materials={materials} loading={materials === undefined} />
        </div>
      ) : view?.kind === "projects" ? (
        <div className="mt-4">
          <ProjectsSheet
            finishedGoods={finishedGoods}
            loading={loading}
            onOpenProject={(name) => {
              setProjectFocus(name);
              onSelectView({ kind: "products" });
            }}
            onNewProject={() => onNewFg("new")}
          />
        </div>
      ) : view?.kind === "fg" && activeFg ? (
        <>
          {/* product header */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            {/* product image: thumbnail or add button */}
            {activeFg.imageUrl ? (
              <div className="group/img relative shrink-0">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  title="Click to enlarge"
                  className="block size-14 overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={activeFg.imageUrl}
                    alt={activeFg.imageAlt ?? activeFg.name}
                    className="size-full object-cover"
                  />
                </button>
                <span className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover/img:flex">
                  <button
                    type="button"
                    aria-label="Replace image"
                    title="Replace image"
                    className="grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-primary"
                    onClick={handlePickImage}
                  >
                    <Pencil className="size-2.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove image"
                    title="Remove image"
                    className="grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                    onClick={() => void handleRemoveImage()}
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePickImage}
                title="Add a product image"
                className="grid size-14 shrink-0 place-items-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {uploadingImage ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFile}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold">{activeFg.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeFg.projectName}
                {activeFg.code ? ` · ${activeFg.code}` : ""}
                {activeFg.unit ? ` · per ${activeFg.unit}` : ""}
              </p>
              {activeFg.note && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{activeFg.note}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => onEditFg(activeFg)}
            >
              Edit details
            </Button>
          </div>

          {/* image lightbox */}
          {lightboxOpen && activeFg.imageUrl && (
            <div
              className="fixed inset-0 z-[100] grid place-items-center bg-foreground/60 p-6 backdrop-blur-sm animate-in fade-in duration-150"
              onClick={() => setLightboxOpen(false)}
            >
              <figure className="max-h-full max-w-3xl">
                <img
                  src={activeFg.imageUrl}
                  alt={activeFg.imageAlt ?? activeFg.name}
                  className="max-h-[80vh] max-w-full rounded-xl border bg-card object-contain shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
                <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-background/90">
                  <span className="truncate">
                    {activeFg.name}
                    {activeFg.imageAlt ? ` — ${activeFg.imageAlt}` : ""}
                  </span>
                  <span className="shrink-0 opacity-70">Click anywhere to close</span>
                </figcaption>
              </figure>
            </div>
          )}

          {/* add-row bars */}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
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
                      {m.code ? `${m.code} · ` : ""}
                      {m.name}
                      {m.category ? ` [${m.category}]` : ""} ({m.pricePerUnit}/{m.unit})
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
                  onClick={() => onSelectView({ kind: "materials" })}
                  className="mt-1.5 text-xs text-primary hover:underline"
                >
                  + Add raw materials first (open the Raw materials tab)
                </button>
              )}
            </div>

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
                        <td className="px-3 py-2 font-medium">{row.label}</td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={drafts.find((d) => d.id === row._id)?.qty ?? row.qty}
                            onChange={(e) =>
                              updateDraft(row._id, { qty: Number(e.target.value) })
                            }
                            className={cn(cellCls, "text-right tabular-nums")}
                            aria-label="Quantity"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.unit ?? "—"}</td>
                        <td className="px-1 py-1">
                          <span className="block px-2 py-1.5 text-right tabular-nums">
                            {row.unitPrice.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {money(
                            (drafts.find((d) => d.id === row._id)?.qty ?? row.qty) *
                              (drafts.find((d) => d.id === row._id)?.unitPrice ?? row.unitPrice),
                            currency,
                          )}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <span className="hidden gap-0.5 group-hover/row:inline-flex">
                            <button
                              type="button"
                              aria-label={`Edit ${row.label}`}
                              title="Edit line"
                              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-primary"
                              onClick={() => void handleEditRow(row)}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete row"
                              title="Delete line"
                              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                void removeItem({ id: row._id }).catch(() =>
                                  toast.error("Couldn't delete the row."),
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </span>
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
                          Margin
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={markupPct}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 0 && activeFg) {
                                void updateFg({ id: activeFg._id, markupPct: v }).catch(() =>
                                  toast.error("Couldn't update the margin."),
                                );
                              }
                            }}
                            className="w-14 rounded border bg-card px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
                            aria-label="Margin percent"
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
                          Sales price
                        </span>
                      </td>
                      <td
                        colSpan={3}
                        className="px-3 py-2.5 text-right font-display text-base font-bold tabular-nums text-primary"
                      >
                        {money(totals.grand, currency)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {rows.length > 0 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <span
                className={cn(
                  "text-xs transition-opacity",
                  isDirty ? "text-amber-600" : "text-muted-foreground/60 opacity-0",
                )}
              >
                Unsaved changes
              </span>
              <Button
                type="button"
                size="sm"
                className={cn("rounded-lg", isDirty && "animate-pulse")}
                disabled={!isDirty || savingSheet}
                onClick={() => void saveSheet()}
                title="Save all sheet edits (Ctrl/Cmd+S)"
              >
                {savingSheet ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {isDirty ? "Save" : "Saved"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={exportCsv}>
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="mt-4">
          <ProductForm
            finishedGoods={finishedGoods}
            activeFgId={view?.kind === "fg" ? view.fgId : null}
            onSelectFg={(id) => onSelectView({ kind: "fg", fgId: id })}
            initialProject={view?.kind === "products" ? projectFocus : null}
          />
        </div>
      )}
    </div>
  );
}
