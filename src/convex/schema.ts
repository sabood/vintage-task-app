import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// note page formatting: body font family
export const noteFontValidator = v.union(
  v.literal("sans"),
  v.literal("serif"),
  v.literal("mono"),
  v.literal("hand"),
);
export type NoteFont = Infer<typeof noteFontValidator>;

// note page formatting: notebook color label
export const noteColorValidator = v.union(
  v.literal("default"),
  v.literal("indigo"),
  v.literal("violet"),
  v.literal("sky"),
  v.literal("teal"),
  v.literal("emerald"),
  v.literal("amber"),
  v.literal("orange"),
  v.literal("rose"),
  v.literal("pink"),
);
export type NoteColor = Infer<typeof noteColorValidator>;

// note page formatting: ink (text) color
export const noteInkValidator = v.union(
  v.literal("default"),
  v.literal("indigo"),
  v.literal("emerald"),
  v.literal("amber"),
  v.literal("rose"),
  v.literal("sky"),
);
export type NoteInk = Infer<typeof noteInkValidator>;

// task priority rating
export const taskPriorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);
export type TaskPriority = Infer<typeof taskPriorityValidator>;

// how a recurring task repeats
export const taskRecurrenceValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);
export type TaskRecurrence = Infer<typeof taskRecurrenceValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // the student's task ledger. one row per task entry.
    tasks: defineTable({
      ownerId: v.id("users"), // the student who wrote the entry
      text: v.string(), // the task itself, e.g. "Read Ch. 4 of Biology"
      isCompleted: v.boolean(), // false until the task is checked off
      listId: v.optional(v.id("taskLists")), // which named list it belongs to
      sourcePageId: v.optional(v.id("notePages")), // set when flagged from a note
      description: v.optional(v.string()), // notes / instructions / links
      dueAt: v.optional(v.number()), // deadline timestamp (ms)
      remindAt: v.optional(v.number()), // reminder timestamp (ms)
      priority: v.optional(taskPriorityValidator), // high / medium / low
      starred: v.optional(v.boolean()), // ⭐ important flag
      tags: v.optional(v.array(v.string())), // e.g. ["work", "home"]
      recurrence: v.optional(taskRecurrenceValidator), // daily / weekly / monthly
      completedAt: v.optional(v.number()), // when it was checked off
      attachments: v.optional(v.string()), // JSON: [{id,name,type,size,data}]
    }).index("by_owner", ["ownerId"]),

    // named task lists (e.g. "Homework", "Chores")
    taskLists: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      folderId: v.optional(v.id("taskFolders")), // grouping into folders
    }).index("by_owner", ["ownerId"]),

    // subtasks (steps) that break a big task into pieces
    taskSteps: defineTable({
      ownerId: v.id("users"),
      taskId: v.id("tasks"),
      text: v.string(),
      isCompleted: v.boolean(),
    }).index("by_task", ["taskId"]),

    // folders that group task lists
    taskFolders: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
    }).index("by_owner", ["ownerId"]),

    // raw materials used for job/task costing (price per unit)
    rawMaterials: defineTable({
      ownerId: v.id("users"),
      code: v.optional(v.string()), // material code / SKU
      name: v.string(),
      category: v.optional(v.string()), // e.g. Wood, Metal, Paint
      unit: v.string(), // e.g. kg, m, pcs, L, hr
      pricePerUnit: v.number(),
    }).index("by_owner", ["ownerId"]),

    // a costing sheet for a job / project / task
    costingSheets: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      currency: v.optional(v.string()), // display currency symbol
      markupPct: v.optional(v.number()), // profit % applied on cost
    }).index("by_owner", ["ownerId"]),

    // finished goods (FG) — the product being costed, grouped by project
    finishedGoods: defineTable({
      ownerId: v.id("users"),
      projectName: v.string(), // group label shown in the sidebar
      name: v.string(), // FG product name, e.g. "Wooden chair"
      code: v.optional(v.string()), // product code / SKU
      unit: v.optional(v.string()), // sold per: pcs, box, set…
      note: v.optional(v.string()), // short product description
      currency: v.optional(v.string()),
      markupPct: v.optional(v.number()),
    }).index("by_owner", ["ownerId"]),

    // one line inside a costing sheet
    costingItems: defineTable({
      ownerId: v.id("users"),
      sheetId: v.optional(v.id("costingSheets")), // legacy sheets
      fgId: v.optional(v.id("finishedGoods")), // lines of an FG product
      materialId: v.optional(v.id("rawMaterials")), // set for raw-material lines
      label: v.string(), // material name or custom line label
      qty: v.number(),
      unitPrice: v.number(), // copied from material but editable
      unit: v.optional(v.string()),
    })
      .index("by_sheet", ["sheetId"])
      .index("by_fg", ["fgId"])
      .index("by_owner", ["ownerId"]),

    // notebooks: the top level of the notes workspace (OneNote-style)
    notebooks: defineTable({
      ownerId: v.id("users"),
      title: v.string(),
      color: v.optional(noteColorValidator), // accent color for the notebook
    }).index("by_owner", ["ownerId"]),

    // pages inside a notebook; rendered like sheets of paper
    notePages: defineTable({
      ownerId: v.id("users"),
      notebookId: v.id("notebooks"),
      title: v.string(),
      body: v.string(),
      parentId: v.optional(v.id("notePages")), // set when this is a sub-page
      drawing: v.optional(v.string()), // ink strokes as JSON (normalized coords)
      images: v.optional(v.string()), // placed images as JSON (src, pos, crop)
      numbered: v.optional(v.boolean()), // number each line of the body
      font: v.optional(noteFontValidator), // body font family
      color: v.optional(noteColorValidator), // notebook color label
      inkColor: v.optional(noteInkValidator), // text (ink) color
      order: v.optional(v.number()), // manual page order within the notebook
    })
      .index("by_owner", ["ownerId"])
      .index("by_notebook", ["notebookId"]),

    // add other tables here

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
