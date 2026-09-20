import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_TASK_LENGTH = 280;

/** All ledger entries for the signed-in student, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return tasks.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Write a new entry into the ledger. */
export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in to write in your ledger.");
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
