import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { activateLicense, getPcId } from "@/lib/native";
import { useCurveStore } from "@/store/useCurveStore";
import { Btn, Glass } from "./Controls";

const spring = { type: "spring", stiffness: 320, damping: 30 } as const;

export function ActivationScreen() {
  const setLicense = useCurveStore((s) => s.setLicense);
  const expired = useCurveStore((s) => s.license.state === "expired");
  const [pcId, setPcId] = useState("");
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "This key has expired." : null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { void getPcId().then(setPcId); }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(pcId); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || checking) return;
    setChecking(true); setError(null);
    let res: Awaited<ReturnType<typeof activateLicense>>;
    try { res = await activateLicense(key.trim()); }
    catch (err) { res = { ok: false, error: String(err) }; }
    setChecking(false);
    if (!res.ok) { setError(res.error ?? "That key isn't valid for this PC."); return; }
    setSuccess(true);
    setTimeout(() => setLicense({ state: "active", expiresAt: res.expiresAt ?? null }), 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={spring}
      className="grid min-h-0 flex-1 place-items-center p-6"
    >
      <Glass className="w-[420px] p-7">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="flex flex-col items-center gap-4 py-10">
              <div className="glow grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-7" strokeWidth={2.5} />
              </div>
              <div className="text-lg font-semibold tracking-tight">AccelX activated</div>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} exit={{ opacity: 0, scale: 0.97 }} className="flex flex-col gap-5">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Activate AccelX</h1>
                <p className="mt-1 text-xs text-muted-foreground">Send your PC ID to the seller. You'll get a key back.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Your PC ID</span>
                <div className="neu-inset flex h-11 items-center justify-between rounded-xl pl-4 pr-1.5">
                  <span className="tabular font-mono text-sm tracking-[0.18em]">{pcId || "…"}</span>
                  <div className="flex items-center gap-2">
                    <AnimatePresence>
                      {copied && (
                        <motion.span initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-[11px] text-muted-foreground">Copied</motion.span>
                      )}
                    </AnimatePresence>
                    <Btn type="button" variant="neu" icon onClick={copy} aria-label="Copy PC ID" disabled={!pcId}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Btn>
                  </div>
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">License key</span>
                <input
                  value={key}
                  onChange={(e) => { setKey(e.target.value.toUpperCase()); setError(null); }}
                  placeholder="Paste your license key here"
                  spellCheck={false}
                  autoComplete="off"
                  className="neu-inset tabular h-11 rounded-xl bg-transparent px-4 font-mono text-xs uppercase tracking-[0.04em] outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
                />
              </label>

              <div className="flex flex-col gap-2">
                <Btn type="submit" variant="primary" className="h-11 w-full" disabled={!key.trim() || checking}>
                  {checking && <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />}
                  {checking ? "Checking…" : "Activate"}
                </Btn>
                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-xs text-destructive/80">{error}</motion.p>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-center text-[11px] text-muted-foreground">Need a key? Contact the seller on Discord.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </Glass>
    </motion.div>
  );
}
