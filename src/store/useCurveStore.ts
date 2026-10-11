import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_POINTS, X_MAX, Y_MAX, clamp, type CurvePoint, type EngineParams } from "@/lib/curve";
import { getLicenseStatus, type LicenseStatus } from "@/lib/native";
import { applyCurve, setAutostart, setEngineEnabled, setRunInBackground, setStartMinimized, setTrayIcon } from "@/lib/native";

export interface Profile { id: string; name: string; points: CurvePoint[]; params: EngineParams; bindExe: string }
export interface Preset { id: string; name: string; points: CurvePoint[] }
export interface Settings {
  runInBackground: boolean; autostart: boolean; startMinimized: boolean; trayIcon: boolean;
  dpi: number; pollingRate: number;
}
interface Draft { points: CurvePoint[]; preset: string | null; modified: boolean; params: EngineParams }

export const DEFAULT_POINTS: CurvePoint[] = [[0, 0.8], [4, 1.0], [10, 1.6], [20, 2.2]];
const DEFAULT_PARAMS: EngineParams = { baseSens: 1, yRatio: 1 };
const clonePts = (p: CurvePoint[]) => p.map((q) => [q[0], q[1]] as CurvePoint);
const newId = (pre: string) => `${pre}_${Date.now().toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`;

interface State {
  profiles: Profile[];
  activeProfileId: string;
  draft: Draft;
  customPresets: Preset[];
  settings: Settings;
  engineEnabled: boolean;
  past: CurvePoint[][];
  future: CurvePoint[][];
  liveSpeed: number;
  license: LicenseStatus & { loading: boolean };
  loadLicense: () => Promise<void>;
  setLicense: (l: LicenseStatus) => void;
  morphToken: number;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadPreset: (id: string) => void;
  resetToPreset: () => void;
  saveAsPreset: (name: string) => void;
  deletePreset: (id: string) => void;
  resetCurve: () => void;
  setParam: (k: keyof EngineParams, v: number) => void;
  addPoint: (x: number, y: number) => number;
  movePoint: (i: number, x: number, y: number) => void;
  removePoint: (i: number) => void;
  apply: () => void;
  revert: () => void;
  addProfile: () => void;
  renameProfile: (id: string, name: string) => void;
  duplicateProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  setBindExe: (id: string, exe: string) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  setEngine: (on: boolean) => void;
  setLiveSpeed: (v: number) => void;
}

const edited = (s: State, points: CurvePoint[]) => ({
  draft: { ...s.draft, points, modified: s.draft.preset ? true : s.draft.modified },
});

