import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

/** Sidebar: the raw-materials master list used for costing. */
export default function CostingSidebar({
  materials,
  loading,
  onAddMaterial,
  onRenameMaterial,
  onEditMaterial,
  onDeleteMaterial,
}: {
  materials: Doc<"rawMaterials">[];
  loading: boolean;
  onAddMaterial: () => void;
  onRenameMaterial: (material: Doc<"rawMaterials">) => void;
  onEditMaterial: (material: Doc<"rawMaterials">) => void;
  onDeleteMaterial: (material: Doc<"rawMaterials">) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = materials.filter((m) =>
    m.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Raw materials
        </span>
        <button
          type="button"
          aria-label="New material"
          title="New material"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onAddMaterial}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {materials.length > 3 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="mx-1 mb-1 rounded-lg border bg-card px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
        />
      )}

      {loading && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      )}

      {filtered.map((material) => (
        <div
          key={material._id}
          className="group/mat flex items-center gap-1.5 rounded-lg pr-1 transition-colors hover:bg-accent"
        >
          <button
            type="button"
            title={`${material.name} — ${material.pricePerUnit} / ${material.unit}`}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 pr-1 text-left"
            onClick={() => onEditMaterial(material)}
          >
            <Boxes className="size-4 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground/85">
                {material.name}
              </span>
              <span className="block text-[10px] tabular-nums text-muted-foreground">
                {material.pricePerUnit.toLocaleString()} / {material.unit}
              </span>
            </span>
          </button>
          <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within/mat:opacity-100 group-hover/mat:opacity-100">
            <button
              type="button"
              aria-label={`Rename “${material.name}”`}
              title="Rename"
              className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/mat:grid"
              onClick={() => onRenameMaterial(material)}
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              aria-label={`Delete “${material.name}”`}
              title="Delete"
              className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/mat:grid"
              onClick={() => onDeleteMaterial(material)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        </div>
      ))}

      {!loading && materials.length === 0 && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No materials yet — add the raw materials you cost with (name, unit, price).
        </p>
      )}
      {!loading && materials.length > 0 && filtered.length === 0 && (
        <p className={cn("px-2 py-2 text-xs text-muted-foreground/70")}>
          Nothing matches “{search}”.
        </p>
      )}
    </div>
  );
}
