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
    }).index("by_owner", ["ownerId"]),

    // named task lists (e.g. "Homework", "Chores")
    taskLists: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
    }).index("by_owner", ["ownerId"]),

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
