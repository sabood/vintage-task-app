import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAppDialogs } from "@/components/AppDialogs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
type SectionKey = "tasks" | "notes" | "costing";

type Member = {
  userId: Id<"users">;
  role: Role;
  customRoleId?: Id<"customRoles">;
  permissions?: { tasks?: boolean; notes?: boolean; costing?: boolean };
  joinedAt: number;
  name?: string;
  email?: string;
  isSuper: boolean;
};

type CustomRole = {
  _id: Id<"customRoles">;
  name: string;
  description?: string;
  permissions?: { tasks?: boolean; notes?: boolean; costing?: boolean };
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

const SECTIONS: { key: SectionKey; label: string; icon: typeof CheckSquare }[] = [
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: NotebookPen },
  { key: "costing", label: "Costing", icon: Calculator },
];

const ASSIGNABLE: AssignableRole[] = ["admin", "user", "member"];

/** Section access switch pair: allow (eye) vs restrict (eye-off). */
function SectionToggles({
  member,
  sectionKey,
  label,
  icon: Icon,
  onToggle,
}: {
  member: Member;
  sectionKey: SectionKey;
  label: string;
  icon: typeof CheckSquare;
  onToggle: (m: Member, s: SectionKey, allowed: boolean) => void;
}) {
  const allowed = member.isSuper ? true : (member.permissions?.[sectionKey] ?? true);
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors",
        allowed ? "border-border bg-background" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <Icon className={cn("size-3.5", allowed ? "text-muted-foreground" : "text-destructive")} />
      <span className="text-[11px] font-medium">{label}</span>
      {member.isSuper ? (
        <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px]">
          always
        </Badge>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label={`${allowed ? "Restrict" : "Allow"} ${label} for this user`}
          title={allowed ? "Click to restrict" : "Click to allow"}
          onClick={() => onToggle(member, sectionKey, !allowed)}
          className={cn(
            "grid size-5 place-items-center rounded-md transition-colors",
            allowed
              ? "text-emerald-600 hover:bg-emerald-500/10"
              : "text-destructive hover:bg-destructive/10",
          )}
        >
          {allowed ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const { confirm } = useAppDialogs();
  const myAccess = useQuery(api.settings.getMyAccess);
  const members = useQuery(api.settings.listMembers);
  const customRoles = useQuery(api.settings.listCustomRoles);
  const pendingInvites = useQuery(api.settings.listPendingInvites);
  const currentUser = useQuery(api.users.currentUser);

  const inviteMember = useMutation(api.settings.inviteMember);
  const setMemberRole = useMutation(api.settings.setMemberRole);
  const setMemberCustomRole = useMutation(api.settings.setMemberCustomRole);
  const setMemberPermission = useMutation(api.settings.setMemberPermission);
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
  const [rolePerms, setRolePerms] = useState<Record<SectionKey, boolean>>({
    tasks: true,
    notes: true,
    costing: true,
  });

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

  const openRoleEditor = (role?: CustomRole) => {
    if (role) {
      setEditingRoleId(role._id);
      setRoleName(role.name);
      setRoleDescription(role.description ?? "");
      setRolePerms({
        tasks: role.permissions?.tasks ?? true,
        notes: role.permissions?.notes ?? true,
        costing: role.permissions?.costing ?? true,
      });
    } else {
      setEditingRoleId(null);
      setRoleName("");
      setRoleDescription("");
      setRolePerms({ tasks: true, notes: true, costing: true });
    }
    setRoleEditorOpen(true);
  };

  const submitRole = async () => {
    const perms = {
      tasks: rolePerms.tasks,
      notes: rolePerms.notes,
      costing: rolePerms.costing,
    };
    setBusy(true);
    try {
      if (editingRoleId !== null) {
        await updateCustomRole({
          id: editingRoleId,
          name: roleName,
          description: roleDescription,
          permissions: perms,
        });
        toast.success(`Role “${roleName}” updated.`);
      } else {
        await createCustomRole({
          name: roleName,
          description: roleDescription,
          permissions: perms,
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

  const handleToggleSection = async (
    member: Member,
    section: SectionKey,
    allowed: boolean,
  ) => {
    try {
      await setMemberPermission({ userId: member.userId, section, allowed });
      toast.success(
        `${section[0]!.toUpperCase()}${section.slice(1)} ${
          allowed ? "allowed" : "restricted"
        } for ${member.name ?? member.email ?? "user"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't change the restriction.",
      );
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
            Create users, assign roles, and restrict what each person can open.
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
                    Super user
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

                {/* restrictions */}
                <div className="flex flex-wrap items-center gap-2">
                  {SECTIONS.map(({ key, label, icon }) => (
                    <SectionToggles
                      key={key}
                      member={m}
                      sectionKey={key}
                      label={label}
                      icon={icon}
                      onToggle={handleToggleSection}
                    />
                  ))}
                </div>

                {/* actions */}
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
            No custom roles yet. Create one to bundle section access (e.g.
            “Storekeeper” with only Costing enabled) and assign it to any user.
          </p>
        ) : (
          <ul className="divide-y">
            {(customRoles ?? []).map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.description || "Custom role"} ·{" "}
                    {SECTIONS.filter(({ key }) => r.permissions?.[key] ?? true)
                      .map(({ label }) => label)
                      .join(", ") || "No sections"}
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

      <p className="text-xs text-muted-foreground">
        <strong>Super user</strong> — full control (created automatically, one per
        workspace). <strong>Admin</strong> — can add users and change roles.{" "}
        <strong>User</strong> — normal access. <strong>Member</strong> — limited
        access. Use the eye buttons to allow or restrict each section per user.
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
              Add a person who has already signed in to the app, then pick their
              role and restrictions.
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4 text-primary" />
              {editingRoleId !== null ? "Edit role" : "Create role"}
            </DialogTitle>
            <DialogDescription>
              Name the role and pick which sections people with it can open.
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
              <Label>Section access</Label>
              <div className="grid gap-1.5">
                {SECTIONS.map(({ key, label, icon: Icon }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={rolePerms[key]}
                      onCheckedChange={(v) =>
                        setRolePerms((p) => ({ ...p, [key]: v === true }))
                      }
                    />
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {rolePerms[key] ? "Allowed" : "Restricted"}
                    </span>
                  </label>
                ))}
              </div>
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
    </div>
  );
}
