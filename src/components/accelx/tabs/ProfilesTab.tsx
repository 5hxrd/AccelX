import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useCurveStore } from "@/store/useCurveStore";
import { Btn } from "../Controls";
import { ProfileCard } from "../ProfileCard";

export function ProfilesTab() {
  const profiles = useCurveStore((s) => s.profiles);
  const activeId = useCurveStore((s) => s.activeProfileId);
  const addProfile = useCurveStore((s) => s.addProfile);
  return (
    <div className="flex h-full flex-col gap-5 px-2 pt-2">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Profiles</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Save curves for different games and apps.</p>
        </div>
        <Btn variant="primary" onClick={addProfile}><Plus className="size-4" />New profile</Btn>
      </div>
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          <AnimatePresence>
            {profiles.map((p) => <ProfileCard key={p.id} profile={p} active={p.id === activeId} canDelete={profiles.length > 1} />)}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
