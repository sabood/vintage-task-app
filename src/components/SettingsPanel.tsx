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
  NotebookPen,
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
type AssignableRole = Exclude<Role, "super">;
type SectionKey = "tasks" | "notes" | "costing";

type Member = {
  userId: Id<"users">;
  role: Role;
  permissions?: { tasks?: boolean; notes?: boolean; costing?: boolean };
  joinedAt: number;
  name?: string;
  email?: string;
  isSuper: boolean;
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
  const currentUser = useQuery(api.users.currentUser);

  const inviteMember = useMutation(api.settings.inviteMember);
  const setMemberRole = useMutation(api.settings.setMemberRole);
  const setMemberPermission = useMutation(api.settings.setMemberPermission);
  const removeMember = useMutation(api.settings.removeMember);
  const setWorkspaceName = useMutation(api.settings.setWorkspaceName);

  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<AssignableRole>("user");
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

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
      await inviteMember({ email, role: addRole });
      toast.success(`${email} added as ${ROLE_META[addRole].label}.`);
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
                          ROLE_META[m.role].chip,
                        )}
                        title={ROLE_META[m.role].blurb}
                      >
                        {ROLE_META[m.role].label}
                        <ChevronDown className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Assign role</DropdownMenuLabel>
                      {ASSIGNABLE.map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => void handleRoleChange(m, r)}
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
                    onClick={() => setAddRole(r)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      addRole === r
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
              </div>
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
    </div>
  );
}
