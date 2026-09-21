import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const MAX_NAME_LENGTH = 120;

/**
 * Generate the next sequential code for a prefix, e.g. "RM" → "RM0007".
 * Scans existing entities (owner-scoped) and returns max+1, so existing
 * codes never change; numbering continues after the highest used number.
 */
async function nextCode(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  prefix: "RM" | "FG" | "PR",
): Promise<string> {
  let max = 0;
  const scan = (code: unknown) => {
    if (typeof code !== "string" || !code.startsWith(prefix)) return;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  };
  if (prefix === "RM") {
    const materials = await ctx.db
      .query("rawMaterials")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const m of materials) scan(m.code);
  } else {
    const fgs = await ctx.db
      .query("finishedGoods")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (prefix === "FG") {
      for (const fg of fgs) scan(fg.code);
    } else {
      for (const fg of fgs) scan(fg.projectCode);
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// ── Units of measure (managed master data) ─────────────────────────────

/** All units for the user, A→Z. */
export const listUnits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const units = await ctx.db
      .query("costUnits")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return units.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Create a unit. */
export const addUnit = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the unit a name.");
    if (clean.length > 20) throw new Error("Unit names are 20 characters max.");
    return await ctx.db.insert("costUnits", { ownerId: userId, name: clean });
  },
});

