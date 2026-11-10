import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type OrbMood = "idle" | "listening" | "thinking" | "negotiating" | "happy" | "sad";

const TONE: Record<OrbMood, string> = {
  idle: "text-secondary",
  listening: "text-primary",
  thinking: "text-secondary",
  negotiating: "text-accent",
  happy: "text-primary",
  sad: "text-muted-foreground",
};

interface Props {
  mood?: OrbMood;
  size?: number;
  className?: string;
  /** Short line shown in a speech bubble */
  say?: string;
  /** -1..1 horizontal gaze override (e.g. typing progress) */
  gazeX?: number | undefined;
}

export function HaggleOrb({ mood = "idle", size = 220, className, say, gazeX }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const ex = useSpring(mx, { stiffness: 180, damping: 18 });
  const ey = useSpring(my, { stiffness: 180, damping: 18 });
  const [blink, setBlink] = useState(false);

  // Eyes follow the pointer unless a mood/gaze dictates otherwise.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (gazeX !== undefined || mood === "thinking") return;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      mx.set(Math.max(-1, Math.min(1, dx * 2.4)) * size * 0.06);
      my.set(Math.max(-1, Math.min(1, dy * 2.4)) * size * 0.04);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [gazeX, mood, mx, my, size]);

  useEffect(() => {
    if (mood === "thinking") {
      mx.set(size * 0.04);
      my.set(-size * 0.04);
    } else if (gazeX !== undefined) {
      mx.set(gazeX * size * 0.06);
      my.set(size * 0.035);
    }
  }, [mood, gazeX, mx, my, size]);

  useEffect(() => {
    const id = window.setInterval(
      () => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
      },
      3200 + Math.random() * 1800,
    );
    return () => window.clearInterval(id);
  }, []);

  const eyeW = size * 0.11;
  const eyeH =
    mood === "listening" ? size * 0.16 : mood === "negotiating" ? size * 0.06 : size * 0.13;
  const happy = mood === "happy";
  const sad = mood === "sad";

  return (
    <div
      ref={ref}
      className={cn("relative grid place-items-center", TONE[mood], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* halo */}
      <motion.div
        className="absolute inset-[-18%] rounded-full bg-current opacity-25 blur-3xl"
        animate={{ scale: mood === "thinking" || mood === "negotiating" ? [1, 1.15, 1] : [1, 1.05, 1] }}
        transition={{ duration: mood === "negotiating" ? 1.1 : 3, repeat: Infinity }}
      />
      {/* rings */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-dashed border-current opacity-40",
          mood === "thinking" || mood === "negotiating" ? "animate-spin" : "animate-spin-slow",
        )}
        style={{ animationDuration: mood === "thinking" ? "2.5s" : undefined }}
      />
      <div className="absolute inset-[7%] rounded-full border border-current opacity-30 animate-spin-reverse" />
      <div className="absolute inset-[7%] animate-spin-slow">
        <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      </div>

      {/* body */}
      <motion.div
        className="relative grid place-items-center overflow-hidden rounded-full border border-border bg-card"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          boxShadow: "inset 0 -20px 50px -10px currentColor, 0 0 40px -10px currentColor",
        }}
        animate={
          happy
            ? { y: [0, -16, 0, -8, 0], rotate: [0, -6, 6, 0] }
            : sad
              ? { y: 6, rotate: -4 }
              : { y: [0, -6, 0] }
        }
        transition={
          happy
            ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.6 }
            : sad
              ? { duration: 0.6 }
              : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/* gloss */}
        <div className="absolute left-[18%] top-[10%] h-[22%] w-[40%] rotate-[-20deg] rounded-full bg-foreground opacity-10 blur-md" />
        {/* scan line while thinking */}
        {(mood === "thinking" || mood === "negotiating") && (
          <div className="absolute inset-x-0 top-1/2 h-1/3 bg-gradient-to-b from-transparent via-current to-transparent opacity-20 animate-scan" />
        )}
        {/* face screen */}
        <div
          className="relative flex items-center justify-center rounded-[40%] bg-background/90"
          style={{ width: size * 0.5, height: size * 0.32, gap: size * 0.09 }}
        >
          {[0, 1].map((i) => (
            <motion.div key={i} style={{ x: ex, y: ey }} className="relative">
              {happy ? (
                <div
                  className="rounded-t-full border-current"
                  style={{
                    width: eyeW * 1.15,
                    height: eyeW * 0.6,
                    borderTopWidth: size * 0.025,
                    borderLeftWidth: size * 0.025,
                    borderRightWidth: size * 0.025,
                    filter: "drop-shadow(0 0 6px currentColor)",
                  }}
                />
              ) : (
                <motion.div
                  className="rounded-full bg-current"
                  animate={{
                    height: blink ? 3 : eyeH,
                    rotate: sad ? (i === 0 ? 18 : -18) : mood === "negotiating" ? (i === 0 ? -12 : 12) : 0,
                  }}
                  transition={{ duration: 0.12 }}
                  style={{ width: eyeW, boxShadow: "0 0 14px currentColor" }}
                />
              )}
            </motion.div>
          ))}
          {/* mouth */}
          <motion.div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 rounded-full border-current",
              happy ? "border-b-[3px] bg-transparent" : "bg-current",
            )}
            style={{ bottom: size * 0.035, width: size * 0.08 }}
            animate={{
              height: happy ? size * 0.04 : 2,
              opacity: mood === "listening" ? [0.4, 1, 0.4] : 0.8,
            }}
            transition={mood === "listening" ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
          />
        </div>
      </motion.div>

      {say && (
        <motion.div
          key={say}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute -top-4 left-[78%] z-10 w-max max-w-[220px] rounded-2xl rounded-bl-sm glass px-3.5 py-2 text-xs font-semibold text-foreground"
        >
          {say}
        </motion.div>
      )}
    </div>
  );
}
