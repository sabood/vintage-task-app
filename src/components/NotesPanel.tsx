import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import {
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Type,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { NoteColor, NoteFont } from "@/convex/schema";

const FONTS: { value: NoteFont; label: string; className: string }[] = [
  { value: "sans", label: "Sans", className: "font-sans" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
  { value: "hand", label: "Hand", className: "font-hand" },
];

const COLORS: { value: NoteColor; className: string; ring: string }[] = [
  {
    value: "default",
    className: "bg-muted-foreground/60",
    ring: "ring-muted-foreground/60",
  },
  { value: "indigo", className: "bg-primary", ring: "ring-primary" },
  { value: "emerald", className: "bg-emerald-500", ring: "ring-emerald-500" },
  { value: "amber", className: "bg-amber-500", ring: "ring-amber-500" },
  { value: "rose", className: "bg-rose-500", ring: "ring-rose-500" },
  { value: "sky", className: "bg-sky-500", ring: "ring-sky-500" },
];

// Static map so Tailwind can see the custom note-* utility classes
const NOTE_COLOR_CLASS: Record<NoteColor, string> = {
  default: "note-default",
  indigo: "note-indigo",
  emerald: "note-emerald",
  amber: "note-amber",
  rose: "note-rose",
  sky: "note-sky",
};

function fontClass(font: NoteFont | undefined): string {
  return FONTS.find((f) => f.value === font)?.className ?? "font-sans";
}

function accentChipClass(color: NoteColor | undefined): string {
  return COLORS.find((c) => c.value === color)?.className ?? COLORS[0].className;
}

/** Body of a note rendered with optional line numbers and the chosen font. */
function NoteBody({
  note,
  clamp,
}: {
  note: Pick<Doc<"notes">, "body" | "numbered" | "font">;
  clamp: boolean;
}) {
  const lines = note.body.split("\n");
  return (
    <div
      className={`flex-1 text-sm leading-relaxed break-words ${fontClass(note.font)} ${
        clamp ? "line-clamp-5" : ""
      }`}
    >
      {note.numbered ? (
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="note-line-num w-5 text-[11px] opacity-70">
                {i + 1}.
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {line === "" ? "\u00A0" : line}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{note.body}</p>
      )}
    </div>
  );
}

export default function NotesPanel() {
  const notes = useQuery(api.notes.list);
  const addNote = useMutation(api.notes.add);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"notes"> | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [numbered, setNumbered] = useState(false);
  const [font, setFont] = useState<NoteFont>("sans");
  const [color, setColor] = useState<NoteColor>("default");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<Id<"notes"> | null>(null);

  const entries = notes ?? [];

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setNumbered(false);
    setFont("sans");
    setColor("default");
    setDialogOpen(true);
  };

  const openEdit = (note: Doc<"notes">) => {
    setEditingId(note._id);
    setTitle(note.title);
    setBody(note.body);
    setNumbered(note.numbered ?? false);
    setFont(note.font ?? "sans");
    setColor(note.color ?? "default");
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setNumbered(false);
    setFont("sans");
    setColor("default");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await updateNote({ id: editingId, title, body, numbered, font, color });
      } else {
        await addNote({ title, body, numbered, font, color });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save that note.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: Id<"notes">) => {
    if (isDeletingId) return;
    setIsDeletingId(id);
    try {
      await removeNote({ id });
      toast.success("Note deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't delete that note.",
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div>
      {/* ── Panel header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {notes === undefined
            ? "Loading…"
            : `${entries.length} ${entries.length === 1 ? "note" : "notes"}`}
        </p>
        <Button onClick={openCreate} className="rounded-xl shadow-sm">
          <Plus className="size-4" />
          New note
        </Button>
      </div>

      {/* ── Notes grid ────────────────────────────────────────────── */}
      {notes === undefined ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border bg-card px-5 py-14 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading your notes…
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
          <StickyNote className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 font-medium">No notes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Jot down ideas, reminders, and reading lists.
          </p>
          <Button onClick={openCreate} className="mt-5 rounded-xl">
            <Plus className="size-4" />
            Create your first note
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {entries.map((note) => (
            <div
              key={note._id}
              className={`${NOTE_COLOR_CLASS[note.color ?? "default"]} note-card overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md`}
            >
              <h3 className="font-medium leading-snug break-words">
                {note.title}
              </h3>
              {note.body && <NoteBody note={note} clamp />}
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${accentChipClass(note.color)}`}
                    aria-hidden
                  />
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note._creationTime), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit “${note.title}”`}
                    onClick={() => openEdit(note)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete “${note.title}”`}
                    disabled={isDeletingId !== null}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(note._id)}
                  >
                    {isDeletingId === note._id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / edit dialog ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit note" : "New note"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update your note and save your changes."
                : "Jot down whatever you want to keep."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Title"
              aria-label="Note title"
              className="rounded-xl bg-card"
              autoFocus
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              placeholder="Write your note…"
              aria-label="Note body"
              className={`min-h-36 rounded-xl bg-card ${fontClass(font)}`}
            />
            {/* formatting toolbar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border bg-muted/40 p-2.5">
              <div className="flex items-center gap-1.5">
                <Type className="mr-0.5 size-3.5 text-muted-foreground" />
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-label={`${f.label} font`}
                    aria-pressed={font === f.value}
                    className={`h-7 rounded-lg px-2 text-xs font-medium transition-colors ${f.className} ${
                      font === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    onClick={() => setFont(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={`${c.value} color`}
                    aria-pressed={color === c.value}
                    className={`size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110 ${c.className} ${
                      color === c.value ? c.ring : "ring-transparent"
                    }`}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-pressed={numbered}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  numbered
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                onClick={() => setNumbered(!numbered)}
              >
                <ListOrdered className="size-3.5" />
                Numbering
              </button>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || isSaving}
                className="rounded-xl"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {editingId ? "Save changes" : "Create note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
