// ── Detailed permission model ────────────────────────────────────────────
// Every section grants four actions. `undefined` inherits the workspace
// default (everything allowed) — only explicit `false` denies.

export const SECTIONS = ["tasks", "notes", "costing"] as const;
export type SectionKey = (typeof SECTIONS)[number];

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type ActionKey = (typeof ACTIONS)[number];

export type GranularPerms = {
  tasks?: Partial<Record<ActionKey, boolean>>;
  notes?: Partial<Record<ActionKey, boolean>>;
  costing?: Partial<Record<ActionKey, boolean>>;
};

/** Resolve a permission: explicit value > default allowed. */
export function can(
  perms: GranularPerms | undefined,
  section: SectionKey,
  action: ActionKey,
): boolean {
  const v = perms?.[section]?.[action];
  if (v !== undefined) return v;
  // delete defaults to true only when nothing is configured at all; but for
  // least surprise, absence = allowed (matches previous behavior).
  return true;
}

/** Section is visible when view is allowed. */
export function canView(
  perms: GranularPerms | undefined,
  section: SectionKey,
): boolean {
  return can(perms, section, "view");
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export const ACTION_DESCRIPTIONS: Record<ActionKey, string> = {
  view: "See the section and its content",
  create: "Add new items",
  edit: "Change existing items",
  delete: "Remove items",
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  tasks: "Tasks",
  notes: "Notes",
  costing: "Costing",
};
