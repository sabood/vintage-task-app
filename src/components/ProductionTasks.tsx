import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useAppDialogs } from "@/components/AppDialogs";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FgDoc = Doc<"finishedGoods">;
type TaskDoc = Doc<"productionTasks">;

const qtyCls =
  "h-7 w-16 rounded-md border bg-card px-1.5 text-xs tabular-nums outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";
const selectCls =
  "h-8 rounded-lg border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";

const STATUS_META: Record<
  string,
  { label: string; chip: string }
> = {
  open: { label: "Open", chip: "bg-muted text-muted-foreground" },
  in_progress: {
    label: "In production",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  finished: {
    label: "Production finished",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** yyyy-mm-dd for a date input, in local time. */
function toDateInput(ms?: number): string {
  if (ms === undefined) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value: string): number | undefined {
  if (!value) return undefined;
  const t = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : undefined;
}

function dueLabel(dueAt: number): { text: string; overdue: boolean } {
  const startOfToday = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  ).getTime();
  const days = Math.ceil((dueAt - startOfToday) / 86_400_000);
  const text =
    days === 0
      ? "Due today"
      : days === 1
        ? "Due tomorrow"
        : days > 1
          ? `Due in ${days}d`
          : `${-days}d overdue`;
  return {
    text: `${text} · ${new Date(dueAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`,
    overdue: dueAt < startOfToday,
  };
}

/** Small numeric field that commits on blur / Enter instead of per keystroke. */
function QtyInput({
  value,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  ariaLabel: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      aria-label={ariaLabel}
      className={qtyCls}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = Number(draft);
        if (!Number.isFinite(next) || next === value) {
          setDraft(String(value));
          return;
        }
        onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** Keeps a not-yet-deployed backend from taking the whole page down. */
class ProductionTasksBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[ProductionTasks] unavailable:", error.message);
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="mt-3 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Production tasks aren’t available right now — the Convex functions for
          them still need to be deployed to this deployment.
        </p>
      );
    }
    return this.props.children;
  }
}

/**
 * Production tasks for one project: each task holds the products it builds
 * (with planned / produced quantities) and can be marked production-finished.
 */
