import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 5000;

/** All notes for the signed-in user, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return notes.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Create a new note. */
export const add = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, { title, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in to create a note.");
    }
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length === 0) {
      throw new Error("Give the note a title.");
    }
    if (cleanTitle.length > MAX_TITLE_LENGTH) {
      throw new Error("That title is too long.");
    }
    if (cleanBody.length > MAX_BODY_LENGTH) {
      throw new Error("That note is too long.");
    }
    return await ctx.db.insert("notes", {
      ownerId: userId,
      title: cleanTitle,
      body: cleanBody,
    });
  },
});

/** Update an existing note. */
export const update = mutation({
  args: { id: v.id("notes"), title: v.string(), body: v.string() },
  handler: async (ctx, { id, title, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in first.");
    }
    const note = await ctx.db.get(id);
    if (note === null) {
      throw new Error("That note no longer exists.");
    }
    if (note.ownerId !== userId) {
      throw new Error("That note belongs to another account.");
    }
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (cleanTitle.length === 0) {
      throw new Error("Give the note a title.");
    }
    if (cleanTitle.length > MAX_TITLE_LENGTH) {
      throw new Error("That title is too long.");
    }
    if (cleanBody.length > MAX_BODY_LENGTH) {
      throw new Error("That note is too long.");
    }
    await ctx.db.patch(id, { title: cleanTitle, body: cleanBody });
  },
});

/** Delete a note. */
export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in first.");
    }
    const note = await ctx.db.get(id);
    if (note === null) {
      throw new Error("That note no longer exists.");
    }
    if (note.ownerId !== userId) {
      throw new Error("That note belongs to another account.");
    }
    await ctx.db.delete(id);
  },
});
