import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { GraphRange } from "@/lib/graphView";
import { Btn, Toggle } from "./Controls";

export interface GraphSettings { range: GraphRange; curved: boolean; autoX: boolean; autoY: boolean; stepX: number; stepY: number }

function RangeNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => { const next = Number(text); if (text.trim() && Number.isFinite(next)) onChange(next); else setText(String(value)); };
  return <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">{label}<input aria-label={label} type="number" step="any" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { commit(); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="neu-inset tabular h-8 w-full rounded-lg px-2 text-xs text-foreground outline-none" /></label>;
}

export function GraphRangePopover({ settings, onChange }: { settings: GraphSettings; onChange: (settings: GraphSettings) => void }) {
  const setBound = (key: keyof GraphRange, value: number) => {
    const range = { ...settings.range, [key]: value };
    if (range.xMin < 0 || range.yMin < 0 || range.xMax <= range.xMin || range.yMax <= range.yMin || range.xMax > 1000000 || range.yMax > 1000000) return;
    onChange({ ...settings, range });
  };
  return <Popover.Root><Popover.Trigger asChild><Btn icon aria-label="Graph range" title="Graph range"><SlidersHorizontal className="size-4" /></Btn></Popover.Trigger><Popover.Portal><Popover.Content side="bottom" align="end" sideOffset={8} aria-label="Graph range" className="glass z-50 w-72 rounded-xl bg-popover p-4 text-foreground" onOpenAutoFocus={(e) => e.preventDefault()}>
    <h3 className="mb-3 text-sm font-semibold">Graph range</h3>
    <div className="grid grid-cols-2 gap-2">
      <RangeNumber label="Min speed" value={settings.range.xMin} onChange={(v) => setBound("xMin", v)} />
      <RangeNumber label="Max speed" value={settings.range.xMax} onChange={(v) => setBound("xMax", v)} />
      <RangeNumber label="Min multiplier" value={settings.range.yMin} onChange={(v) => setBound("yMin", v)} />
      <RangeNumber label="Max multiplier" value={settings.range.yMax} onChange={(v) => setBound("yMax", v)} />
    </div>
    {(["X", "Y"] as const).map((axis) => { const x = axis === "X"; const auto = x ? settings.autoX : settings.autoY; return <div key={axis} className="mt-3 flex items-end gap-3"><div className="min-w-0 flex-1"><RangeNumber label={`${axis} tick step`} value={x ? settings.stepX : settings.stepY} onChange={(v) => { if (v > 0) onChange({ ...settings, [x ? "stepX" : "stepY"]: v }); }} /></div><label className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">Auto<Toggle label={`Auto ${axis} ticks`} checked={auto} onChange={(v) => onChange({ ...settings, [x ? "autoX" : "autoY"]: v })} /></label></div>; })}
    <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">X scale</span><div className="neu-inset flex rounded-lg p-0.5">{[true, false].map((curved) => <Btn key={String(curved)} variant={settings.curved === curved ? "neu" : "ghost"} className="h-7 rounded-md px-3 text-[11px]" aria-pressed={settings.curved === curved} onClick={() => onChange({ ...settings, curved })}>{curved ? "Curved" : "Linear"}</Btn>)}</div></div>
  </Popover.Content></Popover.Portal></Popover.Root>;
}