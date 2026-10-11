import { toast } from "sonner";
import { X_MAX, X_POW, Y_MAX, clamp, evaluateCurve, type CurvePoint, type EngineParams } from "./curve";

export interface EngineStatus {
  driverInstalled: boolean;
  driverActive: boolean;
  needsRestart: boolean;
  lastError: string | null;
  lastAppliedAt: number | null;
  version: string;
}

export const isNative = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const browserNote = (what: string) => toast(`${what} connects to the desktop app`);

/**
 * Samples the exact curve shown in the editor into lookup-table points for the driver.
 * Dense at low speed (same power scale as the graph), plus a flat tail so any speed above
 * the graph keeps the last multiplier.
 */
export function buildLut(points: CurvePoint[]): [number, number][] {
  const N = 64;
  const out: [number, number][] = [];
  for (let i = 1; i <= N; i++) {
    const x = +(X_MAX * Math.pow(i / N, 1 / X_POW)).toFixed(4);
    const y = +clamp(evaluateCurve(points, x), 0.01, Y_MAX).toFixed(5);
    out.push([x, y]);
  }
  out.push([1000, out[out.length - 1]![1]]);
  return out;
}

export async function applyCurve(points: CurvePoint[], params: EngineParams) {
  if (!isNative()) { console.log("[native] applyCurve", points, params); return; }
  try {
    await call("apply_curve", { lut: buildLut(points), baseSens: params.baseSens, yRatio: params.yRatio });
    toast.success("Curve applied");
  } catch (e) {
    toast.error(String(e));
  }
}

export async function setEngineEnabled(on: boolean) {
  if (!isNative()) return;
  try { await call("set_engine_enabled", { enabled: on }); }
  catch (e) { toast.error(String(e)); }
}

export async function minimizeWindow() {
  if (!isNative()) { browserNote("Window controls"); return; }
  await call("minimize_window");
}
export async function closeWindow() {
  if (!isNative()) { browserNote("Window controls"); return; }
  await call("close_window");
}
export async function quitApp() {
  if (!isNative()) { browserNote("Quit"); return; }
  await call("quit_app");
}
export async function setAutostart(on: boolean) {
  if (!isNative()) return;
  try { await call("set_autostart", { enabled: on }); } catch (e) { toast.error(String(e)); }
}
export async function setRunInBackground(on: boolean) {
  if (isNative()) await call("set_flag", { name: "run_in_background", value: on }).catch(() => {});
}
export async function setStartMinimized(on: boolean) {
  if (isNative()) await call("set_flag", { name: "start_minimized", value: on }).catch(() => {});
}
export async function setTrayIcon(on: boolean) {
  if (isNative()) await call("set_flag", { name: "tray_icon", value: on }).catch(() => {});
}

export async function getEngineStatus(): Promise<EngineStatus | null> {
  if (!isNative()) return null;
  return call<EngineStatus>("get_engine_status");
}
export async function installDriver(): Promise<EngineStatus | null> {
  if (!isNative()) return null;
  return call<EngineStatus>("install_driver");
}
export async function uninstallDriver(): Promise<EngineStatus | null> {
  if (!isNative()) return null;
  return call<EngineStatus>("uninstall_driver");
}

// ---------- License (mocked in browser; native app is source of truth) ----------
export type LicenseState = "unlicensed" | "active" | "expired";
export interface LicenseStatus { state: LicenseState; expiresAt: number | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let mockLicense: LicenseStatus = { state: "unlicensed", expiresAt: null };

export async function getPcId(): Promise<string> {
  if (isNative()) return call<string>("get_pc_id");
  return "A1B2-C3D4-E5F6";
}
export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (isNative()) return call<LicenseStatus>("get_license_status");
  await wait(400);
  return { ...mockLicense };
}
export async function activateLicense(key: string): Promise<{ ok: boolean; error?: string; expiresAt?: number | null }> {
  if (isNative()) return call("activate_license", { key });
  await wait(900);
  if (key.trim().toUpperCase() === "DEMO") {
    mockLicense = { state: "active", expiresAt: null };
    return { ok: true, expiresAt: null };
  }
  return { ok: false, error: "That key isn't valid for this PC." };
}
export async function removeLicense(): Promise<void> {
  if (isNative()) return call("remove_license");
  await wait(200);
  mockLicense = { state: "unlicensed", expiresAt: null };
}
