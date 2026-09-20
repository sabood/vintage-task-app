import { useCallback, useEffect, useRef, useState } from "react";

export type PenTool = "pen" | "arrow" | "eraser";

export type Stroke = {
  color: string;
  width: number;
  points: [number, number][]; // normalized 0..1 relative to the canvas box
  tool: PenTool;
};

export function parseStrokes(json: string | undefined): Stroke[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Stroke[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Older strokes saved before tools existed default to freehand pen. */
function normalizeStroke(s: Stroke): Stroke {
  return { ...s, tool: s.tool ?? "pen" };
}

/** Draw one stroke (freehand polyline or straight arrow) on a 2d context. */
function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "arrow" && pts.length >= 2) {
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[pts.length - 1];
    const ax = x0 * w;
    const ay = y0 * h;
    const bx = x1 * w;
    const by = y1 * h;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // arrowhead sized relative to line thickness
    const angle = Math.atan2(by - ay, bx - ax);
    const head = Math.max(stroke.width * 3.2, 9);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx - head * Math.cos(angle - Math.PI / 6.5),
      by - head * Math.sin(angle - Math.PI / 6.5),
    );
    ctx.lineTo(
      bx - head * Math.cos(angle + Math.PI / 6.5),
      by - head * Math.sin(angle + Math.PI / 6.5),
    );
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (stroke.tool === "eraser") {
    // destination-out so it erases strokes underneath on this layer
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = Math.max(stroke.width * 6, 18);
    ctx.beginPath();
    const [sx, sy] = pts[0];
    ctx.moveTo(sx * w, sy * h);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x * w, y * h);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  // freehand pen
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  const [sx, sy] = pts[0];
  ctx.moveTo(sx * w, sy * h);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x * w, y * h);
  ctx.stroke();
}

/**
 * Transparent canvas overlay that captures mouse/touch drawing.
 * Tools: freehand pen, straight arrows, eraser (erases drawn ink only).
 * Strokes are stored in normalized coordinates so they survive resizes.
 */
export function DrawingCanvas({
  strokes,
  onChange,
  active,
  penColor,
  penWidth,
  tool,
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  active: boolean;
  penColor: string;
  penWidth: number;
  tool: PenTool;
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
    const all = currentRef.current
      ? [...strokes, currentRef.current]
      : strokes;
    for (const raw of all) {
      const stroke = normalizeStroke(raw);
      // live eraser preview erases what is already committed
      if (stroke.tool === "eraser" && currentRef.current === stroke) {
        ctx.save();
        paintStroke(ctx, stroke, rect.width, rect.height);
        ctx.restore();
      } else {
        paintStroke(ctx, stroke, rect.width, rect.height);
      }
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
      tool,
    };
    setTick((t) => t + 1);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!active || !drawingRef.current || !currentRef.current) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    if (currentRef.current.tool === "arrow") {
      // arrows preview as tail → head
      currentRef.current.points = [currentRef.current.points[0], p];
    } else {
      currentRef.current.points.push(p);
    }
    redraw();
  };

  const handleUp = () => {
    if (!active || !drawingRef.current) return;
    drawingRef.current = false;
    const finished = currentRef.current;
    currentRef.current = null;
    if (finished && finished.points.length > 0) {
      onChange([...strokes, normalizeStroke(finished)]);
    } else {
      setTick((t) => t + 1);
    }
  };

  const cursor =
    tool === "eraser" ? "cell" : active ? "crosshair" : "default";

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-10"
      style={{
        pointerEvents: active ? "auto" : "none",
        cursor,
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