export const useCurveStore = create<State>()(
  persist(
    (set, get) => ({
      profiles: [{ id: "default", name: "Default", points: clonePts(DEFAULT_POINTS), params: { ...DEFAULT_PARAMS }, bindExe: "" }],
      activeProfileId: "default",
      draft: { points: clonePts(DEFAULT_POINTS), preset: null, modified: false, params: { ...DEFAULT_PARAMS } },
      customPresets: [],
      settings: { runInBackground: true, autostart: false, startMinimized: false, trayIcon: true, dpi: 800, pollingRate: 1000 },
      engineEnabled: true,
      past: [],
      future: [],
      liveSpeed: 0,
      license: { state: "unlicensed", expiresAt: null, loading: true },
      loadLicense: async () => {
        try { const l = await getLicenseStatus(); set({ license: { ...l, loading: false } }); }
        catch { set({ license: { state: "unlicensed", expiresAt: null, loading: false } }); }
      },
      setLicense: (l) => set({ license: { ...l, loading: false } }),
      morphToken: 0,

      pushHistory: () => set((s) => ({ past: [...s.past.slice(-49), clonePts(s.draft.points)], future: [] })),
      undo: () => {
        const s = get();
        if (!s.past.length) return;
        const prev = s.past[s.past.length - 1]!;
        set({ past: s.past.slice(0, -1), future: [clonePts(s.draft.points), ...s.future], ...edited(s, prev) });
      },
      redo: () => {
        const s = get();
        if (!s.future.length) return;
        const [next, ...rest] = s.future as [CurvePoint[], ...CurvePoint[][]];
        set({ future: rest, past: [...s.past, clonePts(s.draft.points)], ...edited(s, next) });
      },
      loadPreset: (id) => {
        const p = get().customPresets.find((x) => x.id === id);
        if (!p) return;
        get().pushHistory();
        set((s) => ({ draft: { ...s.draft, points: clonePts(p.points), preset: id, modified: false }, morphToken: s.morphToken + 1 }));
      },
      resetToPreset: () => get().draft.preset && get().loadPreset(get().draft.preset!),
      saveAsPreset: (name) => {
        const id = newId("pre");
        set((s) => ({
          customPresets: [...s.customPresets, { id, name, points: clonePts(s.draft.points) }],
          draft: { ...s.draft, preset: id, modified: false },
        }));
      },
      deletePreset: (id) =>
        set((s) => ({
          customPresets: s.customPresets.filter((p) => p.id !== id),
          draft: s.draft.preset === id ? { ...s.draft, preset: null, modified: false } : s.draft,
        })),
      resetCurve: () => {
        get().pushHistory();
        set((s) => ({ draft: { ...s.draft, points: [[0, 1], [X_MAX, 1]], preset: null, modified: false }, morphToken: s.morphToken + 1 }));
      },
      setParam: (k, v) => set((s) => ({ draft: { ...s.draft, params: { ...s.draft.params, [k]: v } } })),
      addPoint: (x, y) => {
        const s = get();
        if (s.draft.points.length >= MAX_POINTS) return -1;
        s.pushHistory();
        const pts = clonePts(get().draft.points);
        const pt: CurvePoint = [clamp(x, 0, X_MAX), clamp(y, 0, Y_MAX)];
        let idx = pts.findIndex((p) => p[0] > pt[0]);
        if (idx === -1) idx = pts.length;
        pts.splice(idx, 0, pt);
        set(edited(get(), pts));
        return idx;
      },
      movePoint: (i, x, y) => {
        const s = get();
        const pts = clonePts(s.draft.points);
        const lo = i > 0 ? pts[i - 1]![0] + 0.05 : 0;
        const hi = i < pts.length - 1 ? pts[i + 1]![0] - 0.05 : X_MAX;
        pts[i] = [clamp(x, lo, hi), clamp(y, 0, Y_MAX)];
        set(edited(s, pts));
      },
      removePoint: (i) => {
        const s = get();
        if (s.draft.points.length <= 2) return;
        s.pushHistory();
        set(edited(get(), get().draft.points.filter((_, j) => j !== i)));
      },
      apply: () => {
        const s = get();
        applyCurve(s.draft.points, s.draft.params);
        set({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId ? { ...p, points: clonePts(s.draft.points), params: { ...s.draft.params } } : p,
          ),
        });
      },
      revert: () => {
        const s = get();
        const p = s.profiles.find((x) => x.id === s.activeProfileId)!;
        s.pushHistory();
        set((st) => ({ draft: { points: clonePts(p.points), params: { ...p.params }, preset: null, modified: false }, morphToken: st.morphToken + 1 }));
      },
      addProfile: () =>
        set((s) => ({
          profiles: [...s.profiles, { id: newId("pro"), name: `Profile ${s.profiles.length + 1}`, points: clonePts(DEFAULT_POINTS), params: { ...DEFAULT_PARAMS }, bindExe: "" }],
        })),
      renameProfile: (id, name) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)) })),
      duplicateProfile: (id) =>
        set((s) => {
          const src = s.profiles.find((p) => p.id === id);
          if (!src) return {};
          const i = s.profiles.indexOf(src);
          const copy = { ...src, id: newId("pro"), name: `${src.name} copy`, points: clonePts(src.points), params: { ...src.params } };
          const profiles = [...s.profiles];
          profiles.splice(i + 1, 0, copy);
          return { profiles };
        }),
      deleteProfile: (id) => {
        const s = get();
        if (s.profiles.length <= 1) return;
        const profiles = s.profiles.filter((p) => p.id !== id);
        set({ profiles });
        if (s.activeProfileId === id) get().setActiveProfile(profiles[0]!.id);
      },
      setActiveProfile: (id) => {
        const p = get().profiles.find((x) => x.id === id);
        if (!p) return;
        set((s) => ({
          activeProfileId: id,
          draft: { points: clonePts(p.points), params: { ...p.params }, preset: null, modified: false },
          past: [], future: [], morphToken: s.morphToken + 1,
        }));
        applyCurve(p.points, p.params);
      },
      setBindExe: (id, exe) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, bindExe: exe } : p)) })),
      setSetting: (k, v) => {
        if (k === "autostart") setAutostart(v as boolean);
        if (k === "runInBackground") setRunInBackground(v as boolean);
        if (k === "startMinimized") setStartMinimized(v as boolean);
        if (k === "trayIcon") setTrayIcon(v as boolean);
        set((s) => ({ settings: { ...s.settings, [k]: v } }));
      },
      setEngine: (on) => { set({ engineEnabled: on }); setEngineEnabled(on); },
      setLiveSpeed: (v) => set({ liveSpeed: v }),
    }),
    {
      name: "accelx",
      skipHydration: true,
      partialize: (s) => ({
        profiles: s.profiles, activeProfileId: s.activeProfileId, draft: s.draft,
        customPresets: s.customPresets, settings: s.settings, engineEnabled: s.engineEnabled,
      }),
    },
  ),
);

export function useIsDirty() {
  return useCurveStore((s) => {
    const p = s.profiles.find((x) => x.id === s.activeProfileId);
    if (!p) return false;
    return JSON.stringify([p.points, p.params]) !== JSON.stringify([s.draft.points, s.draft.params]);
  });
}
