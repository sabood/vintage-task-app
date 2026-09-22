import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppDialogs } from "@/components/AppDialogs";
import { cn } from "@/lib/utils";
import {
  Calculator,
  CheckSquare,
  Loader2,
  NotebookPen,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type Role = "super" | "admin" | "user" | "member";

type Member = {
  userId: Id<"users">;
  role: Role;
  permissions?: { tasks?: boolean; notes?: boolean; costing?: boolean };
  joinedAt: number;
  name?: string;
  email?: string;
  isSuper: boolean;
};

const ROLE_META: Record<Role, { label: string; chip: string }> = {
  super: {
    label: "Super user",
    chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  },
  admin: {
    label: "Admin",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  user: {
    label: "User",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  member: {
    label: "Member",
    chip: "bg-muted text-muted-foreground",
  },
};

const SECTIONS = [
  { key: "tasks" as const, label: "Tasks", icon: CheckSquare },
  { key: "notes" as const, label: "Notes", icon: NotebookPen },
  { key: "costing" as const, label: "Costing", icon: Calculator },
];

export default function SettingsPanel() {
  const { confirm, prompt, promptMulti } = useAppDialogs();
  const myAccess = useQuery(api.settings.getMyAccess);
  const members = useQuery(api.settings.listMembers);
  const currentUser = useQuery(api.users.currentUser);

  const inviteMember = useMutation(api.settings.inviteMember);
  const setMemberRole = useMutation(api.settings.setMemberRole);
  const setMemberPermission = useMutation(api.settings.setMemberPermission);
  const removeMember = useMutation(api.settings.removeMember);
  const setWorkspaceName = useMutation(api.settings.setWorkspaceName);

  const [busy, setBusy] = useState(false);

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

  const handleInvite = async () => {
    const result = await promptMulti({
      title: "Add a user",
      message:
        "Add a person who has already signed in to the app. Pick their role — admins can manage other users.",
      fields: [
        { key: "email", label: "Email", required: true },
        {
          key: "role",
          label: "Role (admin, user, or member)",
          required: true,
          validate: (v) =>
            ["admin", "user", "member"].includes(v.trim().toLowerCase())
              ? null
              : "Use admin, user, or member",
        },
      ],
      confirmLabel: "Add user",
    });
    if (!result) return;
    setBusy(true);
    try {
      await inviteMember({
        email: result.email!.trim(),
        role: result.role!.trim().toLowerCase() as "admin" | "user" | "member",
      });
      toast.success("User added to the workspace.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add that user.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (member: Member) => {
    const value = await prompt({
      title: `Change role — ${member.name ?? member.email ?? "user"}`,
      label: "New role (admin, user, or member)",
      initial: member.role === "super" ? "admin" : member.role,
      required: true,
      validate: (v) =>
        ["admin", "user", "member"].includes(v.trim().toLowerCase())
          ? null
          : "Use admin, user, or member",
      confirmLabel: "Save",
    });
    if (value === null) return;
    try {
      await setMemberRole({
        userId: member.userId,
        role: value.trim().toLowerCase() as "admin" | "user" | "member",
      });
      toast.success("Role updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update the role.",
      );
    }
  };

  const handleToggleSection = async (
    member: Member,
    section: "tasks" | "notes" | "costing",
    allowed: boolean,
  ) => {
    try {
      await setMemberPermission({
        userId: member.userId,
        section,
        allowed,
      });
      toast.success(
        `${section[0]!.toUpperCase()}${section.slice(1)} ${
          allowed ? "enabled" : "restricted"
        } for ${member.name ?? member.email ?? "user"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't change the restriction.",
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

  const handleRenameWorkspace = async () => {
    const value = await prompt({
      title: "Workspace name",
      placeholder: "My workspace",
      confirmLabel: "Save",
    });
    if (value === null) return;
    try {
      await setWorkspaceName({ name: value });
      toast.success("Workspace name saved.");
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
          <Button variant="outline" size="sm" onClick={() => void handleRenameWorkspace()}>
            Workspace name
          </Button>
          <Button size="sm" onClick={() => void handleInvite()} disabled={busy}>
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
                className="flex flex-wrap items-center gap-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {m.name ?? m.email ?? "User"}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        ROLE_META[m.role].chip,
                      )}
                    >
                      {ROLE_META[m.role].label}
                    </span>
                  </p>
                  {m.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  )}
                </div>

                {/* restrictions */}
                <div className="flex items-center gap-3">
                  {SECTIONS.map(({ key, label, icon: Icon }) => {
                    const allowed = m.isSuper
                      ? true
                      : (m.permissions?.[key] ?? true);
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                        title={`${allowed ? "Restrict" : "Allow"} ${label}`}
                      >
                        <Icon className="size-3.5" />
                        <Switch
                          checked={allowed}
                          disabled={m.isSuper}
                          onCheckedChange={(v) =>
                            void handleToggleSection(m, key, v)
                          }
                        />
                      </label>
                    );
                  })}
                </div>

                {/* actions */}
                {!m.isSuper && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRoleChange(m)}
                    >
                      <Plus className="size-3.5" />
                      Role
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleRemove(m)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Roles: <strong>Super user</strong> — full control (created automatically,
        one per workspace). <strong>Admin</strong> — can add users and change
        roles. <strong>User</strong> — normal access. <strong>Member</strong> —
        limited access. Toggle the section switches to restrict what each user
        can open.
      </p>
    </div>
  );
}
