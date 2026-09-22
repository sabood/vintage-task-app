import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { permissionsValidator } from "./schema";

/**
 * Workspace roles:
 *  - "super"  → the workspace owner. Created automatically the first time
 *               anyone opens Settings. Can do everything.
 *  - "admin"  → can manage members (invite, change roles below super/admin).
 *  - "user"   → normal access; only restricted by explicit permission denials.
 *  - "member" → read-mostly; same, but typically granted fewer sections.
 */
export type WorkspaceRole = "super" | "admin" | "user" | "member";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  super: 3,
  admin: 2,
  user: 1,
  member: 0,
};

/** Users a given role may manage (strictly below itself; super can also manage admins). */
function canManage(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  if (actor === "super") return true;
  if (actor === "admin") return ROLE_RANK[target] < ROLE_RANK.admin;
  return false;
}

/** Get (or lazily create) the settings row. Caller must be signed in. */
async function getOrCreateSettings(
  ctx: { db: any },
  userId: Id<"users">,
): Promise<Doc<"settings">> {
  const all = await ctx.db.query("settings").collect();
  const mine = all.find((s: Doc<"settings">) => s.ownerId === userId);
  if (mine) return mine;
  // The first user to touch settings becomes the super user.
  const id = await ctx.db.insert("settings", {
    ownerId: userId,
    members: [
      {
        userId,
        role: "super",
        permissions: { tasks: true, notes: true, costing: true },
        joinedAt: Date.now(),
      },
    ],
  });
  const created = await ctx.db.get(id);
  return created as unknown as Doc<"settings">;
}

/** Find a user by email (case-insensitive). */
async function findUserByEmail(
  ctx: { db: any },
  email: string,
): Promise<Doc<"users"> | null> {
  const users = await ctx.db.query("users").collect();
  const needle = email.trim().toLowerCase();
  return (
    users.find(
      (u: Doc<"users">) => (u.email ?? "").toLowerCase() === needle,
    ) ?? null
  );
}

/** Resolve the caller's member entry + role (null role if not a member yet). */
async function actorRole(
  ctx: { db: any },
  settingsDoc: Doc<"settings">,
  userId: Id<"users">,
): Promise<WorkspaceRole | null> {
  const me = settingsDoc.members.find((m) => m.userId === userId);
  return (me?.role as WorkspaceRole) ?? null;
}

// ── Queries ─────────────────────────────────────────────────────────────

/** My role + permissions within the workspace (null when signed out). */
export const getMyAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const me = settingsDoc.members.find((m) => m.userId === userId);
    return {
      role: (me?.role ?? "member") as WorkspaceRole,
      permissions: me?.permissions ?? undefined,
      isSuper: settingsDoc.ownerId === userId,
    };
  },
});

/** Full member directory (Settings tab). Allowed for super/admin only. */
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const role = await actorRole(ctx, settingsDoc, userId);
    if (role !== "super" && role !== "admin") {
      throw new Error("Only the super user or an admin can view the member list.");
    }
    const rows = await Promise.all(
      settingsDoc.members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          role: m.role as WorkspaceRole,
          permissions: m.permissions ?? undefined,
          joinedAt: m.joinedAt,
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          isSuper: m.userId === settingsDoc.ownerId,
        };
      }),
    );
    return rows;
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

/** Invite an existing signed-up user (by email) into the workspace. */
export const inviteMember = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("user"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, { email, role }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor || !canManage(actor, role)) {
      throw new Error("You can't assign that role.");
    }
    const user = await findUserByEmail(ctx, email);
    if (user === null) {
      throw new Error(
        "No user with that email has signed in yet — they must open the app once before you can add them.",
      );
    }
    if (settingsDoc.members.some((m) => m.userId === user._id)) {
      throw new Error("That user is already a member of the workspace.");
    }
    await ctx.db.patch(settingsDoc._id, {
      members: [
        ...settingsDoc.members,
        {
          userId: user._id,
          role,
          permissions: { tasks: true, notes: true, costing: true },
          invitedBy: userId,
          joinedAt: Date.now(),
        },
      ],
    });
  },
});

/** Change a member's role. */
export const setMemberRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("user"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, { userId: targetId, role }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor) throw new Error("You are not a member of this workspace.");
    if (targetId === settingsDoc.ownerId) {
      throw new Error("The super user's role can't be changed.");
    }
    const target = settingsDoc.members.find((m) => m.userId === targetId);
    if (!target) throw new Error("That user is not a member.");
    if (!canManage(actor, target.role as WorkspaceRole)) {
      throw new Error("You can't manage that member.");
    }
    if (!canManage(actor, role)) {
      throw new Error("You can't assign that role.");
    }
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.map((m) =>
        m.userId === targetId ? { ...m, role } : m,
      ),
    });
  },
});

/** Toggle a member's access to a section (restriction management). */
export const setMemberPermission = mutation({
  args: {
    userId: v.id("users"),
    section: v.union(
      v.literal("tasks"),
      v.literal("notes"),
      v.literal("costing"),
    ),
    allowed: v.boolean(),
  },
  handler: async (ctx, { userId: targetId, section, allowed }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor || (actor !== "super" && actor !== "admin")) {
      throw new Error("Only the super user or an admin can change restrictions.");
    }
    if (targetId === settingsDoc.ownerId) {
      throw new Error("The super user always has full access.");
    }
    const target = settingsDoc.members.find((m) => m.userId === targetId);
    if (!target) throw new Error("That user is not a member.");
    const nextPermissions = {
      ...(target.permissions ?? {}),
      [section]: allowed,
    };
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.map((m) =>
        m.userId === targetId ? { ...m, permissions: nextPermissions } : m,
      ),
    });
  },
});

/** Remove a member from the workspace. */
export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor) throw new Error("You are not a member of this workspace.");
    if (targetId === settingsDoc.ownerId) {
      throw new Error("The super user can't be removed.");
    }
    const target = settingsDoc.members.find((m) => m.userId === targetId);
    if (!target) throw new Error("That user is not a member.");
    if (targetId !== userId && !canManage(actor, target.role as WorkspaceRole)) {
      throw new Error("You can't manage that member.");
    }
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.filter((m) => m.userId !== targetId),
    });
  },
});

/** Rename the workspace. */
export const setWorkspaceName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") {
      throw new Error("Only the super user or an admin can rename the workspace.");
    }
    const clean = name.trim().slice(0, 60);
    await ctx.db.patch(settingsDoc._id, {
      workspaceName: clean || undefined,
    });
  },
});
