import { useCurveStore } from "@/store/useCurveStore";
import { Glass, NumInput, Slider } from "./Controls";

const ROWS = [
  { key: "baseSens", label: "Sensitivity", min: 0.1, max: 5 },
  { key: "yRatio", label: "Vertical ratio", min: 0.25, max: 2 },
] as const;

export function ParamPanel() {
  const params = useCurveStore((s) => s.draft.params);
  const setParam = useCurveStore((s) => s.setParam);
  return (
    <Glass className="flex flex-col gap-4 rounded-2xl p-4">
      <h3 className="text-sm font-semibold">Sensitivity</h3>
      {ROWS.map((r) => (
        <div key={r.key} className="flex flex-col gap-2">
          <span className="text-xs font-medium">{r.label}</span>
          <div className="flex items-center gap-3">
            <Slider label={r.label} value={params[r.key]} min={r.min} max={r.max} step={0.05} onChange={(v) => setParam(r.key, v)} />
            <NumInput label={r.label} className="w-[68px]" value={params[r.key]} min={r.min} max={r.max} step={0.05} suffix="×" onChange={(v) => setParam(r.key, v)} />
          </div>
        </div>
      ))}
    </Glass>
  );
}
