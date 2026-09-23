import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { permissionsValidator } from "./schema";
import type { ActionKey, GranularPerms, SectionKey } from "../lib/permissions";
import { ACTIONS, SECTIONS } from "../lib/permissions";

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

/**
 * Read the caller's settings row (queries only read; if none exists yet the
 * caller simply isn't a member of an initialized workspace).
 */
async function getSettings(
  ctx: { db: any },
  userId: Id<"users">,
): Promise<Doc<"settings"> | null> {
  const all = await ctx.db.query("settings").collect();
  return all.find((s: Doc<"settings">) => s.ownerId === userId) ?? null;
}

/**
 * Get (or lazily create) the settings row — MUTATIONS ONLY. The first user
 * to run this becomes the workspace's super user.
 */
async function getOrCreateSettings(
  ctx: { db: any },
  userId: Id<"users">,
): Promise<Doc<"settings">> {
  const existing = await getSettings(ctx, userId);
  if (existing) return existing;
  const id = await ctx.db.insert("settings", {
    ownerId: userId,
    members: [
      {
        userId,
        role: "super",
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

/** Merge custom-role perms with per-user overrides on every section/action. */
function mergePerms(
  base: GranularPerms | undefined,
  override: GranularPerms | undefined,
): GranularPerms | undefined {
  if (base === undefined && override === undefined) return undefined;
  const out: GranularPerms = {};
  for (const s of SECTIONS) {
    const merged: Record<string, boolean> = {};
    for (const a of ACTIONS) {
      const v = override?.[s]?.[a as ActionKey] ?? base?.[s]?.[a as ActionKey];
      if (v !== undefined) merged[a] = v;
    }
    if (Object.keys(merged).length > 0) {
      out[s] = merged as GranularPerms[SectionKey];
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Queries ─────────────────────────────────────────────────────────────

/**
 * Claim any pending invite for the caller's email and register them as a
 * member. Called once per sign-in from the client; silently no-ops when
 * there's no invite.
 */
export const claimPendingInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const user = await ctx.db.get(userId);
    if (user === null || !user.email) return;
    const email = user.email.trim().toLowerCase();

    // Find a pending invite addressed to this email.
    const invites = await ctx.db.query("pendingInvites").collect();
    const invite = invites.find((i) => i.email === email);
    if (invite === undefined) return;

    const settingsDoc = await getSettings(ctx, invite.ownerId);
    if (settingsDoc === null) {
      await ctx.db.delete(invite._id);
      return;
    }
    // Already a member? Just drop the stale invite.
    if (settingsDoc.members.some((m) => m.userId === userId)) {
      await ctx.db.delete(invite._id);
      return;
    }
    await ctx.db.patch(settingsDoc._id, {
      members: [
        ...settingsDoc.members,
        {
          userId,
          role: invite.role,
          customRoleId: invite.customRoleId,
          invitedBy: invite.ownerId,
          joinedAt: Date.now(),
        },
      ],
    });
    await ctx.db.delete(invite._id);
  },
});

/** My role + permissions within the workspace (null when signed out). */
export const getMyAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) {
      // Workspace not initialized yet — the mutation below will bootstrap it.
      return { role: "member" as WorkspaceRole, permissions: undefined, isSuper: false };
    }
    const me = settingsDoc.members.find((m) => m.userId === userId);
    // Custom role: merge its permissions with any direct overrides.
    let permissions = me?.permissions ?? undefined;
    if (me?.customRoleId !== undefined) {
      const customRole = await ctx.db.get(me.customRoleId);
      if (customRole !== null) {
        permissions = mergePerms(customRole.permissions as GranularPerms | undefined, permissions);
      }
    }
    return {
      role: (me?.role ?? "member") as WorkspaceRole,
      permissions,
      isSuper: settingsDoc.ownerId === userId,
    };
  },
});

/**
 * Initialize the caller's workspace if it doesn't exist yet. Idempotent —
 * safe to call on app load. The first caller becomes the super user.
 */
export const ensureWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    await getOrCreateSettings(ctx, userId);
  },
});

