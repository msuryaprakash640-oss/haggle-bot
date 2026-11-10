import { motion } from "motion/react";
import { ArrowUpRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATALOG, formatINR, type Product } from "@/lib/haggle";
import { PRODUCT_IMAGES } from "./product-images";

export function TrendingDeals({
  onCompare,
  onNegotiate,
}: {
  onCompare: (p: Product) => void;
  onNegotiate: (p: Product) => void;
}) {
  return (
    <section id="trending" className="relative scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-secondary">02 · Trending deals</div>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">Deals worth chasing.</h2>
            <p className="mt-3 text-muted-foreground">Discover popular products and let AI find a better price.</p>
          </div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATALOG.map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 160, damping: 20 }}
              whileHover={{ y: -8 }}
              className="group glass flex flex-col overflow-hidden rounded-3xl"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={PRODUCT_IMAGES[p.id]}
                  alt={p.name}
                  loading="lazy"
                  width={816}
                  height={816}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <span className="absolute left-3 top-3 rounded-full glass px-2.5 py-1 font-mono text-[11px] text-foreground">
                  from {formatINR(p.listPrice)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-semibold">{p.short}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-5 grid grid-cols-1 gap-2">
                  <Button variant="glass" size="sm" className="h-10" onClick={() => onCompare(p)}>
                    <Scale /> Compare Prices
                  </Button>
                  <Button variant="hero" size="sm" className="h-10" onClick={() => onNegotiate(p)}>
                    Negotiate Now <ArrowUpRight />
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
