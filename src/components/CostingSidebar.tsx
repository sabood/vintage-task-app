import type { Doc } from "@/convex/_generated/dataModel";
import {
  ChevronDown,
  Folder,
  Loader2,
  Package,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;
type MaterialDoc = Doc<"rawMaterials">;

/** What's open in the main area: raw-materials, products, projects, or one FG product. */
export type CostingView =
  | { kind: "materials" }
  | { kind: "products" }
  | { kind: "projects" }
  | { kind: "fg"; fgId: FgDoc["_id"] }
  | null;

/** Sidebar: projects → FG products, plus the raw-materials sheet entry. */
export default function CostingSidebar({
  finishedGoods,
  materials,
  loading,
  view,
  onSelectView,
  onNewFg,
  onRenameFg,
  onDeleteFg,
  onMaterialsClick,
}: {
  finishedGoods: FgDoc[];
  materials: MaterialDoc[];
  loading: boolean;
  view: CostingView;
  onSelectView: (view: CostingView) => void;
  onNewFg: (projectName: string) => void;
  onRenameFg: (fg: FgDoc) => void;
  onDeleteFg: (fg: FgDoc) => void;
  onMaterialsClick: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /** Group FGs by their project name (insertion order preserved). */
  const projects = useMemo(() => {
    const map = new Map<string, FgDoc[]>();
    for (const fg of finishedGoods) {
      const list = map.get(fg.projectName) ?? [];
      list.push(fg);
      map.set(fg.projectName, list);
    }
    return Array.from(map.entries());
  }, [finishedGoods]);

  const materialsActive = view?.kind === "materials";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Costing
        </span>
      </div>

      {/* raw materials sheet */}
      <div
        className={cn(
          "group/mat flex items-center gap-1 rounded-lg pr-1 transition-colors",
          materialsActive ? "bg-primary/10" : "hover:bg-accent",
        )}
      >
        <button
          type="button"
          onClick={onMaterialsClick}
          aria-current={materialsActive ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 pr-1 text-left"
        >
          <ScrollText
            className={cn(
              "size-4 shrink-0",
              materialsActive ? "text-primary" : "text-muted-foreground/70",
            )}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm",
                materialsActive ? "font-medium text-primary" : "text-foreground/85",
              )}
            >
              Raw materials
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {materials.length} item{materials.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      </div>

      {/* projects → FG products */}
      <div className="mt-3 flex items-center justify-between px-2 pb-1">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Projects
        </span>
        <button
          type="button"
          aria-label="New product"
          title="New product"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => onNewFg("")}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      )}

      {projects.map(([projectName, fgs]) => {
        const isCollapsed = collapsed[projectName] ?? false;
        return (
          <div key={projectName} className="mb-0.5">
            <button
              type="button"
              className="group/pj flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [projectName]: !isCollapsed }))
              }
            >
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground/60 transition-transform",
                  isCollapsed && "-rotate-90",
                )}
              />
              <Folder className="size-3.5 shrink-0 text-sky-500/80" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {projectName}
              </span>
              {fgs[0]?.projectCode && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                  {fgs[0].projectCode}
                </span>
              )}
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {fgs.length}
              </span>
            </button>
            {!isCollapsed && (
              <div className="ml-3 border-l border-border/60 pl-1">
                {fgs.map((fg) => {
                  const active = view?.kind === "fg" && view.fgId === fg._id;
                  return (
                    <div
                      key={fg._id}
                      className={cn(
                        "group/fg flex items-center gap-1 rounded-lg pr-1 transition-colors",
                        active ? "bg-primary/10" : "hover:bg-accent",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectView({ kind: "fg", fgId: fg._id })}
                        aria-current={active ? "true" : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 pr-1 text-left"
                      >
                        <Package
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground/70",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            active ? "font-medium text-primary" : "text-foreground/85",
                          )}
                        >
                          {fg.name}
                        </span>
                        {fg.code && (
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                            {fg.code}
                          </span>
                        )}
                      </button>
                      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within/fg:opacity-100 group-hover/fg:opacity-100">
                        <button
                          type="button"
                          aria-label={`Rename “${fg.name}”`}
                          title="Rename product"
                          className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground group-hover/fg:grid"
                          onClick={() => onRenameFg(fg)}
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete “${fg.name}”`}
                          title="Delete product"
                          className="hidden size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive group-hover/fg:grid"
                          onClick={() => onDeleteFg(fg)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!loading && finishedGoods.length === 0 && (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No products yet — add an FG product to start costing it.
        </p>
      )}
    </div>
  );
}
