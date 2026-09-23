import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MasterDataManager from "@/components/MasterDataManager";
import { useAppDialogs } from "@/components/AppDialogs";
import { cn } from "@/lib/utils";
import {
  ACTION_DESCRIPTIONS,
  ACTIONS,
  type ActionKey,
  itemsForSection,
  ITEMS,
  SECTIONS,
  SECTION_LABELS,
  type SectionKey,
} from "@/lib/permissions";
import {
  Calculator,
  CheckSquare,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  NotebookPen,
  Pencil,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Tags,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type Role = "super" | "admin" | "user" | "member";
type AssignableRole = Exclude<Role, "super">;

type GranularPerms = {
  tasks?: Partial<Record<ActionKey, boolean>>;
  notes?: Partial<Record<ActionKey, boolean>>;
  costing?: Partial<Record<ActionKey, boolean>>;
  items?: Record<string, Partial<Record<ActionKey, boolean>>>;
};

type Member = {
  userId: Id<"users">;
  role: Role;
  customRoleId?: Id<"customRoles">;
  permissions?: GranularPerms;
  joinedAt: number;
  name?: string;
  email?: string;
  isSuper: boolean;
};

type CustomRole = {
  _id: Id<"customRoles">;
  name: string;
  description?: string;
  permissions?: GranularPerms;
  createdAt: number;
};

type PendingInvite = {
  _id: Id<"pendingInvites">;
  email: string;
  role: AssignableRole;
  customRoleId?: Id<"customRoles">;
  createdAt: number;
};

const ROLE_META: Record<Role, { label: string; chip: string; blurb: string }> = {
  super: {
    label: "Super user",
    chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    blurb: "Full control — owner of the workspace.",
  },
  admin: {
    label: "Admin",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    blurb: "Adds users, changes roles & restrictions.",
  },
  user: {
    label: "User",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    blurb: "Normal access to allowed sections.",
  },
  member: {
    label: "Member",
    chip: "bg-muted text-muted-foreground",
    blurb: "Limited, read-mostly access.",
  },
};

const SECTION_ICONS: Record<SectionKey, typeof CheckSquare> = {
  tasks: CheckSquare,
  notes: NotebookPen,
  costing: Calculator,
};

const ASSIGNABLE: AssignableRole[] = ["admin", "user", "member"];

type PermDraft = {
  sections: Record<SectionKey, Record<ActionKey, boolean>>;
  items: Record<string, Partial<Record<ActionKey, boolean>>>;
};

const allAllowed = (): PermDraft => ({
  sections: {
    tasks: { view: true, create: true, edit: true, delete: true },
    notes: { view: true, create: true, edit: true, delete: true },
    costing: { view: true, create: true, edit: true, delete: true },
  },
  items: Object.fromEntries(
    ITEMS.map((item) => [
      item.key,
      Object.fromEntries(item.actions.map((a) => [a, true])),
    ]),
  ),
});

const fromPerms = (perms: GranularPerms | undefined): PermDraft => ({
  sections: {
    tasks: {
      view: perms?.tasks?.view ?? true,
      create: perms?.tasks?.create ?? true,
      edit: perms?.tasks?.edit ?? true,
      delete: perms?.tasks?.delete ?? true,
    },
    notes: {
      view: perms?.notes?.view ?? true,
      create: perms?.notes?.create ?? true,
      edit: perms?.notes?.edit ?? true,
      delete: perms?.notes?.delete ?? true,
    },
    costing: {
      view: perms?.costing?.view ?? true,
      create: perms?.costing?.create ?? true,
      edit: perms?.costing?.edit ?? true,
      delete: perms?.costing?.delete ?? true,
    },
  },
  items: Object.fromEntries(
    ITEMS.map((item) => [
      item.key,
      Object.fromEntries(
        item.actions.map((a) => [a, perms?.items?.[item.key]?.[a] ?? true]),
      ),
    ]),
  ),
});

/** Compact summary of a permission set, e.g. "Tasks: full · Notes: view+edit". */
function permsSummary(perms: GranularPerms | undefined): string {
  const parts = SECTIONS.map((s) => {
    const denied = ACTIONS.filter((a) => perms?.[s]?.[a] === false);
    const items = itemsForSection(s).filter((item) =>
      item.actions.some((a) => perms?.items?.[item.key]?.[a] === false),
    );
    let base: string;
    if (denied.length === 0) base = "full";
    else if (denied.length === ACTIONS.length) base = "none";
    else base = ACTIONS.filter((a) => !denied.includes(a)).join("+");
    const suffix =
      items.length > 0
        ? ` (${items.length} item${items.length === 1 ? "" : "s"} restricted)`
        : "";
    return `${SECTION_LABELS[s]}: ${base}${suffix}`;
  });
  return parts.join(" · ");
}

/** One section block of the permission matrix (View / Create / Edit / Delete). */
function SectionMatrix({
  perms,
  onChange,
  disabled,
}: {
  perms: Partial<Record<ActionKey, boolean>>;
  onChange: (action: ActionKey, allowed: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {ACTIONS.map((action) => {
        const allowed = perms[action] ?? true;
        return (
          <button
            key={action}
            type="button"
            disabled={disabled}
            title={ACTION_DESCRIPTIONS[action]}
            aria-pressed={allowed}
            onClick={() => onChange(action, !allowed)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-medium transition-colors",
              allowed
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/5 text-destructive",
              !disabled && "hover:brightness-95",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {allowed ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

/** Full permission matrix: every section, plus its items, action by action. */
function PermissionMatrix({
  value,
  onSectionChange,
  onItemChange,
  disabled,
}: {
  value: PermDraft;
  onSectionChange: (section: SectionKey, action: ActionKey, allowed: boolean) => void;
  onItemChange: (item: string, action: ActionKey, allowed: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {SECTIONS.map((s) => {
        const Icon = SECTION_ICONS[s];
        const sectionItems = itemsForSection(s);
        return (
          <div key={s} className="rounded-xl border px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{SECTION_LABELS[s]}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Whole section
              </span>
            </div>
            <SectionMatrix
              perms={value.sections[s]}
              disabled={disabled}
              onChange={(a, allowed) => onSectionChange(s, a, allowed)}
            />

            {sectionItems.length > 0 && (
              <div className="mt-2.5 space-y-1 border-t pt-2.5">
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Detailed · inside {SECTION_LABELS[s].toLowerCase()}
                </p>
                {sectionItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                      {item.label}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {item.actions.map((action) => {
                        const allowed =
                          value.items[item.key]?.[action as ActionKey] ?? true;
                        return (
                          <button
                            key={action}
                            type="button"
                            disabled={disabled}
                            title={`${item.label} — ${ACTION_DESCRIPTIONS[action as ActionKey]}`}
                            aria-pressed={allowed}
                            onClick={() =>
                              onItemChange(item.key, action as ActionKey, !allowed)
                            }
                            className={cn(
                              "flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors",
                              allowed
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                                : "border-destructive/30 bg-destructive/5 text-destructive",
                              !disabled && "hover:brightness-95",
                            )}
                          >
                            {allowed ? (
                              <Eye className="size-3" />
                            ) : (
                              <EyeOff className="size-3" />
                            )}
                            {action.charAt(0).toUpperCase() + action.slice(1)}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SettingsPanel() {
  const { confirm } = useAppDialogs();
  const myAccess = useQuery(api.settings.getMyAccess);
  // shared master data (units & categories) used by products and materials
  const units = useQuery(api.costing.listUnits);
  const allCategories = useQuery(api.costing.listCategories);

  const members = useQuery(api.settings.listMembers);
  const customRoles = useQuery(api.settings.listCustomRoles);
  const pendingInvites = useQuery(api.settings.listPendingInvites);
  const currentUser = useQuery(api.users.currentUser);

  const inviteMember = useMutation(api.settings.inviteMember);
  const setMemberRole = useMutation(api.settings.setMemberRole);
  const setMemberCustomRole = useMutation(api.settings.setMemberCustomRole);
  const setMemberSectionPermissions = useMutation(
    api.settings.setMemberSectionPermissions,
  );
  const setMemberItemPermissions = useMutation(
    api.settings.setMemberItemPermissions,
  );
  const removeMember = useMutation(api.settings.removeMember);
  const setWorkspaceName = useMutation(api.settings.setWorkspaceName);
  const cancelPendingInvite = useMutation(api.settings.cancelPendingInvite);
  const createCustomRole = useMutation(api.settings.createCustomRole);
  const updateCustomRole = useMutation(api.settings.updateCustomRole);
  const deleteCustomRole = useMutation(api.settings.deleteCustomRole);

  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<AssignableRole>("user");
  const [addCustomRoleId, setAddCustomRoleId] = useState<Id<"customRoles"> | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // role editor dialog state (create + edit share one dialog)
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<Id<"customRoles"> | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePerms, setRolePerms] = useState(allAllowed());

  // per-user detailed permissions dialog
  const [permMember, setPermMember] = useState<Member | null>(null);
  const [permDraft, setPermDraft] = useState(allAllowed());

  if (myAccess === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card px-5 py-14 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  const isSuper = myAccess?.isSuper ?? false;
  const role = (myAccess?.role ?? "member") as Role;
  const canManage = isSuper || role === "admin";

  if (!canManage) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
        <ShieldCheck className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-3 font-medium">Restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the super user and admins can open Settings.
        </p>
      </div>
    );
  }

  const resetAddDialog = () => {
    setAddEmail("");
    setAddRole("user");
    setAddCustomRoleId(null);
  };

  const submitInvite = async () => {
    const email = addEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter the person's email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteMember({
        email,
        role: addRole,
        customRoleId: addCustomRoleId ?? undefined,
      });
      if (result?.pending) {
        toast.success(
          `Invite saved for ${email} — they'll join automatically the first time they sign in.`,
        );
      } else {
        toast.success(`${email} added as ${ROLE_META[addRole].label}.`);
      }
      setAddOpen(false);
      resetAddDialog();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add that user.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openRoleEditor = (r?: CustomRole) => {
    if (r) {
      setEditingRoleId(r._id);
      setRoleName(r.name);
      setRoleDescription(r.description ?? "");
      setRolePerms(fromPerms(r.permissions));
    } else {
      setEditingRoleId(null);
      setRoleName("");
      setRoleDescription("");
      setRolePerms(allAllowed());
    }
    setRoleEditorOpen(true);
  };

  const submitRole = async () => {
    setBusy(true);
    const permissions = { ...rolePerms.sections, items: rolePerms.items };
    try {
      if (editingRoleId !== null) {
        await updateCustomRole({
          id: editingRoleId,
          name: roleName,
          description: roleDescription,
          permissions,
        });
        toast.success(`Role “${roleName}” updated.`);
      } else {
        await createCustomRole({
          name: roleName,
          description: roleDescription,
          permissions,
        });
        toast.success(`Role “${roleName}” created.`);
      }
      setRoleEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the role.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async (r: CustomRole) => {
    const ok = await confirm({
      title: `Delete role “${r.name}”?`,
      message:
        "Members using this role fall back to their base role until you assign another one.",
      confirmLabel: "Delete",
      danger: true,
      icon: "danger",
    });
    if (!ok) return;
    try {
      await deleteCustomRole({ id: r._id });
      toast.success(`Role “${r.name}” deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the role.");
    }
  };

  const handleAssignCustomRole = async (member: Member, roleId: Id<"customRoles"> | null) => {
    try {
      await setMemberCustomRole({ userId: member.userId, customRoleId: roleId ?? undefined });
      toast.success(
        roleId === null
          ? "Custom role cleared."
          : `Custom role “${(customRoles ?? []).find((r) => r._id === roleId)?.name ?? ""}” assigned.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't assign the role.");
    }
  };

  const handleRoleChange = async (member: Member, next: AssignableRole) => {
    if (next === member.role) return;
    try {
      await setMemberRole({ userId: member.userId, role: next });
      toast.success(
        `${member.name ?? member.email ?? "User"} is now ${ROLE_META[next].label}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update the role.",
      );
    }
  };

  const openPermDialog = (m: Member) => {
    setPermMember(m);
    setPermDraft(fromPerms(m.permissions));
  };

  const submitMemberPerms = async () => {
    if (permMember === null) return;
    setBusy(true);
    try {
      for (const s of SECTIONS) {
        await setMemberSectionPermissions({
          userId: permMember.userId,
          section: s,
          permissions: { [s]: permDraft.sections[s] } as GranularPerms,
        });
      }
      for (const item of ITEMS) {
        await setMemberItemPermissions({
          userId: permMember.userId,
          item: item.key,
          permissions: {
            items: { [item.key]: permDraft.items[item.key] ?? {} },
          } as GranularPerms,
        });
      }
      toast.success(
        `Permissions saved for ${permMember.name ?? permMember.email ?? "user"}.`,
      );
      setPermMember(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save the permissions.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member: Member) => {
    const ok = await confirm({
      title: `Remove ${member.name ?? member.email ?? "user"}?`,
      message: "They lose access to the workspace until added again.",
      confirmLabel: "Remove",
      danger: true,
      icon: "danger",
    });
    if (!ok) return;
    try {
      await removeMember({ userId: member.userId });
      toast.success("User removed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't remove that user.",
      );
    }
  };

  const submitWorkspaceName = async () => {
    try {
      await setWorkspaceName({ name: nameDraft });
      toast.success("Workspace name saved.");
      setNameOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save the name.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold tracking-tight">
            <SettingsIcon className="size-6 text-primary" />
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create users, assign roles, and control exactly what each person can
            view, create, edit, and delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNameDraft("");
              setNameOpen(true);
            }}
          >
            Workspace name
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            Add user
          </Button>
        </div>
      </div>

      {/* my role summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            You are signed in as{" "}
            {currentUser?.name ?? currentUser?.email ?? "a user"}
          </p>
          <p className="text-xs text-muted-foreground">
            Role:{" "}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                ROLE_META[role].chip,
              )}
            >
              {ROLE_META[role].label}
            </span>
          </p>
        </div>
      </div>

      {/* member list */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="flex items-center gap-2 border-b px-5 py-3.5">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Users &amp; roles</h2>
          {members && (
            <Badge variant="secondary" className="ml-auto rounded-full">
              {members.length}
            </Badge>
          )}
        </header>

        {members === undefined ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="divide-y">
            {(members ?? []).map((m) => (
              <li
                key={m.userId}
                className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name ?? m.email ?? "User"}
                  </p>
                  {m.email && (
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  )}
                  {!m.isSuper && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                      {m.customRoleId
                        ? `Custom role · ${permsSummary(m.permissions)}`
                        : permsSummary(m.permissions)}
                    </p>
                  )}
                </div>

                {/* role selector */}
                {m.isSuper ? (
                  <span
                    className={cn(
                      "w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      ROLE_META.super.chip,
                    )}
                    title={ROLE_META.super.blurb}
                  >
                    Super user — full access
                  </span>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80",
                          m.customRoleId
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : ROLE_META[m.role].chip,
                        )}
                        title={ROLE_META[m.role].blurb}
                      >
                        {m.customRoleId
                          ? (customRoles ?? []).find((r) => r._id === m.customRoleId)
                              ?.name ?? "Custom"
                          : ROLE_META[m.role].label}
                        <ChevronDown className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Assign role</DropdownMenuLabel>
                      {ASSIGNABLE.map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => {
                            void handleRoleChange(m, r);
                            void handleAssignCustomRole(m, null);
                          }}
                        >
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              ROLE_META[r].chip,
                            )}
                          >
                            {ROLE_META[r].label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ROLE_META[r].blurb}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      {(customRoles ?? []).length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Custom roles</DropdownMenuLabel>
                          {(customRoles ?? []).map((r) => (
                            <DropdownMenuItem
                              key={r._id}
                              onClick={() => void handleAssignCustomRole(m, r._id)}
                            >
                              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                {r.name}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {r.description || "Custom role"}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* actions */}
                <div className="flex items-center gap-1">
                  {!m.isSuper && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPermDialog(m)}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Permissions
                    </Button>
                  )}
                  {!m.isSuper && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleRemove(m)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* custom roles manager */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="flex items-center gap-2 border-b px-5 py-3.5">
          <Tags className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Roles</h2>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => openRoleEditor()}
          >
            <UserPlus className="size-3.5" />
            Create role
          </Button>
        </header>
        {customRoles === undefined ? (
          <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : (customRoles ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No custom roles yet. Create one to bundle detailed permissions (e.g.
            “Storekeeper” who can view and create materials but not delete them)
            and assign it to any user.
          </p>
        ) : (
          <ul className="divide-y">
            {(customRoles ?? []).map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.description || "Custom role"} · {permsSummary(r.permissions)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openRoleEditor(r)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleDeleteRole(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* pending invites */}
      {pendingInvites !== undefined && (pendingInvites ?? []).length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex items-center gap-2 border-b px-5 py-3.5">
            <Mail className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pending invites</h2>
            <Badge variant="secondary" className="ml-auto rounded-full">
              {(pendingInvites ?? []).length}
            </Badge>
          </header>
          <ul className="divide-y">
            {(pendingInvites ?? []).map((i) => (
              <li key={i._id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.customRoleId
                      ? (customRoles ?? []).find((r) => r._id === i.customRoleId)?.name ?? "Custom role"
                      : ROLE_META[i.role].label}{' '}
                    · joins automatically on first sign-in
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    void cancelPendingInvite({ id: i._id })
                      .then(() => toast.success("Invite cancelled."))
                      .catch((e: unknown) =>
                        toast.error(
                          e instanceof Error ? e.message : "Couldn't cancel.",
                        ),
                      )
                  }
                >
                  <X className="size-3.5" />
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* shared master data — the single home for units & categories */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
          <Tag className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Units &amp; categories</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Shared by finished-goods products and raw materials
          </span>
        </header>
        <div className="px-5 py-4">
          <MasterDataManager
            units={units ?? []}
            categories={allCategories ?? []}
            embedded
          />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        <strong>Super user</strong> — full control (created automatically, one per
        workspace). <strong>Admin</strong> — can add users and change roles. Use{" "}
        <strong>Roles</strong> to build reusable permission sets, and{" "}
        <strong>Permissions</strong> on a user for individual overrides (they
        layer on top of the assigned role).
      </p>

      {/* add-user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Add a user
            </DialogTitle>
            <DialogDescription>
              Add a person by email, then pick their role. Fine-tune their
              detailed permissions afterwards with the Permissions button.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-user-email">Email</Label>
              <Input
                id="add-user-email"
                type="email"
                placeholder="name@company.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitInvite()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="grid gap-1.5">
                {ASSIGNABLE.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setAddRole(r);
                      setAddCustomRoleId(null);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      addRole === r && addCustomRoleId === null
                        ? "border-primary/50 bg-primary/5"
                        : "hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ROLE_META[r].chip,
                      )}
                    >
                      {ROLE_META[r].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_META[r].blurb}
                    </span>
                  </button>
                ))}
                {(customRoles ?? []).map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => setAddCustomRoleId(r._id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      addCustomRoleId === r._id
                        ? "border-primary/50 bg-primary/5"
                        : "hover:bg-accent",
                    )}
                  >
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      {r.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.description || "Custom role"}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-1 text-xs font-medium text-primary hover:underline"
                onClick={() => openRoleEditor()}
              >
                + Create a custom role
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitInvite()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* workspace-name dialog */}
      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Workspace name</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="My workspace"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submitWorkspaceName()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitWorkspaceName()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* role editor dialog (create + edit) */}
      <Dialog open={roleEditorOpen} onOpenChange={setRoleEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4 text-primary" />
              {editingRoleId !== null ? "Edit role" : "Create role"}
            </DialogTitle>
            <DialogDescription>
              Name the role and set exactly what people with it can view,
              create, edit, and delete in each section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Storekeeper"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description (optional)</Label>
              <Input
                id="role-description"
                placeholder="What is this role for?"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Detailed permissions</Label>
              <PermissionMatrix
                value={rolePerms}
                onSectionChange={(s, a, allowed) =>
                  setRolePerms((p) => ({
                    ...p,
                    sections: { ...p.sections, [s]: { ...p.sections[s], [a]: allowed } },
                  }))
                }
                onItemChange={(item, a, allowed) =>
                  setRolePerms((p) => ({
                    ...p,
                    items: {
                      ...p.items,
                      [item]: { ...(p.items[item] ?? {}), [a]: allowed },
                    },
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRole()} disabled={busy || roleName.trim() === ""}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editingRoleId !== null ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* per-user detailed permissions dialog */}
      <Dialog
        open={permMember !== null}
        onOpenChange={(open) => !open && setPermMember(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              Permissions — {permMember?.name ?? permMember?.email ?? "user"}
            </DialogTitle>
            <DialogDescription>
              {permMember?.customRoleId
                ? "These overrides layer on top of the assigned custom role."
                : "Set exactly what this user can view, create, edit, and delete."}
            </DialogDescription>
          </DialogHeader>

          <PermissionMatrix
            value={permDraft}
            onSectionChange={(s, a, allowed) =>
              setPermDraft((p) => ({
                ...p,
                sections: { ...p.sections, [s]: { ...p.sections[s], [a]: allowed } },
              }))
            }
            onItemChange={(item, a, allowed) =>
              setPermDraft((p) => ({
                ...p,
                items: {
                  ...p.items,
                  [item]: { ...(p.items[item] ?? {}), [a]: allowed },
                },
              }))
            }
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermMember(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitMemberPerms()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
