import { AnimatePresence, motion } from "framer-motion";
import { Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCurveStore } from "@/store/useCurveStore";
import { Btn, Glass } from "./Controls";

export function PresetBar() {
  const presets = useCurveStore((s) => s.customPresets);
  const active = useCurveStore((s) => s.draft.preset);
  const modified = useCurveStore((s) => s.draft.modified);
  const { loadPreset, resetToPreset, saveAsPreset, deletePreset, resetCurve } = useCurveStore.getState();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const save = () => {
    const n = name.trim();
    if (!n) return;
    saveAsPreset(n);
    setName("");
    setNaming(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {presets.length ? (
        <Glass className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {presets.map((p) => {
            const on = active === p.id;
            return (
              <div key={p.id} className="group relative shrink-0">
                <button
                  onClick={() => loadPreset(p.id)}
                  className={cn("relative h-7 rounded-lg px-3 pr-6 text-xs font-medium transition-colors", on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {on && <motion.span layoutId="preset-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-lg bg-primary glow" />}
                  <span className="relative whitespace-nowrap">{on && modified ? `Custom (based on ${p.name})` : p.name}</span>
                </button>
                <button
                  aria-label={`Delete ${p.name}`}
                  onClick={() => deletePreset(p.id)}
                  className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100", on ? "text-primary-foreground" : "text-muted-foreground")}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </Glass>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">Shape your curve, then save it as a preset.</p>
      )}

      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {naming ? (
            <motion.div key="in" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-1 gap-2">
              <input
                autoFocus
                value={name}
                maxLength={24}
                placeholder="Preset name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setNaming(false); }}
                onBlur={() => !name && setNaming(false)}
                className="neu-inset h-9 min-w-0 flex-1 rounded-xl px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Btn variant="primary" onClick={save} disabled={!name.trim()}>Save</Btn>
            </motion.div>
          ) : (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-1">
              <Btn onClick={() => setNaming(true)}><Plus className="size-4" />Save preset</Btn>
              {active && modified && (
                <Btn variant="ghost" icon aria-label="Revert to saved preset" onClick={resetToPreset}><RotateCcw className="size-3.5" /></Btn>
              )}
              <Btn variant="ghost" className="ml-auto px-3 text-xs" onClick={resetCurve}>Reset curve</Btn>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
