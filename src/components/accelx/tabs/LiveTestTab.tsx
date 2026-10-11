import { useEffect, useRef } from "react";
import { computeMultiplier } from "@/lib/curve";
import { useCurveStore } from "@/store/useCurveStore";
import { Glass, SectionLabel } from "../Controls";
import { MiniCurve } from "../MiniCurve";

interface TrailPt { x: number; y: number; t: number }

export function LiveTestTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trail = useRef<TrailPt[]>([]);
  const last = useRef<TrailPt | null>(null);
  const smooth = useRef(0);
  const points = useCurveStore((s) => s.draft.points);
  const params = useCurveStore((s) => s.draft.params);
  const speed = useCurveStore((s) => s.liveSpeed);
  const setLiveSpeed = useCurveStore((s) => s.setLiveSpeed);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const color = getComputedStyle(c).color;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const now = performance.now();
      trail.current = trail.current.filter((p) => now - p.t < 600);
      const tr = trail.current;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1]!, b = tr[i]!;
        const life = 1 - (now - b.t) / 600;
        ctx.globalAlpha = life;
        ctx.lineWidth = 1 + 4 * life;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (last.current && now - last.current.t > 50) {
        smooth.current *= 0.9;
        if (smooth.current < 0.01) smooth.current = 0;
        setLiveSpeed(smooth.current);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); setLiveSpeed(0); };
  }, [setLiveSpeed]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    if (last.current) {
      const dt = Math.max(1, p.t - last.current.t);
      const raw = (Math.hypot(p.x - last.current.x, p.y - last.current.y) / dt) * 1.6;
      smooth.current = smooth.current * 0.75 + raw * 0.25;
      setLiveSpeed(smooth.current);
    }
    last.current = p;
    trail.current.push(p);
  };

  const mult = computeMultiplier(points, speed, params);
  const stats = [
    { label: "Input speed", value: speed.toFixed(2), unit: "c/ms" },
    { label: "Multiplier", value: mult.toFixed(2), unit: "×" },
    { label: "Effective speed", value: (speed * mult).toFixed(2), unit: "c/ms" },
  ];

  return (
    <div className="flex h-full gap-3">
      <Glass className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} onPointerMove={onMove} className="absolute inset-0 size-full cursor-crosshair text-primary" />
        <div className="pointer-events-none absolute left-5 top-4">
          <div className="text-sm font-semibold">Live test pad</div>
          <div className="text-[11px] text-muted-foreground">Move your mouse here — slow, then flick.</div>
        </div>
      </Glass>
      <div className="flex w-[260px] shrink-0 flex-col gap-3">
        {stats.map((s) => (
          <Glass key={s.label} className="rounded-2xl p-4">
            <SectionLabel>{s.label}</SectionLabel>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="tabular text-3xl font-semibold tracking-tight">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.unit}</span>
            </div>
          </Glass>
        ))}
        <Glass className="flex flex-1 flex-col gap-3 rounded-2xl p-4">
          <SectionLabel>Curve position</SectionLabel>
          <div className="neu-inset rounded-xl p-3"><MiniCurve points={points} marker={Math.min(speed, 20)} className="h-32 w-full" /></div>
        </Glass>
      </div>
    </div>
  );
}
