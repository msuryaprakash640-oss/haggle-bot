import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Bot, Store, User } from "lucide-react";
import type { ChatMessage, Speaker } from "@/lib/haggle";
import { cn } from "@/lib/utils";

/** Reveals a scripted conversation one message at a time with typing pauses. */
export function useScriptPlayer(
  script: ChatMessage[] | null,
  opts: { playing: boolean; onDone?: () => void; speed?: number },
) {
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState<Speaker | null>(null);
  const done = useRef(opts.onDone);
  done.current = opts.onDone;

  useEffect(() => {
    setCount(0);
    setTyping(null);
    if (!script || !opts.playing) return;
    const timers: number[] = [];
    let t = 300;
    const speed = opts.speed ?? 1;
    script.forEach((m, i) => {
      const typeFor = (m.role === "user" ? 350 : Math.min(1900, 650 + m.text.length * 16)) / speed;
      timers.push(window.setTimeout(() => setTyping(m.role), t));
      t += typeFor;
      timers.push(
        window.setTimeout(() => {
          setTyping(null);
          setCount(i + 1);
        }, t),
      );
      t += 350 / speed;
    });
    timers.push(window.setTimeout(() => done.current?.(), t + 200));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [script, opts.playing, opts.speed]);

  return { visible: script ? script.slice(0, count) : [], typing };
}

const META: Record<Speaker, { label: string; icon: typeof Bot; bubble: string; avatar: string }> = {
  user: {
    label: "You",
    icon: User,
    bubble: "bg-lime text-primary-foreground rounded-br-sm",
    avatar: "bg-primary text-primary-foreground",
  },
  bot: {
    label: "Haggle Bot",
    icon: Bot,
    bubble: "bg-secondary/12 border border-secondary/30 text-foreground rounded-bl-sm",
    avatar: "bg-secondary text-secondary-foreground glow-cyan",
  },
  seller: {
    label: "Seller (Simulation)",
    icon: Store,
    bubble: "bg-accent/12 border border-accent/30 text-foreground rounded-bl-sm",
    avatar: "bg-accent text-accent-foreground",
  },
};

export function NegotiationChat({
  messages,
  typing,
  className,
  height = "h-[420px]",
  title = "Live negotiation",
  statusLabel = "encrypted · simulated",
}: {
  messages: ChatMessage[];
  typing: Speaker | null;
  className?: string;
  height?: string;
  title?: string;
  statusLabel?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  return (
    <div className={cn("glass rounded-3xl", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
          </span>
          {title}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {statusLabel}
        </span>
      </div>
      <div ref={scroller} className={cn("space-y-4 overflow-y-auto p-5", height)}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Bubble key={i} m={m} />
          ))}
          {typing && <Typing key="typing" role={typing} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const meta = META[m.role];
  const mine = m.role === "user";
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}
    >
      <div className={cn("grid size-8 shrink-0 place-items-center rounded-full", meta.avatar)}>
        <Icon className="size-4" />
      </div>
      <div className={cn("max-w-[80%]", mine && "text-right")}>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {meta.label}
        </div>
        <div className={cn("inline-block whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed", meta.bubble)}>
          {m.text}
        </div>
      </div>
    </motion.div>
  );
}

function Typing({ role }: { role: Speaker }) {
  const meta = META[role];
  const Icon = meta.icon;
  const mine = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}
    >
      <div className={cn("grid size-8 shrink-0 place-items-center rounded-full", meta.avatar)}>
        <Icon className="size-4" />
      </div>
      <div className={cn("flex gap-1 rounded-2xl px-4 py-3.5", meta.bubble)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot size-1.5 rounded-full bg-current"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </motion.div>
  );
}
