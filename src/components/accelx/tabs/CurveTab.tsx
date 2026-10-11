import { AnimatePresence, motion } from "framer-motion";
import { useCurveStore, useIsDirty } from "@/store/useCurveStore";
import { Btn } from "../Controls";
import { CurveEditor } from "../CurveEditor";
import { ParamPanel } from "../ParamPanel";
import { PresetBar } from "../PresetBar";
import { ZoneLegend } from "../ZoneLegend";

export function CurveTab() {
  const dirty = useIsDirty();
  const { apply, revert } = useCurveStore.getState();
  return (
    <div className="flex h-full gap-3">
      <CurveEditor />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <PresetBar />
        <ParamPanel />
        <ZoneLegend />
        <div className="mt-auto flex items-center gap-2">
          <AnimatePresence>
            {dirty && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="flex items-center gap-2 text-xs">
                <span className="size-1.5 rounded-full bg-primary glow" />Unsaved changes
              </motion.div>
            )}
          </AnimatePresence>
          <div className="ml-auto flex gap-2">
            <Btn disabled={!dirty} onClick={revert}>Revert</Btn>
            <Btn variant="primary" className="px-6" disabled={!dirty} onClick={apply}>Apply</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
