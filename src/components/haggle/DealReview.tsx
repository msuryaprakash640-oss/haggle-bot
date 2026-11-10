import { motion } from "motion/react";
import { BadgeCheck, ShieldCheck, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, type NegotiationResult } from "@/lib/haggle";
import { AnimatedNumber } from "./AnimatedNumber";

export function DealReview({
  productName,
  image,
  result,
  onApprove,
  onReject,
  decided,
}: {
  productName: string;
  image?: string | undefined;
  result: NegotiationResult;
  onApprove: () => void;
  onReject: () => void;
  decided: "approved" | "rejected" | null;
}) {
  const final = result.finalPrice!;
  const pct = Math.round((result.savings / result.startPrice) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 20 }}
      className="neon-border overflow-hidden rounded-3xl bg-card"
    >
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="relative min-h-44 bg-muted">
          {image ? (
            <img src={image} alt={productName} className="absolute inset-0 size-full object-cover" loading="lazy" width={816} height={816} />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-hero font-display text-5xl text-gradient">
              {productName.charAt(0)}
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            −{pct}%
          </span>
        </div>
        <div className="p-6">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary">
            Your deal, your decision
          </div>
          <h3 className="mt-1 font-display text-xl font-bold">{productName}</h3>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Original price">
              <span className="text-muted-foreground line-through">{formatINR(result.startPrice)}</span>
            </Stat>
            <Stat label="Negotiated price">
              <AnimatedNumber value={final} from={result.startPrice} className="text-primary" />
            </Stat>
            <Stat label="Total savings">
              <AnimatedNumber value={result.savings} duration={2} className="text-success" />
            </Stat>
            <Stat label="Seller">
              <span className="inline-flex items-center gap-1.5">
                <Store className="size-4 text-secondary" /> {result.seller}
              </span>
            </Stat>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {decided === null ? (
              <>
                <Button variant="hero" size="xl" onClick={onApprove}>
                  <BadgeCheck /> Approve Deal
                </Button>
                <Button variant="glass" size="xl" onClick={onReject}>
                  <X /> Reject Deal
                </Button>
              </>
            ) : (
              <div className="font-semibold">
                {decided === "approved" ? "Deal approved ✓" : "Deal rejected — nothing was purchased."}
              </div>
            )}
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> Your purchase is never made without your permission.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-bold">{children}</dd>
    </div>
  );
}
