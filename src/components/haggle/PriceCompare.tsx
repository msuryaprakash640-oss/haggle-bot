import { motion } from "motion/react";
import { Star, Truck, Zap } from "lucide-react";
import { formatINR, type Offer } from "@/lib/haggle";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export function PriceCompare({ offers, budget }: { offers: Offer[]; budget: number }) {
  const highest = Math.max(...offers.map((o) => o.price));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {offers.map((o, i) => {
        const best = i === 0;
        const save = highest - o.price;
        const within = o.price <= budget;
        return (
          <motion.div
            key={o.seller}
            initial={{ opacity: 0, y: 24, rotateX: -20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: i * 0.15, type: "spring", stiffness: 200, damping: 20 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-4",
              best ? "neon-border bg-primary/8 glow-primary" : "glass",
            )}
          >
            {best && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                <Zap className="size-3" /> Best
              </span>
            )}
            <div className="font-display text-sm font-semibold">{o.seller}</div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-current text-primary" /> {o.rating}
              </span>
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3" /> {o.deliveryDays}d
              </span>
            </div>
            <AnimatedNumber
              value={o.price}
              from={highest * 1.25}
              className="mt-3 block font-mono text-2xl font-bold"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={within ? "text-success" : "text-accent"}>
                {within ? "Within budget" : `${formatINR(o.price - budget)} over`}
              </span>
              {save > 0 && (
                <span className="font-mono text-primary">
                  −<AnimatedNumber value={save} duration={1.8} />
                </span>
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 animate-shimmer opacity-40" />
          </motion.div>
        );
      })}
    </div>
  );
}
