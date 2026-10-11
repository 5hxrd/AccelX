import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { removeLicense } from "@/lib/native";
import { useCurveStore } from "@/store/useCurveStore";
import { Btn } from "./Controls";
import { SettingsRow } from "./SettingsRow";

export function LicenseRow() {
  const license = useCurveStore((s) => s.license);
  const setLicense = useCurveStore((s) => s.setLicense);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const hint = license.expiresAt
    ? `Active · Expires in ${Math.max(0, Math.ceil((license.expiresAt - Date.now()) / 86_400_000))} days`
    : "Active · Lifetime";

  const remove = async () => {
    setBusy(true);
    await removeLicense();
    setLicense({ state: "unlicensed", expiresAt: null });
  };

  return (
    <SettingsRow title="License" hint={hint}>
      <AnimatePresence mode="wait" initial={false}>
        {confirm ? (
          <motion.div key="c" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Are you sure?</span>
            <Btn variant="danger" className="h-8 px-3" onClick={remove} disabled={busy}>Yes</Btn>
            <Btn variant="ghost" className="h-8 px-3" onClick={() => setConfirm(false)} disabled={busy}>Cancel</Btn>
          </motion.div>
        ) : (
          <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Btn variant="ghost" onClick={() => setConfirm(true)}>Remove license</Btn>
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsRow>
  );
}
