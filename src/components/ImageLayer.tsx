import { useCallback, useEffect, useRef, useState } from "react";

export type PlacedImage = {
  id: string;
  src: string;
  // position of the image box, normalized 0..1 relative to the page
  x: number;
  y: number;
  w: number;
  h: number;
  // crop of the source image, normalized 0..1 (left/top/right/bottom)
  crop: { l: number; t: number; r: number; b: number };
};

export function parseImages(json: string | undefined): PlacedImage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as PlacedImage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const MAX_IMAGES_PER_PAGE = 12;
const MAX_BYTES = 1_500_000; // keep localStorage/db payloads small

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
}

/** Shrink large images so data URLs stay reasonable. */
async function normalizeFile(file: File): Promise<string> {
  const raw = await readAsDataURL(file);
  if (raw.length <= MAX_BYTES) return raw;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Couldn't load that image."));
    img.src = raw;
  });
  const scale = Math.min(1, Math.sqrt((MAX_BYTES * 1.4) / raw.length));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | {
      kind: "crop";
      id: string;
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      crop: PlacedImage["crop"];
    }
  | { kind: "resize"; id: string; handle: "se"; startX: number; startY: number; w: number; h: number }
  | null;

/**
 * Image layer over the page: insert pictures, drag to move,
 * SE handle to resize, Alt+drag (or crop handles) to crop with the cursor.
 */
export function ImageLayer({
  images,
  onChange,
  active,
  onActiveChange,
}: {
  images: PlacedImage[];
  onChange: (images: PlacedImage[]) => void;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const cropRef = useRef<string | null>(null); // id being crop-dragged
  const [, setTick] = useState(0);

  const norm = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const update = (id: string, patch: Partial<PlacedImage>) => {
    onChange(images.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  };

  const onPointerDown = (
    e: React.PointerEvent,
    img: PlacedImage,
    mode: "move" | "resize" | "crop",
  ) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = norm(e);
    if (mode === "move") {
      dragRef.current = { kind: "move", id: img.id, startX: x, startY: y, ox: img.x, oy: img.y };
    } else if (mode === "resize") {
      dragRef.current = { kind: "resize", id: img.id, handle: "se", startX: x, startY: y, w: img.w, h: img.h };
    } else {
      cropRef.current = img.id;
      dragRef.current = {
        kind: "crop",
        id: img.id,
        handle: "se",
        startX: x,
        startY: y,
        crop: { ...img.crop },
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!active || !st) return;
    const [x, y] = norm(e);
    if (st.kind === "move") {
      update(st.id, {
        x: Math.min(0.98, Math.max(0, st.ox + (x - st.startX))),
        y: Math.min(0.98, Math.max(0, st.oy + (y - st.startY))),
      });
    } else if (st.kind === "resize") {
      update(st.id, {
        w: Math.min(1, Math.max(0.06, st.w + (x - st.startX))),
        h: Math.min(1, Math.max(0.04, st.h + (y - st.startY))),
      });
    } else {
      // crop: shrinking the visible window from the SE corner
      const dx = x - st.startX;
      const dy = y - st.startY;
      update(st.id, {
        crop: {
          l: st.crop.l,
          t: st.crop.t,
          r: Math.min(1, Math.max(st.crop.l + 0.05, st.crop.r + dx)),
          b: Math.min(1, Math.max(st.crop.t + 0.05, st.crop.b + dy)),
        },
      });
    }
    setTick((t) => t + 1);
  };

  const onPointerUp = () => {
    dragRef.current = null;
    cropRef.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onActiveChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onActiveChange]);

  const handleImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const room = MAX_IMAGES_PER_PAGE - images.length;
      if (room <= 0) {
        onChange(images);
        return;
      }
      const next: PlacedImage[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          const src = await normalizeFile(file);
          next.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            src,
            x: 0.08 + next.length * 0.04,
            y: 0.3 + next.length * 0.08,
            w: 0.34,
            h: 0.26,
            crop: { l: 0, t: 0, r: 1, b: 1 },
          });
        } catch {
          // skip unreadable files
        }
      }
      if (next.length > 0) onChange([...images, ...next]);
    },
    [images, onChange],
  );

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-20"
      style={{
        pointerEvents: active ? "auto" : "none",
        cursor: active ? "default" : undefined,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDragOver={(e) => {
        if (active) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!active) return;
        e.preventDefault();
        void handleImages(e.dataTransfer.files);
      }}
    >
      {images.map((img) => (
        <div
          key={img.id}
          className="group absolute shadow-md"
          style={{
            left: `${img.x * 100}%`,
            top: `${img.y * 100}%`,
            width: `${img.w * 100}%`,
            height: `${img.h * 100}%`,
            cursor: active ? (cropRef.current === img.id ? "crosshair" : "move") : "default",
            pointerEvents: active ? "auto" : "none",
          }}
          onPointerDown={(e) => onPointerDown(e, img, "move")}
        >
          {/* cropped view */}
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none size-full rounded-md object-cover select-none"
            style={{
              objectPosition: "center",
              clipPath: `inset(${img.crop.t * 100}% ${(1 - img.crop.r) * 100}% ${(1 - img.crop.b) * 100}% ${img.crop.l * 100}%)`,
              transform: "scale(1.02)",
            }}
          />
          {active && (
            <>
              {/* resize handle */}
              <span
                role="button"
                tabIndex={0}
                aria-label="Resize image"
                className="absolute -right-1.5 -bottom-1.5 z-10 size-3.5 rounded-sm border-2 border-white bg-primary shadow"
                style={{ cursor: "nwse-resize" }}
                onPointerDown={(e) => onPointerDown(e, img, "resize")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onPointerDown(e as unknown as React.PointerEvent, img, "resize");
                }}
              />
              {/* crop handle */}
              <span
                role="button"
                tabIndex={0}
                aria-label="Crop image"
                title="Drag to crop"
                className="absolute -top-1.5 -left-1.5 z-10 size-3.5 rounded-sm border-2 border-white bg-amber-500 shadow"
                style={{ cursor: "nwse-resize" }}
                onPointerDown={(e) => onPointerDown(e, img, "crop")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onPointerDown(e as unknown as React.PointerEvent, img, "crop");
                }}
              />
              {/* delete */}
              <button
                type="button"
                aria-label="Remove image"
                className="absolute -top-2 -right-2 z-10 grid size-5 place-items-center rounded-full border bg-card text-xs text-muted-foreground shadow hover:text-destructive"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(images.filter((i) => i.id !== img.id));
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}

      {active && (
        <label className="absolute top-2 right-2 z-30 flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium shadow-md hover:bg-accent">
          + Add image
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleImages(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
