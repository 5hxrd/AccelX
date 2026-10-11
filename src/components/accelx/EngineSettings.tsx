import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getEngineStatus,
  installDriver,
  isNative,
  uninstallDriver,
  type EngineStatus,
} from "@/lib/native";
import { Btn } from "./Controls";
import { SettingsRow } from "./SettingsRow";

function describe(st: EngineStatus | null, native: boolean): string {
  if (!native) return "Available in the desktop app.";
  if (!st) return "Checking…";
  if (st.needsRestart) return "Driver installed. Restart Windows once to activate it.";
  if (!st.driverInstalled) return "AccelX includes the mouse driver. Install it once (Windows will ask for permission), then restart.";
  if (!st.driverActive) return "Driver installed but not loaded yet. Restart Windows once (a full restart, not shut down).";
  if (st.lastError) return st.lastError;
  if (st.lastAppliedAt) return `Active · last applied ${new Date(st.lastAppliedAt * 1000).toLocaleTimeString()}`;
  return `Driver installed (Raw Accel ${st.version}). Press Apply on the Curve tab.`;
}

export function EngineSettings() {
  const native = isNative();
  const [st, setSt] = useState<EngineStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getEngineStatus().then(setSt).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 4000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const run = async (fn: () => Promise<EngineStatus | null>, done: string) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) {
        setSt(next);
        if (!next.lastError) toast.success(done);
        else toast.error(next.lastError);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const installed = !!st?.driverInstalled;

  return (
    <>
      <SettingsRow title="Mouse driver" hint={describe(st, native)}>
        <div className="flex items-center gap-2">
          {installed && (
            <Btn variant="danger" disabled={!native || busy} onClick={() => run(uninstallDriver, "Driver removed. Restart Windows to finish.")}>
              Uninstall
            </Btn>
          )}
          <Btn
            variant={installed ? "neu" : "primary"}
            disabled={!native || busy}
            onClick={() => run(installDriver, "Driver installed. Restart Windows to activate it.")}
          >
            {busy ? "Working…" : installed ? "Reinstall" : "Install driver"}
          </Btn>
        </div>
      </SettingsRow>
    </>
  );
}
