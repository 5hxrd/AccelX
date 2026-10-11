import { AnimatePresence, motion } from "framer-motion";
import { Activity, Layers, Minus, Settings2, Spline, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { closeWindow, isNative, minimizeWindow, setEngineEnabled, setRunInBackground, setStartMinimized, setTrayIcon } from "@/lib/native";
import { useCurveStore } from "@/store/useCurveStore";
import { Glass, Toggle } from "./Controls";
import { CurveTab } from "./tabs/CurveTab";
import { LiveTestTab } from "./tabs/LiveTestTab";
import { ProfilesTab } from "./tabs/ProfilesTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { ActivationScreen } from "./ActivationScreen";

const WIN_W = 1100, WIN_H = 720;

/** Drop a logo in here later. */
export function LogoSlot() { return null; }

function TitleBar() {
  return (
    <div data-tauri-drag-region className="flex h-10 shrink-0 items-center justify-end gap-1 border-b border-border/60 bg-glass px-2 backdrop-blur-xl">
      <button aria-label="Minimize" onClick={minimizeWindow} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Minus className="size-3.5" />
      </button>
      <button aria-label="Close" onClick={closeWindow} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

const TABS = [
  { id: "curve", label: "Curve", icon: Spline },
  { id: "profiles", label: "Profiles", icon: Layers },
  { id: "live", label: "Live Test", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Sidebar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  const profileName = useCurveStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.name ?? "");
  const engine = useCurveStore((s) => s.engineEnabled);
  const setEngine = useCurveStore((s) => s.setEngine);
  return (
    <Glass className="flex w-[184px] shrink-0 flex-col p-3">
      <div className="flex items-center gap-2 px-2 pb-5 pt-1">
        <LogoSlot />
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">AccelX</div>
          <div className="truncate text-[10px] text-muted-foreground">{profileName}</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("relative flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {on && <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} className="neu absolute inset-0 rounded-xl" />}
              <Icon className="relative size-4" />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="neu-inset mt-auto flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-1 text-[11px]">
        <span className="relative flex size-1.5">
          {engine && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />}
          <span className={cn("relative size-1.5 rounded-full", engine ? "bg-primary" : "bg-muted-foreground/50")} />
        </span>
        <span className={cn("flex-1 whitespace-nowrap", !engine && "text-muted-foreground")}>{engine ? "Engine running" : "Engine paused"}</span>
        <Toggle label="Engine" checked={engine} onChange={setEngine} />
      </div>
    </Glass>
  );
}

export function WindowFrame({ native = false }: { native?: boolean }) {
  const [tab, setTab] = useState<TabId>("curve");
  const [scale, setScale] = useState(1);
  const license = useCurveStore((s) => s.license);
  const loadLicense = useCurveStore((s) => s.loadLicense);
  useEffect(() => { void loadLicense(); }, [loadLicense]);
  const licensed = license.state === "active";

  useEffect(() => {
    Promise.resolve(useCurveStore.persist.rehydrate()).then(() => {
      if (!isNative()) return;
      // Push saved UI settings to the desktop shell once on startup.
      const st = useCurveStore.getState();
      void setRunInBackground(st.settings.runInBackground);
      void setStartMinimized(st.settings.startMinimized);
      void setTrayIcon(st.settings.trayIcon);
      void setEngineEnabled(st.engineEnabled);
    });
    if (native) return undefined;
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / WIN_W, (window.innerHeight - 24) / WIN_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [native]);

  const Content = { curve: CurveTab, profiles: ProfilesTab, live: LiveTestTab, settings: SettingsTab }[tab];

  const inner = (
    <>
    <TitleBar />
    <AnimatePresence mode="wait">
    {license.loading ? (
      <motion.div key="loading" exit={{ opacity: 0 }} className="grid min-h-0 flex-1 place-items-center">
        <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </motion.div>
    ) : !licensed ? (
      <ActivationScreen key="activate" />
    ) : (
    <motion.div
      key="app"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="flex min-h-0 flex-1 gap-3 p-3"
    >
      <Sidebar tab={tab} setTab={setTab} />
      <main className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="h-full"
          >
            <Content />
          </motion.div>
        </AnimatePresence>
      </main>
    </motion.div>
    )}
    </AnimatePresence>
    </>
  );
  const toaster = <Toaster theme="dark" position="bottom-center" toastOptions={{ className: "!bg-popover !border-border !text-foreground !backdrop-blur-xl" }} />;

  if (native) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-background">
        <div className="blob-a pointer-events-none absolute -left-[20%] -top-[30%] size-[70%] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/8%),transparent_65%)] blur-3xl" />
        <div className="blob-b pointer-events-none absolute -bottom-[30%] -right-[20%] size-[70%] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/5%),transparent_65%)] blur-3xl" />
        <div className="relative z-10 flex h-full flex-col">{inner}</div>
        {toaster}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-page">
      <div className="blob-a pointer-events-none absolute -left-[20vw] -top-[25vw] size-[70vw] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/8%),transparent_65%)] blur-3xl" />
      <div className="blob-b pointer-events-none absolute -bottom-[25vw] -right-[20vw] size-[70vw] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/5%),transparent_65%)] blur-3xl" />
      <div style={{ width: WIN_W * scale, height: WIN_H * scale }} className="relative">
        <div style={{ width: WIN_W, height: WIN_H, transform: `scale(${scale})` }} className="absolute left-0 top-0 flex origin-top-left flex-col overflow-hidden rounded-[20px] border border-border bg-background shadow-window">
          {inner}
        </div>
      </div>
      {toaster}
    </div>
  );
}
