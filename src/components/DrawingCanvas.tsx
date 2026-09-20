import { useCallback, useEffect, useRef, useState } from "react";

export type Stroke = {
  color: string;
  width: number;
  points: [number, number][]; // normalized 0..1 relative to the canvas box
};

export const PEN_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#1e1e2e", // ink
];

export const PEN_SIZES = [
  { label: "S", width: 2 },
  { label: "M", width: 4 },
  { label: "L", width: 7 },
];

export function parseStrokes(json: string | undefined): Stroke[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Stroke[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Transparent canvas overlay that captures mouse/touch drawing.
 * Strokes are stored in normalized coordinates so they survive resizes.
 * The parent toggles `active` (draw mode); when inactive, pointers pass through.
 */
export function DrawingCanvas({
  strokes,
  onChange,
  active,
  penColor,
  penWidth,
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  active: boolean;
  penColor: string;
  penWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);
  const [, setTick] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = currentRef.current ? [...strokes, currentRef.current] : strokes;
    for (const stroke of all) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      const [x0, y0] = stroke.points[0];
      ctx.moveTo(x0 * rect.width, y0 * rect.height);
      for (const [x, y] of stroke.points.slice(1)) {
        ctx.lineTo(x * rect.width, y * rect.height);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [redraw]);

  const pointFromEvent = (e: React.PointerEvent): [number, number] => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const handleDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentRef.current = {
      color: penColor,
      width: penWidth,
      points: [pointFromEvent(e)],
    };
    setTick((t) => t + 1);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!active || !drawingRef.current || !currentRef.current) return;
    e.preventDefault();
    currentRef.current.points.push(pointFromEvent(e));
    redraw();
  };

  const handleUp = () => {
    if (!active || !drawingRef.current) return;
    drawingRef.current = false;
    const finished = currentRef.current;
    currentRef.current = null;
    if (finished && finished.points.length > 0) {
      onChange([...strokes, finished]);
    } else {
      setTick((t) => t + 1);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-10"
      style={{
        pointerEvents: active ? "auto" : "none",
        cursor: active ? "crosshair" : "default",
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
    </div>
  );
}
