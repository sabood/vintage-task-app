import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// page formatting: body font family
export const noteFontValidator = v.union(
  v.literal("sans"),
  v.literal("serif"),
  v.literal("mono"),
  v.literal("hand"),
);

// page formatting: notebook color label
export const noteColorValidator = v.union(
  v.literal("default"),
  v.literal("indigo"),
  v.literal("emerald"),
  v.literal("amber"),
  v.literal("rose"),
  v.literal("sky"),
);

// page formatting: ink (text) color
export const noteInkValidator = v.union(
  v.literal("default"),
  v.literal("indigo"),
  v.literal("emerald"),
  v.literal("amber"),
  v.literal("rose"),
  v.literal("sky"),
);

const MAX_TITLE_LENGTH = 120;
const MAX_PAGE_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 20000;

/** All notebooks for the signed-in user, newest first. */
export const listNotebooks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const notebooks = await ctx.db
      .query("notebooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return notebooks.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Create a notebook. */
export const addNotebook = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to create a notebook.");
    const cleanTitle = title.trim();
    if (cleanTitle.length === 0) throw new Error("Give the notebook a title.");
    if (cleanTitle.length > MAX_TITLE_LENGTH)
      throw new Error("That title is too long.");
    return await ctx.db.insert("notebooks", { ownerId: userId, title: cleanTitle });
  },
});

/** Rename a notebook. */
export const renameNotebook = mutation({
  args: { id: v.id("notebooks"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const nb = await ctx.db.get(id);
    if (nb === null) throw new Error("That notebook no longer exists.");
    if (nb.ownerId !== userId) throw new Error("That notebook belongs to another account.");
    const cleanTitle = title.trim();
    if (cleanTitle.length === 0) throw new Error("Give the notebook a title.");
    if (cleanTitle.length > MAX_TITLE_LENGTH) throw new Error("That title is too long.");
    await ctx.db.patch(id, { title: cleanTitle });
  },
});

/** Delete a notebook and all pages inside it. */
export const removeNotebook = mutation({
  args: { id: v.id("notebooks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const nb = await ctx.db.get(id);
    if (nb === null) throw new Error("That notebook no longer exists.");
    if (nb.ownerId !== userId) throw new Error("That notebook belongs to another account.");
    const pages = await ctx.db
      .query("notePages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", id))
      .collect();
    for (const page of pages) await ctx.db.delete(page._id);
    await ctx.db.delete(id);
  },
});

/** Pages of a notebook, ordered by the user's chosen order (fallback: creation). */
export const listPages = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, { notebookId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const nb = await ctx.db.get(notebookId);
    if (nb === null || nb.ownerId !== userId) return [];
    const pages = await ctx.db
      .query("notePages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    return pages.sort(
      (a, b) =>
        (a.order ?? a._creationTime) - (b.order ?? b._creationTime),
    );
  },
});

/** Create a page at the end of a notebook. Returns the new page id. */
export const addPage = mutation({
  args: { notebookId: v.id("notebooks"), title: v.optional(v.string()) },
  handler: async (ctx, { notebookId, title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to create a page.");
    const nb = await ctx.db.get(notebookId);
    if (nb === null) throw new Error("That notebook no longer exists.");
    if (nb.ownerId !== userId) throw new Error("That notebook belongs to another account.");
    const existing = await ctx.db
      .query("notePages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebookId))
      .collect();
    const maxOrder = existing.reduce((m, p) => Math.max(m, p.order ?? 0), 0);
    return await ctx.db.insert("notePages", {
      ownerId: userId,
      notebookId,
      title: title?.trim() || "Untitled page",
      body: "",
      numbered: false,
      font: "sans",
      color: "default",
      inkColor: "default",
      order: maxOrder + 1,
    });
  },
});

/** Update a page: title, body, or formatting. All fields optional. */
export const updatePage = mutation({
  args: {
    id: v.id("notePages"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    numbered: v.optional(v.boolean()),
    font: v.optional(noteFontValidator),
    color: v.optional(noteColorValidator),
    inkColor: v.optional(noteInkValidator),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const page = await ctx.db.get(id);
    if (page === null) throw new Error("That page no longer exists.");
    if (page.ownerId !== userId) throw new Error("That page belongs to another account.");
    if (patch.title !== undefined) {
      const cleanTitle = patch.title.trim();
      if (cleanTitle.length === 0) throw new Error("Page title can't be empty.");
      if (cleanTitle.length > MAX_PAGE_TITLE_LENGTH)
        throw new Error("That page title is too long.");
      patch.title = cleanTitle;
    }
    if (patch.body !== undefined && patch.body.length > MAX_BODY_LENGTH)
      throw new Error("That page is too long.");
    await ctx.db.patch(id, patch);
  },
});

/** Delete a page. */
export const removePage = mutation({
  args: { id: v.id("notePages") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const page = await ctx.db.get(id);
    if (page === null) throw new Error("That page no longer exists.");
    if (page.ownerId !== userId) throw new Error("That page belongs to another account.");
    await ctx.db.delete(id);
  },
});
