import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_NAME_LENGTH = 120;

// ── Raw materials (master list used only for costing) ───────────────────

/** All raw materials for the signed-in user, A→Z. */
export const listMaterials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const materials = await ctx.db
      .query("rawMaterials")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return materials.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Add a raw material. */
export const addMaterial = mutation({
  args: { name: v.string(), unit: v.string(), pricePerUnit: v.number() },
  handler: async (ctx, { name, unit, pricePerUnit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the material a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    const cleanUnit = unit.trim() || "pcs";
    if (pricePerUnit < 0) throw new Error("Price can't be negative.");
    return await ctx.db.insert("rawMaterials", {
      ownerId: userId,
      name: clean,
      unit: cleanUnit,
      pricePerUnit,
    });
  },
});

/** Edit a raw material (name, unit, or price). */
export const updateMaterial = mutation({
  args: {
    id: v.id("rawMaterials"),
    name: v.optional(v.string()),
    unit: v.optional(v.string()),
    pricePerUnit: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const material = await ctx.db.get(id);
    if (material === null) throw new Error("That material no longer exists.");
    if (material.ownerId !== userId) throw new Error("Not your material.");
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (clean.length === 0) throw new Error("Give the material a name.");
      if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
      patch.name = clean;
    }
    if (patch.unit !== undefined) patch.unit = patch.unit.trim() || "pcs";
    if (patch.pricePerUnit !== undefined && patch.pricePerUnit < 0)
      throw new Error("Price can't be negative.");
    await ctx.db.patch(id, patch);
  },
});

/** Delete a raw material. Existing sheet lines keep their copied values. */
export const removeMaterial = mutation({
  args: { id: v.id("rawMaterials") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const material = await ctx.db.get(id);
    if (material === null) throw new Error("That material no longer exists.");
    if (material.ownerId !== userId) throw new Error("Not your material.");
    await ctx.db.delete(id);
  },
});

// ── Costing sheets ──────────────────────────────────────────────────────

/** All costing sheets for the signed-in user, newest first. */
export const listSheets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const sheets = await ctx.db
      .query("costingSheets")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return sheets.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Create a costing sheet. */
export const addSheet = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the sheet a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    return await ctx.db.insert("costingSheets", {
      ownerId: userId,
      name: clean,
      currency: "$",
      markupPct: 0,
    });
  },
});

/** Rename a costing sheet. */
export const renameSheet = mutation({
  args: { id: v.id("costingSheets"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const sheet = await ctx.db.get(id);
    if (sheet === null) throw new Error("That sheet no longer exists.");
    if (sheet.ownerId !== userId) throw new Error("Not your sheet.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the sheet a name.");
    await ctx.db.patch(id, { name: clean });
  },
});

/** Update sheet settings (currency symbol, markup %). */
export const updateSheet = mutation({
  args: {
    id: v.id("costingSheets"),
    currency: v.optional(v.string()),
    markupPct: v.optional(v.number()),
  },
  handler: async (ctx, { id, currency, markupPct }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const sheet = await ctx.db.get(id);
    if (sheet === null) throw new Error("That sheet no longer exists.");
    if (sheet.ownerId !== userId) throw new Error("Not your sheet.");
    const patch: { currency?: string; markupPct?: number } = {};
    if (currency !== undefined) patch.currency = currency.trim().slice(0, 4) || "$";
    if (markupPct !== undefined) {
      if (markupPct < 0) throw new Error("Markup can't be negative.");
      patch.markupPct = markupPct;
    }
    await ctx.db.patch(id, patch);
  },
});

/** Delete a sheet and all its lines. */
export const removeSheet = mutation({
  args: { id: v.id("costingSheets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const sheet = await ctx.db.get(id);
    if (sheet === null) throw new Error("That sheet no longer exists.");
    if (sheet.ownerId !== userId) throw new Error("Not your sheet.");
    const items = await ctx.db
      .query("costingItems")
      .withIndex("by_sheet", (q) => q.eq("sheetId", id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(id);
  },
});

// ── Sheet lines ─────────────────────────────────────────────────────────

/** Lines of one sheet, in creation order (rows of the grid). */
export const listItems = query({
  args: { sheetId: v.id("costingSheets") },
  handler: async (ctx, { sheetId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const sheet = await ctx.db.get(sheetId);
    if (sheet === null || sheet.ownerId !== userId) return [];
    const items = await ctx.db
      .query("costingItems")
      .withIndex("by_sheet", (q) => q.eq("sheetId", sheetId))
      .collect();
    return items.sort((a, b) => a._creationTime - b._creationTime);
  },
});

/**
 * Add a line. For a raw-material row, pass materialId and qty —
 * the name/unit/price are copied from the master list (costing only).
 */
export const addItem = mutation({
  args: {
    sheetId: v.id("costingSheets"),
    materialId: v.optional(v.id("rawMaterials")),
    label: v.optional(v.string()),
    qty: v.number(),
  },
  handler: async (ctx, { sheetId, materialId, label, qty }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const sheet = await ctx.db.get(sheetId);
    if (sheet === null || sheet.ownerId !== userId)
      throw new Error("That sheet no longer exists.");
    if (qty <= 0) throw new Error("Quantity must be greater than zero.");

    if (materialId !== undefined) {
      const material = await ctx.db.get(materialId);
      if (material === null || material.ownerId !== userId)
        throw new Error("That material no longer exists.");
      return await ctx.db.insert("costingItems", {
        ownerId: userId,
        sheetId,
        materialId,
        label: material.name,
        qty,
        unitPrice: material.pricePerUnit,
        unit: material.unit,
      });
    }

    const clean = label?.trim();
    if (!clean) throw new Error("Give the line a description.");
    return await ctx.db.insert("costingItems", {
      ownerId: userId,
      sheetId,
      label: clean.slice(0, MAX_NAME_LENGTH),
      qty,
      unitPrice: 0,
    });
  },
});

/** Edit a line (qty, unit price, or label). */
export const updateItem = mutation({
  args: {
    id: v.id("costingItems"),
    label: v.optional(v.string()),
    qty: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const item = await ctx.db.get(id);
    if (item === null) throw new Error("That line no longer exists.");
    if (item.ownerId !== userId) throw new Error("Not your line.");
    if (patch.qty !== undefined && patch.qty < 0) throw new Error("Qty can't be negative.");
    if (patch.unitPrice !== undefined && patch.unitPrice < 0)
      throw new Error("Price can't be negative.");
    if (patch.label !== undefined) {
      const clean = patch.label.trim();
      if (clean.length === 0) throw new Error("Give the line a description.");
      patch.label = clean.slice(0, MAX_NAME_LENGTH);
    }
    await ctx.db.patch(id, patch);
  },
});

/** Delete a line. */
export const removeItem = mutation({
  args: { id: v.id("costingItems") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const item = await ctx.db.get(id);
    if (item === null) throw new Error("That line no longer exists.");
    if (item.ownerId !== userId) throw new Error("Not your line.");
    await ctx.db.delete(id);
  },
});
