import { ChevronDown, Power } from "lucide-react";
import type { ReactNode } from "react";
import { quitApp } from "@/lib/native";
import { useCurveStore, type Settings } from "@/store/useCurveStore";
import { Btn, Glass, NumInput, SectionLabel, Toggle } from "../Controls";
import { SettingsRow } from "../SettingsRow";
import { EngineSettings } from "../EngineSettings";
import { LicenseRow } from "../LicenseRow";

const GENERAL: { key: keyof Settings; title: string; hint: string }[] = [
  { key: "runInBackground", title: "Run in background when window is closed", hint: "Keeps your curve active after closing." },
  { key: "autostart", title: "Start with Windows", hint: "Launch AccelX when you sign in." },
  { key: "startMinimized", title: "Start minimized to tray", hint: "Open quietly without showing the window." },
  { key: "trayIcon", title: "Show tray icon", hint: "Quick access from the system tray." },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel className="px-1">{label}</SectionLabel>
      <Glass className="flex flex-col divide-y divide-border rounded-2xl px-4">{children}</Glass>
    </section>
  );
}

export function SettingsTab() {
  const s = useCurveStore((st) => st.settings);
  const setSetting = useCurveStore((st) => st.setSetting);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-2 pb-6 pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <Group label="Engine">
          <EngineSettings />
        </Group>
        <Group label="General">
          {GENERAL.map((g) => (
            <SettingsRow key={g.key} title={g.title} hint={g.hint}>
              <Toggle label={g.title} checked={s[g.key] as boolean} onChange={(v) => setSetting(g.key, v)} />
            </SettingsRow>
          ))}
        </Group>
        <Group label="Mouse">
          <SettingsRow title="Mouse DPI" hint="Match your mouse's hardware setting.">
            <NumInput label="Mouse DPI" className="w-24" value={s.dpi} min={100} max={32000} step={50} onChange={(v) => setSetting("dpi", v)} />
          </SettingsRow>
          <SettingsRow title="Polling rate" hint="How often your mouse reports movement.">
            <div className="neu-inset relative h-8 rounded-lg">
              <select
                aria-label="Polling rate"
                value={s.pollingRate}
                onChange={(e) => setSetting("pollingRate", Number(e.target.value))}
                className="tabular h-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 text-xs outline-none [&>option]:bg-background"
              >
                {[125, 500, 1000, 2000, 4000, 8000].map((r) => <option key={r} value={r}>{r} Hz</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </SettingsRow>
        </Group>
        <Group label="App">
          <LicenseRow />
          <SettingsRow title="About AccelX" hint="Version 0.1.0 · Driver: Raw Accel 1.7.1 (MIT license, © a1xd)">
            <span className="tabular text-xs text-muted-foreground">v0.1.0</span>
          </SettingsRow>
          <SettingsRow title="Quit completely" hint="Stops the engine and closes the app.">
            <Btn variant="danger" onClick={quitApp}><Power className="size-4" />Quit</Btn>
          </SettingsRow>
        </Group>
      </div>
    </div>
  );
}
