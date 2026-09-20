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

export type FormatCmd =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "foreColor"
  | "hiliteColor"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "removeFormat"
  | "undo"
  | "redo";

/** Apply a formatting command to the selected letters only. */
export function formatSelection(cmd: FormatCmd, arg?: string): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount === 0 && savedRange) {
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  if (sel.rangeCount === 0 && cmd !== "undo" && cmd !== "redo") return;
  document.execCommand("styleWithCSS", false, "true");
  if (arg !== undefined) {
    document.execCommand(cmd, false, arg);
  } else {
    document.execCommand(cmd);
  }
}

/** Word-style block formats. */
export const BLOCK_FORMATS = [
  { value: "<p>", label: "Paragraph" },
  { value: "<h1>", label: "Heading 1" },
  { value: "<h2>", label: "Heading 2" },
  { value: "<h3>", label: "Heading 3" },
  { value: "<blockquote>", label: "Quote" },
] as const;

export function formatBlock(tag: string): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount === 0 && savedRange) {
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  if (sel.rangeCount === 0) return;
  document.execCommand("formatBlock", false, tag);
}

/** Read the current tag name around the caret, e.g. "h1" | "p" | "blockquote". */
export function currentBlockTag(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "p";
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase();
      if (["h1", "h2", "h3", "p", "blockquote", "li"].includes(tag)) {
        return tag === "li" ? "p" : tag;
      }
    }
    node = node.parentNode;
  }
  return "p";
}

/** Snapshot of toggled formats at the caret/selection. */
export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  ul: boolean;
  ol: boolean;
};

export function queryFormatState(): FormatState {
  const q = (cmd: string) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  return {
    bold: q("bold"),
    italic: q("italic"),
    underline: q("underline"),
    strikeThrough: q("strikeThrough"),
    ul: q("insertUnorderedList"),
    ol: q("insertOrderedList"),
  };
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
  onFormatStateChange,
  editorRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  numbered?: boolean;
  fontClass?: string;
  inkClass?: string;
  onFormatStateChange?: (state: FormatState) => void;
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
      onFormatStateChange?.(queryFormatState());
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
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        const key = e.key.toLowerCase();
        const handled: Record<string, FormatCmd> = {
          b: "bold",
          i: "italic",
          u: "underline",
        };
        if (handled[key]) {
          e.preventDefault();
          formatSelection(handled[key]);
          emit();
          onFormatStateChange?.(queryFormatState());
        }
      }}
    />
  );
}
