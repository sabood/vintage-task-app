import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export default function NotesPanel() {
  const notes = useQuery(api.notes.list);
  const addNote = useMutation(api.notes.add);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"notes"> | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<Id<"notes"> | null>(null);

  const entries = notes ?? [];

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setDialogOpen(true);
  };

  const openEdit = (note: { _id: Id<"notes">; title: string; body: string }) => {
    setEditingId(note._id);
    setTitle(note.title);
    setBody(note.body);
    setDialogOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await updateNote({ id: editingId, title, body });
      } else {
        await addNote({ title, body });
      }
      setDialogOpen(false);
      setEditingId(null);
      setTitle("");
      setBody("");
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
              className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="font-medium leading-snug break-words">
                {note.title}
              </h3>
              {note.body && (
                <p className="mt-2 line-clamp-5 flex-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {note.body}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(note._creationTime), {
                    addSuffix: true,
                  })}
                </span>
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
              className="min-h-36 rounded-xl bg-card"
            />
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
