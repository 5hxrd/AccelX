import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/curve";

export function Glass({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl", className)} {...p} />;
}

const btnVariants = {
  primary: "bg-primary text-primary-foreground glow font-semibold hover:brightness-110",
  neu: "neu text-foreground hover:text-primary active:neu-inset",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  danger: "neu text-destructive hover:bg-destructive/15",
};
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btnVariants; icon?: boolean };
export function Btn({ variant = "neu", icon, className, ...p }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        icon ? "size-8 p-0" : "h-9 px-4",
        btnVariants[variant],
        className,
      )}
      {...p}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("neu-inset relative flex h-6 w-11 shrink-0 items-center rounded-full px-1 transition-colors", checked && "bg-primary/30")}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className={cn("size-4 rounded-full", checked ? "ml-auto bg-primary glow" : "neu")}
      />
    </button>
  );
}

interface SliderProps { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }
export function Slider({ value, min, max, step, onChange, label }: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const pct = (clamp(value, min, max) - min) / (max - min);
  const snap = (v: number) => clamp(Math.round(v / step) * step, min, max);
  const fromX = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(snap(min + clamp((x - r.left) / r.width, 0, 1) * (max - min)));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className="group relative flex h-6 flex-1 cursor-pointer items-center rounded-full"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); fromX(e.clientX); }}
      onPointerMove={(e) => drag && fromX(e.clientX)}
      onPointerUp={() => setDrag(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(snap(value + step)); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(snap(value - step)); }
      }}
    >
      <div className="neu-inset relative h-1.5 w-full overflow-hidden rounded-full">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/40 to-primary" style={{ width: `${pct * 100}%` }} />
      </div>
      <motion.div
        animate={{ scale: drag ? 1.1 : 1 }}
        className="neu absolute top-1/2 size-4 -translate-y-1/2 rounded-full ring-2 ring-primary/70 transition-shadow group-hover:glow"
        style={{ left: `calc(${pct * 100}% - 8px)` }}
      />
    </div>
  );
}

interface NumProps { value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string; className?: string; label: string }
export function NumInput({ value, min, max, step, onChange, suffix, className, label }: NumProps) {
  const dec = step < 1 ? 2 : 0;
  const [text, setText] = useState(value.toFixed(dec));
  useEffect(() => setText(value.toFixed(dec)), [value, dec]);
  const commit = () => {
    const n = parseFloat(text);
    if (isNaN(n)) return setText(value.toFixed(dec));
    onChange(clamp(Math.round(n / step) * step, min, max));
  };
  return (
    <label className={cn("neu-inset flex h-8 items-center gap-1 rounded-lg px-2", className)}>
      <input
        aria-label={label}
        type="number"
        value={text}
        step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="tabular w-full min-w-0 bg-transparent text-right text-xs outline-none"
      />
      {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
    </label>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground", className)}>{children}</div>;
}
