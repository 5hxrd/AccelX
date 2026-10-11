import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { X_MAX, Y_MAX, clamp, evaluateCurve } from "@/lib/curve";
import { DEFAULT_RANGE, panView, rangeView, spaceSpeed, speedSpace, tickLabel, ticks, zoomView, type GraphView } from "@/lib/graphView";
import { useCurveStore } from "@/store/useCurveStore";
import { Btn, Glass } from "./Controls";
import { GraphRangePopover, type GraphSettings } from "./GraphRangePopover";

const S = 480, L = 30, T = 12, R = 14, B = 40;
const W = L + S + R, H = T + S + B;
const N = 160;

const ZONES = [
  { key: "SLOW", from: 0, to: 3, color: "var(--zone-slow)", text: "Raise the curve here to make slow movements travel further. Lower it for finer control." },
  { key: "MEDIUM", from: 3, to: 10, color: "var(--zone-medium)", text: "Raise it here for snappier everyday movement. Lower it for a calmer, steadier feel." },
  { key: "FAST", from: 10, to: 20, color: "var(--zone-fast)", text: "Raise it here so flicks cover more screen. Lower it to keep big swipes under control." },
];
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const DEFAULT_SETTINGS: GraphSettings = { range: DEFAULT_RANGE, curved: true, autoX: true, autoY: true, stepX: 5, stepY: 1 };
const sameView = (a: GraphView, b: GraphView) => (["xMin", "xMax", "yMin", "yMax"] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

export function CurveEditor() {
  const points = useCurveStore((s) => s.draft.points);
  const morphToken = useCurveStore((s) => s.morphToken);
  const liveSpeed = useCurveStore((s) => s.liveSpeed);
  const canUndo = useCurveStore((s) => s.past.length > 0);
  const canRedo = useCurveStore((s) => s.future.length > 0);
  const { undo, redo, addPoint, movePoint, removePoint, pushHistory } = useCurveStore.getState();

  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [hoverPt, setHoverPt] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [drift, setDrift] = useState(6);
  const [, setFrame] = useState(0);

  // presentation-only viewport
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const bounds = useMemo(() => rangeView(settings.range, settings.curved), [settings.range, settings.curved]);
  const [view, setView] = useState<GraphView>(bounds);
  useEffect(() => setView(bounds), [bounds]);
  const zoomed = !sameView(view, bounds);
  const { curved } = settings;
  const spanX = view.xMax - view.xMin, spanY = view.yMax - view.yMin;
  const sx = (x: number) => L + ((speedSpace(x, curved) - view.xMin) / spanX) * S;
  const sy = (y: number) => T + S - ((y - view.yMin) / spanY) * S;
  const ix = (px: number) => clamp(spaceSpeed(view.xMin + ((px - L) / S) * spanX, curved), 0, X_MAX);
  const iy = (py: number) => clamp(view.yMin + ((T + S - py) / S) * spanY, 0, Y_MAX);
  const inView = (x: number, y: number) => { const a = sx(x), b = sy(y); return a >= L - 0.5 && a <= L + S + 0.5 && b >= T - 0.5 && b <= T + S + 0.5; };

  // morph animation (samples follow the view so the curve stays smooth at any zoom)
  const target = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < N; i++) out.push(clamp(evaluateCurve(points, spaceSpeed(view.xMin + (i / (N - 1)) * spanX, curved)), 0, Y_MAX));
    return out;
  }, [points, view.xMin, spanX, curved]);
  const shown = useRef<number[]>(target);
  const morph = useRef<{ from: number[]; start: number } | null>(null);
  const firstToken = useRef(morphToken);
  useEffect(() => {
    if (morphToken === firstToken.current) return;
    morph.current = { from: shown.current.slice(), start: performance.now() };
    let raf = 0;
    const tick = () => {
      setFrame((f) => f + 1);
      if (morph.current && performance.now() - morph.current.start < 400) raf = requestAnimationFrame(tick);
      else { morph.current = null; setFrame((f) => f + 1); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [morphToken]);
  let ys = target;
  if (morph.current) {
    const k = ease(Math.min(1, (performance.now() - morph.current.start) / 400));
    const from = morph.current.from;
    ys = target.map((y, i) => (from[i] ?? y) + (y - (from[i] ?? y)) * k);
  }
  shown.current = ys;

  // idle drift for live marker
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => { setDrift(6 + 5 * Math.sin((t - t0) / 1400)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const speed = liveSpeed > 0.05 ? Math.min(liveSpeed, X_MAX) : drift;

  // keyboard
  const spaceDown = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") { e.preventDefault(); spaceDown.current = true; }
      else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); setSel(null); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); setSel(null); }
      else if ((e.key === "Delete" || e.key === "Backspace") && sel !== null) { removePoint(sel); setSel(null); }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") spaceDown.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, [sel, undo, redo, removePoint]);

  const toSvg = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };

  // wheel zoom toward cursor
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e) => {
    const p = toSvg(e.clientX, e.clientY);
    const raw = e.deltaY || e.deltaX;
    const dy = raw * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const factor = Math.exp(dy * 0.0015);
    const ax = clamp((p.x - L) / S, 0, 1), ay = clamp((T + S - p.y) / S, 0, 1);
    setView((v) => zoomView(v, bounds, factor, ax, ay, !e.altKey, !e.shiftKey));
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // pan
  const pan = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const pathD = ys.map((y, i) => `${i ? "L" : "M"}${(L + (i / (N - 1)) * S).toFixed(2)},${sy(y).toFixed(2)}`).join("");
  const fillD = `${pathD}L${L + S},${T + S}L${L},${T + S}Z`;
  const markerY = evaluateCurve(points, speed);
  const tipPt = dragging ?? hoverPt;
  const activeZone = ZONES.find((z) => z.key === zone);
  const xTicks = ticks(spaceSpeed(view.xMin, curved), spaceSpeed(view.xMax, curved), settings.autoX ? undefined : settings.stepX);
  const yTicks = ticks(view.yMin, view.yMax, settings.autoY ? undefined : settings.stepY);
  const zoneBox = (z: (typeof ZONES)[number]) => { const a = clamp(sx(z.from), L, L + S), b = clamp(sx(z.to), L, L + S); return { a, b }; };
  const tipVisible = tipPt !== null && points[tipPt] && inView(points[tipPt][0], points[tipPt][1]);

  return (
    <Glass className="flex shrink-0 flex-col self-start p-4 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Acceleration curve</h2>
        <div className="flex gap-1.5">
          {zoomed && <Btn icon aria-label="Reset view" title="Reset view" onClick={() => setView(bounds)}><Maximize2 className="size-4" /></Btn>}
          <GraphRangePopover settings={settings} onChange={setSettings} />
          <Btn icon aria-label="Undo" disabled={!canUndo} onClick={undo} className="disabled:opacity-30"><Undo2 className="size-4" /></Btn>
          <Btn icon aria-label="Redo" disabled={!canRedo} onClick={redo} className="disabled:opacity-30"><Redo2 className="size-4" /></Btn>
        </div>
      </div>

      <div className="relative" style={{ width: W, height: H }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className={panning ? "block cursor-grabbing" : "block"}
          onPointerDown={(e) => {
            if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              pan.current = { x: e.clientX, y: e.clientY };
              setPanning(true);
              return;
            }
            if (e.target === e.currentTarget || (e.target as Element).getAttribute("data-bg")) setSel(null);
          }}
          onPointerMove={(e) => {
            if (!pan.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            const dxPx = ((e.clientX - pan.current.x) / r.width) * W, dyPx = ((e.clientY - pan.current.y) / r.height) * H;
            pan.current = { x: e.clientX, y: e.clientY };
            setView((v) => panView(v, bounds, (-dxPx / S) * (v.xMax - v.xMin), (dyPx / S) * (v.yMax - v.yMin)));
          }}
          onPointerUp={() => { pan.current = null; setPanning(false); }}
          onPointerCancel={() => { pan.current = null; setPanning(false); }}
          onAuxClick={(e) => e.preventDefault()}
          onDoubleClick={(e) => {
            const p = toSvg(e.clientX, e.clientY);
            if (p.x < L || p.x > L + S || p.y < T || p.y > T + S) return;
            const i = addPoint(ix(p.x), iy(p.y));
            if (i >= 0) setSel(i);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <defs>
            <linearGradient id="cv-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cv-stroke" x1={L} x2={L + S} y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--zone-slow)" />
              <stop offset="1" stopColor="var(--primary)" />
            </linearGradient>
            <filter id="cv-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
            <clipPath id="cv-clip"><rect x={L} y={T - 6} width={S} height={S + 6} /></clipPath>
            <clipPath id="cv-clip-pts"><rect x={L - 8} y={T - 8} width={S + 16} height={S + 16} /></clipPath>
          </defs>

          {ZONES.map((z) => {
            const { a, b } = zoneBox(z);
            if (b - a < 1) return null;
            return (
              <g key={z.key} onPointerEnter={() => setZone(z.key)} onPointerLeave={() => setZone((c) => (c === z.key ? null : c))}>
                <rect
                  data-bg="1"
                  x={a} y={T} width={b - a} height={S}
                  fill={z.color}
                  style={{ fillOpacity: zone === z.key ? 0.07 : 0.025, transition: "fill-opacity 250ms" }}
                />
                {b - a > 36 && (
                  <text
                    x={(a + b) / 2} y={T + S - 10} textAnchor="middle"
                    fontSize="9.5" fontWeight="700" letterSpacing="0.1em" fill={z.color}
                    style={{ opacity: zone === z.key ? 0.9 : 0.45, transition: "opacity 250ms", pointerEvents: "none" }}
                  >{z.key}</text>
                )}
              </g>
            );
          })}

          <g pointerEvents="none">
            {xTicks.map((x) => (
              <g key={`x${x}`}>
                <line x1={sx(x)} x2={sx(x)} y1={T} y2={T + S} stroke="var(--border)" />
                <text x={sx(x)} y={T + S + 14} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)" className="tabular">{tickLabel(x)}</text>
              </g>
            ))}
            {yTicks.map((y) => (
              <g key={`y${y}`}>
                <line x1={L} x2={L + S} y1={sy(y)} y2={sy(y)} stroke="var(--border)" />
                <text x={L - 8} y={sy(y) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" className="tabular">{tickLabel(y)}</text>
              </g>
            ))}
            <text x={L} y={T + S + 32} fontSize="10" fill="var(--muted-foreground)">← slow movements</text>
            <text x={L + S} y={T + S + 32} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">fast movements →</text>
            <text transform={`translate(9 ${T + S / 2}) rotate(-90)`} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" opacity="0.8">sensitivity</text>

            {1 >= view.yMin && 1 <= view.yMax && (
              <>
                <line x1={L} x2={L + S} y1={sy(1)} y2={sy(1)} stroke="var(--muted-foreground)" strokeOpacity="0.6" strokeDasharray="4 5" />
                <text x={L + S - 6} y={sy(1) - 6} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">Base sensitivity</text>
              </>
            )}

            <g clipPath="url(#cv-clip)">
              <path d={fillD} fill="url(#cv-fill)" />
              <path d={pathD} fill="none" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="6" filter="url(#cv-blur)" />
              <path d={pathD} fill="none" stroke="url(#cv-stroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {inView(speed, markerY) && (
              <>
                <circle cx={sx(speed)} cy={sy(markerY)} r="12" fill="var(--primary)" fillOpacity="0.15" />
                <circle cx={sx(speed)} cy={sy(markerY)} r="4.5" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 6px var(--primary-glow))" }} />
              </>
            )}
          </g>

          <g clipPath="url(#cv-clip-pts)">
            {points.map((p, i) => inView(p[0], p[1]) && (
              <g
                key={i}
                className={dragging === i ? "cursor-grabbing" : "cursor-grab"}
                onPointerEnter={() => setHoverPt(i)}
                onPointerLeave={() => setHoverPt((c) => (c === i ? null : c))}
                onPointerDown={(e) => {
                  if (e.button === 1 || spaceDown.current) return;
                  e.stopPropagation();
                  if (e.button === 2) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSel(i); setDragging(i); pushHistory();
                }}
                onPointerMove={(e) => {
                  if (dragging !== i) return;
                  const q = toSvg(e.clientX, e.clientY);
                  movePoint(i, ix(q.x), iy(q.y));
                }}
                onPointerUp={() => setDragging(null)}
                onDoubleClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); removePoint(i); setSel(null); }}
              >
                <circle cx={sx(p[0])} cy={sy(p[1])} r="16" fill="transparent" />
                <circle
                  cx={sx(p[0])} cy={sy(p[1])} r="6"
                  fill="var(--glass-strong)" stroke="var(--primary)" strokeWidth={sel === i ? 3 : 2}
                  style={{ filter: "drop-shadow(0 0 6px var(--primary-glow))" }}
                />
                <circle cx={sx(p[0])} cy={sy(p[1])} r="1.6" fill="var(--primary)" />
              </g>
            ))}
          </g>
        </svg>

        <AnimatePresence>
          {tipVisible && tipPt !== null && points[tipPt] && (
            <motion.div
              key="pt"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="glass tabular pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px]"
              style={{ left: sx(points[tipPt][0]), top: sy(points[tipPt][1]) - 38 }}
            >
              <span className="text-muted-foreground">{points[tipPt][0].toFixed(2)} c/ms → </span>
              <span className="font-semibold text-foreground">{points[tipPt][1].toFixed(2)}×</span>
            </motion.div>
          )}
          {activeZone && tipPt === null && !panning && (
            <motion.div
              key={activeZone.key}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass pointer-events-none absolute w-56 rounded-2xl p-3 text-[11px] leading-relaxed"
              style={{ left: clamp((zoneBox(activeZone).a + zoneBox(activeZone).b) / 2 - 112, L + 4, L + S - 228), top: T + 10 }}
            >
              <div className="mb-1 font-semibold tracking-wide text-foreground">{activeZone.key}</div>
              <div className="text-muted-foreground">{activeZone.text}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Glass>
  );
}
