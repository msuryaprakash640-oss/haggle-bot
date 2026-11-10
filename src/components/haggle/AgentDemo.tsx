import { useInView } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/haggle";
import { HaggleOrb } from "./HaggleOrb";
import { NegotiationChat, useScriptPlayer } from "./NegotiationChat";

const SCRIPT: ChatMessage[] = [
  { role: "user", text: "I want these headphones under ₹8,000." },
  { role: "bot", text: "I found an offer at ₹9,499. Let's try negotiating for ₹7,500." },
  { role: "seller", text: "We can offer ₹8,500." },
  { role: "bot", text: "That's above your budget. Let me try one more offer." },
  { role: "seller", text: "Our best simulated offer is ₹7,900!" },
  { role: "bot", text: "Great! That's within your budget. Would you like to review this deal?" },
];

export function AgentDemo({ onTry }: { onTry: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [round, setRound] = useState(0);
  const [finished, setFinished] = useState(false);
  // New array identity per round restarts the player.
  const script = useMemo(() => (round >= 0 ? [...SCRIPT] : SCRIPT), [round]);
  const { visible, typing } = useScriptPlayer(inView ? script : null, {
    playing: inView,
    onDone: () => setFinished(true),
  });
  const mood = finished ? "happy" : typing === "seller" ? "thinking" : visible.length ? "negotiating" : "idle";

  return (
    <section id="agent" className="relative py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-accent">03 · Meet your negotiation agent</div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-5xl">
            You set the limit.
            <br />
            <span className="text-gradient">AI does the bargaining.</span>
          </h2>
          <p className="mt-5 max-w-md text-muted-foreground">
            Your personal AI negotiator works to bring prices down without crossing your budget.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <HaggleOrb mood={mood} size={120} />
            <div className="space-y-3">
              <Button variant="coral" size="xl" onClick={onTry}>
                <Play /> Try AI Negotiation
              </Button>
              <button
                onClick={() => {
                  setFinished(false);
                  setRound((r) => r + 1);
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" /> Replay example
              </button>
            </div>
          </div>
        </div>
        <div ref={ref}>
          <NegotiationChat messages={visible} typing={typing} height="h-[460px]" />
          <p className="mt-3 text-center text-xs italic text-muted-foreground">
            Demo conversations use simulated seller responses. No real seller acceptance is implied.
          </p>
        </div>
      </div>
    </section>
  );
}
