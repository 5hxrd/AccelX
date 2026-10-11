import { motion } from "framer-motion";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCurveStore, type Profile } from "@/store/useCurveStore";
import { Btn, Glass } from "./Controls";
import { MiniCurve } from "./MiniCurve";

export function ProfileCard({ profile, active, canDelete }: { profile: Profile; active: boolean; canDelete: boolean }) {
  const { renameProfile, duplicateProfile, deleteProfile, setActiveProfile, setBindExe } = useCurveStore.getState();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const commit = () => { renameProfile(profile.id, name.trim() || profile.name); setEditing(false); };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
      <Glass className={cn("flex flex-col gap-3 rounded-2xl p-4", active && "ring-1 ring-primary/50")}>
        <div className="flex h-7 items-center gap-2">
          {editing ? (
            <input
              autoFocus value={name} maxLength={28}
              onChange={(e) => setName(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              className="neu-inset h-7 min-w-0 flex-1 rounded-lg px-2 text-sm font-semibold outline-none"
            />
          ) : (
            <span className="truncate text-sm font-semibold">{profile.name}</span>
          )}
          {active && !editing && <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium">Active</span>}
        </div>
        <div className="neu-inset rounded-xl p-3"><MiniCurve points={profile.points} className="h-20 w-full" /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] font-medium">
            Bind to app <span className="text-[10px] font-normal text-muted-foreground">Coming soon</span>
          </div>
          <input
            value={profile.bindExe}
            onChange={(e) => setBindExe(profile.id, e.target.value)}
            placeholder="game.exe"
            className="neu-inset h-8 rounded-lg px-2.5 text-xs outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {active ? (
            <div className="flex h-9 flex-1 items-center justify-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5" />In use</div>
          ) : (
            <Btn variant="primary" className="flex-1" onClick={() => setActiveProfile(profile.id)}>Set active</Btn>
          )}
          <Btn icon aria-label="Rename" onClick={() => { setName(profile.name); setEditing(true); }}><Pencil className="size-3.5" /></Btn>
          <Btn icon aria-label="Duplicate" onClick={() => duplicateProfile(profile.id)}><Copy className="size-3.5" /></Btn>
          <Btn icon variant="danger" aria-label="Delete" disabled={!canDelete} onClick={() => deleteProfile(profile.id)}><Trash2 className="size-3.5" /></Btn>
        </div>
      </Glass>
    </motion.div>
  );
}
