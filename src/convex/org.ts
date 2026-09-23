import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * The settings row the given user belongs to — either because they own it
 * (super admin) or because they are listed in `members`.
 */
export async function settingsForUser(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"settings"> | null> {
  const rows = await ctx.db.query("settings").collect();
  const owned = rows.find((s) => s.ownerId === userId);
  if (owned !== undefined) return owned;
  return (
    rows.find((s) => s.members.some((m) => m.userId === userId)) ?? null
  );
}

/**
 * The id every organisation-owned row is scoped by.
 *
 * Members share their super admin's owner id, so tasks, notes, lists,
 * materials, products and projects belong to the *organisation* rather than to
 * one login. Users with no organisation yet fall back to their own id.
 *
 * Every data module resolves its scope through this, so nothing else has to
 * know about organisations.
 */
export async function scopeUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const settings = await settingsForUser(ctx, userId);
  return settings?.ownerId ?? userId;
}

/** Signed-in user + their organisation, for the account-management functions. */
export async function orgContext(ctx: Ctx): Promise<{
  userId: Id<"users">;
  settings: Doc<"settings"> | null;
  orgId: Id<"users">;
  isSuper: boolean;
}> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Sign in first.");
  const settings = await settingsForUser(ctx, userId);
  return {
    userId,
    settings,
    orgId: settings?.ownerId ?? userId,
    isSuper: settings === null || settings.ownerId === userId,
  };
}
