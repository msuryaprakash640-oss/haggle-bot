import { motion } from "motion/react";
import { Check, Handshake, Radar, Scale, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGES = [
  { key: "searching", label: "Searching", icon: Radar },
  { key: "comparing", label: "Comparing", icon: Scale },
  { key: "negotiating", label: "Negotiating", icon: Handshake },
  { key: "found", label: "Deal Found", icon: Trophy },
] as const;

/** active: index of the running stage; complete when the final stage is done */
export function StageProgress({ active, complete }: { active: number; complete: boolean }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[12%] right-[12%] top-6 h-0.5 rounded-full bg-surface-strong">
          <motion.div
            className="h-full rounded-full bg-neon"
            animate={{ width: `${(Math.min(active, 3) / 3) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        </div>
        {STAGES.map((s, i) => {
          const done = i < active || (complete && i === active);
          const current = i === active && !complete;
          const Icon = done ? Check : s.icon;
          return (
            <div key={s.key} className="relative z-10 flex w-1/4 flex-col items-center gap-2">
              <motion.div
                animate={current ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 1, repeat: current ? Infinity : 0 }}
                className={cn(
                  "grid size-12 place-items-center rounded-full border transition-colors duration-500",
                  done && "border-primary bg-primary text-primary-foreground glow-primary",
                  current && "border-secondary bg-secondary/15 text-secondary glow-cyan",
                  !done && !current && "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", current && s.key === "searching" && "animate-spin")} />
              </motion.div>
              <span
                className={cn(
                  "text-center font-mono text-[10px] uppercase tracking-widest sm:text-xs",
                  done || current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