/** Full member directory (Settings tab). Allowed for super/admin only. */
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) return [];
    const role = await actorRole(ctx, settingsDoc, userId);
    if (role !== "super" && role !== "admin") {
      throw new Error("Only the super user or an admin can view the member list.");
    }
    const rows = await Promise.all(
      settingsDoc.members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        // Effective permissions = custom role + per-user overrides.
        let effective = m.permissions as GranularPerms | undefined;
        if (m.customRoleId !== undefined) {
          const customRole = await ctx.db.get(m.customRoleId);
          if (customRole !== null) {
            effective = mergePerms(
              customRole.permissions as GranularPerms | undefined,
              effective,
            );
          }
        }
        return {
          userId: m.userId,
          role: m.role as WorkspaceRole,
          customRoleId: m.customRoleId,
          permissions: effective,
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

/**
 * Invite a user by email into the workspace.
 * - If they already signed in, they're added immediately.
 * - Otherwise a pending invite is stored; they join automatically the first
 *   time they sign in (claimPendingInvite).
 */
export const inviteMember = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("user"),
      v.literal("member"),
    ),
    customRoleId: v.optional(v.id("customRoles")),
  },
  handler: async (ctx, { email, role, customRoleId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor || !canManage(actor, role)) {
      throw new Error("You can't assign that role.");
    }
    if (customRoleId !== undefined) {
      const custom = await ctx.db.get(customRoleId);
      if (custom === null || custom.ownerId !== settingsDoc.ownerId) {
        throw new Error("That custom role no longer exists.");
      }
    }
    const cleanEmail = email.trim().toLowerCase();

    const user = await findUserByEmail(ctx, cleanEmail);
    if (user === null) {
      // Not signed in yet → store a pending invite.
      const invites = await ctx.db.query("pendingInvites").collect();
      const dup = invites.find(
        (i) => i.ownerId === settingsDoc.ownerId && i.email === cleanEmail,
      );
      if (dup !== undefined) {
        await ctx.db.patch(dup._id, { role, customRoleId });
      } else {
        await ctx.db.insert("pendingInvites", {
          ownerId: settingsDoc.ownerId,
          email: cleanEmail,
          role,
          customRoleId,
          createdAt: Date.now(),
        });
      }
      return { pending: true as const };
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
          customRoleId,
          invitedBy: userId,
          joinedAt: Date.now(),
        },
      ],
    });
    return { pending: false as const };
  },
});

// ── Pending invites ─────────────────────────────────────────────────────

/** Pending invites for the caller's workspace (Settings → Invites). */
export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) return [];
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") return [];
    const invites = await ctx.db.query("pendingInvites").collect();
    return invites
      .filter((i) => i.ownerId === settingsDoc.ownerId)
      .map((i) => ({
        _id: i._id,
        email: i.email,
        role: i.role,
        customRoleId: i.customRoleId,
        createdAt: i.createdAt,
      }));
  },
});

/** Cancel a pending invite. */
export const cancelPendingInvite = mutation({
  args: { id: v.id("pendingInvites") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) throw new Error("No workspace.");
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") {
      throw new Error("Only the super user or an admin can cancel invites.");
    }
    const invite = await ctx.db.get(id);
    if (invite === null) return;
    if (invite.ownerId !== settingsDoc.ownerId) {
      throw new Error("That invite belongs to another workspace.");
    }
    await ctx.db.delete(id);
  },
});

// ── Custom roles ────────────────────────────────────────────────────────

/** Manually created roles for the caller's workspace. */
export const listCustomRoles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) return [];
    const roles = await ctx.db.query("customRoles").collect();
    return roles
      .filter((r) => r.ownerId === settingsDoc.ownerId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Create a manually defined role. */
export const createCustomRole = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    permissions: permissionsValidator,
  },
  handler: async (ctx, { name, description, permissions }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getOrCreateSettings(ctx, userId);
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") {
      throw new Error("Only the super user or an admin can create roles.");
    }
    const clean = name.trim().slice(0, 40);
    if (clean.length === 0) throw new Error("Give the role a name.");
    const existing = await ctx.db.query("customRoles").collect();
    if (
      existing.some(
        (r) =>
          r.ownerId === settingsDoc.ownerId &&
          r.name.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      throw new Error("A role with that name already exists.");
    }
    return await ctx.db.insert("customRoles", {
      ownerId: settingsDoc.ownerId,
      name: clean,
      description: description?.trim().slice(0, 120) || undefined,
      permissions,
      createdAt: Date.now(),
    });
  },
});

