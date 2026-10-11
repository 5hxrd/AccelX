import { Glass } from "./Controls";

const LINES = [
  ["Left", "= slow movements"],
  ["Right", "= fast movements"],
  ["Height", "= how much your speed is multiplied (1× = unchanged)"],
];

export function ZoneLegend() {
  return (
    <Glass className="flex flex-col gap-1.5 rounded-2xl p-4 text-xs leading-snug">
      {LINES.map(([b, t]) => (
        <p key={b}><span className="font-semibold text-foreground">{b}</span> <span className="text-muted-foreground">{t}</span></p>
      ))}
    </Glass>
  );
}
