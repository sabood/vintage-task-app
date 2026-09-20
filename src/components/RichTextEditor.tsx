import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Plain-text version of stored rich HTML (for previews / empty checks). */
export function stripHtml(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

/** Convert legacy plain-text bodies (with \n) into paragraph HTML. */
export function toEditorHtml(body: string): string {
  if (body.includes("<")) return body; // already rich HTML
  if (body.trim() === "") return "";
  return body
    .split("\n")
    .map((line) => `<p>${line === "" ? "<br>" : escapeHtml(line)}</p>`)
    .join("");
}

function escapeHtml(text: string): string {
  const el = document.createElement("div");
  el.textContent = text;
  return el.innerHTML;
}

/** Cached selection so toolbar buttons (which steal focus) keep working. */
let savedRange: Range | null = null;

/**
 * Apply a formatting command to the selected letters only.
 * "bold" toggles bold; "foreColor" applies an ink color (arg = CSS color).
 */
export function formatSelection(cmd: "bold" | "foreColor", arg?: string): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount === 0 && savedRange) {
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  if (sel.rangeCount === 0) return;
  document.execCommand("styleWithCSS", false, "true");
  if (cmd === "bold") {
    document.execCommand("bold");
  } else if (arg) {
    document.execCommand("foreColor", false, arg);
  }
}

export type InkOption = { value: string; label: string; dot: string };

export const INK_COMMAND_COLORS: Record<string, string> = {
  default: "currentColor",
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
};

/**
 * ContentEditable rich-text editor.
 * Bold (Ctrl/Cmd+B or toolbar) and ink colors apply to the selected letters only.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  numbered,
  fontClass,
  inkClass,
  onBoldStateChange,
  editorRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  numbered?: boolean;
  fontClass?: string;
  inkClass?: string;
  onBoldStateChange?: (bold: boolean) => void;
  editorRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = editorRef ?? innerRef;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync external value into the DOM when it changes externally.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // Enter creates paragraphs so line numbering stays consistent.
  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  const captureSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      onBoldStateChange?.(document.queryCommandState("bold"));
    }
  };

  const emit = () => {
    const el = ref.current;
    if (el) onChangeRef.current(el.innerHTML);
  };

  const isEmpty = stripHtml(value).trim() === "";

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder ?? "Note body"}
      data-placeholder={placeholder ?? ""}
      data-empty={isEmpty ? "true" : "false"}
      className={cn(
        "rich-editor",
        numbered && "note-numbered",
        fontClass,
        inkClass,
        className,
      )}
      onInput={emit}
      onKeyUp={captureSelection}
      onMouseUp={captureSelection}
      onFocus={captureSelection}
      onPaste={(e) => {
        e.preventDefault();
        const lines = e.clipboardData
          .getData("text/plain")
          .split("\n");
        lines.forEach((line, i) => {
          if (i > 0) document.execCommand("insertParagraph");
          if (line !== "") document.execCommand("insertText", false, line);
        });
        emit();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          formatSelection("bold");
          emit();
          onBoldStateChange?.(document.queryCommandState("bold"));
        }
      }}
    />
  );
}