function ProductionTasksList({
  projectName,
  products,
  canCreate,
  canEdit,
  canDelete,
}: {
  projectName: string;
  products: FgDoc[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { confirm, promptMulti } = useAppDialogs();
  const tasks = useQuery(api.production.listProductionTasks, {
    projectName,
  }) as TaskDoc[] | undefined;
  const addTask = useMutation(api.production.addProductionTask);
  const updateTask = useMutation(api.production.updateProductionTask);
  const removeTask = useMutation(api.production.removeProductionTask);
  const addItem = useMutation(api.production.addProductionItem);
  const setItemQty = useMutation(api.production.setProductionItemQty);
  const removeItemM = useMutation(api.production.removeProductionItem);
  const finishProduction = useMutation(api.production.finishProduction);
  const reopenProduction = useMutation(api.production.reopenProduction);

  const [busy, setBusy] = useState<string | null>(null);
  /** per-task “add product” draft: selected product + quantity */
  const [drafts, setDrafts] = useState<Record<string, { fgId: string; qty: string }>>(
    {},
  );

  const productById = new Map<Id<"finishedGoods">, FgDoc>();
  for (const product of products) productById.set(product._id, product);

  const fail = (error: unknown, fallback: string) => {
    toast.error(error instanceof Error ? error.message : fallback);
  };

  const run = async (id: string, label: string, action: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await action();
      toast.success(label);
    } catch (error) {
      fail(error, "That didn’t work — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleNewTask = async () => {
    const values = await promptMulti({
      title: "New production task",
      message: `Under project “${projectName}”.`,
      columns: 2,
      confirmLabel: "Create task",
      fields: [
        { key: "name", label: "What are we making?", placeholder: "Batch 3 — chairs", required: true },
        { key: "dueAt", label: "Finish by", type: "date" },
        { key: "assignee", label: "Assignee", placeholder: "Who is making it" },
        { key: "note", label: "Instructions", full: true },
      ],
    });
    if (values === null) return;
    const name = values.name?.trim() ?? "";
    if (!name) return;
    await run("__new__", "Production task created.", () =>
      addTask({
        projectName,
        name,
        dueAt: fromDateInput(values.dueAt ?? ""),
        assignee: values.assignee || undefined,
        note: values.note || undefined,
      }),
    );
  };

  const handleEditTask = async (task: TaskDoc) => {
    const values = await promptMulti({
      title: "Edit production task",
      columns: 2,
      confirmLabel: "Save changes",
      fields: [
        { key: "name", label: "Task", initial: task.name, required: true },
        { key: "dueAt", label: "Finish by", type: "date", initial: toDateInput(task.dueAt) },
        { key: "assignee", label: "Assignee", initial: task.assignee ?? "" },
        { key: "note", label: "Instructions", initial: task.note ?? "", full: true },
      ],
    });
    if (values === null) return;
    const name = values.name?.trim() ?? "";
    if (!name) return;
    await run(task._id, "Task updated.", () =>
      updateTask({
        id: task._id,
        name,
        dueAt: fromDateInput(values.dueAt ?? ""),
        assignee: values.assignee || undefined,
        note: values.note || undefined,
      }),
    );
  };

  const handleDeleteTask = async (task: TaskDoc) => {
    const ok = await confirm({
      title: "Delete this production task?",
      message: `“${task.name}” and its product list will be removed. The products themselves are kept.`,
      confirmLabel: "Delete task",
      danger: true,
    });
    if (!ok) return;
    await run(task._id, "Production task deleted.", () => removeTask({ id: task._id }));
  };

  const handleFinish = async (task: TaskDoc) => {
    const ok = await confirm({
      title: "Finish production?",
      message: `Every product on “${task.name}” will be marked produced up to its planned quantity.`,
      confirmLabel: "Finish production",
    });
    if (!ok) return;
    await run(task._id, "Production finished.", () => finishProduction({ id: task._id }));
  };

  const handleAddProduct = async (task: TaskDoc) => {
    const draft = drafts[task._id];
    const qty = Number(draft?.qty ?? "1");
    if (!draft?.fgId || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Pick a product and the quantity to make.");
      return;
    }
    await run(task._id, "Product added to the task.", () =>
      addItem({ id: task._id, fgId: draft.fgId as Id<"finishedGoods">, qty }),
    );
    setDrafts((current) => ({ ...current, [task._id]: { fgId: "", qty: "1" } }));
  };

  if (tasks === undefined) {
    return (
      <div className="mt-3 flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading production tasks…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="size-3.5 text-muted-foreground/70" />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Production tasks
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
        <span className="text-[11px] text-muted-foreground/80">
          {tasks.filter((task) => task.status !== "finished").length} still to make
        </span>
        {canCreate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-7 cursor-pointer rounded-lg text-xs"
            disabled={busy === "__new__"}
            onClick={() => void handleNewTask()}
          >
            {busy === "__new__" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            New task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          No production tasks yet — create one to plan which products to make.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tasks.map((task) => {
            const status = STATUS_META[task.status ?? "open"] ?? STATUS_META.open;
            const planned = task.items.reduce((sum, item) => sum + item.qty, 0);
            const produced = task.items.reduce(
              (sum, item) => sum + Math.min(item.doneQty, item.qty),
              0,
            );
            const pct = planned > 0 ? Math.round((produced / planned) * 100) : 0;
            const due = task.dueAt !== undefined ? dueLabel(task.dueAt) : null;
            const draft = drafts[task._id] ?? { fgId: "", qty: "1" };
            const openProducts = products.filter(
              (product) => !task.items.some((item) => item.fgId === product._id),
            );
            const rowBusy = busy === task._id;

            return (
              <li key={task._id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      status.chip,
                    )}
                  >
                    {status.label}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">
                    {task.name}
                  </span>
                  {task.code && (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                      {task.code}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="size-3" />
                      {task.assignee}
                    </span>
                  )}
                  {due && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                        due.overdue ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {due.text}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {rowBusy && (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Edit “${task.name}”`}
                        title="Edit task"
                        className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-primary"
                        onClick={() => void handleEditTask(task)}
                      >
                        <Pencil className="size-3" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Delete “${task.name}”`}
                        title="Delete task"
                        className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDeleteTask(task)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </span>
                </div>

                {task.note && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{task.note}</p>
                )}

                {/* how much of this task is actually built */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 100 ? "bg-emerald-500/80" : "bg-primary/70",
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {produced} / {planned} made
                  </span>
                </div>

                {/* products inside the task */}
                <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-lg border">
                  {task.items.length === 0 && (
                    <li className="px-2 py-2 text-[11px] text-muted-foreground">
                      No products on this task yet — add the products to make.
                    </li>
                  )}
                  {task.items.map((item) => {
                    const product = productById.get(item.fgId);
                    const done = item.qty > 0 && item.doneQty >= item.qty;
                    return (
                      <li
                        key={item.fgId}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5"
                      >
                        <CheckCircle2
                          className={cn(
                            "size-3.5 shrink-0",
                            done ? "text-emerald-500" : "text-muted-foreground/40",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {product?.name ?? "Deleted product"}
                        </span>
                        {product?.code && (
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                            {product.code}
                          </span>
                        )}
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            make
                          </span>
                          <QtyInput
                            value={item.qty}
                            disabled={!canEdit || rowBusy}
                            ariaLabel={`Quantity to make of ${product?.name ?? "product"}`}
                            onCommit={(next) =>
                              void run(item.fgId, "Task updated.", () =>
                                setItemQty({ id: task._id, fgId: item.fgId, qty: next }),
                              )
                            }
                          />
                          <span className="text-[10px] text-muted-foreground">
                            made
                          </span>
                          <QtyInput
                            value={item.doneQty}
                            disabled={!canEdit || rowBusy}
                            ariaLabel={`Quantity produced of ${product?.name ?? "product"}`}
                            onCommit={(next) =>
                              void run(item.fgId, "Task updated.", () =>
                                setItemQty({
                                  id: task._id,
                                  fgId: item.fgId,
                                  doneQty: next,
                                }),
                              )
                            }
                          />
                          {product?.unit && (
                            <span className="text-[10px] text-muted-foreground/70">
                              {product.unit}
                            </span>
                          )}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={`Remove ${product?.name ?? "product"} from the task`}
                            title="Remove from task"
                            className="grid size-5 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-destructive"
                            disabled={rowBusy}
                            onClick={() =>
                              void run(item.fgId, "Product removed from the task.", () =>
                                removeItemM({ id: task._id, fgId: item.fgId }),
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* add a product · finish production */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {canEdit && openProducts.length > 0 && (
                    <>
                      <select
                        aria-label={`Product to add to “${task.name}”`}
                        className={selectCls}
                        value={draft.fgId}
                        disabled={rowBusy}
                        onChange={(e) => {
                          const fgId = e.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [task._id]: { fgId, qty: current[task._id]?.qty ?? "1" },
                          }));
                        }}
                      >
                        <option value="">Add product…</option>
                        {openProducts.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        inputMode="decimal"
                        aria-label="Quantity to make"
                        value={draft.qty}
                        disabled={rowBusy}
                        onChange={(e) => {
                          const qty = e.target.value;
                          setDrafts((current) => ({
                            ...current,
                            [task._id]: { fgId: current[task._id]?.fgId ?? "", qty },
                          }));
                        }}
                        className={cn(qtyCls, "w-20")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 cursor-pointer rounded-lg text-xs"
                        disabled={!draft.fgId || rowBusy}
                        onClick={() => void handleAddProduct(task)}
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </>
                  )}
                  {canEdit && task.items.length > 0 && (
                    <Button
                      type="button"
                      variant={task.status === "finished" ? "outline" : "default"}
                      size="sm"
                      className="ml-auto h-8 cursor-pointer rounded-lg text-xs"
                      disabled={rowBusy}
                      onClick={() =>
                        task.status === "finished"
                          ? void run(task._id, "Task reopened.", () =>
                              reopenProduction({ id: task._id }),
                            )
                          : void handleFinish(task)
                      }
                    >
                      {task.status === "finished" ? (
                        <>
                          <RotateCcw className="size-3" />
                          Reopen
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3" />
                          Finish production
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">
        A task holds the products it makes and their quantities — mark it
        finished when production is done.
      </p>
    </div>
  );
}

/** Production tasks panel for a single project. */
export default function ProductionTasks(props: {
  projectName: string;
  products: FgDoc[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <ProductionTasksBoundary>
      <ProductionTasksList {...props} />
    </ProductionTasksBoundary>
  );
}