/** Rename a unit. */
export const renameUnit = mutation({
  args: { id: v.id("costUnits"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const unit = await ctx.db.get(id);
    if (unit === null) throw new Error("That unit no longer exists.");
    if (unit.ownerId !== userId) throw new Error("Not your unit.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the unit a name.");
    if (clean.length > 20) throw new Error("Unit names are 20 characters max.");
    await ctx.db.patch(id, { name: clean });
  },
});

/** Delete a unit (materials keep their copied value). */
export const removeUnit = mutation({
  args: { id: v.id("costUnits") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const unit = await ctx.db.get(id);
    if (unit === null) throw new Error("That unit no longer exists.");
    if (unit.ownerId !== userId) throw new Error("Not your unit.");
    await ctx.db.delete(id);
  },
});

// ── Categories & sub-categories (managed master data) ─────────────

/** All categories (and sub-categories) for the user, A→Z. */
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const cats = await ctx.db
      .query("costCategories")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return cats.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Create a category, or a sub-category when parentId is given. */
export const addCategory = mutation({
  args: { name: v.string(), parentId: v.optional(v.id("costCategories")) },
  handler: async (ctx, { name, parentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the category a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    if (parentId !== undefined) {
      const parent = await ctx.db.get(parentId);
      if (parent === null || parent.ownerId !== userId)
        throw new Error("That parent category no longer exists.");
    }
    return await ctx.db.insert("costCategories", {
      ownerId: userId,
      name: clean,
      parentId,
    });
  },
});

/** Rename a category or sub-category. */
export const renameCategory = mutation({
  args: { id: v.id("costCategories"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const cat = await ctx.db.get(id);
    if (cat === null) throw new Error("That category no longer exists.");
    if (cat.ownerId !== userId) throw new Error("Not your category.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the category a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    await ctx.db.patch(id, { name: clean });
  },
});

/** Delete a category or sub-category. Deleting a parent also deletes its sub-categories. */
export const removeCategory = mutation({
  args: { id: v.id("costCategories") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const cat = await ctx.db.get(id);
    if (cat === null) throw new Error("That category no longer exists.");
    if (cat.ownerId !== userId) throw new Error("Not your category.");
    const all = await ctx.db
      .query("costCategories")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    // delete the category and any children (one level of sub-categories)
    for (const c of all) {
      if (c._id === id || c.parentId === id) await ctx.db.delete(c._id);
    }
  },
});

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
  args: {
    code: v.optional(v.string()),
    name: v.string(),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    unit: v.string(),
    pricePerUnit: v.number(),
  },
  handler: async (ctx, { code, name, category, subCategory, unit, pricePerUnit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const clean = name.trim();
    if (clean.length === 0) throw new Error("Give the material a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    const cleanUnit = unit.trim() || "pcs";
    if (pricePerUnit < 0) throw new Error("Price can't be negative.");
    // Auto-code: RM0001, RM0002, … unless the user typed their own code.
    const autoCode = await nextCode(ctx, userId, "RM");
    return await ctx.db.insert("rawMaterials", {
      ownerId: userId,
      code: code?.trim() || autoCode,
      name: clean,
      category: category?.trim() || undefined,
      subCategory: subCategory?.trim() || undefined,
      unit: cleanUnit,
      pricePerUnit,
    });
  },
});

/** Edit a raw material (code, name, category, sub-category, unit, or price). */
export const updateMaterial = mutation({
  args: {
    id: v.id("rawMaterials"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
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
    if (patch.code !== undefined) patch.code = patch.code.trim() || undefined;
    if (patch.category !== undefined)
      patch.category = patch.category.trim() || undefined;
    if (patch.subCategory !== undefined)
      patch.subCategory = patch.subCategory.trim() || undefined;
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

// ── Finished goods (FG products grouped by project) ───────────────────

/** All FG products for the user, newest first. */
export const listFinishedGoods = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const fgs = await ctx.db
      .query("finishedGoods")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return fgs.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Create an FG product under a project name, with optional details. */
export const addFinishedGood = mutation({
  args: {
    projectName: v.string(),
    name: v.string(),
    code: v.optional(v.string()),
    unit: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    note: v.optional(v.string()),
    currency: v.optional(v.string()),
    markupPct: v.optional(v.number()),
  },
  handler: async (ctx, opts) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const cleanProject = opts.projectName.trim();
    const cleanName = opts.name.trim();
    if (cleanProject.length === 0) throw new Error("Give the project a name.");
    if (cleanName.length === 0) throw new Error("Give the product a name.");
    if (cleanName.length > MAX_NAME_LENGTH) throw new Error("That name is too long.");
    // Auto codes: FG0001 for the product; PR0001 shared per project name.
    const fgCode = await nextCode(ctx, userId, "FG");
    let projectCode: string | undefined;
    const siblings = await ctx.db
      .query("finishedGoods")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const existing = siblings.find((s) => s.projectName === cleanProject);
    if (existing?.projectCode) {
      projectCode = existing.projectCode;
    } else {
      projectCode = await nextCode(ctx, userId, "PR");
    }
    return await ctx.db.insert("finishedGoods", {
      ownerId: userId,
      projectName: cleanProject.slice(0, MAX_NAME_LENGTH),
      projectCode,
      name: cleanName.slice(0, MAX_NAME_LENGTH),
      code: opts.code?.trim() || fgCode,
      unit: opts.unit?.trim() || undefined,
      category: opts.category?.trim() || undefined,
      subCategory: opts.subCategory?.trim() || undefined,
      note: opts.note?.trim() || undefined,
      currency: opts.currency?.trim().slice(0, 4) || "$",
      markupPct: opts.markupPct ?? 0,
    });
  },
});

/** Rename an FG product or change its project group. */
export const updateFinishedGood = mutation({
  args: {
    id: v.id("finishedGoods"),
    projectName: v.optional(v.string()),
    projectCode: v.optional(v.string()), // usually auto-assigned on project change
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    unit: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    note: v.optional(v.string()),
    currency: v.optional(v.string()),
    markupPct: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const fg = await ctx.db.get(id);
    if (fg === null) throw new Error("That product no longer exists.");
    if (fg.ownerId !== userId) throw new Error("Not your product.");
    if (patch.projectName !== undefined) {
      const clean = patch.projectName.trim();
      if (clean.length === 0) throw new Error("Give the project a name.");
      patch.projectName = clean.slice(0, MAX_NAME_LENGTH);
      // Moving the product to another project: inherit that project's PR code,
      // or mint a fresh one if this is the first product under the new name.
      const target = patch.projectName;
      if (target !== fg.projectName) {
        const siblings = await ctx.db
          .query("finishedGoods")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect();
        const existing = siblings.find((s) => s.projectName === target && s._id !== id);
        patch.projectCode = existing?.projectCode ?? (await nextCode(ctx, userId, "PR"));
      }
    }
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (clean.length === 0) throw new Error("Give the product a name.");
      patch.name = clean.slice(0, MAX_NAME_LENGTH);
    }
    if (patch.code !== undefined) patch.code = patch.code.trim() || undefined;
    if (patch.unit !== undefined) patch.unit = patch.unit.trim() || undefined;
    if (patch.category !== undefined)
      patch.category = patch.category.trim() || undefined;
    if (patch.subCategory !== undefined)
      patch.subCategory = patch.subCategory.trim() || undefined;
    if (patch.note !== undefined) patch.note = patch.note.trim() || undefined;
    if (patch.markupPct !== undefined && patch.markupPct < 0)
      throw new Error("Markup can't be negative.");
    if (patch.currency !== undefined) patch.currency = patch.currency.trim().slice(0, 4) || "$";
    await ctx.db.patch(id, patch);
  },
});

/** Delete an FG product and all its costing lines. */
export const removeFinishedGood = mutation({
  args: { id: v.id("finishedGoods") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const fg = await ctx.db.get(id);
    if (fg === null) throw new Error("That product no longer exists.");
    if (fg.ownerId !== userId) throw new Error("Not your product.");
    const items = await ctx.db
      .query("costingItems")
      .withIndex("by_fg", (q) => q.eq("fgId", id))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(id);
  },
});

const MAX_IMAGE_BYTES = 900_000; // ~900 KB, matches task attachments

/** Set (or replace) the product photo — stored as a data URL. */
export const setFgImage = mutation({
  args: {
    id: v.id("finishedGoods"),
    data: v.string(), // data URL
    name: v.optional(v.string()), // original file name
    size: v.optional(v.number()),
  },
  handler: async (ctx, { id, data, name, size }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const fg = await ctx.db.get(id);
    if (fg === null) throw new Error("That product no longer exists.");
    if (fg.ownerId !== userId) throw new Error("Not your product.");
    if (size !== undefined && size > MAX_IMAGE_BYTES)
      throw new Error("That image is too large (max ~900 KB).");
    if (!data.startsWith("data:image/")) throw new Error("Only image files are supported.");
    await ctx.db.patch(id, { imageUrl: data, imageAlt: name?.trim() || undefined });
  },
});

/** Remove the product photo. */
export const clearFgImage = mutation({
  args: { id: v.id("finishedGoods") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const fg = await ctx.db.get(id);
    if (fg === null) throw new Error("That product no longer exists.");
    if (fg.ownerId !== userId) throw new Error("Not your product.");
    await ctx.db.patch(id, { imageUrl: undefined, imageAlt: undefined });
  },
});

// ── Sheet lines ─────────────────────────────────────────────────────────

/** Every costing line for the user (for per-product totals across FGs). */
export const listAllItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const items = await ctx.db
      .query("costingItems")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return items.sort((a, b) => a._creationTime - b._creationTime);
  },
});

/** Lines of one FG product, in creation order (rows of the grid). */
export const listFgItems = query({
  args: { fgId: v.id("finishedGoods") },
  handler: async (ctx, { fgId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const fg = await ctx.db.get(fgId);
    if (fg === null || fg.ownerId !== userId) return [];
    const items = await ctx.db
      .query("costingItems")
      .withIndex("by_fg", (q) => q.eq("fgId", fgId))
      .collect();
    return items.sort((a, b) => a._creationTime - b._creationTime);
  },
});

/** Lines of one legacy sheet, in creation order. */
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

/** Legacy: add a line to a sheet (pre-FG flow). Kept while the UI migrates. */
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

/**
 * Add a line to an FG product. For a raw-material row, pass materialId and
 * qty — name/unit/price are copied from the master list (costing only).
 */
export const addFgItem = mutation({
  args: {
    fgId: v.id("finishedGoods"),
    materialId: v.optional(v.id("rawMaterials")),
    label: v.optional(v.string()),
    qty: v.number(),
    unitPrice: v.optional(v.number()),
  },
  handler: async (ctx, { fgId, materialId, label, qty, unitPrice }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const fg = await ctx.db.get(fgId);
    if (fg === null || fg.ownerId !== userId)
      throw new Error("That product no longer exists.");
    if (qty <= 0) throw new Error("Quantity must be greater than zero.");

    if (materialId !== undefined) {
      const material = await ctx.db.get(materialId);
      if (material === null || material.ownerId !== userId)
        throw new Error("That material no longer exists.");
      return await ctx.db.insert("costingItems", {
        ownerId: userId,
        fgId,
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
      fgId,
      label: clean.slice(0, MAX_NAME_LENGTH),
      qty,
      unitPrice: unitPrice ?? 0,
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
