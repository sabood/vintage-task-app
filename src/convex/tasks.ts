import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_TASK_LENGTH = 280;

/** Task lists for the signed-in user, oldest first (stable order). */
export const listLists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const lists = await ctx.db
      .query("taskLists")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return lists.sort((a, b) => a._creationTime - b._creationTime);
  },
});

/** Create a named task list. */
export const addList = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the list a name.");
    if (clean.length > 80) throw new Error("That list name is too long.");
    return await ctx.db.insert("taskLists", { ownerId: userId, name: clean });
  },
});

/** Rename a task list. */
export const renameList = mutation({
  args: { id: v.id("taskLists"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const list = await ctx.db.get(id);
    if (list === null) throw new Error("That list no longer exists.");
    if (list.ownerId !== userId) throw new Error("That list belongs to another account.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the list a name.");
    await ctx.db.patch(id, { name: clean });
  },
});

/** Delete a task list; its tasks fall back to the default list. */
export const removeList = mutation({
  args: { id: v.id("taskLists") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const list = await ctx.db.get(id);
    if (list === null) throw new Error("That list no longer exists.");
    if (list.ownerId !== userId) throw new Error("That list belongs to another account.");
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const t of tasks) {
      if (t.listId === id) {
        await ctx.db.patch(t._id, { listId: undefined });
      }
    }
    await ctx.db.delete(id);
  },
});

/** Tasks, optionally filtered to one list (undefined listId = default list). */
export const list = query({
  args: { listId: v.optional(v.id("taskLists")) },
  handler: async (ctx, { listId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const filtered = listId
      ? tasks.filter((t) => t.listId === listId)
      : tasks.filter((t) => !t.listId);
    return filtered.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Write a new entry into the ledger. */
export const add = mutation({
  args: {
    text: v.string(),
    listId: v.optional(v.id("taskLists")),
    sourcePageId: v.optional(v.id("notePages")),
  },
  handler: async (ctx, { text, listId, sourcePageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in to write in your ledger.");
    }
    if (listId !== undefined) {
      const list = await ctx.db.get(listId);
      if (list === null || list.ownerId !== userId) {
        throw new Error("That list no longer exists.");
      }
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("A task needs at least a few words.");
    }
    if (trimmed.length > MAX_TASK_LENGTH) {
      throw new Error("That entry is too long for one line of the ledger.");
    }
    return await ctx.db.insert("tasks", {
      ownerId: userId,
      text: trimmed,
      isCompleted: false,
      listId,
      sourcePageId,
    });
  },
});

/** Check off — or un-check — a ledger entry. */
export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in first.");
    }
    const task = await ctx.db.get(id);
    if (task === null) {
      throw new Error("That entry is no longer in the ledger.");
    }
    if (task.ownerId !== userId) {
      throw new Error("That entry belongs to another ledger.");
    }
    await ctx.db.patch(id, { isCompleted: !task.isCompleted });
  },
});
