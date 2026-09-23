import { mutation, query } from "./_generated/server";
import { scopeUserId } from "./org";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const MAX_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 2000;
const MAX_QTY = 1_000_000;

/** Round and clamp a quantity so bad input can never reach the database. */
function cleanQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value * 100) / 100, MAX_QTY);
}

/** Next "PT" code for the owner (highest existing + 1). */
async function nextTaskCode(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<string> {
  const tasks = await ctx.db
    .query("productionTasks")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  let max = 0;
  for (const task of tasks) {
    const code = task.code;
    if (typeof code !== "string" || !code.startsWith("PT")) continue;
    const n = Number.parseInt(code.slice(2), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `PT${String(max + 1).padStart(4, "0")}`;
}

/** Load a production task and make sure the signed-in user owns it. */
async function ownTask(ctx: MutationCtx, id: Id<"productionTasks">) {
  const userId = await scopeUserId(ctx);
  if (userId === null) throw new Error("Sign in first.");
  const task = await ctx.db.get(id);
  if (task === null || task.ownerId !== userId)
    throw new Error("That production task no longer exists.");
  return task;
}

// ── Production tasks ────────────────────────────────────────────────────

/** Production tasks for the user, newest first — optionally just one project. */
export const listProductionTasks = query({
  args: { projectName: v.optional(v.string()) },
  handler: async (ctx, { projectName }) => {
    const userId = await scopeUserId(ctx);
    if (userId === null) return [];
    const tasks = await ctx.db
      .query("productionTasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const scoped =
      projectName === undefined
        ? tasks
        : tasks.filter((task) => task.projectName === projectName);
    return scoped.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Create a production task under a project, optionally with products. */
export const addProductionTask = mutation({
  args: {
    projectName: v.string(),
    name: v.string(),
    note: v.optional(v.string()),
    assignee: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    items: v.optional(
      v.array(v.object({ fgId: v.id("finishedGoods"), qty: v.number() })),
    ),
  },
  handler: async (ctx, opts) => {
    const userId = await scopeUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const projectName = opts.projectName.trim();
    if (projectName.length === 0) throw new Error("Pick a project for the task.");
    const name = opts.name.trim();
    if (name.length === 0) throw new Error("Give the task a name.");

    const items: { fgId: Id<"finishedGoods">; qty: number; doneQty: number }[] =
      [];
    for (const item of opts.items ?? []) {
      const fg = await ctx.db.get(item.fgId);
      if (fg === null || fg.ownerId !== userId) continue;
      if (fg.projectName !== projectName) continue;
      if (items.some((existing) => existing.fgId === item.fgId)) continue;
      items.push({ fgId: item.fgId, qty: cleanQty(item.qty), doneQty: 0 });
    }

    return await ctx.db.insert("productionTasks", {
      ownerId: userId,
      projectName: projectName.slice(0, MAX_NAME_LENGTH),
      name: name.slice(0, MAX_NAME_LENGTH),
      code: await nextTaskCode(ctx, userId),
      note: opts.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined,
      assignee: opts.assignee?.trim().slice(0, MAX_NAME_LENGTH) || undefined,
      dueAt: opts.dueAt,
      status: "open",
      items,
    });
  },
});

/** Update a production task's details. Use finish/reopen to change status. */
export const updateProductionTask = mutation({
  args: {
    id: v.id("productionTasks"),
    name: v.optional(v.string()),
    note: v.optional(v.string()),
    assignee: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ownTask(ctx, id);
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length === 0) throw new Error("Give the task a name.");
      clean.name = name.slice(0, MAX_NAME_LENGTH);
    }
    if (patch.note !== undefined)
      clean.note = patch.note.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
    if (patch.assignee !== undefined)
      clean.assignee = patch.assignee.trim().slice(0, MAX_NAME_LENGTH) || undefined;
    if (patch.dueAt !== undefined) clean.dueAt = patch.dueAt;
    await ctx.db.patch(id, clean);
  },
});

/** Delete a production task. Products and projects are untouched. */
export const removeProductionTask = mutation({
  args: { id: v.id("productionTasks") },
  handler: async (ctx, { id }) => {
    await ownTask(ctx, id);
    await ctx.db.delete(id);
  },
});

// ── Products inside a task ──────────────────────────────────────────────

/** Put a product into a task with the quantity to make. */
export const addProductionItem = mutation({
  args: {
    id: v.id("productionTasks"),
    fgId: v.id("finishedGoods"),
    qty: v.number(),
  },
  handler: async (ctx, { id, fgId, qty }) => {
    const task = await ownTask(ctx, id);
    const fg = await ctx.db.get(fgId);
    if (fg === null || fg.ownerId !== task.ownerId)
      throw new Error("That product no longer exists.");
    if (fg.projectName !== task.projectName)
      throw new Error("That product belongs to another project.");
    const amount = cleanQty(qty);
    if (amount <= 0) throw new Error("Give the quantity to make.");
    const existing = task.items.find((item) => item.fgId === fgId);
    const items = existing
      ? task.items.map((item) =>
          item.fgId === fgId ? { ...item, qty: cleanQty(item.qty + amount) } : item,
        )
      : [...task.items, { fgId, qty: amount, doneQty: 0 }];
    await ctx.db.patch(id, {
      items,
      status: task.status === "finished" ? "in_progress" : task.status,
    });
  },
});

/** Change a task line's planned and/or produced quantity. */
export const setProductionItemQty = mutation({
  args: {
    id: v.id("productionTasks"),
    fgId: v.id("finishedGoods"),
    qty: v.optional(v.number()),
    doneQty: v.optional(v.number()),
  },
  handler: async (ctx, { id, fgId, qty, doneQty }) => {
    const task = await ownTask(ctx, id);
    if (!task.items.some((item) => item.fgId === fgId))
      throw new Error("That product is not on this task.");
    const items = task.items.map((item) =>
      item.fgId === fgId
        ? {
            ...item,
            qty: qty === undefined ? item.qty : cleanQty(qty),
            doneQty: doneQty === undefined ? item.doneQty : cleanQty(doneQty),
          }
        : item,
    );
    const produced = items.some((item) => item.doneQty > 0);
    await ctx.db.patch(id, {
      items,
      status:
        task.status === "open" && produced
          ? "in_progress"
          : task.status === "finished" && !produced
            ? "in_progress"
            : task.status,
    });
  },
});

/** Take a product off a task. */
export const removeProductionItem = mutation({
  args: { id: v.id("productionTasks"), fgId: v.id("finishedGoods") },
  handler: async (ctx, { id, fgId }) => {
    const task = await ownTask(ctx, id);
    await ctx.db.patch(id, {
      items: task.items.filter((item) => item.fgId !== fgId),
    });
  },
});

// ── Finishing production ────────────────────────────────────────────────

/** Production done: every product is built up to its planned quantity. */
export const finishProduction = mutation({
  args: { id: v.id("productionTasks") },
  handler: async (ctx, { id }) => {
    const task = await ownTask(ctx, id);
    if (task.items.length === 0)
      throw new Error("Add at least one product before finishing production.");
    await ctx.db.patch(id, {
      items: task.items.map((item) => ({
        ...item,
        doneQty: Math.max(item.doneQty, item.qty),
      })),
      status: "finished",
      finishedAt: Date.now(),
    });
  },
});

/** Put a finished task back into production. */
export const reopenProduction = mutation({
  args: { id: v.id("productionTasks") },
  handler: async (ctx, { id }) => {
    await ownTask(ctx, id);
    await ctx.db.patch(id, { status: "in_progress", finishedAt: undefined });
  },
});
