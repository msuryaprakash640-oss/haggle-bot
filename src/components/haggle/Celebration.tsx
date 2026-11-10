import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/haggle";
import { AnimatedNumber } from "./AnimatedNumber";
import { HaggleOrb } from "./HaggleOrb";

async function burst() {
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#c6ff3d", "#3de0ff", "#ff4f6d", "#ffffff"];
  const end = Date.now() + 1400;
  confetti({ particleCount: 160, spread: 100, origin: { y: 0.55 }, colors, zIndex: 100 });
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 100 });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 100 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function Celebration({
  open,
  onClose,
  productName,
  finalPrice,
  savings,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  finalPrice: number;
  savings: number;
  onPay: () => void;
}) {
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    if (open) {
      setPaid(false);
      void burst();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-label="Deal approved"
        >
          <motion.div
            initial={{ scale: 0.6, y: 40, rotate: -4 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="neon-border relative w-full max-w-md overflow-hidden rounded-3xl bg-card p-8 text-center"
          >
            <div className="pointer-events-none absolute inset-0 bg-hero opacity-70" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-surface-strong hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <div className="relative">
              <div className="mx-auto w-fit">
                <HaggleOrb mood="happy" size={140} />
              </div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-4 font-display text-3xl font-black text-gradient"
              >
                Deal locked!
              </motion.h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {productName} for <span className="font-mono font-bold text-foreground">{formatINR(finalPrice)}</span>
              </p>
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">You saved</div>
                <AnimatedNumber value={savings} duration={2.2} className="mt-1 block font-mono text-4xl font-black text-primary" />
              </div>

              <div className="mt-6 space-y-3">
                <div className="font-display text-sm font-semibold">Love the deal? Make it yours.</div>
                <Button
                  variant="neon"
                  size="xl"
                  className="w-full"
                  disabled={paid}
                  onClick={() => {
                    setPaid(true);
                    onPay();
                    toast.success("Demo checkout complete", {
                      description: "Sandbox only — no real payment was made and nothing was purchased.",
                    });
                  }}
                >
                  <Lock /> {paid ? "Demo payment recorded" : "Continue with PayPal"}
                </Button>
                <Button asChild variant="glass" size="lg" className="w-full">
                  <Link to="/deals">View My Deals</Link>
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Demo transactions are clearly identified. Sandbox payments do not purchase products from
                  external retailers.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