/** Edit a manually defined role; members using it get the new access. */
export const updateCustomRole = mutation({
  args: {
    id: v.id("customRoles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(permissionsValidator),
  },
  handler: async (ctx, { id, name, description, permissions }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) throw new Error("No workspace.");
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") {
      throw new Error("Only the super user or an admin can edit roles.");
    }
    const role = await ctx.db.get(id);
    if (role === null || role.ownerId !== settingsDoc.ownerId) {
      throw new Error("That role no longer exists.");
    }
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      const clean = name.trim().slice(0, 40);
      if (clean.length === 0) throw new Error("Give the role a name.");
      patch.name = clean;
    }
    if (description !== undefined) {
      patch.description = description.trim().slice(0, 120) || undefined;
    }
    if (permissions !== undefined) patch.permissions = permissions;
    await ctx.db.patch(id, patch);
  },
});

/** Delete a manually defined role; members fall back to their base role. */
export const deleteCustomRole = mutation({
  args: { id: v.id("customRoles") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) throw new Error("No workspace.");
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (actor !== "super" && actor !== "admin") {
      throw new Error("Only the super user or an admin can delete roles.");
    }
    const role = await ctx.db.get(id);
    if (role === null) return;
    if (role.ownerId !== settingsDoc.ownerId) {
      throw new Error("That role belongs to another workspace.");
    }
    // Detach members and pending invites from the deleted role.
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.map((m) =>
        m.customRoleId === id ? { ...m, customRoleId: undefined } : m,
      ),
    });
    const invites = await ctx.db.query("pendingInvites").collect();
    for (const i of invites) {
      if (i.customRoleId === id) {
        await ctx.db.patch(i._id, { customRoleId: undefined });
      }
    }
    await ctx.db.delete(id);
  },
});

/** Assign (or clear, with undefined) a custom role on a member. */
export const setMemberCustomRole = mutation({
  args: {
    userId: v.id("users"),
    customRoleId: v.optional(v.id("customRoles")),
  },
  handler: async (ctx, { userId: targetId, customRoleId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    const settingsDoc = await getSettings(ctx, userId);
    if (settingsDoc === null) throw new Error("No workspace.");
    const actor = await actorRole(ctx, settingsDoc, userId);
    if (!actor || (actor !== "super" && actor !== "admin")) {
      throw new Error("Only the super user or an admin can assign roles.");
    }
    if (targetId === settingsDoc.ownerId) {
      throw new Error("The super user's access can't be changed.");
    }
    const target = settingsDoc.members.find((m) => m.userId === targetId);
    if (!target) throw new Error("That user is not a member.");
    if (customRoleId !== undefined) {
      const custom = await ctx.db.get(customRoleId);
      if (custom === null || custom.ownerId !== settingsDoc.ownerId) {
        throw new Error("That custom role no longer exists.");
      }
    }
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.map((m) =>
        m.userId === targetId ? { ...m, customRoleId } : m,
      ),
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
    action: v.union(
      v.literal("view"),
      v.literal("create"),
      v.literal("edit"),
      v.literal("delete"),
    ),
    allowed: v.boolean(),
  },
  handler: async (ctx, { userId: targetId, section, action, allowed }) => {
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
    const nextPermissions: GranularPerms = {
      ...(target.permissions ?? {}),
      [section]: {
        ...(target.permissions?.[section as SectionKey] ?? {}),
        [action]: allowed,
      },
    };
    await ctx.db.patch(settingsDoc._id, {
      members: settingsDoc.members.map((m) =>
        m.userId === targetId ? { ...m, permissions: nextPermissions } : m,
      ),
    });
  },
});

/** Set a whole section block of permissions on a member at once. */
export const setMemberSectionPermissions = mutation({
  args: {
    userId: v.id("users"),
    section: v.union(
      v.literal("tasks"),
      v.literal("notes"),
      v.literal("costing"),
    ),
    permissions: permissionsValidator,
  },
  handler: async (ctx, { userId: targetId, section, permissions }) => {
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
    const sectionPerms = permissions[section as SectionKey];
    const nextPermissions: GranularPerms = {
      ...(target.permissions ?? {}),
      [section]: sectionPerms ?? {},
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
