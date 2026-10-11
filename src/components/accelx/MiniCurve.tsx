import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Y_MAX, computeMultiplier, sampleCurve, xToT, type CurvePoint } from "@/lib/curve";

export function MiniCurve({ points, marker, className }: { points: CurvePoint[]; marker?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const W = 200, H = 100;
  const d = useMemo(() => {
    const ys = sampleCurve(points, 80);
    return ys.map((y, i) => `${i ? "L" : "M"}${((i / (ys.length - 1)) * W).toFixed(1)},${(H - (y / Y_MAX) * H).toFixed(1)}`).join("");
  }, [points]);
  const base = H - H / Y_MAX;
  const mk = marker !== undefined
    ? { x: xToT(marker) * 100, y: 100 - (Math.min(computeMultiplier(points, marker, { baseSens: 1, yRatio: 1 }), Y_MAX) / Y_MAX) * 100 }
    : null;
  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#f${id})`} />
        <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {mk && (
        <div
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary glow"
          style={{ left: `${mk.x}%`, top: `${mk.y}%` }}
        />
      )}
    </div>
  );
}
